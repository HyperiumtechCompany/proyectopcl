import { describe, expect, it } from 'vitest';
import { calculateSiteLighting } from '../domain/siteLightingCalculation';
import type { SiteData, SiteElement } from '../domain/types';
import { buildSiteFormalDocument } from './buildSiteFormalDocument';
import { renderSitePlanSvg } from './siteSvgPlan';

const square = (id: string, type: SiteElement['type'], x: number, y: number, size: number, extra: Partial<SiteElement> = {}): SiteElement => ({
    id,
    type,
    label: id,
    vertices: [
        { x, y },
        { x: x + size, y },
        { x: x + size, y: y + size },
        { x, y: y + size },
    ],
    style: { fillColor: '#cbd5e1', strokeColor: '#334155' },
    ...extra,
});

const site: SiteData = {
    schemaVersion: 1,
    terrainScaleM: 1,
    gridSizeM: 1,
    canvasWidth: 200,
    canvasHeight: 200,
    elements: [
        square('Cancha', 'court', 0, 0, 30, {
            normReq: { activities: { exterior: 'EN 12464-2 · Circulación › Tránsito vehicular regular (máx. 40 km/h)' } },
        }),
        square('P1', 'pole', 14.7, 14.7, 0.6, {
            config: { kind: 'pole', heightM: 8, armLengthM: 0, armDirectionDeg: 0, fixtures: 1, lumens: 12000, wattage: 100 },
        }),
    ],
    feederPaths: [],
    circuits: [],
    layers: [],
};

describe('informe PDF de la planta general (D2)', () => {
    const calculation = calculateSiteLighting(site, new Map());
    const document = buildSiteFormalDocument({
        site,
        projectName: 'Colegio <A&B>',
        calculation,
        outputRows: [],
        regions: ['exterior'],
        generatedAt: new Date('2026-09-25T12:00:00Z'),
    });

    it('páginas en orden con numeración continua e índice que apunta a ellas', () => {
        expect(document.pages.map((page) => page.kind)).toEqual([
            'cover',
            'toc',
            'site-section',
            'terrain-cad',
            'terrain-cad',
            'site-section',
            // Ficha de la zona "Cancha" con las páginas por ambiente de la V1.
            'ambient-summary',
            'ambient-plan',
            'ambient-luminaires',
            'ambient-calculation-object',
            'ambient-useful-plane',
            'site-section',
            'site-section',
        ]);
        expect(document.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
        expect(document.toc.length).toBeGreaterThanOrEqual(2);
        for (const entry of document.toc) {
            expect(document.pages.some((page) => page.pageNumber === entry.pageNumber && entry.title.endsWith(page.title))).toBe(true);
        }
    });

    it('todas las páginas referencian assets existentes', () => {
        const ids = new Set(document.assets.map((asset) => asset.id));
        for (const page of document.pages) {
            for (const id of page.assetIds) expect(ids.has(id)).toBe(true);
        }
    });

    it('la tabla de superficies trae el resultado del motor V1 y la comparación con la norma, nunca "cumple"', () => {
        const areas = document.assets.find((asset) => asset.id === 'site-areas');
        expect(areas?.kind).toBe('structured');
        const data = (areas as { data: { rows: Array<Record<string, string>> } }).data;
        expect(data.rows).toHaveLength(1);
        expect(data.rows[0].name).toBe('Cancha');
        expect(data.rows[0].em).toBe(calculation.areas[0].result.avg_lux.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
        expect(data.rows[0].norm).toMatch(/20 lx → (≥ norma|< norma)/);
        expect(JSON.stringify(document)).not.toMatch(/cumple/i);
    });

    it('sin cálculo: sin página de falsos colores ni de superficies, y lo advierte', () => {
        const bare = buildSiteFormalDocument({ site, projectName: 'X', calculation: null, outputRows: [], regions: ['exterior'] });
        expect(bare.pages.some((page) => page.title === 'Falsos colores')).toBe(false);
        expect(bare.pages.some((page) => page.title === 'Superficies de cálculo')).toBe(false);
        expect(bare.pages[2].notes.join(' ')).toMatch(/No se ejecutó "Calcular alumbrado"/);
    });

    it('SVG del plano en metros con los falsos colores y texto escapado', () => {
        const plain = renderSitePlanSvg({ ...site, elements: [...site.elements, square('A&B <x>', 'custom_zone', 40, 0, 5)] });
        expect(plain.svg).toContain('A&amp;B &lt;x&gt;');
        const withLux = renderSitePlanSvg(site, { calculation });
        expect(withLux.svg.length).toBeGreaterThan(plain.svg.length);
        expect(withLux.svg).toContain('Iluminancia (lx)');
    });

    it('ficha de zona como un ambiente de la V1: resultados, luminarias con posición y assets', () => {
        const [detail] = document.ambientDetails;
        const area = calculation.areas[0];
        expect(detail.ambientId).toBe('site-Cancha');
        expect(detail.avgLux).toBe(area.result.avg_lux);
        expect(detail.targetLux).toBe(20);
        expect(detail.uniformityTarget).toBe(0.4);
        expect(detail.fixtureCount).toBe(1);
        expect(detail.fixturePositions[0].mountingHeight).toBeCloseTo(8, 6);
        expect(detail.luminaires[0].quantity).toBe(1);
        expect(detail.luminaires[0].powerWatts).toBe(100);
        expect(detail.complianceLabel).toMatch(/^(≥ norma|< norma)/);
        // Nunca "Conforme": catálogo exterior pendiente de confirmar.
        expect(detail.requirementEvaluations.every((item) => item.status === 'not-evaluated')).toBe(true);
        expect(detail.reflectionCeiling).toBeNull();
        expect(detail.ugr).toBeNull();
        const ids = new Set(document.assets.map((asset) => asset.id));
        expect(ids.has(detail.planAssetId!)).toBe(true);
        expect(ids.has(detail.isoluxAssetId!)).toBe(true);
        for (const page of document.pages.filter((item) => item.ambientId)) {
            expect(page.ambientId).toBe(detail.ambientId);
        }
    });

    it('índice: una entrada por zona (su resumen), no por cada subpágina', () => {
        const zoneEntries = document.toc.filter((entry) => entry.title.startsWith('Zona:'));
        expect(zoneEntries).toHaveLength(1);
        expect(zoneEntries[0].level).toBe(1);
    });

    it('la ficha es de un ESPACIO exterior (tipo, proyección, superficie), no de un recinto', () => {
        const [detail] = document.ambientDetails;
        expect(detail.exterior?.spaceType).toBe('Cancha deportiva');
        expect(detail.exterior?.surface).toMatch(/^A nivel del suelo \(cota 0\.00 m\), malla de/);
        expect(detail.exterior?.projection).toMatch(/Sin proyección: iluminada por 1 luminaria/);
    });
});

