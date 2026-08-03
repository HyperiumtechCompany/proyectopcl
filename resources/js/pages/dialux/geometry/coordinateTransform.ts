/**
 * coordinateTransform.ts — Funciones únicas de conversión pantalla ↔ mundo.
 *
 * Contrato de coordenadas (verificado contra @mlightcad/cad-simple-viewer 1.5.8):
 *   - `view.screenToWorld` / `view.worldToScreen` operan en PÍXELES CSS locales
 *     al canvas (la vista toma su ancho/alto de getBoundingClientRect()).
 *     NO se debe multiplicar por devicePixelRatio en esta frontera.
 *   - Las coordenadas de MUNDO del motor están en unidades CAD nativas.
 *   - La unidad canónica de la escena DIAlux es el METRO:
 *       metros = unidades_cad × effectiveScale
 *       effectiveScale = scaleConfig.factor × scaleConfig.calibrationFactor
 *
 * Toda la geometría persistida usa metros; la cámara (zoom/pan) solo afecta la
 * visualización, por lo que el resultado de screenToScene es independiente del
 * nivel de zoom para un mismo punto del mundo.
 */

import type { ScaleConfig } from '@/pages/dialux/hooks/types';
import type { WorldPoint } from './polygonGeometry';

export interface ScreenPoint {
    x: number;
    y: number;
}

/** Sub-conjunto de la vista del motor CAD que necesitamos. */
export interface CadViewLike {
    worldToScreen?: (p: { x: number; y: number }) => { x?: number; y?: number } | null | undefined;
    screenToWorld?: (p: { x: number; y: number }) => { x?: number; y?: number } | null | undefined;
}

export interface FallbackViewport {
    zoom: number;
    panX: number;
    panY: number;
    /** Píxeles CSS por metro cuando el motor CAD no está disponible */
    pxPerMeter: number;
}

export interface CanvasTransforms {
    /** metros → píxeles CSS (solo para renderizar) */
    sceneToScreen: (p: WorldPoint) => ScreenPoint;
    /** píxeles CSS → metros (retira zoom, pan y transformación de cámara) */
    screenToScene: (p: ScreenPoint) => WorldPoint;
    /** Longitud en píxeles de un desplazamiento (dx,dy) en metros desde `origin` */
    screenDistance: (dx: number, dy: number, origin?: WorldPoint) => number;
}

function safeNum(val: unknown): number {
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
}

export function getEffectiveScale(scaleConfig?: Pick<ScaleConfig, 'factor' | 'calibrationFactor'> | null): number {
    if (!scaleConfig) return 1;
    const factor = safeNum(scaleConfig.factor || 1);
    const calibration = safeNum(scaleConfig.calibrationFactor || 1);
    const effective = factor * calibration;
    return effective > 0 ? effective : 1;
}

/** Convierte una magnitud en unidades CAD nativas a metros. */
export function cadToMeters(cadVal: number, scaleConfig?: ScaleConfig | null): number {
    return safeNum(cadVal) * getEffectiveScale(scaleConfig);
}

/** Convierte una magnitud en metros a unidades CAD nativas. */
export function metersToCad(meterVal: number, scaleConfig?: ScaleConfig | null): number {
    return safeNum(meterVal) / getEffectiveScale(scaleConfig);
}

/**
 * Crea el par único de transformaciones pantalla ↔ escena.
 *
 * Ruta nativa: usa la cámara del motor CAD (que ya integra zoom, pan e
 * inversión de eje Y del espacio CAD).
 *
 * Ruta fallback (motor no inicializado): transformación afín propia. Invierte
 * el eje Y para respetar el convenio CAD (Y hacia arriba) igual que el motor,
 * de modo que la geometría no cambie de orientación cuando el motor se activa.
 */
export function createCanvasTransforms(
    cadView: CadViewLike | null | undefined,
    scaleConfig: ScaleConfig | null | undefined,
    fallback: FallbackViewport,
    canvasHeightPx = 0,
): CanvasTransforms {
    const hasView = Boolean(cadView?.worldToScreen && cadView?.screenToWorld);
    const effective = getEffectiveScale(scaleConfig);

    const sceneToScreen = (p: WorldPoint): ScreenPoint => {
        if (hasView && cadView?.worldToScreen) {
            const s = cadView.worldToScreen({
                x: safeNum(p.x) / effective,
                y: safeNum(p.y) / effective,
            });
            return { x: safeNum(s?.x), y: safeNum(s?.y) };
        }
        const pxPerM = fallback.pxPerMeter > 0 ? fallback.pxPerMeter : 1;
        return {
            x: safeNum(p.x) * pxPerM * fallback.zoom + fallback.panX,
            y: canvasHeightPx - (safeNum(p.y) * pxPerM * fallback.zoom + fallback.panY),
        };
    };

    const screenToScene = (p: ScreenPoint): WorldPoint => {
        if (hasView && cadView?.screenToWorld) {
            const w = cadView.screenToWorld({ x: safeNum(p.x), y: safeNum(p.y) });
            return { x: safeNum(w?.x) * effective, y: safeNum(w?.y) * effective };
        }
        const pxPerM = fallback.pxPerMeter > 0 ? fallback.pxPerMeter : 1;
        return {
            x: (safeNum(p.x) - fallback.panX) / (pxPerM * fallback.zoom),
            y: (canvasHeightPx - safeNum(p.y) - fallback.panY) / (pxPerM * fallback.zoom),
        };
    };

    const screenDistance = (dx: number, dy: number, origin: WorldPoint = { x: 0, y: 0 }): number => {
        const a = sceneToScreen(origin);
        const b = sceneToScreen({ x: origin.x + safeNum(dx), y: origin.y + safeNum(dy) });
        return Math.hypot(b.x - a.x, b.y - a.y);
    };

    return { sceneToScreen, screenToScene, screenDistance };
}
