import type { DxfEntity } from '@/pages/dialux/hooks/useEditorStore';
import type { Transform } from '../geometry/transforms';
import { transformPoint, dxfToMeters } from '../geometry/transforms';
import { escapeXml, renderPolyline, renderArcPath } from '../geometry/renderPrimitives';

export function renderDxfEntity(
    entity: DxfEntity,
    transform: Transform,
    scaleConfig: import('@/pages/dialux/hooks/useEditorStore').ScaleConfig,
): string {
    // effective factor to convert DXF raw coords → meters
    const dxfScale = scaleConfig.factor * (scaleConfig.calibrationFactor ?? 1);

    switch (entity.type) {
        case 'line': {
            const start = transformPoint(transform, dxfToMeters(entity.x1, entity.y1, dxfScale));
            const end = transformPoint(transform, dxfToMeters(entity.x2, entity.y2, dxfScale));
            return `<line x1="${start.x.toFixed(2)}" y1="${start.y.toFixed(2)}" x2="${end.x.toFixed(2)}" y2="${end.y.toFixed(2)}" stroke="#1e293b" stroke-width="1.5" />`;
        }
        case 'polyline':
        case 'polygon':
        case 'solid': {
            const vertices = entity.vertices.map(([x, y]) => dxfToMeters(x, y, dxfScale));
            return renderPolyline(vertices, transform, {
                stroke: '#1e293b',
                strokeWidth: 1.5,
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
                strokeWidth: 1.5,
                fill: 'none',
                closed: true,
            });
        }
        case 'circle': {
            const center = transformPoint(transform, dxfToMeters(entity.cx, entity.cy, dxfScale));
            return `<circle cx="${center.x.toFixed(2)}" cy="${center.y.toFixed(2)}" r="${Math.max(1, entity.r * dxfScale * transform.scale).toFixed(2)}" fill="none" stroke="#1e293b" stroke-width="1.5" />`;
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
            return `<ellipse cx="${center.x.toFixed(2)}" cy="${center.y.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" fill="none" stroke="#1e293b" stroke-width="1.5" transform="rotate(${(-angleDeg).toFixed(2)} ${center.x.toFixed(2)} ${center.y.toFixed(2)})" />`;
        }
        case 'spline': {
            if (entity.control_points.length < 2) { return ''; }
            const vertices = entity.control_points.map(([x, y]) => dxfToMeters(x, y, dxfScale));
            return renderPolyline(vertices, transform, {
                stroke: '#1e293b',
                strokeWidth: 1.5,
                fill: 'none',
                closed: entity.closed,
            });
        }
        case 'text': {
            const point = transformPoint(transform, dxfToMeters(entity.x, entity.y, dxfScale));
            const rawSize = entity.height * dxfScale * transform.scale;
            const fontSize = Math.max(8, Math.min(rawSize, 40));
            const rotation = entity.rotation ?? 0;
            const rotAttr = rotation !== 0
                ? ` transform="rotate(${(-rotation).toFixed(2)} ${point.x.toFixed(2)} ${point.y.toFixed(2)})"`
                : '';
            return `<text x="${point.x.toFixed(2)}" y="${point.y.toFixed(2)}" fill="#1e293b" font-size="${fontSize.toFixed(1)}" font-family="sans-serif" font-weight="500"${rotAttr}>${escapeXml(entity.text)}</text>`;
        }
        case 'point': {
            const point = transformPoint(transform, dxfToMeters(entity.x, entity.y, dxfScale));
            return `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="2.5" fill="#1e293b" />`;
        }
        case 'hatch': {
            return entity.boundary_paths
                .map((path) =>
                    renderPolyline(
                        path.map(([x, y]) => dxfToMeters(x, y, dxfScale)),
                        transform,
                        {
                            stroke: '#1e293b',
                            strokeWidth: 1.0,
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
