import { describe, expect, it } from 'vitest';
import { valorizacion02Jul2026 as fixture } from '../../data/fixtures/valorizacion02Jul2026';
import { periodosDeObra } from '../../lib/periodos';
import { computeCalendario } from '../calendario/computeCalendario';
import { calendarioEjecutadoDesdeMetrados } from '../metrados/computeMetrados';
import { computePresupuesto } from '../presupuesto/computePresupuesto';
import { computeControlFinanciero, computeControlGeneral } from './computeControl';

const presupuesto = computePresupuesto(fixture.presupuesto, fixture.parametros);
const periodos = periodosDeObra('2026-06-20', '2026-08-18');
const programado = computeCalendario('programado', presupuesto, fixture.calendarios.programado, periodos, fixture.parametros);
const ejecutado = computeCalendario('ejecutado', presupuesto, calendarioEjecutadoDesdeMetrados(presupuesto, fixture.metrados), periodos, fixture.parametros);
const control = computeControlGeneral(programado, ejecutado, '2026-07');
const pct = (value: { toFixed: (n: number) => string }) => value.toFixed(4);

describe('CONTROL GEN. AVAN. OBRA. — cuadra con el Excel', () => {
    it('programado (D, E, F, G)', () => {
        expect(control.meses.map((m) => m.programado.mensual.toFixed(2))).toEqual(['157550.32', '203396.72', '277880.43']);
        expect(control.meses.map((m) => m.programado.acumulado.toFixed(2))).toEqual(['157550.32', '360947.04', '638827.47']);
        expect(control.meses.map((m) => pct(m.programado.pctMensual))).toEqual(['0.2466', '0.3184', '0.4350']);
        expect(control.meses.map((m) => pct(m.programado.pctAcumulado))).toEqual(['0.2466', '0.5650', '1.0000']);
        expect(control.totalProgramado.toFixed(2)).toBe('638827.47');
    });

    it('ejecutado solo hasta el mes valorizado (H, I, J, K)', () => {
        const [jun, jul, ago] = control.meses;
        expect(jun.ejecutado?.mensual.toFixed(2)).toBe('400648.29');
        expect(jul.ejecutado?.acumulado.toFixed(2)).toBe('624846.84');
        expect(pct(jul.ejecutado!.pctAcumulado)).toBe('0.9782');
        expect(ago.ejecutado).toBeNull();
        expect(control.totalEjecutado.toFixed(2)).toBe('624846.84');
    });

    it('evaluación del atraso (L, M, N, O, P) y situación final', () => {
        const [jun, jul] = control.meses;
        expect(pct(jun.ochenta)).toBe('0.1973');
        expect(pct(jul.ochenta)).toBe('0.4520');
        expect(pct(jun.evaluacion!.diferencia)).toBe('0.3806');
        expect(pct(jul.evaluacion!.diferencia)).toBe('0.4132');
        expect(jul.evaluacion!.situacion).toBe('ADELANTADA');
        expect(control.situacionObra).toBe('OBRA ADELANTADA');
        expect(control.ultima?.numero).toBe(2);
    });

    it('CURVA S: curva del 80 % sin redondear (G = 0.8 × F)', () => {
        expect(control.meses[0].curva80.toString()).toBe('0.19728');
        expect(control.meses[2].curva80.toString()).toBe('0.8');
    });
});

describe('CONTROL FINANCIERO — cuadra con el Excel', () => {
    const financiero = computeControlFinanciero(control, fixture.control.devengados, '638827.47', '638827.47', { directo: null, materiales: null });

    it('facturable, devengado, % y pendiente por valorización', () => {
        const [v1, v2] = financiero.valorizaciones;
        expect([v1.facturable.toFixed(2), v1.devengado.toFixed(2), v1.pendiente.toFixed(2)]).toEqual(['400648.29', '400648.29', '0.00']);
        expect(v1.pctDevengado.toFixed(10)).toBe('0.6271619628');
        expect([v2.facturable.toFixed(2), v2.devengado.toFixed(2), v2.pendiente.toFixed(2)]).toEqual(['224198.55', '0.00', '224198.55']);
    });

    it('acumulado y saldo (filas 19 y 20)', () => {
        expect(financiero.acumulado.facturable.toFixed(2)).toBe('624846.84');
        expect(financiero.acumulado.devengado.toFixed(2)).toBe('400648.29');
        expect(financiero.acumulado.pendiente.toFixed(2)).toBe('224198.55');
        expect(financiero.saldo.facturable.toFixed(2)).toBe('13980.63');
        expect(financiero.saldo.devengado.toFixed(2)).toBe('238179.18');
        expect(financiero.saldo.pctDevengado.toFixed(10)).toBe('0.3728380372');
        expect(financiero.saldo.pendiente.toFixed(2)).toBe('13980.63');
    });
});
