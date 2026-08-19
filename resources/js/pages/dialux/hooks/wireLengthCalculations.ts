import { circuitCurrent } from '../electrical/engine/formulas';
import { deriveSceneAmbientSpaces, findAmbientSpaceContainingPoint, pointInPolygon } from './ambientSpaces';
import { calculatePolygonArea, calculatePolygonPerimeter } from './lightingCalculations';
import { CONDUCTOR_SECTION_OPTIONS, DEFAULT_OUTLET_POWER_W, isOutletDeviceType } from './types';
import type {
    Conductor,
    ElectricalDevice,
    Fixture,
    LightSwitch,
    Scene,
    Vertex,
} from './types';

const DEFAULT_ROOM_HEIGHT = 2.7;
const DEFAULT_SWITCH_HEIGHT = 1.4;

type WireNode =
    | (Fixture & { nodeType: 'fixture' })
    | (LightSwitch & { nodeType: 'switch' })
    | (ElectricalDevice & { nodeType: 'device' });

export interface WireLengthWallRow {
    wallId: string | null;
    wallLabel: string;
    conductorCount: number;
    switchLabels: string[];
    horizontalLength: number;
    verticalAllowance: number;
    totalLength: number;
}

function distance(a: Vertex, b: Vertex): number {
    return Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
}

function resolveNode(
    id: string,
    fixtures: Fixture[],
    switches: LightSwitch[],
    devices: ElectricalDevice[],
): WireNode | null {
    const fixture = fixtures.find((item) => item.id === id);
    if (fixture) return { ...fixture, nodeType: 'fixture' };

    const lightSwitch = switches.find((item) => item.id === id);
    if (lightSwitch) return { ...lightSwitch, nodeType: 'switch' };

    const device = devices.find((item) => item.id === id);
    if (device) return { ...device, nodeType: 'device' };

    return null;
}

function conductorPlanLength(
    conductor: Conductor,
    source: Vertex,
    target: Vertex,
): number {
    const points = [source, ...(conductor.waypoints ?? []), target];

    return points.reduce((total, point, index) => {
        if (index === 0) return total;
        return total + distance(points[index - 1], point);
    }, 0);
}

function nodeMountingHeight(node: WireNode): number {
    if (node.nodeType === 'fixture') {
        return Math.max(0, node.z ?? node.mountingHeight ?? 0);
    }

    return Math.max(0, node.mountingHeight ?? 0);
}

/**
 * Tramo vertical de UN extremo del conductor (tablero, luminaria, foco o
 * interruptor) — sigue el `routeType` del propio conductor, nunca el tipo
 * de nodo: un tablero alimentando un circuito `wall_ceiling` (alumbrado)
 * baja desde el cielo raso (`roomHeight - mountingHeight`); el MISMO
 * tablero alimentando un circuito `floor` (tomacorrientes) baja hasta el
 * piso (`mountingHeight`) para entrar a la canaleta embutida, igual que
 * cualquier otro nodo — mismo criterio ya usado por el render 3D
 * (`House3DBuilder.ts::buildPath`, sin caso especial para tableros).
 *
 * ANTES: un tablero SIEMPRE tomaba la fórmula de cielo raso sin importar
 * `routeType`, así que un circuito de tomacorrientes (piso) sumaba
 * `roomHeight - mountingHeight` en el extremo del tablero en vez de
 * `mountingHeight` — sobrestimando la longitud (y a veces contradiciendo
 * físicamente el recorrido: el cable no sube al techo para después bajar
 * al piso). Reportado por el usuario contra un proyecto real donde DIALux
 * evo daba una longitud menor y consistente con el recorrido por piso.
 */
function nodeVerticalAllowance(
    scene: Scene,
    node: WireNode,
    conductor: Conductor,
): number {
    const mountingHeight = nodeMountingHeight(node);

    const isCeiling = conductor.routeType === 'wall_ceiling' || conductor.routeType === undefined;
    const SLACK_ALLOWANCE = 0.05; // 5cm de holgura por caja (curvatura tipo arco y mechas de empalme) a petición del ingeniero

    if (isCeiling) {
        const routeHeight = conductor.routeHeightM !== undefined
            ? Math.max(0, conductor.routeHeightM)
            : roomHeightAt(scene, node);
        return Math.abs(routeHeight - mountingHeight) + SLACK_ALLOWANCE;
    }

    return mountingHeight + SLACK_ALLOWANCE;
}

function conductorLengthComponents(
    scene: Scene,
    conductor: Conductor,
    source: WireNode,
    target: WireNode,
): { horizontalLengthM: number; verticalLengthM: number; totalLengthM: number } {
    const horizontalLengthM = conductorPlanLength(conductor, source, target);
    const verticalLengthM = [source, target].reduce(
        (total, node) =>
            total + nodeVerticalAllowance(scene, node, conductor),
        0,
    );

    return {
        horizontalLengthM,
        verticalLengthM,
        totalLengthM: horizontalLengthM + verticalLengthM,
    };
}

export interface ConductorLength {
    horizontalLengthM: number;
    verticalLengthM: number;
    totalLengthM: number;
}

/**
 * Longitud de un conductor individual (tramo origen→waypoints→destino, más
 * el tramo vertical según altura de montaje) — mismo criterio geométrico que
 * usa `calculatePanelCircuitSummaries` para el Cálculo CT, expuesto acá para
 * mostrar la longitud de un cable puntual en el panel de propiedades.
 * Devuelve `null` si el origen o el destino ya no existen en la escena.
 */
export function calculateConductorLength(
    scene: Scene,
    conductor: Conductor,
): ConductorLength | null {
    const fixtures = scene.fixtures ?? [];
    const switches = scene.lightSwitches ?? [];
    const devices = scene.electricalDevices ?? [];

    const source = resolveNode(conductor.sourceId, fixtures, switches, devices);
    const target = resolveNode(conductor.targetId, fixtures, switches, devices);
    if (!source || !target) return null;

    return conductorLengthComponents(scene, conductor, source, target);
}

/**
 * Longitud de una línea conectada, sin repetir montantes en nodos
 * compartidos: un interruptor/luminaria/tablero que es el destino de UN
 * conductor del grupo y el origen del SIGUIENTE (ej. TD→interruptor→
 * luminaria) tiene una sola bajada física — antes esta función sumaba
 * `conductorLengthComponents()` de cada conductor de forma independiente,
 * así que ese nodo compartido se contaba dos veces (una como destino del
 * primer tramo, otra como origen del segundo), sobrestimando la longitud
 * vertical del grupo completo. Se deduplica por `node.id`: cada nodo aporta
 * su `nodeVerticalAllowance()` una sola vez, sin importar en cuántos
 * conductores del grupo participe.
 */
export function calculateConductorGroupLength(
    scene: Scene,
    conductorIds: string[],
): ConductorLength {
    const fixtures = scene.fixtures ?? [];
    const switches = scene.lightSwitches ?? [];
    const devices = scene.electricalDevices ?? [];
    let horizontalLengthM = 0;
    let verticalLengthM = 0;
    const countedNodeIds = new Set<string>();

    for (const conductor of (scene.conductors ?? []).filter((item) => conductorIds.includes(item.id))) {
        const source = resolveNode(conductor.sourceId, fixtures, switches, devices);
        const target = resolveNode(conductor.targetId, fixtures, switches, devices);
        if (!source || !target) continue;

        horizontalLengthM += conductorPlanLength(conductor, source, target);
        for (const node of [source, target]) {
            if (countedNodeIds.has(node.id)) continue;
            countedNodeIds.add(node.id);
            verticalLengthM += nodeVerticalAllowance(scene, node, conductor);
        }
    }

    return {
        horizontalLengthM,
        verticalLengthM,
        totalLengthM: horizontalLengthM + verticalLengthM,
    };
}

function roomHeightAt(scene: Scene, point: Vertex): number {
    const room = scene.rooms.find(
        (item) => item.vertices.length >= 3 && pointInPolygon(point, item.vertices),
    );

    return room?.height ?? scene.floorHeight ?? DEFAULT_ROOM_HEIGHT;
}

/** Altura horizontal visible/efectiva de una ruta de cable. */
export function resolveConductorRouteHeight(
    scene: Scene,
    conductor: Conductor,
): number {
    if (conductor.routeHeightM !== undefined && conductor.routeHeightM > 0) {
        return conductor.routeHeightM;
    }

    const fixtures = scene.fixtures ?? [];
    const switches = scene.lightSwitches ?? [];
    const devices = scene.electricalDevices ?? [];
    const endpoints = [
        resolveNode(conductor.sourceId, fixtures, switches, devices),
        resolveNode(conductor.targetId, fixtures, switches, devices),
    ].filter((node): node is WireNode => node !== null);

    return endpoints.length > 0
        ? Math.max(...endpoints.map((node) => roomHeightAt(scene, node)))
        : scene.floorHeight ?? DEFAULT_ROOM_HEIGHT;
}

function switchLabel(lightSwitch: LightSwitch): string {
    return lightSwitch.label || lightSwitch.type;
}

function wallLabel(scene: Scene, wallId: string | null): string {
    if (!wallId) return 'Sin pared';

    const wallIndex = scene.walls.findIndex((wall) => wall.id === wallId);
    return wallIndex >= 0 ? `Pared ${wallIndex + 1}` : 'Pared no encontrada';
}

function switchVerticalDrop(scene: Scene, lightSwitch: LightSwitch): number {
    const roomHeight = roomHeightAt(scene, lightSwitch);
    const mountingHeight = lightSwitch.mountingHeight ?? DEFAULT_SWITCH_HEIGHT;

    return Math.max(0, roomHeight - mountingHeight);
}

