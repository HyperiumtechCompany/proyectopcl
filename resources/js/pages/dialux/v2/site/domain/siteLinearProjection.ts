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
    /** Bordes reales (null si no se detectaron los dos extremos: se usa el eje recto). */
    sides: LinearSides | null;
    /** Largo del recorrido usado para la separación (m). */
    runLengthM: number;
}

export const MIN_AXIS_FILL = 0.8;

/**
 * Los dos BORDES LARGOS reales del espacio (en metros), separados por sus dos
 * extremos: lo que permite proyectar postes que SIGUEN la vereda/calle aunque
 * sea en L, en U o curva (el eje recto del rectángulo mínimo no lo hace).
 */
export interface LinearSides {
    /** Polígono en metros. */
    polygon: Point2D[];
    /** Borde A y borde B como polilíneas (metros), de un extremo al otro. */
    chains: [Point2D[], Point2D[]];
    lengths: [number, number];
    /** Ancho efectivo 2·Área/Perímetro (≈ ancho de un corredor largo). */
    widthM: number;
    /** +1 si el polígono tiene área con signo positiva (define la normal exterior). */
    orientation: 1 | -1;
}

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

const polylineLength = (points: Point2D[]) =>
    points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);

/**
 * Detecta los dos extremos del espacio (lados cortos, ≤ 1,6 × ancho
 * efectivo, con los puntos medios más alejados entre sí) y devuelve los dos
 * bordes largos que quedan entre ellos. En un rectángulo: los dos lados
 * largos. `null` si no hay dos extremos reconocibles.
 */
export function linearSidesOf(element: SiteElement, scaleM: number): LinearSides | null {
    const raw = element.vertices.map((v) => ({ x: v.x * scaleM, y: v.y * scaleM }));
    const polygon = raw.filter((p, i) => {
        const next = raw[(i + 1) % raw.length];
        return Math.hypot(next.x - p.x, next.y - p.y) > 1e-6;
    });
    const n = polygon.length;
    if (n < 4) return null;
    let twice = 0;
    for (let i = 0; i < n; i++) {
        const a = polygon[i];
        const b = polygon[(i + 1) % n];
        twice += a.x * b.y - b.x * a.y;
    }
    const area = Math.abs(twice) / 2;
    const edgeLength = (i: number) => {
        const a = polygon[i];
        const b = polygon[(i + 1) % n];
        return Math.hypot(b.x - a.x, b.y - a.y);
    };
    const perimeter = polygon.reduce((sum, _, i) => sum + edgeLength(i), 0);
    if (!(area > 0) || !(perimeter > 0)) return null;
    const widthM = (2 * area) / perimeter;
    const mid = (i: number) => ({
        x: (polygon[i].x + polygon[(i + 1) % n].x) / 2,
        y: (polygon[i].y + polygon[(i + 1) % n].y) / 2,
    });
    const candidates = polygon.map((_, i) => i).filter((i) => edgeLength(i) <= 1.6 * widthM);
    let best: [number, number] | null = null;
    let bestDistance = -1;
    for (let a = 0; a < candidates.length; a++) {
        for (let b = a + 1; b < candidates.length; b++) {
            const pa = mid(candidates[a]);
            const pb = mid(candidates[b]);
            const d = Math.hypot(pa.x - pb.x, pa.y - pb.y);
            if (d > bestDistance) {
                bestDistance = d;
                best = [candidates[a], candidates[b]];
            }
        }
    }
    if (!best) return null;
    const [i, j] = best;
    // Borde A: del final del extremo i al inicio del extremo j; B: el resto.
    const walk = (from: number, to: number) => {
        const chain: Point2D[] = [];
        for (let k = from; ; k = (k + 1) % n) {
            chain.push(polygon[k]);
            if (k === to) break;
        }
        return chain;
    };
    const chainA = walk((i + 1) % n, j);
    const chainB = walk((j + 1) % n, i);
    if (chainA.length < 2 || chainB.length < 2) return null;
    return {
        polygon,
        chains: [chainA, chainB],
        lengths: [polylineLength(chainA), polylineLength(chainB)],
        widthM,
        orientation: twice > 0 ? 1 : -1,
    };
}

