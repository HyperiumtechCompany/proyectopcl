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
});
