import { pointInPolygon } from './ambientSpaces';
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
