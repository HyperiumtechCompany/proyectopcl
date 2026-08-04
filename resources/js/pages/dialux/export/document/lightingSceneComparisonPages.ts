import type { DialuxSceneComparisonSummary } from '../domain/types';
import type { PageSeed } from './pageSeed';

/**
 * Anexo comparativo de escenas lumínicas (Fase 13, §11: "añadir anexos
 * comparativos") — usa `compareLightingScenes` (Fase 10) para mostrar la
 * diferencia (Δlux/ΔUo/ΔUGR) entre dos escenas del mismo nivel. Mismo patrón
 * que `glossaryPages.ts`: una lista vacía produce cero páginas — hoy ningún
 * proyecto real tiene 2+ `lightingScenes` por nivel (ninguna UI las crea
 * todavía), así que esto no aparece en ningún informe existente.
 */
export function buildLightingSceneComparisonPageSeeds(sceneComparisons: DialuxSceneComparisonSummary[]): PageSeed[] {
    return sceneComparisons.map((comparison, index) => ({
        id: `page-lighting-scene-comparison-${comparison.id}`,
        kind: 'lighting-scene-comparison',
        sectionId: 'technical-appendix',
        title: index === 0 ? 'Comparación de escenas lumínicas' : 'Comparación de escenas lumínicas (cont.)',
        subtitle: `${comparison.levelName}: ${comparison.baselineSceneName} vs. ${comparison.comparisonSceneName}`,
        assetIds: [],
        notes: [],
        sceneId: comparison.levelId,
        sceneComparison: comparison,
    }));
}
