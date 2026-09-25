import {
    calculateExactQuantity,
    calculateLumensRequired,
} from '@/pages/dialux/hooks/lightingCalculations';
import type { LuminairePhotometry } from '../lib/luminaireCatalog';
import { projectedPoleElement, PROJECTED_FOR_KEY } from './siteFixtureProjection';
import { calculateSiteLighting } from './siteLightingCalculation';
import type { Point2D, PoleConfig, SiteData, SiteElement, SiteElementType } from './types';

/**
 * Proyección de POSTES a lo largo de espacios LINEALES — calles, pasajes,
 * veredas/pasadizos, rampas y escaleras —, como el cálculo de alumbrado
 * público: los postes van en el borde, en fila, y lo que se decide es la
 * DISPOSICIÓN y la INTERDISTANCIA (no filas × columnas de una grilla).
 *
 *  1. Eje del espacio: rectángulo orientado de área mínima que lo contiene
 *     (calibres rotatorios sobre la envolvente convexa): largo L, ancho W.
 *  2. Disposición según la relación ancho / altura de montaje W/h (regla de
 *     diseño usual de alumbrado vial, REFERENCIAL, no normativa):
 *     W/h ≤ 1 → unilateral; 1 < W/h ≤ 1,5 → tresbolillo; W/h > 1,5 →
 *     bilateral pareada. Espacios peatonales (vereda, rampa, escalera):
 *     unilateral salvo que el usuario elija otra.
 *  3. Interdistancia: la MAYOR cantidad entre (a) separación máx. k·h (la
 *     misma regla k·h de la proyección de áreas) y (b) el método de lúmenes
 *     de la V1 (`calculateLumensRequired` / `calculateExactQuantity`, sin
 *     modificar). Reparto ½-1-1-½ a lo largo del eje. En rampas y escaleras,
 *     mínimo 2 postes (arranque y llegada).
 *  4. Verificación con el motor luminotécnico V1 (`calculateSiteLighting`)
 *     sobre esa superficie. Rampas y escaleras se evalúan sobre un plano
 *     horizontal a su cota media (aproximación declarada: la superficie real
 *     es inclinada).
 *
 * Los postes se ubican por defecto FUERA del borde, a `EDGE_OFFSET_M` (en la
 * berma / vereda / terreno junto a la vía, nunca sobre los peldaños o la
 * calzada), o dentro a esa distancia si el usuario lo elige; el brazo apunta
 * al eje del espacio.
 */

export type LinearArrangement = 'single' | 'staggered' | 'opposite';

export const LINEAR_SPACE_TYPES = new Set<SiteElementType>([
    'street',
    'sidewalk',
    'ramp',
    'stair',
]);
const PEDESTRIAN_TYPES = new Set<SiteElementType>(['sidewalk', 'ramp', 'stair']);
export const EDGE_OFFSET_M = 0.5;
export const DEFAULT_LINEAR_SPACING_TO_HEIGHT = 3;

export interface LinearAxis {
    /** Centro en metros. */
    center: Point2D;
    /** Unitario a lo largo del eje (largo) y perpendicular (ancho). */
    along: Point2D;
    across: Point2D;
    lengthM: number;
    widthM: number;
}

export interface LinearSuggestion {
    axis: LinearAxis;
    arrangement: LinearArrangement;
    /** Postes totales propuestos. */
    count: number;
    /** Por separación máx. k·h y por método de lúmenes. */
    bySpacing: number;
    byLumens: number;
    maxSpacingM: number;
    widthToHeight: number;
    /**
     * Área del polígono / área del rectángulo del eje (1 = recto). Por debajo
     * de `MIN_AXIS_FILL` (espacio en L, en U, curvo) el eje recto es solo
     * aproximado y la interfaz lo advierte.
     */
    axisFill: number;
    /** Ancho usado para la regla W/h (el declarado de la rampa/escalera si existe). */
    ruleWidthM: number;
}

export const MIN_AXIS_FILL = 0.8;

export interface LinearLayout {
    positions: Point2D[];
    /** Rumbo del brazo de cada poste (convención de `PoleConfig.armDirectionDeg`). */
    armDirectionsDeg: number[];
    /** Interdistancia entre postes consecutivos a lo largo del eje (m). */
    spacingM: number;
}

