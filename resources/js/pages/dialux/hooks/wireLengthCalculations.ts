import { circuitCurrent, voltageDropPct } from '../electrical/engine/formulas';
import { deriveSceneAmbientSpaces, findAmbientSpaceAtPoint, pointInPolygon } from './ambientSpaces';
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
    return Math.hypot(b.x - a.x, b.y - a.y);
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

function conductorTotalLength(
    scene: Scene,
    conductor: Conductor,
    source: WireNode,
    target: WireNode,
): number {
    const planLength = conductorPlanLength(conductor, source, target);
    if (conductor.routeType !== 'wall_ceiling') return planLength;

    const switches = [source, target].filter(
        (node): node is LightSwitch & { nodeType: 'switch' } => node.nodeType === 'switch',
    );
    return planLength + switches.reduce(
        (total, lightSwitch) => total + switchVerticalDrop(scene, lightSwitch),
        0,
    );
}

function roomHeightAt(scene: Scene, point: Vertex): number {
    const room = scene.rooms.find(
        (item) => item.vertices.length >= 3 && pointInPolygon(point, item.vertices),
    );

    return room?.height ?? scene.floorHeight ?? DEFAULT_ROOM_HEIGHT;
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
    installedPowerW: number;
    detail: string;
}

export interface PanelCircuitSummary {
    levelId: string;
    levelName: string;
    levelIndex: number;
    panelId: string;
    panelLabel: string;
    code: string;
    rootConductorId: string;
    conductorCount: number;
    lengthM: number;
    installedPowerW: number;
    rooms: PanelCircuitRoomLoad[];
    traversedRoomNames: string[];
    sectionMm2: number;
    voltageV: number;
    phases: 1 | 3;
    currentA: number;
    voltageDropPct: number;
    maxVoltageDropPct: number;
    voltageDropOk: boolean;
}

const PANEL_TYPES = new Set(['main_panel', 'sub_panel']);
const DEFAULT_VOLTAGE = 220;
const DEFAULT_POWER_FACTOR = 0.9;
const DEFAULT_MAX_VOLTAGE_DROP_PCT = 2.5;

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
    const panels = devices.filter((device) => PANEL_TYPES.has(device.type));
    const panelIds = new Set(panels.map((panel) => panel.id));
    const nodeById = new Map<string, WireNode>();
    const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
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

    return panels.flatMap((panel) => {
        const exits = conductorsByNode.get(panel.id) ?? [];

        return exits.map((root, index) => {
            const visitedConductors = new Set<string>();
            const reachedFixtures = new Set<string>();
            const traversedRoomNames = new Set<string>();
            const queue: Array<{ conductor: Conductor; fromNodeId: string }> = [{ conductor: root, fromNodeId: panel.id }];
            let lengthM = 0;

            while (queue.length > 0) {
                const current = queue.shift()!;
                if (visitedConductors.has(current.conductor.id)) continue;
                visitedConductors.add(current.conductor.id);

                const source = nodeById.get(current.conductor.sourceId);
                const target = nodeById.get(current.conductor.targetId);
                if (!source || !target) continue;
                lengthM += conductorTotalLength(scene, current.conductor, source, target);
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
                if (panelIds.has(nextNodeId)) continue;

                for (const candidate of conductorsByNode.get(nextNodeId) ?? []) {
                    if (visitedConductors.has(candidate.id)) continue;
                    if (candidate.sourceId === nextNodeId || candidate.targetId === nextNodeId) {
                        queue.push({ conductor: candidate, fromNodeId: nextNodeId });
                    }
                }
            }

            const loadsByRoom = new Map<string, Fixture[]>();
            for (const fixtureId of reachedFixtures) {
                const fixture = fixtureById.get(fixtureId);
                if (!fixture) continue;
                const explicitRoom = fixture.roomId ? roomById.get(fixture.roomId) : undefined;
                const derivedAmbient = fixture.roomId
                    ? derivedAmbientById.get(fixture.roomId)
                    : findAmbientSpaceAtPoint(scene, fixture);
                const positionalAmbient = findAmbientSpaceAtPoint(scene, fixture);
                const containingAmbient = derivedAmbient ?? positionalAmbient;
                const containingRoom = explicitRoom
                    ?? containingAmbient?.room
                    ?? scene.rooms.find((room) => pointInPolygon(fixture, room.vertices));
                const roomId = containingAmbient?.room.id
                    ?? containingRoom?.id
                    ?? '__sin_ambiente__';
                loadsByRoom.set(roomId, [...(loadsByRoom.get(roomId) ?? []), fixture]);
            }

            const rooms = [...loadsByRoom.entries()].map(([roomId, roomFixtures]) => {
                const powerGroups = new Map<number, number>();
                roomFixtures.forEach((fixture) => {
                    const power = Math.max(0, fixture.power ?? 0);
                    powerGroups.set(power, (powerGroups.get(power) ?? 0) + 1);
                });
                const installedPowerW = roomFixtures.reduce((sum, fixture) => sum + Math.max(0, fixture.power ?? 0), 0);
                return {
                    roomId,
                    roomName:
                        derivedAmbientById.get(roomId)?.name
                        ?? roomById.get(roomId)?.name
                        ?? 'Sin ambiente asignado',
                    fixtureCount: roomFixtures.length,
                    installedPowerW,
                    detail: [...powerGroups.entries()].map(([power, count]) => `${count}×${power} W`).join(' + '),
                };
            });

            const installedPowerW = rooms.reduce(
                (sum, room) => sum + room.installedPowerW,
                0,
            );
            const voltageV = numericProperty(panel.properties?.voltage, DEFAULT_VOLTAGE);
            const phases = phasesProperty(panel.properties?.phases);
            const sectionMm2 = Math.max(0, root.sectionMm2 ?? 0);
            const currentA = circuitCurrent(
                installedPowerW,
                voltageV,
                phases,
                DEFAULT_POWER_FACTOR,
            );
            const dropPct = voltageDropPct(
                currentA,
                lengthM,
                sectionMm2,
                voltageV,
                phases,
                'cobre',
            );

            return {
                levelId: scene.id,
                levelName: scene.name,
                levelIndex: scene.floorIndex ?? 0,
                panelId: panel.id,
                panelLabel: panel.label || (panel.type === 'main_panel' ? 'TG' : 'TD'),
                code: `C-${index + 1}`,
                rootConductorId: root.id,
                conductorCount: visitedConductors.size,
                lengthM,
                installedPowerW,
                rooms,
                traversedRoomNames: [...traversedRoomNames],
                sectionMm2,
                voltageV,
                phases,
                currentA,
                voltageDropPct: dropPct,
                maxVoltageDropPct: DEFAULT_MAX_VOLTAGE_DROP_PCT,
                voltageDropOk: dropPct <= DEFAULT_MAX_VOLTAGE_DROP_PCT,
            };
        });
    });
}
