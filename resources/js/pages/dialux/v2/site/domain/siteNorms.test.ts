import { describe, expect, it } from 'vitest';
import {
    evaluatePlatformRetention,
    evaluateRamp,
    evaluateStair,
    stairStepCount,
    planRampFlights,
    planStairFlights,
    platformRetentionDropM,
    rampMaxSlopePct,
} from './siteNorms';
import type { SiteElement } from './types';

function platform(id: string, z: number, x0: number): SiteElement {
    return {
        id,
        type: 'terrace_platform',
        label: id,
        baseElevationM: z,
        vertices: [
            { x: x0, y: 0 },
            { x: x0 + 10, y: 0 },
            { x: x0 + 10, y: 10 },
            { x: x0, y: 10 },
        ],
        style: { fillColor: '#fff', strokeColor: '#000' },
    };
}

describe('site/domain/siteNorms', () => {
    it('la pendiente máxima depende del desnivel del tramo y no existe sobre 0.72 m', () => {
        expect(rampMaxSlopePct(0.2)).toBe(10);
        expect(rampMaxSlopePct(0.3)).toBe(10);
        expect(rampMaxSlopePct(0.5)).toBe(8);
        expect(rampMaxSlopePct(0.72)).toBe(8);
        expect(rampMaxSlopePct(0.9)).toBeNull();
    });

    it('divide 3.35 m en tramos de ≤ 0.72 m con descansos de 1.50 m y ≤ 9 m de largo', () => {
        const flights = planRampFlights(3.35, 1);
        expect(flights).toHaveLength(5);
        const total = flights.reduce((sum, f) => sum + f.riseM, 0);
        expect(total).toBeCloseTo(3.35, 2);
        for (const [i, f] of flights.entries()) {
            expect(Math.abs(f.riseM)).toBeLessThanOrEqual(0.72 + 1e-9);
            expect(f.lengthM).toBeLessThanOrEqual(9 + 1e-9);
            expect(f.landingLengthM).toBe(i < flights.length - 1 ? 1.5 : 0);
        }
        // Los tramos que genera la propia función no deben tener observaciones.
        const findings = evaluateRamp({
            widthM: 1.2,
            fromElevationM: 0,
            toElevationM: 3.35,
            flights,
        });
        expect(findings.every((f) => f.level === 'info')).toBe(true);
    });

    it('conserva el signo al bajar y no genera tramos sin desnivel', () => {
        const down = planRampFlights(-1.0, 1);
        expect(down.every((f) => f.riseM < 0)).toBe(true);
        expect(planRampFlights(0)).toEqual([]);
    });

    it('marca ancho corto, pendiente excesiva y desnivel sin tramos', () => {
        const findings = evaluateRamp({
            widthM: 0.8,
            fromElevationM: 0,
            toElevationM: 1.5,
        });
        expect(findings.some((f) => f.text.includes('Ancho'))).toBe(true);
        expect(findings.some((f) => f.text.includes('Generar tramos'))).toBe(true);
        const steep = evaluateRamp({
            widthM: 1.2,
            fromElevationM: 0,
            toElevationM: 0.5,
            singleRunM: 3,
        });
        expect(steep.some((f) => f.text.includes('Pendiente'))).toBe(true);
    });

    it('avisa cuando los tramos no suman el desnivel hasta la cota destino', () => {
        const flights = planRampFlights(3.4, 1); // suma 3.40 m
        const findings = evaluateRamp({
            widthM: 1.2,
            fromElevationM: 0,
            toElevationM: 3.5,
            flights,
        });
        expect(findings.some((f) => f.text.includes('suman'))).toBe(true);
    });

    it('escalera: peldaños por contrahuella máxima, tramos de ≤ 18 con descanso y sumando el desnivel', () => {
        expect(stairStepCount(3.5)).toBe(20); // 3.5 / 0.175
        const flights = planStairFlights(3.5, 1.2);
        expect(flights).toHaveLength(2); // 20 peldaños → 10 + 10
        expect(flights.reduce((acc, f) => acc + f.riseM, 0)).toBeCloseTo(3.5, 3);
        expect(flights[0].landingLengthM).toBeGreaterThanOrEqual(1.2);
        // Recta por defecto: los tramos siguen en línea, con descanso plano en medio.
        expect(flights[0].turnAfterDeg).toBe(0);
        expect(planStairFlights(3.5, 1.2, 18, 'L')[0].turnAfterDeg).toBe(90);
        expect(planStairFlights(3.5, 1.2, 18, 'U')[0].turnAfterDeg).toBe(180);
        expect(flights[1].landingLengthM).toBe(0);
        // Un solo tramo si caben en 18 peldaños.
        expect(planStairFlights(1.75, 1.2)).toHaveLength(1);
        expect(planStairFlights(0, 1.2)).toEqual([]);
        const ok = evaluateStair({ fromElevationM: 0, toElevationM: 3.5, widthM: 1.2 });
        expect(ok.every((f) => f.level === 'info')).toBe(true);
        const narrow = evaluateStair({ fromElevationM: 0, toElevationM: 1.75, widthM: 0.7 });
        expect(narrow.some((f) => f.level === 'review' && f.text.includes('Ancho'))).toBe(true);
        expect(evaluateStair({ fromElevationM: 1, toElevationM: 1, widthM: 1.2 })[0].level).toBe('review');
    });

    it('detecta el desnivel con la plataforma vecina y exige EMS sobre 2.00 m', () => {
        const a = platform('a', 3.35, 0);
        const b = platform('b', 0, 10); // comparte el borde x=10
        const far = platform('c', -3.35, 200);
        const drop = platformRetentionDropM(a, [a, b, far]);
        expect(drop).toBeCloseTo(3.35, 6);
        const findings = evaluatePlatformRetention(drop);
        expect(findings.some((f) => f.level === 'review')).toBe(true);
        expect(
            evaluatePlatformRetention(1.2).every((f) => f.level === 'info'),
        ).toBe(true);
        expect(evaluatePlatformRetention(0)).toEqual([]);
    });
});
