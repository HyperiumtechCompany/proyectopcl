import { describe, expect, it } from 'vitest';
import { calculateConductorGroupLength, calculateConductorLength, calculatePanelCircuitSummaries, calculatePanelTotalCurrentA, calculateProjectPanelCircuitSummaries, calculateWireLengthByWall, defaultNominalCableCurrent, excelCopperResistivity, excelGroupingFactor, excelTemperatureFactor, resolveConductorRouteHeight, validateSceneOutlets } from './wireLengthCalculations';
import type { ElectricalDevice, Room, Scene } from './types';

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

describe('fórmulas literales MD_Caida B5:AI21', () => {
    it('calcula AG5, K1, K2 y N de TD/TG igual que el Excel', () => {
        expect(excelCopperResistivity(40)).toBeCloseTo(0.01859655172413793, 12);
        expect([1, 2, 3, 4, 5, 6].map(excelGroupingFactor)).toEqual([1, 0.85, 0.75, 0.7, 0.65, 0.6]);
        expect([10, 15, 20, 25, 30, 35, 40].map(excelTemperatureFactor)).toEqual([1.07, 1.04, 1, 0.96, 0.93, 0.89, 0.85]);
        expect(calculatePanelTotalCurrentA(11.0227272727, 0.6818181818, 2.5631313131, 1.25)).toBeCloseTo(8.81818181816, 10);
        expect(defaultNominalCableCurrent(3, 'LSOH-80')).toBe(24);
    });

    it('reproduce los valores patrón C1-C4, TD y TG sin cambiar fórmulas ni unidades', () => {
        const factorDiseno = 1.25;
        const voltajeTrifasicoV = 380;
        const resistividad = excelCopperResistivity(40);
        const circuitos = [
            { piW: 486, fp: 0.9, fs: 1, sistema: 1 as const, fase: 'R', longitudM: 38.62, seccionMm2: 2.5 },
            { piW: 108, fp: 0.9, fs: 1, sistema: 1 as const, fase: 'S', longitudM: 3.87, seccionMm2: 2.5 },
            { piW: 406, fp: 0.9, fs: 1, sistema: 1 as const, fase: 'T', longitudM: 31.33, seccionMm2: 2.5 },
            { piW: 1260, fp: 0.9, fs: 1, sistema: 1 as const, fase: 'R', longitudM: 40.11, seccionMm2: 4 },
        ].map((entrada) => {
            const piTotalKw = entrada.piW / 1000;
            const maximaDemandaKw = entrada.fs * piTotalKw;
            const corrienteTotalA = maximaDemandaKw * 1000 / (220 * entrada.fp);
            const corrienteDisenoA = corrienteTotalA * factorDiseno;
            return { ...entrada, piTotalKw, maximaDemandaKw, corrienteTotalA, corrienteDisenoA };
        });

        expect(circuitos.map((c) => c.piTotalKw)).toEqual([0.486, 0.108, 0.406, 1.26]);
        expect(circuitos.map((c) => c.corrienteDisenoA)).toEqual([
            3.0681818181818183,
            0.6818181818181818,
            2.563131313131313,
            7.954545454545454,
        ]);

        const td = {
            piTotalKw: circuitos.reduce((suma, c) => suma + c.piTotalKw, 0),
            maximaDemandaKw: circuitos.reduce((suma, c) => suma + c.maximaDemandaKw, 0),
            corrienteR_A: circuitos.filter((c) => c.fase === 'R').reduce((suma, c) => suma + c.corrienteDisenoA, 0),
            corrienteS_A: circuitos.filter((c) => c.fase === 'S').reduce((suma, c) => suma + c.corrienteDisenoA, 0),
            corrienteT_A: circuitos.filter((c) => c.fase === 'T').reduce((suma, c) => suma + c.corrienteDisenoA, 0),
        };
        const tgFs = 0.8;
        const tgR = td.corrienteR_A * tgFs;
        const tgS = td.corrienteS_A * tgFs;
        const tgT = td.corrienteT_A * tgFs;
        const tgDropV = Math.sqrt(3) * Math.max(tgR, tgS, tgT) * resistividad * 200 * 0.85 / 120;
        const tdDropV = Math.sqrt(3) * Math.max(td.corrienteR_A, td.corrienteS_A, td.corrienteT_A) * resistividad * 200 * 0.8 / 50 + tgDropV;

        expect(td.piTotalKw).toBeCloseTo(2.26, 14);
        expect(td.maximaDemandaKw).toBeCloseTo(2.26, 14);
        expect(td.corrienteR_A).toBeCloseTo(11.022727272727273, 14);
        expect(td.corrienteS_A).toBeCloseTo(0.6818181818181818, 14);
        expect(td.corrienteT_A).toBeCloseTo(2.563131313131313, 14);
        expect(calculatePanelTotalCurrentA(td.corrienteR_A, td.corrienteS_A, td.corrienteT_A, factorDiseno)).toBeCloseTo(8.818181818181818, 14);
        expect(tgR).toBeCloseTo(8.818181818181818, 14);
        expect(tgS).toBeCloseTo(0.5454545454545454, 14);
        expect(tgT).toBeCloseTo(2.0505050505050506, 14);
        expect(calculatePanelTotalCurrentA(tgR, tgS, tgT, factorDiseno)).toBeCloseTo(7.054545454545455, 14);
        expect(tgDropV).toBeCloseTo(0.4023831389395521, 14);
        expect(tdDropV).toBeCloseTo(1.5385237665335818, 14);

        const caidasCircuitos = circuitos.map((c) =>
            2 * c.corrienteDisenoA * resistividad * c.longitudM * c.fp / c.seccionMm2 + tdDropV,
        );
        expect(caidasCircuitos[0]).toBeCloseTo(3.125090267474021, 14);
        expect(caidasCircuitos[1]).toBeCloseTo(1.5738538336182213, 14);
        expect(caidasCircuitos[2]).toBeCloseTo(2.6137408847153996, 14);
        expect(caidasCircuitos[3]).toBeCloseTo(4.208534246549256, 14);
        expect(tgDropV / voltajeTrifasicoV * 100).toBeCloseTo(0.10589029972093476, 14);
        expect(tdDropV / voltajeTrifasicoV * 100).toBeCloseTo(0.40487467540357414, 14);
    });
});

