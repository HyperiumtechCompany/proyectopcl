/**
 * Tests unitarios de las fórmulas puras del motor eléctrico DIALux.
 */

import { describe, expect, it } from 'vitest';
import {
    BREAKER_SCALE,
    cableLength,
    circuitCurrent,
    complianceStatus,
    computeMinLuminaires,
    computeOutletsAuto,
    estimateIlluminance,
    selectBreaker,
    selectConductor,
    suggestGrid,
    voltageDropPct,
} from './formulas';
import type { ConductorCatalog, OutletRule } from './types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

let conductorId = 0;
function cu(section_mm2: number, ampacity_a: number, awg_ref: string, price_per_meter: number | null = null): ConductorCatalog {
    conductorId += 1;
    return { id: conductorId, user_id: null, material: 'cobre', section_mm2, awg_ref, insulation: 'THW-90', ampacity_a, price_per_meter };
}

/** Misma data del seeder: conductores de cobre THW-90. */
const CONDUCTORS: ConductorCatalog[] = [
    cu(2.5, 20, '14'),
    cu(4, 25, '12'),
    cu(6, 35, '10'),
    cu(10, 50, '8'),
    cu(16, 65, '6'),
    cu(25, 85, '4'),
    cu(35, 100, '2'),
    cu(50, 125, '1/0'),
    cu(70, 160, '2/0'),
];

function rule(method: OutletRule['method'], value: number): OutletRule {
    return {
        id: 1,
        user_id: null,
        room_type: 'aula',
        method,
        value,
        unit: method === 'area' ? 'm2_per_point' : method === 'perimeter' ? 'm_per_point' : 'points',
        power_per_outlet_va: 180,
    };
}

// ─── computeMinLuminaires ────────────────────────────────────────────────────

describe('computeMinLuminaires', () => {
    it('Caso A: 40 m², 300 lux, 3600 lm, CU 0.60, FM 0.80 → ceil(12000/1728) = 7', () => {
        expect(computeMinLuminaires(300, 40, 3600, 0.6, 0.8)).toBe(7);
    });

    it('retorna 0 si el flujo, CU, FM o el área son inválidos', () => {
        expect(computeMinLuminaires(300, 0, 3600, 0.6, 0.8)).toBe(0);
        expect(computeMinLuminaires(300, 40, 0, 0.6, 0.8)).toBe(0);
        expect(computeMinLuminaires(300, 40, 3600, 0, 0.8)).toBe(0);
        expect(computeMinLuminaires(300, 40, 3600, 0.6, 0)).toBe(0);
        expect(computeMinLuminaires(300, -40, 3600, 0.6, 0.8)).toBe(0);
        expect(computeMinLuminaires(300, 40, Number.NaN, 0.6, 0.8)).toBe(0);
    });

    it('retorna 0 si el nivel requerido es ≤ 0', () => {
        expect(computeMinLuminaires(0, 40, 3600, 0.6, 0.8)).toBe(0);
        expect(computeMinLuminaires(-100, 40, 3600, 0.6, 0.8)).toBe(0);
    });
});

// ─── estimateIlluminance ─────────────────────────────────────────────────────

describe('estimateIlluminance', () => {
    it('Caso A: 7 luminarias de 3600 lm en 40 m² → 302.4 lux', () => {
        expect(estimateIlluminance(7, 3600, 0.6, 0.8, 40)).toBeCloseTo(302.4, 5);
    });

    it('retorna 0 ante área cero o datos inválidos (nunca NaN/Infinity)', () => {
        expect(estimateIlluminance(7, 3600, 0.6, 0.8, 0)).toBe(0);
        expect(estimateIlluminance(0, 3600, 0.6, 0.8, 40)).toBe(0);
        expect(estimateIlluminance(7, -3600, 0.6, 0.8, 40)).toBe(0);
        expect(Number.isFinite(estimateIlluminance(7, 3600, 0.6, 0.8, Number.NaN))).toBe(true);
    });
});

// ─── complianceStatus ────────────────────────────────────────────────────────

