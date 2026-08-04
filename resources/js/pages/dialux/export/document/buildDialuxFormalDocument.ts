import {
    DIALUX_FORMAL_DOCUMENT_SCHEMA_VERSION,
    type DialuxDocumentPage,
    type DialuxExportAsset,
    type DialuxExportSnapshot,
    type DialuxFormalDocument,
    type DialuxTocEntry,
} from '../domain/types';
import { buildAmbientDetails } from './ambientDossier';
import { buildFixedPageSeeds } from './frontMatter';
import { selectGlossaryEntries } from './glossaryCatalog';
import { buildGlossaryPageSeeds } from './glossaryPages';
import { buildLevelSummaries } from './levelPages';
import { buildLightingSceneComparisonPageSeeds } from './lightingSceneComparisonPages';
import type { PageSeed } from './pageSeed';
import { generateFormalTocFromSeeds, TOC_ROWS_PER_PAGE } from './pagination';
import { buildLuminaireList, buildLuminaireTotals, buildProductPageSeeds } from './productPages';
import { buildRoomAmbientPageSeeds } from './roomAmbientPages';
import { buildTerrainPageSeeds } from './terrainPages';

/**
 * Ensamblador del informe formal DIALux (Fase 2 del plan maestro: este
 * archivo bajó de 1324 a un orquestador delgado; toda la lógica de
 * construcción vive ahora en sus módulos vecinos — `pagination.ts`,
 * `productPages.ts`, `levelPages.ts`, `ambientDossier.ts`, `frontMatter.ts`,
 * `terrainPages.ts`, `glossaryPages.ts` — sin cambiar ningún comportamiento
 * ni resultado; la cobertura de tests existente (fase5-8, luminaireListPagination,
 * dialux-export, moduloIFixture, fase10FinalValidation) verifica esto a
 * través de la única función pública, `buildDialuxFormalDocument`.
 */

function toFileBaseName(projectName: string): string {
    return projectName
        .toLowerCase()
        .normalize('NFD')
        .replaceAll(/[\u0300-\u036f]/g, '')
        .replaceAll(/[^a-z0-9]+/g, '-')
        .replaceAll(/^-+|-+$/g, '')
        .slice(0, 80);
}

function buildTechnicalPageSeeds(
    snapshot: DialuxExportSnapshot,
    luminaires: ReturnType<typeof buildLuminaireList>,
    ambientDetails: ReturnType<typeof buildAmbientDetails>,
    assets: DialuxExportAsset[],
    levelSummaries: ReturnType<typeof buildLevelSummaries>,
    glossaryEntries: ReturnType<typeof selectGlossaryEntries>,
): PageSeed[] {
    return [
        ...buildTerrainPageSeeds(assets),
        ...buildProductPageSeeds(luminaires),
        ...buildRoomAmbientPageSeeds(snapshot, ambientDetails, levelSummaries),
        ...buildLightingSceneComparisonPageSeeds(snapshot.sceneComparisons),
        ...buildGlossaryPageSeeds(glossaryEntries),
    ];
}

