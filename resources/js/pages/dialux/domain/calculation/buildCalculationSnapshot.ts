import { buildPartitionOcclusionBoxes, buildWallOcclusionBoxes } from '@/pages/dialux/domain/geometry/occlusionBoxes';
import { deriveSceneAmbientSpaces } from '@/pages/dialux/hooks/ambientSpaces';
import type { Fixture, LightingScenePreset, LightSwitch, Project, Room } from '@/pages/dialux/hooks/types';
import {
    CALCULATION_SNAPSHOT_SCHEMA_VERSION,
    type CalculationLevel,
    type CalculationLuminaire,
    type CalculationMaterial,
    type CalculationObject,
    type CalculationObstacle,
    type CalculationPartitionPatch,
    type CalculationSnapshot,
    type LightingSceneState,
    type LuminaireState,
} from './types';

/**
 * Construye el `CalculationSnapshot` a partir del `Project` mutable del store
 * (Fase 1, plan maestro §11/§4.2). Función PURA: no lee Zustand, no muta
 * `project`, y cada campo del snapshot se reconstruye copiando valores
 * primitivos/objetos anidados propios — nunca reutiliza arrays/objetos del
 * `Project` de entrada por referencia, así que editar el store después de
 * llamar a esta función no afecta al snapshot ya creado.
 *
 * La asociación luminaria↔ambiente reutiliza `deriveSceneAmbientSpaces`
 * (`hooks/ambientSpaces.ts`), el mismo algoritmo que ya usa el export a
 * PDF/snapshot — no reimplementa esa lógica (pasadizos divididos en
 * sub-ambientes, detección raster, etc.).
 */
export function buildCalculationSnapshot(project: Project): CalculationSnapshot {
    const levels: CalculationLevel[] = [];
    const materials: CalculationMaterial[] = [];
    const materialIdByKey = new Map<string, string>();
    const luminaires: CalculationLuminaire[] = [];
    const scenes: LightingSceneState[] = [];
    const calculationObjects: CalculationObject[] = [];
    const obstacles: CalculationObstacle[] = [];
    const partitionPatches: CalculationPartitionPatch[] = [];

    for (const scene of project.scenes) {
        levels.push({
            id: scene.id,
            name: scene.name,
            floorIndex: scene.floorIndex,
            floorElevation: scene.floorElevation,
            floorHeight: scene.floorHeight,
        });

        const levelLuminaireIds: string[] = [];
        const ambients = deriveSceneAmbientSpaces(scene);

        for (const ambient of ambients) {
            const room = ambient.room;
            const materialId = resolveMaterialId(room, materials, materialIdByKey);
            const luminaireIds: string[] = [];

            for (const fixture of ambient.fixtures) {
                const luminaire = toCalculationLuminaire(fixture, scene.id);
                luminaires.push(luminaire);
                luminaireIds.push(luminaire.id);
                levelLuminaireIds.push(luminaire.id);
            }

            calculationObjects.push(toCalculationObject(room, ambient.id, ambient.name, scene.id, materialId, luminaireIds));
        }

        // Fase 10: un nivel puede definir varias escenas lumínicas
        // (`lightingScenes`, presets de encendido/apagado/regulación por
        // interruptor). Sin ninguna definida (`undefined`/`[]`, el caso de
        // todo proyecto anterior a esta fase), se genera exactamente la
        // misma "Escena por defecto" (todo encendido) que antes — mismo
        // comportamiento, no disruptivo.
        const presets = scene.lightingScenes ?? [];
        if (presets.length > 0) {
            for (const preset of presets) {
                scenes.push({
                    id: `${scene.id}::${preset.id}`,
                    levelId: scene.id,
                    name: preset.name,
                    luminaireStates: resolveLuminaireStates(levelLuminaireIds, scene.lightSwitches, preset.switchStates),
                    trigger: preset.trigger,
                });
            }
        } else {
            scenes.push({
                id: `${scene.id}::default-scene`,
                levelId: scene.id,
                name: 'Escena por defecto',
                luminaireStates: resolveLuminaireStates(levelLuminaireIds, scene.lightSwitches, null),
            });
        }

        const sceneBoxes = [
            ...buildWallOcclusionBoxes(scene.walls, scene.windows, scene.doors),
            ...buildPartitionOcclusionBoxes(scene.partitions, scene.doors),
        ];
        for (const box of sceneBoxes) {
            obstacles.push({ ...box, levelId: scene.id });
        }

        for (const partition of scene.partitions) {
            if (partition.partitionType === 'glass') {
                continue;
            }
            partitionPatches.push({
                levelId: scene.id,
                vertices: partition.vertices.map((v) => ({ x: v.x, y: v.y })),
                thickness: partition.thickness,
                height: partition.height,
                bottomGap: partition.bottomGap,
            });
        }
    }

    return {
        schemaVersion: CALCULATION_SNAPSHOT_SCHEMA_VERSION,
        projectId: project.id,
        geometryHash: '',
        levels,
        materials,
        luminaires,
        scenes,
        calculationObjects,
        obstacles,
        partitionPatches,
    };
}

