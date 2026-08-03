import axios from 'axios';
import * as productRoutes from '@/routes/dialux/products';
import type { DialuxExportSnapshot, DialuxExportAsset, DialuxBitmapAsset, DialuxAssetPurpose } from '../../domain/types';

export async function fetchImageAsBitmapAsset(
    url: string,
    assetId: string,
    title: string,
    purpose: DialuxAssetPurpose,
): Promise<DialuxBitmapAsset | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

        return await new Promise<DialuxBitmapAsset | null>((resolve) => {
            const img = new Image();
            img.onload = () => {
                resolve({
                    id: assetId,
                    title,
                    purpose,
                    kind: 'bitmap',
                    mimeType: (blob.type as 'image/png' | 'image/jpeg') || 'image/png',
                    dataUrl,
                    width: img.width,
                    height: img.height,
                });
            };
            img.onerror = () => {
                console.warn(`[dialux-export] Failed to load image dimensions for ${assetId}`);
                resolve(null);
            };
            img.src = dataUrl;
        });
    } catch (e) {
        console.error(`[dialux-export] Failed to fetch image from ${url}`, e);
        return null;
    }
}

export async function enrichProducts(snapshot: DialuxExportSnapshot): Promise<DialuxExportAsset[]> {
    const assets: DialuxExportAsset[] = [];

    const uniqueProductIds = [
        ...new Set(
            snapshot.fixtures
                .map((f) => f.productId)
                .filter((id): id is number => typeof id === 'number'),
        ),
    ];

    const productMap = new Map<number, any>();

    await Promise.all(
        uniqueProductIds.map(async (id) => {
            try {
                const response = await axios.get(
                    productRoutes.show.url({ productId: id }),
                );
                const product = response.data.product;
                if (product) {
                    productMap.set(id, product);

                    const web = product.photometric_web || {};
                    const reportAssets = product.report_assets || {};
                    if (typeof reportAssets.polar_svg === 'string' && reportAssets.polar_svg.trim() !== '') {
                        assets.push({
                            id: `prod-${id}-polar`,
                            title: `Diagrama polar - ${product.name}`,
                            purpose: 'ambient-catalog',
                            kind: 'vector',
                            mimeType: 'image/svg+xml',
                            svg: reportAssets.polar_svg,
                            width: 640,
                            height: 520,
                        });
                    }

                    const visuals = [
                        { key: 'product_photo', url: product.product_image_url, purpose: 'ambient-catalog' as const, suffix: 'photo', label: 'Foto de producto' },
                        { key: 'brand_logo', url: product.brand_logo_url, purpose: 'ambient-catalog' as const, suffix: 'logo', label: 'Logo de marca' },
                        { key: 'line_drawing', purpose: 'ambient-catalog' as const, suffix: 'drawing', label: 'Dibujo dimensional' },
                        ...(reportAssets.polar_svg ? [] : [{ key: 'polar_diagram', purpose: 'ambient-catalog' as const, suffix: 'polar', label: 'Diagrama polar' }]),
                    ];

                    for (const visual of visuals) {
                        const url = visual.url ?? web[visual.key];
                        if (url && typeof url === 'string') {
                            const assetId = `prod-${id}-${visual.suffix}`;
                            const title = `${visual.label} - ${product.name}`;
                            const asset = await fetchImageAsBitmapAsset(url, assetId, title, visual.purpose);
                            if (asset) {
                                assets.push(asset);
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn(`[dialux-export] Failed to fetch product ${id} details`, e);
            }
        }),
    );

    for (const fixture of snapshot.fixtures) {
        if (typeof fixture.productId === 'number') {
            const product = productMap.get(fixture.productId);
            if (product) {
                const web = product.photometric_web || {};
                const reportAssets = product.report_assets || {};
                if (web.polar_diagram || reportAssets.polar_svg) fixture.polarDiagramAssetId = `prod-${fixture.productId}-polar`;
                if (web.product_photo || product.product_image_url) fixture.productPhotoAssetId = `prod-${fixture.productId}-photo`;
                if (product.brand_logo_url) fixture.brandLogoAssetId = `prod-${fixture.productId}-logo`;
                if (web.line_drawing) fixture.lineDrawingAssetId = `prod-${fixture.productId}-drawing`;

                fixture.brand = fixture.brand ?? product.manufacturer;
                fixture.articleNumber = fixture.articleNumber ?? product.catalog_number;
                fixture.productSourceFormat = fixture.productSourceFormat ?? product.source_format;
                fixture.cct = fixture.cct ?? (typeof product.cct === 'string' ? parseInt(product.cct) : product.cct);
                fixture.cri = fixture.cri ?? product.cri_ra;
                fixture.description = fixture.description ?? product.description;
                fixture.reportData = fixture.reportData ?? product.report_data ?? null;
                fixture.reportAssets = fixture.reportAssets ?? product.report_assets ?? null;

                if (!fixture.ugrTable && product.photometric_summary?.ugr_table) {
                    fixture.ugrTable = product.photometric_summary.ugr_table;
                }
            }
        }
    }

    return assets;
}
