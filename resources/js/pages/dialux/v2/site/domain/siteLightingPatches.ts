import { pointInPolygon } from '@/pages/dialux/geometry/polygonGeometry';
import type { LightingResult } from '@/pages/dialux/hooks/types';
import type { SiteLightingPatch } from './siteLightingCalculation';
import type { Point2D } from './types';

/**
 * Geometría de los PARCHES de una superficie de cálculo exterior (extraído
 * de `siteLightingCalculation.ts`): una superficie con desnivel se divide en
 * rectángulos recortados a su contorno, cada uno calculado a su cota; los
 * puntos que pertenecen a otra superficie más específica se anulan y la
 * estadística se toma sobre todos los parches.
 */

/** Desnivel (m) a partir del cual una superficie se calcula en parches. */
export const PATCH_ELEVATION_TOLERANCE_M = 0.25;
/** Tope de parches por superficie (el lado del parche crece en áreas enormes). */
export const MAX_PATCHES = 64;
const MIN_PATCH_SIDE_M = 8;
/** Muestras por lado para leer la cota de una superficie. */
const ELEVATION_SAMPLES = 24;

export interface Bounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

export interface PlannedPatch extends Bounds {
    vertices: Point2D[];
    baseElevationM: number;
}

/** Recorta un polígono con un rectángulo (Sutherland–Hodgman; el recorte es convexo). */
export function clipPolygonToRect(polygon: Point2D[], rect: Bounds): Point2D[] {
    const edges: Array<[(p: Point2D) => boolean, (a: Point2D, b: Point2D) => Point2D]> = [
        [(p) => p.x >= rect.minX, (a, b) => lerpAt(a, b, (rect.minX - a.x) / (b.x - a.x))],
        [(p) => p.x <= rect.maxX, (a, b) => lerpAt(a, b, (rect.maxX - a.x) / (b.x - a.x))],
        [(p) => p.y >= rect.minY, (a, b) => lerpAt(a, b, (rect.minY - a.y) / (b.y - a.y))],
        [(p) => p.y <= rect.maxY, (a, b) => lerpAt(a, b, (rect.maxY - a.y) / (b.y - a.y))],
    ];
    let output = polygon;
    for (const [inside, cut] of edges) {
        const input = output;
        output = [];
        for (let i = 0; i < input.length; i++) {
            const current = input[i];
            const previous = input[(i + input.length - 1) % input.length];
            if (inside(current)) {
                if (!inside(previous)) output.push(cut(previous, current));
                output.push(current);
            } else if (inside(previous)) {
                output.push(cut(previous, current));
            }
        }
        if (output.length === 0) break;
    }
    return output;
}

