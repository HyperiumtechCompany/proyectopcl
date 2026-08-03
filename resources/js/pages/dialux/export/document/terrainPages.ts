import type { DialuxExportAsset } from '../domain/types';
import type { PageSeed } from './pageSeed';

/**
 * Páginas de plano de terreno (CAD base → dibujo → isolux). Extraído de
 * `buildDialuxFormalDocument.ts` (Fase 2 del plan maestro) sin cambiar
 * comportamiento — mismo orden solicitado por el formato DIALux evo: plano
 * solo → plano con dibujo → plano con isolux.
 */
export function buildTerrainPageSeeds(assets: DialuxExportAsset[]): PageSeed[] {
    const seeds: PageSeed[] = [];

    // 1a. Plano base importado (solo CAD DXF, sin recintos)
    const cadSvgAssetId = assets.some((a) => a.id === 'cad-overview-svg')
        ? 'cad-overview-svg'
        : assets.some((a) => a.id === 'cad-base-bitmap')
          ? 'cad-base-bitmap'
          : null;

    if (cadSvgAssetId) {
        seeds.push({
            id: 'page-terrain-cad',
            kind: 'terrain-cad',
            sectionId: 'cad-overview',
            title: 'Terreno 1 - Edificación 1',
            subtitle: 'Plano base importado',
            assetIds: [cadSvgAssetId],
            notes: [],
        });
    }

    // 1b. Lista de locales (CAD + recintos dibujados, sin isolux).
    // La captura compuesta del editor (CAD + overlay alineados) es la fuente
    // preferida; el SVG sintético queda como fallback sin DOM/captura.
    const drawnTerrainAssetId = assets.some(
        (a) => a.id === 'composite-plan-bitmap',
    )
        ? 'composite-plan-bitmap'
        : assets.some((a) => a.id === 'drawn-terrain-svg')
          ? 'drawn-terrain-svg'
          : cadSvgAssetId;

    seeds.push({
        id: 'page-terrain-ambient-list',
        kind: 'ambient-list',
        sectionId: 'ambient-list',
        title: 'Lista de locales / Escena de luz 1',
        subtitle: 'Terreno 1 - Edificacion 1',
        assetIds: drawnTerrainAssetId ? [drawnTerrainAssetId] : [],
        notes: [],
    });

    // 1c. Plano Arquitectónico con Isolux superpuesto (CAD + recintos + isolux)
    const terrainIsoluxAssetId = assets.some(
        (a) => a.id === 'composite-isolux-bitmap',
    )
        ? 'composite-isolux-bitmap'
        : assets.some((a) => a.id === 'terrain-with-isolux-svg')
          ? 'terrain-with-isolux-svg'
          : drawnTerrainAssetId;

    if (terrainIsoluxAssetId) {
        seeds.push({
            id: 'page-terrain-architectural',
            kind: 'terrain-architectural',
            sectionId: 'architectural-overview',
            title: 'Terreno 1 - Edificación 1',
            subtitle: 'Plano Arquitectónico con Isolux',
            assetIds: [terrainIsoluxAssetId],
            notes: [],
        });
    }

    return seeds;
}
