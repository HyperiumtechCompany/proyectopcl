/**
 * OverlayDoors.tsx — Renderiza puertas en el plano 2D sobre el canvas SVG.
 *
 * Representación arquitectónica estándar:
 *   - Línea de umbral gruesa (abertura en la pared)
 *   - Hoja de puerta: línea sólida desde la bisagra al extremo abierto
 *   - Arco de apertura de 90° desde la bisagra
 *   - Dirección: inward (arco hacia interior) / outward (arco hacia exterior)
 *   - Bisagra izquierda o derecha según `hingeDirection` ('left'|'right')
 *
 * La bisagra se configura en PropertiesPanel con hingeDirection + openingDirection.
 */

import React, { memo } from 'react';
import type { Door, Wall } from '@/hooks/dialux/types';
import { safeNum } from './canvasUtils';

interface Props {
    doors: Door[];
    walls: Wall[];
    selectedId: string | null;
    zoom: number;
    onSelect: (id: string) => void;
    screenPoint: (p: { x: number; y: number }) => { x: number; y: number };
}

/**
 * Calcula la posición de la puerta sobre la pared en coordenadas de pantalla.
 * Retorna start (bisagra) y end (extremo libre del umbral), dirección,
 * y normal (perpendicular a la pared).
 */
function resolveDoorOnWall(
    door: Door,
    wall: Wall,
    screenPoint: (p: { x: number; y: number }) => { x: number; y: number },
): {
    hingeScreen: { x: number; y: number };
    swingScreen: { x: number; y: number };
    normalWorld: { x: number; y: number };
    widthPx: number;
} | null {
    const verts = wall.vertices;
    if (verts.length < 2) return null;

    const offset = door.offsetAlongWall;
    const width = door.width;
    const hingeRight = (door as any).hingeDirection === 'right';

    let accumulated = 0;
    for (let i = 1; i < verts.length; i++) {
        const a = verts[i - 1];
        const b = verts[i];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const segLen = Math.hypot(dx, dy);

        if (accumulated + segLen >= offset) {
            const t0 = (offset - accumulated) / segLen;
            const t1 = Math.min((offset + width - accumulated) / segLen, 1);

            const ux = dx / segLen;
            const uy = dy / segLen;
            // Normal perpendicular a la pared (apunta hacia el interior del recinto)
            const nx = -uy;
            const ny = ux;

            // Punto de bisagra: si hingeRight, bisagra en el extremo de mayor offset (t1)
            const tp = hingeRight ? t1 : t0;
            const te = hingeRight ? t0 : t1;

            const hingeWorld = { x: a.x + tp * dx, y: a.y + tp * dy };
            const swingWorld = { x: a.x + te * dx, y: a.y + te * dy };

            const widthPx = Math.hypot(
                screenPoint(swingWorld).x - screenPoint(hingeWorld).x,
                screenPoint(swingWorld).y - screenPoint(hingeWorld).y,
            );

            return {
                hingeScreen: screenPoint(hingeWorld),
                swingScreen: screenPoint(swingWorld),
                normalWorld: { x: nx, y: ny },
                widthPx: Math.abs(widthPx),
            };
        }
        accumulated += segLen;
    }
    return null;
}