describe('vínculo lógico de tableros entre pisos', () => {
    it('vincula un TD del piso 2 con el TG del piso 1 sin conductor 2D entre escenas', () => {
        const piso1 = buildScene({
            id: 'piso-1',
            floorIndex: 0,
            electricalDevices: [{
                id: 'tg-principal', type: 'main_panel', label: 'TG', x: 0, y: 0,
                mountingHeight: 1.8, connectedDeviceIds: [], properties: { sectionMm2: 120, lengthM: 200 },
            }],
        });
        const piso2 = buildScene({
            id: 'piso-2',
            floorIndex: 1,
            electricalDevices: [{
                id: 'td-piso-2', type: 'sub_panel', label: 'TD-2', x: 0, y: 0,
                mountingHeight: 1.8, connectedDeviceIds: [], properties: { upstreamPanelId: 'tg-principal', sectionMm2: 50, lengthM: 200 },
            }],
        });

        const summaries = calculateProjectPanelCircuitSummaries([piso1, piso2]);
        const tg = summaries.find((item) => item.panelId === 'tg-principal' && item.isPanelSummary)!;
        const td = summaries.find((item) => item.panelId === 'td-piso-2' && item.isPanelSummary)!;

        expect(td.upstreamVoltageDropV).toBe(tg.voltageDropV);
        expect(td.upstreamVoltageDropV).not.toBe(6.22);
    });

    it('un TD raíz (sub_panel, sin hijos propios) que solo alimenta un Sub-TD de otro piso también genera su fila resumen', () => {
        // Caso real: el TD del piso 1 es el tablero raíz del módulo (lo
        // alimenta el TG del módulo general, fuera de este proyecto), no
        // tiene ningún hijo dibujado en SU propia escena, y no es
        // main_panel — antes del fix, `calculatePanelCircuitSummaries` lo
        // dejaba invisible (ninguna de las 3 condiciones de
        // `visibleSummaryCircuits` se cumplía), así que `panelFeederGeometry`
        // en el módulo general nunca encontraba su altura de montaje real.
        const piso1 = buildScene({
            id: 'piso-1',
            floorIndex: 0,
            floorElevation: 0,
            electricalDevices: [{
                id: 'td-piso-1', type: 'sub_panel', label: 'TD', x: 0, y: 0,
                mountingHeight: 1.8, connectedDeviceIds: [], properties: { sectionMm2: 16, lengthM: 200 },
            }],
        });
        const piso2 = buildScene({
            id: 'piso-2',
            floorIndex: 1,
            floorElevation: 3.5,
            electricalDevices: [{
                id: 'sub-td-01', type: 'sub_panel', label: 'Sub TD-01', x: 0, y: 0,
                mountingHeight: 1.8, connectedDeviceIds: [], properties: { upstreamPanelId: 'td-piso-1', sectionMm2: 10, lengthM: 200 },
            }],
        });

        const summaries = calculateProjectPanelCircuitSummaries([piso1, piso2]);
        const td = summaries.find((item) => item.panelId === 'td-piso-1' && item.isPanelSummary);
        const subTd = summaries.find((item) => item.panelId === 'sub-td-01' && item.isPanelSummary);

        expect(td).toBeDefined();
        expect(subTd).toBeDefined();
        expect(subTd!.upstreamVoltageDropV).toBe(td!.voltageDropV);
    });
});

