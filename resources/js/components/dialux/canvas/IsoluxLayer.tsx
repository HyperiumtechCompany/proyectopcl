import React, { memo, useMemo } from 'react';
import { buildContourSegments } from '@/hooks/dialux/isoluxContours';
import type { IsoluxMode, LightingResult } from '@/hooks/dialux/useEditorStore';
import { safeNum } from './canvasUtils';

interface IsoluxLayerProps {
    layerId: string;
    result: LightingResult;
    mode: IsoluxMode;
    screenPoint: (p: { x: number; y: number }) => { x: number; y: number };
}

function colorForFunctionalLux(lux: number, maxLux: number) {
    const ratio = Math.min(1, Math.max(0, lux / Math.max(maxLux, 1)));
    const hue = 220 - ratio * 220;
    const saturation = 85;
    const lightness = 55 - ratio * 10;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function colorForTemperatureLux(lux: number, maxLux: number) {
    const ratio = Math.min(1, Math.max(0, lux / Math.max(maxLux, 1)));
    const hue = 240 - ratio * 240;
    return `hsl(${hue}, 90%, 56%)`;
}

const WAVE_LEVEL_FACTORS = [0.12, 0.2, 0.3, 0.42, 0.55, 0.68, 0.82, 0.94];

function buildWaveBands(values: Array<number | null>, maxLux: number) {
    const levels = WAVE_LEVEL_FACTORS.map((factor) => maxLux * factor);

    return values.map((lux) => {
        if (lux === null) return null;
        let bandIndex = 0;
        while (bandIndex < levels.length && lux > levels[bandIndex]) {
            bandIndex += 1;
        }
        return bandIndex;
    });
}

function waveStrokeColor(level: number, maxLux: number) {
    const ratio = Math.min(1, Math.max(0, level / Math.max(maxLux, 1)));
    const hue = 205 - ratio * 28;
    const saturation = 90 - ratio * 12;
    const lightness = 72 - ratio * 28;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function waveBackdropColor(lux: number, maxLux: number) {
    const ratio = Math.min(1, Math.max(0, lux / Math.max(maxLux, 1)));
    const hue = 210 - ratio * 35;
    const saturation = 65 + ratio * 15;
    const lightness = 18 + ratio * 16;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export const IsoluxLayer = memo(function IsoluxLayer({
    layerId,
    result,
    mode,
    screenPoint,
}: IsoluxLayerProps) {
    const {
        grid_rows,
        grid_cols,
        grid_values,
        max_lux,
        grid_origin_x,
        grid_origin_y,
        grid_cell_width,
        grid_cell_height,
        room_vertices,
    } = result;

    const hasGrid =
        grid_rows > 0 &&
        grid_cols > 0 &&
        grid_values.length > 0 &&
        grid_origin_x !== undefined &&
        grid_origin_y !== undefined &&
        (grid_cell_width ?? 0) > 0 &&
        (grid_cell_height ?? 0) > 0;

    const safeGridRows = hasGrid ? grid_rows : 0;
    const safeGridCols = hasGrid ? grid_cols : 0;
    const safeOriginX = grid_origin_x ?? 0;
    const safeOriginY = grid_origin_y ?? 0;
    const safeCellWidth = grid_cell_width ?? 0;
    const safeCellHeight = grid_cell_height ?? 0;
    const safeMaxLux = max_lux || 1;
    const waveLevels = useMemo(
        () => WAVE_LEVEL_FACTORS.map((factor) => safeMaxLux * factor),
        [safeMaxLux],
    );
    const contourSegments = useMemo(() => {
        if (mode !== 'waves' || !hasGrid) return [];

        return buildContourSegments({
            rows: safeGridRows,
            cols: safeGridCols,
            values: grid_values,
            levels: waveLevels,
            pointAt: (row, col) => {
                const point = screenPoint({
                    x: safeOriginX + col * safeCellWidth + safeCellWidth / 2,
                    y: safeOriginY + row * safeCellHeight + safeCellHeight / 2,
                });
                return { x: point.x, y: point.y };
            },
        });
    }, [
        hasGrid,
        mode,
        safeCellHeight,
        safeCellWidth,
        safeGridCols,
        safeGridRows,
        grid_values,
        safeOriginX,
        safeOriginY,
        screenPoint,
        waveLevels,
    ]);

    if (!hasGrid) {
        return null;
    }

    const roomPath =
        room_vertices && room_vertices.length > 2
            ? `${room_vertices
                  .map((vertex, index) => {
                      const point = screenPoint(vertex);
                      return `${index === 0 ? 'M' : 'L'} ${safeNum(point.x)} ${safeNum(point.y)}`;
                  })
                  .join(' ')} Z`
            : null;
    const waveBands =
        mode === 'waves' ? buildWaveBands(grid_values, safeMaxLux) : null;
    const clipPathId = useMemo(
        () => `isolux-room-clip-${layerId.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
        [layerId],
    );

    return (
        <g
            className="isolux-layer"
            role="img"
            aria-label={`Mapa isolux ${mode}`}
        >
            {roomPath && (
                <defs>
                    <clipPath id={clipPathId}>
                        <path d={roomPath} />
                    </clipPath>
                </defs>
            )}

            <g clipPath={roomPath ? `url(#${clipPathId})` : undefined}>
                {grid_values.map((lux, index) => {
                    if (lux === null) return null;

                    const col = index % safeGridCols;
                    const row = Math.floor(index / safeGridCols);
                    const x = safeOriginX + col * safeCellWidth;
                    const y = safeOriginY + row * safeCellHeight;

                    const topLeft = screenPoint({ x, y });
                    const bottomRight = screenPoint({
                        x: x + safeCellWidth,
                        y: y + safeCellHeight,
                    });
                    const center = screenPoint({
                        x: x + safeCellWidth / 2,
                        y: y + safeCellHeight / 2,
                    });

                    const width = Math.max(
                        1,
                        Math.abs(bottomRight.x - topLeft.x),
                    );
                    const height = Math.max(
                        1,
                        Math.abs(bottomRight.y - topLeft.y),
                    );
                    const showLabel =
                        mode !== 'waves' &&
                        width > 26 &&
                        height > 18 &&
                        lux >= safeMaxLux * 0.35;
                    const bandIndex = waveBands?.[index] ?? 0;
                    const waveOpacity = 0.16 + bandIndex * 0.08;
                    const fill =
                        mode === 'waves'
                            ? waveBackdropColor(lux, safeMaxLux)
                            : mode === 'temperature'
                                ? colorForTemperatureLux(lux, safeMaxLux)
                                : colorForFunctionalLux(lux, safeMaxLux);

                    const stroke =
                        mode === 'temperature'
                            ? 'rgba(255,255,255,0.06)'
                            : mode === 'waves'
                                ? 'rgba(148, 163, 184, 0.12)'
                                : 'rgba(255,255,255,0.06)';

                    return (
                        <g key={index}>
                            <rect
                                x={safeNum(Math.min(topLeft.x, bottomRight.x))}
                                y={safeNum(Math.min(topLeft.y, bottomRight.y))}
                                width={safeNum(width)}
                                height={safeNum(height)}
                                fill={fill}
                                opacity={mode === 'waves' ? waveOpacity : 0.42}
                                stroke={stroke}
                                strokeWidth={mode === 'waves' ? 0.35 : 0.5}
                            />
                            {showLabel && (
                                <text
                                    x={safeNum(center.x)}
                                    y={safeNum(center.y)}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fill="#e5eefb"
                                    fontSize={10}
                                    fontFamily="monospace"
                                    pointerEvents="none"
                                >
                                    {lux.toFixed(0)}
                                </text>
                            )}
                        </g>
                    );
                })}

                {mode === 'waves' &&
                    contourSegments.map((segment, index) => {
                        const strokeWidth =
                            segment.levelIndex % 2 === 0 ? 1.15 : 0.75;
                        const dashArray =
                            segment.levelIndex === waveLevels.length - 1
                                ? '2 1'
                                : undefined;

                        return (
                            <line
                                key={`wave-${segment.levelIndex}-${index}`}
                                x1={safeNum(segment.start.x)}
                                y1={safeNum(segment.start.y)}
                                x2={safeNum(segment.end.x)}
                                y2={safeNum(segment.end.y)}
                                stroke={waveStrokeColor(segment.level, safeMaxLux)}
                                strokeWidth={strokeWidth}
                                strokeLinecap="round"
                                strokeOpacity={0.95}
                                strokeDasharray={dashArray}
                            />
                        );
                    })}
            </g>

            {roomPath && (
                <path
                    d={roomPath}
                    fill="none"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                />
            )}
        </g>
    );
});
