/**
 * patchWebGLPreserveBuffer.ts
 *
 * Patches HTMLCanvasElement.prototype.getContext so that any WebGL context
 * created AFTER this call always has preserveDrawingBuffer: true.
 *
 * This is the ONLY reliable way to read pixel data from WebGL canvases that
 * are rendered by third-party engines (like mlightcad) without access to their
 * render loop. Without this patch, canvas.toDataURL() and gl.readPixels()
 * both return blank data after the frame is presented to the compositor.
 *
 * IMPORTANT: Call this function ONCE at application startup, before any
 * WebGL canvas is created. In this project, call it from the app entry point
 * (app.tsx or bootstrap.ts) before mounting the React tree.
 */

let _patched = false;

export function patchWebGLPreserveBuffer(): void {
    if (_patched || typeof HTMLCanvasElement === 'undefined') return;
    _patched = true;

    const original = HTMLCanvasElement.prototype.getContext;

    HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        contextId: string,
        options?: Record<string, unknown>,
    ) {
        if (contextId === 'webgl' || contextId === 'webgl2' || contextId === 'experimental-webgl') {
            options = { ...(options ?? {}), preserveDrawingBuffer: true };
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (original as any).call(this, contextId, options);
    };

    if (import.meta.env.DEV) {
        console.info('[dialux-export] WebGL preserveDrawingBuffer patch applied.');
    }
}
