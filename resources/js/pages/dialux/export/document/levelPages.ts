import type { DialuxExportSnapshot, DialuxLevelSummary } from '../domain/types';
import { buildLevelLuminaireList, buildLuminaireTotals } from './productPages';

/**
 * Agregados por nivel del informe formal. Extraído de
 * `buildDialuxFormalDocument.ts` (Fase 2 del plan maestro) sin cambiar
 * comportamiento.
 */

/**
 * Agregados por nivel (Scene): luminarias, totales y conteos de cumplimiento.
 * Se deriva agrupando `snapshot.ambients` por `sceneId` — funciona igual con
 * 1 nivel o con N, sin cantidades fijas.
 */
export function buildLevelSummaries(
    snapshot: DialuxExportSnapshot,
): DialuxLevelSummary[] {
    const sceneOrder: string[] = [];
    const ambientsByScene = new Map<
        string,
        DialuxExportSnapshot['ambients']
    >();

    for (const ambient of snapshot.ambients) {
        let ambientsForScene = ambientsByScene.get(ambient.sceneId);
        if (!ambientsForScene) {
            ambientsForScene = [];
            ambientsByScene.set(ambient.sceneId, ambientsForScene);
            sceneOrder.push(ambient.sceneId);
        }
        ambientsForScene.push(ambient);
    }

    return sceneOrder
        .map((sceneId): DialuxLevelSummary => {
            const ambients = ambientsByScene.get(sceneId)!;
            const luminaires = buildLevelLuminaireList(ambients);

            return {
                sceneId,
                sceneName: ambients[0]!.sceneName,
                floorIndex: ambients[0]!.floorIndex,
                ambientCount: ambients.length,
                calculatedAmbientCount: ambients.filter(
                    (ambient) => ambient.result !== null,
                ).length,
                compliantAmbientCount: ambients.filter(
                    (ambient) => ambient.metrics.complies,
                ).length,
                fixtureCount: ambients.reduce(
                    (sum, ambient) => sum + ambient.fixtures.length,
                    0,
                ),
                luminaires,
                luminaireTotals: buildLuminaireTotals(luminaires),
            };
        })
        .sort((left, right) => left.floorIndex - right.floorIndex);
}
