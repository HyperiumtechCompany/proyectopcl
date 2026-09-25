import type { FeederPath, FeederRoute, Point2D } from './types';

/** Valores por defecto de la ruta de un alimentador exterior. */
export const FEEDER_ROUTE_DEFAULTS = {
    /** Flecha máxima del cable aéreo, como % del vano entre postes. */
    sagPct: 3,
    /** Altura de amarre del cable en el poste (m). */
    mountHeightM: 6,
    /** Profundidad de la zanja (m) — bajo terreno, a la cara superior del ducto. */
    depthM: 0.6,
} as const;

/** Parámetro `a` (m) de la catenaria y = a·cosh(x/a) que da una flecha `sag` en un vano `span` con amarres a igual altura. */
export function catenaryParameter(span: number, sag: number): number {
    if (!(span > 0) || !(sag > 0)) return Infinity;
    // sag(a) = a·(cosh(span/2a) − 1) decrece con `a`: se resuelve por bisección.
    const sagOf = (a: number) => a * (Math.cosh(span / (2 * a)) - 1);
    let lo = span / 1000; // catenaria muy cerrada → flecha enorme
    let hi = span * 1e6; // casi recta → flecha ~0
    for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2;
        if (sagOf(mid) > sag) lo = mid;
        else hi = mid;
    }
    return (lo + hi) / 2;
}

/** Longitud (m) del cable colgado en un vano de `span` m con flecha `sag` m: L = 2a·sinh(span/2a). */
export function catenaryLength(span: number, sag: number): number {
    if (!(span > 0)) return 0;
    if (!(sag > 0)) return span;
    const a = catenaryParameter(span, sag);
    return 2 * a * Math.sinh(span / (2 * a));
}

/**
 * Puntos (distancia horizontal, altura relativa al amarre) de la catenaria de un
 * vano: 0 en los extremos y −sag en el centro. `steps` tramos.
 */
export function catenaryProfile(
    span: number,
    sag: number,
    steps = 16,
): Array<{ x: number; drop: number }> {
    const n = Math.max(2, Math.round(steps));
    const a = catenaryParameter(span, sag);
    const points: Array<{ x: number; drop: number }> = [];
    for (let i = 0; i <= n; i++) {
        const x = (span * i) / n;
        const drop = Number.isFinite(a)
            ? a * (Math.cosh((x - span / 2) / a) - Math.cosh(span / (2 * a)))
            : 0;
        points.push({ x, drop });
    }
    return points;
}

export function routeSagPct(route: FeederRoute | undefined): number {
    return route?.sagPct ?? FEEDER_ROUTE_DEFAULTS.sagPct;
}
export function routeMountHeightM(route: FeederRoute | undefined): number {
    return route?.mountHeightM ?? FEEDER_ROUTE_DEFAULTS.mountHeightM;
}
export function routeDepthM(route: FeederRoute | undefined): number {
    return route?.depthM ?? FEEDER_ROUTE_DEFAULTS.depthM;
}

export interface FeederLengthBreakdown {
    /** Suma de tramos rectos en planta (m). */
    planM: number;
    /** Aéreo: exceso de catenaria sobre la recta · subterráneo: 0. */
    sagExtraM: number;
    /** Subidas/bajadas propias del tendido: amarres, zanjas, cambios de modo y cajas. */
    routeVerticalM: number;
    /** Desnivel acumulado entre plataformas/terreno de waypoints consecutivos. */
    levelChangeM: number;
    /** Compatibilidad: vertical del tendido + desniveles. */
    verticalM: number;
    subtotalM: number;
    wasteM: number;
    totalM: number;
}

/**
 * Longitud real de un alimentador exterior. Sin `route` es la polilínea en
 * planta (comportamiento anterior). `waypoints` en unidades de plano; `scaleM`
 * = metros por unidad.
 *  - aéreo: cada vano (entre waypoints consecutivos = postes) como catenaria con
 *    flecha `sagPct`% del vano, + subida y bajada al amarre en los extremos.
 *  - subterráneo: recta en zanja + bajada y subida (2·profundidad) en cada extremo
 *    + 2·profundidad por cada caja de paso intermedia.
 */
/** Modo efectivo de cada tramo: el propio (`segmentModes`) o el de `route.kind`; `null` = sin tendido (plano). */
export function feederSegmentModes(
    waypointCount: number,
    route?: FeederRoute,
    segmentModes?: Array<'aerial' | 'underground'>,
): Array<'aerial' | 'underground'> | null {
    const n = Math.max(0, waypointCount - 1);
    if (segmentModes && segmentModes.length > 0) {
        return Array.from(
            { length: n },
            (_, i) => segmentModes[i] ?? segmentModes[segmentModes.length - 1],
        );
    }
    return route ? Array.from({ length: n }, () => route.kind) : null;
}

export function feederLengthBreakdown(
    waypoints: Point2D[],
    scaleM: number,
    route?: FeederRoute,
    segmentModes?: Array<'aerial' | 'underground'>,
    elevationsM: number[] = [],
    wastePct = 0,
): FeederLengthBreakdown {
    let planM = 0;
    const spans: number[] = [];
    for (let i = 1; i < waypoints.length; i++) {
        const span =
            Math.hypot(
                waypoints[i].x - waypoints[i - 1].x,
                waypoints[i].y - waypoints[i - 1].y,
            ) * scaleM;
        spans.push(span);
        planM += span;
    }
    let levelChangeM = 0;
    for (let index = 1; index < waypoints.length; index += 1) {
        levelChangeM += Math.abs(
            (elevationsM[index] ?? elevationsM[index - 1] ?? 0) -
                (elevationsM[index - 1] ?? 0),
        );
    }

    const modes = feederSegmentModes(waypoints.length, route, segmentModes);
    let sagExtraM = 0;
    let routeVerticalM = 0;

    if (modes && modes.length > 0) {
        const sagFraction = routeSagPct(route) / 100;
        const mount = routeMountHeightM(route);
        const depth = routeDepthM(route);
        spans.forEach((span, i) => {
            if (modes[i] === 'aerial') {
                sagExtraM += catenaryLength(span, span * sagFraction) - span;
            }
        });
        const end = (mode: 'aerial' | 'underground') =>
            mode === 'aerial' ? mount : depth;
        routeVerticalM = end(modes[0]) + end(modes[modes.length - 1]);
        for (let i = 1; i < modes.length; i++) {
            if (modes[i] !== modes[i - 1]) routeVerticalM += mount + depth;
        }
        if (modes.includes('underground')) {
            routeVerticalM += (route?.junctionBoxes?.length ?? 0) * 2 * depth;
        }
    }

    const verticalM = routeVerticalM + levelChangeM;
    const subtotalM = planM + sagExtraM + verticalM;
    const wasteM = subtotalM * (Math.max(0, wastePct) / 100);
    return {
        planM,
        sagExtraM,
        routeVerticalM,
        levelChangeM,
        verticalM,
        subtotalM,
        wasteM,
        totalM: subtotalM + wasteM,
    };
}

/** Longitud total (m) del alimentador para el cálculo de caída de tensión. */
export function feederPathLengthM(path: FeederPath, scaleM: number): number {
    if (!path.route && !path.segmentModes && scaleM === 1) {
        // Trazado sin ruta y a escala 1: se respeta la longitud guardada.
        return (
            path.calculatedLengthM ||
            feederLengthBreakdown(path.waypoints, 1).totalM
        );
    }
    return feederLengthBreakdown(
        path.waypoints,
        scaleM,
        path.route,
        path.segmentModes,
    ).totalM;
}
