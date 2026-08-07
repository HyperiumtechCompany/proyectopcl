import { describe, expect, it } from 'vitest';
import { calculateExactQuantity, calculateLumensRequired } from './lightingCalculations';

describe('calculateLumensRequired', () => {
    it('usa Fm=0.8 y Fu=0.8 fijos (fórmula literal del ingeniero supervisor): ((área × lux) / 0.8) × 0.8', () => {
        expect(calculateLumensRequired(4.61, 200)).toBeCloseTo(((4.61 * 200) / 0.8) * 0.8, 5);
        expect(calculateLumensRequired(10, 300)).toBeCloseTo(((10 * 300) / 0.8) * 0.8, 5);
    });

    it('con Fm=Fu=0.8 por defecto, equivale a área × lux (÷0.8×0.8 se cancela — confirmado con el usuario 2026-08-07)', () => {
        expect(calculateLumensRequired(4.61, 200)).toBeCloseTo(4.61 * 200, 5);
    });

    it('permite sobreescribir Fm/Fu explícitamente', () => {
        expect(
            calculateLumensRequired(10, 300, { maintenanceFactor: 0.65, utilizationFactor: 0.5 }),
        ).toBeCloseTo(((10 * 300) / 0.65) * 0.5, 5);
    });
});

describe('calculateExactQuantity', () => {
    it('divide los lúmenes requeridos entre los lúmenes por luminaria', () => {
        const lumensRequired = calculateLumensRequired(4.61, 200);
        expect(calculateExactQuantity(lumensRequired, 2580)).toBeCloseTo(lumensRequired / 2580, 5);
    });
});