describe('complianceStatus', () => {
    it('Caso A: 302.4 lux estimados sobre 300 requeridos → cumple (100.8 %)', () => {
        const result = complianceStatus(302.4, 300);
        expect(result.status).toBe('cumple');
        expect(result.pct).toBeCloseTo(100.8, 5);
        expect(result.deltaLux).toBeCloseTo(2.4, 5);
    });

    it('aplica los umbrales: <90 no_cumple, [90,100) advertencia, [100,150] cumple, >150 exceso', () => {
        expect(complianceStatus(89, 100).status).toBe('no_cumple');
        expect(complianceStatus(90, 100).status).toBe('advertencia');
        expect(complianceStatus(99.9, 100).status).toBe('advertencia');
        expect(complianceStatus(100, 100).status).toBe('cumple');
        expect(complianceStatus(150, 100).status).toBe('cumple');
        expect(complianceStatus(150.1, 100).status).toBe('exceso');
    });

    it('sin nivel requerido (≤ 0) se considera cumple con 100 %', () => {
        expect(complianceStatus(500, 0)).toEqual({ status: 'cumple', pct: 100, deltaLux: 500 });
        expect(complianceStatus(500, -10).status).toBe('cumple');
    });

    it('nunca retorna NaN ante estimado inválido', () => {
        const result = complianceStatus(Number.NaN, 300);
        expect(Number.isFinite(result.pct)).toBe(true);
        expect(result.status).toBe('no_cumple');
    });
});

// ─── computeOutletsAuto ──────────────────────────────────────────────────────

describe('computeOutletsAuto', () => {
    it('aula de 48 m² con regla de área 10 → 5 puntos', () => {
        expect(computeOutletsAuto(rule('area', 10), 48, 28)).toBe(5);
    });

    it('comedor de 72 m² con regla de área 15 → 5 puntos', () => {
        expect(computeOutletsAuto(rule('area', 15), 72, 36)).toBe(5);
    });

    it('exterior de 50 m de perímetro con regla 9 → 6 puntos', () => {
        expect(computeOutletsAuto(rule('perimeter', 9), 100, 50)).toBe(6);
    });

    it('regla fija redondea el valor', () => {
        expect(computeOutletsAuto(rule('fixed', 3.4), 48, 28)).toBe(3);
        expect(computeOutletsAuto(rule('fixed', 3.5), 48, 28)).toBe(4);
    });

    it('sin regla o con datos inválidos retorna 0', () => {
        expect(computeOutletsAuto(undefined, 48, 28)).toBe(0);
        expect(computeOutletsAuto(rule('area', 0), 48, 28)).toBe(0);
        expect(computeOutletsAuto(rule('area', 10), 0, 28)).toBe(0);
        expect(computeOutletsAuto(rule('perimeter', 9), 100, 0)).toBe(0);
        expect(computeOutletsAuto(rule('fixed', -2), 48, 28)).toBe(0);
    });
});

// ─── circuitCurrent ──────────────────────────────────────────────────────────

describe('circuitCurrent', () => {
    it('monofásico: I = P/(V·fp)', () => {
        expect(circuitCurrent(10000, 220, 1, 0.9)).toBeCloseTo(10000 / (220 * 0.9), 5);
    });

    it('trifásico: I = P/(√3·V·fp)', () => {
        expect(circuitCurrent(10000, 380, 3, 0.9)).toBeCloseTo(10000 / (Math.sqrt(3) * 380 * 0.9), 5);
    });

    it('retorna 0 ante tensión, potencia o factor de potencia inválidos', () => {
        expect(circuitCurrent(10000, 0, 1, 0.9)).toBe(0);
        expect(circuitCurrent(0, 220, 1, 0.9)).toBe(0);
        expect(circuitCurrent(-100, 220, 1, 0.9)).toBe(0);
        expect(circuitCurrent(10000, 220, 1, 0)).toBe(0);
    });
});

// ─── voltageDropPct ──────────────────────────────────────────────────────────

