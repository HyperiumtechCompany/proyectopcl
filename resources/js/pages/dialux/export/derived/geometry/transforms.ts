import type { Vertex } from '@/pages/dialux/hooks/types';
import type { DialuxExportSnapshot } from '../../domain/types';

export interface Bounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

export interface Transform {
    scale: number;
    padX: number;
    padY: number;
    bounds: Bounds;
    width: number;
    height: number;
}

export function createBoundsFromVertices(vertices: Vertex[]): Bounds | null {
    if (vertices.length === 0) {
        return null;
    }

    return vertices.reduce<Bounds>(
        (accumulator, vertex) => ({
            minX: Math.min(accumulator.minX, vertex.x),
            minY: Math.min(accumulator.minY, vertex.y),
            maxX: Math.max(accumulator.maxX, vertex.x),
            maxY: Math.max(accumulator.maxY, vertex.y),
        }),
        {
            minX: Number.POSITIVE_INFINITY,
            minY: Number.POSITIVE_INFINITY,
            maxX: Number.NEGATIVE_INFINITY,
            maxY: Number.NEGATIVE_INFINITY,
        },
    );
}

export function expandBounds(bounds: Bounds, x: number, y: number): Bounds {
    return {
        minX: Math.min(bounds.minX, x),
        minY: Math.min(bounds.minY, y),
        maxX: Math.max(bounds.maxX, x),
        maxY: Math.max(bounds.maxY, y),
    };
}

export function mergeBounds(
    left: Bounds | null,
    right: Bounds | null,
): Bounds | null {
    if (!left) return right;
    if (!right) return left;
    return {
        minX: Math.min(left.minX, right.minX),
        minY: Math.min(left.minY, right.minY),
        maxX: Math.max(left.maxX, right.maxX),
        maxY: Math.max(left.maxY, right.maxY),
    };
}

export function buildSceneBounds(
    snapshot: DialuxExportSnapshot,
    dxfScale?: number,
    includeDxfExtents = false,
): Bounds {
    const scale = dxfScale ?? (snapshot.scaleConfig.factor * (snapshot.scaleConfig.calibrationFactor ?? 1));
    const hasDrawnElements = snapshot.rooms.length > 0 || snapshot.walls.length > 0;

    let dxfExtentBounds: Bounds | null = null;
    if (snapshot.dxfExtents && (!hasDrawnElements || includeDxfExtents)) {
        const eb: Bounds = {
            minX: snapshot.dxfExtents.min_x * scale,
            minY: snapshot.dxfExtents.min_y * scale,
            maxX: snapshot.dxfExtents.max_x * scale,
            maxY: snapshot.dxfExtents.max_y * scale,
        };
        const w = eb.maxX - eb.minX;
        const h = eb.maxY - eb.minY;
        if (w > 0.5 && h > 0.5 && w < 5000 && h < 5000) {
            dxfExtentBounds = eb;
        }
    }

    let bounds: Bounds | null = dxfExtentBounds;

    for (const room of snapshot.rooms) {
        bounds = mergeBounds(bounds, createBoundsFromVertices(room.vertices));
    }

    for (const wall of snapshot.walls) {
        bounds = mergeBounds(bounds, createBoundsFromVertices(wall.vertices));
    }

    for (const canopy of snapshot.canopies) {
        bounds = bounds
            ? expandBounds(
                  expandBounds(bounds, canopy.x1, canopy.y1),
                  canopy.x2,
                  canopy.y2,
              )
            : {
                  minX: Math.min(canopy.x1, canopy.x2),
                  minY: Math.min(canopy.y1, canopy.y2),
                  maxX: Math.max(canopy.x1, canopy.x2),
                  maxY: Math.max(canopy.y1, canopy.y2),
              };
    }

    for (const fixture of snapshot.fixtures) {
        bounds = bounds
            ? expandBounds(bounds, fixture.x, fixture.y)
            : {
                  minX: fixture.x,
                  minY: fixture.y,
                  maxX: fixture.x,
                  maxY: fixture.y,
              };
    }

    return (
        bounds ?? {
            minX: 0,
            minY: 0,
            maxX: 10,
            maxY: 10,
        }
    );
}

/**
 * Límites defensivos de escala (px por metro de mundo). Con los tamaños de
 * canvas actuales (800-1200px) ningún ambiente real los alcanza — solo
 * evitan un transform degenerado ante geometría patológica (un ambiente de
 * kilómetros o de un punto).
 */
export const MIN_TRANSFORM_SCALE = 0.5;
export const MAX_TRANSFORM_SCALE = 5000;

export function createTransform(
    bounds: Bounds,
    width: number,
    height: number,
    padding = 48,
): Transform {
    const safeWidth = Math.max(bounds.maxX - bounds.minX, 1);
    const safeHeight = Math.max(bounds.maxY - bounds.minY, 1);
    const drawableWidth = width - padding * 2;
    const drawableHeight = height - padding * 2;
    const rawScale = Math.min(
        drawableWidth / safeWidth,
        drawableHeight / safeHeight,
    );
    const scale = Math.max(
        MIN_TRANSFORM_SCALE,
        Math.min(MAX_TRANSFORM_SCALE, rawScale),
    );
    const contentWidth = safeWidth * scale;
    const contentHeight = safeHeight * scale;
    const padX = (width - contentWidth) / 2;
    const padY = (height - contentHeight) / 2;

    return { scale, padX, padY, bounds, width, height };
}

export function transformPoint(
    transform: Transform,
    point: { x: number; y: number },
): { x: number; y: number } {
    return {
        x: transform.padX + (point.x - transform.bounds.minX) * transform.scale,
        y:
            transform.height -
            transform.padY -
            (point.y - transform.bounds.minY) * transform.scale,
    };
}

export function dxfToMeters(
    rawX: number,
    rawY: number,
    dxfScale: number,
): { x: number; y: number } {
    return { x: rawX * dxfScale, y: rawY * dxfScale };
}
