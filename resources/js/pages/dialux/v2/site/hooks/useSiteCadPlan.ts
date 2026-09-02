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

interface CadViewLike {
    zoom?: number;
    center?: { x: number; y: number };
    internalCamera?: { zoom?: number };
    flyTo?: (point: { x: number; y: number }, scale?: number) => void;
    worldToScreen?: (p: { x: number; y: number }) => { x: number; y: number };
    screenToWorld?: (p: { x: number; y: number }) => { x: number; y: number };
}

/** Sub-conjunto de la cámara del motor que consume `createCanvasTransforms`. */
export interface SiteCadView {
    worldToScreen?: (p: { x: number; y: number }) => { x?: number; y?: number };
    screenToWorld?: (p: { x: number; y: number }) => { x?: number; y?: number };
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

    // ── API de cámara: el MOTOR es el dueño del pan/zoom (modelo del editor v1).
    // El overlay SVG lo sigue leyendo `worldToScreen`/`screenToWorld` cada frame
    // (`createCanvasTransforms`), así que plano y geometría comparten UNA sola
    // transformación y no pueden desalinearse.

    // `useMlightcadEngine()` devuelve un objeto NUEVO cada render (sus métodos
    // leen el `_docManager` a nivel módulo), así que se accede por closure y
    // NUNCA va en las dependencias — igual que en `MlightcadCanvas2D` de v1.

    /** La cámara viva del motor, para `createCanvasTransforms`. */
    const getView = useCallback((): SiteCadView | null => {
        if (status !== 'ready') return null;
        const view = engine.docManager?.curView as unknown as
            SiteCadView | undefined;
        return view?.worldToScreen && view.screenToWorld ? view : null;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    /** `{ zoom, panX, panY }` para detectar cambios de cámara en un loop rAF. */
    const getViewState = useCallback(
        () => engine.getViewState?.() ?? null,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    /** Zoom centrado en un punto del canvas (px locales). */
    const zoomAtScreen = useCallback(
        (localX: number, localY: number, factor: number) => {
            if (status !== 'ready') return;
            engine.zoomAt?.({ x: localX, y: localY }, factor);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [status],
    );

    /** Desplaza la cámara `dxPx, dyPx` píxeles de pantalla. */
    const panByScreen = useCallback(
        (dxPx: number, dyPx: number) => {
            if (status !== 'ready') return;
            const view = engine.docManager?.curView as unknown as
                CadViewLike | undefined;
            if (
                !view?.flyTo ||
                !view.screenToWorld ||
                !view.center ||
                (dxPx === 0 && dyPx === 0)
            ) {
                return;
            }
            const zoom =
                typeof view.zoom === 'number' && Number.isFinite(view.zoom)
                    ? view.zoom
                    : typeof view.internalCamera?.zoom === 'number'
                      ? view.internalCamera.zoom
                      : undefined;
            try {
                const a = view.screenToWorld({ x: 0, y: 0 });
                const b = view.screenToWorld({ x: dxPx, y: dyPx });
                view.flyTo(
                    {
                        x: view.center.x - (b.x - a.x),
                        y: view.center.y - (b.y - a.y),
                    },
                    zoom,
                );
            } catch (error) {
                console.warn('[site-plan] pan falló.', error);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [status],
    );

    /** Reencuadra el plano completo (carga inicial). */
    const refit = useCallback(() => {
        if (status !== 'ready') return;
        engine.setViewOrigin?.();
        engine.fitToView?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    return {
        containerRef,
        status,
        getView,
        getViewState,
        zoomAtScreen,
        panByScreen,
        refit,
    };
}
