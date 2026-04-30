/**
 * OverlayCanopies.tsx — Renders voladizos/aleros en el plano 2D
 */

import React, { memo } from 'react';
import type { Canopy } from '@/hooks/dialux/types';
import { safeNum } from './canvasUtils';

interface Props {
    canopies: Canopy[];
    selectedId: string | null;
    zoom: number;
    onSelect: (id: string) => void;
    screenPoint: (p: { x: number; y: number }) => { x: number; y: number };
    screenDistance: (dx: number, dy: number, origin: { x: number; y: number }) => number;
}

export const OverlayCanopies = memo(function OverlayCanopies({
    canopies, selectedId, zoom, onSelect, screenPoint, screenDistance,
}: Props) {
    if (!canopies.length) return null;
    return (
        <g className="overlay-canopies">
            {canopies.map(c => {
                const p1    = screenPoint({ x: c.x1, y: c.y1 });
                const p2    = screenPoint({ x: c.x2, y: c.y2 });
                const wPx   = screenDistance(c.width, 0, { x: c.x1, y: c.y1 });
                const dx    = p2.x - p1.x;
                const dy    = p2.y - p1.y;
                const len   = Math.hypot(dx, dy);
                if (len < 1) return null;

                const nx = -dy / len;
                const ny =  dx / len;
                const hw = wPx / 2;
                const pts = [
                    `${p1.x - nx * hw},${p1.y - ny * hw}`,
                    `${p1.x + nx * hw},${p1.y + ny * hw}`,
                    `${p2.x + nx * hw},${p2.y + ny * hw}`,
                    `${p2.x - nx * hw},${p2.y - ny * hw}`,
                ].join(' ');
                const isSelected = selectedId === c.id;

                return (
                    <g
                        key={c.id}
                        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                        onClick={() => onSelect(c.id)}
                    >
                        <polygon
                            points={pts}
                            fill="url(#hatch-canopy-svg)"
                            stroke={isSelected ? '#f59e0b' : '#d97706'}
                            strokeWidth={isSelected ? 2 : 1.5}
                            fillOpacity={0.8}
                        />
                        <text
                            x={safeNum((p1.x + p2.x) / 2)}
                            y={safeNum((p1.y + p2.y) / 2 - 6)}
                            textAnchor="middle"
                            fill="#fbbf24"
                            fontSize={safeNum(Math.max(8, 9 * zoom))}
                            fontFamily="sans-serif"
                            fontWeight={600}
                            pointerEvents="none"
                        >
                            Voladizo
                        </text>
                    </g>
                );
            })}
        </g>
    );
});
