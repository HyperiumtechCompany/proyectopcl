import type { Point2D } from './types';

/**
 * Convención de dibujo de cableado (2D y 3D, la misma en ambos): un tramo
 * SUBTERRÁNEO se arquea hacia la DERECHA del sentido de avance (A→B) y se
 * dibuja con línea de rayas ("líneas consecutivas"); uno AÉREO se arquea
 * hacia la IZQUIERDA y se dibuja sólido (sin rayas). Si en pantalla sale al
 * revés, basta invertir el signo de `cableBowSign`.
 */

/** Fracción del largo del tramo usada como amplitud del arco lateral. */
const BOW_FRACTION = 0.16;
/** Amplitud máxima del arco lateral (m) — un tramo largo no se abre más que esto. */
const BOW_MAX_M = 0.6;
/** Amplitud mínima (m) — un tramo corto igual se nota arqueado. */
const BOW_MIN_M = 0.06;

export type CableCurveSide = 'auto' | 'left' | 'right' | 'straight';

export function cableBowSign(mode: 'aerial' | 'underground'): 1 | -1 {
    return mode === 'underground' ? 1 : -1;
}

function bowAmplitudeM(lengthM: number): number {
    return Math.min(BOW_MAX_M, Math.max(BOW_MIN_M, lengthM * BOW_FRACTION));
}

/**
 * Punto a fracción `t` (0..1) del tramo A→B, desplazado perpendicular a su
 * sentido de avance — 0 en los extremos (A y B quedan exactos donde
 * estaban) y máximo a la mitad, con perfil seno (igual de suave que una
 * catenaria, pero horizontal). `a`/`b` en unidades de plano; `scaleM` las
 * pasa a metros reales para calcular la amplitud del arco.
 */
export function bowedPoint(
    a: Point2D,
    b: Point2D,
    scaleM: number,
    mode: 'aerial' | 'underground',
    t: number,
    side: CableCurveSide = 'auto',
    offsetM?: number,
): Point2D {
    // Extremos exactos: evita que el redondeo de punto flotante en sin(π·t)
    // deje un residuo minúsculo justo donde el cable debe tocar el artefacto.
    if (t <= 0) return a;
    if (t >= 1) return b;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const base = { x: a.x + dx * t, y: a.y + dy * t };
    if (side === 'straight') return base;
    const lenPlan = Math.hypot(dx, dy);
    if (lenPlan < 1e-9 || !(scaleM > 0)) return base;
    const ux = dx / lenPlan;
    const uy = dy / lenPlan;
    // Perpendicular al sentido de avance.
    const px = -uy;
    const py = ux;
    const lengthM = lenPlan * scaleM;
    const sign =
        side === 'left' ? -1 : side === 'right' ? 1 : cableBowSign(mode);
    const amplitudeM =
        typeof offsetM === 'number'
            ? Math.min(10, Math.max(BOW_MIN_M, offsetM))
            : bowAmplitudeM(lengthM);
    const ampPlan = (amplitudeM * sign) / scaleM;
    const s = Math.sin(Math.PI * t);
    return {
        x: base.x + px * ampPlan * s,
        y: base.y + py * ampPlan * s,
    };
}

/** Muestrea el tramo A→B en `n` puntos (extremos incluidos), ya arqueados. */
export function bowedSegmentPoints(
    a: Point2D,
    b: Point2D,
    scaleM: number,
    mode: 'aerial' | 'underground',
    n = 10,
    side: CableCurveSide = 'auto',
    offsetM?: number,
): Point2D[] {
    const pts: Point2D[] = [];
    for (let i = 0; i <= n; i++) {
        pts.push(bowedPoint(a, b, scaleM, mode, i / n, side, offsetM));
    }
    return pts;
}