function convexHull(points: Point2D[]): Point2D[] {
    const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
    if (sorted.length < 3) return sorted;
    const cross = (o: Point2D, a: Point2D, b: Point2D) =>
        (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower: Point2D[] = [];
    for (const p of sorted) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
        lower.push(p);
    }
    const upper: Point2D[] = [];
    for (const p of [...sorted].reverse()) {
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
        upper.push(p);
    }
    return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Rectángulo orientado de área mínima (en metros) del polígono. */
export function linearAxisOf(element: SiteElement, scaleM: number): LinearAxis | null {
    const pts = element.vertices.map((v) => ({ x: v.x * scaleM, y: v.y * scaleM }));
    const hull = convexHull(pts);
    if (hull.length < 3) return null;
    let best: LinearAxis | null = null;
    let bestArea = Infinity;
    for (let i = 0; i < hull.length; i++) {
        const a = hull[i];
        const b = hull[(i + 1) % hull.length];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len < 1e-9) continue;
        const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
        const n = { x: -u.y, y: u.x };
        let minU = Infinity;
        let maxU = -Infinity;
        let minN = Infinity;
        let maxN = -Infinity;
        for (const p of hull) {
            const pu = p.x * u.x + p.y * u.y;
            const pn = p.x * n.x + p.y * n.y;
            minU = Math.min(minU, pu);
            maxU = Math.max(maxU, pu);
            minN = Math.min(minN, pn);
            maxN = Math.max(maxN, pn);
        }
        const area = (maxU - minU) * (maxN - minN);
        if (area < bestArea - 1e-9) {
            bestArea = area;
            const cu = (minU + maxU) / 2;
            const cn = (minN + maxN) / 2;
            const center = { x: u.x * cu + n.x * cn, y: u.y * cu + n.y * cn };
            const du = maxU - minU;
            const dn = maxN - minN;
            best =
                du >= dn
                    ? { center, along: u, across: n, lengthM: du, widthM: dn }
                    : { center, along: n, across: { x: -u.x, y: -u.y }, lengthM: dn, widthM: du };
        }
    }
    return best;
}

/** Disposición de referencia por W/h (ver cabecera). */
export function arrangementFor(type: SiteElementType, widthToHeight: number): LinearArrangement {
    if (PEDESTRIAN_TYPES.has(type)) return 'single';
    if (widthToHeight <= 1) return 'single';
    if (widthToHeight <= 1.5) return 'staggered';
    return 'opposite';
}

function polygonAreaM2(vertices: Point2D[], scaleM: number): number {
    let twice = 0;
    for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i];
        const b = vertices[(i + 1) % vertices.length];
        twice += a.x * b.y - b.x * a.y;
    }
    return (Math.abs(twice) / 2) * scaleM * scaleM;
}

export function suggestLinearPoles(input: {
    site: SiteData;
    areaId: string;
    targetLux: number;
    lumensEach: number;
    maintenanceFactor: number;
    mountingHeightM: number;
    spacingToHeight?: number;
    arrangement?: LinearArrangement;
    utilizationFactor?: number;
}): LinearSuggestion | null {
    const element = (input.site.elements ?? []).find((item) => item.id === input.areaId);
    if (!element || !LINEAR_SPACE_TYPES.has(element.type) || element.vertices.length < 3) {
        return null;
    }
    const scaleM = input.site.terrainScaleM || 1;
    const axis = linearAxisOf(element, scaleM);
    if (!axis || axis.lengthM <= 0) return null;
    const h = Math.max(0.5, input.mountingHeightM);
    // Rampa/escalera: su ancho de paso declarado (en L/U el rectángulo del eje
    // no representa el ancho real de cada tramo).
    const declaredWidth =
        element.config?.kind === 'ramp' || element.config?.kind === 'stair'
            ? element.config.widthM
            : undefined;
    const ruleWidthM = declaredWidth && declaredWidth > 0 ? declaredWidth : axis.widthM;
    const widthToHeight = ruleWidthM / h;
    const axisFill =
        axis.lengthM * axis.widthM > 0
            ? polygonAreaM2(element.vertices, scaleM) / (axis.lengthM * axis.widthM)
            : 1;
    const arrangement = input.arrangement ?? arrangementFor(element.type, widthToHeight);
    const maxSpacingM = h * (input.spacingToHeight ?? DEFAULT_LINEAR_SPACING_TO_HEIGHT);
    // Separación medida entre postes CONSECUTIVOS a lo largo del eje; en la
    // pareada cada "posición" lleva 2 postes enfrentados.
    const positionsBySpacing = Math.max(1, Math.ceil(axis.lengthM / maxSpacingM));
    const perPosition = arrangement === 'opposite' ? 2 : 1;
    const minimum = element.type === 'ramp' || element.type === 'stair' ? 2 : 1;
    const bySpacing = Math.max(minimum, positionsBySpacing * perPosition);
    const byLumens = Math.max(
        1,
        Math.ceil(
            calculateExactQuantity(
                calculateLumensRequired(
                    polygonAreaM2(element.vertices, scaleM),
                    Math.max(0, input.targetLux),
                    {
                        maintenanceFactor: input.maintenanceFactor,
                        utilizationFactor: input.utilizationFactor ?? 0.8,
                    },
                ),
                Math.max(1, input.lumensEach),
            ),
        ),
    );
    let count = Math.max(bySpacing, byLumens);
    if (arrangement === 'opposite' && count % 2 === 1) count += 1;
    return {
        axis,
        arrangement,
        count,
        bySpacing,
        byLumens,
        maxSpacingM,
        widthToHeight,
        axisFill,
        ruleWidthM,
    };
}

