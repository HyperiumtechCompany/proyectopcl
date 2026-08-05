import type { OcclusionBox } from '@/pages/dialux/domain/geometry/occlusionBoxes';
import { isSegmentOccluded } from '@/pages/dialux/domain/geometry/segmentOcclusion';
import { overcastSkyRelativeLuminance } from './cieOvercastSky';
import type { SurfacePoint } from './directIlluminance';
import type { SkyAperturePatch } from './windowSkyAperture';

/**
 * Fase 17 del plan maestro ("Luz natural" — Daylight Factor, primer ciclo).
 * Iluminancia (en unidades de `L_zenit = 1`, ver `cieOvercastSky.ts`) que
 * aporta el cielo cubierto visible a través de una ventana sobre `point`.
 *
 * Misma FORMA geométrica que `radiosityTransfer.ts::computeFormFactor`
 * (área·cosPatch·cosReceptor/dist²) pero SIN el factor `/π`: esa constante
 * en `computeFormFactor` convierte una EXCITANCIA Lambertiana (`M = E·ρ`) en
 * iluminancia transferida, mientras que aquí `L(θ)` ya es una radiancia
 * (del cielo) y la fórmula estándar de transferencia radiancia→iluminancia
 * es directamente `dE = L(θ)·cosReceptor·dΩ`, con
 * `dΩ ≈ área·cosPatch/dist²` el ángulo sólido subtendido por el sub-parche
 * — sin conversión de exitancia de por medio, no hay `/π` que aplicar.
 *
 * `patch.normal` sigue la convención de `windowSkyAperture.ts::resolveInwardNormal`
 * (apunta HACIA ADENTRO del recinto, igual que `EnclosurePatch`) — el ángulo
 * cenital de la porción de cielo se mide siguiendo la dirección
 * punto→parche (la luz entra en esa dirección).
 */
export function skyIlluminanceAtSurfacePoint(
    point: SurfacePoint,
    skyPatches: SkyAperturePatch[],
    glazingTransmittance: number,
    obstacles: OcclusionBox[],
): number {
    if (glazingTransmittance <= 0 || skyPatches.length === 0) {
        return 0;
    }

    let sum = 0;

    for (const patch of skyPatches) {
        const dx = point.x - patch.x;
        const dy = point.y - patch.y;
        const dz = point.z - patch.z;
        const dist2 = dx * dx + dy * dy + dz * dz;
        if (dist2 < 1e-6) {
            continue;
        }
        const dist = Math.sqrt(dist2);

        // Dirección parche→punto (por dónde "sale" la luz del parche hacia el receptor).
        const cosPatch = (dx / dist) * patch.normal.x + (dy / dist) * patch.normal.y + (dz / dist) * patch.normal.z;
        if (cosPatch <= 0) {
            continue;
        }

        // Dirección punto→parche (¿el receptor "mira" hacia el parche?).
        const cosPoint = (-dx / dist) * point.normal.x + (-dy / dist) * point.normal.y + (-dz / dist) * point.normal.z;
        if (cosPoint <= 0) {
            continue;
        }

        if (obstacles.length > 0 && isSegmentOccluded(point, { x: patch.x, y: patch.y, z: patch.z }, obstacles)) {
            continue;
        }

        // Ángulo cenital de la dirección punto→parche (por ahí "se ve" el cielo).
        const cosZenith = -dz / dist;
        const zenithAngleRad = Math.acos(Math.min(1, Math.max(-1, cosZenith)));
        const skyLuminance = overcastSkyRelativeLuminance(zenithAngleRad);

        sum += (skyLuminance * cosPatch * cosPoint * patch.area) / dist2;
    }

    return sum * glazingTransmittance;
}
