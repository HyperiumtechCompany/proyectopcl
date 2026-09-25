import { describe, expect, it } from 'vitest';
import type { LuminairePhotometry } from '../lib/luminaireCatalog';
import {
    arrangementFor,
    EDGE_OFFSET_M,
    evaluateLinearPoles,
    linearAxisOf,
    linearPolePositions,
    suggestLinearPoles,
} from './siteLinearProjection';
import type { PoleConfig, SiteData, SiteElement } from './types';

/** Rectángulo de `length` × `width` m girado `deg` alrededor del origen. */
function strip(
    id: string,
    type: SiteElement['type'],
    length: number,
    width: number,
    deg = 0,
    config?: SiteElement['config'],
): SiteElement {
    const t = (deg * Math.PI) / 180;
    const rot = (x: number, y: number) => ({
        x: 100 + x * Math.cos(t) - y * Math.sin(t),
        y: 100 + x * Math.sin(t) + y * Math.cos(t),
    });
    return {
        id,
        type,
        label: id,
        vertices: [rot(0, 0), rot(length, 0), rot(length, width), rot(0, width)],
        style: { fillColor: '#000', strokeColor: '#000' },
        ...(config ? { config } : {}),
    };
}

const site = (elements: SiteElement[]): SiteData => ({
    schemaVersion: 1,
    terrainScaleM: 1,
    gridSizeM: 1,
    canvasWidth: 400,
    canvasHeight: 400,
    elements,
    feederPaths: [],
    circuits: [],
    layers: [],
});

const POLE: PoleConfig = {
    kind: 'pole',
    heightM: 8,
    armLengthM: 1.5,
    armDirectionDeg: 0,
    fixtures: 1,
    lumens: 8000,
    maintenanceFactor: 0.8,
};