describe('voltageDropPct', () => {
    it('monofásico cobre: ΔV = 2·ρ·L·I/S', () => {
        // ΔV = 2·0.0175·20·10/2.5 = 2.8 V → 2.8/220·100 = 1.2727 %
        expect(voltageDropPct(10, 20, 2.5, 220, 1, 'cobre')).toBeCloseTo((2.8 / 220) * 100, 5);
    });

    it('trifásico usa factor √3', () => {
        const expected = ((Math.sqrt(3) * 0.0175 * 20 * 10) / 2.5 / 380) * 100;
        expect(voltageDropPct(10, 20, 2.5, 380, 3, 'cobre')).toBeCloseTo(expected, 5);
    });

    it('el aluminio cae más que el cobre (ρ 0.0286 vs 0.0175)', () => {
        const copper = voltageDropPct(10, 20, 2.5, 220, 1, 'cobre');
        const aluminum = voltageDropPct(10, 20, 2.5, 220, 1, 'aluminio');
        expect(aluminum).toBeCloseTo(copper * (0.0286 / 0.0175), 5);
    });

    it('retorna 0 ante sección, tensión, longitud o corriente inválidas (nunca Infinity)', () => {
        expect(voltageDropPct(10, 20, 0, 220, 1, 'cobre')).toBe(0);
        expect(voltageDropPct(10, 20, 2.5, 0, 1, 'cobre')).toBe(0);
        expect(voltageDropPct(0, 20, 2.5, 220, 1, 'cobre')).toBe(0);
        expect(voltageDropPct(10, -20, 2.5, 220, 1, 'cobre')).toBe(0);
    });
});

// ─── selectBreaker ───────────────────────────────────────────────────────────

describe('selectBreaker', () => {
    it('elige el primer valor de la escala ≥ corriente de diseño', () => {
        expect(selectBreaker(1.59)).toEqual({ amps: 10, source: 'auto' });
        expect(selectBreaker(18)).toEqual({ amps: 20, source: 'auto' });
        expect(selectBreaker(63)).toEqual({ amps: 63, source: 'auto' });
        expect(selectBreaker(63.1)).toEqual({ amps: 80, source: 'auto' });
    });

    it('si excede la escala usa el máximo disponible', () => {
        expect(selectBreaker(9999)).toEqual({ amps: BREAKER_SCALE[BREAKER_SCALE.length - 1], source: 'auto' });
    });

    it('respeta el valor manual positivo', () => {
        expect(selectBreaker(1.59, 20)).toEqual({ amps: 20, source: 'manual' });
    });

    it('ignora valores manuales inválidos y corrientes negativas', () => {
        expect(selectBreaker(18, 0)).toEqual({ amps: 20, source: 'auto' });
        expect(selectBreaker(18, -5)).toEqual({ amps: 20, source: 'auto' });
        expect(selectBreaker(-3)).toEqual({ amps: 10, source: 'auto' });
    });
});

// ─── selectConductor ─────────────────────────────────────────────────────────

