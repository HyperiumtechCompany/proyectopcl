/**
 * affine2d.ts — Matriz afín 2×3 en píxeles de pantalla.
 *
 * `createCanvasTransforms` la usa para no llamar `cadView.worldToScreen` /
 * `screenToWorld` (que son llamadas al motor CAD) una vez por cada punto que
 * se proyecta. La cámara del motor en vista 2D es ortográfica → afín pura →
 * 3 muestras la reconstruyen EXACTA; a partir de ahí todo es aritmética.
 *
 * Convención SVG: `matrix(a,b,c,d,e,f)` mapea (x,y) → (a·x + c·y + e, b·x + d·y + f).
 */

export interface Affine {
    a: number;
    b: number;
    c: number;
    d: number;
    e: number;
    f: number;
}

/**
 * Reconstruye la matriz afín de una función escena→pantalla muestreándola en
 * el origen y en los dos vectores unitarios. `null` si la función no es afín
 * usable (resultados no finitos o cámara degenerada, escala ~0).
 */
export function sampleAffine(
    sceneToScreen: (p: { x: number; y: number }) => { x: number; y: number },
): Affine | null {
    const o = sceneToScreen({ x: 0, y: 0 });
    const ux = sceneToScreen({ x: 1, y: 0 });
    const uy = sceneToScreen({ x: 0, y: 1 });
    const m: Affine = {
        a: ux.x - o.x,
        b: ux.y - o.y,
        c: uy.x - o.x,
        d: uy.y - o.y,
        e: o.x,
        f: o.y,
    };
    for (const v of [m.a, m.b, m.c, m.d, m.e, m.f]) {
        if (!Number.isFinite(v)) return null;
    }
    if (Math.abs(m.a * m.d - m.b * m.c) < 1e-12) return null;
    return m;
}

/** Inversa de una matriz afín, o `null` si es (casi) singular. */
export function invert(m: Affine): Affine | null {
    const det = m.a * m.d - m.b * m.c;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
    return {
        a: m.d / det,
        b: -m.b / det,
        c: -m.c / det,
        d: m.a / det,
        e: (m.c * m.f - m.d * m.e) / det,
        f: (m.b * m.e - m.a * m.f) / det,
    };
}
