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
            // Lista de luminarias del proyecto, lista de espacios y objetos de cálculo (V1 / DIALux evo).
            'luminaire-list',
            'site-section',
            'site-section',
            'calculation-object-list',
            // Recinto "Canchas deportivas": locales, luminarias y objetos de cálculo del grupo…
            'room-ambient-list',
            'room-luminaires',
            'calculation-object-list',
            // …y la ficha del espacio "Cancha" con las páginas por ambiente de la V1.
            'ambient-summary',
            'ambient-plan',
            'ambient-luminaires',
            'ambient-calculation-object',
            'ambient-useful-plane',
            'site-section',
            'site-section',
        ]);
        expect(document.pages.map((page) => page.pageNumber)).toEqual(document.pages.map((_, index) => index + 1));
        expect(document.toc.length).toBeGreaterThanOrEqual(2);
        const numbers = new Set(document.pages.map((page) => page.pageNumber));
        for (const entry of document.toc) expect(numbers.has(entry.pageNumber)).toBe(true);
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
        expect(data.rows[0].required).toBe('20 lx · U0 0.4');
        expect(data.rows[0].verdict).toMatch(/^(≥ norma|< norma)$/);
        const norms = document.assets.find((asset) => asset.id === 'site-norms-0') as { data: { rows: Array<Record<string, string>> } };
        expect(norms.data.rows[0].em).toMatch(/ \/ 20$/);
        expect(norms.data.rows[0].emVerdict).toMatch(/^(≥ norma|< norma)$/);
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
        // Con norma elegida se EVALÚA como la V1 (pass/fail coherente con el
        // número), citando la fuente.
        for (const item of detail.requirementEvaluations) {
            expect(item.status).toBe((item.calculatedValue ?? 0) >= (item.requiredValue ?? Infinity) ? 'pass' : 'fail');
            expect(item.source).toMatch(/EN 1(2464-2|3201-2)/);
        }
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
        const groupEntries = document.toc.filter((entry) => entry.title.startsWith('Recinto:'));
        expect(groupEntries.map((entry) => [entry.title, entry.level])).toEqual([['Recinto: Canchas deportivas (1 espacio)', 1]]);
        const zoneEntries = document.toc.filter((entry) => entry.level === 2);
        expect(zoneEntries.map((entry) => entry.title)).toEqual(['Cancha']);
    });

    it('cada ficha se calcula y lista con SUS luminarias; las vecinas solo en modo escena', () => {
        const withNeighbour: SiteData = {
            ...site,
            elements: [
                ...site.elements,
                square('Vereda', 'sidewalk', 30, 0, 10),
                square('P2', 'pole', 34.7, 4.7, 0.6, {
                    config: { kind: 'pole', heightM: 8, armLengthM: 0, armDirectionDeg: 0, fixtures: 1, lumens: 12000, wattage: 100 },
                }),
            ],
        };
        const doc = buildSiteFormalDocument({
            site: withNeighbour,
            projectName: 'Demo',
            calculation: calculateSiteLighting(withNeighbour, new Map()),
            outputRows: [],
            regions: ['exterior'],
        });
        const cancha = doc.ambientDetails.find((detail) => detail.ambientName === 'Cancha')!;
        expect(cancha.fixtureCount).toBe(1);
        expect(cancha.luminaires.reduce((sum, item) => sum + item.quantity, 0)).toBe(1);
        // Por defecto se calcula solo con SUS luminarias: nada de la vereda.
        expect(cancha.fixturePositions).toHaveLength(1);
        expect(cancha.warnings.some((w) => w.code === 'exterior-neighbour-luminaires')).toBe(false);
        expect(cancha.exterior?.luminaires).toMatch(/^Solo las luminarias del espacio/);
        expect(cancha.exterior?.reflections).toMatch(/^Cielo abierto/);
        expect([cancha.reflectionCeiling, cancha.reflectionWall, cancha.reflectionFloor]).toEqual([null, null, null]);

        // Modo "toda la escena": la vereda aporta y se avisa.
        const scene: SiteData = {
            ...withNeighbour,
            elements: withNeighbour.elements.map((element) =>
                element.id === 'Cancha' ? { ...element, calcSurface: { luminaires: 'all' as const } } : element,
            ),
        };
        const sceneDoc = buildSiteFormalDocument({
            site: scene,
            projectName: 'Demo',
            calculation: calculateSiteLighting(scene, new Map()),
            outputRows: [],
            regions: ['exterior'],
        });
        const sceneCancha = sceneDoc.ambientDetails.find((detail) => detail.ambientName === 'Cancha')!;
        expect(sceneCancha.fixtureCount).toBe(1);
        expect(sceneCancha.warnings.some((w) => w.code === 'exterior-neighbour-luminaires')).toBe(true);
        const total = doc.ambientDetails.reduce((sum, detail) => sum + detail.fixtureCount, 0);
        expect(total).toBe(doc.luminaires.reduce((sum, item) => sum + item.quantity, 0));
    });

    it('los espacios se agrupan por recinto (categoría) y el proyecto trae su lista de luminarias', () => {
        expect(document.ambientDetails.map((detail) => [detail.roomId, detail.roomName])).toEqual([
            ['site-group-canchas', 'Canchas deportivas'],
        ]);
        expect(document.luminaires.length).toBeGreaterThan(0);
        expect(document.luminaires.reduce((sum, item) => sum + item.quantity, 0)).toBe(
            document.ambientDetails[0].luminaires.reduce((sum, item) => sum + item.quantity, 0),
        );
        const list = document.pages.find((page) => page.kind === 'luminaire-list');
        expect([list?.rowRangeStart, list?.rowRangeEnd]).toEqual([0, document.luminaires.length]);
    });

    it('la ficha es de un ESPACIO exterior (tipo, proyección, superficie), no de un recinto', () => {
        const [detail] = document.ambientDetails;
        expect(detail.exterior?.spaceType).toBe('Cancha deportiva');
        expect(detail.exterior?.surface).toMatch(/^A nivel del suelo \(cota 0\.00 m\); malla [\d.]+ m — EN 12464/);
        expect(detail.exterior?.projection).toMatch(/Sin proyección: 1 luminaria\(s\) propias/);
    });

    it('toda evaluación normativa lleva unidad (el servidor rechaza una vacía: error 422)', () => {
        for (const detail of document.ambientDetails) {
            for (const evaluation of detail.requirementEvaluations) {
                expect(evaluation.unit.length).toBeGreaterThan(0);
            }
        }
        expect(document.ambientDetails[0].requirementEvaluations.map((item) => item.unit)).toEqual(['lx', 'ratio']);
    });
});


