import type Decimal from 'decimal.js';
import { D, roundMoney, roundPct, safeDiv } from './money';
import type { DecimalInput } from './money';

/** Parámetros del pie presupuestal (PRESUPUESTO!D157:D160). Fracciones: 0.10 = 10 %. */
export interface BudgetRates {
    gastosGenerales: DecimalInput;
    utilidad: DecimalInput;
    igv: DecimalInput;
}

export interface BudgetTotals {
    costoDirecto: Decimal;
    gastosGenerales: Decimal;
    utilidad: Decimal;
    subTotal: Decimal;
    igv: Decimal;
    total: Decimal;
    /** Peso del CD respecto a un CD de referencia (avance físico mensual). */
    pesoCD: Decimal;
}

/**
 * Pie presupuestal estándar. Se repite en PRESUPUESTO, ambos calendarios,
 * VAL. MENSUAL (×5 bloques), PROG VS. EJEC y RESUMEN VAL. Réplica de:
 *   G156 = ROUND(SUM(G12:G155), 2)   costo directo
 *   G157 = ROUND($D157*G$156, 2)     gastos generales
 *   G158 = ROUND($D158*G$156, 2)     utilidad
 *   G159 = ROUND(G156+G157+G158, 2)  sub total
 *   G160 = ROUND($D160*G$159, 2)     IGV
 *   G161 = ROUND(G159+G160, 2)       total
 *   G162 = ROUND(G156/$G$156, 4)     peso del CD
 */
export function calcBudgetTotals(sumPartidas: DecimalInput, rates: BudgetRates, cdReferencia?: DecimalInput): BudgetTotals {
    const costoDirecto = roundMoney(sumPartidas);
    const gastosGenerales = roundMoney(costoDirecto.mul(D(rates.gastosGenerales)));
    const utilidad = roundMoney(costoDirecto.mul(D(rates.utilidad)));
    const subTotal = roundMoney(costoDirecto.add(gastosGenerales).add(utilidad));
    const igv = roundMoney(subTotal.mul(D(rates.igv)));
    const total = roundMoney(subTotal.add(igv));
    const pesoCD = roundPct(safeDiv(costoDirecto, cdReferencia ?? costoDirecto));

    return { costoDirecto, gastosGenerales, utilidad, subTotal, igv, total, pesoCD };
}

/** Total de partida: ROUND(metrado × P.U., 2). */
export const calcPartidaTotal = (metrado: DecimalInput, precioUnitario: DecimalInput): Decimal => roundMoney(D(metrado).mul(D(precioUnitario)));

/** % de avance: ROUND(monto / presupuesto, 4); presupuesto 0 → 0. */
export const calcPctAvance = (monto: DecimalInput, presupuesto: DecimalInput): Decimal => roundPct(safeDiv(monto, presupuesto));

const FIELDS = ['costoDirecto', 'gastosGenerales', 'utilidad', 'subTotal', 'igv', 'total', 'pesoCD'] as const;

/**
 * Suma campo a campo de dos pies (VAL. MENSUAL R157:R163 = J + N): el acumulado
 * del Excel suma los pies de "anterior" y "actual", no recalcula el pie.
 */
export function sumTotals(a: BudgetTotals, b: BudgetTotals): BudgetTotals {
    return Object.fromEntries(FIELDS.map((field) => [field, a[field].add(b[field])])) as unknown as BudgetTotals;
}

/** Resta campo a campo (saldo = presupuesto − acumulado, VAL. MENSUAL V157:V163). */
export function diffTotals(a: BudgetTotals, b: BudgetTotals): BudgetTotals {
    return Object.fromEntries(FIELDS.map((field) => [field, a[field].sub(b[field])])) as unknown as BudgetTotals;
}
