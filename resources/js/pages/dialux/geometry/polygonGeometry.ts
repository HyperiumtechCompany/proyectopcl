/**
 * polygonGeometry.ts — Fuente única de verdad para geometría de polígonos.
 *
 * Todas las funciones operan sobre coordenadas del MUNDO (metros).
 * Nunca reciben píxeles de pantalla ni dependen de zoom/pan/devicePixelRatio.
 * Sin redondeos internos: la precisión completa se conserva; redondear solo
 * al presentar en UI o exportar.
 */

export interface WorldPoint {
    x: number;
    y: number;
}

export function polygonBounds(vertices: WorldPoint[]) {
    const ring = sanitizePolygon(vertices);
    if (ring.length === 0) {
        return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }
    const xs = ring.map((point) => point.x);
    const ys = ring.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/** Escala el poligono desde el centro de su caja envolvente. */
export function resizePolygonBounds(
    vertices: WorldPoint[],
    width: number,
    height: number,
): WorldPoint[] {
    const bounds = polygonBounds(vertices);
    if (
        bounds.width <= EPSILON ||
        bounds.height <= EPSILON ||
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0
    ) {
        return vertices.map((point) => ({ ...point }));
    }
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const scaleX = width / bounds.width;
    const scaleY = height / bounds.height;
    return vertices.map((point) => ({
        x: centerX + (point.x - centerX) * scaleX,
        y: centerY + (point.y - centerY) * scaleY,
    }));
}

export function rectangleFromPolygonBounds(
    vertices: WorldPoint[],
): WorldPoint[] {
    const bounds = polygonBounds(vertices);
    if (bounds.width <= EPSILON || bounds.height <= EPSILON) {
        return vertices.map((point) => ({ ...point }));
    }
    return [
        { x: bounds.minX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.maxY },
        { x: bounds.minX, y: bounds.maxY },
    ];
}

const EPSILON = 1e-9;

/** True si el punto tiene coordenadas finitas (no NaN/Infinity). */
export function isFinitePoint(
    p: WorldPoint | null | undefined,
): p is WorldPoint {
    return !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
}

/**
 * Normaliza un anillo de polígono para cálculo:
 *  - descarta puntos no finitos,
 *  - elimina vértices duplicados consecutivos,
 *  - elimina el vértice de cierre si repite al primero (el cierre es implícito).
 */
export function sanitizePolygon(vertices: WorldPoint[]): WorldPoint[] {
    const out: WorldPoint[] = [];
    for (const v of vertices) {
        if (!isFinitePoint(v)) continue;
        const prev = out[out.length - 1];
        if (
            prev &&
            Math.abs(prev.x - v.x) < EPSILON &&
            Math.abs(prev.y - v.y) < EPSILON
        ) {
            continue;
        }
        out.push(v);
    }
    if (out.length >= 2) {
        const first = out[0];
        const last = out[out.length - 1];
        if (
            Math.abs(first.x - last.x) < EPSILON &&
            Math.abs(first.y - last.y) < EPSILON
        ) {
            out.pop();
        }
    }
    return out;
}

/**
 * Área con signo (shoelace / Gauss). Positiva si el anillo es antihorario.
 * Entrada en metros → salida en m². Precisión completa, sin redondeos.
 */
export function polygonSignedArea(vertices: WorldPoint[]): number {
    const ring = sanitizePolygon(vertices);
    if (ring.length < 3) return 0;
    let sum = 0;
    for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        sum += a.x * b.y - b.x * a.y;
    }
    return sum / 2;
}

/**
 * Área absoluta del polígono en m².
 * Área = ½ |Σ(xᵢyᵢ₊₁ − xᵢ₊₁yᵢ)| sobre vértices en metros.
 */
export function polygonAreaM2(vertices: WorldPoint[]): number {
    return Math.abs(polygonSignedArea(vertices));
}

/** Perímetro del anillo cerrado en metros. */
export function polygonPerimeterM(vertices: WorldPoint[]): number {
    const ring = sanitizePolygon(vertices);
    if (ring.length < 2) return 0;
    let per = 0;
    for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        per += Math.hypot(b.x - a.x, b.y - a.y);
    }
    return per;
}

/**
 * Centroide del área del polígono (no el promedio de vértices).
 * Cae al promedio simple cuando el área es degenerada.
 */
