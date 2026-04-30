import { useCallback } from 'react';
import type {
    AngleSnapMode,
    DxfEntity,
    Wall,
} from './useEditorStore';

interface CanvasPoint {
    x: number;
    y: number;
}

interface SnapOptions {
    dxfEntities: DxfEntity[] | null;
    walls: Wall[];
    sceneToCanvas: (sx: number, sy: number) => CanvasPoint;
}

interface SegmentCandidate {
    point: CanvasPoint;
    distSq: number;
    angleDeg: number;
}

export function useSnap(opts: SnapOptions) {
    const { dxfEntities, walls, sceneToCanvas } = opts;
    const SMART_SNAP_MAX_DELTA_DEG = 12;

    // ── Snap a puntos DXF ─────────────────────────────────────────────────────
    const findSnapPoint = useCallback(
        (cx: number, cy: number): CanvasPoint | null => {
            if (!dxfEntities) return null;
            const SNAP_DIST_SQ = 15 * 15;
            let closest: CanvasPoint | null = null;
            let minDist = SNAP_DIST_SQ;

            const checkPoint = (pxM: number, pyM: number) => {
                const p = sceneToCanvas(pxM, pyM);
                const d2 = (p.x - cx) ** 2 + (p.y - cy) ** 2;
                if (d2 < minDist) {
                    minDist = d2;
                    closest = p;
                }
            };

            for (const ent of dxfEntities) {
                if (ent.type === 'line') {
                    checkPoint(ent.x1, ent.y1);
                    checkPoint(ent.x2, ent.y2);
                } else if (
                    ent.type === 'circle' ||
                    ent.type === 'arc' ||
                    ent.type === 'ellipse'
                ) {
                    checkPoint(ent.cx, ent.cy);
                } else if (
                    ent.type === 'polyline' ||
                    ent.type === 'polygon' ||
                    ent.type === 'solid'
                ) {
                    for (const [vx, vy] of ent.vertices) checkPoint(vx, vy);
                } else if (
                    ent.type === 'rectangle' ||
                    ent.type === 'text' ||
                    ent.type === 'point'
                ) {
                    checkPoint(ent.x, ent.y);
                }
            }
            return closest;
        },
        [dxfEntities, sceneToCanvas],
    );

    // Snap a extremos de muros existentes
    const findWallSnapPoint = useCallback(
        (cx: number, cy: number): CanvasPoint | null => {
            const SNAP_DIST_SQ = 18 * 18;
            let closest: CanvasPoint | null = null;
            let minDist = SNAP_DIST_SQ;

            for (const w of walls) {
                for (const v of w.vertices) {
                    const p = sceneToCanvas(v.x, v.y);
                    const d2 = (p.x - cx) ** 2 + (p.y - cy) ** 2;
                    if (d2 < minDist) {
                        minDist = d2;
                        closest = p;
                    }
                }
            }
            return closest;
        },
        [walls, sceneToCanvas],
    );

    const findNearestGuideSegment = useCallback(
        (cx: number, cy: number): SegmentCandidate | null => {
            const SNAP_DIST_SQ = 16 * 16;
            let best: SegmentCandidate | null = null;

            const considerSegment = (
                startM: CanvasPoint,
                endM: CanvasPoint,
            ) => {
                const start = sceneToCanvas(startM.x, startM.y);
                const end = sceneToCanvas(endM.x, endM.y);
                const dx = end.x - start.x;
                const dy = end.y - start.y;
                const lenSq = dx * dx + dy * dy;
                if (lenSq <= 0.001) return;

                let t = ((cx - start.x) * dx + (cy - start.y) * dy) / lenSq;
                t = Math.max(0, Math.min(1, t));

                const px = start.x + dx * t;
                const py = start.y + dy * t;
                const distSq = (px - cx) ** 2 + (py - cy) ** 2;
                if (distSq > SNAP_DIST_SQ) return;

                const angleDeg = normalizeAngleDeg(
                    (Math.atan2(dy, dx) * 180) / Math.PI,
                );
                if (!best || distSq < best.distSq) {
                    best = {
                        point: { x: px, y: py },
                        distSq,
                        angleDeg,
                    };
                }
            };

            for (const wall of walls) {
                for (let i = 1; i < wall.vertices.length; i++) {
                    considerSegment(wall.vertices[i - 1], wall.vertices[i]);
                }
            }

            if (!dxfEntities) return best;

            for (const ent of dxfEntities) {
                if (ent.type === 'line') {
                    considerSegment(
                        { x: ent.x1, y: ent.y1 },
                        { x: ent.x2, y: ent.y2 },
                    );
                    continue;
                }

                if (
                    ent.type === 'polyline' ||
                    ent.type === 'polygon' ||
                    ent.type === 'solid'
                ) {
                    for (let i = 1; i < ent.vertices.length; i++) {
                        const [x1, y1] = ent.vertices[i - 1];
                        const [x2, y2] = ent.vertices[i];
                        considerSegment({ x: x1, y: y1 }, { x: x2, y: y2 });
                    }

                    if (ent.closed && ent.vertices.length > 2) {
                        const [x1, y1] = ent.vertices[ent.vertices.length - 1];
                        const [x2, y2] = ent.vertices[0];
                        considerSegment({ x: x1, y: y1 }, { x: x2, y: y2 });
                    }
                }
            }

            return best;
        },
        [dxfEntities, sceneToCanvas, walls],
    );

    // Snap: prioridad wall > dxf
    const resolveSnap = useCallback(
        (cx: number, cy: number, currentDrawingVertices: CanvasPoint[] = []): CanvasPoint => {
            // First Priority: Snap to start of current drawing (to close polyline)
            if (currentDrawingVertices.length > 2) {
                const first = currentDrawingVertices[0];
                if (Math.hypot(first.x - cx, first.y - cy) < 20) {
                    return first;
                }
            }

            const wallSnap = findWallSnapPoint(cx, cy);
            if (wallSnap) return wallSnap;
            const dxfSnap = findSnapPoint(cx, cy);
            if (dxfSnap) return dxfSnap;
            const segmentSnap = findNearestGuideSegment(cx, cy);
            if (segmentSnap) return segmentSnap.point;
            return { x: cx, y: cy };
        },
        [findNearestGuideSegment, findWallSnapPoint, findSnapPoint],
    );

    const getGuideAngles = useCallback(
        (cx: number, cy: number): number[] => {
            const nearestSegment = findNearestGuideSegment(cx, cy);
            if (!nearestSegment) return [];

            return uniqueAngles([
                nearestSegment.angleDeg,
                nearestSegment.angleDeg + 90,
                nearestSegment.angleDeg + 180,
                nearestSegment.angleDeg + 270,
            ]);
        },
        [findNearestGuideSegment],
    );

    const applyAngleSnap = useCallback(
        (
            cx: number,
            cy: number,
            prevPointM: CanvasPoint | null,
            mode: AngleSnapMode,
            shiftKey: boolean,
            guideAngles: number[] = [],
        ): CanvasPoint => {
            if (!prevPointM) return { x: cx, y: cy };

            const prevPoint = sceneToCanvas(prevPointM.x, prevPointM.y);
            const dx = cx - prevPoint.x;
            const dy = cy - prevPoint.y;
            const distance = Math.hypot(dx, dy);

            if (distance <= 5) return { x: cx, y: cy };

            let targetAngles: number[] = [];
            if (shiftKey || mode === 'orthogonal') {
                targetAngles = [0, 90, 180, 270];
            } else if (mode === 'diagonal') {
                targetAngles = [
                    0, 30, 45, 60, 90, 120, 135, 150,
                    180, 210, 225, 240, 270, 300, 315, 330,
                ];
            } else if (mode === 'smart') {
                targetAngles = [
                    0, 30, 45, 60, 90, 120, 135, 150,
                    180, 210, 225, 240, 270, 300, 315, 330,
                    ...guideAngles,
                ];
            } else {
                return { x: cx, y: cy };
            }

            if (targetAngles.length === 0) return { x: cx, y: cy };
            targetAngles = uniqueAngles(targetAngles);

            const currentAngle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
            const snappedAngleDeg = targetAngles.reduce((closest, candidate) => {
                const deltaCurrent = circularAngleDistance(currentAngle, closest);
                const deltaCandidate = circularAngleDistance(currentAngle, candidate);
                return deltaCandidate < deltaCurrent ? candidate : closest;
            }, targetAngles[0]);
            const snappedDelta = circularAngleDistance(
                currentAngle,
                snappedAngleDeg,
            );

            if (
                mode === 'smart' &&
                !shiftKey &&
                snappedDelta > SMART_SNAP_MAX_DELTA_DEG
            ) {
                return { x: cx, y: cy };
            }

            const snappedAngleRad = (snappedAngleDeg * Math.PI) / 180;

            return {
                x: prevPoint.x + Math.cos(snappedAngleRad) * distance,
                y: prevPoint.y + Math.sin(snappedAngleRad) * distance,
            };
        },
        [sceneToCanvas],
    );

    return {
        resolveSnap,
        getGuideAngles,
        applyAngleSnap,
        findWallSnapPoint,
        findSnapPoint,
    };
}

function circularAngleDistance(a: number, b: number): number {
    const raw = Math.abs(a - b) % 360;
    return raw > 180 ? 360 - raw : raw;
}

function normalizeAngleDeg(angle: number): number {
    const normalized = angle % 360;
    return normalized < 0 ? normalized + 360 : normalized;
}

function uniqueAngles(angles: number[]): number[] {
    const normalized = angles.map((angle) => normalizeAngleDeg(angle));
    return normalized.filter(
        (angle, index) =>
            normalized.findIndex(
                (candidate) => circularAngleDistance(candidate, angle) < 0.25,
            ) === index,
    );
}
