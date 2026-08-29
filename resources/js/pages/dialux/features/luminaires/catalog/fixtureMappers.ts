import type { Fixture } from '@/pages/dialux/hooks/useEditorStore';
import type { ImportedLuminaireProduct } from './catalogApi';

/** Extraído de `components/CatalogPanel.tsx` (Fase 2) sin cambiar comportamiento. */

export function toFixtureType(value: string | null | undefined): Fixture['fixtureType'] {
    const allowed: Fixture['fixtureType'][] = ['recessed', 'pendant', 'surface', 'spot', 'strip', 'panel', 'tube'];
    return allowed.includes(value as Fixture['fixtureType']) ? (value as Fixture['fixtureType']) : 'panel';
}

export function toFixtureShape(value: string | null | undefined): Fixture['fixtureShape'] {
    const allowed: NonNullable<Fixture['fixtureShape']>[] = ['round', 'square', 'rectangular', 'cylindrical'];
    return allowed.includes(value as NonNullable<Fixture['fixtureShape']>) ? (value as Fixture['fixtureShape']) : 'rectangular';
}

/** Traduce un producto importado del catálogo a los campos de `Fixture` que aplica al colocar/actualizar una luminaria. */
export function productToFixtureFields(product: ImportedLuminaireProduct): Partial<Fixture> {
    const lumens = product.total_lumens ?? 1000;
    const power = product.power_watts ?? undefined;

    return {
        fixtureType: toFixtureType(product.fixture_type),
        fixtureShape: toFixtureShape(product.fixture_shape),
        lumens,
        power,
        efficiency: product.efficiency && product.efficiency > 0 ? Math.min(1, product.efficiency / 100) : 0.85,
        cri: product.cri_ra ?? null,
        lightColor: product.cct?.startsWith('3') ? '#fff5e1' : '#f0f8ff',
        brand: product.manufacturer ?? undefined,
        articleNumber: product.catalog_number ?? undefined,
        productId: product.id,
        productSourceFormat: product.source_format,
        reportData: product.report_data ?? null,
        reportAssets: {
            ...(product.report_assets ?? {}),
            product_photo_url: product.product_image_url ?? null,
            brand_logo_url: product.brand_logo_url ?? null,
        },
        dimensions: product.dimensions ?? undefined,
        luminousOpening: product.luminous_opening ?? null,
        metadata: product.metadata ?? null,
        name: product.name,
    };
}

/**
 * Un producto importado "coincide" con la plantilla actual del store — usado
 * para resaltar el ítem activo. El único identificador fiable es `productId`
 * (lo asigna `productToFixtureFields`): sin él, dos productos distintos con la
 * misma marca/lúmenes/tipo se resaltaban a la vez, y un producto importado se
 * resaltaba junto a un ítem del catálogo estático de specs equivalentes.
 */
export function isImportedProductActive(
    product: ImportedLuminaireProduct,
    fixtureTemplate: { productId?: number | null },
): boolean {
    return fixtureTemplate.productId != null && fixtureTemplate.productId === product.id;
}
