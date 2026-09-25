import type { DialuxExportAsset } from '@/pages/dialux/export/domain/types';

/**
 * Dompdf NO dibuja SVG incrustado (solo imprime sus textos): igual que el
 * informe de la V1 (`buildDialuxExportAssets.ts::svgToBitmapAsset`), cada
 * plano vectorial se rasteriza en el navegador antes de enviarlo. Lado mayor
 * `maxSidePx` (nítido en A4 apaisado); JPEG para planos grandes (payload).
 * Si el navegador no puede rasterizar, se deja el vector (mejor que nada).
 */
export async function rasterizeVectorAssets(
    assets: DialuxExportAsset[],
    maxSidePx = 2400,
): Promise<DialuxExportAsset[]> {
    return Promise.all(
        assets.map((asset) => (asset.kind === 'vector' ? rasterize(asset, maxSidePx) : asset)),
    );
}

function rasterize(
    asset: Extract<DialuxExportAsset, { kind: 'vector' }>,
    maxSidePx: number,
): Promise<DialuxExportAsset> {
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
        return Promise.resolve(asset);
    }
    return new Promise((resolve) => {
        const url = URL.createObjectURL(new Blob([asset.svg], { type: 'image/svg+xml;charset=utf-8' }));
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            const ratio = maxSidePx / Math.max(asset.width, asset.height, 1);
            const width = Math.max(1, Math.round(asset.width * ratio));
            const height = Math.max(1, Math.round(asset.height * ratio));
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(asset);
                return;
            }
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            resolve({
                id: asset.id,
                title: asset.title,
                purpose: asset.purpose,
                kind: 'bitmap',
                mimeType: 'image/jpeg',
                dataUrl: canvas.toDataURL('image/jpeg', 0.9),
                width,
                height,
            });
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(asset);
        };
        img.src = url;
    });
}
