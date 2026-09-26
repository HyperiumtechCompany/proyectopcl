import { closestPointOnPolygon, pointInPolygon } from './geometry';
import { elementBox } from './layoutFit';
import { buildStraightRampLayout } from './rampLayout';
import { siteElementBaseElevation } from './siteLightingCalculation';
import { exclusiveSpacePolygons, polygonsClash } from './spaceGuard';
import type { Point2D, RampConfig, SiteData, SiteElement } from './types';

/** Tolerancia de cota (m) para decir que una rampa/escalera "llega" a una plataforma. */
export const LEVEL_TOL_M = 0.05;
/** Distancia máxima (m) del extremo al borde de la plataforma para considerarlo conectado. */
export const LINK_REACH_M = 1.0;

export interface LevelLinkEnd {
    role: 'start' | 'end';
    /** Cota que la rampa/escalera declara en este extremo (m). */
    elevationM: number;
    point: Point2D;
    ok: boolean;
    /** Plataforma o edificación a la que conecta (cota coincidente y a ≤ LINK_REACH_M). */
    platform?: { id: string; label: string; elevationM: number; kind: 'platform' | 'building' };
    message: string;
}

export interface LevelLinkReport {
    start: LevelLinkEnd;
    end: LevelLinkEnd;
    /** Espacios exclusivos (otras rampas, escaleras, edificios…) que el layout invade. */
    overlaps: Array<{ id: string; label: string }>;
    /** Postes, tableros, árboles… que quedan dentro del layout. */
    obstacles: Array<{ id: string; label: string }>;
}

const OBSTACLE_TYPES = new Set(['pole', 'tg_location', 'transformer', 'tree']);

/**
 * A qué se conecta una rampa/escalera: una PLATAFORMA (su cota) o una
 * EDIFICACIÓN (la cota de su piso: la superficie sobre la que está + su
 * elevación propia — mismo criterio que el cálculo y el 3D). Así una rampa
 * puede unir dos plataformas, dos edificaciones o una plataforma con un
 * edificio.
 */
export interface LevelTarget {
    element: SiteElement;
    elevationM: number;
    kind: 'platform' | 'building';
}

export function levelTargets(elements: SiteElement[]): LevelTarget[] {
    const site = { elements } as unknown as SiteData;
    return elements
        .filter(
            (el) =>
                (el.type === 'terrace_platform' || el.type === 'building_block') &&
                el.visible !== false &&
                el.vertices.length >= 3,
        )
        .map((el) => ({
            element: el,
            kind: el.type === 'terrace_platform' ? ('platform' as const) : ('building' as const),
            elevationM:
                el.type === 'terrace_platform'
                    ? (el.baseElevationM ?? 0)
                    : siteElementBaseElevation(site, el),
        }));
}

const targetName = (target: LevelTarget) =>
    `${target.kind === 'building' ? 'la edificación' : 'la plataforma'} "${target.element.label}"`;

/**
 * Comprueba que una rampa/escalera de tramos cumple su razón de ser: unir dos
 * niveles. INICIO debe tocar una plataforma a la cota de origen y FIN otra a la
 * cota de destino (con el descanso de llegada incluido), y el layout no debe
 * invadir otros espacios ni obstáculos. `layoutConfig` es la config YA ajustada
 * al espacio (la misma que se dibuja).
 */
