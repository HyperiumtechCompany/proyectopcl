import { describe, expect, it } from 'vitest';
import type { LightingResult } from '@/pages/dialux/hooks/useEditorStore';
import { buildDialuxExportAssets } from './derived/buildDialuxExportAssets';
import { buildDialuxFormalDocument } from './document/buildDialuxFormalDocument';
import { DIALUX_FORMAL_DOCUMENT_SCHEMA_VERSION } from './domain/types';
import {
    MODULO_I_EXPECTED_AMBIENT_COUNT,
    MODULO_I_EXPECTED_LEVEL_COUNT,
    buildModuloIProjectFixture,
} from './__fixtures__/moduloIFixture';
import { buildDialuxExportSnapshot } from './snapshot/buildDialuxExportSnapshot';

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

describe('MÓDULO I fixture (3 niveles × 24 ambientes)', () => {
    it('builds a snapshot covering every level and ambient', () => {
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

        expect(project.scenes).toHaveLength(MODULO_I_EXPECTED_LEVEL_COUNT);
        expect(snapshot.ambients).toHaveLength(
            MODULO_I_EXPECTED_AMBIENT_COUNT,
        );
        expect(snapshot.summary.calculatedAmbientCount).toBe(
            MODULO_I_EXPECTED_AMBIENT_COUNT,
        );
    });

    it('builds a formal document with schemaVersion and a stable, non-empty TOC', async () => {
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
        const assets = await buildDialuxExportAssets(snapshot, {
            includeViewerCapture: false,
        });
        const documentModel = buildDialuxFormalDocument(snapshot, assets);

        expect(documentModel.schemaVersion).toBe(
            DIALUX_FORMAL_DOCUMENT_SCHEMA_VERSION,
        );
        expect(documentModel.ambientDetails).toHaveLength(
            MODULO_I_EXPECTED_AMBIENT_COUNT,
        );
        expect(documentModel.toc.length).toBeGreaterThan(0);

        const tocPageCount = documentModel.pages.filter(
            (page) => page.kind === 'toc',
        ).length;
        const tocEntriesForPages = documentModel.toc.filter(
            (entry) => entry.kind !== 'section-label',
        );
        expect(tocPageCount).toBeGreaterThan(0);
        expect(tocEntriesForPages.length).toBeGreaterThan(0);

        // Cada entrada "item" del índice (no los rótulos/encabezados de grupo,
        // que se listan sin número propio) debe apuntar a una página real.
        const maxPageNumber = Math.max(
            ...documentModel.pages.map((page) => page.pageNumber),
        );
        const itemEntries = documentModel.toc.filter(
            (entry) => (entry.kind ?? 'item') === 'item',
        );
        expect(itemEntries.length).toBeGreaterThan(0);
        for (const entry of itemEntries) {
            expect(entry.pageNumber).toBeGreaterThan(0);
            expect(entry.pageNumber).toBeLessThanOrEqual(maxPageNumber);
        }
    });

    it('every ambient carries requirement evaluations with provenance instead of a bare boolean', () => {
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

        for (const ambient of snapshot.ambients) {
            // Fase 16: ya no son siempre 3 — una actividad que no regula
            // UGR/Uo (ej. estacionamientos, baños) omite esa fila en vez de
            // compararla contra un límite genérico inventado. Iluminancia
            // sí se evalúa siempre.
            expect(ambient.metrics.requirementEvaluations.length).toBeGreaterThanOrEqual(1);
            expect(ambient.metrics.requirementEvaluations.length).toBeLessThanOrEqual(3);
            expect(ambient.metrics.requirementEvaluations.map((e) => e.metric)).toContain('illuminance');
            expect(ambient.metrics.provenance.status).toBe('calculated');
            expect(ambient.metrics.provenance.engine).toBeTruthy();

            for (const evaluation of ambient.metrics.requirementEvaluations) {
                expect(['pass', 'fail']).toContain(evaluation.status);
                // El fixture asigna normativeLabel por ambiente; la evaluación debe
                // trazar de dónde viene el requisito, no solo su valor numérico.
                expect(evaluation.source).toBeTruthy();
            }
        }
    });
});

