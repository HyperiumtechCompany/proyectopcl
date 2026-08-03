import type { DialuxExportSnapshot, DialuxTocEntry } from '../domain/types';
import type { PageSeed } from './pageSeed';

/**
 * Paginación y tabla de contenidos del informe formal. Extraído de
 * `buildDialuxFormalDocument.ts` (Fase 2 del plan maestro) sin cambiar
 * comportamiento — mismas constantes, mismo algoritmo.
 */

// 14 dejaba media página en blanco en proyectos reales: la altura real de
// fila del CSS (.toc-row ~6mm, encabezados de sección ~7-11mm) permite bastante
// más por página en una hoja A4 (~243mm útiles tras título/índice). 24 es un
// valor conservador frente a esa capacidad real (mezcla de filas simples,
// filas con subtítulo y encabezados de sección).
export const TOC_ROWS_PER_PAGE = 24;

/**
 * Filas por página para listas de luminarias (proyecto/nivel). Mismo enfoque
 * que TOC_ROWS_PER_PAGE: una constante razonable, no una medición real de
 * alto de fila (no existe esa infraestructura hoy).
 */
export const LUMINAIRE_ROWS_PER_PAGE = 20;

/** Filas por página para la tabla de objetos de cálculo por recinto. */
export const CALCULATION_OBJECT_ROWS_PER_PAGE = 18;

/** Términos de glosario por página (cada fila ya mantiene término+definición juntos). */
export const GLOSSARY_ROWS_PER_PAGE = 12;

/** Divide `totalRows` en tramos `[start, end)` de a lo sumo `rowsPerPage` filas. */
export function chunkIndices(
    totalRows: number,
    rowsPerPage: number,
): Array<{ start: number; end: number }> {
    if (totalRows <= 0) {
        return [{ start: 0, end: 0 }];
    }

    const chunks: Array<{ start: number; end: number }> = [];
    for (let start = 0; start < totalRows; start += rowsPerPage) {
        chunks.push({ start, end: Math.min(start + rowsPerPage, totalRows) });
    }

    return chunks;
}

