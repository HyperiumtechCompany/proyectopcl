import React, { memo } from 'react';
import type { LightSwitch } from '@/pages/dialux/hooks/types';
import { safeNum } from './canvasUtils';

interface Props {
    lightSwitches: LightSwitch[];
    selectedId: string | null;
    zoom: number;
    onSelect: (id: string, multi: boolean) => void;
    screenPoint: (p: { x: number; y: number }) => { x: number; y: number };
    screenDistance?: (dx: number, dy: number, origin?: { x: number; y: number }) => number;
}

/** Radio físico real del símbolo de interruptor (metros), igual criterio que OverlayElectricalDevices */
const PHYS_RADIUS_M = 0.06;
const MIN_PX = 6;

/** Deriva la etiqueta normativa peruana a partir del tipo y del campo label opcional */
function getSwitchLabel(sw: LightSwitch): string {
    if (sw.label) return sw.label;
    switch (sw.type) {
        case 'single':   return 'S(a)';
        case 'two-way':  return 'Sc(a)';
        case 'double':   return '2S(a)';
        case 'triple':   return '3S(a)';
        default:         return 'S(a)';
    }
}

export const OverlayLightSwitches = memo(function OverlayLightSwitches({
    lightSwitches,
    selectedId,
    zoom,
    onSelect,
    screenPoint,
    screenDistance,
}: Props) {
    if (!lightSwitches.length) return null;

    return (
        <g className="overlay-light-switches">
            {lightSwitches.map((sw) => {
                const fp = screenPoint({ x: sw.x, y: sw.y });
                const isSelected = selectedId === sw.id;
                const symbolScale = Math.max(0.25, sw.symbolScale ?? 1);
                // Tamaño real del símbolo: metros físicos → píxeles de pantalla,
                // igual criterio que luminarias/dispositivos (mantiene escala al hacer zoom).
                const R = screenDistance
                    ? Math.max(MIN_PX, screenDistance(PHYS_RADIUS_M * symbolScale, 0, { x: sw.x, y: sw.y }))
                    : Math.max(MIN_PX, 10 * zoom * symbolScale);
                const rotation = sw.rotation ?? 0;
                const label = getSwitchLabel(sw);

                // Color por tipo de interruptor
                const circleStroke = isSelected ? '#f59e0b'
                    : sw.type === 'two-way' ? '#a78bfa'
                    : sw.type === 'double'  ? '#38bdf8'
                    : '#64748b';
                const circleFill = isSelected ? '#fde68a' : '#f8fafc';
                const labelColor = isSelected ? '#92400e'
                    : sw.type === 'two-way' ? '#7c3aed'
                    : sw.type === 'double'  ? '#0369a1'
                    : '#1e293b';

                return (
                    <g
                        key={sw.id}
                        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                        onClick={(e) => {
                            if (e.ctrlKey) e.stopPropagation();
                            onSelect(sw.id, e.ctrlKey);
                        }}
                    >
                        {/* Cuerpo rota alrededor del centro del interruptor; la etiqueta se mantiene fuera para legibilidad */}
                        <g transform={`translate(${safeNum(fp.x)}, ${safeNum(fp.y)}) rotate(${safeNum(rotation)})`}>
                            {/* Base circular */}
                            <circle
                                cx={0}
                                cy={0}
                                r={safeNum(R)}
                                fill={circleFill}
                                stroke={circleStroke}
                                strokeWidth={isSelected ? 2 : 1.5}
                            />

                            {/* Línea diagonal superior derecha — símbolo normativo */}
                            <line
                                x1={safeNum(R * 0.55)}
                                y1={safeNum(-R * 0.55)}
                                x2={safeNum(R * 1.6)}
                                y2={safeNum(-R * 1.6)}
                                stroke={circleStroke}
                                strokeWidth={isSelected ? 1.8 : 1.4}
                                strokeLinecap="round"
                            />

                            {/* Indicador de selección */}
                            {isSelected && (
                                <circle
                                    cx={0}
                                    cy={0}
                                    r={safeNum(R + 4)}
                                    fill="none"
                                    stroke="#f59e0b"
                                    strokeWidth={1.5}
                                    strokeDasharray="4,3"
                                    opacity={0.7}
                                />
                            )}
                        </g>

                        {/* Etiqueta normativa — siempre horizontal, no rota con el símbolo */}
                        <text
                            x={safeNum(fp.x + R * 1.7)}
                            y={safeNum(fp.y - R * 1.4)}
                            textAnchor="start"
                            dominantBaseline="middle"
                            fill={labelColor}
                            fontSize={safeNum(Math.max(8, R * 1.1))}
                            fontWeight="600"
                            fontFamily="sans-serif"
                            pointerEvents="none"
                            style={{ userSelect: 'none' }}
                        >
                            {label}
                        </text>
                    </g>
                );
            })}
        </g>
    );
});
