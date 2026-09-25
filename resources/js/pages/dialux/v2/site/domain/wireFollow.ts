import { elementBox } from './layoutFit';
import type { Point2D, SiteData, SiteElement } from './types';

/**
 * Un cable que PASA por un artefacto (caja de pase, buzón, poste…) guarda ese
 * paso como un waypoint intermedio en el centro exacto del artefacto: el clic
 * de ruteo se engancha a `anchor.point` (`useSiteEditor.addCircuitPoint`) y la
 * continuación de un circuito arranca en `elementBox(target).center`. Solo el
 * origen y el destino finales se resuelven en vivo (`resolveWireEndpoints`),
 * así que al mover la caja el cable se quedaba donde estaba.
 *
 * Esta función hace que los waypoints que estaban en el centro de un objeto
 * movido se desplacen con él — en circuitos de instalación y en trazados de
 * alimentador. Es posicional (no guarda vínculos nuevos): funciona igual para
 * cualquier camino de edición y no cambia el modelo de datos.
 */

/** Tolerancia en METROS para considerar que un waypoint está en el centro del objeto. */
const FOLLOW_TOLERANCE_M = 0.02;

function followPoints(
    points: Point2D[],
    moves: Array<{ from: Point2D; to: Point2D }>,
    tolerance: number,
): Point2D[] | null {
    let changed = false;
    const next = points.map((point) => {
        for (const move of moves) {
            if (
                Math.hypot(point.x - move.from.x, point.y - move.from.y) <=
                tolerance
            ) {
                changed = true;
                return {
                    x: point.x + (move.to.x - move.from.x),
                    y: point.y + (move.to.y - move.from.y),
                };
            }
        }
        return point;
    });
    return changed ? next : null;
}

/**
 * Devuelve `next` con los cables arrastrados junto a los objetos que se
 * movieron entre `previousElements` y `next.elements` (o `next` tal cual si
 * nada cambió).
 */
export function followMovedElements(
    previousElements: SiteElement[],
    next: SiteData,
    movedIds: Iterable<string>,
): SiteData {
    const scaleM = next.terrainScaleM || 1;
    const previousById = new Map(
        previousElements.map((element) => [element.id, element]),
    );
    const nextById = new Map(next.elements.map((element) => [element.id, element]));
    const moves: Array<{ from: Point2D; to: Point2D }> = [];
    for (const id of movedIds) {
        const before = previousById.get(id);
        const after = nextById.get(id);
        if (!before || !after || before.vertices.length === 0) continue;
        const from = elementBox(before, scaleM).center;
        const to = elementBox(after, scaleM).center;
        if (from.x === to.x && from.y === to.y) continue;
        moves.push({ from, to });
    }
    if (moves.length === 0) return next;

    const tolerance = FOLLOW_TOLERANCE_M / scaleM;
    let changed = false;
    const circuits = (next.circuits ?? []).map((circuit) => {
        const waypoints = followPoints(circuit.waypoints, moves, tolerance);
        if (!waypoints) return circuit;
        changed = true;
        return { ...circuit, waypoints };
    });
    const feederPaths = (next.feederPaths ?? []).map((path) => {
        const waypoints = followPoints(path.waypoints, moves, tolerance);
        if (!waypoints) return path;
        changed = true;
        return { ...path, waypoints };
    });
    return changed ? { ...next, circuits, feederPaths } : next;
}