export function calculateWireLengthByWall(scene: Scene): WireLengthWallRow[] {
    const groups = new Map<string, WireLengthWallRow>();
    const switches = scene.lightSwitches ?? [];
    const conductors = scene.conductors ?? [];
    const fixtures = scene.fixtures ?? [];
    const devices = scene.electricalDevices ?? [];

    for (const conductor of conductors) {
        const source = resolveNode(conductor.sourceId, fixtures, switches, devices);
        const target = resolveNode(conductor.targetId, fixtures, switches, devices);
        if (!source || !target) continue;

        const sourceSwitch = source.nodeType === 'switch' ? source : null;
        const targetSwitch = target.nodeType === 'switch' ? target : null;
        const primarySwitch = targetSwitch ?? sourceSwitch;
        const wallId = primarySwitch?.wallId ?? null;
        const key = wallId ?? '__no_wall__';

        const existing = groups.get(key) ?? {
            wallId,
            wallLabel: wallLabel(scene, wallId),
            conductorCount: 0,
            switchLabels: [],
            horizontalLength: 0,
            verticalAllowance: 0,
            totalLength: 0,
        };

        const horizontalLength = conductorPlanLength(conductor, source, target);
        const switchEndpoints = [sourceSwitch, targetSwitch].filter(
            (item): item is LightSwitch & { nodeType: 'switch' } => Boolean(item),
        );
        const verticalAllowance =
            conductor.routeType === 'wall_ceiling'
                ? switchEndpoints.reduce(
                      (total, lightSwitch) =>
                          total + switchVerticalDrop(scene, lightSwitch),
                      0,
                  )
                : 0;

        existing.conductorCount += 1;
        existing.horizontalLength += horizontalLength;
        existing.verticalAllowance += verticalAllowance;
        existing.totalLength += horizontalLength + verticalAllowance;

        for (const lightSwitch of switchEndpoints) {
            const label = switchLabel(lightSwitch);
            if (!existing.switchLabels.includes(label)) {
                existing.switchLabels.push(label);
            }
        }

        groups.set(key, existing);
    }

    return [...groups.values()].sort((a, b) => b.totalLength - a.totalLength);
}

export interface RoomWireSummary {
    /** Focos ("puntos") que pertenecen a este recinto (Fixture.roomId). */
    pointCount: number;
    conductorCount: number;
    totalLength: number;
}

/**
 * Resumen de cableado para un conjunto de focos ("puntos") ya resueltos por
 * el llamador (p.ej. getFixturesForRoom, que entiende ambientes/pasadizos) —
 * suma la longitud (plano + tramo vertical hacia el interruptor) de los
 * conductores que llegan a esos focos.
 */
export function calculateRoomWireSummary(
    scene: Scene,
    roomFixtures: Fixture[],
): RoomWireSummary {
    const fixtures = scene.fixtures ?? [];
    const switches = scene.lightSwitches ?? [];
    const devices = scene.electricalDevices ?? [];
    const roomFixtureIds = new Set(roomFixtures.map((f) => f.id));

    const conductors = (scene.conductors ?? []).filter(
        (c) => roomFixtureIds.has(c.sourceId) || roomFixtureIds.has(c.targetId),
    );

    let totalLength = 0;
    for (const conductor of conductors) {
        const source = resolveNode(conductor.sourceId, fixtures, switches, devices);
        const target = resolveNode(conductor.targetId, fixtures, switches, devices);
        if (!source || !target) continue;

        const horizontalLength = conductorPlanLength(conductor, source, target);
        const switchEndpoints = [source, target].filter(
            (item): item is LightSwitch & { nodeType: 'switch' } =>
                item.nodeType === 'switch',
        );
        const verticalAllowance =
            conductor.routeType === 'wall_ceiling'
                ? switchEndpoints.reduce(
                      (total, lightSwitch) => total + switchVerticalDrop(scene, lightSwitch),
                      0,
                  )
                : 0;

        totalLength += horizontalLength + verticalAllowance;
    }

    return {
        pointCount: roomFixtureIds.size,
        conductorCount: conductors.length,
        totalLength,
    };
}

export interface PanelCircuitRoomLoad {
    roomId: string;
    roomName: string;
    fixtureCount: number;
    outletCount: number;
    /** Alumbrado + tomacorrientes de este ambiente. */
    installedPowerW: number;
    lightingPowerW: number;
    outletPowerW: number;
    /** Texto legible que distingue alumbrado de tomacorriente, p.ej. "6×26 W alumbrado + 2×180 W tomacorriente". */
    detail: string;
}

export interface PanelCircuitSummary {
    levelId: string;
    levelName: string;
    levelIndex: number;
    panelId: string;
    panelLabel: string;
    panelType: 'main_panel' | 'sub_panel';
    panelLengthM: number;
    connectionType: 'delta' | 'star';
    designFactor: number;
    copperResistivity: number;
    code: string;
    rootConductorId: string;
    conductorCount: number;
    horizontalLengthM: number;
    verticalLengthM: number;
    lengthM: number;
    /** true si `lengthM` viene de la "Longitud del tablero" declarada del hijo, no del trazo del plano. */
    lengthOverridden: boolean;
    lightingOutletCount: number;
    outletOutletCount: number;
    installedPowerW: number;
    lightingPowerW: number;
    outletPowerW: number;
    forcePowerW: number;
    /**
     * Clasificación de la salida según CNE-Utilización / RNE EM.010:
     * `lighting`/`outlet` = derivación final de un solo tipo (correcto);
     * `feeder` = alimenta a otro tablero, agrega ambos tipos aguas abajo
     * (normal, no es violación); `mixed` = derivación final que llega a la
     * vez a una luminaria y a un tomacorriente (violación: deben separarse
     * en circuitos y tuberías distintas); `unclassified` = sin cargas.
     */
    circuitLoadType: 'lighting' | 'outlet' | 'feeder' | 'mixed' | 'unclassified';
    /** true cuando `circuitLoadType === 'mixed'`: alumbrado y tomacorriente comparten la misma salida. */
    normativeViolation: boolean;
    installedPowerKw: number;
    demandFactor: number;
    maximumDemandKw: number;
    powerFactor: number;
    rooms: PanelCircuitRoomLoad[];
    traversedRoomNames: string[];
    /** Tableros alimentados directamente por esta salida. */
    fedPanelLabels: string[];
    sectionMm2: number;
    voltageV: number;
    circuitVoltageV: number;
    phases: 1 | 3;
    currentA: number;
    theoreticalDesignCurrentA: number;
    phaseBalance: 'R' | 'S' | 'T' | 'RST' | 'RS' | 'ST' | 'TR';
    phaseCurrentR: number;
    phaseCurrentS: number;
    phaseCurrentT: number;
    nominalCableCurrentA: number;
    ambientTemperatureC: number;
    groupedCircuitCount: number;
    groupingFactor: number;
    temperatureFactor: number;
    admissibleCableCurrentA: number;
    capacityConforms: boolean;
    itm: string;
    dif: string;
    conductorType: string;
    tubeDiameterMm: number;
    earthSectionMm2: number;
    upstreamVoltageDropV: number;
    voltageDropV: number;
    voltageDropPct: number;
    maxVoltageDropPct: number;
    voltageDropOk: boolean;
    /** Si es true, esta fila no representa una salida del tablero, sino el resumen/alimentador del tablero en sí */
    isPanelSummary?: boolean;
}

/**
 * Forma intermedia de un circuito antes de resolver la caída de tensión
 * (ver "Pasada 2" en `calculatePanelCircuitSummaries`): todo lo demás ya
 * está calculado, pero `voltageDropV`/`voltageDropPct`/`voltageDropOk`/
 * `upstreamVoltageDropV` dependen de conocer el árbol completo de tableros
 * primero, así que se guarda el aporte propio del tramo (`circuitOwnDropV`)
 * para sumarlo recién cuando se sepa el ΔV heredado del padre.
 */
type PartialPanelCircuit = Omit<
    PanelCircuitSummary,
    'upstreamVoltageDropV' | 'voltageDropV' | 'voltageDropPct' | 'voltageDropOk'
> & { circuitOwnDropV: number };

const PANEL_TYPES = new Set(['main_panel', 'sub_panel']);
const DEFAULT_VOLTAGE = 220;
const DEFAULT_POWER_FACTOR = 0.9;
const DEFAULT_MAX_VOLTAGE_DROP_PCT = 2.5;

export const CONDUCTOR_CAPACITIES: Record<string, Record<number, number>> = {
    'TW': { 2.5: 24, 4: 31, 6: 39, 10: 51, 16: 68, 25: 88, 35: 110, 50: 138, 70: 165, 95: 198, 120: 165, 150: 264, 185: 303, 240: 352, 300: 391 },
    'THW': { 2.5: 27, 4: 34, 6: 44, 10: 62, 16: 85, 25: 107, 35: 135, 50: 160, 70: 203, 95: 242, 120: 279, 150: 318, 185: 361, 240: 406, 300: 462 },
    'THW-90': { 2.5: 27, 4: 34, 6: 44, 10: 62, 16: 85, 25: 107, 35: 135, 50: 160, 70: 203, 95: 242, 120: 279, 150: 318, 185: 361, 240: 406, 300: 462 },
    'NYY': { 2.5: 32, 4: 43, 6: 58, 10: 77, 16: 102, 25: 132, 35: 157, 50: 186, 70: 222, 95: 265, 120: 301, 150: 338, 185: 367, 240: 426, 300: 480 },
    'LSOH-80': { 2.5: 24, 4: 31, 6: 39, 10: 51, 16: 68, 25: 88, 35: 110, 50: 138, 70: 165, 95: 198, 120: 231, 150: 264, 185: 303, 240: 352, 300: 391 },
    'NH-80': { 2.5: 24, 4: 31, 6: 39, 10: 51, 16: 68, 25: 88, 35: 110, 50: 138, 70: 165, 95: 198, 120: 231, 150: 264, 185: 303, 240: 352, 300: 391 },
    'LSOH-90': { 2.5: 27, 4: 34, 6: 44, 10: 62, 16: 85, 25: 107, 35: 135, 50: 160, 70: 203, 95: 242, 120: 279, 150: 318, 185: 361, 240: 406, 300: 462 },
    'N2XOH': { 2.5: 38, 4: 55, 6: 68, 10: 95, 16: 125, 25: 160, 35: 195, 50: 230, 70: 275, 95: 330, 120: 380, 150: 410, 185: 450, 240: 525, 300: 600, 400: 680, 500: 700 },
    'N2X0H': { 2.5: 38, 4: 55, 6: 68, 10: 95, 16: 125, 25: 160, 35: 195, 50: 230, 70: 275, 95: 330, 120: 380, 150: 410, 185: 450, 240: 525, 300: 600, 400: 680, 500: 700 }
};

