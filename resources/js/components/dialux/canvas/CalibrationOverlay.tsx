import React, { memo } from 'react';
import type { CanvasPoint } from '@/hooks/dialux/useCanvasInteraction';

interface CalibrationOverlayProps {
    line: { start: CanvasPoint; end: CanvasPoint } | null;
    snapPoint?: CanvasPoint | null;
    label?: string | null;
    screenPoint: (p: { x: number; y: number }) => { x: number; y: number };
}

export const CalibrationOverlay = memo(function CalibrationOverlay({
    line,
    snapPoint,
    label,
    screenPoint,
}: CalibrationOverlayProps) {
    if (!line && !snapPoint) return null;

    const screenLine = line
        ? { start: screenPoint(line.start), end: screenPoint(line.end) }
        : null;
    const screenSnapPoint = snapPoint ? screenPoint(snapPoint) : null;
    const midX = screenLine ? (screenLine.start.x + screenLine.end.x) / 2 : 0;
    const midY = screenLine ? (screenLine.start.y + screenLine.end.y) / 2 : 0;

    return (
        <g className="calibration-overlay pointer-events-none">
            <defs>
                <marker
                    id="calibration-arrow"
                    markerWidth="8"
                    markerHeight="8"
                    refX="4"
                    refY="4"
                    orient="auto"
                >
                    <path d="M0,0 L8,4 L0,8 Z" fill="#f59e0b" />
                </marker>
            </defs>

            {screenSnapPoint && (
                <circle
                    cx={screenSnapPoint.x}
                    cy={screenSnapPoint.y}
                    r={6}
                    fill="rgba(245, 158, 11, 0.18)"
                    stroke="#fbbf24"
                    strokeWidth={1.5}
                />
            )}

            {screenLine && (
                <>
                    <line
                        x1={screenLine.start.x}
                        y1={screenLine.start.y}
                        x2={screenLine.end.x}
                        y2={screenLine.end.y}
                        stroke="#f59e0b"
                        strokeWidth={2}
                        strokeDasharray="7 5"
                        markerStart="url(#calibration-arrow)"
                        markerEnd="url(#calibration-arrow)"
                    />
                    <circle cx={screenLine.start.x} cy={screenLine.start.y} r={4} fill="#f59e0b" />
                    <circle cx={screenLine.end.x} cy={screenLine.end.y} r={4} fill="#f59e0b" />

                    {label && (
                        <g transform={`translate(${midX}, ${midY})`}>
                            <rect
                                x={-58}
                                y={-24}
                                rx={8}
                                width={116}
                                height={22}
                                fill="rgba(15, 23, 42, 0.92)"
                                stroke="rgba(245, 158, 11, 0.5)"
                            />
                            <text
                                x={0}
                                y={-9}
                                fill="#fcd34d"
                                fontSize="10"
                                textAnchor="middle"
                            >
                                {label}
                            </text>
                        </g>
                    )}
                </>
            )}
        </g>
    );
});
