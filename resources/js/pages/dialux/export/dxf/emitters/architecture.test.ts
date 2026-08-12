import { describe, expect, it } from 'vitest';
import type { DxfEntity } from '@/pages/dialux/hooks/types';
import { renderImportedEntities } from './architecture';

function countOccurrences(text: string, needle: string): number {
    return text.split(needle).length - 1;
}

describe('renderImportedEntities — ellipse/point del plano base importado', () => {
    it('una elipse circular (minor_ratio=1) se aproxima con puntos a distancia = radio mayor del centro', () => {
        const out: string[] = [];
        const entities: DxfEntity[] = [{
            id: 'e1', type: 'ellipse', layer: 'L',
            cx: 10, cy: 5, major_x: 2, major_y: 0, minor_ratio: 1,
            start_param: 0, end_param: 2 * Math.PI,
        }];

        renderImportedEntities(out, entities);
        const dxf = out.join('\n');

        // Emitida como polilínea de LINE (R12-safe), no como entidad ELLIPSE nativa.
        expect(dxf).not.toContain('0\nELLIPSE');
        expect(countOccurrences(dxf, '0\nLINE')).toBeGreaterThan(20);

        // Los puntos de inicio/fin de cada segmento deben quedar a ~radio 2 del centro (10,5).
        const xs = [...dxf.matchAll(/10\n(-?\d+\.\d+)/g)].map((m) => Number(m[1]));
        const ys = [...dxf.matchAll(/20\n(-?\d+\.\d+)/g)].map((m) => Number(m[1]));
        expect(xs.length).toBeGreaterThan(0);
        for (let i = 0; i < xs.length; i++) {
            const dist = Math.hypot(xs[i] - 10, ys[i] - 5);
            expect(dist).toBeCloseTo(2, 3);
        }
    });

    it('una elipse degenerada (eje mayor nulo) no emite nada ni lanza', () => {
        const out: string[] = [];
        const entities: DxfEntity[] = [{
            id: 'e2', type: 'ellipse', layer: 'L',
            cx: 0, cy: 0, major_x: 0, major_y: 0, minor_ratio: 1,
            start_param: 0, end_param: 2 * Math.PI,
        }];

        expect(() => renderImportedEntities(out, entities)).not.toThrow();
        expect(out.join('\n')).toBe('');
    });

    it('un point del CAD importado se emite como entidad POINT nativa en su posición', () => {
        const out: string[] = [];
        const entities: DxfEntity[] = [
            { id: 'p1', type: 'point', layer: 'L', x: 3, y: 4 },
        ];

        renderImportedEntities(out, entities);
        const dxf = out.join('\n');

        expect(countOccurrences(dxf, '0\nPOINT')).toBe(1);
        expect(dxf).toContain('10\n3.000000');
        expect(dxf).toContain('20\n4.000000');
    });

    it('un hatch dibuja el contorno cerrado de cada boundary path (sin relleno de patrón)', () => {
        const out: string[] = [];
        const entities: DxfEntity[] = [
            { id: 'h1', type: 'hatch', layer: 'L', pattern_name: 'ANSI31', solid: false, boundary_paths: [[[0, 0], [5, 0], [5, 3], [0, 3]]] },
        ];

        renderImportedEntities(out, entities);
        const dxf = out.join('\n');

        // 4 vértices cerrados = 4 segmentos LINE (incluye el de cierre 4→0).
        expect(countOccurrences(dxf, '0\nLINE')).toBe(4);
        expect(dxf).toContain('10\n0.000000');
        expect(dxf).toContain('10\n5.000000');
    });

    it('hatch y texto van a capas propias (DXF_BASE_HATCH / DXF_BASE_TEXTO), no a DXF_BASE', () => {
        // Regresión: antes todo el CAD importado (líneas, hatch, texto)
        // compartía la capa 'DXF_BASE' -- un usuario no podía congelar/
        // ocultar el hatch que tapaba un texto sin perder también muros y
        // el resto del fondo. Reportado con un DXF real abierto en AutoCAD.
        const out: string[] = [];
        const entities: DxfEntity[] = [
            { id: 'l1', type: 'line', layer: 'L', x1: 0, y1: 0, x2: 1, y2: 1 },
            { id: 't1', type: 'text', layer: 'L', x: 0, y: 0, text: 'MEDIDOR DE INSTALACION', height: 0.1, rotation: 0 },
            { id: 'h1', type: 'hatch', layer: 'L', pattern_name: 'ANSI31', solid: false, boundary_paths: [[[0, 0], [1, 0], [1, 1]]] },
        ];

        renderImportedEntities(out, entities);
        const dxf = out.join('\n');

        // La línea (geometría general) sigue en 'DXF_BASE'; el hatch tiene 3
        // segmentos LINE en su propia capa, el texto va en la suya -- ninguno
        // de los dos debe caer en 'DXF_BASE' junto con la línea.
        expect(countOccurrences(dxf, '8\nDXF_BASE\n')).toBe(1);
        expect(countOccurrences(dxf, '8\nDXF_BASE_TEXTO\n')).toBe(1);
        expect(countOccurrences(dxf, '8\nDXF_BASE_HATCH\n')).toBe(3);
    });

    it('un hatch con boundary_paths vacío no emite nada ni lanza', () => {
        const out: string[] = [];
        const entities: DxfEntity[] = [
            { id: 'h2', type: 'hatch', layer: 'L', pattern_name: 'SOLID', solid: true, boundary_paths: [] },
        ];

        expect(() => renderImportedEntities(out, entities)).not.toThrow();
        expect(out.join('\n')).toBe('');
    });
});
