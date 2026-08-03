import type {
    DialuxExportDocument,
    DialuxExportSection,
    DialuxExportSnapshot,
    DialuxExportAsset,
} from '../domain/types';

function buildSections(
    snapshot: DialuxExportSnapshot,
    assets: DialuxExportAsset[],
): DialuxExportSection[] {
    const assetIds = new Set(assets.map((asset) => asset.id));
    const visualCadAssets = ['viewer-capture', 'cad-overview-svg'].filter(
        (id) => assetIds.has(id),
    );
    const isoluxVisualAssetIds = assets
        .filter(
            (asset) => asset.purpose === 'isolux' && asset.kind === 'vector',
        )
        .map((asset) => asset.id);
    const isoluxStructuredAssetIds = assets
        .filter(
            (asset) =>
                asset.purpose === 'isolux' && asset.kind === 'structured',
        )
        .map((asset) => asset.id);

    return [
        {
            id: 'project-summary',
            kind: 'project-summary',
            title: 'Resumen ejecutivo',
            description:
                'Sintesis del proyecto, estado del calculo y principales indicadores luminicos.',
            visualAssetIds: [],
            structuredAssetIds: ['project-summary-data'],
        },
        {
            id: 'cad-overview',
            kind: 'cad-overview',
            title: 'Vista general CAD',
            description:
                'Vista compuesta del plano base y de la geometria creada en DIAlux Web.',
            visualAssetIds: visualCadAssets,
            structuredAssetIds: [],
        },
        {
            id: 'ambient-catalog',
            kind: 'ambient-catalog',
            title: 'Recintos y ambientes derivados',
            description:
                'Jerarquia recinto -> ambiente exportada desde el snapshot del editor.',
            visualAssetIds: ['cad-overview-svg'].filter((id) =>
                assetIds.has(id),
            ),
            structuredAssetIds: ['ambient-catalog-data'],
        },
        {
            id: 'lighting-results-table',
            kind: 'lighting-results-table',
            title: 'Resultados luminicos por ambiente',
            description:
                'Tabla estructurada con lux, uniformidad, UGR y cumplimiento por ambiente.',
            visualAssetIds: [],
            structuredAssetIds: ['lighting-results-data'],
        },
        {
            id: 'isolux',
            kind: 'isolux',
            title: 'Isolux y malla tecnica',
            description: `Modo activo: ${snapshot.visualConfig.isoluxMode}. Cada ambiente mantiene su representacion visual y sus datos tecnicos.`,
            visualAssetIds: isoluxVisualAssetIds,
            structuredAssetIds: isoluxStructuredAssetIds,
        },
        {
            id: 'charts',
            kind: 'charts',
            title: 'Graficos comparativos',
            description:
                'Series tipadas del proyecto renderizadas como grafico vectorial para exportacion.',
            visualAssetIds: ['chart-lux-summary'].filter((id) =>
                assetIds.has(id),
            ),
            structuredAssetIds: [],
        },
        {
            id: 'technical-appendix',
            kind: 'technical-appendix',
            title: 'Anexos tecnicos',
            description:
                'Snapshot tecnico del exportado con configuracion visual, escala y datos del calculo.',
            visualAssetIds: [],
            structuredAssetIds: ['technical-appendix-data'],
        },
    ];
}

function buildMetadata(
    snapshot: DialuxExportSnapshot,
): Array<{ label: string; value: string }> {
    return [
        { label: 'Proyecto', value: snapshot.project.name },
        { label: 'Escena', value: snapshot.scene.name },
        { label: 'Formato snapshot', value: snapshot.formatVersion },
        { label: 'Escala', value: snapshot.scaleConfig.displayUnit },
        {
            label: 'Ambientes calculados',
            value: `${snapshot.summary.calculatedAmbientCount}/${snapshot.summary.ambientCount}`,
        },
        {
            label: 'Exportado',
            value: new Date(snapshot.exportedAt).toLocaleString('es-PE'),
        },
    ];
}

function normalizeFileName(value: string): string {
    return value
        .normalize('NFD')
        .replaceAll(/[\u0300-\u036f]/g, '')
        .replaceAll(/[^a-zA-Z0-9-_]+/g, '-')
        .replaceAll(/-+/g, '-')
        .replaceAll(/^-|-$/g, '')
        .toLowerCase();
}

export function buildDialuxExportDocument(
    snapshot: DialuxExportSnapshot,
    assets: DialuxExportAsset[],
): DialuxExportDocument {
    return {
        title: `Reporte DIAlux Web - ${snapshot.project.name}`,
        subtitle: `Escena ${snapshot.scene.name}`,
        fileBaseName: normalizeFileName(
            `${snapshot.project.name}-${snapshot.scene.name}-dialux-export`,
        ),
        generatedAt: snapshot.exportedAt,
        header: {
            title: snapshot.project.name,
            subtitle: `DIAlux Web · ${snapshot.scene.name}`,
        },
        footer: {
            left: 'Exportado desde DIAlux Web',
            right: new Date(snapshot.exportedAt).toLocaleString('es-PE'),
        },
        metadata: buildMetadata(snapshot),
        summary: snapshot.summary,
        sections: buildSections(snapshot, assets),
        assets,
    };
}
