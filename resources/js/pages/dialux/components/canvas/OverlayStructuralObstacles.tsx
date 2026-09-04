/**
 * OverlayStructuralObstacles.tsx -- Renderiza columnas/vigas/zonas restringidas
 * en el plano 2D: relleno solido con hatch diagonal en tono ambar/rojo (senal
 * de "no colocar luminarias aqui"), distinto del azul de Room y del ambar de
 * Pasadizo para que se lea de inmediato como un obstaculo, no como un espacio.
 */

import { memo } from 'react';
import {
    calculatePolygonArea,
    calculatePolygonPerimeter,
} from '@/pages/dialux/hooks/lightingCalculations';
import type { StructuralObstacle } from '@/pages/dialux/hooks/types';
import { safeNum, centroid } from './canvasUtils';

type ScreenFn = (p: { x: number; y: number }) => { x: number; y: number };

interface Props {
    obstacles: StructuralObstacle[];
    selectedId: string | null;
    zoom: number;
    onSelect: (id: string) => void;
    screenPoint: ScreenFn;
}

const OBSTACLE_TYPE_LABEL: Record<StructuralObstacle['obstacleType'], string> = {
    column: 'Columna',
    beam: 'Viga',
    restricted_area: 'Zona restringida',
    roof: 'Cubierta',
    ceiling: 'Cielorraso',
    ramp: 'Rampa',
};

const ObstaclePolygon = memo(function ObstaclePolygon({
    obstacle, pts, ctr, isSelected, zoom, onSelect,
}: {
    obstacle: StructuralObstacle;
    pts: string;
    ctr: { x: number; y: number };
    isSelected: boolean;
    zoom: number;
    onSelect: (id: string) => void;
}) {
    const area = calculatePolygonArea(obstacle.vertices);
    const perimeter = calculatePolygonPerimeter(obstacle.vertices);
    const labelFontSize = safeNum(Math.max(8, 10 * zoom));
    const subFontSize = safeNum(Math.max(7, 8 * zoom));
    const lineOffset = safeNum(Math.max(9, 12 * zoom));
    const showMetrics = zoom >= 0.5 && area > 0;
    const patId = `hatch-obstacle-${obstacle.id}`;
    const isConstructionSurface = ['roof', 'ceiling', 'ramp'].includes(obstacle.obstacleType);
    const rampColors: Record<string, string> = {
        concrete: '#78716c', metal: '#64748b', plastic: '#0891b2',
        wood: '#92400e', composite: '#475569',
    };
    const baseColor = obstacle.obstacleType === 'ramp'
        ? (rampColors[obstacle.rampMaterial ?? 'concrete'] ?? '#78716c')
        : isConstructionSurface ? '#1d4ed8' : '#44403c';
    const hatchColor = isConstructionSurface ? '#67e8f9' : '#dc2626';

    return (
        <g
            style={{ pointerEvents: isConstructionSurface ? 'none' : 'auto', cursor: 'pointer' }}
            onClick={isConstructionSurface ? undefined : () => onSelect(obstacle.id)}
        >
            <defs>
                <pattern id={patId} patternUnits="userSpaceOnUse" width={8} height={8}>
                    <line x1={0} y1={0} x2={8} y2={8} stroke={hatchColor} strokeWidth={1} strokeOpacity={0.55} />
                    <line x1={8} y1={0} x2={0} y2={8} stroke={hatchColor} strokeWidth={1} strokeOpacity={0.55} />
                </pattern>
            </defs>
            <polygon points={pts} fill={baseColor} fillOpacity={isConstructionSurface ? 0.12 : 0.55} />
            <polygon points={pts} fill={`url(#${patId})`} fillOpacity={isConstructionSurface ? 0.22 : 1} />
            <polygon
                points={pts} fill="none"
                stroke={isSelected ? '#f87171' : '#a8a29e'}
                strokeWidth={isSelected ? 2.5 : 1.6}
                style={isConstructionSurface ? { pointerEvents: 'stroke', cursor: 'pointer' } : undefined}
                onClick={isConstructionSurface ? () => onSelect(obstacle.id) : undefined}
            />
            {isSelected && (
                <polygon
                    points={pts} fill="none"
                    stroke="#fca5a5" strokeWidth={5.5}
                    strokeLinejoin="miter" opacity={0.28}
                />
            )}
            <text
                x={safeNum(ctr.x)} y={safeNum(showMetrics ? ctr.y - lineOffset / 2 : ctr.y)}
                textAnchor="middle" dominantBaseline="middle"
                fill={isSelected ? '#fecaca' : '#e7e5e4'}
                fontSize={labelFontSize}
                fontFamily="sans-serif" fontWeight={700}
                pointerEvents="none"
            >
                {obstacle.name}
            </text>
            {showMetrics && (
                <text
                    x={safeNum(ctr.x)} y={safeNum(ctr.y + lineOffset / 2)}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="#d6d3d1"
                    fontSize={subFontSize}
                    fontFamily="monospace" fontWeight={400}
                    pointerEvents="none"
                >
                    {`${OBSTACLE_TYPE_LABEL[obstacle.obstacleType]} · ${area.toFixed(2)}m² · Ø${perimeter.toFixed(2)}m`}
                </text>
            )}
        </g>
    );
});

export const OverlayStructuralObstacles = memo(function OverlayStructuralObstacles({
    obstacles, selectedId, zoom, onSelect, screenPoint,
}: Props) {
    if (!obstacles.length) return null;

    return (
        <g className="overlay-structural-obstacles">
            {obstacles.map((obstacle) => {
                if (obstacle.vertices.length < 3) return null;
                const sv = obstacle.vertices.map((v) => screenPoint(v));
                const pts = sv.map((p) => `${safeNum(p.x)},${safeNum(p.y)}`).join(' ');
                const ctr = centroid(sv);
                return (
                    <ObstaclePolygon
                        key={obstacle.id}
                        obstacle={obstacle}
                        pts={pts}
                        ctr={ctr}
                        isSelected={selectedId === obstacle.id}
                        zoom={zoom}
                        onSelect={onSelect}
                    />
                );
            })}
        </g>
    );
});
