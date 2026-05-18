/**
 * OverlayRooms.tsx — Renderiza recintos, pasadizos y escaleras en plano 2D
 *
 * Jerarquía de capas (de abajo hacia arriba):
 *   Pasadizo  → patrón de losa: líneas cruzadas + borde amarillo
 *   Escalera  → patrón de escalones orientados + flechas por tramo
 *   Recinto   → relleno sólido + borde azul
 */

import { memo } from 'react';
import type { Room, StairFlight } from '@/hooks/dialux/types';
import { safeNum, centroid } from './canvasUtils';

type ScreenFn = (p: { x: number; y: number }) => { x: number; y: number };

interface Props {
    rooms: Room[];
    selectedId: string | null;
    zoom: number;
    onSelect: (id: string) => void;
    screenPoint: ScreenFn;
    screenDistance?: (dx: number, dy: number, origin: { x: number; y: number }) => number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ARROW: Record<StairFlight['direction'], string> = {
    north: '↑', south: '↓', east: '→', west: '←',
};

function bboxOf(verts: { x: number; y: number }[]) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const v of verts) {
        if (v.x < minX) minX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.x > maxX) maxX = v.x;
        if (v.y > maxY) maxY = v.y;
    }
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

// ─── Sub-componentes (cada uno se memoiza por separado) ───────────────────────

const RoomPolygon = memo(function RoomPolygon({
    room, pts, ctr, isSelected, zoom, onSelect,
}: {
    room: Room;
    pts: string;
    ctr: { x: number; y: number };
    isSelected: boolean;
    zoom: number;
    onSelect: (id: string) => void;
}) {
    return (
        <g
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
            onClick={() => onSelect(room.id)}
        >
            <polygon points={pts} fill="#1e3a5f" fillOpacity={0.22} />
            {isSelected && (
                <polygon
                    points={pts} fill="none"
                    stroke="#93c5fd" strokeWidth={6}
                    strokeLinejoin="miter" opacity={0.3}
                />
            )}
            <polygon
                points={pts} fill="none"
                stroke={isSelected ? '#60a5fa' : '#3b82f6'}
                strokeWidth={isSelected ? 3 : 2}
                strokeLinejoin="miter"
            />
            <text
                x={safeNum(ctr.x)} y={safeNum(ctr.y)}
                textAnchor="middle" dominantBaseline="middle"
                fill={isSelected ? '#e2e8f0' : '#93c5fd'}
                fontSize={safeNum(Math.max(9, 11 * zoom))}
                fontFamily="sans-serif" fontWeight={600}
                pointerEvents="none"
            >
                {room.name}
            </text>
        </g>
    );
});

const CorridorPolygon = memo(function CorridorPolygon({
    room, pts, ctr, isSelected, zoom, onSelect,
}: {
    room: Room;
    pts: string;
    ctr: { x: number; y: number };
    isSelected: boolean;
    zoom: number;
    onSelect: (id: string) => void;
}) {
    const patId = `hatch-pasadizo-${room.id}`;
    return (
        <g
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
            onClick={() => onSelect(room.id)}
        >
            <defs>
                <pattern id={patId} patternUnits="userSpaceOnUse" width={10} height={10}>
                    <line x1={0} y1={0} x2={10} y2={10}
                        stroke="#f59e0b" strokeWidth={0.8} strokeOpacity={0.55} />
                    <line x1={10} y1={0} x2={0} y2={10}
                        stroke="#f59e0b" strokeWidth={0.8} strokeOpacity={0.55} />
                </pattern>
            </defs>
            <polygon points={pts} fill="#78350f" fillOpacity={0.18} />
            <polygon points={pts} fill={`url(#${patId})`} fillOpacity={1} />
            <polygon
                points={pts} fill="none"
                stroke={isSelected ? '#fbbf24' : '#f59e0b'}
                strokeWidth={isSelected ? 2.5 : 1.8}
                strokeDasharray={isSelected ? '0' : '6,3'}
            />
            <text
                x={safeNum(ctr.x)} y={safeNum(ctr.y)}
                textAnchor="middle" dominantBaseline="middle"
                fill={isSelected ? '#fbbf24' : '#d97706'}
                fontSize={safeNum(Math.max(8, 10 * zoom))}
                fontFamily="sans-serif" fontWeight={600}
                pointerEvents="none" letterSpacing={0.5}
            >
                {room.name}
            </text>
        </g>
    );
});

