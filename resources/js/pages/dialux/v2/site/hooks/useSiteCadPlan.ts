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
 * de esas longitudes sale la caída de tensión y el diagrama de red del Módulo
 * General. Un raster calibrado a ojo no da precisión métrica ni se puede
 * exportar como plano; los vectores sí.
 *
 * El canvas del motor se monta DEBAJO del SVG del emplazamiento y su cámara se
 * mantiene alineada con el `viewBox` (ver `syncCamera`), así que el SVG sigue
 * mandando el pan/zoom y toda la geometría del sitio conserva sus coordenadas
 * en metros — no hubo que rehacer el editor.
 *
 * Convención de ejes: el SVG dibuja con Y hacia ABAJO y el motor CAD con Y
 * hacia ARRIBA, por eso `cadY = -siteY`.
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
    center?: { x: number; y: number };
    flyTo?: (point: { x: number; y: number }, scale?: number) => void;
    worldToScreen?: (p: { x: number; y: number }) => { x: number; y: number };
}

export function useSiteCadPlan(projectId: number, generalModuleId: number) {
    const engine = useMlightcadEngine();
    const containerRef = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState<SiteCadPlanStatus>('idle');
    const startedRef = useRef(false);

    useEffect(() => {
        if (startedRef.current) return;
        const container = containerRef.current;
        if (!container) return;
        startedRef.current = true;

        void (async () => {
            setStatus('loading');
            try {
                // Copia local primero (inmediata, sin límite de subida); el
                // servidor es el respaldo para abrirlo desde otra máquina.
                const stored =
                    (await loadDialuxPlan(
                        String(projectId),
                        SITE_PLAN_SOURCE_SCENE_ID,
                    )) ??
                    (await loadDialuxPlanFromServer(
                        String(projectId),
                        SITE_PLAN_SOURCE_SCENE_ID,
                        String(generalModuleId),
                    ));

                if (!stored) {
                    // Proyecto importado antes de que se guardara el original:
                    // no es un error, el llamador cae a la imagen PNG.
                    setStatus('missing');
                    return;
                }

                await engine.initViewer(container);
                const opened = await engine.openFile(
                    storedDialuxPlanToFile(stored),
                );
                setStatus(opened ? 'ready' : 'error');
            } catch (error) {
                console.warn(
                    '[site-plan] No se pudo abrir el plano CAD del emplazamiento.',
                    error,
                );
                setStatus('error');
            }
        })();
    }, [engine, projectId, generalModuleId]);

    // El motor es un SINGLETON compartido con el editor de interiores (v1):
    // hay que soltarlo al salir del emplazamiento o v1 encontraría este
    // documento ya abierto.
    useEffect(() => {
        return () => {
            startedRef.current = false;
            try {
                engine.dispose();
            } catch {
                /* el motor ya estaba libre */
            }
        };
    }, [engine]);

    /**
     * Alinea la cámara del motor con el `viewBox` del SVG. `pixelWidth` es el
     * ancho real en píxeles del canvas, necesario para saber cuántos píxeles
     * corresponden a una unidad del emplazamiento.
     *
     * La escala se ajusta de forma RELATIVA (se mide la actual con
     * `worldToScreen` y se corrige por el cociente) porque la unidad de
     * `view.zoom` del motor no es px/unidad y no está documentada.
     */
    const syncCamera = useCallback(
        (viewBox: ViewBoxLike, pixelWidth: number) => {
            const view = engine.docManager?.curView as unknown as
                CadViewLike | undefined;
            if (!view?.flyTo || !view.worldToScreen) return;
            if (viewBox.width <= 0 || pixelWidth <= 0) return;

            try {
                const origin = view.worldToScreen({ x: 0, y: 0 });
                const unitX = view.worldToScreen({ x: 1, y: 0 });
                const currentPxPerUnit = Math.hypot(
                    unitX.x - origin.x,
                    unitX.y - origin.y,
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
                        // Y invertida: el SVG crece hacia abajo, el CAD hacia arriba.
                        y: -(viewBox.y + viewBox.height / 2),
                    },
                    nextZoom,
                );
            } catch (error) {
                console.warn(
                    '[site-plan] No se pudo sincronizar la cámara CAD.',
                    error,
                );
            }
        },
        [engine],
    );

    return { containerRef, status, syncCamera };
}
