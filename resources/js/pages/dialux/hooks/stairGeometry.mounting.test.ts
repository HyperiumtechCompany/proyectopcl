import { describe, expect, it } from 'vitest';
import type { Room } from './types';
import { resolveStairUndersidePoint } from './stairMountingGeometry';

const stair = (flights: NonNullable<Room['stairConfig']>['flights']): Room =>
    ({
        id: 'stair-1',
        name: 'Escalera',
        roomType: 'stair',
        vertices: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 6 },
            { x: 0, y: 6 },
        ],
        height: 3,
        stairConfig: {
            normativeUse: 'generic',
            orientation: 'south',
            riserHeight: 0.15,
            treadDepth: 0.3,
            stairWidth: 1.2,
            stepCount: flights.reduce(
                (sum, flight) => sum + flight.stepCount,
                0,
            ),
            flights,
            hasBaseSlab: true,
            isInterFloor: true,
        },
    }) as Room;

describe('resolveStairUndersidePoint', () => {
    it('centra la luminaria bajo el tramo y eleva el cable siguiendo la pendiente', () => {
        const room = stair([
            {
                id: 'flight-1',
                direction: 'south',
                stepCount: 10,
                hasLanding: false,
                landingDepth: 0,
            },
        ]);
        const low = resolveStairUndersidePoint(room, { x: 0.2, y: 0.8 });
        const high = resolveStairUndersidePoint(room, { x: 3.8, y: 2.4 });

        expect(low?.kind).toBe('flight');
        expect(low?.x).toBeCloseTo(2);
        expect(high?.x).toBeCloseTo(2);
        expect(high!.height).toBeGreaterThan(low!.height);
    });

    it('coloca una luminaria debajo y al centro del descanso', () => {
        const room = stair([
            {
                id: 'flight-1',
                direction: 'south',
                stepCount: 10,
                hasLanding: true,
                landingDepth: 1.2,
            },
            {
                id: 'flight-2',
                direction: 'north',
                stepCount: 10,
                hasLanding: false,
                landingDepth: 0,
            },
        ]);
        const mount = resolveStairUndersidePoint(room, { x: 2, y: 5.7 });

        expect(mount?.kind).toBe('landing');
        expect(mount?.x).toBeCloseTo(2);
        expect(mount?.y).toBeCloseTo(5.4);
        expect(mount!.height).toBeGreaterThan(1);
    });
});