describe('per-level luminaire totals (adaptable a N niveles)', () => {
    it('builds one level summary per scene, ordered by floorIndex, for a 3-level project', async () => {
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
        const assets = await buildDialuxExportAssets(snapshot, {
            includeViewerCapture: false,
        });
        const documentModel = buildDialuxFormalDocument(snapshot, assets);

        expect(documentModel.levels).toHaveLength(MODULO_I_EXPECTED_LEVEL_COUNT);
        expect(documentModel.levels.map((level) => level.floorIndex)).toEqual([
            0, 1, 2,
        ]);

        for (const level of documentModel.levels) {
            expect(level.ambientCount).toBe(8);
            expect(level.luminaires.length).toBeGreaterThan(0);
            expect(level.luminaireTotals.totalLumens).toBeGreaterThan(0);
        }

        // Conservación de sumas (riesgo 3 del plan maestro): la suma de los
        // totales de nivel debe coincidir con el total de proyecto.
        const sumOfLevelLumens = documentModel.levels.reduce(
            (sum, level) => sum + level.luminaireTotals.totalLumens,
            0,
        );
        const sumOfLevelPower = documentModel.levels.reduce(
            (sum, level) => sum + level.luminaireTotals.totalPowerWatts,
            0,
        );
        expect(sumOfLevelLumens).toBeCloseTo(
            documentModel.luminaireTotals.totalLumens,
            0,
        );
        expect(sumOfLevelPower).toBeCloseTo(
            documentModel.luminaireTotals.totalPowerWatts,
            1,
        );

        // Una página "level-luminaire-list" por nivel, con su sceneId propio.
        const levelPages = documentModel.pages.filter(
            (page) => page.kind === 'level-luminaire-list',
        );
        expect(levelPages).toHaveLength(MODULO_I_EXPECTED_LEVEL_COUNT);
        expect(new Set(levelPages.map((page) => page.sceneId)).size).toBe(
            MODULO_I_EXPECTED_LEVEL_COUNT,
        );
    });

    it('still works with a single level (N=1), matching today’s planta-baja-only project', async () => {
        const project = buildModuloIProjectFixture();

        // includeAllScenes por defecto es false: solo la escena activa (nivel 1).
        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: project.scenes[0]!.id,
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: VISUAL_CONFIG,
        });
        const assets = await buildDialuxExportAssets(snapshot, {
            includeViewerCapture: false,
        });
        const documentModel = buildDialuxFormalDocument(snapshot, assets);

        expect(documentModel.levels).toHaveLength(1);
        expect(documentModel.levels[0]?.ambientCount).toBe(8);
        expect(documentModel.levels[0]?.luminaireTotals.totalLumens).toBe(
            documentModel.luminaireTotals.totalLumens,
        );
        expect(
            documentModel.pages.filter(
                (page) => page.kind === 'level-luminaire-list',
            ),
        ).toHaveLength(1);
    });
});

