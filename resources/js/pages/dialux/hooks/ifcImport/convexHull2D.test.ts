import { describe, expect, it } from 'vitest';
import { convexHull2D } from './convexHull2D';

describe('convexHull2D', () => {
    it('devuelve [] con menos de 3 puntos distintos', () => {
        expect(convexHull2D([])).toEqual([]);
        expect(convexHull2D([{ x: 0, y: 0 }])).toEqual([]);
        expect(convexHull2D([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toEqual([]);
        expect(convexHull2D([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }])).toEqual([]);
    });

    it('el casco de un cuadrado con un punto interior excluye el punto interior', () => {
        const hull = convexHull2D([
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 4 },
            { x: 0, y: 4 },
            { x: 2, y: 2 }, // interior — no debe aparecer en el casco
        ]);
        expect(hull).toHaveLength(4);
        expect(hull).not.toContainEqual({ x: 2, y: 2 });
    });

    it('el casco de un triángulo son sus 3 vértices', () => {
        const hull = convexHull2D([
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 2, y: 4 },
        ]);
        expect(hull).toHaveLength(3);
    });

    it('el área del casco de un cuadrado 4x3 es 12 (shoelace)', () => {
        const hull = convexHull2D([
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 3 },
            { x: 0, y: 3 },
        ]);
        let area = 0;
        for (let i = 0; i < hull.length; i++) {
            const a = hull[i]!;
            const b = hull[(i + 1) % hull.length]!;
            area += a.x * b.y - b.x * a.y;
        }
        expect(Math.abs(area) / 2).toBeCloseTo(12, 9);
    });

    it('ignora puntos colineales redundantes en el borde', () => {
        const hull = convexHull2D([
            { x: 0, y: 0 },
            { x: 2, y: 0 }, // colineal en el borde inferior
            { x: 4, y: 0 },
            { x: 4, y: 4 },
            { x: 0, y: 4 },
        ]);
        expect(hull).toHaveLength(4);
    });
});
