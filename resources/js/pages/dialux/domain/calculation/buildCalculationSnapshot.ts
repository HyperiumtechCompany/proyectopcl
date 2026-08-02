import { deriveSceneAmbientSpaces } from '@/pages/dialux/hooks/ambientSpaces';
import type { Fixture, Project, Room } from '@/pages/dialux/hooks/types';
import {
    CALCULATION_SNAPSHOT_SCHEMA_VERSION,
    type CalculationLevel,
    type CalculationLuminaire,
    type CalculationMaterial,
    type CalculationObject,
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

    for (const scene of project.scenes) {
        levels.push({
            id: scene.id,
            name: scene.name,
            floorIndex: scene.floorIndex,
            floorElevation: scene.floorElevation,
            floorHeight: scene.floorHeight,
        });

        const luminaireStates: LuminaireState[] = [];
        const ambients = deriveSceneAmbientSpaces(scene);

        for (const ambient of ambients) {
            const room = ambient.room;
            const materialId = resolveMaterialId(room, materials, materialIdByKey);
            const luminaireIds: string[] = [];

            for (const fixture of ambient.fixtures) {
                const luminaire = toCalculationLuminaire(fixture, scene.id);
                luminaires.push(luminaire);
                luminaireIds.push(luminaire.id);
                luminaireStates.push({ luminaireId: luminaire.id, on: true, dimmingFactor: 1 });
            }

            calculationObjects.push(toCalculationObject(room, ambient.id, ambient.name, scene.id, materialId, luminaireIds));
        }

        scenes.push({
            id: `${scene.id}::default-scene`,
            levelId: scene.id,
            // Único estado real hoy: no existe UI de encendido/apagado por escena (Fase 10 la introduce).
            name: 'Escena por defecto',
            luminaireStates,
        });
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
    };
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
              }
            : null,
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
