import { closestPointOnPolygon, pointInPolygon } from './geometry';
import { elementBox, layoutExtent } from './layoutFit';
import { LEVEL_TOL_M, LINK_REACH_M } from './levelLink';
import { buildStraightRampLayout } from './rampLayout';
import { planRampFlights } from './siteNorms';
import type { Point2D, RampConfig, SiteElement, StairConfig } from './types';

export interface PlatformAtPoint {
    platform: SiteElement;
    elevationM: number;
    /** 0 = el punto está dentro de la plataforma. */
    distanceM: number;
}

/**
 * Plataforma "de este punto": si lo contienen varias (una baja que rodea a una
 * más alta), la MÁS ALTA — igual que el suelo real (`groundTopAbs`). Si ninguna
 * lo contiene, la más cercana a ≤ `maxReachM`.
 */
export function platformAtPoint(
    point: Point2D,
    elements: SiteElement[],
    scaleM: number,
    maxReachM = LINK_REACH_M * 3,
): PlatformAtPoint | null {
    let inside: PlatformAtPoint | null = null;
    let near: PlatformAtPoint | null = null;
    for (const platform of elements) {
        if (
            platform.type !== 'terrace_platform' ||
            platform.visible === false ||
            platform.vertices.length < 3
        ) {
            continue;
        }
        const elevationM = platform.baseElevationM ?? 0;
        if (pointInPolygon(point, platform.vertices)) {
            if (!inside || elevationM > inside.elevationM) {
                inside = { platform, elevationM, distanceM: 0 };
            }
            continue;
        }
        const hit = closestPointOnPolygon(point, platform.vertices, true);
        if (!hit) continue;
        const d = hit.distance * scaleM;
        if (d <= maxReachM && (!near || d < near.distanceM)) {
            near = { platform, elevationM, distanceM: d };
        }
    }
    return inside ?? near;
}

export interface AutoLink {
    fromElevationM: number;
    toElevationM: number;
    /** `true` si el recorrido debe ir al revés (INICIO en el extremo alto del trazo). */
    reversed: boolean;
    from: PlatformAtPoint;
    to: PlatformAtPoint;
}

/**
 * Deduce las cotas y el sentido de una rampa/escalera de tramos a partir de las
 * plataformas que toca en cada extremo: la más baja es el ORIGEN (INICIO) y la
 * más alta el DESTINO (FIN, con el descanso de llegada). `config` debe ser el
 * layout SIN invertir (`reversed` se ignora). `null` si un extremo no toca
 * ninguna plataforma o ambas tienen la misma cota.
 */
export function autoLinkLevels(
    element: Pick<SiteElement, 'vertices'>,
    elements: SiteElement[],
    scaleM: number,
    config: RampConfig,
): AutoLink | null {
    if (!config.flights || config.flights.length === 0) return null;
    const segments = buildStraightRampLayout({ ...config, reversed: false });
    if (segments.length === 0) return null;
    const center = elementBox(element, scaleM).center;
    const planOf = (p: { x: number; z: number }): Point2D => ({
        x: center.x + p.x / scaleM,
        y: center.y - p.z / scaleM,
    });
    const firstFlight = segments.find((s) => s.kind === 'flight') ?? segments[0];
    const last = segments[segments.length - 1];
    const a = platformAtPoint(planOf(firstFlight.startLocal), elements, scaleM);
    const b = platformAtPoint(planOf(last.endLocal), elements, scaleM);
    if (!a || !b || Math.abs(a.elevationM - b.elevationM) <= LEVEL_TOL_M) return null;
    const aIsLow = a.elevationM < b.elevationM;
    return {
        fromElevationM: Math.min(a.elevationM, b.elevationM),
        toElevationM: Math.max(a.elevationM, b.elevationM),
        reversed: !aIsLow,
        from: aIsLow ? a : b,
        to: aIsLow ? b : a,
    };
}

/**
 * Cotas y sentido de una ESCALERA a partir de las plataformas que tocan los dos
 * extremos de su polígono (a lo largo de su eje mayor; INICIO = extremo oeste/norte
 * salvo `reversed`). No depende del layout, así que sirve aunque aún tenga desnivel 0.
 */
export function autoLinkStairFromPolygon(
    element: Pick<SiteElement, 'vertices'>,
    elements: SiteElement[],
    scaleM: number,
    direction?: 'east' | 'south',
): AutoLink | null {
    const box = elementBox(element, scaleM);
    const xs = element.vertices.map((v) => v.x);
    const ys = element.vertices.map((v) => v.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const alongX = direction ? direction === 'east' : box.widthM >= box.depthM;
    // Un poco hacia adentro del extremo (10 % del largo, máx. 0.5 m) para no caer justo en el borde.
    const inset = Math.min(0.5, (alongX ? box.widthM : box.depthM) * 0.1) / scaleM;
    const a: Point2D = alongX
        ? { x: minX + inset, y: box.center.y }
        : { x: box.center.x, y: minY + inset };
    const b: Point2D = alongX
        ? { x: maxX - inset, y: box.center.y }
        : { x: box.center.x, y: maxY - inset };
    const pa = platformAtPoint(a, elements, scaleM);
    const pb = platformAtPoint(b, elements, scaleM);
    if (!pa || !pb || Math.abs(pa.elevationM - pb.elevationM) <= LEVEL_TOL_M) return null;
    const aIsLow = pa.elevationM < pb.elevationM;
    return {
        fromElevationM: Math.min(pa.elevationM, pb.elevationM),
        toElevationM: Math.max(pa.elevationM, pb.elevationM),
        reversed: !aIsLow,
        from: aIsLow ? pa : pb,
        to: aIsLow ? pb : pa,
    };
}

export function applyAutoLinkToStair(config: StairConfig, link: AutoLink): StairConfig {
    return {
        ...config,
        fromElevationM: link.fromElevationM,
        toElevationM: link.toElevationM,
        reversed: link.reversed,
    };
}

/** Aplica un `AutoLink` a la config de una rampa; regenera los tramos si el desnivel total cambió. */
export function applyAutoLinkToRamp(config: RampConfig, link: AutoLink): RampConfig {
    const total = link.toElevationM - link.fromElevationM;
    const flightsRise = (config.flights ?? []).reduce((s, f) => s + f.riseM, 0);
    const rises = Math.abs(flightsRise - total) < 0.02;
    return {
        ...config,
        fromElevationM: link.fromElevationM,
        toElevationM: link.toElevationM,
        reversed: link.reversed,
        flights: rises || !config.flights ? config.flights : planRampFlights(total),
    };
}

/**
 * Rectángulo (plano) que ocupa el recorrido NATURAL (sin ajustar) de una
 * rampa/escalera, centrado en el centro del polígono actual — para "adaptar el
 * polígono al recorrido" cuando el trazo quedó chico y el layout no cabe.
 */
export function naturalFootprint(
    element: Pick<SiteElement, 'vertices'>,
    scaleM: number,
    config: RampConfig,
): Point2D[] | null {
    if (!config.flights || config.flights.length === 0) return null;
    const ext = layoutExtent(buildStraightRampLayout(config));
    if (ext.width <= 0 || ext.depth <= 0) return null;
    const c = elementBox(element, scaleM).center;
    const hw = ext.width / 2 / scaleM;
    const hd = ext.depth / 2 / scaleM;
    return [
        { x: c.x - hw, y: c.y - hd },
        { x: c.x + hw, y: c.y - hd },
        { x: c.x + hw, y: c.y + hd },
        { x: c.x - hw, y: c.y + hd },
    ];
}
