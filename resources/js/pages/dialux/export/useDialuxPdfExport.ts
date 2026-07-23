import axios from 'axios';
import { useCallback, useState } from 'react';
import Swal from 'sweetalert2';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import { fitCadViewToDrawing } from '@/pages/dialux/hooks/useMlightcadEngine';
import * as dialuxRoutes from '@/routes/dialux';
import { capture3DViewerBitmap } from './assets/capture3DViewerBitmap';
import { captureCadBaseBitmap } from './assets/captureCadBaseBitmap';
import { captureCompositeViewerBitmap } from './assets/captureCompositeViewerBitmap';
import { buildDialuxExportAssets } from './derived/buildDialuxExportAssets';
import { buildDialuxFormalDocument } from './document/buildDialuxFormalDocument';
import type { DialuxBitmapAsset, DialuxFormalDocument } from './domain/types';
import { buildDialuxExportSnapshot } from './snapshot/buildDialuxExportSnapshot';

export interface UseDialuxPdfExportResult {
    exportPdf: (targetWindow?: Window | null) => Promise<void>;
    isExporting: boolean;
    exportStep: string;
    lastError: string | null;
}

/**
 * Returns a promise that resolves after two animation frames.
 *
 * Two RAFs guarantee that:
 *   1. The first RAF fires at the START of the next paint cycle.
 *   2. The second RAF fires AFTER that cycle completes (i.e., the canvas has been
 *      fully painted and gl.readPixels() / toDataURL() can see the rendered pixels).
 */
function waitForTwoFrames(): Promise<void> {
    return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
}

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

async function prepareCadCanvasForCapture(
    wasShowing3D: boolean,
): Promise<void> {
    if (wasShowing3D) {
        useEditorStore.getState().toggle3DView();
    }

    await waitForTwoFrames();
    window.dispatchEvent(new Event('resize'));
    await wait(120);
    await waitForTwoFrames();
}

interface CapturedViewerBitmaps {
    viewer3D: DialuxBitmapAsset | null;
    cadBase: DialuxBitmapAsset | null;
    drawnComposite: DialuxBitmapAsset | null;
    isoluxComposite: DialuxBitmapAsset | null;
}

/**
 * Orquesta todas las capturas del editor en el orden correcto:
 *   1. Vista 3D (portada) — se activa temporalmente si estaba apagada.
 *   2. Vista 2D encuadrada con fitToView: canvas CAD solo (plano base),
 *      compuesto CAD+dibujo (sin isolux) y compuesto CAD+dibujo+isolux.
 * Restaura el estado de isolux al terminar; la vista 3D la restaura el caller.
 */
async function captureEditorBitmaps(): Promise<CapturedViewerBitmaps> {
    const result: CapturedViewerBitmaps = {
        viewer3D: null,
        cadBase: null,
        drawnComposite: null,
        isoluxComposite: null,
    };
    const store = useEditorStore;

    // ── 1. Captura 3D para la portada ────────────────────────────────────
    // El canvas de Babylon tarda en montar y la primera escena en renderizar;
    // se espera activamente a que exista con tamaño real y se reintenta la
    // captura hasta obtener una imagen con contenido (no en blanco).
    try {
        if (!store.getState().ui.show3DView) {
            store.getState().toggle3DView();
        }

        const deadline = Date.now() + 8000;
        while (Date.now() < deadline) {
            await waitForTwoFrames();
            const canvas = document.getElementById(
                'babylon-3d-canvas',
            ) as HTMLCanvasElement | null;
            if (canvas && canvas.width > 32 && canvas.height > 32) {
                result.viewer3D = await capture3DViewerBitmap({
                    purpose: 'formal-cover',
                });
                if (result.viewer3D) {
                    break; // captura válida (con contenido)
                }
            }
            await wait(350);
        }

        if (!result.viewer3D) {
            console.warn(
                '[DIAlux] La captura 3D no produjo contenido tras varios intentos; la portada usará el gráfico vectorial.',
            );
        }
    } catch (error) {
        console.warn('[DIAlux] Falló la captura 3D de portada:', error);
    }

    // ── 2. Conmutar a 2D y encuadrar el plano completo ───────────────────
    if (store.getState().ui.show3DView) {
        store.getState().toggle3DView();
    }
    await prepareCadCanvasForCapture(false);
    if (fitCadViewToDrawing()) {
        await wait(300); // esperar el redibujado del motor CAD tras el zoom
        await waitForTwoFrames();
    }

    const wasShowingIsolux = store.getState().ui.showIsolux;

    try {
        // 2a. Sin isolux: plano base + plano con dibujo
        if (store.getState().ui.showIsolux) {
            store.getState().toggleIsolux();
            await waitForTwoFrames();
        }

        try {
            result.cadBase = await captureCadBaseBitmap();
        } catch (error) {
            console.warn('[DIAlux] Falló la captura del CAD base:', error);
        }

        try {
            result.drawnComposite = await captureCompositeViewerBitmap({
                id: 'composite-plan-bitmap',
                title: 'Plano con recintos y luminarias',
                purpose: 'drawn-terrain',
            });
        } catch (error) {
            console.warn(
                '[DIAlux] Falló la captura compuesta del plano:',
                error,
            );
        }

        // 2b. Con isolux: plano con curvas/ondas superpuestas
        store.getState().toggleIsolux();
        await waitForTwoFrames();
        await wait(200);
        await waitForTwoFrames();

        try {
            result.isoluxComposite = await captureCompositeViewerBitmap({
                id: 'composite-isolux-bitmap',
                title: 'Plano con isolux',
                purpose: 'isolux',
            });
        } catch (error) {
            console.warn(
                '[DIAlux] Falló la captura compuesta con isolux:',
                error,
            );
        }
    } finally {
        // Restaurar el estado original del isolux
        if (store.getState().ui.showIsolux !== wasShowingIsolux) {
            store.getState().toggleIsolux();
        }
    }

    return result;
}

