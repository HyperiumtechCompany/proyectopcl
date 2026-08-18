import { describe, expect, it } from 'vitest';
import { formatSensorGridForRtrace, generateSensorGrid } from './generateSensorGrid';

/**
 * Ronda 21 (`planes/plan_cierre_brecha_paridad_dialux_evo.md` §-21):
 * `generateSensorGrid()` (rectángulo) ahora es un envoltorio sobre
 * `generatePolygonSensorGrid()` — recibe `spacing`, no `columns`/`rows`
 * explícitos (ver `generatePolygonSensorGrid.parity.test.ts` para la
 * prueba de paridad exacta contra `buildGrid()` de producción).
 */
describe('generateSensorGrid', () => {
    it('genera floor(width/spacing) x floor(depth/spacing) puntos, todos respetando la zona marginal', () => {
        const points = generateSensorGrid({
            width: 2.209,
            depth: 0.95,
            workingPlaneHeight: 0,
            marginalZone: 0.125,
            spacing: 0.5,
        });

        // floor(2.209/0.5)=4 columnas x floor(0.95/0.5)=1 fila = 4 puntos.
        expect(points).toHaveLength(4);
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
            spacing: 2,
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
                spacing: 0.3,
            }),
        ).toThrow(/no dejaron ningún sensor/);
    });

    it('formatSensorGridForRtrace produce una línea "x y z dx dy dz" por punto', () => {
        const points = generateSensorGrid({
            width: 2,
            depth: 2,
            workingPlaneHeight: 0,
            marginalZone: 0.1,
            spacing: 1,
        });
        const formatted = formatSensorGridForRtrace(points);
        const lines = formatted.trim().split('\n');
        expect(lines).toHaveLength(points.length);
        expect(lines[0]).toMatch(/^\d+\.\d{4} \d+\.\d{4} \d+\.\d{4} 0 0 1$/);
    });
});
