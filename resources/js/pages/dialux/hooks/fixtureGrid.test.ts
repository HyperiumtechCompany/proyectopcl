import { describe, expect, it } from 'vitest';
import { buildFixtureGridObjects, suggestFixtureGridSize } from './fixtureGrid';

describe('suggestFixtureGridSize', () => {
    it('grows columns first when that keeps the grid closer to a square room', () => {
        // 3x2 = 6 luminarias, se requieren 9 en un ambiente ~cuadrado.
        expect(suggestFixtureGridSize(3, 2, 9, 1.0)).toEqual({ rows: 3, columns: 3 });
    });

    it('grows the dimension matching an elongated room instead of the other one', () => {
        // Ambiente muy alargado (aspectRatio 4): con 8 requeridas, conviene
        // crecer columnas (eje largo) antes que filas.
        expect(suggestFixtureGridSize(2, 2, 8, 4)).toEqual({ rows: 2, columns: 4 });
    });

    it('leaves the grid untouched when it already meets the requirement', () => {
        expect(suggestFixtureGridSize(3, 3, 6, 1)).toEqual({ rows: 3, columns: 3 });
    });

    it('rounds and clamps non-integer or zero inputs before growing', () => {
        // rows=0 -> clamp a 1, columns=1.6 -> round a 2; crece filas para
        // corregir la forma alargada (1x2) hacia el aspectRatio cuadrado.
        expect(suggestFixtureGridSize(0, 1.6, 5, 1)).toEqual({ rows: 3, columns: 2 });
    });
});

describe('buildFixtureGridObjects', () => {
    it('conserva los watts y la identidad técnica de cada luminaria regenerada', () => {
        const fixtures = buildFixtureGridObjects({
            roomId: 'room-a', rows: 1, columns: 2,
            fixtureTemplate: { name: 'Panel 26W', power: 26, lumens: 3000, productId: 10, emergencyType: 'none' },
        }, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }], () => 'group-1');

        expect(fixtures).toHaveLength(2);
        expect(fixtures.every((fixture) => fixture.power === 26)).toBe(true);
        expect(fixtures.every((fixture) => fixture.productId === 10)).toBe(true);
        expect(fixtures[0].name).toContain('Panel 26W');
    });
});
