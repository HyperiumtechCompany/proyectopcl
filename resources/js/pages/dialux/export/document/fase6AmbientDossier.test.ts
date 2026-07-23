import { describe, expect, it } from 'vitest';
import type { Project } from '@/pages/dialux/hooks/useEditorStore';
import { buildDialuxFormalDocument } from './buildDialuxFormalDocument';
import { buildDialuxExportSnapshot } from '../snapshot/buildDialuxExportSnapshot';
import { buildModuloIProjectFixture } from '../__fixtures__/moduloIFixture';

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

function buildSingleAmbientProject(overrides: {
    roomName: string;
    fixtures: Project['scenes'][number]['fixtures'];
}): Project {
    return {
        id: 'single-ambient-fixture',
        name: 'Proyecto Ambiente Único',
        created_at: '2026-07-22T10:00:00.000Z',
        updated_at: '2026-07-22T10:00:00.000Z',
        scenes: [
            {
                id: 'scene-1',
                name: 'Planta Baja',
                floorIndex: 0,
                floorElevation: 0,
                floorHeight: 2.8,
                lightSwitches: [],
                partitions: [],
                scaleConfig: {
                    unit: 'm',
                    factor: 1,
                    displayUnit: 'Metros (1 = 1m)',
                    calibrationFactor: 1,
                    isCalibrated: false,
                },
                rooms: [
                    {
                        id: 'room-1',
                        name: overrides.roomName,
                        vertices: [
                            { x: 0, y: 0 },
                            { x: 6, y: 0 },
                            { x: 6, y: 4 },
                            { x: 0, y: 4 },
                        ],
                        height: 2.8,
                        color: 'rgba(56,189,248,0.25)',
                        illuminanceLux: 300,
                        norma: 300,
                        fixtureLumens: 2000,
                        fixtureFlux: 2000,
                    },
                ],
                walls: [],
                windows: [],
                doors: [],
                canopies: [],
                fixtures: overrides.fixtures,
            },
        ],
    };
}

describe('Fase 6 — expediente reutilizable de ambiente', () => {
    it('un nombre de ambiente muy largo y con caracteres especiales no rompe la generación del documento', async () => {
        const longName =
            'Depósito de Materiales & Equipos Eléctricos — Sub-Nivel "Técnico" (Área Restringida) N°25 / Ñoño & Cía.';
        const project = buildSingleAmbientProject({
            roomName: longName,
            fixtures: [
                {
                    id: 'fixture-1',
                    name: 'Panel',
                    x: 3,
                    y: 2,
                    z: 2.6,
                    lumens: 2000,
                    efficiency: 0.8,
                    fixtureType: 'panel',
                    fixtureShape: 'rectangular',
                    lightColor: '#fff5e1',
                    roomId: 'room-1::ambient-1',
                    power: 20,
                },
            ],
        });

        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: 'scene-1',
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: VISUAL_CONFIG,
        });

        expect(() => buildDialuxFormalDocument(snapshot, [])).not.toThrow();
        const documentModel = buildDialuxFormalDocument(snapshot, []);

        expect(documentModel.ambientDetails[0]?.ambientName).toBe(longName);
        expect(
            documentModel.pages.some((page) => page.subtitle === longName),
        ).toBe(true);
    });

    it('un ambiente sin luminarias no genera la página de lista de luminarias (sin páginas vacías)', async () => {
        const project = buildSingleAmbientProject({
            roomName: 'Depósito sin equipar',
            fixtures: [],
        });

        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: 'scene-1',
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: VISUAL_CONFIG,
        });
        const documentModel = buildDialuxFormalDocument(snapshot, []);

        expect(documentModel.ambientDetails[0]?.luminaires).toHaveLength(0);
        expect(
            documentModel.pages.some((page) => page.kind === 'ambient-luminaires'),
        ).toBe(false);
        // El resumen y los objetos de cálculo sí deben seguir presentes.
        expect(
            documentModel.pages.some((page) => page.kind === 'ambient-summary'),
        ).toBe(true);
        expect(
            documentModel.pages.some(
                (page) => page.kind === 'ambient-calculation-object',
            ),
        ).toBe(true);
    });

    it('un hall con una sola luminaria genera la lista de luminarias con exactamente 1 fila', async () => {
        const project = buildSingleAmbientProject({
            roomName: 'Hall de Escalera',
            fixtures: [
                {
                    id: 'fixture-1',
                    name: 'Spot',
                    x: 3,
                    y: 2,
                    z: 2.6,
                    lumens: 1200,
                    efficiency: 0.8,
                    fixtureType: 'spot',
                    fixtureShape: 'round',
                    lightColor: '#fff5e1',
                    roomId: 'room-1::ambient-1',
                    power: 12,
                },
            ],
        });

        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: 'scene-1',
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: VISUAL_CONFIG,
        });
        const documentModel = buildDialuxFormalDocument(snapshot, []);

        expect(documentModel.ambientDetails[0]?.luminaires).toHaveLength(1);
        expect(
            documentModel.pages.some((page) => page.kind === 'ambient-luminaires'),
        ).toBe(true);
    });

    it('los 7 tipos de ambiente de referencia (MÓDULO I) se generan con la misma factoría', async () => {
        const project = buildModuloIProjectFixture();
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

        // Cada uno de los 24 ambientes (8 tipos × 3 niveles) debe tener, como
        // mínimo, resumen y objetos de cálculo — generados por la misma
        // factoría (el mismo roomAmbients.forEach), sin importar el tipo.
        for (const detail of documentModel.ambientDetails) {
            const pagesForAmbient = documentModel.pages.filter(
                (page) => page.ambientId === detail.ambientId,
            );
            const kindsForAmbient = pagesForAmbient.map((page) => page.kind);

            expect(kindsForAmbient).toContain('ambient-summary');
            expect(kindsForAmbient).toContain('ambient-calculation-object');
            // Todos los ambientes de este fixture tienen luminaria propia.
            expect(kindsForAmbient).toContain('ambient-luminaires');
        }
    });
});
