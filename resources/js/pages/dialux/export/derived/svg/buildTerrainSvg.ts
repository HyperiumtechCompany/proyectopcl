import type { DialuxExportSnapshot, DialuxVectorAsset, DialuxBitmapAsset } from '../../domain/types';
import { buildSceneBounds, createTransform, transformPoint } from '../geometry/transforms';
import { renderDxfEntity } from './renderDxfEntity';
import { escapeXml, renderPolyline, renderCadBitmapFill } from '../geometry/renderPrimitives';
import { buildContourSegments } from '@/pages/dialux/hooks/isoluxContours';

function hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number): string => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function colorForFunctionalLux(lux: number, maxLux: number): string {
    const ratio = Math.min(1, Math.max(0, lux / Math.max(maxLux, 1)));
    const hue = 240 - ratio * 200;
    return hslToHex(hue, 92, 62 - ratio * 28);
}

function colorForTemperatureLux(lux: number, maxLux: number): string {
    const ratio = Math.min(1, Math.max(0, lux / Math.max(maxLux, 1)));
    const hue = 250 - ratio * 220;
    return hslToHex(hue, 92, 58 - ratio * 22);
}

function waveStrokeColor(level: number, maxLux: number): string {
    const ratio = Math.min(1, Math.max(0, level / Math.max(maxLux, 1)));
    const hue = 220 - ratio * 160;
    return hslToHex(hue, 90, 28 - ratio * 8);
}

function waveBackdropColor(lux: number, maxLux: number): string {
    const ratio = Math.min(1, Math.max(0, lux / Math.max(maxLux, 1)));
    const hue = 230 - ratio * 185;
    return hslToHex(hue, 92, 58 - ratio * 28);
}

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

    const fixturesMarkup = snapshot.fixtures
        .map((fixture) => {
            const p = transformPoint(transform, fixture);
            const r = Math.max(5, Math.min(12, transform.scale * 0.12));
            return `<g>
                <circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${(r * 2).toFixed(2)}" fill="#3b82f6" fill-opacity="0.10"/>
                <circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${r.toFixed(2)}" fill="#3b82f6" stroke="#1d4ed8" stroke-width="1"/>
                <line x1="${(p.x - r * 0.7).toFixed(2)}" y1="${p.y.toFixed(2)}" x2="${(p.x + r * 0.7).toFixed(2)}" y2="${p.y.toFixed(2)}" stroke="#ffffff" stroke-width="1.5"/>
                <line x1="${p.x.toFixed(2)}" y1="${(p.y - r * 0.7).toFixed(2)}" x2="${p.x.toFixed(2)}" y2="${(p.y + r * 0.7).toFixed(2)}" stroke="#ffffff" stroke-width="1.5"/>
            </g>`;
        })
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
    const barMeters = (barLenPx / oneMeterPx).toFixed(1);
    const barX = MARGIN + 8;
    const barY = H - MARGIN - 14;
    const scaleBarMarkup = `
        <rect x="${barX}" y="${barY - 6}" width="${barLenPx.toFixed(1)}" height="5" fill="none" stroke="#334155" stroke-width="1"/>
        <rect x="${barX}" y="${barY - 6}" width="${(barLenPx / 2).toFixed(1)}" height="5" fill="#334155" fill-opacity="0.5"/>
        <text x="${barX}" y="${barY + 6}" fill="#334155" font-size="9" font-family="sans-serif">0</text>
        <text x="${(barX + barLenPx / 2).toFixed(1)}" y="${barY + 6}" fill="#334155" font-size="9" font-family="sans-serif" text-anchor="middle">${(Number(barMeters) / 2).toFixed(1)}</text>
        <text x="${(barX + barLenPx).toFixed(1)}" y="${barY + 6}" fill="#334155" font-size="9" font-family="sans-serif" text-anchor="end">${barMeters} m</text>`;

    const naX = W - MARGIN - 24;
    const naY = MARGIN + 52;
    const northArrow = `
        <g transform="translate(${naX},${naY})">
            <polygon points="0,-20 5,0 0,-4 -5,0" fill="#1e293b"/>
            <polygon points="0,-4 5,0 0,20 -5,0" fill="#94a3b8"/>
            <text x="0" y="36" fill="#1e293b" font-size="11" font-family="sans-serif" font-weight="700" text-anchor="middle">N</text>
        </g>`;

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
            const fill = mode === 'temperature'
                ? colorForTemperatureLux(lux, maxLux)
                : mode === 'waves'
                    ? waveBackdropColor(lux, maxLux)
                    : colorForFunctionalLux(lux, maxLux);
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
    const barMeters = (barLenPx / oneMeterPx).toFixed(1);
    const barX = MARGIN + 8;
    const barY = H - MARGIN - 14;
    const scaleBarMarkup = `
        <rect x="${barX}" y="${barY - 6}" width="${barLenPx.toFixed(1)}" height="5" fill="none" stroke="#334155" stroke-width="1"/>
        <rect x="${barX}" y="${barY - 6}" width="${(barLenPx / 2).toFixed(1)}" height="5" fill="#334155" fill-opacity="0.5"/>
        <text x="${barX}" y="${barY + 6}" fill="#334155" font-size="9" font-family="sans-serif">0</text>
        <text x="${(barX + barLenPx / 2).toFixed(1)}" y="${barY + 6}" fill="#334155" font-size="9" font-family="sans-serif" text-anchor="middle">${(Number(barMeters) / 2).toFixed(1)}</text>
        <text x="${(barX + barLenPx).toFixed(1)}" y="${barY + 6}" fill="#334155" font-size="9" font-family="sans-serif" text-anchor="end">${barMeters} m</text>`;

    const naX = W - MARGIN - 24;
    const naY = MARGIN + 52;
    const northArrow = `
        <g transform="translate(${naX},${naY})">
            <polygon points="0,-20 5,0 0,-4 -5,0" fill="#1e293b"/>
            <polygon points="0,-4 5,0 0,20 -5,0" fill="#94a3b8"/>
            <text x="0" y="36" fill="#1e293b" font-size="11" font-family="sans-serif" font-weight="700" text-anchor="middle">N</text>
        </g>`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
        <rect width="${W}" height="${H}" fill="#ffffff"/>
        ${cadBgLayer}
        <g id="isolux-layer">${isoluxMarkup}</g>
        <g id="rooms-layer">${roomsMarkup}</g>
        <g id="walls-layer">${wallsMarkup}</g>
        <g id="room-labels-layer">${roomLabelsMarkup}</g>
        ${scaleBarMarkup}
        ${northArrow}
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
