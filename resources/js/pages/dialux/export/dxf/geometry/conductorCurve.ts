/**
 * Curva real (ARC, nunca LINE) de un tramo de conductor — extraída de
 * `buildDialuxDxfExport.ts` en la Fase 8 para que el nuevo emitter de
 * conductores por lámina (`emitters/lighting.ts`) reutilice EXACTAMENTE la
 * misma matemática que el exportador en vivo, en vez de reinventarla como
 * una línea recta (ver [[dialux-dxf-conductors-must-be-arcs]] en memoria).
 *
 * Mismo comportamiento que antes de la extracción — verificado contra el
 * snapshot congelado de la Fase 0.
 */

import type { Pt } from '../emitters/primitives';

/**
 * Half-length (metres) of a wire-count tick mark perpendicular to the wire.
 * Reducido de 0.12 a pedido del usuario tras ver un export real: a 0.12
 * (0.24m de largo total) el tick quedaba más grande que el símbolo de
 * luminaria (`FIXTURE_SYMBOL_SIZE_M` en `emitters/lighting.ts`, 0.15m), y
 * el propio usuario lo señaló como "no está a escala".
 */
export const TICK_HALF = 0.05;

/** Spacing (metres) between adjacent tick marks along the wire. */
export const TICK_SPACING = 0.025;

/**
 * Compute the quadratic Bezier control point for a conductor segment.
 * Matches the canvas formula (OverlayWires.tsx): midpoint + perpendicular *
 * length * 0.18 * curveDir.
 *   curveDir = +1 bows the segment into an arc one way (floor routes).
 *   curveDir = -1 bows it the OPPOSITE way (wall/ceiling routes) — both
 *   route types curve, they just sweep in opposite directions, exactly like
 *   the editor canvas. curveDir must never be 0 here, or the cable renders
 *   as a straight LINE instead of the expected ARC.
 */
export function conductorCp(a: Pt, b: Pt, curveDir: number): Pt {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-6) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return {
        x: (a.x + b.x) / 2 + (-dy / len) * len * 0.18 * curveDir,
        y: (a.y + b.y) / 2 + (dx / len) * len * 0.18 * curveDir,
    };
}

/** Circumcircle of three points, or `null` when they are (near-)collinear. */
export function circumcircle(p1: Pt, p2: Pt, p3: Pt): { cx: number; cy: number; r: number } | null {
    const d = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
    if (Math.abs(d) < 1e-9) return null;
    const p1sq = p1.x * p1.x + p1.y * p1.y;
    const p2sq = p2.x * p2.x + p2.y * p2.y;
    const p3sq = p3.x * p3.x + p3.y * p3.y;
    const cx = (p1sq * (p2.y - p3.y) + p2sq * (p3.y - p1.y) + p3sq * (p1.y - p2.y)) / d;
    const cy = (p1sq * (p3.x - p2.x) + p2sq * (p1.x - p3.x) + p3sq * (p2.x - p1.x)) / d;
    return { cx, cy, r: Math.hypot(p1.x - cx, p1.y - cy) };
}

/** Angle (degrees, 0-360) from `center` to `pt`. */
function angleDeg(center: { cx: number; cy: number }, pt: Pt): number {
    const deg = (Math.atan2(pt.y - center.cy, pt.x - center.cx) * 180) / Math.PI;
    return deg < 0 ? deg + 360 : deg;
}

/** True if sweeping counter-clockwise from `start` to `end` (degrees) passes through `mid`. */
function arcSweepContainsAngle(start: number, end: number, mid: number): boolean {
    const sweep = (end - start + 360) % 360;
    const rel = (mid - start + 360) % 360;
    return rel <= sweep + 1e-6;
}

export type ConductorCurve =
    | { kind: 'line' }
    | { kind: 'arc'; cx: number; cy: number; r: number; startDeg: number; endDeg: number };

/**
 * Compute the true circular arc through `a`, the curve midpoint (derived from
 * the same control point formula the canvas uses) and `b`. Falls back to
 * `{ kind: 'line' }` only for degenerate (near-zero-length or collinear)
 * segments — never as a stylistic choice.
 */
export function computeConductorCurve(a: Pt, b: Pt, curveDir: number): ConductorCurve {
    const cp = conductorCp(a, b, curveDir);
    const mid: Pt = {
        x: 0.25 * a.x + 0.5 * cp.x + 0.25 * b.x,
        y: 0.25 * a.y + 0.5 * cp.y + 0.25 * b.y,
    };
    const circ = circumcircle(a, mid, b);
    if (!circ) return { kind: 'line' };

    const angA = angleDeg(circ, a);
    const angB = angleDeg(circ, b);
    const angMid = angleDeg(circ, mid);
    const [startDeg, endDeg] = arcSweepContainsAngle(angA, angB, angMid)
        ? [angA, angB]
        : [angB, angA];

    return { kind: 'arc', cx: circ.cx, cy: circ.cy, r: circ.r, startDeg, endDeg };
}