export function buildDialuxFormalDocument(
    snapshot: DialuxExportSnapshot,
    assets: DialuxExportAsset[],
): DialuxFormalDocument {
    const luminaires = buildLuminaireList(snapshot);
    const luminaireTotals = buildLuminaireTotals(luminaires);
    const levelSummaries = buildLevelSummaries(snapshot);
    const ambientDetails = buildAmbientDetails(snapshot, assets);
    const glossaryEntries = selectGlossaryEntries({
        hasCct: luminaires.some((lum) => lum.cct != null),
        hasCri: luminaires.some((lum) => lum.cri != null),
        hasIsolux: ambientDetails.some((detail) => detail.isoluxAssetId !== null),
        hasMultipleLevels: levelSummaries.length > 1,
    });
    const fixedPageSeeds = buildFixedPageSeeds(snapshot, luminaires, assets);
    const technicalPageSeeds = buildTechnicalPageSeeds(
        snapshot,
        luminaires,
        ambientDetails,
        assets,
        levelSummaries,
        glossaryEntries,
    );
    const fixedPageCount = fixedPageSeeds.length;
    const toc = generateFormalTocFromSeeds(
        fixedPageCount,
        fixedPageSeeds,
        technicalPageSeeds,
        snapshot,
    );
    const tocPageCount = Math.max(1, Math.ceil(toc.length / TOC_ROWS_PER_PAGE));

    const pages: DialuxDocumentPage[] = [
        ...fixedPageSeeds.map((seed, index) => ({
            id: seed.id,
            kind: seed.kind,
            sectionId: seed.sectionId,
            pageNumber: index + 1,
            title: seed.title,
            subtitle: seed.subtitle,
            assetIds: seed.assetIds,
            notes: seed.notes,
            ambientId: seed.ambientId ?? null,
            roomId: seed.roomId ?? null,
            sceneId: seed.sceneId ?? null,
            sceneName: seed.sceneName ?? null,
            rowRangeStart: seed.rowRangeStart ?? null,
            rowRangeEnd: seed.rowRangeEnd ?? null,
        })),
        ...Array.from({ length: tocPageCount }, (_, index) => ({
            id: `page-content-${index + 1}`,
            kind: 'toc' as const,
            sectionId: 'content' as const,
            pageNumber: fixedPageCount + 1 + index,
            title: 'Contenido',
            subtitle:
                tocPageCount > 1
                    ? `Indice ${index + 1} de ${tocPageCount}`
                    : 'Indice del documento',
            assetIds: [],
            notes: [],
        })),
    ];

    const firstTechnicalPage = fixedPageCount + tocPageCount + 1;

    technicalPageSeeds.forEach((seed, index) => {
        pages.push({
            id: seed.id,
            kind: seed.kind,
            sectionId: seed.sectionId,
            pageNumber: firstTechnicalPage + index,
            title: seed.title,
            subtitle: seed.subtitle,
            assetIds: seed.assetIds,
            notes: seed.notes,
            ambientId: seed.ambientId ?? null,
            roomId: seed.roomId ?? null,
            sceneId: seed.sceneId ?? null,
            sceneName: seed.sceneName ?? null,
            rowRangeStart: seed.rowRangeStart ?? null,
            rowRangeEnd: seed.rowRangeEnd ?? null,
            sceneComparison: seed.sceneComparison ?? null,
        });
    });

    return {
        formatVersion: '1.0.0',
        schemaVersion: DIALUX_FORMAL_DOCUMENT_SCHEMA_VERSION,
        title: `${snapshot.project.name} · Informe Luminotécnico PCL`,
        subtitle: snapshot.scene.name,
        fileBaseName: `${toFileBaseName(snapshot.project.name || 'dialux')}-reporte-formal`,
        generatedAt: snapshot.exportedAt,
        paper: {
            format: 'A4',
            orientation: 'portrait',
        },
        header: {
            title: snapshot.project.name,
            subtitle: snapshot.scene.name,
        },
        footer: {
            left: 'PCL',
            right: snapshot.exportedAt.slice(0, 10),
        },
        metadata: [
            { label: 'Proyecto', value: snapshot.project.name },
            { label: 'Escena', value: snapshot.scene.name },
            { label: 'Exportado', value: snapshot.exportedAt },
            { label: 'Formato', value: 'A4 vertical' },
            { label: 'Ambientes', value: `${snapshot.summary.ambientCount}` },
            { label: 'Luminarias', value: `${snapshot.summary.fixtureCount}` },
            {
                label: 'Estado calculo',
                value:
                    snapshot.summary.ambientCount === 0
                        ? 'Sin ambientes'
                        : snapshot.summary.calculatedAmbientCount === 0
                          ? 'Sin calcular'
                          : snapshot.summary.calculatedAmbientCount <
                              snapshot.summary.ambientCount
                            ? `Parcial (${snapshot.summary.calculatedAmbientCount}/${snapshot.summary.ambientCount})`
                            : snapshot.summary.compliantAmbientCount >=
                                snapshot.summary.ambientCount
                              ? 'Conforme'
                              : `Revisar (${snapshot.summary.compliantAmbientCount}/${snapshot.summary.ambientCount})`,
            },
            {
                label: 'Lux promedio',
                value: snapshot.summary.averageLux.toFixed(1),
            },
        ],
        pages,
        toc,
        luminaires,
        luminaireTotals,
        levels: levelSummaries,
        ambientDetails,
        assets,
        glossary: glossaryEntries,
    };
}

export function generateDialuxToc(
    document: DialuxFormalDocument,
): DialuxTocEntry[] {
    return document.toc;
}
