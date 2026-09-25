import { describe, expect, it } from 'vitest';
import {
    isExclusiveSpace,
    overlappingSpaces,
    overlapFraction,
    polygonsClash,
    exclusiveSpacePolygons,
    polygonsOverlap,
    pushOutsideSpaces,
} from './spaceGuard';

const rect = (x0: number, y0: number, x1: number, y1: number) => [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
];

describe('site/domain/spaceGuard', () => {
    it('rampas, escaleras y edificios son espacios exclusivos; terreno y calles no', () => {
        for (const t of ['ramp', 'stair', 'building_block', 'court'] as const) {
            expect(isExclusiveSpace(t)).toBe(true);
        }
        for (const t of ['terrain', 'street', 'terrace_platform', 'fence', 'canopy'] as const) {
            expect(isExclusiveSpace(t)).toBe(false);
        }
    });

    it('un punto dentro de otro espacio sale por el borde más cercano', () => {
        const stair = rect(10, 0, 20, 10);
        const out = pushOutsideSpaces({ x: 11, y: 5 }, [{ vertices: stair }], 0.1);
        expect(out.x).toBeLessThan(10);
        expect(out.y).toBeCloseTo(5, 1);
    });

    it('un punto fuera no se mueve', () => {
        const p = { x: 3, y: 3 };
        expect(pushOutsideSpaces(p, [{ vertices: rect(10, 0, 20, 10) }])).toBe(p);
    });

    it('detecta cruce de aristas y contención, pero no dos espacios que solo se tocan', () => {
        expect(polygonsOverlap(rect(0, 0, 10, 10), rect(5, 5, 15, 15))).toBe(true);
        expect(polygonsOverlap(rect(0, 0, 20, 20), rect(5, 5, 10, 10))).toBe(true);
        expect(polygonsOverlap(rect(0, 0, 10, 10), rect(10, 0, 20, 10))).toBe(false);
        expect(polygonsOverlap(rect(0, 0, 10, 10), rect(30, 0, 40, 10))).toBe(false);
    });

    it('lista con qué espacios se superpone', () => {
        const found = overlappingSpaces(rect(0, 0, 10, 10), [
            { id: 'a', label: 'Escalera', vertices: rect(8, 2, 14, 8) },
            { id: 'b', label: 'Cancha', vertices: rect(20, 20, 30, 30) },
        ]);
        expect(found).toEqual([{ id: 'a', label: 'Escalera' }]);
    });

    it('un roce casi tangente no es un choque; una superposición real sí', () => {
        // Se cruzan por una franja de 0.05 de ancho sobre 10 de alto (0.5 % del más pequeño).
        expect(polygonsClash(rect(0, 0, 10, 10), rect(9.95, 2, 20, 8))).toBe(false);
        expect(polygonsClash(rect(0, 0, 10, 10), rect(5, 2, 20, 8))).toBe(true);
        expect(overlapFraction(rect(0, 0, 10, 10), rect(5, 0, 15, 10))).toBeCloseTo(0.5, 1);
    });

    it('un objeto en una capa oculta no bloquea', () => {
        const el = (id: string) => ({
            id,
            type: 'sidewalk' as const,
            label: id,
            vertices: rect(0, 0, 5, 5),
            style: { fillColor: '#000', strokeColor: '#000' },
        });
        const layers = [{ id: 'l', label: 'l', types: ['sidewalk' as const], visible: false, locked: false }];
        expect(exclusiveSpacePolygons([el('a')], [], layers)).toEqual([]);
        expect(exclusiveSpacePolygons([el('a')], [], undefined)).toHaveLength(1);
    });
});
