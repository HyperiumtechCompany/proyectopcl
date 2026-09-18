/**
 * Alumbrado exterior del emplazamiento — MODELO SIMPLIFICADO.
 *
 * Cada luminaria apunta hacia abajo con una distribución de intensidad
 * I(γ) = I0·cos^n(γ) (γ = ángulo respecto de la vertical), con `n` elegido para
 * que la intensidad caiga al 50 % en el "ángulo de haz" indicado, e I0 tal que
 * el flujo en el hemisferio inferior sea el de la luminaria. La iluminancia
 * horizontal en un punto es I(γ)·cosγ / d².
 *
 * Si la luminaria trae fotometría real (matriz IES/LDT del catálogo
 * compartido con v1), se interpola esa matriz en vez del modelo cos^n. Aun
 * así NO considera inclinación, obstáculos ni reflexiones, y no carga ninguna
 * norma de iluminancia exterior: es una estimación para ver cuánta luz da cada
 * poste y comparar alternativas, no un cálculo certificable.
 */
import { candelaFromPhotometricWeb } from '@/pages/dialux/hooks/photometricInterpolation';

export const DEFAULT_LUMINAIRE = {
    // Luminaria peatonal / de patio (antes 7000 lm, de vía: a 6 m daba ~88 lx
    // bajo el poste, deslumbrante para quien camina). Las de vía o
    // estacionamiento se eligen del catálogo o subiendo el flujo.
    lumens: 3000,
    beamDeg: 60,
    maintenance: 0.8,
    watts: 60,
} as const;

/** Luminaria en coordenadas de MUNDO 3D (metros; `y` = altura de la cabeza respecto del datum). */
export interface LuminaireSource {
    x: number;
    y: number;
    z: number;
    lumens: number;
    beamDeg: number;
    /** Factor de mantenimiento (0-1) que multiplica su aporte. */
    maintenance: number;
    /**
     * Fotometría real (IES/LDT): candelas de la matriz × `scale` (= lm de la
     * luminaria / flujo de referencia de la matriz). C0 apunta hacia el rumbo
     * `orientationRad` (el del brazo); en luminarias simétricas no importa.
     */
    photometry?: {
        web: {
            c_angles: number[];
            gamma_angles: number[];
            candela: number[][];
            reference_lumens?: number;
        };
        scale: number;
        orientationRad: number;
    };
}

export interface LuxGridSpec {
    minX: number;
    minZ: number;
    cell: number;
    cols: number;
    rows: number;
}

export interface LightingSummary {
    luminaires: number;
    fluxLm: number;
    avgLux: number;
    minLux: number;
    maxLux: number;
    /** Uniformidad U0 = E mínima / E media en el área analizada. */
    uniformity: number;
    areaM2: number;
}

/** Exponente `n` de I(γ)=I0·cos^n γ para que la intensidad sea el 50 % a `beamDeg`. */
export function beamExponent(beamDeg: number): number {
    const beta = (Math.min(85, Math.max(10, beamDeg)) * Math.PI) / 180;
    return Math.log(0.5) / Math.log(Math.cos(beta));
}

/** Intensidad máxima (cd) para que el hemisferio inferior reciba `lumens`. */
export function peakIntensityCd(lumens: number, n: number): number {
    return (lumens * (n + 1)) / (2 * Math.PI);
}

/** Iluminancia horizontal (lx, sin mantenimiento) en (px, py, pz) por una luminaria que apunta hacia abajo. */
export function illuminanceFrom(
    source: LuminaireSource,
    n: number,
    i0: number,
    px: number,
    py: number,
    pz: number,
): number {
    const dh = source.y - py;
    if (dh <= 0.01) return 0;
    const dx = source.x - px;
    const dz = source.z - pz;
    const d2 = dx * dx + dz * dz + dh * dh;
    const cosG = dh / Math.sqrt(d2);
    if (source.photometry) {
        const { web, scale, orientationRad } = source.photometry;
        const gammaDeg = (Math.acos(Math.min(1, cosG)) * 180) / Math.PI;
        // Rumbo del punto visto desde la luminaria, relativo a su orientación.
        let azimuthDeg =
            ((Math.atan2(-dx, -dz) - orientationRad) * 180) / Math.PI;
        azimuthDeg = ((azimuthDeg % 360) + 360) % 360;
        const candela =
            candelaFromPhotometricWeb(web, azimuthDeg, gammaDeg) *
            scale *
            source.maintenance;
        return (candela * cosG) / d2;
    }
    return (i0 * Math.pow(cosG, n) * cosG) / d2;
}

