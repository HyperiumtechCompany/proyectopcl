/**
 * useMlightcadEngine.ts â€” Hook singleton para el motor mlightcad
 *
 * PatrÃ³n de diseÃ±o:
 *   - Instancia del motor a nivel mÃ³dulo (singleton) para persistir entre
 *     re-renders y entre montaje/desmontaje de componentes.
 *   - `initViewer` es idempotente: solo inicializa una vez por contenedor.
 *   - Eventos del motor conectados una sola vez (flag `_eventListenersAttached`).
 *   - Log condicional via `cadLog` â€” silenciado en producciÃ³n.
 */

import { AcApDocManager, AcEdOpenMode } from '@mlightcad/cad-simple-viewer';
import type { AcApDocument } from '@mlightcad/cad-simple-viewer';
import { AcDbOsnapMode } from '@mlightcad/data-model';
import { useCallback, useEffect } from 'react';
import { create } from 'zustand';
import { ensureWritableBlankDocument } from './mlightcadDocument';

// â”€â”€â”€ Logger condicional â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const isDev = import.meta.env.DEV;
const cadLog = isDev ? console.log.bind(console, '[mlightcad]') : () => {};
const cadWarn = isDev ? console.warn.bind(console, '[mlightcad]') : () => {};
const cadErr = console.error.bind(console, '[mlightcad]');

// â”€â”€â”€ ConfiguraciÃ³n de workers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const WORKER_URLS = {
    dxfParser: '/cad-workers/libredwg-parser-worker.js',
    dwgParser: '/cad-workers/libredwg-parser-worker.js',
    mtextRender: '/cad-workers/mtext-renderer-worker.js',
};

// DXF R2000 mínimo válido: pasa el parser de mlightcad sin errores de worker.
// Usar openDocument con este buffer evita el hack de _context y cierra
// correctamente el canal de mensajes con los workers.
const BLANK_DXF_CONTENT = [
    '0', 'SECTION', '2', 'HEADER',
    '9', '$ACADVER', '1', 'AC1015',
    '9', '$INSUNITS', '70', '4',
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'TABLES',
    '0', 'TABLE', '2', 'LTYPE', '70', '1',
    '0', 'LTYPE', '2', 'CONTINUOUS', '70', '0', '3', 'Solid line', '72', '65', '73', '0', '40', '0.0',
    '0', 'ENDTAB',
    '0', 'TABLE', '2', 'LAYER', '70', '1',
    '0', 'LAYER', '2', '0', '70', '0', '62', '7', '6', 'CONTINUOUS',
    '0', 'ENDTAB',
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
    '0', 'ENDSEC',
    '0', 'EOF',
].join('\n') + '\n';

// â”€â”€â”€ Estado a nivel mÃ³dulo (singleton) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let _docManager: AcApDocManager | null = null;
let _container: HTMLElement | null = null;
let _initialized: boolean = false;
let _eventListenersAttached: boolean = false;

interface ViewApi {
    setViewOrigin?: (point: { x: number; y: number }) => void;
    setCenter?: (point: { x: number; y: number }) => void;
    center?: { x: number; y: number };
    zoom?: number;
    internalCamera?: { zoom?: number };
    screenToWorld?: (point: { x: number; y: number }) => { x: number; y: number };
    worldToScreen?: (point: { x: number; y: number }) => { x: number; y: number };
    flyTo?: (point: { x: number; y: number }, scale?: number) => void;
    zoomToFitDrawing?: (timeout?: number) => void;
    pick?: (
        point?: { x: number; y: number },
        hitRadius?: number,
        pickOneOnly?: boolean,
    ) => Array<{ id: string; children?: Array<{ id: string }> }>;
}

interface ExtentsDatabase {
    getExtents?: () => {
        minPt?: { x: number; y: number };
        maxPt?: { x: number; y: number };
    };
    header?: {
        extMin?: { x?: number; y?: number };
        extMax?: { x?: number; y?: number };
    };
}

