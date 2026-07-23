import type { DialuxExportSnapshot, DialuxVectorAsset, DialuxBitmapAsset } from '../../domain/types';
import { buildSceneBounds, createTransform, transformPoint } from '../geometry/transforms';
import { renderDxfEntity } from './renderDxfEntity';
import {
    buildIsoluxColorLegend,
    escapeXml,
    renderCadBitmapFill,
    renderFixtureSymbol,
    renderNorthArrow,
    renderPolyline,
    renderScaleBar,
} from '../geometry/renderPrimitives';
import { colorForLuxMode, waveStrokeColor } from '../geometry/luxColor';
import { buildContourSegments } from '@/pages/dialux/hooks/isoluxContours';

export function buildDrawnTerrainSvg(
    snapshot: DialuxExportSnapshot,
    cadBaseAsset: DialuxBitmapAsset | null = null,
): DialuxVectorAsset {
    const MARGIN = 36;
    // Las extents del DXF (lámina completa: marco, notas, vistas) solo amplían
    // los límites cuando hay entidades DXF que dibujar. Con cad-viewer (DWG)
    // no hay entidades en el store: incluirlas arrincona el dibujo en una
    // esquina y deja la hoja vacía.
    const bounds = buildSceneBounds(
        snapshot,
        undefined,
        snapshot.dxfEntities.length > 0,
    );

    const boundsWidth = Math.max(1, bounds.maxX - bounds.minX);
    const boundsHeight = Math.max(1, bounds.maxY - bounds.minY);
    const isPortrait = boundsHeight > boundsWidth;
    const W = isPortrait ? 800 : 1200;
    const H = isPortrait ? 1131 : 780;
    
    const transform = createTransform(bounds, W, H, 72);

    const dxfMarkup = snapshot.dxfEntities
        .map((entity) => renderDxfEntity(entity, transform, snapshot.scaleConfig))
        .join('');

    const cadBitmapMarkup = (!dxfMarkup && cadBaseAsset)
        ? renderCadBitmapFill(cadBaseAsset, transform)
        : '';
    const dxfBaseLayer = dxfMarkup
        ? `<g id="dxf-base" opacity="0.9">${dxfMarkup}</g>`
        : '';
    const cadBgLayer = `${cadBitmapMarkup}${dxfBaseLayer}`;

    const roomsMarkup = snapshot.rooms
        .map((room) => {
            const isCorridor = room.roomType === 'corridor';
            return renderPolyline(room.vertices, transform, {
                stroke: isCorridor ? '#7c3aed' : '#e91e8c',
                strokeWidth: 1.5,
                fill: 'none',
                closed: true,
            });
        })
        .join('');

    const roomLabelsMarkup = snapshot.rooms
        .map((room) => {
            let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
            room.vertices.forEach(v => {
                minX = Math.min(minX, v.x);
                minY = Math.min(minY, v.y);
                maxX = Math.max(maxX, v.x);
                maxY = Math.max(maxY, v.y);
            });
            const center = transformPoint(transform, { x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
            const isCorridor = room.roomType === 'corridor';
            return `<text x="${center.x.toFixed(2)}" y="${center.y.toFixed(2)}" fill="${isCorridor ? '#7c3aed' : '#c2185b'}" font-size="11" font-family="sans-serif" font-weight="700" text-anchor="middle">${escapeXml(room.name)}</text>`;
        })
        .join('');

    const wallsMarkup = snapshot.walls
        .map((wall) =>
            renderPolyline(wall.vertices, transform, {
                stroke: '#475569',
                strokeWidth: 1.0,
                fill: 'none',
                closed: false,
            }),
        )
        .join('');

    // Mismo símbolo que los planos técnicos por ambiente (renderFixtureSymbol),
    // en vez de un punto azul genérico — consistencia visual entre plantillas.
    const fixturesMarkup = snapshot.fixtures
        .map((fixture) =>
            renderFixtureSymbol(transformPoint(transform, fixture), fixture, {
                scale: 0.6,
                accent: '#b45309',
                fill: '#f59e0b',
                fillOpacity: 0.22,
            }),
        )
        .join('');

    const ambientLabelsMarkup = snapshot.ambients
        .map((ambient) => {
            let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
            ambient.room.vertices.forEach(v => {
                minX = Math.min(minX, v.x);
                minY = Math.min(minY, v.y);
                maxX = Math.max(maxX, v.x);
                maxY = Math.max(maxY, v.y);
            });
            const center = transformPoint(transform, { x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
            return `<text x="${center.x.toFixed(2)}" y="${(center.y + 16).toFixed(2)}" fill="#9d174d" font-size="9" font-family="sans-serif" text-anchor="middle">${escapeXml(ambient.name)}</text>`;
        })
        .join('');

    const oneMeterPx = transform.scale;
    const barLenPx = Math.min(oneMeterPx * 5, 160);
    const barMeters = Number((barLenPx / oneMeterPx).toFixed(1));
    const scaleBarMarkup = renderScaleBar({
        x: MARGIN + 8,
        y: H - MARGIN - 14,
        barLengthPx: barLenPx,
        labelMeters: barMeters,
        barHeight: 5,
        strokeWidth: 1,
        fillOpacity: 0.5,
        fontSize: 9,
        labelYOffset: 6,
    });
    const northArrow = renderNorthArrow({
        x: W - MARGIN - 24,
        y: MARGIN + 52,
    });

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
        <rect width="${W}" height="${H}" fill="#ffffff"/>
        ${cadBgLayer}
        <g id="rooms-layer">${roomsMarkup}</g>
        <g id="walls-layer">${wallsMarkup}</g>
        <g id="fixtures-layer">${fixturesMarkup}</g>
        <g id="room-labels-layer">${roomLabelsMarkup}</g>
        <g id="ambient-labels-layer">${ambientLabelsMarkup}</g>
        ${scaleBarMarkup}
        ${northArrow}
    </svg>`;

    return {
        id: 'drawn-terrain-svg',
        title: 'Plano Arquitectónico',
        purpose: 'cad-overview',
        kind: 'vector',
        mimeType: 'image/svg+xml',
        svg,
        width: W,
        height: H,
    };
}

export function buildTerrainWithIsoluxSvg(
    snapshot: DialuxExportSnapshot,
    cadBaseAsset: DialuxBitmapAsset | null = null,
): DialuxVectorAsset {
    // Ver nota en buildDrawnTerrainSvg: extents del DXF solo con entidades.
    const bounds = buildSceneBounds(
        snapshot,
        undefined,
        snapshot.dxfEntities.length > 0,
    );
    
    const boundsWidth = Math.max(1, bounds.maxX - bounds.minX);
    const boundsHeight = Math.max(1, bounds.maxY - bounds.minY);
    const isPortrait = boundsHeight > boundsWidth;
    const W = isPortrait ? 800 : 1200;
    const H = isPortrait ? 1131 : 780;
    const MARGIN = 36;
    
    const transform = createTransform(bounds, W, H, 72);
    const mode = snapshot.visualConfig.isoluxMode ?? 'waves';

    const hasDxfEntities = snapshot.dxfEntities.length > 0;
    const dxfMarkup = snapshot.dxfEntities
        .map((entity) => renderDxfEntity(entity, transform, snapshot.scaleConfig))
        .join('');
    const cadBitmapMarkup = (!hasDxfEntities && cadBaseAsset)
        ? renderCadBitmapFill(cadBaseAsset, transform)
        : '';
    const dxfIsoluxBaseLayer = hasDxfEntities
        ? `<g id="dxf-base" opacity="0.7">${dxfMarkup}</g>`
        : '';
    const cadBgLayer = `${cadBitmapMarkup}${dxfIsoluxBaseLayer}`;

    // Min/max global para la leyenda de color (un solo rango para todo el
    // terreno, no uno distinto por ambiente).
    const validResults = snapshot.ambients
        .map((ambient) => ambient.result)
        .filter((result): result is NonNullable<typeof result> => result !== null);
    const terrainMaxLux = Math.max(1, ...validResults.map((result) => result.max_lux));
    const terrainValidValues = validResults.flatMap((result) =>
        result.grid_values.filter((v): v is number => v !== null),
    );
    const terrainMinLux =
        terrainValidValues.length > 0 ? Math.max(0, Math.min(...terrainValidValues)) : 0;

    const isoluxMarkup = snapshot.ambients.map((ambient) => {
        const result = ambient.result;
        if (
            !result ||
            result.grid_rows <= 0 ||
            result.grid_cols <= 0 ||
            result.grid_values.length === 0 ||
            result.grid_origin_x === undefined ||
            result.grid_origin_y === undefined ||
            result.grid_cell_width === undefined ||
            result.grid_cell_height === undefined
        ) {
            return '';
        }
        const maxLux = Math.max(result.max_lux, 1);
        const originX = result.grid_origin_x;
        const originY = result.grid_origin_y;
        const cellW0 = result.grid_cell_width;
        const cellH0 = result.grid_cell_height;
        const levels = [0.12, 0.2, 0.3, 0.42, 0.55, 0.68, 0.82, 0.94].map(
            (factor) => maxLux * factor,
        );

        const contourSegments =
            mode === 'waves'
                ? buildContourSegments({
                      rows: result.grid_rows,
                      cols: result.grid_cols,
                      values: result.grid_values,
                      levels,
                      pointAt: (row, col) =>
                          transformPoint(transform, {
                              x: originX + col * cellW0 + cellW0 / 2,
                              y: originY + row * cellH0 + cellH0 / 2,
                          }),
                  })
                : [];

        const contourMarkup = contourSegments
            .map((segment) =>
                `<line x1="${segment.start.x.toFixed(1)}" y1="${segment.start.y.toFixed(1)}" x2="${segment.end.x.toFixed(1)}" y2="${segment.end.y.toFixed(1)}" stroke="${waveStrokeColor(segment.level, maxLux)}" stroke-width="${segment.levelIndex % 2 === 0 ? 2.2 : 1.2}" stroke-linecap="round" />`,
            )
            .join('');

        const cells = result.grid_values.map((lux, index) => {
            if (lux === null) return '';
            const col = index % result.grid_cols;
            const row = Math.floor(index / result.grid_cols);
            const topLeft = transformPoint(transform, {
                x: originX + col * cellW0,
                y: originY + row * cellH0,
            });
            const bottomRight = transformPoint(transform, {
                x: originX + (col + 1) * cellW0,
                y: originY + (row + 1) * cellH0,
            });
            const cellW = Math.max(1, Math.abs(bottomRight.x - topLeft.x));
            const cellH = Math.max(1, Math.abs(bottomRight.y - topLeft.y));
            const x = Math.min(topLeft.x, bottomRight.x);
            const y = Math.min(topLeft.y, bottomRight.y);
            const fill = colorForLuxMode(lux, maxLux, mode);
            const opacity = mode === 'waves' ? 0.88 : 0.80;
            return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cellW.toFixed(1)}" height="${cellH.toFixed(1)}" fill="${fill}" fill-opacity="${opacity}" />`;
        }).join('');
        
        return `<g id="isolux-${ambient.id}">
            <g class="cells">${cells}</g>
            ${mode === 'waves' ? `<g class="contours">${contourMarkup}</g>` : ''}
        </g>`;
    }).join('');

    const roomsMarkup = snapshot.rooms.map((room) => {
        const isCorridor = room.roomType === 'corridor';
        return renderPolyline(room.vertices, transform, {
            stroke: isCorridor ? '#7c3aed' : '#e91e8c',
            strokeWidth: 2.0,
            fill: 'none',
            closed: true,
        });
    }).join('');

    const roomLabelsMarkup = snapshot.rooms.map((room) => {
        let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
        room.vertices.forEach(v => {
            minX = Math.min(minX, v.x);
            minY = Math.min(minY, v.y);
            maxX = Math.max(maxX, v.x);
            maxY = Math.max(maxY, v.y);
        });
        const center = transformPoint(transform, { x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
        const isCorridor = room.roomType === 'corridor';
        return `<text x="${center.x.toFixed(2)}" y="${center.y.toFixed(2)}" fill="${isCorridor ? '#5b21b6' : '#9d174d'}" font-size="11" font-family="sans-serif" font-weight="700" text-anchor="middle" dominant-baseline="middle">${escapeXml(room.name)}</text>`;
    }).join('');

    const wallsMarkup = snapshot.walls.map((wall) =>
        renderPolyline(wall.vertices, transform, {
            stroke: '#1e293b',
            strokeWidth: 1.2,
            fill: 'none',
            closed: false,
        }),
    ).join('');

    const oneMeterPx = transform.scale;
    const barLenPx = Math.min(oneMeterPx * 5, 160);
    const barMeters = Number((barLenPx / oneMeterPx).toFixed(1));
    const scaleBarMarkup = renderScaleBar({
        x: MARGIN + 8,
        y: H - MARGIN - 14,
        barLengthPx: barLenPx,
        labelMeters: barMeters,
        barHeight: 5,
        strokeWidth: 1,
        fillOpacity: 0.5,
        fontSize: 9,
        labelYOffset: 6,
    });
    const northArrow = renderNorthArrow({
        x: W - MARGIN - 24,
        y: MARGIN + 52,
    });
    // Leyenda de color: antes ausente en este plano pese a mostrar la misma
    // grilla de colores que el isolux por ambiente (gap de Fase 3).
    const legendMarkup = validResults.length > 0
        ? buildIsoluxColorLegend(terrainMinLux, terrainMaxLux, mode, W, H)
        : '';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
        <rect width="${W}" height="${H}" fill="#ffffff"/>
        ${cadBgLayer}
        <g id="isolux-layer">${isoluxMarkup}</g>
        <g id="rooms-layer">${roomsMarkup}</g>
        <g id="walls-layer">${wallsMarkup}</g>
        <g id="room-labels-layer">${roomLabelsMarkup}</g>
        ${scaleBarMarkup}
        ${northArrow}
        ${legendMarkup}
    </svg>`;

    return {
        id: 'terrain-with-isolux-svg',
        title: 'Plano con Isolux',
        purpose: 'cad-overview',
        kind: 'vector',
        mimeType: 'image/svg+xml',
        svg,
        width: W,
        height: H,
    };
}
