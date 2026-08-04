import type { OcclusionBox } from '@/pages/dialux/domain/geometry/occlusionBoxes';
import { isSegmentOccluded } from '@/pages/dialux/domain/geometry/segmentOcclusion';
import type { SurfacePoint } from './directIlluminance';
import type { EnclosurePatch } from './roomPatches';

const MATH_PI = Math.PI;

/**
 * Factor de forma punto-a-parche SIN acotar (Fase 7/8, plan maestro §11):
 * fracción del hemisferio de `receiver` que ocupa `patch`, con la
 * aproximación estándar de tratar el parche como una fuente puntual en su
 * centroide (válida en campo lejano, `dist² >> área`). Devuelve 0 si el
 * parche no "mira" al receptor, si el receptor no "mira" al parche, o si
 * `isSegmentOccluded` bloquea la línea receptor↔parche.
 *
 * NO se acota aquí a `[0,1]` — quien la use decide cómo: `patchTransferToPoint`
 * (más abajo) la acota individualmente porque atiende un receptor "sumidero"
 * (un punto de malla no realimenta el sistema); `computePatchFormFactorMatrix`
 * (`iterativeRadiosity.ts`) la usa SIN acotar por par y en cambio NORMALIZA
 * toda la fila (todos los receptores de un mismo parche emisor) para que
 * sume como máximo 1 — necesario porque un emisor SÍ realimenta el sistema
 * en cada rebote, y acotar cada par por separado no evita que la SUMA sobre
 * varios receptores cercanos exceda el 100% del flujo del emisor (verificado
 * empíricamente: sin esta normalización, un cubo con reflectancia uniforme
 * diverge — la energía crece exponencialmente en vez de converger).
 */
export function computeFormFactor(patch: EnclosurePatch, receiver: SurfacePoint, obstacles: OcclusionBox[]): number {
    const dx = receiver.x - patch.x;
    const dy = receiver.y - patch.y;
    const dz = receiver.z - patch.z;
    const dist2 = dx * dx + dy * dy + dz * dz;
    if (dist2 < 1e-6) {
        return 0;
    }

    const dist = Math.sqrt(dist2);
    // Coseno en el parche (¿el parche "mira" hacia el receptor?) y coseno en
    // el receptor (¿el receptor "mira" hacia el parche?) — sin ambos, el
    // factor de forma es 0.
    const cosPatch = (dx / dist) * patch.normal.x + (dy / dist) * patch.normal.y + (dz / dist) * patch.normal.z;
    if (cosPatch <= 0) {
        return 0;
    }

    const cosReceiver = (-dx / dist) * receiver.normal.x + (-dy / dist) * receiver.normal.y + (-dz / dist) * receiver.normal.z;
    if (cosReceiver <= 0) {
        return 0;
    }

    if (obstacles.length > 0 && isSegmentOccluded(receiver, patch, obstacles)) {
        return 0;
    }

    return (patch.area * cosPatch * cosReceiver) / (MATH_PI * dist2);
}

/**
 * Transferencia de flujo reflejado de un parche Lambertiano hacia un punto
 * receptor SUMIDERO (un punto de malla, o cualquier receptor que no
 * realimenta el sistema — Fase 7). `exitance` es la excitancia lumínica del
 * parche (`M = E_incidente · reflectancia`, en lux) — YA calculada por el
 * llamador. El factor de forma se acota individualmente a `[0,1]` (un solo
 * emisor no puede cubrir más de un hemisferio completo desde el receptor) —
 * suficiente aquí porque el receptor no vuelve a emitir, así que no hay
 * realimentación que amplifique un exceso agregado entre varios emisores
 * (a diferencia de la transferencia parche↔parche, ver `computeFormFactor`).
 */
export function patchExitanceTransferToPoint(point: SurfacePoint, patch: EnclosurePatch, exitance: number, obstacles: OcclusionBox[]): number {
    if (exitance <= 0) {
        return 0;
    }
    const formFactor = Math.min(computeFormFactor(patch, point, obstacles), 1);
    return exitance * formFactor;
}
