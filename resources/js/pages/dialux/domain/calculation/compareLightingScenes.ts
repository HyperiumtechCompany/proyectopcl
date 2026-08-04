import type { CalculationRun } from './types';

/**
 * Fase 10 del plan maestro ("Escenas luminosas y controles", §11:
 * "comparación de escenas"). Función PURA: recibe dos `CalculationRun` ya
 * calculados (típicamente el mismo `CalculationSnapshot`, dos llamadas a
 * `runDirectPreviewEngine` con distinto `sceneSelectionByLevel` — mismos
 * niveles/geometría, sin duplicar nada) y devuelve la diferencia por
 * objeto de cálculo. No recalcula nada: solo resta resultados ya obtenidos.
 */
export interface SceneComparisonEntry {
    objectId: string;
    objectName: string;
    levelId: string;
    avgLuxDelta: number;
    minLuxDelta: number;
    maxLuxDelta: number;
    uniformityDelta: number;
    ugrDelta: number;
}

/**
 * `comparison - baseline` por objeto de cálculo, emparejado por `objectId`.
 * Un objeto presente en un solo run (ej. un ambiente que solo existe en un
 * nivel de un proyecto distinto) se omite — nunca se inventa un delta contra
 * un resultado que no existe.
 */
export function compareLightingScenes(baseline: CalculationRun, comparison: CalculationRun): SceneComparisonEntry[] {
    const baselineByObjectId = new Map(baseline.surfaces.map((surface) => [surface.objectId, surface]));
    const entries: SceneComparisonEntry[] = [];

    for (const surface of comparison.surfaces) {
        const base = baselineByObjectId.get(surface.objectId);
        if (!base) {
            continue;
        }

        entries.push({
            objectId: surface.objectId,
            objectName: surface.objectName,
            levelId: surface.levelId,
            avgLuxDelta: surface.result.avg_lux - base.result.avg_lux,
            minLuxDelta: surface.result.min_lux - base.result.min_lux,
            maxLuxDelta: surface.result.max_lux - base.result.max_lux,
            uniformityDelta: surface.result.uniformity - base.result.uniformity,
            ugrDelta: surface.result.ugr - base.result.ugr,
        });
    }

    return entries;
}
