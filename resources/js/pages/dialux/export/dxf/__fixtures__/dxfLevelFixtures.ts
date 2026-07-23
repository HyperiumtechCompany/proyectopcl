import type {
    Canopy,
    Conductor,
    Door,
    DxfEntity,
    ElectricalDevice,
    Fixture,
    JunctionBox,
    LightSwitch,
    Project,
    Room,
    Scene,
    Wall,
    Window as SceneWindow,
} from '@/pages/dialux/hooks/types';

/**
 * Fixtures de referencia para el plan maestro de planos DXF por nivel
 * (planes/plan_maestro_planos_dxf_por_nivel_marcos_leyendas.md, sección 20).
 *
 * Fase 0 los usa para congelar el comportamiento actual del exportador DXF
 * (un solo plano) antes de introducir el modelo multinivel. Fases
 * posteriores reutilizan estas mismas formas para construir Fixture C
 * (tres niveles) sin duplicar la definición de cada elemento eléctrico.
 */

const SCALE_CONFIG = {
    unit: 'm' as const,
    factor: 1,
    displayUnit: 'Metros (1 = 1m)',
    calibrationFactor: 1,
    isCalibrated: false,
};

/**
 * Fixture A — Un nivel mínimo: un recinto, una luminaria, un interruptor,
 * un tomacorriente y dos conductores clasificados (alumbrado y tomas).
 * Resultado esperado: dos láminas (Fase 8).
 */
export function buildDxfFixtureAProject(): Project {
    const room: Room = {
        id: 'a-room-1',
        name: 'Aula 1',
        vertices: [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 5, y: 4 },
            { x: 0, y: 4 },
        ],
        height: 3,
        color: 'rgba(56,189,248,0.25)',
        roomType: 'ambient',
    };

    const fixture: Fixture = {
        id: 'a-fixture-1',
        name: 'Panel LED 60x60',
        x: 2.5, y: 2, z: 2.8,
        lumens: 4000,
        efficiency: 0.8,
        fixtureType: 'panel',
        fixtureShape: 'rectangular',
        lightColor: '#fff5e1',
        brand: 'PCL Iluminación',
        articleNumber: 'PANEL-40W',
        productId: 10,
        power: 40,
    };

    const lightSwitch: LightSwitch = {
        id: 'a-switch-1',
        x: 0.2, y: 2,
        mountingHeight: 1.4,
        type: 'single',
        connectedFixtureIds: [fixture.id],
        label: 'S',
    };

    const panel: ElectricalDevice = {
        id: 'a-panel-1',
        type: 'main_panel',
        x: 0.2, y: 3.8,
        label: 'TG',
        mountingHeight: 1.8,
        connectedDeviceIds: [],
        properties: { voltage: '380V', phases: '3O' },
    };

    const outlet: ElectricalDevice = {
        id: 'a-outlet-1',
        type: 'outlet_floor',
        x: 4.5, y: 0.2,
        label: 'T-01',
        mountingHeight: 0.4,
        connectedDeviceIds: [],
        properties: {},
    };

    const conductors: Conductor[] = [
        {
            id: 'a-cond-lighting',
            sourceId: lightSwitch.id,
            targetId: fixture.id,
            wireCount: 2,
            routeType: 'wall_ceiling',
            tubeSize: 20,
            conductorType: 'Cu LSOH',
            sectionMm2: 2.5,
            waypoints: [],
        },
        {
            id: 'a-cond-outlet',
            sourceId: panel.id,
            targetId: outlet.id,
            wireCount: 3,
            routeType: 'floor',
            tubeSize: 20,
            conductorType: 'Cu LSOH',
            sectionMm2: 4,
            waypoints: [],
        },
    ];

    return {
        id: 'dxf-fixture-a',
        name: 'Fixture A - Nivel minimo',
        created_at: '2026-07-22T10:00:00.000Z',
        updated_at: '2026-07-22T10:00:00.000Z',
        scenes: [
            {
                id: 'a-scene-1',
                name: 'Nivel 1',
                floorIndex: 0,
                floorElevation: 0,
                floorHeight: 3,
                scaleConfig: SCALE_CONFIG,
                rooms: [room],
                walls: [],
                windows: [],
                doors: [],
                canopies: [],
                fixtures: [fixture],
                lightSwitches: [lightSwitch],
                conductors,
                junctionBoxes: [],
                electricalDevices: [panel, outlet],
                partitions: [],
            },
        ],
    };
}

