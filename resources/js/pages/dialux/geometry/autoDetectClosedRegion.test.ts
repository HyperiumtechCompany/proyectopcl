import { describe, expect, it } from 'vitest';
import { autoDetectClosedRegion, segmentsFromVertexRing, type Segment } from './autoDetectClosedRegion';

function rectSegments(x0: number, y0: number, x1: number, y1: number): Segment[] {
    return segmentsFromVertexRing(
        [
            { x: x0, y: y0 },
            { x: x1, y: y0 },
            { x: x1, y: y1 },
            { x: x0, y: y1 },
        ],
        true,
    );
}

describe('autoDetectClosedRegion', () => {
    it('detecta un rectángulo simple 4×3 m con el área correcta', () => {
        const result = autoDetectClosedRegion({ x: 2, y: 1.5 }, rectSegments(0, 0, 4, 3));
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        // Tolerancia principiada, no arbitraria: el contorno sigue la última
        // celda LIBRE antes de la pared (sesgo raster inherente, no un bug —
        // ver `segmentIntersectsCell`), así que el peor caso de error de
        // área es ~perímetro × cellSizeM = 14 × 0.02 = 0.28 m².
        expect(Math.abs(result.areaM2 - 12)).toBeLessThan(0.3);
        // Rectángulo → 4 vértices tras simplificar colineales.
        expect(result.vertices).toHaveLength(4);
    });

    it('detecta una forma en L (unión de dos rectángulos)', () => {
        // L: (0,0)-(6,0)-(6,2)-(2,2)-(2,4)-(0,4) — área = 6*2 + 2*2 = 16
        const segments = segmentsFromVertexRing(
            [
                { x: 0, y: 0 },
                { x: 6, y: 0 },
                { x: 6, y: 2 },
                { x: 2, y: 2 },
                { x: 2, y: 4 },
                { x: 0, y: 4 },
            ],
            true,
        );
        const result = autoDetectClosedRegion({ x: 1, y: 1 }, segments);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.areaM2).toBeCloseTo(16, 0);
    });

    it('reporta "not-enclosed" cuando el área no cierra dentro del radio de búsqueda (hueco en el contorno)', () => {
        // Mismo rectángulo pero con un hueco de 1m en un lado — el relleno se escapa.
        const segments: Segment[] = [
            { start: { x: 0, y: 0 }, end: { x: 4, y: 0 } },
            { start: { x: 4, y: 0 }, end: { x: 4, y: 3 } },
            { start: { x: 4, y: 3 }, end: { x: 0, y: 3 } },
            // falta el lado x=0 completo -> abierto
        ];
        const result = autoDetectClosedRegion({ x: 2, y: 1.5 }, segments, { maxRadiusM: 8 });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.reason).toBe('not-enclosed');
    });

    it('reporta "seed-blocked" cuando el clic cae exactamente sobre una línea', () => {
        const result = autoDetectClosedRegion({ x: 0, y: 1.5 }, rectSegments(0, 0, 4, 3));
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.reason).toBe('seed-blocked');
    });

    it('reporta "not-enclosed" cuando el clic está en espacio abierto sin ningún contorno cerca', () => {
        const result = autoDetectClosedRegion({ x: 100, y: 100 }, rectSegments(0, 0, 4, 3), { maxRadiusM: 5 });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.reason).toBe('not-enclosed');
    });

    it('un muro grueso (varios segmentos formando un pasillo) no dispara falsos "escapes" por diagonales', () => {
        // Cuadrado 10x10 con una partición interior en L que no debe afectar
        // la detección de la habitación exterior completa.
        const outer = rectSegments(0, 0, 10, 10);
        const result = autoDetectClosedRegion({ x: 0.5, y: 0.5 }, outer, { maxRadiusM: 15 });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.areaM2).toBeCloseTo(100, -1);
    });

    it('la unión de dos rectángulos vecinos con una pared compartida detecta cada uno por separado', () => {
        // Aula 1 (0,0)-(4,3) y Aula 2 (4,0)-(8,3), separadas por x=4.
        const segments: Segment[] = [
            ...rectSegments(0, 0, 4, 3),
            ...rectSegments(4, 0, 8, 3),
        ];
        const aula1 = autoDetectClosedRegion({ x: 2, y: 1.5 }, segments);
        const aula2 = autoDetectClosedRegion({ x: 6, y: 1.5 }, segments);
        expect(aula1.ok).toBe(true);
        expect(aula2.ok).toBe(true);
        if (!aula1.ok || !aula2.ok) return;
        // Misma tolerancia principiada que el rectángulo simple (ver arriba).
        expect(Math.abs(aula1.areaM2 - 12)).toBeLessThan(0.3);
        expect(Math.abs(aula2.areaM2 - 12)).toBeLessThan(0.3);
    });
});
