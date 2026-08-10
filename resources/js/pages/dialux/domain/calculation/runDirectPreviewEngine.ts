import type { OcclusionBox } from '@/pages/dialux/domain/geometry/occlusionBoxes';
import { resolveMeshSpacing } from '@/pages/dialux/hooks/adaptiveGridSpacing';
import type { DirectIlluminanceBatchKernel } from '@/pages/dialux/hooks/directIlluminance';
import { calculateLightingResult, LIGHTING_ENGINE_VERSION } from '@/pages/dialux/hooks/lightingEngineCore';
import { getRoomUsefulPlaneHeight } from '@/pages/dialux/hooks/roomLighting';
import type { Fixture } from '@/pages/dialux/hooks/types';
import { hashCalculationSnapshot } from './hashSnapshot';
import {
    groupObstaclesByLevel,
    resolveSurfaceReflectances,
    toEngineFixture,
    toEngineRoom,
} from './runDirectPreviewEngineAdapters';
import {
    DEFAULT_DIRECT_PREVIEW_CONFIG,
    type CalculationConfig,
    type CalculationLuminaire,
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

        const objectLuminaires = object.luminaireIds
            .map((id) => luminairesById.get(id))
            .filter((luminaire): luminaire is CalculationLuminaire => luminaire !== undefined);

        const hasNoLuminaires = object.luminaireIds.length === 0;
        if (hasNoLuminaires) {
            warnings.push({
                code: 'object-without-luminaires',
                message: `"${object.name}" no tiene luminarias asociadas — el resultado ${config.emergencyMode ? 'de emergencia ' : ''}es 0 en todos los puntos.`,
                objectId: object.id,
            });
        }

        let fixtures: Fixture[];

        // Fase 14: en un corte real los circuitos normales pierden alimentación, así que `isEffectivelyOn`/escena
        // es irrelevante aquí a propósito — solo `emergency`/`permanent` con `emergencyFlux` de fabricante participan (nunca flujo normal ni un % inventado, verificado con chief-electrical-engineer-reviewer).
        if (config.emergencyMode) {
            const emergencyCapable = objectLuminaires.filter((luminaire) => luminaire.emergencyType !== 'none');
            const withoutFluxData = emergencyCapable.filter((luminaire) => luminaire.emergencyFlux == null);
            if (withoutFluxData.length > 0) {
                warnings.push({
                    code: 'luminaire-without-emergency-flux-data',
                    message: `"${object.name}": ${withoutFluxData.length} luminaria(s) de emergencia/permanente sin emergencyFlux definido — se excluyen. Nunca se usa el flujo normal como sustituto ni se inventa un valor.`,
                    objectId: object.id,
                });
            }

            fixtures = emergencyCapable.filter((l) => l.emergencyFlux != null).map((l) => toEngineFixture(l, l.emergencyFlux!));

            if (!hasNoLuminaires && fixtures.length === 0) {
                warnings.push({
                    code: 'no-emergency-fixtures-in-object',
                    message: `"${object.name}" no tiene ninguna luminaria de emergencia/permanente con flujo definido — el resultado de emergencia es 0 en todos los puntos.`,
                    objectId: object.id,
                });
            }
        } else {
            fixtures = objectLuminaires
                .filter((luminaire) => isEffectivelyOn(luminaire.id))
                .map((luminaire) => toEngineFixture(luminaire, luminaire.lumens * (luminaireStateById.get(luminaire.id)?.dimmingFactor ?? 1)));

            // Distinto de "sin luminarias": el ambiente SÍ tiene luminarias,
            // pero todas están apagadas en la escena seleccionada — resultado
            // 0 esperado, no un problema de datos (Fase 10).
            if (!hasNoLuminaires && fixtures.length === 0) {
                warnings.push({
                    code: 'all-fixtures-off-in-scene',
                    message: `Todas las luminarias de "${object.name}" están apagadas en la escena "${scene?.name ?? 'por defecto'}" — el resultado es 0 en todos los puntos.`,
                    objectId: object.id,
                });
            }
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
            } else if (material) {
                // Auditoría `dialux-calc-reviewer`: `resolveMaterialId()`
                // (`buildCalculationSnapshot.ts`) crea un material en cuanto
                // el usuario asigna reflectancia a UNA superficie —
                // `RoomSurfaceMaterialsSection.tsx` permite asignar
                // techo/pared/piso de forma independiente, cada uno con su
                // propio "Sin asignar" (`null`). `resolveSurfaceReflectances`
                // (`runDirectPreviewEngineAdapters.ts`) convierte cada `null`
                // individual en `0` (negro absoluto) para poder calcular —
                // sin este warning, un usuario que solo asignó reflectancia
                // de techo obtenía pared/piso en 0% en silencio, sin que
                // nada en el PDF o la UI lo indicara.
                const missingSurfaces: string[] = [];
                if (material.ceilingReflectance == null) missingSurfaces.push('techo');
                if (material.wallReflectance == null) missingSurfaces.push('pared');
                if (material.floorReflectance == null) missingSurfaces.push('piso');
                if (missingSurfaces.length > 0) {
                    warnings.push({
                        code: 'object-with-partial-material-reflectance',
                        message: `"${object.name}" tiene reflectancia definida solo para algunas superficies — ${missingSurfaces.join('/')} se asume(n) 0% (negro) para calcular ${config.interreflection === 'iterative' ? 'interreflexión' : 'primera reflexión'}, no un valor por defecto razonable. Asignar reflectancia real a esas superficies para un cálculo más representativo.`,
                        objectId: object.id,
                    });
                }
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

        // Fase 5/adaptativo: `resolveMeshSpacing` decide espaciado fijo vs
        // adaptativo por recinto (`hooks/adaptiveGridSpacing.ts`) — sin
        // `meshPolicy.adaptive`, idéntico al comportamiento de siempre.
        const levelObstacles = obstaclesByLevel.get(object.levelId) ?? [];
        const { spacingM, marginalZoneOverride } = resolveMeshSpacing(
            room,
            fixtures,
            getRoomUsefulPlaneHeight(room),
            levelObstacles,
            config.meshPolicy,
        );
        const result = calculateLightingResult(
            room,
            fixtures,
            spacingM,
            levelObstacles,
            surfaceReflectances,
            iterativeConfig,
            glareConfig,
            runOptions?.directIlluminanceBatch,
            config.maintenanceFactor ?? 0.8,
            marginalZoneOverride,
            config.excludeMarginalZoneFromStats,
        );

        if (iterativeConfig && result.interreflection_converged === false) {
            warnings.push({
                code: 'interreflection-not-converged',
                message: `"${object.name}" no convergió en ${result.interreflection_iterations} iteraciones (residual ${result.interreflection_residual?.toExponential(2)}) — el resultado usa el valor truncado en el límite de rebotes.`,
                objectId: object.id,
            });
        }

        // Auditoría `dialux-calc-reviewer` Fase 9: `surfaceReflectances` + `guth-observers` cambia el MÉTODO de
        // luminancia de fondo (`Lb`) de `avg/π` a `Eind/π` (casi siempre mucho más chico) — puede subir el UGR
        // reportado varias unidades sin que cambie el diseño; es un artefacto metodológico, no físico.
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

        // Cede el hilo ENTRE objetos (Fase 12) — un yield de microtarea no basta porque los `postMessage` del
        // worker son macrotareas; `setTimeout(...,0)` cede a esa cola. No cambia ningún valor, solo el scheduling.
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
