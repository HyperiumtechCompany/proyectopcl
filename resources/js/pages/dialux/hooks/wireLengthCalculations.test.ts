import { describe, expect, it } from 'vitest';
import { calculateWireLengthByWall } from './wireLengthCalculations';
import type { Scene } from './types';

function buildScene(partial: Partial<Scene> = {}): Scene {
    return {
        id: 'scene-1',
        name: 'Planta',
        floorIndex: 0,
        floorElevation: 0,
        floorHeight: 2.7,
        scaleConfig: {
            unit: 'm',
            factor: 1,
            displayUnit: 'Metros',
            calibrationFactor: 1,
            isCalibrated: false,
        },
        rooms: [],
        walls: [],
        windows: [],
        doors: [],
        canopies: [],
        fixtures: [],
        lightSwitches: [],
        conductors: [],
        partitions: [],
        visible: true,
        ...partial,
    };
}

describe('calculateWireLengthByWall', () => {
    it('adds the ceiling drop from room height to switch height', () => {
        const rows = calculateWireLengthByWall(
            buildScene({
                rooms: [
                    {
                        id: 'room-1',
                        name: 'Recinto',
                        vertices: [
                            { x: -1, y: -1 },
                            { x: 6, y: -1 },
                            { x: 6, y: 2 },
                            { x: -1, y: 2 },
                        ],
                        height: 2.7,
                        color: '#000000',
                    },
                ],
                walls: [
                    {
                        id: 'wall-1',
                        vertices: [
                            { x: 0, y: 0 },
                            { x: 0, y: 2 },
                        ],
                        thickness: 0.15,
                        height: 2.7,
                    },
                ],
                lightSwitches: [
                    {
                        id: 'switch-1',
                        x: 0,
                        y: 0,
                        mountingHeight: 1.4,
                        type: 'single',
                        wallId: 'wall-1',
                        connectedFixtureIds: ['fixture-1'],
                        label: 'S(a)',
                    },
                ],
                fixtures: [
                    {
                        id: 'fixture-1',
                        name: 'L1',
                        x: 5,
                        y: 0,
                        z: 2.6,
                        lumens: 1000,
                        efficiency: 0.8,
                        fixtureType: 'recessed',
                        lightColor: '#ffffff',
                    },
                ],
                conductors: [
                    {
                        id: 'wire-1',
                        sourceId: 'fixture-1',
                        targetId: 'switch-1',
                        wireCount: 2,
                        routeType: 'wall_ceiling',
                        tubeSize: 20,
                        conductorType: 'Cu LSOH',
                        waypoints: [],
                    },
                ],
            }),
        );

        expect(rows).toHaveLength(1);
        expect(rows[0]?.horizontalLength).toBeCloseTo(5);
        expect(rows[0]?.verticalAllowance).toBeCloseTo(1.3);
        expect(rows[0]?.totalLength).toBeCloseTo(6.3);
    });
});
