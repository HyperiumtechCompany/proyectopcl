import type { DialuxBitmapAsset } from '../domain/types';

const MAX_CAPTURE_WIDTH = 1200;
const MAX_CAPTURE_HEIGHT = 780;
const VIEWER_CAPTURE_MIME_TYPE = 'image/jpeg' as const;
const VIEWER_CAPTURE_QUALITY = 0.78;

/**
 * Returns true when the canvas can be read without a SecurityError
 * (i.e. it is not tainted by cross-origin pixel data).
 */
function isSafeCanvas(canvas: HTMLCanvasElement): boolean {
    try {
        canvas.toDataURL();
        return true;
    } catch {
        return false;
    }
}

interface CaptureCompositeViewerBitmapOptions {
    title?: string;
    purpose?: DialuxBitmapAsset['purpose'];
    cadSelector?: string;
    overlaySelector?: string;
}

/**
 * Renders a composite bitmap from the mlightcad CAD canvas + the DIAlux SVG overlay.
 *
 * Pipeline:
 *   1. Locate the CAD engine container and the SVG overlay element.
 *   2. Test each CAD canvas for CORS safety before drawing it.
 *   3. Serialise the SVG overlay via Blob URL (avoids data-URL length limits and
 *      removes external references that would taint the canvas).
 *   4. Composite both layers onto a single off-screen canvas.
 *   5. Return null on any unrecoverable error so the caller can use the
 *      vectorial SVG fallback instead.
 */
export async function captureCompositeViewerBitmap(
    options: CaptureCompositeViewerBitmapOptions = {},
): Promise<DialuxBitmapAsset | null> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return null;
    }

    const cadContainer = document.querySelector(
        options.cadSelector ?? '#cad-engine-container',
    ) as HTMLElement | null;
    const overlay = document.querySelector(
        options.overlaySelector ?? '#dialux-overlay',
    ) as SVGSVGElement | null;

    if (!cadContainer || !overlay) {
        return null;
    }

    const rect = cadContainer.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);

    if (width <= 4 || height <= 4) {
        return null;
    }

    const scale = Math.min(
        1,
        MAX_CAPTURE_WIDTH / width,
        MAX_CAPTURE_HEIGHT / height,
    );
    const outputWidth = Math.max(1, Math.round(width * scale));
    const outputHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;

    const context = canvas.getContext('2d');
    if (!context) {
        return null;
    }

    // White background for formal print output
    context.fillStyle = '#f8fafc';
    context.fillRect(0, 0, outputWidth, outputHeight);
    context.scale(scale, scale);

    // ── Step 1: Draw CAD canvas layers ───────────────────────────────────────
    const cadCanvases = Array.from(cadContainer.querySelectorAll('canvas'));
    let drewAtLeastOneLayer = false;

    for (const sourceCanvas of cadCanvases) {
        if (sourceCanvas.width < 2 || sourceCanvas.height < 2) continue;
        if (!isSafeCanvas(sourceCanvas)) {
            console.warn(
                '[dialux-export] Skipping tainted CAD canvas (cross-origin). ' +
                    'The composite capture will only contain the SVG overlay.',
            );
            continue;
        }
        try {
            context.save();
            // Invert dark DXF theme to light print background
            context.filter = 'invert(1) brightness(0.90) contrast(1.05)';
            context.drawImage(sourceCanvas, 0, 0, width, height);
            context.restore();
            drewAtLeastOneLayer = true;
        } catch (error) {
            console.warn(
                '[dialux-export] Failed to draw CAD canvas layer:',
                error,
            );
        }
    }

    // If no CAD layer was readable we cannot produce a useful composite
    if (!drewAtLeastOneLayer) {
        console.warn(
            '[dialux-export] No readable CAD layers — composite capture aborted. ' +
                'Caller should use the vectorial SVG fallback.',
        );
        return null;
    }

    // ── Step 2: Draw SVG overlay on top ──────────────────────────────────────
    try {
        // Strip external filter references that would taint the canvas after drawImage
        const svgClone = overlay.cloneNode(true) as SVGSVGElement;
        // Remove filter attributes that reference external resources
        svgClone
            .querySelectorAll('[filter]')
            .forEach((el) => el.removeAttribute('filter'));

        const svgString = new XMLSerializer().serializeToString(svgClone);
        const svgBlob = new Blob([svgString], {
            type: 'image/svg+xml;charset=utf-8',
        });
        const svgUrl = URL.createObjectURL(svgBlob);

        await new Promise<void>((resolve) => {
            const svgImage = new Image();
            svgImage.onload = () => {
                try {
                    context.drawImage(svgImage, 0, 0, width, height);
                } catch (err) {
                    console.warn(
                        '[dialux-export] Failed to composite SVG overlay:',
                        err,
                    );
                } finally {
                    URL.revokeObjectURL(svgUrl);
                    resolve();
                }
            };
            svgImage.onerror = () => {
                URL.revokeObjectURL(svgUrl);
                console.warn(
                    '[dialux-export] SVG overlay image failed to load.',
                );
                resolve(); // non-fatal: proceed without the overlay
            };
            svgImage.src = svgUrl;
        });
    } catch (error) {
        console.warn(
            '[dialux-export] SVG overlay capture failed (non-fatal):',
            error,
        );
    }

    // ── Step 3: Validate output ───────────────────────────────────────────────
    let dataUrl: string;
    try {
        dataUrl = canvas.toDataURL(
            VIEWER_CAPTURE_MIME_TYPE,
            VIEWER_CAPTURE_QUALITY,
        );
    } catch (error) {
        console.warn(
            '[dialux-export] Composite canvas.toDataURL() failed (tainted):',
            error,
        );
        return null;
    }

    if (dataUrl.length < 2000) {
        console.warn(
            '[dialux-export] Composite capture too small — discarding.',
        );
        return null;
    }

    return {
        id: 'viewer-capture',
        title: options.title ?? 'Captura del CAD Viewer',
        purpose: options.purpose ?? 'viewer-capture',
        kind: 'bitmap',
        mimeType: VIEWER_CAPTURE_MIME_TYPE,
        dataUrl,
        width: outputWidth,
        height: outputHeight,
    };
}
