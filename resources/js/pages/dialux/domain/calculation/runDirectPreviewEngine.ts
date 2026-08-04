import type { OcclusionBox } from '@/pages/dialux/domain/geometry/occlusionBoxes';
import type { DirectIlluminanceBatchKernel } from '@/pages/dialux/hooks/directIlluminance';
import { calculateLightingResult, LIGHTING_ENGINE_VERSION } from '@/pages/dialux/hooks/lightingEngineCore';
import type { Fixture, Room } from '@/pages/dialux/hooks/types';
import { hashCalculationSnapshot } from './hashSnapshot';
import {
    DEFAULT_DIRECT_PREVIEW_CONFIG,
    type CalculationConfig,
    type CalculationLuminaire,
    type CalculationMaterial,
    type CalculationObject,
    type CalculationObstacle,
    type CalculationRun,
    type CalculationSnapshot,
    type CalculationWarning,
    type LightingSceneState,
    type SurfaceCalculationResult,
} from './types';

/**
 * Resuelve, para UN nivel, qué `LightingSceneState` usar (Fase 10, §11:
 * "escena activa vs. conjunto calculado" — la escena que se calcula es una
 * elección explícita del llamador, no un estado implícito del store).
 * `sceneSelectionByLevel[levelId]` elige un id concreto; sin selección (o si
 * el id no existe para ese nivel — se advierte, no se falla en silencio), se
 * usa la PRIMERA escena del nivel — con exactamente una escena por nivel
 * (todo proyecto sin `lightingScenes` definidas), esto reproduce el
 * comportamiento de antes de esta fase sin ningún cambio.
 */
function resolveSceneForLevel(
    scenesByLevel: Map<string, LightingSceneState[]>,
    levelId: string,
    selectedSceneId: string | undefined,
    warnings: CalculationWarning[],
): LightingSceneState | undefined {
    const candidates = scenesByLevel.get(levelId) ?? [];
    if (!selectedSceneId) {
        return candidates[0];
    }

    const match = candidates.find((scene) => scene.id === selectedSceneId);
    if (match) {
        return match;
    }

    warnings.push({
        code: 'scene-not-found',
        message: `No existe la escena "${selectedSceneId}" en el nivel "${levelId}" — se usa la escena por defecto de ese nivel.`,
        objectId: null,
    });
    return candidates[0];
}

/**
 * Reflectancias efectivas para la primera reflexión difusa (Fase 7, §11).
 * `null` cuando falta un dato requerido: nunca se inventa un valor típico
 * (70/50/20) en su lugar (plan §20: "no ocultar fallbacks sintéticos") — sin
 * material asignado simplemente no hay primera reflexión para ese objeto.
 */
