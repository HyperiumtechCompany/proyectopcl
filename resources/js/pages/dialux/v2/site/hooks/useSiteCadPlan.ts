import { useCallback, useEffect, useRef, useState } from 'react';
import {
    loadDialuxPlan,
    loadDialuxPlanFromServer,
    storedDialuxPlanToFile,
} from '@/pages/dialux/hooks/dialuxPlanStorage';
import { useMlightcadEngine } from '@/pages/dialux/hooks/useMlightcadEngine';
import { SITE_PLAN_SOURCE_SCENE_ID } from '../lib/planImport';

/**
 * useSiteCadPlan — plano del emplazamiento renderizado EN VIVO por el motor
 * CAD, en vez de la imagen PNG rasterizada.
 *
 * Motivo: sobre este plano se dibujan exteriores y se trazan alimentadores, y
 * de esas longitudes sale la caida de tension y el diagrama de red del Modulo
 * General. Un raster calibrado a ojo no da precision metrica ni se exporta
 * como plano; los vectores si.
 *
 * DISENO (lecciones de un intento anterior que se revirtio):
 *  - El motor `useMlightcadEngine` es un SINGLETON a nivel modulo. NO se puede
 *    montar en dos lugares a la vez (p.ej. este canvas y el dialogo de
 *    import): `initViewer` con otro contenedor DESTRUYE el docManager a mitad
 *    del parseo -> "Worker operation timed out". Este hook es el UNICO punto
 *    de montaje del motor en el emplazamiento.
 *  - `useMlightcadEngine()` devuelve un objeto nuevo en cada render, asi que
 *    NUNCA va en la lista de dependencias de un efecto con cleanup (bucle
 *    infinito montar/desmontar). Se accede por closure, igual que
 *    `MlightcadCanvas2D` en v1.
 *  - Sin el archivo local, el servidor se consulta UNA sola vez.
 *
 * El canvas del motor se monta DEBAJO del SVG del emplazamiento; su camara la
 * alinea `syncCamera` con el `viewBox`, asi que el SVG sigue mandando el
 * pan/zoom y la geometria del sitio conserva sus coordenadas en metros.
 *
 * Ejes: el SVG dibuja Y hacia ABAJO y el motor CAD Y hacia ARRIBA -> cadY = -siteY.
 */

export type SiteCadPlanStatus =
    'idle' | 'loading' | 'ready' | 'missing' | 'error';

