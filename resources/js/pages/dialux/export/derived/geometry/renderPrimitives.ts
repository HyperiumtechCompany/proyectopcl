import type { DialuxAmbientExport } from '../../domain/types';
import type { Transform } from './transforms';
import { transformPoint } from './transforms';
import type { Vertex } from '@/pages/dialux/hooks/useEditorStore';

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