function lerpAt(a: Point2D, b: Point2D, t: number): Point2D {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Cotas de las muestras de `bounds` que caen en el polígono y son de la superficie. */
export function sampleElevations(
    vertices: Point2D[],
    bounds: Bounds,
    samples: number,
    owns: (xM: number, yM: number) => boolean,
    elevationAt: (xM: number, yM: number) => number,
): number[] {
    const values: number[] = [];
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    for (let i = 0; i < samples; i++) {
        for (let j = 0; j < samples; j++) {
            const x = bounds.minX + ((i + 0.5) / samples) * w;
            const y = bounds.minY + ((j + 0.5) / samples) * h;
            if (!pointInPolygon({ x, y }, vertices) || !owns(x, y)) continue;
            values.push(elevationAt(x, y));
        }
    }
    return values;
}

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

/**
 * Divide la superficie en parches planos: uno solo si su desnivel es menor
 * que `PATCH_ELEVATION_TOLERANCE_M`; si no, una grilla de rectángulos (lado ≥
 * 8 m, máx. 64) recortados al contorno, cada uno a la cota media de sus
 * puntos propios.
 */
export function planPatches(
    vertices: Point2D[],
    bounds: Bounds,
    owns: (xM: number, yM: number) => boolean,
    elevationAt: (xM: number, yM: number) => number,
): { patches: PlannedPatch[]; tiled: boolean; elevationRangeM: number } {
    const elevations = sampleElevations(vertices, bounds, ELEVATION_SAMPLES, owns, elevationAt);
    if (elevations.length === 0) {
        // Superficie más chica que la muestra: se calcula entera a su centroide.
        const c = centroidOf(vertices);
        if (!owns(c.x, c.y)) return { patches: [], tiled: false, elevationRangeM: 0 };
        return {
            patches: [{ ...bounds, vertices, baseElevationM: elevationAt(c.x, c.y) }],
            tiled: false,
            elevationRangeM: 0,
        };
    }
    const range = Math.max(...elevations) - Math.min(...elevations);
    if (range <= PATCH_ELEVATION_TOLERANCE_M) {
        return {
            patches: [{ ...bounds, vertices, baseElevationM: mean(elevations) }],
            tiled: false,
            elevationRangeM: range,
        };
    }
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    const side = Math.max(MIN_PATCH_SIDE_M, Math.sqrt((w * h) / MAX_PATCHES));
    const cols = Math.max(1, Math.ceil(w / side));
    const rows = Math.max(1, Math.ceil(h / side));
    const patches: PlannedPatch[] = [];
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            const rect = {
                minX: bounds.minX + (i * w) / cols,
                maxX: bounds.minX + ((i + 1) * w) / cols,
                minY: bounds.minY + (j * h) / rows,
                maxY: bounds.minY + ((j + 1) * h) / rows,
            };
            const clipped = clipPolygonToRect(vertices, rect);
            if (clipped.length < 3) continue;
            const local = sampleElevations(clipped, rect, 5, owns, elevationAt);
            if (local.length === 0) continue;
            patches.push({ ...rect, vertices: clipped, baseElevationM: mean(local) });
        }
    }
    return { patches, tiled: patches.length > 1, elevationRangeM: range };
}

/** Anula los puntos de la malla que pertenecen a otra superficie de cálculo. */
export function maskGrid(
    result: LightingResult,
    owns: (xM: number, yM: number) => boolean,
): LightingResult {
    const ox = result.grid_origin_x ?? 0;
    const oy = result.grid_origin_y ?? 0;
    const cw = result.grid_cell_width ?? 0;
    const ch = result.grid_cell_height ?? 0;
    if (cw <= 0 || ch <= 0) return result;
    let changed = false;
    const values = result.grid_values.map((value, index) => {
        if (value === null) return null;
        const row = Math.floor(index / result.grid_cols);
        const col = index % result.grid_cols;
        if (owns(ox + (col + 0.5) * cw, oy + (row + 0.5) * ch)) return value;
        changed = true;
        return null;
    });
    return changed ? { ...result, grid_values: values } : result;
}

/** Ēm/Emín/Emáx/U0 sobre los puntos de todos los parches (y la cota media ponderada). */
export function patchStats(patches: SiteLightingPatch[]) {
    let sum = 0;
    let count = 0;
    let min = Infinity;
    let max = -Infinity;
    let elevationSum = 0;
    for (const patch of patches) {
        for (const value of patch.result.grid_values) {
            if (value === null) continue;
            sum += value;
            count += 1;
            min = Math.min(min, value);
            max = Math.max(max, value);
            elevationSum += patch.baseElevationM;
        }
    }
    if (count === 0) return null;
    const avg = sum / count;
    return {
        avg,
        min,
        max,
        uniformity: avg > 0 ? min / avg : 0,
        weightedElevationM: elevationSum / count,
    };
}

function centroidOf(vertices: Point2D[]): Point2D {
    const n = vertices.length || 1;
    return {
        x: vertices.reduce((sum, v) => sum + v.x, 0) / n,
        y: vertices.reduce((sum, v) => sum + v.y, 0) / n,
    };
}
