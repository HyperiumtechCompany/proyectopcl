import { describe, expect, it } from 'vitest';
import type { LightingResult } from '@/pages/dialux/hooks/types';
import { areaIsolines, areaIsoluxLevels, areaRaster, isoluxContours, isoluxLevelsFor } from './isoluxContours';

function grid(cols: number, rows: number, f: (x: number, y: number) => number | null): LightingResult {
    const values: Array<number | null> = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) values.push(f(c + 0.5, r + 0.5));
    }
    return {
        grid_cols: cols,
        grid_rows: rows,
        grid_values: values,
        grid_origin_x: 0,
        grid_origin_y: 0,
        grid_cell_width: 1,
        grid_cell_height: 1,
    } as unknown as LightingResult;
}

describe('curvas isolux (marching squares sobre la malla del motor V1)', () => {
    it('iluminancia = x: cada curva es una recta vertical exactamente en x = nivel', () => {
        const lines = isoluxContours(grid(20, 10, (x) => x), [5, 12.5]);
        expect(lines.map((line) => line.level)).toEqual([5, 12.5]);
        for (const line of lines) {
            expect(line.closed).toBe(false);
            for (const p of line.points) expect(p.x).toBeCloseTo(line.level, 9);
            // Recorre toda la malla de arriba abajo (0,5 → 9,5).
            const ys = line.points.map((p) => p.y);
            expect(Math.min(...ys)).toBeCloseTo(0.5, 9);
            expect(Math.max(...ys)).toBeCloseTo(9.5, 9);
        }
    });

    it('un cono de luz da una curva CERRADA de radio correcto', () => {
        const [line] = isoluxContours(grid(41, 41, (x, y) => 100 - 5 * Math.hypot(x - 20.5, y - 20.5)), [50]);
        expect(line.closed).toBe(true);
        for (const p of line.points) {
            // Radio 10 m; la interpolación lineal en celdas de 1 m se aparta poco.
            expect(Math.abs(Math.hypot(p.x - 20.5, p.y - 20.5) - 10)).toBeLessThan(0.05);
        }
    });

    it('no traza curvas por celdas sin valor (fuera de la superficie)', () => {
        const lines = isoluxContours(grid(20, 10, (x) => (x > 10 ? null : x)), [5, 15]);
        expect(lines.map((line) => line.level)).toEqual([5]);
    });

    it('niveles: solo los que cruzan la malla', () => {
        expect(isoluxLevelsFor([3, 8, 40, null])).toEqual([5, 10, 20, 30]);
    });
});

describe('niveles de curvas por espacio', () => {
    const flat = (min: number, max: number) =>
        grid(10, 1, (x) => min + ((max - min) * (x - 0.5)) / 9);

    it('vereda 3–18 lx: escalones finos (incluye 7,5 lx, la clase P3)', () => {
        expect(areaIsoluxLevels([flat(3, 18)])).toEqual([5, 7.5, 10, 12.5, 15, 17.5]);
    });

    it('cancha 80–600 lx: niveles propios, altos', () => {
        expect(areaIsoluxLevels([flat(80, 600)])).toEqual([100, 200, 300, 400, 500]);
    });

    it('rango amplio (2–1000 lx): como mucho 8 curvas', () => {
        expect(areaIsoluxLevels([flat(2, 1000)]).length).toBeLessThanOrEqual(8);
    });

    it('todos los parches del espacio comparten los niveles', () => {
        const a = flat(4, 12);
        const b = flat(20, 40);
        const levels = areaIsoluxLevels([a, b]);
        expect(levels[0]).toBeGreaterThan(4);
        expect(Math.max(...levels)).toBeLessThan(40);
    });
});

describe('curvas de un espacio con la curva de su norma', () => {
    it('agrega la curva del Ē exigido (marcada) además de los niveles propios', () => {
        const result = grid(20, 5, (x) => x);
        const iso = areaIsolines([result], 7.5);
        expect(iso.requiredLux).toBe(7.5);
        const required = iso.lines.filter((line) => line.required);
        expect(required.length).toBeGreaterThan(0);
        for (const p of required[0].points) expect(p.x).toBeCloseTo(7.5, 9);
        // La curva de la norma no se duplica como nivel propio.
        expect(iso.lines.filter((line) => !line.required && line.level === 7.5)).toHaveLength(0);
    });

    it('sin norma: solo niveles propios', () => {
        const iso = areaIsolines([grid(20, 5, (x) => x * 3)], null);
        expect(iso.requiredLux).toBeNull();
        expect(iso.lines.every((line) => !line.required)).toBe(true);
        expect(iso.levels.length).toBeGreaterThan(2);
    });
});

describe('curvas por espacio sobre malla continua (compatibles con el dibujo)', () => {
    // Franja angosta (vereda 20 × 2 m) calculada con UNA fila de puntos: por
    // parche no hay curvas (marching squares necesita 2 filas).
    const strip = {
        grid_values: [5, 10, 20, 30, 40, 30, 20, 10, 5, 2],
        grid_cols: 10,
        grid_rows: 1,
        grid_origin_x: 0,
        grid_origin_y: 0,
        grid_cell_width: 2,
        grid_cell_height: 2,
    } as unknown as LightingResult;
    const outline = [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 2 },
        { x: 0, y: 2 },
    ];

    it('un espacio de una sola fila de puntos igual tiene curvas', () => {
        expect(areaIsolines([strip], null).lines).toHaveLength(0);
        const iso = areaIsolines([strip], 20, [outline]);
        expect(iso.lines.length).toBeGreaterThan(0);
        expect(iso.lines.some((line) => line.required)).toBe(true);
    });

    it('la malla de dibujo conserva los valores calculados y no se aleja del contorno', () => {
        const raster = areaRaster([strip], [outline])!;
        const step = raster.grid_cell_width ?? 0;
        const cols = raster.grid_cols;
        // Centro de la celda de cálculo 4 (x = 9 m, y = 1 m) = 40 lx.
        const x0 = (raster.grid_origin_x ?? 0) + step / 2;
        const y0 = (raster.grid_origin_y ?? 0) + step / 2;
        const c = Math.round((9 - x0) / step);
        const r = Math.round((1 - y0) / step);
        // Interpolación bilineal: a ≤ medio paso del punto, entre 40 y su vecino (30).
        const value = raster.grid_values[r * cols + c] ?? 0;
        expect(Math.abs(x0 + c * step - 9)).toBeLessThanOrEqual(step / 2 + 1e-9);
        expect(value).toBeGreaterThanOrEqual(38 - 1e-9);
        expect(value).toBeLessThanOrEqual(40 + 1e-9);
        // Ningún nodo con valor a más de 1,5 pasos del contorno.
        raster.grid_values.forEach((value, index) => {
            if (value === null) return;
            const x = x0 + (index % cols) * step;
            const y = y0 + Math.floor(index / cols) * step;
            expect(x).toBeGreaterThanOrEqual(-step * 1.51);
            expect(x).toBeLessThanOrEqual(20 + step * 1.51);
            expect(y).toBeGreaterThanOrEqual(-step * 1.51);
            expect(y).toBeLessThanOrEqual(2 + step * 1.51);
        });
    });
});