describe('defaultNominalCableCurrent', () => {
    it.each([
        ['TW', 2.5, 24],
        ['THW', 4, 34],
        ['NYY', 6, 58],
        ['LSOH-80', 10, 51],
        ['LSOH-90', 16, 85],
        ['N2X0H', 400, 680],
        ['N2X0H', 500, 700],
    ])('busca %s de %s mm² y devuelve %s A', (conductorType, sectionMm2, expected) => {
        expect(defaultNominalCableCurrent(sectionMm2 as number, conductorType as string)).toBe(expected);
    });
});

describe('calculatePanelCircuitSummaries', () => {
    it('calcula In total del TD como MAX(R, S, T) dividido entre fdis', () => {
        expect(calculatePanelTotalCurrentA(11.02, 0.68, 2.56, 1.25)).toBeCloseTo(8.816);
    });

    it('el TG suma el PI total de todos los TD existentes en el piso', () => {
        const panel = (id: string, type: 'main_panel' | 'sub_panel', x: number) => ({
            id, type, x, y: 0, label: id.toUpperCase(), mountingHeight: 1.8,
            connectedDeviceIds: [], properties: { sectionMm2: 2.5 },
        });
        const wire = (id: string, sourceId: string, targetId: string) => ({
            id, sourceId, targetId, wireCount: 2, routeType: 'floor' as const,
            tubeSize: 20, conductorType: 'THW', sectionMm2: 2.5, waypoints: [],
        });
        const scene = buildScene({
            electricalDevices: [panel('tg1', 'main_panel', 0), panel('td1', 'sub_panel', 2), panel('td2', 'sub_panel', 12)],
            fixtures: [
                { id: 'l1', name: 'L1', x: 4, y: 0, z: 2.7, power: 100, lumens: 1000, efficiency: 0.8, fixtureType: 'recessed', lightColor: '#fff' },
                { id: 'l2', name: 'L2', x: 14, y: 0, z: 2.7, power: 200, lumens: 1000, efficiency: 0.8, fixtureType: 'recessed', lightColor: '#fff' },
            ],
            conductors: [wire('tg1-td1', 'tg1', 'td1'), wire('td1-l1', 'td1', 'l1'), wire('td2-l2', 'td2', 'l2')],
        });

        const summaries = calculatePanelCircuitSummaries(scene).filter((circuit) => circuit.isPanelSummary);
        expect(summaries.find((circuit) => circuit.panelId === 'tg1')?.installedPowerKw).toBeCloseTo(0.3);
    });
});

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

        // +0.1 m (2 nodos × 0.05 m de holgura por caja, `SLACK_ALLOWANCE` en
        // `nodeVerticalAllowance` — pedido real del ingeniero, no un ajuste
        // de este test) sobre el valor geométrico puro (5.24/2.9).
        expect(calculateConductorLength(base, conductor)?.verticalLengthM).toBeCloseTo(5.34, 8);
        expect(resolveConductorRouteHeight(base, conductor)).toBeCloseTo(4.67, 8);
        expect(resolveConductorRouteHeight(base, { ...conductor, routeHeightM: 3.5 })).toBeCloseTo(3.5, 8);
        expect(calculateConductorLength(base, { ...conductor, routeHeightM: 3.5 })?.verticalLengthM)
            .toBeCloseTo(3.0, 8);
    });
});

