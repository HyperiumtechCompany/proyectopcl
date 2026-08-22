import { describe, expect, it } from 'vitest';
import { calculateLeni } from './leniCalculation';

/**
 * Fase B del cierre de brechas (`dialux-calc-reviewer`, hallazgo bloqueante
 * "motor LENI/EN 15193 no existe"). Entrada → Proceso → Resultado, mismo
 * formato que exige `planes/PLAN_MD_REVISION_MOTOR_DIALUX_HYPERIUMTECH.md` §3.
 */
describe('calculateLeni', () => {
    it('sin buildingType definido: null (nunca inventa un tipo de edificio por defecto)', () => {
        expect(
            calculateLeni({
                installedPowerWatts: 1000,
                usefulAreaM2: 50,
                leni: {},
            }),
        ).toBeNull();
    });

    it('con área 0 o negativa: null (LENI no está definido, evita división por cero)', () => {
        expect(
            calculateLeni({
                installedPowerWatts: 1000,
                usefulAreaM2: 0,
                leni: { buildingType: 'office' },
            }),
        ).toBeNull();
    });

    it('office, sin overrides de horas/controles: usa los defaults del catálogo (manual/none/sin iluminación constante → todos los factores en 1)', () => {
        const result = calculateLeni({
            installedPowerWatts: 500,
            usefulAreaM2: 25,
            leni: { buildingType: 'office' },
        });

        expect(result).not.toBeNull();
        expect(result!.factorOccupancy).toBe(1);
        expect(result!.factorDaylight).toBe(1);
        expect(result!.factorConstantIlluminance).toBe(1);
        // W_L = (500 × 1 × [(2250×1×1) + (250×1)]) / 1000 = 500 × 2500 / 1000 = 1250 kWh/año
        expect(result!.lightingEnergyKwhYear).toBeCloseTo(1250, 6);
        expect(result!.referenceEnergyKwhYear).toBeCloseTo(1250, 6);
        expect(result!.parasiticEnergyKwhYear).toBe(0);
        expect(result!.parasiticEnergyModeled).toBe(false);
        // LENI = 1250 / 25 = 50 kWh/(m²·año)
        expect(result!.leniKwhPerM2Year).toBeCloseTo(50, 6);
    });

    it('horas/controles declarados por el usuario tienen prioridad sobre el default del catálogo', () => {
        const result = calculateLeni({
            installedPowerWatts: 1000,
            usefulAreaM2: 100,
            leni: {
                buildingType: 'office',
                annualOperatingHoursDay: 2000,
                annualOperatingHoursNight: 0,
                occupancyControlType: 'auto-presence-off',
                daylightControlType: 'photocell-dimming',
                constantIlluminanceControl: true,
            },
        });

        expect(result).not.toBeNull();
        expect(result!.annualHoursDay).toBe(2000);
        expect(result!.annualHoursNight).toBe(0);
        expect(result!.factorOccupancy).toBeCloseTo(0.75, 6);
        expect(result!.factorDaylight).toBeCloseTo(0.75, 6);
        expect(result!.factorConstantIlluminance).toBeCloseTo(0.9, 6);
        // effectiveHours = 2000 × 0.75 × 0.75 + 0 × 0.75 = 1125
        // W_L = (1000 × 0.9 × 1125) / 1000 = 1012.5 kWh/año
        expect(result!.lightingEnergyKwhYear).toBeCloseTo(1012.5, 6);
        expect(result!.referenceEnergyKwhYear).toBeCloseTo(2000, 6);
        expect(result!.leniKwhPerM2Year).toBeCloseTo(10.125, 6);
    });

    it('cada control más agresivo reduce el LENI monótonamente (nunca lo aumenta)', () => {
        const base = calculateLeni({
            installedPowerWatts: 1000,
            usefulAreaM2: 50,
            leni: { buildingType: 'industrial' },
        })!;
        const withOccupancyControl = calculateLeni({
            installedPowerWatts: 1000,
            usefulAreaM2: 50,
            leni: { buildingType: 'industrial', occupancyControlType: 'auto-presence-off' },
        })!;
        const withAllControls = calculateLeni({
            installedPowerWatts: 1000,
            usefulAreaM2: 50,
            leni: {
                buildingType: 'industrial',
                occupancyControlType: 'auto-presence-off',
                daylightControlType: 'photocell-dimming',
                constantIlluminanceControl: true,
            },
        })!;

        expect(withOccupancyControl.leniKwhPerM2Year).toBeLessThan(base.leniKwhPerM2Year);
        expect(withAllControls.leniKwhPerM2Year).toBeLessThan(withOccupancyControl.leniKwhPerM2Year);
    });
});