export const OverlayDoors = memo(function OverlayDoors({
    doors,
    walls,
    selectedId,
    zoom,
    onSelect,
    screenPoint,
}: Props) {
    if (!doors.length) return null;

    return (
        <g className="overlay-doors">
            {doors.map((door) => {
                const wall = walls.find((w) => w.id === door.wallId);
                if (!wall) return null;

                const pos = resolveDoorOnWall(door, wall, screenPoint);
                if (!pos) return null;

                const isSelected = selectedId === door.id;
                const color = isSelected ? '#6ee7b7' : '#34d399';
                const strokeW = isSelected ? 2.5 : 1.8;

                const { hingeScreen, swingScreen, normalWorld, widthPx } = pos;

                // La hoja de puerta gira 90° desde la bisagra
                // La normal en pantalla decide si va "hacia dentro" o "hacia fuera"
                const openInward = door.openingDirection !== 'outward';

                // Normal en pantalla (convertimos un punto de la normal del mundo)
                const normalScreenPt = screenPoint({
                    x: (wall.vertices[0]?.x ?? 0) + normalWorld.x,
                    y: (wall.vertices[0]?.y ?? 0) + normalWorld.y,
                });
                const normalBasePt = screenPoint({
                    x: wall.vertices[0]?.x ?? 0,
                    y: wall.vertices[0]?.y ?? 0,
                });
                const normalScreen = {
                    x: normalScreenPt.x - normalBasePt.x,
                    y: normalScreenPt.y - normalBasePt.y,
                };
                const normalLen =
                    Math.hypot(normalScreen.x, normalScreen.y) || 1;
                const nxS = normalScreen.x / normalLen;
                const nyS = normalScreen.y / normalLen;
                const sign = openInward ? 1 : -1;

                // Extremo del arco: bisagra + (normal * radius) con rotación 90°
                // El arco desde hingeScreen → arcEnd, radio = widthPx
                // El ángulo de la hoja va de la dirección del umbral 90° hacia la normal
                const umbralDx = swingScreen.x - hingeScreen.x;
                const umbralDy = swingScreen.y - hingeScreen.y;
                const umbralLen = Math.hypot(umbralDx, umbralDy) || 1;
                const ux = umbralDx / umbralLen;
                const uy = umbralDy / umbralLen;

                // Rotar 90° en dirección openInward/outward para el extremo del arco
                const arcEndX = hingeScreen.x + -uy * sign * widthPx;
                const arcEndY = hingeScreen.y + ux * sign * widthPx;

                // sweep-flag del SVG: 1 = clockwise, 0 = counter-clockwise
                // Lo determinamos con producto vectorial
                const cross = ux * (nxS * sign) - uy * (nyS * sign);
                const sweepFlag = cross > 0 ? 1 : 0;

                // Etiqueta
                const midX = (hingeScreen.x + swingScreen.x) / 2;
                const midY = (hingeScreen.y + swingScreen.y) / 2 - 9;
                const label = `P ${door.width.toFixed(2)}×${door.height.toFixed(2)}`;
                const fontSize = safeNum(Math.max(8, 9 * zoom));

                return (
                    <g
                        key={door.id}
                        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                        onClick={() => onSelect(door.id)}
                    >
                        {/* ── Línea de umbral (abertura en la pared) ── */}
                        <line
                            x1={safeNum(hingeScreen.x)}
                            y1={safeNum(hingeScreen.y)}
                            x2={safeNum(swingScreen.x)}
                            y2={safeNum(swingScreen.y)}
                            stroke={color}
                            strokeWidth={strokeW + 0.5}
                            strokeLinecap="butt"
                        />

                        {/* ── Hoja de puerta (línea sólida desde bisagra al extremo del arco) ── */}
                        <line
                            x1={safeNum(hingeScreen.x)}
                            y1={safeNum(hingeScreen.y)}
                            x2={safeNum(arcEndX)}
                            y2={safeNum(arcEndY)}
                            stroke={color}
                            strokeWidth={strokeW * 0.8}
                            strokeLinecap="round"
                        />

                        {/* ── Arco de apertura (cuarto de círculo, 90°) ── */}
                        <path
                            d={`M ${safeNum(swingScreen.x)},${safeNum(swingScreen.y)} A ${safeNum(widthPx)},${safeNum(widthPx)} 0 0,${sweepFlag} ${safeNum(arcEndX)},${safeNum(arcEndY)}`}
                            fill="none"
                            stroke={color}
                            strokeWidth={safeNum(strokeW * 0.55)}
                            strokeDasharray="5,3"
                            opacity={0.75}
                        />

                        {/* ── Punto de bisagra ── */}
                        <circle
                            cx={safeNum(hingeScreen.x)}
                            cy={safeNum(hingeScreen.y)}
                            r={safeNum(Math.max(2, strokeW * 0.9))}
                            fill={color}
                        />

                        {/* ── Hit área invisible ── */}
                        <line
                            x1={safeNum(hingeScreen.x)}
                            y1={safeNum(hingeScreen.y)}
                            x2={safeNum(swingScreen.x)}
                            y2={safeNum(swingScreen.y)}
                            stroke="transparent"
                            strokeWidth={12}
                        />

                        {/* ── Etiqueta ── */}
                        {zoom > 0.4 && (
                            <text
                                x={safeNum(midX)}
                                y={safeNum(midY)}
                                textAnchor="middle"
                                fill={color}
                                fontSize={fontSize}
                                fontFamily="monospace"
                                fontWeight={500}
                                pointerEvents="none"
                                style={{ userSelect: 'none' }}
                            >
                                {label}
                            </text>
                        )}

                        {/* ── Indicador de apertura ── */}
                        {isSelected && (
                            <text
                                x={safeNum(midX)}
                                y={safeNum(midY - 11)}
                                textAnchor="middle"
                                fill={color}
                                fontSize={safeNum(Math.max(7, 8 * zoom))}
                                fontFamily="sans-serif"
                                opacity={0.7}
                                pointerEvents="none"
                                style={{ userSelect: 'none' }}
                            >
                                {door.openingDirection === 'outward'
                                    ? '← hacia afuera'
                                    : '→ hacia adentro'}
                            </text>
                        )}
                    </g>
                );
            })}
        </g>
    );
});
