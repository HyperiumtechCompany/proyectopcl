import { describe, expect, it } from 'vitest';
import { calculateLightingResult, GRID_SPACING } from '@/pages/dialux/hooks/lightingEngineCore';
import type { Fixture, LightingResult, Room } from '@/pages/dialux/hooks/types';
import { compareResultGrids } from './compareResultGrids';

function buildRoom(side = 4, height = 3): Room {
    return {
        id: 'grid-diff-room',
        name: 'Recinto de referencia — diff de mallas',
        roomType: 'ambient',
        vertices: [
            { x: 0, y: 0 },
            { x: side, y: 0 },
            { x: side, y: side },
            { x: 0, y: side },
        ],
        height,
        color: '#000000',
        usefulPlaneHeight: 0.8,
    };
}

function buildFixture(lumens = 3000): Fixture {
    return {
        id: 'grid-diff-fixture',
        name: 'Luminaria de referencia',
        x: 2,
        y: 2,
        z: 2.8,
        lumens,
        efficiency: 1,
        fixtureType: 'panel',
        lightColor: '#ffffff',
    };
}

describe('Fase 11 — compareResultGrids', () => {
    it('con la misma malla, calcula un delta por punto (positivo cuando la comparación es más brillante)', () => {
        const room = buildRoom();
        const baseline = calculateLightingResult(room, [buildFixture(2000)], GRID_SPACING, []);
        const comparison = calculateLightingResult(room, [buildFixture(4000)], GRID_SPACING, []);

        const diff = compareResultGrids(baseline, comparison)!;

        expect(diff).not.toBeNull();
        expect(diff.rows).toBe(baseline.grid_rows);
        expect(diff.cols).toBe(baseline.grid_cols);
        expect(diff.points).toHaveLength(baseline.grid_values.length);

        for (const point of diff.points) {
            if (point.delta !== null) {
                expect(point.delta).toBeGreaterThan(0); // el doble de lúmenes siempre alumbra más, punto por punto
            }
        }
        expect(diff.maxAbsDelta).toBeGreaterThan(0);
    });

    it('comparar un resultado consigo mismo da delta 0 en todos los puntos activos', () => {
        const room = buildRoom();
        const result = calculateLightingResult(room, [buildFixture()], GRID_SPACING, []);

        const diff = compareResultGrids(result, result)!;

        for (const point of diff.points) {
            if (point.valueA !== null) {
                expect(point.delta).toBe(0);
            }
        }
        expect(diff.maxAbsDelta).toBe(0);
    });

    it('devuelve null si las mallas tienen distinta forma (ej. distinto espaciado)', () => {
        const room = buildRoom();
        const fine = calculateLightingResult(room, [buildFixture()], GRID_SPACING, []);
        const coarse = calculateLightingResult(room, [buildFixture()], GRID_SPACING * 2, []);

        expect(compareResultGrids(fine, coarse)).toBeNull();
    });

    it('devuelve null si falta metadata de malla (grid_origin_x/y o tamaño de celda)', () => {
        const bare: LightingResult = {
            avg_lux: 100,
            min_lux: 50,
            max_lux: 150,
            uniformity: 0.5,
            ugr: 15,
            grid_rows: 1,
            grid_cols: 1,
            grid_values: [100],
        };

        expect(compareResultGrids(bare, bare)).toBeNull();
    });
});
