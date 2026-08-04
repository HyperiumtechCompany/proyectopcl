import { runProjectLightingCalculation } from '@/pages/dialux/domain/calculation/runProjectLightingCalculation';
import { isCalculationRunStale } from '@/pages/dialux/domain/calculation/staleness';
import type { CalculationRun } from '@/pages/dialux/domain/calculation/types';
import type { LightingResult, Project } from '@/pages/dialux/hooks/types';

export interface ResolvedCalculationRun {
    resultsByRoom: Record<string, LightingResult>;
    calculationRun: CalculationRun;
    /** `true` si se reusó `cachedRun` sin recalcular. */
    reused: boolean;
}

/**
 * Fase 13 (§11: "evitar recálculos en exportadores" + "invalidar... si el
 * resultado está stale"). Extraído de `useDialuxPdfExport.ts` para poder
 * probarlo sin el resto del hook (Swal/axios/capturas de canvas, imposibles
 * de aislar en un test unitario). Nunca reusa un resultado sin verificar
 * primero — mantiene la garantía de Fase 11 ("el PDF nunca muestra
 * resultados viejos"): la diferencia es que ahora se VERIFICA en vez de
 * asumir que hace falta recalcular.
 */
export async function resolveCalculationRunForExport(
    project: Project,
    cachedRun: CalculationRun | null,
): Promise<ResolvedCalculationRun> {
    if (cachedRun && !(await isCalculationRunStale(cachedRun, project))) {
        return {
            calculationRun: cachedRun,
            resultsByRoom: Object.fromEntries(cachedRun.surfaces.map((surface) => [surface.objectId, surface.result])),
            reused: true,
        };
    }

    const recalculated = await runProjectLightingCalculation(project);
    return {
        calculationRun: recalculated.run,
        resultsByRoom: recalculated.resultsByRoom,
        reused: false,
    };
}