export function checkLevelLink(
    element: SiteElement,
    elements: SiteElement[],
    scaleM: number,
    layoutConfig: RampConfig,
): LevelLinkReport | null {
    if (!layoutConfig.flights || layoutConfig.flights.length === 0) return null;
    const segments = buildStraightRampLayout(layoutConfig);
    if (segments.length === 0) return null;
    const center = elementBox(element, scaleM).center;
    const planOf = (lx: number, lz: number): Point2D => ({
        x: center.x + lx / scaleM,
        y: center.y - lz / scaleM,
    });

    const firstFlight = segments.find((s) => s.kind === 'flight') ?? segments[0];
    const last = segments[segments.length - 1];
    const startPoint = planOf(firstFlight.startLocal.x, firstFlight.startLocal.z);
    const endPoint = planOf(last.endLocal.x, last.endLocal.z);

    const targets = levelTargets(elements);
    const reach = (point: Point2D, target: LevelTarget): number => {
        if (pointInPolygon(point, target.element.vertices)) return 0;
        const hit = closestPointOnPolygon(point, target.element.vertices, true);
        return hit ? hit.distance * scaleM : Infinity;
    };
    const evaluate = (
        role: 'start' | 'end',
        elevationM: number,
        point: Point2D,
    ): LevelLinkEnd => {
        const label = role === 'start' ? 'INICIO' : 'FIN';
        const withDistance = targets
            .map((p) => ({ p, d: reach(point, p) }))
            .sort((a, b) => a.d - b.d);
        const match = withDistance.find(
            ({ p, d }) => Math.abs(p.elevationM - elevationM) <= LEVEL_TOL_M && d <= LINK_REACH_M,
        );
        if (match) {
            return {
                role,
                elevationM,
                point,
                ok: true,
                platform: {
                    id: match.p.element.id,
                    label: match.p.element.label,
                    elevationM: match.p.elevationM,
                    kind: match.p.kind,
                },
                message: `${label} ${elevationM.toFixed(2)} m llega a ${targetName(match.p)}.`,
            };
        }
        const nearest = withDistance[0];
        let message: string;
        if (!nearest || nearest.d > LINK_REACH_M * 3) {
            message = `${label} ${elevationM.toFixed(2)} m no toca ninguna plataforma ni edificación (¿queda en el aire o sobre terreno natural?).`;
        } else if (Math.abs(nearest.p.elevationM - elevationM) > LEVEL_TOL_M) {
            message = `${label} declara ${elevationM.toFixed(2)} m pero ${targetName(nearest.p)} cercana está a ${nearest.p.elevationM.toFixed(2)} m: corrige la cota o mueve el extremo.`;
        } else {
            message = `${label} queda a ${nearest.d.toFixed(1)} m del borde de ${targetName(nearest.p)} (máx. ${LINK_REACH_M} m): acerca el extremo.`;
        }
        return { role, elevationM, point, ok: false, message };
    };

    const start = evaluate('start', layoutConfig.fromElevationM, startPoint);
    const end = evaluate('end', layoutConfig.toElevationM, endPoint);

    // Huella real de cada tramo/descanso (rectángulos orientados) en el plano.
    const footprint: Point2D[][] = segments.map((seg) => {
        const dx = seg.endLocal.x - seg.startLocal.x;
        const dz = seg.endLocal.z - seg.startLocal.z;
        const len = Math.hypot(dx, dz) || 1;
        const px = (-dz / len) * (seg.widthM / 2);
        const pz = (dx / len) * (seg.widthM / 2);
        const c = (p: { x: number; z: number }, s: number) =>
            planOf(p.x + px * s, p.z + pz * s);
        return [
            c(seg.startLocal, -1),
            c(seg.startLocal, 1),
            c(seg.endLocal, 1),
            c(seg.endLocal, -1),
        ];
    });

    const overlaps = exclusiveSpacePolygons(elements, [element.id])
        .filter((o) => footprint.some((rect) => polygonsClash(rect, o.vertices)))
        .map(({ id, label }) => ({ id, label }));

    const obstacles = elements
        .filter(
            (el) =>
                OBSTACLE_TYPES.has(el.type) &&
                el.visible !== false &&
                el.vertices.length > 0,
        )
        .filter((el) => {
            const c = {
                x: el.vertices.reduce((s, v) => s + v.x, 0) / el.vertices.length,
                y: el.vertices.reduce((s, v) => s + v.y, 0) / el.vertices.length,
            };
            return footprint.some((rect) => pointInPolygon(c, rect));
        })
        .map((el) => ({ id: el.id, label: el.label }));

    return { start, end, overlaps, obstacles };
}

/** Plataforma o edificación más cercana a un punto (sin importar su cota), su cota y el punto de su borde más próximo. */
export function nearestPlatform(
    point: Point2D,
    elements: SiteElement[],
    scaleM: number,
): { platform: SiteElement; distanceM: number; edgePoint: Point2D; elevationM: number } | null {
    let best: { platform: SiteElement; distanceM: number; edgePoint: Point2D; elevationM: number } | null = null;
    for (const target of levelTargets(elements)) {
        const platform = target.element;
        if (pointInPolygon(point, platform.vertices)) {
            // Varias pueden contenerlo (una baja que rodea a una alta): manda la MÁS ALTA, como el suelo real.
            if (!best || best.distanceM > 0 || target.elevationM > best.elevationM) {
                best = { platform, distanceM: 0, edgePoint: point, elevationM: target.elevationM };
            }
            continue;
        }
        if (best && best.distanceM === 0) continue;
        const hit = closestPointOnPolygon(point, platform.vertices, true);
        if (!hit) continue;
        const distanceM = hit.distance * scaleM;
        if (!best || distanceM < best.distanceM) {
            best = { platform, distanceM, edgePoint: hit.point, elevationM: target.elevationM };
        }
    }
    return best;
}

/**
 * Cotas propuestas a partir de las plataformas vecinas de INICIO y FIN
 * (`null` si algún extremo no tiene plataforma a ≤ 3 × LINK_REACH_M).
 */
export function suggestCotasFromPlatforms(
    report: LevelLinkReport,
    elements: SiteElement[],
    scaleM: number,
): { fromElevationM: number; toElevationM: number } | null {
    const a = nearestPlatform(report.start.point, elements, scaleM);
    const b = nearestPlatform(report.end.point, elements, scaleM);
    if (!a || !b || a.distanceM > LINK_REACH_M * 3 || b.distanceM > LINK_REACH_M * 3) {
        return null;
    }
    return {
        fromElevationM: a.elevationM,
        toElevationM: b.elevationM,
    };
}

/**
 * Desplazamiento (unidades de plano) que lleva el extremo FIN al borde de la
 * plataforma o edificación de llegada — la de cota `toElevationM` más cercana, hasta 20 m.
 * `null` si no hay ninguna o ya está conectado.
 */
export function shiftToReachArrival(
    report: LevelLinkReport,
    elements: SiteElement[],
    scaleM: number,
): Point2D | null {
    if (report.end.ok) return null;
    let best: { d: number; dx: number; dy: number } | null = null;
    for (const target of levelTargets(elements)) {
        const platform = target.element;
        if (Math.abs(target.elevationM - report.end.elevationM) > LEVEL_TOL_M) continue;
        if (pointInPolygon(report.end.point, platform.vertices)) return null;
        const hit = closestPointOnPolygon(report.end.point, platform.vertices, true);
        if (!hit) continue;
        const d = hit.distance * scaleM;
        if (d <= 20 && (!best || d < best.d)) {
            best = {
                d,
                dx: hit.point.x - report.end.point.x,
                dy: hit.point.y - report.end.point.y,
            };
        }
    }
    return best ? { x: best.dx, y: best.dy } : null;
}
