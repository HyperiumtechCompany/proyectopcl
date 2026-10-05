import { describe, expect, it } from 'vitest';
import { valorizacion02Jul2026 as fixture } from '../../data/fixtures/valorizacion02Jul2026';
import type { BudgetTotals } from '../../lib/budget';
import { periodosDeObra } from '../../lib/periodos';
import { computeMetrados } from '../metrados/computeMetrados';
import { computePresupuesto } from '../presupuesto/computePresupuesto';
import { computeValorizacionMensual } from './computeValorizacionMensual';

const presupuesto = computePresupuesto(fixture.presupuesto, fixture.parametros);
const pie = (t: BudgetTotals) => [t.costoDirecto, t.gastosGenerales, t.utilidad, t.subTotal, t.igv, t.total].map((v) => v.toFixed(2));

describe('METRADOS', () => {
    const metrados = computeMetrados(presupuesto, fixture.metrados, periodosDeObra('2026-06-20', '2026-08-18'));
    const fila = (codigo: string) => metrados.filas.find((f) => f.node.codigo === codigo)!;

    it('acumulado = Σ meses y saldo = contratado − acumulado (M y O)', () => {
        expect(fila('01.01.01.03').acumulado.toString()).toBe('1.48');
        expect(fila('01.01.01.03').saldo.toString()).toBe('0.52');
        expect(fila('01.01.01.03').estado).toBe('en-curso');
        expect(fila('01.13.04').acumulado.toString()).toBe('1');
        expect(fila('01.13.04').estado).toBe('completo');
        expect(fila('01.02.06.01').estado).toBe('sin-avance');
        expect(metrados.issues).toEqual([]);
    });

    it('los títulos no suman metrados', () => {
        expect(fila('01.01').contratado).toBeNull();
    });
});

describe('VAL. MENSUAL — Julio 2026, derivada de metrados, cuadra con el Excel', () => {
    const vm = computeValorizacionMensual(presupuesto, fixture.metrados, '2026-07', fixture.parametros);
    const fila = (codigo: string) => vm.filas.find((f) => f.node.codigo === codigo)!;

    it('fila 15 (01.01.01.01): anterior, actual, acumulado y saldo', () => {
        const f = fila('01.01.01.01');
        expect([f.anterior.metrado?.toString(), f.anterior.costo.toFixed(2), f.anterior.pct.toFixed(4)]).toEqual(['1', '2400.00', '0.5000']);
        expect([f.actual.metrado?.toString(), f.actual.costo.toFixed(2), f.actual.pct.toFixed(4)]).toEqual(['0.48', '1152.00', '0.2400']);
        expect([f.acumulado.metrado?.toString(), f.acumulado.costo.toFixed(2), f.acumulado.pct.toFixed(4)]).toEqual(['1.48', '3552.00', '0.7400']);
        expect([f.saldo.metrado?.toString(), f.saldo.costo.toFixed(2), f.saldo.pct.toFixed(4)]).toEqual(['0.52', '1248.00', '0.2600']);
    });

    it('pies de los 5 bloques (filas 157–163)', () => {
        expect(pie(vm.pies.anterior)).toEqual(['290198.67', '29019.87', '20313.91', '339532.45', '61115.84', '400648.29']);
        expect(pie(vm.pies.actual)).toEqual(['162392.11', '16239.21', '11367.45', '189998.77', '34199.78', '224198.55']);
        expect(pie(vm.pies.acumulado)).toEqual(['452590.78', '45259.08', '31681.36', '529531.22', '95315.62', '624846.84']);
        expect(pie(vm.pies.saldo)).toEqual(['10126.49', '1012.65', '708.85', '11847.99', '2132.64', '13980.63']);
        expect(vm.pies.anterior.pesoCD.toFixed(4)).toBe('0.6272');
        expect(vm.pies.actual.pesoCD.toFixed(4)).toBe('0.3510');
        expect(vm.pies.acumulado.pesoCD.toFixed(4)).toBe('0.9782');
        expect(vm.pies.saldo.pesoCD.toFixed(4)).toBe('0.0218');
    });

    it('títulos suman costos de sus partidas (RESUMEN VAL. por componente)', () => {
        expect(fila('01.01').anterior.costo.toFixed(2)).toBe('21290.72');
        expect(fila('01.01').actual.costo.toFixed(2)).toBe('1560.00');
        expect(fila('01.03').actual.costo.toFixed(2)).toBe('50900.79');
        // La hoja RESUMEN VAL. del Excel muestra 17,496.26 por referencias rotas en 01.09–01.13;
        // VAL. MENSUAL da 18,340.56 − 16,380.56 − 840 = 1,120.00.
        expect(fila('01.11').anterior.costo.toFixed(2)).toBe('16380.56');
        expect(fila('01.11').saldo.costo.toFixed(2)).toBe('1120.00');
        expect(vm.issues).toEqual([]);
    });

    it('cambiar el mes valorizado mueve el corte anterior / actual', () => {
        const junio = computeValorizacionMensual(presupuesto, fixture.metrados, '2026-06', fixture.parametros);
        expect(junio.pies.anterior.total.isZero()).toBe(true);
        expect(junio.pies.actual.total.toFixed(2)).toBe('400648.29');
        expect(junio.issues[0]).toContain('meses posteriores');
    });
});
