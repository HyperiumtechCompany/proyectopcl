import { describe, expect, it } from 'vitest';
import { distributeOutletsOnPerimeter, requiredOutletCount } from './outletPlacement';

const rectangle = (width: number, height: number) => [
    { x: 0, y: 0 }, { x: width, y: 0 },
    { x: width, y: height }, { x: 0, y: height },
];

describe('outlet placement', () => {
    it('calcula aulas por cada 10 m2 y comedores por cada 15 m2', () => {
        const room = rectangle(8, 6);
        expect(requiredOutletCount(room, 'aula')).toBe(5);
        expect(requiredOutletCount(room, 'comedor')).toBe(4);
    });

    it('garantiza en exteriores una separación no mayor a 9 m', () => {
        const exterior = rectangle(15, 10);
        const count = requiredOutletCount(exterior, 'exterior');
        expect(count).toBe(6);
        expect(50 / count).toBeLessThanOrEqual(9);
        expect(distributeOutletsOnPerimeter(exterior, count)).toHaveLength(6);
    });
    it('permite fijar el punto inicial como distancia sobre el perímetro', () => {
        const points = distributeOutletsOnPerimeter(rectangle(10, 5), 3, 2);
        expect(points[0]).toEqual({ x: 2, y: 0 });
    });
});
