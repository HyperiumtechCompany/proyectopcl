import { describe, expect, it } from 'vitest';
import { isPointInZone, computeValidInstallationZones } from '../geometry/ceilingProjection';
import {
    calculateFixtureGridPositions,
    calculateGuidedFixtureGridPositions,
    estimatePhotometricFixtureQuantity,
    isPointInPolygon,
    normalizeGuideBoundaries,
    polygonCentroid,
    suggestFixtureGridSize,
} from './fixtureGrid';
import {
    buildFixtureGridObjects,
    calculateObstacleAwareFixtureGridPositions,
} from './fixtureGridObstacles';
import type { StructuralObstacle } from './types';

/** Compara posiciones con tolerancia de punto flotante (no bit-exacto). */
function expectSameFixturePositions(a: { x: number; y: number }[], b: { x: number; y: number }[]) {
    expect(a).toHaveLength(b.length);
    a.forEach((p, i) => {
        expect(p.x).toBeCloseTo(b[i].x, 9);
        expect(p.y).toBeCloseTo(b[i].y, 9);
    });
}

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

    it('sin obstaculos, el 5º parametro es opcional y el resultado es idéntico al camino clásico', () => {
        const room = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }];
        const withoutParam = buildFixtureGridObjects({ rows: 2, columns: 2, fixtureTemplate: {} }, room, () => 'g');
        const withEmptyObstacles = buildFixtureGridObjects({ rows: 2, columns: 2, fixtureTemplate: {} }, room, () => 'g', []);
        expect(withoutParam.map((f) => ({ x: f.x, y: f.y }))).toEqual(
            withEmptyObstacles.map((f) => ({ x: f.x, y: f.y })),
        );
    });
});

describe('calculateObstacleAwareFixtureGridPositions', () => {
    const room10x10 = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];

    function makeColumn(overrides: Partial<StructuralObstacle> = {}): StructuralObstacle {
        return {
            id: 'col-1', name: 'Columna 1', obstacleType: 'column',
            vertices: [{ x: 4, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 6 }, { x: 4, y: 6 }],
            height: 3, elevation: 0,
            ...overrides,
        };
    }

    it('sin obstaculos, delega exactamente al algoritmo clasico (mismas posiciones)', () => {
        const classic = calculateFixtureGridPositions(room10x10, 3, 3);
        const obstacleAware = calculateObstacleAwareFixtureGridPositions(room10x10, [], 2.7, 3, 3);
        expectSameFixturePositions(obstacleAware, classic);
    });

    it('un obstaculo que no bloquea la altura de montaje no cambia el resultado', () => {
        const beam = makeColumn({ obstacleType: 'beam', elevation: 2.5, height: 0.1 });
        const classic = calculateFixtureGridPositions(room10x10, 3, 3);
        const obstacleAware = calculateObstacleAwareFixtureGridPositions(room10x10, [beam], 2.0, 3, 3);
        expectSameFixturePositions(obstacleAware, classic);
    });

    it('las guias se aplican cuando no hay obstaculos relevantes', () => {
        const guided = calculateObstacleAwareFixtureGridPositions(room10x10, [], 2.7, 1, 2, undefined, [0.2]);
        expect(guided[0].x).toBeCloseTo(1, 6);
        expect(guided[1].x).toBeCloseTo(6, 6);
    });

    it('ninguna luminaria cae dentro de la columna cuando esta bloquea el montaje', () => {
        const column = makeColumn();
        const positions = calculateObstacleAwareFixtureGridPositions(room10x10, [column], 2.7, 4, 4);
        const zones = computeValidInstallationZones(room10x10, [column], 2.7);
        positions.forEach((pos) => {
            const insideSomeZone = zones.some((zone) => isPointInZone(pos, zone));
            expect(insideSomeZone).toBe(true);
        });
    });

    it('conserva la cantidad total pedida (rows*columns) salvo redondeo por zona', () => {
        const column = makeColumn();
        const positions = calculateObstacleAwareFixtureGridPositions(room10x10, [column], 2.7, 4, 4);
        expect(positions.length).toBeGreaterThan(0);
        expect(positions.length).toBeLessThanOrEqual(16);
    });

    it('un obstaculo que divide el room reparte luminarias en ambas zonas', () => {
        const wall: StructuralObstacle = {
            id: 'wall-1', name: 'Muro', obstacleType: 'restricted_area',
            vertices: [{ x: 4.5, y: -1 }, { x: 5.5, y: -1 }, { x: 5.5, y: 11 }, { x: 4.5, y: 11 }],
            height: 3, elevation: 0,
        };
        const positions = calculateObstacleAwareFixtureGridPositions(room10x10, [wall], 2.7, 4, 4);
        const leftCount = positions.filter((p) => p.x < 4.5).length;
        const rightCount = positions.filter((p) => p.x > 5.5).length;
        expect(leftCount).toBeGreaterThan(0);
        expect(rightCount).toBeGreaterThan(0);
        expect(leftCount + rightCount).toBe(positions.length);
    });
});