describe('requirement evaluations status derivation', () => {
    function buildSnapshotWithResult(result: LightingResult) {
        const project = buildModuloIProjectFixture();
        const firstRoom = project.scenes[0]!.rooms[0]!;

        return buildDialuxExportSnapshot({
            project,
            activeSceneId: project.scenes[0]!.id,
            resultsByRoom: { [`${firstRoom.id}::ambient-1`]: result },
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: VISUAL_CONFIG,
        });
    }

    it('marks a metric as fail when the calculated value misses the requirement', () => {
        const belowTarget: LightingResult = {
            avg_lux: 10,
            min_lux: 5,
            max_lux: 15,
            uniformity: 0.1,
            ugr: 30,
            grid_rows: 1,
            grid_cols: 1,
            grid_values: [10],
        };

        const snapshot = buildSnapshotWithResult(belowTarget);
        const failingAmbient = snapshot.ambients[0]!;

        expect(failingAmbient.metrics.complies).toBe(false);
        expect(
            failingAmbient.metrics.requirementEvaluations.every(
                (evaluation) => evaluation.status === 'fail',
            ),
        ).toBe(true);
    });

    it('marks every metric as pass when the calculated value satisfies the requirement', () => {
        const aboveTarget: LightingResult = {
            avg_lux: 900,
            min_lux: 700,
            max_lux: 950,
            uniformity: 0.9,
            ugr: 15,
            grid_rows: 1,
            grid_cols: 1,
            grid_values: [900],
        };

        const snapshot = buildSnapshotWithResult(aboveTarget);
        const passingAmbient = snapshot.ambients[0]!;

        expect(passingAmbient.metrics.complies).toBe(true);
        expect(
            passingAmbient.metrics.requirementEvaluations.every(
                (evaluation) => evaluation.status === 'pass',
            ),
        ).toBe(true);
    });

    it('marks every metric as pass when the calculated value lands exactly on the normative boundary', () => {
        // Aula 1° Primaria del fixture pide 500 lx; uniformityTarget/ugrLimit
        // caen a los defaults de buildAmbientMetrics (0.4 y 22) porque el
        // fixture no los define por ambiente. Los operadores son >= y <=,
        // así que un valor calculado IGUAL al requisito debe dar 'pass'.
        const exactBoundary: LightingResult = {
            avg_lux: 500,
            min_lux: 200,
            max_lux: 500,
            uniformity: 0.4,
            ugr: 22,
            grid_rows: 1,
            grid_cols: 1,
            grid_values: [500],
        };

        const snapshot = buildSnapshotWithResult(exactBoundary);
        const boundaryAmbient = snapshot.ambients[0]!;

        expect(boundaryAmbient.metrics.complies).toBe(true);
        expect(
            boundaryAmbient.metrics.requirementEvaluations.every(
                (evaluation) => evaluation.status === 'pass',
            ),
        ).toBe(true);
    });
});

describe('product deduplication edge cases', () => {
    it('does not merge distinct products that share the same display name but differ in article number', () => {
        const project = buildModuloIProjectFixture();
        const scene = project.scenes[0]!;
        const firstRoomId = scene.rooms[0]!.id;

        // Mismo nombre visible, mismo fabricante, pero número de artículo
        // distinto y sin productId: deben quedar como 2 filas separadas.
        scene.fixtures = [
            {
                id: 'fixture-variant-a',
                name: 'Panel LED 60x60',
                x: 1,
                y: 1,
                z: 2.6,
                lumens: 4000,
                efficiency: 0.8,
                fixtureType: 'panel',
                fixtureShape: 'rectangular',
                lightColor: '#fff5e1',
                roomId: `${firstRoomId}::ambient-1`,
                brand: 'PCL Iluminación',
                articleNumber: 'PANEL-40W-4000K',
                power: 40,
            },
            {
                id: 'fixture-variant-b',
                name: 'Panel LED 60x60',
                x: 2,
                y: 1,
                z: 2.6,
                lumens: 3600,
                efficiency: 0.8,
                fixtureType: 'panel',
                fixtureShape: 'rectangular',
                lightColor: '#fff5e1',
                roomId: `${firstRoomId}::ambient-1`,
                brand: 'PCL Iluminación',
                articleNumber: 'PANEL-40W-3000K',
                power: 40,
            },
        ];

        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: scene.id,
            resultsByRoom: {},
            dxfEntities: null,
            dxfExtents: null,
            visualConfig: VISUAL_CONFIG,
        });
        const documentModel = buildDialuxFormalDocument(snapshot, []);

        const variantEntries = documentModel.luminaires.filter(
            (luminaire) => luminaire.name === 'Panel LED 60x60',
        );
        expect(variantEntries).toHaveLength(2);
        expect(variantEntries.every((entry) => entry.quantity === 1)).toBe(
            true,
        );
    });
});