function resolveSurfaceReflectances(
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
function groupObstaclesByLevel(obstacles: CalculationObstacle[]): Map<string, OcclusionBox[]> {
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

/**
 * `dimmingFactor` (Fase 10, §11: "encendido, apagado y regulación") escala
 * el flujo luminoso ANTES de convertir a `Fixture` — reduce el `lumens` que
 * ve el motor, no un factor aplicado después sobre el resultado (así la
 * regulación afecta correctamente la interreflexión/UGR, que dependen de
 * cuánta luz entra al recinto, no solo del resultado final punto a punto).
 */
function toEngineFixture(luminaire: CalculationLuminaire, dimmingFactor: number): Fixture {
    return {
        id: luminaire.id,
        name: luminaire.name,
        x: luminaire.x,
        y: luminaire.y,
        z: luminaire.z,
        rotation: luminaire.rotation,
        lumens: luminaire.lumens * dimmingFactor,
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
    /**
     * Elige qué `LightingSceneState` calcular en cada nivel (Fase 10:
     * "resultados independientes por escena" — llamar dos veces con
     * distintas selecciones, sobre el MISMO snapshot, da "comparación de
     * escenas" sin duplicar geometría). Default `null` — usa la primera
     * escena de cada nivel, que con exactamente una escena por nivel (todo
     * proyecto sin `lightingScenes` definidas) es idéntico al comportamiento
     * de antes de esta fase.
     */
    sceneSelectionByLevel: Record<string, string> | null = null,
    /**
     * Fase 12 ("Rendimiento: Worker y WASM"). Default `undefined` en los tres
     * campos — el bucle de `calculationObjects` sigue siendo secuencial
     * (ahora con un `await` cooperativo entre objetos, que NO cambia ningún
     * valor calculado, solo cede el hilo — verificado contra los goldens de
     * todas las fases anteriores) y usa el motor TS puro, igual que antes de
     * esta fase para todo llamador que no pase `runOptions`.
     */
    runOptions?: {
        /** Se invoca después de terminar CADA `calculationObject` (no por punto de malla). */
        onProgress?: (completed: number, total: number) => void;
        /**
         * Chequeado ENTRE objetos (no puede interrumpir uno a mitad de
         * cálculo — cooperativo, no preventivo; ver `planes/fase12_progreso_dialux.md`
         * §"cancelación" para el límite conocido de esto). `true` corta el
         * bucle: el `CalculationRun` devuelto tiene `status:'cancelled'` y
         * `surfaces` con solo los objetos ya calculados hasta ese punto.
         */
        isCancelled?: () => boolean;
        /** Kernel WASM por lotes (`hooks/wasmDirectIlluminanceKernel.ts`) — ver `calculateLightingResult`. */
        directIlluminanceBatch?: DirectIlluminanceBatchKernel;
    },
): Promise<CalculationRun> {
    const startedAt = new Date().toISOString();
    const start = performance.now();
    const warnings: CalculationWarning[] = [];
    const luminairesById = new Map(snapshot.luminaires.map((luminaire) => [luminaire.id, luminaire]));
    const materialsById = new Map(snapshot.materials.map((material) => [material.id, material]));
    const scenesByLevel = new Map<string, LightingSceneState[]>();
    for (const scene of snapshot.scenes) {
        const list = scenesByLevel.get(scene.levelId);
        if (list) {
            list.push(scene);
        } else {
            scenesByLevel.set(scene.levelId, [scene]);
        }
    }
    // Fase 6: `config.occlusion` era metadata sin efecto hasta ahora (Fase 0,
    // brecha §3.3). Solo se computan obstáculos cuando el modo lo pide — con
    // `occlusion: false` (default) el comportamiento es idéntico al de antes
    // de esta fase, sin ningún costo adicional.
    const obstaclesByLevel = config.occlusion
        ? groupObstaclesByLevel(snapshot.obstacles)
        : new Map<string, OcclusionBox[]>();

    // Fase 8: `config.interreflection === 'iterative'` ahora tiene efecto
    // real (antes de esta fase, solo advertía y calculaba luz directa).
    // `maxBounces <= 1` no es un error, pero pedir "iterativo" y no permitir
    // más de un rebote es indistinguible de la primera reflexión de la Fase
    // 7 — se advierte para que no parezca un resultado iterativo real cuando
    // en la práctica solo corrió un rebote (plan §20: "no ocultar fallbacks
    // sintéticos").
    const iterativeButSingleBounce = config.interreflection === 'iterative' && config.maxBounces <= 1;
    if (iterativeButSingleBounce) {
        warnings.push({
            code: 'interreflection-maxBounces-too-low',
            message: `config.maxBounces (${config.maxBounces}) no permite más de un rebote — el resultado equivale a "first-bounce", no a interreflexión iterativa real.`,
            objectId: null,
        });
    }

    const total = snapshot.calculationObjects.length;
    const surfaces: SurfaceCalculationResult[] = [];
    let cancelled = false;

    for (const object of snapshot.calculationObjects) {
        if (runOptions?.isCancelled?.()) {
            cancelled = true;
            break;
        }

        const room = toEngineRoom(object);
        const scene = resolveSceneForLevel(scenesByLevel, object.levelId, sceneSelectionByLevel?.[object.levelId], warnings);
        const luminaireStateById = new Map((scene?.luminaireStates ?? []).map((state) => [state.luminaireId, state]));

        // Fase 10: una luminaria "apagada" en la escena seleccionada no
        // participa del cálculo — sin estado registrado (nivel sin ninguna
        // escena resuelta), se asume encendida al 100%. Una luminaria con
        // `on:true` pero `dimmingFactor<=0` es indistinguible físicamente de
        // "apagada" (0 lúmenes) — se trata igual (auditoría `dialux-calc-reviewer`:
        // sin esto, quedaba en el array de `fixtures`, aportando 0 lux sin
        // que ningún warning lo explicara).
        const isEffectivelyOn = (luminaireId: string) => {
            const state = luminaireStateById.get(luminaireId);
            if (!state) {
                return true;
            }
            return state.on && state.dimmingFactor > 0;
        };

        const fixtures = object.luminaireIds
            .map((id) => luminairesById.get(id))
            .filter((luminaire): luminaire is CalculationLuminaire => luminaire !== undefined)
            .filter((luminaire) => isEffectivelyOn(luminaire.id))
            .map((luminaire) => toEngineFixture(luminaire, luminaireStateById.get(luminaire.id)?.dimmingFactor ?? 1));

        if (object.luminaireIds.length === 0) {
            warnings.push({
                code: 'object-without-luminaires',
                message: `"${object.name}" no tiene luminarias asociadas — el resultado es 0 en todos los puntos.`,
                objectId: object.id,
            });
        } else if (fixtures.length === 0) {
            // Distinto de "sin luminarias": el ambiente SÍ tiene luminarias,
            // pero todas están apagadas en la escena seleccionada — resultado
            // 0 esperado, no un problema de datos (Fase 10).
            warnings.push({
                code: 'all-fixtures-off-in-scene',
                message: `Todas las luminarias de "${object.name}" están apagadas en la escena "${scene?.name ?? 'por defecto'}" — el resultado es 0 en todos los puntos.`,
                objectId: object.id,
            });
        }

        let surfaceReflectances: { ceiling: number; wall: number; floor: number } | null = null;
        if (config.interreflection === 'first-bounce' || config.interreflection === 'iterative') {
            const material = object.materialId ? materialsById.get(object.materialId) : undefined;
            surfaceReflectances = resolveSurfaceReflectances(material);
            if (!surfaceReflectances) {
                warnings.push({
                    code: 'object-without-material-reflectance',
                    message: `"${object.name}" no tiene reflectancias de superficie definidas — no se calcula ${config.interreflection === 'iterative' ? 'interreflexión' : 'primera reflexión'} para este ambiente.`,
                    objectId: object.id,
                });
            }
        }

        const iterativeConfig =
            config.interreflection === 'iterative' && surfaceReflectances
                ? { maxBounces: config.maxBounces, convergenceTolerance: config.convergenceTolerance }
                : null;

        // Fase 9: `config.glare.observerModel === 'guth-observers'` activa
        // UGR con observadores reales (posición/altura/dirección) e índice
        // de posición de Guth — `null` (default `'legacy'`) mantiene el
        // `calculateUGR` heredado sin cambios (Fase 0).
        const glareConfig = config.glare.observerModel === 'guth-observers' ? {} : null;

        // Fase 5: `meshPolicy.gridSpacingM` era metadata sin efecto real
        // hasta ahora — `calculateLightingResult` ya lo acepta.
        const result = calculateLightingResult(
            room,
            fixtures,
            config.meshPolicy.gridSpacingM,
            obstaclesByLevel.get(object.levelId) ?? [],
            surfaceReflectances,
            iterativeConfig,
            glareConfig,
            runOptions?.directIlluminanceBatch,
        );

        if (iterativeConfig && result.interreflection_converged === false) {
            warnings.push({
                code: 'interreflection-not-converged',
                message: `"${object.name}" no convergió en ${result.interreflection_iterations} iteraciones (residual ${result.interreflection_residual?.toExponential(2)}) — el resultado usa el valor truncado en el límite de rebotes.`,
                objectId: object.id,
            });
        }

        // Auditoría `dialux-calc-reviewer` de Fase 9: activar `surfaceReflectances`
        // junto con `guth-observers` CAMBIA EL MÉTODO de cálculo de la
        // luminancia de fondo (`Lb`) — de `avg/π` (promedio directo+indirecto
        // de toda la malla) a `Eind/π` (solo la componente indirecta real en
        // el ojo del observador), casi siempre un valor mucho más chico.
        // Verificado que esto puede subir el UGR reportado varias unidades
        // de un cálculo a otro SIN que haya cambiado el diseño — es un
        // artefacto metodológico, no un cambio físico. Advertir para que no
        // se interprete como una regresión del diseño.
        if (glareConfig && surfaceReflectances) {
            warnings.push({
                code: 'ugr-background-luminance-method-changed',
                message: `"${object.name}": con interreflexión activa, la luminancia de fondo de UGR usa la iluminancia indirecta real en el ojo del observador (Eind/π) en vez del promedio directo+indirecto de la malla — el UGR puede diferir sustancialmente de un cálculo sin interreflexión, sin que eso implique un cambio en el diseño.`,
                objectId: object.id,
            });
        }

        if (glareConfig && result.ugr_excluded_fixture_count && result.ugr_excluded_fixture_count > 0) {
            warnings.push({
                code: 'ugr-fixtures-excluded',
                message: `${result.ugr_excluded_fixture_count} luminaria(s) excluida(s) del cálculo de UGR en "${object.name}" (fuera del campo visual superior o fuera del rango de validez H/R>2 — ver plan §11 Fase 9).`,
                objectId: object.id,
            });
        }

        surfaces.push({
            objectId: object.id,
            objectName: object.name,
            levelId: object.levelId,
            result,
        });

        runOptions?.onProgress?.(surfaces.length, total);

        // Cede el hilo ENTRE objetos (Fase 12: "UI fluida durante cálculo",
        // "cancelación perceptible en <500ms") — un yield de microtarea
        // (`await Promise.resolve()`) NO basta: los mensajes `postMessage`
        // del worker se procesan como macrotareas, así que una cancelación
        // pendiente no se vería hasta la siguiente vuelta del event loop.
        // `setTimeout(...,0)` cede a la cola de macrotareas. No cambia
        // ningún valor calculado, solo cuándo se reanuda — verificado contra
        // los goldens de todas las fases anteriores (comparan valores
        // resueltos, no orden de scheduling).
        await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const snapshotHash = await hashCalculationSnapshot(snapshot);
    const completedAt = new Date().toISOString();

    return {
        id: `run-${snapshotHash.slice(0, 16)}-${Date.now()}`,
        engineVersion: LIGHTING_ENGINE_VERSION,
        snapshotHash,
        status: cancelled ? 'cancelled' : 'completed',
        config,
        startedAt,
        completedAt,
        durationMs: performance.now() - start,
        warnings,
        surfaces,
    };
}
