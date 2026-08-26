import {
    pointInPolygon as pointInPolygonWorld,
    polygonAreaM2,
    polygonBounds,
    polygonPerimeterM,
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