/**
 * Posiciones (coordenadas de PLANO) de `count` postes con la disposición dada:
 * reparto ½-1-1-½ a lo largo del eje, a `EDGE_OFFSET_M` del borde, con el brazo
 * hacia el eje. `side` elige el borde en la unilateral (1 = el opuesto).
 */
export function linearPolePositions(input: {
    axis: LinearAxis;
    arrangement: LinearArrangement;
    count: number;
    scaleM: number;
    side?: 0 | 1;
    /** 'outside' (por defecto) = junto al borde, por fuera; 'inside' = dentro del espacio. */
    placement?: 'outside' | 'inside';
}): LinearLayout {
    const { axis, arrangement, scaleM } = input;
    const count = Math.max(1, Math.round(input.count));
    const positionsAlong = arrangement === 'opposite' ? Math.ceil(count / 2) : count;
    const step = axis.lengthM / positionsAlong;
    const offset =
        input.placement === 'inside'
            ? Math.max(0, axis.widthM / 2 - EDGE_OFFSET_M)
            : axis.widthM / 2 + EDGE_OFFSET_M;
    const sideSign = (side: 0 | 1) => (side === 0 ? -1 : 1);
    const positions: Point2D[] = [];
    const armDirectionsDeg: number[] = [];
    const push = (t: number, side: 0 | 1) => {
        const s = sideSign(side);
        const x = axis.center.x + axis.along.x * t + axis.across.x * offset * s;
        const y = axis.center.y + axis.along.y * t + axis.across.y * offset * s;
        positions.push({ x: x / scaleM, y: y / scaleM });
        // Brazo hacia el eje: dirección −s·across (convención atan2(dx, dy)).
        const dx = -axis.across.x * s;
        const dy = -axis.across.y * s;
        armDirectionsDeg.push((Math.atan2(dx, dy) * 180) / Math.PI);
    };
    for (let i = 0; i < positionsAlong; i++) {
        const t = -axis.lengthM / 2 + (i + 0.5) * step;
        if (arrangement === 'single') {
            push(t, input.side ?? 0);
        } else if (arrangement === 'staggered') {
            push(t, (i % 2) as 0 | 1);
        } else {
            push(t, 0);
            if (positions.length < count) push(t, 1);
        }
    }
    return { positions, armDirectionsDeg, spacingM: step };
}

export interface LinearPreviewMetrics {
    warnings: string[];
    count: number;
    avgLux: number;
    minLux: number;
    uniformity: number;
    spacingM: number;
}

/**
 * Evalúa una disposición con el motor V1 (solo esa superficie). Rampas y
 * escaleras las evalúa el propio motor a su cota media (aproximación
 * declarada en sus avisos, `inclinedSurfaceElevationM`).
 */
export function evaluateLinearPoles(input: {
    site: SiteData;
    areaId: string;
    layout: LinearLayout;
    pole: PoleConfig;
    photometry: ReadonlyMap<number, LuminairePhotometry>;
}): LinearPreviewMetrics | null {
    const elements = input.site.elements ?? [];
    const area = elements.find((element) => element.id === input.areaId);
    if (!area) return null;
    const trial: SiteData = {
        ...input.site,
        elements: [
            ...elements
                .filter((element) => element.metadata?.[PROJECTED_FOR_KEY] !== input.areaId),
            ...input.layout.positions.map((point, index) =>
                projectedPoleElement(
                    `__linear_${index}`,
                    point,
                    { ...input.pole, armDirectionDeg: input.layout.armDirectionsDeg[index] ?? 0 },
                    input.areaId,
                ),
            ),
        ],
    };
    const calculation = calculateSiteLighting(trial, input.photometry, new Set([input.areaId]));
    const result = calculation.areas[0];
    return {
        count: input.layout.positions.length,
        avgLux: result?.result.avg_lux ?? 0,
        minLux: result?.result.min_lux ?? 0,
        uniformity: result?.result.uniformity ?? 0,
        spacingM: input.layout.spacingM,
        // Avisos del motor (postes bajo el plano, sin fotometría, superficie
        // inclinada): explican un Ēm bajo o nulo.
        warnings: calculation.warnings,
    };
}
