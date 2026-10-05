import { describe, expect, it } from 'vitest';
import { valorizacion02Jul2026 as fixture } from '../../data/fixtures/valorizacion02Jul2026';
import { periodosDeObra } from '../../lib/periodos';
import { montoEnLetrasTexto } from '../../lib/spanishWords';
import { computeCalendario } from '../calendario/computeCalendario';
import { computeControlFinanciero, computeControlGeneral } from '../control/computeControl';
import { calendarioEjecutadoDesdeMetrados } from '../metrados/computeMetrados';
import { computePresupuesto } from '../presupuesto/computePresupuesto';
import { computeTablero } from '../tablero/computeTablero';
import { computeValorizacionMensual } from '../valorizacion-mensual/computeValorizacionMensual';
import type { PagoMensual } from './computePagos';
import { computeAdicionales, computeControlPagos, computePagoMensual, computePagosAcumulados, computeResumenValorizacion, computeRetencionFielCumplimiento } from './computePagos';

const MES = '2026-07';
const presupuesto = computePresupuesto(fixture.presupuesto, fixture.parametros);
const periodos = periodosDeObra('2026-06-20', '2026-08-18');
const programado = computeCalendario('programado', presupuesto, fixture.calendarios.programado, periodos, fixture.parametros);
const ejecutado = computeCalendario('ejecutado', presupuesto, calendarioEjecutadoDesdeMetrados(presupuesto, fixture.metrados), periodos, fixture.parametros);
const control = computeControlGeneral(programado, ejecutado, MES);
const vm = computeValorizacionMensual(presupuesto, fixture.metrados, MES, fixture.parametros);
const rfc = computeRetencionFielCumplimiento(control, '638827.47', fixture.pagos.rfc, MES);
const acumulados = computePagosAcumulados(presupuesto.totales, ejecutado, rfc, {}, '0.04', MES);

/** A, C, F, G, G.rfc, G.detracción, H, J, K. */
const estado = (p: PagoMensual) => [p.a, p.c, p.f, p.g.total, p.g.rfc, p.g.detraccion, p.h.total, p.j, p.k].map((v) => v.toFixed(2));

describe('RESUMEN VAL. — desde VAL. MENSUAL (sin las referencias rotas del Excel)', () => {
    const resumen = computeResumenValorizacion(vm);
    const comp = (codigo: string) => resumen.componentes.find((c) => c.node.codigo === codigo)!;

    it('13 componentes; filas sanas cuadran con el Excel', () => {
        expect(resumen.componentes).toHaveLength(13);
        expect([comp('01.01').anterior.pct.toFixed(4), comp('01.01').anterior.monto.toFixed(2)]).toEqual(['0.8676', '21290.72']);
        expect([comp('01.01').actual.pct.toFixed(4), comp('01.01').actual.monto.toFixed(2)]).toEqual(['0.0636', '1560.00']);
        expect([comp('01.01').acumulado.pct.toFixed(4), comp('01.01').saldo.monto.toFixed(2)]).toEqual(['0.9312', '1690.00']);
        expect(comp('01.03').acumulado.pct.toFixed(4)).toBe('1.0000');
    });

    it('filas que el Excel tenía rotas, ahora correctas', () => {
        expect(comp('01.11').anterior.monto.toFixed(2)).toBe('16380.56');
        expect(comp('01.11').acumulado.monto.toFixed(2)).toBe('17220.56');
        expect(comp('01.09').actual.pct.toFixed(4)).toBe('1.0000');
        expect(resumen.pies.actual.total.toFixed(2)).toBe('224198.55');
    });
});

describe('R.F.C — retención de garantía de fiel cumplimiento', () => {
    it('10 % del contrato retenido en el primer pago (R.F.C!D21, F24:F31)', () => {
        expect(rfc.total.toFixed(2)).toBe('63882.75');
        expect(rfc.meses.map((m) => m.efectiva.toFixed(2))).toEqual(['63882.75', '0.00', '0.00']);
        expect(rfc.anteriorAcumulada.toFixed(2)).toBe('63882.75');
        expect(rfc.actual.toFixed(2)).toBe('0.00');
        expect(rfc.saldoPorRetener.toFixed(2)).toBe('0.00');
    });

    it('prorrateo en la primera mitad de los pagos', () => {
        const prorrateo = computeRetencionFielCumplimiento(control, '638827.47', { porcentaje: '0.10', modo: 'prorrateo-mitad' }, MES);
        expect(prorrateo.meses.map((m) => m.programada.toFixed(2))).toEqual(['31941.38', '31941.37', '0.00']);
        expect(prorrateo.actual.toFixed(2)).toBe('31941.37');
        expect(prorrateo.saldoPorRetener.toFixed(2)).toBe('0.00');
    });
});

