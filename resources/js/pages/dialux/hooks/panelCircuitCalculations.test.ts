import { describe, expect, it } from 'vitest';
import type { Conductor, ElectricalDevice, Fixture, Room, Scene } from './types';
import {
    calculatePanelCircuitSummaries,
    resolveConformingSectionMm2,
    resolveTreeConformingSections,
} from './wireLengthCalculations';

const fixture = (id: string, roomId: string, power: number): Fixture => ({
    id, roomId, power, name: id, x: 0, y: 0, z: 2.7, lumens: 1000,
    efficiency: 1, fixtureType: 'surface', lightColor: '#fff',
});

const conductor = (id: string, sourceId: string, targetId: string, length: number): Conductor => ({
    id, sourceId, targetId, wireCount: 3, wireLabel: 'F+N+T', routeType: 'floor',
    tubeSize: 20, conductorType: 'THW-90', sectionMm2: 2.5,
    waypoints: [{ x: length, y: 0 }],
});

const outlet = (id: string, roomId: string, ratedPowerW?: number): ElectricalDevice => ({
    id, type: 'outlet_floor', x: 0, y: 0, label: 'T', mountingHeight: 0.4,
    roomId, connectedDeviceIds: [],
    properties: ratedPowerW === undefined ? {} : { ratedPowerW },
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
            { id: 'room-a', name: 'Ambiente A', vertices: [], height: 2.7, color: '#FFFFFF' },
            { id: 'room-b', name: 'Ambiente B', vertices: [], height: 2.7, color: '#FFFFFF' },
        ] as Room[];
        const scene = { fixtures, electricalDevices: [panel], conductors, rooms, walls: [], lightSwitches: [] } as unknown as Scene;

        const [circuit] = calculatePanelCircuitSummaries(scene);
        expect(circuit.code).toBe('C-1');
        expect(circuit.panelLabel).toBe('TD');
        expect(circuit.rooms.map((room) => room.roomName)).toEqual(['Ambiente A', 'Ambiente B']);
        expect(circuit.installedPowerW).toBe(6 * 26 + 2 * 54 + 2 * 20);
        expect(circuit.rooms[0].detail).toBe('6×26 W alumbrado');
        expect(circuit.rooms[1].detail).toBe('2×54 W alumbrado + 2×20 W alumbrado');
        expect(circuit.lengthM).toBeGreaterThan(0);
        expect(circuit.lengthM).toBeCloseTo(
            circuit.horizontalLengthM + circuit.verticalLengthM,
            8,
        );
        expect(circuit.sectionMm2).toBe(2.5);
        expect(circuit.voltageV).toBe(220);
        expect(circuit.voltageDropPct).toBeGreaterThan(0);
    });

    it('cuenta los tomacorrientes cableados como PI tomas, no como alumbrado', () => {
        const panel = { id: 'td', type: 'sub_panel', label: 'TD', x: 0, y: 0 } as ElectricalDevice;
        const lamp = fixture('lamp-1', 'room-a', 26);
        const socket = outlet('outlet-1', 'room-a', 300);
        const scene = {
            // Una sola salida (td → lamp-1 → outlet-1), como cuando el
            // mismo circuito alimenta una luminaria y, más adelante en la
            // misma tirada, un tomacorriente.
            fixtures: [lamp],
            electricalDevices: [panel, socket],
            conductors: [
                conductor('wire-lamp', 'td', 'lamp-1', 2),
                conductor('wire-outlet', 'lamp-1', 'outlet-1', 3),
            ],
            rooms: [{ id: 'room-a', name: 'Ambiente A', vertices: [], height: 2.7, color: '#FFFFFF' }] as Room[],
            walls: [], lightSwitches: [],
        } as unknown as Scene;

        const [circuit] = calculatePanelCircuitSummaries(scene);

        expect(circuit.lightingPowerW).toBe(26);
        expect(circuit.outletPowerW).toBe(300);
        expect(circuit.installedPowerW).toBe(326);
        expect(circuit.rooms[0].fixtureCount).toBe(1);
        expect(circuit.rooms[0].outletCount).toBe(1);
        expect(circuit.rooms[0].lightingPowerW).toBe(26);
        expect(circuit.rooms[0].outletPowerW).toBe(300);
        expect(circuit.rooms[0].detail).toBe('1×26 W alumbrado + 1×300 W tomacorriente');

        // CNE-Utilización / RNE EM.010: una salida final que mezcla
        // alumbrado y tomacorriente en el mismo circuito es una violación
        // normativa — deben ir separados.
        expect(circuit.circuitLoadType).toBe('mixed');
        expect(circuit.normativeViolation).toBe(true);
    });

    it('usa la potencia por defecto de tomacorriente (180 W) cuando no se personaliza, y clasifica la salida como tomacorriente puro', () => {
        const panel = { id: 'td', type: 'sub_panel', label: 'TD', x: 0, y: 0 } as ElectricalDevice;
        const socket = outlet('outlet-1', 'room-a');
        const scene = {
            fixtures: [],
            electricalDevices: [panel, socket],
            conductors: [conductor('wire-outlet', 'td', 'outlet-1', 3)],
            rooms: [{ id: 'room-a', name: 'Ambiente A', vertices: [], height: 2.7, color: '#FFFFFF' }] as Room[],
            walls: [], lightSwitches: [],
        } as unknown as Scene;

        const [circuit] = calculatePanelCircuitSummaries(scene);
        expect(circuit.outletPowerW).toBe(180);
        expect(circuit.lightingPowerW).toBe(0);
        expect(circuit.circuitLoadType).toBe('outlet');
        expect(circuit.normativeViolation).toBe(false);
    });

    it('clasifica una salida de solo alumbrado como "lighting", sin violación', () => {
        const panel = { id: 'td', type: 'sub_panel', label: 'TD', x: 0, y: 0 } as ElectricalDevice;
        const lamp = fixture('lamp-1', 'room-a', 26);
        const scene = {
            fixtures: [lamp],
            electricalDevices: [panel],
            conductors: [conductor('wire-lamp', 'td', 'lamp-1', 2)],
            rooms: [{ id: 'room-a', name: 'Ambiente A', vertices: [], height: 2.7, color: '#FFFFFF' }] as Room[],
            walls: [], lightSwitches: [],
        } as unknown as Scene;

        const [circuit] = calculatePanelCircuitSummaries(scene);
        expect(circuit.circuitLoadType).toBe('lighting');
        expect(circuit.normativeViolation).toBe(false);
    });

    it('un alimentador hacia otro tablero se clasifica como "feeder" aunque agregue alumbrado + tomacorriente aguas abajo (no es violación)', () => {
        const tg = {
            id: 'tg', type: 'main_panel', label: 'TG-01', x: 0, y: 0,
            properties: { voltage: '380V', phases: '3O' },
        } as ElectricalDevice;
        const td = {
            id: 'td', type: 'sub_panel', label: 'TD-01', x: 4, y: 0,
            properties: { voltage: '220V', phases: '1O' },
        } as ElectricalDevice;
        const lamp = fixture('lamp-1', 'room-a', 26);
        const socket = outlet('outlet-1', 'room-a', 180);
        const scene = {
            fixtures: [lamp],
            electricalDevices: [tg, td, socket],
            conductors: [
                conductor('feeder', 'tg', 'td', 4),
                conductor('wire-lamp', 'td', 'lamp-1', 2),
                conductor('wire-outlet', 'td', 'outlet-1', 2),
            ],
            rooms: [{ id: 'room-a', name: 'Aula', vertices: [], height: 2.7, color: '#FFFFFF' }] as Room[],
            walls: [], lightSwitches: [],
        } as unknown as Scene;

        const circuits = calculatePanelCircuitSummaries(scene);
        const tgFeeder = circuits.find((circuit) => circuit.panelId === 'tg');

        expect(tgFeeder?.circuitLoadType).toBe('feeder');
        expect(tgFeeder?.normativeViolation).toBe(false);
        expect(tgFeeder?.lightingPowerW).toBe(26);
        expect(tgFeeder?.outletPowerW).toBe(180);
    });

    it('separa recorrido horizontal y vertical y usa el total para la caída de tensión', () => {
        const panel = {
            id: 'td',
            type: 'sub_panel',
            label: 'TD',
            x: 0,
            y: 0,
            mountingHeight: 1.8,
            properties: { voltage: '220V', phases: '1O' },
        } as ElectricalDevice;
        const load = { ...fixture('load-1', 'room-a', 540), x: 4, y: 0, z: 2.7 };
        const wire = {
            ...conductor('wire-1', 'td', 'load-1', 4),
            routeType: 'wall_ceiling' as const,
            waypoints: [],
        };
        const scene = {
            floorHeight: 3,
            fixtures: [load],
            electricalDevices: [panel],
            conductors: [wire],
            rooms: [],
            walls: [],
            lightSwitches: [],
        } as unknown as Scene;

        const [circuit] = calculatePanelCircuitSummaries(scene);

        expect(circuit.horizontalLengthM).toBeCloseTo(4, 8);
        expect(circuit.verticalLengthM).toBeCloseTo(1.6, 8);
        expect(circuit.lengthM).toBeCloseTo(5.6, 8);
        expect(circuit.voltageDropPct).toBeGreaterThan(0);
    });

    it('baja el tablero hasta el piso (no hasta el techo) en una ruta de piso, como un circuito de tomacorrientes', () => {
        // El cable de un circuito de piso (tomacorrientes) sale del tablero,
        // BAJA por la pared hasta el piso (mountingHeight del propio
        // tablero), recorre embutido en la losa y SUBE hasta el destino —
        // nunca sube al techo para luego bajar al piso. Mismo criterio que
        // ya usa el render 3D (`House3DBuilder.ts::buildPath`, sin caso
        // especial para tableros).
        const panel = {
            id: 'td',
            type: 'sub_panel',
            label: 'TD',
            x: 0,
            y: 0,
            mountingHeight: 1.8,
            properties: { voltage: '220V', phases: '1O' },
        } as ElectricalDevice;
        const load = { ...fixture('load-1', 'room-a', 540), x: 4, y: 0, z: 0 };
        const scene = {
            floorHeight: 3,
            fixtures: [load],
            electricalDevices: [panel],
            conductors: [{
                ...conductor('wire-1', 'td', 'load-1', 4),
                waypoints: [],
            }],
            rooms: [],
            walls: [],
            lightSwitches: [],
        } as unknown as Scene;

        const [circuit] = calculatePanelCircuitSummaries(scene);

        expect(circuit.horizontalLengthM).toBeCloseTo(4, 8);
        expect(circuit.verticalLengthM).toBeCloseTo(1.9, 8);
        expect(circuit.lengthM).toBeCloseTo(5.9, 8);
    });

    it('recalcula el tramo vertical con la altura editable del interruptor', () => {
        const panel = {
            id: 'td', type: 'sub_panel', label: 'TD', x: 0, y: 0,
            mountingHeight: 1.8, properties: {},
        } as ElectricalDevice;
        const lightSwitch = {
            id: 'switch-1', type: 'single', label: 'S1', x: 2, y: 0,
            mountingHeight: 1.2, connectedFixtureIds: [],
        };
        const wire = {
            ...conductor('wire-1', 'td', 'switch-1', 2),
            routeType: 'wall_ceiling' as const,
            waypoints: [],
        };
        const baseScene = {
            floorHeight: 3, fixtures: [], electricalDevices: [panel],
            conductors: [wire], rooms: [], walls: [],
        };

        const [atOneTwenty] = calculatePanelCircuitSummaries({
            ...baseScene,
            lightSwitches: [lightSwitch],
        } as unknown as Scene);
        const [atOneFifty] = calculatePanelCircuitSummaries({
            ...baseScene,
            lightSwitches: [{ ...lightSwitch, mountingHeight: 1.5 }],
        } as unknown as Scene);

        expect(atOneTwenty.verticalLengthM).toBeCloseTo(3.1, 8);
        expect(atOneFifty.verticalLengthM).toBeCloseTo(2.8, 8);
    });

    it('cuenta una sola vez la montante de un interruptor compartido por varios tramos', () => {
        const panel = {
            id: 'td', type: 'sub_panel', label: 'TD', x: 0, y: 0,
            mountingHeight: 1.8, properties: {},
        } as ElectricalDevice;
        const lightSwitch = {
            id: 'switch-1', type: 'single', label: 'S1', x: 2, y: 0,
            mountingHeight: 1.4, connectedFixtureIds: [],
        };
        const load = { ...fixture('load-1', 'room-a', 26), x: 4, y: 0, z: 3 };
        const scene = {
            floorHeight: 3,
            fixtures: [load],
            electricalDevices: [panel],
            lightSwitches: [lightSwitch],
            conductors: [
                { ...conductor('wire-1', 'td', 'switch-1', 2), routeType: 'wall_ceiling' as const, waypoints: [] },
                { ...conductor('wire-2', 'switch-1', 'load-1', 2), routeType: 'wall_ceiling' as const, waypoints: [] },
            ],
            rooms: [], walls: [],
        } as unknown as Scene;

        const [circuit] = calculatePanelCircuitSummaries(scene);

        expect(circuit.verticalLengthM).toBeCloseTo(4.6, 8);
    });

    it.each([2.7, 3, 4.5])(
        'usa la altura real del recinto de %s m para la subida del tablero',
        (roomHeight) => {
            const panel = {
                id: 'td', type: 'sub_panel', label: 'TD', x: 1, y: 1,
                mountingHeight: 1.8, properties: {},
            } as ElectricalDevice;
            const load = {
                ...fixture('load-1', 'room-a', 540),
                x: 4,
                y: 1,
                z: roomHeight,
            };
            const room = {
                id: 'room-a',
                name: 'Ambiente',
                height: roomHeight,
                color: '#fff',
                vertices: [
                    { x: 0, y: 0 },
                    { x: 5, y: 0 },
                    { x: 5, y: 3 },
                    { x: 0, y: 3 },
                ],
            } as Room;
            const scene = {
                floorHeight: 3,
                fixtures: [load],
                electricalDevices: [panel],
                conductors: [{
                    ...conductor('wire-1', 'td', 'load-1', 3),
                    routeType: 'wall_ceiling' as const,
                    waypoints: [],
                }],
                rooms: [room],
                walls: [],
                lightSwitches: [],
            } as unknown as Scene;

            const [circuit] = calculatePanelCircuitSummaries(scene);

            expect(circuit.verticalLengthM).toBeCloseTo(
                roomHeight - panel.mountingHeight + 0.1,
                8,
            );
        },
    );

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
            rooms: [{ id: 'room-a', name: 'A', vertices: [], height: 2.7, color: '#FFFFFF' }, { id: 'room-b', name: 'B', vertices: [], height: 2.7, color: '#FFFFFF' }] as Room[],
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

    it('acumula en la salida del TG las cargas finales alimentadas por un TD', () => {
        const tg = {
            id: 'tg',
            type: 'main_panel',
            label: 'TG-01',
            x: 0,
            y: 0,
            properties: { voltage: '380V', phases: '3O' },
        } as ElectricalDevice;
        const td = {
            id: 'td',
            type: 'sub_panel',
            label: 'TD-01',
            x: 4,
            y: 0,
            properties: { voltage: '220V', phases: '1O' },
        } as ElectricalDevice;
        const load = { ...fixture('load-1', 'room-a', 540), x: 8 };
        const scene = {
            id: 'level-1',
            name: 'Piso 1',
            floorIndex: 0,
            fixtures: [load],
            electricalDevices: [tg, td],
            conductors: [
                conductor('feeder', 'tg', 'td', 4),
                conductor('branch', 'td', 'load-1', 4),
            ],
            rooms: [{ id: 'room-a', name: 'Aula', vertices: [], height: 2.7, color: '#FFFFFF' }] as Room[],
            walls: [],
            lightSwitches: [],
        } as unknown as Scene;

        const circuits = calculatePanelCircuitSummaries(scene);
        const tgFeeder = circuits.find(
            (circuit) => circuit.panelId === 'tg',
        );
        const tdBranch = circuits.find(
            (circuit) => circuit.panelId === 'td' && circuit.rooms.length > 0,
        );

        expect(tgFeeder?.fedPanelLabels).toEqual(['TD-01']);
        expect(tgFeeder?.installedPowerW).toBe(540);
        expect(tgFeeder?.rooms[0]?.roomName).toBe('Aula');
        expect(tdBranch?.installedPowerW).toBe(540);

        // El conductor TG→TD es uno solo: debe aparecer una única vez (como
        // salida del TG). Antes del fix, el TD también lo contaba como "su
        // propia salida hacia el TG" (relación invertida), generando una
        // fila fantasma con 0 A que aparecía como conforme o no conforme
        // sin representar nada real.
        expect(circuits).toHaveLength(2);
        expect(
            circuits.some(
                (circuit) => circuit.panelId === 'td' && circuit.fedPanelLabels.length > 0,
            ),
        ).toBe(false);
    });

    it('usa la "Longitud del tablero" del TD como ΔV del alimentador TG→TD, en vez del trazo del plano', () => {
        const tg = {
            id: 'tg', type: 'main_panel', label: 'TG-01', x: 0, y: 0,
            properties: { voltage: '380V', phases: '3O' },
        } as ElectricalDevice;
        const td = {
            id: 'td', type: 'sub_panel', label: 'TD-01', x: 4, y: 0,
            // El trazo del plano da 4 m (ver conductor 'feeder' abajo), pero
            // el cable real a instalar (por ducto) es mucho más largo.
            properties: { voltage: '220V', phases: '1O', lengthM: 150 },
        } as ElectricalDevice;
        const load = { ...fixture('load-1', 'room-a', 540), x: 8 };
        const scene = {
            id: 'level-1',
            name: 'Piso 1',
            floorIndex: 0,
            fixtures: [load],
            electricalDevices: [tg, td],
            conductors: [
                conductor('feeder', 'tg', 'td', 4),
                conductor('branch', 'td', 'load-1', 4),
            ],
            rooms: [{ id: 'room-a', name: 'Aula', vertices: [], height: 2.7, color: '#FFFFFF' }] as Room[],
            walls: [],
            lightSwitches: [],
        } as unknown as Scene;

        const circuits = calculatePanelCircuitSummaries(scene);
        const tgFeeder = circuits.find((circuit) => circuit.panelId === 'tg');
        const tdBranch = circuits.find(
            (circuit) => circuit.panelId === 'td' && circuit.rooms.length > 0,
        );

        expect(tgFeeder?.lengthOverridden).toBe(true);
        expect(tgFeeder?.lengthM).toBe(150);
        expect(tgFeeder?.horizontalLengthM).toBeCloseTo(149.9, 8);
        expect(tgFeeder?.verticalLengthM).toBeCloseTo(0.1, 8);

        // La salida propia del TD (hacia su carga) no tiene padre que la
        // sobrescriba: sigue usando el trazo real del plano.
        expect(tdBranch?.lengthOverridden).toBe(false);
        expect(tdBranch?.lengthM).toBeGreaterThan(0);
        expect(tdBranch?.lengthM).not.toBe(150);
    });

    it('descarta una salida degenerada (0 m, sin carga, sin alimentar otro tablero)', () => {
        // mountingHeight del tablero = 0 (ruta de piso: el tramo vertical
        // del propio tablero es su propia altura de montaje, no la del
        // recinto) para que el tramo vertical dé 0; el interruptor también
        // en 0 m de altura y en el mismo punto (0,0) para que el tramo
        // horizontal dé 0. Sin luminarias enganchadas: es un cable "muerto".
        const panel = {
            id: 'td', type: 'sub_panel', label: 'TD', x: 0, y: 0, mountingHeight: 0,
        } as ElectricalDevice;
        const deadSwitch = {
            id: 'sw-dead', x: 0, y: 0, mountingHeight: 0,
            type: 'single' as const, connectedFixtureIds: [],
        };
        const load = fixture('load-1', 'room-a', 100);
        const scene = {
            fixtures: [load],
            electricalDevices: [panel],
            lightSwitches: [deadSwitch],
            conductors: [
                // Cable real con carga.
                conductor('wire-1', 'td', 'load-1', 3),
                // Cable degenerado: 0 m, no llega a ninguna luminaria ni
                // tablero (p.ej. quedó sin terminar de cablear).
                { ...conductor('wire-dead', 'td', 'sw-dead', 0), waypoints: [] },
            ],
            rooms: [{ id: 'room-a', name: 'A', vertices: [], height: 2.7, color: '#FFFFFF' }] as Room[],
            walls: [],
        } as unknown as Scene;

        const circuits = calculatePanelCircuitSummaries(scene);
        expect(circuits).toHaveLength(2);
        expect(circuits[0]?.installedPowerW).toBe(100);
    });

    it('calcula el flujo CT editable desde PI hasta capacidad y caída de tensión', () => {
        const panel = {
            id: 'td',
            type: 'sub_panel',
            label: 'TD-01',
            x: 0,
            y: 0,
            mountingHeight: 0,
            properties: {
                voltage: '220V',
                phases: '1O',
                designFactor: 1.25,
                copperResistivity: 0.0175,
                upstreamVoltageDropV: 6.22,
            },
        } as ElectricalDevice;
        const load = { ...fixture('load', 'room', 100), x: 10, y: 0, z: 0 };
        const wire = {
            ...conductor('wire', 'td', 'load', 10),
            waypoints: [],
            sectionMm2: 4,
            ct: {
                outletPowerW: 1000,
                forcePowerW: 900,
                powerFactor: 0.8,
                demandFactor: 0.8,
                system: 1 as const,
                phaseBalance: 'S' as const,
                nominalCableCurrentA: 20,
                groupingFactor: 0.8,
                temperatureFactor: 0.9,
                voltageDropLimitPct: 4,
            },
        };
        const [result] = calculatePanelCircuitSummaries({
            id: 'level',
            name: 'Piso 1',
            floorIndex: 0,
            floorHeight: 2.7,
            fixtures: [load],
            electricalDevices: [panel],
            conductors: [wire],
            rooms: [{ id: 'room', name: 'Aula', vertices: [], height: 2.7, color: '#FFFFFF' }] as Room[],
            walls: [],
            lightSwitches: [],
        } as unknown as Scene);

        expect(result.lightingPowerW).toBe(100);
        expect(result.installedPowerKw).toBeCloseTo(2);
        expect(result.maximumDemandKw).toBeCloseTo(1.6);
        expect(result.currentA).toBeCloseTo(9.0909, 3);
        expect(result.theoreticalDesignCurrentA).toBeCloseTo(11.3636, 4);
        expect(result.phaseCurrentR).toBe(0);
        expect(result.phaseCurrentS).toBeCloseTo(result.theoreticalDesignCurrentA);
        expect(result.admissibleCableCurrentA).toBeCloseTo(14.4);
        expect(result.capacityConforms).toBe(true);
        // Sin el `* powerFactor` (auditoría `dialux-electrical-reviewer`):
        // `result.phaseCurrentS` YA es corriente real (`circuitCurrent()` ya
        // dividió entre `powerFactor` para obtenerla) — multiplicarla otra
        // vez por 0.8 aquí contaba el factor de potencia dos veces.
        const expectedDropV =
            (2 *
                result.phaseCurrentS *
                0.0175 *
                result.lengthM) /
                4 +
            6.22;
        expect(result.voltageDropV).toBeCloseTo(7.01153605, 8);
        expect(result.voltageDropPct).toBeCloseTo(
            (7.01153605 / 220) * 100,
            8,
        );
        expect(result.voltageDropOk).toBe(true);
    });

    it('resolveConformingSectionMm2 aumenta la sección hasta que la caída de tensión cumple', () => {
        const panel = {
            id: 'td',
            type: 'sub_panel',
            label: 'TD-01',
            x: 0,
            y: 0,
            mountingHeight: 0,
            properties: {
                voltage: '220V',
                phases: '1O',
                designFactor: 1.25,
                copperResistivity: 0.0175,
                upstreamVoltageDropV: 0,
            },
        } as ElectricalDevice;
        const load = { ...fixture('load', 'room', 100), x: 40, y: 0, z: 0 };
        const buildScene = (sectionMm2: number): Scene => ({
            id: 'level',
            name: 'Piso 1',
            floorIndex: 0,
            floorHeight: 2.7,
            fixtures: [load],
            electricalDevices: [panel],
            conductors: [{
                ...conductor('wire', 'td', 'load', 40),
                waypoints: [],
                sectionMm2,
                ct: {
                    outletPowerW: 2000,
                    forcePowerW: 0,
                    powerFactor: 1,
                    demandFactor: 1,
                    system: 1 as const,
                    phaseBalance: 'R' as const,
                    voltageDropLimitPct: 1,
                },
            }],
            rooms: [{ id: 'room', name: 'Aula', vertices: [], height: 2.7, color: '#FFFFFF' }] as Room[],
            walls: [],
            lightSwitches: [],
        } as unknown as Scene);

        const [circuit] = calculatePanelCircuitSummaries(buildScene(2.5));
        expect(circuit.capacityConforms).toBe(true);
        expect(circuit.voltageDropOk).toBe(false);

        const fixedSection = resolveConformingSectionMm2(circuit);
        expect(fixedSection).toBeGreaterThan(circuit.sectionMm2);
        expect(fixedSection).toBe(10);

        const [fixedCircuit] = calculatePanelCircuitSummaries(buildScene(fixedSection));
        expect(fixedCircuit.voltageDropOk).toBe(true);
        expect(fixedCircuit.capacityConforms).toBe(true);
    });

    it('resolveConformingSectionMm2 no cambia nada si la salida ya cumple', () => {
        const panel = {
            id: 'td', type: 'sub_panel', label: 'TD', x: 0, y: 0,
            properties: { voltage: '220V', phases: '1O' },
        } as ElectricalDevice;
        const load = { ...fixture('load', 'room', 100), x: 2, y: 0 };
        const scene = {
            id: 'level',
            fixtures: [load],
            electricalDevices: [panel],
            conductors: [{
                ...conductor('wire', 'td', 'load', 2),
                sectionMm2: 4,
                ct: { outletPowerW: 0, forcePowerW: 0, powerFactor: 1, demandFactor: 1, system: 1 as const, phaseBalance: 'R' as const },
            }],
            rooms: [{ id: 'room', name: 'Aula', vertices: [], height: 2.7, color: '#FFFFFF' }] as Room[],
            walls: [], lightSwitches: [],
        } as unknown as Scene;

        const [circuit] = calculatePanelCircuitSummaries(scene);
        expect(circuit.voltageDropOk).toBe(true);
        expect(resolveConformingSectionMm2(circuit)).toBe(4);
    });
});

