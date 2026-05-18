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

                const isCerco = w.wallType === 'cerco';
                const cercoStroke = '#4ade80';
                const cercoStrokeSel = '#86efac';
                const finalStroke = isCerco
                    ? (isSelected ? cercoStrokeSel : cercoStroke)
                    : (isSelected ? selectedStroke : wallStroke);
                const finalLabelFill = isCerco ? '#86efac' : labelFill;

                // Marcas de postes para cerco: un círculo cada postSpacing metros
                const postSpacingM = w.postSpacing ?? 3.0;
                const postMarkers: { x: number; y: number }[] = [];
                if (isCerco && w.vertices.length >= 2) {
                    let accumulated = 0;
                    for (let seg = 0; seg < w.vertices.length - 1; seg++) {
                        const a = w.vertices[seg];
                        const b = w.vertices[seg + 1];
                        const segLen = Math.hypot(b.x - a.x, b.y - a.y);
                        const ux = (b.x - a.x) / segLen;
                        const uy = (b.y - a.y) / segLen;
                        let t = postSpacingM - (accumulated % postSpacingM);
                        if (accumulated === 0) t = 0;
                        while (t <= segLen) {
                            const mx = a.x + ux * t;
                            const my = a.y + uy * t;
                            const sp = screenPoint({ x: mx, y: my });
                            postMarkers.push(sp);
                            t += postSpacingM;
                        }
                        accumulated += segLen;
                    }
                    // Post at start always
                    const sp0 = screenPoint(w.vertices[0]);
                    if (!postMarkers.some(p => Math.abs(p.x - sp0.x) < 1 && Math.abs(p.y - sp0.y) < 1)) {
                        postMarkers.unshift(sp0);
                    }
                }

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
                        {/* Cuerpo visible */}
                        <polyline
                            points={pts}
                            stroke={finalStroke}
                            strokeWidth={isSelected ? 3 : (isCerco ? 2.5 : 2)}
                            strokeLinecap="round"
                            strokeDasharray={isCerco ? '8,4' : undefined}
                            fill="none"
                        />
                        {/* Postes del cerco */}
                        {isCerco && postMarkers.map((pm, pIdx) => (
                            <rect
                                key={`post-${pIdx}`}
                                x={safeNum(pm.x - 3.5)}
                                y={safeNum(pm.y - 3.5)}
                                width={7}
                                height={7}
                                fill={isSelected ? cercoStrokeSel : cercoStroke}
                                fillOpacity={0.85}
                                rx={1}
                                pointerEvents="none"
                            />
                        ))}
                        {/* Etiqueta de longitud */}
                        {totalLen > 0.1 && (
                            <text
                                x={safeNum(ctr.x)}
                                y={safeNum(ctr.y - thickPx / 2 - 4)}
                                textAnchor="middle"
                                fill={finalLabelFill}
                                fontSize={safeNum(Math.max(7, 9 * zoom))}
                                fontFamily="monospace"
                                pointerEvents="none"
                            >
                                {isCerco ? `⬛ ${totalLen.toFixed(2)}m` : `${totalLen.toFixed(2)}m`}
                            </text>
                        )}
                    </g>
                );
            })}
        </g>
    );
});
