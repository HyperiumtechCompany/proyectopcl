import { useCallback } from 'react';
import type { Wall, Fixture, Room, Canopy, Window, Door, LightSwitch } from './useEditorStore';

export interface CanvasPoint { x: number; y: number; }
interface HelperOptions {
    walls: Wall[];
    fixtures: Fixture[];
    rooms: Room[];
    canopies: Canopy[];
    windows: Window[];
    doors: Door[];
    lightSwitches: LightSwitch[];
    sceneToCanvas: (sx: number, sy: number) => CanvasPoint;
}

/** Distancia punto a segmento (en unidades canvas) */
export function ptSegDist(
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
): { dist: number; offset: number } {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const nearX = ax + t * dx;
    const nearY = ay + t * dy;
    const dist = Math.hypot(px - nearX, py - nearY);
    return { dist, offset: t * Math.sqrt(lenSq) }; // offset en px canvas
}

export function wallLength(vertices: { x: number; y: number }[]): number {
    let length = 0;
    for (let i = 1; i < vertices.length; i++) {
        length += Math.hypot(
            vertices[i].x - vertices[i - 1].x,
            vertices[i].y - vertices[i - 1].y,
        );
    }
    return length;
}

export function resolveOffsetOnWall(
    wall: Wall,
    offsetAlongWall: number,
): { x: number; y: number } | null {
    const verts = wall.vertices;
    if (verts.length < 2) return null;

    let remaining = offsetAlongWall;

    for (let i = 0; i < verts.length - 1; i++) {
        const a = verts[i];
        const b = verts[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const segLen = Math.hypot(dx, dy);
        if (segLen === 0) continue;

        if (remaining <= segLen) {
            const t = remaining / segLen;
            return {
                x: a.x + dx * t,
                y: a.y + dy * t,
            };
        }

        remaining -= segLen;
    }

    return verts[verts.length - 1] ?? null;
}

export function projectPointToWallOffset(
    point: { x: number; y: number },
    wall: Wall,
): number {
    return projectPointToWallProjection(point, wall)?.offsetAlongWall ?? 0;
}

export interface WallProjection {
    offsetAlongWall: number;
    segmentStartOffset: number;
    segmentEndOffset: number;
    segmentIndex: number;
    distanceSq: number;
}

export function projectPointToWallProjection(
    point: { x: number; y: number },
    wall: Wall,
): WallProjection | null {
    const verts = wall.vertices;
    if (verts.length < 2) return null;

    let bestProjection: WallProjection | null = null;
    let cumulativeOffset = 0;

    for (let i = 0; i < verts.length - 1; i++) {
        const a = verts[i];
        const b = verts[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy;
        const segLen = Math.sqrt(lenSq);
        if (segLen === 0) continue;

        let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));

        const nearX = a.x + t * dx;
        const nearY = a.y + t * dy;
        const distSq = (point.x - nearX) ** 2 + (point.y - nearY) ** 2;

        if (!bestProjection || distSq < bestProjection.distanceSq) {
            bestProjection = {
                offsetAlongWall: cumulativeOffset + t * segLen,
                segmentStartOffset: cumulativeOffset,
                segmentEndOffset: cumulativeOffset + segLen,
                segmentIndex: i,
                distanceSq: distSq,
            };
        }

        cumulativeOffset += segLen;
    }

    return bestProjection;
}

export function clampOpeningOffsetToWallSegment(
    projection: Pick<
        WallProjection,
        'offsetAlongWall' | 'segmentStartOffset' | 'segmentEndOffset'
    >,
    openingWidth: number,
    totalWallLength: number,
    anchor: 'start' | 'center' = 'center',
): number {
    const width = Math.max(0, openingWidth);
    const wallMaxStart = Math.max(0, totalWallLength - width);
    const desiredStart =
        anchor === 'center'
            ? projection.offsetAlongWall - width / 2
            : projection.offsetAlongWall;

    const segmentMaxStart = projection.segmentEndOffset - width;

    if (segmentMaxStart >= projection.segmentStartOffset) {
        return Math.max(
            projection.segmentStartOffset,
            Math.min(segmentMaxStart, desiredStart),
        );
    }

    return Math.max(0, Math.min(wallMaxStart, desiredStart));
}

