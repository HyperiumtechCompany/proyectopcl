import axios from 'axios';
import * as productRoutes from '@/routes/dialux/products';
import { buildContourSegments } from '@/hooks/dialux/isoluxContours';
import type { DxfEntity, Vertex } from '@/hooks/dialux/useEditorStore';
import { captureCompositeViewerBitmap } from '../assets/captureCompositeViewerBitmap';
import { captureCadBaseBitmap } from '../assets/captureCadBaseBitmap';
import { capture3DViewerBitmap } from '../assets/capture3DViewerBitmap';
import type {
    DialuxAmbientExport,
    DialuxAssetPurpose,
    DialuxBitmapAsset,
    DialuxExportAsset,
    DialuxExportSnapshot,
    DialuxStructuredJsonData,
    DialuxStructuredSummaryData,
    DialuxStructuredTableData,
    DialuxVectorAsset,
} from '../domain/types';

const SVG_WIDTH = 1200;
const SVG_HEIGHT = 780;
const SVG_PADDING = 48;

interface Bounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

interface Transform {
    scale: number;
    padX: number;
    padY: number;
    bounds: Bounds;
    width: number;
    height: number;
}

export interface BuildDialuxExportAssetsOptions {
    includeViewerCapture?: boolean;
    /**
     * A pre-captured CAD bitmap obtained BEFORE entering the async export
     * pipeline (i.e., within a requestAnimationFrame callback, where WebGL
     * pixel data is still available). When provided, skips the internal
     * captureCadBaseBitmap() call entirely.
     */
    preCapturedCadBitmap?: import('../domain/types').DialuxBitmapAsset | null;
}

function escapeXml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function createBoundsFromVertices(vertices: Vertex[]): Bounds | null {
    if (vertices.length === 0) {
        return null;
    }

    return vertices.reduce<Bounds>(
        (accumulator, vertex) => ({
            minX: Math.min(accumulator.minX, vertex.x),
            minY: Math.min(accumulator.minY, vertex.y),
            maxX: Math.max(accumulator.maxX, vertex.x),
            maxY: Math.max(accumulator.maxY, vertex.y),
        }),
        {
            minX: Number.POSITIVE_INFINITY,
            minY: Number.POSITIVE_INFINITY,
            maxX: Number.NEGATIVE_INFINITY,
            maxY: Number.NEGATIVE_INFINITY,
        },
    );
}

function expandBounds(bounds: Bounds, x: number, y: number): Bounds {
    return {
        minX: Math.min(bounds.minX, x),
        minY: Math.min(bounds.minY, y),
        maxX: Math.max(bounds.maxX, x),
        maxY: Math.max(bounds.maxY, y),
    };
}

function mergeBounds(
    left: Bounds | null,
    right: Bounds | null,
): Bounds | null {
    if (!left) return right;
    if (!right) return left;
    return {
        minX: Math.min(left.minX, right.minX),
        minY: Math.min(left.minY, right.minY),
        maxX: Math.max(left.maxX, right.maxX),
        maxY: Math.max(left.maxY, right.maxY),
    };
}



function buildSceneBounds(
    snapshot: DialuxExportSnapshot,
    dxfScale?: number,
    includeDxfExtents = false,
): Bounds {
    // Convert dxfExtents from raw CAD units (mm/cm) to meters using the same
    // scale factor applied when rendering each DXF entity. Without this, the
    // bounds are orders of magnitude larger than the room/wall coords (in meters),
    // making the SVG viewBox huge and all content invisible.
    const scale = dxfScale ?? (snapshot.scaleConfig.factor * (snapshot.scaleConfig.calibrationFactor ?? 1));

    // Ignore DXF extents if we have actual drawn rooms/walls, 
    // to prevent huge bounding boxes and ensure the drawing fills the page.
    const hasDrawnElements = snapshot.rooms.length > 0 || snapshot.walls.length > 0;
    
    let bounds: Bounds | null = (snapshot.dxfExtents && (!hasDrawnElements || includeDxfExtents))
        ? {
              minX: snapshot.dxfExtents.min_x * scale,
              minY: snapshot.dxfExtents.min_y * scale,
              maxX: snapshot.dxfExtents.max_x * scale,
              maxY: snapshot.dxfExtents.max_y * scale,
          }
        : null;

    for (const room of snapshot.rooms) {
        bounds = mergeBounds(bounds, createBoundsFromVertices(room.vertices));
    }

    for (const wall of snapshot.walls) {
        bounds = mergeBounds(bounds, createBoundsFromVertices(wall.vertices));
    }

    for (const canopy of snapshot.canopies) {
        bounds = bounds
            ? expandBounds(
                  expandBounds(bounds, canopy.x1, canopy.y1),
                  canopy.x2,
                  canopy.y2,
              )
            : {
                  minX: Math.min(canopy.x1, canopy.x2),
                  minY: Math.min(canopy.y1, canopy.y2),
                  maxX: Math.max(canopy.x1, canopy.x2),
                  maxY: Math.max(canopy.y1, canopy.y2),
              };
    }

    for (const fixture of snapshot.fixtures) {
        bounds = bounds
            ? expandBounds(bounds, fixture.x, fixture.y)
            : {
                  minX: fixture.x,
                  minY: fixture.y,
                  maxX: fixture.x,
                  maxY: fixture.y,
              };
    }

    return (
        bounds ?? {
            minX: 0,
            minY: 0,
            maxX: 10,
            maxY: 10,
        }
    );
}

function createTransform(
    bounds: Bounds,
    width: number,
    height: number,
    padding = SVG_PADDING,
): Transform {
    const safeWidth = Math.max(bounds.maxX - bounds.minX, 1);
    const safeHeight = Math.max(bounds.maxY - bounds.minY, 1);
    const drawableWidth = width - padding * 2;
    const drawableHeight = height - padding * 2;
    const scale = Math.min(
        drawableWidth / safeWidth,
        drawableHeight / safeHeight,
    );
    const contentWidth = safeWidth * scale;
    const contentHeight = safeHeight * scale;
    const padX = (width - contentWidth) / 2;
    const padY = (height - contentHeight) / 2;

    return { scale, padX, padY, bounds, width, height };
}

function transformPoint(
    transform: Transform,
    point: { x: number; y: number },
): { x: number; y: number } {
    return {
        x: transform.padX + (point.x - transform.bounds.minX) * transform.scale,
        y:
            transform.height -
            transform.padY -
            (point.y - transform.bounds.minY) * transform.scale,
    };
}

/**
 * Converts a raw DXF coordinate (in original DXF units, e.g. mm or cm)
 * to meters by applying the scene scale factor, so it aligns with
 * room/wall vertices which are already stored in meters.
 */
function dxfToMeters(
    rawX: number,
    rawY: number,
    dxfScale: number,
): { x: number; y: number } {
    return { x: rawX * dxfScale, y: rawY * dxfScale };
}

