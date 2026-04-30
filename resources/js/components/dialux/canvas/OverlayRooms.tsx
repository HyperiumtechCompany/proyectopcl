/**
 * OverlayRooms.tsx — Renderiza los recintos (polígonos) en el plano 2D
 */

import React, { memo } from 'react';
import type { Room } from '@/hooks/dialux/types';
import { safeNum, centroid } from './canvasUtils';

interface Props {
    rooms: Room[];
    selectedId: string | null;
    zoom: number;
    onSelect: (id: string) => void;
    screenPoint: (p: { x: number; y: number }) => { x: number; y: number };
}

export const OverlayRooms = memo(function OverlayRooms({
    rooms, selectedId, zoom, onSelect, screenPoint,
}: Props) {
    if (!rooms.length) return null;
    return (
        <g className="overlay-rooms">
            {rooms.map(room => {
                const screenVertices = room.vertices.map(v =>
                    screenPoint({ x: v.x, y: v.y }),
                );
                const pts = screenVertices
                    .map(p => `${safeNum(p.x)},${safeNum(p.y)}`)
                    .join(' ');
                const ctr = centroid(screenVertices);
                const isSelected = selectedId === room.id;

                return (
                    <g
                        key={room.id}
                        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                        onClick={() => onSelect(room.id)}
                    >
                        <polygon
                            points={pts}
                            fill={room.color}
                            fillOpacity={0.3}
                            stroke={isSelected ? '#60a5fa' : '#3b82f6'}
                            strokeWidth={isSelected ? 2 : 1}
                        />
                        <text
                            x={safeNum(ctr.x)}
                            y={safeNum(ctr.y - 8)}
                            textAnchor="middle"
                            fill="#93c5fd"
                            fontSize={safeNum(Math.max(9, 11 * zoom))}
                            fontFamily="sans-serif"
                            fontWeight={500}
                            pointerEvents="none"
                        >
                            {room.name}
                        </text>
                    </g>
                );
            })}
        </g>
    );
});
