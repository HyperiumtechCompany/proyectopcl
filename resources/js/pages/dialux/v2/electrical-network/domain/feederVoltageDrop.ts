import { excelCopperResistivity } from '@/pages/dialux/hooks/wireLengthCalculations';

/**
 * Caída de tensión de los ALIMENTADORES de la red v2 (TG → TD, TG → módulo,
 * suministro → TG) con la fórmula completa de IEC 60364-5-52:2009, Anexo G
 * (G.1):
 *
 *     u = b · (ρ₁ · L · cos φ / S + λ · L · sin φ) · I_B
 *
 *  - b = 1 en trifásico (u es la caída fase-neutro; en % sobre U0, que es lo
 *    mismo que √3·u sobre la tensión de línea), b = 2 en monofásico.
 *  - ρ₁ = resistividad a la temperatura de trabajo: MISMA expresión que el
 *    motor CT de la V1 para el cobre (`excelCopperResistivity`,
 *    ρ = 1/58 · (1 + 0.00393·(T − 20))), así la cascada red → módulo usa el
 *    mismo criterio; aluminio ρ20 = 0.02826 Ω·mm²/m, α = 0.00403 /°C (IEC 60228).
 *  - λ = 0.08 mΩ/m, reactancia lineal de cables que el Anexo G indica cuando
 *    no se conoce otro valor. Es despreciable en secciones chicas, pero en
 *    alimentadores grandes (≥ 50 mm²) aporta del orden de +10 a +20 % a la ΔU
 *    — por eso los circuitos finales de la V1 (sin reactancia) siguen igual y
 *    solo los alimentadores de la red la incluyen.
 *
 * Reemplaza (solo en la red) a `electrical/engine/formulas.ts::voltageDropPct`
 * (k·ρ·L·I/S con ρ fijo y sin cos φ), que sobrestimaba el término resistivo en
 * 1/cos φ y omitía la reactancia. Esa función NO se modifica: la sigue usando
 * el Módulo Eléctrico.
 */

/** Reactancia lineal por defecto, Ω/m (IEC 60364-5-52 Anexo G: 0.08 mΩ/m). */
export const FEEDER_REACTANCE_OHM_PER_M = 0.08e-3;

const ALUMINIUM_RHO_20 = 0.02826;
const ALUMINIUM_ALPHA = 0.00403;

/** Resistividad (Ω·mm²/m) a la temperatura de trabajo del conductor. */
export function conductorResistivity(
    material: 'cobre' | 'aluminio',
    temperatureC: number,
): number {
    if (material === 'aluminio') {
        return ALUMINIUM_RHO_20 * (1 + ALUMINIUM_ALPHA * (temperatureC - 20));
    }
    return excelCopperResistivity(temperatureC);
}

export interface FeederVoltageDropInput {
    currentA: number;
    lengthM: number;
    sectionMm2: number;
    /** Tensión del tramo: de línea en trifásico, fase-neutro en monofásico. */
    voltageV: number;
    phases: 1 | 3;
    material: 'cobre' | 'aluminio';
    powerFactor: number;
    temperatureC: number;
}

/** ΔU en voltios (misma base que `voltageV`) y en % de `voltageV`. */
export function feederVoltageDrop(input: FeederVoltageDropInput): {
    dropV: number;
    dropPercent: number;
} {
    const { currentA, lengthM, sectionMm2, voltageV, phases } = input;
    if (
        !(currentA > 0) ||
        !(lengthM > 0) ||
        !(sectionMm2 > 0) ||
        !(voltageV > 0)
    ) {
        return { dropV: 0, dropPercent: 0 };
    }
    const cosPhi = Math.min(1, Math.max(0, input.powerFactor));
    const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
    const rho = conductorResistivity(input.material, input.temperatureC);
    const perMetre =
        (rho * cosPhi) / sectionMm2 + FEEDER_REACTANCE_OHM_PER_M * sinPhi;
    // Trifásico: √3·u sobre la tensión de línea (≡ u sobre U0); monofásico: 2·u.
    const factor = phases === 3 ? Math.sqrt(3) : 2;
    const dropV = factor * currentA * lengthM * perMetre;
    return { dropV, dropPercent: (dropV / voltageV) * 100 };
}