describe('selectConductor', () => {
    const base = {
        lengthM: 20,
        voltageV: 220,
        phases: 1 as const,
        maxVoltageDropPct: 2.5,
        conductors: CONDUCTORS,
    };

    it('alumbrado con carga pequeña sugiere la sección mínima de 2.5 mm²', () => {
        const result = selectConductor({ ...base, designCurrentA: 5, minSectionMm2: 2.5 });
        expect(result.sectionMm2).toBe(2.5);
        expect(result.source).toBe('auto');
        expect(result.warnings).toEqual([]);
    });

    it('tomacorrientes respeta la sección mínima de 4 mm² aunque la corriente sea baja', () => {
        const result = selectConductor({ ...base, designCurrentA: 6, minSectionMm2: 4 });
        expect(result.sectionMm2).toBe(4);
    });

    it('carga elevada (10 kW a 60 m) sube de sección por caída de tensión', () => {
        // I diseño = 10000/(220·0.9)·1.25 ≈ 63.13 A: por ampacidad bastaría
        // 16 mm² (65 A), pero su caída a 60 m es 3.77 % > 2.5 % → sube a 25 mm².
        const designCurrentA = (10000 / (220 * 0.9)) * 1.25;
        const result = selectConductor({ ...base, designCurrentA, lengthM: 60, minSectionMm2: 4 });
        expect(result.sectionMm2).toBe(25);
        expect(result.voltageDropPct).toBeLessThanOrEqual(2.5);
        expect(result.warnings).toEqual([]);
    });

    it('sección manual usa la del catálogo igual o inmediatamente superior', () => {
        const exact = selectConductor({ ...base, designCurrentA: 5, minSectionMm2: 2.5, manualSectionMm2: 4 });
        expect(exact.sectionMm2).toBe(4);
        expect(exact.source).toBe('manual');
        expect(exact.warnings).toEqual([]);

        const rounded = selectConductor({ ...base, designCurrentA: 5, minSectionMm2: 2.5, manualSectionMm2: 5 });
        expect(rounded.sectionMm2).toBe(6);
        expect(rounded.warnings.some((w) => w.includes('no existe en el catálogo'))).toBe(true);
    });

    it('sección manual insuficiente genera warnings de ampacidad y caída', () => {
        const designCurrentA = (10000 / (220 * 0.9)) * 1.25; // ≈ 63.13 A
        const result = selectConductor({ ...base, designCurrentA, lengthM: 60, minSectionMm2: 4, manualSectionMm2: 2.5 });
        expect(result.sectionMm2).toBe(2.5);
        expect(result.source).toBe('manual');
        expect(result.warnings.some((w) => w.includes('ampacidad'))).toBe(true);
        expect(result.warnings.some((w) => w.includes('caída de tensión'))).toBe(true);
    });

    it('si ninguna sección cumple usa la mayor disponible con warning', () => {
        const result = selectConductor({ ...base, designCurrentA: 500, minSectionMm2: 2.5 });
        expect(result.sectionMm2).toBe(70);
        expect(result.warnings.some((w) => w.includes('mayor disponible'))).toBe(true);
        expect(result.warnings.some((w) => w.includes('ampacidad'))).toBe(true);
    });

    it('catálogo vacío retorna conductor null y sección 0 con warning', () => {
        const result = selectConductor({ ...base, designCurrentA: 10, minSectionMm2: 2.5, conductors: [] });
        expect(result.conductor).toBeNull();
        expect(result.sectionMm2).toBe(0);
        expect(result.voltageDropPct).toBe(0);
        expect(result.warnings.some((w) => w.includes('catálogo'))).toBe(true);
    });

    it('filtra por material: sin conductores de aluminio retorna null', () => {
        const result = selectConductor({ ...base, designCurrentA: 10, minSectionMm2: 2.5, material: 'aluminio' });
        expect(result.conductor).toBeNull();
        expect(result.warnings.some((w) => w.includes('aluminio'))).toBe(true);
    });
});

// ─── suggestGrid ─────────────────────────────────────────────────────────────

describe('suggestGrid', () => {
    it('cols = ceil(√N), rows = ceil(N/cols)', () => {
        expect(suggestGrid(1)).toEqual({ rows: 1, cols: 1 });
        expect(suggestGrid(5)).toEqual({ rows: 2, cols: 3 });
        expect(suggestGrid(7)).toEqual({ rows: 3, cols: 3 });
        expect(suggestGrid(12)).toEqual({ rows: 3, cols: 4 });
        expect(suggestGrid(16)).toEqual({ rows: 4, cols: 4 });
    });

    it('retorna (0,0) para cantidades cero o inválidas', () => {
        expect(suggestGrid(0)).toEqual({ rows: 0, cols: 0 });
        expect(suggestGrid(-4)).toEqual({ rows: 0, cols: 0 });
        expect(suggestGrid(Number.NaN)).toEqual({ rows: 0, cols: 0 });
    });
});

// ─── cableLength ─────────────────────────────────────────────────────────────

describe('cableLength', () => {
    it('L·n·factor: 25 m × 3 conductores × 1.10 = 82.5 m', () => {
        expect(cableLength(25, 3, 1.1)).toBeCloseTo(82.5, 5);
    });

    it('retorna 0 ante longitud, conductores o factor inválidos', () => {
        expect(cableLength(0, 3, 1.1)).toBe(0);
        expect(cableLength(25, 0, 1.1)).toBe(0);
        expect(cableLength(25, 3, 0)).toBe(0);
        expect(cableLength(-25, 3, 1.1)).toBe(0);
    });
});
