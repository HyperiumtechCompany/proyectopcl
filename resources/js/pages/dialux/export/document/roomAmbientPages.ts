import type { DialuxAmbientDetail, DialuxExportSnapshot, DialuxLevelSummary } from '../domain/types';
import type { PageSeed } from './pageSeed';
import { CALCULATION_OBJECT_ROWS_PER_PAGE, chunkIndices, LUMINAIRE_ROWS_PER_PAGE } from './pagination';

/**
 * Páginas por Recinto → Nivel → Ambiente del informe formal. Extraído de
 * `buildDialuxFormalDocument.ts` (Fase 2 del plan maestro) sin cambiar
 * comportamiento — separado de `ambientDossier.ts` (que agrega los DATOS de
 * cada ambiente) porque este archivo construye las PÁGINAS a partir de esos
 * datos ya agregados; juntos superaban el presupuesto de 400 líneas.
 */

/**
 * Páginas por Recinto → Nivel → Ambiente: lista de luminarias del nivel (una
 * vez por Scene, antes de sus recintos), y por cada recinto sus 3 páginas de
 * nivel + 5 sub-secciones por ambiente (estructura DIALux evo).
 */
export function buildRoomAmbientPageSeeds(
    snapshot: DialuxExportSnapshot,
    ambientDetails: DialuxAmbientDetail[],
    levelSummaries: DialuxLevelSummary[],
): PageSeed[] {
    const seeds: PageSeed[] = [];

    // Sorted by floorIndex so rooms belonging to "1° NIVEL" appear before "2° NIVEL".
    const sortedRooms = [...snapshot.rooms].sort((a, b) => {
        const aFloor = ambientDetails.find((d) => d.roomId === a.id)?.floorIndex ?? 0;
        const bFloor = ambientDetails.find((d) => d.roomId === b.id)?.floorIndex ?? 0;
        return aFloor - bFloor;
    });
    const emittedLevelSummaryForScene = new Set<string>();

    sortedRooms.forEach((room) => {
        const roomAmbients = ambientDetails.filter((a) => a.roomId === room.id);
        if (roomAmbients.length === 0) return;
        const levelSceneId = roomAmbients[0]?.sceneId ?? null;
        const levelSceneNameForRoom = roomAmbients[0]?.sceneName ?? null;

        // Lista de luminarias del nivel: una vez por nivel (Scene), antes de
        // sus locales. Funciona igual con 1 nivel o con N (no asume cantidad fija).
        if (levelSceneId && !emittedLevelSummaryForScene.has(levelSceneId)) {
            emittedLevelSummaryForScene.add(levelSceneId);
            const levelSummary = levelSummaries.find(
                (level) => level.sceneId === levelSceneId,
            );

            const levelLuminaireCount = levelSummary?.luminaires.length ?? 0;
            const levelListSubtitle = levelSummary?.sceneName ?? levelSceneNameForRoom;
            chunkIndices(levelLuminaireCount, LUMINAIRE_ROWS_PER_PAGE).forEach(
                (range, index) => {
                    seeds.push({
                        id:
                            index === 0
                                ? `page-level-luminaires-${levelSceneId}`
                                : `page-level-luminaires-${levelSceneId}-p${index + 1}`,
                        kind: 'level-luminaire-list',
                        sectionId: `level-luminaire-list:${levelSceneId}`,
                        title: 'Lista de luminarias del nivel',
                        subtitle:
                            index === 0
                                ? levelListSubtitle
                                : `${levelListSubtitle ?? 'Nivel'} (continuación)`,
                        assetIds: [],
                        notes: [],
                        sceneId: levelSceneId,
                        sceneName: levelSceneNameForRoom,
                        rowRangeStart: range.start,
                        rowRangeEnd: range.end,
                    });
                },
            );
        }
        const levelSceneName = roomAmbients[0]?.sceneName ?? null;

        // Nivel: Lista de locales (bloques por local con Ptotal, área,
        // potencia específica y Ē, como la página "Lista de locales" de evo)
        seeds.push({
            id: `page-room-ambient-list-${room.id}`,
            kind: 'room-ambient-list',
            sectionId: `room-ambient-list:${room.id}`,
            title: 'Lista de locales / Escena de luz 1',
            subtitle: room.name,
            assetIds: [],
            notes: [],
            sceneId: levelSceneId,
            sceneName: levelSceneName,
            roomId: room.id,
        });

        // Nivel: Lista de luminarias
        seeds.push({
            id: `page-room-luminaires-${room.id}`,
            kind: 'room-luminaires',
            sectionId: `room-luminaires:${room.id}`,
            title: 'Lista de luminarias',
            subtitle: room.name,
            assetIds: [],
            notes: [],
            sceneId: levelSceneId,
            sceneName: levelSceneName,
            roomId: room.id,
        });

        // Nivel: Objetos de cálculo / Escena de luz 1 (todos los locales del
        // nivel). Se pagina igual que las listas de luminarias (Fase 4): un
        // recinto con más ambientes que los que caben en una hoja no debe
        // recortarlos en silencio.
        chunkIndices(roomAmbients.length, CALCULATION_OBJECT_ROWS_PER_PAGE).forEach(
            (range, index) => {
                seeds.push({
                    id:
                        index === 0
                            ? `page-room-calculation-objects-${room.id}`
                            : `page-room-calculation-objects-${room.id}-p${index + 1}`,
                    kind: 'calculation-object-list',
                    sectionId: `room-calculation-object:${room.id}`,
                    title: 'Objetos de cálculo / Escena de luz 1',
                    subtitle: index === 0 ? room.name : `${room.name} (continuación)`,
                    assetIds: [],
                    notes: [],
                    sceneId: levelSceneId,
                    sceneName: levelSceneName,
                    roomId: room.id,
                    rowRangeStart: range.start,
                    rowRangeEnd: range.end,
                });
            },
        );

        // Sub-secciones por local (5 páginas fijas por ambiente)
        roomAmbients.forEach((detail) => {
            // Sub-sección 1: Resumen / Escena de luz 1 (métricas + resultados, sin imagen)
            seeds.push({
                id: `page-ambient-summary-${detail.ambientId}`,
                kind: 'ambient-summary',
                sectionId: `ambient-summary:${detail.ambientId}`,
                title: 'Resumen / Escena de luz 1',
                subtitle: detail.ambientName,
                assetIds: [],
                notes: [],
                sceneId: detail.sceneId,
                sceneName: detail.sceneName,
                ambientId: detail.ambientId,
                roomId: room.id,
            });

            // Sub-sección 2: Plano de situación de luminarias
            if (detail.planAssetId) {
                seeds.push({
                    id: `page-ambient-plan-${detail.ambientId}`,
                    kind: 'ambient-plan',
                    sectionId: `ambient-plan:${detail.ambientId}`,
                    title: 'Plano de situación de luminarias',
                    subtitle: detail.ambientName,
                    assetIds: [detail.planAssetId],
                    notes: [],
                    sceneId: detail.sceneId,
                    sceneName: detail.sceneName,
                    ambientId: detail.ambientId,
                    roomId: room.id,
                });
            }

            // Sub-sección 3: Lista de luminarias del ambiente
            if (detail.luminaires.length > 0) {
                seeds.push({
                    id: `page-ambient-luminaires-${detail.ambientId}`,
                    kind: 'ambient-luminaires',
                    sectionId: `ambient-luminaires:${detail.ambientId}`,
                    title: 'Lista de luminarias',
                    subtitle: detail.ambientName,
                    assetIds: [],
                    notes: [],
                    sceneId: detail.sceneId,
                    sceneName: detail.sceneName,
                    ambientId: detail.ambientId,
                    roomId: room.id,
                });
            }

            // Sub-sección 4: Objetos de cálculo / Escena de luz 1
            seeds.push({
                id: `page-ambient-calculation-object-${detail.ambientId}`,
                kind: 'ambient-calculation-object',
                sectionId: `ambient-calculation-object:${detail.ambientId}`,
                title: 'Objetos de cálculo / Escena de luz 1',
                subtitle: detail.ambientName,
                assetIds: [],
                notes: [],
                sceneId: detail.sceneId,
                sceneName: detail.sceneName,
                ambientId: detail.ambientId,
                roomId: room.id,
            });

            // Sub-sección 5: Plano útil / Iluminancia perpendicular (mapa isolux)
            if (detail.isoluxAssetId) {
                seeds.push({
                    id: `page-ambient-useful-plane-${detail.ambientId}`,
                    kind: 'ambient-useful-plane',
                    sectionId: `ambient-useful-plane:${detail.ambientId}`,
                    title: `Plano útil (${detail.ambientName}) / Iluminancia perpendicular`,
                    subtitle: detail.ambientName,
                    assetIds: [detail.isoluxAssetId],
                    notes: [],
                    sceneId: detail.sceneId,
                    sceneName: detail.sceneName,
                    ambientId: detail.ambientId,
                    roomId: room.id,
                });
            }
        });
    });

    return seeds;
}