export function defaultNominalCableCurrent(sectionMm2: number, conductorType: string = 'THW'): number {
    const capacities = CONDUCTOR_CAPACITIES[conductorType] || CONDUCTOR_CAPACITIES['THW'];
    const sections = Object.keys(capacities).map(Number).sort((a, b) => a - b);
    // BUSCARV sin cuarto argumento: coincidencia aproximada sobre tabla
    // ascendente, equivalente al mayor calibre <= valor buscado.
    const section = [...sections].reverse().find(s => s <= sectionMm2);
    if (section === undefined) return 0;
    return capacities[section] ?? 0;
}

export function calculatePanelTotalCurrentA(
    phaseCurrentR: number,
    phaseCurrentS: number,
    phaseCurrentT: number,
    designFactor: number,
): number {
    if (designFactor <= 0) return 0;

    return Math.max(phaseCurrentR, phaseCurrentS, phaseCurrentT) / designFactor;
}

/** Excel V: factor K1 según cantidad de circuitos agrupados (Tabla 5Dc). */
export function excelGroupingFactor(groupedCircuitCount: number): number {
    if (groupedCircuitCount <= 1) return 1;
    if (groupedCircuitCount === 2) return 0.85;
    if (groupedCircuitCount === 3) return 0.75;
    if (groupedCircuitCount === 4) return 0.7;
    if (groupedCircuitCount === 5) return 0.65;
    if (groupedCircuitCount === 6) return 0.6;
    return 0;
}

/** Excel W: factor K2 según temperatura ambiente (Tabla 5A). */
export function excelTemperatureFactor(ambientTemperatureC: number): number {
    const factors = new Map([
        [10, 1.07],
        [15, 1.04],
        [20, 1],
        [25, 0.96],
        [30, 0.93],
        [35, 0.89],
        [40, 0.85],
    ]);

    return factors.get(ambientTemperatureC) ?? 0;
}

/** Excel AG5: ρCuT = 1/58 × (1 + 0.00393 × (temperatura - 20)). */
export function excelCopperResistivity(ambientTemperatureC: number): number {
    return (1 / 58) * (1 + 0.00393 * (ambientTemperatureC - 20));
}

