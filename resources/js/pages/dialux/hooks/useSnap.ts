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
    /** Extra vertices a incluir en el snap (ej. vértices de rooms existentes) */
    extraVerticesScene?: CanvasPoint[];
    /**
     * Zoom actual del canvas (≥1).
     * A mayor zoom, se reduce el radio de snap en píxeles para mayor precisión:
     * se evita que a zoom 10x el snap aún «salte» a puntos alejados varios cm reales.
     */
    zoom?: number;
}

interface SegmentCandidate {
    point: CanvasPoint;
    distSq: number;
    angleDeg: number;
}

export function useSnap(opts: SnapOptions) {
    const { dxfEntities, walls, sceneToCanvas, extraVerticesScene = [], zoom = 1 } = opts;
    /**
     * Tolerancia de captura del modo "Inteligente" (smart).
     * Baja a propósito (antes 12°): el set de ángulos candidato de este modo
     * combina 8 fijos (cada 45°) + hasta 8 guía dinámicos del muro/segmento
     * vecino. Con una tolerancia amplia, los candidatos se solapan y cubren
     * ~todo el círculo, dejando cero grados "libres" para trazar formas
     * irregulares (terrenos con ángulos peculiares). 6° deja margen real
     * entre candidatos sin perder la asistencia en ángulos intencionales.
     */
    const SMART_SNAP_MAX_DELTA_DEG = 6;

    /**
     * Factor de reducción de snap adaptativo al zoom.
     * A zoom 1x → factor 1.0 (radio base completo).
     * A zoom 4x → factor 0.5  (radio reducido a la mitad).
     * A zoom 16x → factor 0.25 (radio reducido a un cuarto).
     * Fórmula: 1 / sqrt(zoom) — garantiza que el área de snap en metros reales
     * sea constante independientemente del nivel de zoom.
     * Mínimo: 0.3 (nunca reducir más del 70 % para mantener usabilidad).
     */
    const zoomSnapFactor = Math.max(0.3, 1 / Math.sqrt(Math.max(1, zoom)));

    /**
     * Radio de snap en píxeles para endpoints DXF.
     * Base 10px, reducido adaptativamente con el zoom.
     */
    const snapBasePx = 10 * zoomSnapFactor;
    const SNAP_PX_SQ = snapBasePx * snapBasePx;

    /**
     * Radio de snap en píxeles para segmentos (proyección).
     */
    const segBasePx = 10 * zoomSnapFactor;
    const SEG_SNAP_PX_SQ = segBasePx * segBasePx;

    /**
     * Radio de snap para muros propios (siempre activo).
     * Base 14px — ligeramente más generoso que DXF para facilitar continuidad de muros.
     */
    const wallBasePx = 14 * zoomSnapFactor;
    const WALL_SNAP_PX_SQ = wallBasePx * wallBasePx;

    // ── Snap a puntos DXF ─────────────────────────────────────────────────────
    const findSnapPoint = useCallback(
        (cx: number, cy: number): CanvasPoint | null => {
            if (!dxfEntities) return null;

            let closest: CanvasPoint | null = null;
            let minDist = SNAP_PX_SQ;

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
                    ent.type === 'point'
                ) {
                    checkPoint(ent.x, ent.y);
                }
            }
            return closest;
        },
        [dxfEntities, sceneToCanvas, SNAP_PX_SQ],
    );

    // Snap a extremos de muros existentes (siempre activo — construcción propia)
    const findWallSnapPoint = useCallback(
        (cx: number, cy: number): CanvasPoint | null => {
            let closest: CanvasPoint | null = null;
            let minDist = WALL_SNAP_PX_SQ;

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
        [walls, sceneToCanvas, WALL_SNAP_PX_SQ],
    );

    /**
     * Snap a vértices extra (rooms existentes en escena, etc.)
     */
    const findExtraVertexSnap = useCallback(
        (cx: number, cy: number): CanvasPoint | null => {
            if (extraVerticesScene.length === 0) return null;
            let closest: CanvasPoint | null = null;
            let minDist = WALL_SNAP_PX_SQ;

            for (const v of extraVerticesScene) {
                const p = sceneToCanvas(v.x, v.y);
                const d2 = (p.x - cx) ** 2 + (p.y - cy) ** 2;
                if (d2 < minDist) {
                    minDist = d2;
                    closest = p;
                }
            }
            return closest;
        },
        [extraVerticesScene, sceneToCanvas, WALL_SNAP_PX_SQ],
    );

    /**
     * Snap al punto medio de segmentos de muros.
     * Útil para centrar puertas/ventanas.
     */
    const findMidpointSnap = useCallback(
        (cx: number, cy: number): CanvasPoint | null => {
            let closest: CanvasPoint | null = null;
            let minDist = WALL_SNAP_PX_SQ;

            const checkMid = (ax: number, ay: number, bx: number, by: number) => {
                const mx = (ax + bx) / 2;
                const my = (ay + by) / 2;
                const p = sceneToCanvas(mx, my);
                const d2 = (p.x - cx) ** 2 + (p.y - cy) ** 2;
                if (d2 < minDist) {
                    minDist = d2;
                    closest = p;
                }
            };

            for (const w of walls) {
                for (let i = 1; i < w.vertices.length; i++) {
                    checkMid(
                        w.vertices[i - 1].x, w.vertices[i - 1].y,
                        w.vertices[i].x, w.vertices[i].y,
                    );
                }
            }
            return closest;
        },
        [walls, sceneToCanvas, WALL_SNAP_PX_SQ],
    );

    const findNearestGuideSegment = useCallback(
        (cx: number, cy: number): SegmentCandidate | null => {
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
                if (distSq > SEG_SNAP_PX_SQ) return;

                const angleDeg = normalizeAngleDeg(
                    (Math.atan2(dy, dx) * 180) / Math.PI,
                );
                if (!best || distSq < best.distSq) {
                    best = { point: { x: px, y: py }, distSq, angleDeg };
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
        [dxfEntities, sceneToCanvas, walls, SEG_SNAP_PX_SQ],
    );

    /**
     * Resolución de snap con prioridades:
     *  1. Cierre de polígono (primer vértice del dibujo en curso)
     *  2. Vértices extra de rooms existentes
     *  3. Extremos de muros propios
     *  4. Endpoints DXF (solo si !disableDxfSnap)
     *  5. Proyección sobre segmentos DXF (solo si !disableDxfSnap)
     *  6. Midpoints de muros
     *
     * CORRECCIÓN CRÍTICA: `disableDxfSnap = true` en modo libre para evitar que
     * el snap DXF "secuestre" el cursor a puntos de plano que no corresponden a
     * la geometría que el usuario intenta dibujar (ej. casa de 5m → snap lleva a 7m).
     */
    const resolveSnap = useCallback(
        (
            cx: number,
            cy: number,
            currentDrawingVertices: CanvasPoint[] = [],
            disableDxfSnap = false,
        ): CanvasPoint => {
            // 1ª Prioridad: cierre de polígono
            if (currentDrawingVertices.length > 2) {
                const first = currentDrawingVertices[0];
                if (Math.hypot(first.x - cx, first.y - cy) < 20) {
                    return first;
                }
            }

            // 2ª: vértices de rooms existentes
            const extraSnap = findExtraVertexSnap(cx, cy);
            if (extraSnap) return extraSnap;

            // 3ª: extremos de muros propios (siempre activo)
            const wallSnap = findWallSnapPoint(cx, cy);
            if (wallSnap) return wallSnap;

            // 4ª-5ª: DXF solo si no está desactivado
            if (!disableDxfSnap) {
                const dxfSnap = findSnapPoint(cx, cy);
                if (dxfSnap) return dxfSnap;
                const segmentSnap = findNearestGuideSegment(cx, cy);
                if (segmentSnap) return segmentSnap.point;
            }

            // 6ª: midpoints
            const midSnap = findMidpointSnap(cx, cy);
            if (midSnap) return midSnap;

            return { x: cx, y: cy };
        },
        [findExtraVertexSnap, findNearestGuideSegment, findWallSnapPoint, findSnapPoint, findMidpointSnap],
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
            rawPoint?: CanvasPoint,
        ): CanvasPoint => {
            if (!prevPointM) return { x: cx, y: cy };

            const prevPoint = sceneToCanvas(prevPointM.x, prevPointM.y);

            /**
             * El ángulo se decide con el punto CRUDO del mouse, no con (cx,cy)
             * — que puede venir ya desplazado unos px por el snap de posición
             * (vértice/segmento cercano). En un tramo corto, ese desplazamiento
             * de pocos px gira el ángulo calculado decenas de grados; y como
             * ese ángulo coincide por definición con el segmento que causó el
             * desplazamiento, el chequeo de tolerancia lo "confirmaba" igual,
             * secuestrando el trazo aunque el mouse apuntara claramente hacia
             * otro lado. Con el punto crudo, el snap de posición solo se honra
             * cuando no compite con la dirección real del mouse.
             */
            const anglePoint = rawPoint ?? { x: cx, y: cy };
            const dx = anglePoint.x - prevPoint.x;
            const dy = anglePoint.y - prevPoint.y;
            const distance = Math.hypot(dx, dy);

            if (distance <= 5) return { x: cx, y: cy };

            let targetAngles: number[] = [];
            if (shiftKey || mode === 'orthogonal') {
                targetAngles = [0, 90, 180, 270];
            } else if (mode === 'fine') {
                // Cada 15° — precisión máxima
                targetAngles = Array.from({ length: 24 }, (_, i) => i * 15);
            } else if (mode === 'diagonal') {
                targetAngles = [
                    0, 30, 45, 60, 90, 120, 135, 150,
                    180, 210, 225, 240, 270, 300, 315, 330,
                ];
            } else if (mode === 'smart') {
                // Base ligera (cardinales + 45°) — la densidad de 15° queda
                // reservada al modo "diagonal" dedicado. Lo "inteligente" de
                // este modo son los guideAngles: ángulos reales tomados del
                // muro/segmento vecino, no una rejilla arbitraria.
                targetAngles = [
                    0, 45, 90, 135, 180, 225, 270, 315,
                    ...guideAngles,
                ];
            } else {
                // free — sin restricción angular
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

            // Proyección ortogonal (O-Track CAD logic)
            // En lugar de rotar el vector (que altera longitudes si se hace snap a puntos alejados),
            // proyectamos el punto crudo del mouse (anglePoint, vía dx/dy) sobre el vector
            // direccional del ángulo — así la distancia sigue al mouse real, no al punto
            // reubicado por el snap de posición.
            const uX = Math.cos(snappedAngleRad);
            const uY = Math.sin(snappedAngleRad);
            
            // Distancia proyectada (dot product)
            const projectedDist = dx * uX + dy * uY;

            return {
                x: prevPoint.x + uX * projectedDist,
                y: prevPoint.y + uY * projectedDist,
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
        findMidpointSnap,
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
