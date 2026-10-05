import type Decimal from 'decimal.js';
import type { BudgetTotals } from '../../lib/budget';
import { D, roundInt, roundMoney, roundPct, safeDiv } from '../../lib/money';
import type { DecimalInput } from '../../lib/money';
import type { PartidaNode } from '../../lib/partidaTree';
import type { Periodo } from '../../lib/periodos';
import type { AdicionalPago, AjustesPago, ConfigRfc, MesKey } from '../../types';
import type { CalendarioCalculado } from '../calendario/computeCalendario';
import type { ControlGeneral } from '../control/computeControl';
import type { ValorizacionMensualCalculada } from '../valorizacion-mensual/computeValorizacionMensual';

/* ───────────────────────── RESUMEN VAL. ───────────────────────── */

export interface BloqueResumen {
    pct: Decimal;
    monto: Decimal;
}

export interface ComponenteResumen {
    node: PartidaNode;
    contratado: Decimal;
    anterior: BloqueResumen;
    actual: BloqueResumen;
    acumulado: BloqueResumen;
    saldo: BloqueResumen;
}

export interface ResumenValorizacion {
    componentes: ComponenteResumen[];
    pies: ValorizacionMensualCalculada['pies'];
}

/**
 * RESUMEN VAL.: VAL. MENSUAL agrupada por componente (nivel 2). % = ROUND(monto /
 * contratado, 4); acumulado % = anterior % + actual % (columna M del Excel);
 * saldo = contratado − acumulado. Se calcula desde VAL. MENSUAL: la hoja del
 * Excel tenía referencias rotas en 01.09–01.13.
 */
export function computeResumenValorizacion(vm: ValorizacionMensualCalculada): ResumenValorizacion {
    const componentes = vm.filas
        .filter((fila) => fila.node.nivel === 2)
        .map((fila): ComponenteResumen => {
            const pct = (monto: Decimal) => roundPct(safeDiv(monto, fila.total));
            const anterior = { monto: fila.anterior.costo, pct: pct(fila.anterior.costo) };
            const actual = { monto: fila.actual.costo, pct: pct(fila.actual.costo) };
            const acumulado = { monto: anterior.monto.add(actual.monto), pct: anterior.pct.add(actual.pct) };

            return { node: fila.node, contratado: fila.total, anterior, actual, acumulado, saldo: { monto: fila.total.sub(acumulado.monto), pct: D(1).sub(acumulado.pct) } };
        });

    return { componentes, pies: vm.pies };
}

/* ───────────────────────── R.F.C ───────────────────────── */

export interface RfcMes {
    numero: number;
    periodo: Periodo;
    /** Monto valorizado con IGV (0 si el mes no se valorizó). */
    valorizado: Decimal;
    programada: Decimal;
    /** MIN(valorizado, programada) — R.F.C!F = IF(D<E, D, E). */
    efectiva: Decimal;
}

export interface RetencionFielCumplimiento {
    contrato: Decimal;
    total: Decimal;
    meses: RfcMes[];
    anteriorAcumulada: Decimal;
    actual: Decimal;
    actualAcumulada: Decimal;
    saldoPorRetener: Decimal;
}

/**
 * Programa la retención: todo en el primer pago, o prorrateada en la primera
 * mitad de los pagos (ceil(n/2) meses, el último absorbe los céntimos).
 */
function programarRetencion(total: Decimal, meses: number, modo: ConfigRfc['modo']): Decimal[] {
    if (meses === 0) {
        return [];
    }
    if (modo === 'primer-pago') {
        return Array.from({ length: meses }, (_, index) => (index === 0 ? total : D(0)));
    }
    const cuotas = Math.ceil(meses / 2);
    const cuota = roundMoney(total.div(cuotas));

    return Array.from({ length: meses }, (_, index) => {
        if (index < cuotas - 1) {
            return cuota;
        }

        return index === cuotas - 1 ? total.sub(cuota.mul(cuotas - 1)) : D(0);
    });
}

