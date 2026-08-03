import type { Fixture } from './useEditorStore';

/**
 * Interpolación de la matriz fotométrica (IES/LDT ya normalizados a
 * `Fixture.photometricWeb`) — extraído de `lightingEngineCore.ts` (Fase 5
 * del plan maestro, "Extraer interpolación fotométrica") sin cambiar
 * ninguna fórmula. Único punto de entrada real: `candela(fixture, gammaDeg,
 * azimuthDeg)`; el resto de funciones son detalle interno, exportadas solo
 * para poder probarlas de forma aislada.
 */

const MATH_PI = Math.PI;

/** Interpola linealmente `values` (definidos en `points`, ascendentes) en `target`, con clamp en los extremos. */
export function interpolate1D(values: number[], points: number[], target: number): number {
    if (points.length === 0) {
        return 0;
    }
    if (points.length === 1) {
        return values[0] ?? 0;
    }
    if (target <= points[0]) {
        return values[0];
    }
    if (target >= points[points.length - 1]) {
        return values[values.length - 1];
    }

    for (let i = 0; i < points.length - 1; i++) {
        if (target >= points[i] && target <= points[i + 1]) {
            const span = points[i + 1] - points[i];
            const t = span > 0 ? (target - points[i]) / span : 0;
            return values[i] + (values[i + 1] - values[i]) * t;
        }
    }

    return values[values.length - 1];
}

/**
 * Repliega un azimut arbitrario [0,360) al rango de C-planos disponible en el archivo IES/LDT
 * (los fabricantes suelen publicar solo un cuarto o una mitad de la solución fotométrica
 * cuando la luminaria es simétrica).
 */
export function foldAzimuthToCRange(azimuthDeg: number, maxC: number): number {
    let a = azimuthDeg % 360;
    if (a < 0) {
        a += 360;
    }

    if (maxC <= 90.01) {
        a %= 180;
        if (a > 90) {
            a = 180 - a;
        }
        return Math.min(a, maxC);
    }

    if (maxC <= 180.01) {
        if (a > 180) {
            a = 360 - a;
        }
        return Math.min(a, maxC);
    }

    return a;
}

/** Candela real interpolada bilinealmente desde la matriz fotométrica (C-plano x gamma). */
export function candelaFromPhotometricWeb(
    web: NonNullable<Fixture['photometricWeb']>,
    azimuthDeg: number,
    gammaDeg: number,
): number {
    const { c_angles: cAngles, gamma_angles: gammaAngles, candela: matrix } = web;

    if (
        !cAngles?.length ||
        !gammaAngles?.length ||
        !matrix?.length ||
        !matrix[0]?.length
    ) {
        return 0;
    }

    const maxC = cAngles[cAngles.length - 1];
    const foldedC = foldAzimuthToCRange(azimuthDeg, maxC);
    const clampedGamma = Math.min(
        Math.max(gammaDeg, gammaAngles[0]),
        gammaAngles[gammaAngles.length - 1],
    );

    let loIdx = 0;
    let hiIdx = cAngles.length - 1;
    for (let i = 0; i < cAngles.length; i++) {
        if (cAngles[i] <= foldedC) {
            loIdx = i;
        }
        if (cAngles[i] >= foldedC) {
            hiIdx = i;
            break;
        }
    }
    if (hiIdx < loIdx) {
        hiIdx = loIdx;
    }

    const loVal = interpolate1D(matrix[loIdx] ?? matrix[0], gammaAngles, clampedGamma);
    const hiVal = interpolate1D(matrix[hiIdx] ?? matrix[loIdx], gammaAngles, clampedGamma);

    if (hiIdx === loIdx) {
        return loVal;
    }

    const span = cAngles[hiIdx] - cAngles[loIdx];
    const t = span > 0 ? (foldedC - cAngles[loIdx]) / span : 0;

    return loVal + (hiVal - loVal) * t;
}

/**
 * Candela en dirección (azimut, gamma) desde el eje del proyector.
 * Usa la matriz fotométrica real (IES/LDT) cuando está disponible; si no,
 * cae a un modelo Lambertiano aproximado a partir del flujo total.
 */
export function candela(fixture: Fixture, gammaDeg: number, azimuthDeg = 0): number {
    if (fixture.photometricWeb) {
        return candelaFromPhotometricWeb(fixture.photometricWeb, azimuthDeg, gammaDeg);
    }

    const intensity = (fixture.lumens * fixture.efficiency) / MATH_PI;
    const gammaRad = (gammaDeg * MATH_PI) / 180;

    return intensity * Math.cos(gammaRad);
}
