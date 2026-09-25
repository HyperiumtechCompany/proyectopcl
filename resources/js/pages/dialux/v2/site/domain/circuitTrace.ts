import type { Point2D } from './types';

export type CircuitSegmentMode = 'aerial' | 'underground';

/**
 * El doble clic del navegador genera dos clics antes de `dblclick`. Al cerrar
 * un circuito sobre un artefacto eso puede dejar dos puntos iguales y un
 * tramo de longitud cero. Compactamos únicamente esos duplicados consecutivos
 * y conservamos el modo correspondiente a cada tramo real.
 */
export function compactCircuitTrace(
    waypoints: Point2D[],
    modes: CircuitSegmentMode[],
): { waypoints: Point2D[]; modes: CircuitSegmentMode[] } {
    if (waypoints.length < 2) return { waypoints, modes: [] };

    const compactedWaypoints: Point2D[] = [waypoints[0]];
    const compactedModes: CircuitSegmentMode[] = [];

    for (let index = 1; index < waypoints.length; index += 1) {
        const point = waypoints[index];
        const previous = compactedWaypoints[compactedWaypoints.length - 1];
        if (Math.hypot(point.x - previous.x, point.y - previous.y) < 1e-6) {
            continue;
        }
        compactedWaypoints.push(point);
        compactedModes.push(
            modes[index - 1] ?? modes[modes.length - 1] ?? 'aerial',
        );
    }

    return { waypoints: compactedWaypoints, modes: compactedModes };
}