describe('PDF: alimentadores a edificios de módulo (C3)', () => {
    it('agrega la tabla con la ΔU de punta a punta y el estado, sin "cumple"', () => {
        const doc = buildSiteFormalDocument({
            site,
            projectName: 'Demo',
            calculation: null,
            outputRows: [],
            regions: ['exterior'],
            dropLimits: { feederPercent: 2.5, totalPercent: 4 },
            buildingFeeds: [
                {
                    blockId: 'b',
                    blockLabel: 'Pabellón A',
                    moduleName: 'Módulo 1',
                    panelLabel: 'TD-01',
                    fromLabel: 'TG',
                    lengthM: 48.2,
                    interiorLengthM: 6,
                    sectionMm2: 16,
                    conductorType: 'N2XOH',
                    feederPercent: 1.4,
                    worstCircuit: { code: 'C-4', panelLabel: 'TD-01', percent: 2.9 },
                    totalPercent: 4.3,
                    withinLimits: false,
                },
            ],
        });
        const page = doc.pages.find((item) => item.id === 'page-building-feeds');
        expect(page?.kind).toBe('site-section');
        const table = doc.assets.find((asset) => asset.id === 'site-building-feeds') as { data: { rows: Array<Record<string, string>> } };
        expect(table.data.rows[0]).toMatchObject({ module: 'Módulo 1 · TD-01', total: '4.30', status: 'Fuera del límite' });
        expect(JSON.stringify(table)).not.toMatch(/cumple/i);
    });
});

describe('informe formal: espacios con alumbrado, ficha de producto y modelo real', () => {
    const lit: SiteData = {
        ...site,
        elements: [
            ...site.elements.map((element) =>
                element.id === 'P1' && element.config?.kind === 'pole'
                    ? { ...element, config: { ...element.config, productId: 63 } }
                    : element,
            ),
            // Espacio SIN luminarias propias.
            square('Patio vacío', 'custom_zone', 60, 0, 10),
        ],
    };
    const web = { c_angles: [0, 90, 180, 270], gamma_angles: [0, 45, 90], candela: [[500, 300, 0], [500, 300, 0], [500, 300, 0], [500, 300, 0]], reference_lumens: 12000 };
    const photometry = new Map([[63, { id: 63, totalLumens: 12000, web }]]);
    const doc = buildSiteFormalDocument({
        site: lit,
        projectName: 'Demo',
        calculation: calculateSiteLighting(lit, photometry),
        outputRows: [],
        regions: ['exterior'],
        photometry,
        productSheets: new Map([[63, { polarDiagramAssetId: 'site-prod-63-polar', technicalTable: [{ label: 'Flujo luminoso', value: '12.000 lm' }] }]]),
        productAssets: [{ id: 'site-prod-63-polar', title: 'polar', purpose: 'ambient-catalog', kind: 'vector', mimeType: 'image/svg+xml', svg: '<svg/>', width: 640, height: 520 }],
    });

    it('solo los espacios con luminarias llevan ficha; el vacío se lista como "Sin alumbrado proyectado"', () => {
        expect(doc.ambientDetails.map((detail) => detail.ambientName)).toEqual(['Cancha']);
        const rows = (doc.assets.find((asset) => asset.id === 'site-areas') as { data: { rows: Array<Record<string, string>> } }).data.rows;
        expect(rows.find((row) => row.name === 'Patio vacío')?.verdict).toBe('Sin alumbrado proyectado');
        expect(doc.pages.some((page) => page.title === 'Patio vacío')).toBe(false);
    });

    it('la lista de luminarias usa la fotometría real y hay una ficha de producto por producto', () => {
        const item = doc.luminaires[0] as (typeof doc.luminaires)[number] & { polarDiagramAssetId?: string };
        expect(item.model).toMatch(/^Fotometría/);
        expect(item.polarDiagramAssetId).toBe('site-prod-63-polar');
        expect(item.reportData?.technical_table?.[0]).toEqual({ label: 'Flujo luminoso', value: '12.000 lm' });
        const sheet = doc.pages.find((page) => page.kind === 'product-sheet');
        expect(sheet?.sectionId).toBe(`product-sheet:${item.id}`);
        expect(sheet?.assetIds).toContain('site-prod-63-polar');
        expect(doc.assets.some((asset) => asset.id === 'site-prod-63-polar')).toBe(true);
    });
});
