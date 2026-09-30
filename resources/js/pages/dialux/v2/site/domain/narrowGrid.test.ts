import { describe, expect, it } from 'vitest';
import { existingProjection, PROJECTED_FOR_KEY } from './siteFixtureProjection';
import { areaGridFor, effectiveWidthM, en12464GridSpacingM } from './siteLightingCalculation';
import type { SiteData, SiteElement } from './types';

const strip = (id: string, length: number, width: number): SiteElement => ({
    id,
    type: 'sidewalk',
    label: id,
    vertices: [
        { x: 0, y: 0 },
        { x: length, y: 0 },
        { x: length, y: width },
        { x: 0, y: width },
    ],
    style: { fillColor: '#000', strokeColor: '#000' },
});

describe('malla de cálculo en franjas angostas (vereda de 3 m × 49 m)', () => {
    it('el ancho efectivo de una franja es su ancho (2·A/P)', () => {
        // Caso a mano: 2·(49·3)/(2·(49+3)) = 294/104 = 2,827 m.
        expect(effectiveWidthM(strip('v', 49, 3), 1)).toBeCloseTo(294 / 104, 9);
    });

    it('asegura ≥ 3 puntos a lo ancho (antes: paso 3,04 m → menos de una fila)', () => {
        const p = en12464GridSpacingM(49);
        expect(p).toBeGreaterThan(3);
        const grid = areaGridFor(undefined, 49, 3, effectiveWidthM(strip('v', 49, 3), 1));
        expect(grid.spacingM).toBeCloseTo(294 / 104 / 3, 9);
        expect(3 / grid.spacingM).toBeGreaterThanOrEqual(3 - 1e-9);
        expect(grid.basis).toMatch(/3 puntos a lo ancho/);
    });

    it('un espacio ancho sigue con el paso de la norma (sin cambios)', () => {
        const wide = strip('c', 40, 20);
        expect(areaGridFor(undefined, 40, 20, effectiveWidthM(wide, 1)).spacingM).toBeCloseTo(en12464GridSpacingM(40), 9);
    });
});

describe('proyección existente de un espacio', () => {
    it('devuelve sus postes, la configuración del poste y los parámetros guardados', () => {
        const pole = (id: string, area: string): SiteElement => ({
            id,
            type: 'pole',
            label: id,
            vertices: [{ x: 0, y: 0 }],
            style: { fillColor: '#000', strokeColor: '#000' },
            config: { kind: 'pole', heightM: 4, lumens: 2400, wattage: 20, fixtures: 1, productId: 63 } as SiteElement['config'],
            metadata: { [PROJECTED_FOR_KEY]: area },
        });
        const vereda = { ...strip('v', 49, 3), metadata: { projection: { mode: 'linear', count: 5, arrangement: 'single' } } };
        const site = { elements: [vereda, pole('a', 'v'), pole('b', 'v'), pole('x', 'otro')] } as unknown as SiteData;
        const result = existingProjection(site, 'v');
        expect(result.poles.map((element) => element.id)).toEqual(['a', 'b']);
        expect(result.pole).toMatchObject({ heightM: 4, productId: 63 });
        expect(result.saved).toMatchObject({ mode: 'linear', count: 5 });
        expect(existingProjection(site, 'nada').poles).toHaveLength(0);
    });
});

describe('superficie marcada "no evaluar"', () => {
    it('no se calcula ni aparece en el informe (ni en sus avisos)', async () => {
        const { calculateSiteLighting } = await import('./siteLightingCalculation');
        const platform: SiteElement = {
            ...strip('pl', 20, 20),
            type: 'terrace_platform',
            label: 'Plataforma',
        };
        const site = { terrainScaleM: 1, elements: [platform], circuits: [], feederPaths: [] } as unknown as SiteData;
        expect(calculateSiteLighting(site, new Map()).areas.map((area) => area.elementId)).toEqual(['pl']);
        const skipped = { ...site, elements: [{ ...platform, calcSurface: { evaluate: false } }] } as SiteData;
        expect(calculateSiteLighting(skipped, new Map()).areas).toHaveLength(0);
    });
});