describe('calculateConductorGroupLength', () => {
    it('no duplica la bajada de un nodo compartido', () => {
        const scene = buildScene({
            floorHeight: 3,
            lightSwitches: [{ id: 's1', x: 2, y: 0, mountingHeight: 1.4, type: 'single', connectedFixtureIds: [] }],
            fixtures: [{ id: 'l1', name: 'L1', x: 4, y: 0, z: 3, lumens: 1000, efficiency: 0.8, fixtureType: 'recessed', lightColor: '#fff' }],
            electricalDevices: [{ id: 'td', type: 'sub_panel', label: 'TD', x: 0, y: 0, mountingHeight: 1.8, connectedDeviceIds: [], properties: {} }],
            conductors: [
                { id: 'c1', sourceId: 'td', targetId: 's1', wireCount: 2, routeType: 'wall_ceiling', tubeSize: 20, conductorType: 'THW-90', sectionMm2: 2.5, waypoints: [] },
                { id: 'c2', sourceId: 's1', targetId: 'l1', wireCount: 2, routeType: 'wall_ceiling', tubeSize: 20, conductorType: 'THW-90', sectionMm2: 2.5, waypoints: [] },
            ],
        });

        const result = calculateConductorGroupLength(scene, ['c1', 'c2']);
        expect(result.horizontalLengthM).toBeCloseTo(4, 8);
        // Nodo compartido (s1, destino de c1 y origen de c2): su bajada
        // (|3-1.4|+0.05 = 1.65) cuenta UNA sola vez, no dos — td (1.25) +
        // s1 (1.65, una vez) + l1 (0.05) = 2.95, no 2.8+algo ni 2×1.65+resto.
        expect(result.verticalLengthM).toBeCloseTo(2.95, 8);
        expect(result.totalLengthM).toBeCloseTo(6.95, 8);
    });
});

describe('validateSceneOutlets', () => {
    function buildOutlet(overrides: Partial<ElectricalDevice> = {}): ElectricalDevice {
        return {
            id: 'outlet-1',
            type: 'outlet_floor',
            x: 1,
            y: 1,
            label: 'T-01',
            mountingHeight: 0.4,
            connectedDeviceIds: [],
            properties: {},
            ...overrides,
        };
    }

    it('regresión: cuenta los tomacorrientes ya instalados en el ambiente (antes daba 0 siempre por comparar contra el id compuesto del ambiente)', () => {
        const room: Room = {
            id: 'room-1',
            name: 'Aula 1',
            roomType: 'ambient',
            vertices: [
                { x: 0, y: 0 },
                { x: 4, y: 0 },
                { x: 4, y: 3 },
                { x: 0, y: 3 },
            ],
            height: 2.7,
            color: '#ffffff',
            outletUse: 'aula',
        };
        const scene = buildScene({
            rooms: [room],
            electricalDevices: [buildOutlet({ roomId: room.id })],
        });

        const validations = validateSceneOutlets(scene);

        expect(validations).toHaveLength(1);
        expect(validations[0]!.installedOutlets).toBe(1);
    });

    it('no cuenta tomacorrientes de OTRO sub-ambiente que comparte el mismo recinto físico (ej. Baño vs Guarderías)', () => {
        const room: Room = {
            id: 'room-shared',
            name: 'Recinto compartido',
            roomType: 'room',
            vertices: [
                { x: 0, y: 0 },
                { x: 4, y: 0 },
                { x: 4, y: 3 },
                { x: 0, y: 3 },
            ],
            height: 2.7,
            color: '#ffffff',
            outletUse: 'aula',
        };
        const scene = buildScene({
            rooms: [room],
            electricalDevices: [
                buildOutlet({ id: 'outlet-bano', roomId: room.id, ambientId: 'wall-bano' }),
                buildOutlet({ id: 'outlet-guarderias', roomId: room.id, ambientId: 'wall-guarderias' }),
            ],
        });

        const validations = validateSceneOutlets(scene);

        // Sin paredes internas configuradas, `deriveSceneAmbientSpaces`
        // deriva un único ambiente base (sin `wallId`) para este recinto —
        // ninguno de los dos tomacorrientes (ambos con `ambientId` de una
        // pared) pertenece a ese ambiente base.
        expect(validations).toHaveLength(1);
        expect(validations[0]!.installedOutlets).toBe(0);
    });
});
