import { describe, expect, it } from 'vitest';
import { resolveVertexAlignmentSnap } from './vertexAlignmentSnap';

describe('resolveVertexAlignmentSnap', () => {
    it('ajusta X cuando el punto arrastrado cae cerca de la columna de otro vértice', () => {
        const result = resolveVertexAlignmentSnap({ x: 103, y: 50 }, [{ x: 100, y: 200 }], 10);
        expect(result.point).toEqual({ x: 100, y: 50 });
        expect(result.guideX).toBe(100);
        expect(result.guideY).toBeNull();
    });

    it('ajusta Y cuando el punto arrastrado cae cerca de la fila de otro vértice', () => {
        const result = resolveVertexAlignmentSnap({ x: 50, y: 204 }, [{ x: 300, y: 200 }], 10);
        expect(result.point).toEqual({ x: 50, y: 200 });
        expect(result.guideY).toBe(200);
        expect(result.guideX).toBeNull();
    });

    it('ajusta X e Y a la vez cuando dos vértices DISTINTOS aportan cada guía', () => {
        const result = resolveVertexAlignmentSnap(
            { x: 101, y: 199 },
            [
                { x: 100, y: 50 }, // aporta la columna (X)
                { x: 400, y: 200 }, // aporta la fila (Y)
            ],
            10,
        );
        expect(result.point).toEqual({ x: 100, y: 200 });
        expect(result.guideX).toBe(100);
        expect(result.guideY).toBe(200);
    });

    it('no ajusta nada si ningún candidato está dentro de la tolerancia', () => {
        const result = resolveVertexAlignmentSnap({ x: 50, y: 50 }, [{ x: 300, y: 300 }], 10);
        expect(result.point).toEqual({ x: 50, y: 50 });
        expect(result.guideX).toBeNull();
        expect(result.guideY).toBeNull();
    });

    it('elige el candidato MÁS CERCANO cuando varios están dentro de tolerancia', () => {
        const result = resolveVertexAlignmentSnap(
            { x: 105, y: 50 },
            [
                { x: 100, y: 10 }, // dist 5
                { x: 108, y: 10 }, // dist 3, más cerca
            ],
            10,
        );
        expect(result.guideX).toBe(108);
    });

    it('sin candidatos, no hace nada', () => {
        const result = resolveVertexAlignmentSnap({ x: 12, y: 34 }, [], 10);
        expect(result).toEqual({ point: { x: 12, y: 34 }, guideX: null, guideY: null });
    });
});
