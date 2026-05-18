/**
 * OverlayPreviews.tsx - Preview dinamico mientras el usuario dibuja.
 * Muestra lineas de feedback en tiempo real para room, wall y canopy.
 */

import React, { memo } from 'react';
import type { CanvasPoint } from '@/hooks/dialux/useCanvasInteraction';
import { pointsToSvgString, safeNum } from './canvasUtils';

interface Props {
    roomVertices: CanvasPoint[];
    roomPreviewPoint: CanvasPoint | null;
    wallPreview: CanvasPoint[] | null;
    canopyPreview: { start: CanvasPoint; end: CanvasPoint } | null;
    screenPoint: (p: { x: number; y: number }) => { x: number; y: number };
    measureCadDistanceFromScreen?: (
        p1: CanvasPoint,
        p2: CanvasPoint,
    ) => number;
    angleSnapMode?: 'smart' | 'free' | 'orthogonal' | 'diagonal' | 'fine';
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
    screenPoint,
    measureCadDistanceFromScreen,
    angleSnapMode = 'free',
}: Props) {
    const screenRoomVertices = roomVertices.map(screenPoint);
    const screenRoomPreviewPoint = roomPreviewPoint
        ? screenPoint(roomPreviewPoint)
        : null;
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
                                      screenRoomPreviewPoint,
                                  ]
                                : screenRoomVertices,
                        )}
                        stroke="#60a5fa"
                        strokeWidth={2}
                        fill="none"
                        strokeDasharray="6 4"
                        opacity={0.9}
                    />
                    {screenRoomPreviewPoint && (
                        <>
                            <circle
                                cx={safeNum(screenRoomPreviewPoint.x)}
                                cy={safeNum(screenRoomPreviewPoint.y)}
                                r={5}
                                fill="none"
                                stroke="#22c55e"
                                strokeWidth={2}
                            />
                            {screenRoomVertices.length > 0 &&
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
                        {renderLabel(
                            screenWallPreview[screenWallPreview.length - 2],
                            screenWallPreview[screenWallPreview.length - 1],
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
        </g>
    );
});
