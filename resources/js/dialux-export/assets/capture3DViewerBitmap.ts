import type { DialuxBitmapAsset } from '../domain/types';

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
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;

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

    const dataUrl = canvas.toDataURL('image/png');

    return {
        id: 'viewer-capture-3d',
        title: options.title ?? 'Captura 3D del modelo',
        purpose: options.purpose ?? 'formal-cover',
        kind: 'bitmap',
        mimeType: 'image/png',
        dataUrl,
        width,
        height,
    };
}
