/**
 * Fase 17 del plan maestro ("Luz natural" — Daylight Factor, primer ciclo).
 * Distribución de luminancia del CIE Standard Overcast Sky (Moon & Spencer,
 * 1942 — fórmula ampliamente reproducida en literatura de luz natural,
 * también referenciada por CIE 110-2016/CIE S 003): la luminancia del cielo
 * cubierto depende SOLO del ángulo cenital `θ` (medido desde la vertical,
 * 0 = cenit, π/2 = horizonte) — es azimutalmente simétrica, por eso el
 * Daylight Factor clásico NO depende de la hora, fecha ni orientación del
 * edificio (a diferencia de un cielo despejado con sol directo).
 *
 * `pending-confirmation`: la fórmula se verificó contra literatura
 * secundaria ampliamente citada (confirmado con `chief-electrical-engineer-reviewer`),
 * no letra por letra contra el texto primario CIE 110-2016 en esta sesión.
 *
 * Normalizado con `L_zenit = 1` — el Daylight Factor es un COCIENTE
 * (iluminancia interior / iluminancia exterior de referencia), así que el
 * valor absoluto de luminancia del cielo (cd/m²) se cancela siempre que
 * numerador y denominador usen esta misma función (ver `daylightFactorEngine.ts`).
 */

const HORIZON_ZENITH_ANGLE_RAD = Math.PI / 2;

/**
 * Luminancia relativa del cielo cubierto en la dirección de ángulo cenital
 * `zenithAngleRad` (Moon-Spencer: `L_θ/L_z = (1 + 2·cosθ) / 3`). Devuelve 0
 * para ángulos por debajo del horizonte (`> π/2`) o negativos — esas
 * direcciones apuntan al suelo, no al cielo.
 */
export function overcastSkyRelativeLuminance(zenithAngleRad: number): number {
    if (!Number.isFinite(zenithAngleRad) || zenithAngleRad < 0 || zenithAngleRad > HORIZON_ZENITH_ANGLE_RAD) {
        return 0;
    }
    return (1 + 2 * Math.cos(zenithAngleRad)) / 3;
}
