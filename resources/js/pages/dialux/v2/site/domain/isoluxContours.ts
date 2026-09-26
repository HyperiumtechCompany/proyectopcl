import type { LightingResult } from '@/pages/dialux/hooks/types';
import type { Point2D } from './types';

/**
 * Curvas ISOLUX (líneas de igual iluminancia, como las "isolíneas" de
 * DIALux) a partir de la malla calculada por el motor V1: marching squares
 * sobre los puntos (centros de celda), interpolación lineal en las aristas,
 * y unión de segmentos en polilíneas para dibujarlas y rotularlas. Una celda
 * con algún punto sin valor (fuera de la superficie o de otra superficie) no
 * genera curva.
 */

export const DEFAULT_ISOLUX_LEVELS = [1, 2, 5, 10, 20, 30, 50, 75, 100, 150, 200, 300, 500];

export interface IsoluxLine {
    level: number;
    /** Puntos en METROS (mismo sistema que la malla del motor). */
    points: Point2D[];
    closed: boolean;
}

type Segment = [Point2D, Point2D];

/** Niveles que efectivamente cruzan la malla (entre su mínimo y máximo). */
export function isoluxLevelsFor(values: Array<number | null>, levels = DEFAULT_ISOLUX_LEVELS): number[] {
    const numbers = values.filter((value): value is number => value !== null);
    if (numbers.length === 0) return [];
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    return levels.filter((level) => level > min && level < max);
}

export function isoluxContours(result: LightingResult, levels?: number[]): IsoluxLine[] {
    const cols = result.grid_cols;
    const rows = Math.round(result.grid_values.length / Math.max(1, cols));
    const cw = result.grid_cell_width ?? 0;
    const ch = result.grid_cell_height ?? 0;
    if (cols < 2 || rows < 2 || cw <= 0 || ch <= 0) return [];
    const ox = (result.grid_origin_x ?? 0) + cw / 2;
    const oy = (result.grid_origin_y ?? 0) + ch / 2;
    const value = (r: number, c: number) => result.grid_values[r * cols + c];
    const at = (r: number, c: number) => ({ x: ox + c * cw, y: oy + r * ch });
    const lines: IsoluxLine[] = [];
    for (const level of levels ?? isoluxLevelsFor(result.grid_values)) {
        const segments: Segment[] = [];
        for (let r = 0; r < rows - 1; r++) {
            for (let c = 0; c < cols - 1; c++) {
                const v = [value(r, c), value(r, c + 1), value(r + 1, c + 1), value(r + 1, c)];
                if (v.some((item) => item === null)) continue;
                const [a, b, cc, d] = v as number[];
                const p = [at(r, c), at(r, c + 1), at(r + 1, c + 1), at(r + 1, c)];
                const lerp = (i: number, j: number): Point2D => {
                    const vi = [a, b, cc, d][i];
                    const vj = [a, b, cc, d][j];
                    const t = vj === vi ? 0.5 : (level - vi) / (vj - vi);
                    return { x: p[i].x + (p[j].x - p[i].x) * t, y: p[i].y + (p[j].y - p[i].y) * t };
                };
                const code = (a >= level ? 8 : 0) | (b >= level ? 4 : 0) | (cc >= level ? 2 : 0) | (d >= level ? 1 : 0);
                // Aristas: 0 = arriba (0-1), 1 = derecha (1-2), 2 = abajo (2-3), 3 = izquierda (3-0).
                const edge = (e: number) => [lerp(0, 1), lerp(1, 2), lerp(2, 3), lerp(3, 0)][e];
                const center = (a + b + cc + d) / 4;
                const pairs: Array<[number, number]> = (() => {
                    switch (code) {
                        case 0:
                        case 15:
                            return [];
                        case 1:
                        case 14:
                            return [[2, 3]];
                        case 2:
                        case 13:
                            return [[1, 2]];
                        case 3:
                        case 12:
                            return [[1, 3]];
                        case 4:
                        case 11:
                            return [[0, 1]];
                        case 6:
                        case 9:
                            return [[0, 2]];
                        case 7:
                        case 8:
                            return [[0, 3]];
                        case 5:
                            // Silla: se desempata con el promedio de la celda.
                            return center >= level ? [[0, 3], [1, 2]] : [[0, 1], [2, 3]];
                        case 10:
                            return center >= level ? [[0, 1], [2, 3]] : [[0, 3], [1, 2]];
                        default:
                            return [];
                    }
                })();
                for (const [e1, e2] of pairs) segments.push([edge(e1), edge(e2)]);
            }
        }
        lines.push(...joinSegments(segments).map((line) => ({ level, ...line })));
    }
    return lines;
}

