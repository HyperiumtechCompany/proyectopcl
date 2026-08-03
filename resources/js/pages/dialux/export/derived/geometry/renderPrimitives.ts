import type { DialuxAmbientExport } from '../../domain/types';
import type { Transform } from './transforms';
import { transformPoint } from './transforms';
import type { IsoluxMode, Vertex } from '@/pages/dialux/hooks/useEditorStore';
import { colorForLuxMode } from './luxColor';

export function escapeXml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

export function renderPolyline(
    vertices: Vertex[],
    transform: Transform,
    options: {
        stroke: string;
        strokeWidth: number;
        fill?: string;
        fillOpacity?: number;
        closed?: boolean;
    },
): string {
    if (vertices.length === 0) {
        return '';
    }

    const points = vertices
        .map((vertex) => {
            const point = transformPoint(transform, vertex);
            return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
        })
        .join(' ');

    if (options.closed ?? vertices.length > 2) {
        return `<polygon points="${points}" fill="${options.fill ?? 'none'}" fill-opacity="${options.fillOpacity ?? 1}" stroke="${options.stroke}" stroke-width="${options.strokeWidth}" />`;
    }

    return `<polyline points="${points}" fill="none" stroke="${options.stroke}" stroke-width="${options.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />`;
}

export function renderFixtureSymbol(
    point: { x: number; y: number },
    fixture: DialuxAmbientExport['fixtures'][number],
    options: {
        scale?: number;
        accent?: string;
        fill?: string;
        fillOpacity?: number;
        label?: boolean;
    } = {},
): string {
    const scale = options.scale ?? 1;
    const accent = options.accent ?? '#fbbf24';
    const fill = options.fill ?? '#fbbf24';
    const fillOpacity = (options.fillOpacity ?? 0.22).toFixed(2);
    const shape = fixture.fixtureShape ?? 'round';
    const radius = 11 * scale;
    const width = shape === 'rectangular' ? 28 * scale : 22 * scale;
    const rxCylindrical = 8 * scale;
    const ryCylindrical = 14 * scale;
    let body = '';

    if (shape === 'square' || shape === 'rectangular') {
        body = `<rect x="${(point.x - width / 2).toFixed(2)}" y="${(
            point.y - 7 * scale
        ).toFixed(2)}" width="${width.toFixed(2)}" height="${(14 * scale).toFixed(2)}" rx="${(
            shape === 'rectangular' ? 4 : 2
        ).toFixed(2)}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${accent}" stroke-width="${(
            1.5 * scale
        ).toFixed(2)}" />`;
    } else if (shape === 'cylindrical') {
        body = `<ellipse cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" rx="${rxCylindrical.toFixed(2)}" ry="${ryCylindrical.toFixed(2)}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${accent}" stroke-width="${(
            1.5 * scale
        ).toFixed(2)}" />`;
    } else {
        body = `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="${radius.toFixed(2)}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${accent}" stroke-width="${(
            1.5 * scale
        ).toFixed(2)}" />`;
    }

    const beam =
        fixture.fixtureType === 'spot' || fixture.fixtureType === 'pendant'
            ? `<path d="M ${point.x.toFixed(2)} ${(point.y + 5 * scale).toFixed(2)} L ${(point.x - 8 * scale).toFixed(2)} ${(point.y + 18 * scale).toFixed(2)} L ${(point.x + 8 * scale).toFixed(2)} ${(point.y + 18 * scale).toFixed(2)} Z" fill="#fde047" fill-opacity="0.16" stroke="${accent}" stroke-opacity="0.55" stroke-width="${(
                  1 * scale
              ).toFixed(2)}" />`
            : '';
    const label = options.label
        ? `<text x="${point.x.toFixed(2)}" y="${(point.y - 16 * scale).toFixed(2)}" fill="#0f172a" font-size="${(
              10 * scale
          ).toFixed(2)}" font-family="system-ui" text-anchor="middle">${escapeXml(
              fixture.fixtureType,
          )}</text>`
        : '';

    return `<g>${beam}${body}${label}</g>`;
}

