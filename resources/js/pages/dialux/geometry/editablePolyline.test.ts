import { describe, expect, it } from 'vitest';
import { insertPolygonEdgeMidpoint, movePolygonVertex } from './editablePolyline';

const rectangle = [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 5, y: 2 },
    { x: 0, y: 2 },
];

describe('editablePolyline', () => {
    it('permite reducir un rectángulo moviendo sus vértices', () => {
        const resized = movePolygonVertex(rectangle, 1, { x: 2, y: 0 });
        expect(resized[1]).toEqual({ x: 2, y: 0 });
        expect(rectangle[1]).toEqual({ x: 5, y: 0 });
    });

    it('inserta un nuevo vértice en el centro de cualquier lado', () => {
        const result = insertPolygonEdgeMidpoint(rectangle, 0);
        expect(result.insertedIndex).toBe(1);
        expect(result.vertices).toHaveLength(5);
        expect(result.vertices[1]).toEqual({ x: 2.5, y: 0 });
    });
});
