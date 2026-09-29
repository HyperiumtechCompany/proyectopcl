import { buildPolarSvgFromMatrix } from '@/pages/dialux/export/derived/data/buildPolarSvgFromMatrix';
import { fetchImageAsBitmapAsset } from '@/pages/dialux/export/derived/data/enrichProducts';
import type { DialuxExportAsset } from '@/pages/dialux/export/domain/types';
import type { SiteData } from '../domain/types';
import { loadProductDetail } from '../lib/luminaireCatalog';
import type { ProductSheetData } from './buildSiteFormalDocument';

/** Productos del catálogo usados por la planta (postes, portones, techados, balizas). */
export function siteProductIds(site: SiteData): number[] {
    const ids = new Set<number>();
    for (const element of site.elements ?? []) {
        if (element.visible === false) continue;
        const config = element.config as
            | { kind?: string; productId?: number; lights?: { enabled?: boolean; productId?: number } }
            | undefined;
        if (config?.kind === 'pole' && config.productId !== undefined) ids.add(config.productId);
        if (config?.lights?.productId !== undefined) ids.add(config.lights.productId);
    }
    return [...ids];
}

const num = (value: unknown) => (value === null || value === undefined || value === '' ? null : Number(value));
const fmt = (value: number | null, unit: string, digits = 0) =>
    value === null || !Number.isFinite(value)
        ? null
        : `${value.toLocaleString('es-PE', { maximumFractionDigits: digits })} ${unit}`;

/** Tabla técnica armada con los datos del LDT/IES del producto (sin inventar: un dato ausente no se lista). */
export function productTechnicalTable(product: Record<string, unknown>): Array<{ label: string; value: string }> {
    const reportTable = (
        (product.report_data as { technical_table?: Array<{ label: string; value: string }> } | null)?.technical_table ?? []
    ).filter((row) => row && row.label && row.value);
    if (reportTable.length > 0) return reportTable;
    const dimensions = product.dimensions as { length?: number; width?: number; height?: number } | null;
    const lumens = num(product.total_lumens);
    const watts = num(product.power_watts);
    const rows: Array<[string, string | null]> = [
        ['Fabricante', (product.manufacturer as string | null) ?? null],
        ['N.º de artículo', ((product.article_number ?? product.catalog_number) as string | null) ?? null],
        ['Flujo luminoso', fmt(lumens, 'lm')],
        ['Potencia', fmt(watts, 'W', 1)],
        ['Eficacia', lumens && watts ? fmt(lumens / watts, 'lm/W', 1) : null],
        ['Temperatura de color', product.cct ? `${String(product.cct)} K` : null],
        ['IRC (Ra)', product.cri_ra ? String(product.cri_ra) : null],
        ['Ángulo de haz (50 %)', fmt(num(product.beam_angle_50), '°')],
        ['Distribución', (product.distribution_type as string | null) ?? null],
        [
            'Medidas (L × A × H)',
            dimensions && (dimensions.length || dimensions.width)
                ? `${Math.round(Number(dimensions.length ?? 0) * 1000)} × ${Math.round(Number(dimensions.width ?? 0) * 1000)} × ${Math.round(Number(dimensions.height ?? 0) * 1000)} mm`
                : null,
        ],
        ['Archivo fotométrico', [product.source_format, product.source_file_name].filter(Boolean).join(' · ') || null],
    ];
    return rows
        .filter((row): row is [string, string] => Boolean(row[1]))
        .map(([label, value]) => ({ label, value: value.slice(0, 255) }));
}

/**
 * Ficha de producto de la V1 para cada producto usado en la planta: curva
 * polar (la del catálogo o generada desde la matriz del LDT — mismo generador
 * de la V1), foto y logo del catálogo y la tabla técnica.
 */
export async function buildSiteProductSheets(site: SiteData): Promise<{
    sheets: Map<number, ProductSheetData>;
    assets: DialuxExportAsset[];
}> {
    const sheets = new Map<number, ProductSheetData>();
    const assets: DialuxExportAsset[] = [];
    await Promise.all(
        siteProductIds(site).map(async (id) => {
            const product = await loadProductDetail(id);
            if (!product) return;
            const name = String(product.name ?? `Producto ${id}`);
            const sheet: ProductSheetData = { technicalTable: productTechnicalTable(product) };
            const reportAssets = (product.report_assets ?? {}) as Record<string, unknown>;
            const polarSvg =
                typeof reportAssets.polar_svg === 'string' && reportAssets.polar_svg.trim() !== ''
                    ? reportAssets.polar_svg
                    : buildPolarSvgFromMatrix(
                          product.photometric_web as Parameters<typeof buildPolarSvgFromMatrix>[0],
                          name,
                          num(product.total_lumens) ?? undefined,
                      );
            if (polarSvg) {
                const assetId = `site-prod-${id}-polar`;
                assets.push({
                    id: assetId,
                    title: `Diagrama polar - ${name}`,
                    purpose: 'ambient-catalog',
                    kind: 'vector',
                    mimeType: 'image/svg+xml',
                    svg: polarSvg,
                    width: 640,
                    height: 520,
                });
                sheet.polarDiagramAssetId = assetId;
            }
            if (typeof product.product_image_url === 'string' && product.product_image_url) {
                const asset = await fetchImageAsBitmapAsset(product.product_image_url, `site-prod-${id}-photo`, `Foto - ${name}`, 'ambient-catalog');
                if (asset) {
                    assets.push(asset);
                    sheet.productPhotoAssetId = asset.id;
                }
            }
            if (typeof product.brand_logo_url === 'string' && product.brand_logo_url) {
                const asset = await fetchImageAsBitmapAsset(product.brand_logo_url, `site-prod-${id}-logo`, `Logo - ${name}`, 'ambient-catalog');
                if (asset) {
                    assets.push(asset);
                    sheet.brandLogoAssetId = asset.id;
                }
            }
            sheet.cct = num(product.cct);
            sheet.cri = num(product.cri_ra);
            sheets.set(id, sheet);
        }),
    );
    return { sheets, assets };
}
