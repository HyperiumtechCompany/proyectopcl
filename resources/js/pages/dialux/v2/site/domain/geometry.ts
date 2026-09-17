import {
    pointInPolygon as pointInPolygonWorld,
    polygonAreaM2,
    polygonBounds,
    polygonPerimeterM,
    polygonSignedArea,
} from '@/pages/dialux/geometry/polygonGeometry';
import type { Point2D } from './types';

/** Área del polígono en m² (fórmula de Shoelace). */
export function polygonArea(vertices: Point2D[]): number {
    return polygonAreaM2(vertices);
}

/** Perímetro del polígono cerrado en metros. */
export function polygonPerimeter(vertices: Point2D[]): number {
    return polygonPerimeterM(vertices);
}

/** Longitud total de una polilínea abierta (p.ej. el trazado de un alimentador). */
export function polylineLength(points: Point2D[]): number {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
        total += Math.hypot(
            points[i].x - points[i - 1].x,
            points[i].y - points[i - 1].y,
        );
    }
    return total;
}

/** Test de inclusión punto-en-polígono (borde cuenta como dentro). */
export function pointInPolygon(point: Point2D, vertices: Point2D[]): boolean {
    return pointInPolygonWorld(point, vertices);
}

/** Caja envolvente de un conjunto de vértices. */
export function boundingBox(vertices: Point2D[]): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
} {
    return polygonBounds(vertices);
}

/** Ajusta un punto a la cuadrícula más cercana (gridSize en las mismas unidades que el punto). */
export function snapToGrid(point: Point2D, gridSize: number): Point2D {
    if (gridSize <= 0) return point;
    return {
        x: Math.round(point.x / gridSize) * gridSize,
        y: Math.round(point.y / gridSize) * gridSize,
    };
}

export interface ClosestPolygonPoint {
    point: Point2D;
    /** Vector del lado sobre el que cae `point` (sin normalizar) — de A a B. */
    tangent: Point2D;
}

/**
 * Punto más cercano sobre el perímetro de un polígono cerrado (probando
 * cada lado, incluido el que cierra del último vértice al primero) — usado
 * para "pegar" un objeto puntual (ej. un portón) sobre el cerco al que está
 * vinculado en vez de depender de que el usuario lo alinee a mano.
 */
export function closestPointOnPolygon(
    point: Point2D,
    vertices: Point2D[],
): ClosestPolygonPoint | undefined {
    if (vertices.length < 2) return undefined;
    let best: (ClosestPolygonPoint & { distSq: number }) | undefined;
    for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i];
        const b = vertices[(i + 1) % vertices.length];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy || 1;
        const t = Math.max(
            0,
            Math.min(
                1,
                ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq,
            ),
        );
        const px = a.x + dx * t;
        const py = a.y + dy * t;
        const distSq = (point.x - px) ** 2 + (point.y - py) ** 2;
        if (!best || distSq < best.distSq) {
            best = {
                point: { x: px, y: py },
                tangent: { x: dx, y: dy },
                distSq,
            };
        }
    }
    if (!best) return undefined;
    return { point: best.point, tangent: best.tangent };
}

function edgeOutwardNormal(a: Point2D, b: Point2D, ccw: boolean): Point2D {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    // Antihorario (área con signo > 0): afuera = girar la dirección del lado
    // -90°. Horario: afuera = girar +90°. Se detecta el sentido en vez de
    // exigírselo al usuario (dibuja libremente en cualquier orden).
    return ccw ? { x: uy, y: -ux } : { x: -uy, y: ux };
}

/**
 * Para cada vértice de un polígono (convexo o cóncavo), la dirección hacia
 * "afuera" — el promedio (bisectriz) de las normales de sus dos lados
 * vecinos, con el factor de inglete (`1/cos(ángulo/2)`) ya aplicado, así que
 * `vertice + direccion[i] * distancia` da el desplazamiento perpendicular
 * correcto respecto a AMBOS lados.
 *
 * Reemplaza un desplazamiento "radial desde el centroide" (que solo
 * funciona en huellas convexas — en una cóncava, un vértice interior puede
 * desplazarse hacia el lado equivocado y cruzar el resto del polígono,
 * generando una malla que se autointerseca). El factor de inglete se acota
 * (`miterLimit`) para no disparar un pico absurdo en un vértice muy agudo.
 */
export function outwardMiterDirections(
    vertices: Point2D[],
    miterLimit = 4,
): Point2D[] {
    const n = vertices.length;
    if (n < 3) return vertices.map(() => ({ x: 0, y: 0 }));
    const ccw = polygonSignedArea(vertices) > 0;
    const edgeNormals = vertices.map((a, i) =>
        edgeOutwardNormal(a, vertices[(i + 1) % n], ccw),
    );
    return vertices.map((_, i) => {
        const nPrev = edgeNormals[(i - 1 + n) % n];
        const nNext = edgeNormals[i];
        const bx = nPrev.x + nNext.x;
        const by = nPrev.y + nNext.y;
        const blen = Math.hypot(bx, by);
        if (blen < 1e-9) return nNext; // lados casi opuestos: sin inglete posible
        const ubx = bx / blen;
        const uby = by / blen;
        const dot = ubx * nNext.x + uby * nNext.y;
        const scale = Math.min(miterLimit, 1 / Math.max(1e-6, dot));
        return { x: ubx * scale, y: uby * scale };
    });
}
