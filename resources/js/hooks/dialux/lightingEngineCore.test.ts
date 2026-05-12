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
});
