import type {
    DialuxExportAsset,
    DialuxExportSnapshot,
    DialuxLuminaireListItem,
    DialuxStructuredSummaryData,
} from '../domain/types';
import { findStructuredSummaryData } from './ambientDossier';
import type { PageSeed } from './pageSeed';

/**
 * Páginas fijas iniciales del informe formal (portada + observaciones
 * preliminares). Extraído de `buildDialuxFormalDocument.ts` (Fase 2 del plan
 * maestro) sin cambiar comportamiento.
 */

function buildPreliminaryNotes(
    snapshot: DialuxExportSnapshot,
    luminaires: DialuxLuminaireListItem[],
    summaryAsset: DialuxStructuredSummaryData | null,
): string[] {
    const missingResults =
        snapshot.summary.calculatedAmbientCount < snapshot.summary.ambientCount;
    const hasFixtures = snapshot.summary.fixtureCount > 0;
    const summaryLine = summaryAsset?.items
        .map((item) => `${item.label}: ${item.value}`)
        .join(' | ');

    return [
        'Objetivo del estudio: documentar en formato formal el estado del modelado luminico, la jerarquia recinto -> ambiente y los principales indicadores tecnicos del proyecto exportado.',
        `Alcance del documento: ${snapshot.summary.roomCount} recinto(s), ${snapshot.summary.ambientCount} ambiente(s) derivado(s) y ${snapshot.summary.fixtureCount} luminaria(s) registradas en la escena activa.`,
        'Base de calculo: los lux promedio, uniformidad y UGR se leen desde los resultados almacenados por ambiente; las cantidades propuestas se derivan de area, lux objetivo y flujo luminoso disponible.',
        'Criterios de lectura: E avg se compara con el lux objetivo del ambiente, Uo describe uniformidad del plano util y UGR resume control de deslumbramiento cuando el resultado esta disponible.',
        missingResults
            ? 'Advertencia: no todos los ambientes cuentan con resultados de calculo; las secciones tecnicas deben interpretarse como avance parcial hasta recalcular la escena completa.'
            : 'Estado del calculo: todos los ambientes del snapshot cuentan con resultados luminotecnicos listos para su lectura en el reporte.',
        hasFixtures
            ? `Inventario preliminar: ${luminaires.length} tipologia(s) de luminarias detectadas y agrupadas para las paginas tecnicas posteriores.`
            : 'Inventario preliminar: la escena activa no registra luminarias, por lo que la propuesta tecnica requiere completar activos antes de emitir un informe final.',
        summaryLine
            ? `Resumen del proyecto: ${summaryLine}`
            : 'Resumen del proyecto: usar metadata y assets estructurados como fuente unica de lectura para las siguientes secciones del reporte.',
    ];
}

export function buildFixedPageSeeds(
    snapshot: DialuxExportSnapshot,
    luminaires: DialuxLuminaireListItem[],
    assets: DialuxExportAsset[],
): PageSeed[] {
    const summaryData = findStructuredSummaryData(
        assets,
        'project-summary-data',
    );
    const coverAssetId =
        assets.find((asset) => asset.id === 'viewer-capture-3d')?.id ??
        assets.find((asset) => asset.id === 'formal-cover-svg')?.id ??
        assets.find((asset) => asset.id === 'viewer-capture')?.id ??
        assets.find((asset) => asset.purpose === 'formal-cover')?.id ??
        '';
    const preliminaryAssetIds = [
        'project-summary-data',
        'viewer-capture',
        'formal-cover-svg',
        'terrain-with-isolux-svg',
        'cad-overview-svg',
        'lighting-results-data',
    ].filter((id) => assets.some((asset) => asset.id === id));

    return [
        {
            id: 'page-cover',
            kind: 'cover',
            sectionId: 'cover',
            title: 'Portada',
            subtitle: snapshot.scene.name,
            assetIds: coverAssetId ? [coverAssetId] : [],
            notes: [],
        },
        {
            id: 'page-preliminary-observations',
            kind: 'preliminary-observations',
            sectionId: 'preliminary-observations',
            title: 'Observaciones preliminares',
            subtitle: 'Base tecnica y criterios iniciales del reporte',
            assetIds: preliminaryAssetIds,
            notes: buildPreliminaryNotes(snapshot, luminaires, summaryData),
        },
    ];
}
