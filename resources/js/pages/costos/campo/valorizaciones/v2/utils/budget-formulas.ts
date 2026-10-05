import Decimal from 'decimal.js';
import { D, roundMoney, roundPct } from './decimal-helpers';

export interface BudgetTotals {
    costoDirecto: Decimal;      // SUM(partidas)
    gastosGenerales: Decimal;   // CD × %GG
    utilidad: Decimal;          // CD × %UTIL
    subTotal: Decimal;          // CD + GG + UTIL
    igv: Decimal;               // SubTotal × %IGV
    total: Decimal;             // SubTotal + IGV
    pctCD: Decimal;             // CD / CD_referencia (para peso %)
}

/**
 * Calcula el bloque presupuestal estándar.
 * Replica exactamente las fórmulas del Excel:
 *   G156 = ROUND(SUM(G12:G155), 2)       → costoDirecto
 *   G157 = ROUND($D157 * G$156, 2)       → gastosGenerales
 *   G158 = ROUND($D158 * G$156, 2)       → utilidad
 *   G159 = ROUND(G156+G157+G158, 2)      → subTotal
 *   G160 = ROUND($D160 * G$159, 2)       → igv
 *   G161 = ROUND(G159+G160, 2)           → total
 *   G162 = ROUND(G156 / $G$156, 4)       → pctCD
 */
export function calcBudgetTotals(
    sumPartidas: Decimal | number | string,
    pctGG: Decimal | number | string,       // ej: 0.075 (7.5%)
    pctUtil: Decimal | number | string,     // ej: 0.05 (5%)
    pctIGV: Decimal | number | string,      // ej: 0.18 (18%)
    cdReferencia?: Decimal | number | string // Para calcular pctCD (si es undefined, usa sumPartidas)
): BudgetTotals {
    const costoDirecto = roundMoney(sumPartidas);
    const gastosGenerales = roundMoney(costoDirecto.mul(D(pctGG)));
    const utilidad = roundMoney(costoDirecto.mul(D(pctUtil)));
    const subTotal = roundMoney(costoDirecto.add(gastosGenerales).add(utilidad));
    const igv = roundMoney(subTotal.mul(D(pctIGV)));
    const total = roundMoney(subTotal.add(igv));
    
    const ref = D(cdReferencia ?? costoDirecto);
    const pctCD = ref.isZero() ? D(0) : roundPct(costoDirecto.div(ref));

    return { costoDirecto, gastosGenerales, utilidad, subTotal, igv, total, pctCD };
}

/** 
 * Fórmula por partida: ROUND(metrado × precioUnitario, 2) 
 */
export const calcPartidaTotal = (metrado: Decimal | number | string, pu: Decimal | number | string): Decimal => {
    return roundMoney(D(metrado).mul(D(pu)));
};

/** 
 * % avance de partida/mes: ROUND(montoAvance / montoPresupuesto, 4) 
 */
export const calcPctAvance = (avance: Decimal | number | string, presupuesto: Decimal | number | string): Decimal => {
    const p = D(presupuesto);
    if (p.isZero()) return D(0);
    return roundPct(D(avance).div(p));
};
