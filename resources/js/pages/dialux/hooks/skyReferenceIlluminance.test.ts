import { describe, expect, it } from 'vitest';
import { computeUnobstructedOvercastSkyHorizontalIlluminance } from './skyReferenceIlluminance';

describe('skyReferenceIlluminance (test dorado de auto-consistencia)', () => {
    it('converge al resultado analítico conocido E = 7π/9 · L_zenit (Moon & Spencer, 1942)', () => {
        const analytic = (7 * Math.PI) / 9;
        const numeric = computeUnobstructedOvercastSkyHorizontalIlluminance(180, 360);
        expect(numeric).toBeCloseTo(analytic, 3);
    });

    it('una subdivisión más fina se acerca más al valor analítico que una gruesa', () => {
        const analytic = (7 * Math.PI) / 9;
        const coarse = computeUnobstructedOvercastSkyHorizontalIlluminance(10, 20);
        const fine = computeUnobstructedOvercastSkyHorizontalIlluminance(180, 360);
        expect(Math.abs(fine - analytic)).toBeLessThan(Math.abs(coarse - analytic));
    });
});
