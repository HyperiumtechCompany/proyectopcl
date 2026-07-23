import { describe, expect, it } from 'vitest';
import type { Conductor, ElectricalDevice, Fixture, Room, Scene } from './types';
import { calculatePanelCircuitSummaries } from './wireLengthCalculations';

const fixture = (id: string, roomId: string, power: number): Fixture => ({
    id, roomId, power, name: id, x: 0, y: 0, z: 2.7, lumens: 1000,
    efficiency: 1, fixtureType: 'surface', lightColor: '#fff',
});

const conductor = (id: string, sourceId: string, targetId: string, length: number): Conductor => ({
    id, sourceId, targetId, wireCount: 3, wireLabel: 'F+N+T', routeType: 'floor',
    tubeSize: 20, conductorType: 'THW-90', sectionMm2: 2.5,
    waypoints: [{ x: length, y: 0 }],
});

describe('calculatePanelCircuitSummaries', () => {
    it('numera la salida del TD y suma longitud, ambientes y carga de toda la ruta', () => {
        const panel = { id: 'td', type: 'sub_panel', label: 'TD', x: 0, y: 0 } as ElectricalDevice;
        const fixtures = [
            ...Array.from({ length: 6 }, (_, index) => fixture(`a-${index}`, 'room-a', 26)),
            ...Array.from({ length: 2 }, (_, index) => fixture(`b-${index}`, 'room-b', 54)),
            ...Array.from({ length: 2 }, (_, index) => fixture(`e-${index}`, 'room-b', 20)),
        ];
        // Cadena TD → A1 → ... → A6 → B1 → B2 → E1 → E2.
        const nodes = ['td', ...fixtures.map((item) => item.id)];
        const conductors = nodes.slice(0, -1).map((node, index) => conductor(`wire-${index}`, node, nodes[index + 1], index + 1));
        const rooms = [
            { id: 'room-a', name: 'Ambiente A', vertices: [] },
            { id: 'room-b', name: 'Ambiente B', vertices: [] },
        ] as Room[];
        const scene = { fixtures, electricalDevices: [panel], conductors, rooms, walls: [], lightSwitches: [] } as unknown as Scene;

        const [circuit] = calculatePanelCircuitSummaries(scene);
        expect(circuit.code).toBe('C-1');
        expect(circuit.panelLabel).toBe('TD');
        expect(circuit.rooms.map((room) => room.roomName)).toEqual(['Ambiente A', 'Ambiente B']);
        expect(circuit.installedPowerW).toBe(6 * 26 + 2 * 54 + 2 * 20);
        expect(circuit.rooms[0].detail).toBe('6×26 W');
        expect(circuit.rooms[1].detail).toBe('2×54 W + 2×20 W');
        expect(circuit.lengthM).toBeGreaterThan(0);
        expect(circuit.sectionMm2).toBe(2.5);
        expect(circuit.voltageV).toBe(220);
        expect(circuit.voltageDropPct).toBeGreaterThan(0);
    });

    it('conserva el nombre del ambiente y registra los ambientes atravesados por el cable', () => {
        const panel = {
            id: 'td', type: 'sub_panel', label: 'TD-01', x: 1, y: 1,
            properties: { voltage: '220V', phases: '1O' },
        } as ElectricalDevice;
        const load = { ...fixture('load-1', 'room-b', 540), x: 7, y: 1 };
        const rooms = [
            {
                id: 'room-a', name: 'Sala', height: 2.7, color: '#fff',
                vertices: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }],
            },
            {
                id: 'room-b', name: 'Dormitorio', height: 2.7, color: '#fff',
                vertices: [{ x: 4, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 3 }, { x: 4, y: 3 }],
            },
        ] as Room[];
        const wire = {
            ...conductor('wire-1', 'td', 'load-1', 4),
            waypoints: [{ x: 4, y: 1 }],
        };
        const scene = {
            id: 'floor-2', name: 'Segundo piso', floorIndex: 2,
            fixtures: [load], electricalDevices: [panel], conductors: [wire],
            rooms, walls: [], lightSwitches: [],
        } as unknown as Scene;

        const [circuit] = calculatePanelCircuitSummaries(scene);

        expect(circuit.levelName).toBe('Segundo piso');
        expect(circuit.rooms[0].roomName).toBe('Dormitorio');
        expect(circuit.traversedRoomNames).toEqual(['Sala', 'Dormitorio']);
        expect(circuit.voltageDropOk).toBe(true);
    });

    it('crea C-1 y C-2 cuando existen dos salidas directas del mismo subtablero', () => {
        const panel = { id: 'td', type: 'sub_panel', label: 'TD', x: 0, y: 0 } as ElectricalDevice;
        const fixtures = [fixture('load-1', 'room-a', 26), fixture('load-2', 'room-b', 54)];
        const scene = {
            fixtures,
            electricalDevices: [panel],
            conductors: [conductor('wire-1', 'td', 'load-1', 2), conductor('wire-2', 'td', 'load-2', 3)],
            rooms: [{ id: 'room-a', name: 'A', vertices: [] }, { id: 'room-b', name: 'B', vertices: [] }] as Room[],
            walls: [], lightSwitches: [],
        } as unknown as Scene;

        const circuits = calculatePanelCircuitSummaries(scene);
        expect(circuits.map((circuit) => circuit.code)).toEqual(['C-1', 'C-2']);
        expect(circuits.map((circuit) => circuit.installedPowerW)).toEqual([26, 54]);
    });

    it('asigna por posición una luminaria de emergencia antigua sin roomId', () => {
        const panel = { id: 'td', type: 'sub_panel', label: 'TD', x: 0, y: 0 } as ElectricalDevice;
        const emergency = { ...fixture('emergency-1', '', 20), roomId: undefined, x: 2, y: 2, emergencyType: 'emergency' as const };
        const room = {
            id: 'room-a', name: 'Recinto 1', roomType: 'room', height: 2.7, color: '#fff',
            vertices: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }],
        } as Room;
        const scene = {
            fixtures: [emergency], electricalDevices: [panel],
            conductors: [conductor('wire-1', 'td', 'emergency-1', 2)],
            rooms: [room], walls: [], lightSwitches: [],
        } as unknown as Scene;

        const [circuit] = calculatePanelCircuitSummaries(scene);
        expect(circuit.rooms).toHaveLength(1);
        expect(circuit.rooms[0].roomName).toBe('Recinto 1');
        expect(circuit.rooms[0].installedPowerW).toBe(20);
    });
});