function pruneUnusedAssets(
    document: DialuxFormalDocument,
): DialuxFormalDocument {
    const referencedAssetIds = new Set<string>();

    for (const page of document.pages) {
        for (const assetId of page.assetIds) {
            referencedAssetIds.add(assetId);
        }
    }

    for (const ambient of document.ambientDetails) {
        if (ambient.planAssetId) {
            referencedAssetIds.add(ambient.planAssetId);
        }
        if (ambient.isoluxAssetId) {
            referencedAssetIds.add(ambient.isoluxAssetId);
        }
        for (const luminaire of ambient.luminaires) {
            [
                luminaire.polarDiagramAssetId,
                luminaire.productPhotoAssetId,
                luminaire.brandLogoAssetId,
                luminaire.lineDrawingAssetId,
            ].forEach((assetId) => {
                if (assetId) {
                    referencedAssetIds.add(assetId);
                }
            });
        }
    }

    for (const luminaire of document.luminaires) {
        [
            luminaire.polarDiagramAssetId,
            luminaire.productPhotoAssetId,
            luminaire.brandLogoAssetId,
            luminaire.lineDrawingAssetId,
        ].forEach((assetId) => {
            if (assetId) {
                referencedAssetIds.add(assetId);
            }
        });
    }

    return {
        ...document,
        assets: document.assets.filter((asset) =>
            referencedAssetIds.has(asset.id),
        ),
    };
}

