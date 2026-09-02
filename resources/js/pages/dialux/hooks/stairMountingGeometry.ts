import { pointInPolygon } from './ambientSpaces';
import {
    DEFAULT_STRUCTURAL_SLAB_THICKNESS,
    getFittedStairTreadDepth,
    getPostLandingCursorOffset,
    getStairLaneLayout,
} from './stairGeometry';
import type { Room } from './types';

export interface StairUndersidePoint {
    x: number;
    y: number;
    height: number;
    kind: 'flight' | 'landing';
}

const SLAB_THICKNESS = 0.15;
const MOUNTING_CLEARANCE = 0.06;

export function findStairAtPoint(rooms: Room[], point: { x: number; y: number }): Room | undefined {
    return rooms.find((room) =>
        room.roomType === 'stair' && pointInPolygon(point, room.vertices),
    );
}

/** Proyecta luminarias y conductos al eje de la cara inferior de la escalera. */
export function resolveStairUndersidePoint(
    room: Room,
    point: { x: number; y: number },
): StairUndersidePoint | null {
    const cfg = room.stairConfig;
    if (room.roomType !== 'stair' || !cfg || room.vertices.length < 3) return null;

    const xs = room.vertices.map((vertex) => vertex.x);
    const ys = room.vertices.map((vertex) => vertex.y);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minY = Math.min(...ys); const maxY = Math.max(...ys);
    const centerX = (minX + maxX) / 2; const centerY = (minY + maxY) / 2;
    const width = Math.max(0.5, maxX - minX); const depth = Math.max(0.5, maxY - minY);
    const flights = cfg.flights.length > 0 ? cfg.flights : [{
        id: 'default', direction: cfg.orientation, stepCount: cfg.stepCount,
        hasLanding: false, landingDepth: 0,
    }];
    const totalSteps = Math.max(1, flights.reduce((sum, flight) => sum + Math.max(0, flight.stepCount), 0));
    const startElevation = cfg.startElevation ?? 0;
    const totalHeight = (cfg.isInterFloor !== false
        ? room.height + DEFAULT_STRUCTURAL_SLAB_THICKNESS
        : room.height) - startElevation;
    const riser = totalHeight / totalSteps;
    const isUStair = flights.length === 2 && (
        (flights[0].direction === 'north' && flights[1].direction === 'south') ||
        (flights[0].direction === 'south' && flights[1].direction === 'north') ||
        (flights[0].direction === 'east' && flights[1].direction === 'west') ||
        (flights[0].direction === 'west' && flights[1].direction === 'east')
    );
    const landingAllowance = isUStair
        ? (flights.find((flight) => flight.hasLanding)?.landingDepth ?? 0)
        : 0;
    const nsLanes = getStairLaneLayout(width, flights.filter((flight) =>
        flight.direction === 'north' || flight.direction === 'south').length,
    cfg.stairWidth, cfg.flightGap, isUStair);
    const ewLanes = getStairLaneLayout(depth, flights.filter((flight) =>
        flight.direction === 'east' || flight.direction === 'west').length,
    cfg.stairWidth, cfg.flightGap, isUStair);
    const firstDirection = flights[0].direction;
    let cursorX = firstDirection === 'west' ? maxX : minX;
    let cursorY = firstDirection === 'north' ? maxY : minY;
    let cursorHeight = 0; let nsLane = 0; let ewLane = 0;
    const candidates: Array<StairUndersidePoint & { distance: number }> = [];

    flights.forEach((flight) => {
        if (flight.stepCount <= 0) return;
        const isNS = flight.direction === 'north' || flight.direction === 'south';
        const sign = flight.direction === 'south' || flight.direction === 'east' ? 1 : -1;
        const lane = isNS ? nsLanes[nsLane++] : ewLanes[ewLane++];
        const axis = isNS ? minX + lane.center : minY + lane.center;
        const run = getFittedStairTreadDepth(
            isNS ? depth : width, flight.stepCount, cfg.treadDepth,
            isUStair ? landingAllowance : 0,
        ) * flight.stepCount;
        const along = isNS ? (point.y - cursorY) * sign : (point.x - cursorX) * sign;
        const clamped = Math.max(0, Math.min(run, along));
        candidates.push({
            x: isNS ? axis : cursorX + sign * clamped,
            y: isNS ? cursorY + sign * clamped : axis,
            height: Math.max(0.2, startElevation + cursorHeight
                + clamped / Math.max(run, 0.01) * flight.stepCount * riser
                - SLAB_THICKNESS - MOUNTING_CLEARANCE),
            kind: 'flight',
            distance: Math.abs((isNS ? point.x : point.y) - axis)
                + Math.abs(along - clamped),
        });

        cursorHeight += flight.stepCount * riser;
        if (isNS) cursorY += sign * run; else cursorX += sign * run;
        if (flight.hasLanding && flight.landingDepth > 0) {
            const landingCenterX = isNS ? centerX : cursorX + sign * flight.landingDepth / 2;
            const landingCenterY = isNS ? cursorY + sign * flight.landingDepth / 2 : centerY;
            const inside = isNS
                ? Math.abs(point.y - landingCenterY) <= flight.landingDepth / 2
                : Math.abs(point.x - landingCenterX) <= flight.landingDepth / 2;
            if (inside) candidates.push({
                x: landingCenterX, y: landingCenterY,
                height: Math.max(0.2, startElevation + cursorHeight - SLAB_THICKNESS - MOUNTING_CLEARANCE),
                kind: 'landing', distance: 0,
            });
            const offset = getPostLandingCursorOffset(flight.landingDepth, sign, isUStair);
            if (isNS) cursorY += offset; else cursorX += offset;
        }
    });

    candidates.sort((a, b) => a.distance - b.distance);
    const best = candidates[0];
    return best ? { x: best.x, y: best.y, height: best.height, kind: best.kind } : null;
}