interface ModelSpaceApi {
    getIdAt?: (id: string) =>
        | {
              subGetOsnapPoints?: (
                  mode: AcDbOsnapMode,
                  pickPoint: { x: number; y: number; z: number },
                  lastPoint: { x: number; y: number; z: number },
                  snapPoints: Array<{
                      x: number;
                      y: number;
                      z?: number;
                      type?: AcDbOsnapMode;
                  }>,
                  gsMark?: string,
              ) => void;
          }
        | undefined;
}

/**
 * Ajusta la vista del motor CAD a la extensión del dibujo desde fuera de React.
 * Lo usa el exportador PDF para encuadrar el plano completo antes de capturar
 * el canvas. Retorna false si el motor o el documento no están disponibles.
 */
export function fitCadViewToDrawing(): boolean {
    const view = _docManager?.curView as unknown as ViewApi | null;
    if (view && typeof view.zoomToFitDrawing === 'function') {
        try {
            view.zoomToFitDrawing();
            return true;
        } catch {
            return false;
        }
    }
    return false;
}

/** Obtiene o crea la instancia Ãºnica del AcApDocManager */
function getOrCreateDocManager(container?: HTMLElement): AcApDocManager {
    if (!_docManager) {
        cadLog('Creating new instance, container:', container?.id);
        _docManager = AcApDocManager.createInstance({
            webworkerFileUrls: WORKER_URLS,
            container,
            autoResize: true,
            useMainThreadDraw: false,
            notLoadDefaultFonts: false,
        }) as AcApDocManager;
    }
    return _docManager;
}

async function bootstrapDocument(dm: AcApDocManager): Promise<void> {
    // Usar openDocument con un DXF mínimo válido para que los workers del motor
    // reciban y respondan correctamente el canal de mensajes. El hack directo de
    // _context dejaba los workers colgados, causando "message channel closed".
    try {
        const encoder = new TextEncoder();
        const buffer = encoder.encode(BLANK_DXF_CONTENT).buffer as ArrayBuffer;
        const ok = await dm.openDocument('nuevo.dxf', buffer, {
            mode: AcEdOpenMode.Write,
        });
        if (ok) {
            cadLog('Blank DXF document ready via openDocument');
            return;
        }
        cadWarn('openDocument returned false, fallback to legacy bootstrap');
    } catch (e) {
        cadWarn('openDocument failed, fallback to legacy bootstrap:', e);
    }

    // Fallback: hack de contexto para motores que no aceptan el buffer DXF
    const doc = ensureWritableBlankDocument(dm);
    if (!doc || doc.openMode < AcEdOpenMode.Write) {
        throw new Error('No se pudo preparar un documento editable en blanco.');
    }
    cadLog('Blank writable document ready (legacy bootstrap)');
}

// â”€â”€â”€ Store Reactivo Interno â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface EngineStore {
    isReady: boolean;
    isLoading: boolean;
    loadProgress: number;
    isCadCommandActive: boolean;
    activeDoc: AcApDocument | null;
    fileName: string | null;
    error: string | null;
    setReady: (v: boolean) => void;
    setLoading: (v: boolean) => void;
    setProgress: (v: number) => void;
    setCadCommandActive: (v: boolean) => void;
    setDocState: (doc: AcApDocument | null, name: string | null) => void;
    setErrorMsg: (err: string | null) => void;
}

const useEngineStore = create<EngineStore>((set) => ({
    isReady: _initialized,
    isLoading: false,
    loadProgress: 0,
    isCadCommandActive: false,
    activeDoc: null,
    fileName: null,
    error: null,
    setReady: (isReady) => set({ isReady }),
    setLoading: (isLoading) => set({ isLoading }),
    setProgress: (loadProgress) => set({ loadProgress }),
    setCadCommandActive: (isCadCommandActive) => set({ isCadCommandActive }),
    setDocState: (activeDoc, fileName) => set({ activeDoc, fileName }),
    setErrorMsg: (error) => set({ error }),
}));

// â”€â”€â”€ Interfaces pÃºblicas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface MlightcadEngineState {
    isReady: boolean;
    isLoading: boolean;
    loadProgress: number;
    isCadCommandActive: boolean;
    activeDoc: AcApDocument | null;
    fileName: string | null;
    error: string | null;
}

