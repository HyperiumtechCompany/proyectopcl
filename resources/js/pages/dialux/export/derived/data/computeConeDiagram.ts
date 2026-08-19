/**
 * Cono de iluminancia (tab "Cone diagram" del LDT Editor de DIALux) — Ronda
 * 21 del plan `plan_ldt_ies_lector_editor.md`. Para distancias estándar
 * 1-5 m bajo la luminaria: diámetro del haz (según el ángulo de apertura al
 * 50%), iluminancia en el centro (E0) e iluminancia promedio dentro del haz
 * (Eavg).
 *
 * Fórmulas:
 *   E0(d)   = I(γ=0) / d²                                    [inverso del cuadrado, incidencia normal]
 *   Φ_haz   = 2π · ∫[0, γ50] I(γ) · sin(γ) dγ                 [flujo dentro del cono de apertura 50%, CIE 121:1996 §6.3]
 *   Eavg(d) = Φ_haz / (π · r(d)²),  r(d) = d · tan(γ50)       [flujo / área proyectada del círculo del haz]
 *
 * `Φ_haz` se integra numéricamente (regla del trapecio) sobre los puntos
 * gamma realmente declarados por el archivo dentro de [0, γ50] — no una
 * aproximación cerrada — reutilizando el MISMO criterio de integración que
 * ya se usa para flujo zonal en otras partes del proyecto.
 */

interface ConeMatrixInput {
    gamma_angles?: number[] | null;
    candela?: number[][] | null;
}

export interface ConeDiagramRow {
    distanceM: number;
    beamDiameterM: number;
    e0Lux: number;
    eAvgLux: number;
}

const STANDARD_DISTANCES_M = [1, 2, 3, 4, 5];

/** Interpola linealmente I(γ) para un ángulo arbitrario dentro del rango declarado. */
function interpolateCandela(gammaAngles: number[], candela: number[], gammaDeg: number): number {
    if (gammaDeg <= gammaAngles[0]) return candela[0] ?? 0;
    const last = gammaAngles.length - 1;
    if (gammaDeg >= gammaAngles[last]) return candela[last] ?? 0;
    for (let i = 0; i < last; i++) {
        const a = gammaAngles[i];
        const b = gammaAngles[i + 1];
        if (gammaDeg >= a && gammaDeg <= b && b > a) {
            const t = (gammaDeg - a) / (b - a);
            return (candela[i] ?? 0) + t * ((candela[i + 1] ?? 0) - (candela[i] ?? 0));
        }
    }
    return 0;
}

/** Flujo dentro del cono [0, beamAngle50Deg] por integración trapezoidal sobre los puntos gamma reales + el propio límite del haz. */
function integrateBeamFlux(gammaAngles: number[], candela: number[], beamAngle50Deg: number): number {
    const sampleAngles = [...gammaAngles.filter((g) => g <= beamAngle50Deg), beamAngle50Deg].filter((g, i, arr) => arr.indexOf(g) === i).sort((a, b) => a - b);
    if (sampleAngles.length < 2) return 0;

    let flux = 0;
    for (let i = 0; i < sampleAngles.length - 1; i++) {
        const g1 = sampleAngles[i];
        const g2 = sampleAngles[i + 1];
        const i1 = interpolateCandela(gammaAngles, candela, g1) * Math.sin((g1 * Math.PI) / 180);
        const i2 = interpolateCandela(gammaAngles, candela, g2) * Math.sin((g2 * Math.PI) / 180);
        flux += ((i1 + i2) / 2) * (((g2 - g1) * Math.PI) / 180);
    }
    return 2 * Math.PI * flux;
}

export function computeConeDiagram(web: ConeMatrixInput & { reference_lumens?: number | null } | null | undefined, beamAngle50Deg: number | null | undefined, totalLumens?: number): ConeDiagramRow[] | null {
    const gammaAngles = web?.gamma_angles;
    const plane = web?.candela?.[0];
    if (!Array.isArray(gammaAngles) || !Array.isArray(plane) || plane.length === 0 || !beamAngle50Deg || beamAngle50Deg <= 0) {
        return null;
    }

    // Calcular escala si el usuario editó el flujo total de la luminaria
    const candelaScale = web?.reference_lumens && web.reference_lumens > 0 && totalLumens !== undefined ? totalLumens / web.reference_lumens : 1;

    const i0 = interpolateCandela(gammaAngles, plane, 0) * candelaScale;
    if (i0 <= 0) return null;

    const beamFlux = integrateBeamFlux(gammaAngles, plane, beamAngle50Deg) * candelaScale;
    const halfAngleRad = (beamAngle50Deg * Math.PI) / 180;
    const tanHalfAngle = Math.tan(halfAngleRad);

    return STANDARD_DISTANCES_M.map((distanceM) => {
        const beamRadius = distanceM * tanHalfAngle;
        const e0Lux = i0 / (distanceM * distanceM);
        const beamAreaM2 = Math.PI * beamRadius * beamRadius;
        const eAvgLux = beamAreaM2 > 0 ? beamFlux / beamAreaM2 : 0;
        return {
            distanceM,
            beamDiameterM: 2 * beamRadius,
            e0Lux,
            eAvgLux,
        };
    });
}
