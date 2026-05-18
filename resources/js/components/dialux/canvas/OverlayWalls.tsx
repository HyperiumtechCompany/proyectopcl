/**
 * OverlayWalls.tsx — Renderiza las paredes (polilíneas) en el plano 2D
 * Cada pared: hit-area invisible, cuerpo visible y (para cerco) postes memoizados.
 */

import { memo, useMemo } from 'react';
import type { Wall } from '@/hooks/dialux/types';
import { safeNum, wallVertStr, wallLengthM, wallThickPx, centroid } from './canvasUtils';

type ScreenFn = (p: { x: number; y: number }) => { x: number; y: number };
type ScreenDistFn = (dx: number, dy: number, origin: { x: number; y: number }) => number;

interface Props {
    walls: Wall[];
    selectedId: string | null;
    zoom: number;
    onSelect: (id: string) => void;
    screenPoint: ScreenFn;
    screenDistance: ScreenDistFn;
}

// ─── WallItem: sub-componente memo para que useMemo opere por muro ────────────

interface WallItemProps {
    wall: Wall;
    isSelected: boolean;
    zoom: number;
    onSelect: (id: string) => void;
    screenPoint: ScreenFn;
    screenDistance: ScreenDistFn;
}

const WallItem = memo(function WallItem({
    wall: w, isSelected, zoom, onSelect, screenPoint, screenDistance,
}: WallItemProps) {
    const pts      = wallVertStr(w, screenPoint);
    const origin   = w.vertices[0] ?? { x: 0, y: 0 };
    const thickPx  = wallThickPx(w.thickness, screenDistance, origin);
    const totalLen = wallLengthM(w);
    const ctr      = centroid(w.vertices.map(v => screenPoint(v)));

    const isEdu    = w.normativeUse === 'education';
    const isCerco  = w.wallType === 'cerco';

    const wallStroke     = isCerco ? '#4ade80' : isEdu ? '#22d3ee' : '#eab308';
    const selectedStroke = isCerco ? '#86efac' : isEdu ? '#67e8f9' : '#fde047';
    const labelFill      = isCerco ? '#86efac' : isEdu ? '#67e8f9' : '#94a3b8';
    const stroke         = isSelected ? selectedStroke : wallStroke;

    // Postes del cerco memoizados — solo recalcula cuando cambian vértices o spacing
    const postMarkers = useMemo<{ x: number; y: number }[]>(() => {
        if (!isCerco || w.vertices.length < 2) return [];
        const spacing = w.postSpacing ?? 3.0;
        const markers: { x: number; y: number }[] = [];
        let accumulated = 0;

        for (let seg = 0; seg < w.vertices.length - 1; seg++) {
            const a = w.vertices[seg];
            const b = w.vertices[seg + 1];
            const segLen = Math.hypot(b.x - a.x, b.y - a.y);
            if (segLen === 0) continue;
            const ux = (b.x - a.x) / segLen;
            const uy = (b.y - a.y) / segLen;
            // Primer poste del segmento: en el inicio si es el primer segmento
            let t = accumulated === 0 ? 0 : spacing - (accumulated % spacing);
            while (t <= segLen) {
                markers.push(screenPoint({ x: a.x + ux * t, y: a.y + uy * t }));
                t += spacing;
            }
            accumulated += segLen;
        }
        return markers;
    // screenPoint cambia con pan/zoom — recalcular también en ese caso
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCerco, w.vertices, w.postSpacing, screenPoint]);

    return (
        <g
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
            onClick={() => onSelect(w.id)}
        >
            {/* Hit-area ancha para facilitar el click */}
            <polyline points={pts} stroke="transparent" strokeWidth={20} fill="none" />

            {/* Cuerpo visible */}
            <polyline
                points={pts}
                stroke={stroke}
                strokeWidth={isSelected ? 3 : isCerco ? 2.5 : 2}
                strokeLinecap="round"
                strokeDasharray={isCerco ? '8,4' : undefined}
                fill="none"
            />

            {/* Postes del cerco */}
            {postMarkers.map((pm, i) => (
                <rect
                    key={i}
                    x={safeNum(pm.x - 3.5)} y={safeNum(pm.y - 3.5)}
                    width={7} height={7}
                    fill={isSelected ? selectedStroke : wallStroke}
                    fillOpacity={0.85} rx={1}
                    pointerEvents="none"
                />
            ))}

            {/* Etiqueta de longitud */}
            {totalLen > 0.1 && (
                <text
                    x={safeNum(ctr.x)}
                    y={safeNum(ctr.y - thickPx / 2 - 4)}
                    textAnchor="middle"
                    fill={labelFill}
                    fontSize={safeNum(Math.max(7, 9 * zoom))}
                    fontFamily="monospace"
                    pointerEvents="none"
                >
                    {isCerco ? `▪ ${totalLen.toFixed(2)}m` : `${totalLen.toFixed(2)}m`}
                </text>
            )}
        </g>
    );
});

// ─── Contenedor principal ─────────────────────────────────────────────────────

export const OverlayWalls = memo(function OverlayWalls({
    walls, selectedId, zoom, onSelect, screenPoint, screenDistance,
}: Props) {
    if (!walls.length) return null;
    return (
        <g className="overlay-walls">
            {walls.map(w => (
                <WallItem
                    key={w.id}
                    wall={w}
                    isSelected={selectedId === w.id}
                    zoom={zoom}
                    onSelect={onSelect}
                    screenPoint={screenPoint}
                    screenDistance={screenDistance}
                />
            ))}
        </g>
    );
});
