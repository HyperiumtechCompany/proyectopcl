import { describe, expect, it } from 'vitest';
import { offsetPolyline, offsetSegment, wireBundleLanes } from './wireBundles';

describe('cables en paralelo por la misma zanja', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 };
    const c = { x: 10, y: 10 };

    it('dos cables por el mismo tramo quedan en carriles opuestos (no uno encima del otro)', () => {
        // El segundo dibujado al revés: igual comparte el tramo.
        const lanes = wireBundleLanes([
            { id: 'verde', points: [a, b, c] },
            { id: 'naranja', points: [b, a] },
        ]);
        const green = lanes.get('verde')!;
        const orange = lanes.get('naranja')!;
        expect(green[0].lane).toBe(-0.5);
        expect(orange[0].lane).toBe(0.5);
        // Tramo propio (b→c) sin compartir: al centro.
        expect(green[1].lane).toBe(0);
        const [ga] = offsetSegment(a, b, green[0], 1);
        const [ob] = offsetSegment(b, a, orange[0], 1);
        // Mismo tramo, lados opuestos: separados exactamente 1 carril.
        expect(Math.abs(ga.y - ob.y)).toBeCloseTo(1, 9);
    });

    it('un cable solo no se mueve; la polilínea desplazada es continua', () => {
        const alone = wireBundleLanes([{ id: 'x', points: [a, b, c] }]).get('x');
        expect(offsetPolyline([a, b, c], alone, 1)).toEqual([a, b, c]);
        const lanes = wireBundleLanes([
            { id: 'p', points: [a, b, c] },
            { id: 'q', points: [a, b, c] },
        ]);
        const shifted = offsetPolyline([a, b, c], lanes.get('p'), 1);
        expect(shifted).toHaveLength(3);
        expect(shifted[0].y).toBeCloseTo(-0.5, 9);
    });
});
