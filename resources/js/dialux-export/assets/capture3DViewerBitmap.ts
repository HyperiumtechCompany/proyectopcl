import type { DialuxBitmapAsset } from '../domain/types';

const MAX_CAPTURE_WIDTH = 1200;
const MAX_CAPTURE_HEIGHT = 780;
const VIEWER_CAPTURE_MIME_TYPE = 'image/jpeg' as const;
const VIEWER_CAPTURE_QUALITY = 0.78;

interface Capture3DViewerBitmapOptions {
    title?: string;
    purpose?: DialuxBitmapAsset['purpose'];
    canvasId?: string;
}

export async function capture3DViewerBitmap(
    options: Capture3DViewerBitmapOptions = {},
): Promise<DialuxBitmapAsset | null> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return null;
    }

    const canvasId = options.canvasId ?? 'babylon-3d-canvas';
    const canvas = document.getElementById(
        canvasId,
    ) as HTMLCanvasElement | null;

    if (!canvas) {
        return null;
    }

    // Babylon.js uses WebGL which clears the drawing buffer by default.
    // Ensure the engine was created with preserveDrawingBuffer: true
    const width = canvas.width;
    const height = canvas.height;

    if (width <= 1 || height <= 1) {
        return null;
    }

    const scale = Math.min(
        1,
        MAX_CAPTURE_WIDTH / width,
        MAX_CAPTURE_HEIGHT / height,
    );
    const outputWidth = Math.max(1, Math.round(width * scale));
    const outputHeight = Math.max(1, Math.round(height * scale));
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = outputWidth;
    outputCanvas.height = outputHeight;
    const context = outputCanvas.getContext('2d');

    if (!context) {
        return null;
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, outputWidth, outputHeight);
    context.drawImage(canvas, 0, 0, outputWidth, outputHeight);

    const dataUrl = outputCanvas.toDataURL(
        VIEWER_CAPTURE_MIME_TYPE,
        VIEWER_CAPTURE_QUALITY,
    );

    return {
        id: 'viewer-capture-3d',
        title: options.title ?? 'Captura 3D del modelo',
        purpose: options.purpose ?? 'formal-cover',
        kind: 'bitmap',
        mimeType: VIEWER_CAPTURE_MIME_TYPE,
        dataUrl,
        width: outputWidth,
        height: outputHeight,
    };
}
