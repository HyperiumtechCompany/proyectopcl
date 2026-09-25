import { closestPointOnPolygon, pointInPolygon } from './geometry';
import type { Point2D, SiteElement, SiteElementType, SiteLayer } from './types';

/**
 * Tipos que OCUPAN un espacio propio: no deben dibujarse unos encima de otros
 * (una rampa no invade a la escalera de al lado, un edificio no pisa una
 * cancha…). Quedan fuera los que hacen de fondo o cubren a otros (terreno,
 * plataformas, calles, zonas, techados) y los lineales/puntuales.
 */
export const EXCLUSIVE_SPACE_TYPES = new Set<SiteElementType>([
    'building_block',
    'ramp',
    'stair',
    'court',
    'parking',
    'pool',
    'sidewalk',
]);

export function isExclusiveSpace(type: SiteElementType): boolean {
    return EXCLUSIVE_SPACE_TYPES.has(type);
}

/** Polígonos de los espacios exclusivos visibles, salvo los ids indicados. */
export function exclusiveSpacePolygons(
    elements: SiteElement[],
    exceptIds: string[] = [],
    /** Capas del emplazamiento: un objeto en una capa OCULTA no bloquea (no se ve, no puede "chocar"). */
    layers?: SiteLayer[],
): Array<{ id: string; label: string; vertices: Point2D[] }> {
    const hidden = new Set(
        (layers ?? []).filter((l) => !l.visible).flatMap((l) => l.types),
    );
    return elements
        .filter(
            (el) =>
                isExclusiveSpace(el.type) &&
                !hidden.has(el.type) &&
                el.visible !== false &&
                el.vertices.length >= 3 &&
                !exceptIds.includes(el.id),
        )
        .map((el) => ({ id: el.id, label: el.label, vertices: el.vertices }));
}

/**
 * Si `point` cae DENTRO de alguno de los polígonos, lo saca por el borde más
 * cercano (más `marginUnits` hacia afuera para que no quede justo encima).
 * Se repite por si el borde nuevo cae dentro de otro vecino.
 */
export function pushOutsideSpaces(
    point: Point2D,
    polygons: Array<{ vertices: Point2D[] }>,
    marginUnits = 0,
): Point2D {
    let p = point;
    for (let pass = 0; pass < 4; pass++) {
        const host = polygons.find((poly) => pointInPolygon(p, poly.vertices));
        if (!host) return p;
        const hit = closestPointOnPolygon(p, host.vertices, true);
        if (!hit) return p;
        // Dirección de salida: del punto hacia su proyección en el borde, y un poco más allá.
        const dx = hit.point.x - p.x;
        const dy = hit.point.y - p.y;
        const len = Math.hypot(dx, dy);
        p =
            len > 1e-9
                ? {
                      x: hit.point.x + (dx / len) * marginUnits,
                      y: hit.point.y + (dy / len) * marginUnits,
                  }
                : hit.point;
    }
    return p;
}

function segmentsCross(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
    const o = (p: Point2D, q: Point2D, r: Point2D) =>
        (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const o1 = o(a, b, c);
    const o2 = o(a, b, d);
    const o3 = o(c, d, a);
    const o4 = o(c, d, b);
    return o1 * o2 < 0 && o3 * o4 < 0;
}

function polygonAreaAbs(p: Point2D[]): number {
    let a = 0;
    for (let i = 0; i < p.length; i++) {
        const q = p[(i + 1) % p.length];
        a += p[i].x * q.y - q.x * p[i].y;
    }
    return Math.abs(a) / 2;
}

/**
 * Fracción (0–1) del polígono MÁS PEQUEÑO que cubre el otro, por muestreo en
 * malla sobre la caja común. Evita dar por "choque" un roce o una arista que
 * apenas se cruza: solo cuenta la superposición de ÁREA.
 */
export function overlapFraction(a: Point2D[], b: Point2D[], grid = 40): number {
    const minX = Math.max(Math.min(...a.map((p) => p.x)), Math.min(...b.map((p) => p.x)));
    const maxX = Math.min(Math.max(...a.map((p) => p.x)), Math.max(...b.map((p) => p.x)));
    const minY = Math.max(Math.min(...a.map((p) => p.y)), Math.min(...b.map((p) => p.y)));
    const maxY = Math.min(Math.max(...a.map((p) => p.y)), Math.max(...b.map((p) => p.y)));
    if (maxX <= minX || maxY <= minY) return 0;
    let both = 0;
    for (let i = 0; i < grid; i++) {
        for (let j = 0; j < grid; j++) {
            const p = {
                x: minX + ((i + 0.5) / grid) * (maxX - minX),
                y: minY + ((j + 0.5) / grid) * (maxY - minY),
            };
            if (pointInPolygon(p, a) && pointInPolygon(p, b)) both += 1;
        }
    }
    const overlapArea = (both / (grid * grid)) * (maxX - minX) * (maxY - minY);
    const smaller = Math.min(polygonAreaAbs(a), polygonAreaAbs(b));
    return smaller > 0 ? overlapArea / smaller : 0;
}

/** Superposición mínima (fracción del objeto más pequeño) para considerarla un choque real. */
export const OVERLAP_MIN_FRACTION = 0.01;

/** ¿Se superponen dos polígonos? (aristas que se cruzan, o uno contenido en el otro) y de forma real, no un roce. */
export function polygonsOverlap(a: Point2D[], b: Point2D[]): boolean {
    if (a.length < 3 || b.length < 3) return false;
    for (let i = 0; i < a.length; i++) {
        const a1 = a[i];
        const a2 = a[(i + 1) % a.length];
        for (let j = 0; j < b.length; j++) {
            if (segmentsCross(a1, a2, b[j], b[(j + 1) % b.length])) return true;
        }
    }
    // Sin cruces: uno puede contener al otro. Se prueban los vértices encogidos hacia el centro
    // (un vértice compartido o una arista común caen "en el borde" y darían falsos positivos).
    const inside = (poly: Point2D[], other: Point2D[]) => {
        const cx = poly.reduce((sum, p) => sum + p.x, 0) / poly.length;
        const cy = poly.reduce((sum, p) => sum + p.y, 0) / poly.length;
        return poly.some((p) =>
            pointInPolygon({ x: p.x + (cx - p.x) * 0.02, y: p.y + (cy - p.y) * 0.02 }, other),
        );
    };
    return inside(a, b) || inside(b, a);
}

/** Igual que `polygonsOverlap`, pero exige superposición de ÁREA (≥ 1 % del objeto más pequeño). */
export function polygonsClash(a: Point2D[], b: Point2D[]): boolean {
    return polygonsOverlap(a, b) && overlapFraction(a, b) >= OVERLAP_MIN_FRACTION;
}

/** Espacios exclusivos con los que `vertices` se superpone. */
export function overlappingSpaces(
    vertices: Point2D[],
    polygons: Array<{ id: string; label: string; vertices: Point2D[] }>,
): Array<{ id: string; label: string }> {
    return polygons
        .filter((poly) => polygonsClash(vertices, poly.vertices))
        .map(({ id, label }) => ({ id, label }));
}
