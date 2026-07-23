import type { Fixture, Room, Wall } from '@/pages/dialux/hooks/types';
import type { DxfBounds, DxfLevelBasePlan } from '../domain/types';

const EMPTY_BOUNDS_FALLBACK: DxfBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };

/** Límites reales (metros) de un nivel: recintos + muros + luminarias + fondo CAD. */
export function computeLevelBounds(
    rooms: Room[],
    walls: Wall[],
    fixtures: Fixture[],
    basePlan: DxfLevelBasePlan,
): DxfBounds {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const points: Array<{ x: number; y: number }> = [
        ...rooms.flatMap((room) => room.vertices),
        ...walls.flatMap((wall) => wall.vertices),
        ...fixtures.map((fixture) => ({ x: fixture.x, y: fixture.y })),
    ];
    if (basePlan.extents) {
        points.push({ x: basePlan.extents.min_x, y: basePlan.extents.min_y });
        points.push({ x: basePlan.extents.max_x, y: basePlan.extents.max_y });
    }

    for (const point of points) {
        if (Number.isFinite(point.x)) {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
        }
        if (Number.isFinite(point.y)) {
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        }
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
        return EMPTY_BOUNDS_FALLBACK;
    }

    return { minX, minY, maxX, maxY };
}

/** Traslada un `DxfBounds` por (dx, dy) — usado al ubicar una lámina en su posición final (Fase 8, sección 13). */
export function translateBounds(bounds: DxfBounds, dx: number, dy: number): DxfBounds {
    return {
        minX: bounds.minX + dx, minY: bounds.minY + dy,
        maxX: bounds.maxX + dx, maxY: bounds.maxY + dy,
    };
}

/** Unión de dos `DxfBounds`. */
export function unionBounds(a: DxfBounds, b: DxfBounds): DxfBounds {
    return {
        minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY),
        maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY),
    };
}

/** Unión de una lista de `DxfBounds` (Fase 8, sección 14.1: "calcular la unión de todos los frameBounds"). */
export function unionBoundsList(list: DxfBounds[]): DxfBounds | null {
    if (list.length === 0) return null;
    return list.reduce((acc, bounds) => unionBounds(acc, bounds));
}
