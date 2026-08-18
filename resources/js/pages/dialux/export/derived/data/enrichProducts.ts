import axios from 'axios';
import * as productRoutes from '@/routes/dialux/products';
import type { DialuxExportSnapshot, DialuxExportAsset, DialuxBitmapAsset, DialuxAssetPurpose, ProductUgrTable } from '../../domain/types';
import { buildPolarSvgFromMatrix } from './buildPolarSvgFromMatrix';
import { computeEngineUgrTable, computeEngineUgrTables } from './computeEngineUgrTable';

export interface EnrichProductsResult {
    assets: DialuxExportAsset[];
    /** Fase 15: advertencias trazables (nunca solo `console.warn`) cuando un fixture se queda sin CDL a pesar de agotar todas las fuentes disponibles. */
    warnings: string[];
}

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

export async function enrichProducts(snapshot: DialuxExportSnapshot): Promise<EnrichProductsResult> {
    const assets: DialuxExportAsset[] = [];
    const warnings: string[] = [];

    const uniqueProductIds = [
        ...new Set(
            snapshot.fixtures
                .map((f) => f.productId)
                .filter((id): id is number => typeof id === 'number'),
        ),
    ];

    const productMap = new Map<number, any>();
    const failedProductIds = new Map<number, string>();
    // Fase 15, Parte B: memoiza por producto — varios fixtures del mismo
    // producto comparten la misma matriz fotométrica, no tiene sentido
    // recalcular la tabla de referencia UGR (varias salas × 2 direcciones)
    // más de una vez por producto.
    const ugrTableByProductId = new Map<number, ProductUgrTable | null>();
    const ugrTablesByProductId = new Map<number, ProductUgrTable[] | null>();

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
                // Fase 15: ya no se traga el error en silencio — el fixture
                // igual puede resolver su CDL con datos locales más abajo
                // (`fixture.reportAssets`/`fixture.photometricWeb`), pero si
                // ninguno existe se advierte con el productId y la causa.
                failedProductIds.set(id, e instanceof Error ? e.message : String(e));
            }
        }),
    );

    for (const fixture of snapshot.fixtures) {
        // Fase 15, Parte A ("CDL polar sin dependencia de red"): la fuente
        // local YA persistida en el proyecto tiene prioridad sobre el
        // catálogo remoto — un fallo de red nunca debe perder una CDL que
        // ya estaba guardada.
        const localPolarSvg = fixture.reportAssets?.polar_svg;
        if (typeof localPolarSvg === 'string' && localPolarSvg.trim() !== '') {
            const assetId = `fixture-${fixture.id}-polar`;
            assets.push({
                id: assetId,
                title: `Diagrama polar - ${fixture.name}`,
                purpose: 'ambient-catalog',
                kind: 'vector',
                mimeType: 'image/svg+xml',
                svg: localPolarSvg,
                width: 640,
                height: 520,
            });
            fixture.polarDiagramAssetId = assetId;
        }

        if (typeof fixture.productId === 'number') {
            const product = productMap.get(fixture.productId);
            if (product) {
                const web = product.photometric_web || {};
                const reportAssets = product.report_assets || {};
                if (!fixture.polarDiagramAssetId && (web.polar_diagram || reportAssets.polar_svg)) {
                    fixture.polarDiagramAssetId = `prod-${fixture.productId}-polar`;
                }
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
            }
        }

        // Última fuente: generación determinista desde la matriz fotométrica
        // ya presente en el snapshot (Fase 15) — nunca depende de la red.
        if (!fixture.polarDiagramAssetId) {
            const generatedSvg = buildPolarSvgFromMatrix(fixture.photometricWeb, fixture.name);
            if (generatedSvg) {
                const assetId = `fixture-${fixture.id}-polar-generated`;
                assets.push({
                    id: assetId,
                    title: `Diagrama polar - ${fixture.name}`,
                    purpose: 'ambient-catalog',
                    kind: 'vector',
                    mimeType: 'image/svg+xml',
                    svg: generatedSvg,
                    width: 640,
                    height: 520,
                });
                fixture.polarDiagramAssetId = assetId;
            } else if (typeof fixture.productId === 'number' && failedProductIds.has(fixture.productId)) {
                warnings.push(
                    `"${fixture.name}" (producto ${fixture.productId}): no se pudo obtener la CDL polar del catálogo (${failedProductIds.get(fixture.productId)}) y no hay datos locales (reportAssets/photometricWeb) para generarla.`,
                );
            }
        }

        // Fase 15, Parte B: tabla de referencia UGR — solo sobre fotometría
        // real de fabricante ya presente localmente (nunca depende de la
        // red: `computeEngineUgrTable` lee `fixture.photometricWeb`).
        let ugrTableComputed: ProductUgrTable | null = null;
        if (typeof fixture.productId === 'number') {
            if (!ugrTableByProductId.has(fixture.productId)) {
                const result = computeEngineUgrTable(fixture);
                ugrTableByProductId.set(fixture.productId, result.available ? result.table : null);
            }
            ugrTableComputed = ugrTableByProductId.get(fixture.productId) ?? null;
        } else {
            const result = computeEngineUgrTable(fixture);
            ugrTableComputed = result.available ? result.table : null;
        }
        // Ronda 21c: grilla de 5 combinaciones de reflectancia habituales, la
        // misma que ya se usa en el modal de previsualización — se muestra
        // en el PDF en una sección de ancho completo (no en la columna
        // angosta de 50% que usa el diagrama polar) porque 11 columnas
        // densas no caben legibles en la mitad de una página A4. La tabla
        // singular (`ugrTableComputed`, 70/50/20) se mantiene sin tocar por
        // si algún renderizador viejo todavía la espera.
        let ugrTablesComputed: ProductUgrTable[] | null = null;
        if (typeof fixture.productId === 'number') {
            if (!ugrTablesByProductId.has(fixture.productId)) {
                const result = computeEngineUgrTables(fixture);
                ugrTablesByProductId.set(fixture.productId, result.available ? result.tables : null);
            }
            ugrTablesComputed = ugrTablesByProductId.get(fixture.productId) ?? null;
        } else {
            const result = computeEngineUgrTables(fixture);
            ugrTablesComputed = result.available ? result.tables : null;
        }

        if (ugrTableComputed) {
            fixture.reportData = { ...(fixture.reportData ?? {}), ugrTableComputed };
        }
        if (ugrTablesComputed) {
            fixture.reportData = { ...(fixture.reportData ?? {}), ugrTablesComputed };
        }
    }

    return { assets, warnings };
}
