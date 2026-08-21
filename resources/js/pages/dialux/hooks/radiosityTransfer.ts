import type { OcclusionBox } from '@/pages/dialux/domain/geometry/occlusionBoxes';
import { isSegmentOccluded } from '@/pages/dialux/domain/geometry/segmentOcclusion';
import type { SurfacePoint } from './directIlluminance';
import type { EnclosurePatch, Vector3 } from './roomPatches';

const MATH_PI = Math.PI;

/**
 * Dos tangentes unitarias perpendiculares a `normal`, para muestrear el
 * footprint real de un parche (Ronda "sombra dura", 2026-08-21) — mismo
 * motivo físico que `fixtureVisibilityFraction` (`directIlluminance.ts`):
 * un solo rayo al centroide trata el parche como fuente puntual y produce un
 * borde de sombra afilado, inestable frente a cambios mínimos de geometría.
 * `roomPatches.ts` solo genera dos formas de normal: piso/techo (±Z puro) y
 * pared/partición (horizontal, Z=0) — cubrir esos dos casos basta, no hace
 * falta una base ortonormal general (Gram-Schmidt) para un normal arbitrario.
 */
function patchTangents(normal: Vector3): [Vector3, Vector3] {
    if (Math.abs(normal.z) > 0.99) {
        return [
            { x: 1, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
        ];
    }
    const horizLen = Math.hypot(normal.x, normal.y) || 1;
    return [
        { x: -normal.y / horizLen, y: normal.x / horizLen, z: 0 },
        { x: 0, y: 0, z: 1 },
    ];
}

const PATCH_SAMPLE_OFFSETS: ReadonlyArray<{ fu: number; fv: number }> = [
    { fu: 0, fv: 0 },
    { fu: 1, fv: 1 },
    { fu: -1, fv: 1 },
    { fu: 1, fv: -1 },
    { fu: -1, fv: -1 },
];

/**
 * Fracción de visibilidad [0,1] de `patch` desde `receiver`, muestreando su
 * footprint real (lado = `√área`, la misma aproximación cuadrada que ya usa
 * `roomPatches.ts` para subdividir parches) en vez de un único rayo al
 * centroide — ver doc de `patchTangents` arriba.
 */
function patchVisibilityFraction(receiver: SurfacePoint, patch: EnclosurePatch, obstacles: OcclusionBox[]): number {
    if (obstacles.length === 0) {
        return 1;
    }
    const halfExtent = Math.sqrt(patch.area) / 2;
    const [tu, tv] = patchTangents(patch.normal);
    let visibleCount = 0;
    for (const sample of PATCH_SAMPLE_OFFSETS) {
        const samplePoint = {
            x: patch.x + (tu.x * sample.fu + tv.x * sample.fv) * halfExtent,
            y: patch.y + (tu.y * sample.fu + tv.y * sample.fv) * halfExtent,
            z: patch.z + (tu.z * sample.fu + tv.z * sample.fv) * halfExtent,
        };
        if (!isSegmentOccluded(receiver, samplePoint, obstacles)) {
            visibleCount += 1;
        }
    }
    return visibleCount / PATCH_SAMPLE_OFFSETS.length;
}

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

    const visibility = patchVisibilityFraction(receiver, patch, obstacles);
    if (visibility <= 0) {
        return 0;
    }

    return (patch.area * cosPatch * cosReceiver * visibility) / (MATH_PI * dist2);
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
