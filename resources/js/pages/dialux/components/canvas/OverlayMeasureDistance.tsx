import { memo } from 'react';
import type { CanvasPoint } from '@/pages/dialux/hooks/useCanvasInteraction';
import { safeNum } from './canvasUtils';

type ScreenFn = (point: CanvasPoint) => CanvasPoint;

export function measureDistance(start: CanvasPoint, end: CanvasPoint): number {
    return Math.hypot(end.x - start.x, end.y - start.y);
}

interface Props {
    measurement: { start: CanvasPoint; end: CanvasPoint } | null;
    isFinal: boolean;
    isCalibrated: boolean;
    screenPoint: ScreenFn;
}

export const OverlayMeasureDistance = memo(function OverlayMeasureDistance({
    measurement,
    isFinal,
    isCalibrated,
    screenPoint,
}: Props) {
    if (!measurement) return null;

    const start = screenPoint(measurement.start);
    const end = screenPoint(measurement.end);
    const distance = measureDistance(measurement.start, measurement.end);
    const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

    return (
        <g className="overlay-measure-distance" pointerEvents="none">
            <line
                x1={safeNum(start.x)}
                y1={safeNum(start.y)}
                x2={safeNum(end.x)}
                y2={safeNum(end.y)}
                stroke="#22d3ee"
                strokeWidth={2}
                strokeDasharray={isFinal ? undefined : '6 4'}
            />
            {[start, end].map((point, index) => (
                <g key={index}>
                    <circle
                        cx={safeNum(point.x)}
                        cy={safeNum(point.y)}
                        r={5}
                        fill="#0e7490"
                        stroke="#a5f3fc"
                        strokeWidth={2}
                    />
                    <line
                        x1={safeNum(point.x - 8)}
                        y1={safeNum(point.y)}
                        x2={safeNum(point.x + 8)}
                        y2={safeNum(point.y)}
                        stroke="#a5f3fc"
                    />
                </g>
            ))}
            {distance > 0 && (
                <g
                    transform={`translate(${safeNum(middle.x)}, ${safeNum(middle.y - 28)})`}
                >
                    <rect
                        x={-78}
                        y={-18}
                        width={156}
                        height={38}
                        rx={6}
                        fill="#083344"
                        fillOpacity={0.95}
                        stroke="#22d3ee"
                    />
                    <text
                        x={0}
                        y={-2}
                        textAnchor="middle"
                        fill="#cffafe"
                        fontFamily="monospace"
                        fontSize={13}
                        fontWeight="bold"
                    >
                        {distance.toFixed(3)} m
                    </text>
                    <text
                        x={0}
                        y={13}
                        textAnchor="middle"
                        fill={isCalibrated ? '#6ee7b7' : '#fcd34d'}
                        fontFamily="sans-serif"
                        fontSize={9}
                    >
                        {isCalibrated
                            ? 'Escala calibrada'
                            : 'Escala sin calibrar'}
                    </text>
                </g>
            )}
        </g>
    );
});
