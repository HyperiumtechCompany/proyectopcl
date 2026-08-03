/**
 * Fase 10 — Validación final e integral.
 *
 * Genera el documento formal completo a partir del fixture MÓDULO I
 * (3 niveles × 24 ambientes, el mismo usado en fases 5-8) con resultados de
 * cálculo reales para cada ambiente (no vacío como en moduloIFixture.test.ts,
 * que solo verifica estructura) y dos productos distintos por ambiente para
 * obtener una ficha de producto "completa" (con reportData/reportAssets
 * enriquecidos, simulando lo que enrichProducts.ts trae del catálogo del
 * servidor) y una "incompleta" (sin ningún dato adicional).
 *
 * Escribe storage/app/dialux-test-payload.json para que
 * scripts/render_dialux_test_pdf.php lo renderice con la misma lógica del
 * controlador real y se pueda inspeccionar visualmente el PDF resultante.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LightingResult } from '@/pages/dialux/hooks/useEditorStore';
import { buildDialuxExportAssets } from './derived/buildDialuxExportAssets';
import { buildDialuxFormalDocument } from './document/buildDialuxFormalDocument';
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

const PNG_1PX_BLUE =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqGeoBwAChAGAVtN0PgAAAABJRU5ErkJggg==';

/** Grilla 4x4 alrededor del target, con una falla deliberada para variedad. */
function buildResultForRoom(targetLux: number, shouldFail: boolean): LightingResult {
    const avg = shouldFail ? targetLux * 0.4 : targetLux * 1.05;
    const spread = avg * 0.18;
    const grid_values = Array.from({ length: 16 }, (_, i) => {
        const wave = Math.sin(i * 0.7) * spread;
        return Math.max(1, Math.round(avg + wave));
    });

    return {
        avg_lux: avg,
        min_lux: Math.min(...grid_values),
        max_lux: Math.max(...grid_values),
        uniformity: Math.min(...grid_values) / avg,
        ugr: shouldFail ? 26 : 19,
        grid_rows: 4,
        grid_cols: 4,
        grid_values,
    };
}