/**
 * Fixture B — Nivel completo: varias luminarias de dos productos, emergencia,
 * interruptores de varios tipos, tomas de varias alturas, tablero y cajas,
 * conductores con dos secciones. Resultado esperado: dos leyendas extensas
 * pero legibles (Fase 6/7).
 */
export function buildDxfFixtureBProject(): Project {
    const room: Room = {
        id: 'b-room-aula',
        name: 'Aula Principal',
        vertices: [
            { x: 0, y: 0 },
            { x: 8, y: 0 },
            { x: 8, y: 6 },
            { x: 0, y: 6 },
        ],
        height: 3,
        color: 'rgba(56,189,248,0.25)',
        roomType: 'ambient',
        normativeLabel: 'Aula Principal',
    };

    const corridor: Room = {
        id: 'b-room-pasillo',
        name: 'Pasillo',
        vertices: [
            { x: 8.5, y: 0 },
            { x: 10.5, y: 0 },
            { x: 10.5, y: 6 },
            { x: 8.5, y: 6 },
        ],
        height: 3,
        color: 'rgba(148,163,184,0.25)',
        roomType: 'corridor',
    };

    const perimeterWall: Wall = {
        id: 'b-wall-perimeter',
        vertices: [
            { x: 0, y: 0 },
            { x: 8, y: 0 },
            { x: 8, y: 6 },
            { x: 0, y: 6 },
            { x: 0, y: 0 },
        ],
        thickness: 0.2,
        height: 2.8,
        wallType: 'exterior',
    };

    const divisionWall: Wall = {
        id: 'b-wall-division',
        vertices: [
            { x: 8, y: 0 },
            { x: 8, y: 6 },
        ],
        thickness: 0.15,
        height: 2.8,
        wallType: 'interior',
    };

    const window: SceneWindow = {
        id: 'b-window-1',
        wallId: perimeterWall.id,
        offsetAlongWall: 1,
        width: 1.5,
        height: 1.2,
        sillHeight: 0.9,
    };

    const door: Door = {
        id: 'b-door-1',
        wallId: divisionWall.id,
        offsetAlongWall: 2,
        width: 0.9,
        height: 2.1,
        doorType: 'single',
    };

    const canopy: Canopy = {
        id: 'b-canopy-1',
        x1: 0, y1: 0, x2: -1, y2: 0,
        width: 8,
        slabThickness: 0.15,
        height: 2.6,
    };

    const fixtures: Fixture[] = [
        {
            id: 'b-fixture-1',
            name: 'Panel LED 60x60',
            x: 2, y: 2, z: 2.8,
            lumens: 4000,
            efficiency: 0.8,
            fixtureType: 'panel',
            fixtureShape: 'rectangular',
            lightColor: '#fff5e1',
            brand: 'PCL Iluminación',
            articleNumber: 'PANEL-40W',
            productId: 10,
            power: 40,
        },
        {
            id: 'b-fixture-2',
            name: 'Panel LED 60x60',
            x: 6, y: 2, z: 2.8,
            lumens: 4000,
            efficiency: 0.8,
            fixtureType: 'panel',
            fixtureShape: 'rectangular',
            lightColor: '#fff5e1',
            brand: 'PCL Iluminación',
            articleNumber: 'PANEL-40W',
            productId: 10,
            power: 40,
        },
        {
            id: 'b-fixture-3',
            name: 'Downlight LED',
            x: 4, y: 4, z: 2.8,
            lumens: 1200,
            efficiency: 0.85,
            fixtureType: 'recessed',
            fixtureShape: 'round',
            lightColor: '#ffffff',
            brand: 'PCL Iluminación',
            articleNumber: 'DOWN-12W',
            productId: 11,
            power: 12,
        },
        {
            id: 'b-fixture-emergency',
            name: 'Luminaria de Emergencia',
            x: 8.3, y: 3, z: 2.8,
            lumens: 300,
            efficiency: 0.7,
            fixtureType: 'surface',
            fixtureShape: 'rectangular',
            lightColor: '#ffffff',
            brand: 'PCL Iluminación',
            articleNumber: 'EMER-01',
            productId: 12,
            power: 5,
            emergencyType: 'emergency',
        },
    ];

    const lightSwitches: LightSwitch[] = [
        { id: 'b-switch-single', x: 0.2, y: 3, mountingHeight: 1.4, type: 'single', connectedFixtureIds: ['b-fixture-1'], label: 'S' },
        { id: 'b-switch-double', x: 0.2, y: 4, mountingHeight: 1.4, type: 'double', connectedFixtureIds: ['b-fixture-2', 'b-fixture-3'], label: '2S' },
        { id: 'b-switch-triple', x: 0.2, y: 5, mountingHeight: 1.4, type: 'triple', connectedFixtureIds: ['b-fixture-1', 'b-fixture-2', 'b-fixture-3'], label: '3S' },
        { id: 'b-switch-twoway', x: 0.2, y: 1, mountingHeight: 1.4, type: 'two-way', connectedFixtureIds: ['b-fixture-emergency'], label: 'Sc' },
    ];

    const electricalDevices: ElectricalDevice[] = [
        { id: 'b-outlet-floor', type: 'outlet_floor', x: 1, y: 0.2, label: 'T-01', mountingHeight: 0.4, connectedDeviceIds: [], properties: {} },
        { id: 'b-outlet-initial', type: 'outlet_initial', x: 2, y: 0.2, label: 'TI-01', mountingHeight: 1.5, connectedDeviceIds: [], properties: {} },
        { id: 'b-outlet-high', type: 'outlet_high_180', x: 3, y: 0.2, label: 'TA-01', mountingHeight: 1.8, connectedDeviceIds: [], properties: {} },
        { id: 'b-outlet-waterproof', type: 'outlet_waterproof', x: 4, y: 0.2, label: 'T-02', mountingHeight: 1.2, connectedDeviceIds: [], properties: {} },
        { id: 'b-outlet-ceiling', type: 'outlet_ceiling', x: 4, y: 5.8, label: 'T-03', mountingHeight: 0, connectedDeviceIds: [], properties: {} },
        { id: 'b-outlet-rack', type: 'outlet_rack', x: 5, y: 0.2, label: 'TR-01', mountingHeight: 2, connectedDeviceIds: [], properties: {} },
        { id: 'b-outlet-floorbox', type: 'outlet_floor_box', x: 6, y: 3, label: 'TP-01', mountingHeight: 0, connectedDeviceIds: [], properties: {} },
        { id: 'b-water-heater', type: 'water_heater_30l', x: 9, y: 1, label: 'TE-01', mountingHeight: 1.8, connectedDeviceIds: [], properties: { voltage: '220V' } },
        { id: 'b-main-panel', type: 'main_panel', x: 9, y: 5.5, label: 'TG', mountingHeight: 1.8, connectedDeviceIds: [], properties: { voltage: '380V', phases: '3O' } },
        { id: 'b-sub-panel', type: 'sub_panel', x: 8.7, y: 5.5, label: 'TD-01', mountingHeight: 1.8, connectedDeviceIds: [], properties: { voltage: '220V', phases: '1O' } },
    ];

    const junctionBoxes: JunctionBox[] = [
        { id: 'b-jbox-1', x: 4, y: 3, size: '100x100x50', label: 'C-01' },
    ];

    const conductors: Conductor[] = [
        {
            id: 'b-cond-lighting-1',
            sourceId: 'b-switch-single',
            targetId: 'b-fixture-1',
            wireCount: 2,
            routeType: 'wall_ceiling',
            tubeSize: 20,
            conductorType: 'Cu LSOH',
            sectionMm2: 2.5,
            waypoints: [],
        },
        {
            id: 'b-cond-lighting-2',
            sourceId: 'b-switch-triple',
            targetId: 'b-fixture-3',
            wireCount: 3,
            routeType: 'wall_ceiling',
            tubeSize: 20,
            conductorType: 'Cu LSOH',
            sectionMm2: 2.5,
            waypoints: [{ x: 3, y: 5 }],
        },
        {
            id: 'b-cond-outlet-1',
            sourceId: 'b-main-panel',
            targetId: 'b-outlet-floor',
            wireCount: 3,
            routeType: 'floor',
            tubeSize: 20,
            conductorType: 'N2XOH',
            sectionMm2: 4,
            waypoints: [],
        },
        {
            id: 'b-cond-outlet-2',
            sourceId: 'b-sub-panel',
            targetId: 'b-outlet-waterproof',
            wireCount: 2,
            routeType: 'floor',
            tubeSize: 20,
            conductorType: 'N2XOH',
            sectionMm2: 4,
            waypoints: [],
        },
    ];

    return {
        id: 'dxf-fixture-b',
        name: 'Fixture B - Nivel completo',
        created_at: '2026-07-22T10:00:00.000Z',
        updated_at: '2026-07-22T10:00:00.000Z',
        scenes: [
            {
                id: 'b-scene-1',
                name: 'Nivel 1',
                floorIndex: 0,
                floorElevation: 0,
                floorHeight: 3,
                scaleConfig: SCALE_CONFIG,
                rooms: [room, corridor],
                walls: [perimeterWall, divisionWall],
                windows: [window],
                doors: [door],
                canopies: [canopy],
                fixtures,
                lightSwitches,
                conductors,
                junctionBoxes,
                electricalDevices,
                partitions: [],
            },
        ],
    };
}

