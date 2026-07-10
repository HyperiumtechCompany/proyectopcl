import React, { memo } from 'react';

interface GridLayerProps {
    width: number;
    height: number;
    screenPoint: (p: { x: number; y: number }) => { x: number; y: number };
    worldPoint: (x: number, y: number) => { x: number; y: number };
    viewTick: number; // Forzar re-render cuando cambia la vista CAD
}

/**
 * GridLayer — Capa SVG de grilla métrica de fondo
 * Dibuja líneas verticales y horizontales utilizando la cámara nativa CAD.
 */
export const GridLayer = memo(function GridLayer({
    width,
    height,
    screenPoint,
    worldPoint,
}: GridLayerProps) {
    if (width <= 0 || height <= 0) return null;

    // Obtener los límites del mundo visibles en pantalla
    const wTopLeft = worldPoint(0, 0);
    const wBottomRight = worldPoint(width, height);

    // Calcular el rango visible en metros
    const minX = Math.min(wTopLeft.x, wBottomRight.x);
    const maxX = Math.max(wTopLeft.x, wBottomRight.x);
    const minY = Math.min(wTopLeft.y, wBottomRight.y);
    const maxY = Math.max(wTopLeft.y, wBottomRight.y);

    // Determinar la resolución de la grilla
    const viewWidthMeters = maxX - minX;
    if (viewWidthMeters > 500) return null; // Muy lejos para grilla

    // Ajustar el paso de la grilla basado en el zoom
    let step = 1; // 1 metro por defecto
    if (viewWidthMeters > 100) step = 5;
    if (viewWidthMeters < 5) step = 0.5;

    const startX = Math.floor(minX / step) * step;
    const startY = Math.floor(minY / step) * step;

    const vertLines: { x: number; isMain: boolean }[] = [];
    for (let wx = startX; wx <= maxX; wx += step) {
        const sx = screenPoint({ x: wx, y: 0 }).x;
        vertLines.push({ x: sx, isMain: Math.abs(wx % (step * 5)) < 0.001 });
    }

    const horizLines: { y: number; isMain: boolean }[] = [];
    for (let wy = startY; wy <= maxY; wy += step) {
        // En mlightcad Y está invertido en la pantalla (crece hacia arriba en CAD),
        // pero nuestro screenPoint ya lo maneja.
        const sy = screenPoint({ x: 0, y: wy }).y;
        horizLines.push({ y: sy, isMain: Math.abs(wy % (step * 5)) < 0.001 });
    }

    return (
        <g className="grid-layer" opacity={0.3} pointerEvents="none">
            {vertLines.map((l, i) => (
                <line
                    key={`v-${i}`}
                    x1={l.x}
                    y1={0}
                    x2={l.x}
                    y2={height}
                    stroke={l.isMain ? '#6b7280' : '#4b5563'}
                    strokeWidth={l.isMain ? 1 : 0.5}
                />
            ))}
            {horizLines.map((l, i) => (
                <line
                    key={`h-${i}`}
                    x1={0}
                    y1={l.y}
                    x2={width}
                    y2={l.y}
                    stroke={l.isMain ? '#6b7280' : '#4b5563'}
                    strokeWidth={l.isMain ? 1 : 0.5}
                />
            ))}
        </g>
    );
});
