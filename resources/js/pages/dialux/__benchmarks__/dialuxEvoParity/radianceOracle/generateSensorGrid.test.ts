import { describe, expect, it } from 'vitest';
import { formatSensorGridForRtrace, generateSensorGrid } from './generateSensorGrid';

describe('generateSensorGrid', () => {
    it('genera columns x rows puntos, todos dentro de la zona marginal excluida', () => {
        const points = generateSensorGrid({
            width: 2.209,
            depth: 0.95,
            workingPlaneHeight: 0,
            marginalZone: 0.125,
            columns: 7,
            rows: 3,
        });

        expect(points).toHaveLength(21);
        const epsilon = 1e-9;
        for (const point of points) {
            expect(point.x).toBeGreaterThanOrEqual(0.125 - epsilon);
            expect(point.x).toBeLessThanOrEqual(2.209 - 0.125 + epsilon);
            expect(point.y).toBeGreaterThanOrEqual(0.125 - epsilon);
            expect(point.y).toBeLessThanOrEqual(0.95 - 0.125 + epsilon);
        }
    });

    it('aplica el desplazamiento vertical por defecto (0.01 m) sobre la altura del plano de trabajo', () => {
        const [point] = generateSensorGrid({
            width: 2,
            depth: 2,
            workingPlaneHeight: 0.85,
            marginalZone: 0.1,
            columns: 1,
            rows: 1,
        });
        expect(point!.z).toBeCloseTo(0.86, 5);
        expect(point!.dz).toBe(1);
    });

    it('con zona marginal que deja área útil no positiva: lanza un error explícito, no una grilla vacía o inválida en silencio', () => {
        expect(() =>
            generateSensorGrid({
                width: 1,
                depth: 1,
                workingPlaneHeight: 0,
                marginalZone: 0.6,
                columns: 3,
                rows: 3,
            }),
        ).toThrow(/área útil no positiva/);
    });

    it('formatSensorGridForRtrace produce una línea "x y z dx dy dz" por punto', () => {
        const points = generateSensorGrid({
            width: 2,
            depth: 2,
            workingPlaneHeight: 0,
            marginalZone: 0.1,
            columns: 2,
            rows: 1,
        });
        const formatted = formatSensorGridForRtrace(points);
        const lines = formatted.trim().split('\n');
        expect(lines).toHaveLength(2);
        expect(lines[0]).toMatch(/^\d+\.\d{4} \d+\.\d{4} \d+\.\d{4} 0 0 1$/);
    });
});
