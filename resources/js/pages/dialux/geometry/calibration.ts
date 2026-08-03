/**
 * calibration.ts — Matemática pura de calibración por distancia conocida.
 *
 * El usuario mide una distancia sobre el plano (en unidades CAD nativas) e
 * introduce la distancia real en metros. De ahí sale la escala efectiva única
 * que usa TODO el sistema:
 *
 *   factorEscala   = distanciaReal / distanciaMedida       (lineal)
 *   áreaCorregida  = áreaMedida × factorEscala²            (cuadrática)
 *
 * Nunca se aplica un factor fijo hardcodeado: el factor siempre se deriva de
 * la unidad declarada del archivo ($INSUNITS), de la heurística de extents o
 * de esta calibración manual — en ese orden de confianza.
 */

import type { ScaleConfig } from '@/pages/dialux/hooks/types';

/**
 * Factor de escala lineal derivado de una medición.
 * Devuelve null si las distancias no son válidas (> 0 y finitas).
 */
export function computeLinearScaleFactor(
    measuredDistance: number,
    realDistance: number,
): number | null {
    if (!Number.isFinite(measuredDistance) || !Number.isFinite(realDistance)) return null;
    if (measuredDistance <= 0 || realDistance <= 0) return null;
    return realDistance / measuredDistance;
}

/** Un área escala con el CUADRADO del factor lineal. */
export function scaleAreaByLinearFactor(areaM2: number, linearFactor: number): number {
    return areaM2 * linearFactor * linearFactor;
}

/**
 * Construye el ScaleConfig calibrado a partir de una medición:
 * `cadDistance` en unidades CAD nativas, `realDistance` en metros.
 * El `calibrationFactor` resultante hace que
 * `factor × calibrationFactor = realDistance / cadDistance`.
 */
export function calibrateScaleConfig(
    current: ScaleConfig,
    cadDistance: number,
    realDistance: number,
): ScaleConfig | null {
    const desiredEffective = computeLinearScaleFactor(cadDistance, realDistance);
    if (desiredEffective === null) return null;
    const baseFactor = current.factor > 0 ? current.factor : 1;
    return {
        ...current,
        calibrationFactor: desiredEffective / baseFactor,
        isCalibrated: true,
    };
}