export function computeRetencionFielCumplimiento(control: ControlGeneral, contratoOriginal: DecimalInput, config: ConfigRfc, mesValorizacion: MesKey): RetencionFielCumplimiento {
    const contrato = D(contratoOriginal);
    const total = roundMoney(contrato.mul(D(config.porcentaje)));
    const programadas = programarRetencion(total, control.meses.length, config.modo);

    const meses = control.meses.map((mes, index): RfcMes => {
        const valorizado = mes.ejecutado?.mensual ?? D(0);
        const programada = programadas[index] ?? D(0);

        return { numero: mes.numero, periodo: mes.periodo, valorizado, programada, efectiva: valorizado.lt(programada) ? valorizado : programada };
    });

    const sumar = (filtro: (mes: RfcMes) => boolean) => meses.filter(filtro).reduce((acc, mes) => acc.add(mes.efectiva), D(0));
    const anteriorAcumulada = sumar((mes) => mes.periodo.key < mesValorizacion);
    const actual = sumar((mes) => mes.periodo.key === mesValorizacion);
    const actualAcumulada = anteriorAcumulada.add(actual);

    return { contrato, total, meses, anteriorAcumulada, actual, actualAcumulada, saldoPorRetener: total.sub(actualAcumulada) };
}

/* ───────────────────────── R PAGO MENSUAL ───────────────────────── */

export interface PagoMensual {
    /** Pie de la valorización del mes (CD → total con IGV). */
    valorizacion: BudgetTotals;
    /** A. Valorización del mes sin reajuste. */
    a: Decimal;
    b: { reajusteMes: Decimal; reintegroMesAnterior: Decimal; total: Decimal };
    /** C = A + B. */
    c: Decimal;
    d: { directo: Decimal; materiales: Decimal; total: Decimal };
    e: { directo: Decimal; materiales: Decimal; total: Decimal };
    /** F = C − D − E (monto neto facturable). */
    f: Decimal;
    g: { rfc: Decimal; detraccion: Decimal; total: Decimal };
    h: { atraso: Decimal; otros: Decimal; total: Decimal };
    /** J = F (monto a facturar). */
    j: Decimal;
    /** K = F − G − H (líquido a pagar). */
    k: Decimal;
}

const dinero = (value: string | undefined) => D(value ?? 0);

/**
 * R PAGO MENSUAL: A (valorización con IGV) + reajustes − deducciones −
 * amortizaciones = F neto facturable; G retenciones (R.F.C del mes + detracción
 * ROUND(F × 4 %, 0) a ENTERO); H penalidades; K = F − G − H.
 */
export function computePagoMensual(valorizacion: BudgetTotals, ajustes: Partial<AjustesPago>, rfcMes: DecimalInput, porcentajeDetraccion: DecimalInput): PagoMensual {
    const a = valorizacion.total;
    const b = { reajusteMes: dinero(ajustes.reajusteMes), reintegroMesAnterior: dinero(ajustes.reintegroMesAnterior), total: D(0) };
    b.total = b.reajusteMes.add(b.reintegroMesAnterior);
    const c = a.add(b.total);
    const d = { directo: dinero(ajustes.deduccionReajusteDirecto), materiales: dinero(ajustes.deduccionReajusteMateriales), total: D(0) };
    d.total = d.directo.add(d.materiales);
    const e = { directo: dinero(ajustes.amortizacionDirecto), materiales: dinero(ajustes.amortizacionMateriales), total: D(0) };
    e.total = e.directo.add(e.materiales);
    const f = c.sub(d.total).sub(e.total);
    const g = { rfc: D(rfcMes), detraccion: roundInt(f.mul(D(porcentajeDetraccion))), total: D(0) };
    g.total = g.rfc.add(g.detraccion);
    const h = { atraso: dinero(ajustes.penalidadAtraso), otros: dinero(ajustes.penalidadOtros), total: D(0) };
    h.total = h.atraso.add(h.otros);

    return { valorizacion, a, b, c, d, e, f, g, h, j: f, k: f.sub(g.total).sub(h.total) };
}

