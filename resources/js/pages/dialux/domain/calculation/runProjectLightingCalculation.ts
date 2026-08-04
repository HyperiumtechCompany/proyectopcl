import type { LightingResult, Project } from '@/pages/dialux/hooks/types';
import { buildCalculationSnapshot } from './buildCalculationSnapshot';
import { runDirectPreviewEngine } from './runDirectPreviewEngine';
import { DEFAULT_DIRECT_PREVIEW_CONFIG, type CalculationConfig, type CalculationRun } from './types';

/**
 * Fase 11 del plan maestro ("Resultados profesionales", §11: "cada valor
 * visible puede trazarse a una ejecución, configuración, punto y objeto").
 * Orquesta snapshot + motor para TODO el proyecto de una sola vez —
 * reemplaza los loops ad hoc que llamaban `calculateLightingResult` ambiente
 * por ambiente sin ninguna trazabilidad de versión/configuración/warnings
 * (`useDialuxPdfExport.ts` → `recalculateAllResults`, previo a esta fase, y
 * el fallback interno de `buildDialuxExportSnapshot.ts`).
 */
export interface ProjectLightingCalculation {
    /**
     * Indexado por `objectId` (== `ambient.id`, la convención ya establecida
     * en `buildCalculationSnapshot.ts`/`hooks/ambientSpaces.ts` — NO el
     * `roomId` plano), compatible con el `resultsByRoom` que ya consumían
     * `useEditorStore`/`buildDialuxExportSnapshot.ts` antes de esta fase.
     */
    resultsByRoom: Record<string, LightingResult>;
    /** Ejecución completa (versión, hash, config, warnings) — la fuente real de trazabilidad de esta fase. */
    run: CalculationRun;
}

export async function runProjectLightingCalculation(
    project: Project,
    config: CalculationConfig = DEFAULT_DIRECT_PREVIEW_CONFIG,
): Promise<ProjectLightingCalculation> {
    const snapshot = buildCalculationSnapshot(project);
    const run = await runDirectPreviewEngine(snapshot, config);

    const resultsByRoom: Record<string, LightingResult> = {};
    for (const surface of run.surfaces) {
        resultsByRoom[surface.objectId] = surface.result;
    }

    return { resultsByRoom, run };
}
