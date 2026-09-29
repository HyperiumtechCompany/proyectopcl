import { closestPointOnPolygon } from './geometry';
import { elementBox } from './layoutFit';
import { tgOutputPlanOffset } from './tgPanel';
import type { Point2D, SiteElement } from './types';

/**
 * Acometida de un edificio: el cable llega a su FACHADA (el punto del
 * contorno más cercano al tramo anterior), no a su centro. El recorrido
 * dentro del edificio hasta su tablero se declara aparte en el cable
 * (`SiteCircuit.interiorLengthM`). Sin contorno válido, su centro.
 */
export function buildingEntryPoint(block: SiteElement, from: Point2D): Point2D {
    if (block.vertices.length < 3) return from;
    return closestPointOnPolygon(from, block.vertices, true)?.point ?? from;
}

/** Cajas de pase / buzones: el cable pasa por ellas sin ser una carga ni un tablero. */
export const PASS_THROUGH_TYPES = new Set<SiteElement['type']>(['pull_box', 'cable_vault']);

/** Tolerancia (m) para reconocer que un punto del cable está sobre una caja de pase. */
const PASS_THROUGH_SNAP_M = 0.3;

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
    /** Elementos de la planta: para reconocer las cajas de pase por donde pasa el cable. */
    elements?: Iterable<SiteElement>,
): Point2D[] {
    if (waypoints.length === 0) return waypoints;
    let resolved = waypoints;
    const passThroughs = elements ? [...elements].filter((element) => PASS_THROUGH_TYPES.has(element.type)) : [];
    /**
     * El extremo dibujado normalmente ES el objeto (y se reemplaza por su
     * anclaje vivo, así el cable lo sigue si se mueve). Pero si ese punto
     * está sobre OTRA caja de pase / buzón, el cable pasa por ella a
     * propósito: se conserva y se agrega el tramo final (antes se
     * reemplazaba y el cable saltaba por donde no va).
     */
    const isAtObject = (point: Point2D, element: SiteElement) =>
        !passThroughs.some((box) => {
            if (box.id === element.id) return false;
            const c = elementBox(box, scaleM).center;
            return Math.hypot(point.x - c.x, point.y - c.y) * scaleM <= PASS_THROUGH_SNAP_M;
        });
    const source = elementById(sourceId);
    if (source) {
        const first = resolved[0];
        const next = resolved.length > 1 ? resolved[1] : first;
        const keep = resolved.length > 1 && !isAtObject(first, source);
        const from = keep ? first : next;
        const point =
            source.type === 'building_block' && resolved.length > 1
                ? buildingEntryPoint(source, from)
                : anchorPointFor(source, scaleM, tgOutputId);
        if (keep) {
            resolved = [point, ...resolved];
        } else if (point.x !== first.x || point.y !== first.y) {
            resolved = [point, ...resolved.slice(1)];
        }
    }
    if (resolved.length > 1) {
        const target = elementById(targetId);
        if (target) {
            const last = resolved[resolved.length - 1];
            const keep = !isAtObject(last, target);
            const from = keep ? last : resolved[resolved.length - 2];
            const point =
                target.type === 'building_block'
                    ? buildingEntryPoint(target, from)
                    : anchorPointFor(target, scaleM, tgOutputId);
            if (keep) {
                resolved = [...resolved, point];
            } else if (point.x !== last.x || point.y !== last.y) {
                resolved = [...resolved.slice(0, -1), point];
            }
        }
    }
    return resolved;
}