export interface MlightcadEngineActions {
    initViewer: (container: HTMLElement) => Promise<void>;
    openFile: (file: File) => Promise<boolean>;
    newDocument: () => Promise<void>;
    fitToView: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
    zoomAt: (screenPoint: { x: number; y: number }, factor: number) => void;
    sendCommand: (cmd: string) => void;
    dispose: () => void;
    getViewState: () => { zoom: number; panX: number; panY: number } | null;
    /** Posiciona el viewport del motor CAD en el primer cuadrante (origen esquina inferior izquierda, Y hacia arriba). */
    setViewOrigin: () => void;
    /** Retorna las extents del documento actual en unidades CAD (puede ser mm, cm o m). */
    getDocumentExtents: () => {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    } | null;
    measureCadDistance: (
        p1: { x: number; y: number },
        p2: { x: number; y: number },
    ) => number;
    getOsnapPoint: (
        worldPoint: { x: number; y: number },
        options?: {
            hitRadius?: number;
            lastPoint?: { x: number; y: number } | null;
        },
    ) => { x: number; y: number } | null;
}

export type UseMlightcadEngineReturn = MlightcadEngineState &
    MlightcadEngineActions & {
        docManager: AcApDocManager | null;
    };

// â”€â”€â”€ Hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function useMlightcadEngine(): UseMlightcadEngineReturn {
    const isReady = useEngineStore((s) => s.isReady);
    const isLoading = useEngineStore((s) => s.isLoading);
    const loadProgress = useEngineStore((s) => s.loadProgress);
    const isCadCommandActive = useEngineStore((s) => s.isCadCommandActive);
    const activeDoc = useEngineStore((s) => s.activeDoc);
    const fileName = useEngineStore((s) => s.fileName);
    const error = useEngineStore((s) => s.error);

    const syncDocumentState = useCallback((dm: AcApDocManager) => {
        const doc = dm.curDocument ?? null;
        useEngineStore
            .getState()
            .setDocState(
                doc,
                doc ? doc.fileName || doc.docTitle || 'Nuevo documento' : null,
            );
    }, []);

    // â”€â”€ initViewer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const initViewer = useCallback(
        async (container: HTMLElement): Promise<void> => {
            if (_initialized && _container === container) {
                cadLog('Already initialized with same container â€” skipping');
                useEngineStore.getState().setReady(true);
                return;
            }

            cadLog('initViewer, container:', container.id);
            _container = container;

            try {
                const dm = getOrCreateDocManager(container);

                // Adjuntar eventos del motor una sola vez
                if (!_eventListenersAttached) {
                    const events = (
                        dm as unknown as {
                            events?: {
                                on?: (ev: string, cb: () => void) => void;
                            };
                        }
                    ).events;
                    if (events?.on) {
                        events.on('documentActivated', () => {
                            cadLog('documentActivated');
                            syncDocumentState(dm);
                        });
                        events.on('newDocumentCreated', () => {
                            cadLog('newDocumentCreated');
                            syncDocumentState(dm);
                        });
                        events.on('documentOpened', () => {
                            cadLog('documentOpened');
                            syncDocumentState(dm);
                        });
                        events.on('documentClosed', () => {
                            cadLog('documentClosed');
                            useEngineStore.getState().setDocState(null, null);
                        });
                    }

                    const editorEvents = (
                        dm.editor as unknown as {
                            events?: {
                                commandWillStart?: {
                                    addEventListener?: (cb: () => void) => void;
                                };
                                commandEnded?: {
                                    addEventListener?: (cb: () => void) => void;
                                };
                            };
                        }
                    ).events;

                    editorEvents?.commandWillStart?.addEventListener?.(() => {
                        useEngineStore.getState().setCadCommandActive(true);
                    });

                    editorEvents?.commandEnded?.addEventListener?.(() => {
                        useEngineStore.getState().setCadCommandActive(false);
                    });

                    _eventListenersAttached = true;
                }

                _initialized = true;

                // setReady(true) va DESPUÉS de bootstrapDocument para que
                // safeExecute y zoomAt no ejecuten comandos CAD antes de que
                // el documento esté cargado.
                useEngineStore.getState().setErrorMsg(null);
                useEngineStore.getState().setCadCommandActive(false);

                await bootstrapDocument(dm);
                syncDocumentState(dm);
                useEngineStore.getState().setReady(true);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                cadErr('initViewer error:', err);
                useEngineStore.getState().setErrorMsg(msg);
            }
        },
        [syncDocumentState],
    );

    // â”€â”€ openFile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const openFile = useCallback(async (file: File): Promise<boolean> => {
        const dm = _docManager;
        if (!dm) {
            useEngineStore.getState().setErrorMsg('Motor no inicializado');
            return false;
        }

        useEngineStore.getState().setLoading(true);
        useEngineStore.getState().setProgress(0);
        useEngineStore.getState().setErrorMsg(null);
        useEngineStore
            .getState()
            .setDocState(useEngineStore.getState().activeDoc, file.name);

        try {
            cadLog('Opening file:', file.name);
            const buffer = await file.arrayBuffer();
            const success = await dm.openDocument(file.name, buffer, {
                mode: AcEdOpenMode.Write,
            });

            if (success) {
                useEngineStore
                    .getState()
                    .setDocState(dm.curDocument ?? null, file.name);
                useEngineStore.getState().setProgress(100);
                cadLog('File opened OK');
                // Zoom to extents and force first-quadrant origin after a brief paint cycle.
                // Avoid unsupported grid commands; native CAD grid control is not exposed by this engine.
                requestAnimationFrame(() => {
                    try {
                        setViewOrigin();
                    } catch (e) {
                        cadWarn('Post-open view origin failed:', e);
                    }
                });
            } else {
                useEngineStore
                    .getState()
                    .setErrorMsg(`No se pudo abrir: ${file.name}`);
            }
            return success;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            cadErr('openFile error:', err);
            useEngineStore.getState().setErrorMsg(msg);
            return false;
        } finally {
            useEngineStore.getState().setLoading(false);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ——— newDocument —————————————————————————————————————————————————————————————————————————————————
    const newDocument = useCallback(async (): Promise<void> => {
        const dm = _docManager;
        if (!dm) {
            useEngineStore.getState().setErrorMsg('Motor no inicializado');
            return;
        }

        try {
            cadLog('Creating new document via blank DXF');
            useEngineStore.getState().setReady(false);
            await bootstrapDocument(dm);
            syncDocumentState(dm);
            useEngineStore.getState().setReady(true);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            cadErr('newDocument error:', err);
            useEngineStore.getState().setErrorMsg(msg);
        }
    }, [syncDocumentState]);

    // ——— safeExecute (interno) ——————————————————————————————————————————————————————————————————————
    const safeExecute = useCallback((cmd: string): void => {
        const dm = _docManager;
        // Requiere documento activo: evita que zoomToWindow y otros comandos
        // internos de mlightcad crasheen con “zoomTo is undefined” cuando el
        // motor está listo pero no hay documento cargado aún.
        if (!dm || !useEngineStore.getState().isReady || !dm.curDocument) {
            cadWarn('Viewer not ready or no document for command:', cmd);
            return;
        }
        try {
            dm.sendStringToExecute(cmd.trim());
            cadLog('Executed:', cmd);
        } catch (err) {
            cadErr('Command execution error:', cmd, err);
        }
    }, []);

    const getCurrentView = useCallback((): ViewApi | null => {
        const dm = _docManager;
        if (!dm?.curView) return null;
        return dm.curView as unknown as ViewApi;
    }, []);

    const zoomByFactor = useCallback(
        (factor: number): void => {
            const view = getCurrentView();
            if (!view) {
                cadWarn('Viewer not ready for zoom factor:', factor);
                return;
            }

            const currentZoom =
                typeof view.zoom === 'number' && Number.isFinite(view.zoom)
                    ? view.zoom
                    : typeof view.internalCamera?.zoom === 'number' &&
                        Number.isFinite(view.internalCamera.zoom)
                      ? view.internalCamera.zoom
                      : null;
            let center = { x: 0, y: 0 };
            try { center = view.center ?? center; } catch (e) {}

            if (currentZoom && typeof view.flyTo === 'function') {
                const nextZoom = Math.min(
                    1000,
                    Math.max(0.01, currentZoom * factor),
                );
                view.flyTo(center, nextZoom);
                cadLog('Executed native zoom factor:', factor, '->', nextZoom);
                return;
            }

            if (typeof view.zoomToFitDrawing === 'function') {
                view.zoomToFitDrawing();
                cadLog('Fallback zoomToFitDrawing used for factor:', factor);
                return;
            }

            cadWarn('Native zoom and zoomToFitDrawing not supported by this engine version');
        },
        [getCurrentView, safeExecute],
    );

    const zoomAt = useCallback(
        (screenPoint: { x: number; y: number }, factor: number): void => {
            const view = getCurrentView();
            let centerValid = false;
            try { centerValid = !!view?.center; } catch(e) {}
            
            if (
                !view ||
                typeof view.flyTo !== 'function' ||
                typeof view.screenToWorld !== 'function' ||
                !centerValid
            ) {
                zoomByFactor(factor);
                return;
            }

            const currentZoom =
                typeof view.zoom === 'number' && Number.isFinite(view.zoom)
                    ? view.zoom
                    : typeof view.internalCamera?.zoom === 'number' &&
                        Number.isFinite(view.internalCamera.zoom)
                      ? view.internalCamera.zoom
                      : null;

            if (!currentZoom) {
                zoomByFactor(factor);
                return;
            }

            const dpr = window.devicePixelRatio || 1;
            const spPhysical = { x: screenPoint.x * dpr, y: screenPoint.y * dpr };
            const before = view.screenToWorld(spPhysical);
            const currentCenter = view.center;
            const nextZoom = Math.min(
                1000,
                Math.max(0.01, currentZoom * factor),
            );

            view.flyTo(currentCenter, nextZoom);
            const after = view.screenToWorld(spPhysical);
            const nextCenter = {
                x: currentCenter.x + (before.x - after.x),
                y: currentCenter.y + (before.y - after.y),
            };

            view.flyTo(nextCenter, nextZoom);
            // cadLog('Executed native zoom-at factor:', factor, '->', nextZoom);
        },
        [getCurrentView, zoomByFactor],
    );

    // â”€â”€ Controles de vista â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const fitToView = useCallback(() => {
        const view = getCurrentView();
        if (view && typeof view.zoomToFitDrawing === 'function') {
            view.zoomToFitDrawing();
        }
    }, [getCurrentView]);
    const zoomIn = useCallback(() => zoomByFactor(1.2), [zoomByFactor]);
    const zoomOut = useCallback(() => zoomByFactor(1 / 1.2), [zoomByFactor]);
    const sendCommand = useCallback(
        (cmd: string) => safeExecute(cmd),
        [safeExecute],
    );

    // â”€â”€ setViewOrigin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Posiciona el viewport para que el origen (0,0) quede en la esquina
    // inferior izquierda, con el eje Y apuntando hacia arriba (primer cuadrante).
    // Esto imita el comportamiento estÃ¡ndar de AutoCAD / DIAlux.
    const setViewOrigin = useCallback((): void => {
        const dm = _docManager;
        if (!dm) return;
        try {
            // Intentar configurar via API nativa del view si estÃ¡ disponible
            const view = (
                dm.curDocument as (AcApDocument & { view?: ViewApi }) | null
            )?.view;
            if (view && typeof view.setViewOrigin === 'function') {
                view.setViewOrigin({ x: 0, y: 0 });
            } else if (view && typeof view.setCenter === 'function') {
                view.setCenter({ x: 5, y: 5 });
            }
            
            if (view && typeof view.zoomToFitDrawing === 'function') {
                view.zoomToFitDrawing();
            }
            cadLog('setViewOrigin: first-quadrant view configured');
        } catch (e) {
            cadWarn('setViewOrigin error (non-critical):', e);
        }
    }, [safeExecute]);

    // â”€â”€ getDocumentExtents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Lee las extents del documento actual para detectar la escala del DXF/DWG.
    // Retorna null si el documento no estÃ¡ disponible o la API no estÃ¡ expuesta.
    const getDocumentExtents = useCallback((): {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    } | null => {
        const dm = _docManager;
        if (!dm?.curDocument) return null;
        try {
            const db = dm.curDocument.database as ExtentsDatabase | undefined;
            if (!db) return null;

            // Intentar mÃ©todo nativo getExtents
            if (typeof db.getExtents === 'function') {
                const ext = db.getExtents() as {
                    minPt?: { x: number; y: number };
                    maxPt?: { x: number; y: number };
                };
                if (ext?.minPt && ext?.maxPt) {
                    return {
                        minX: ext.minPt.x,
                        minY: ext.minPt.y,
                        maxX: ext.maxPt.x,
                        maxY: ext.maxPt.y,
                    };
                }
            }

            // Alternativa: leer EXTMIN/EXTMAX del header DXF si estÃ¡n expuestos
            const header = db.header;
            if (header?.extMin && header?.extMax) {
                return {
                    minX: header.extMin.x ?? 0,
                    minY: header.extMin.y ?? 0,
                    maxX: header.extMax.x ?? 0,
                    maxY: header.extMax.y ?? 0,
                };
            }

            return null;
        } catch (e) {
            cadWarn('getDocumentExtents error:', e);
            return null;
        }
    }, []);

    // â”€â”€ getViewState â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const getViewState = useCallback((): {
        zoom: number;
        panX: number;
        panY: number;
    } | null => {
        const dm = _docManager;
        if (!dm?.curDocument) return null;
        try {
            const view = getCurrentView();
            const liveZoom =
                typeof view?.zoom === 'number' && Number.isFinite(view.zoom)
                    ? view.zoom
                    : typeof view?.internalCamera?.zoom === 'number' &&
                        Number.isFinite(view.internalCamera.zoom)
                      ? view.internalCamera.zoom
                      : null;
            if (view && typeof liveZoom === 'number' && view.center) {
                return {
                    zoom: liveZoom,
                    panX: view.center.x,
                    panY: view.center.y,
                };
            }

            const doc = dm.curDocument as unknown as {
                getZoomFactor?: () => number;
                getViewCenter?: () => { x: number; y: number };
            };
            if (
                typeof doc.getZoomFactor === 'function' &&
                typeof doc.getViewCenter === 'function'
            ) {
                const zoom = doc.getZoomFactor();
                const center = doc.getViewCenter();
                return { zoom, panX: center.x, panY: center.y };
            }
            return null;
        } catch (e) {
            cadWarn('getViewState error:', e);
            return null;
        }
    }, [getCurrentView]);

    const measureCadDistance = useCallback(
        (p1: { x: number; y: number }, p2: { x: number; y: number }): number =>
            Math.hypot((p2.x ?? 0) - (p1.x ?? 0), (p2.y ?? 0) - (p1.y ?? 0)),
        [],
    );

    const getOsnapPoint = useCallback(
        (
            worldPoint: { x: number; y: number },
            options?: {
                hitRadius?: number;
                lastPoint?: { x: number; y: number } | null;
            },
        ): { x: number; y: number } | null => {
            const dm = _docManager;
            const view = getCurrentView();
            const doc = dm?.curDocument;
            if (!doc || !view?.pick) return null;

            const modelSpace = doc.database.tables.blockTable
                .modelSpace as ModelSpaceApi;
            if (!modelSpace?.getIdAt) return null;

            try {
                const hitRadius = options?.hitRadius ?? 16;
                const lastPoint = options?.lastPoint ?? null;
                const results = view.pick(worldPoint, hitRadius, false) ?? [];
                const osnapPoints: Array<{
                    x: number;
                    y: number;
                    z?: number;
                    type?: AcDbOsnapMode;
                }> = [];
                const modes = [
                    AcDbOsnapMode.EndPoint,
                    AcDbOsnapMode.MidPoint,
                    // Center/Quadrant/Nearest omitidos: causan crash en entidades
                    // hatch con boundary_paths nulas ("Failed to convert hatch boundaries")
                ];

                for (const item of results) {
                    try {
                        const entity = modelSpace.getIdAt(item.id);
                        const subGetOsnapPoints = entity?.subGetOsnapPoints;
                        if (!subGetOsnapPoints) continue;

                        const injectPoints = (gsMark?: string) => {
                            for (const mode of modes) {
                                const startIndex = osnapPoints.length;
                                try {
                                    subGetOsnapPoints.call(entity,
                                        mode,
                                        { ...worldPoint, z: 0 },
                                        {
                                            x: lastPoint?.x ?? worldPoint.x,
                                            y: lastPoint?.y ?? worldPoint.y,
                                            z: 0,
                                        },
                                        osnapPoints,
                                        gsMark,
                                    );
                                } catch {
                                    // Geometría interna nula (ej. hatch sin boundaries) → saltar modo
                                    continue;
                                }
                                for (let i = startIndex; i < osnapPoints.length; i++) {
                                    osnapPoints[i].type = mode;
                                }
                            }
                        };

                        if (item.children?.length) {
                            for (const child of item.children) {
                                try { injectPoints(child.id); } catch { /* skip bad child */ }
                            }
                        } else {
                            injectPoints();
                        }
                    } catch {
                        // Entidad con geometría corrupta (hatch, solid 3D, etc.) → ignorar
                        continue;
                    }
                }

                if (osnapPoints.length === 0) return null;

                const toScreen = (point: { x: number; y: number }) =>
                    view.worldToScreen ? view.worldToScreen(point) : point;
                const pickScreen = toScreen(worldPoint);

                const best = osnapPoints.reduce(
                    (closest, candidate) => {
                        const current = toScreen(candidate);
                        const currentDist = Math.hypot(
                            current.x - pickScreen.x,
                            current.y - pickScreen.y,
                        );
                        if (!closest) {
                            return { point: candidate, dist: currentDist };
                        }

                        const priority = osnapPriority(candidate.type);
                        const closestPriority = osnapPriority(
                            closest.point.type,
                        );
                        if (
                            priority < closestPriority ||
                            (priority === closestPriority &&
                                currentDist < closest.dist)
                        ) {
                            return { point: candidate, dist: currentDist };
                        }

                        return closest;
                    },
                    null as {
                        point: { x: number; y: number; z?: number; type?: AcDbOsnapMode };
                        dist: number;
                    } | null,
                );

                return best?.point
                    ? { x: best.point.x ?? 0, y: best.point.y ?? 0 }
                    : null;
            } catch (error) {
                cadWarn('getOsnapPoint failed, fallback to local snap:', error);
                return null;
            }
        },
        [getCurrentView],
    );

    // â”€â”€ dispose â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const dispose = useCallback((): void => {
        // No reseteamos _initialized a false porque el motor es singleton a nivel
        // mÃ³dulo y puede ser reutilizado por otros componentes aun desmontando Ã©ste.
        useEngineStore.getState().setReady(false);
        useEngineStore.getState().setCadCommandActive(false);
    }, []);

    // Cleanup de visibilidad del estado al desmontar el componente que lo usa
    useEffect(() => {
        return () => {
            /* motor vive en mÃ³dulo, no se destruye al desmontar */
        };
    }, []);

    return {
        isReady,
        isLoading,
        loadProgress,
        isCadCommandActive,
        activeDoc,
        fileName,
        error,
        initViewer,
        openFile,
        newDocument,
        fitToView,
        zoomIn,
        zoomOut,
        zoomAt,
        sendCommand,
        getViewState,
        setViewOrigin,
        getDocumentExtents,
        measureCadDistance,
        getOsnapPoint,
        dispose,
        docManager: _docManager,
    };
}

function osnapPriority(mode?: AcDbOsnapMode): number {
    switch (mode) {
        case AcDbOsnapMode.EndPoint:
            return 0;
        case AcDbOsnapMode.MidPoint:
            return 1;
        case AcDbOsnapMode.Center:
            return 2;
        case AcDbOsnapMode.Quadrant:
            return 3;
        case AcDbOsnapMode.Nearest:
            return 4;
        default:
            return 10;
    }
}
