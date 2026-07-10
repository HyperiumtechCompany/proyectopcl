import type { DialuxAmbientExport, DialuxExportSnapshot, DialuxVectorAsset } from '../../domain/types';
import { createBoundsFromVertices, createTransform, transformPoint } from '../geometry/transforms';
import { renderDxfEntity } from './renderDxfEntity';
import { escapeXml, renderPolyline, renderFixtureSymbol } from '../geometry/renderPrimitives';
import { buildContourSegments } from '@/pages/dialux/hooks/isoluxContours';

export function buildAmbientPlanSvgAsset(
    ambient: DialuxAmbientExport,
    snapshot: DialuxExportSnapshot
): DialuxVectorAsset {
    const roomBounds = createBoundsFromVertices(ambient.room.vertices) ?? {
        minX: 0,
        minY: 0,
        maxX: 10,
        maxY: 10,
    };

    // Expand bounds slightly for context padding
    const paddingBounds = Math.max((roomBounds.maxX - roomBounds.minX), (roomBounds.maxY - roomBounds.minY)) * 0.15;
    const bounds = {
        minX: roomBounds.minX - paddingBounds,
        minY: roomBounds.minY - paddingBounds,
        maxX: roomBounds.maxX + paddingBounds,
        maxY: roomBounds.maxY + paddingBounds,
    };

    // Dynamically adjust SVG aspect ratio to fit the ambient bounds
    const boundsWidth = Math.max(1, bounds.maxX - bounds.minX);
    const boundsHeight = Math.max(1, bounds.maxY - bounds.minY);
    const ratio = boundsWidth / boundsHeight;

    let width = 1200;
    let height = 780;

    if (ratio < 0.8) {
        width = 800;
        height = 1131;
    } else if (ratio >= 0.8 && ratio <= 1.2) {
        width = 900;
        height = 900;
    }

    const padding = Math.max(48, Math.min(width, height) * 0.08);
    const transform = createTransform(bounds, width, height, padding);

    // DXF base layer (light gray, thin) for architectural context
    const dxfMarkup = snapshot.dxfEntities
        .map((entity) => renderDxfEntity(entity, transform, snapshot.scaleConfig))
        .join('');

    const dxfAmbientLayer = dxfMarkup
        ? `<g id="dxf-base" opacity="0.88">${dxfMarkup}</g>`
        : '';
    const cadBgLayer = dxfAmbientLayer;

    // Context walls (structural only — no doors/windows)
    const contextWallsMarkup = snapshot.walls
        .map((wall) =>
            renderPolyline(wall.vertices, transform, {
                stroke: '#334155',
                strokeWidth: 1.2,
                fill: 'none',
                closed: false,
            }),
        )
        .join('');

    const roomPath = renderPolyline(ambient.room.vertices, transform, {
        stroke: '#0d9488',
        strokeWidth: 2.0,
        fill: '#ccfbf1',
        fillOpacity: 0.25,
        closed: true,
    });

    const fixtureMarkup = ambient.fixtures
        .map((fixture) => renderFixtureSymbol(transformPoint(transform, fixture), fixture, {
            scale: 0.75,
            accent: '#b45309',
            fill: '#f59e0b',
            fillOpacity: 0.22,
            label: true,
        }))
        .join('');

    // Scale bar
    const oneMeterPx = transform.scale;
    const targetPx = 140; 
    const targetMeters = targetPx / oneMeterPx;
    const steps = [0.5, 1, 2, 5, 10];
    let barMeters = 0.5;
    for (const step of steps) {
        if (targetMeters >= step) barMeters = step;
        else break;
    }
    const barLenPx = barMeters * oneMeterPx;
    const barX = 48;
    const barY = height - 28;
    const scaleBarMarkup = `
        <rect x="${barX}" y="${barY - 6}" width="${barLenPx.toFixed(1)}" height="6" fill="none" stroke="#334155" stroke-width="1.2"/>
        <rect x="${barX}" y="${barY - 6}" width="${(barLenPx / 2).toFixed(1)}" height="6" fill="#334155" fill-opacity="0.55"/>
        <text x="${barX}" y="${barY + 8}" fill="#334155" font-size="10" font-family="sans-serif">0</text>
        <text x="${(barX + barLenPx / 2).toFixed(1)}" y="${barY + 8}" fill="#334155" font-size="10" font-family="sans-serif" text-anchor="middle">${(Number(barMeters) / 2).toFixed(1)}</text>
        <text x="${(barX + barLenPx).toFixed(1)}" y="${barY + 8}" fill="#334155" font-size="10" font-family="sans-serif" text-anchor="end">${barMeters} m</text>`;

    const areaText = ambient.metrics?.area != null
        ? `Área: ${ambient.metrics.area.toFixed(2)} m²`
        : '';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="${width}" height="${height}" fill="#ffffff" />
        ${cadBgLayer}
        <g id="context-walls">${contextWallsMarkup}</g>
        <g id="room-fill">${roomPath}</g>
        <g id="fixtures">${fixtureMarkup}</g>
        ${scaleBarMarkup}
        <rect x="0" y="0" width="${width}" height="48" fill="#ffffff" fill-opacity="0.92" />
        <text x="56" y="28" fill="#0f172a" font-size="20" font-family="system-ui" font-weight="700">${escapeXml(ambient.name)}</text>
        <text x="56" y="43" fill="#64748b" font-size="11" font-family="system-ui">Recinto: ${escapeXml(ambient.roomName)}${areaText ? ' · ' + escapeXml(areaText) : ''} · Plano de luminarias</text>
    </svg>`;

    return {
        id: `ambient-plan-svg-${ambient.id}`,
        title: `Vista 2D - ${ambient.name}`,
        purpose: 'ambient-plan',
        kind: 'vector',
        mimeType: 'image/svg+xml',
        svg,
        width,
        height,
    };
}

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

function buildIsoluxColorLegend(
    minLux: number,
    maxLux: number,
    mode: DialuxExportSnapshot['visualConfig']['isoluxMode'],
    svgWidth: number,
    svgHeight: number,
): string {
    const steps = 12;
    const legendWidth = Math.min(280, svgWidth * 0.35);
    const legendHeight = 10;
    const legendX = (svgWidth - legendWidth) / 2;
    const legendY = svgHeight - 28;
    const stepW = legendWidth / steps;

    let cells = '';
    for (let i = 0; i < steps; i++) {
        const ratio = i / (steps - 1);
        const lux = minLux + ratio * (maxLux - minLux);
        const fill = mode === 'temperature'
            ? colorForTemperatureLux(lux, maxLux)
            : mode === 'waves'
                ? waveBackdropColor(lux, maxLux)
                : colorForFunctionalLux(lux, maxLux);
        cells += `<rect x="${(legendX + i * stepW).toFixed(1)}" y="${legendY}" width="${stepW.toFixed(1)}" height="${legendHeight}" fill="${fill}" fill-opacity="0.85" />`;
    }

    const minLabel = minLux.toFixed(0);
    const midLabel = ((minLux + maxLux) / 2).toFixed(0);
    const maxLabel = maxLux.toFixed(0);

    return `<g id="color-legend">
        <rect x="${(legendX - 2).toFixed(1)}" y="${(legendY - 2)}" width="${(legendWidth + 4).toFixed(1)}" height="${legendHeight + 4}" fill="none" stroke="#94a3b8" stroke-width="0.6" rx="1"/>
        ${cells}
        <text x="${legendX.toFixed(1)}" y="${(legendY + legendHeight + 9)}" fill="#475569" font-size="8" font-family="sans-serif" text-anchor="middle">${minLabel} lx</text>
        <text x="${(legendX + legendWidth / 2).toFixed(1)}" y="${(legendY + legendHeight + 9)}" fill="#475569" font-size="8" font-family="sans-serif" text-anchor="middle">${midLabel} lx</text>
        <text x="${(legendX + legendWidth).toFixed(1)}" y="${(legendY + legendHeight + 9)}" fill="#475569" font-size="8" font-family="sans-serif" text-anchor="middle">${maxLabel} lx</text>
    </g>`;
}

export function buildAmbientIsoluxSvgAsset(
    ambient: DialuxAmbientExport,
    snapshot: DialuxExportSnapshot,
): DialuxVectorAsset {
    const result = ambient.result!;
    const roomVertices = result.room_vertices ?? ambient.room.vertices;
    const bounds = createBoundsFromVertices(roomVertices)!;
    const boundsMargin = Math.max((bounds.maxX - bounds.minX) * 0.08, (bounds.maxY - bounds.minY) * 0.08, 0.3);
    const expandedBounds = {
        minX: bounds.minX - boundsMargin,
        minY: bounds.minY - boundsMargin,
        maxX: bounds.maxX + boundsMargin,
        maxY: bounds.maxY + boundsMargin,
    };
    const LEGEND_RESERVE = 42;

    const boundsWidth = Math.max(1, expandedBounds.maxX - expandedBounds.minX);
    const boundsHeight = Math.max(1, expandedBounds.maxY - expandedBounds.minY);
    const ratio = boundsWidth / boundsHeight;

    let width = 1200;
    let height = 780;

    if (ratio < 0.8) {
        width = 800;
        height = 1131;
    } else if (ratio >= 0.8 && ratio <= 1.2) {
        width = 900;
        height = 900;
    }

    const padding = Math.max(48, Math.min(width, height) * 0.08);
    const transform = createTransform(expandedBounds, width, height - LEGEND_RESERVE, padding);
    const mode = snapshot.visualConfig.isoluxMode ?? 'waves';
    
    const validValues = result.grid_values.filter((v): v is number => v !== null);
    const computedMin = validValues.length > 0 ? Math.min(...validValues) : 0;
    const maxLux = Math.max(result.max_lux, 1);
    const minLux = Math.max(0, computedMin);

    const gridOriginX = result.grid_origin_x!;
    const gridOriginY = result.grid_origin_y!;
    const gridCellWidth = result.grid_cell_width!;
    const gridCellHeight = result.grid_cell_height!;

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
                          x: gridOriginX + col * gridCellWidth + gridCellWidth / 2,
                          y: gridOriginY + row * gridCellHeight + gridCellHeight / 2,
                      }),
              })
            : [];

    const cellMarkup = result.grid_values
        .map((lux, index) => {
            if (lux === null) return '';
            const col = index % result.grid_cols;
            const row = Math.floor(index / result.grid_cols);
            const topLeft = transformPoint(transform, {
                x: gridOriginX + col * gridCellWidth,
                y: gridOriginY + row * gridCellHeight,
            });
            const bottomRight = transformPoint(transform, {
                x: gridOriginX + (col + 1) * gridCellWidth,
                y: gridOriginY + (row + 1) * gridCellHeight,
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
            const opacity = mode === 'waves' ? 0.88 : 0.92;

            const showLabel = cellW >= 22 && cellH >= 14;
            const label = showLabel
                ? `<text x="${(x + cellW / 2).toFixed(1)}" y="${(y + cellH / 2).toFixed(1)}" fill="#1e293b" font-size="${Math.min(9, cellW * 0.38).toFixed(1)}" font-family="monospace" text-anchor="middle" dominant-baseline="middle" font-weight="600">${lux.toFixed(0)}</text>`
                : '';

            return `<g>
                <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cellW.toFixed(1)}" height="${cellH.toFixed(1)}" fill="${fill}" fill-opacity="${opacity}" stroke="none" />
                ${label}
            </g>`;
        })
        .join('');

    const contourMarkup = contourSegments
        .map((segment) =>
            `<line x1="${segment.start.x.toFixed(1)}" y1="${segment.start.y.toFixed(1)}" x2="${segment.end.x.toFixed(1)}" y2="${segment.end.y.toFixed(1)}" stroke="${waveStrokeColor(segment.level, maxLux)}" stroke-width="${segment.levelIndex % 2 === 0 ? 2.8 : 1.6}" stroke-linecap="round" />`,
        )
        .join('');

    const dxfContextMarkup = snapshot && snapshot.dxfEntities.length > 0
        ? `<g id="dxf-context" opacity="0.18">${
            snapshot.dxfEntities
                .map((entity) => renderDxfEntity(entity, transform, snapshot.scaleConfig))
                .join('')
          }</g>`
        : '';

    const wallsContextMarkup = snapshot && snapshot.walls.length > 0
        ? `<g id="walls-context" opacity="0.4">${
            snapshot.walls
                .map((wall) => renderPolyline(wall.vertices, transform, {
                    stroke: '#334155',
                    strokeWidth: 1.0,
                    fill: 'none',
                    closed: false,
                }))
                .join('')
          }</g>`
        : '';

    const roomPath = renderPolyline(roomVertices, transform, {
        stroke: '#0f172a',
        strokeWidth: 2.2,
        fill: 'none',
        closed: true,
    });

    const fixturesMarkup = ambient.fixtures
        .map((fixture) =>
            renderFixtureSymbol(transformPoint(transform, fixture), fixture, {
                scale: 0.72,
                accent: '#1d4ed8',
                fill: '#3b82f6',
                fillOpacity: 0.22,
            }),
        )
        .join('');

    const areaText = ambient.metrics?.area != null ? ` · Área: ${ambient.metrics.area.toFixed(2)} m²` : '';
    const avgLuxText = ambient.metrics?.avgLux != null ? ` · Em: ${ambient.metrics.avgLux.toFixed(0)} lx` : '';
    const legendMarkup = buildIsoluxColorLegend(minLux, maxLux, mode, width, height);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
        <rect width="${width}" height="${height}" fill="#ffffff" />
        ${dxfContextMarkup}
        ${wallsContextMarkup}
        <g id="heatmap">${cellMarkup}</g>
        ${mode === 'waves' ? `<g id="contours">${contourMarkup}</g>` : ''}
        <g id="room-outline">${roomPath}</g>
        <g id="fixtures">${fixturesMarkup}</g>
        ${legendMarkup}
        <rect x="0" y="0" width="${width}" height="36" fill="#ffffff" fill-opacity="0.92" />
        <text x="14" y="16" fill="#0f172a" font-size="13" font-family="sans-serif" font-weight="700">${escapeXml(ambient.name)}</text>
        <text x="14" y="29" fill="#64748b" font-size="9" font-family="sans-serif">Plano útil — Isolux (lx)${escapeXml(areaText + avgLuxText)}</text>
    </svg>`;

    return {
        id: `isolux-svg-${ambient.id}`,
        title: `Isolux - ${ambient.name}`,
        purpose: 'isolux',
        kind: 'vector',
        mimeType: 'image/svg+xml',
        svg,
        width,
        height,
    };
}