export function useInteractionHelpers(opts: HelperOptions) {
    const { walls, fixtures, rooms, canopies, windows, doors, lightSwitches, sceneToCanvas } = opts;

    const findNearestWall = useCallback(
        (cx: number, cy: number): {
            wall: Wall;
            offset: number;
            segmentStartOffset: number;
            segmentEndOffset: number;
            segmentIndex: number;
        } | null => {
            const MAX_DIST_PX = 20;
            let best: {
                wall: Wall;
                offset: number;
                dist: number;
                segmentStartOffset: number;
                segmentEndOffset: number;
                segmentIndex: number;
            } | null = null;

            for (const w of walls) {
                const vertices = w.vertices;
                let cumulativeOffsetM = 0;
                for (let i = 0; i < vertices.length - 1; i++) {
                    const v1 = vertices[i];
                    const v2 = vertices[i + 1];
                    const ca = sceneToCanvas(v1.x, v1.y);
                    const cb = sceneToCanvas(v2.x, v2.y);
                    const { dist, offset: offsetPx } = ptSegDist(cx, cy, ca.x, ca.y, cb.x, cb.y);
                    if (dist < MAX_DIST_PX && (!best || dist < best.dist)) {
                        const segLenPx = Math.hypot(cb.x - ca.x, cb.y - ca.y);
                        const segLenM = Math.hypot(v2.x - v1.x, v2.y - v1.y);
                        const offsetM = segLenPx > 0 ? (offsetPx / segLenPx) * segLenM : 0;
                        best = {
                            wall: w,
                            offset: cumulativeOffsetM + offsetM,
                            dist,
                            segmentStartOffset: cumulativeOffsetM,
                            segmentEndOffset: cumulativeOffsetM + segLenM,
                            segmentIndex: i,
                        };
                    }
                    cumulativeOffsetM += Math.hypot(v2.x - v1.x, v2.y - v1.y);
                }
            }
            return best
                ? {
                      wall: best.wall,
                      offset: best.offset,
                      segmentStartOffset: best.segmentStartOffset,
                      segmentEndOffset: best.segmentEndOffset,
                      segmentIndex: best.segmentIndex,
                  }
                : null;
        },
        [walls, sceneToCanvas],
    );

    const findNearestFixture = useCallback(
        (cx: number, cy: number): { id: string; x: number; y: number } | null => {
            const SNAP_DIST_PX = 15;
            let closest: { id: string; x: number; y: number } | null = null;
            let minDist = SNAP_DIST_PX * SNAP_DIST_PX;

            for (const f of fixtures) {
                const p = sceneToCanvas(f.x, f.y);
                const d2 = (p.x - cx) ** 2 + (p.y - cy) ** 2;
                if (d2 < minDist) {
                    minDist = d2;
                    closest = { id: f.id, x: f.x, y: f.y };
                }
            }
            return closest;
        },
        [fixtures, sceneToCanvas],
    );

    const findNearestRoom = useCallback(
        (cx: number, cy: number): { id: string; vertices: { x: number; y: number }[] } | null => {
            const SNAP_DIST_PX = 15;
            let closest: { id: string; vertices: { x: number; y: number }[] } | null = null;
            let minDist = SNAP_DIST_PX * SNAP_DIST_PX;

            for (const r of rooms) {
                for (const v of r.vertices) {
                    const p = sceneToCanvas(v.x, v.y);
                    const d2 = (p.x - cx) ** 2 + (p.y - cy) ** 2;
                    if (d2 < minDist) {
                        minDist = d2;
                        closest = { id: r.id, vertices: r.vertices };
                    }
                }
            }
            return closest;
        },
        [rooms, sceneToCanvas],
    );

    const findNearestCanopy = useCallback(
        (cx: number, cy: number): { id: string; x1: number; y1: number; x2: number; y2: number } | null => {
            const SNAP_DIST_PX = 15;
            let closest: { id: string; x1: number; y1: number; x2: number; y2: number } | null = null;
            let minDist = SNAP_DIST_PX * SNAP_DIST_PX;

            for (const c of canopies) {
                const p1 = sceneToCanvas(c.x1, c.y1);
                const p2 = sceneToCanvas(c.x2, c.y2);
                const d1 = (p1.x - cx) ** 2 + (p1.y - cy) ** 2;
                const d2 = (p2.x - cx) ** 2 + (p2.y - cy) ** 2;
                if (d1 < minDist) {
                    minDist = d1;
                    closest = { id: c.id, x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2 };
                }
                if (d2 < minDist) {
                    minDist = d2;
                    closest = { id: c.id, x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2 };
                }
            }
            return closest;
        },
        [canopies, sceneToCanvas],
    );

    const findNearestWindow = useCallback(
        (cx: number, cy: number): { id: string; wallId: string; offsetAlongWall: number } | null => {
            const SNAP_DIST_PX = 15;
            let closest: { id: string; wallId: string; offsetAlongWall: number } | null = null;
            let minDist = SNAP_DIST_PX * SNAP_DIST_PX;

            for (const w of windows) {
                const wall = walls.find((wall) => wall.id === w.wallId);
                if (!wall) continue;
                const winPosition = resolveOffsetOnWall(wall, w.offsetAlongWall);
                if (!winPosition) continue;

                const winPoint = sceneToCanvas(winPosition.x, winPosition.y);
                const d2 = (winPoint.x - cx) ** 2 + (winPoint.y - cy) ** 2;
                if (d2 < minDist) {
                    minDist = d2;
                    closest = { id: w.id, wallId: w.wallId, offsetAlongWall: w.offsetAlongWall };
                }
            }
            return closest;
        },
        [windows, walls, sceneToCanvas],
    );

    const findNearestDoor = useCallback(
        (cx: number, cy: number): { id: string; wallId: string; offsetAlongWall: number } | null => {
            const SNAP_DIST_PX = 18;
            let closest: { id: string; wallId: string; offsetAlongWall: number } | null = null;
            let minDist = SNAP_DIST_PX * SNAP_DIST_PX;

            for (const d of doors) {
                const wall = walls.find((w) => w.id === d.wallId);
                if (!wall) continue;
                // Usar el punto medio del umbral de la puerta
                const midOffset = d.offsetAlongWall + d.width / 2;
                const doorPos = resolveOffsetOnWall(wall, midOffset);
                if (!doorPos) continue;

                const doorPoint = sceneToCanvas(doorPos.x, doorPos.y);
                const dist2 = (doorPoint.x - cx) ** 2 + (doorPoint.y - cy) ** 2;
                if (dist2 < minDist) {
                    minDist = dist2;
                    closest = { id: d.id, wallId: d.wallId, offsetAlongWall: d.offsetAlongWall };
                }
            }
            return closest;
        },
        [doors, walls, sceneToCanvas],
    );

    const findNearestLightSwitch = useCallback(
        (cx: number, cy: number): { id: string; x: number; y: number } | null => {
            const SNAP_DIST_PX = 15;
            let closest: { id: string; x: number; y: number } | null = null;
            let minDist = SNAP_DIST_PX * SNAP_DIST_PX;

            for (const s of lightSwitches) {
                const p = sceneToCanvas(s.x, s.y);
                const d2 = (p.x - cx) ** 2 + (p.y - cy) ** 2;
                if (d2 < minDist) {
                    minDist = d2;
                    closest = { id: s.id, x: s.x, y: s.y };
                }
            }
            return closest;
        },
        [lightSwitches, sceneToCanvas],
    );

    return {
        findNearestWall,
        findNearestFixture,
        findNearestRoom,
        findNearestCanopy,
        findNearestWindow,
        findNearestDoor,
        findNearestLightSwitch,
    };
}
