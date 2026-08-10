import type {
    DialuxAmbientLuminaireItem,
    DialuxExportSnapshot,
    DialuxLuminaireListItem,
    DialuxLuminaireTotals,
} from '../domain/types';
import type { PageSeed } from './pageSeed';
import { chunkIndices, LUMINAIRE_ROWS_PER_PAGE } from './pagination';

/**
 * Agregación y páginas de luminarias/productos del informe formal. Extraído
 * de `buildDialuxFormalDocument.ts` (Fase 2 del plan maestro) sin cambiar
 * comportamiento.
 */

export function readFixturePowerWatts(
    fixture: DialuxExportSnapshot['fixtures'][number],
): number | null {
    return 'power' in fixture && typeof fixture.power === 'number'
        ? fixture.power
        : null;
}

export function stripCopyCounter(name: string): string {
    return name.replace(/\s*[\[\(]\d+[\]\)]\s*$/, '').trim();
}

/**
 * Clave de agrupación de luminarias al estilo DIALux evo: el mismo producto
 * (misma referencia de catálogo) se consolida en una sola fila con cantidad,
 * sin importar en cuántos ambientes esté colocado ni el sufijo de copia
 * "[n]"/"(n)" del nombre de la instancia.
 */
export function buildProductGroupKey(
    fixture: DialuxExportSnapshot['fixtures'][number],
): string {
    if (fixture.productId !== undefined && fixture.productId !== null) {
        return `prod::${fixture.productId}`;
    }

    return [
        (fixture.brand ?? 'sin-fabricante').trim().toLowerCase(),
        (fixture.articleNumber ?? 'sin-articulo').trim().toLowerCase(),
        stripCopyCounter(fixture.name).toLowerCase(),
    ].join('::');
}

export function buildLuminaireList(
    snapshot: DialuxExportSnapshot,
): DialuxLuminaireListItem[] {
    const groupedFixtures = new Map<string, DialuxLuminaireListItem>();

    for (const fixture of snapshot.fixtures) {
        const ambient = snapshot.ambients.find(
            (candidate) => candidate.room.id === fixture.roomId,
        );
        const roomName =
            ambient?.roomName ??
            snapshot.rooms.find((room) => room.id === fixture.roomId)?.name ??
            null;
        const powerWatts = readFixturePowerWatts(fixture);
        const baseName = stripCopyCounter(fixture.name);
        const key = buildProductGroupKey(fixture);

        const currentItem = groupedFixtures.get(key);
        if (currentItem) {
            currentItem.quantity += 1;
            continue;
        }

        const lumens = fixture.lumens ?? null;
        const efficiency =
            lumens !== null && powerWatts !== null && powerWatts > 0
                ? Number((lumens / powerWatts).toFixed(1))
                : null;

        groupedFixtures.set(key, {
            id: fixture.id,
            name: baseName,
            model: fixture.fixtureType ?? fixture.fixtureShape ?? 'No definido',
            brand: fixture.brand ?? null,
            articleNumber:
                fixture.articleNumber ??
                fixture.productSourceFormat?.toUpperCase() ??
                fixture.fixtureType ??
                null,
            fixtureShape: fixture.fixtureShape ?? null,
            shape: fixture.fixtureShape ?? null,
            lumens,
            powerWatts,
            efficiency,
            roomName,
            ambientName: ambient?.name ?? null,
            quantity: 1,
            cct: fixture.cct ?? null,
            cri: fixture.cri ?? null,
            description: fixture.description ?? null,
            applications: fixture.applications ?? null,
            reportData: fixture.reportData ?? null,
            reportAssets: fixture.reportAssets ?? null,
            ugrTable: fixture.ugrTable ?? null,
            ugrDiagramValue: fixture.ugrDiagramValue ?? null,
            polarDiagramAssetId: fixture.polarDiagramAssetId ?? null,
            productPhotoAssetId: fixture.productPhotoAssetId ?? null,
            brandLogoAssetId: fixture.brandLogoAssetId ?? null,
            lineDrawingAssetId: fixture.lineDrawingAssetId ?? null,
        });
    }

    return [...groupedFixtures.values()].sort((left, right) =>
        left.name.localeCompare(right.name, 'es'),
    );
}

export function buildLuminaireTotals(
    luminaires: DialuxLuminaireListItem[],
): DialuxLuminaireTotals {
    const totalLumens = luminaires.reduce(
        (sum, luminaire) => sum + (luminaire.lumens ?? 0) * luminaire.quantity,
        0,
    );
    const totalPowerWatts = luminaires.reduce(
        (sum, luminaire) =>
            sum + (luminaire.powerWatts ?? 0) * luminaire.quantity,
        0,
    );

    return {
        totalLumens: Number(totalLumens.toFixed(0)),
        totalPowerWatts: Number(totalPowerWatts.toFixed(1)),
        overallEfficiency:
            totalPowerWatts > 0
                ? Number((totalLumens / totalPowerWatts).toFixed(1))
                : 0,
    };
}

