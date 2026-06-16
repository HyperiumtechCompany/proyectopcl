import type { DialuxExportSnapshot, DialuxVectorAsset } from '../../domain/types';
import { escapeXml } from '../geometry/renderPrimitives';

export function buildChartSvg(snapshot: DialuxExportSnapshot): DialuxVectorAsset {
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