const StairPolygon = memo(function StairPolygon({
    room, screenVerts, pts, ctr, isSelected, zoom, onSelect,
}: {
    room: Room;
    screenVerts: { x: number; y: number }[];
    pts: string;
    ctr: { x: number; y: number };
    isSelected: boolean;
    zoom: number;
    onSelect: (id: string) => void;
}) {
    const sc         = room.stairConfig;
    const flights    = sc?.flights ?? [];
    const hasFlights = flights.length > 0;
    const startElev  = sc?.startElevation ?? 0;

    // Dirección efectiva del primer tramo
    const primaryDir: StairFlight['direction'] = hasFlights
        ? flights[0].direction
        : (sc?.orientation ?? 'south');
    const isHorizontalAscent = primaryDir === 'east' || primaryDir === 'west';

    // Para U-stair (2 tramos NS opuestos o 2 EW opuestos), usamos patrón dividido
    const isUStair = hasFlights && flights.length === 2 && (() => {
        const d0 = flights[0].direction;
        const d1 = flights[1].direction;
        return (
            (d0 === 'north' && d1 === 'south') || (d0 === 'south' && d1 === 'north') ||
            (d0 === 'east'  && d1 === 'west')  || (d0 === 'west'  && d1 === 'east')
        );
    })();

    const stepPx    = Math.max(8, 11 * zoom);
    const patId     = `hatch-stair-${room.id}`;
    const patId2    = `hatch-stair2-${room.id}`;
    const clipId    = `clip-stair-${room.id}`;
    const clipHalf0 = `clip-half0-${room.id}`;
    const clipHalf1 = `clip-half1-${room.id}`;
    const bb        = bboxOf(screenVerts);
    const fontSize  = safeNum(Math.max(7, 9 * zoom));
    const arrowSize = safeNum(Math.max(10, 13 * zoom));
    const subSize   = safeNum(Math.max(6, 7.5 * zoom));

    const totalSteps = hasFlights
        ? flights.reduce((s, f) => s + f.stepCount, 0)
        : (sc?.stepCount ?? 1);
    const totalH = (totalSteps * (sc?.riserHeight ?? 0.175) + startElev).toFixed(2);

    // Líneas de rajado horizontal (⊥ al movimiento N/S) o vertical (⊥ E/W)
    const hatchLineNS = <line x1={0} y1={0} x2={1000} y2={0}
        stroke="#fb923c" strokeWidth={1.2} strokeOpacity={0.65} />;
    const hatchLineEW = <line x1={0} y1={0} x2={0} y2={1000}
        stroke="#fb923c" strokeWidth={1.2} strokeOpacity={0.65} />;

    // Rectángulos de mitad izquierda/derecha (para U-stair NS) o arriba/abajo (U-stair EW)
    const halfMidX = (bb.minX + bb.maxX) / 2;
    const halfMidY = (bb.minY + bb.maxY) / 2;

    return (
        <g
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
            onClick={() => onSelect(room.id)}
        >
            <defs>
                <clipPath id={clipId}>
                    <polygon points={pts} />
                </clipPath>

                {/* Para U-stair: dos clips de mitad para el patrón dividido */}
                {isUStair && (
                    <>
                        <clipPath id={clipHalf0}>
                            <polygon points={pts} />
                        </clipPath>
                        <clipPath id={clipHalf1}>
                            <polygon points={pts} />
                        </clipPath>
                    </>
                )}

                {/* Patrón principal */}
                <pattern id={patId} patternUnits="userSpaceOnUse"
                    width={isHorizontalAscent ? stepPx : 1000}
                    height={isHorizontalAscent ? 1000 : stepPx}
                >
                    {isHorizontalAscent ? hatchLineEW : hatchLineNS}
                </pattern>

                {/* Patrón secundario (dirección opuesta para U-stair) */}
                {isUStair && (
                    <pattern id={patId2} patternUnits="userSpaceOnUse"
                        width={isHorizontalAscent ? 1000 : stepPx}
                        height={isHorizontalAscent ? stepPx : 1000}
                    >
                        {isHorizontalAscent ? hatchLineNS : hatchLineEW}
                    </pattern>
                )}
            </defs>

            {/* Relleno base */}
            <polygon points={pts} fill="#7c2d12" fillOpacity={0.22} />

            {isUStair ? (
                /* U-stair: mitad izquierda con patrón 1, mitad derecha con patrón 2 */
                <>
                    {/* Mitad 0 — primer tramo */}
                    <rect
                        x={isHorizontalAscent ? bb.minX - 2 : bb.minX - 2}
                        y={isHorizontalAscent ? bb.minY - 2 : bb.minY - 2}
                        width={isHorizontalAscent ? bb.w + 4 : halfMidX - bb.minX + 2}
                        height={isHorizontalAscent ? halfMidY - bb.minY + 2 : bb.h + 4}
                        fill={`url(#${patId})`}
                        clipPath={`url(#${clipId})`}
                        pointerEvents="none"
                    />
                    {/* Mitad 1 — segundo tramo (patrón opuesto) */}
                    <rect
                        x={isHorizontalAscent ? bb.minX - 2 : halfMidX - 2}
                        y={isHorizontalAscent ? halfMidY - 2 : bb.minY - 2}
                        width={isHorizontalAscent ? bb.w + 4 : bb.maxX - halfMidX + 4}
                        height={isHorizontalAscent ? bb.maxY - halfMidY + 4 : bb.h + 4}
                        fill={`url(#${patId2})`}
                        clipPath={`url(#${clipId})`}
                        pointerEvents="none"
                    />
                    {/* Línea divisoria del descanso en el centro */}
                    <line
                        x1={isHorizontalAscent ? bb.minX : halfMidX}
                        y1={isHorizontalAscent ? halfMidY : bb.minY}
                        x2={isHorizontalAscent ? bb.maxX : halfMidX}
                        y2={isHorizontalAscent ? halfMidY : bb.maxY}
                        stroke="#fb923c" strokeWidth={1.5} strokeDasharray="4 3"
                        strokeOpacity={0.7} pointerEvents="none"
                        clipPath={`url(#${clipId})`}
                    />
                </>
            ) : (
                /* Escalera directa o multi-tramo no-U: patrón uniforme */
                <rect
                    x={bb.minX - 2} y={bb.minY - 2}
                    width={bb.w + 4} height={bb.h + 4}
                    fill={`url(#${patId})`}
                    clipPath={`url(#${clipId})`}
                    pointerEvents="none"
                />
            )}

            {/* Flechas por tramo */}
            {hasFlights && flights.length > 1
                ? flights.map((flight, idx) => {
                    // Para U-stair NS: flechas en cada mitad horizontal
                    // Para el resto: posición proporcional en el eje principal
                    const isFlightNS = flight.direction === 'north' || flight.direction === 'south';
                    let arrowX: number, arrowY: number;
                    if (isUStair) {
                        if (isHorizontalAscent) {
                            arrowX = ctr.x;
                            arrowY = idx === 0
                                ? (bb.minY + halfMidY) / 2
                                : (halfMidY + bb.maxY) / 2;
                        } else {
                            arrowX = idx === 0
                                ? (bb.minX + halfMidX) / 2
                                : (halfMidX + bb.maxX) / 2;
                            arrowY = ctr.y;
                        }
                    } else {
                        const ratio = idx / flights.length + 0.5 / flights.length;
                        arrowX = isFlightNS ? ctr.x : bb.minX + bb.w * ratio;
                        arrowY = isFlightNS ? bb.minY + bb.h * ratio : ctr.y;
                    }
                    return (
                        <text
                            key={flight.id}
                            x={safeNum(arrowX)} y={safeNum(arrowY)}
                            textAnchor="middle" dominantBaseline="middle"
                            fill="#fdba74" fontSize={arrowSize}
                            fontFamily="sans-serif" fontWeight={700}
                            pointerEvents="none"
                        >
                            {ARROW[flight.direction]}
                        </text>
                    );
                })
                : <text
                    x={safeNum(ctr.x)} y={safeNum(ctr.y - Math.max(6, 8 * zoom))}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="#fdba74" fontSize={arrowSize}
                    fontFamily="sans-serif" fontWeight={700}
                    pointerEvents="none"
                >
                    {ARROW[primaryDir]}
                </text>
            }

            {/* Contorno */}
            {isSelected && (
                <polygon points={pts} fill="none"
                    stroke="#fdba74" strokeWidth={6}
                    strokeLinejoin="miter" opacity={0.3}
                />
            )}
            <polygon points={pts} fill="none"
                stroke={isSelected ? '#fdba74' : '#f97316'}
                strokeWidth={isSelected ? 2.5 : 1.8}
                strokeLinejoin="miter"
            />

            {/* Etiqueta principal */}
            <text
                x={safeNum(ctr.x)}
                y={safeNum(ctr.y + Math.max(6, 8 * zoom))}
                textAnchor="middle" dominantBaseline="middle"
                fill={isSelected ? '#fdba74' : '#fb923c'}
                fontSize={fontSize}
                fontFamily="sans-serif" fontWeight={600}
                pointerEvents="none" letterSpacing={0.3}
            >
                {room.name}
            </text>

            {/* Subtítulo: tramos + elevación */}
            <text
                x={safeNum(ctr.x)}
                y={safeNum(ctr.y + Math.max(6, 8 * zoom) + Math.max(7, 9 * zoom))}
                textAnchor="middle" dominantBaseline="middle"
                fill="#a3660a"
                fontSize={subSize}
                fontFamily="monospace"
                pointerEvents="none"
            >
                {hasFlights
                    ? `${flights.map(f => ARROW[f.direction]).join('')} · ${totalSteps}esc · ${startElev > 0 ? `+${startElev.toFixed(2)}→` : ''}${totalH}m`
                    : `${ARROW[primaryDir]} · ${sc?.stepCount ?? '?'}esc · ${startElev > 0 ? `+${startElev.toFixed(2)}→` : ''}${totalH}m`
                }
            </text>
        </g>
    );
});

