import { describe, expect, it } from 'vitest';
import { filterPointsOutsideMarginalZone } from './marginalZoneFilter';
import type { GridPoint } from './lightingEngineCore';
import type { Vertex } from './types';

const SQUARE_ROOM: Vertex[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
];

function point(x: number, y: number, active = true): GridPoint {
    return { x, y, z: 0.8, normal: { x: 0, y: 0, z: 1 }, active };
}

describe('filterPointsOutsideMarginalZone', () => {
    it('excluye los puntos más cerca del borde que el margen', () => {
        const points = [point(0.2, 5), point(5, 5), point(9.8, 5)];
        const values = [100, 200, 300];

        const result = filterPointsOutsideMarginalZone(points, values, SQUARE_ROOM, 0.5);

        // Los dos puntos a 0.2m del borde quedan excluidos; el central (a 5m) no.
        expect(result).toEqual([200]);
    });

    it('margen <= 0 no excluye nada (equivale al comportamiento de siempre)', () => {
        const points = [point(0.1, 0.1), point(5, 5)];
        const values = [100, 200];

        expect(filterPointsOutsideMarginalZone(points, values, SQUARE_ROOM, 0)).toEqual([100, 200]);
        expect(filterPointsOutsideMarginalZone(points, values, SQUARE_ROOM, -1)).toEqual([100, 200]);
    });

    it('margen tan grande que vacía el resultado devuelve un array vacío (el llamador decide el respaldo)', () => {
        const points = [point(5, 5)];
        const values = [200];

        // El único punto está a 5m de cada borde; un margen de 6m lo excluye.
        expect(filterPointsOutsideMarginalZone(points, values, SQUARE_ROOM, 6)).toEqual([]);
    });

    it('ignora puntos inactivos (fuera del polígono) igual que el resto del motor', () => {
        const points = [point(5, 5, false), point(5, 5, true)];
        const values = [100, 200];

        expect(filterPointsOutsideMarginalZone(points, values, SQUARE_ROOM, 0.5)).toEqual([200]);
    });

    it('ignora puntos con valor null (fuera del polígono en calculatePointByPoint)', () => {
        const points = [point(5, 5), point(6, 6)];
        const values = [null, 200];

        expect(filterPointsOutsideMarginalZone(points, values, SQUARE_ROOM, 0.5)).toEqual([200]);
    });
});