function numericProperty(value: string | undefined, fallback: number): number {
    const parsed = Number.parseFloat(value?.replace(',', '.') ?? '');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function phasesProperty(value: string | undefined): 1 | 3 {
    return value?.trim().startsWith('3') ? 3 : 1;
}

function ambientNamesAlongConductor(
    conductor: Conductor,
    source: WireNode,
    target: WireNode,
    ambients: ReturnType<typeof deriveSceneAmbientSpaces>,
): string[] {
    const names = new Set<string>();
    const points = [source, ...(conductor.waypoints ?? []), target];

    for (let index = 1; index < points.length; index += 1) {
        const start = points[index - 1];
        const end = points[index];
        const segmentLength = distance(start, end);
        const sampleCount = Math.max(1, Math.ceil(segmentLength / 0.25));

        for (let sample = 0; sample <= sampleCount; sample += 1) {
            const ratio = sample / sampleCount;
            const point = {
                x: start.x + (end.x - start.x) * ratio,
                y: start.y + (end.y - start.y) * ratio,
            };
            const ambient = ambients.find((item) =>
                pointInPolygon(point, item.room.vertices),
            );
            if (ambient) names.add(ambient.name);
        }
    }

    return [...names];
}

/** Resume cada salida física de tablero siguiendo la red de conductores hasta sus cargas finales. */
export function calculatePanelCircuitSummaries(scene: Scene): PanelCircuitSummary[] {
    const fixtures = scene.fixtures ?? [];
    const switches = scene.lightSwitches ?? [];
    const devices = scene.electricalDevices ?? [];
    const conductors = scene.conductors ?? [];
    // TG primero, TD después: cuando el mismo conductor físico toca dos
    // tableros (el alimentador TG→TD), el tablero procesado primero se
    // queda como dueño de esa salida (ver claimedConductorIds más abajo).
    // Sin este orden, el TD también la contaba como "su propia salida"
    // hacia el TG (la relación invertida), generando una fila fantasma con
    // 0 A / 0 m que aparecía como "Cumple" o "No cumple" sin significar nada.
    const panels = devices
        .filter((device) => PANEL_TYPES.has(device.type))
        .sort((a, b) => (a.type === 'main_panel' ? 0 : 1) - (b.type === 'main_panel' ? 0 : 1));
    const panelIds = new Set(panels.map((panel) => panel.id));
    const nodeById = new Map<string, WireNode>();
    const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
    const outletById = new Map(
        devices.filter((device) => isOutletDeviceType(device.type)).map((device) => [device.id, device]),
    );
    const roomById = new Map(scene.rooms.map((room) => [room.id, room]));
    const derivedAmbients = deriveSceneAmbientSpaces(scene);
    const derivedAmbientById = new Map<string, ReturnType<typeof deriveSceneAmbientSpaces>[number]>();
    derivedAmbients.forEach((ambient) => {
        derivedAmbientById.set(ambient.id, ambient);
        derivedAmbientById.set(ambient.room.id, ambient);
    });
    const conductorsByNode = new Map<string, Conductor[]>();
    fixtures.forEach((fixture) => nodeById.set(fixture.id, { ...fixture, nodeType: 'fixture' }));
    switches.forEach((lightSwitch) => nodeById.set(lightSwitch.id, { ...lightSwitch, nodeType: 'switch' }));
    devices.forEach((device) => nodeById.set(device.id, { ...device, nodeType: 'device' }));
    conductors.forEach((conductor) => {
        conductorsByNode.set(conductor.sourceId, [...(conductorsByNode.get(conductor.sourceId) ?? []), conductor]);
        conductorsByNode.set(conductor.targetId, [...(conductorsByNode.get(conductor.targetId) ?? []), conductor]);
    });

    const collectDownstreamLoads = (
        panelId: string,
        excludedConductorIds: ReadonlySet<string>,
    ): { fixtureIds: Set<string>; outletIds: Set<string> } => {
        const reachedFixtures = new Set<string>();
        const reachedOutlets = new Set<string>();
        const visitedConductors = new Set(excludedConductorIds);
        const pendingNodes = [panelId];
        const visitedNodes = new Set<string>();

        while (pendingNodes.length > 0) {
            const nodeId = pendingNodes.shift()!;
            if (visitedNodes.has(nodeId)) continue;
            visitedNodes.add(nodeId);

            for (const conductor of conductorsByNode.get(nodeId) ?? []) {
                if (visitedConductors.has(conductor.id)) continue;
                visitedConductors.add(conductor.id);
                const nextNodeId =
                    conductor.sourceId === nodeId
                        ? conductor.targetId
                        : conductor.sourceId;
                if (fixtureById.has(nextNodeId)) reachedFixtures.add(nextNodeId);
                if (outletById.has(nextNodeId)) reachedOutlets.add(nextNodeId);
                pendingNodes.push(nextNodeId);
            }
        }

        return { fixtureIds: reachedFixtures, outletIds: reachedOutlets };
    };

    // Conductores ya atribuidos a un tablero (como salida propia o como
    // tramo intermedio de su recorrido). Un tablero aguas abajo no puede
    // reclamar como "su propia salida" un conductor que ya forma parte del
    // recorrido de un tablero aguas arriba.
    const claimedConductorIds = new Set<string>();

    // Relación padre→hijo del árbol de tableros: se llena mientras se
    // recorren las salidas (abajo) cada vez que una salida alimenta a un
    // único tablero hijo. Se usa después para encadenar la caída de
    // tensión (sección "Pasada 2").
    const feederLinks: Array<{ parentPanelId: string; rootConductorId: string; childPanelId: string }> = [];

    const partialCircuits = panels.flatMap((panel) => {
        const exits = (conductorsByNode.get(panel.id) ?? []).filter(
            (conductor) => !claimedConductorIds.has(conductor.id),
        );
        const circuitNumberByPanel = new Map<string, number>();

        return exits.map((root) => {
            const nextCircuitNumber = (circuitNumberByPanel.get(panel.id) ?? 0) + 1;
            circuitNumberByPanel.set(panel.id, nextCircuitNumber);
            const visitedConductors = new Set<string>();
            const reachedFixtures = new Set<string>();
            const reachedOutlets = new Set<string>();
            const reachedPanelIds = new Set<string>();
            const traversedRoomNames = new Set<string>();
            const queue: Array<{ conductor: Conductor; fromNodeId: string }> = [{ conductor: root, fromNodeId: panel.id }];
            let horizontalLengthM = 0;
            let verticalLengthM = 0;

            while (queue.length > 0) {
                const current = queue.shift()!;
                if (visitedConductors.has(current.conductor.id)) continue;
                visitedConductors.add(current.conductor.id);

                const source = nodeById.get(current.conductor.sourceId);
                const target = nodeById.get(current.conductor.targetId);
                if (!source || !target) continue;
                const lengths = conductorLengthComponents(
                    scene,
                    current.conductor,
                    source,
                    target,
                );
                horizontalLengthM += lengths.horizontalLengthM;
                verticalLengthM += lengths.verticalLengthM;
                ambientNamesAlongConductor(
                    current.conductor,
                    source,
                    target,
                    derivedAmbients,
                ).forEach((name) => traversedRoomNames.add(name));

                const nextNodeId = current.conductor.sourceId === current.fromNodeId
                    ? current.conductor.targetId
                    : current.conductor.sourceId;
                if (fixtureById.has(nextNodeId)) reachedFixtures.add(nextNodeId);
                if (outletById.has(nextNodeId)) reachedOutlets.add(nextNodeId);
                if (panelIds.has(nextNodeId)) {
                    if (nextNodeId !== panel.id) reachedPanelIds.add(nextNodeId);
                    continue;
                }

                for (const candidate of conductorsByNode.get(nextNodeId) ?? []) {
                    if (visitedConductors.has(candidate.id)) continue;
                    if (candidate.sourceId === nextNodeId || candidate.targetId === nextNodeId) {
                        queue.push({ conductor: candidate, fromNodeId: nextNodeId });
                    }
                }
            }

            // Reclama todo el tramo recorrido por esta salida para que
            // ningún otro tablero de la cadena (aguas abajo) lo vuelva a
            // contar como si fuera propio.
            visitedConductors.forEach((id) => claimedConductorIds.add(id));

            reachedPanelIds.forEach((downstreamPanelId) => {
                const downstream = collectDownstreamLoads(downstreamPanelId, visitedConductors);
                downstream.fixtureIds.forEach((fixtureId) => reachedFixtures.add(fixtureId));
                downstream.outletIds.forEach((outletId) => reachedOutlets.add(outletId));
            });

            // Si esta salida alimenta a un único tablero hijo y ese tablero
            // declaró su propia "Longitud del tablero" (el cable real que se
            // va a instalar — a veces más largo que el trazo del plano por
            // ductos, subterráneo, etc.), esa longitud reemplaza la medida
            // en el CAD para el cálculo de ΔV de esta fila.
            let lengthOverridden = false;
            if (reachedPanelIds.size === 1) {
                const [downstreamPanelId] = reachedPanelIds;
                const downstreamPanel = devices.find((device) => device.id === downstreamPanelId);
                const declaredLengthM = downstreamPanel?.properties?.lengthM ?? 0;
                if (declaredLengthM > 0) {
                    horizontalLengthM = Math.max(0, declaredLengthM - verticalLengthM);
                    lengthOverridden = true;
                }
            }

            // Ubica el ambiente que contiene un punto (luminaria o
            // tomacorriente) con el mismo criterio: roomId explícito primero,
            // luego el ambiente derivado (rasterizado, ya calculado una sola
            // vez para toda la escena arriba), y por último el polígono
            // crudo del Room.
            const roomIdFor = (point: Vertex, explicitRoomId?: string): string => {
                const explicitRoom = explicitRoomId ? roomById.get(explicitRoomId) : undefined;
                const containingAmbient =
                    (explicitRoomId ? derivedAmbientById.get(explicitRoomId) : undefined) ??
                    findAmbientSpaceContainingPoint(derivedAmbients, point);
                const containingRoom = explicitRoom
                    ?? containingAmbient?.room
                    ?? scene.rooms.find((room) => pointInPolygon(point, room.vertices));
                return containingAmbient?.room.id ?? containingRoom?.id ?? '__sin_ambiente__';
            };

            const loadsByRoom = new Map<string, { fixtures: Fixture[]; outlets: ElectricalDevice[] }>();
            for (const fixtureId of reachedFixtures) {
                const fixture = fixtureById.get(fixtureId);
                if (!fixture) continue;
                const roomId = roomIdFor(fixture, fixture.roomId);
                const entry = loadsByRoom.get(roomId) ?? { fixtures: [], outlets: [] };
                entry.fixtures.push(fixture);
                loadsByRoom.set(roomId, entry);
            }
            for (const outletId of reachedOutlets) {
                const outlet = outletById.get(outletId);
                if (!outlet) continue;
                const roomId = roomIdFor(outlet, outlet.roomId);
                const entry = loadsByRoom.get(roomId) ?? { fixtures: [], outlets: [] };
                entry.outlets.push(outlet);
                loadsByRoom.set(roomId, entry);
            }

            const rooms = [...loadsByRoom.entries()].map(([roomId, { fixtures: roomFixtures, outlets: roomOutlets }]) => {
                const lightingGroups = new Map<number, number>();
                roomFixtures.forEach((fixture) => {
                    const power = Math.max(0, fixture.power ?? 0);
                    lightingGroups.set(power, (lightingGroups.get(power) ?? 0) + 1);
                });
                const outletGroups = new Map<number, number>();
                roomOutlets.forEach((outlet) => {
                    const power = Math.max(0, outlet.properties?.ratedPowerW ?? DEFAULT_OUTLET_POWER_W);
                    outletGroups.set(power, (outletGroups.get(power) ?? 0) + 1);
                });
                const lightingPowerW = roomFixtures.reduce((sum, fixture) => sum + Math.max(0, fixture.power ?? 0), 0);
                const outletPowerW = roomOutlets.reduce(
                    (sum, outlet) => sum + Math.max(0, outlet.properties?.ratedPowerW ?? DEFAULT_OUTLET_POWER_W),
                    0,
                );
                const lightingDetail = [...lightingGroups.entries()]
                    .map(([power, count]) => `${count}×${power} W alumbrado`)
                    .join(' + ');
                const outletDetail = [...outletGroups.entries()]
                    .map(([power, count]) => `${count}×${power} W tomacorriente`)
                    .join(' + ');
                return {
                    roomId,
                    roomName:
                        derivedAmbientById.get(roomId)?.name
                        ?? roomById.get(roomId)?.name
                        ?? 'Sin ambiente asignado',
                    fixtureCount: roomFixtures.length,
                    outletCount: roomOutlets.length,
                    installedPowerW: lightingPowerW + outletPowerW,
                    lightingPowerW,
                    outletPowerW,
                    detail: [lightingDetail, outletDetail].filter(Boolean).join(' + '),
                };
            });

            const voltageV = numericProperty(panel.properties?.voltage, DEFAULT_VOLTAGE);
            const phases = root.ct?.system ?? phasesProperty(panel.properties?.phases);
            const sectionMm2 = Math.max(0, root.sectionMm2 ?? 0);
            const lengthM = horizontalLengthM + verticalLengthM;
            const lightingPowerW = rooms.reduce((sum, room) => sum + room.lightingPowerW, 0);
            // PI tomas = suma automática de los tomacorrientes realmente
            // cableados a esta salida + cualquier ajuste manual que ya
            // existiera desde el diálogo CT (compatibilidad con proyectos
            // guardados antes de que los tomacorrientes se contaran solos).
            const autoOutletPowerW = rooms.reduce((sum, room) => sum + room.outletPowerW, 0);
            const outletPowerW = autoOutletPowerW + Math.max(0, root.ct?.outletPowerW ?? 0);
            const forcePowerW = Math.max(0, root.ct?.forcePowerW ?? 0);

            // Clasificación normativa (CNE-Utilización / RNE EM.010): un
            // alimentador hacia otro tablero SÍ agrega alumbrado +
            // tomacorrientes (es la suma de todo lo que hay aguas abajo, y
            // eso es normal). Una salida final que NO alimenta a otro
            // tablero pero llega a la vez a una luminaria y a un
            // tomacorriente SÍ es una violación: deben ir en circuitos y
            // tuberías separados, nunca compartidos.
            const isFeederCircuit = reachedPanelIds.size > 0;
            const hasLightingLoad = reachedFixtures.size > 0;
            const hasOutletLoad = reachedOutlets.size > 0;
            const circuitLoadType: PanelCircuitSummary['circuitLoadType'] = isFeederCircuit
                ? 'feeder'
                : hasLightingLoad && hasOutletLoad
                    ? 'mixed'
                    : hasOutletLoad
                        ? 'outlet'
                        : hasLightingLoad
                            ? 'lighting'
                            : 'unclassified';
            const normativeViolation = circuitLoadType === 'mixed';
            if (circuitLoadType === 'feeder' && reachedPanelIds.size === 1) {
                feederLinks.push({
                    parentPanelId: panel.id,
                    rootConductorId: root.id,
                    childPanelId: [...reachedPanelIds][0],
                });
            }
            const totalInstalledPowerW =
                lightingPowerW + outletPowerW + forcePowerW;
            const installedPowerKw = totalInstalledPowerW / 1000;
            const demandFactor = Math.max(
                0,
                root.ct?.demandFactor ??
                    panel.properties?.defaultDemandFactor ??
                    1,
            );
            const maximumDemandKw = installedPowerKw * demandFactor;
            const powerFactor = Math.min(
                1,
                Math.max(
                    0.01,
                    root.ct?.powerFactor ??
                        panel.properties?.defaultPowerFactor ??
                        DEFAULT_POWER_FACTOR,
                ),
            );
            const designFactor = Math.max(
                0,
                panel.properties?.designFactor ?? 1.25,
            );
            const circuitVoltageV = phases === 1 ? 220 : voltageV;
            const currentA = circuitCurrent(
                maximumDemandKw * 1000,
                circuitVoltageV,
                phases,
                powerFactor,
            );
            const theoreticalDesignCurrentA = currentA * designFactor;
            const phaseBalance =
                phases === 3 ? 'RST' : (root.ct?.phaseBalance ?? 'R');
            const phaseCurrentR =
                phaseBalance === 'R' || phaseBalance === 'RST' || phaseBalance === 'RS' || phaseBalance === 'TR' ? theoreticalDesignCurrentA : 0;
            const phaseCurrentS =
                phaseBalance === 'S' || phaseBalance === 'RST' || phaseBalance === 'RS' || phaseBalance === 'ST' ? theoreticalDesignCurrentA : 0;
            const phaseCurrentT =
                phaseBalance === 'T' || phaseBalance === 'RST' || phaseBalance === 'ST' || phaseBalance === 'TR' ? theoreticalDesignCurrentA : 0;
            const maximumPhaseCurrent = Math.max(
                phaseCurrentR,
                phaseCurrentS,
                phaseCurrentT,
            );
            const nominalCableCurrentA = Math.max(
                0,
                root.ct?.nominalCableCurrentA ??
                    defaultNominalCableCurrent(sectionMm2, root.conductorType),
            );
            const groupedCircuitCount = Math.max(
                1,
                root.ct?.groupedCircuitCount ?? 1,
            );
            const groupingFactor = Math.max(
                0,
                root.ct?.groupingFactor ?? excelGroupingFactor(groupedCircuitCount),
            );
            // Excel T: temperatura ambiente solo determina K2.
            const ambientC = root.ct?.ambientTemperatureC ?? panel.properties?.ambientTemperatureC ?? 20;
            const temperatureFactor = Math.max(
                0,
                root.ct?.temperatureFactor ?? excelTemperatureFactor(ambientC),
            );
            const admissibleCableCurrentA =
                nominalCableCurrentA * groupingFactor * temperatureFactor;
            // Excel AG5 usa AD5 (temperatura de trabajo, 40 °C), no T. AMB.
            const workingTemperatureC = panel.properties?.workingTemperatureC ?? 40;
            const autoCopperResistivity = excelCopperResistivity(workingTemperatureC);
            const copperResistivity = Math.max(
                0,
                root.ct?.copperResistivity ?? autoCopperResistivity,
            );
            // Aporte propio de ESTE tramo a la caída de tensión (todavía sin
            // sumar lo que ya cayó aguas arriba — eso se resuelve en la
            // "Pasada 2", después de conocer el árbol completo de tableros,
            // para poder encadenar padre→hijo en vez de leer un número fijo).
            //
            // Auditoría `dialux-electrical-reviewer`: esta fórmula multiplicaba
            // por `powerFactor` además de usar `maximumPhaseCurrent` — pero
            // `maximumPhaseCurrent` viene de `currentA = circuitCurrent(P, V,
            // phases, powerFactor)` (línea de arriba), que YA divide entre
            // `powerFactor` para obtener la corriente REAL (I = P/(V·cosφ)).
            // Multiplicar otra vez por `powerFactor` aquí contaba el factor de
            // potencia dos veces, subestimando la caída ~10-30% según el fp
            // configurado — confirmado numéricamente contra
            // `engine/formulas.ts::voltageDropPct` (que NO tiene este término,
            // porque su `currentA` de entrada ya es corriente real, igual que
            // aquí). El modelo de caída de tensión resistiva pura (ΔV=k·ρ·L·I/S)
            // no lleva ningún término de `cosφ` adicional cuando I ya es la
            // corriente real — ese factor solo aparecería en el término
            // reactivo (X·sinφ) de la fórmula completa con impedancia, que
            // este modelo no calcula (ni antes ni después de este fix).
            const circuitOwnDropV =
                sectionMm2 > 0
                    ? (phases === 1 ? 2 : Math.sqrt(3)) *
                      maximumPhaseCurrent *
                      copperResistivity *
                      lengthM *
                      powerFactor /
                      sectionMm2
                    : Number.POSITIVE_INFINITY;
            const maxVoltageDropPct =
                root.ct?.voltageDropLimitPct ??
                (reachedPanelIds.size > 0
                    ? DEFAULT_MAX_VOLTAGE_DROP_PCT
                    : 4);

            return {
                levelId: scene.id,
                levelName: scene.name,
                levelIndex: scene.floorIndex ?? 0,
                panelId: panel.id,
                panelLabel: panel.label || (panel.type === 'main_panel' ? 'TG' : 'TD'),
                panelType: panel.type as 'main_panel' | 'sub_panel',
                panelLengthM: Math.max(0, panel.properties?.lengthM ?? 0),
                connectionType:
                    panel.properties?.connectionType ?? 'star',
                designFactor,
                copperResistivity,
                code: `C-${nextCircuitNumber}`,
                rootConductorId: root.id,
                conductorCount: visitedConductors.size,
                horizontalLengthM,
                verticalLengthM,
                lengthM,
                lengthOverridden,
                lightingOutletCount: reachedFixtures.size,
                outletOutletCount: reachedOutlets.size,
                installedPowerW: totalInstalledPowerW,
                lightingPowerW,
                outletPowerW,
                forcePowerW,
                circuitLoadType,
                normativeViolation,
                installedPowerKw,
                demandFactor,
                maximumDemandKw,
                powerFactor,
                rooms,
                traversedRoomNames: [...traversedRoomNames],
                fedPanelLabels: [...reachedPanelIds].map((panelId) => {
                    const downstreamPanel = devices.find(
                        (device) => device.id === panelId,
                    );
                    return downstreamPanel?.label || 'TD';
                }),
                sectionMm2,
                voltageV,
                circuitVoltageV,
                phases,
                currentA,
                theoreticalDesignCurrentA,
                phaseBalance,
                phaseCurrentR,
                phaseCurrentS,
                phaseCurrentT,
                nominalCableCurrentA,
                ambientTemperatureC:
                    root.ct?.ambientTemperatureC ??
                    20,
                groupedCircuitCount,
                groupingFactor,
                temperatureFactor,
                admissibleCableCurrentA,
                capacityConforms:
                    admissibleCableCurrentA > maximumPhaseCurrent,
                itm:
                    root.ct?.itm ??
                    (outletPowerW > 0 ? '1x20 A' : '1x16 A'),
                dif: root.ct?.dif ?? '2x25 A',
                conductorType: root.conductorType,
                tubeDiameterMm: root.tubeSize,
                earthSectionMm2:
                    root.ct?.earthSectionMm2 ?? sectionMm2,
                maxVoltageDropPct,
                circuitOwnDropV,
            };
        });
    });

    // Descarta salidas degeneradas: longitud 0, sin carga (ni propia ni
    // manualmente cargada desde el diálogo CT) y sin alimentar a otro
    // tablero. Normalmente son cables mal conectados (origen y destino en
    // el mismo punto) que, al llevar 0 A, "cumplen" trivialmente y solo
    // agregan ruido a la tabla. Un circuito en obra (p.ej. hacia un
    // interruptor aún sin luminarias) sí tiene longitud real y se conserva.
    const aliveCircuits: PartialPanelCircuit[] = partialCircuits.filter(
        (circuit) =>
            circuit.lengthM > 0 ||
            circuit.installedPowerW > 0 ||
            circuit.fedPanelLabels.length > 0,
    );

    // Ronda 2026-08-19 — fotografía DE SOLO LECTURA de cada circuito por su
    // `rootConductorId`, tomada ANTES de que la Pasada 2 empiece a mutar
    // `aliveCircuits` (splice/unshift más abajo). Un TG con más de un TD
    // (o un TD con un Sub-TD de segundo piso) tiene varias salidas propias,
    // cada una con su propia sección/longitud/ΔV ya calculados aquí en la
    // Pasada 1 (`circuitOwnDropV` de la línea ~930) — bug real encontrado:
    // cuando el tablero HIJO se procesaba primero (hojas→raíz) y usaba
    // `aliveCircuits.splice(...)` para "reclamar" el conductor que lo
    // alimenta, el tablero PADRE se quedaba sin poder leer los datos de ESE
    // MISMO conductor al procesarse después — su fila de resumen caía al
    // valor por defecto `panel.properties?.sectionMm2 ?? 0`, dando
    // `circuitOwnDropV = 0` aunque el cable real tuviera una caída de
    // tensión real y distinta de cero. Esta fotografía deja disponible el
    // dato real para AMBOS lados de cada conductor, sin que ninguno se lo
    // "robe" al otro.
    const circuitByRootConductorId = new Map<string, PartialPanelCircuit>();
    aliveCircuits.forEach((circuit) => circuitByRootConductorId.set(circuit.rootConductorId, circuit));

    // ─── Pasada 2: encadena la caída de tensión padre→hijo ─────────────────
    //
    // Arma el árbol de tableros a partir de `feederLinks` (una salida que
    // alimenta a un único tablero hijo = ese hijo tiene padre) y recorre los
    // tableros en orden topológico (padres antes que hijos). El "baseline"
    // de un tablero con padre es el ΔV YA resuelto de la salida específica
    // del padre que lo alimenta (que a su vez ya sumó el baseline del
    // abuelo); un tablero sin padre en el grafo (TG raíz, o un TD usado
    // suelto sin TG) sigue usando su propiedad manual `upstreamVoltageDropV`
    // — igual que antes de este cambio, para no romper proyectos existentes.

    
    // ─── Generar filas resumen de tableros (Bottom-Up) ───────
    // Primero, preparamos el árbol topológico para saber en qué orden sumar
    const parentOf = new Map<string, { parentPanelId: string; rootConductorId: string }>();
    feederLinks.forEach((link) => {
        if (!parentOf.has(link.childPanelId)) {
            parentOf.set(link.childPanelId, {
                parentPanelId: link.parentPanelId,
                rootConductorId: link.rootConductorId,
            });
        }
    });

    const topologicalOrder: string[] = [];
    const orderedIds = new Set<string>();
    const resolvingIds = new Set<string>();

    const visitPanelOrder = (panelId: string): void => {
        if (orderedIds.has(panelId) || resolvingIds.has(panelId)) return;
        resolvingIds.add(panelId);
        const parent = parentOf.get(panelId);
        if (parent) visitPanelOrder(parent.parentPanelId);
        resolvingIds.delete(panelId);
        orderedIds.add(panelId);
        topologicalOrder.push(panelId);
    };
    panels.forEach((panel) => visitPanelOrder(panel.id));

    // Array de summaries para agregar luego
    const panelSummaryCircuits: PartialPanelCircuit[] = [];

    // Recorremos los paneles de hojas a raíz (reverse topological order)
    const reversedPanels = [...topologicalOrder].reverse();

    reversedPanels.forEach((panelId) => {
        const panel = panels.find((p) => p.id === panelId)!;
        const isMainPanel = panel.type === 'main_panel';

        // Buscamos los circuitos de este tablero (excluyendo el summary que estamos creando)
        const childCircuits = aliveCircuits.filter(c => c.panelId === panel.id);
        
        // Sumatorias bottom-up
        let sumInstalledPowerW = 0;
        let sumMaximumDemandKw = 0;
        let sumPhaseCurrentR = 0;
        let sumPhaseCurrentS = 0;
        let sumPhaseCurrentT = 0;

        // Sumamos de sus hijos directos (circuitos normales o los headers de subtableros que pertenecen a este tablero)
        // Ojo: un subtablero TD aparece en la lista del panel padre como su circuito alimentador.
        // Pero espera! En la tabla visual, los TD están en su propia sección.
        // Si el usuario quiere que el TG sea la sumatoria de todos los TD, necesitamos que TG sume los headers de los TD.
        // Los headers de los TD son `PanelCircuitSummary` que se generaron antes (por iterar en reverse).
        
        if (isMainPanel) {
            // El TG suma las características de los summaries de los TD
            const tdSummaries = panelSummaryCircuits.filter(
                (summary) => summary.panelType === 'sub_panel',
            );
            const tgDemandFactor = Math.max(0, panel.properties?.defaultDemandFactor ?? 1);
            tdSummaries.forEach(td => {
                sumInstalledPowerW += td.installedPowerW;
                sumMaximumDemandKw += td.maximumDemandKw * tgDemandFactor;
                sumPhaseCurrentR += td.phaseCurrentR * tgDemandFactor;
                sumPhaseCurrentS += td.phaseCurrentS * tgDemandFactor;
                sumPhaseCurrentT += td.phaseCurrentT * tgDemandFactor;
            });
        } else {
            // Un TD suma de sus propios circuitos finales
            childCircuits.forEach(c => {
                sumInstalledPowerW += c.installedPowerW;
                sumMaximumDemandKw += c.maximumDemandKw;
                // Excel K(TD): suma directa de la M.D. de sus circuitos.
                sumPhaseCurrentR += c.phaseCurrentR;
                sumPhaseCurrentS += c.phaseCurrentS;
                sumPhaseCurrentT += c.phaseCurrentT;
            });
        }
        
        // Recalcular la corriente nominal del tablero en base a M.D.? 
        // El usuario pide que I dependa de MD.
        const phases = phasesProperty(panel.properties?.phases);
        const powerFactor = Math.min(1, Math.max(0.01, panel.properties?.defaultPowerFactor ?? DEFAULT_POWER_FACTOR));
        const voltageV = numericProperty(panel.properties?.voltage, DEFAULT_VOLTAGE);
        const circuitVoltageV = phases === 1 ? 220 : voltageV;
        
        const designFactor = Math.max(0, panel.properties?.designFactor ?? 1.25);
        const theoreticalDesignCurrentA = circuitCurrent(
            sumMaximumDemandKw * 1000,
            circuitVoltageV,
            phases,
            powerFactor,
        ) * designFactor;
        
        // O tomamos la R,S,T cruda que es la sumatoria directa, tal como pide el usuario.
        // En un TD/TG la R, S, T debe ser la sumatoria de las columnas de R, S, T.
        const maximumPhaseCurrent = Math.max(sumPhaseCurrentR, sumPhaseCurrentS, sumPhaseCurrentT);
        
        // Si este tablero es un TD (o Sub-TD de otro piso) alimentado por un
        // padre, tomamos las características del cable físico de ESE
        // alimentador específico — lectura de la fotografía de solo lectura
        // (`circuitByRootConductorId`), nunca se elimina de `aliveCircuits`:
        // el mismo conductor lo necesita también la fila del PADRE si el
        // padre solo tiene esta única salida (ver `ownFeeder` más abajo).
        const parentLink = feederLinks.find((link) => link.childPanelId === panel.id);
        const parentFeeder: PartialPanelCircuit | undefined = parentLink
            ? circuitByRootConductorId.get(parentLink.rootConductorId)
            : undefined;

        // Un tablero (TG, o un TD que a su vez alimenta un Sub-TD de otro
        // piso) puede tener VARIAS salidas propias hacia distintos tableros
        // hijos — cada una es un cable físico distinto, con su propia
        // longitud/sección/ΔV, y no hay una única respuesta correcta para
        // "la" fila resumen de ese tablero en ese caso (queda fuera de
        // alcance de este fix, documentado, no adivinado). Cuando el
        // tablero tiene EXACTAMENTE una salida propia, sí hay una respuesta
        // correcta: mostrar los datos reales de esa única salida en su
        // propia fila resumen, en vez de caer a `panel.properties` vacío.
        const ownFeederLinks = feederLinks.filter((link) => link.parentPanelId === panel.id);
        const ownFeeder: PartialPanelCircuit | undefined =
            ownFeederLinks.length === 1 ? circuitByRootConductorId.get(ownFeederLinks[0]!.rootConductorId) : undefined;

        // Fuente de datos de cable real para esta fila: primero mi propio
        // alimentador entrante (si soy un TD/Sub-TD), si no el mío propio
        // saliente cuando soy el único (ver `ownFeeder` arriba) — nunca los
        // dos a la vez (un tablero no puede ser hijo Y padre de la MISMA
        // fila resumen).
        const cableSource = parentFeeder ?? ownFeeder;

        const sectionMm2 = cableSource?.sectionMm2 ?? Math.max(0, panel.properties?.sectionMm2 ?? 0);
        const lengthM = cableSource?.lengthM ?? Math.max(0, panel.properties?.lengthM ?? 0);
        const ambientTemperatureC = cableSource?.ambientTemperatureC ?? panel.properties?.ambientTemperatureC ?? 20;
        const workingTemperatureC = panel.properties?.workingTemperatureC ?? 40;
        const copperResistivity = cableSource?.copperResistivity ?? Math.max(0, panel.properties?.copperResistivity ?? excelCopperResistivity(workingTemperatureC));
        const conductorType = cableSource?.conductorType ?? panel.properties?.wireType ?? 'THW';
        const nominalCableCurrentA = cableSource?.nominalCableCurrentA
            ?? defaultNominalCableCurrent(sectionMm2, conductorType);
        const groupedCircuitCount = cableSource?.groupedCircuitCount ?? panel.properties?.groupedCircuitCount ?? 1;
        const groupingFactor = cableSource?.groupingFactor ?? panel.properties?.groupingFactor ?? excelGroupingFactor(groupedCircuitCount);
        const temperatureFactor = cableSource?.temperatureFactor ?? panel.properties?.temperatureFactor ?? excelTemperatureFactor(ambientTemperatureC);
        const admissibleCableCurrentA = cableSource?.admissibleCableCurrentA
            ?? nominalCableCurrentA * groupingFactor * temperatureFactor;

        const circuitOwnDropV = sectionMm2 > 0
            ? (phases === 1 ? 2 : Math.sqrt(3)) * maximumPhaseCurrent * copperResistivity * lengthM * powerFactor / sectionMm2
            : 0;

        panelSummaryCircuits.push({
            ...(cableSource ?? {
                levelId: scene.id,
                levelName: scene.name,
                levelIndex: scene.floorIndex ?? 0,
                rootConductorId: `synthetic-feeder-${panel.id}`,
                conductorCount: 0,
                horizontalLengthM: panel.properties?.horizontalLengthM ?? lengthM,
                verticalLengthM: panel.properties?.verticalLengthM ?? 0,
                lengthOverridden: !cableSource,
                lightingOutletCount: 0,
                outletOutletCount: 0,
                lightingPowerW: 0,
                outletPowerW: 0,
                forcePowerW: sumInstalledPowerW,
                circuitLoadType: 'feeder',
                normativeViolation: false,
                rooms: [],
                traversedRoomNames: [],
                fedPanelLabels: [panel.label || (isMainPanel ? 'TG' : 'TD')],
                voltageV,
                circuitVoltageV,
                nominalCableCurrentA,
                ambientTemperatureC,
                groupedCircuitCount,
                groupingFactor,
                temperatureFactor,
                admissibleCableCurrentA,
                itm: panel.properties?.itm ?? '1x20',
                dif: panel.properties?.dif ?? '2x25',
                conductorType,
                tubeDiameterMm: panel.properties?.tubeDiameterMm || 20,
                earthSectionMm2: panel.properties?.earthSectionMm2 || sectionMm2,
                maxVoltageDropPct: 4,
            }),
            panelId: panel.id,
            panelLabel: panel.label || (isMainPanel ? 'TG' : 'TD'),
            panelType: panel.type as 'main_panel' | 'sub_panel',
            panelLengthM: lengthM,
            connectionType: panel.properties?.connectionType ?? 'star',
            designFactor,
            copperResistivity,
            code: `${panel.label || (isMainPanel ? 'TG' : 'TD')}`,
            lengthM,
            sectionMm2,
            
            // Los campos sumados:
            installedPowerW: sumInstalledPowerW,
            installedPowerKw: sumInstalledPowerW / 1000,
            demandFactor: Math.max(0, panel.properties?.defaultDemandFactor ?? 1),
            maximumDemandKw: sumMaximumDemandKw,
            powerFactor,
            phases,
            // Excel N(TD/TG) = MAX(P:R) / factor de diseño.
            currentA: calculatePanelTotalCurrentA(
                sumPhaseCurrentR,
                sumPhaseCurrentS,
                sumPhaseCurrentT,
                designFactor,
            ),
            theoreticalDesignCurrentA,
            phaseBalance: phases === 3 ? 'RST' : (panel.properties?.phaseBalance ?? 'R'),
            phaseCurrentR: sumPhaseCurrentR,
            phaseCurrentS: sumPhaseCurrentS,
            phaseCurrentT: sumPhaseCurrentT,
            
            capacityConforms: admissibleCableCurrentA > maximumPhaseCurrent,
            // Excel AF: circuito final <4 %, alimentador TD <2.5 %, TG <1 %.
            maxVoltageDropPct: isMainPanel ? 1 : 2.5,
            circuitOwnDropV,
            isPanelSummary: true,
        });
    });

    // Todo conductor que sea el alimentador de ALGÚN tablero (`feederLinks`,
    // sin importar si terminó usado como `parentFeeder` o `ownFeeder` más
    // arriba) ya quedó representado en la fila resumen del tablero que
    // alimenta — se descarta aquí de la lista de circuitos genéricos para no
    // duplicarlo como una fila más. A diferencia del `.splice()` que había
    // antes (eliminaba UNO a la vez, mientras el bucle de arriba todavía
    // podía necesitar leer ese mismo conductor para OTRO tablero), este
    // filtro corre una sola vez, DESPUÉS de que todas las filas resumen ya
    // leyeron lo que necesitaban de `circuitByRootConductorId` — ningún
    // tablero se queda sin poder leer el conductor que lo alimenta.
    const claimedConductorRootIds = new Set(feederLinks.map((link) => link.rootConductorId));
    const genericCircuits = aliveCircuits.filter((circuit) => !claimedConductorRootIds.has(circuit.rootConductorId));

    // Los alimentadores entre tableros no consumen la numeración visible de
    // circuitos finales. Cada TD comienza siempre en C-1.
    const visibleCircuitNumberByPanel = new Map<string, number>();
    genericCircuits.forEach((circuit) => {
        const next = (visibleCircuitNumberByPanel.get(circuit.panelId) ?? 0) + 1;
        visibleCircuitNumberByPanel.set(circuit.panelId, next);
        circuit.code = `C-${next}`;
    });

    // `panelSummaryCircuits` se llenó para TODOS los tableros (hace falta
    // completo para que un TG pueda sumar el `installedPowerW` de CADA uno
    // de sus TD, tenga hijos propios o no — ver `tdSummaries` arriba). Para
    // el resultado visible, una fila resumen solo aporta algo real cuando
    // el tablero ALIMENTA a otro tablero (agrega lo que baja por sus
    // hijos); un tablero hoja (fed por su padre, pero sin hijos-tablero
    // propios) ya tiene su(s) propio(s) circuito(s) real(es) con los
    // mismos datos (`rooms`, `installedPowerW`) y hereda el ΔV del padre
    // directamente — mostrar TAMBIÉN una fila sintética ahí duplicaba el
    // tablero sin agregar información nueva.
    const visibleSummaryCircuits = panelSummaryCircuits.filter((summary) => {
        if (feederLinks.some((link) => link.parentPanelId === summary.panelId)) return true;
        // TG (main_panel) se muestra siempre, aunque en ESTA escena no
        // tenga hijos-tablero: `calculateProjectPanelCircuitSummaries`
        // (Pasada de vínculo lógico entre pisos, `properties.upstreamPanelId`)
        // necesita encontrar su fila resumen para sumarle los TD de OTRA
        // escena — un TG real casi siempre alimenta algo, aunque ese algo
        // esté en otro piso sin conductor 2D que los una en el mismo plano.
        if (summary.panelType === 'main_panel') return true;
        // Un TD (sub_panel) declarado como alimentado por un TG de otra
        // escena (`upstreamPanelId`) también necesita su fila resumen
        // disponible para que esa misma Pasada lo encuentre — aunque en SU
        // propia escena no tenga hijos ni padre conductor.
        const ownPanel = panels.find((candidate) => candidate.id === summary.panelId);
        return Boolean(ownPanel?.properties?.upstreamPanelId);
    });
    const aliveCircuitsFinal = [...visibleSummaryCircuits, ...genericCircuits];

    // parentOf, topologicalOrder ya calculados! Borramos eso de abajo.


    const resolvedDropByPanelId = new Map<string, number>();
    const circuitsByPanelId = new Map<string, PartialPanelCircuit[]>();
    aliveCircuitsFinal.forEach((circuit) => {
        circuitsByPanelId.set(circuit.panelId, [...(circuitsByPanelId.get(circuit.panelId) ?? []), circuit]);
    });

    return topologicalOrder.flatMap((panelId) => {
        const panel = panels.find((item) => item.id === panelId);
        const parent = parentOf.get(panelId);
        const panelUpstreamDropV = parent
            ? (resolvedDropByPanelId.get(parent.parentPanelId) ?? 0)
            : Math.max(
                  0,
                  panel?.properties?.upstreamVoltageDropV ??
                      (panel?.type === 'sub_panel' ? 6.22 : 0),
              );

        const panelCircuits = circuitsByPanelId.get(panelId) ?? [];
        const summaryCircuit = panelCircuits.find((circuit) => circuit.isPanelSummary);
        const panelTotalDropV = summaryCircuit
            ? summaryCircuit.circuitOwnDropV + panelUpstreamDropV
            : panelUpstreamDropV;
        resolvedDropByPanelId.set(panelId, panelTotalDropV);

        return panelCircuits.map((circuit) => {
            // Excel: AD(TG) no suma aguas arriba; AD(TD) suma E(TD)=AD(TG);
            // cada circuito C suma AD(TD). Se conserva esa cadena literal.
            const baselineV = circuit.isPanelSummary
                ? panelUpstreamDropV
                : panelTotalDropV;
            const voltageDropV = circuit.circuitOwnDropV + baselineV;
            const voltageDropPct =
                (voltageDropV / (circuit.phases === 1 ? 220 : circuit.voltageV)) * 100;

            const { circuitOwnDropV: _circuitOwnDropV, ...rest } = circuit;
            return {
                ...rest,
                upstreamVoltageDropV: baselineV,
                voltageDropV,
                voltageDropPct,
                voltageDropOk: voltageDropPct < circuit.maxVoltageDropPct,
            };
        });
    });
}

/**
 * Calcula CT para todas las plantas y aplica enlaces lógicos entre un TD y un
 * TG de otra escena mediante `properties.upstreamPanelId`.
 */
export function calculateProjectPanelCircuitSummaries(scenes: Scene[]): PanelCircuitSummary[] {
    const summaries = scenes.flatMap((scene) => calculatePanelCircuitSummaries(scene));
    const devices = scenes.flatMap((scene) => scene.electricalDevices ?? []);
    const linkedTdIdsByTg = new Map<string, string[]>();

    devices.forEach((device) => {
        if (device.type !== 'sub_panel' || !device.properties?.upstreamPanelId) return;
        const ids = linkedTdIdsByTg.get(device.properties.upstreamPanelId) ?? [];
        linkedTdIdsByTg.set(device.properties.upstreamPanelId, [...ids, device.id]);
    });

    if (linkedTdIdsByTg.size === 0) return summaries;

    const result = summaries.map((summary) => ({ ...summary }));
    const summaryByPanelId = new Map(
        result.filter((item) => item.isPanelSummary).map((item) => [item.panelId, item]),
    );

    linkedTdIdsByTg.forEach((tdIds, tgId) => {
        const tg = summaryByPanelId.get(tgId);
        const linkedTds = tdIds
            .map((tdId) => summaryByPanelId.get(tdId))
            .filter((item): item is PanelCircuitSummary => item !== undefined);
        if (!tg || linkedTds.length === 0) return;

        tg.installedPowerW = linkedTds.reduce((sum, td) => sum + td.installedPowerW, 0);
        tg.installedPowerKw = tg.installedPowerW / 1000;
        tg.lightingPowerW = linkedTds.reduce((sum, td) => sum + td.lightingPowerW, 0);
        tg.outletPowerW = linkedTds.reduce((sum, td) => sum + td.outletPowerW, 0);
        tg.forcePowerW = linkedTds.reduce((sum, td) => sum + td.forcePowerW, 0);
        tg.maximumDemandKw = linkedTds.reduce((sum, td) => sum + td.maximumDemandKw, 0) * tg.demandFactor;
        tg.phaseCurrentR = linkedTds.reduce((sum, td) => sum + td.phaseCurrentR, 0) * tg.demandFactor;
        tg.phaseCurrentS = linkedTds.reduce((sum, td) => sum + td.phaseCurrentS, 0) * tg.demandFactor;
        tg.phaseCurrentT = linkedTds.reduce((sum, td) => sum + td.phaseCurrentT, 0) * tg.demandFactor;
        tg.currentA = calculatePanelTotalCurrentA(tg.phaseCurrentR, tg.phaseCurrentS, tg.phaseCurrentT, tg.designFactor);
        tg.theoreticalDesignCurrentA = circuitCurrent(
            tg.maximumDemandKw * 1000,
            tg.circuitVoltageV,
            tg.phases,
            tg.powerFactor,
        ) * tg.designFactor;
        const tgOwnDropV = tg.sectionMm2 > 0
            ? (tg.phases === 1 ? 2 : Math.sqrt(3)) * Math.max(tg.phaseCurrentR, tg.phaseCurrentS, tg.phaseCurrentT) * tg.copperResistivity * tg.lengthM * tg.powerFactor / tg.sectionMm2
            : 0;
        tg.upstreamVoltageDropV = 0;
        tg.voltageDropV = tgOwnDropV;
        tg.voltageDropPct = tgOwnDropV / tg.circuitVoltageV * 100;
        tg.voltageDropOk = tg.voltageDropPct < tg.maxVoltageDropPct;

        linkedTds.forEach((td) => {
            const oldTdTotalDropV = td.voltageDropV;
            const tdOwnDropV = Math.max(0, td.voltageDropV - td.upstreamVoltageDropV);
            td.upstreamVoltageDropV = tg.voltageDropV;
            td.voltageDropV = tdOwnDropV + tg.voltageDropV;
            td.voltageDropPct = td.voltageDropV / td.circuitVoltageV * 100;
            td.voltageDropOk = td.voltageDropPct < td.maxVoltageDropPct;

            result.forEach((circuit) => {
                if (circuit.panelId !== td.panelId || circuit.isPanelSummary) return;
                const ownDropV = Math.max(0, circuit.voltageDropV - oldTdTotalDropV);
                circuit.upstreamVoltageDropV = td.voltageDropV;
                circuit.voltageDropV = ownDropV + td.voltageDropV;
                circuit.voltageDropPct = circuit.voltageDropV / circuit.circuitVoltageV * 100;
                circuit.voltageDropOk = circuit.voltageDropPct < circuit.maxVoltageDropPct;
            });
        });
    });

    return result.sort((a, b) => a.levelIndex - b.levelIndex);
}

/**
 * Busca, entre los calibres estándar (`CONDUCTOR_SECTION_OPTIONS`), el
 * primero que sea mayor o igual al actual y que haga cumplir a la vez la
 * capacidad admisible y la caída de tensión (misma fórmula que
 * `calculatePanelCircuitSummaries`). Solo aumenta sección, nunca la reduce.
 * Si ningún calibre disponible alcanza a cumplir, devuelve el mayor
 * disponible (mejor esfuerzo).
 */
export function resolveConformingSectionMm2(circuit: PanelCircuitSummary): number {
    const maxPhaseCurrent = Math.max(
        circuit.phaseCurrentR,
        circuit.phaseCurrentS,
        circuit.phaseCurrentT,
    );
    const candidates = CONDUCTOR_SECTION_OPTIONS
        .map((option) => option.value as number)
        .filter((section) => section >= circuit.sectionMm2)
        .sort((a, b) => a - b);

    for (const section of candidates) {
        const nominalCableCurrentA = defaultNominalCableCurrent(section, circuit.conductorType);
        const admissibleCableCurrentA =
            nominalCableCurrentA * circuit.groupingFactor * circuit.temperatureFactor;
        // Mismo fix que `circuitOwnDropV` arriba: `maxPhaseCurrent` ya es
        // corriente real (`circuitCurrent()` ya dividió entre `powerFactor`),
        // así que no se vuelve a multiplicar por `circuit.powerFactor` aquí
        // — ver el comentario extenso en `circuitOwnDropV` para el porqué.
        const circuitVoltageDropV =
            ((circuit.phases === 1 ? 2 : Math.sqrt(3)) *
                maxPhaseCurrent *
                circuit.copperResistivity *
                circuit.lengthM *
                circuit.powerFactor) /
            section;
        const voltageDropV = circuitVoltageDropV + circuit.upstreamVoltageDropV;
        const voltageDropPct =
            (voltageDropV / circuit.circuitVoltageV) * 100;

        if (admissibleCableCurrentA > maxPhaseCurrent && voltageDropPct < circuit.maxVoltageDropPct) {
            return section;
        }
    }

    return candidates.at(-1) ?? circuit.sectionMm2;
}

/**
 * Recorre TODO el árbol de tableros de una escena (piso) y sube la sección
 * de cada ALIMENTADOR no conforme (caída de tensión o capacidad) — nunca
 * una salida final (circuito C de alumbrado/tomacorriente) — en orden
 * hijo→padre, hasta que todo cumpla o ya no haya calibre disponible que
 * ayude. Como `calculatePanelCircuitSummaries` encadena la caída de tensión
 * (padre→hijo — ver "Pasada 2"), aumentar la sección de un alimentador
 * (p.ej. TG→TD) puede hacer que sus hijos pasen a cumplir sin tocarlos: por
 * eso este ajuste se hace en un solo bucle sobre TODA la escena, no
 * tablero por tablero.
 *
 * Regla real del CNE-Utilización (pedido explícito del usuario, no una
 * elección de diseño de este archivo): el calibre de una salida final de
 * alumbrado es 2.5 mm² y el de tomacorriente 4 mm² — son valores FIJOS por
 * norma, no una variable de ajuste. Si un circuito C no cumple caída de
 * tensión, la corrección real de obra es acortar el recorrido o SUBIR EL
 * ALIMENTADOR del tablero que lo agrupa (menos ΔV heredado aguas arriba),
 * nunca engordar el conductor del circuito final. Por eso este corrector
 * solo considera `circuitLoadType === 'feeder'` como candidato — un C no
 * conforme nunca se toca directamente, se corrige subiendo el alimentador
 * del TD específico que lo alimenta (el que agrupa ESE C, no cualquier
 * TD del árbol — `calculatePanelCircuitSummaries` ya construye una fila de
 * alimentador por cada tablero que agrega hijos reales, así que "el
 * alimentador que sube" siempre es el del padre directo de la salida que
 * falla). Si subir el alimentador del TD no alcanza (calibre agotado) o el
 * TD no tiene fila de alimentador propia (no agrupa otros tableros), la
 * búsqueda hijo→padre naturalmente prueba el siguiente alimentador aguas
 * arriba (TG), replicando "si no cumple TD, corregimos TG".
 *
 * No toca salidas con `normativeViolation` (mezcla alumbrado/tomacorriente
 * en el mismo circuito) — eso no se arregla cambiando la sección, hay que
 * separar el cableado en el plano.
 */
export function resolveTreeConformingSections(
    scene: Scene,
): Array<{ conductorId: string; sectionMm2: number }> {
    const originalConductors = scene.conductors ?? [];
    // conductorId -> sección ya subida en esta corrida (solo se guardan los
    // que realmente cambiaron, para devolver un parche mínimo al llamador).
    const workingSections = new Map<string, number>();
    // Salidas para las que ya no hay calibre disponible que las haga
    // cumplir del todo: se dejan de reintentar para no colgar el bucle,
    // pero no detienen la corrección del resto del árbol.
    const exhausted = new Set<string>();
    const MAX_ITERATIONS = 200;

    const buildWorkingScene = (): Scene => ({
        ...scene,
        conductors: originalConductors.map((conductor) =>
            workingSections.has(conductor.id)
                ? {
                      ...conductor,
                      sectionMm2: workingSections.get(conductor.id)!,
                      ct: { ...(conductor.ct ?? {}), nominalCableCurrentA: undefined },
                  }
                : conductor,
        ),
    });

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
        const circuits = calculatePanelCircuitSummaries(buildWorkingScene());
        // Orden hijo→padre (`circuits` viene padre→hijo, ver
        // `topologicalOrder.flatMap` en `calculatePanelCircuitSummaries`):
        // busca el alimentador no conforme más CERCANO a la salida que
        // falla antes de escalar a uno más arriba en el árbol.
        const violator = [...circuits].reverse().find(
            (circuit) =>
                circuit.circuitLoadType === 'feeder' &&
                !circuit.normativeViolation &&
                !exhausted.has(circuit.rootConductorId) &&
                (!circuit.voltageDropOk || !circuit.capacityConforms),
        );
        if (!violator) break;

        const nextSection = resolveConformingSectionMm2(violator);
        if (nextSection <= violator.sectionMm2) {
            exhausted.add(violator.rootConductorId);
            continue;
        }
        workingSections.set(violator.rootConductorId, nextSection);
    }

    return [...workingSections.entries()].map(([conductorId, sectionMm2]) => ({
        conductorId,
        sectionMm2,
    }));
}

