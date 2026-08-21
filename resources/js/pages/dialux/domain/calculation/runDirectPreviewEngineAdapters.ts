import type { OcclusionBox } from '@/pages/dialux/domain/geometry/occlusionBoxes';
import type { Fixture, Room } from '@/pages/dialux/hooks/types';
import type { PartitionPatchInput } from '@/pages/dialux/hooks/roomPatches';
import type {
    CalculationLuminaire,
    CalculationMaterial,
    CalculationObject,
    CalculationObstacle,
    CalculationPartitionPatch,
} from './types';

/**
 * Adaptadores puros `CalculationObject`/`CalculationLuminaire` (dominio,
 * Fase 1) → `Room`/`Fixture` (motor `direct-preview-v1`), extraídos de
 * `runDirectPreviewEngine.ts` por presupuesto de tamaño de archivo
 * (`__architecture__/fileSizeBudget.test.ts`) — sin cambios de comportamiento.
 */

/**
 * Reflectancias efectivas para la primera reflexión difusa (Fase 7, §11).
 * `null` cuando falta un dato requerido: nunca se inventa un valor típico
 * (70/50/20) en su lugar (plan §20: "no ocultar fallbacks sintéticos") — sin
 * material asignado simplemente no hay primera reflexión para ese objeto.
 */
export function resolveSurfaceReflectances(
    material: CalculationMaterial | undefined,
): { ceiling: number; wall: number; floor: number } | null {
    if (!material) {
        return null;
    }
    return {
        ceiling: material.ceilingReflectance ?? 0,
        wall: material.wallReflectance ?? 0,
        floor: material.floorReflectance ?? 0,
    };
}

/** Agrupa obstáculos por nivel — un ambiente solo debe ocluirse con muros/particiones de SU MISMO nivel (Fase 6: "dos niveles superpuestos" no debe filtrar entre sí). */
export function groupObstaclesByLevel(obstacles: CalculationObstacle[]): Map<string, OcclusionBox[]> {
    const byLevel = new Map<string, OcclusionBox[]>();
    for (const obstacle of obstacles) {
        const list = byLevel.get(obstacle.levelId);
        if (list) {
            list.push(obstacle);
        } else {
            byLevel.set(obstacle.levelId, [obstacle]);
        }
    }
    return byLevel;
}

/** Agrupa parches de partición por nivel — mismo criterio que `groupObstaclesByLevel`. */
export function groupPartitionPatchesByLevel(patches: CalculationPartitionPatch[]): Map<string, PartitionPatchInput[]> {
    const byLevel = new Map<string, PartitionPatchInput[]>();
    for (const patch of patches) {
        const list = byLevel.get(patch.levelId);
        if (list) {
            list.push(patch);
        } else {
            byLevel.set(patch.levelId, [patch]);
        }
    }
    return byLevel;
}

/**
 * Adapta un `CalculationObject`/`CalculationLuminaire` (dominio puro, Fase 1)
 * a la forma `Room`/`Fixture` que `calculateLightingResult` espera hoy
 * (motor `direct-preview-v1`, sin cambios de fórmula — plan maestro §11 Fase
 * 1: "adaptar el motor actual mediante un wrapper, sin cambiar fórmula").
 *
 * `color`/`lightColor` son campos requeridos por `Room`/`Fixture` pero el
 * motor nunca los lee (verificado: no aparecen en `lightingEngineCore.ts` ni
 * en `roomLighting.ts`) — son un remanente de que esos tipos sirven también
 * a la UI. Se rellenan con un placeholder inerte, nunca se leen.
 */
export function toEngineRoom(object: CalculationObject): Room {
    return {
        id: object.id,
        name: object.name,
        roomType: object.roomType,
        vertices: object.vertices,
        height: object.height,
        color: '#000000', // no leído por el motor — ver comentario de arriba.
        usefulPlaneHeight: object.usefulPlaneHeight,
        marginalZone: object.marginalZone,
        illuminanceLux: object.requirement.illuminanceLux ?? undefined,
        uniformityTarget: object.requirement.uniformityTarget,
        ugrLimit: object.requirement.ugrLimit,
    };
}

/**
 * `lumens` ya resuelto por el llamador (Fase 10, §11: "encendido, apagado y
 * regulación" — `luminaire.lumens * dimmingFactor`; Fase 14: `emergencyFlux`
 * en `config.emergencyMode`) — se aplica ANTES de convertir a `Fixture`,
 * no como un factor posterior sobre el resultado (así afecta correctamente
 * la interreflexión/UGR, que dependen de cuánta luz entra al recinto).
 */
export function toEngineFixture(luminaire: CalculationLuminaire, lumens: number): Fixture {
    return {
        id: luminaire.id,
        name: luminaire.name,
        x: luminaire.x,
        y: luminaire.y,
        z: luminaire.z,
        rotation: luminaire.rotation,
        lumens,
        efficiency: luminaire.efficiency,
        fixtureType: luminaire.fixtureType as Fixture['fixtureType'],
        fixtureShape: (luminaire.fixtureShape ?? undefined) as Fixture['fixtureShape'],
        dimensions: luminaire.dimensions ?? undefined,
        photometricWeb: luminaire.photometricWeb,
        lightColor: '#ffffff', // no leído por el motor — ver comentario de arriba.
    };
}