interface ViewBoxLike {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface CadViewLike {
    zoom?: number;
    internalCamera?: { zoom?: number };
    flyTo?: (point: { x: number; y: number }, scale?: number) => void;
    worldToScreen?: (p: { x: number; y: number }) => { x: number; y: number };
    screenToWorld?: (p: { x: number; y: number }) => { x: number; y: number };
}

export function useSiteCadPlan(
    projectId: number,
    generalModuleId: number,
    /** `Date.now()` de la ultima importacion; al cambiar se reabre el plano. */
    importedAt: number | undefined,
) {
    const engine = useMlightcadEngine();
    const containerRef = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState<SiteCadPlanStatus>('idle');

    const initedRef = useRef(false);
    const openedForRef = useRef<number | null>(null);
    const serverMissingRef = useRef(false);

    // 1. Inicializar el motor UNA vez (montar el visor en el contenedor).
    useEffect(() => {
        const container = containerRef.current;
        if (!container || initedRef.current) return;
        initedRef.current = true;
        void engine.initViewer(container).catch((error) => {
            console.warn('[site-plan] initViewer fallo.', error);
            setStatus('error');
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 2. Abrir el DWG (y reabrirlo cuando cambia `importedAt`).
    useEffect(() => {
        if (!initedRef.current) return;
        if (importedAt !== undefined && openedForRef.current === importedAt) {
            return;
        }

        let cancelled = false;
        void (async () => {
            setStatus('loading');
            try {
                let stored = await loadDialuxPlan(
                    String(projectId),
                    SITE_PLAN_SOURCE_SCENE_ID,
                );
                if (!stored && !serverMissingRef.current) {
                    stored = await loadDialuxPlanFromServer(
                        String(projectId),
                        SITE_PLAN_SOURCE_SCENE_ID,
                        String(generalModuleId),
                    );
                    if (!stored) serverMissingRef.current = true;
                }
                if (cancelled) return;

                if (!stored) {
                    // Proyecto importado antes de que se guardara el original:
                    // no es un error - el canvas cae a la imagen PNG.
                    setStatus('missing');
                    return;
                }

                const opened = await engine.openFile(
                    storedDialuxPlanToFile(stored),
                );
                if (cancelled) return;
                openedForRef.current = importedAt ?? Date.now();
                if (opened) {
                    engine.setViewOrigin?.();
                    engine.fitToView?.();
                }
                setStatus(opened ? 'ready' : 'error');
            } catch (error) {
                if (cancelled) return;
                console.warn(
                    '[site-plan] No se pudo abrir el plano CAD del emplazamiento.',
                    error,
                );
                setStatus('error');
            }
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [importedAt, projectId, generalModuleId]);

    // 3. Soltar el motor al DESMONTAR (no en cada render).
    useEffect(() => {
        return () => {
            initedRef.current = false;
            openedForRef.current = null;
            try {
                engine.dispose();
            } catch {
                /* ya libre */
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * Alinea la camara del motor con el `viewBox` del SVG. `pixelWidth` es el
     * ancho real del canvas en px, necesario para saber cuantos px equivalen a
     * una unidad del emplazamiento.
     *
     * La escala se ajusta RELATIVA (se mide la actual con `worldToScreen` y se
     * corrige por el cociente) porque la unidad de `view.zoom` del motor no es
     * px/unidad y no esta documentada.
     */
    const syncCamera = useCallback(
        (viewBox: ViewBoxLike, pixelWidth: number) => {
            if (status !== 'ready') return;
            const view = engine.docManager?.curView as unknown as
                CadViewLike | undefined;
            if (!view?.flyTo || !view.worldToScreen) return;
            if (viewBox.width <= 0 || pixelWidth <= 0) return;

            try {
                const origin = view.worldToScreen({ x: 0, y: 0 });
                const unit = view.worldToScreen({ x: 1, y: 0 });
                const currentPxPerUnit = Math.hypot(
                    unit.x - origin.x,
                    unit.y - origin.y,
                );
                if (
                    !Number.isFinite(currentPxPerUnit) ||
                    currentPxPerUnit <= 0
                ) {
                    return;
                }

                const currentZoom =
                    typeof view.zoom === 'number' && Number.isFinite(view.zoom)
                        ? view.zoom
                        : typeof view.internalCamera?.zoom === 'number'
                          ? view.internalCamera.zoom
                          : null;
                if (currentZoom === null) return;

                const desiredPxPerUnit = pixelWidth / viewBox.width;
                const nextZoom = Math.min(
                    1e6,
                    Math.max(
                        1e-6,
                        currentZoom * (desiredPxPerUnit / currentPxPerUnit),
                    ),
                );

                view.flyTo(
                    {
                        x: viewBox.x + viewBox.width / 2,
                        y: -(viewBox.y + viewBox.height / 2),
                    },
                    nextZoom,
                );
            } catch (error) {
                console.warn(
                    '[site-plan] No se pudo sincronizar la camara CAD.',
                    error,
                );
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [status],
    );

    /**
     * `viewBox` (en unidades del emplazamiento) que encuadra el plano completo,
     * para que el canvas arranque mostrandolo entero en vez de un punto
     * diminuto en el centro. Se calcula pidiendole al motor que haga
     * `fitToView` (que si conoce la extension del dibujo, aunque
     * `getDocumentExtents` devuelva null) y leyendo que zona quedo visible.
     * `null` si el plano no esta listo o el motor no expone la vista.
     */
    const framePlanViewBox = useCallback(
        (pixelWidth: number, pixelHeight: number): ViewBoxLike | null => {
            if (status !== 'ready' || pixelWidth <= 0 || pixelHeight <= 0) {
                return null;
            }
            const view = engine.docManager?.curView as unknown as
                CadViewLike | undefined;
            if (!view?.worldToScreen || !view.screenToWorld) return null;

            try {
                engine.fitToView?.();
                const origin = view.worldToScreen({ x: 0, y: 0 });
                const unit = view.worldToScreen({ x: 1, y: 0 });
                const pxPerUnit = Math.hypot(
                    unit.x - origin.x,
                    unit.y - origin.y,
                );
                if (!Number.isFinite(pxPerUnit) || pxPerUnit <= 0) return null;

                const center = view.screenToWorld({
                    x: pixelWidth / 2,
                    y: pixelHeight / 2,
                });
                const visW = pixelWidth / pxPerUnit;
                const visH = pixelHeight / pxPerUnit;
                // Un margen del 8% para que el plano no toque los bordes.
                const pad = 1.08;
                const width = visW * pad;
                const height = visH * pad;
                return {
                    x: center.x - width / 2,
                    // El SVG dibuja Y hacia abajo: siteY = -cadY.
                    y: -center.y - height / 2,
                    width,
                    height,
                };
            } catch (error) {
                console.warn(
                    '[site-plan] No se pudo encuadrar el plano.',
                    error,
                );
                return null;
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [status],
    );

    return { containerRef, status, syncCamera, framePlanViewBox };
}
