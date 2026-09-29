import { circuitColor, circuitRuns, circuitRunTag } from '../domain/circuitRuns';
import { luxColor } from '../domain/exteriorLighting';
import { calcOutlines } from '../domain/rampFootprint';
import type { SiteLightingCalculation } from '../domain/siteLightingCalculation';
import { siteLuminaires } from '../domain/siteLightingCalculation';
import { requiredLuxFor } from '../domain/siteLightingNorms';
import type { Point2D, SiteData, SiteElement, SiteNormRegion } from '../domain/types';
import { resolveWireEndpoints } from '../domain/wireAnchors';
import { offsetPolyline, wireBundleLanes } from '../domain/wireBundles';
import { isoluxSvgFragments, svgClipToPolygons } from './isoluxSvg';

/**
 * Plano vectorial (SVG) de la Planta General para el informe PDF (D2): en
 * METROS (vértices × `terrainScaleM`, Y hacia abajo como en el editor), con
 * los colores de cada objeto, postes, cables y rótulos. Con `calculation`
 * superpone los falsos colores del motor V1 — un parche por cota
 * (`area.patches`) — y su leyenda, con la MISMA escala que el 2D y el 3D.
 */

const LEGEND_STOPS = [0, 1, 5, 10, 20, 50, 100];
/** Objetos puntuales que se dibujan como símbolo pequeño, no con su huella de dibujo. */
const SMALL_SYMBOL_TYPES = new Set<SiteElement['type']>(['pull_box', 'cable_vault', 'earth_pit']);
const POINT_TYPES = new Set<SiteElement['type']>([
    'pole',
    'outlet',
    'earth_pit',
    'tg_location',
    'sub_panel',
    'ats',
    'transformer',
    'generator',
    'pull_box',
    'cable_vault',
]);

const escapeXml = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Color de la escala de lux como atributos SVG (rgb + opacidad: no todos los visores leen rgba). */
function luxFill(lux: number): string {
    const [r, g, b, a] = luxColor(lux);
    return `fill="rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})" fill-opacity="${Math.max(0.35, a).toFixed(2)}"`;
}

const isOpen = (element: SiteElement) =>
    element.type === 'contour' ||
    (element.type === 'fence' && element.config?.kind === 'fence' && element.config.closed === false) ||
    (element.type === 'gate' && element.vertices.length === 2);

export interface SiteSvgPlan {
    svg: string;
    width: number;
    height: number;
}