/** Suma campo a campo de dos pagos (anterior + actual). */
export function sumarPagos(x: PagoMensual, y: PagoMensual): PagoMensual {
    const add = (p: Decimal, q: Decimal) => p.add(q);
    const addObj = <T extends Record<string, Decimal>>(p: T, q: T): T => Object.fromEntries(Object.keys(p).map((key) => [key, add(p[key], q[key])])) as T;
    const valorizacion = Object.fromEntries(Object.keys(x.valorizacion).map((key) => [key, add(x.valorizacion[key as keyof BudgetTotals], y.valorizacion[key as keyof BudgetTotals])])) as unknown as BudgetTotals;

    return { valorizacion, a: add(x.a, y.a), b: addObj(x.b, y.b), c: add(x.c, y.c), d: addObj(x.d, y.d), e: addObj(x.e, y.e), f: add(x.f, y.f), g: addObj(x.g, y.g), h: addObj(x.h, y.h), j: add(x.j, y.j), k: add(x.k, y.k) };
}

/** Resta campo a campo (saldo = contratado − acumulado). */
export function restarPagos(x: PagoMensual, y: PagoMensual): PagoMensual {
    const neg = (p: PagoMensual): PagoMensual => {
        const n = (value: Decimal) => value.neg();
        const nObj = <T extends Record<string, Decimal>>(o: T): T => Object.fromEntries(Object.entries(o).map(([key, value]) => [key, n(value)])) as T;

        return { valorizacion: nObj(p.valorizacion as unknown as Record<string, Decimal>) as unknown as BudgetTotals, a: n(p.a), b: nObj(p.b), c: n(p.c), d: nObj(p.d), e: nObj(p.e), f: n(p.f), g: nObj(p.g), h: nObj(p.h), j: n(p.j), k: n(p.k) };
    };

    return sumarPagos(x, neg(y));
}

/* ───────────────────────── PAGOS ACUMULADOS ───────────────────────── */

export interface PagosAcumulados {
    /** Columna "monto contratado": presupuesto + R.F.C total + detracción del total. */
    contratado: PagoMensual;
    anterior: PagoMensual;
    actual: PagoMensual;
    acumulado: PagoMensual;
    saldo: PagoMensual;
    /** Pago de cada mes valorizado (para CONTROL DE PAGOS). */
    porMes: Array<{ periodo: Periodo; numero: number; pago: PagoMensual; ajustes: Partial<AjustesPago> }>;
}

const VACIO: Partial<AjustesPago> = {};

/**
 * PAGOS ACUMULADOS: el "acumulado anterior" del Excel era un número tecleado;
 * aquí es la suma de los pagos de los meses valorizados anteriores.
 */
export function computePagosAcumulados(
    presupuesto: BudgetTotals,
    ejecutado: CalendarioCalculado,
    rfc: RetencionFielCumplimiento,
    ajustesPorMes: Record<MesKey, Partial<AjustesPago>>,
    porcentajeDetraccion: DecimalInput,
    mesValorizacion: MesKey,
): PagosAcumulados {
    const rfcPorMes = new Map(rfc.meses.map((mes) => [mes.periodo.key, mes.efectiva]));
    const porMes = ejecutado.meses
        .filter((mes) => mes.periodo.key <= mesValorizacion)
        .map((mes, index) => {
            const ajustes = ajustesPorMes[mes.periodo.key] ?? VACIO;

            return { periodo: mes.periodo, numero: index + 1, ajustes, pago: computePagoMensual(mes.totales, ajustes, rfcPorMes.get(mes.periodo.key) ?? 0, porcentajeDetraccion) };
        });

    const cero = computePagoMensual({ costoDirecto: D(0), gastosGenerales: D(0), utilidad: D(0), subTotal: D(0), igv: D(0), total: D(0), pesoCD: D(0) }, VACIO, 0, porcentajeDetraccion);
    const anterior = porMes.filter((item) => item.periodo.key < mesValorizacion).reduce((acc, item) => sumarPagos(acc, item.pago), cero);
    const actual = porMes.find((item) => item.periodo.key === mesValorizacion)?.pago ?? cero;
    const acumulado = sumarPagos(anterior, actual);
    const contratado = computePagoMensual(presupuesto, VACIO, rfc.total, porcentajeDetraccion);

    return { contratado, anterior, actual, acumulado, saldo: restarPagos(contratado, acumulado), porMes };
}

/* ───────────────────────── CONTROL DE PAGOS ───────────────────────── */

