import axios from 'axios';
import { useCallback, useState } from 'react';
import { useEditorStore } from '@/hooks/dialux/useEditorStore';
import * as dialuxRoutes from '@/routes/dialux';
import { captureCadBaseBitmap } from './assets/captureCadBaseBitmap';
import { buildDialuxExportAssets } from './derived/buildDialuxExportAssets';
import { buildDialuxFormalDocument } from './document/buildDialuxFormalDocument';
import type { DialuxFormalDocument } from './domain/types';
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

        try {
            // ── Step 1: Pre-capture the CAD canvas WITHIN an animation frame
            // This is the ONLY window in which gl.readPixels() can see the
            // rendered WebGL frame, even without preserveDrawingBuffer: true.
            setExportStep('Capturando plano CAD...');
            let preCapturedCadBitmap: Awaited<
                ReturnType<typeof captureCadBaseBitmap>
            > = null;
            await prepareCadCanvasForCapture(wasShowing3D);
            preCapturedCadBitmap = await captureCadBaseBitmap(
                '#cad-engine-container',
                900,
                585,
            );

            // ── Step 2: Build the export snapshot from application state
            setExportStep('Preparando datos del proyecto...');
            const exportState = useEditorStore.getState();
            const exportProject = exportState.project ?? project;
            const exportActiveSceneId =
                exportState.activeSceneId ?? activeSceneId;
            const snapshot = buildDialuxExportSnapshot({
                project: exportProject,
                activeSceneId: exportActiveSceneId,
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

            // ── Step 3: Build all export assets (pass pre-captured CAD bitmap)
            setExportStep('Generando planos y gráficos...');
            const assets = await buildDialuxExportAssets(snapshot, {
                includeViewerCapture: true,
                preCapturedCadBitmap,
            });

            // ── Step 4: Compose the formal document
            setExportStep('Componiendo documento formal...');
            const formalDocument = pruneUnusedAssets(
                buildDialuxFormalDocument(snapshot, assets),
            );

            // ── Step 5: Send to server and download PDF
            setExportStep('Generando PDF en servidor...');
            const response = await axios.post(
                dialuxRoutes.formalExport.url(),
                { document: formalDocument },
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
            link.click();
            window.URL.revokeObjectURL(objectUrl);
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