export function renderSitePlanSvg(
    site: SiteData,
    options: {
        calculation?: SiteLightingCalculation | null;
        title?: string;
        /** Regiones normativas activas (curva del Ē exigido por espacio). */
        regions?: SiteNormRegion[];
    } = {},
): SiteSvgPlan {
    const scaleM = site.terrainScaleM || 1;
    const layerVisible = (element: SiteElement) => {
        const layer = site.layers?.find((candidate) => candidate.types.includes(element.type));
        return layer ? layer.visible : true;
    };
    const elements = (site.elements ?? []).filter(
        (element) => element.visible !== false && layerVisible(element) && element.vertices.length > 0,
    );
    const M = (p: Point2D) => ({ x: p.x * scaleM, y: p.y * scaleM });
    const all = elements.flatMap((element) => element.vertices.map(M));
    const minX = all.length ? Math.min(...all.map((p) => p.x)) : 0;
    const minY = all.length ? Math.min(...all.map((p) => p.y)) : 0;
    const maxX = all.length ? Math.max(...all.map((p) => p.x)) : 10;
    const maxY = all.length ? Math.max(...all.map((p) => p.y)) : 10;
    const extent = Math.max(maxX - minX, maxY - minY, 10);
    const margin = extent * 0.04;
    const textH = Math.min(3, Math.max(0.4, extent / 110));
    const legendW = options.calculation ? extent * 0.16 : 0;
    const vb = {
        x: minX - margin,
        y: minY - margin - (options.title ? textH * 3 : 0),
        w: maxX - minX + margin * 2 + legendW,
        h: maxY - minY + margin * 2 + (options.title ? textH * 3 : 0),
    };
    const parts: string[] = [`<rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="#ffffff"/>`];
    const pts = (points: Point2D[]) => points.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(' ');
    const stroke = extent / 900;

    // Áreas primero (las de mayor tamaño debajo), luego lo puntual.
    const byArea = [...elements].sort((a, b) => spread(b) - spread(a));
    for (const element of byArea) {
        if (POINT_TYPES.has(element.type) || element.type === 'tree') continue;
        const points = element.vertices.map(M);
        const fill = element.style?.fillColor ?? '#e2e8f0';
        const line = element.style?.strokeColor ?? '#475569';
        parts.push(
            isOpen(element) || points.length < 3
                ? `<polyline points="${pts(points)}" fill="none" stroke="${line}" stroke-width="${stroke * 2}"/>`
                : `<polygon points="${pts(points)}" fill="${fill}" fill-opacity="0.55" stroke="${line}" stroke-width="${stroke}"/>`,
        );
    }

    // Falsos colores del motor V1 (un parche por cota).
    if (options.calculation) {
        for (const area of options.calculation.areas) {
            // Recortado al contorno del espacio (nada fuera de lo calculado).
            const areaElement = (site.elements ?? []).find((element) => element.id === area.elementId);
            const outlines = areaElement ? calcOutlines(areaElement, scaleM).map((polygon) => polygon.map(M)) : [];
            const clip = svgClipToPolygons(outlines);
            if (clip.def) parts.push(clip.def, `<g${clip.attr}>`);
            for (const patch of area.patches) {
                const r = patch.result;
                const ox = r.grid_origin_x ?? 0;
                const oy = r.grid_origin_y ?? 0;
                const cw = r.grid_cell_width ?? 0;
                const ch = r.grid_cell_height ?? 0;
                if (cw <= 0 || ch <= 0) continue;
                r.grid_values.forEach((value, index) => {
                    if (value === null) return;
                    const row = Math.floor(index / r.grid_cols);
                    const col = index % r.grid_cols;
                    parts.push(
                        `<rect x="${(ox + col * cw).toFixed(3)}" y="${(oy + row * ch).toFixed(3)}" width="${cw.toFixed(3)}" height="${ch.toFixed(3)}" ${luxFill(value)}/>`,
                    );
                });
            }
            if (clip.def) parts.push('</g>');
        }
    }

    if (options.calculation) {
        // Curvas POR ESPACIO, cada uno con sus niveles y la curva de su norma.
        const regions = options.regions ?? [];
        for (const area of options.calculation.areas) {
            const element = (site.elements ?? []).find((item) => item.id === area.elementId);
            parts.push(
                isoluxSvgFragments(
                    area.patches.map((patch) => patch.result),
                    stroke * 1.2,
                    textH * 0.7,
                    requiredLuxFor(element, regions, area.summary)?.lux ?? null,
                    element ? calcOutlines(element, scaleM).map((polygon) => polygon.map(M)) : undefined,
                ),
            );
        }
    }
    // Cables con sus extremos EN VIVO y el color de su salida (TG-1·2…),
    // rotulados en su tramo más largo: se distingue cada salida en el plano.
    const runs = circuitRuns(site);
    const byId = (id: string) => (site.elements ?? []).find((element) => element.id === id);
    const tags: string[] = [];
    const wires = (site.circuits ?? []).map((circuit) => ({
        circuit,
        points: resolveWireEndpoints(
            circuit.waypoints,
            circuit.sourceId,
            circuit.targetId,
            byId,
            scaleM,
            circuit.tgOutputId,
            site.elements ?? [],
        ).map(M),
    }));
    // Cables por la misma zanja/cajas: en paralelo, cada salida visible con su color.
    const lanes = wireBundleLanes(wires.map((wire) => ({ id: wire.circuit.id, points: wire.points })));
    for (const { circuit, points: centerline } of wires) {
        const circuitLanes = lanes.get(circuit.id);
        const points = offsetPolyline(centerline, circuitLanes, stroke * 3);
        if (points.length < 2) continue;
        const run = runs.get(circuit.id);
        const color = circuitColor(circuit, run, '#0e7490');
        parts.push(`<polyline points="${pts(points)}" fill="none" stroke="${color}" stroke-width="${stroke * 1.6}"/>`);
        const tag = circuitRunTag(run);
        if (!tag) continue;
        let best = { length: 0, x: 0, y: 0 };
        for (let k = 1; k < points.length; k++) {
            const length = Math.hypot(points[k].x - points[k - 1].x, points[k].y - points[k - 1].y);
            // En un haz, cada rótulo en otro punto del tramo (no se tapan).
            const t = 0.5 + Math.max(-0.35, Math.min(0.35, (circuitLanes?.[k - 1]?.lane ?? 0) * 0.22));
            if (length > best.length) {
                best = {
                    length,
                    x: points[k - 1].x + (points[k].x - points[k - 1].x) * t,
                    y: points[k - 1].y + (points[k].y - points[k - 1].y) * t,
                };
            }
        }
        const size = textH * 0.5;
        const w = size * 0.62 * tag.length + size * 0.6;
        if (best.length < w) continue;
        // Etiqueta con fondo blanco y borde del color de la salida: legible sobre cualquier fondo.
        tags.push(
            `<rect x="${(best.x - w / 2).toFixed(3)}" y="${(best.y - size * 0.75).toFixed(3)}" width="${w.toFixed(3)}" height="${(size * 1.5).toFixed(3)}" rx="${(size * 0.3).toFixed(3)}" fill="#ffffff" stroke="${color}" stroke-width="${(stroke * 1.2).toFixed(3)}"/>` +
                `<text x="${best.x.toFixed(3)}" y="${(best.y + size * 0.35).toFixed(3)}" font-size="${size.toFixed(3)}" font-weight="bold" font-family="Arial, sans-serif" text-anchor="middle" fill="#0f172a">${escapeXml(tag)}</text>`,
        );
    }
    parts.push(...tags);
    for (const path of site.feederPaths ?? []) {
        const points = path.waypoints.map(M);
        if (points.length >= 2) {
            parts.push(`<polyline points="${pts(points)}" fill="none" stroke="#b91c1c" stroke-width="${stroke * 2.2}"/>`);
        }
    }

    const symbolR = Math.max(0.2, textH * 0.45);
    for (const element of elements) {
        if (!POINT_TYPES.has(element.type) && element.type !== 'tree') continue;
        const c = centerOf(element.vertices.map(M));
        const color = element.style?.strokeColor ?? '#1e293b';
        if (element.type === 'pole') {
            parts.push(`<circle cx="${c.x}" cy="${c.y}" r="${symbolR}" fill="#facc15" stroke="#854d0e" stroke-width="${stroke}"/>`);
        } else if (element.type === 'outlet') {
            parts.push(`<circle cx="${c.x}" cy="${c.y}" r="${symbolR * 0.7}" fill="#fff" stroke="#1d4ed8" stroke-width="${stroke}"/>`);
        } else if (element.type === 'tree') {
            parts.push(`<circle cx="${c.x}" cy="${c.y}" r="${Math.max(symbolR, spreadRadius(element, scaleM))}" fill="#16a34a" fill-opacity="0.35" stroke="#166534" stroke-width="${stroke}"/>`);
        } else if (SMALL_SYMBOL_TYPES.has(element.type)) {
            // Caja de pase / buzón / pozo a tierra: símbolo pequeño (su huella
            // de dibujo es simbólica, ~3 m, y tapaba el plano).
            const half = symbolR * (element.type === 'cable_vault' ? 0.8 : 0.6);
            const fill = element.style?.fillColor ?? '#e2e8f0';
            parts.push(
                element.type === 'earth_pit'
                    ? `<circle cx="${c.x}" cy="${c.y}" r="${half}" fill="${fill}" stroke="${color}" stroke-width="${stroke}"/><line x1="${c.x - half * 0.6}" y1="${c.y}" x2="${c.x + half * 0.6}" y2="${c.y}" stroke="${color}" stroke-width="${stroke}"/>`
                    : `<rect x="${c.x - half}" y="${c.y - half}" width="${half * 2}" height="${half * 2}" fill="${fill}" stroke="${color}" stroke-width="${stroke}"/>`,
            );
        } else {
            parts.push(`<polygon points="${pts(element.vertices.map(M))}" fill="${element.style?.fillColor ?? '#fecaca'}" stroke="${color}" stroke-width="${stroke}"/>`);
        }
    }
    for (const lum of siteLuminaires(site, new Map())) {
        parts.push(`<circle cx="${lum.x}" cy="${lum.y}" r="${symbolR * 0.45}" fill="#f59e0b"/>`);
    }

    // Rótulos.
    for (const element of elements) {
        const label = element.label?.trim();
        if (!label || element.type === 'contour') continue;
        const c = centerOf(element.vertices.map(M));
        const point = POINT_TYPES.has(element.type) || element.type === 'tree';
        const size = point ? textH * 0.6 : textH;
        parts.push(
            `<text x="${(point ? c.x + symbolR * 1.3 : c.x).toFixed(3)}" y="${(point ? c.y - symbolR : c.y).toFixed(3)}" font-size="${size}" font-family="Arial, sans-serif" fill="#0f172a"${point ? '' : ' text-anchor="middle"'}>${escapeXml(label)}</text>`,
        );
    }

    if (options.title) {
        parts.push(
            `<text x="${vb.x + margin}" y="${vb.y + textH * 2}" font-size="${textH * 1.4}" font-weight="bold" font-family="Arial, sans-serif">${escapeXml(options.title)}</text>`,
        );
    }
    if (options.calculation) {
        const lx = maxX + margin * 1.5;
        const ly = minY + textH;
        parts.push(`<text x="${lx}" y="${ly}" font-size="${textH * 0.8}" font-weight="bold" font-family="Arial, sans-serif">Iluminancia (lx)</text>`);
        LEGEND_STOPS.forEach((lux, index) => {
            const y = ly + textH * (1.2 + index * 1.3);
            parts.push(
                `<rect x="${lx}" y="${y}" width="${textH * 1.6}" height="${textH}" ${luxFill(lux)} stroke="#334155" stroke-width="${stroke}"/>`,
                `<text x="${lx + textH * 2}" y="${y + textH * 0.85}" font-size="${textH * 0.75}" font-family="Arial, sans-serif">${index === LEGEND_STOPS.length - 1 ? `≥ ${lux}` : lux}</text>`,
            );
        });
    }
    // Escala gráfica de 10 m (o 50 m en terrenos grandes).
    const barM = extent > 300 ? 50 : 10;
    const bx = minX;
    const by = maxY + margin * 0.6;
    parts.push(
        `<line x1="${bx}" y1="${by}" x2="${bx + barM}" y2="${by}" stroke="#0f172a" stroke-width="${stroke * 3}"/>`,
        `<text x="${bx}" y="${by - textH * 0.3}" font-size="${textH * 0.7}" font-family="Arial, sans-serif">0</text>`,
        `<text x="${bx + barM}" y="${by - textH * 0.3}" font-size="${textH * 0.7}" font-family="Arial, sans-serif">${barM} m</text>`,
    );

    const width = Math.round(vb.w * 10);
    const height = Math.round(vb.h * 10);
    return {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${vb.x.toFixed(3)} ${vb.y.toFixed(3)} ${vb.w.toFixed(3)} ${vb.h.toFixed(3)}">${parts.join('')}</svg>`,
        width,
        height,
    };
}

function centerOf(points: Point2D[]): Point2D {
    return {
        x: points.reduce((sum, p) => sum + p.x, 0) / Math.max(1, points.length),
        y: points.reduce((sum, p) => sum + p.y, 0) / Math.max(1, points.length),
    };
}

function spread(element: SiteElement): number {
    const xs = element.vertices.map((v) => v.x);
    const ys = element.vertices.map((v) => v.y);
    return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
}

function spreadRadius(element: SiteElement, scaleM: number): number {
    const xs = element.vertices.map((v) => v.x);
    return ((Math.max(...xs) - Math.min(...xs)) * scaleM) / 2;
}
