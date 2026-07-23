import axios from 'axios';
import { describe, expect, it, vi } from 'vitest';
import type { LightingResult, Project } from '@/pages/dialux/hooks/useEditorStore';
import { buildDialuxExportAssets } from './derived/buildDialuxExportAssets';
import { buildDialuxExportDocument } from './document/buildDialuxExportDocument';
import { buildDialuxFormalDocument } from './document/buildDialuxFormalDocument';
import { buildDialuxExportSnapshot } from './snapshot/buildDialuxExportSnapshot';

function buildProjectFixture(): Project {
    return {
        id: 'project-1',
        name: 'Proyecto Demo',
        created_at: '2026-04-20T10:00:00.000Z',
        updated_at: '2026-04-20T10:00:00.000Z',
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
                        name: 'Oficina',
                        vertices: [
                            { x: 0, y: 0 },
                            { x: 6, y: 0 },
                            { x: 6, y: 4 },
                            { x: 0, y: 4 },
                        ],
                        height: 2.8,
                        color: 'rgba(56,189,248,0.25)',
                        illuminanceLux: 500,
                        norma: 500,
                        fixtureLumens: 4000,
                        fixtureFlux: 4000,
                        normativeCategory: 'oficinas',
                        normativeSection: 'interiores',
                        normativeActivity: 'trabajo',
                        normativeLabel: 'Oficina general',
                    },
                    {
                        id: 'room-2',
                        name: 'Sala de reuniones',
                        vertices: [
                            { x: 6.5, y: 0 },
                            { x: 11.5, y: 0 },
                            { x: 11.5, y: 4 },
                            { x: 6.5, y: 4 },
                        ],
                        height: 2.8,
                        color: 'rgba(74,222,128,0.25)',
                        illuminanceLux: 300,
                        norma: 300,
                        fixtureLumens: 3200,
                        fixtureFlux: 3200,
                        normativeCategory: 'oficinas',
                        normativeSection: 'interiores',
                        normativeActivity: 'reunion',
                        normativeLabel: 'Sala de reuniones',
                    },
                ],
                walls: [],
                windows: [],
                doors: [],
                canopies: [],
                fixtures: [
                    {
                        id: 'fixture-1',
                        name: 'Panel 60x60',
                        x: 3,
                        y: 2,
                        z: 2.7,
                        lumens: 4000,
                        efficiency: 0.8,
                        fixtureType: 'panel',
                        fixtureShape: 'rectangular',
                        lightColor: '#fff5e1',
                        roomId: 'room-1::ambient-1',
                        brand: 'Test Lighting',
                        articleNumber: 'PANEL-40W',
                        productId: 10,
                        productSourceFormat: 'ies',
                        power: 40,
                    },
                    {
                        id: 'fixture-2',
                        name: 'Spot dirigible',
                        x: 8.5,
                        y: 2,
                        z: 2.7,
                        lumens: 1600,
                        efficiency: 0.8,
                        fixtureType: 'spot',
                        fixtureShape: 'round',
                        lightColor: '#fff5e1',
                        roomId: 'room-2::ambient-1',
                        power: 18,
                    },
                ],
            },
        ],
    };
}

function buildLightingResultFixture(): LightingResult {
    return {
        avg_lux: 540,
        min_lux: 332,
        max_lux: 688,
        uniformity: 0.615,
        ugr: 18.2,
        grid_rows: 2,
        grid_cols: 3,
        grid_values: [420, 520, 610, 332, 540, 688],
        grid_active: [true, true, true, true, true, true],
        grid_origin_x: 0,
        grid_origin_y: 0,
        grid_cell_width: 2,
        grid_cell_height: 2,
        room_vertices: [
            { x: 0, y: 0 },
            { x: 6, y: 0 },
            { x: 6, y: 4 },
            { x: 0, y: 4 },
        ],
    };
}

