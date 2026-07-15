import { describe, expect, it } from 'vitest';
import { calculateLightingResult } from './lightingEngineCore';
import type { Fixture, Room } from './types';

describe('lightingEngineCore', () => {
    it('calculates large grids without overflowing the call stack', () => {
        const room: Room = {
            id: 'large-room',
            name: 'Gran nave',
            vertices: [
                { x: 0, y: 0 },
                { x: 200, y: 0 },
                { x: 200, y: 200 },
                { x: 0, y: 200 },
            ],
            height: 3,
            color: '#ffffff',
        };
        const fixtures: Fixture[] = [
            {
                id: 'fixture-1',
                name: 'Panel LED',
                x: 100,
                y: 100,
                z: 2.8,
                lumens: 4000,
                efficiency: 0.8,
                fixtureType: 'panel',
                lightColor: '#ffffff',
            },
        ];

        const result = calculateLightingResult(room, fixtures);

        expect(result.grid_values.length).toBeGreaterThan(100000);
        expect(result.max_lux).toBeGreaterThanOrEqual(result.min_lux);
        expect(result.avg_lux).toBeGreaterThan(0);
    });

    it('UGR uses the real candela at the fixture→observer angle, not just nadir', () => {
        // Sala alargada: la luminaria queda lejos del centro, así el ángulo
        // fixture→centro (donde se evalúa el UGR) está bien fuera del nadir.
        const room: Room = {
            id: 'ugr-room',
            name: 'Oficina alargada',
            vertices: [
                { x: 0, y: 0 },
                { x: 8, y: 0 },
                { x: 8, y: 3 },
                { x: 0, y: 3 },
            ],
            height: 3,
            color: '#ffffff',
        };

        const baseFixture = {
            id: 'fixture-1',
            name: 'Downlight',
            x: 1,
            y: 1.5,
            z: 2.8,
            lumens: 4000,
            efficiency: 0.8,
            fixtureType: 'recessed' as const,
            lightColor: '#ffffff',
        };

        // Luminaria "lambertiana" plana: misma candela en cualquier ángulo.
        const uniformFixture: Fixture = {
            ...baseFixture,
            photometricWeb: {
                c_angles: [0],
                gamma_angles: [0, 30, 60, 90],
                candela: [[100, 100, 100, 100]],
            },
        };

        // Luminaria tipo "batwing": candela baja en nadir, muy alta ~60° (fuera de eje).
        const batwingFixture: Fixture = {
            ...baseFixture,
            photometricWeb: {
                c_angles: [0],
                gamma_angles: [0, 30, 60, 90],
                candela: [[50, 200, 900, 100]],
            },
        };

        const uniformResult = calculateLightingResult(room, [uniformFixture]);
        const batwingResult = calculateLightingResult(room, [batwingFixture]);

        // Si el UGR solo mirara el nadir (candela en gamma=0: 100 vs 50), el
        // batwing daría UGR *menor*. Como el observador ve la luminaria fuera
        // de eje (~55-60°), donde el batwing tiene su pico (900 vs 100), el
        // UGR real debe ser *mayor* — solo es posible si se usa el ángulo real.
        expect(batwingResult.ugr).toBeGreaterThan(uniformResult.ugr);
    });
});
