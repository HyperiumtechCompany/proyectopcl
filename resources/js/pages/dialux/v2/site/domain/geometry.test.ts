import { describe, expect, it } from 'vitest';
import {
    boundingBox,
    pointInPolygon,
    polygonArea,
    polygonPerimeter,
    polylineLength,
    snapToGrid,
} from './geometry';

describe('site/domain/geometry', () => {
    it('calcula área y perímetro de un rectángulo de 10x5 m', () => {
        const square = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 5 },
            { x: 0, y: 5 },
        ];
        expect(polygonArea(square)).toBeCloseTo(50, 6);
        expect(polygonPerimeter(square)).toBeCloseTo(30, 6);
    });

    it('detecta puntos dentro y fuera del polígono', () => {
        const square = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];
        expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
        expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
    });

    it('suma la longitud de una polilínea abierta (no la cierra como un anillo)', () => {
        const path = [
            { x: 0, y: 0 },
            { x: 3, y: 0 },
            { x: 3, y: 4 },
        ];
        expect(polylineLength(path)).toBeCloseTo(7, 6);
    });

    it('polylineLength de un solo punto es 0', () => {
        expect(polylineLength([{ x: 5, y: 5 }])).toBe(0);
    });

    it('calcula la caja envolvente de un conjunto de vértices', () => {
        const vertices = [
            { x: -2, y: 3 },
            { x: 8, y: -1 },
            { x: 4, y: 6 },
        ];
        expect(boundingBox(vertices)).toMatchObject({
            minX: -2,
            minY: -1,
            maxX: 8,
            maxY: 6,
        });
    });

    it('ajusta un punto a la cuadrícula más cercana', () => {
        expect(snapToGrid({ x: 12, y: 27 }, 10)).toEqual({ x: 10, y: 30 });
        expect(snapToGrid({ x: 12, y: 27 }, 0)).toEqual({ x: 12, y: 27 });
    });
});
