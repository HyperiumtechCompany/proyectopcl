import { buildSimpleDxfDocument, type DxfLayerDef } from '@/pages/dialux/export/dxf/emitters/document';
import {
    dxfCircle,
    dxfLine,
    dxfPolyLines,
    dxfText,
    type DxfLines,
} from '@/pages/dialux/export/dxf/emitters/primitives';
import { siteLuminaires } from './siteLightingCalculation';
import { siteCircuitLengthM } from './siteNetworkBridge';
import { siteElementLoadW } from './siteOutputs';
import type { Point2D, SiteData, SiteElement, SiteElementType } from './types';

/**
 * Plano DXF de la Planta General (fase D1 de
 * `plan_pendientes_exterior_electrico_documentos.md`): la planta tal como se
 * dibujó — terreno, edificaciones, vías, espacios, cercos, alumbrado,
 * tomacorrientes, tableros, cableado y alimentadores — en METROS reales
 * (vértices × `terrainScaleM`, Y hacia arriba), una capa por especialidad,
 * con rótulos, un cuadro resumen (cantidades y metrado de cable) y marco.
 * DXF R12 con las primitivas de la exportación DXF de la V1. Respeta las
 * capas ocultas y los objetos ocultos del editor.
 */

export const SITE_DXF_LAYERS: DxfLayerDef[] = [
    { name: 'EMP-TERRENO', color: 8 },
    { name: 'EMP-EDIFICACION', color: 7 },
    { name: 'EMP-VIAS', color: 9 },
    { name: 'EMP-ESPACIOS', color: 3 },
    { name: 'EMP-CERCOS', color: 6 },
    { name: 'EMP-ALUMBRADO', color: 2 },
    { name: 'EMP-TOMAS', color: 4 },
    { name: 'EMP-TABLEROS', color: 1 },
    { name: 'EMP-CAJAS', color: 30 },
    { name: 'EMP-CABLEADO', color: 5 },
    { name: 'EMP-ALIMENTADORES', color: 1 },
    { name: 'EMP-TEXTO', color: 7 },
    { name: 'EMP-MARCO', color: 8 },
];

const LAYER_OF: Partial<Record<SiteElementType, string>> = {
    terrain: 'EMP-TERRENO',
    contour: 'EMP-TERRENO',
    spot_elevation: 'EMP-TERRENO',
    terrace_platform: 'EMP-TERRENO',
    building_block: 'EMP-EDIFICACION',
    canopy: 'EMP-EDIFICACION',
    street: 'EMP-VIAS',
    sidewalk: 'EMP-VIAS',
    parking: 'EMP-VIAS',
    ramp: 'EMP-VIAS',
    stair: 'EMP-VIAS',
    court: 'EMP-ESPACIOS',
    green_area: 'EMP-ESPACIOS',
    pool: 'EMP-ESPACIOS',
    tree: 'EMP-ESPACIOS',
    custom_zone: 'EMP-ESPACIOS',
    fence: 'EMP-CERCOS',
    gate: 'EMP-CERCOS',
    pole: 'EMP-ALUMBRADO',
    outlet: 'EMP-TOMAS',
    tg_location: 'EMP-TABLEROS',
    sub_panel: 'EMP-TABLEROS',
    ats: 'EMP-TABLEROS',
    generator: 'EMP-TABLEROS',
    transformer: 'EMP-TABLEROS',
    mt_cell_arrival: 'EMP-TABLEROS',
    mt_cell_protection: 'EMP-TABLEROS',
    mt_cell_transformation: 'EMP-TABLEROS',
    earth_pit: 'EMP-TABLEROS',
    pull_box: 'EMP-CAJAS',
    cable_vault: 'EMP-CAJAS',
};

export function siteDxfLayerOf(type: SiteElementType): string {
    return LAYER_OF[type] ?? 'EMP-ESPACIOS';
}

/** Tipos dibujados como polilínea ABIERTA. */
function isOpenPath(element: SiteElement): boolean {
    if (element.type === 'contour') return true;
    if (element.type === 'fence') {
        return element.config?.kind === 'fence' && element.config.closed === false;
    }
    return element.type === 'gate' && element.vertices.length === 2;
}

const centroid = (points: Point2D[]): Point2D => ({
    x: points.reduce((sum, v) => sum + v.x, 0) / Math.max(1, points.length),
    y: points.reduce((sum, v) => sum + v.y, 0) / Math.max(1, points.length),
});