export interface FilaControlPago {
    numero: number;
    periodo: Periodo;
    /** V: monto valorizado. */
    monto: Decimal;
    /** R: reajuste neto (reajuste + reintegro − deducciones). */
    reajuste: Decimal;
    /** Vb = V + R. */
    bruta: Decimal;
    amortizacionDirecto: Decimal;
    amortizacionMateriales: Decimal;
    /** Vn = Vb − (D + M). */
    neta: Decimal;
    retencion: Decimal;
    penalidades: Decimal;
    detraccion: Decimal;
    /** Líquido pagado = Vn − (G + P + detracción). */
    liquido: Decimal;
    /** ROUND(líquido / (1 + IGV), 2). */
    base: Decimal;
    igv: Decimal;
    ajustes: Partial<AjustesPago>;
}

export function computeControlPagos(pagos: PagosAcumulados, tasaIgv: DecimalInput): { filas: FilaControlPago[]; total: Omit<FilaControlPago, 'numero' | 'periodo' | 'ajustes'> } {
    const divisor = D(1).add(D(tasaIgv));
    const filas = pagos.porMes.map(({ numero, periodo, pago, ajustes }): FilaControlPago => {
        const base = roundMoney(pago.k.div(divisor));

        return {
            numero,
            periodo,
            monto: pago.a,
            reajuste: pago.b.total.sub(pago.d.total),
            bruta: pago.a.add(pago.b.total).sub(pago.d.total),
            amortizacionDirecto: pago.e.directo,
            amortizacionMateriales: pago.e.materiales,
            neta: pago.f,
            retencion: pago.g.rfc,
            penalidades: pago.h.total,
            detraccion: pago.g.detraccion,
            liquido: pago.k,
            base,
            igv: pago.k.sub(base),
            ajustes,
        };
    });
    const campos = ['monto', 'reajuste', 'bruta', 'amortizacionDirecto', 'amortizacionMateriales', 'neta', 'retencion', 'penalidades', 'detraccion', 'liquido', 'base', 'igv'] as const;
    const total = Object.fromEntries(campos.map((campo) => [campo, filas.reduce((acc, fila) => acc.add(fila[campo]), D(0))])) as Omit<FilaControlPago, 'numero' | 'periodo' | 'ajustes'>;

    return { filas, total };
}

/* ───────────────────────── ADICIONALES (CONTROL DE PAGOS) ───────────────────────── */

export interface FilaAdicional {
    adicional: AdicionalPago;
    bruta: Decimal;
    neta: Decimal;
    /** (Vn − (G + P)) / (1 + IGV), sin redondear como el Excel. */
    efectivo: Decimal;
    igv: Decimal;
    total: Decimal;
}

/**
 * Valorizaciones de adicionales, mayores gastos generales, intereses u otros:
 * Vb = V + R · Vn = Vb − (D + M) · efectivo = (Vn − (G + P)) / (1 + IGV) ·
 * IGV = efectivo × tasa · total = efectivo + IGV (CONTROL DE PAGOS filas 22–25).
 */
export function computeAdicionales(adicionales: AdicionalPago[], tasaIgv: DecimalInput): { filas: FilaAdicional[]; total: Omit<FilaAdicional, 'adicional'> & { monto: Decimal } } {
    const tasa = D(tasaIgv);
    const filas = adicionales.map((adicional): FilaAdicional => {
        const bruta = D(adicional.monto).add(D(adicional.reajuste));
        const neta = bruta.sub(D(adicional.amortizacionDirecto)).sub(D(adicional.amortizacionMateriales));
        const efectivo = neta.sub(D(adicional.retencion)).sub(D(adicional.penalidades)).div(D(1).add(tasa));
        const igv = efectivo.mul(tasa);

        return { adicional, bruta, neta, efectivo, igv, total: efectivo.add(igv) };
    });
    const suma = (pick: (fila: FilaAdicional) => Decimal) => filas.reduce((acc, fila) => acc.add(pick(fila)), D(0));

    return {
        filas,
        total: { monto: suma((f) => D(f.adicional.monto)), bruta: suma((f) => f.bruta), neta: suma((f) => f.neta), efectivo: suma((f) => f.efectivo), igv: suma((f) => f.igv), total: suma((f) => f.total) },
    };
}