/**
 * Fondo CAD importado para Fixture B. `Scene` no tiene un campo `dxfEntities`
 * propio hoy (ver plan maestro, sección 6.2) — el fondo se pasa por separado
 * a `buildDialuxExportSnapshot`, igual que en el editor real.
 */
export interface DxfLevelSceneOptions {
    id: string;
    name: string;
    floorIndex: number;
    visible?: boolean;
    /** Fixture C incluye un nivel sin tomacorrientes (plan maestro, sección 20). */
    includeOutlets?: boolean;
}

/**
 * Un nivel de una sola habitación con una luminaria, un interruptor y
 * (opcionalmente) un tomacorriente — bloque reutilizable para construir
 * proyectos de N niveles sin repetir la definición de cada elemento
 * (plan maestro, sección 2: "no duplicar manualmente la lógica por piso").
 */
export function buildDxfLevelScene(options: DxfLevelSceneOptions): Scene {
    const room: Room = {
        id: `${options.id}-room`,
        name: `Ambiente ${options.name}`,
        vertices: [
            { x: 0, y: 0 },
            { x: 6, y: 0 },
            { x: 6, y: 5 },
            { x: 0, y: 5 },
        ],
        height: 3,
        color: 'rgba(56,189,248,0.25)',
        roomType: 'ambient',
    };

    const fixture: Fixture = {
        id: `${options.id}-fixture-1`,
        name: 'Panel LED 60x60',
        x: 3, y: 2.5, z: 2.8,
        lumens: 4000,
        efficiency: 0.8,
        fixtureType: 'panel',
        fixtureShape: 'rectangular',
        lightColor: '#fff5e1',
        brand: 'PCL Iluminación',
        articleNumber: 'PANEL-40W',
        productId: 10,
        power: 40,
    };

    const lightSwitch: LightSwitch = {
        id: `${options.id}-switch-1`,
        x: 0.2, y: 2.5,
        mountingHeight: 1.4,
        type: 'single',
        connectedFixtureIds: [fixture.id],
        label: 'S',
    };

    const electricalDevices: ElectricalDevice[] = options.includeOutlets === false
        ? []
        : [{
            id: `${options.id}-outlet-1`,
            type: 'outlet_floor',
            x: 5.5, y: 0.2,
            label: 'T-01',
            mountingHeight: 0.4,
            connectedDeviceIds: [],
            properties: {},
        }];

    const conductors: Conductor[] = [
        {
            id: `${options.id}-cond-1`,
            sourceId: lightSwitch.id,
            targetId: fixture.id,
            wireCount: 2,
            routeType: 'wall_ceiling',
            tubeSize: 20,
            conductorType: 'Cu LSOH',
            sectionMm2: 2.5,
            waypoints: [],
        },
    ];

    return {
        id: options.id,
        name: options.name,
        floorIndex: options.floorIndex,
        floorElevation: options.floorIndex * 3,
        floorHeight: 3,
        scaleConfig: SCALE_CONFIG,
        rooms: [room],
        walls: [],
        windows: [],
        doors: [],
        canopies: [],
        fixtures: [fixture],
        lightSwitches: [lightSwitch],
        conductors,
        junctionBoxes: [],
        electricalDevices,
        partitions: [],
        visible: options.visible ?? true,
    };
}

