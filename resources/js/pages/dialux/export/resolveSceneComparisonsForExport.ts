import { buildCalculationSnapshot } from '@/pages/dialux/domain/calculation/buildCalculationSnapshot';
import { compareLightingScenes } from '@/pages/dialux/domain/calculation/compareLightingScenes';
import { runDirectPreviewEngine } from '@/pages/dialux/domain/calculation/runDirectPreviewEngine';
import { DEFAULT_DIRECT_PREVIEW_CONFIG, type CalculationConfig } from '@/pages/dialux/domain/calculation/types';
import type { Project } from '@/pages/dialux/hooks/types';
import type { DialuxSceneComparisonSummary } from './domain/types';

/**
 * Anexo comparativo de escenas lumínicas (Fase 13, §11: "añadir anexos
 * comparativos") — usa `compareLightingScenes` (Fase 10) sobre dos
 * `CalculationRun` del MISMO snapshot (misma geometría, sin recalcular
 * nada dos veces salvo el motor en sí). Solo hace trabajo real cuando algún
 * nivel tiene 2+ `lightingScenes` — hoy ninguna UI las crea, así que esto
 * devuelve `[]` (0 llamadas al motor) para todo proyecto real.
 */
export async function resolveSceneComparisonsForExport(
    project: Project,
    config: CalculationConfig = DEFAULT_DIRECT_PREVIEW_CONFIG,
): Promise<DialuxSceneComparisonSummary[]> {
    const scenesWithComparablePresets = project.scenes.filter((scene) => (scene.lightingScenes?.length ?? 0) >= 2);
    if (scenesWithComparablePresets.length === 0) {
        return [];
    }

    const snapshot = buildCalculationSnapshot(project);
    const comparisons: DialuxSceneComparisonSummary[] = [];

    for (const scene of scenesWithComparablePresets) {
        const presets = scene.lightingScenes!;
        const [baseline, ...alternates] = presets;
        const baselineRun = await runDirectPreviewEngine(snapshot, config, { [scene.id]: baseline!.id });

        for (const alternate of alternates) {
            const alternateRun = await runDirectPreviewEngine(snapshot, config, { [scene.id]: alternate.id });
            comparisons.push({
                id: `${scene.id}::${alternate.id}`,
                levelId: scene.id,
                levelName: scene.name,
                baselineSceneName: baseline!.name,
                comparisonSceneName: alternate.name,
                entries: compareLightingScenes(baselineRun, alternateRun),
            });
        }
    }

    return comparisons;
}