/** Une segmentos que comparten extremos en polilíneas (abiertas o cerradas). */
function joinSegments(segments: Segment[]): Array<{ points: Point2D[]; closed: boolean }> {
    const key = (p: Point2D) => `${p.x.toFixed(5)},${p.y.toFixed(5)}`;
    const byEnd = new Map<string, number[]>();
    segments.forEach(([a, b], index) => {
        for (const p of [a, b]) byEnd.set(key(p), [...(byEnd.get(key(p)) ?? []), index]);
    });
    const used = new Set<number>();
    const result: Array<{ points: Point2D[]; closed: boolean }> = [];
    const extend = (points: Point2D[]) => {
        for (;;) {
            const tail = points[points.length - 1];
            const next = (byEnd.get(key(tail)) ?? []).find((index) => !used.has(index));
            if (next === undefined) return;
            used.add(next);
            const [a, b] = segments[next];
            points.push(key(a) === key(tail) ? b : a);
        }
    };
    segments.forEach(([a, b], index) => {
        if (used.has(index)) return;
        used.add(index);
        const forward = [a, b];
        extend(forward);
        const backward = [a];
        extend(backward);
        const points = [...backward.slice(1).reverse(), ...forward];
        const closed = points.length > 3 && key(points[0]) === key(points[points.length - 1]);
        result.push({ points, closed });
    });
    return result;
}

/** Punto donde rotular una curva (el vértice del medio). */
export function labelPoint(line: IsoluxLine): Point2D {
    return line.points[Math.floor(line.points.length / 2)];
}

export function formatIsoluxLevel(level: number): string {
    return level >= 10 ? String(Math.round(level)) : String(level);
}

const NICE_SERIES = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];

/** Paso "redondo" (1-2-2,5-5 × 10ⁿ) para `span / divisions`. */
function niceStep(span: number, divisions: number): number {
    const raw = span / Math.max(1, divisions);
    const power = 10 ** Math.floor(Math.log10(raw));
    const unit = raw / power;
    return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10) * power;
}

/**
 * Niveles de curvas PROPIOS de un espacio: la serie 1-2-5 dentro de su rango
 * real (Emín…Emáx de todos sus parches); si el rango es angosto (menos de 4
 * niveles de la serie), escalones lineales "redondos". Así una vereda de
 * 5–15 lx y una cancha de 100–500 lx tienen cada una curvas legibles, y todos
 * los parches de un espacio usan los MISMOS niveles.
 */
export function areaIsoluxLevels(results: LightingResult[], maxLines = 8): number[] {
    const values = results.flatMap((result) =>
        result.grid_values.filter((value): value is number => value !== null),
    );
    if (values.length === 0) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (!(max > min)) return [];
    let levels = NICE_SERIES.filter((level) => level > min && level < max);
    if (levels.length < 4) {
        const step = niceStep(max - min, 6);
        levels = [];
        for (let level = Math.ceil(min / step) * step; level < max; level += step) {
            if (level > min) levels.push(Number(level.toFixed(6)));
        }
    }
    // Demasiadas curvas: una de cada k (conservando la más baja).
    const k = Math.ceil(levels.length / maxLines);
    return levels.filter((_, index) => index % k === 0);
}

export interface AreaIsolines {
    /** Niveles propios del espacio (sin la norma). */
    levels: number[];
    /** Ē exigido por la norma del espacio (elegida o sugerida), si la hay. */
    requiredLux: number | null;
    /** Curvas: `required` = la curva del valor exigido (se dibuja destacada). */
    lines: Array<IsoluxLine & { required: boolean }>;
}

const areaCache = new WeakMap<LightingResult, Map<string, AreaIsolines>>();

/**
 * Curvas de UN espacio: niveles propios de su rango (`areaIsoluxLevels`) + la
 * curva del Ē exigido por su norma, para medir el espacio contra su
 * requisito. Caché por la malla del primer parche (cambia con cada cálculo).
 */
export function areaIsolines(results: LightingResult[], requiredLux: number | null): AreaIsolines {
    const key = `${requiredLux ?? ''}`;
    const first = results[0];
    const cached = first ? areaCache.get(first)?.get(key) : undefined;
    if (cached) return cached;
    const levels = areaIsoluxLevels(results);
    const lines: AreaIsolines['lines'] = [];
    for (const result of results) {
        for (const line of isoluxContours(result, levels.filter((level) => level !== requiredLux))) {
            lines.push({ ...line, required: false });
        }
        if (requiredLux && requiredLux > 0) {
            for (const line of isoluxContours(result, [requiredLux])) {
                lines.push({ ...line, required: true });
            }
        }
    }
    const value: AreaIsolines = { levels, requiredLux: requiredLux && requiredLux > 0 ? requiredLux : null, lines };
    if (first) {
        const map = areaCache.get(first) ?? new Map<string, AreaIsolines>();
        map.set(key, value);
        areaCache.set(first, map);
    }
    return value;
}