describe('caída de tensión en cascada (árbol de tableros)', () => {
    it('el TD hereda el ΔV real de la salida del TG que lo alimenta, no un valor fijo', () => {
        const tg = {
            id: 'tg', type: 'main_panel', label: 'TG-01', x: 0, y: 0,
            properties: { voltage: '380V', phases: '3O' },
        } as ElectricalDevice;
        const td = {
            id: 'td', type: 'sub_panel', label: 'TD-01', x: 4, y: 0,
            properties: { voltage: '220V', phases: '1O' },
        } as ElectricalDevice;
        const load = { ...fixture('load-1', 'room-a', 540), x: 8 };
        const scene = {
            id: 'level-1', name: 'Piso 1', floorIndex: 0,
            fixtures: [load],
            electricalDevices: [tg, td],
            conductors: [
                conductor('feeder', 'tg', 'td', 4),
                conductor('branch', 'td', 'load-1', 4),
            ],
            rooms: [{ id: 'room-a', name: 'Aula', vertices: [], height: 2.7, color: '#FFFFFF' }] as Room[],
            walls: [], lightSwitches: [],
        } as unknown as Scene;

        const circuits = calculatePanelCircuitSummaries(scene);
        const tgFeeder = circuits.find((c) => c.panelId === 'tg')!;
        const tdBranch = circuits.find((c) => c.panelId === 'td' && c.rooms.length > 0)!;

        // TG es raíz (sin padre en el grafo): usa su propiedad manual, que
        // por defecto es 0 para un main_panel.
        expect(tgFeeder.upstreamVoltageDropV).toBe(0);
        expect(tgFeeder.voltageDropV).toBeGreaterThan(0);

        // El TD hereda EXACTAMENTE el ΔV ya resuelto de la salida del TG que
        // lo alimenta — ya no el 6.22 V fijo de antes de este cambio.
        expect(tdBranch.upstreamVoltageDropV).toBeCloseTo(tgFeeder.voltageDropV, 8);
        expect(tdBranch.upstreamVoltageDropV).not.toBeCloseTo(6.22, 1);
        expect(tdBranch.voltageDropV).toBeGreaterThan(tgFeeder.voltageDropV);
    });

    it('cascada de tres niveles TG → TD1 → TD2: cada uno hereda el ΔV real de su padre, acumulado', () => {
        const tg = { id: 'tg', type: 'main_panel', label: 'TG', x: 0, y: 0, properties: { voltage: '380V', phases: '3O' } } as ElectricalDevice;
        const td1 = { id: 'td1', type: 'sub_panel', label: 'TD1', x: 4, y: 0, properties: { voltage: '220V', phases: '1O' } } as ElectricalDevice;
        const td2 = { id: 'td2', type: 'sub_panel', label: 'TD2', x: 8, y: 0, properties: { voltage: '220V', phases: '1O' } } as ElectricalDevice;
        const load = { ...fixture('load-1', 'room-a', 300), x: 12 };
        const scene = {
            id: 'level-1', name: 'Piso 1', floorIndex: 0,
            fixtures: [load],
            electricalDevices: [tg, td1, td2],
            conductors: [
                conductor('feeder-1', 'tg', 'td1', 5),
                conductor('feeder-2', 'td1', 'td2', 5),
                conductor('branch', 'td2', 'load-1', 3),
            ],
            rooms: [{ id: 'room-a', name: 'Aula', vertices: [], height: 2.7, color: '#FFFFFF' }] as Room[],
            walls: [], lightSwitches: [],
        } as unknown as Scene;

        const circuits = calculatePanelCircuitSummaries(scene);
        const tgToTd1 = circuits.find((c) => c.panelId === 'tg')!;
        const td1ToTd2 = circuits.find((c) => c.panelId === 'td1')!;
        const td2Branch = circuits.find((c) => c.panelId === 'td2')!;

        expect(tgToTd1.upstreamVoltageDropV).toBe(0);
        expect(td1ToTd2.upstreamVoltageDropV).toBeCloseTo(tgToTd1.voltageDropV, 8);
        expect(td2Branch.upstreamVoltageDropV).toBeCloseTo(td1ToTd2.voltageDropV, 8);
        // Se va acumulando de nivel en nivel, nunca se resetea a mitad del árbol.
        expect(td1ToTd2.voltageDropV).toBeGreaterThan(tgToTd1.voltageDropV);
        expect(td2Branch.voltageDropV).toBeGreaterThan(td1ToTd2.voltageDropV);
    });

    it('un tablero sin padre en el grafo (TD suelto, sin TG) sigue respetando su ΔV manual', () => {
        const panel = {
            id: 'td', type: 'sub_panel', label: 'TD', x: 0, y: 0,
            properties: { voltage: '220V', phases: '1O', upstreamVoltageDropV: 12.5 },
        } as ElectricalDevice;
        const load = fixture('load-1', 'room-a', 100);
        const scene = {
            fixtures: [load],
            electricalDevices: [panel],
            conductors: [conductor('wire-1', 'td', 'load-1', 3)],
            rooms: [{ id: 'room-a', name: 'A', vertices: [], height: 2.7, color: '#FFFFFF' }] as Room[],
            walls: [], lightSwitches: [],
        } as unknown as Scene;

        const [circuit] = calculatePanelCircuitSummaries(scene);
        expect(circuit.upstreamVoltageDropV).toBe(12.5);
    });

    it('resolveTreeConformingSections sube la sección del alimentador TG→TD no conforme y reduce las salidas fuera de norma en todo el árbol', () => {
        const tg = { id: 'tg', type: 'main_panel', label: 'TG', x: 0, y: 0, properties: { voltage: '380V', phases: '3O' } } as ElectricalDevice;
        const td = { id: 'td', type: 'sub_panel', label: 'TD', x: 0, y: 0, properties: { voltage: '220V', phases: '1O' } } as ElectricalDevice;
        const load = fixture('load-1', 'room-a', 3000);
        const scene = {
            id: 'level-1', name: 'Piso 1', floorIndex: 0,
            fixtures: [load],
            electricalDevices: [tg, td],
            conductors: [
                // 200 m a 2.5 mm² (default): el alimentador TG→TD no cumple
                // caída de tensión, y esa caída se hereda como ΔV del TD.
                conductor('feeder', 'tg', 'td', 200),
                conductor('branch', 'td', 'load-1', 2),
            ],
            rooms: [{ id: 'room-a', name: 'Aula', vertices: [], height: 2.7, color: '#FFFFFF' }] as Room[],
            walls: [], lightSwitches: [],
        } as unknown as Scene;

        const before = calculatePanelCircuitSummaries(scene);
        const nonCompliantBefore = before.filter(
            (c) => !c.normativeViolation && (!c.voltageDropOk || !c.capacityConforms),
        );
        expect(nonCompliantBefore.length).toBeGreaterThan(0);

        const fixes = resolveTreeConformingSections(scene);
        expect(fixes.length).toBeGreaterThan(0);
        const feederFix = fixes.find((f) => f.conductorId === 'feeder');
        expect(feederFix?.sectionMm2).toBeGreaterThan(2.5);

        const fixedScene: Scene = {
            ...scene,
            conductors: (scene.conductors ?? []).map((c) => {
                const fix = fixes.find((f) => f.conductorId === c.id);
                return fix
                    ? { ...c, sectionMm2: fix.sectionMm2, ct: { ...(c.ct ?? {}), nominalCableCurrentA: undefined } }
                    : c;
            }),
        };
        const after = calculatePanelCircuitSummaries(fixedScene);
        const nonCompliantAfter = after.filter(
            (c) => !c.normativeViolation && (!c.voltageDropOk || !c.capacityConforms),
        );

        // El árbol nunca queda peor que antes, y en este caso concreto queda
        // estrictamente mejor (el alimentador deja de ser el problema).
        expect(nonCompliantAfter.length).toBeLessThan(nonCompliantBefore.length);
        const feederAfter = after.find((c) => c.rootConductorId === 'feeder')!;
        expect(feederAfter.voltageDropOk).toBe(true);
        expect(feederAfter.capacityConforms).toBe(true);
    });
});
