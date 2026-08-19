import { candelaFromPhotometricWeb } from '@/pages/dialux/hooks/photometricInterpolation';
import type { Fixture } from '@/pages/dialux/hooks/types';

/**
 * Flujo zonal (Fase 1 acotada de `planes/plan_correcion_luminarias_ldt.md`,
 * a pedido explícito del usuario: "solo lo que verifica precisión").
 *
 * Objetivo: verificar, para cada luminaria importada, que la matriz de
 * candela que quedó guardada es físicamente consistente con lo que el
 * propio archivo declara — integrando la intensidad real (la misma que usa
 * `candela()`/`photometricInterpolation.ts` en el motor de cálculo, no una
 * reimplementación aparte) y comparando el resultado contra
 * `reference_lumens` (el flujo total que el archivo declaró) y, cuando el
 * archivo lo trae, contra `metadata.downward_flux_fraction_pct` (DFF) /
 * `metadata.light_output_ratio_pct` (LOR).
 *
 * Fórmula (CIE 121:1996 §6.3, IESNA LM-79-08 §9.1):
 *
 *   Φ_zona = ∫∫ I(γ,φ) · sin(γ) · dφ · dγ     [lm]
 *
 * Integrado numéricamente (regla del trapecio en γ y φ) sobre la MISMA
 * función de interpolación bilineal que usa el motor real
 * (`candelaFromPhotometricWeb`) — así una divergencia detectada aquí es una
 * divergencia real del dato importado, no un artefacto de una integración
 * distinta a la que realmente se usa para calcular lux.
 */

const GAMMA_STEP_DEG = 2.5;
const PHI_STEP_DEG = 5;

export interface ZonalFluxResult {
    /** Flujo total integrado desde la matriz de candela, en lúmenes. */
    totalFluxLm: number;
    /** Flujo hacia abajo (0°-90°, hacia el plano de trabajo), en lúmenes. */
    downwardFluxLm: number;
    /** Flujo hacia arriba (90°-180°), en lúmenes. */
    upwardFluxLm: number;
    /** DFF calculado = downwardFlux/totalFlux × 100. */
    downwardFluxFractionPct: number;
    /** UFF calculado = upwardFlux/totalFlux × 100. */
    upwardFluxFractionPct: number;
    /** LOR calculado = totalFlux/reference_lumens × 100 — 100% = la matriz reproduce exactamente el flujo declarado del archivo. */
    lightOutputRatioPct: number | null;
    /** DFF que el propio archivo declaró en su metadata (LDT línea 22), si lo trae — null si no hay dato para comparar. */
    declaredDownwardFluxFractionPct: number | null;
    /** LORL que el propio archivo declaró (LDT línea 23), si lo trae. */
    declaredLightOutputRatioPct: number | null;
    /** Zonas angulares acumuladas desde el nadir, para el desglose 0-30/0-60/0-90/0-180. */
    cumulativeZonesLm: Array<{ toDeg: number; fluxLm: number }>;
}

/**
 * Integra `sin(γ)` en el paso [gammaFromDeg, gammaToDeg) para UN plano C
 * (interpolando en φ también), regla del trapecio compuesta.
 */
function integrateGammaRange(web: NonNullable<Fixture['photometricWeb']>, gammaFromDeg: number, gammaToDeg: number): number {
    let flux = 0;
    for (let phiDeg = 0; phiDeg < 360; phiDeg += PHI_STEP_DEG) {
        let phiIntegral = 0;
        for (let gammaDeg = gammaFromDeg; gammaDeg < gammaToDeg; gammaDeg += GAMMA_STEP_DEG) {
            const gammaNextDeg = Math.min(gammaDeg + GAMMA_STEP_DEG, gammaToDeg);
            const g1 = (gammaDeg * Math.PI) / 180;
            const g2 = (gammaNextDeg * Math.PI) / 180;
            const i1 = candelaFromPhotometricWeb(web, phiDeg, gammaDeg) * Math.sin(g1);
            const i2 = candelaFromPhotometricWeb(web, phiDeg, gammaNextDeg) * Math.sin(g2);
            phiIntegral += ((i1 + i2) / 2) * (g2 - g1);
        }
        flux += phiIntegral;
    }
    // dφ constante (PHI_STEP_DEG en radianes) — se aplica una sola vez al
    // final en vez de dentro del bucle, la suma de arriba ya es Σ I·sinγ·dγ
    // por cada φ muestreado.
    return flux * ((PHI_STEP_DEG * Math.PI) / 180);
}

/**
 * `null` si no hay matriz fotométrica real de fabricante — el flujo zonal
 * solo tiene sentido de "verificación contra el archivo" para fotometría
 * real, no para una curva sintética/manual que no declara nada que
 * verificar.
 */
export function computeZonalFlux(
    web: NonNullable<Fixture['photometricWeb']> | null | undefined,
    metadata: { downward_flux_fraction_pct?: number | null; light_output_ratio_pct?: number | null } | null | undefined,
): ZonalFluxResult | null {
    if (!web || web.provenance !== 'manufacturer' || !Array.isArray(web.gamma_angles) || web.gamma_angles.length === 0) {
        return null;
    }

    const zoneBoundsDeg = [0, 30, 60, 90, 120, 180];
    const cumulativeZonesLm: Array<{ toDeg: number; fluxLm: number }> = [];
    let cumulative = 0;
    for (let i = 1; i < zoneBoundsDeg.length; i++) {
        cumulative += integrateGammaRange(web, zoneBoundsDeg[i - 1]!, zoneBoundsDeg[i]!);
        cumulativeZonesLm.push({ toDeg: zoneBoundsDeg[i]!, fluxLm: cumulative });
    }

    const totalFluxLm = cumulativeZonesLm[cumulativeZonesLm.length - 1]!.fluxLm;
    const downwardFluxLm = cumulativeZonesLm.find((z) => z.toDeg === 90)!.fluxLm;
    const upwardFluxLm = totalFluxLm - downwardFluxLm;

    const referenceLumens = web.reference_lumens ?? null;

    return {
        totalFluxLm,
        downwardFluxLm,
        upwardFluxLm,
        downwardFluxFractionPct: totalFluxLm > 0 ? (downwardFluxLm / totalFluxLm) * 100 : 0,
        upwardFluxFractionPct: totalFluxLm > 0 ? (upwardFluxLm / totalFluxLm) * 100 : 0,
        lightOutputRatioPct: referenceLumens && referenceLumens > 0 ? (totalFluxLm / referenceLumens) * 100 : null,
        declaredDownwardFluxFractionPct: metadata?.downward_flux_fraction_pct ?? null,
        declaredLightOutputRatioPct: metadata?.light_output_ratio_pct ?? null,
        cumulativeZonesLm,
    };
}