/** Corrección en cascada sobre el árbol lógico completo, incluidos otros pisos. */
export function resolveProjectTreeConformingSections(
    scenes: Scene[],
): Array<{ levelId: string; conductorId: string; panelId: string; isPanelSummary: boolean; sectionMm2: number }> {
    const workingScenes = scenes.map((scene) => ({
        ...scene,
        conductors: [...(scene.conductors ?? [])],
        electricalDevices: [...(scene.electricalDevices ?? [])],
    }));
    const fixes = new Map<string, { levelId: string; conductorId: string; panelId: string; isPanelSummary: boolean; sectionMm2: number }>();
    const exhausted = new Set<string>();

    for (let iteration = 0; iteration < 200; iteration += 1) {
        const circuits = calculateProjectPanelCircuitSummaries(workingScenes);
        // Mismo criterio que `resolveTreeConformingSections`: solo
        // alimentadores (nunca una salida final C, calibre fijo por CNE), y
        // el más cercano a la salida que falla antes de escalar aguas
        // arriba (`.reverse()`, mismo orden hijo→padre).
        const violator = [...circuits].reverse().find((circuit) =>
            circuit.circuitLoadType === 'feeder' &&
            !circuit.normativeViolation &&
            !exhausted.has(circuit.rootConductorId) &&
            (!circuit.voltageDropOk || !circuit.capacityConforms),
        );
        if (!violator) break;
        const nextSection = resolveConformingSectionMm2(violator);
        if (nextSection <= violator.sectionMm2) {
            exhausted.add(violator.rootConductorId);
            continue;
        }

        const scene = workingScenes.find((item) => item.id === violator.levelId);
        if (!scene) continue;
        const conductorIndex = (scene.conductors ?? []).findIndex((item) => item.id === violator.rootConductorId);
        if (conductorIndex >= 0) {
            const conductor = scene.conductors![conductorIndex]!;
            scene.conductors![conductorIndex] = {
                ...conductor,
                sectionMm2: nextSection,
                ct: { ...(conductor.ct ?? {}), nominalCableCurrentA: undefined },
            };
        } else if (violator.isPanelSummary) {
            scene.electricalDevices = (scene.electricalDevices ?? []).map((device) =>
                device.id === violator.panelId
                    ? { ...device, properties: { ...(device.properties ?? {}), sectionMm2: nextSection } }
                    : device,
            );
        } else {
            exhausted.add(violator.rootConductorId);
            continue;
        }
        fixes.set(violator.rootConductorId, {
            levelId: violator.levelId,
            conductorId: violator.rootConductorId,
            panelId: violator.panelId,
            isPanelSummary: Boolean(violator.isPanelSummary),
            sectionMm2: nextSection,
        });
    }

    return [...fixes.values()];
}

