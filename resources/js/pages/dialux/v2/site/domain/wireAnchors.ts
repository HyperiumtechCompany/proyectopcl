import { elementBox } from './layoutFit';
import { tgOutputPlanOffset } from './tgPanel';
import type { Point2D, SiteElement } from './types';

/** Centro del artefacto, corrido a la salida concreta del TG si aplica (mismo criterio en 2D y 3D). */
function anchorPointFor(
    el: SiteElement,
    scaleM: number,
    tgOutputId: string | undefined,
): Point2D {
    const center = elementBox(el, scaleM).center;
    if (el.type !== 'tg_location' || !tgOutputId) return center;
    const outputs = el.config?.kind === 'tg' ? el.config.outputs : undefined;
    const offset = tgOutputPlanOffset(
        outputs,
        tgOutputId,
        el.rotation ?? 0,
        scaleM,
        el.config?.kind === 'tg' ? el.config : undefined,
    );
    return { x: center.x + offset.x, y: center.y + offset.y };
}

/**
 * Reemplaza el primer y el último waypoint de un cableado por el punto
 * ACTUAL de los artefactos anclados (si todavía existen) — así el cable
 * sigue al objeto cuando se mueve o gira, en vez de quedarse fijo donde se
 * dibujó la primera vez. Si un extremo es un TG y `tgOutputId` indica una
 * salida concreta, el punto se corre a esa salida (no al centro del
 * gabinete) — en metros reales, así que sigue al TG sin depender del zoom y
 * es el MISMO cálculo que usa el constructor 3D (antes solo funcionaba, a
 * medias, en el plano 2D). Los waypoints intermedios (puntos de ruteo a
 * mano) no se tocan. Se usa en el render 2D, en el constructor 3D y en
 * cualquier cálculo de longitud, para que todos lean la misma posición "en
 * vivo".
 */
export function resolveWireEndpoints(
    waypoints: Point2D[],
    sourceId: string,
    targetId: string,
    elementById: (id: string) => SiteElement | undefined,
    scaleM: number,
    tgOutputId?: string,
): Point2D[] {
    if (waypoints.length === 0) return waypoints;
    let resolved = waypoints;
    const source = elementById(sourceId);
    if (source) {
        const point = anchorPointFor(source, scaleM, tgOutputId);
        if (point.x !== resolved[0].x || point.y !== resolved[0].y) {
            resolved = [point, ...resolved.slice(1)];
        }
    }
    if (resolved.length > 1) {
        const target = elementById(targetId);
        if (target) {
            const point = anchorPointFor(target, scaleM, tgOutputId);
            const last = resolved[resolved.length - 1];
            if (point.x !== last.x || point.y !== last.y) {
                resolved = [...resolved.slice(0, -1), point];
            }
        }
    }
    return resolved;
}