export function useDialuxPdfExport(): UseDialuxPdfExportResult {
    const [isExporting, setIsExporting] = useState(false);
    const [exportStep, setExportStep] = useState('');
    const [lastError, setLastError] = useState<string | null>(null);

    const exportPdf = useCallback(async (_targetWindow?: Window | null) => {
        if (typeof window === 'undefined') {
            return;
        }

        const state = useEditorStore.getState();
        if (!state.project || !state.activeSceneId) {
            throw new Error(
                'No hay un proyecto o una escena activa para exportar.',
            );
        }
        const project = state.project;
        const activeSceneId = state.activeSceneId;

        setIsExporting(true);
        setLastError(null);

        const wasShowing3D = state.ui.show3DView;

        const updateSwalProgress = (stepText: string, percent: number) => {
            setExportStep(stepText);
            Swal.update({
                html: `
                    <div style="margin-bottom: 10px; font-size: 14px; color: #475569;">${stepText}</div>
                    <div style="width: 100%; background-color: #e2e8f0; border-radius: 99px; overflow: hidden; height: 12px; border: 1px solid #cbd5e1;">
                        <div style="width: ${percent}%; height: 100%; background-color: #0d9488; transition: width 0.4s ease;"></div>
                    </div>
                    <div style="margin-top: 5px; font-size: 12px; color: #64748b; font-weight: bold;">${percent}%</div>
                `,
            });
        };

        Swal.fire({
            title: 'Generando Reporte',
            html: `
                <div style="margin-bottom: 10px; font-size: 14px; color: #475569;">Iniciando exportación...</div>
                <div style="width: 100%; background-color: #e2e8f0; border-radius: 99px; overflow: hidden; height: 12px; border: 1px solid #cbd5e1;">
                    <div style="width: 2%; height: 100%; background-color: #0d9488; transition: width 0.4s ease;"></div>
                </div>
                <div style="margin-top: 5px; font-size: 12px; color: #64748b; font-weight: bold;">2%</div>
            `,
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            },
        });

        try {
            // ── Step 1: Prepare project data
            updateSwalProgress('Preparando datos del proyecto...', 20);
            const exportState = useEditorStore.getState();
            const exportProject = exportState.project ?? project;
            const exportActiveSceneId =
                exportState.activeSceneId ?? activeSceneId;
            const snapshot = buildDialuxExportSnapshot({
                project: exportProject,
                activeSceneId: exportActiveSceneId,
                includeAllScenes: true,
                resultsByRoom: exportState.resultsByRoom,
                dxfEntities: exportState.dxfEntities,
                dxfExtents: exportState.dxfExtents,
                visualConfig: {
                    showGrid: exportState.ui.showGrid,
                    showIsolux: exportState.ui.showIsolux,
                    show3DView: exportState.ui.show3DView,
                    isoluxMode: exportState.ui.isoluxMode,
                    zoom: exportState.ui.zoom,
                    panX: exportState.ui.panX,
                    panY: exportState.ui.panY,
                    selectedId: exportState.ui.selectedId,
                },
            });

            // ── Step 2: Capturar el editor — 3D (portada) y 2D (plano solo,
            // plano con dibujo, plano con isolux) directamente del canvas real
            updateSwalProgress(
                'Capturando vista 3D y planos del editor...',
                35,
            );
            const captures = await captureEditorBitmaps();

            // ── Step 3: Build all export assets
            updateSwalProgress(
                'Generando planos y gráficos vectoriales...',
                45,
            );
            const assets = await buildDialuxExportAssets(snapshot, {
                includeViewerCapture: false,
                preCapturedViewerBitmap: captures.viewer3D,
                preCapturedCadBitmap: captures.cadBase,
                preCapturedDrawnBitmap: captures.drawnComposite,
                preCapturedIsoluxBitmap: captures.isoluxComposite,
            });

            // ── Step 4: Compose the formal document
            updateSwalProgress('Componiendo documento formal...', 70);
            const formalDocument = pruneUnusedAssets(
                buildDialuxFormalDocument(snapshot, assets),
            );

            // ── Step 5: Send to server and download PDF
            updateSwalProgress(
                'Generando PDF en servidor (puede tardar un momento)...',
                90,
            );
            const response = await axios.post(
                dialuxRoutes.formalExport.url(),
                {
                    document: formalDocument,
                    dialux_project_id: exportProject.id,
                },
                { responseType: 'blob' },
            );
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const objectUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            const headerValue = response.headers['content-disposition'];
            const matchedFileName =
                typeof headerValue === 'string'
                    ? /filename="?([^"]+)"?/i.exec(headerValue)?.[1]
                    : null;

            link.href = objectUrl;
            link.download =
                matchedFileName ?? `${formalDocument.fileBaseName}.pdf`;

            updateSwalProgress('¡Completado! Descargando archivo...', 100);
            setTimeout(() => {
                link.click();
                window.URL.revokeObjectURL(objectUrl);
                Swal.close();
            }, 800);
        } catch (error) {
            // When responseType is 'blob', Laravel 422 validation errors arrive
            // as a Blob — we decode it so we can surface the real messages.
            const axiosLike = error as {
                response?: { data?: unknown; status?: number };
            };

            if (axiosLike?.response?.data instanceof Blob) {
                try {
                    const text = await (axiosLike.response.data as Blob).text();
                    const parsed = JSON.parse(text) as Record<string, unknown>;
                    console.error(
                        '[DIAlux PDF Export] Backend validation errors:',
                        parsed,
                    );
                    const validationErrors = parsed['errors'];
                    if (
                        validationErrors &&
                        typeof validationErrors === 'object'
                    ) {
                        const firstMessages = (
                            Object.values(validationErrors) as string[][]
                        )
                            .flat()
                            .slice(0, 4)
                            .join(' | ');
                        const userMessage = `Exportación rechazada por el servidor (${axiosLike.response.status}): ${firstMessages}`;
                        setLastError(userMessage);
                        throw new Error(userMessage);
                    }
                } catch (parseError) {
                    if (
                        parseError instanceof Error &&
                        parseError.message.startsWith('Exportación')
                    ) {
                        throw parseError;
                    }
                    console.warn(
                        '[DIAlux PDF Export] No se pudo decodificar el error blob',
                        parseError,
                    );
                }
            }

            const message =
                error instanceof Error
                    ? error.message
                    : 'No se pudo exportar el PDF.';
            setLastError(message);

            Swal.fire({
                icon: 'error',
                title: 'Error de Exportación',
                text: message,
                confirmButtonColor: '#0d9488',
                confirmButtonText: 'Entendido',
            });

            throw error;
        } finally {
            if (wasShowing3D && !useEditorStore.getState().ui.show3DView) {
                useEditorStore.getState().toggle3DView();
                await waitForTwoFrames();
            }
            setIsExporting(false);
            setExportStep('');
        }
    }, []);

    return {
        exportPdf,
        isExporting,
        exportStep,
        lastError,
    };
}
