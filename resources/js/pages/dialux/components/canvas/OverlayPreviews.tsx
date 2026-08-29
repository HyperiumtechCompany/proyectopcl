/**
 * OverlayPreviews.tsx - Preview dinamico mientras el usuario dibuja.
 * Muestra lineas de feedback en tiempo real para room, wall y canopy.
 */

import React, { memo } from 'react';
import { calculateObstacleAwareFixtureGridPositions } from '@/pages/dialux/hooks/fixtureGridObstacles';
import type { CanvasPoint } from '@/pages/dialux/hooks/useCanvasInteraction';
import type { StructuralObstacle } from '@/pages/dialux/hooks/types';
import { pointsToSvgString, safeNum } from './canvasUtils';

/**
 * Altura de montaje con la que `buildFixtureGridObjects` genera la grilla
 * proyectada (`config.mountingHeight ?? 2.7`, y el flujo de "Dibujar área" no
 * pasa mountingHeight). El preview debe usar la misma para que las zonas
 * válidas alrededor de columnas/vigas coincidan con el resultado real.
 */
const FIXTURE_GRID_PREVIEW_MOUNTING_HEIGHT = 2.7;

/**
 * `calculateObstacleAwareFixtureGridPositions` hace resta booleana CSG +
 * pole-of-inaccessibility cuando hay columnas/vigas; corría en cada render
 * mientras el área de proyección está pendiente de confirmar. Caché de 1
 * entrada por firma de entrada (el área y los obstáculos no cambian entre
 * dibujar el polígono y confirmar en el panel; solo cambian filas/columnas).
 * En espacio de escena — el mapeo a pantalla (que sí depende de pan/zoom) se
 * aplica después.
 */
let gridPreviewCacheKey = '';
let gridPreviewCacheValue: { x: number; y: number }[] = [];
function memoizedGridPreviewPositions(
    area: CanvasPoint[],
    obstacles: StructuralObstacle[],
    rows: number,
    columns: number,
): { x: number; y: number }[] {
    const key =
        `${rows}x${columns}|` +
        area.map((v) => `${v.x.toFixed(3)},${v.y.toFixed(3)}`).join(';') +
        '|' +
        obstacles
            .map((o) => `${o.id}:${o.obstacleType}:${o.vertices.length}`)
            .join(',');
    if (key !== gridPreviewCacheKey) {
        gridPreviewCacheKey = key;
        gridPreviewCacheValue = calculateObstacleAwareFixtureGridPositions(
            area,
            obstacles,
            FIXTURE_GRID_PREVIEW_MOUNTING_HEIGHT,
            rows,
            columns,
        );
    }
    return gridPreviewCacheValue;
}

interface Props {
    roomVertices: CanvasPoint[];
    roomPreviewPoint: CanvasPoint | null;
    wallPreview: CanvasPoint[] | null;
    canopyPreview: { start: CanvasPoint; end: CanvasPoint } | null;
    /** Poligono de proyeccion de luminarias ya cerrado, esperando confirmacion (herramienta 'fixture-grid', modo 'draw') */
    pendingFixtureGridArea?: CanvasPoint[] | null;
    /** Filas/columnas objetivo, para previsualizar los centros proyectados dentro del area */
    fixtureGridAreaRows?: number;
    fixtureGridAreaColumns?: number;
    /** Obstaculos estructurales del piso activo — el preview reparte la grilla evitandolos, igual que el resultado real */
    structuralObstacles?: StructuralObstacle[];
    screenPoint: (p: { x: number; y: number }) => { x: number; y: number };
    measureCadDistanceFromScreen?: (
        p1: CanvasPoint,
        p2: CanvasPoint,
    ) => number;
    angleSnapMode?: 'smart' | 'free' | 'orthogonal' | 'diagonal' | 'fine';
    /**
     * Radio (px de pantalla) dentro del cual un clic sobre el primer vértice
     * cierra el polígono. > 0 solo para herramientas de polígono (recinto,
     * área de proyección…). Dibuja un blanco sobre el primer vértice para que
     * cerrar no exija pulso fino; se resalta al acercar el cursor.
     */
    polygonCloseTargetPx?: number;
    /** Oculta el badge de texto (distancia/ángulo) cuando el input dinámico
     * editable (DynamicInputOverlay) ya está mostrando el mismo dato — evita
     * dos globitos superpuestos con la misma info. La guía punteada y el
     * marcador del punto siguen visibles. */
    hideLabel?: boolean;
}

