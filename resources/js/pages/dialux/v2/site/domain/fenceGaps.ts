import { gateSpanM, isSpanGate } from './gateLayout';
import { closestPointOnPolygon } from './geometry';
import type { Point2D, SiteElement } from './types';

/** Un extremo a esta distancia (m) o menos de otro cerco/portón/edificio se considera cerrado (sin rendija). */
export const FENCE_TOUCH_M = 0.1;
/** Un hueco de hasta esta medida (m) se avisa como rendija; más allá es un extremo libre. */
export const FENCE_GAP_MAX_M = 3;

export interface FenceEndIssue {
    /** 0 = primer vértice, 1 = último. */
    end: 0 | 1;
    point: Point2D;
    kind: 'gap' | 'free';
    /** Distancia al objeto más cercano (m); solo con `gap`. */
    gapM?: number;
    /** Objeto más cercano (para el mensaje). */
    nearLabel?: string;
    message: string;
}

function distToSegmentM(p: Point2D, a: Point2D, b: Point2D, scaleM: number): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)) * scaleM;
}

/**
 * Extremos de un cerco ABIERTO que no cierran contra otro cerco, un portón o un
 * edificio: son por donde se "escapa" alguien (en un colegio, un niño). Un cerco
 * cerrado no tiene extremos. No es una verificación normativa: solo geometría.
 */
export function openFenceEnds(
    fence: SiteElement,
    elements: SiteElement[],
    scaleM: number,
): FenceEndIssue[] {
    if (fence.type !== 'fence' || fence.vertices.length < 2) return [];
    const closed = fence.config?.kind === 'fence' ? (fence.config.closed ?? true) : true;
    if (closed && fence.vertices.length >= 3) return [];

    const ends: Array<{ end: 0 | 1; point: Point2D }> = [
        { end: 0, point: fence.vertices[0] },
        { end: 1, point: fence.vertices[fence.vertices.length - 1] },
    ];
    const issues: FenceEndIssue[] = [];
    for (const { end, point } of ends) {
        let best: { d: number; label: string } | null = null;
        const consider = (d: number, label: string) => {
            if (!best || d < best.d) best = { d, label };
        };
        for (const other of elements) {
            if (other.id === fence.id || other.visible === false || other.vertices.length < 2) continue;
            if (other.type === 'fence') {
                const otherClosed =
                    other.config?.kind === 'fence' ? (other.config.closed ?? true) : true;
                const hit = closestPointOnPolygon(point, other.vertices, otherClosed);
                if (hit) consider(hit.distance * scaleM, other.label);
            } else if (other.type === 'gate') {
                if (isSpanGate(other)) {
                    consider(distToSegmentM(point, other.vertices[0], other.vertices[1], scaleM), other.label);
                } else {
                    const c = {
                        x: other.vertices.reduce((s, v) => s + v.x, 0) / other.vertices.length,
                        y: other.vertices.reduce((s, v) => s + v.y, 0) / other.vertices.length,
                    };
                    const half = gateSpanM(other, scaleM) / 2;
                    consider(Math.max(0, Math.hypot(point.x - c.x, point.y - c.y) * scaleM - half), other.label);
                }
            } else if (other.type === 'building_block' && other.vertices.length >= 3) {
                const hit = closestPointOnPolygon(point, other.vertices, true);
                if (hit) consider(hit.distance * scaleM, other.label);
            }
        }
        const found = best as { d: number; label: string } | null;
        if (found && found.d <= FENCE_TOUCH_M) continue;
        if (found && found.d <= FENCE_GAP_MAX_M) {
            issues.push({
                end,
                point,
                kind: 'gap',
                gapM: found.d,
                nearLabel: found.label,
                message: `Extremo ${end === 0 ? 'inicial' : 'final'}: queda un hueco de ${found.d.toFixed(2)} m frente a "${found.label}" — por ahí se puede pasar.`,
            });
        } else {
            issues.push({
                end,
                point,
                kind: 'free',
                message: `Extremo ${end === 0 ? 'inicial' : 'final'} libre: no cierra contra otro cerco, portón ni edificio.`,
            });
        }
    }
    return issues;
}
