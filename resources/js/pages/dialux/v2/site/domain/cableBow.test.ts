import { describe, expect, it } from 'vitest';
import { bowedPoint, bowedSegmentPoints, cableBowSign } from './cableBow';

describe('cableBow', () => {
    it('el subterráneo se arquea a la derecha y el aéreo a la izquierda (signos opuestos)', () => {
        expect(cableBowSign('underground')).toBe(1);
        expect(cableBowSign('aerial')).toBe(-1);
    });

    it('los extremos del tramo quedan exactos (sin arco en t=0 y t=1)', () => {
        const a = { x: 0, y: 0 };
        const b = { x: 0, y: 10 };
        expect(bowedPoint(a, b, 1, 'underground', 0)).toEqual(a);
        expect(bowedPoint(a, b, 1, 'underground', 1)).toEqual(b);
    });

    it('el arco es máximo a la mitad del tramo y perpendicular al sentido de avance', () => {
        const a = { x: 0, y: 0 };
        const b = { x: 0, y: 10 }; // tramo vertical (avanza en +y)
        const mid = bowedPoint(a, b, 1, 'underground', 0.5);
        // Perpendicular a un tramo vertical es horizontal: y se queda en el punto medio, x se desplaza.
        expect(mid.y).toBeCloseTo(5, 5);
        expect(Math.abs(mid.x)).toBeGreaterThan(0);
    });

    it('subterráneo y aéreo arquean el mismo tramo hacia lados opuestos', () => {
        const a = { x: 0, y: 0 };
        const b = { x: 0, y: 10 };
        const underground = bowedPoint(a, b, 1, 'underground', 0.5);
        const aerial = bowedPoint(a, b, 1, 'aerial', 0.5);
        expect(underground.x).toBeCloseTo(-aerial.x, 5);
        expect(underground.x).not.toBeCloseTo(0, 5);
    });

    it('bowedSegmentPoints muestrea n+1 puntos empezando y terminando en los extremos', () => {
        const a = { x: 0, y: 0 };
        const b = { x: 5, y: 0 };
        const pts = bowedSegmentPoints(a, b, 1, 'aerial', 4);
        expect(pts).toHaveLength(5);
        expect(pts[0]).toEqual(a);
        expect(pts[4]).toEqual(b);
    });

    it('un tramo degenerado (a === b) no revienta y devuelve el mismo punto', () => {
        const a = { x: 3, y: 3 };
        expect(bowedPoint(a, a, 1, 'underground', 0.5)).toEqual(a);
    });

    it('permite elegir el lado y la separación del arco', () => {
        const a = { x: 0, y: 0 };
        const b = { x: 0, y: 10 };
        const left = bowedPoint(a, b, 1, 'underground', 0.5, 'left', 2);
        const right = bowedPoint(a, b, 1, 'underground', 0.5, 'right', 2);

        expect(left.x).toBeCloseTo(-right.x, 5);
        expect(Math.abs(left.x)).toBeCloseTo(2, 5);
    });

    it('puede dejar el cable completamente recto', () => {
        expect(
            bowedPoint(
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                1,
                'aerial',
                0.5,
                'straight',
            ),
        ).toEqual({ x: 5, y: 0 });
    });
});
