export interface CurvePoint {
    x: number;
    y: number;
}

export function defaultWireCurveMidpoint(
    start: CurvePoint,
    end: CurvePoint,
    routeType: 'floor' | 'wall_ceiling',
): CurvePoint {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const direction = routeType === 'floor' ? 1 : -1;

    return {
        x: (start.x + end.x) / 2 + -dy * 0.09 * direction,
        y: (start.y + end.y) / 2 + dx * 0.09 * direction,
    };
}

/** Convierte un punto situado sobre la curva en el control cuadrático SVG. */
export function quadraticControlThroughMidpoint(
    start: CurvePoint,
    midpoint: CurvePoint,
    end: CurvePoint,
): CurvePoint {
    return {
        x: 2 * midpoint.x - (start.x + end.x) / 2,
        y: 2 * midpoint.y - (start.y + end.y) / 2,
    };
}

export function quadraticPoint(
    start: CurvePoint,
    control: CurvePoint,
    end: CurvePoint,
    t: number,
): CurvePoint {
    const inverse = 1 - t;
    return {
        x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
        y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
    };
}
