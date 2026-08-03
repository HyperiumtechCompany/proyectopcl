import type { DialuxExportSnapshot, DialuxVectorAsset } from '../../domain/types';
import { buildSceneBounds, createTransform } from '../geometry/transforms';
import { renderDxfEntity } from './renderDxfEntity';
import { pickSvgPageDimensions, renderNorthArrow } from '../geometry/renderPrimitives';

export function buildCadOverviewSvg(
    snapshot: DialuxExportSnapshot,
): DialuxVectorAsset {
    // Always include DXF extents so the full plan is visible
    const bounds = buildSceneBounds(snapshot, undefined, true);
    const MARGIN = 36;
    
    // Dynamically adjust SVG aspect ratio to fit the scene bounds
    const boundsWidth = Math.max(1, bounds.maxX - bounds.minX);
    const boundsHeight = Math.max(1, bounds.maxY - bounds.minY);
    const ratio = boundsWidth / boundsHeight;
    
    const { width: W, height: H } = pickSvgPageDimensions(ratio);

    // Padding dinámico (6% del menor lado)
    const padding = Math.max(48, Math.min(W, H) * 0.06);
    
    const transform = createTransform(bounds, W, H, padding);

    const dxfMarkup = snapshot.dxfEntities
        .map((entity) => renderDxfEntity(entity, transform, snapshot.scaleConfig))
        .join('');

    const hasDxf = snapshot.dxfEntities.length > 0;
    
    const dxfOverlay = hasDxf
        ? `<g id="dxf-layer" opacity="1">${dxfMarkup}</g>`
        : '';
    const emptyPlaceholder = !hasDxf
        ? `<text x="${W / 2}" y="${H / 2}" fill="#94a3b8" font-size="18" font-family="sans-serif" text-anchor="middle">Sin plano CAD importado o vectorizado</text>`
        : '';

    // Scale bar: compute 1m in SVG pixels
    const oneMeterPx = transform.scale; // px per meter
    // Select optimal scale bar length (1m, 2m, 5m, 10m, 20m, 50m)
    const targetPx = 150; // ideal width in pixels
    const targetMeters = targetPx / oneMeterPx;
    const steps = [1, 2, 5, 10, 20, 50, 100];
    let barMeters = 1;
    for (const step of steps) {
        if (targetMeters >= step) barMeters = step;
        else break;
    }
    const barLenPx = barMeters * oneMeterPx;
    
    const barX = MARGIN + 8;
    const barY = H - MARGIN - 14;

    const scaleBarMarkup = `
        <line x1="${barX}" y1="${barY}" x2="${(barX + barLenPx).toFixed(1)}" y2="${barY}" stroke="#334155" stroke-width="2" stroke-linecap="square"/>
        <line x1="${barX}" y1="${(barY - 5)}" x2="${barX}" y2="${(barY + 5)}" stroke="#334155" stroke-width="1.5"/>
        <line x1="${(barX + barLenPx).toFixed(1)}" y1="${(barY - 5)}" x2="${(barX + barLenPx).toFixed(1)}" y2="${(barY + 5)}" stroke="#334155" stroke-width="1.5"/>
        <text x="${(barX + barLenPx / 2).toFixed(1)}" y="${(barY - 8)}" fill="#334155" font-size="10" font-family="sans-serif" text-anchor="middle">${barMeters} m</text>`;

    // North arrow (top-right corner)
    const northArrow = renderNorthArrow({
        x: W - MARGIN - 24,
        y: MARGIN + 52,
    });

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
        <rect width="${W}" height="${H}" fill="#ffffff"/>
        ${dxfOverlay}
        ${emptyPlaceholder}
        ${scaleBarMarkup}
        ${northArrow}
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