function renderPolyline(
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

function renderFixtureSymbol(
    point: { x: number; y: number },
    fixture: DialuxAmbientExport['fixtures'][number],
    options: {
        scale?: number;
        accent?: string;
        fill?: string;
        label?: boolean;
    } = {},
): string {
    const scale = options.scale ?? 1;
    const accent = options.accent ?? '#fbbf24';
    const fill = options.fill ?? 'rgba(251,191,36,0.22)';
    const shape = fixture.fixtureShape ?? 'round';
    const radius = 11 * scale;
    const width = shape === 'rectangular' ? 28 * scale : 22 * scale;
    const height = shape === 'cylindrical' ? 28 * scale : 22 * scale;
    let body = '';

    if (shape === 'square' || shape === 'rectangular') {
        body = `<rect x="${(point.x - width / 2).toFixed(2)}" y="${(
            point.y - 7 * scale
        ).toFixed(2)}" width="${width.toFixed(2)}" height="${(14 * scale).toFixed(2)}" rx="${(
            shape === 'rectangular' ? 4 : 2
        ).toFixed(2)}" fill="${fill}" stroke="${accent}" stroke-width="${(
            1.5 * scale
        ).toFixed(2)}" />`;
    } else if (shape === 'cylindrical') {
        body = `<ellipse cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" rx="${(
            8 * scale
        ).toFixed(2)}" ry="${(12 * scale).toFixed(2)}" fill="${fill}" stroke="${accent}" stroke-width="${(
            1.5 * scale
        ).toFixed(2)}" />`;
    } else {
        body = `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="${radius.toFixed(2)}" fill="${fill}" stroke="${accent}" stroke-width="${(
            1.5 * scale
        ).toFixed(2)}" />`;
    }

    const beam =
        fixture.fixtureType === 'spot' || fixture.fixtureType === 'pendant'
            ? `<path d="M ${point.x.toFixed(2)} ${(point.y + 5 * scale).toFixed(2)} L ${(point.x - 8 * scale).toFixed(2)} ${(point.y + 18 * scale).toFixed(2)} L ${(point.x + 8 * scale).toFixed(2)} ${(point.y + 18 * scale).toFixed(2)} Z" fill="rgba(253,224,71,0.16)" stroke="${accent}" stroke-opacity="0.55" stroke-width="${(
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

function pointAlongWall(
    vertices: Vertex[],
    offset: number,
): { start: Vertex; end: Vertex } | null {
    if (vertices.length < 2) {
        return null;
    }

    let remaining = offset;

    for (let index = 0; index < vertices.length - 1; index += 1) {
        const start = vertices[index];
        const end = vertices[index + 1];
        const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);

        if (segmentLength <= 0) {
            continue;
        }

        if (remaining <= segmentLength || index === vertices.length - 2) {
            const ratio = Math.max(0, Math.min(1, remaining / segmentLength));
            const point: Vertex = {
                x: start.x + (end.x - start.x) * ratio,
                y: start.y + (end.y - start.y) * ratio,
            };

            return { start: point, end };
        }

        remaining -= segmentLength;
    }

    return null;
}

function renderOpeningMarker(
    transform: Transform,
    wallVertices: Vertex[],
    offsetAlongWall: number,
    width: number,
    stroke: string,
): string {
    const openingOrigin = pointAlongWall(wallVertices, offsetAlongWall);
    if (!openingOrigin) {
        return '';
    }

    const axis =
        pointAlongWall(wallVertices, offsetAlongWall + width) ?? openingOrigin;
    const start = transformPoint(transform, openingOrigin.start);
    const end = transformPoint(transform, axis.start);

    return `<line x1="${start.x.toFixed(2)}" y1="${start.y.toFixed(2)}" x2="${end.x.toFixed(2)}" y2="${end.y.toFixed(2)}" stroke="${stroke}" stroke-width="4" stroke-linecap="round" />`;
}

function renderArcPath(
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

    const startWorld = dxfToMeters(cx + r * Math.cos(startRad), cy + r * Math.sin(startRad), dxfScale);
    const endWorld = dxfToMeters(cx + r * Math.cos(endRad), cy + r * Math.sin(endRad), dxfScale);

    const start = transformPoint(transform, startWorld);
    const end = transformPoint(transform, endWorld);
    const rx = Math.max(1, r * dxfScale * transform.scale);

    let sweep = endAngleDeg - startAngleDeg;
    if (sweep < 0) { sweep += 360; }
    const largeArc = sweep > 180 ? 1 : 0;

    return `<path d="M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${rx.toFixed(2)} ${rx.toFixed(2)} 0 ${largeArc} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}" fill="none" stroke="#334155" stroke-width="1" />`;
}

function renderDxfEntity(
    entity: DxfEntity,
    transform: Transform,
    scaleConfig: import('@/hooks/dialux/useEditorStore').ScaleConfig,
): string {
    // effective factor to convert DXF raw coords → meters
    const dxfScale = scaleConfig.factor * (scaleConfig.calibrationFactor ?? 1);

    switch (entity.type) {
        case 'line': {
            const start = transformPoint(transform, dxfToMeters(entity.x1, entity.y1, dxfScale));
            const end = transformPoint(transform, dxfToMeters(entity.x2, entity.y2, dxfScale));
            return `<line x1="${start.x.toFixed(2)}" y1="${start.y.toFixed(2)}" x2="${end.x.toFixed(2)}" y2="${end.y.toFixed(2)}" stroke="#1e293b" stroke-width="0.5" />`;
        }
        case 'polyline':
        case 'polygon':
        case 'solid': {
            const vertices = entity.vertices.map(([x, y]) => dxfToMeters(x, y, dxfScale));
            return renderPolyline(vertices, transform, {
                stroke: '#1e293b',
                strokeWidth: 0.5,
                fill: entity.type === 'solid' ? '#334155' : 'none',
                fillOpacity: entity.type === 'solid' ? 0.30 : 1,
                closed: 'closed' in entity ? entity.closed : true,
            });
        }
        case 'rectangle': {
            const { x, y, width: w, height: h } = entity;
            const origin = dxfToMeters(x, y, dxfScale);
            const vertices = [
                origin,
                dxfToMeters(x + w, y, dxfScale),
                dxfToMeters(x + w, y + h, dxfScale),
                dxfToMeters(x, y + h, dxfScale),
            ];
            return renderPolyline(vertices, transform, {
                stroke: '#1e293b',
                strokeWidth: 0.5,
                fill: 'none',
                closed: true,
            });
        }
        case 'circle': {
            const center = transformPoint(transform, dxfToMeters(entity.cx, entity.cy, dxfScale));
            return `<circle cx="${center.x.toFixed(2)}" cy="${center.y.toFixed(2)}" r="${Math.max(1, entity.r * dxfScale * transform.scale).toFixed(2)}" fill="none" stroke="#1e293b" stroke-width="0.5" />`;
        }
        case 'arc': {
            return renderArcPath(transform, entity.cx, entity.cy, entity.r, entity.start_angle, entity.end_angle, dxfScale);
        }
        case 'ellipse': {
            const center = transformPoint(transform, dxfToMeters(entity.cx, entity.cy, dxfScale));
            const majorLen = Math.sqrt(entity.major_x ** 2 + entity.major_y ** 2);
            const rx = Math.max(1, majorLen * dxfScale * transform.scale);
            const ry = Math.max(1, majorLen * entity.minor_ratio * dxfScale * transform.scale);
            const angleDeg = (Math.atan2(entity.major_y, entity.major_x) * 180) / Math.PI;
            return `<ellipse cx="${center.x.toFixed(2)}" cy="${center.y.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" fill="none" stroke="#1e293b" stroke-width="0.5" transform="rotate(${(-angleDeg).toFixed(2)} ${center.x.toFixed(2)} ${center.y.toFixed(2)})" />`;
        }
        case 'spline': {
            if (entity.control_points.length < 2) { return ''; }
            const vertices = entity.control_points.map(([x, y]) => dxfToMeters(x, y, dxfScale));
            return renderPolyline(vertices, transform, {
                stroke: '#1e293b',
                strokeWidth: 0.5,
                fill: 'none',
                closed: entity.closed,
            });
        }
        case 'text': {
            const point = transformPoint(transform, dxfToMeters(entity.x, entity.y, dxfScale));
            const rawSize = entity.height * dxfScale * transform.scale;
            const fontSize = Math.max(7, Math.min(rawSize, 36));
            const rotation = entity.rotation ?? 0;
            const rotAttr = rotation !== 0
                ? ` transform="rotate(${(-rotation).toFixed(2)} ${point.x.toFixed(2)} ${point.y.toFixed(2)})"`
                : '';
            return `<text x="${point.x.toFixed(2)}" y="${point.y.toFixed(2)}" fill="#1e293b" font-size="${fontSize.toFixed(1)}" font-family="sans-serif"${rotAttr}>${escapeXml(entity.text)}</text>`;
        }
        case 'point': {
            const point = transformPoint(transform, dxfToMeters(entity.x, entity.y, dxfScale));
            return `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="1.5" fill="#475569" />`;
        }
        case 'hatch': {
            return entity.boundary_paths
                .map((path) =>
                    renderPolyline(
                        path.map(([x, y]) => dxfToMeters(x, y, dxfScale)),
                        transform,
                        {
                            stroke: '#1e293b',
                            strokeWidth: 0.4,
                            fill: entity.solid ? '#334155' : 'none',
                            fillOpacity: entity.solid ? 0.25 : 1,
                            closed: true,
                        },
                    ),
                )
                .join('');
        }
        default:
            return '';
    }
}

function buildCadOverviewSvg(
    snapshot: DialuxExportSnapshot,
    cadBaseDataUrl: string | null = null,
): DialuxVectorAsset {
    // Full-page clean DXF plan — no decorative border cards, professional CAD style.
    // This page is dedicated entirely to the imported base plan.
    const W = SVG_WIDTH;
    const H = SVG_HEIGHT;
    const MARGIN = 36;
    const bounds = buildSceneBounds(snapshot, undefined, true);
    const transform = createTransform(bounds, W, H, 72);

    const dxfMarkup = snapshot.dxfEntities
        .map((entity) => renderDxfEntity(entity, transform, snapshot.scaleConfig))
        .join('');

    const hasDxf = snapshot.dxfEntities.length > 0;
    const cadBitmapLayer = !hasDxf && cadBaseDataUrl
        ? `<image href="${cadBaseDataUrl}" x="${MARGIN}" y="${MARGIN + 34}" width="${W - MARGIN * 2}" height="${H - MARGIN * 2 - 34}" preserveAspectRatio="xMidYMid meet" />`
        : '';
    const emptyPlaceholder = !hasDxf && !cadBaseDataUrl
        ? `<text x="${W / 2}" y="${H / 2}" fill="#94a3b8" font-size="18" font-family="sans-serif" text-anchor="middle">Sin plano CAD importado</text>`
        : '';

    // Scale bar: compute 1m in SVG pixels
    const oneMeterPx = transform.scale; // px per meter
    const barLenPx = Math.min(oneMeterPx * 5, 180); // up to 5m but max 180px
    const barMeters = (barLenPx / oneMeterPx).toFixed(1);
    const barX = MARGIN + 8;
    const barY = H - MARGIN - 14;

    const scaleBarMarkup = `
        <line x1="${barX}" y1="${barY}" x2="${(barX + barLenPx).toFixed(1)}" y2="${barY}" stroke="#334155" stroke-width="2" stroke-linecap="square"/>
        <line x1="${barX}" y1="${(barY - 5)}" x2="${barX}" y2="${(barY + 5)}" stroke="#334155" stroke-width="1.5"/>
        <line x1="${(barX + barLenPx).toFixed(1)}" y1="${(barY - 5)}" x2="${(barX + barLenPx).toFixed(1)}" y2="${(barY + 5)}" stroke="#334155" stroke-width="1.5"/>
        <text x="${(barX + barLenPx / 2).toFixed(1)}" y="${(barY - 8)}" fill="#334155" font-size="10" font-family="sans-serif" text-anchor="middle">${barMeters} m</text>`;

    // North arrow (top-right corner)
    const naX = W - MARGIN - 24;
    const naY = MARGIN + 52;
    const northArrow = `
        <g transform="translate(${naX},${naY})">
            <polygon points="0,-20 5,0 0,-4 -5,0" fill="#1e293b"/>
            <polygon points="0,-4 5,0 0,20 -5,0" fill="#94a3b8"/>
            <text x="0" y="36" fill="#1e293b" font-size="11" font-family="sans-serif" font-weight="700" text-anchor="middle">N</text>
        </g>`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
        <rect width="${W}" height="${H}" fill="#ffffff"/>
        <rect x="${MARGIN}" y="${MARGIN}" width="${W - MARGIN * 2}" height="${H - MARGIN * 2}" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.8"/>
        ${cadBitmapLayer}
        <g id="dxf-layer" opacity="1">${dxfMarkup}${emptyPlaceholder}</g>
        ${scaleBarMarkup}
        ${northArrow}
        <rect x="${MARGIN}" y="${MARGIN}" width="${W - MARGIN * 2}" height="34" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.8"/>
        <text x="${MARGIN + 10}" y="${MARGIN + 13}" fill="#0f172a" font-size="11" font-family="sans-serif" font-weight="700">${escapeXml(snapshot.project.name)} — Plano Base (CAD)</text>
        <text x="${MARGIN + 10}" y="${MARGIN + 26}" fill="#64748b" font-size="9" font-family="sans-serif">${escapeXml(snapshot.scene.name)} · Terreno original importado</text>
    </svg>`;

    return {
        id: 'cad-overview-svg',
        title: 'Vista general del CAD',
        purpose: 'cad-overview',
        kind: 'vector',
        mimeType: 'image/svg+xml',
        svg,
        width: W,
        height: H,
    };
}

function buildFormalCoverSvg(snapshot: DialuxExportSnapshot): DialuxVectorAsset {
    const bounds = buildSceneBounds(snapshot);
    const width = 1200;
    const height = 780;
    const transform = createTransform(bounds, width, height);
    const extrusionDepth = 26;

    const extrudedRoomsMarkup = snapshot.rooms
        .map((room) => {
            const topPoints = room.vertices.map((vertex) =>
                transformPoint(transform, vertex),
            );

            if (topPoints.length < 3) {
                return '';
            }

            const roof = topPoints
                .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
                .join(' ');

            const sides = topPoints
                .map((point, index) => {
                    const next = topPoints[(index + 1) % topPoints.length];
                    const isVisibleFace = next.x >= point.x || next.y >= point.y;

                    if (!isVisibleFace) {
                        return '';
                    }

                    return `<polygon points="${point.x.toFixed(2)},${point.y.toFixed(2)} ${next.x.toFixed(2)},${next.y.toFixed(2)} ${next.x.toFixed(2)},${(next.y + extrusionDepth).toFixed(2)} ${point.x.toFixed(2)},${(point.y + extrusionDepth).toFixed(2)}" fill="#0f766e" fill-opacity="0.22" stroke="#155e75" stroke-width="1" />`;
                })
                .join('');

            return `<g>
                ${sides}
                <polygon points="${roof}" fill="${room.color}" fill-opacity="0.48" stroke="#67e8f9" stroke-width="1.8" />
            </g>`;
        })
        .join('');

    const fixturesMarkup = snapshot.fixtures
        .map((fixture) => {
            const point = transformPoint(transform, fixture);
            return `<g>
                <circle cx="${point.x.toFixed(2)}" cy="${(point.y - 8).toFixed(2)}" r="8" fill="#fde68a" fill-opacity="0.18" />
                <circle cx="${point.x.toFixed(2)}" cy="${(point.y - 8).toFixed(2)}" r="4.5" fill="#fbbf24" stroke="#f59e0b" stroke-width="1.2" />
            </g>`;
        })
        .join('');

    const ambientCount = snapshot.summary.ambientCount.toString().padStart(2, '0');
    const fixtureCount = snapshot.summary.fixtureCount.toString().padStart(2, '0');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${width} ${height}">
        <defs>
            <linearGradient id="cover-bg" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stop-color="#020617" />
                <stop offset="55%" stop-color="#0f172a" />
                <stop offset="100%" stop-color="#082f49" />
            </linearGradient>
            <linearGradient id="cover-panel" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stop-color="#0f172a" stop-opacity="0.94" />
                <stop offset="100%" stop-color="#111827" stop-opacity="0.8" />
            </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#cover-bg)" />
        <circle cx="1050" cy="140" r="220" fill="#22d3ee" fill-opacity="0.08" />
        <circle cx="140" cy="640" r="180" fill="#f59e0b" fill-opacity="0.07" />
        <rect x="54" y="58" width="1092" height="664" rx="30" fill="url(#cover-panel)" stroke="#164e63" stroke-opacity="0.8" />
        <g transform="translate(0 20)">
            ${extrudedRoomsMarkup}
            ${fixturesMarkup}
        </g>
        <text x="96" y="140" fill="#67e8f9" font-size="18" font-family="system-ui" letter-spacing="4">DIALUX WEB</text>
        <text x="96" y="202" fill="#f8fafc" font-size="42" font-family="system-ui" font-weight="700">${escapeXml(snapshot.project.name)}</text>
        <text x="96" y="242" fill="#cbd5e1" font-size="18" font-family="system-ui">${escapeXml(snapshot.scene.name)} · ${escapeXml(snapshot.exportedAt.slice(0, 10))}</text>
        <text x="96" y="620" fill="#cbd5e1" font-size="16" font-family="system-ui">Ambientes: ${ambientCount}</text>
        <text x="96" y="648" fill="#cbd5e1" font-size="16" font-family="system-ui">Luminarias: ${fixtureCount}</text>
        <text x="96" y="676" fill="#cbd5e1" font-size="16" font-family="system-ui">Escala: ${escapeXml(snapshot.scaleConfig.displayUnit)}</text>
    </svg>`;

    return {
        id: 'formal-cover-svg',
        title: 'Portada formal 3D',
        purpose: 'formal-cover',
        kind: 'vector',
        mimeType: 'image/svg+xml',
        svg,
        width,
        height,
    };
}

function buildDrawnTerrainSvg(
    snapshot: DialuxExportSnapshot,
    cadBaseDataUrl: string | null = null,
): DialuxVectorAsset {
    // DIAlux EVO style: white background, DXF entities in light gray,
    // room/corridor overlays in magenta (#e91e8c) with translucent fill.
    // Fixtures rendered as blue circles. Professional north arrow + scale bar.
    const W = SVG_WIDTH;
    const H = SVG_HEIGHT;
    const MARGIN = 36;
    const bounds = buildSceneBounds(snapshot, undefined, true);
    const transform = createTransform(bounds, W, H, 72);

    // ── DXF base layer (light gray, thin lines) ──────────────────────────────
    const dxfMarkup = snapshot.dxfEntities
        .map((entity) => renderDxfEntity(entity, transform, snapshot.scaleConfig))
        .join('');

    // Si no hay entidades DXF vectoriales, pero tenemos una imagen base, la usamos.
    const cadBgLayer = (snapshot.dxfEntities.length === 0 && cadBaseDataUrl)
        ? `<image href="${cadBaseDataUrl}" x="${MARGIN}" y="${MARGIN + 34}" width="${W - MARGIN * 2}" height="${H - MARGIN * 2 - 34}" opacity="0.7" preserveAspectRatio="xMidYMid meet" />`
        : `<g id="dxf-base" opacity="0.85">${dxfMarkup}</g>`;

    // ── Rooms: magenta fill + border (DIAlux EVO style) ──────────────────────
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

    // ── Room labels ────────────────────────────────────────────────────────────
    const roomLabelsMarkup = snapshot.rooms
        .map((room) => {
            const rb = createBoundsFromVertices(room.vertices);
            if (!rb) { return ''; }
            const center = transformPoint(transform, {
                x: (rb.minX + rb.maxX) / 2,
                y: (rb.minY + rb.maxY) / 2,
            });
            const isCorridor = room.roomType === 'corridor';
            return `<text x="${center.x.toFixed(2)}" y="${center.y.toFixed(2)}" fill="${isCorridor ? '#7c3aed' : '#c2185b'}" font-size="11" font-family="sans-serif" font-weight="700" text-anchor="middle">${escapeXml(room.name)}</text>`;
        })
        .join('');

    // ── Walls (thicker, dark) ─────────────────────────────────────────────────
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

    // ── Windows (cyan) ────────────────────────────────────────────────────────
    const windowsMarkup = snapshot.windows
        .map((windowItem) => {
            const wall = snapshot.walls.find((w) => w.id === windowItem.wallId);
            return wall ? renderOpeningMarker(transform, wall.vertices, windowItem.offsetAlongWall, windowItem.width, '#0ea5e9') : '';
        })
        .join('');

    // ── Doors (orange) ────────────────────────────────────────────────────────
    const doorsMarkup = snapshot.doors
        .map((door) => {
            const wall = snapshot.walls.find((w) => w.id === door.wallId);
            return wall ? renderOpeningMarker(transform, wall.vertices, door.offsetAlongWall, door.width, '#f97316') : '';
        })
        .join('');

    // ── Fixtures: blue circles (DIAlux EVO style) ─────────────────────────────
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

    // ── Ambient labels (magenta, smaller) ─────────────────────────────────────
    const ambientLabelsMarkup = snapshot.ambients
        .map((ambient) => {
            const ab = createBoundsFromVertices(ambient.room.vertices);
            if (!ab) { return ''; }
            const center = transformPoint(transform, {
                x: (ab.minX + ab.maxX) / 2,
                y: (ab.minY + ab.maxY) / 2,
            });
            return `<text x="${center.x.toFixed(2)}" y="${(center.y + 16).toFixed(2)}" fill="#9d174d" font-size="9" font-family="sans-serif" text-anchor="middle">${escapeXml(ambient.name)}</text>`;
        })
        .join('');

    // ── Scale bar ─────────────────────────────────────────────────────────────
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

    // ── North arrow ───────────────────────────────────────────────────────────
    const naX = W - MARGIN - 24;
    const naY = MARGIN + 52;
    const northArrow = `
        <g transform="translate(${naX},${naY})">
            <polygon points="0,-20 5,0 0,-4 -5,0" fill="#1e293b"/>
            <polygon points="0,-4 5,0 0,20 -5,0" fill="#94a3b8"/>
            <text x="0" y="36" fill="#1e293b" font-size="11" font-family="sans-serif" font-weight="700" text-anchor="middle">N</text>
        </g>`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
        <rect width="${W}" height="${H}" fill="#ffffff"/>
        <rect x="${MARGIN}" y="${MARGIN}" width="${W - MARGIN * 2}" height="${H - MARGIN * 2}" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.8"/>
        ${cadBgLayer}
        <g id="rooms-layer">${roomsMarkup}</g>
        <g id="walls-layer">${wallsMarkup}</g>
        <g id="windows-layer">${windowsMarkup}</g>
        <g id="doors-layer">${doorsMarkup}</g>
        <g id="fixtures-layer">${fixturesMarkup}</g>
        <g id="room-labels-layer">${roomLabelsMarkup}</g>
        <g id="ambient-labels-layer">${ambientLabelsMarkup}</g>
        ${scaleBarMarkup}
        ${northArrow}
        <rect x="${MARGIN}" y="${MARGIN}" width="${W - MARGIN * 2}" height="34" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.8"/>
        <text x="${MARGIN + 10}" y="${MARGIN + 13}" fill="#0f172a" font-size="11" font-family="sans-serif" font-weight="700">${escapeXml(snapshot.project.name)} — Plano Arquitectónico</text>
        <text x="${MARGIN + 10}" y="${MARGIN + 26}" fill="#64748b" font-size="9" font-family="sans-serif">${escapeXml(snapshot.scene.name)} · Vista arquitectónica 2D / Recintos y luminarias</text>
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







function buildAmbientPlanSvgAsset(ambient: DialuxAmbientExport, snapshot: DialuxExportSnapshot, cadBaseDataUrl: string | null): DialuxVectorAsset {
    const roomBounds = createBoundsFromVertices(ambient.room.vertices) ?? {
        minX: 0,
        minY: 0,
        maxX: 10,
        maxY: 10,
    };

    // Expand bounds slightly for context padding
    const padding = Math.max((roomBounds.maxX - roomBounds.minX), (roomBounds.maxY - roomBounds.minY)) * 0.15;
    const bounds = {
        minX: roomBounds.minX - padding,
        minY: roomBounds.minY - padding,
        maxX: roomBounds.maxX + padding,
        maxY: roomBounds.maxY + padding,
    };

    const width = 1200;
    const height = 780;
    const transform = createTransform(bounds, width, height);

    // DXF entities filtered to those within or near the ambient bounds
    const dxfMarkup = snapshot.dxfEntities
        .map((entity) => renderDxfEntity(entity, transform, snapshot.scaleConfig))
        .join('');

    // Context walls near this ambient
    const contextWallsMarkup = snapshot.walls
        .map((wall) =>
            renderPolyline(wall.vertices, transform, {
                stroke: '#334155',
                strokeWidth: 0.7,
                fill: 'none',
                closed: false,
            }),
        )
        .join('');

    // Context windows
    const contextWindowsMarkup = snapshot.windows
        .map((windowItem) => {
            const wall = snapshot.walls.find((w) => w.id === windowItem.wallId);
            return wall ? renderOpeningMarker(transform, wall.vertices, windowItem.offsetAlongWall, windowItem.width, '#0ea5e9') : '';
        })
        .join('');

    // Context doors
    const contextDoorsMarkup = snapshot.doors
        .map((door) => {
            const wall = snapshot.walls.find((w) => w.id === door.wallId);
            return wall ? renderOpeningMarker(transform, wall.vertices, door.offsetAlongWall, door.width, '#f97316') : '';
        })
        .join('');

    const roomPath = renderPolyline(ambient.room.vertices, transform, {
        stroke: '#0d9488',
        strokeWidth: 0.7,
        fill: '#ccfbf1',
        fillOpacity: 0.30,
        closed: true,
    });

    const fixtureMarkup = ambient.fixtures
        .map((fixture) => renderFixtureSymbol(transformPoint(transform, fixture), fixture, {
            scale: 0.65,
            accent: '#b45309',
            fill: 'rgba(245, 158, 11, 0.18)',
        }))
        .join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${width} ${height}">
        <rect width="100%" height="100%" fill="#ffffff" />
        <g id="context-walls">${contextWallsMarkup}</g>
        <g id="context-openings">${contextWindowsMarkup}${contextDoorsMarkup}</g>
        <g id="room-fill">${roomPath}</g>
        <g id="fixtures">${fixtureMarkup}</g>
        <rect x="0" y="0" width="${width}" height="44" fill="rgba(255,255,255,0.88)" />
        <text x="56" y="26" fill="#0f172a" font-size="20" font-family="system-ui" font-weight="700">${escapeXml(ambient.name)}</text>
        <text x="56" y="40" fill="#64748b" font-size="11" font-family="system-ui">Recinto ${escapeXml(ambient.roomName)} · Vista 2D</text>
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

function colorForFunctionalLux(lux: number, maxLux: number): string {
    const ratio = Math.min(1, Math.max(0, lux / Math.max(maxLux, 1)));
    const hue = 220 - ratio * 220;
    const saturation = 85;
    const lightness = 55 - ratio * 10;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function colorForTemperatureLux(lux: number, maxLux: number): string {
    const ratio = Math.min(1, Math.max(0, lux / Math.max(maxLux, 1)));
    const hue = 240 - ratio * 240;
    return `hsl(${hue}, 90%, 56%)`;
}

function waveStrokeColor(level: number, maxLux: number): string {
    const ratio = Math.min(1, Math.max(0, level / Math.max(maxLux, 1)));
    const hue = 205 - ratio * 28;
    const saturation = 90 - ratio * 12;
    const lightness = 72 - ratio * 28;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function waveBackdropColor(lux: number, maxLux: number): string {
    const ratio = Math.min(1, Math.max(0, lux / Math.max(maxLux, 1)));
    const hue = 210 - ratio * 35;
    const saturation = 65 + ratio * 15;
    const lightness = 18 + ratio * 16;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function buildIsoluxSvgAsset(
    ambient: DialuxAmbientExport,
    mode: DialuxExportSnapshot['visualConfig']['isoluxMode'],
): DialuxVectorAsset | null {
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
        return null;
    }

    const roomVertices = result.room_vertices ?? ambient.room.vertices;
    const bounds = createBoundsFromVertices(roomVertices);
    if (!bounds) {
        return null;
    }

    const transform = createTransform(bounds, SVG_WIDTH, SVG_HEIGHT);
    const maxLux = Math.max(result.max_lux, 1);
    const gridOriginX = result.grid_origin_x;
    const gridOriginY = result.grid_origin_y;
    const gridCellWidth = result.grid_cell_width;
    const gridCellHeight = result.grid_cell_height;
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
                          x:
                              gridOriginX +
                              col * gridCellWidth +
                              gridCellWidth / 2,
                          y:
                              gridOriginY +
                              row * gridCellHeight +
                              gridCellHeight / 2,
                      }),
              })
            : [];

    const cellMarkup = result.grid_values
        .map((lux, index) => {
            if (lux === null) {
                return '';
            }

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
            const width = Math.max(1, Math.abs(bottomRight.x - topLeft.x));
            const height = Math.max(1, Math.abs(bottomRight.y - topLeft.y));
            const x = Math.min(topLeft.x, bottomRight.x);
            const y = Math.min(topLeft.y, bottomRight.y);
            const fill =
                mode === 'waves'
                    ? waveBackdropColor(lux, maxLux)
                    : mode === 'temperature'
                      ? colorForTemperatureLux(lux, maxLux)
                      : colorForFunctionalLux(lux, maxLux);
            const opacity = mode === 'waves' ? 0.24 : 0.46;

            return `<g>
                <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${width.toFixed(2)}" height="${height.toFixed(2)}" fill="${fill}" fill-opacity="${opacity}" stroke="rgba(255,255,255,0.07)" stroke-width="0.7" />
                <text x="${(x + width / 2).toFixed(2)}" y="${(y + height / 2).toFixed(2)}" fill="#dbeafe" font-size="10" font-family="monospace" text-anchor="middle" dominant-baseline="middle">${lux.toFixed(0)}</text>
            </g>`;
        })
        .join('');

    const contourMarkup = contourSegments
        .map(
            (segment, index) =>
                `<line key="${index}" x1="${segment.start.x.toFixed(2)}" y1="${segment.start.y.toFixed(2)}" x2="${segment.end.x.toFixed(2)}" y2="${segment.end.y.toFixed(2)}" stroke="${waveStrokeColor(segment.level, maxLux)}" stroke-width="${segment.levelIndex % 2 === 0 ? 1.1 : 0.8}" stroke-linecap="round" />`,
        )
        .join('');

    const roomPath = renderPolyline(roomVertices, transform, {
        stroke: '#e2e8f0',
        strokeWidth: 1.4,
        fill: 'none',
        closed: true,
    });
    const fixturesMarkup = ambient.fixtures
        .map((fixture) =>
            renderFixtureSymbol(transformPoint(transform, fixture), fixture, {
                scale: 0.68,
                accent: '#f8fafc',
                fill: 'rgba(248,250,252,0.12)',
            }),
        )
        .join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">
        <rect width="100%" height="100%" fill="#0b1120" />
        ${cellMarkup}
        ${mode === 'waves' ? contourMarkup : ''}
        ${roomPath}
        ${fixturesMarkup}
        <text x="48" y="44" fill="#f8fafc" font-size="18" font-family="system-ui" font-weight="700">${escapeXml(ambient.name)}</text>
        <text x="48" y="68" fill="#94a3b8" font-size="12" font-family="system-ui">Modo isolux: ${escapeXml(mode)}</text>
    </svg>`;

    return {
        id: `isolux-svg-${ambient.id}`,
        title: `Isolux - ${ambient.name}`,
        purpose: 'isolux',
        kind: 'vector',
        mimeType: 'image/svg+xml',
        svg,
        width: SVG_WIDTH,
        height: SVG_HEIGHT,
    };
}

function buildAmbientTable(
    snapshot: DialuxExportSnapshot,
): DialuxStructuredTableData {
    return {
        type: 'table',
        columns: [
            { key: 'roomName', label: 'Recinto' },
            { key: 'ambientName', label: 'Ambiente' },
            { key: 'activity', label: 'Actividad' },
            { key: 'area', label: 'Area (m2)' },
            { key: 'fixtureCount', label: 'Luminarias' },
            { key: 'coverage', label: 'Cobertura' },
        ],
        rows: snapshot.ambients.map((ambient) => ({
            roomName: ambient.roomName,
            ambientName: ambient.name,
            activity: ambient.activity ?? '-',
            area: Number(ambient.metrics.area.toFixed(2)),
            fixtureCount: ambient.metrics.fixtureCount,
            coverage: ambient.metrics.coverage,
        })),
    };
}

function buildLightingResultsTable(
    snapshot: DialuxExportSnapshot,
): DialuxStructuredTableData {
    return {
        type: 'table',
        columns: [
            { key: 'ambientName', label: 'Ambiente' },
            { key: 'targetLux', label: 'Lux objetivo' },
            { key: 'avgLux', label: 'E avg' },
            { key: 'minLux', label: 'E min' },
            { key: 'maxLux', label: 'E max' },
            { key: 'uniformity', label: 'Uo' },
            { key: 'g2', label: 'g2' },
            { key: 'usefulPlaneHeight', label: 'Altura plano' },
            { key: 'marginalZone', label: 'Zona marginal' },
            { key: 'ugr', label: 'UGR' },
            { key: 'status', label: 'Cumple' },
        ],
        rows: snapshot.ambients.map((ambient) => ({
            ambientName: ambient.name,
            targetLux: ambient.metrics.illuminanceLux,
            avgLux:
                ambient.metrics.avgLux === null
                    ? null
                    : Number(ambient.metrics.avgLux.toFixed(2)),
            minLux:
                ambient.metrics.minLux === null
                    ? null
                    : Number(ambient.metrics.minLux.toFixed(2)),
            maxLux:
                ambient.metrics.maxLux === null
                    ? null
                    : Number(ambient.metrics.maxLux.toFixed(2)),
            uniformity:
                ambient.metrics.uniformity === null
                    ? null
                    : Number(ambient.metrics.uniformity.toFixed(3)),
            g2:
                ambient.metrics.g2 === null
                    ? null
                    : Number(ambient.metrics.g2.toFixed(3)),
            usefulPlaneHeight: Number(
                ambient.metrics.usefulPlaneHeight.toFixed(3),
            ),
            marginalZone: Number(ambient.metrics.marginalZone.toFixed(3)),
            ugr:
                ambient.metrics.ugr === null
                    ? null
                    : Number(ambient.metrics.ugr.toFixed(2)),
            status: ambient.metrics.complies ? 'Si' : 'No',
        })),
    };
}

function buildLuminaireProductTable(
    snapshot: DialuxExportSnapshot,
): DialuxStructuredTableData {
    const grouped = new Map<
        string,
        {
            quantity: number;
            manufacturer: string;
            articleNumber: string;
            name: string;
            sourceFormat: string;
            powerWatts: number | null;
            lumens: number | null;
            efficiency: number | null;
        }
    >();

    for (const fixture of snapshot.fixtures) {
        const powerWatts =
            'power' in fixture && typeof fixture.power === 'number'
                ? fixture.power
                : null;
        const lumens = fixture.lumens ?? null;
        const key = [
            fixture.productId ?? 'sin-producto',
            fixture.brand ?? 'sin-fabricante',
            fixture.articleNumber ?? 'sin-articulo',
            fixture.name,
            lumens ?? 'sin-lumen',
            powerWatts ?? 'sin-potencia',
        ].join('::');
        const current = grouped.get(key);

        if (current) {
            current.quantity += 1;
            continue;
        }

        grouped.set(key, {
            quantity: 1,
            manufacturer: fixture.brand ?? 'Importado',
            articleNumber: fixture.articleNumber ?? '-',
            name: fixture.name,
            sourceFormat: fixture.productSourceFormat?.toUpperCase() ?? '-',
            powerWatts,
            lumens,
            efficiency:
                lumens !== null && powerWatts !== null && powerWatts > 0
                    ? Number((lumens / powerWatts).toFixed(1))
                    : null,
        });
    }

    return {
        type: 'table',
        columns: [
            { key: 'quantity', label: 'Cantidad' },
            { key: 'manufacturer', label: 'Fabricante' },
            { key: 'articleNumber', label: 'Codigo' },
            { key: 'name', label: 'Producto' },
            { key: 'sourceFormat', label: 'Formato' },
            { key: 'powerWatts', label: 'P (W)' },
            { key: 'lumens', label: 'Flujo (lm)' },
            { key: 'efficiency', label: 'lm/W' },
        ],
        rows: [...grouped.values()].map((item) => ({ ...item })),
    };
}

function buildProjectSummary(
    snapshot: DialuxExportSnapshot,
): DialuxStructuredSummaryData {
    return {
        type: 'summary',
        items: [
            { label: 'Proyecto', value: snapshot.project.name },
            { label: 'Escena', value: snapshot.scene.name },
            { label: 'Escala', value: snapshot.scaleConfig.displayUnit },
            {
                label: 'Ambientes calculados',
                value: `${snapshot.summary.calculatedAmbientCount}/${snapshot.summary.ambientCount}`,
            },
            {
                label: 'Ambientes conformes',
                value: `${snapshot.summary.compliantAmbientCount}/${snapshot.summary.ambientCount}`,
            },
            {
                label: 'Lux promedio',
                value: snapshot.summary.averageLux.toFixed(1),
            },
            {
                label: 'Uniformidad promedio',
                value: `${(snapshot.summary.averageUniformity * 100).toFixed(1)}%`,
            },
        ],
    };
}

function buildChartSvg(snapshot: DialuxExportSnapshot): DialuxVectorAsset {
    const rows = snapshot.ambients.slice(0, 8);
    const width = 1200;
    const height = 520;
    const chartTop = 70;
    const chartBottom = 420;
    const chartHeight = chartBottom - chartTop;
    const barWidth = rows.length > 0 ? 90 : 0;
    const gap = 36;
    const originX = 90;
    const maxLux = Math.max(
        1,
        ...rows.map((ambient) =>
            Math.max(
                ambient.metrics.illuminanceLux,
                ambient.metrics.avgLux ?? 0,
            ),
        ),
    );

    const bars = rows
        .map((ambient, index) => {
            const avgLux = ambient.metrics.avgLux ?? 0;
            const x = originX + index * (barWidth + gap);
            const barHeight = (avgLux / maxLux) * chartHeight;
            const y = chartBottom - barHeight;
            const targetY =
                chartBottom -
                (ambient.metrics.illuminanceLux / maxLux) * chartHeight;
            const fill = ambient.metrics.complies ? '#22c55e' : '#f59e0b';

            return `<g>
                <rect x="${x}" y="${y.toFixed(2)}" width="${barWidth}" height="${barHeight.toFixed(2)}" fill="${fill}" rx="10" ry="10" />
                <line x1="${x}" y1="${targetY.toFixed(2)}" x2="${x + barWidth}" y2="${targetY.toFixed(2)}" stroke="#38bdf8" stroke-width="3" stroke-dasharray="6 4" />
                <text x="${x + barWidth / 2}" y="${chartBottom + 20}" fill="#e2e8f0" font-size="11" font-family="system-ui" text-anchor="middle">${escapeXml(ambient.name)}</text>
                <text x="${x + barWidth / 2}" y="${Math.max(28, y - 10).toFixed(2)}" fill="#f8fafc" font-size="11" font-family="monospace" text-anchor="middle">${avgLux.toFixed(0)} lx</text>
            </g>`;
        })
        .join('');

    const guideLines = [0, 0.25, 0.5, 0.75, 1]
        .map((ratio) => {
            const y = chartBottom - ratio * chartHeight;
            const label = (maxLux * ratio).toFixed(0);
            return `<g>
                <line x1="70" y1="${y.toFixed(2)}" x2="${width - 40}" y2="${y.toFixed(2)}" stroke="#1e293b" stroke-width="1" />
                <text x="58" y="${(y + 4).toFixed(2)}" fill="#64748b" font-size="10" font-family="monospace" text-anchor="end">${label}</text>
            </g>`;
        })
        .join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="100%" height="100%" fill="#020617" />
        <text x="48" y="40" fill="#f8fafc" font-size="20" font-family="system-ui" font-weight="700">Comparativo de lux por ambiente</text>
        <text x="48" y="62" fill="#94a3b8" font-size="12" font-family="system-ui">Barras: lux promedio calculado. Linea punteada: lux objetivo.</text>
        ${guideLines}
        ${bars}
    </svg>`;

    return {
        id: 'chart-lux-summary',
        title: 'Grafico comparativo de lux',
        purpose: 'chart',
        kind: 'vector',
        mimeType: 'image/svg+xml',
        svg,
        width,
        height,
    };
}

function buildTechnicalAppendix(
    snapshot: DialuxExportSnapshot,
): DialuxStructuredJsonData {
    return {
        type: 'json',
        data: {
            formatVersion: snapshot.formatVersion,
            exportedAt: snapshot.exportedAt,
            sceneId: snapshot.scene.id,
            scaleConfig: snapshot.scaleConfig,
            visualConfig: snapshot.visualConfig,
            dxfExtents: snapshot.dxfExtents,
            ambientCount: snapshot.ambients.length,
            rooms: snapshot.rooms.map((room) => ({
                id: room.id,
                name: room.name,
                vertices: room.vertices,
            })),
            ambients: snapshot.ambients.map((ambient) => ({
                id: ambient.id,
                roomId: ambient.roomId,
                name: ambient.name,
                activity: ambient.activity,
                metrics: ambient.metrics,
                lightingResult: ambient.result,
            })),
        },
    };
}

async function svgToBitmapAsset(asset: DialuxVectorAsset): Promise<DialuxBitmapAsset> {
    // SSR / Node environment — return inline SVG data URL as-is
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return {
            id: asset.id,
            title: asset.title,
            purpose: asset.purpose,
            kind: 'bitmap',
            mimeType: 'image/png',
            dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(asset.svg)}`,
            width: asset.width,
            height: asset.height,
        };
    }

    // Render at 2× logical resolution for crisp A4 printing
    const scale = 2;
    const canvasW = asset.width * scale;
    const canvasH = asset.height * scale;

    return new Promise((resolve) => {
        // Use Blob URL to avoid data-URL length limits on large SVGs
        const blob = new Blob([asset.svg], { type: 'image/svg+xml;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);

        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(blobUrl);
            const canvas = document.createElement('canvas');
            canvas.width = canvasW;
            canvas.height = canvasH;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvasW, canvasH);
                ctx.drawImage(img, 0, 0, canvasW, canvasH);
                resolve({
                    id: asset.id,
                    title: asset.title,
                    purpose: asset.purpose,
                    kind: 'bitmap',
                    mimeType: 'image/png',
                    dataUrl: canvas.toDataURL('image/png'),
                    width: asset.width,
                    height: asset.height,
                });
            } else {
                // Canvas context unavailable — embed SVG as data URL
                resolve({
                    ...asset,
                    kind: 'bitmap',
                    mimeType: 'image/png',
                    dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(asset.svg)}`,
                });
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            // Blob URL failed — try direct encodeURIComponent as last resort
            const fallbackImg = new Image();
            fallbackImg.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = canvasW;
                canvas.height = canvasH;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvasW, canvasH);
                    ctx.drawImage(fallbackImg, 0, 0, canvasW, canvasH);
                    resolve({
                        id: asset.id,
                        title: asset.title,
                        purpose: asset.purpose,
                        kind: 'bitmap',
                        mimeType: 'image/png',
                        dataUrl: canvas.toDataURL('image/png'),
                        width: asset.width,
                        height: asset.height,
                    });
                } else {
                    resolve({
                        ...asset,
                        kind: 'bitmap',
                        mimeType: 'image/png',
                        dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(asset.svg)}`,
                    });
                }
            };
            fallbackImg.onerror = () => {
                resolve({
                    ...asset,
                    kind: 'bitmap',
                    mimeType: 'image/png',
                    dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(asset.svg)}`,
                });
            };
            fallbackImg.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(asset.svg)}`;
        };
        img.src = blobUrl;
    });
}