/**
 * Iluminancia mantenida (lx) en los vértices de una malla regular
 * (`(cols+1)·(rows+1)` valores, índice `j·(cols+1)+i`, x = minX+i·cell,
 * z = minZ+j·cell) sobre el suelo `groundY(x, z)`.
 */
export function computeLuxGrid(
    sources: LuminaireSource[],
    spec: LuxGridSpec,
    groundY: (x: number, z: number) => number,
): Float32Array {
    const stride = spec.cols + 1;
    const values = new Float32Array(stride * (spec.rows + 1));
    const prepared = sources.map((source) => {
        const n = beamExponent(source.beamDeg);
        return {
            source,
            n,
            i0: peakIntensityCd(source.lumens, n) * source.maintenance,
        };
    });
    for (let j = 0; j <= spec.rows; j++) {
        const z = spec.minZ + j * spec.cell;
        for (let i = 0; i <= spec.cols; i++) {
            const x = spec.minX + i * spec.cell;
            const y = groundY(x, z);
            let e = 0;
            for (const p of prepared) {
                e += illuminanceFrom(p.source, p.n, p.i0, x, y, z);
            }
            values[j * stride + i] = e;
        }
    }
    return values;
}

/** Estadística de los vértices donde `include(i, j)` es verdadero. */
export function summarizeLux(
    values: Float32Array,
    spec: LuxGridSpec,
    include: (i: number, j: number) => boolean,
    sources: LuminaireSource[],
): LightingSummary {
    const stride = spec.cols + 1;
    let count = 0;
    let sum = 0;
    let min = Infinity;
    let max = 0;
    for (let j = 0; j <= spec.rows; j++) {
        for (let i = 0; i <= spec.cols; i++) {
            if (!include(i, j)) continue;
            const e = values[j * stride + i];
            count += 1;
            sum += e;
            if (e < min) min = e;
            if (e > max) max = e;
        }
    }
    const avg = count > 0 ? sum / count : 0;
    return {
        luminaires: sources.length,
        fluxLm: sources.reduce((acc, s) => acc + s.lumens, 0),
        avgLux: avg,
        minLux: count > 0 ? min : 0,
        maxLux: max,
        uniformity: avg > 0 && count > 0 ? min / avg : 0,
        areaM2: count * spec.cell * spec.cell,
    };
}

const LUX_STOPS: Array<[number, [number, number, number, number]]> = [
    [0, [0.05, 0.1, 0.4, 0]],
    [1, [0.1, 0.2, 0.7, 0.35]],
    [5, [0.1, 0.7, 0.9, 0.5]],
    [10, [0.2, 0.85, 0.3, 0.55]],
    [20, [0.95, 0.9, 0.2, 0.6]],
    [50, [1, 0.55, 0.1, 0.65]],
    [100, [0.95, 0.15, 0.1, 0.7]],
];

/** Color RGBA (0-1) de la escala de lux del mapa de iluminancia: transparente en oscuridad, azul → verde → amarillo → rojo. */
export function luxColor(lux: number): [number, number, number, number] {
    if (lux <= LUX_STOPS[0][0]) return LUX_STOPS[0][1];
    for (let k = 1; k < LUX_STOPS.length; k++) {
        const [e1, c1] = LUX_STOPS[k];
        const [e0, c0] = LUX_STOPS[k - 1];
        if (lux <= e1) {
            const t = (lux - e0) / (e1 - e0);
            return [
                c0[0] + (c1[0] - c0[0]) * t,
                c0[1] + (c1[1] - c0[1]) * t,
                c0[2] + (c1[2] - c0[2]) * t,
                c0[3] + (c1[3] - c0[3]) * t,
            ];
        }
    }
    return LUX_STOPS[LUX_STOPS.length - 1][1];
}

/**
 * Flujo (lm) que necesita UNA luminaria para dar `targetLux` a `radiusM`
 * metros de la vertical del poste, a nivel del suelo (con su factor de
 * mantenimiento). La iluminancia es lineal en el flujo, así que basta
 * escalar. `null` si en ese punto la luminaria no da luz (p. ej. fuera de
 * su haz).
 */
export function lumensForTargetLux(
    source: LuminaireSource,
    radiusM: number,
    targetLux: number,
): number | null {
    const n = beamExponent(source.beamDeg);
    const i0 = peakIntensityCd(source.lumens, n) * source.maintenance;
    // Promedio de 8 direcciones: en luminarias asimétricas el aporte depende del rumbo.
    let e = 0;
    for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        e +=
            illuminanceFrom(
                source,
                n,
                i0,
                source.x + radiusM * Math.cos(a),
                0,
                source.z + radiusM * Math.sin(a),
            ) / 8;
    }
    if (!(e > 1e-9) || !(targetLux > 0)) return null;
    return (source.lumens * targetLux) / e;
}
