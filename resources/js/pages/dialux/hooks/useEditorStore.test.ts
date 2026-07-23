import { beforeEach, describe, expect, it } from 'vitest';
import type { Project, Room, Scene } from './types';
import { createScaleConfig, useEditorStore } from './useEditorStore';

const baseRoom = (
    id: string,
    normativeStandard: Room['normativeStandard'],
): Room => ({
    id,
    name: id,
    vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
    ],
    height: 2.7,
    color: 'rgba(56,189,248,0.25)',
    normativeStandard,
    normativeCategory: 'Previous category',
    normativeSection: 'Previous section',
    normativeActivity: 'Previous activity',
    normativeLabel: 'Previous label',
});

describe('useEditorStore electrical legend controls', () => {
    it('opens the legend when an electrical drawing tool is activated', () => {
        const store = useEditorStore.getState();
        store.setSidebarTab('objects');
        store.setTool('wire');

        expect(useEditorStore.getState().ui.sidebarTab).toBe('legend');
    });

    it('toggles a complete group and an individual element independently', () => {
        const store = useEditorStore.getState();
        const wasVisible = store.ui.electricalLayerVisibility.fixtures;
        store.toggleElectricalLayer('fixtures');
        store.toggleElectricalItemVisibility('fixture-1');

        expect(useEditorStore.getState().ui.electricalLayerVisibility.fixtures).toBe(!wasVisible);
        expect(useEditorStore.getState().ui.hiddenElectricalIds).toContain('fixture-1');

        useEditorStore.getState().toggleElectricalItemVisibility('fixture-1');
        expect(useEditorStore.getState().ui.hiddenElectricalIds).not.toContain('fixture-1');
    });
});

const scene = (id: string, rooms: Room[]): Scene => ({
    id,
    name: id,
    scaleConfig: createScaleConfig('m', 1, 'Metros (1 = 1m)'),
    rooms,
    walls: [],
    windows: [],
    doors: [],
    canopies: [],
    fixtures: [],
});

describe('useEditorStore normative defaults', () => {
    beforeEach(() => {
        useEditorStore.setState({
            project: null,
            activeSceneId: null,
            defaultRoomNormativeStandard: 'en_12464',
        });
    });

    it('applies the default normative standard to every scene in the project', () => {
        const project: Project = {
            id: 'project-1',
            name: 'Project',
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
            scenes: [
                scene('scene-1', [baseRoom('room-1', 'en_12464')]),
                scene('scene-2', [baseRoom('room-2', 'ies_na')]),
            ],
        };

        useEditorStore.getState().setProject(project);
        useEditorStore.getState().setActiveScene('scene-1');
        useEditorStore.getState().setDefaultRoomNormativeStandard('rne_peru');
        useEditorStore.getState().applyDefaultNormativeStandardToRooms();

        const rooms = useEditorStore
            .getState()
            .project?.scenes.flatMap((currentScene) => currentScene.rooms);

        expect(rooms?.map((room) => room.normativeStandard)).toEqual([
            'rne_peru',
            'rne_peru',
        ]);
        expect(rooms?.map((room) => room.normativeActivity)).toEqual([
            undefined,
            undefined,
        ]);
    });

    it('applyNormativeProfileToRooms with roomIds only touches the selected ambient, not every ambient in the project', () => {
        // Bug real reportado: configurar la norma de un segundo ambiente
        // sobrescribía en silencio la del primero, porque el panel aplicaba
        // el perfil a TODOS los ambientes en cada clic, sin scoping.
        const ambient1: Room = {
            ...baseRoom('ambient-1', 'en_12464'),
            roomType: 'ambient',
            illuminanceLux: 500,
        };
        const ambient2: Room = {
            ...baseRoom('ambient-2', 'en_12464'),
            roomType: 'ambient',
            illuminanceLux: 500,
        };
        const project: Project = {
            id: 'project-1',
            name: 'Project',
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
            scenes: [scene('scene-1', [ambient1, ambient2])],
        };

        useEditorStore.getState().setProject(project);
        useEditorStore.getState().setActiveScene('scene-1');

        useEditorStore.getState().applyNormativeProfileToRooms({
            standard: 'rne_peru',
            normaLux: 150,
            roomIds: ['ambient-1'],
        });

        const rooms = useEditorStore.getState().project?.scenes[0].rooms ?? [];
        const updated1 = rooms.find((r) => r.id === 'ambient-1');
        const untouched2 = rooms.find((r) => r.id === 'ambient-2');

        expect(updated1?.illuminanceLux).toBe(150);
        expect(updated1?.normativeStandard).toBe('rne_peru');
        expect(useEditorStore.getState().defaultRoomNormativeStandard).toBe(
            'rne_peru',
        );
        expect(
            useEditorStore.getState().project?.defaultRoomNormativeStandard,
        ).toBe('rne_peru');
        // El segundo ambiente conserva su configuración previa intacta.
        expect(untouched2?.illuminanceLux).toBe(500);
        expect(untouched2?.normativeStandard).toBe('en_12464');
    });

    it('applyNormativeProfileToRooms without roomIds still applies to every ambient (comportamiento global explícito)', () => {
        const ambient1: Room = {
            ...baseRoom('ambient-1', 'en_12464'),
            roomType: 'ambient',
            illuminanceLux: 500,
        };
        const ambient2: Room = {
            ...baseRoom('ambient-2', 'en_12464'),
            roomType: 'ambient',
            illuminanceLux: 500,
        };
        const project: Project = {
            id: 'project-1',
            name: 'Project',
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
            scenes: [scene('scene-1', [ambient1, ambient2])],
        };

        useEditorStore.getState().setProject(project);
        useEditorStore.getState().setActiveScene('scene-1');

        useEditorStore.getState().applyNormativeProfileToRooms({
            standard: 'rne_peru',
            normaLux: 300,
        });

        const rooms = useEditorStore.getState().project?.scenes[0].rooms ?? [];
        expect(rooms.every((r) => r.illuminanceLux === 300)).toBe(true);
    });
});