describe('proyección lineal de postes (calles, pasadizos, rampas, escaleras)', () => {
    it('encuentra el eje de un espacio girado: largo, ancho y dirección', () => {
        const axis = linearAxisOf(strip('calle', 'street', 60, 7, 30), 1)!;
        expect(axis.lengthM).toBeCloseTo(60, 6);
        expect(axis.widthM).toBeCloseTo(7, 6);
        expect(Math.abs(axis.along.x * Math.cos(Math.PI / 6) + axis.along.y * Math.sin(Math.PI / 6))).toBeCloseTo(1, 6);
    });

    it('disposición por W/h (referencial): ≤1 unilateral, ≤1,5 tresbolillo, >1,5 pareada; peatonal unilateral', () => {
        expect(arrangementFor('street', 0.9)).toBe('single');
        expect(arrangementFor('street', 1.2)).toBe('staggered');
        expect(arrangementFor('street', 2)).toBe('opposite');
        expect(arrangementFor('sidewalk', 3)).toBe('single');
        expect(arrangementFor('stair', 3)).toBe('single');
    });

    it('calle de 60 × 7 m con postes de 8 m: unilateral, separación ≤ 3·h = 24 m', () => {
        const suggestion = suggestLinearPoles({
            site: site([strip('calle', 'street', 60, 7)]),
            areaId: 'calle',
            targetLux: 5,
            lumensEach: 8000,
            maintenanceFactor: 0.8,
            mountingHeightM: 8,
        })!;
        expect(suggestion.arrangement).toBe('single');
        expect(suggestion.maxSpacingM).toBe(24);
        expect(suggestion.bySpacing).toBe(3); // ceil(60 / 24)
        // Lúmenes V1: A·E/(Fm·Fu) = 420·5/(0,8·0,8) = 3281 lm → 1 luminaria.
        expect(suggestion.byLumens).toBe(1);
        expect(suggestion.count).toBe(3);
    });

    it('posiciones ½-1-1-½ por FUERA del borde y brazo hacia el eje', () => {
        const element = strip('calle', 'street', 60, 7);
        const axis = linearAxisOf(element, 1)!;
        const layout = linearPolePositions({ axis, arrangement: 'single', count: 3, scaleM: 1 });
        expect(layout.spacingM).toBeCloseTo(20, 9);
        const xs = layout.positions.map((p) => p.x).sort((a, b) => a - b);
        expect(xs[0]).toBeCloseTo(110, 6);
        expect(xs[2]).toBeCloseTo(150, 6);
        for (const [index, p] of layout.positions.entries()) {
            // A 3,5 + 0,5 m del eje (y = 103,5): fuera del borde.
            expect(Math.abs(p.y - 103.5)).toBeCloseTo(3.5 + EDGE_OFFSET_M, 6);
            // El brazo apunta hacia el eje (convención atan2(dx, dy)).
            const a = (layout.armDirectionsDeg[index] * Math.PI) / 180;
            expect(Math.sign(Math.cos(a))).toBe(Math.sign(103.5 - p.y));
        }
    });

    it('pareada: postes enfrentados en ambos bordes; tresbolillo alterna', () => {
        const axis = linearAxisOf(strip('av', 'street', 60, 20), 1)!;
        const opposite = linearPolePositions({ axis, arrangement: 'opposite', count: 6, scaleM: 1 });
        expect(opposite.positions).toHaveLength(6);
        expect(new Set(opposite.positions.map((p) => Math.round(p.y))).size).toBe(2);
        const staggered = linearPolePositions({ axis, arrangement: 'staggered', count: 4, scaleM: 1 });
        const sides = staggered.positions.map((p) => Math.sign(p.y - 110));
        expect(sides).toEqual([sides[0], -sides[0], sides[0], -sides[0]]);
    });

    it('escalera: mínimo 2 postes (arranque y llegada) y se verifica a su cota media', () => {
        const stair = strip('esc', 'stair', 6, 1.5, 0, {
            kind: 'stair',
            fromElevationM: 0,
            toElevationM: 2,
            widthM: 1.5,
            run: 'straight',
        } as SiteElement['config']);
        const plant = site([stair]);
        const suggestion = suggestLinearPoles({
            site: plant,
            areaId: 'esc',
            targetLux: 10,
            lumensEach: 1500,
            maintenanceFactor: 0.8,
            mountingHeightM: 3,
        })!;
        expect(suggestion.count).toBeGreaterThanOrEqual(2);
        const layout = linearPolePositions({ axis: suggestion.axis, arrangement: 'single', count: suggestion.count, scaleM: 1 });
        const metrics = evaluateLinearPoles({
            site: plant,
            areaId: 'esc',
            layout,
            pole: { ...POLE, heightM: 4, armLengthM: 0, lumens: 1500 },
            photometry: new Map<number, LuminairePhotometry>(),
        })!;
        expect(metrics.count).toBe(suggestion.count);
        expect(metrics.avgLux).toBeGreaterThan(0);
    });

    it('la calle proyectada se ilumina con el motor V1', () => {
        const element = strip('calle', 'street', 60, 7);
        const plant = site([element]);
        const axis = linearAxisOf(element, 1)!;
        const layout = linearPolePositions({ axis, arrangement: 'single', count: 3, scaleM: 1 });
        const metrics = evaluateLinearPoles({
            site: plant,
            areaId: 'calle',
            layout,
            pole: POLE,
            photometry: new Map(),
        })!;
        expect(metrics.avgLux).toBeGreaterThan(0);
        expect(metrics.uniformity).toBeGreaterThan(0);
    });

    it('rampa/escalera: superficie de cálculo real a cota media, con aviso — auditoría R6', () => {
        const ramp = strip('rampa', 'ramp', 12, 1.5, 0, {
            kind: 'ramp',
            fromElevationM: 0,
            toElevationM: 1,
            widthM: 1.5,
        } as SiteElement['config']);
        const plant = site([ramp]);
        const axis = linearAxisOf(ramp, 1)!;
        const layout = linearPolePositions({ axis, arrangement: 'single', count: 2, scaleM: 1 });
        const metrics = evaluateLinearPoles({
            site: plant,
            areaId: 'rampa',
            layout,
            pole: { ...POLE, heightM: 4, armLengthM: 0, lumens: 1500 },
            photometry: new Map(),
        })!;
        expect(metrics.avgLux).toBeGreaterThan(0);
        expect(metrics.warnings.some((w) => w.includes('cota media'))).toBe(true);
    });

    it('un espacio en L avisa que el eje recto es aproximado (axisFill < 0,8)', () => {
        const lShape: SiteElement = {
            id: 'L',
            type: 'sidewalk',
            label: 'L',
            vertices: [
                { x: 0, y: 0 },
                { x: 20, y: 0 },
                { x: 20, y: 2 },
                { x: 2, y: 2 },
                { x: 2, y: 20 },
                { x: 0, y: 20 },
            ],
            style: { fillColor: '#000', strokeColor: '#000' },
        };
        const suggestion = suggestLinearPoles({
            site: site([lShape]),
            areaId: 'L',
            targetLux: 10,
            lumensEach: 1500,
            maintenanceFactor: 0.8,
            mountingHeightM: 4,
        })!;
        expect(suggestion.axisFill).toBeLessThan(0.8);
    });

    it('escalera: la regla W/h usa su ancho declarado', () => {
        const stair = strip('esc', 'stair', 10, 3, 0, {
            kind: 'stair', fromElevationM: 0, toElevationM: 2, widthM: 1.2, run: 'straight',
        } as SiteElement['config']);
        const suggestion = suggestLinearPoles({
            site: site([stair]), areaId: 'esc', targetLux: 10, lumensEach: 1500, maintenanceFactor: 0.8, mountingHeightM: 4,
        })!;
        expect(suggestion.ruleWidthM).toBe(1.2);
        expect(suggestion.widthToHeight).toBeCloseTo(0.3, 9);
    });
});
