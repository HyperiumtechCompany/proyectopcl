import { skyIlluminanceAtSurfacePoint } from './skyIlluminance';
import type { SkyAperturePatch } from './windowSkyAperture';

/**
 * Fase 17 del plan maestro ("Luz natural" — Daylight Factor, primer ciclo).
 * Iluminancia horizontal de referencia bajo cielo cubierto SIN obstrucción
 * (denominador del Daylight Factor: `DF = E_interior / E_exterior_referencia`).
 *
 * Se calcula reutilizando LITERALMENTE `skyIlluminanceAtSurfacePoint` —
 * discretizando el hemisferio celeste completo en parches sobre una esfera
 * grande, cada uno con normal radial HACIA EL ORIGEN (mismo rol que la
 * normal "hacia adentro" de un `SkyAperturePatch` de ventana). Esto garantiza
 * que un eventual error de escala en la fórmula de transferencia se cancele
 * automáticamente en el cociente del Daylight Factor, porque numerador y
 * denominador comparten el mismo código — no una fórmula cerrada aparte.
 *
 * Verificado en `skyReferenceIlluminance.test.ts` contra el resultado
 * analítico conocido `E = 7π/9 · L_zenit` (Moon & Spencer, 1942;
 * `pending-confirmation` sobre el texto primario CIE, mismo criterio que
 * `cieOvercastSky.ts`) — con suficiente subdivisión, la integración numérica
 * debe converger a esa constante.
 */

const SPHERE_RADIUS_M = 1000; // Arbitrario: el resultado no depende de la escala (dΩ = área/R² es invariante).

function buildFullHemisphereSkyPatches(subdivisionZenith: number, subdivisionAzimuth: number): SkyAperturePatch[] {
    const patches: SkyAperturePatch[] = [];
    const dTheta = (Math.PI / 2) / subdivisionZenith;
    const dPhi = (2 * Math.PI) / subdivisionAzimuth;

    for (let i = 0; i < subdivisionZenith; i++) {
        const theta = (i + 0.5) * dTheta; // ángulo cenital del centro de la banda
        // Área de un elemento esférico: R²·senθ·dθ·dφ (elemento de ángulo sólido estándar × R²).
        const area = SPHERE_RADIUS_M * SPHERE_RADIUS_M * Math.sin(theta) * dTheta * dPhi;
        if (area < 1e-12) {
            continue;
        }
        for (let j = 0; j < subdivisionAzimuth; j++) {
            const phi = (j + 0.5) * dPhi;
            const dirX = Math.sin(theta) * Math.cos(phi);
            const dirY = Math.sin(theta) * Math.sin(phi);
            const dirZ = Math.cos(theta);
            patches.push({
                x: dirX * SPHERE_RADIUS_M,
                y: dirY * SPHERE_RADIUS_M,
                z: dirZ * SPHERE_RADIUS_M,
                // Normal radial HACIA EL ORIGEN — mismo rol que "hacia adentro" en una ventana.
                normal: { x: -dirX, y: -dirY, z: -dirZ },
                area,
            });
        }
    }

    return patches;
}

/**
 * `subdivisionZenith`/`subdivisionAzimuth` controlan la finura de la
 * integración numérica — valores más altos convergen mejor al resultado
 * analítico `7π/9` a costa de más cómputo. Se calcula una sola vez (no por
 * punto de malla ni por proyecto), así que un valor fino es barato en la
 * práctica.
 */
export function computeUnobstructedOvercastSkyHorizontalIlluminance(subdivisionZenith = 90, subdivisionAzimuth = 180): number {
    const patches = buildFullHemisphereSkyPatches(subdivisionZenith, subdivisionAzimuth);
    const horizontalPoint = { x: 0, y: 0, z: 0, normal: { x: 0, y: 0, z: 1 } };
    return skyIlluminanceAtSurfacePoint(horizontalPoint, patches, 1, []);
}
