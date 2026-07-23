import { describe, expect, it } from 'vitest';
import { calculateRoomIndex, estimateUtilizationFactor } from './lightingCalculations';

describe('estimateUtilizationFactor', () => {
    it('matches tabulated UF at reference reflectance (70/50/20) for typical room indices', () => {
        const reflectances = { ceiling: 0.7, wall: 0.5, floor: 0.2 };

        expect(estimateUtilizationFactor(0.6, reflectances)).toBeCloseTo(0.43, 2);
        expect(estimateUtilizationFactor(1.0, reflectances)).toBeCloseTo(0.57, 2);
        expect(estimateUtilizationFactor(2.5, reflectances)).toBeCloseTo(0.75, 2);
        expect(estimateUtilizationFactor(5.0, reflectances)).toBeCloseTo(0.82, 2);
    });

    it('interpolates between tabulated points', () => {
        const reflectances = { ceiling: 0.7, wall: 0.5, floor: 0.2 };
        const uf = estimateUtilizationFactor(1.09, reflectances);

        // Índice de local típico de una sala 6x4m con montaje a 2.2m sobre el
        // plano de trabajo — antes de la recalibración esto daba ~0.38, muy por
        // debajo de una tabla de UF real, forzando ~1.6x más luminarias que un
        // cálculo con fotometría real (DIALux).
        expect(uf).toBeGreaterThan(0.55);
        expect(uf).toBeLessThan(0.62);
    });

    it('reduces utilization for darker rooms without collapsing it', () => {
        const dark = estimateUtilizationFactor(1.5, { ceiling: 0.3, wall: 0.1, floor: 0.1 });
        const reference = estimateUtilizationFactor(1.5, { ceiling: 0.7, wall: 0.5, floor: 0.2 });

        expect(dark).toBeLessThan(reference);
        expect(dark).toBeGreaterThan(0.4);
    });

    it('stays within [0.15, 0.9] for extreme room indices', () => {
        expect(estimateUtilizationFactor(0.1)).toBeGreaterThanOrEqual(0.15);
        expect(estimateUtilizationFactor(20)).toBeLessThanOrEqual(0.9);
    });

    it('returns 0.4 for a degenerate room index', () => {
        expect(estimateUtilizationFactor(0)).toBe(0.4);
    });
});

describe('calculateRoomIndex', () => {
    it('computes k = (L*W) / (Hm*(L+W))', () => {
        expect(calculateRoomIndex(6, 4, 2.2)).toBeCloseTo(24 / 22, 5);
    });
});
