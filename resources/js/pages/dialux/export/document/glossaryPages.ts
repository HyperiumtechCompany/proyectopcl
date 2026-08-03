import type { GlossaryEntry } from '../domain/types';
import type { PageSeed } from './pageSeed';
import { chunkIndices, GLOSSARY_ROWS_PER_PAGE } from './pagination';

/**
 * Páginas de glosario del informe formal — solo los términos que el informe
 * realmente usa (ver `glossaryCatalog.ts::selectGlossaryEntries`), paginado
 * igual que las demás tablas largas. Extraído de
 * `buildDialuxFormalDocument.ts` (Fase 2 del plan maestro) sin cambiar
 * comportamiento.
 */
export function buildGlossaryPageSeeds(glossaryEntries: GlossaryEntry[]): PageSeed[] {
    return chunkIndices(glossaryEntries.length, GLOSSARY_ROWS_PER_PAGE).map(
        (range, index) => ({
            id: index === 0 ? 'page-glossary' : `page-glossary-p${index + 1}`,
            kind: 'glossary',
            sectionId: 'glossary',
            title: 'Glosario',
            subtitle: index === 0 ? '' : 'Continuación',
            assetIds: [],
            notes: [],
            rowRangeStart: range.start,
            rowRangeEnd: range.end,
        }),
    );
}
