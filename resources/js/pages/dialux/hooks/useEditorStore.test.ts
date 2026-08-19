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

        expect(
            useEditorStore.getState().ui.electricalLayerVisibility.fixtures,
        ).toBe(!wasVisible);
        expect(useEditorStore.getState().ui.hiddenElectricalIds).toContain(
            'fixture-1',
        );

        useEditorStore.getState().toggleElectricalItemVisibility('fixture-1');
        expect(useEditorStore.getState().ui.hiddenElectricalIds).not.toContain(
            'fixture-1',
        );
    });
});

const scene = (id: string, rooms: Room[]): Scene => ({
    id,
    name: id,
    floorIndex: 0,
    floorElevation: 0,
    floorHeight: 2.7,
    scaleConfig: createScaleConfig('m', 1, 'Metros (1 = 1m)'),
    rooms,
    walls: [],
    windows: [],
    doors: [],
    canopies: [],
    fixtures: [],
    lightSwitches: [],
    partitions: [],
});

describe('useEditorStore normative defaults', () => {
    beforeEach(() => {
        useEditorStore.setState({
            project: null,
            activeSceneId: null,
            defaultRoomNormativeStandard: 'en_12464_1',
        });
    });

    it('applies the default normative standard to every scene in the project', () => {
        const project: Project = {
            id: 'project-1',
            name: 'Project',
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
            scenes: [
                scene('scene-1', [baseRoom('room-1', 'en_12464_1')]),
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
        // sobrescribÃ­a en silencio la del primero, porque el panel aplicaba
        // el perfil a TODOS los ambientes en cada clic, sin scoping.
        const ambient1: Room = {
            ...baseRoom('ambient-1', 'en_12464_1'),
            roomType: 'ambient',
            illuminanceLux: 500,
        };
        const ambient2: Room = {
            ...baseRoom('ambient-2', 'en_12464_1'),
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
        expect(updated1?.normativeCategory).toBeUndefined();
        expect(updated1?.normativeSection).toBeUndefined();
        expect(updated1?.normativeActivity).toBeUndefined();
        expect(updated1?.normativeLabel).toBeUndefined();
        expect(useEditorStore.getState().defaultRoomNormativeStandard).toBe(
            'en_12464_1',
        );
        expect(
            useEditorStore.getState().project?.defaultRoomNormativeStandard,
        ).toBeUndefined();
        // El segundo ambiente conserva su configuraciÃ³n previa intacta.
        expect(untouched2?.illuminanceLux).toBe(500);
        expect(untouched2?.normativeStandard).toBe('en_12464_1');
        expect(untouched2?.normativeCategory).toBe('Previous category');
    });

    it('rechaza aplicar una misma clasificaciÃ³n global cuando no hay roomIds', () => {
        const ambient1: Room = {
            ...baseRoom('ambient-1', 'en_12464_1'),
            roomType: 'ambient',
            illuminanceLux: 500,
        };
        const ambient2: Room = {
            ...baseRoom('ambient-2', 'en_12464_1'),
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
        expect(rooms.every((r) => r.illuminanceLux === 500)).toBe(true);
        expect(rooms.every((r) => r.normativeStandard === 'en_12464_1')).toBe(
            true,
        );
    });

    it('guarda la etiqueta del perfil nuevo sin conservar la actividad europea', () => {
        const ambient: Room = {
            ...baseRoom('ambient-1', 'en_12464_1'),
            roomType: 'ambient',
        };
        const project: Project = {
            id: 'project-1',
            name: 'Project',
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
            scenes: [scene('scene-1', [ambient])],
        };
        useEditorStore.getState().setProject(project);

        useEditorStore.getState().applyNormativeProfileToRooms({
            standard: 'rne_peru',
            normaLux: 300,
            normativeLabel: 'Sala de juegos / GuarderÃ­a',
            roomIds: ['ambient-1'],
        });

        const updated = useEditorStore.getState().project?.scenes[0].rooms[0];
        expect(updated?.normativeLabel).toBe('Sala de juegos / GuarderÃ­a');
        expect(updated?.normativeActivity).toBeUndefined();
    });

    it('aplica globalmente la norma a recintos contenedores, ambientes derivados y paredes sin reconstruirlos', () => {
        const outerRoom: Room = {
            ...baseRoom('recinto-1', 'en_12464_1'),
            roomType: 'room',
            ambientConfigs: {
                'ambient-1': {
                    normativeStandard: 'en_12464_1',
                    normativeCategory: 'EducaciÃ³n',
                    activity: 'Aula europea',
                    illuminanceLux: 500,
                },
            },
        };
        const currentScene = scene('scene-1', [outerRoom]);
        currentScene.walls = [
            {
                id: 'wall-1',
                vertices: [
                    { x: 0, y: 0 },
                    { x: 4, y: 0 },
                ],
                height: 2.7,
                thickness: 0.15,
                normativeStandard: 'en_12464_1',
            },
        ];
        const project: Project = {
            id: 'project-1',
            name: 'Project',
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
            scenes: [currentScene],
        };
        useEditorStore.getState().setProject(project);

        useEditorStore.getState().setDefaultRoomNormativeStandard('rne_peru');
        useEditorStore.getState().applyDefaultNormativeStandardToRooms();

        const updatedScene = useEditorStore.getState().project!.scenes[0];
        const updatedRoom = updatedScene.rooms[0];
        const updatedConfig = updatedRoom.ambientConfigs?.['ambient-1'];
        expect(updatedRoom.id).toBe('recinto-1');
        expect(updatedRoom.vertices).toEqual(outerRoom.vertices);
        expect(updatedRoom.normativeStandard).toBe('rne_peru');
        expect(updatedConfig?.normativeStandard).toBe('rne_peru');
        expect(updatedConfig?.activity).toBeUndefined();
        expect(updatedConfig?.illuminanceLux).toBe(500);
        expect(updatedScene.walls[0].id).toBe('wall-1');
        expect(updatedScene.walls[0].normativeStandard).toBe('rne_peru');
        expect(updatedScene.walls[0].illuminanceLux).toBeUndefined();
    });

    it('al cambiar solo el estÃ¡ndar global no impone la misma aplicaciÃ³n ni los mismos lux a todos los ambientes', () => {
        const bathroom: Room = {
            ...baseRoom('bathroom', 'en_12464_1'),
            roomType: 'ambient',
            normativeActivity: 'BaÃ±o',
            illuminanceLux: 200,
        };
        const bedroom: Room = {
            ...baseRoom('bedroom', 'en_12464_1'),
            roomType: 'ambient',
            normativeActivity: 'Dormitorio',
            illuminanceLux: 100,
        };
        const project: Project = {
            id: 'project-1',
            name: 'Project',
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
            scenes: [scene('scene-1', [bathroom, bedroom])],
        };
        useEditorStore.getState().setProject(project);
        useEditorStore.getState().setDefaultRoomNormativeStandard('rne_peru');
        useEditorStore.getState().applyDefaultNormativeStandardToRooms();

        const rooms = useEditorStore.getState().project!.scenes[0].rooms;
        expect(rooms.map((room) => room.normativeStandard)).toEqual([
            'rne_peru',
            'rne_peru',
        ]);
        expect(rooms.map((room) => room.normativeActivity)).toEqual([
            undefined,
            undefined,
        ]);
        expect(rooms.map((room) => room.illuminanceLux)).toEqual([200, 100]);
    });
});

describe('useEditorStore.setProjectSiteSettings (panel "Terreno")', () => {
    const project = (): Project => ({
        id: 'project-terreno',
        name: 'Proyecto',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        scenes: [scene('scene-1', [])],
    });

    it('crea siteSettings en el proyecto cuando no existÃ­a', () => {
        useEditorStore.getState().setProject(project());
        useEditorStore.getState().setProjectSiteSettings({ maintenanceFactor: 0.65 });

        expect(useEditorStore.getState().project?.siteSettings).toEqual({
            maintenanceFactor: 0.65,
        });
    });

    it('hace merge parcial â€” no pisa campos ya seteados de otras secciones', () => {
        useEditorStore.getState().setProject(project());
        useEditorStore.getState().setProjectSiteSettings({ maintenanceFactor: 0.65 });
        useEditorStore.getState().setProjectSiteSettings({ environmentalZone: 'E3' });

        expect(useEditorStore.getState().project?.siteSettings).toEqual({
            maintenanceFactor: 0.65,
            environmentalZone: 'E3',
        });
    });

    it('no hace nada si no hay proyecto activo (no revienta)', () => {
        useEditorStore.setState({ project: null });
        expect(() =>
            useEditorStore.getState().setProjectSiteSettings({ maintenanceFactor: 0.5 }),
        ).not.toThrow();
        expect(useEditorStore.getState().project).toBeNull();
    });
});