export interface SiteDxfSummary {
    poles: number;
    lightingW: number;
    outlets: number;
    panels: number;
    /** Metrado de cable (m) por "tipo sección". */
    cableByType: Array<{ label: string; lengthM: number }>;
    feederLengthM: number;
}

export function summarizeSiteForDxf(site: SiteData): SiteDxfSummary {
    const elements = (site.elements ?? []).filter((element) => element.visible !== false);
    const scaleM = site.terrainScaleM || 1;
    const cable = new Map<string, number>();
    for (const circuit of site.circuits ?? []) {
        const label = `${circuit.conductorType ?? 'THW-90'} ${circuit.sectionMm2 ?? 2.5} mm2 (${circuit.wireLabel ?? `${circuit.wireCount} cond.`})`;
        cable.set(label, (cable.get(label) ?? 0) + siteCircuitLengthM(circuit, site.elements ?? [], scaleM));
    }
    return {
        poles: elements.filter((element) => element.type === 'pole').length,
        lightingW: elements
            .filter((element) => ['pole', 'gate', 'canopy'].includes(element.type))
            .reduce((sum, element) => sum + siteElementLoadW(element).watts, 0),
        outlets: elements.filter((element) => element.type === 'outlet').length,
        panels: elements.filter((element) => element.type === 'tg_location' || element.type === 'sub_panel').length,
        cableByType: [...cable.entries()]
            .map(([label, lengthM]) => ({ label, lengthM }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        feederLengthM: (site.feederPaths ?? []).reduce((sum, path) => sum + (path.calculatedLengthM || 0), 0),
    };
}

export function buildSiteDxf(site: SiteData, options: { projectName?: string } = {}): string {
    const scaleM = site.terrainScaleM || 1;
    const layerVisible = (element: SiteElement) => {
        const layer = site.layers?.find((candidate) => candidate.types.includes(element.type));
        return layer ? layer.visible : true;
    };
    const elements = (site.elements ?? []).filter(
        (element) => element.visible !== false && layerVisible(element) && element.vertices.length > 0,
    );
    // Plano (Y abajo) → metros con Y arriba.
    const M = (point: Point2D) => ({ x: point.x * scaleM, y: -point.y * scaleM });

    const all = elements.flatMap((element) => element.vertices.map(M));
    const bounds = all.length
        ? {
              minX: Math.min(...all.map((v) => v.x)),
              maxX: Math.max(...all.map((v) => v.x)),
              minY: Math.min(...all.map((v) => v.y)),
              maxY: Math.max(...all.map((v) => v.y)),
          }
        : { minX: 0, maxX: 10, minY: 0, maxY: 10 };
    const extent = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 10);
    /** Alto de texto: legible a la escala del plano completo. */
    const textH = Math.min(3, Math.max(0.25, extent / 180));
    const margin = textH * 6;
    const summary = summarizeSiteForDxf(site);
    const summaryLines = [
        'CUADRO RESUMEN',
        `Postes: ${summary.poles}  |  Potencia alumbrado: ${(summary.lightingW / 1000).toFixed(2)} kW`,
        `Tomacorrientes: ${summary.outlets}  |  Tableros: ${summary.panels}`,
        ...summary.cableByType.map((row) => `Cable ${row.label}: ${row.lengthM.toFixed(1)} m`),
        ...(summary.feederLengthM > 0 ? [`Alimentadores trazados: ${summary.feederLengthM.toFixed(1)} m`] : []),
        'Longitudes con recorrido, cotas y desperdicio (mismo metrado que Red y CT).',
    ];
    const tableWidth = textH * 34;
    const frame = {
        minX: bounds.minX - margin,
        minY: bounds.minY - margin - textH * 4,
        maxX: bounds.maxX + margin + tableWidth,
        maxY: bounds.maxY + margin + textH * 3,
    };
    const luminaires = siteLuminaires(site, new Map());

    return buildSimpleDxfDocument({
        layers: SITE_DXF_LAYERS,
        bounds: frame,
        insUnits: 6,
        renderEntities: (out: DxfLines) => {
            for (const element of elements) {
                renderElement(out, element, M, textH);
            }
            // Cabezas de luminaria (postes con brazo, portones, techados).
            for (const lum of luminaires) {
                if (!elements.some((element) => element.id === lum.poleId)) continue;
                dxfCircle(out, 'EMP-ALUMBRADO', lum.x, -lum.y, Math.max(0.12, textH * 0.3));
            }
            for (const circuit of site.circuits ?? []) {
                const points = circuit.waypoints.map(M);
                if (points.length < 2) continue;
                dxfPolyLines(out, 'EMP-CABLEADO', points, false);
                const mid = centroid(points.slice(Math.floor((points.length - 1) / 2), Math.floor((points.length - 1) / 2) + 2));
                dxfText(
                    out,
                    'EMP-CABLEADO',
                    mid.x,
                    mid.y + textH * 0.3,
                    textH * 0.6,
                    `${circuit.label ?? ''} ${circuit.sectionMm2 ?? 2.5}mm2`.trim(),
                );
            }
            for (const path of site.feederPaths ?? []) {
                const points = path.waypoints.map(M);
                if (points.length >= 2) dxfPolyLines(out, 'EMP-ALIMENTADORES', points, false);
            }
            // Marco, título y cuadro resumen.
            dxfPolyLines(
                out,
                'EMP-MARCO',
                [
                    { x: frame.minX, y: frame.minY },
                    { x: frame.maxX, y: frame.minY },
                    { x: frame.maxX, y: frame.maxY },
                    { x: frame.minX, y: frame.maxY },
                ],
                true,
            );
            dxfText(
                out,
                'EMP-TEXTO',
                frame.minX + textH,
                frame.maxY - textH * 2,
                textH * 1.6,
                `PLANTA GENERAL${options.projectName ? ` - ${options.projectName}` : ''} (m)`,
            );
            summaryLines.forEach((line, index) =>
                dxfText(
                    out,
                    'EMP-TEXTO',
                    bounds.maxX + margin * 0.5,
                    bounds.maxY - index * textH * 1.5,
                    index === 0 ? textH * 1.1 : textH * 0.8,
                    line,
                ),
            );
        },
    });
}

function renderElement(
    out: DxfLines,
    element: SiteElement,
    M: (point: Point2D) => Point2D,
    textH: number,
): void {
    const layer = siteDxfLayerOf(element.type);
    const points = element.vertices.map(M);
    const center = centroid(points);
    const symbolR = Math.max(0.2, textH * 0.5);
    switch (element.type) {
        case 'pole': {
            dxfCircle(out, layer, center.x, center.y, symbolR);
            const config = element.config?.kind === 'pole' ? element.config : undefined;
            if (config && config.armLengthM > 0) {
                // Misma convención que el cálculo: dirección en planta (sin a, cos a), Y abajo.
                const a = ((config.armDirectionDeg + (element.rotation ?? 0)) * Math.PI) / 180;
                dxfLine(
                    out,
                    layer,
                    center.x,
                    center.y,
                    center.x + Math.sin(a) * config.armLengthM,
                    center.y - Math.cos(a) * config.armLengthM,
                );
            }
            break;
        }
        case 'outlet':
            dxfCircle(out, layer, center.x, center.y, symbolR * 0.7);
            dxfLine(out, layer, center.x - symbolR, center.y, center.x + symbolR, center.y);
            break;
        case 'earth_pit':
            dxfCircle(out, layer, center.x, center.y, symbolR);
            dxfLine(out, layer, center.x - symbolR, center.y, center.x + symbolR, center.y);
            dxfLine(out, layer, center.x, center.y - symbolR, center.x, center.y + symbolR);
            break;
        case 'tree': {
            const radius = Math.max(
                0.3,
                Math.max(...points.map((v) => Math.hypot(v.x - center.x, v.y - center.y))),
            );
            dxfCircle(out, layer, center.x, center.y, radius);
            break;
        }
        default:
            if (points.length >= 2) dxfPolyLines(out, layer, points, !isOpenPath(element) && points.length >= 3);
            if (element.type === 'pull_box' || element.type === 'cable_vault') {
                const [a, , c] = points;
                if (a && c) dxfLine(out, layer, a.x, a.y, c.x, c.y);
            }
    }
    const label = element.label?.trim();
    if (!label) return;
    const isArea = points.length >= 3 && !isOpenPath(element);
    const small = ['pole', 'outlet', 'earth_pit', 'tree', 'pull_box'].includes(element.type);
    dxfText(
        out,
        'EMP-TEXTO',
        small ? center.x + symbolR * 1.3 : center.x - (label.length * textH * 0.3) / 2,
        small ? center.y + symbolR : center.y,
        isArea && !small ? textH : textH * 0.7,
        label,
    );
}