function buildTocEntries(
    tocPageCount: number,
    fixedPageSeeds: PageSeed[],
    technicalPageSeeds: PageSeed[],
    fixedPageCount: number,
    snapshot: DialuxExportSnapshot,
): DialuxTocEntry[] {
    const entries: DialuxTocEntry[] = fixedPageSeeds.map((seed, index) => ({
        sectionId: seed.sectionId,
        title: seed.title,
        subtitle: seed.subtitle,
        level: 0,
        pageNumber: index + 1,
    }));

    entries.push({
        sectionId: 'content',
        title: 'Contenido',
        subtitle: null,
        level: 0,
        pageNumber: fixedPageCount + 1,
    });

    const firstTechnicalPage = fixedPageCount + tocPageCount + 1;
    let currentSceneId: string | null = null;
    let currentRoomId: string | null = null;
    let currentAmbientId: string | null = null;
    let productSheetHeaderAdded = false;
    let terrainHeaderAdded = false;

    technicalPageSeeds.forEach((seed, index) => {
        // Special TOC Group: Terreno (antes de la primera página de planos del bloque general)
        if (
            !terrainHeaderAdded &&
            (seed.kind === 'terrain-cad' ||
                seed.kind === 'ambient-list' ||
                seed.kind === 'terrain-architectural' ||
                seed.kind === 'luminaire-list')
        ) {
            entries.push({
                sectionId: 'terrain-header',
                title: 'Terreno 1',
                subtitle: null,
                level: 0,
                pageNumber: 0,
                kind: 'section-label',
                size: 'small',
            });
            entries.push({
                sectionId: 'edification-header',
                title: snapshot.project.name,
                subtitle: null,
                level: 0,
                pageNumber: 0,
                kind: 'section-heading',
                size: 'large',
            });
            terrainHeaderAdded = true;
        }

        // Special TOC Group: Fichas de producto
        if (seed.kind === 'product-sheet' && !productSheetHeaderAdded) {
            entries.push({
                sectionId: 'product-sheets-header',
                title: 'Fichas de producto',
                subtitle: null,
                level: 0,
                pageNumber: 0,
                kind: 'section-heading',
                size: 'large',
            });
            productSheetHeaderAdded = true;
        }

        if (seed.sceneId && seed.sceneId !== currentSceneId) {
            currentSceneId = seed.sceneId;
            entries.push({
                sectionId: `scene-group-label-${seed.sceneId}`,
                title: snapshot.project.name,
                subtitle: null,
                level: 0,
                pageNumber: 0,
                kind: 'section-label',
                size: 'small',
            });
            entries.push({
                sectionId: `scene-group-heading-${seed.sceneId}`,
                title: seed.sceneName ?? 'Nivel',
                subtitle: null,
                level: 0,
                pageNumber: 0,
                kind: 'section-heading',
                size: 'large',
            });
        }

        // Room transition tracking.
        if (seed.roomId && seed.roomId !== currentRoomId) {
            currentRoomId = seed.roomId;
        }

        // Ambient Transition Group
        if (seed.ambientId && seed.ambientId !== currentAmbientId) {
            const ambient = snapshot.ambients.find(
                (a) => a.id === seed.ambientId,
            );
            currentAmbientId = seed.ambientId;
            if (ambient) {
                entries.push({
                    sectionId: `ambient-group-label-${ambient.id}`,
                    title: ambient.roomName,
                    subtitle: null,
                    level: 1,
                    pageNumber: 0,
                    kind: 'section-label',
                    size: 'small',
                });
                entries.push({
                    sectionId: `ambient-group-heading-${ambient.id}`,
                    title: ambient.name,
                    subtitle: null,
                    level: 1,
                    pageNumber: 0,
                    kind: 'section-heading',
                    size: 'large',
                });
            }
        }

        let level = 0;
        let title = seed.title;

        if (seed.kind === 'product-sheet') {
            title = seed.subtitle ?? seed.title;
            level = 0;
        } else if (
            seed.kind === 'terrain-cad' ||
            seed.kind === 'terrain-architectural'
        ) {
            // En el índice se lee mejor el subtítulo descriptivo del plano
            // ("Plano base importado", "Plano Arquitectónico con Isolux").
            title = seed.subtitle ?? seed.title;
            level = 0;
        } else if (
            seed.kind === 'ambient-plan' ||
            seed.kind === 'ambient-luminaires' ||
            seed.kind === 'ambient-products' ||
            seed.kind === 'ambient-calculation-object' ||
            seed.kind === 'ambient-useful-plane' ||
            seed.kind === 'ambient-summary' ||
            seed.kind === 'ambient-results' ||
            seed.kind === 'ambient-list' ||
            seed.kind === 'calculation-object-list' ||
            seed.kind === 'room-ambient-list' ||
            seed.kind === 'room-luminaires' ||
            seed.kind === 'room-calculation-object'
        ) {
            level = 0; // The user TOC doesn't indent them visually, it just lists them under the headers
        }

        entries.push({
            sectionId: seed.sectionId,
            title: title,
            subtitle: null,
            level,
            pageNumber: firstTechnicalPage + index,
            kind: 'item',
        });
    });

    return entries;
}

export function generateFormalTocFromSeeds(
    fixedPageCount: number,
    fixedPageSeeds: PageSeed[],
    technicalPageSeeds: PageSeed[],
    snapshot: DialuxExportSnapshot,
): DialuxTocEntry[] {
    let tocPageCount = 1;

    while (true) {
        const tocEntries = buildTocEntries(
            tocPageCount,
            fixedPageSeeds,
            technicalPageSeeds,
            fixedPageCount,
            snapshot,
        );
        const nextTocPageCount = Math.max(
            1,
            Math.ceil(tocEntries.length / TOC_ROWS_PER_PAGE),
        );

        if (nextTocPageCount === tocPageCount) {
            return tocEntries;
        }

        tocPageCount = nextTocPageCount;
    }
}
