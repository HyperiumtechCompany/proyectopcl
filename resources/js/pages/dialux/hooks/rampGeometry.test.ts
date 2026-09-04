import { describe, expect, it } from 'vitest';
import type { StructuralObstacle } from './types';
import { buildRampLayout, resolveRampSurfacePoint, resolveRampUndersidePoint } from './rampGeometry';

const ramp = (patch: Partial<StructuralObstacle> = {}): StructuralObstacle => ({
    id: 'ramp-1', name: 'Rampa', obstacleType: 'ramp',
    vertices: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 10 }, { x: 0, y: 10 }],
    height: 3, elevation: 0, startLevel: 0, endLevel: 3,
    width: 1.2, length: 10, thickness: 0.15,
    rampShape: 'straight', rampDirection: 'south',
    ...patch,
});

describe('rampGeometry', () => {
    it('centra una rampa recta y sigue su pendiente', () => {
        const low = resolveRampSurfacePoint(ramp(), { x: 0.2, y: 2 })!;
        const high = resolveRampSurfacePoint(ramp(), { x: 3.8, y: 8 })!;
        expect(low.x).toBeCloseTo(2);
        expect(high.x).toBeCloseTo(2);
        expect(high.height).toBeGreaterThan(low.height);
    });

    it('mantiene luminarias y cableado debajo de la losa', () => {
        const item = ramp();
        const surface = resolveRampSurfacePoint(item, { x: 2, y: 8 })!;
        const underside = resolveRampUndersidePoint(item, { x: 2, y: 8 })!;
        expect(underside.height).toBeLessThan(surface.height);
    });

    it('proyecta una rampa vehicular helicoidal sobre su eje curvo', () => {
        const item = ramp({
            rampShape: 'spiral', rampType: 'vehicular', width: 1,
            vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
        });
        const point = resolveRampSurfacePoint(item, { x: 9, y: 5 })!;
        expect(Math.hypot(point.x - 5, point.y - 5)).toBeCloseTo(4.5);
        expect(point.progress).toBeGreaterThanOrEqual(0);
        expect(point.progress).toBeLessThanOrEqual(1);
    });

    it('elige la vuelta correspondiente a la altura del piso', () => {
        const item = ramp({
            rampShape: 'spiral', rampTurns: 2,
            vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
        });
        const lower = resolveRampSurfacePoint(item, { x: 9, y: 5 }, 0.5)!;
        const upper = resolveRampSurfacePoint(item, { x: 9, y: 5 }, 2.5)!;
        expect(upper.height).toBeGreaterThan(lower.height);
    });

    it('construye subida, descanso horizontal, giro y segunda subida', () => {
        const item = ramp({ rampFlights: [
            { id: 'f1', direction: 'north', length: 6, rise: 0.75, landingLength: 1.5, turnAfterDeg: 180 },
            { id: 'f2', direction: 'north', length: 6, rise: 0.75, landingLength: 0, turnAfterDeg: 0 },
        ] });
        const layout = buildRampLayout(item);
        expect(layout.map((segment) => segment.kind)).toEqual(['flight', 'landing', 'flight']);
        expect(layout[1].startHeight).toBeCloseTo(layout[1].endHeight);
        expect(layout[2].endHeight).toBeCloseTo(1.5);
        expect(layout[2].end.y).toBeGreaterThan(layout[2].start.y);
    });

    it('admite giros de noventa grados entre tramos', () => {
        const item = ramp({ rampFlights: [
            { id: 'f1', direction: 'east', length: 4, rise: 0.5, landingLength: 1, turnAfterDeg: 90 },
            { id: 'f2', direction: 'east', length: 4, rise: 0.5, landingLength: 0, turnAfterDeg: 0 },
        ] });
        const layout = buildRampLayout(item);
        expect(layout[0].end.x).toBeGreaterThan(layout[0].start.x);
        expect(layout[2].end.y).toBeGreaterThan(layout[2].start.y);
    });
});
