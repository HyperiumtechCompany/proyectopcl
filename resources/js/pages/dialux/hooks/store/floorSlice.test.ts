import { describe, expect, it } from 'vitest';
import { useEditorStore, createScaleConfig } from '../useEditorStore';
import type {
    Conductor,
    ElectricalDevice,
    Fixture,
    JunctionBox,
    LightSwitch,
    Project,
    Room,
    Scene,
    Wall,
} from '../types';

/**
 * Cobertura de duplicateFloor: al clonar un piso, TODAS las entidades deben
 * recibir un ID nuevo y TODAS sus referencias cruzadas (roomId simple o
 * compuesto por ambiente, wallId, sourceId/targetId, connected*Ids) deben
 * apuntar dentro del piso nuevo, nunca al piso original.
 *
 * Regresión de un bug real: antes de este fix, `roomId` compuesto
 * (`${room.id}::ambient-N`, ver hooks/ambientSpaces.ts) no se remapeaba, y
 * lightSwitches/electricalDevices/conductors/junctionBoxes no se clonaban en
 * absoluto (llegaban al piso nuevo con el mismo ID y las mismas referencias
 * del piso original vía el spread `...source`).
 */
function buildSourceScene(): Scene {
    const room: Room = {
        id: 'room-aula-a',
        name: 'Aula A',
        vertices: [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 5, y: 4 },
            { x: 0, y: 4 },
        ],
        height: 3.2,
        color: 'rgba(56,189,248,0.25)',
    };

    const wall: Wall = {
        id: 'wall-1',
        vertices: [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
        ],
        height: 3.2,
        thickness: 0.15,
    };

    // Convención real de hooks/ambientSpaces.ts para un ambiente dentro de un recinto.
    const ambientRoomId = `${room.id}::ambient-1`;

    const fixture: Fixture = {
        id: 'fixture-1',
        name: 'Panel LED',
        x: 2.5, y: 2, z: 3.1,
        lumens: 4000,
        efficiency: 0.8,
        fixtureType: 'panel',
        lightColor: '#fff5e1',
        roomId: ambientRoomId,
        wallId: wall.id,
    };

    const lightSwitch: LightSwitch = {
        id: 'switch-1',
        x: 0.2, y: 0.2,
        mountingHeight: 1.4,
        type: 'single',
        wallId: wall.id,
        connectedFixtureIds: [fixture.id],
    };

    const outlet: ElectricalDevice = {
        id: 'outlet-1',
        type: 'outlet_initial',
        x: 1, y: 1,
        label: 'T1',
        mountingHeight: 0.4,
        wallId: wall.id,
        roomId: ambientRoomId,
        connectedDeviceIds: [],
        connectedFixtureIds: [fixture.id],
        connectedSwitchIds: [lightSwitch.id],
        properties: {},
    };

    const conductor: Conductor = {
        id: 'conductor-1',
        sourceId: lightSwitch.id,
        targetId: fixture.id,
        waypoints: [],
        wireCount: 2,
        routeType: 'wall_ceiling',
        tubeSize: 20,
        conductorType: 'LSOH-80',
        sectionMm2: 2.5,
    };

    const junctionBox: JunctionBox = {
        id: 'jbox-1',
        x: 3, y: 3,
        size: '100x100x50',
    };

    return {
        id: 'scene-piso-1',
        name: '1er Piso',
        floorIndex: 0,
        floorElevation: 0,
        floorHeight: 3.2,
        scaleConfig: createScaleConfig('m', 1, 'Metros (1 = 1m)'),
        rooms: [room],
        walls: [wall],
        windows: [],
        doors: [],
        canopies: [],
        fixtures: [fixture],
        lightSwitches: [lightSwitch],
        electricalDevices: [outlet],
        conductors: [conductor],
        junctionBoxes: [junctionBox],
        partitions: [],
    };
}

function setProjectWithScene(scene: Scene): void {
    const project: Project = {
        id: 'project-test',
        name: 'Proyecto de prueba',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        scenes: [scene],
    };
    useEditorStore.setState({ project, activeSceneId: scene.id });
}