describe('R PAGO MENSUAL — Val. N°02 (julio)', () => {
    it('A → K cuadra con el Excel (detracción a entero)', () => {
        expect(estado(acumulados.actual)).toEqual(['224198.55', '224198.55', '224198.55', '8968.00', '0.00', '8968.00', '0.00', '224198.55', '215230.55']);
    });

    it('reajustes, amortizaciones y penalidades entran donde corresponde', () => {
        const pago = computePagoMensual(vm.pies.actual, { reajusteMes: '1000', amortizacionDirecto: '200', penalidadAtraso: '50' }, 0, '0.04');
        expect(pago.c.toFixed(2)).toBe('225198.55');
        expect(pago.f.toFixed(2)).toBe('224998.55');
        expect(pago.g.detraccion.toFixed(2)).toBe('9000.00');
        expect(pago.k.toFixed(2)).toBe('215948.55');
    });

    it('monto en letras del texto final', () => {
        expect(montoEnLetrasTexto('224198.55')).toBe('Doscientos Veinticuatro Mil Ciento Noventa y Ocho con 55/100 soles');
    });
});

describe('PAGOS ACUMULADOS — cuadra con el Excel', () => {
    it('contratado, anterior (Val. N°01), actual, acumulado y saldo', () => {
        expect(estado(acumulados.contratado)).toEqual(['638827.47', '638827.47', '638827.47', '89435.75', '63882.75', '25553.00', '0.00', '638827.47', '549391.72']);
        expect(estado(acumulados.anterior)).toEqual(['400648.29', '400648.29', '400648.29', '79908.75', '63882.75', '16026.00', '0.00', '400648.29', '320739.54']);
        expect(estado(acumulados.acumulado)).toEqual(['624846.84', '624846.84', '624846.84', '88876.75', '63882.75', '24994.00', '0.00', '624846.84', '535970.09']);
        expect(estado(acumulados.saldo)).toEqual(['13980.63', '13980.63', '13980.63', '559.00', '0.00', '559.00', '0.00', '13980.63', '13421.63']);
    });
});

describe('CONTROL DE PAGOS — cuadra con el Excel', () => {
    const { filas, total } = computeControlPagos(acumulados, '0.18');

    it('una fila por valorización con base imponible e IGV', () => {
        expect(filas.map((f) => [f.monto, f.retencion, f.detraccion, f.liquido, f.base, f.igv].map((v) => v.toFixed(2)))).toEqual([
            ['400648.29', '63882.75', '16026.00', '320739.54', '271813.17', '48926.37'],
            ['224198.55', '0.00', '8968.00', '215230.55', '182398.77', '32831.78'],
        ]);
        expect([total.monto, total.retencion, total.detraccion, total.liquido, total.base, total.igv].map((v) => v.toFixed(2))).toEqual([
            '624846.84', '63882.75', '24994.00', '535970.09', '454211.94', '81758.15',
        ]);
    });
});

describe('Tablero de indicadores (reconstrucción de "res %")', () => {
    it('junta los resultados de las demás hojas', () => {
        const financiero = computeControlFinanciero(control, fixture.control.devengados, '638827.47', '638827.47', { directo: null, materiales: null });
        const tablero = computeTablero({
            control,
            financiero,
            resumen: computeResumenValorizacion(vm),
            rfc,
            pagos: acumulados,
            mesValorizacion: MES,
            inicioObra: '2026-06-20',
            terminoVigente: '2026-08-18',
            contratoVigente: presupuesto.totales.total,
        });
        expect([tablero.fisico.programado.toFixed(4), tablero.fisico.ejecutado.toFixed(4), tablero.fisico.diferencia?.toFixed(4)]).toEqual(['0.5650', '0.9782', '0.4132']);
        expect(tablero.tiempo).toMatchObject({ transcurridos: 42, plazo: 60 });
        expect(tablero.tiempo.pct.toFixed(4)).toBe('0.7000');
        expect(tablero.liquidoMes.toFixed(2)).toBe('215230.55');
        expect(tablero.financiero.saldoObra.toFixed(2)).toBe('13980.63');
        expect(tablero.garantia.retenida.toFixed(2)).toBe('63882.75');
        expect(tablero.componentes).toHaveLength(13);
    });
});

describe('CONTROL DE PAGOS — adicionales', () => {
    it('Vb, Vn, efectivo sin IGV, IGV y total (fórmulas de la segunda tabla del Excel)', () => {
        const { filas, total } = computeAdicionales(
            [
                { id: 'a1', mes: '2026-07', concepto: 'Adicional N°01', monto: '11800', reajuste: '0', amortizacionDirecto: '0', amortizacionMateriales: '0', retencion: '1180', penalidades: '0', facturaNro: '', comprobanteNro: '', fechaPago: null },
            ],
            '0.18',
        );
        expect([filas[0].bruta, filas[0].neta, filas[0].efectivo, filas[0].igv, filas[0].total].map((v) => v.toFixed(2))).toEqual(['11800.00', '11800.00', '9000.00', '1620.00', '10620.00']);
        expect(total.total.toFixed(2)).toBe('10620.00');
    });
});
