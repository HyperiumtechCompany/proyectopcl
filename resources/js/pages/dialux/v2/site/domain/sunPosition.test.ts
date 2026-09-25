import { describe, expect, it } from 'vitest';
import {
    dayOfYearFromDate,
    formatHour,
    skyState,
    sunPosition,
    sunVector,
} from './sunPosition';

describe('site/domain/sunPosition', () => {
    it('al mediodía del equinoccio en el ecuador el sol está casi en el cenit', () => {
        const sun = sunPosition(12, 0, 80);
        expect(sun.elevationDeg).toBeGreaterThan(87);
    });

    it('sale por el Este y se pone por el Oeste', () => {
        const morning = sunPosition(7, -12, 80);
        const evening = sunPosition(17, -12, 80);
        expect(morning.azimuthDeg).toBeGreaterThan(45);
        expect(morning.azimuthDeg).toBeLessThan(135);
        expect(evening.azimuthDeg).toBeGreaterThan(225);
        expect(evening.azimuthDeg).toBeLessThan(315);
    });

    it('hemisferio sur: al mediodía el sol queda al Norte', () => {
        const noon = sunPosition(12, -12, 172); // solsticio de junio
        const [x, , z] = sunVector(noon);
        expect(z).toBeGreaterThan(0);
        expect(Math.abs(x)).toBeLessThan(0.05);
    });

    it('a medianoche está bajo el horizonte y el cielo es de noche', () => {
        const midnight = sunPosition(0, -12, 80);
        expect(midnight.elevationDeg).toBeLessThan(0);
        const sky = skyState(midnight.elevationDeg);
        expect(sky.sunIntensity).toBe(0);
        expect(sky.sky[2]).toBeLessThan(0.2);
    });

    it('el cielo pasa de noche a día de forma continua', () => {
        expect(skyState(45).sunIntensity).toBeCloseTo(1.1, 6);
        expect(skyState(5).sunIntensity).toBeLessThan(skyState(45).sunIntensity);
        expect(skyState(-2).sky[0]).toBeGreaterThan(skyState(-20).sky[0]);
    });

    it('día del año a partir de una fecha', () => {
        expect(dayOfYearFromDate('2026-01-01')).toBe(1);
        expect(dayOfYearFromDate('2026-03-21')).toBe(80);
        expect(dayOfYearFromDate('2026-12-31')).toBe(365);
        expect(dayOfYearFromDate('basura')).toBe(80);
    });

    it('en el solsticio de junio el sol de mediodía (Lima) está más bajo que en diciembre', () => {
        expect(sunPosition(12, -12, 172).elevationDeg).toBeLessThan(
            sunPosition(12, -12, 355).elevationDeg,
        );
    });

    it('formatea la hora', () => {
        expect(formatHour(7.5)).toBe('07:30');
        expect(formatHour(0)).toBe('00:00');
    });
});
