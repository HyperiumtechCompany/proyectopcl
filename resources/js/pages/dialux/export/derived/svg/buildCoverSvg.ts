import type { DialuxExportSnapshot, DialuxVectorAsset } from '../../domain/types';
import { buildSceneBounds, createTransform, transformPoint } from '../geometry/transforms';
import { escapeXml } from '../geometry/renderPrimitives';

export function buildFormalCoverSvg(snapshot: DialuxExportSnapshot): DialuxVectorAsset {
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
