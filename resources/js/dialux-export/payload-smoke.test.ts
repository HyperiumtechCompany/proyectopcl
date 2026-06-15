/**
 * payload-smoke.test.ts — Genera un payload realista del documento formal y lo
 * escribe en storage/app/dialux-test-payload.json para que un script PHP lo
 * renderice con dompdf y se pueda inspeccionar visualmente el PDF resultante.
 *
 * Simula el caso real del usuario: plano importado con cad-viewer (sin
 * dxfEntities en el store) + recintos dibujados + luminarias del mismo
 * producto. La captura 3D de portada se simula con un bitmap mínimo.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Project } from '@/hooks/dialux/useEditorStore';
import { buildDialuxExportAssets } from './derived/buildDialuxExportAssets';
import { buildDialuxFormalDocument } from './document/buildDialuxFormalDocument';
import { buildDialuxExportSnapshot } from './snapshot/buildDialuxExportSnapshot';

const PNG_1PX_BLUE =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqGeoBwAChAGAVtN0PgAAAABJRU5ErkJggg==';

function buildFixture(
    id: string,
    name: string,
    x: number,
    y: number,
    roomId: string,
) {
    return {
        id,
        name,
        x,
        y,
        z: 2.8,
        lumens: 700,
        efficiency: 0.99,
        fixtureType: 'panel' as const,
        fixtureShape: 'rectangular' as const,
        lightColor: '#fff5e1',
        roomId,
        brand: 'VARTON',
        articleNumber: 'V1-R0-00547-10000-4402040',
        power: 20,
    };
}

function buildUserLikeProject(): Project {
    // Nivel tipo módulo educativo: 2 aulas grandes + hall + circulación lateral,
    // proporción vertical como el plano del usuario (≈12m ancho x 21m alto).
    return {
        id: 'project-test',
        name: 'MODULO I',
        created_at: '2026-06-11T10:00:00.000Z',
        updated_at: '2026-06-11T10:00:00.000Z',
        scenes: [
            {
                id: 'scene-1',
                name: '1° NIVEL',
                floorIndex: 0,
                floorElevation: 0,
                floorHeight: 3,
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
                        id: 'aula-1',
                        name: 'AULA 1° PRIMARIA',
                        vertices: [
                            { x: 0, y: 14 },
                            { x: 9.5, y: 14 },
                            { x: 9.5, y: 21 },
                            { x: 0, y: 21 },
                        ],
                        height: 3,
                        color: 'rgba(56,189,248,0.25)',
                        illuminanceLux: 300,
                        norma: 300,
                        fixtureLumens: 700,
                        fixtureFlux: 700,
                    },
                    {
                        id: 'aula-2',
                        name: 'AULA 2° PRIMARIA',
                        vertices: [
                            { x: 0, y: 6.5 },
                            { x: 9.5, y: 6.5 },
                            { x: 9.5, y: 13.5 },
                            { x: 0, y: 13.5 },
                        ],
                        height: 3,
                        color: 'rgba(74,222,128,0.25)',
                        illuminanceLux: 300,
                        norma: 300,
                        fixtureLumens: 700,
                        fixtureFlux: 700,
                    },
                    {
                        id: 'hall-1',
                        name: 'HALL SS.HH.',
                        vertices: [
                            { x: 0, y: 4 },
                            { x: 4.2, y: 4 },
                            { x: 4.2, y: 6 },
                            { x: 0, y: 6 },
                        ],
                        height: 3,
                        color: 'rgba(251,191,36,0.25)',
                        illuminanceLux: 100,
                        norma: 100,
                        fixtureLumens: 700,
                        fixtureFlux: 700,
                    },
                    {
                        id: 'circulacion-1',
                        name: 'CIRCULACION',
                        roomType: 'corridor',
                        vertices: [
                            { x: 10, y: 0 },
                            { x: 12, y: 0 },
                            { x: 12, y: 21 },
                            { x: 10, y: 21 },
                        ],
                        height: 3,
                        color: 'rgba(59,130,246,0.4)',
                        illuminanceLux: 100,
                        norma: 100,
                        fixtureLumens: 700,
                        fixtureFlux: 700,
                    },
                ],
                walls: [],
                windows: [],
                doors: [],
                canopies: [],
                fixtures: [
                    buildFixture('f-1', 'Luminaria VARTON [1]', 3, 16, 'aula-1'),
                    buildFixture('f-2', 'Luminaria VARTON [2]', 6.5, 19, 'aula-1'),
                    buildFixture('f-3', 'Luminaria VARTON [3]', 3, 8.5, 'aula-2'),
                    buildFixture('f-4', 'Luminaria VARTON [4]', 6.5, 11.5, 'aula-2'),
                    buildFixture('f-5', 'Luminaria VARTON [5]', 2.1, 5, 'hall-1'),
                    buildFixture('f-6', 'Luminaria VARTON [6]', 11, 4, 'circulacion-1'),
                    buildFixture('f-7', 'Luminaria VARTON [7]', 11, 11, 'circulacion-1'),
                    buildFixture('f-8', 'Luminaria VARTON [8]', 11, 18, 'circulacion-1'),
                ],
            },
        ],
    } as unknown as Project;
}

describe('dialux export payload smoke', () => {
    it('builds the formal document and writes the PHP render payload', async () => {
        const snapshot = buildDialuxExportSnapshot({
            project: buildUserLikeProject(),
            activeSceneId: 'scene-1',
            resultsByRoom: {},
            // Caso cad-viewer: el plano existe en el canvas pero NO en el store.
            dxfEntities: null,
            dxfExtents: { min_x: -40, min_y: -30, max_x: 60, max_y: 40 },
            visualConfig: {
                showGrid: true,
                showIsolux: true,
                show3DView: false,
                isoluxMode: 'waves',
                zoom: 1,
                panX: 0,
                panY: 0,
                selectedId: null,
            },
        });

        const assets = await buildDialuxExportAssets(snapshot, {
            includeViewerCapture: false,
            preCapturedViewerBitmap: {
                id: 'viewer-capture-3d',
                title: 'Captura 3D del modelo',
                purpose: 'formal-cover',
                kind: 'bitmap',
                mimeType: 'image/png',
                dataUrl: PNG_1PX_BLUE,
                width: 900,
                height: 585,
            },
        });
        const documentModel = buildDialuxFormalDocument(snapshot, assets);

        // El plano dibujado debe encuadrar el dibujo, no las extents del DXF:
        // proporción vertical (alto > ancho) como el edificio del usuario.
        const drawnTerrain = documentModel.assets.find(
            (asset) => asset.id === 'drawn-terrain-svg',
        );
        expect(drawnTerrain?.kind).toBe('vector');
        if (drawnTerrain?.kind === 'vector') {
            expect(drawnTerrain.height).toBeGreaterThan(drawnTerrain.width);
        }

        const outPath = resolve(
            __dirname,
            '../../../storage/app/dialux-test-payload.json',
        );
        mkdirSync(dirname(outPath), { recursive: true });
        writeFileSync(outPath, JSON.stringify({ document: documentModel }));

        expect(documentModel.pages.length).toBeGreaterThan(10);
    });
});
