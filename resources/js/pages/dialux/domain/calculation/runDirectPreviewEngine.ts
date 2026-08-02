import { calculateLightingResult, LIGHTING_ENGINE_VERSION } from '@/pages/dialux/hooks/lightingEngineCore';
import type { Fixture, Room } from '@/pages/dialux/hooks/types';
import { hashCalculationSnapshot } from './hashSnapshot';
import {
    DEFAULT_DIRECT_PREVIEW_CONFIG,
    type CalculationConfig,
    type CalculationLuminaire,
    type CalculationObject,
    type CalculationRun,
    type CalculationSnapshot,
    type CalculationWarning,
    type SurfaceCalculationResult,
} from './types';

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
function toEngineRoom(object: CalculationObject): Room {
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

function toEngineFixture(luminaire: CalculationLuminaire): Fixture {
    return {
        id: luminaire.id,
        name: luminaire.name,
        x: luminaire.x,
        y: luminaire.y,
        z: luminaire.z,
        rotation: luminaire.rotation,
        lumens: luminaire.lumens,
        efficiency: luminaire.efficiency,
        fixtureType: luminaire.fixtureType as Fixture['fixtureType'],
        fixtureShape: (luminaire.fixtureShape ?? undefined) as Fixture['fixtureShape'],
        dimensions: luminaire.dimensions ?? undefined,
        photometricWeb: luminaire.photometricWeb,
        lightColor: '#ffffff', // no leído por el motor — ver comentario de arriba.
    };
}

/**
 * Ejecuta el motor `direct-preview-v1` sobre un snapshot ya construido
 * (`buildCalculationSnapshot`). Produce un `CalculationRun` completo
 * (plan maestro §8.3): mismo resultado numérico que llamar a
 * `calculateLightingResult` directamente (ver golden de Fase 0), con
 * trazabilidad (versión, hash, warnings, duración) añadida por el wrapper.
 */
export async function runDirectPreviewEngine(
    snapshot: CalculationSnapshot,
    config: CalculationConfig = DEFAULT_DIRECT_PREVIEW_CONFIG,
): Promise<CalculationRun> {
    const startedAt = new Date().toISOString();
    const start = performance.now();
    const warnings: CalculationWarning[] = [];
    const luminairesById = new Map(snapshot.luminaires.map((luminaire) => [luminaire.id, luminaire]));

    const surfaces: SurfaceCalculationResult[] = snapshot.calculationObjects.map((object) => {
        const room = toEngineRoom(object);
        const fixtures = object.luminaireIds
            .map((id) => luminairesById.get(id))
            .filter((luminaire): luminaire is CalculationLuminaire => luminaire !== undefined)
            .map(toEngineFixture);

        if (fixtures.length === 0) {
            warnings.push({
                code: 'object-without-luminaires',
                message: `"${object.name}" no tiene luminarias asociadas — el resultado es 0 en todos los puntos.`,
                objectId: object.id,
            });
        }

        return {
            objectId: object.id,
            objectName: object.name,
            levelId: object.levelId,
            result: calculateLightingResult(room, fixtures),
        };
    });

    const snapshotHash = await hashCalculationSnapshot(snapshot);
    const completedAt = new Date().toISOString();

    return {
        id: `run-${snapshotHash.slice(0, 16)}-${Date.now()}`,
        engineVersion: LIGHTING_ENGINE_VERSION,
        snapshotHash,
        status: 'completed',
        config,
        startedAt,
        completedAt,
        durationMs: performance.now() - start,
        warnings,
        surfaces,
    };
}
