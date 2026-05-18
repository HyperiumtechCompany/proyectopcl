/**
 * OverlayRooms.tsx — Renderiza los recintos, pasadizos y escaleras en el plano 2D
 *
 * Jerarquía visual:
 *   Recinto   → paredes exteriores: contorno grueso gris-azulado, relleno sólido oscuro
 *   Pasadizo  → proyección de losa de techo: patrón de líneas cruzadas + borde amarillo
 *   Escalera  → patrón escalonado naranja: líneas paralelas + borde naranja
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
    /** Convierte una distancia (m) a píxeles — opcional, usado para grosor de muro */
    screenDistance?: (dx: number, dy: number, origin: { x: number; y: number }) => number;
}

export const OverlayRooms = memo(function OverlayRooms({
    rooms, selectedId, zoom, onSelect, screenPoint, screenDistance,
}: Props) {
    if (!rooms.length) return null;

    // Separar recintos, pasadizos y escaleras para controlar el orden de capas
    const recintos = rooms.filter(r => !r.roomType || r.roomType === 'room');
    const pasadizos = rooms.filter(r => r.roomType === 'corridor');
    const escaleras = rooms.filter(r => r.roomType === 'stair');

    const renderRoom = (room: Room) => {
        const screenVertices = room.vertices.map(v => screenPoint({ x: v.x, y: v.y }));
        const pts = screenVertices.map(p => `${safeNum(p.x)},${safeNum(p.y)}`).join(' ');
        const ctr = centroid(screenVertices);
        const isSelected = selectedId === room.id;

        if (room.roomType === 'stair') {
            // ── Escalera: líneas perpendiculares a la dirección de ascenso ──────
            const patId   = `hatch-stair-${room.id}`;
            const clipId  = `clip-stair-${room.id}`;
            const orient  = room.stairConfig?.orientation ?? 'north';
            const isHorizontalAscent = orient === 'east' || orient === 'west';
            // Líneas de escalón son perpendiculares al movimiento:
            //   N/S → líneas horizontales   E/O → líneas verticales
            const stepPx  = Math.max(8, 11 * zoom);
            const arrowMap: Record<string, string> = {
                north: '↑', south: '↓', east: '→', west: '←',
            };

            return (
                <g
                    key={room.id}
                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                    onClick={() => onSelect(room.id)}
                >
                    <defs>
                        <clipPath id={clipId}>
                            <polygon points={pts} />
                        </clipPath>
                        <pattern
                            id={patId}
                            patternUnits="userSpaceOnUse"
                            width={isHorizontalAscent ? stepPx : 200}
                            height={isHorizontalAscent ? 200 : stepPx}
                        >
                            {isHorizontalAscent
                                ? /* Líneas verticales — ascenso E/O */
                                  <line x1={0} y1={0} x2={0} y2={200}
                                      stroke="#fb923c" strokeWidth={1.2} strokeOpacity={0.65} />
                                : /* Líneas horizontales — ascenso N/S */
                                  <line x1={0} y1={0} x2={200} y2={0}
                                      stroke="#fb923c" strokeWidth={1.2} strokeOpacity={0.65} />
                            }
                        </pattern>
                    </defs>

                    {/* Relleno base */}
                    <polygon points={pts} fill="#7c2d12" fillOpacity={0.22} />

                    {/* Patrón de escalones recortado al polígono */}
                    <rect
                        x={Math.min(...screenVertices.map(p => p.x)) - 5}
                        y={Math.min(...screenVertices.map(p => p.y)) - 5}
                        width={Math.max(...screenVertices.map(p => p.x)) - Math.min(...screenVertices.map(p => p.x)) + 10}
                        height={Math.max(...screenVertices.map(p => p.y)) - Math.min(...screenVertices.map(p => p.y)) + 10}
                        fill={`url(#${patId})`}
                        clipPath={`url(#${clipId})`}
                    />

                    {/* Contorno */}
                    <polygon
                        points={pts}
                        fill="none"
                        stroke={isSelected ? '#fdba74' : '#f97316'}
                        strokeWidth={isSelected ? 2.5 : 1.8}
                        strokeLinejoin="miter"
                    />
                    {isSelected && (
                        <polygon
                            points={pts}
                            fill="none"
                            stroke="#fdba74"
                            strokeWidth={6}
                            strokeLinejoin="miter"
                            opacity={0.3}
                        />
                    )}

                    {/* Flecha de dirección de ascenso */}
                    <text
                        x={safeNum(ctr.x)}
                        y={safeNum(ctr.y - Math.max(7, 9 * zoom))}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#fdba74"
                        fontSize={safeNum(Math.max(10, 14 * zoom))}
                        fontFamily="sans-serif"
                        fontWeight={700}
                        pointerEvents="none"
                    >
                        {arrowMap[orient]}
                    </text>

                    {/* Etiqueta */}
                    <text
                        x={safeNum(ctr.x)}
                        y={safeNum(ctr.y + Math.max(6, 8 * zoom))}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={isSelected ? '#fdba74' : '#fb923c'}
                        fontSize={safeNum(Math.max(7, 9 * zoom))}
                        fontFamily="sans-serif"
                        fontWeight={600}
                        pointerEvents="none"
                        letterSpacing={0.5}
                    >
                        {room.name}
                    </text>
                </g>
            );
        }

        if (room.roomType === 'corridor') {
            // ── Pasadizo: proyección de losa de techo ────────────────────────────
            // Fondo translúcido cálido (representación de sombra de alero)
            // Patrón de líneas cruzadas aplicado como clipPath sobre el polígono
            const patId = `hatch-pasadizo-${room.id}`;
            return (
                <g
                    key={room.id}
                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                    onClick={() => onSelect(room.id)}
                >
                    <defs>
                        {/* Patrón de cuadrícula cruzada — típico de proyección de losa en planta */}
                        <pattern
                            id={patId}
                            patternUnits="userSpaceOnUse"
                            width={10} height={10}
                        >
                            {/* diagonal \ */}
                            <line x1={0} y1={0} x2={10} y2={10}
                                stroke="#f59e0b" strokeWidth={0.8} strokeOpacity={0.55} />
                            {/* diagonal / */}
                            <line x1={10} y1={0} x2={0} y2={10}
                                stroke="#f59e0b" strokeWidth={0.8} strokeOpacity={0.55} />
                        </pattern>
                    </defs>
                    {/* Relleno base */}
                    <polygon
                        points={pts}
                        fill="#78350f"
                        fillOpacity={0.18}
                    />
                    {/* Patrón de losa encima */}
                    <polygon
                        points={pts}
                        fill={`url(#${patId})`}
                        fillOpacity={1}
                    />
                    {/* Contorno — borde exterior de alero */}
                    <polygon
                        points={pts}
                        fill="none"
                        stroke={isSelected ? '#fbbf24' : '#f59e0b'}
                        strokeWidth={isSelected ? 2.5 : 1.8}
                        strokeDasharray={isSelected ? '0' : '6,3'}
                    />
                    {/* Etiqueta */}
                    <text
                        x={safeNum(ctr.x)}
                        y={safeNum(ctr.y)}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={isSelected ? '#fbbf24' : '#d97706'}
                        fontSize={safeNum(Math.max(8, 10 * zoom))}
                        fontFamily="sans-serif"
                        fontWeight={600}
                        pointerEvents="none"
                        letterSpacing={0.5}
                    >
                        {room.name}
                    </text>
                </g>
            );
        }

        // ── Recinto: paredes exteriores en planta ─────────────────────────────

        return (
            <g key={room.id} style={{ pointerEvents: 'auto', cursor: 'pointer' }} onClick={() => onSelect(room.id)}>
                {/* Relleno interior del recinto */}
                <polygon
                    points={pts}
                    fill="#1e3a5f"
                    fillOpacity={0.22}
                />
                {/* Muro exterior — trazo fino azul */}
                <polygon
                    points={pts}
                    fill="none"
                    stroke={isSelected ? '#60a5fa' : '#3b82f6'}
                    strokeWidth={isSelected ? 3 : 2}
                    strokeLinejoin="miter"
                />
                {/* Selección glow */}
                {isSelected && (
                    <polygon
                        points={pts}
                        fill="none"
                        stroke="#93c5fd"
                        strokeWidth={6}
                        strokeLinejoin="miter"
                        opacity={0.3}
                    />
                )}
                {/* Etiqueta */}
                <text
                    x={safeNum(ctr.x)}
                    y={safeNum(ctr.y)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isSelected ? '#e2e8f0' : '#93c5fd'}
                    fontSize={safeNum(Math.max(9, 11 * zoom))}
                    fontFamily="sans-serif"
                    fontWeight={600}
                    pointerEvents="none"
                >
                    {room.name}
                </text>
            </g>
        );
    };

    return (
        <g className="overlay-rooms">
            {/* Pasadizos primero (capa base) */}
            {pasadizos.map(r => renderRoom(r))}
            {/* Escaleras (segunda capa) */}
            {escaleras.map(r => renderRoom(r))}
            {/* Recintos encima */}
            {recintos.map(r => renderRoom(r))}
        </g>
    );
});