function renderLabel(
    p1: CanvasPoint,
    p2: CanvasPoint,
    measureCadDistanceFromScreen?: (p1: CanvasPoint, p2: CanvasPoint) => number,
    angleSnapMode: 'smart' | 'free' | 'orthogonal' | 'diagonal' | 'fine' = 'free',
) {
    if (!measureCadDistanceFromScreen) return null;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    if (Math.hypot(dx, dy) < 5) return null;

    const distM = measureCadDistanceFromScreen(p1, p2);
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    const displayAngle = Math.abs(angle % 360);

    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    const showSnapBadge = angleSnapMode !== 'free';

    return (
        <g transform={`translate(${safeNum(mx)}, ${safeNum(my)})`}>
            <rect
                x={-48}
                y={showSnapBadge ? -28 : -25}
                width={96}
                height={showSnapBadge ? 26 : 20}
                fill="#1e293b"
                fillOpacity={0.8}
                rx={4}
                stroke="#334155"
            />
            <text
                x={0}
                y={-11}
                fill="#38bdf8"
                fontSize={11}
                fontFamily="monospace"
                textAnchor="middle"
                fontWeight="bold"
            >
                {distM.toFixed(2)}m {Math.round(displayAngle)}deg
            </text>
            {showSnapBadge && (
                <text
                    x={0}
                    y={1}
                    fill="#cbd5e1"
                    fontSize={8}
                    fontFamily="monospace"
                    textAnchor="middle"
                >
                    {angleSnapMode === 'orthogonal'
                        ? 'ORTHO'
                        : angleSnapMode === 'diagonal'
                          ? 'DIAG'
                          : 'SMART'}
                </text>
            )}
        </g>
    );
}

