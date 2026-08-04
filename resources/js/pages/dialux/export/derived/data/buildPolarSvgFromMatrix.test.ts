import { describe, expect, it } from 'vitest';
import { buildPolarSvgFromMatrix } from './buildPolarSvgFromMatrix';

describe('Fase 15 — buildPolarSvgFromMatrix', () => {
    it('genera un SVG determinista a partir de una matriz válida', () => {
        const svg = buildPolarSvgFromMatrix(
            { gamma_angles: [0, 30, 60, 90], candela: [[1000, 800, 400, 0]] },
            'Producto de prueba',
        );

        expect(svg).not.toBeNull();
        expect(svg).toContain('<svg');
        expect(svg).toContain('CDL polar');
        expect(svg).toContain('Producto de prueba');
        expect(svg).toContain('Imax 1,000 cd');
    });

    it('es determinista: misma entrada produce el mismo SVG', () => {
        const web = { gamma_angles: [0, 45, 90], candela: [[500, 300, 100]] };
        const first = buildPolarSvgFromMatrix(web, 'X');
        const second = buildPolarSvgFromMatrix(web, 'X');
        expect(first).toBe(second);
    });

    it('devuelve null sin gamma_angles', () => {
        expect(buildPolarSvgFromMatrix({ candela: [[1, 2, 3]] }, 'X')).toBeNull();
    });

    it('devuelve null sin candela', () => {
        expect(buildPolarSvgFromMatrix({ gamma_angles: [0, 45, 90] }, 'X')).toBeNull();
    });

    it('devuelve null con matriz vacía', () => {
        expect(buildPolarSvgFromMatrix({ gamma_angles: [], candela: [[]] }, 'X')).toBeNull();
    });

    it('devuelve null cuando la candela máxima es 0 (curva degenerada)', () => {
        expect(buildPolarSvgFromMatrix({ gamma_angles: [0, 90], candela: [[0, 0]] }, 'X')).toBeNull();
    });

    it('devuelve null con entrada nula/indefinida', () => {
        expect(buildPolarSvgFromMatrix(null, 'X')).toBeNull();
        expect(buildPolarSvgFromMatrix(undefined, 'X')).toBeNull();
    });

    it('escapa caracteres especiales del título', () => {
        const svg = buildPolarSvgFromMatrix({ gamma_angles: [0, 90], candela: [[100, 50]] }, 'A & B <script>');
        expect(svg).toContain('A &amp; B &lt;script&gt;');
        expect(svg).not.toContain('<script>');
    });
});
