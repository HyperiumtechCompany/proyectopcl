/**
 * canvasUtils.ts — Utilidades compartidas por los overlays del canvas 2D
 *
 * Funciones puras: sin estado, sin efectos secundarios.
 * Exportadas para uso desde los sub-componentes del overlay SVG.
 */

import type { ScaleConfig, Wall } from '@/pages/dialux/hooks/types';

/** 
 * Factor de convesión efectivo: metros por cada unidad CAD.
 * Formula: metros_en_escena = valor_cad × effectiveScale
 *
 * El `factor` base depende de la unidad del CAD (0.001 para mm, 0.01 para cm, 1 para m).
 * El `calibrationFactor` ajusta la escala cuando el plano tiene factores no estándar.
 *
 * Ejemplo (caso típico):
 *   El usuario dibuja un cuadrado de área 3.39 m² en AutoCAD.
 *   Al medir un lado en el plano obtiene 1.58 ud CAD.
 *   El lado real del cuadrado es √3.39 ≈ 1.842 m.
 *   Por lo tanto:  effectiveScale = 1.842 / 1.58 ≈ 1.1658 m/ud_CAD
 *   Verificación: (1.58 × 1.1658)² ≈ 3.39 m²  ✓
 */
export function getEffectiveScale(scaleConfig?: ScaleConfig | null): number {
    if (!scaleConfig) return 1;
    const factor      = safeNum(scaleConfig.factor      || 1);
    const calibration = safeNum(scaleConfig.calibrationFactor || 1);
    return factor * calibration;
}

/** Convierte una magnitud en unidades CAD a metros de escena */
export function cadToMeters(cadVal: number, scaleConfig?: ScaleConfig | null): number {
    return safeNum(cadVal) * getEffectiveScale(scaleConfig);
}

/** Convierte una magnitud en metros de escena a unidades CAD */
export function metersToCad(meterVal: number, scaleConfig?: ScaleConfig | null): number {
    const scale = getEffectiveScale(scaleConfig);
    return scale > 0 ? safeNum(meterVal) / scale : safeNum(meterVal);
}

/**
 * Área de un cuadrado dado su lado (metros).
 * Útil para verificar calibraciones:  área = lado²
 * Inversa: lado = √área
 */
export function squareAreaFromSide(sideMeters: number): number {
    return safeNum(sideMeters) * safeNum(sideMeters);
}

/**
 * Lado de un cuadrado dado su área (metros).
 * squareSideFromArea(3.39) → 1.8439 m
 */
export function squareSideFromArea(areaM2: number): number {
    return areaM2 > 0 ? Math.sqrt(areaM2) : 0;
}

/**
 * Px por metro base (solo usado como fallback absoluto si el motor no responde).
 * En operación normal se usa la transformación de cámara nativa.
 */
export const FALLBACK_PXP_M = 60;

export function getCanvasScalePxPerMeter(_scaleConfig?: ScaleConfig): number {
    return FALLBACK_PXP_M;
}

/**
 * Convierte un valor a número seguro, devolviendo 0 si es NaN/undefined/null.
 * Evita que SVG reciba atributos "NaN" que causan warnings.
 */
export function safeNum(val: unknown): number {
    const n = Number(val);
    return isFinite(n) ? n : 0;
}

/** Convierte array de puntos {x,y} a string SVG "x1,y1 x2,y2 ..." */
export function pointsToSvgString(points: { x: number; y: number }[]): string {
    return points.map((p) => `${safeNum(p.x)},${safeNum(p.y)}`).join(' ');
}

/**
 * Genera el string SVG de puntos para los vértices de una pared.
 * Soporta tanto el formato nuevo (vertices[]) como el legacy (x1,y1,x2,y2).
 */
export function wallVertStr(
    wall: Wall,
    toScreen: (p: { x: number; y: number }) => { x: number; y: number },
): string {
    const verts = wall.vertices;
    return verts
        .map((v) => toScreen({ x: safeNum(v.x), y: safeNum(v.y) }))
        .map((p) => `${safeNum(p.x)},${safeNum(p.y)}`)
        .join(' ');
}

export function wallLengthM(wall: Wall): number {
    const verts = wall.vertices;
    if (verts.length < 2) return 0;

    let len = 0;
    for (let i = 1; i < verts.length; i++) {
        len += Math.hypot(
            verts[i].x - verts[i - 1].x,
            verts[i].y - verts[i - 1].y,
        );
    }
    return len;
}

/** Centroide de una lista de puntos */
export function centroid(points: { x: number; y: number }[]): {
    x: number;
    y: number;
} {
    if (points.length === 0) return { x: 0, y: 0 };
    let sx = 0;
    let sy = 0;
    for (const p of points) {
        sx += p.x;
        sy += p.y;
    }
    return { x: sx / points.length, y: sy / points.length };
}

/**
 * Grosor de pared en píxeles de pantalla.
 * Mínimo 3px para siempre ser visible.
 * Máximo 20px para que nunca se dibuje como bloque sólido.
 */
export function wallThickPx(
    thickness: number,
    screenDistance: (
        dx: number,
        dy: number,
        origin: { x: number; y: number },
    ) => number,
    origin: { x: number; y: number },
): number {
    return Math.min(20, Math.max(3, screenDistance(safeNum(thickness), 0, origin)));
}
