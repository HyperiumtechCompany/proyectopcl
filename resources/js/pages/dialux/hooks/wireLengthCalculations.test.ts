import { describe, expect, it } from 'vitest';
import { calculateConductorGroupLength, calculateConductorLength, calculateWireLengthByWall, resolveConductorRouteHeight } from './wireLengthCalculations';
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
                        sectionMm2: 2.5,
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

describe('calculateConductorLength routeHeightM', () => {
    it('usa el techo real por defecto y permite una altura de ruta editable', () => {
        const base = buildScene({
            floorHeight: 4.67,
            rooms: [{
                id: 'room-1', name: 'Recinto alto', height: 4.67, color: '#fff',
                vertices: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }],
            }],
            lightSwitches: [{
                id: 'switch-1', x: 1, y: 1, mountingHeight: 1.4,
                type: 'single', connectedFixtureIds: [],
            }],
            fixtures: [{
                id: 'fixture-1', name: 'L1', x: 4, y: 1, z: 2.7,
                lumens: 1000, efficiency: 0.8, fixtureType: 'recessed', lightColor: '#fff',
            }],
        });
        const conductor = {
            id: 'wire-1', sourceId: 'switch-1', targetId: 'fixture-1', wireCount: 2,
            routeType: 'wall_ceiling' as const, tubeSize: 20, conductorType: 'THW-90',
            sectionMm2: 2.5, waypoints: [],
        };

        expect(calculateConductorLength(base, conductor)?.verticalLengthM).toBeCloseTo(5.24, 8);
        expect(resolveConductorRouteHeight(base, conductor)).toBeCloseTo(4.67, 8);
        expect(resolveConductorRouteHeight(base, { ...conductor, routeHeightM: 3.5 })).toBeCloseTo(3.5, 8);
        expect(calculateConductorLength(base, { ...conductor, routeHeightM: 3.5 })?.verticalLengthM)
            .toBeCloseTo(2.9, 8);
    });
});

describe('calculateConductorGroupLength', () => {
    it('no duplica la bajada de un nodo compartido', () => {
        const scene = buildScene({
            floorHeight: 3,
            lightSwitches: [{ id: 's1', x: 2, y: 0, mountingHeight: 1.4, type: 'single', connectedFixtureIds: [] }],
            fixtures: [{ id: 'l1', name: 'L1', x: 4, y: 0, z: 3, lumens: 1000, efficiency: 0.8, fixtureType: 'recessed', lightColor: '#fff' }],
            electricalDevices: [{ id: 'td', type: 'sub_panel', label: 'TD', x: 0, y: 0, mountingHeight: 1.8, properties: {} }],
            conductors: [
                { id: 'c1', sourceId: 'td', targetId: 's1', wireCount: 2, routeType: 'wall_ceiling', tubeSize: 20, conductorType: 'THW-90', sectionMm2: 2.5, waypoints: [] },
                { id: 'c2', sourceId: 's1', targetId: 'l1', wireCount: 2, routeType: 'wall_ceiling', tubeSize: 20, conductorType: 'THW-90', sectionMm2: 2.5, waypoints: [] },
            ],
        });

        const result = calculateConductorGroupLength(scene, ['c1', 'c2']);
        expect(result.horizontalLengthM).toBeCloseTo(4, 8);
        expect(result.verticalLengthM).toBeCloseTo(2.8, 8);
        expect(result.totalLengthM).toBeCloseTo(6.8, 8);
    });
});