describe('floorSlice.duplicateFloor', () => {
    it('remapea el roomId compuesto de ambiente al recinto del piso nuevo', () => {
        const source = buildSourceScene();
        setProjectWithScene(source);

        const newSceneId = useEditorStore.getState().duplicateFloor(source.id, 1, '1er Piso (copia)');
        const newScene = useEditorStore.getState().project!.scenes.find((s) => s.id === newSceneId)!;

        const newRoomId = newScene.rooms[0]!.id;
        expect(newRoomId).not.toBe(source.rooms[0]!.id);

        const duplicatedFixture = newScene.fixtures[0]!;
        expect(duplicatedFixture.roomId).toBe(`${newRoomId}::ambient-1`);
        expect(duplicatedFixture.roomId).not.toBe(source.fixtures[0]!.roomId);
    });

    it('clona lightSwitches, electricalDevices, conductors y junctionBoxes con IDs propios (no comparten ID con el piso original)', () => {
        const source = buildSourceScene();
        setProjectWithScene(source);

        const newSceneId = useEditorStore.getState().duplicateFloor(source.id, 1, '1er Piso (copia)');
        const newScene = useEditorStore.getState().project!.scenes.find((s) => s.id === newSceneId)!;

        expect(newScene.lightSwitches).toHaveLength(1);
        expect(newScene.electricalDevices).toHaveLength(1);
        expect(newScene.conductors).toHaveLength(1);
        expect(newScene.junctionBoxes).toHaveLength(1);

        expect(newScene.lightSwitches![0]!.id).not.toBe(source.lightSwitches![0]!.id);
        expect(newScene.electricalDevices![0]!.id).not.toBe(source.electricalDevices![0]!.id);
        expect(newScene.conductors![0]!.id).not.toBe(source.conductors![0]!.id);
        expect(newScene.junctionBoxes![0]!.id).not.toBe(source.junctionBoxes![0]!.id);
    });

    it('remapea todas las referencias cruzadas al piso nuevo: wallId, roomId, sourceId/targetId y connected*Ids', () => {
        const source = buildSourceScene();
        setProjectWithScene(source);

        const newSceneId = useEditorStore.getState().duplicateFloor(source.id, 1, '1er Piso (copia)');
        const newScene = useEditorStore.getState().project!.scenes.find((s) => s.id === newSceneId)!;

        const newWallId = newScene.walls[0]!.id;
        const newFixtureId = newScene.fixtures[0]!.id;
        const newSwitchId = newScene.lightSwitches![0]!.id;
        const newRoomId = newScene.rooms[0]!.id;

        const newSwitch = newScene.lightSwitches![0]!;
        expect(newSwitch.wallId).toBe(newWallId);
        expect(newSwitch.connectedFixtureIds).toEqual([newFixtureId]);

        const newOutlet = newScene.electricalDevices![0]!;
        expect(newOutlet.wallId).toBe(newWallId);
        expect(newOutlet.roomId).toBe(`${newRoomId}::ambient-1`);
        expect(newOutlet.connectedFixtureIds).toEqual([newFixtureId]);
        expect(newOutlet.connectedSwitchIds).toEqual([newSwitchId]);

        const newConductor = newScene.conductors![0]!;
        expect(newConductor.sourceId).toBe(newSwitchId);
        expect(newConductor.targetId).toBe(newFixtureId);
    });

    it('ningún ID del piso original reaparece en el piso duplicado (sin colisiones entre pisos)', () => {
        const source = buildSourceScene();
        setProjectWithScene(source);

        const newSceneId = useEditorStore.getState().duplicateFloor(source.id, 1, '1er Piso (copia)');
        const newScene = useEditorStore.getState().project!.scenes.find((s) => s.id === newSceneId)!;

        const originalIds = new Set([
            ...source.rooms.map((r) => r.id),
            ...source.walls.map((w) => w.id),
            ...source.fixtures.map((f) => f.id),
            ...(source.lightSwitches ?? []).map((s) => s.id),
            ...(source.electricalDevices ?? []).map((d) => d.id),
            ...(source.conductors ?? []).map((c) => c.id),
            ...(source.junctionBoxes ?? []).map((j) => j.id),
        ]);

        const newIds = [
            ...newScene.rooms.map((r) => r.id),
            ...newScene.walls.map((w) => w.id),
            ...newScene.fixtures.map((f) => f.id),
            ...(newScene.lightSwitches ?? []).map((s) => s.id),
            ...(newScene.electricalDevices ?? []).map((d) => d.id),
            ...(newScene.conductors ?? []).map((c) => c.id),
            ...(newScene.junctionBoxes ?? []).map((j) => j.id),
        ];

        for (const id of newIds) {
            expect(originalIds.has(id)).toBe(false);
        }
    });
});
