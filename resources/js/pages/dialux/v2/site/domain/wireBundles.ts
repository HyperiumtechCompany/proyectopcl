import type { Point2D } from './types';

/**
 * Cables que comparten un mismo tramo (p.ej. varias salidas del TG por las
 * mismas cajas de pase y la misma zanja) se dibujan EN PARALELO, uno al lado
 * del otro, en vez de uno encima del otro: así cada salida se ve con su color
 * y se puede seleccionar, cortar o re-trazar por separado. Solo es dibujo: el
 * recorrido guardado y las longitudes no cambian.
 */

export interface WireLane {
    /** Posición en el haz: 0 = centro; ±1, ±2… a cada lado (en "carriles"). */
    lane: number;
    /** Normal unitaria del tramo, en el sentido CANÓNICO (igual para todos los cables del haz). */
    nx: number;
    ny: number;
}

/** Clave de un tramo sin importar su sentido (extremos redondeados a `tolerance`). */
function segmentKey(a: Point2D, b: Point2D, tolerance: number): { key: string; flipped: boolean } {
    const round = (p: Point2D) => `${Math.round(p.x / tolerance)},${Math.round(p.y / tolerance)}`;
    const ka = round(a);
    const kb = round(b);
    return ka <= kb ? { key: `${ka}|${kb}`, flipped: false } : { key: `${kb}|${ka}`, flipped: true };
}

/**
 * Carril de cada tramo de cada cable. `wires` en el orden de dibujo; los
 * puntos en unidades de plano. Devuelve, por id de cable, un `WireLane` por
 * tramo (lane 0 si el tramo no lo comparte nadie).
 */
export function wireBundleLanes(
    wires: Array<{ id: string; points: Point2D[] }>,
    tolerance = 0.05,
): Map<string, WireLane[]> {
    const members = new Map<string, string[]>();
    for (const wire of wires) {
        for (let i = 1; i < wire.points.length; i++) {
            const { key } = segmentKey(wire.points[i - 1], wire.points[i], tolerance);
            const list = members.get(key) ?? [];
            if (!list.includes(wire.id)) list.push(wire.id);
            members.set(key, list);
        }
    }
    const result = new Map<string, WireLane[]>();
    for (const wire of wires) {
        const lanes: WireLane[] = [];
        for (let i = 1; i < wire.points.length; i++) {
            const a = wire.points[i - 1];
            const b = wire.points[i];
            const { key, flipped } = segmentKey(a, b, tolerance);
            const list = members.get(key) ?? [wire.id];
            // Sentido canónico: el mismo para todos los cables del haz.
            const [from, to] = flipped ? [b, a] : [a, b];
            const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
            lanes.push({
                lane: list.indexOf(wire.id) - (list.length - 1) / 2,
                nx: -(to.y - from.y) / length,
                ny: (to.x - from.x) / length,
            });
        }
        result.set(wire.id, lanes);
    }
    return result;
}

/** Desplaza un tramo `a→b` a su carril: `spacing` en las mismas unidades que los puntos. */
export function offsetSegment(
    a: Point2D,
    b: Point2D,
    lane: WireLane | undefined,
    spacing: number,
): [Point2D, Point2D] {
    if (!lane || lane.lane === 0) return [a, b];
    const dx = lane.nx * lane.lane * spacing;
    const dy = lane.ny * lane.lane * spacing;
    return [
        { x: a.x + dx, y: a.y + dy },
        { x: b.x + dx, y: b.y + dy },
    ];
}

/**
 * Polilínea completa desplazada a sus carriles (continua: cada vértice toma
 * el promedio de los desplazamientos de sus dos tramos). Para el 3D y el PDF.
 */
export function offsetPolyline(
    points: Point2D[],
    lanes: WireLane[] | undefined,
    spacing: number,
): Point2D[] {
    if (!lanes || lanes.every((lane) => lane.lane === 0)) return points;
    const shiftOf = (index: number) => {
        const lane = lanes[index];
        return lane ? { x: lane.nx * lane.lane * spacing, y: lane.ny * lane.lane * spacing } : { x: 0, y: 0 };
    };
    return points.map((point, i) => {
        const before = i > 0 ? shiftOf(i - 1) : null;
        const after = i < points.length - 1 ? shiftOf(i) : null;
        const shift =
            before && after
                ? { x: (before.x + after.x) / 2, y: (before.y + after.y) / 2 }
                : (before ?? after ?? { x: 0, y: 0 });
        return { x: point.x + shift.x, y: point.y + shift.y };
    });
}