describe('dialux export pipeline', () => {
    it('builds a snapshot from the editor state shape', () => {
        const snapshot = buildDialuxExportSnapshot({
            project: buildProjectFixture(),
            activeSceneId: 'scene-1',
            resultsByRoom: {
                'room-1::ambient-1': buildLightingResultFixture(),
                'room-2::ambient-1': {
                    ...buildLightingResultFixture(),
                    avg_lux: 328,
                    min_lux: 211,
                    max_lux: 412,
                    room_vertices: [
                        { x: 6.5, y: 0 },
                        { x: 11.5, y: 0 },
                        { x: 11.5, y: 4 },
                        { x: 6.5, y: 4 },
                    ],
                },
            },
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: {
                showGrid: true,
                showIsolux: true,
                show3DView: false,
                isoluxMode: 'functional',
                zoom: 1,
                panX: 0,
                panY: 0,
                selectedId: null,
            },
        });

        expect(snapshot.scene.id).toBe('scene-1');
        expect(snapshot.ambients).toHaveLength(2);
        expect(snapshot.ambients[0]?.result?.avg_lux).toBe(540);
        expect(snapshot.ambients[0]?.metrics.g2).toBeCloseTo(332 / 688);
        expect(snapshot.ambients[0]?.metrics.usefulPlaneHeight).toBe(0.8);
        expect(snapshot.summary.calculatedAmbientCount).toBe(2);
        expect(snapshot.summary.compliantAmbientCount).toBe(2);
    });

    it('can build the formal export snapshot from every project level', () => {
        const project = buildProjectFixture();
        const baseScene = project.scenes[0]!;
        baseScene.name = 'NIVEL 1';
        const secondLevelRoom = {
            ...baseScene.rooms[0]!,
            id: 'room-3',
            name: '2 NIVEL',
            vertices: [
                { x: 0, y: 5 },
                { x: 6, y: 5 },
                { x: 6, y: 9 },
                { x: 0, y: 9 },
            ],
        };

        project.scenes.push({
            ...baseScene,
            id: 'scene-2',
            name: 'NIVEL 2',
            floorIndex: 1,
            rooms: [secondLevelRoom],
            fixtures: [
                {
                    ...baseScene.fixtures[0]!,
                    id: 'fixture-3',
                    roomId: 'room-3::ambient-1',
                    x: 3,
                    y: 7,
                },
            ],
        });

        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: 'scene-1',
            includeAllScenes: true,
            resultsByRoom: {
                'room-1::ambient-1': buildLightingResultFixture(),
                'room-2::ambient-1': buildLightingResultFixture(),
                'room-3::ambient-1': buildLightingResultFixture(),
            },
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: {
                showGrid: true,
                showIsolux: true,
                show3DView: false,
                isoluxMode: 'functional',
                zoom: 1,
                panX: 0,
                panY: 0,
                selectedId: null,
            },
        });
        const documentModel = buildDialuxFormalDocument(snapshot, []);

        expect(snapshot.ambients).toHaveLength(3);
        expect(snapshot.summary.fixtureCount).toBe(3);
        expect(
            documentModel.ambientDetails.map((detail) => detail.roomName),
        ).toContain('2 NIVEL');
        expect(
            documentModel.pages.some(
                (page) => page.sectionId === 'room-calculation-object:room-3',
            ),
        ).toBe(true);
        expect(
            documentModel.toc.some(
                (entry) =>
                    entry.kind === 'section-heading' &&
                    entry.title === 'NIVEL 1',
            ),
        ).toBe(true);
        expect(
            documentModel.toc.some(
                (entry) =>
                    entry.kind === 'section-heading' &&
                    entry.title === 'NIVEL 2',
            ),
        ).toBe(true);
    });

    it('calculates missing ambient results while building the export snapshot', () => {
        const snapshot = buildDialuxExportSnapshot({
            project: buildProjectFixture(),
            activeSceneId: 'scene-1',
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: {
                showGrid: true,
                showIsolux: true,
                show3DView: false,
                isoluxMode: 'functional',
                zoom: 1,
                panX: 0,
                panY: 0,
                selectedId: null,
            },
        });

        expect(snapshot.summary.calculatedAmbientCount).toBe(2);
        expect(snapshot.ambients[0]?.result).not.toBeNull();
        expect(snapshot.ambients[0]?.metrics.avgLux).toBeGreaterThan(0);
        expect(snapshot.ambients[0]?.metrics.minLux).toBeGreaterThanOrEqual(0);
        expect(snapshot.ambients[0]?.metrics.maxLux).toBeGreaterThan(0);
        expect(snapshot.resultsByRoom['room-1::ambient-1']?.avg_lux).toBe(
            snapshot.ambients[0]?.metrics.avgLux,
        );
    });

    it('exports corridor room type inside a module as a calculated formal ambient', async () => {
        const project = buildProjectFixture();
        const scene = project.scenes[0]!;

        scene.rooms = [
            {
                id: 'module-1',
                name: 'Modulo A',
                roomType: 'room',
                vertices: [
                    { x: 0, y: 0 },
                    { x: 10, y: 0 },
                    { x: 10, y: 5 },
                    { x: 0, y: 5 },
                ],
                height: 2.7,
                color: 'rgba(56,189,248,0.25)',
                illuminanceLux: 500,
                norma: 500,
                fixtureLumens: 4000,
                fixtureFlux: 4000,
            },
            {
                id: 'corridor-1',
                name: 'Pasadizo principal',
                roomType: 'corridor',
                vertices: [
                    { x: 0, y: 0 },
                    { x: 8, y: 0 },
                    { x: 8, y: 1.5 },
                    { x: 0, y: 1.5 },
                ],
                height: 2.7,
                color: 'rgba(59, 130, 246, 0.4)',
                illuminanceLux: 150,
                norma: 150,
                fixtureLumens: 3000,
                fixtureFlux: 3000,
            },
        ];
        scene.walls = [
            {
                id: 'wall-1',
                vertices: [
                    { x: 1, y: 0.25 },
                    { x: 2, y: 0.25 },
                    { x: 2, y: 1.25 },
                    { x: 1, y: 1.25 },
                    { x: 1, y: 0.25 },
                ],
                thickness: 0.15,
                height: 2.7,
            },
        ];
        scene.fixtures = [
            {
                id: 'fixture-corridor-1',
                name: 'Panel pasadizo',
                x: 4,
                y: 0.75,
                z: 2.6,
                lumens: 3000,
                efficiency: 0.8,
                fixtureType: 'panel',
                fixtureShape: 'rectangular',
                lightColor: '#fff5e1',
                roomId: 'module-1::corridor-1::ambient-1',
                power: 30,
            },
        ];

        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: 'scene-1',
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: {
                showGrid: true,
                showIsolux: true,
                show3DView: false,
                isoluxMode: 'functional',
                zoom: 1,
                panX: 0,
                panY: 0,
                selectedId: null,
            },
        });
        const assets = await buildDialuxExportAssets(snapshot, {
            includeViewerCapture: false,
        });
        const documentModel = buildDialuxFormalDocument(snapshot, assets);

        const corridorAmbient = snapshot.ambients.find(
            (ambient) => ambient.sourceRoom.id === 'corridor-1',
        );

        // El módulo + el pasillo (los corredores siempre se reportan como contexto).
        expect(snapshot.rooms).toHaveLength(2);
        expect(snapshot.rooms.some((room) => room.id === 'module-1')).toBe(
            true,
        );
        expect(corridorAmbient?.id).toBe('module-1::corridor-1::ambient-1');
        expect(corridorAmbient?.roomId).toBe('module-1');
        expect(corridorAmbient?.roomName).toBe('Modulo A');
        expect(corridorAmbient?.metrics.usefulPlaneHeight).toBe(0);
        expect(snapshot.summary.roomCount).toBe(2);
        expect(snapshot.summary.calculatedAmbientCount).toBe(2);
        expect(documentModel.ambientDetails).toHaveLength(2);
        expect(
            documentModel.ambientDetails.some(
                (detail) =>
                    detail.roomName === 'Modulo A' &&
                    detail.ambientName === 'Pasadizo principal',
            ),
        ).toBe(true);
        expect(
            documentModel.ambientDetails.find(
                (detail) => detail.ambientName === 'Pasadizo principal',
            )?.ambientName,
        ).toBe('Pasadizo principal');
        expect(
            documentModel.pages.some((page) => page.kind === 'ambient-summary'),
        ).toBe(true);
        expect(
            documentModel.assets.some(
                (asset) =>
                    asset.id ===
                    'ambient-plan-svg-module-1::corridor-1::ambient-1',
            ),
        ).toBe(true);
        expect(
            documentModel.toc.some(
                (entry) => entry.title === 'Pasadizo principal',
            ),
        ).toBe(true);
        expect(
            documentModel.toc.some(
                (entry) =>
                    entry.sectionId ===
                        'ambient-group-label-module-1::corridor-1::ambient-1' &&
                    entry.title.includes('Modulo A'),
            ),
        ).toBe(true);
        expect(
            documentModel.pages.filter((page) => page.kind === 'toc'),
        ).toHaveLength(Math.ceil(documentModel.toc.length / 24));
    });

    it('creates reusable visual and structured assets', async () => {
        const snapshot = buildDialuxExportSnapshot({
            project: buildProjectFixture(),
            activeSceneId: 'scene-1',
            resultsByRoom: {
                'room-1::ambient-1': buildLightingResultFixture(),
                'room-2::ambient-1': {
                    ...buildLightingResultFixture(),
                    avg_lux: 328,
                    min_lux: 211,
                    max_lux: 412,
                    room_vertices: [
                        { x: 6.5, y: 0 },
                        { x: 11.5, y: 0 },
                        { x: 11.5, y: 4 },
                        { x: 6.5, y: 4 },
                    ],
                },
            },
            dxfEntities: null,
            dxfExtents: null,
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
        });

        // Sin DXF importado no se emite el plano base CAD ("plano solo").
        expect(assets.some((asset) => asset.id === 'cad-overview-svg')).toBe(
            false,
        );
        expect(assets.some((asset) => asset.id === 'drawn-terrain-svg')).toBe(
            true,
        );
        expect(
            assets.some((asset) => asset.id === 'terrain-with-isolux-svg'),
        ).toBe(true);
        expect(assets.some((asset) => asset.id === 'chart-lux-summary')).toBe(
            true,
        );
        expect(
            assets.some((asset) => asset.id === 'isolux-svg-room-1::ambient-1'),
        ).toBe(true);
        expect(
            assets.some((asset) => asset.id === 'ambient-catalog-data'),
        ).toBe(true);
        expect(
            assets.some((asset) => asset.id === 'luminaire-products-data'),
        ).toBe(true);
        expect(
            assets.some(
                (asset) => asset.id === 'ambient-plan-svg-room-1::ambient-1',
            ),
        ).toBe(true);
    });

    it('attaches the architectural plan to the formal ambient list page', () => {
        const snapshot = buildDialuxExportSnapshot({
            project: buildProjectFixture(),
            activeSceneId: 'scene-1',
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: {
                showGrid: true,
                showIsolux: true,
                show3DView: false,
                isoluxMode: 'functional',
                zoom: 1,
                panX: 0,
                panY: 0,
                selectedId: null,
            },
        });
        const documentModel = buildDialuxFormalDocument(snapshot, [
            {
                id: 'drawn-terrain-svg',
                title: 'Plano arquitectonico',
                purpose: 'drawn-terrain',
                kind: 'vector',
                mimeType: 'image/svg+xml',
                svg: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="160"></svg>',
                width: 300,
                height: 160,
            },
        ]);

        expect(
            documentModel.pages.find((page) => page.kind === 'ambient-list')
                ?.assetIds,
        ).toEqual(['drawn-terrain-svg']);
    });

    it('builds the document model with the planned sections', async () => {
        const snapshot = buildDialuxExportSnapshot({
            project: buildProjectFixture(),
            activeSceneId: 'scene-1',
            resultsByRoom: {
                'room-1::ambient-1': buildLightingResultFixture(),
                'room-2::ambient-1': {
                    ...buildLightingResultFixture(),
                    avg_lux: 328,
                    min_lux: 211,
                    max_lux: 412,
                    room_vertices: [
                        { x: 6.5, y: 0 },
                        { x: 11.5, y: 0 },
                        { x: 11.5, y: 4 },
                        { x: 6.5, y: 4 },
                    ],
                },
            },
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: {
                showGrid: true,
                showIsolux: true,
                show3DView: false,
                isoluxMode: 'temperature',
                zoom: 1,
                panX: 0,
                panY: 0,
                selectedId: null,
            },
        });
        const assets = await buildDialuxExportAssets(snapshot, {
            includeViewerCapture: false,
        });
        const documentModel = buildDialuxExportDocument(snapshot, assets);

        expect(documentModel.sections.map((section) => section.kind)).toEqual([
            'project-summary',
            'cad-overview',
            'ambient-catalog',
            'lighting-results-table',
            'isolux',
            'charts',
            'technical-appendix',
        ]);
        expect(documentModel.assets.length).toBeGreaterThanOrEqual(6);
    });

    it('builds a formal A4 document with fixed front matter, toc, luminaires and ambient detail pages', async () => {
        const snapshot = buildDialuxExportSnapshot({
            project: buildProjectFixture(),
            activeSceneId: 'scene-1',
            resultsByRoom: {
                'room-1::ambient-1': buildLightingResultFixture(),
                'room-2::ambient-1': {
                    ...buildLightingResultFixture(),
                    avg_lux: 328,
                    min_lux: 211,
                    max_lux: 412,
                    room_vertices: [
                        { x: 6.5, y: 0 },
                        { x: 11.5, y: 0 },
                        { x: 11.5, y: 4 },
                        { x: 6.5, y: 4 },
                    ],
                },
            },
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: {
                showGrid: true,
                showIsolux: true,
                show3DView: true,
                isoluxMode: 'functional',
                zoom: 1,
                panX: 0,
                panY: 0,
                selectedId: null,
            },
        });
        const assets = await buildDialuxExportAssets(snapshot, {
            includeViewerCapture: false,
        });
        const documentModel = buildDialuxFormalDocument(snapshot, assets);

        expect(documentModel.paper).toEqual({
            format: 'A4',
            orientation: 'portrait',
        });
        expect(documentModel.pages[0]?.kind).toBe('cover');
        expect(documentModel.pages[1]?.kind).toBe('preliminary-observations');
        expect(documentModel.pages[2]?.kind).toBe('toc');
        expect(documentModel.pages[1]?.sectionId).toBe(
            'preliminary-observations',
        );
        expect(documentModel.pages[1]?.pageNumber).toBe(2);
        expect(documentModel.pages[2]?.pageNumber).toBe(3);
        expect(
            documentModel.pages.some((page) => page.kind === 'luminaire-list'),
        ).toBe(true);
        expect(
            documentModel.pages.some((page) => page.kind === 'ambient-list'),
        ).toBe(true);
        expect(
            documentModel.pages.some(
                (page) => page.kind === 'calculation-object-list',
            ),
        ).toBe(true);
        expect(
            documentModel.pages.filter((page) => page.kind === 'ambient-plan'),
        ).toHaveLength(2);
        expect(
            documentModel.pages.filter(
                (page) => page.kind === 'ambient-useful-plane',
            ),
        ).toHaveLength(2);
        // Los planos del terreno van primero: plano con dibujo → plano con
        // isolux → lista de luminarias (el plano solo requiere DXF importado).
        expect(
            documentModel.pages.findIndex(
                (page) => page.kind === 'ambient-list',
            ),
        ).toBeLessThan(
            documentModel.pages.findIndex(
                (page) => page.kind === 'terrain-architectural',
            ),
        );
        expect(
            documentModel.pages.findIndex(
                (page) => page.kind === 'terrain-architectural',
            ),
        ).toBeLessThan(
            documentModel.pages.findIndex(
                (page) => page.sectionId === 'cad-overview-luminaires',
            ),
        );
        expect(
            documentModel.pages.findIndex(
                (page) => page.sectionId === 'cad-overview-luminaires',
            ),
        ).toBeLessThan(
            documentModel.pages.findIndex(
                (page) => page.kind === 'calculation-object-list',
            ),
        );
        expect(
            documentModel.pages.filter(
                (page) => page.kind === 'ambient-summary',
            ),
        ).toHaveLength(2);
        expect(
            documentModel.toc.find(
                (entry) => entry.sectionId === 'preliminary-observations',
            )?.pageNumber,
        ).toBe(2);
        expect(
            documentModel.toc.find((entry) => entry.sectionId === 'content')
                ?.pageNumber,
        ).toBe(3);
        expect(
            documentModel.toc.find(
                (entry) => entry.sectionId === 'cad-overview-luminaires',
            )?.pageNumber,
        ).toBeGreaterThan(1);
        expect(
            documentModel.assets.some(
                (asset) => asset.id === 'ambient-plan-svg-room-1::ambient-1',
            ),
        ).toBe(true);
        expect(
            documentModel.assets.some(
                (asset) => asset.id === 'isolux-svg-room-2::ambient-1',
            ),
        ).toBe(true);
        expect(documentModel.luminaires).toHaveLength(2);
        expect(documentModel.luminaires[0]?.articleNumber).toBe('PANEL-40W');
        expect(documentModel.luminaires[0]?.brand).toBe('Test Lighting');
        expect(documentModel.ambientDetails).toHaveLength(2);
        expect(documentModel.ambientDetails[0]?.g2).toBeCloseTo(332 / 688, 2);
        expect(documentModel.ambientDetails[0]?.calculationIndex).toBe('WP1');
        expect(documentModel.ambientDetails[0]?.usefulPlaneHeight).toBe(0.8);
        expect(documentModel.ambientDetails[0]?.fixturePositions[0]?.x).toBe(3);
        const firstAmbientPageKinds = documentModel.pages
            .filter((page) => page.ambientId === 'room-1::ambient-1')
            .map((page) => page.kind);
        expect(firstAmbientPageKinds).toEqual([
            'ambient-summary',
            'ambient-plan',
            'ambient-luminaires',
            'ambient-calculation-object',
            'ambient-useful-plane',
        ]);
        expect(
            documentModel.ambientDetails[0]?.luminaires[0]?.shape,
        ).toBeTruthy();
        expect(documentModel.pages[1]?.notes.length).toBeGreaterThan(0);
    });

    it('prefers pre-captured editor bitmaps for cover and terrain plan pages', async () => {
        const snapshot = buildDialuxExportSnapshot({
            project: buildProjectFixture(),
            activeSceneId: 'scene-1',
            resultsByRoom: {
                'room-1::ambient-1': buildLightingResultFixture(),
            },
            dxfEntities: null,
            dxfExtents: null,
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

        const makeBitmap = (id: string, purpose: string) => ({
            id,
            title: id,
            purpose,
            kind: 'bitmap' as const,
            mimeType: 'image/jpeg' as const,
            dataUrl: 'data:image/jpeg;base64,xxxx',
            width: 900,
            height: 585,
        });

        const assets = await buildDialuxExportAssets(snapshot, {
            includeViewerCapture: false,
            preCapturedViewerBitmap: makeBitmap(
                'viewer-capture-3d',
                'formal-cover',
            ) as never,
            preCapturedCadBitmap: makeBitmap(
                'cad-base-bitmap',
                'cad-base',
            ) as never,
            preCapturedDrawnBitmap: makeBitmap(
                'composite-plan-bitmap',
                'drawn-terrain',
            ) as never,
            preCapturedIsoluxBitmap: makeBitmap(
                'composite-isolux-bitmap',
                'isolux',
            ) as never,
        });
        const documentModel = buildDialuxFormalDocument(snapshot, assets);

        // La portada usa la captura 3D real del editor.
        const coverPage = documentModel.pages.find(
            (page) => page.kind === 'cover',
        );
        expect(coverPage?.assetIds).toContain('viewer-capture-3d');

        // El plano base (sin DXF en el store) usa la captura del canvas CAD.
        const cadPage = documentModel.pages.find(
            (page) => page.kind === 'terrain-cad',
        );
        expect(cadPage?.assetIds).toEqual(['cad-base-bitmap']);

        // Plano con dibujo e isolux: las capturas compuestas tienen prioridad
        // sobre los SVG sintéticos.
        const drawnPage = documentModel.pages.find(
            (page) => page.kind === 'ambient-list',
        );
        expect(drawnPage?.assetIds).toEqual(['composite-plan-bitmap']);
        const isoluxPage = documentModel.pages.find(
            (page) => page.kind === 'terrain-architectural',
        );
        expect(isoluxPage?.assetIds).toEqual(['composite-isolux-bitmap']);
    });

    it('groups identical luminaire products into one list item with quantity and a single product sheet', () => {
        const project = buildProjectFixture();
        const scene = project.scenes[0]!;

        // Tres instancias del mismo producto (con sufijos de copia y en distintos
        // recintos) + un producto distinto.
        scene.fixtures = [
            {
                id: 'fixture-a1',
                name: 'Panel 60x60 [1]',
                x: 2,
                y: 1,
                z: 2.7,
                lumens: 4000,
                efficiency: 0.8,
                fixtureType: 'panel',
                fixtureShape: 'rectangular',
                lightColor: '#fff5e1',
                roomId: 'room-1::ambient-1',
                brand: 'Test Lighting',
                articleNumber: 'PANEL-40W',
                productId: 10,
                power: 40,
            },
            {
                id: 'fixture-a2',
                name: 'Panel 60x60 [2]',
                x: 4,
                y: 3,
                z: 2.7,
                lumens: 4000,
                efficiency: 0.8,
                fixtureType: 'panel',
                fixtureShape: 'rectangular',
                lightColor: '#fff5e1',
                roomId: 'room-1::ambient-1',
                brand: 'Test Lighting',
                articleNumber: 'PANEL-40W',
                productId: 10,
                power: 40,
            },
            {
                id: 'fixture-a3',
                name: 'Panel 60x60 (3)',
                x: 8.5,
                y: 2,
                z: 2.7,
                lumens: 4000,
                efficiency: 0.8,
                fixtureType: 'panel',
                fixtureShape: 'rectangular',
                lightColor: '#fff5e1',
                roomId: 'room-2::ambient-1',
                brand: 'Test Lighting',
                articleNumber: 'PANEL-40W',
                productId: 10,
                power: 40,
            },
            {
                id: 'fixture-b1',
                name: 'Spot dirigible',
                x: 9.5,
                y: 3,
                z: 2.7,
                lumens: 1600,
                efficiency: 0.8,
                fixtureType: 'spot',
                fixtureShape: 'round',
                lightColor: '#fff5e1',
                roomId: 'room-2::ambient-1',
                power: 18,
            },
        ];

        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: 'scene-1',
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: {
                showGrid: true,
                showIsolux: true,
                show3DView: false,
                isoluxMode: 'functional',
                zoom: 1,
                panX: 0,
                panY: 0,
                selectedId: null,
            },
        });
        const documentModel = buildDialuxFormalDocument(snapshot, []);

        // Lista global: 2 tipologías, el panel consolidado con cantidad 3.
        expect(documentModel.luminaires).toHaveLength(2);
        const panel = documentModel.luminaires.find(
            (luminaire) => luminaire.articleNumber === 'PANEL-40W',
        );
        expect(panel?.quantity).toBe(3);
        expect(panel?.name).toBe('Panel 60x60');

        // Totales tipo evo: Φtotal y Ptotal multiplican por cantidad.
        expect(documentModel.luminaireTotals.totalLumens).toBe(4000 * 3 + 1600);
        expect(documentModel.luminaireTotals.totalPowerWatts).toBe(40 * 3 + 18);

        // Una sola ficha de producto por producto único.
        expect(
            documentModel.pages.filter((page) => page.kind === 'product-sheet'),
        ).toHaveLength(2);

        // Lista por ambiente: las 2 instancias del room-1 se agrupan en una fila.
        const firstAmbient = documentModel.ambientDetails.find(
            (detail) => detail.ambientId === 'room-1::ambient-1',
        );
        expect(firstAmbient?.luminaires).toHaveLength(1);
        expect(firstAmbient?.luminaires[0]?.quantity).toBe(2);

        // El plano útil descuenta la zona marginal del área total.
        expect(firstAmbient?.usefulArea).toBeGreaterThan(0);
        expect(firstAmbient?.usefulArea).toBeLessThanOrEqual(
            firstAmbient?.area ?? 0,
        );
    });

    it('enriches imported products with polar assets and report tables', async () => {
        const getSpy = vi.spyOn(axios, 'get').mockResolvedValueOnce({
            data: {
                product: {
                    id: 10,
                    name: 'Panel 60x60',
                    manufacturer: 'Test Lighting',
                    catalog_number: 'PANEL-40W',
                    source_format: 'ies',
                    cct: '4000K',
                    cri_ra: 80,
                    report_data: {
                        technical_table: [
                            { label: 'Producto', value: 'Panel 60x60' },
                            { label: 'Rendimiento', value: '100.0 lm/W' },
                        ],
                    },
                    report_assets: {
                        polar_svg:
                            '<svg xmlns="http://www.w3.org/2000/svg"><text>CDL polar</text></svg>',
                    },
                    photometric_web: {
                        c_angles: [0],
                        gamma_angles: [0, 45, 90],
                        candela: [[1200, 800, 100]],
                    },
                },
            },
        });

        const snapshot = buildDialuxExportSnapshot({
            project: buildProjectFixture(),
            activeSceneId: 'scene-1',
            resultsByRoom: {
                'room-1::ambient-1': buildLightingResultFixture(),
            },
            dxfEntities: null,
            dxfExtents: null,
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
        });
        const documentModel = buildDialuxFormalDocument(snapshot, assets);

        expect(assets.some((asset) => asset.id === 'prod-10-polar')).toBe(true);
        expect(
            documentModel.pages.some((page) => page.kind === 'product-sheet'),
        ).toBe(true);
        expect(documentModel.luminaires[0]?.polarDiagramAssetId).toBe(
            'prod-10-polar',
        );
        expect(
            documentModel.luminaires[0]?.reportData?.technical_table?.[1]
                ?.value,
        ).toBe('100.0 lm/W');

        getSpy.mockRestore();
    });
});
