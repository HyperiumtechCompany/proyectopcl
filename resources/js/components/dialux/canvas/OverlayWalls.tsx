/**
 * OverlayWalls.tsx — Renderiza las paredes (polilíneas) en el plano 2D
 * Cada pared tiene 3 polilíneas superpuestas: hit-area invisible, cuerpo, highlight.
 */

import React, { memo } from 'react';
import type { Wall } from '@/hooks/dialux/types';
import { safeNum, wallVertStr, wallLengthM, wallThickPx, centroid } from './canvasUtils';

interface Props {
    walls: Wall[];
    selectedId: string | null;
    zoom: number;
    onSelect: (id: string) => void;
    screenPoint: (p: { x: number; y: number }) => { x: number; y: number };
    screenDistance: (dx: number, dy: number, origin: { x: number; y: number }) => number;
}

export const OverlayWalls = memo(function OverlayWalls({
    walls, selectedId, zoom, onSelect, screenPoint, screenDistance,
}: Props) {
    if (!walls.length) return null;
    return (
        <g className="overlay-walls">
            {walls.map(w => {
                const isSelected = selectedId === w.id;
                const pts        = wallVertStr(w, screenPoint);
                const origin     = w.vertices[0] ?? { x: 0, y: 0 };
                const thickPx    = wallThickPx(w.thickness, screenDistance, origin);
                const totalLen   = wallLengthM(w);
                const screenVerts = w.vertices.map(v => screenPoint(v));
                const ctr        = centroid(screenVerts);
                const isEducationWall = w.normativeUse === 'education';
                const wallStroke = isEducationWall ? '#22d3ee' : '#eab308';
                const selectedStroke = isEducationWall ? '#67e8f9' : '#fde047';
                const labelFill = isEducationWall ? '#67e8f9' : '#94a3b8';

                return (
                    <g
                        key={w.id}
                        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                        onClick={() => onSelect(w.id)}
                    >
                        {/* Hit-area invisible más gruesa para facilitar el click */}
                        <polyline
                            points={pts}
                            stroke="transparent"
                            strokeWidth={20}
                            fill="none"
                        />
                        {/* Cuerpo visible — pared interior: amarillo */}
                        <polyline
                            points={pts}
                            stroke={isSelected ? selectedStroke : wallStroke}
                            strokeWidth={isSelected ? 3 : 2}
                            strokeLinecap="round"
                            fill="none"
                        />
                        {/* Etiqueta de longitud */}
                        {totalLen > 0.1 && (
                            <text
                                x={safeNum(ctr.x)}
                                y={safeNum(ctr.y - thickPx / 2 - 4)}
                                textAnchor="middle"
                                fill={labelFill}
                                fontSize={safeNum(Math.max(7, 9 * zoom))}
                                fontFamily="monospace"
                                pointerEvents="none"
                            >
                                {totalLen.toFixed(2)}m
                            </text>
                        )}
                    </g>
                );
            })}
        </g>
    );
});
