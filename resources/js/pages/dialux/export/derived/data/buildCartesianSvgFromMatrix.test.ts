import { describe, expect, it } from 'vitest';
import { buildCartesianSvgFromMatrix } from './buildCartesianSvgFromMatrix';

describe('buildCartesianSvgFromMatrix', () => {
    it('genera un SVG con ejes y grilla a partir de una matriz válida', () => {
        const svg = buildCartesianSvgFromMatrix(
            { gamma_angles: [0, 45, 90], candela: [[1000, 500, 0]] },
            'Producto de prueba',
        );
        expect(svg).not.toBeNull();
        expect(svg).toContain('<svg');
        expect(svg).toContain('Diagrama cartesiano');
        expect(svg).toContain('Producto de prueba');
    });

    it('devuelve null sin gamma_angles ni candela', () => {
        expect(buildCartesianSvgFromMatrix({ candela: [[1, 2, 3]] }, 'X')).toBeNull();
        expect(buildCartesianSvgFromMatrix({ gamma_angles: [0, 45, 90] }, 'X')).toBeNull();
        expect(buildCartesianSvgFromMatrix(null, 'X')).toBeNull();
    });

    it('dibuja una curva por cada plano C disponible, hasta 4', () => {
        const svg = buildCartesianSvgFromMatrix(
            {
                gamma_angles: [0, 90],
                candela: [
                    [1000, 0],
                    [800, 0],
                    [600, 0],
                    [400, 0],
                    [200, 0],
                ],
            },
            'X',
        );
        // Cada curva de plano C usa stroke-width="1.8" (único entre los <path>
        // del SVG — la grilla y el eje usan otros grosores) — el 5to plano se
        // descarta porque solo hay 4 colores definidos.
        const curveCount = (svg?.match(/stroke-width="1\.8"/g) ?? []).length;
        expect(curveCount).toBe(4);
    });

    it('muestra el flujo luminoso total (Φ) cuando reference_lumens está presente (Ronda 21g)', () => {
        const svg = buildCartesianSvgFromMatrix(
            { gamma_angles: [0, 90], candela: [[500, 0]], reference_lumens: 2014 },
            'X',
        );
        expect(svg).toContain('Φ 2,014 lm');
    });

    it('no agrega Φ cuando no hay reference_lumens', () => {
        const svg = buildCartesianSvgFromMatrix({ gamma_angles: [0, 90], candela: [[500, 0]] }, 'X');
        expect(svg).not.toContain('Φ');
    });
});
