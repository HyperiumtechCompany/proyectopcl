import { pointInPolygon } from './ambientSpaces';
import type { RampFlight, StructuralObstacle, Vertex } from './types';

export interface RampSurfacePoint {
    x: number;
    y: number;
    height: number;
    progress: number;
}

export interface RampLayoutSegment {
    id: string;
    kind: 'flight' | 'landing';
    start: Vertex;
    end: Vertex;
    startHeight: number;
    endHeight: number;
    width: number;
}

const DIRECTION_ANGLE: Record<RampFlight['direction'], number> = {
    north: -90, south: 90, east: 0, west: 180,
};

export function buildRampLayout(ramp: StructuralObstacle): RampLayoutSegment[] {
    const bounds = boundsOf(ramp);
    const configured = ramp.rampFlights ?? [];
    const startHeight = ramp.startLevel ?? ramp.elevation ?? 0;
    const endHeight = ramp.endLevel ?? startHeight;
    const fallbackDirection = ramp.rampDirection ?? 'north';
    const fallbackLength = Math.max(0.1,
        fallbackDirection === 'north' || fallbackDirection === 'south'
            ? bounds.maxY - bounds.minY : bounds.maxX - bounds.minX,
    );
    const flights: RampFlight[] = configured.length > 0 ? configured : [{
        id: 'flight-1', direction: fallbackDirection, length: fallbackLength,
        rise: endHeight - startHeight, landingLength: 0, turnAfterDeg: 0,
    }];
    const width = Math.max(0.5, ramp.width ?? 1.2);
    const raw: RampLayoutSegment[] = [];
    let cursor = { x: 0, y: 0 }; let height = startHeight;
    let headingDeg = DIRECTION_ANGLE[flights[0].direction];
    flights.forEach((flight) => {
        const heading = (headingDeg * Math.PI) / 180;
        const vector = { x: Math.cos(heading), y: Math.sin(heading) };
        const length = Math.max(0.1, flight.length);
        const end = { x: cursor.x + vector.x * length, y: cursor.y + vector.y * length };
        raw.push({ id: flight.id, kind: 'flight', start: cursor, end,
            startHeight: height, endHeight: height + flight.rise, width });
        cursor = end; height += flight.rise;
        if (flight.landingLength > 0) {
            const landingEnd = {
                x: cursor.x + vector.x * flight.landingLength,
                y: cursor.y + vector.y * flight.landingLength,
            };
            raw.push({ id: `${flight.id}-landing`, kind: 'landing', start: cursor,
                end: landingEnd, startHeight: height, endHeight: height, width });
            cursor = landingEnd;
        }
        headingDeg += flight.turnAfterDeg;
    });
    const all = raw.flatMap((segment) => [segment.start, segment.end]);
    const rawCenterX = (Math.min(...all.map((point) => point.x)) + Math.max(...all.map((point) => point.x))) / 2;
    const rawCenterY = (Math.min(...all.map((point) => point.y)) + Math.max(...all.map((point) => point.y))) / 2;
    return raw.map((segment) => ({
        ...segment,
        start: { x: segment.start.x - rawCenterX + bounds.cx, y: segment.start.y - rawCenterY + bounds.cy },
        end: { x: segment.end.x - rawCenterX + bounds.cx, y: segment.end.y - rawCenterY + bounds.cy },
    }));
}