// ─── Componente principal ─────────────────────────────────────────────────────

export const OverlayRooms = memo(function OverlayRooms({
    rooms, selectedId, zoom, onSelect, screenPoint,
}: Props) {
    if (!rooms.length) return null;

    const recintos  = rooms.filter(r => !r.roomType || r.roomType === 'room');
    const pasadizos = rooms.filter(r => r.roomType === 'corridor');
    const escaleras = rooms.filter(r => r.roomType === 'stair');

    const renderOne = (room: Room) => {
        const sv  = room.vertices.map(v => screenPoint(v));
        const pts = sv.map(p => `${safeNum(p.x)},${safeNum(p.y)}`).join(' ');
        const ctr = centroid(sv);
        const sel = selectedId === room.id;

        if (room.roomType === 'stair') {
            return (
                <StairPolygon
                    key={room.id}
                    room={room}
                    screenVerts={sv}
                    pts={pts}
                    ctr={ctr}
                    isSelected={sel}
                    zoom={zoom}
                    onSelect={onSelect}
                />
            );
        }
        if (room.roomType === 'corridor') {
            return (
                <CorridorPolygon
                    key={room.id}
                    room={room}
                    pts={pts}
                    ctr={ctr}
                    isSelected={sel}
                    zoom={zoom}
                    onSelect={onSelect}
                />
            );
        }
        return (
            <RoomPolygon
                key={room.id}
                room={room}
                pts={pts}
                ctr={ctr}
                isSelected={sel}
                zoom={zoom}
                onSelect={onSelect}
            />
        );
    };

    return (
        <g className="overlay-rooms">
            {pasadizos.map(renderOne)}
            {escaleras.map(renderOne)}
            {recintos.map(renderOne)}
        </g>
    );
});