function rasterizeVectorAsset(asset: DialuxVectorAsset): Promise<DialuxBitmapAsset> {
    return new Promise((resolve, reject) => {
        const blob = new Blob([asset.svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = asset.width ?? 1200;
            canvas.height = asset.height ?? 780;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve({
                    id: asset.id,
                    title: asset.title,
                    purpose: asset.purpose,
                    kind: 'bitmap',
                    mimeType: 'image/png',
                    dataUrl: canvas.toDataURL('image/png'),
                    width: canvas.width,
                    height: canvas.height,
                });
            } else {
                reject(new Error('Failed to get 2D context'));
            }
            URL.revokeObjectURL(url);
        };
        img.onerror = (err) => {
            URL.revokeObjectURL(url);
            reject(err);
        };
        img.src = url;
    });
}

/**
 * Helper to fetch a product image and convert it to a DialuxBitmapAsset.
 */
async function fetchImageAsBitmapAsset(
    url: string,
    assetId: string,
    title: string,
    purpose: DialuxAssetPurpose,
): Promise<DialuxBitmapAsset | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

        // Get dimensions
        return await new Promise<DialuxBitmapAsset | null>((resolve) => {
            const img = new Image();
            img.onload = () => {
                resolve({
                    id: assetId,
                    title,
                    purpose,
                    kind: 'bitmap',
                    mimeType: (blob.type as 'image/png' | 'image/jpeg') || 'image/png',
                    dataUrl,
                    width: img.width,
                    height: img.height,
                });
            };
            img.onerror = () => {
                console.warn(`[dialux-export] Failed to load image dimensions for ${assetId}`);
                resolve(null);
            };
            img.src = dataUrl;
        });
    } catch (e) {
        console.error(`[dialux-export] Failed to fetch image from ${url}`, e);
        return null;
    }
}

