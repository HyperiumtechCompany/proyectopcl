/**
 * OverlayWindows.tsx — Renderiza ventanas sobre sus paredes en 2D
 *
 * Representación arquitectónica estándar:
 *   - Dos líneas paralelas a lo largo de la pared (marco exterior e interior)
 *   - Línea de apertura / transparencia entre las dos
 *   - Ventana de baño: patrón rayado opaco (vidrio esmerilado)
 *   - Ventana circular (ojo de buey): elipse
 *
 * El `offsetAlongWall` se puede centrar automáticamente cuando `centered === true`.
 */

import React, { memo } from 'react';
import type { Window, Wall } from '@/hooks/dialux/types';
import { safeNum } from './canvasUtils';

interface Props {
    windows:    Window[];
    walls:      Wall[];
    selectedId: string | null;
    zoom:       number;
    onSelect:   (id: string) => void;
    screenPoint: (p: { x: number; y: number }) => { x: number; y: number };
}

/** Calcula la posición y dirección de una ventana sobre su pared */
function resolveWindowOnWall(
    win: Window,
    wall: Wall,
): { position: { x: number; y: number }; direction: { x: number; y: number }; normal: { x: number; y: number } } | null {
    const verts = wall.vertices;
    if (verts.length < 2) return null;

    let remaining = win.offsetAlongWall;
    for (let i = 0; i < verts.length - 1; i++) {
        const a = verts[i];
        const b = verts[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const segLen = Math.hypot(dx, dy);
        if (segLen === 0) continue;
        if (remaining <= segLen) {
            const t = remaining / segLen;
            const dir = { x: dx / segLen, y: dy / segLen };
            return {
                position:  { x: a.x + dx * t, y: a.y + dy * t },
                direction: dir,
                normal:    { x: -dir.y, y: dir.x },
            };
        }
        remaining -= segLen;
    }
    // Fuera del rango: usar el último punto
    const last = verts[verts.length - 1];
    const prev = verts[verts.length - 2];
    const dx = last.x - prev.x;
    const dy = last.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const dir = { x: dx / len, y: dy / len };
    return {
        position:  { x: last.x, y: last.y },
        direction: dir,
        normal:    { x: -dir.y, y: dir.x },
    };
}

const BATHROOM_PATTERN_ID = 'hatch-bathroom-window';

export const OverlayWindows = memo(function OverlayWindows({
    windows, walls, selectedId, zoom, onSelect, screenPoint,
}: Props) {
    if (!windows.length) return null;

    const hasBathroom = windows.some(w => w.windowType === 'bathroom');

    return (
        <g className="overlay-windows">
            {/* Patrón de relleno para ventana de baño */}
            {hasBathroom && (
                <defs>
                    <pattern id={BATHROOM_PATTERN_ID} patternUnits="userSpaceOnUse" width={5} height={5} patternTransform="rotate(45)">
                        <line x1={0} y1={0} x2={0} y2={5} stroke="#a78bfa" strokeWidth={2} strokeOpacity={0.55} />
                    </pattern>
                </defs>
            )}

            {windows.map(win => {
                const wall = walls.find(w => w.id === win.wallId);
                if (!wall) return null;

                const resolved = resolveWindowOnWall(win, wall);
                if (!resolved) return null;

                const { position, direction, normal } = resolved;
                const halfW    = (win.width || 1.0) / 2;
                const wallThick = (wall.thickness ?? 0.15) / 2;
                const nudge    = wallThick * 0.5;

                const isBathroom = win.windowType === 'bathroom';
                const isCircular = win.windowShape === 'circular';
                const isSelected = selectedId === win.id;

                // Colores según tipo
                const baseColor = isBathroom ? '#a78bfa' : '#7dd3fc';
                const selColor  = isSelected ? (isBathroom ? '#ddd6fe' : '#f0f9ff') : baseColor;
                const strokeW   = Math.max(isBathroom ? 3.5 : 2.5, zoom * 2.5);

                // Puntos extremos del vano (a lo largo de la pared)
                const p1World = {
                    x: position.x - direction.x * halfW,
                    y: position.y - direction.y * halfW,
                };
                const p2World = {
                    x: position.x + direction.x * halfW,
                    y: position.y + direction.y * halfW,
                };

                // Offset interior/exterior para los marcos
                const innerNudge = nudge;
                const outerNudge = -nudge;

                // Pantalla
                const sp1 = screenPoint(p1World);
                const sp2 = screenPoint(p2World);
                const sp1n = screenPoint({
                    x: p1World.x + normal.x * innerNudge,
                    y: p1World.y + normal.y * innerNudge,
                });
                const sp2n = screenPoint({
                    x: p2World.x + normal.x * innerNudge,
                    y: p2World.y + normal.y * innerNudge,
                });
                const sp1o = screenPoint({
                    x: p1World.x + normal.x * outerNudge,
                    y: p1World.y + normal.y * outerNudge,
                });
                const sp2o = screenPoint({
                    x: p2World.x + normal.x * outerNudge,
                    y: p2World.y + normal.y * outerNudge,
                });

                // Centro de pantalla para etiqueta
                const midX = (sp1.x + sp2.x) / 2;
                const midY = (sp1.y + sp2.y) / 2;

                // Para ventanas circulares calcular radio de pantalla
                const circR = Math.max(
                    6,
                    Math.hypot(sp2.x - sp1.x, sp2.y - sp1.y) / 2,
                );

                const labelText = isBathroom
                    ? `B ${win.width.toFixed(2)}m`
                    : isCircular
                      ? `⊙ ${win.width.toFixed(2)}m`
                      : `V ${win.width.toFixed(2)}m`;

                return (
                    <g
                        key={win.id}
                        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelect(win.id);
                        }}
                    >
                        {/* ── Hitarea invisible ── */}
                        <line
                            x1={safeNum(sp1.x)} y1={safeNum(sp1.y)}
                            x2={safeNum(sp2.x)} y2={safeNum(sp2.y)}
                            stroke="transparent"
                            strokeWidth={14}
                        />

                        {isCircular ? (
                            /* ── Ventana circular (ojo de buey) ── */
                            <>
                                <circle
                                    cx={safeNum(midX)} cy={safeNum(midY)}
                                    r={safeNum(circR)}
                                    fill={isSelected ? `${selColor}22` : 'rgba(125,211,252,0.08)'}
                                    stroke={selColor}
                                    strokeWidth={safeNum(strokeW)}
                                />
                                {/* Línea de cruz interior */}
                                <line
                                    x1={safeNum(midX - circR * 0.5)}
                                    y1={safeNum(midY)}
                                    x2={safeNum(midX + circR * 0.5)}
                                    y2={safeNum(midY)}
                                    stroke={selColor}
                                    strokeWidth={safeNum(Math.max(0.8, strokeW * 0.4))}
                                    opacity={0.5}
                                />
                                <line
                                    x1={safeNum(midX)}
                                    y1={safeNum(midY - circR * 0.5)}
                                    x2={safeNum(midX)}
                                    y2={safeNum(midY + circR * 0.5)}
                                    stroke={selColor}
                                    strokeWidth={safeNum(Math.max(0.8, strokeW * 0.4))}
                                    opacity={0.5}
                                />
                            </>
                        ) : (
                            /* ── Ventana rectangular / de baño ── */
                            <>
                                {/* Relleno de vidrio interior */}
                                {isBathroom ? (
                                    <line
                                        x1={safeNum(sp1n.x)} y1={safeNum(sp1n.y)}
                                        x2={safeNum(sp2n.x)} y2={safeNum(sp2n.y)}
                                        stroke={`url(#${BATHROOM_PATTERN_ID})`}
                                        strokeWidth={safeNum(strokeW * 3.5)}
                                        strokeLinecap="butt"
                                        opacity={0.55}
                                    />
                                ) : (
                                    <line
                                        x1={safeNum(sp1n.x)} y1={safeNum(sp1n.y)}
                                        x2={safeNum(sp2n.x)} y2={safeNum(sp2n.y)}
                                        stroke={selColor}
                                        strokeWidth={safeNum(strokeW * 3)}
                                        strokeLinecap="butt"
                                        opacity={0.10}
                                    />
                                )}

                                {/* Línea de marco interior (cara interior de la pared) */}
                                <line
                                    x1={safeNum(sp1n.x)} y1={safeNum(sp1n.y)}
                                    x2={safeNum(sp2n.x)} y2={safeNum(sp2n.y)}
                                    stroke={selColor}
                                    strokeWidth={safeNum(strokeW)}
                                    strokeLinecap="square"
                                    opacity={0.9}
                                />

                                {/* Línea de marco exterior (cara exterior de la pared) */}
                                <line
                                    x1={safeNum(sp1o.x)} y1={safeNum(sp1o.y)}
                                    x2={safeNum(sp2o.x)} y2={safeNum(sp2o.y)}
                                    stroke={selColor}
                                    strokeWidth={safeNum(strokeW * 0.7)}
                                    strokeLinecap="square"
                                    opacity={0.55}
                                />

                                {/* Topes laterales del vano (extremos) */}
                                <line
                                    x1={safeNum(sp1o.x)} y1={safeNum(sp1o.y)}
                                    x2={safeNum(sp1n.x)} y2={safeNum(sp1n.y)}
                                    stroke={selColor}
                                    strokeWidth={safeNum(strokeW * 0.7)}
                                    strokeLinecap="square"
                                    opacity={0.7}
                                />
                                <line
                                    x1={safeNum(sp2o.x)} y1={safeNum(sp2o.y)}
                                    x2={safeNum(sp2n.x)} y2={safeNum(sp2n.y)}
                                    stroke={selColor}
                                    strokeWidth={safeNum(strokeW * 0.7)}
                                    strokeLinecap="square"
                                    opacity={0.7}
                                />
                            </>
                        )}

                        {/* ── Etiqueta ── */}
                        {zoom > 0.4 && (
                            <text
                                x={safeNum(midX)}
                                y={safeNum(midY - strokeW * 3 - 6)}
                                textAnchor="middle"
                                fill={selColor}
                                className="select-none"
                                fontSize={safeNum(Math.max(8, 9 * zoom))}
                                fontFamily="monospace"
                                fontWeight={500}
                                pointerEvents="none"
                            >
                                {labelText}
                            </text>
                        )}

                        {/* ── Punto de selección (centro) ── */}
                        {isSelected && (
                            <circle
                                cx={safeNum(midX)}
                                cy={safeNum(midY)}
                                r={3.5}
                                fill={selColor}
                                opacity={0.9}
                            />
                        )}
                    </g>
                );
            })}
        </g>
    );
});