export function polygonCentroid(vertices: WorldPoint[]): WorldPoint | null {
    const ring = sanitizePolygon(vertices);
    if (ring.length === 0) return null;
    const signed = polygonSignedArea(ring);
    if (Math.abs(signed) < EPSILON) {
        let sx = 0;
        let sy = 0;
        for (const p of ring) {
            sx += p.x;
            sy += p.y;
        }
        return { x: sx / ring.length, y: sy / ring.length };
    }
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        const cross = a.x * b.y - b.x * a.y;
        cx += (a.x + b.x) * cross;
        cy += (a.y + b.y) * cross;
    }
    return { x: cx / (6 * signed), y: cy / (6 * signed) };
}

/** Test punto-en-polígono por ray casting. Borde cuenta como dentro. */
export function pointInPolygon(
    point: WorldPoint,
    vertices: WorldPoint[],
): boolean {
    const ring = sanitizePolygon(vertices);
    if (ring.length < 3 || !isFinitePoint(point)) return false;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[i];
        const b = ring[j];
        // Punto exactamente sobre un borde → dentro
        if (distancePointToSegment(point, a, b) < EPSILON) return true;
        const intersects =
            a.y > point.y !== b.y > point.y &&
            point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
        if (intersects) inside = !inside;
    }
    return inside;
}

/** Distancia mínima de un punto a un segmento. */
export function distancePointToSegment(
    p: WorldPoint,
    a: WorldPoint,
    b: WorldPoint,
): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    const t =
        lenSq > 0
            ? Math.max(
                  0,
                  Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq),
              )
            : 0;
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Distancia mínima de un punto al borde del polígono (anillo cerrado). */
export function distanceToPolygonEdge(
    point: WorldPoint,
    vertices: WorldPoint[],
): number {
    const ring = sanitizePolygon(vertices);
    if (ring.length === 0 || !isFinitePoint(point)) return Infinity;
    if (ring.length === 1)
        return Math.hypot(point.x - ring[0].x, point.y - ring[0].y);
    let min = Infinity;
    for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        const d = distancePointToSegment(point, a, b);
        if (d < min) min = d;
    }
    return min;
}

/** Orientación/intersección propia de segmentos (excluye extremos compartidos). */
function segmentsIntersect(
    p1: WorldPoint,
    p2: WorldPoint,
    p3: WorldPoint,
    p4: WorldPoint,
): boolean {
    const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
    if (Math.abs(d) < EPSILON) return false;
    const t =
        ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
    const u =
        ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
    return t > EPSILON && t < 1 - EPSILON && u > EPSILON && u < 1 - EPSILON;
}

/** Detecta autointersecciones en el anillo (polígono no simple). O(n²), n pequeño. */
export function isSelfIntersecting(vertices: WorldPoint[]): boolean {
    const ring = sanitizePolygon(vertices);
    const n = ring.length;
    if (n < 4) return false;
    for (let i = 0; i < n; i++) {
        const a1 = ring[i];
        const a2 = ring[(i + 1) % n];
        for (let j = i + 1; j < n; j++) {
            // Saltar segmentos adyacentes (comparten vértice)
            if (j === i || (j + 1) % n === i || j === (i + 1) % n) continue;
            const b1 = ring[j];
            const b2 = ring[(j + 1) % n];
            if (segmentsIntersect(a1, a2, b1, b2)) return true;
        }
    }
    return false;
}

export interface PolygonValidation {
    valid: boolean;
    /** Motivos de invalidez, vacío si valid */
    errors: string[];
    /** Advertencias no bloqueantes (ej. autointersección) */
    warnings: string[];
}

/** Valida un anillo antes de persistirlo o calcular sobre él. */
export function validatePolygon(vertices: WorldPoint[]): PolygonValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (vertices.some((v) => !isFinitePoint(v))) {
        errors.push('El polígono contiene coordenadas no finitas (NaN/∞).');
    }
    const ring = sanitizePolygon(vertices);
    if (ring.length < 3) {
        errors.push('El polígono necesita al menos 3 vértices distintos.');
    } else if (polygonAreaM2(ring) < EPSILON) {
        errors.push('El polígono tiene área nula (vértices colineales).');
    }
    if (ring.length >= 4 && isSelfIntersecting(ring)) {
        warnings.push(
            'El polígono se autointerseca; el área calculada puede no ser la esperada.',
        );
    }
    return { valid: errors.length === 0, errors, warnings };
}
