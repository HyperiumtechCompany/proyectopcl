import { describe, expect, it } from 'vitest';
import { overcastSkyRelativeLuminance } from './cieOvercastSky';

describe('cieOvercastSky', () => {
    it('es máxima (1) exactamente en el cenit', () => {
        expect(overcastSkyRelativeLuminance(0)).toBeCloseTo(1, 9);
    });

    it('vale 1/3 en el horizonte (π/2) — resultado conocido de Moon-Spencer', () => {
        expect(overcastSkyRelativeLuminance(Math.PI / 2)).toBeCloseTo(1 / 3, 9);
    });

    it('decrece monótonamente del cenit al horizonte', () => {
        const angles = [0, Math.PI / 8, Math.PI / 4, (3 * Math.PI) / 8, Math.PI / 2];
        const values = angles.map(overcastSkyRelativeLuminance);
        for (let i = 1; i < values.length; i++) {
            expect(values[i]!).toBeLessThan(values[i - 1]!);
        }
    });

    it('es 0 por debajo del horizonte o con ángulos inválidos', () => {
        expect(overcastSkyRelativeLuminance(Math.PI / 2 + 0.01)).toBe(0);
        expect(overcastSkyRelativeLuminance(-0.01)).toBe(0);
        expect(overcastSkyRelativeLuminance(Number.NaN)).toBe(0);
    });
});
