import { describe, expect, it } from 'vitest';
import { buildSpiralRampPolyline, buildStraightRampLayout } from './rampLayout';
import type { RampConfig } from './types';

function baseRamp(overrides: Partial<RampConfig> = {}): RampConfig {
    return {
        kind: 'ramp',
        fromElevationM: 0,
        toElevationM: 3,
        widthM: 3,
        ...overrides,
    };
}

describe('site/domain/rampLayout', () => {
    it('sin flights genera un único tramo que cubre todo el desnivel (compatibilidad con rampas clásicas)', () => {
        const layout = buildStraightRampLayout(baseRamp());
        expect(layout).toHaveLength(1);
        expect(layout[0].endY - layout[0].startY).toBeCloseTo(3, 6);
    });

    it('encadena varios tramos con giros y acumula el desnivel total', () => {
        const layout = buildStraightRampLayout(
            baseRamp({
                flights: [
                    { id: 'f1', direction: 'north', lengthM: 10, riseM: 1.5, turnAfterDeg: 180 },
                    { id: 'f2', direction: 'north', lengthM: 10, riseM: 1.5 },
                ],
            }),
        );
        expect(layout).toHaveLength(2);
        // El giro de 180° hace que el segundo tramo avance en sentido opuesto al primero.
        const dx1 = layout[0].endLocal.x - layout[0].startLocal.x;
        const dz1 = layout[0].endLocal.z - layout[0].startLocal.z;
        const dx2 = layout[1].endLocal.x - layout[1].startLocal.x;
        const dz2 = layout[1].endLocal.z - layout[1].startLocal.z;
        expect(dx1 + dx2).toBeCloseTo(0, 6);
        expect(dz1 + dz2).toBeCloseTo(0, 6);
        // El segundo tramo termina 3 m más arriba del inicio del primero.
        expect(layout[1].endY - layout[0].startY).toBeCloseTo(3, 6);
    });

    it('agrega un descanso plano (mismo Y en ambos extremos) cuando el tramo lo pide', () => {
        const layout = buildStraightRampLayout(
            baseRamp({
                flights: [
                    { id: 'f1', direction: 'north', lengthM: 10, riseM: 1.5, landingLengthM: 2 },
                ],
            }),
        );
        expect(layout).toHaveLength(2);
        expect(layout[1].kind).toBe('landing');
        expect(layout[1].startY).toBeCloseTo(layout[1].endY, 6);
    });

    it('la espiral completa el desnivel total al final del recorrido y respeta el radio de la huella', () => {
        const points = buildSpiralRampPolyline(
            baseRamp({ shape: 'spiral', turns: 2, widthM: 4 }),
            10,
        );
        expect(points[0].y).toBeCloseTo(0, 6);
        expect(points[points.length - 1].y).toBeCloseTo(3, 6);
        const maxRadius = Math.max(...points.map((p) => Math.hypot(p.x, p.z)));
        expect(maxRadius).toBeLessThanOrEqual(10 + 1e-6);
    });

    it('la espiral en sentido antihorario gira en dirección opuesta a la horaria', () => {
        const cw = buildSpiralRampPolyline(
            baseRamp({ shape: 'spiral', turns: 0.25, clockwise: true }),
            10,
        );
        const ccw = buildSpiralRampPolyline(
            baseRamp({ shape: 'spiral', turns: 0.25, clockwise: false }),
            10,
        );
        expect(cw[cw.length - 1].z).toBeCloseTo(-ccw[ccw.length - 1].z, 6);
    });
});
