/**
 * OverlayRooms.tsx — Renderiza los recintos y pasadizos en el plano 2D
 *
 * Jerarquía visual:
 *   Recinto  → paredes exteriores: contorno grueso gris-azulado, relleno sólido oscuro
 *   Pasadizo → proyección de losa de techo: patrón de líneas cruzadas + borde amarillo
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

    // Separar recintos y pasadizos para controlar el orden de capas
    const recintos = rooms.filter(r => r.roomType !== 'corridor');
    const pasadizos = rooms.filter(r => r.roomType === 'corridor');

    const renderRoom = (room: Room, isCorridor: boolean) => {
        const screenVertices = room.vertices.map(v => screenPoint({ x: v.x, y: v.y }));
        const pts = screenVertices.map(p => `${safeNum(p.x)},${safeNum(p.y)}`).join(' ');
        const ctr = centroid(screenVertices);
        const isSelected = selectedId === room.id;

        if (isCorridor) {

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
            {pasadizos.map(r => renderRoom(r, true))}
            {/* Recintos encima */}
            {recintos.map(r => renderRoom(r, false))}
        </g>
    );
});
