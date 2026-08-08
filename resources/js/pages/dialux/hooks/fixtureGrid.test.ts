import { describe, expect, it } from 'vitest';
import {
    buildFixtureGridObjects,
    calculateFixtureGridPositions,
    estimatePhotometricFixtureQuantity,
    isPointInPolygon,
    polygonCentroid,
    suggestFixtureGridSize,
} from './fixtureGrid';

describe('estimatePhotometricFixtureQuantity', () => {
    it('ajusta la recomendación con el resultado punto-a-punto', () => {
        expect(estimatePhotometricFixtureQuantity(2, 76, 200, 1.5)).toEqual({
            exact: 200 / 38,
            rounded: 6,
        });
    });

    it('nunca recomienda menos que el método de lúmenes', () => {
        expect(estimatePhotometricFixtureQuantity(4, 427, 200, 1.5)).toEqual({
            exact: 800 / 427,
            rounded: 2,
        });
    });
});

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

    it('reduces an oversized grid to the exact required quantity', () => {
        expect(suggestFixtureGridSize(2, 2, 2, 1)).toEqual({ rows: 1, columns: 2 });
    });

    it('rounds and clamps non-integer or zero inputs before growing', () => {
        expect(suggestFixtureGridSize(0, 1.6, 5, 1)).toEqual({ rows: 1, columns: 5 });
    });

    it('conserva la fotometría LDT y las dimensiones al regenerar la grilla', () => {
        const photometricWeb = {
            c_angles: [0, 90], gamma_angles: [0, 45], candela: [[100, 200], [100, 200]],
            reference_lumens: 2580, provenance: 'manufacturer' as const, symmetry: 1,
        };
        const dimensions = { length: 0.2, width: 0.2, height: 0.104 };
        const fixtures = buildFixtureGridObjects({
            roomId: 'room-a', rows: 1, columns: 2,
            fixtureTemplate: { name: 'FLIQ', lumens: 2580, photometricWeb, dimensions },
        }, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }], () => 'group-1');

        expect(fixtures.every((fixture) => fixture.photometricWeb === photometricWeb)).toBe(true);
        expect(fixtures.every((fixture) => fixture.dimensions === dimensions)).toBe(true);
    });
});

describe('polygonCentroid / isPointInPolygon (formas irregulares)', () => {
    // Forma en L: cuadrado de 4x4 con un cuadrante de 2x2 recortado arriba-derecha.
    const lShape = [
        { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 },
        { x: 2, y: 2 }, { x: 2, y: 4 }, { x: 0, y: 4 },
    ];

    it('el centroide real no coincide con el centro del bounding box', () => {
        const centroid = polygonCentroid(lShape);
        // Centro del bbox sería (2,2) — cae justo en el recorte.
        expect(centroid.x).toBeCloseTo(1.667, 2);
        expect(centroid.y).toBeCloseTo(1.667, 2);
    });

    it('detecta correctamente puntos dentro y fuera del recorte', () => {
        expect(isPointInPolygon({ x: 1, y: 1 }, lShape)).toBe(true);
        expect(isPointInPolygon({ x: 3, y: 3 }, lShape)).toBe(false); // en el recorte
    });

    it('calculateFixtureGridPositions nunca coloca luminarias fuera del recinto en forma L', () => {
        const positions = calculateFixtureGridPositions(lShape, 2, 2);
        expect(positions).toHaveLength(4);
        positions.forEach((p) => {
            expect(isPointInPolygon(p, lShape)).toBe(true);
        });
    });

    it('centra un único punto sobre el centroide real, no el del bbox', () => {
        const [single] = calculateFixtureGridPositions(lShape, 1, 1);
        expect(single.x).toBeCloseTo(1.667, 2);
        expect(single.y).toBeCloseTo(1.667, 2);
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