export function renderArcPath(
    transform: Transform,
    cx: number,
    cy: number,
    r: number,
    startAngleDeg: number,
    endAngleDeg: number,
    dxfScale = 1,
): string {
    const startRad = (startAngleDeg * Math.PI) / 180;
    const endRad = (endAngleDeg * Math.PI) / 180;

    const dxfToMeters = (x: number, y: number) => ({ x: x * dxfScale, y: y * dxfScale });

    const startWorld = dxfToMeters(cx + r * Math.cos(startRad), cy + r * Math.sin(startRad));
    const endWorld = dxfToMeters(cx + r * Math.cos(endRad), cy + r * Math.sin(endRad));

    const start = transformPoint(transform, startWorld);
    const end = transformPoint(transform, endWorld);
    const rx = Math.max(1, r * dxfScale * transform.scale);

    let sweep = endAngleDeg - startAngleDeg;
    if (sweep < 0) { sweep += 360; }
    const largeArc = sweep > 180 ? 1 : 0;

    return `<path d="M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${rx.toFixed(2)} ${rx.toFixed(2)} 0 ${largeArc} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}" fill="none" stroke="#1e293b" stroke-width="1.5" />`;
}

export function renderCadBitmapFill(
    asset: { dataUrl?: string; width?: number; height?: number } | null,
    transform: Transform
): string {
    if (!asset || !asset.dataUrl) return '';
    // SVG image spanning the exact document bounds to act as the base layer
    return `<image href="${asset.dataUrl}" x="0" y="0" width="${transform.width}" height="${transform.height}" opacity="1" preserveAspectRatio="none" />`;
}

/**
 * Barra de escala gráfica (bicolor + 3 etiquetas: 0, mitad, total). El
 * llamador decide cuántos metros representa la barra (distintos builders
 * usan distintos algoritmos de redondeo); esta función solo dibuja el
 * marcado dado ya un largo en píxeles y su etiqueta en metros.
 */
export function renderScaleBar(options: {
    x: number;
    y: number;
    barLengthPx: number;
    labelMeters: number;
    barHeight?: number;
    strokeWidth?: number;
    fillOpacity?: number;
    fontSize?: number;
    labelYOffset?: number;
    color?: string;
}): string {
    const barHeight = options.barHeight ?? 6;
    const strokeWidth = options.strokeWidth ?? 1.2;
    const fillOpacity = options.fillOpacity ?? 0.55;
    const fontSize = options.fontSize ?? 10;
    const labelYOffset = options.labelYOffset ?? 8;
    const color = options.color ?? '#334155';
    const { x, y, barLengthPx, labelMeters } = options;
    const barY = y - barHeight;
    const textY = (y + labelYOffset).toFixed(1);

    return `
        <rect x="${x}" y="${barY.toFixed(1)}" width="${barLengthPx.toFixed(1)}" height="${barHeight}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"/>
        <rect x="${x}" y="${barY.toFixed(1)}" width="${(barLengthPx / 2).toFixed(1)}" height="${barHeight}" fill="${color}" fill-opacity="${fillOpacity}"/>
        <text x="${x}" y="${textY}" fill="${color}" font-size="${fontSize}" font-family="sans-serif">0</text>
        <text x="${(x + barLengthPx / 2).toFixed(1)}" y="${textY}" fill="${color}" font-size="${fontSize}" font-family="sans-serif" text-anchor="middle">${(labelMeters / 2).toFixed(1)}</text>
        <text x="${(x + barLengthPx).toFixed(1)}" y="${textY}" fill="${color}" font-size="${fontSize}" font-family="sans-serif" text-anchor="end">${labelMeters} m</text>`;
}

/** Flecha norte estándar de los planos técnicos (CAD/terreno). */
export function renderNorthArrow(options: { x: number; y: number }): string {
    return `
        <g transform="translate(${options.x},${options.y})">
            <polygon points="0,-20 5,0 0,-4 -5,0" fill="#1e293b"/>
            <polygon points="0,-4 5,0 0,20 -5,0" fill="#94a3b8"/>
            <text x="0" y="36" fill="#1e293b" font-size="11" font-family="sans-serif" font-weight="700" text-anchor="middle">N</text>
        </g>`;
}

/**
 * Tamaño de página SVG (retrato / cuadrado / apaisado) según la relación de
 * aspecto del contenido a dibujar. Compartido por los builders que ya usaban
 * exactamente estos 3 tramos (800×1131 / 900×900 / 1200×780).
 */
export function pickSvgPageDimensions(ratio: number): {
    width: number;
    height: number;
} {
    if (ratio < 0.8) {
        return { width: 800, height: 1131 };
    }
    if (ratio <= 1.2) {
        return { width: 900, height: 900 };
    }
    return { width: 1200, height: 780 };
}

/** Leyenda de color para planos de isolux: qué valor de lux representa cada tono. */
export function buildIsoluxColorLegend(
    minLux: number,
    maxLux: number,
    mode: IsoluxMode,
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
        const fill = colorForLuxMode(lux, maxLux, mode);
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
