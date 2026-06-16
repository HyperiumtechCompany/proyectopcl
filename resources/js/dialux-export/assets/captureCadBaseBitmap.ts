import type { DialuxBitmapAsset } from '../domain/types';

const CAD_CAPTURE_MIME_TYPE = 'image/jpeg' as const;
const CAD_CAPTURE_QUALITY = 0.92;

function encodePrintBitmap(canvas: HTMLCanvasElement): string {
    return canvas.toDataURL(CAD_CAPTURE_MIME_TYPE, CAD_CAPTURE_QUALITY);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Reads pixels from a WebGL canvas using gl.readPixels().
 * This works even when the context was created WITHOUT preserveDrawingBuffer,
 * as long as we are called within the same task as the render (within RAF).
 *
 * WebGL reads pixels bottom-to-top, so we flip the Y axis here.
 * We also invert RGB channels so the dark-theme DXF renders on white.
 */
function readWebGLPixels(
    canvas: HTMLCanvasElement,
    targetWidth: number,
    targetHeight: number,
): { dataUrl: string; width: number; height: number } | null {
    const gl =
        (canvas.getContext('webgl2') as WebGL2RenderingContext | null) ??
        (canvas.getContext('webgl') as WebGLRenderingContext | null);

    if (!gl) return null;

    const w = canvas.width;
    const h = canvas.height;
    if (w < 2 || h < 2) return null;

    const pixels = new Uint8Array(w * h * 4);

    try {
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    } catch {
        return null;
    }

    // Check whether the buffer has real content (not all zeros = blank)
    let hasContent = false;
    for (let i = 0; i < pixels.length; i += 64) {
        if (pixels[i] !== 0 || pixels[i + 1] !== 0 || pixels[i + 2] !== 0) {
            hasContent = true;
            break;
        }
    }
    if (!hasContent) return null;

    // Build an ImageData with Y-flip + RGB inversion (dark→light mode)
    const inverted = new Uint8ClampedArray(w * h * 4);
    for (let row = 0; row < h; row++) {
        const srcRow = h - 1 - row; // flip Y
        for (let col = 0; col < w; col++) {
            const src = (srcRow * w + col) * 4;
            const dst = (row * w + col) * 4;
            inverted[dst] = 255 - pixels[src]; // R invert
            inverted[dst + 1] = 255 - pixels[src + 1]; // G invert
            inverted[dst + 2] = 255 - pixels[src + 2]; // B invert
            inverted[dst + 3] = 255; // full opacity
        }
    }

    // Paint into a temporary canvas at native resolution, then scale to target
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const tmpCtx = tmp.getContext('2d');
    if (!tmpCtx) return null;
    tmpCtx.putImageData(new ImageData(inverted, w, h), 0, 0);

    // Scale to target while preserving aspect ratio, without padding (no letterbox)
    const scale = Math.min(targetWidth / w, targetHeight / h);
    const dw = Math.round(w * scale);
    const dh = Math.round(h * scale);
    
    const out = document.createElement('canvas');
    out.width = dw;
    out.height = dh;
    const outCtx = out.getContext('2d');
    if (!outCtx) return null;

    outCtx.fillStyle = '#ffffff';
    outCtx.fillRect(0, 0, dw, dh);
    outCtx.drawImage(tmp, 0, 0, dw, dh);

    return {
        dataUrl: encodePrintBitmap(out),
        width: dw,
        height: dh,
    };
}

/**
 * Tries to read the canvas via the standard 2D API (toDataURL).
 * Works when preserveDrawingBuffer: true OR on 2D canvases.
 */
async function readCanvasViaDataUrl(
    canvas: HTMLCanvasElement,
    targetWidth: number,
    targetHeight: number,
): Promise<{ dataUrl: string; width: number; height: number } | null> {
    let rawDataUrl: string;
    try {
        rawDataUrl = canvas.toDataURL();
    } catch {
        return null; // cross-origin tainted
    }

    // Heuristic: a blank canvas encodes as a very short data URL
    if (rawDataUrl.length < 2000) return null;

    // Check for all-white (blank after inversion would be all-black, also useless)
    const w = canvas.width;
    const h = canvas.height;
    const scale = Math.min(targetWidth / w, targetHeight / h);
    const dw = Math.round(w * scale);
    const dh = Math.round(h * scale);

    const out = document.createElement('canvas');
    out.width = dw;
    out.height = dh;
    const ctx = out.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, dw, dh);

    const srcImg = new Image();
    await new Promise<void>((resolve, reject) => {
        srcImg.onload = () => resolve();
        srcImg.onerror = () =>
            reject(new Error('CAD canvas image failed to load'));
        srcImg.src = rawDataUrl;
    }).catch(() => null);

    if (!srcImg.complete || srcImg.naturalWidth === 0) return null;

    ctx.save();
    ctx.filter = 'invert(1) brightness(0.90) contrast(1.05)';
    try {
        ctx.drawImage(srcImg, 0, 0, dw, dh);
    } catch {
        ctx.restore();
        return null;
    }
    ctx.restore();

    const dataUrl = encodePrintBitmap(out);
    return dataUrl.length > 2000 ? { dataUrl, width: dw, height: dh } : null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Captures the CAD base canvas (mlightcad / imported DXF) as a high-fidelity
 * light-mode PNG bitmap for embedding in formal PDF reports.
 *
 * Capture strategy (in priority order):
 *   1. WebGL gl.readPixels() — works even without preserveDrawingBuffer when
 *      called within the same RAF as the render. After patchWebGLPreserveBuffer()
 *      is applied at app startup this ALWAYS works.
 *   2. Canvas.toDataURL() with CSS invert filter — works for 2D canvases or
 *      WebGL with preserveDrawingBuffer: true.
 *   3. Return null → caller uses vectorial SVG DXF fallback.
 *
 * The returned image has a white background and inverted colours so it renders
 * correctly over white A4 PDF backgrounds.
 */
export async function captureCadBaseBitmap(
    cadSelector = '#cad-engine-container',
    targetWidth = 1800,
    targetHeight = 1200,
): Promise<DialuxBitmapAsset | null> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return null;
    }

    const cadContainer = document.querySelector(
        cadSelector,
    ) as HTMLElement | null;
    if (!cadContainer) {
        console.warn('[dialux-export] CAD container not found:', cadSelector);
        return null;
    }

    const canvases = Array.from(cadContainer.querySelectorAll('canvas')).filter(
        (c) => c.width > 4 && c.height > 4,
    );

    if (canvases.length === 0) {
        console.warn('[dialux-export] No CAD canvas elements found.');
        return null;
    }

    // Use the canvas with the most pixels (the primary render target)
    const primary = canvases.reduce((best, c) =>
        c.width * c.height > best.width * best.height ? c : best,
    );

    // ── Strategy 1: WebGL readPixels (best quality, bypasses buffer swap) ────
    const webglResult = readWebGLPixels(primary, targetWidth, targetHeight);
    if (webglResult) {
        console.info('[dialux-export] CAD captured via WebGL readPixels ✓');
        return {
            id: 'cad-base-bitmap',
            title: 'Plano base CAD importado',
            purpose: 'cad-base',
            kind: 'bitmap',
            mimeType: CAD_CAPTURE_MIME_TYPE,
            dataUrl: webglResult.dataUrl,
            width: webglResult.width,
            height: webglResult.height,
            cssWidth: primary.clientWidth,
            cssHeight: primary.clientHeight,
            physicalWidth: primary.width,
            physicalHeight: primary.height,
        };
    }

    // ── Strategy 2: 2D toDataURL with CSS filter ──────────────────────────────
    for (const canvas of canvases) {
        const result = await readCanvasViaDataUrl(
            canvas,
            targetWidth,
            targetHeight,
        );
        if (result) {
            console.info('[dialux-export] CAD captured via toDataURL ✓');
            return {
                id: 'cad-base-bitmap',
                title: 'Plano base CAD importado',
                purpose: 'cad-base',
                kind: 'bitmap',
                mimeType: CAD_CAPTURE_MIME_TYPE,
                dataUrl: result.dataUrl,
                width: result.width,
                height: result.height,
                cssWidth: canvas.clientWidth,
                cssHeight: canvas.clientHeight,
                physicalWidth: canvas.width,
                physicalHeight: canvas.height,
            };
        }
    }

    console.warn(
        '[dialux-export] CAD bitmap capture failed (WebGL buffer empty + toDataURL blank).\n' +
            'Ensure patchWebGLPreserveBuffer() is called at app startup before mlightcad initializes.\n' +
            'Falling back to vectorial SVG DXF rendering.',
    );
    return null;
}
