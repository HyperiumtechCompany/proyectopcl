import { beforeEach, describe, expect, it } from 'vitest';
import { createScaleConfig, useEditorStore } from '../useEditorStore';
import type { Project, Scene } from '../types';

function makeScene(id: string): Scene {
    return {
        id,
        name: id,
        floorIndex: 0,
        floorElevation: 0,
        floorHeight: 3,
        scaleConfig: createScaleConfig('m', 1, 'Metros (1 = 1m)'),
        rooms: [],
        walls: [],
        windows: [],
        doors: [],
        canopies: [],
        fixtures: [],
        lightSwitches: [],
        conductors: [],
        junctionBoxes: [],
        partitions: [],
        visible: true,
    };
}

function makeProject(): Project {
    return {
        id: 'p1',
        name: 'Proyecto',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        scenes: [makeScene('scene-1')],
    };
}

describe('historySlice — undo/redo (Fase 3 del plan)', () => {
    beforeEach(() => {
        useEditorStore.setState({ project: null, activeSceneId: null });
        useEditorStore.getState().resetHistory();
        useEditorStore.getState().setProject(makeProject());
        useEditorStore.getState().setActiveScene('scene-1');
        useEditorStore.getState().resetHistory(); // la carga inicial no debe ser undoable
    });

    it('Prueba A: crear una luminaria, deshacer y rehacer', () => {
        expect(useEditorStore.getState().historyCanUndo).toBe(false);

        const id = useEditorStore.getState().addFixture({
            name: 'L1',
            x: 1,
            y: 1,
            z: 2.4,
            lumens: 4000,
            efficiency: 0.8,
            fixtureType: 'surface',
            fixtureShape: 'round',
            lightColor: '#fff',
        } as any);

        expect(useEditorStore.getState().activeScene()?.fixtures).toHaveLength(1);
        expect(useEditorStore.getState().historyCanUndo).toBe(true);

        useEditorStore.getState().undo();
        expect(useEditorStore.getState().activeScene()?.fixtures).toHaveLength(0);
        expect(useEditorStore.getState().historyCanRedo).toBe(true);

        useEditorStore.getState().redo();
        expect(useEditorStore.getState().activeScene()?.fixtures.map((f) => f.id)).toEqual([id]);
    });

    it('Prueba B: eliminar un interruptor, deshacer, y que vuelva con el mismo id y propiedades', () => {
        const swId = useEditorStore.getState().addLightSwitch({
            x: 2,
            y: 2,
            type: 'single',
            mountingHeight: 1.4,
            label: 'S(a)',
        } as any);

        useEditorStore.getState().requestDelete(swId);
        expect(useEditorStore.getState().activeScene()?.lightSwitches).toHaveLength(0);

        useEditorStore.getState().undo();
        const restored = useEditorStore.getState().activeScene()?.lightSwitches[0];
        expect(restored?.id).toBe(swId);
        expect(restored?.label).toBe('S(a)');
    });

    it('Prueba E: después de deshacer y ejecutar un comando nuevo, la pila de rehacer queda vacía', () => {
        useEditorStore.getState().addFixture({ name: 'A', x: 0, y: 0, z: 2.4, lumens: 1, efficiency: 1, fixtureType: 'surface', fixtureShape: 'round', lightColor: '#fff' } as any);
        useEditorStore.getState().undo();
        expect(useEditorStore.getState().historyCanRedo).toBe(true);

        useEditorStore.getState().addFixture({ name: 'B', x: 1, y: 1, z: 2.4, lumens: 1, efficiency: 1, fixtureType: 'surface', fixtureShape: 'round', lightColor: '#fff' } as any);
        expect(useEditorStore.getState().historyCanRedo).toBe(false);
    });

    it('Prueba F: cien operaciones consecutivas no corrompen el árbol de entidades', () => {
        for (let i = 0; i < 100; i++) {
            useEditorStore.getState().addFixture({
                name: `F${i}`,
                x: i,
                y: i,
                z: 2.4,
                lumens: 1,
                efficiency: 1,
                fixtureType: 'surface',
                fixtureShape: 'round',
                lightColor: '#fff',
            } as any);
        }
        expect(useEditorStore.getState().activeScene()?.fixtures).toHaveLength(100);
        for (let i = 0; i < 100; i++) {
            useEditorStore.getState().undo();
        }
        expect(useEditorStore.getState().activeScene()?.fixtures).toHaveLength(0);
    });

    it('gestos: mover un objeto en varios pasos cuenta como UN solo paso de undo', () => {
        const roomId = useEditorStore.getState().addRoom({
            name: 'R1',
            vertices: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }],
            height: 2.7,
            color: '#fff',
        } as any);
        useEditorStore.getState().resetHistory(); // solo nos interesa el gesto de mover

        useEditorStore.getState().beginHistoryGesture();
        useEditorStore.getState().updateRoom(roomId, {
            vertices: [{ x: 1, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 4 }, { x: 1, y: 4 }],
        } as any);
        useEditorStore.getState().updateRoom(roomId, {
            vertices: [{ x: 2, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 2, y: 4 }],
        } as any);
        useEditorStore.getState().endHistoryGesture();

        const movedRoom = useEditorStore.getState().activeScene()?.rooms.find((r) => r.id === roomId);
        expect(movedRoom?.vertices[0].x).toBe(2);

        useEditorStore.getState().undo();
        const undoneRoom = useEditorStore.getState().activeScene()?.rooms.find((r) => r.id === roomId);
        expect(undoneRoom?.vertices[0].x).toBe(0); // volvió al estado ANTES del gesto completo
        expect(useEditorStore.getState().historyCanUndo).toBe(false); // el gesto era un solo paso
    });

    it('deshacer una eliminación de un ambiente restaura sus hijos (transacción de cascada)', () => {
        const roomId = useEditorStore.getState().addRoom({
            name: 'Ambiente',
            roomType: 'ambient',
            vertices: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }, { x: 0, y: 5 }],
            height: 2.7,
            color: '#fff',
        } as any);
        const fixId = useEditorStore.getState().addFixture({
            name: 'L1', x: 2, y: 2, z: 2.4, lumens: 1, efficiency: 1, fixtureType: 'surface', fixtureShape: 'round', lightColor: '#fff', roomId,
        } as any);

        useEditorStore.getState().requestDelete(roomId);
        // Contenedor con hijos → requiere confirmación, no se borra aún
        expect(useEditorStore.getState().pendingDeletion?.id).toBe(roomId);
        expect(useEditorStore.getState().activeScene()?.rooms).toHaveLength(1);

        useEditorStore.getState().confirmPendingDeletion();
        expect(useEditorStore.getState().activeScene()?.rooms).toHaveLength(0);
        expect(useEditorStore.getState().activeScene()?.fixtures).toHaveLength(0);

        // Deshacer la cascada completa restaura AMBOS en un solo undo
        useEditorStore.getState().undo();
        expect(useEditorStore.getState().activeScene()?.rooms.map((r) => r.id)).toEqual([roomId]);
        expect(useEditorStore.getState().activeScene()?.fixtures.map((f) => f.id)).toEqual([fixId]);
    });

    it('undo no permite retroceder antes del estado inicial sembrado (no hay nada previo)', () => {
        expect(useEditorStore.getState().historyCanUndo).toBe(false);
        useEditorStore.getState().undo(); // no-op
        expect(useEditorStore.getState().project).not.toBeNull();
    });
});
