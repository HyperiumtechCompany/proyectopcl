import type { FenceConfig } from './types';

/**
 * Medidas de MODELADO del cerco. El espesor mínimo (0.12 m) es el "mínimo
 * operativo" que la app ya usa para muro de ladrillo (`hooks/wallNorms.ts`,
 * vivienda); NO es una cita de RNE E.070 ni de ordenanza municipal — esas
 * exigencias (espesor, altura, retiros) no tienen fuente cargada
 * (`normativa.md` §5b/§5c) y el sistema no las valida.
 */
export const FENCE_MODEL = {
    minThicknessM: 0.12,
    defaultThicknessM: 0.25,
    /** Sobresalen del paño a cada lado (m) y por encima de la corona (m). */
    pilasterExtraM: 0.12,
    pilasterRiseM: 0.1,
    /** Viga de coronación: alto (m) y vuelo total sobre el espesor (m). */
    capHeightM: 0.1,
    capExtraM: 0.08,
} as const;

export function fenceThicknessM(cfg: Pick<FenceConfig, 'thicknessM'> | undefined): number {
    const t = cfg?.thicknessM ?? FENCE_MODEL.defaultThicknessM;
    return Math.max(FENCE_MODEL.minThicknessM, Number.isFinite(t) ? t : FENCE_MODEL.defaultThicknessM);
}

/** Aclara un color #rrggbb mezclándolo con blanco (`amount` 0–1). */
export function lightenHex(hex: string, amount: number): string {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const mix = (c: number) => Math.round(c + (255 - c) * amount);
    const r = mix((n >> 16) & 255);
    const g = mix((n >> 8) & 255);
    const b = mix(n & 255);
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
