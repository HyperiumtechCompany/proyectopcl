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

/**
 * Clave de un tramo sin importar su sentido. Un extremo que es el OBJETO del
 * cable (TG, caja…) se identifica por su id — no por la coordenada: cada
 * salida del TG arranca en su propio borne (a centímetros de las otras) y
 * con coordenadas nunca se reconocían como el mismo tramo.
 */
function segmentKey(
    a: Point2D,
    b: Point2D,
    tolerance: number,
    aKey?: string,
    bKey?: string,
): { key: string; flipped: boolean } {
    const round = (p: Point2D) => `${Math.round(p.x / tolerance)},${Math.round(p.y / tolerance)}`;
    const ka = aKey ?? round(a);
    const kb = bKey ?? round(b);
    return ka <= kb ? { key: `${ka}|${kb}`, flipped: false } : { key: `${kb}|${ka}`, flipped: true };
}

/**
 * Carril de cada tramo de cada cable. `wires` en el orden de dibujo; los
 * puntos en unidades de plano. Devuelve, por id de cable, un `WireLane` por
 * tramo (lane 0 si el tramo no lo comparte nadie).
 */
export function wireBundleLanes(
    wires: Array<{
        id: string;
        points: Point2D[];
        /** Objeto del extremo inicial / final del cable (`sourceId` / `targetId`). */
        startId?: string;
        endId?: string;
    }>,
    tolerance = 0.05,
): Map<string, WireLane[]> {
    const keyOf = (wire: (typeof wires)[number], i: number) =>
        segmentKey(
            wire.points[i - 1],
            wire.points[i],
            tolerance,
            i === 1 && wire.startId ? `@${wire.startId}` : undefined,
            i === wire.points.length - 1 && wire.endId ? `@${wire.endId}` : undefined,
        );
    // Por tramo compartido: sus cables y la normal canónica del haz.
    const bundles = new Map<string, { nx: number; ny: number; members: Array<{ id: string; side: number; order: number }> }>();
    let order = 0;
    for (const wire of wires) {
        for (let i = 1; i < wire.points.length; i++) {
            const a = wire.points[i - 1];
            const b = wire.points[i];
            const { key, flipped } = keyOf(wire, i);
            const [from, to] = flipped ? [b, a] : [a, b];
            let bundle = bundles.get(key);
            if (!bundle) {
                const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
                bundle = { nx: -(to.y - from.y) / length, ny: (to.x - from.x) / length, members: [] };
                bundles.set(key, bundle);
            }
            if (bundle.members.some((member) => member.id === wire.id)) continue;
            // Posición real del cable a lo ancho del haz (p.ej. su borne en el
            // TG): los carriles siguen ese orden y los cables no se cruzan.
            const side = ((a.x + b.x) / 2) * bundle.nx + ((a.y + b.y) / 2) * bundle.ny;
            bundle.members.push({ id: wire.id, side, order: order++ });
        }
    }
    for (const bundle of bundles.values()) {
        bundle.members.sort((p, q) => (Math.abs(p.side - q.side) > 1e-6 ? p.side - q.side : p.order - q.order));
    }
    const result = new Map<string, WireLane[]>();
    for (const wire of wires) {
        const lanes: WireLane[] = [];
        for (let i = 1; i < wire.points.length; i++) {
            const bundle = bundles.get(keyOf(wire, i).key);
            const index = bundle ? bundle.members.findIndex((member) => member.id === wire.id) : 0;
            const size = bundle ? bundle.members.length : 1;
            lanes.push({
                lane: index - (size - 1) / 2,
                nx: bundle?.nx ?? 0,
                ny: bundle?.ny ?? 1,
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
    /** Extremos que NO se mueven (el borne de su salida en el TG). */
    pin: { start?: boolean; end?: boolean } = {},
): [Point2D, Point2D] {
    if (!lane || lane.lane === 0) return [a, b];
    const dx = lane.nx * lane.lane * spacing;
    const dy = lane.ny * lane.lane * spacing;
    return [
        pin.start ? a : { x: a.x + dx, y: a.y + dy },
        pin.end ? b : { x: b.x + dx, y: b.y + dy },
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
    /** Extremos que NO se mueven (el borne de su salida en el TG). */
    pin: { start?: boolean; end?: boolean } = {},
): Point2D[] {
    if (!lanes || lanes.every((lane) => lane.lane === 0)) return points;
    const shiftOf = (index: number) => {
        const lane = lanes[index];
        return lane ? { x: lane.nx * lane.lane * spacing, y: lane.ny * lane.lane * spacing } : { x: 0, y: 0 };
    };
    return points.map((point, i) => {
        if ((i === 0 && pin.start) || (i === points.length - 1 && pin.end)) return point;
        const before = i > 0 ? shiftOf(i - 1) : null;
        const after = i < points.length - 1 ? shiftOf(i) : null;
        const shift =
            before && after
                ? { x: (before.x + after.x) / 2, y: (before.y + after.y) / 2 }
                : (before ?? after ?? { x: 0, y: 0 });
        return { x: point.x + shift.x, y: point.y + shift.y };
    });
}

/** Fracción del tramo en la que el cable se abre desde / se junta hacia su objeto. */
const TAPER_FRACTION = 0.25;

/**
 * Desplazamiento de carril en la fracción `t` (0..1) de un tramo. En un
 * extremo que es un OBJETO (borne del TG, caja de pase, poste) el cable
 * llega a él — se junta con el resto del haz, como entra en obra a la caja —
 * y se abre en paralelo a lo largo del tramo. Así los cables del haz nunca
 * se cruzan ni "saltan" al pasar por una caja.
 */
export function laneShift(
    lane: WireLane | undefined,
    spacing: number,
    t: number,
    taper: { start?: boolean; end?: boolean } = {},
): Point2D {
    if (!lane || lane.lane === 0) return { x: 0, y: 0 };
    let f = 1;
    if (taper.start) f = Math.min(f, t / TAPER_FRACTION);
    if (taper.end) f = Math.min(f, (1 - t) / TAPER_FRACTION);
    f = Math.max(0, Math.min(1, f));
    const smooth = f * f * (3 - 2 * f);
    return {
        x: lane.nx * lane.lane * spacing * smooth,
        y: lane.ny * lane.lane * spacing * smooth,
    };
}

/**
 * Desplazamiento de haz de un punto cualquiera del cable (p.ej. un punto del
 * tubo 3D o de la catenaria): se ubica en su tramo más cercano. `pin` = los
 * extremos del cable son objetos (se juntan ahí).
 */
export function bundleShiftAt(
    point: Point2D,
    points: Point2D[],
    lanes: WireLane[] | undefined,
    spacing: number,
    pin: { start?: boolean; end?: boolean } = { start: true, end: true },
): Point2D {
    if (!lanes || points.length < 2 || lanes.every((lane) => lane.lane === 0)) return { x: 0, y: 0 };
    let best = { k: 0, t: 0, d: Infinity };
    for (let k = 1; k < points.length; k++) {
        const a = points[k - 1];
        const b = points[k];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len2 = dx * dx + dy * dy;
        const t = len2 > 0 ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2)) : 0;
        const d = Math.hypot(a.x + dx * t - point.x, a.y + dy * t - point.y);
        if (d < best.d) best = { k: k - 1, t, d };
    }
    return laneShift(lanes[best.k], spacing, best.t, {
        start: best.k === 0 && pin.start,
        end: best.k === points.length - 2 && pin.end,
    });
}

/** Polilínea del cable muestreada y desplazada a su carril (juntándose en sus objetos). Para el PDF. */
export function bundledPolyline(
    points: Point2D[],
    lanes: WireLane[] | undefined,
    spacing: number,
    pin: { start?: boolean; end?: boolean } = { start: true, end: true },
    samplesPerSegment = 12,
): Point2D[] {
    if (!lanes || lanes.every((lane) => lane.lane === 0)) return points;
    const out: Point2D[] = [points[0]];
    for (let k = 1; k < points.length; k++) {
        const a = points[k - 1];
        const b = points[k];
        for (let s = 1; s <= samplesPerSegment; s++) {
            const t = s / samplesPerSegment;
            const shift = laneShift(lanes[k - 1], spacing, t, {
                start: k === 1 && pin.start,
                end: k === points.length - 1 && pin.end,
            });
            out.push({ x: a.x + (b.x - a.x) * t + shift.x, y: a.y + (b.y - a.y) * t + shift.y });
        }
    }
    return out;
}