/**
 * Fixture C — Tres niveles: sótano, planta baja y piso superior, con
 * geometría y elementos eléctricos distintos por nivel; el piso superior no
 * tiene tomacorrientes. Resultado esperado: cinco láminas por defecto o seis
 * con `includeEmptySheets` (Fase 8).
 */
export function buildDxfFixtureCProject(): Project {
    return {
        id: 'dxf-fixture-c',
        name: 'Fixture C - Tres niveles',
        created_at: '2026-07-22T10:00:00.000Z',
        updated_at: '2026-07-22T10:00:00.000Z',
        scenes: [
            buildDxfLevelScene({ id: 'c-sotano', name: 'Sótano 1', floorIndex: -1 }),
            buildDxfLevelScene({ id: 'c-planta-baja', name: 'Planta Baja', floorIndex: 0 }),
            buildDxfLevelScene({ id: 'c-piso-1', name: 'Piso 1', floorIndex: 1, includeOutlets: false }),
        ],
    };
}

/** Dos niveles que comparten el mismo nombre — debe advertir, no fusionarlos ni fallar. */
export function buildDxfDuplicateLevelNamesProject(): Project {
    return {
        id: 'dxf-fixture-duplicate-names',
        name: 'Fixture - nombres de nivel duplicados',
        created_at: '2026-07-22T10:00:00.000Z',
        updated_at: '2026-07-22T10:00:00.000Z',
        scenes: [
            buildDxfLevelScene({ id: 'dup-a', name: 'Nivel 1', floorIndex: 0 }),
            buildDxfLevelScene({ id: 'dup-b', name: 'Nivel 1', floorIndex: 1 }),
        ],
    };
}

/** Un proyecto de dos niveles donde el segundo está oculto (`Scene.visible = false`). */
export function buildDxfHiddenLevelProject(): Project {
    return {
        id: 'dxf-fixture-hidden-level',
        name: 'Fixture - nivel oculto',
        created_at: '2026-07-22T10:00:00.000Z',
        updated_at: '2026-07-22T10:00:00.000Z',
        scenes: [
            buildDxfLevelScene({ id: 'hide-a', name: 'Nivel 1', floorIndex: 0 }),
            buildDxfLevelScene({ id: 'hide-b', name: 'Nivel 2 (oculto)', floorIndex: 1, visible: false }),
        ],
    };
}

export const DXF_FIXTURE_B_DXF_ENTITIES: DxfEntity[] = [
    { id: 'b-dxf-line-1', type: 'line', x1: -1, y1: -1, x2: 11, y2: -1, layer: 'IMPORTADO' },
    {
        id: 'b-dxf-poly-1', type: 'polyline',
        vertices: [[-1, -1], [11, -1], [11, 7], [-1, 7]],
        closed: true, layer: 'IMPORTADO',
    },
];
