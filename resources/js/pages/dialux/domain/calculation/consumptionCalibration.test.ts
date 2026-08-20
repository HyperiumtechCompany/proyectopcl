import { describe, expect, it } from 'vitest';
import { calculateAnnualConsumption } from './consumptionCalibration';

describe('calculateAnnualConsumption', () => {
    it('calcula el consumo anual a partir de potencia y horas diarias', () => {
        expect(calculateAnnualConsumption(1000, 8)).toBe(2920);
    });

    it('limita las horas al rango diario valido', () => {
        expect(calculateAnnualConsumption(100, -2)).toBe(0);
        expect(calculateAnnualConsumption(100, 30)).toBe(876);
    });
});