export async function buildDialuxExportAssets(
    snapshot: DialuxExportSnapshot,
    options: BuildDialuxExportAssetsOptions = {},
): Promise<DialuxExportAsset[]> {
    const assets: DialuxExportAsset[] = [];

    // ─── 1. Enriquecer productos fotométricos ───
    const uniqueProductIds = [
        ...new Set(
            snapshot.fixtures
                .map((f) => f.productId)
                .filter((id): id is number => typeof id === 'number'),
        ),
    ];

    const productMap = new Map<number, any>();

    // Cargamos los detalles de cada producto de forma paralela
    await Promise.all(
        uniqueProductIds.map(async (id) => {
            try {
                const response = await axios.get(
                    productRoutes.show.url({ productId: id }),
                );
                const product = response.data.product;
                if (product) {
                    productMap.set(id, product);

                    const web = product.photometric_web || {};
                    const reportAssets = product.report_assets || {};
                    if (typeof reportAssets.polar_svg === 'string' && reportAssets.polar_svg.trim() !== '') {
                        assets.push({
                            id: `prod-${id}-polar`,
                            title: `Diagrama polar - ${product.name}`,
                            purpose: 'ambient-catalog',
                            kind: 'vector',
                            mimeType: 'image/svg+xml',
                            svg: reportAssets.polar_svg,
                            width: 640,
                            height: 520,
                        });
                    }

                    // Procesar visuales de photometric_web
                    const visuals = [
                        { key: 'product_photo', url: product.product_image_url, purpose: 'ambient-catalog' as const, suffix: 'photo', label: 'Foto de producto' },
                        { key: 'brand_logo', url: product.brand_logo_url, purpose: 'ambient-catalog' as const, suffix: 'logo', label: 'Logo de marca' },
                        { key: 'line_drawing', purpose: 'ambient-catalog' as const, suffix: 'drawing', label: 'Dibujo dimensional' },
                        ...(reportAssets.polar_svg ? [] : [{ key: 'polar_diagram', purpose: 'ambient-catalog' as const, suffix: 'polar', label: 'Diagrama polar' }]),
                    ];

                    for (const visual of visuals) {
                        const url = visual.url ?? web[visual.key];
                        if (url && typeof url === 'string') {
                            const assetId = `prod-${id}-${visual.suffix}`;
                            const title = `${visual.label} - ${product.name}`;
                            const asset = await fetchImageAsBitmapAsset(url, assetId, title, visual.purpose);
                            if (asset) {
                                assets.push(asset);
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn(`[dialux-export] Failed to fetch product ${id} details`, e);
            }
        }),
    );

    // Actualizamos las fixtures en el snapshot para que tengan los IDs de los assets recién creados
    for (const fixture of snapshot.fixtures) {
        if (typeof fixture.productId === 'number') {
            const product = productMap.get(fixture.productId);
            if (product) {
                const web = product.photometric_web || {};
                const reportAssets = product.report_assets || {};
                if (web.polar_diagram || reportAssets.polar_svg) fixture.polarDiagramAssetId = `prod-${fixture.productId}-polar`;
                if (web.product_photo || product.product_image_url) fixture.productPhotoAssetId = `prod-${fixture.productId}-photo`;
                if (product.brand_logo_url) fixture.brandLogoAssetId = `prod-${fixture.productId}-logo`;
                if (web.line_drawing) fixture.lineDrawingAssetId = `prod-${fixture.productId}-drawing`;

                // También enriquecemos metadatos técnicos si faltan
                fixture.brand = fixture.brand ?? product.manufacturer;
                fixture.articleNumber = fixture.articleNumber ?? product.catalog_number;
                fixture.productSourceFormat = fixture.productSourceFormat ?? product.source_format;
                fixture.cct = fixture.cct ?? (typeof product.cct === 'string' ? parseInt(product.cct) : product.cct);
                fixture.cri = fixture.cri ?? product.cri_ra;
                fixture.description = fixture.description ?? product.description;
                fixture.reportData = fixture.reportData ?? product.report_data ?? null;
                fixture.reportAssets = fixture.reportAssets ?? product.report_assets ?? null;

                // UGR handling if available in metadata or summary
                if (!fixture.ugrTable && product.photometric_summary?.ugr_table) {
                    fixture.ugrTable = product.photometric_summary.ugr_table;
                }
            }
        }
    }

    let coverAdded = false;
    let capturedViewerAsset: import('../domain/types').DialuxBitmapAsset | null = null;

    if (options.includeViewerCapture ?? true) {
        // ── Captura compuesta del visor CAD 2D (canvas mlightcad + overlay SVG)
        // Si el canvas está tainted o tiene otra falla, captureCompositeViewerBitmap
        // retorna null y el flujo cae al SVG vectorial automáticamente.
        const capturedViewer = await captureCompositeViewerBitmap({
            purpose: 'cad-overview',
        });
        if (capturedViewer) {
            capturedViewerAsset = capturedViewer;
            assets.push(capturedViewer);
        }

        // ── Captura del visor 3D para la portada
        const captured3D = await capture3DViewerBitmap();
        if (captured3D) {
            assets.push(captured3D);
            coverAdded = true;
        }
    }

    if (!coverAdded) {
        assets.push(buildFormalCoverSvg(snapshot));
    }

    // ── CAD canvas bitmap for plan SVG backgrounds ────────────────────────────
    // Prefer the pre-captured bitmap (taken within RAF at export trigger time)
    // over an in-pipeline attempt, because by the time we reach here the WebGL
    // frame has already been swapped and readPixels() would return blank.
    let cadBaseAsset: import('../domain/types').DialuxBitmapAsset | null =
        options.preCapturedCadBitmap ?? null;

    if (!cadBaseAsset) {
        // Fallback: try again in case patchWebGLPreserveBuffer() is active
        cadBaseAsset = await captureCadBaseBitmap();
    }

    const cadBaseDataUrl = cadBaseAsset?.dataUrl ?? capturedViewerAsset?.dataUrl ?? null;

    if (cadBaseAsset) {
        assets.push(cadBaseAsset);
    }

    if (!cadBaseDataUrl) {
        console.info(
            '[dialux-export] CAD bitmap unavailable — plan SVGs will use vectorial DXF fallback.',
        );
    }

    // ── Plano CAD general (terreno) — usa DXF vectorial o el bitmap CAD capturado.
    // rasterizeVectorAsset usa Blob URL para manejar SVGs grandes sin límite.
    try {
        const cadSvgAsset = buildCadOverviewSvg(snapshot, cadBaseDataUrl);
        const cadBitmapAsset = await rasterizeVectorAsset(cadSvgAsset);
        assets.push(cadBitmapAsset);
    } catch (e) {
        console.warn('[dialux-export] Failed to rasterize CAD overview, using SVG vector', e);
        assets.push(buildCadOverviewSvg(snapshot, cadBaseDataUrl));
    }

    assets.push(buildDrawnTerrainSvg(snapshot, cadBaseDataUrl));
    assets.push({
        id: 'project-summary-data',
        title: 'Resumen del proyecto',
        purpose: 'project-summary',
        kind: 'structured',
        mimeType: 'application/json',
        data: buildProjectSummary(snapshot),
    });
    assets.push({
        id: 'ambient-catalog-data',
        title: 'Catalogo de ambientes',
        purpose: 'ambient-catalog',
        kind: 'structured',
        mimeType: 'application/json',
        data: buildAmbientTable(snapshot),
    });
    assets.push({
        id: 'lighting-results-data',
        title: 'Tabla de resultados luminicos',
        purpose: 'lighting-results',
        kind: 'structured',
        mimeType: 'application/json',
        data: buildLightingResultsTable(snapshot),
    });
    assets.push({
        id: 'luminaire-products-data',
        title: 'Productos de luminarias utilizados',
        purpose: 'luminaire-list',
        kind: 'structured',
        mimeType: 'application/json',
        data: buildLuminaireProductTable(snapshot),
    });
    assets.push(buildChartSvg(snapshot));
    assets.push({
        id: 'technical-appendix-data',
        title: 'Anexo tecnico',
        purpose: 'technical-appendix',
        kind: 'structured',
        mimeType: 'application/json',
        data: buildTechnicalAppendix(snapshot),
    });

    for (const ambient of snapshot.ambients) {
        assets.push(buildAmbientPlanSvgAsset(ambient, snapshot, cadBaseDataUrl));
        const isoluxAsset = buildIsoluxSvgAsset(
            ambient,
            'waves', // Forzamos el modo 'ondas' para el reporte formal profesional
        );

        if (!isoluxAsset) {
            continue;
        }

        assets.push(isoluxAsset);
        assets.push({
            id: `isolux-grid-${ambient.id}`,
            title: `Datos tecnicos isolux - ${ambient.name}`,
            purpose: 'isolux',
            kind: 'structured',
            mimeType: 'application/json',
            data: {
                type: 'json',
                data: {
                    ambientId: ambient.id,
                    ambientName: ambient.name,
                    grid: ambient.result,
                },
            },
        });
    }

    const finalizedAssets: DialuxExportAsset[] = [];
    for (const asset of assets) {
        if (asset.kind === 'vector') {
            finalizedAssets.push(await svgToBitmapAsset(asset as DialuxVectorAsset));
        } else {
            finalizedAssets.push(asset);
        }
    }

    return finalizedAssets;
}
