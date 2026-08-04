import { describe, expect, it } from 'vitest';
import { calculateLightingResult, GRID_SPACING } from '@/pages/dialux/hooks/lightingEngineCore';
import type { Fixture, LightingResult, Room } from '@/pages/dialux/hooks/types';
import { findResultExtremum } from './findResultExtremum';

function buildRoom(side = 4, height = 3): Room {
    return {
        id: 'extremum-room',
        name: 'Recinto de referencia — extremos',
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

function buildOffCenterFixture(): Fixture {
    return {
        id: 'extremum-fixture',
        name: 'Luminaria de referencia',
        x: 1,
        y: 1,
        z: 2.8,
        lumens: 3000,
        efficiency: 1,
        fixtureType: 'panel',
        lightColor: '#ffffff',
    };
}

describe('Fase 11 — findResultExtremum', () => {
    it('localiza el máximo cerca de la luminaria (descentrada) y el mínimo lejos de ella', () => {
        const room = buildRoom();
        const fixture = buildOffCenterFixture();
        const result = calculateLightingResult(room, [fixture], GRID_SPACING, []);

        const max = findResultExtremum(result, 'max')!;
        const min = findResultExtremum(result, 'min')!;

        expect(max).not.toBeNull();
        expect(min).not.toBeNull();
        expect(max.value).toBeCloseTo(result.max_lux, 6);
        expect(min.value).toBeCloseTo(result.min_lux, 6);

        // El máximo debe estar más cerca de la luminaria (1,1) que el mínimo.
        const distToFixture = (p: { x: number; y: number }) => Math.hypot(p.x - fixture.x, p.y - fixture.y);
        expect(distToFixture(max)).toBeLessThan(distToFixture(min));
    });

    it('las coordenadas devueltas caen dentro del recinto', () => {
        const room = buildRoom(6, 3);
        const fixture = buildOffCenterFixture();
        const result = calculateLightingResult(room, [fixture], GRID_SPACING, []);

        const max = findResultExtremum(result, 'max')!;
        expect(max.x).toBeGreaterThanOrEqual(0);
        expect(max.x).toBeLessThanOrEqual(6);
        expect(max.y).toBeGreaterThanOrEqual(0);
        expect(max.y).toBeLessThanOrEqual(6);
    });

    it('devuelve null si el resultado no tiene metadatos de malla completos', () => {
        const bareResult: LightingResult = {
            avg_lux: 100,
            min_lux: 50,
            max_lux: 150,
            uniformity: 0.5,
            ugr: 15,
            grid_rows: 2,
            grid_cols: 2,
            grid_values: [50, 100, 100, 150],
            // sin grid_origin_x/y ni grid_cell_width/height
        };

        expect(findResultExtremum(bareResult, 'max')).toBeNull();
    });

    it('devuelve null si no hay ningún punto activo (todo null)', () => {
        const room = buildRoom();
        room.vertices = []; // fuerza grid vacío
        const result = calculateLightingResult(room, [buildOffCenterFixture()], GRID_SPACING, []);

        expect(findResultExtremum(result, 'max')).toBeNull();
    });
});
