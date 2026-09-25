import { describe, expect, it } from 'vitest';
import {
    applyRoofRule,
    canopyLightPoints,
    canopyRoofGeometry,
    gateLightPoints,
} from './siteLightPlacement';
import type { SiteElement } from './types';

/** Techado de 12 m (X) × 8 m (Y): la cumbrera corre a lo largo de X. */
const canopy = (roof: 'flat' | 'gable', rows: number, columns: number): SiteElement => ({
    id: 'techo',
    type: 'canopy',
    label: 'Techado',
    vertices: [
        { x: 0, y: 0 },
        { x: 12, y: 0 },
        { x: 12, y: 8 },
        { x: 0, y: 8 },
    ],
    config: {
        kind: 'canopy',
        heightM: 3,
        roof,
        translucent: false,
        columnSpacingM: 4,
        columnDiameterM: 0.2,
        lights: { enabled: true, count: rows * columns, rows, columns, lumens: 2000, wattage: 18 },
    } as SiteElement['config'],
    style: { fillColor: '#000', strokeColor: '#000' },
});

describe('luminarias de techado', () => {
    it('reparto ½-1-1-½: separación completa entre sí y la mitad al borde', () => {
        const points = canopyLightPoints(canopy('flat', 2, 3), 1);
        const xs = [...new Set(points.map((p) => p.x))].sort((a, b) => a - b);
        const ys = [...new Set(points.map((p) => p.y))].sort((a, b) => a - b);
        expect(xs).toEqual([2, 6, 10]); // 12 m ÷ 3 = 4 m, 2 m al borde
        expect(ys).toEqual([2, 6]); // 8 m ÷ 2 = 4 m, 2 m al borde
        // Techo plano: 15 cm bajo el alero.
        expect(points[0].heightM).toBeCloseTo(2.85, 6);
    });

    it('2 caídas: la cantidad a lo ancho sube a par y ninguna queda en la cumbrera', () => {
        const element = canopy('gable', 3, 3);
        expect(applyRoofRule(element, 1, 3, 3)).toEqual({ rows: 4, columns: 3, adjusted: true });
        const points = canopyLightPoints(element, 1);
        expect(points).toHaveLength(12);
        // Cumbrera en y = 4 (mitad del ancho de 8 m): ningún punto sobre ella.
        expect(points.some((p) => Math.abs(p.y - 4) < 1e-9)).toBe(false);
    });

    it('en 2 caídas la altura sigue la pendiente (más alta cerca de la cumbrera)', () => {
        const element = canopy('gable', 4, 1);
        const geometry = canopyRoofGeometry(element, 1);
        expect(geometry.ridgeAlongX).toBe(true);
        const points = canopyLightPoints(element, 1).sort((a, b) => a.y - b.y);
        // y = 1 (cerca del alero) más baja que y = 3 (cerca de la cumbrera).
        expect(points[1].heightM).toBeGreaterThan(points[0].heightM);
        expect(points[1].heightM).toBeCloseTo(geometry.undersideAt(6, 3) - 0.15, 6);
    });
});

describe('rumbo (C0) de las luminarias adosadas', () => {
    it('techado: el C0 corre a lo largo de la cumbrera', () => {
        // 12 × 8 m: cumbrera a lo largo de X → 0°.
        for (const point of canopyLightPoints(canopy('gable', 2, 2), 1)) {
            expect(point.rotationDeg).toBe(0);
        }
    });

    it('portón: el C0 apunta hacia el interior del predio (normal del vano)', () => {
        const gate: SiteElement = {
            id: 'porton',
            type: 'gate',
            label: 'Portón',
            vertices: [
                { x: 0, y: 0 },
                { x: 6, y: 0 },
            ],
            config: {
                kind: 'gate',
                lights: { enabled: true, count: 2, heightM: 2.8, lumens: 1500, wattage: 15 },
            } as SiteElement['config'],
            style: { fillColor: '#000', strokeColor: '#000' },
        };
        const points = gateLightPoints(gate, 1);
        expect(points).toHaveLength(2);
        // Vano horizontal: la normal es ±Y, así que el rumbo es ±90°.
        for (const point of points) {
            expect(Math.abs(Math.abs(point.rotationDeg) - 90)).toBeLessThan(1e-9);
            // El punto está desplazado hacia el lado del rumbo.
            expect(Math.sign(point.y)).toBe(Math.sign(Math.sin((point.rotationDeg * Math.PI) / 180)));
        }
    });
});
