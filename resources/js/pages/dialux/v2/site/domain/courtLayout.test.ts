import { describe, expect, it } from 'vitest';
import { courtLines, COURT_REFERENCE_M } from './courtLayout';

describe('site/domain/courtLayout', () => {
    it('cada deporte genera marcas y todas quedan dentro de la cancha', () => {
        for (const sport of ['futsal', 'basketball', 'volleyball', 'multi'] as const) {
            const { length, width } = COURT_REFERENCE_M[sport];
            const lines = courtLines(sport, length, width);
            expect(lines.length).toBeGreaterThan(2);
            for (const line of lines) {
                for (const [x, y] of line) {
                    expect(Math.abs(x)).toBeLessThanOrEqual(length / 2 + 1e-6);
                    expect(Math.abs(y)).toBeLessThanOrEqual(width / 2 + 1e-6);
                }
            }
        }
    });

    it('se escala a las medidas de la cancha dibujada, sin salirse', () => {
        const lines = courtLines('basketball', 20, 11);
        for (const line of lines) {
            for (const [x, y] of line) {
                expect(Math.abs(x)).toBeLessThanOrEqual(10 + 1e-6);
                expect(Math.abs(y)).toBeLessThanOrEqual(5.5 + 1e-6);
            }
        }
    });

    it('vóley: red al centro y líneas de ataque a 3 m de ella (escaladas)', () => {
        const lines = courtLines('volleyball', 18, 9);
        const xs = lines.filter((l) => l.length === 2).map((l) => l[0][0]).sort((a, b) => a - b);
        expect(xs).toEqual([-3, 0, 3]);
    });

    it('"sin marcas" o medidas nulas no dibujan nada', () => {
        expect(courtLines('none', 28, 15)).toEqual([]);
        expect(courtLines('futsal', 0, 20)).toEqual([]);
    });
});
