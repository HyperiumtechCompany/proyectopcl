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

describe('Ronda 21g — etiquetas de anillos/ángulos, flujo total y segundo plano C', () => {
    it('etiqueta los 3 anillos con su valor de candela proporcional al máximo', () => {
        const svg = buildPolarSvgFromMatrix(
            { gamma_angles: [0, 30, 60, 90], candela: [[1200, 900, 400, 0]] },
            'X',
        );
        // Anillos a 1/3, 2/3 y 3/3 (máximo) de 1200 cd.
        expect(svg).toContain('>400<');
        expect(svg).toContain('>800<');
        expect(svg).toContain('>1,200<');
    });

    it('etiqueta los ángulos 0°/30°/60°/90° alrededor del gráfico', () => {
        const svg = buildPolarSvgFromMatrix({ gamma_angles: [0, 30, 60, 90], candela: [[500, 400, 200, 0]] }, 'X');
        expect(svg).toContain('>0°<');
        expect(svg).toContain('>30°<');
        expect(svg).toContain('>60°<');
        expect(svg).toContain('>90°<');
    });

    it('muestra el flujo luminoso total (Φ) cuando reference_lumens está presente', () => {
        const svg = buildPolarSvgFromMatrix(
            { gamma_angles: [0, 90], candela: [[500, 0]], reference_lumens: 2014 },
            'X',
        );
        expect(svg).toContain('Φ 2,014 lm');
    });

    it('no agrega Φ cuando no hay reference_lumens (no inventa datos)', () => {
        const svg = buildPolarSvgFromMatrix({ gamma_angles: [0, 90], candela: [[500, 0]] }, 'X');
        expect(svg).not.toContain('Φ');
    });

    it('con un solo plano C (luminaria simétrica) dibuja una sola curva azul y sin leyenda — sin cambio de color respecto al comportamiento previo', () => {
        const svg = buildPolarSvgFromMatrix(
            { c_angles: [0], gamma_angles: [0, 90], candela: [[500, 0]] },
            'X',
        );
        expect(svg).toContain('#2563eb');
        expect(svg).not.toContain('#dc2626');
        expect(svg).not.toContain('C0/C180');
    });

    it('con dos planos C distintos (C0 y C90) dibuja ambas curvas y la leyenda', () => {
        const svg = buildPolarSvgFromMatrix(
            {
                c_angles: [0, 90],
                gamma_angles: [0, 45, 90],
                candela: [
                    [1000, 500, 0],
                    [600, 300, 0],
                ],
            },
            'X',
        );
        expect(svg).toContain('C0/C180');
        expect(svg).toContain('C90/C270');
        expect(svg).toContain('#dc2626');
        expect(svg).toContain('#2563eb');
    });

    it('con solo C0 y C180 (sin C90 real) no confunde C180 con el eje C90/C270', () => {
        // c_angles=[0, 180]: ambos pertenecen al mismo eje que el plano
        // primario (0°) — ninguno está a menos de 30° de 90°/270°, así que
        // no debe agregarse una "segunda curva" mal etiquetada.
        const svg = buildPolarSvgFromMatrix(
            {
                c_angles: [0, 180],
                gamma_angles: [0, 45, 90],
                candela: [
                    [1200, 800, 100],
                    [1100, 700, 90],
                ],
            },
            'X',
        );
        expect(svg).not.toContain('C90/C270');
        expect(svg).not.toContain('#dc2626');
    });

    it('el máximo de candela considera ambos planos cuando hay dos', () => {
        // El segundo plano (C90) tiene el valor más alto — Imax debe reflejarlo.
        const svg = buildPolarSvgFromMatrix(
            {
                c_angles: [0, 90],
                gamma_angles: [0, 90],
                candela: [
                    [400, 0],
                    [900, 0],
                ],
            },
            'X',
        );
        expect(svg).toContain('Imax 900 cd');
    });
});