export function buildAmbientLuminaireList(
    ambient: DialuxExportSnapshot['ambients'][number],
): DialuxAmbientLuminaireItem[] {
    const groupedFixtures = new Map<string, DialuxAmbientLuminaireItem>();

    for (const fixture of ambient.fixtures) {
        const powerWatts = readFixturePowerWatts(fixture);
        const baseName = stripCopyCounter(fixture.name);
        const key = buildProductGroupKey(fixture);
        const existing = groupedFixtures.get(key);

        if (existing) {
            existing.quantity += 1;
            continue;
        }

        const lumens = fixture.lumens ?? null;
        const efficiency =
            lumens !== null && powerWatts !== null && powerWatts > 0
                ? Number((lumens / powerWatts).toFixed(1))
                : null;

        groupedFixtures.set(key, {
            id: fixture.id,
            name: baseName,
            model: fixture.fixtureType ?? fixture.fixtureShape ?? 'No definido',
            brand: fixture.brand ?? null,
            articleNumber:
                fixture.articleNumber ??
                fixture.productSourceFormat?.toUpperCase() ??
                fixture.fixtureType ??
                null,
            fixtureShape: fixture.fixtureShape ?? null,
            shape: fixture.fixtureShape ?? null,
            lumens,
            powerWatts,
            efficiency,
            roomName: ambient.roomName,
            ambientName: ambient.name,
            quantity: 1,
            cct: fixture.cct ?? null,
            cri: fixture.cri ?? null,
            description: fixture.description ?? null,
            applications: fixture.applications ?? null,
            reportData: fixture.reportData ?? null,
            reportAssets: fixture.reportAssets ?? null,
            ugrTable: fixture.ugrTable ?? null,
            ugrDiagramValue: fixture.ugrDiagramValue ?? null,
            polarDiagramAssetId: fixture.polarDiagramAssetId ?? null,
            productPhotoAssetId: fixture.productPhotoAssetId ?? null,
            brandLogoAssetId: fixture.brandLogoAssetId ?? null,
            lineDrawingAssetId: fixture.lineDrawingAssetId ?? null,
        });
    }

    return [...groupedFixtures.values()].sort((left, right) =>
        left.name.localeCompare(right.name, 'es'),
    );
}

/**
 * Lista de luminarias consolidada a escala de nivel (varios ambientes de la
 * misma Scene). Mismo patrón de agrupación que `buildAmbientLuminaireList`,
 * generalizado a una lista de ambientes en vez de uno solo.
 */
export function buildLevelLuminaireList(
    ambients: DialuxExportSnapshot['ambients'],
): DialuxLuminaireListItem[] {
    const groupedFixtures = new Map<string, DialuxLuminaireListItem>();

    for (const ambient of ambients) {
        for (const fixture of ambient.fixtures) {
            const powerWatts = readFixturePowerWatts(fixture);
            const baseName = stripCopyCounter(fixture.name);
            const key = buildProductGroupKey(fixture);
            const existing = groupedFixtures.get(key);

            if (existing) {
                existing.quantity += 1;
                continue;
            }

            const lumens = fixture.lumens ?? null;
            const efficiency =
                lumens !== null && powerWatts !== null && powerWatts > 0
                    ? Number((lumens / powerWatts).toFixed(1))
                    : null;

            groupedFixtures.set(key, {
                id: fixture.id,
                name: baseName,
                model:
                    fixture.fixtureType ?? fixture.fixtureShape ?? 'No definido',
                brand: fixture.brand ?? null,
                articleNumber:
                    fixture.articleNumber ??
                    fixture.productSourceFormat?.toUpperCase() ??
                    fixture.fixtureType ??
                    null,
                fixtureShape: fixture.fixtureShape ?? null,
                shape: fixture.fixtureShape ?? null,
                lumens,
                powerWatts,
                efficiency,
                roomName: ambient.roomName,
                ambientName: ambient.name,
                quantity: 1,
                reportData: fixture.reportData ?? null,
                reportAssets: fixture.reportAssets ?? null,
            });
        }
    }

    return [...groupedFixtures.values()].sort((left, right) =>
        left.name.localeCompare(right.name, 'es'),
    );
}

/**
 * Páginas de nivel proyecto: lista de luminarias (paginada) + una ficha de
 * producto por producto único (no por instancia colocada).
 */
export function buildProductPageSeeds(
    luminaires: DialuxLuminaireListItem[],
): PageSeed[] {
    const seeds: PageSeed[] = [];

    chunkIndices(luminaires.length, LUMINAIRE_ROWS_PER_PAGE).forEach(
        (range, index) => {
            seeds.push({
                id: index === 0 ? 'page-terrain-luminaires' : `page-terrain-luminaires-p${index + 1}`,
                kind: 'luminaire-list',
                sectionId: 'cad-overview-luminaires',
                title: 'Lista de luminarias',
                subtitle:
                    index === 0
                        ? 'Terreno 1 - Edificación 1'
                        : `Terreno 1 - Edificación 1 (continuación)`,
                assetIds: [],
                notes: [],
                rowRangeStart: range.start,
                rowRangeEnd: range.end,
            });
        },
    );

    luminaires.forEach((lum) => {
        const assetIds: string[] = [];
        if (lum.brandLogoAssetId) assetIds.push(lum.brandLogoAssetId);
        if (lum.productPhotoAssetId) assetIds.push(lum.productPhotoAssetId);
        if (lum.lineDrawingAssetId) assetIds.push(lum.lineDrawingAssetId);
        if (lum.polarDiagramAssetId) assetIds.push(lum.polarDiagramAssetId);

        seeds.push({
            id: `page-product-sheet-${lum.id}`,
            kind: 'product-sheet',
            sectionId: `product-sheet:${lum.id}`,
            title: 'Ficha de producto',
            subtitle: lum.name,
            assetIds: assetIds,
            notes: [],
        });
    });

    return seeds;
}
