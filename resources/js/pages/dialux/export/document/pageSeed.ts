import type { DialuxDocumentPage, DialuxSceneComparisonSummary } from '../domain/types';

/**
 * Representación intermedia de una página del informe formal, antes de que
 * se le asigne el número de página final — ese número depende de cuántas
 * páginas de TOC hagan falta, que a su vez depende del total de seeds
 * (ver `pagination.ts::generateFormalTocFromSeeds`).
 *
 * Extraído de `buildDialuxFormalDocument.ts` (Fase 2 del plan maestro) sin
 * cambiar su forma.
 */
export interface PageSeed {
    id: string;
    kind: DialuxDocumentPage['kind'];
    sectionId: DialuxDocumentPage['sectionId'];
    title: string;
    subtitle: string | null;
    assetIds: string[];
    notes: string[];
    ambientId?: string | null;
    sceneId?: string | null;
    sceneName?: string | null;
    roomId?: string | null;
    rowRangeStart?: number | null;
    rowRangeEnd?: number | null;
    sceneComparison?: DialuxSceneComparisonSummary | null;
}