describe('normalizeGuideBoundaries', () => {
    it('sin guias, produce fronteras uniformes', () => {
        expect(normalizeGuideBoundaries(undefined, 1)).toEqual([0, 0.5, 1]);
        expect(normalizeGuideBoundaries(undefined, 3)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    });

    it('longitud incorrecta se degrada a uniforme', () => {
        expect(normalizeGuideBoundaries([0.2, 0.9], 1)).toEqual([0, 0.5, 1]);
    });

    it('ordena guias desordenadas', () => {
        expect(normalizeGuideBoundaries([0.7, 0.3], 2)).toEqual([0, 0.3, 0.7, 1]);
    });

    it('guias degeneradas (demasiado juntas) se degradan a uniforme', () => {
        expect(normalizeGuideBoundaries([0.5, 0.5001], 2)).toEqual([0, 1 / 3, 2 / 3, 1]);
    });

    it('divider count 0 (una sola fila/columna) da solo los extremos', () => {
        expect(normalizeGuideBoundaries([], 0)).toEqual([0, 1]);
        expect(normalizeGuideBoundaries(undefined, 0)).toEqual([0, 1]);
    });
});

describe('calculateGuidedFixtureGridPositions', () => {
    const room10x10 = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    const lShape = [
        { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 },
        { x: 2, y: 2 }, { x: 2, y: 4 }, { x: 0, y: 4 },
    ];

    it('sin guias, equivale a calculateFixtureGridPositions (rectangulo)', () => {
        for (const [rows, cols] of [[1, 1], [1, 2], [2, 1], [3, 3], [2, 4]] as const) {
            expectSameFixturePositions(
                calculateGuidedFixtureGridPositions(room10x10, rows, cols),
                calculateFixtureGridPositions(room10x10, rows, cols),
            );
        }
    });

    it('sin guias, equivale a calculateFixtureGridPositions (forma en L, con clamp)', () => {
        expectSameFixturePositions(
            calculateGuidedFixtureGridPositions(lShape, 2, 2),
            calculateFixtureGridPositions(lShape, 2, 2),
        );
    });

    it('una guia de columna movida hacia la izquierda desplaza el centro de ambas celdas', () => {
        const uniform = calculateGuidedFixtureGridPositions(room10x10, 1, 2);
        const shifted = calculateGuidedFixtureGridPositions(room10x10, 1, 2, undefined, [0.2]);
        // Frontera en 0.2 (en vez de 0.5) -> celda izquierda centrada en 0.1*10=1, derecha en 0.6*10=6.
        expect(shifted[0].x).toBeCloseTo(1, 6);
        expect(shifted[1].x).toBeCloseTo(6, 6);
        expect(shifted[0].x).not.toBeCloseTo(uniform[0].x, 3);
    });

    it('una guia de fila alineada con una viga real produce centros asimetricos por diseno', () => {
        // Viga real a 30% de la altura del ambiente (no al medio): la celda de
        // arriba debe ser mas angosta que la de abajo.
        const positions = calculateGuidedFixtureGridPositions(room10x10, 2, 1, [0.3]);
        const topY = positions[0].y;
        const bottomY = positions[1].y;
        expect(topY).toBeCloseTo(1.5, 6); // centro de [0, 0.3] * 10
        expect(bottomY).toBeCloseTo(6.5, 6); // centro de [0.3, 1] * 10
    });

    it('guias invalidas (fuera de rango) se clampan sin generar celdas invertidas', () => {
        const positions = calculateGuidedFixtureGridPositions(room10x10, 1, 2, undefined, [1.5]);
        expect(positions).toHaveLength(2);
        expect(positions[0].x).toBeLessThan(positions[1].x);
    });
});