function boundsOf(ramp: StructuralObstacle) {
    const xs = ramp.vertices.map((vertex) => vertex.x);
    const ys = ramp.vertices.map((vertex) => vertex.y);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minY = Math.min(...ys); const maxY = Math.max(...ys);
    return { minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

export function findRampAtPoint(
    ramps: StructuralObstacle[],
    point: Vertex,
): StructuralObstacle | undefined {
    return ramps.find((ramp) =>
        ramp.obstacleType === 'ramp' && pointInPolygon(point, ramp.vertices),
    );
}

/** Punto sobre el eje y cota de rodadura de una rampa recta o helicoidal. */
export function resolveRampSurfacePoint(
    ramp: StructuralObstacle,
    point: Vertex,
    preferredHeight?: number,
): RampSurfacePoint | null {
    if (ramp.obstacleType !== 'ramp' || ramp.vertices.length < 3) return null;
    const bounds = boundsOf(ramp);
    const start = ramp.startLevel ?? ramp.elevation ?? 0;
    const end = ramp.endLevel ?? start;

    if ((ramp.rampShape ?? 'straight') === 'spiral') {
        const dx = point.x - bounds.cx; const dy = point.y - bounds.cy;
        const outerRadius = Math.max(0.5, Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2);
        const laneWidth = Math.min(ramp.width ?? outerRadius * 0.4, outerRadius * 0.8);
        const radius = Math.max(0.2, outerRadius - laneWidth / 2);
        const startAngle = ((ramp.rampStartAngleDeg ?? 0) * Math.PI) / 180;
        let angle = Math.atan2(dy, dx) - startAngle;
        if (ramp.rampClockwise !== false) angle = -angle;
        angle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const turns = Math.max(0.25, ramp.rampTurns ?? ramp.rampFloorCount ?? 1);
        const turnCandidates = Array.from(
            { length: Math.max(1, Math.ceil(turns)) },
            (_, turn) => Math.min(1, (angle + turn * Math.PI * 2) / (Math.PI * 2 * turns)),
        );
        const progress = Number.isFinite(preferredHeight) && end !== start
            ? turnCandidates.reduce((best, candidate) =>
                Math.abs(start + (end - start) * candidate - preferredHeight!) <
                Math.abs(start + (end - start) * best - preferredHeight!) ? candidate : best,
            turnCandidates[0])
            : turnCandidates[0];
        const worldAngle = startAngle + (ramp.rampClockwise !== false ? -1 : 1) * angle;
        return {
            x: bounds.cx + Math.cos(worldAngle) * radius,
            y: bounds.cy + Math.sin(worldAngle) * radius,
            height: start + (end - start) * progress,
            progress,
        };
    }

    const layout = buildRampLayout(ramp);
    let best: { segment: RampLayoutSegment; ratio: number; distance: number } | null = null;
    layout.forEach((segment) => {
        const dx = segment.end.x - segment.start.x;
        const dy = segment.end.y - segment.start.y;
        const lengthSq = Math.max(0.0001, dx * dx + dy * dy);
        const ratio = Math.max(0, Math.min(1,
            ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / lengthSq,
        ));
        const x = segment.start.x + dx * ratio; const y = segment.start.y + dy * ratio;
        const distance = Math.hypot(point.x - x, point.y - y);
        if (!best || distance < best.distance) best = { segment, ratio, distance };
    });
    if (!best) return null;
    const selected: { segment: RampLayoutSegment; ratio: number } = best;
    const totalRise = Math.max(0.0001, Math.abs(end - start));
    const height = selected.segment.startHeight
        + (selected.segment.endHeight - selected.segment.startHeight) * selected.ratio;
    return {
        x: selected.segment.start.x + (selected.segment.end.x - selected.segment.start.x) * selected.ratio,
        y: selected.segment.start.y + (selected.segment.end.y - selected.segment.start.y) * selected.ratio,
        height,
        progress: Math.max(0, Math.min(1, Math.abs(height - start) / totalRise)),
    };
}

/** Cota segura bajo la losa para luminarias y canalizaciones. */
export function resolveRampUndersidePoint(
    ramp: StructuralObstacle,
    point: Vertex,
    preferredHeight?: number,
): RampSurfacePoint | null {
    const surface = resolveRampSurfacePoint(ramp, point, preferredHeight);
    return surface ? {
        ...surface,
        height: Math.max(0.2, surface.height - Math.max(0.05, ramp.thickness ?? 0.15) - 0.06),
    } : null;
}
