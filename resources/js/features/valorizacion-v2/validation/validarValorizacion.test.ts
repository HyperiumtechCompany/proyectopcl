import { describe, expect, it } from 'vitest';
import { valorizacion02Jul2026 as fixture } from '../data/fixtures/valorizacion02Jul2026';
import { D } from '../lib/money';
import { periodosDeObra } from '../lib/periodos';
import { computeCalendario } from '../sheets/calendario/computeCalendario';
import { computeControlGeneral } from '../sheets/control/computeControl';
import { calendarioEjecutadoDesdeMetrados, computeMetrados } from '../sheets/metrados/computeMetrados';
import { computePagosAcumulados, computeRetencionFielCumplimiento } from '../sheets/pagos/computePagos';
import { computePresupuesto } from '../sheets/presupuesto/computePresupuesto';
import type { MetradosInput } from '../types';
import type { EntradaValidacion } from './validarValorizacion';
import { validarValorizacion } from './validarValorizacion';

const MES = '2026-07';
const periodos = periodosDeObra('2026-06-20', '2026-08-18');
const presupuesto = computePresupuesto(fixture.presupuesto, fixture.parametros);

function entrada(metrados: MetradosInput = fixture.metrados, cambios: Partial<EntradaValidacion> = {}): EntradaValidacion {
    const programado = computeCalendario('programado', presupuesto, fixture.calendarios.programado, periodos, fixture.parametros);
    const ejecutado = computeCalendario('ejecutado', presupuesto, calendarioEjecutadoDesdeMetrados(presupuesto, metrados), periodos, fixture.parametros);
    const control = computeControlGeneral(programado, ejecutado, MES);
    const rfc = computeRetencionFielCumplimiento(control, '638827.47', fixture.pagos.rfc, MES);

    return {
        metrados: computeMetrados(presupuesto, metrados, periodos).filas,
        control,
        rfc,
        pagos: computePagosAcumulados(presupuesto.totales, ejecutado, rfc, {}, '0.04', MES),
        contratoVigente: D('638827.47'),
        adelantos: { directo: null, materiales: null },
        plazos: { fechaInicioObra: '2026-06-20', plazoEjecucionDias: 60, fechaTerminoReal: null, fechaTerminoVigente: '2026-08-18' },
        mesValorizacion: MES,
        ...cambios,
    };
}

const reglas = (e: EntradaValidacion) => validarValorizacion(e).map((h) => `${h.nivel}:${h.regla}`);

describe('validarValorizacion — reglas de negocio (plan §9.1)', () => {
    it('la Val. N°02 real no tiene errores', () => {
        expect(reglas(entrada()).filter((r) => r.startsWith('error'))).toEqual([]);
    });

    it('mayor metrado en una partida = aviso con su código y exceso', () => {
        const partida = presupuesto.tree.ordered.find((node) => node.esHoja && Number(node.input.metrado) > 0)!;
        const metrados = { ejecutado: { ...fixture.metrados.ejecutado, [partida.id]: { [MES]: String(Number(partida.input.metrado) + 5) } } };
        const hallazgo = validarValorizacion(entrada(metrados)).find((h) => h.regla === 'metrado-excedido')!;
        expect(hallazgo.nivel).toBe('aviso');
        expect(hallazgo.mensaje).toContain(`${partida.codigo} (+5.00)`);
    });

    it('ejecutar el doble del presupuesto: avance > 100 % y valorizado > contrato (errores)', () => {
        const doble = Object.fromEntries(
            presupuesto.tree.ordered.filter((node) => node.esHoja).map((node) => [node.id, { [MES]: String(Number(node.input.metrado ?? 0) * 2) }]),
        );
        const r = reglas(entrada({ ejecutado: doble }));
        expect(r).toContain('error:avance-mayor-100');
        expect(r).toContain('error:valorizado-mayor-contrato');
        // Los errores van primero.
        expect(r.findIndex((x) => x.startsWith('aviso'))).toBeGreaterThan(r.lastIndexOf('error:valorizado-mayor-contrato'));
    });

    it('retención mayor a la garantía, amortización mayor al adelanto y penalidad > 10 %', () => {
        const base = entrada();
        const r = reglas({
            ...base,
            rfc: { ...base.rfc, actualAcumulada: base.rfc.total.add(100) },
            adelantos: { directo: '1000.00', materiales: null },
            pagos: { ...base.pagos, acumulado: { ...base.pagos.acumulado, e: { directo: D(1500), materiales: D(0), total: D(1500) }, h: { atraso: D(70000), otros: D(0), total: D(70000) } } },
        });
        expect(r).toContain('error:retencion-mayor-garantia');
        expect(r).toContain('aviso:saldo-adelanto-negativo');
        expect(r).toContain('aviso:penalidad-tope');
    });

    it('fechas y plazo inválidos son errores; mes sin metrados es aviso', () => {
        const r = reglas(entrada(fixture.metrados, { plazos: { fechaInicioObra: '2026-06-20', plazoEjecucionDias: 0, fechaTerminoReal: '2026-06-01', fechaTerminoVigente: '2026-08-18' }, mesValorizacion: '2026-08' }));
        expect(r).toContain('error:plazo');
        expect(r).toContain('error:fecha-termino');
        expect(r).toContain('aviso:mes-sin-avance');
    });
});