export const OverlayPreviews = memo(function OverlayPreviews({
    roomVertices,
    roomPreviewPoint,
    wallPreview,
    canopyPreview,
    pendingFixtureGridArea,
    fixtureGridAreaRows = 1,
    fixtureGridAreaColumns = 1,
    structuralObstacles = [],
    screenPoint,
    measureCadDistanceFromScreen,
    angleSnapMode = 'free',
    polygonCloseTargetPx = 0,
    hideLabel = false,
}: Props) {
    const screenRoomVertices = roomVertices.map(screenPoint);
    const screenRoomPreviewPoint = roomPreviewPoint
        ? screenPoint(roomPreviewPoint)
        : null;

    // Blanco de cierre sobre el primer vértice del polígono en curso.
    const closeTarget =
        polygonCloseTargetPx > 0 && screenRoomVertices.length >= 3
            ? screenRoomVertices[0]
            : null;
    const nearClose =
        closeTarget && screenRoomPreviewPoint
            ? Math.hypot(
                  screenRoomPreviewPoint.x - closeTarget.x,
                  screenRoomPreviewPoint.y - closeTarget.y,
              ) <= polygonCloseTargetPx
            : false;
    const screenWallPreview = wallPreview ? wallPreview.map(screenPoint) : null;
    const screenCanopyPreview = canopyPreview
        ? {
              start: screenPoint(canopyPreview.start),
              end: screenPoint(canopyPreview.end),
          }
        : null;

    return (
        <g className="overlay-previews" pointerEvents="none">
            {screenRoomVertices.length > 0 && (
                <>
                    <polyline
                        points={pointsToSvgString(
                            screenRoomPreviewPoint
                                ? [
                                      ...screenRoomVertices,
                                      nearClose && closeTarget
                                          ? closeTarget
                                          : screenRoomPreviewPoint,
                                      ...(nearClose && closeTarget
                                          ? [screenRoomVertices[0]]
                                          : []),
                                  ]
                                : screenRoomVertices,
                        )}
                        stroke={nearClose ? '#22c55e' : '#60a5fa'}
                        strokeWidth={2}
                        fill="none"
                        strokeDasharray="6 4"
                        opacity={0.9}
                    />
                    {screenRoomPreviewPoint && !nearClose && (
                        <>
                            <circle
                                cx={safeNum(screenRoomPreviewPoint.x)}
                                cy={safeNum(screenRoomPreviewPoint.y)}
                                r={5}
                                fill="none"
                                stroke="#22c55e"
                                strokeWidth={2}
                            />
                            {!hideLabel &&
                                screenRoomVertices.length > 0 &&
                                renderLabel(
                                    screenRoomVertices[
                                        screenRoomVertices.length - 1
                                    ],
                                    screenRoomPreviewPoint,
                                    measureCadDistanceFromScreen,
                                    angleSnapMode,
                                )}
                        </>
                    )}
                    {closeTarget && (
                        <>
                            <circle
                                cx={safeNum(closeTarget.x)}
                                cy={safeNum(closeTarget.y)}
                                r={nearClose ? 9 : 6}
                                fill={
                                    nearClose
                                        ? 'rgba(34,197,94,0.25)'
                                        : 'rgba(96,165,250,0.15)'
                                }
                                stroke={nearClose ? '#22c55e' : '#60a5fa'}
                                strokeWidth={nearClose ? 2.5 : 1.5}
                            />
                            {nearClose && (
                                <text
                                    x={safeNum(closeTarget.x + 12)}
                                    y={safeNum(closeTarget.y - 12)}
                                    fill="#4ade80"
                                    fontSize={11}
                                    fontFamily="sans-serif"
                                    fontWeight={700}
                                    stroke="#052e16"
                                    strokeWidth={3}
                                    paintOrder="stroke"
                                >
                                    Cerrar
                                </text>
                            )}
                        </>
                    )}
                </>
            )}

            {screenWallPreview && screenWallPreview.length > 1 && (
                <>
                    <polyline
                        points={pointsToSvgString(screenWallPreview)}
                        stroke="#38bdf8"
                        strokeWidth={2}
                        fill="none"
                        strokeDasharray="5 5"
                        opacity={0.9}
                    />
                    <>
                        <rect
                            x={
                                safeNum(
                                    screenWallPreview[
                                        screenWallPreview.length - 1
                                    ].x,
                                ) - 4
                            }
                            y={
                                safeNum(
                                    screenWallPreview[
                                        screenWallPreview.length - 1
                                    ].y,
                                ) - 4
                            }
                            width={8}
                            height={8}
                            fill="none"
                            stroke="#facc15"
                            strokeWidth={2}
                        />
                        {!hideLabel &&
                            renderLabel(
                                screenWallPreview[
                                    screenWallPreview.length - 2
                                ],
                                screenWallPreview[
                                    screenWallPreview.length - 1
                                ],
                                measureCadDistanceFromScreen,
                                angleSnapMode,
                            )}
                    </>
                </>
            )}

            {screenCanopyPreview && (
                <>
                    <line
                        x1={screenCanopyPreview.start.x}
                        y1={screenCanopyPreview.start.y}
                        x2={screenCanopyPreview.end.x}
                        y2={screenCanopyPreview.end.y}
                        stroke="#f59e0b"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        opacity={0.9}
                    />
                    <circle
                        cx={screenCanopyPreview.start.x}
                        cy={screenCanopyPreview.start.y}
                        r={4}
                        fill="#f59e0b"
                    />
                    {renderLabel(
                        screenCanopyPreview.start,
                        screenCanopyPreview.end,
                        measureCadDistanceFromScreen,
                        angleSnapMode,
                    )}
                </>
            )}

            {pendingFixtureGridArea && pendingFixtureGridArea.length >= 3 &&
                (() => {
                    const screenPoly = pendingFixtureGridArea.map(screenPoint);
                    const previewCenters = memoizedGridPreviewPositions(
                        pendingFixtureGridArea,
                        structuralObstacles,
                        fixtureGridAreaRows,
                        fixtureGridAreaColumns,
                    ).map(screenPoint);
                    return (
                        <>
                            <polygon
                                points={pointsToSvgString(screenPoly)}
                                fill="#22d3ee" fillOpacity={0.1}
                                stroke="#22d3ee" strokeWidth={2} strokeDasharray="5 4"
                            />
                            {previewCenters.map((p, i) => (
                                <g key={i}>
                                    <circle cx={safeNum(p.x)} cy={safeNum(p.y)} r={9} fill="#0891b2" fillOpacity={0.3} stroke="#22d3ee" strokeWidth={1.5} />
                                    <line x1={safeNum(p.x - 5)} y1={safeNum(p.y)} x2={safeNum(p.x + 5)} y2={safeNum(p.y)} stroke="#22d3ee" strokeWidth={1.5} />
                                    <line x1={safeNum(p.x)} y1={safeNum(p.y - 5)} x2={safeNum(p.x)} y2={safeNum(p.y + 5)} stroke="#22d3ee" strokeWidth={1.5} />
                                </g>
                            ))}
                        </>
                    );
                })()}
        </g>
    );
});
