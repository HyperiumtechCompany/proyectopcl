import { describe, expect, it } from 'vitest';
import { siteExportChecklist } from './siteExportChecklist';
import { calculateSiteLighting, siteLuminaires } from './siteLightingCalculation';
import type { SiteData, SiteElement } from './types';

const square = (id: string, type: SiteElement['type'], x0: number, size: number, extra: Partial<SiteElement> = {}): SiteElement => ({
    id,
    type,
    label: id,
    vertices: [
        { x: x0, y: 0 },
        { x: x0 + size, y: 0 },
        { x: x0 + size, y: size },
        { x: x0, y: size },
    ],
    style: { fillColor: '#000', strokeColor: '#000' },
    ...extra,
});
const pole = (id: string, x: number, config: Record<string, unknown> = {}): SiteElement => ({
    ...square(id, 'pole', x, 0.2),
    vertices: [{ x, y: 5 }],
    config: { kind: 'pole', heightM: 6, armLengthM: 0, armDirectionDeg: 0, fixtures: 1, lumens: 5000, ...config } as SiteElement['config'],
});
const site = (elements: SiteElement[]): SiteData => ({ schemaVersion: 1, terrainScaleM: 1, layers: [], elements, circuits: [] }) as unknown as SiteData;

describe('revisión antes de exportar el PDF', () => {
    const plant = site([square('patio', 'custom_zone', 0, 10), square('vereda', 'sidewalk', 20, 4), pole('p1', 5)]);

    it('sin cálculo (o desactualizado) es OBLIGATORIO y ofrece calcular', () => {
        const none = siteExportChecklist({ site: plant, calculation: null, calculationStale: false, outputRows: [], feeds: {} });
        expect(none.find((item) => item.id === 'no-calculation')).toMatchObject({ level: 'required', action: 'calculate' });
        const calc = calculateSiteLighting(plant, new Map());
        const stale = siteExportChecklist({ site: plant, calculation: calc, calculationStale: true, outputRows: [], feeds: {} });
        expect(stale.find((item) => item.id === 'stale-calculation')?.level).toBe('required');
    });

    it('con cálculo vigente solo quedan avisos recomendados (espacio sin luminarias, luminaria genérica, sin norma)', () => {
        const calc = calculateSiteLighting(plant, new Map());
        const items = siteExportChecklist({ site: plant, calculation: calc, calculationStale: false, outputRows: [], feeds: {} });
        expect(items.every((item) => item.level === 'recommended')).toBe(true);
        expect(items.find((item) => item.id === 'unlit-spaces')?.detail).toContain('vereda');
        expect(items.find((item) => item.id === 'generic-luminaires')?.detail).toContain('p1');
        expect(items.some((item) => item.id === 'no-norm')).toBe(true);
    });

    it('edificio de módulo sin alimentador desde la planta', () => {
        const withBlock = site([...plant.elements, square('edificio', 'building_block', 40, 10, { moduleId: 8, moduleName: 'Módulo 1' })]);
        const items = siteExportChecklist({ site: withBlock, calculation: null, calculationStale: false, outputRows: [], feeds: {} });
        expect(items.find((item) => item.id === 'unfed-buildings')?.detail).toContain('Módulo 1');
    });
});

describe('luminarias de piso', () => {
    it('bolardo: sin brazo, a su altura; empotrada en piso: fuera del cálculo horizontal y avisada', () => {
        const plant = site([
            square('patio', 'custom_zone', 0, 10),
            pole('b1', 3, { mount: 'bollard', heightM: 1, armLengthM: 2, fixtures: 3 }),
            pole('g1', 7, { mount: 'inground', heightM: 0 }),
        ]);
        const lums = siteLuminaires(plant, new Map());
        expect(lums).toHaveLength(1);
        expect(lums[0]).toMatchObject({ poleId: 'b1', x: 3, headElevationM: 1 });
        const calc = calculateSiteLighting(plant, new Map());
        expect(calc.warnings.some((w) => w.startsWith('1 luminaria(s) empotrada(s) en piso'))).toBe(true);
        expect(calc.areas[0].result.avg_lux).toBeGreaterThan(0);
    });
});
