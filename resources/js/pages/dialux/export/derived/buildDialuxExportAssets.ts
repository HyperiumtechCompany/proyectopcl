import { capture3DViewerBitmap } from '../assets/capture3DViewerBitmap';
import { captureCadBaseBitmap } from '../assets/captureCadBaseBitmap';
import type {
    DialuxBitmapAsset,
    DialuxExportAsset,
    DialuxExportSnapshot,
} from '../domain/types';

import { buildFormalCoverSvg } from './svg/buildCoverSvg';
import { buildChartSvg } from './svg/buildChartSvg';
import { buildAmbientPlanSvgAsset, buildAmbientIsoluxSvgAsset } from './svg/buildAmbientSvg';
import { buildDrawnTerrainSvg, buildTerrainWithIsoluxSvg } from './svg/buildTerrainSvg';
import { buildCadOverviewSvg } from './svg/buildCadOverviewSvg';
import { buildAmbientTable, buildLightingResultsTable, buildLuminaireProductTable, buildProjectSummary, buildTechnicalAppendix } from './data/buildStructuredAssets';
import { enrichProducts } from './data/enrichProducts';

export interface BuildDialuxExportAssetsOptions {
    includeViewerCapture?: boolean;
    /** Captura 3D (portada) tomada antes de conmutar la vista a 2D. */
    preCapturedViewerBitmap?: DialuxBitmapAsset | null;
    /** Captura del canvas CAD (mlightcad) solo, sin overlay. */
    preCapturedCadBitmap?: DialuxBitmapAsset | null;
    /** Captura compuesta CAD + dibujo (recintos/luminarias), sin isolux. */
    preCapturedDrawnBitmap?: DialuxBitmapAsset | null;
    /** Captura compuesta CAD + dibujo + isolux. */
    preCapturedIsoluxBitmap?: DialuxBitmapAsset | null;
}

/**
 * Genera todos los assets visuales y de datos (JSON) necesarios para
 * armar el documento PDF formal. Extrae la responsabilidad
 * del dibujado individual a módulos específicos.
 */
