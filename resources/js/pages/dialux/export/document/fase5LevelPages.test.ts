import { describe, expect, it } from 'vitest';
import type { Project, Room } from '@/pages/dialux/hooks/useEditorStore';
import { buildDialuxFormalDocument } from './buildDialuxFormalDocument';
import { buildDialuxExportSnapshot } from '../snapshot/buildDialuxExportSnapshot';
import {
    buildModuloIProjectFixture,
    MODULO_I_EXPECTED_LEVEL_COUNT,
} from '../__fixtures__/moduloIFixture';

const VISUAL_CONFIG = {
    showGrid: true,
    showIsolux: true,
    show3DView: false,
    isoluxMode: 'functional' as const,
    zoom: 1,
    panX: 0,
    panY: 0,
    selectedId: null,
};

describe('Fase 5 — páginas por nivel', () => {
    it('un nivel vacío (sin recintos) no genera páginas propias ni rompe el documento', async () => {
        const project = buildModuloIProjectFixture();
        // El 3er nivel se vacía por completo — sin recintos ni luminarias.
        project.scenes[2]!.rooms = [];
        project.scenes[2]!.fixtures = [];

        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: project.scenes[0]!.id,
            includeAllScenes: true,
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: VISUAL_CONFIG,
        });
        const documentModel = buildDialuxFormalDocument(snapshot, []);

        const emptySceneId = project.scenes[2]!.id;
        // Ningún seed técnico debe referenciar el nivel vacío.
        expect(
            documentModel.pages.some((page) => page.sceneId === emptySceneId),
        ).toBe(false);
        // Los otros 2 niveles con datos siguen intactos.
        expect(documentModel.levels).toHaveLength(
            MODULO_I_EXPECTED_LEVEL_COUNT - 1,
        );
        expect(
            documentModel.pages.filter(
                (page) => page.kind === 'level-luminaire-list',
            ),
        ).toHaveLength(MODULO_I_EXPECTED_LEVEL_COUNT - 1);
    });

    it('un recinto con más objetos de cálculo que los que caben en una página se pagina, no se recorta', async () => {
        const project = buildModuloIProjectFixture();
        const scene = project.scenes[0]!;
        const AMBIENT_COUNT = 25;

        const moduleRoom: Room = {
            id: 'big-module',
            name: 'Modulo Grande',
            roomType: 'room',
            vertices: [
                { x: 0, y: 0 },
                { x: 60, y: 0 },
                { x: 60, y: 3 },
                { x: 0, y: 3 },
            ],
            height: 2.7,
            color: 'rgba(56,189,248,0.25)',
        };

        const corridorRooms: Room[] = Array.from(
            { length: AMBIENT_COUNT },
            (_, index) => ({
                id: `corridor-${index}`,
                name: `Tramo ${index + 1}`,
                roomType: 'corridor',
                vertices: [
                    { x: index * 2, y: 0 },
                    { x: index * 2 + 1.5, y: 0 },
                    { x: index * 2 + 1.5, y: 2 },
                    { x: index * 2, y: 2 },
                ],
                height: 2.7,
                color: 'rgba(59,130,246,0.4)',
                illuminanceLux: 150,
                norma: 150,
                fixtureLumens: 2000,
                fixtureFlux: 2000,
            }),
        );

        scene.rooms = [moduleRoom, ...corridorRooms];
        scene.fixtures = corridorRooms.map((room, index) => ({
            id: `fixture-corridor-${index}`,
            name: 'Panel',
            x: index * 2 + 0.75,
            y: 1,
            z: 2.6,
            lumens: 2000,
            efficiency: 0.8,
            fixtureType: 'panel' as const,
            fixtureShape: 'rectangular' as const,
            lightColor: '#fff5e1',
            roomId: `${room.id}::ambient-1`,
            power: 20,
        }));

        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: scene.id,
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: VISUAL_CONFIG,
        });
        const documentModel = buildDialuxFormalDocument(snapshot, []);

        const moduleAmbients = documentModel.ambientDetails.filter(
            (detail) => detail.roomId === 'big-module',
        );
        // El módulo en sí también se reporta como ambiente de contexto además
        // de sus corredores (mismo comportamiento que el resto del pipeline).
        const totalAmbientsInModule = AMBIENT_COUNT + 1;
        expect(moduleAmbients).toHaveLength(totalAmbientsInModule);

        const calcPagesForModule = documentModel.pages.filter(
            (page) =>
                page.kind === 'calculation-object-list' &&
                page.roomId === 'big-module',
        );
        expect(calcPagesForModule.length).toBeGreaterThan(1);

        const sortedRanges = [...calcPagesForModule]
            .map((page) => [page.rowRangeStart ?? 0, page.rowRangeEnd ?? 0] as const)
            .sort((a, b) => a[0] - b[0]);
        expect(sortedRanges[0]![0]).toBe(0);
        expect(sortedRanges.at(-1)![1]).toBe(totalAmbientsInModule);
        for (let i = 1; i < sortedRanges.length; i++) {
            expect(sortedRanges[i]![0]).toBe(sortedRanges[i - 1]![1]);
        }
    });
});
