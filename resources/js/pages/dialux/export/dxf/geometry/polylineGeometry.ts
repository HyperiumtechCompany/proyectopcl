import type { Pt } from '../emitters/primitives';

/**
 * Extraído de `buildDialuxDxfExport.ts` en la Fase 8 para que
 * `emitters/architecture.ts` (nuevo) reutilice la misma geometría que el
 * exportador en vivo — mismo comportamiento, verificado contra el snapshot
 * congelado de la Fase 0.
 */

export function centroid(pts: Pt[]): Pt {
    return {
        x: pts.reduce((sum, pt) => sum + pt.x, 0) / pts.length,
        y: pts.reduce((sum, pt) => sum + pt.y, 0) / pts.length,
    };
}

/**
 * Walk along a multi-vertex polyline and return the point at `offset` metres
 * from the start, plus the normalised direction vector at that segment.
 */
export function ptAlongPoly(vertices: Pt[], offset: number): { pt: Pt; dir: Pt } {
    let rem = offset;
    for (let i = 1; i < vertices.length; i++) {
        const dx = vertices[i].x - vertices[i - 1].x;
        const dy = vertices[i].y - vertices[i - 1].y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (rem <= len || i === vertices.length - 1) {
            const t = len > 0 ? Math.min(rem / len, 1) : 0;
            return {
                pt: { x: vertices[i - 1].x + t * dx, y: vertices[i - 1].y + t * dy },
                dir: { x: len > 0 ? dx / len : 1, y: len > 0 ? dy / len : 0 },
            };
        }
        rem -= len;
    }
    const last = vertices[vertices.length - 1];
    const prev = vertices[vertices.length - 2] ?? vertices[0];
    const dx = last.x - prev.x;
    const dy = last.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    return {
        pt: last,
        dir: len > 0 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 },
    };
}