/**
 * Estado de encendido/regulación de cada luminaria de un nivel, para UNA
 * escena (Fase 10). Los "grupos de control" del plan ya existen como
 * `LightSwitch.connectedFixtureIds` — no se reinventa esa agrupación, solo
 * se resuelve el estado de cada interruptor que controla cada luminaria.
 *
 * `switchStates === null` (sin ningún preset definido, el nivel usa la
 * "Escena por defecto"): todas las luminarias quedan encendidas al 100%,
 * SIN mirar `lightSwitches` — mismo comportamiento exacto que antes de la
 * Fase 10, incluso si el nivel ya tiene interruptores modelados en el
 * plano eléctrico.
 *
 * Con un preset real: un interruptor NO listado en `switchStates` se asume
 * encendido al 100% (una escena es un "diff" desde todo encendido). Una
 * luminaria controlada por MÁS DE UN interruptor (conmutación de varios
 * puntos) usa la regla conservadora "apagada si CUALQUIERA de sus
 * interruptores está apagado" y "atenuación = la más baja entre ellos" — no
 * modela conmutación de 3 vías real (XOR), documentado como simplificación
 * deliberada en `planes/fase10_progreso_dialux.md`.
 */
function resolveLuminaireStates(
    luminaireIds: string[],
    lightSwitches: LightSwitch[],
    switchStates: LightingScenePreset['switchStates'] | null,
): LuminaireState[] {
    if (!switchStates) {
        return luminaireIds.map((luminaireId) => ({ luminaireId, on: true, dimmingFactor: 1 }));
    }

    const switchesByFixture = new Map<string, LightSwitch[]>();
    for (const lightSwitch of lightSwitches) {
        for (const fixtureId of lightSwitch.connectedFixtureIds) {
            const list = switchesByFixture.get(fixtureId);
            if (list) {
                list.push(lightSwitch);
            } else {
                switchesByFixture.set(fixtureId, [lightSwitch]);
            }
        }
    }

    return luminaireIds.map((luminaireId) => {
        const controllingSwitches = switchesByFixture.get(luminaireId) ?? [];
        if (controllingSwitches.length === 0) {
            return { luminaireId, on: true, dimmingFactor: 1 };
        }

        let on = true;
        let dimmingFactor = 1;
        for (const lightSwitch of controllingSwitches) {
            const state = switchStates[lightSwitch.id] ?? { on: true, dimmingFactor: 1 };
            on = on && state.on;
            // Recortado a [0,1] en el punto de lectura (auditoría `dialux-calc-reviewer`
            // de esta fase): ninguna UI escribe `lightingScenes` todavía, pero
            // el contrato ya lo permite, y un valor fuera de rango (dato
            // malformado o negativo) no debe llegar sin filtro al motor —
            // mismo criterio que `clampReflectance` en la Fase 7.
            const clampedDimming = Number.isFinite(state.dimmingFactor) ? Math.min(1, Math.max(0, state.dimmingFactor)) : 1;
            dimmingFactor = Math.min(dimmingFactor, clampedDimming);
        }

        return { luminaireId, on, dimmingFactor };
    });
}

function resolveMaterialId(
    room: Room,
    materials: CalculationMaterial[],
    materialIdByKey: Map<string, string>,
): string | null {
    const { ceilingReflectance = null, wallReflectance = null, floorReflectance = null } = room;
    if (ceilingReflectance == null && wallReflectance == null && floorReflectance == null) {
        return null;
    }

    const key = `${ceilingReflectance}|${wallReflectance}|${floorReflectance}`;
    const existing = materialIdByKey.get(key);
    if (existing) {
        return existing;
    }

    const id = `material-${materials.length + 1}`;
    materialIdByKey.set(key, id);
    materials.push({ id, ceilingReflectance, wallReflectance, floorReflectance });
    return id;
}

function toCalculationLuminaire(fixture: Fixture, levelId: string): CalculationLuminaire {
    return {
        id: fixture.id,
        levelId,
        name: fixture.name,
        x: fixture.x,
        y: fixture.y,
        z: fixture.z,
        rotation: fixture.rotation ?? 0,
        lumens: fixture.lumens,
        efficiency: fixture.efficiency,
        fixtureType: fixture.fixtureType,
        fixtureShape: fixture.fixtureShape ?? null,
        dimensions: fixture.dimensions ? { ...fixture.dimensions } : null,
        photometricWeb: fixture.photometricWeb
            ? {
                  c_angles: [...fixture.photometricWeb.c_angles],
                  gamma_angles: [...fixture.photometricWeb.gamma_angles],
                  candela: fixture.photometricWeb.candela.map((row) => [...row]),
                  reference_lumens: fixture.photometricWeb.reference_lumens,
                  provenance: fixture.photometricWeb.provenance,
              }
            : null,
        emergencyType: fixture.emergencyType ?? 'none',
        emergencyFlux: fixture.emergencyFlux ?? null,
    };
}

function toCalculationObject(
    room: Room,
    id: string,
    name: string,
    levelId: string,
    materialId: string | null,
    luminaireIds: string[],
): CalculationObject {
    return {
        id,
        levelId,
        name,
        vertices: room.vertices.map((vertex) => ({ x: vertex.x, y: vertex.y })),
        height: room.height,
        roomType: room.roomType,
        usefulPlaneHeight: room.usefulPlaneHeight ?? null,
        marginalZone: room.marginalZone ?? null,
        materialId,
        requirement: {
            illuminanceLux: room.illuminanceLux ?? null,
            uniformityTarget: room.uniformityTarget ?? null,
            ugrLimit: room.ugrLimit ?? null,
            normativeStandard: room.normativeStandard ?? null,
            normativeLabel: room.normativeLabel ?? null,
        },
        luminaireIds,
    };
}
