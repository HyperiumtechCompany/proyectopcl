import React, { memo } from 'react';
import type { LightSwitch } from '@/hooks/dialux/types';
import { safeNum } from './canvasUtils';

interface Props {
    lightSwitches: LightSwitch[];
    selectedId: string | null;
    zoom: number;
    onSelect: (id: string, multi: boolean) => void;
    screenPoint: (p: { x: number; y: number }) => { x: number; y: number };
}

export const OverlayLightSwitches = memo(function OverlayLightSwitches({
    lightSwitches,
    selectedId,
    zoom,
    onSelect,
    screenPoint,
}: Props) {
    if (!lightSwitches.length) return null;

    return (
        <g className="overlay-light-switches">
            {lightSwitches.map((sw) => {
                const fp = screenPoint({ x: sw.x, y: sw.y });
                const isSelected = selectedId === sw.id;

                const R = Math.max(8, 12 * zoom);

                let icon = 'S(f)';
                if (sw.type === 'double') icon = '2Sc(d,3)';
                if (sw.type === 'two-way') icon = 'Sc(c)';

                return (
                    <g
                        key={sw.id}
                        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                        onClick={(e) => {
                            if (e.ctrlKey) {
                                e.stopPropagation();
                            }
                            onSelect(sw.id, e.ctrlKey);
                        }}
                    >
                        {/* ── Base circular ── */}
                        <circle
                            cx={safeNum(fp.x)}
                            cy={safeNum(fp.y)}
                            r={safeNum(R)}
                            fill={isSelected ? '#fde68a' : '#f8fafc'}
                            stroke={isSelected ? '#f59e0b' : '#64748b'}
                            strokeWidth={isSelected ? 2 : 1.5}
                        />

                        {/* ── Ícono Texto Completo ── */}
                        <text
                            x={safeNum(fp.x + R + 4)}
                            y={safeNum(fp.y + R / 2)}
                            textAnchor="start"
                            dominantBaseline="middle"
                            fill={isSelected ? '#b45309' : '#334155'}
                            fontSize={safeNum(R * 1.5)}
                            fontWeight="bold"
                            pointerEvents="none"
                            style={{ userSelect: 'none' }}
                        >
                            {icon}
                        </text>
                    </g>
                );
            })}
        </g>
    );
});