/** Punto a `distance` m a lo largo de una polilínea + normal EXTERIOR del tramo donde cae. */
function pointOnSide(
    chain: Point2D[],
    distance: number,
    orientation: 1 | -1,
): { point: Point2D; outward: Point2D } {
    let left = Math.max(0, distance);
    for (let k = 0; k < chain.length - 1; k++) {
        const a = chain[k];
        const b = chain[k + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        if (len <= 1e-9) continue;
        if (left <= len || k === chain.length - 2) {
            const t = Math.min(1, left / len);
            const dx = (b.x - a.x) / len;
            const dy = (b.y - a.y) / len;
            // Polígono de área con signo positiva: la normal exterior de a→b es (dy, −dx).
            const outward = orientation === 1 ? { x: dy, y: -dx } : { x: -dy, y: dx };
            return { point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, outward };
        }
        left -= len;
    }
    return { point: chain[chain.length - 1], outward: { x: 0, y: 0 } };
}

const armDeg = (direction: Point2D) => (Math.atan2(direction.x, direction.y) * 180) / Math.PI;

/**
 * Brazo de un poste en `point` (PLANO) hacia el espacio: si el poste está
 * fuera, apunta al borde más cercano; si está dentro, hacia el interior.
 */
export function armTowardSpaceDeg(polygonM: Point2D[], point: Point2D, scaleM: number): number {
    const p = { x: point.x * scaleM, y: point.y * scaleM };
    let twice = 0;
    for (let i = 0; i < polygonM.length; i++) {
        const a = polygonM[i];
        const b = polygonM[(i + 1) % polygonM.length];
        twice += a.x * b.y - b.x * a.y;
    }
    let best = { d: Infinity, q: p, inward: { x: 0, y: 1 } };
    for (let i = 0; i < polygonM.length; i++) {
        const a = polygonM[i];
        const b = polygonM[(i + 1) % polygonM.length];
        const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
        if (len2 <= 1e-12) continue;
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len2));
        const q = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < best.d) {
            const len = Math.sqrt(len2);
            const dx = (b.x - a.x) / len;
            const dy = (b.y - a.y) / len;
            best = { d, q, inward: twice > 0 ? { x: -dy, y: dx } : { x: dy, y: -dx } };
        }
    }
    if (best.d < 1e-6) return armDeg(best.inward);
    const toEdge = { x: best.q.x - p.x, y: best.q.y - p.y };
    // Dentro del espacio el vector al borde apunta hacia afuera: se invierte.
    const inside = toEdge.x * best.inward.x + toEdge.y * best.inward.y < 0;
    return armDeg(inside ? { x: -toEdge.x, y: -toEdge.y } : toEdge);
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
    const sides = linearSidesOf(element, scaleM);
    const ruleWidthM =
        declaredWidth && declaredWidth > 0 ? declaredWidth : (sides?.widthM ?? axis.widthM);
    // Largo real del recorrido: la media de los dos bordes (en L o curva, el
    // largo del rectángulo mínimo no es el recorrido).
    const runLengthM = sides ? (sides.lengths[0] + sides.lengths[1]) / 2 : axis.lengthM;
    const widthToHeight = ruleWidthM / h;
    const axisFill =
        axis.lengthM * axis.widthM > 0
            ? polygonAreaM2(element.vertices, scaleM) / (axis.lengthM * axis.widthM)
            : 1;
    const arrangement = input.arrangement ?? arrangementFor(element.type, widthToHeight);
    const maxSpacingM = h * (input.spacingToHeight ?? DEFAULT_LINEAR_SPACING_TO_HEIGHT);
    // Separación medida entre postes CONSECUTIVOS a lo largo del eje; en la
    // pareada cada "posición" lleva 2 postes enfrentados.
    const positionsBySpacing = Math.max(1, Math.ceil(runLengthM / maxSpacingM));
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
        sides,
        runLengthM,
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
    /** Bordes reales del espacio: si están, los postes SIGUEN esos bordes. */
    sides?: LinearSides | null;
}): LinearLayout {
    const { axis, arrangement, scaleM } = input;
    const count = Math.max(1, Math.round(input.count));
    if (input.sides) return layoutAlongSides({ ...input, sides: input.sides, count });
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

/**
 * Postes a lo largo de los BORDES reales: reparto ½-1-1-½ sobre la longitud de
 * cada borde, a `EDGE_OFFSET_M` fuera (o dentro) del tramo donde cae cada uno,
 * con el brazo hacia el espacio. Unilateral = un borde; pareada = ambos en la
 * misma posición; tresbolillo = alterna bordes.
 */
function layoutAlongSides(input: {
    arrangement: LinearArrangement;
    count: number;
    scaleM: number;
    side?: 0 | 1;
    placement?: 'outside' | 'inside';
    sides: LinearSides;
}): LinearLayout {
    const { sides, arrangement, count, scaleM } = input;
    const offset = input.placement === 'inside' ? -EDGE_OFFSET_M : EDGE_OFFSET_M;
    const positions: Point2D[] = [];
    const armDirectionsDeg: number[] = [];
    const push = (sideIndex: 0 | 1, fraction: number) => {
        const { point, outward } = pointOnSide(
            sides.chains[sideIndex],
            fraction * sides.lengths[sideIndex],
            sides.orientation,
        );
        positions.push({
            x: (point.x + outward.x * offset) / scaleM,
            y: (point.y + outward.y * offset) / scaleM,
        });
        armDirectionsDeg.push(armDeg({ x: -outward.x, y: -outward.y }));
    };
    const along = arrangement === 'opposite' ? Math.ceil(count / 2) : count;
    for (let i = 0; i < along; i++) {
        const fraction = (i + 0.5) / along;
        if (arrangement === 'single') {
            push(input.side ?? 0, fraction);
        } else if (arrangement === 'staggered') {
            // El borde B corre en sentido contrario: se invierte la fracción
            // para que los postes alternen a lo largo del recorrido.
            if (i % 2 === 0) push(0, fraction);
            else push(1, 1 - fraction);
        } else {
            push(0, fraction);
            if (positions.length < count) push(1, 1 - fraction);
        }
    }
    const usedLength =
        arrangement === 'single'
            ? sides.lengths[input.side ?? 0]
            : (sides.lengths[0] + sides.lengths[1]) / 2;
    return { positions, armDirectionsDeg, spacingM: usedLength / along };
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

/**
 * Rumbo del brazo (convención `armDirectionDeg`) de un poste en `point`
 * (coordenadas de PLANO) hacia el eje de la vía: sirve cuando el usuario
 * movió el poste (incluso al otro lado) después de proyectar.
 */
export function armTowardAxisDeg(axis: LinearAxis, point: Point2D, scaleM: number): number {
    const across =
        (point.x * scaleM - axis.center.x) * axis.across.x +
        (point.y * scaleM - axis.center.y) * axis.across.y;
    const s = across >= 0 ? 1 : -1;
    return (Math.atan2(-axis.across.x * s, -axis.across.y * s) * 180) / Math.PI;
}

/** Aplica posiciones ajustadas a mano y reorienta cada brazo hacia la vía. */
export function adjustLinearLayout(
    layout: LinearLayout,
    axis: LinearAxis,
    positions: Point2D[],
    scaleM: number,
    sides?: LinearSides | null,
): LinearLayout {
    return {
        ...layout,
        positions,
        armDirectionsDeg: positions.map((point) =>
            sides
                ? armTowardSpaceDeg(sides.polygon, point, scaleM)
                : armTowardAxisDeg(axis, point, scaleM),
        ),
    };
}