export async function buildDialuxExportAssets(
    snapshot: DialuxExportSnapshot,
    options: BuildDialuxExportAssetsOptions = {},
): Promise<DialuxExportAsset[]> {
    const assets: DialuxExportAsset[] = [];
    const pushAsset = (asset: DialuxExportAsset | null) => {
        if (asset) assets.push(asset);
    };

    // La rasterización SVG→bitmap requiere DOM (Image/canvas). En entornos sin
    // navegador (tests) se conserva el asset vectorial, que dompdf también acepta.
    const canRasterize =
        typeof Image !== 'undefined' && typeof document !== 'undefined';

    // 0. Enriquecer fixtures con datos de producto (foto, logo, diagrama polar,
    // tabla técnica, CCT/CRI). Muta el snapshot y devuelve los assets visuales
    // por producto que consumen las fichas de producto del documento formal.
    try {
        const enriched = await enrichProducts(snapshot);
        assets.push(...enriched.assets);
        // Fase 15: warnings trazables (productId + causa) cuando un fixture
        // se queda sin CDL a pesar de agotar catálogo remoto y datos locales
        // — se anexan a `globalWarnings` (mismo array que ya renderiza
        // `frontMatter.ts` desde la Fase 13), no solo a la consola.
        for (const message of enriched.warnings) {
            snapshot.globalWarnings.push({ code: 'product-asset-fetch-failed', message, objectId: null });
        }
    } catch (error) {
        console.warn('[DIAlux] No se pudieron enriquecer los productos:', error);
    }

    // Converts an SVG asset to a high-res PNG bitmap using a Blob URL (avoids
    // tainting issues and handles embedded data: URIs inside the SVG correctly).
    async function svgToBitmapAsset(
        svgAsset: { id: string; title: string; purpose: any; svg: string; width: number; height: number } | null
    ): Promise<DialuxExportAsset | null> {
        if (!svgAsset) return null;
        if (!canRasterize) {
            return { ...svgAsset, kind: 'vector', mimeType: 'image/svg+xml' } as DialuxExportAsset;
        }
        return new Promise((resolve) => {
            const blob = new Blob([svgAsset.svg], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                const canvas = document.createElement('canvas');
                const scale = 2.5; // High resolution for PDF cover
                canvas.width = Math.round(svgAsset.width * scale);
                canvas.height = Math.round(svgAsset.height * scale);
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.scale(scale, scale);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, svgAsset.width, svgAsset.height);
                    ctx.drawImage(img, 0, 0, svgAsset.width, svgAsset.height);
                    resolve({
                        id: svgAsset.id,
                        kind: 'bitmap',
                        mimeType: 'image/png',
                        title: svgAsset.title,
                        purpose: svgAsset.purpose,
                        dataUrl: canvas.toDataURL('image/png'),
                        width: canvas.width,
                        height: canvas.height,
                    });
                } else {
                    resolve(null);
                }
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                console.warn('[DIAlux] Failed to convert SVG to bitmap:', svgAsset.id);
                resolve(null);
            };
            img.src = url;
        });
    }

    // Converts a plan SVG to a JPEG bitmap for reliable rendering in dompdf.
    // Uses Blob URL for loading, JPEG at 0.88 quality to keep payload manageable.
    // Falls back to the original vector asset on any error.
    async function svgToPlanBitmap(
        svgAsset: { id: string; title: string; purpose: any; svg: string; width: number; height: number; kind?: string; mimeType?: string } | null
    ): Promise<DialuxExportAsset | null> {
        if (!svgAsset) return null;
        if (!canRasterize) {
            return { ...svgAsset, kind: 'vector', mimeType: 'image/svg+xml' } as DialuxExportAsset;
        }
        return new Promise((resolve) => {
            const blob = new Blob([svgAsset.svg], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                const canvas = document.createElement('canvas');
                const scale = 2.0; // Good quality for plan pages in A4 PDF
                canvas.width = Math.round(svgAsset.width * scale);
                canvas.height = Math.round(svgAsset.height * scale);
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve({ ...svgAsset, kind: 'vector', mimeType: 'image/svg+xml' } as DialuxExportAsset);
                    return;
                }
                ctx.scale(scale, scale);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, svgAsset.width, svgAsset.height);
                try {
                    ctx.drawImage(img, 0, 0, svgAsset.width, svgAsset.height);
                } catch {
                    resolve({ ...svgAsset, kind: 'vector', mimeType: 'image/svg+xml' } as DialuxExportAsset);
                    return;
                }
                const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
                if (dataUrl.length < 2000) {
                    // Blank result — fallback to SVG
                    resolve({ ...svgAsset, kind: 'vector', mimeType: 'image/svg+xml' } as DialuxExportAsset);
                    return;
                }
                resolve({
                    id: svgAsset.id,
                    kind: 'bitmap',
                    mimeType: 'image/jpeg',
                    title: svgAsset.title,
                    purpose: svgAsset.purpose,
                    dataUrl,
                    width: canvas.width,
                    height: canvas.height,
                } as DialuxBitmapAsset);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                console.warn('[DIAlux] Plan SVG→bitmap failed, using SVG fallback:', svgAsset.id);
                resolve({ ...svgAsset, kind: 'vector', mimeType: 'image/svg+xml' } as DialuxExportAsset);
            };
            img.src = url;
        });
    }

    // 1. Captura del Viewer 3D (Portada)
    if (options.preCapturedViewerBitmap) {
        assets.push(options.preCapturedViewerBitmap);
    } else if (options.includeViewerCapture) {
        try {
            const viewerBitmap = await capture3DViewerBitmap({ purpose: 'formal-cover' });
            if (viewerBitmap) assets.push(viewerBitmap);
        } catch (error) {
            console.warn('[DIAlux] Falló la captura del viewer 3D para la portada:', error);
        }
    }

    // 2. Gráficos generales de Terreno
    const hasDxfEntities = snapshot.dxfEntities.length > 0;

    // Captura del canvas mlightcad: se intenta SIEMPRE que haya DOM, porque con
    // cad-viewer (DWG/DXF) el plano vive solo en el canvas — el store no tiene
    // entidades vectoriales. captureCadBaseBitmap retorna null sin canvas/contenido.
    let cadBaseAsset: DialuxBitmapAsset | null =
        options.preCapturedCadBitmap ?? null;
    if (!cadBaseAsset) {
        try {
            cadBaseAsset = await captureCadBaseBitmap();
        } catch (err) {
            console.warn('[DIAlux] Falló la captura del CAD base:', err);
        }
    }
    if (cadBaseAsset) {
        assets.push(cadBaseAsset);
    }

    // Capturas compuestas (CAD + overlay del editor, perfectamente alineadas):
    // son la fuente preferida para "plano con dibujo" y "plano con isolux".
    if (options.preCapturedDrawnBitmap) {
        assets.push(options.preCapturedDrawnBitmap);
    }
    if (options.preCapturedIsoluxBitmap) {
        assets.push(options.preCapturedIsoluxBitmap);
    }

    // 2. Gráficos Generales
    // Todos los planos se convierten a bitmap JPEG para garantizar que dompdf los
    // renderice correctamente. El SVG inline en dompdf es experimental y falla con
    // gráficos complejos (DXF, isolux, etc.). El bitmap <img> siempre funciona.
    pushAsset(await svgToBitmapAsset(buildFormalCoverSvg(snapshot)));
    // CAD overview: solo se genera como asset independiente cuando hay DXF entities.
    // Sin DXF, la página terrain-cad no se incluye en el documento.
    if (hasDxfEntities) {
        pushAsset(await svgToPlanBitmap(buildCadOverviewSvg(snapshot)));
    }
    pushAsset(await svgToPlanBitmap(buildDrawnTerrainSvg(snapshot, cadBaseAsset)));
    pushAsset(await svgToPlanBitmap(buildTerrainWithIsoluxSvg(snapshot, cadBaseAsset)));

    // 3. Gráficos por Ambiente — también convertidos a bitmap para consistencia con dompdf
    for (const ambient of snapshot.ambients) {
        pushAsset(await svgToPlanBitmap(buildAmbientPlanSvgAsset(ambient, snapshot)));
        // El isolux solo se genera cuando el ambiente tiene resultados de cálculo.
        if (ambient.result !== null) {
            pushAsset(await svgToPlanBitmap(buildAmbientIsoluxSvgAsset(ambient, snapshot)));
        }
    }

    // 4. Datos Estructurados (Tablas, Resumen, JSON Técnico)
    assets.push({
        id: 'project-summary-data',
        title: 'Resumen de Proyecto',
        purpose: 'project-summary',
        kind: 'structured',
        mimeType: 'application/json',
        data: buildProjectSummary(snapshot),
    });

    assets.push({
        id: 'ambient-catalog-data',
        title: 'Catálogo de Ambientes',
        purpose: 'ambient-catalog',
        kind: 'structured',
        mimeType: 'application/json',
        data: buildAmbientTable(snapshot),
    });

    assets.push({
        id: 'lighting-results-data',
        title: 'Resultados Generales',
        purpose: 'lighting-results',
        kind: 'structured',
        mimeType: 'application/json',
        data: buildLightingResultsTable(snapshot),
    });

    assets.push({
        id: 'luminaire-products-data',
        title: 'Lista de Luminarias',
        purpose: 'luminaire-list',
        kind: 'structured',
        mimeType: 'application/json',
        data: buildLuminaireProductTable(snapshot),
    });

    assets.push({
        id: 'technical-appendix-data',
        title: 'Datos Técnicos Base',
        purpose: 'technical-appendix',
        kind: 'structured',
        mimeType: 'application/json',
        data: buildTechnicalAppendix(snapshot),
    });

    // 5. Gráficos (Charts)
    pushAsset(buildChartSvg(snapshot));

    return assets;
}
