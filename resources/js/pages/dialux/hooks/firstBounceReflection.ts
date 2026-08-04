import type { OcclusionBox } from '@/pages/dialux/domain/geometry/occlusionBoxes';
import { illuminanceFromFixture, type SurfacePoint } from './directIlluminance';
import { patchExitanceTransferToPoint } from './radiosityTransfer';
import type { EnclosurePatch } from './roomPatches';
import type { Fixture } from './types';

/**
 * Iluminancia directa (fixtures → parche) sobre cada parche de la envolvente
 * (Fase 7, plan maestro §11: "Materiales e interreflexión inicial") — mismo
 * cálculo que `illuminanceFromFixture` sobre un punto de malla, pero SIN
 * incluir lo que otros parches reflejan (un único rebote; la Fase 8 suma
 * rebotes sucesivos entre parches en `iterativeRadiosity.ts`).
 */
export function computePatchDirectIlluminance(patches: EnclosurePatch[], fixtures: Fixture[], obstacles: OcclusionBox[]): number[] {
    return patches.map((patch) => fixtures.reduce((sum, fixture) => sum + illuminanceFromFixture(patch, fixture, obstacles), 0));
}

/**
 * Contribución de la primera reflexión difusa sobre `point`, sumando cada
 * parche de la envolvente como un emisor Lambertiano de excitancia
 * `M = E_directa · ρ` ("implementar primera reflexión difusa" + "conservar
 * energía") — un único rebote, sin recibir lo que reflejan otros parches.
 * Con `reflectance = 0` en todos los parches (o `patches = []`) esta función
 * siempre suma 0 — es lo que garantiza que "reflectancia 0 reproduce cálculo
 * directo" sea EXACTO, no aproximado.
 */
export function firstBounceIlluminance(
    point: SurfacePoint,
    patches: EnclosurePatch[],
    patchIlluminance: number[],
    obstacles: OcclusionBox[],
): number {
    let sum = 0;

    for (let i = 0; i < patches.length; i++) {
        const patch = patches[i]!;
        const directOnPatch = patchIlluminance[i]!;
        const exitance = directOnPatch * patch.reflectance;
        sum += patchExitanceTransferToPoint(point, patch, exitance, obstacles);
    }

    return sum;
}