export interface RoomOutletValidation {
    roomId: string;
    roomName: string;
    area: number;
    perimeter: number;
    outletUse: 'aula' | 'comedor' | 'exterior' | 'none';
    requiredOutlets: number;
    installedOutlets: number;
}

export function validateSceneOutlets(scene: Scene): RoomOutletValidation[] {
    const derivedAmbients = deriveSceneAmbientSpaces(scene);
    
    return derivedAmbients.map(ambient => {
        const outletUse = ambient.room.outletUse ?? 'none';
        
        // El calculationRoom es el propio ambient.room
        const calculationRoom = ambient.room;
        const area = calculatePolygonArea(calculationRoom.vertices);
        const perimeter = calculatePolygonPerimeter(calculationRoom.vertices);
        
        let requiredOutlets = 0;
        if (outletUse === 'aula') requiredOutlets = Math.ceil(area / 10);
        else if (outletUse === 'comedor') requiredOutlets = Math.ceil(area / 15);
        else if (outletUse === 'exterior') requiredOutlets = Math.ceil(perimeter / 9);
        
        // `ambient.room.id` es el id SINTÉTICO del ambiente derivado
        // (`${room.id}::ambient-N`) — nunca coincide con `device.roomId`
        // (siempre el id FÍSICO plano del recinto, `ambient.roomId`). Con
        // esa comparación, `installedOutlets` daba 0 siempre, sin importar
        // cuántos tomacorrientes hubiera realmente colocados. Además de
        // corregir el id, se filtra también por `ambient.wallId` (contra
        // `device.ambientId`) para no contar tomacorrientes de OTRO
        // sub-ambiente que comparte el mismo recinto físico (ej. "Baño" vs
        // "Guarderías" delimitados por paredes internas distintas).
        const installedOutlets = (scene.electricalDevices ?? []).filter(
            device => device.type.startsWith('outlet_')
                && device.roomId === ambient.roomId
                && device.ambientId === ambient.wallId
        ).length;

        return {
            roomId: ambient.room.id,
            roomName: ambient.name,
            area,
            perimeter,
            outletUse,
            requiredOutlets,
            installedOutlets,
        };
    }).filter(v => v.outletUse !== 'none');
}