describe('Fase 10 — validación final e integral (MÓDULO I completo)', () => {
    it('genera el documento formal completo con resultados reales y lo escribe para inspección PHP/PDF', async () => {
        const project = buildModuloIProjectFixture();

        // Segundo producto distinto en la primera aula, para tener 2 fichas
        // de producto: una "completa" (enriquecida ANTES de construir el
        // documento, igual que enrichProducts.ts lo haría en el navegador
        // real antes de buildDialuxFormalDocument) y otra que se deja tal
        // cual (incompleta), igual que las pruebas Pest de Fase 4.
        const firstScene = project.scenes[0]!;
        const firstRoomId = firstScene.rooms[0]!.id;
        firstScene.fixtures.push({
            id: 'fixture-variant-secondary',
            name: 'Downlight Opal',
            // Dentro del polígono real de "l0-aula-a" (0,0)-(5,0)-(5,4)-(0,4):
            // los fixtures se asignan a ambientes por contención geométrica
            // (pointInPolygon), no por el campo roomId — una coordenada fuera
            // del polígono queda huérfana (no aparece en ninguna lista por
            // ambiente/nivel, aunque sí en la lista global del proyecto).
            x: 4,
            y: 3,
            z: 2.6,
            lumens: 2014,
            efficiency: 0.959,
            fixtureType: 'panel',
            fixtureShape: 'round',
            lightColor: '#fff5e1',
            roomId: `${firstRoomId}::ambient-1`,
            brand: 'Regiolux',
            articleNumber: 'DALL-21W',
            power: 21,
            reportData: {
                technical_table: [
                    { label: 'Producto', value: 'Downlight Opal' },
                    { label: 'Flujo luminoso', value: '2014 lm' },
                    { label: 'Potencia', value: '21 W' },
                    { label: 'Rendimiento', value: '95.9 lm/W' },
                ],
                warnings: [],
            },
            ugrTable: [
                [19, 20, 21],
                [18, 19, 20],
            ],
            polarDiagramAssetId: 'prod-downlight-polar',
            brandLogoAssetId: 'prod-downlight-logo',
            productPhotoAssetId: 'prod-downlight-photo',
        });

        // Resultados de cálculo reales para los 24 ambientes: 1 falla
        // deliberada (último SS.HH. varones del último nivel) para tener un
        // ejemplo de "no cumple" además de los que cumplen.
        const resultsByRoom: Record<string, LightingResult> = {};
        for (const scene of project.scenes) {
            for (const room of scene.rooms) {
                const isLastFailingCase =
                    scene.floorIndex === MODULO_I_EXPECTED_LEVEL_COUNT - 1 &&
                    room.id.endsWith('sshh-varones');
                resultsByRoom[`${room.id}::ambient-1`] = buildResultForRoom(
                    room.illuminanceLux ?? 300,
                    isLastFailingCase,
                );
            }
        }

        const snapshot = buildDialuxExportSnapshot({
            project,
            activeSceneId: project.scenes[0]!.id,
            includeAllScenes: true,
            resultsByRoom,
            dxfEntities: null,
            dxfExtents: { min_x: -5, min_y: -5, max_x: 25, max_y: 15 },
            visualConfig: VISUAL_CONFIG,
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

        // Assets de catálogo que enrichProducts.ts habría agregado en el
        // navegador real (logo/foto/diagrama polar del producto enriquecido).
        assets.push(
            {
                id: 'prod-downlight-polar',
                title: 'Diagrama polar - Downlight Opal',
                purpose: 'ambient-catalog',
                kind: 'vector',
                mimeType: 'image/svg+xml',
                svg: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><circle cx="100" cy="100" r="80" fill="none" stroke="#0f172a" stroke-width="2"/><text x="60" y="105" font-size="14">CDL polar</text></svg>',
                width: 200,
                height: 200,
            },
            {
                id: 'prod-downlight-logo',
                title: 'Logo de marca - Regiolux',
                purpose: 'ambient-catalog',
                kind: 'bitmap',
                mimeType: 'image/png',
                dataUrl: PNG_1PX_BLUE,
                width: 1,
                height: 1,
            },
            {
                id: 'prod-downlight-photo',
                title: 'Foto de producto - Downlight Opal',
                purpose: 'ambient-catalog',
                kind: 'bitmap',
                mimeType: 'image/png',
                dataUrl: PNG_1PX_BLUE,
                width: 1,
                height: 1,
            },
        );

        const documentModel = buildDialuxFormalDocument(snapshot, assets);

        expect(documentModel.ambientDetails).toHaveLength(
            MODULO_I_EXPECTED_AMBIENT_COUNT,
        );
        expect(documentModel.levels).toHaveLength(MODULO_I_EXPECTED_LEVEL_COUNT);

        // Conservación de sumas (riesgo 3 del plan maestro): el total de
        // luminarias del NIVEL 1 (donde vive el downlight adicional) debe
        // incluir ambos productos, no solo el panel repetido en las otras
        // 7 aulas del mismo nivel.
        const level1 = documentModel.levels.find((l) => l.floorIndex === 0)!;
        expect(level1.luminaires.map((l) => l.articleNumber).sort()).toEqual(
            ['DALL-21W', 'PANEL-40W'].sort(),
        );
        expect(level1.luminaireTotals.totalLumens).toBeCloseTo(
            8 * 4000 + 2014,
            0,
        );

        // Al menos un ambiente con isolux real (resultsByRoom no vacío) y
        // al menos uno sin cumplimiento (la falla deliberada).
        const withIsolux = documentModel.ambientDetails.filter(
            (detail) => detail.isoluxAssetId,
        );
        expect(withIsolux.length).toBeGreaterThan(0);
        const withFailure = documentModel.ambientDetails.some((detail) =>
            (detail.requirementEvaluations ?? []).some(
                (evaluation) => evaluation.status === 'fail',
            ),
        );
        expect(withFailure).toBe(true);

        // El producto Downlight Opal ya llegó enriquecido (reportData/ugrTable/
        // *AssetId asignados en la fixture, antes de construir el documento),
        // así que buildDialuxFormalDocument ya generó su página product-sheet
        // con los assetIds correctos (ver línea ~746 de buildDialuxFormalDocument.ts,
        // que lee lum.polarDiagramAssetId al construir el seed). El producto
        // Panel LED 60x60 se dejó tal cual: sin ningún dato adicional
        // ("incompleta"), igual que las pruebas Pest de Fase 4.
        const enrichedLuminaire = documentModel.luminaires.find(
            (l) => l.articleNumber === 'DALL-21W',
        );
        expect(enrichedLuminaire).toBeDefined();
        expect(enrichedLuminaire?.polarDiagramAssetId).toBe('prod-downlight-polar');

        const enrichedProductSheetPage = documentModel.pages.find(
            (page) =>
                page.kind === 'product-sheet' &&
                page.id === `page-product-sheet-${enrichedLuminaire?.id}`,
        );
        expect(enrichedProductSheetPage?.assetIds).toContain(
            'prod-downlight-polar',
        );

        const productSheetPages = documentModel.pages.filter(
            (page) => page.kind === 'product-sheet',
        );
        expect(productSheetPages.length).toBeGreaterThanOrEqual(2);

        const outPath = resolve(
            __dirname,
            '../../../../../storage/app/dialux-test-payload.json',
        );
        mkdirSync(dirname(outPath), { recursive: true });
        writeFileSync(outPath, JSON.stringify({ document: documentModel }));

        // eslint-disable-next-line no-console
        console.log(
            'Fase 10 payload:',
            documentModel.pages.length,
            'páginas,',
            documentModel.assets.length,
            'assets. Kinds:',
            [...new Set(documentModel.pages.map((p) => p.kind))].join(', '),
        );
    });
});
