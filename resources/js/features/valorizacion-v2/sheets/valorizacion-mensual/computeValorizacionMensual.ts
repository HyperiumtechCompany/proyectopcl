import type Decimal from 'decimal.js';
import { calcBudgetTotals, calcPartidaTotal, diffTotals, sumTotals } from '../../lib/budget';
import type { BudgetTotals } from '../../lib/budget';
import { D, roundPct, safeDiv } from '../../lib/money';
import type { PartidaNode } from '../../lib/partidaTree';
import type { MesKey, MetradosInput, ParametrosPresupuesto } from '../../types';
import type { PresupuestoCalculado } from '../presupuesto/computePresupuesto';

export interface BloqueVM {
    /** Metrado (null en títulos: unidades distintas). */
    metrado: Decimal | null;
    costo: Decimal;
    pct: Decimal;
}

export interface ValorizacionFila {
    node: PartidaNode;
    metradoContratado: Decimal | null;
    precioUnitario: Decimal | null;
    total: Decimal;
    anterior: BloqueVM;
    actual: BloqueVM;
    acumulado: BloqueVM;
    saldo: BloqueVM;
}

export interface ValorizacionMensualCalculada {
    mes: MesKey;
    filas: ValorizacionFila[];
    porId: Map<string, ValorizacionFila>;
    pies: { presupuesto: BudgetTotals; anterior: BudgetTotals; actual: BudgetTotals; acumulado: BudgetTotals; saldo: BudgetTotals };
    issues: string[];
}

const bloque = (metrado: Decimal | null, costo: Decimal, pct: Decimal): BloqueVM => ({ metrado, costo, pct });

/**
 * Hoja VAL. MENSUAL, derivada de los metrados ejecutados:
 *   ANTERIOR  I/J/K = metrados y costos de los meses previos (Σ ROUND(met × PU, 2))
 *   ACTUAL    M = metrado del mes · N = ROUND(M × $F, 2) · O = ROUND(N / $G, 4)
 *   ACUMULADO Q = I + M · R = J + N · S = K + O
 *   SALDO     U = E − Q · V = G − R · W = 1 − S
 * Pie: anterior y actual con calcBudgetTotals; acumulado = suma de ambos pies
 * (R157 = J157 + N157 …) y saldo = presupuesto − acumulado, como el Excel.
 */
export function computeValorizacionMensual(
    presupuesto: PresupuestoCalculado,
    metrados: MetradosInput,
    mes: MesKey,
    parametros: ParametrosPresupuesto,
): ValorizacionMensualCalculada {
    const { tree } = presupuesto;
    const issues: string[] = [];
    const rates = { gastosGenerales: parametros.gastosGenerales, utilidad: parametros.utilidad, igv: parametros.igv };
    const porId = new Map<string, ValorizacionFila>();
    let posteriores = 0;

    const visit = (node: PartidaNode): ValorizacionFila => {
        const total = presupuesto.porId.get(node.id)?.total ?? D(0);
        let fila: ValorizacionFila;

        if (node.esHoja) {
            const pu = D(node.input.precioUnitario ?? 0);
            const contratado = D(node.input.metrado ?? 0);
            let antMet = D(0);
            let antCosto = D(0);
            let actMet: Decimal | null = null;
            for (const [mesKey, raw] of Object.entries(metrados.ejecutado[node.id] ?? {})) {
                if (raw === '') {
                    continue;
                }
                if (mesKey < mes) {
                    antMet = antMet.add(raw);
                    antCosto = antCosto.add(calcPartidaTotal(raw, pu));
                } else if (mesKey === mes) {
                    actMet = D(raw);
                } else {
                    posteriores += 1;
                }
            }
            const antPct = roundPct(safeDiv(antCosto, total));
            const actCosto = actMet ? calcPartidaTotal(actMet, pu) : D(0);
            const actPct = roundPct(safeDiv(actCosto, total));
            const acuMet = antMet.add(actMet ?? 0);
            const acuCosto = antCosto.add(actCosto);
            const acuPct = antPct.add(actPct);
            fila = {
                node,
                metradoContratado: contratado,
                precioUnitario: pu,
                total,
                anterior: bloque(antMet, antCosto, antPct),
                actual: bloque(actMet, actCosto, actPct),
                acumulado: bloque(acuMet, acuCosto, acuPct),
                saldo: bloque(contratado.sub(acuMet), total.sub(acuCosto), D(1).sub(acuPct)),
            };
        } else {
            const hijos = node.children.map(visit);
            const sumar = (pick: (f: ValorizacionFila) => Decimal) => hijos.reduce((acc, hijo) => acc.add(pick(hijo)), D(0));
            const ant = sumar((f) => f.anterior.costo);
            const act = sumar((f) => f.actual.costo);
            const pct = (costo: Decimal) => roundPct(safeDiv(costo, total));
            fila = {
                node,
                metradoContratado: null,
                precioUnitario: null,
                total,
                anterior: bloque(null, ant, pct(ant)),
                actual: bloque(null, act, pct(act)),
                acumulado: bloque(null, ant.add(act), pct(ant.add(act))),
                saldo: bloque(null, total.sub(ant).sub(act), pct(total.sub(ant).sub(act))),
            };
        }
        porId.set(node.id, fila);

        return fila;
    };
    tree.roots.forEach(visit);

    const filas = tree.ordered.map((node) => porId.get(node.id)!);
    const hojas = filas.filter((fila) => fila.node.esHoja);
    const cd = presupuesto.totales.costoDirecto;
    const anterior = calcBudgetTotals(hojas.reduce((acc, f) => acc.add(f.anterior.costo), D(0)), rates, cd);
    const actual = calcBudgetTotals(hojas.reduce((acc, f) => acc.add(f.actual.costo), D(0)), rates, cd);
    const acumulado = sumTotals(anterior, actual);
    const saldo = diffTotals(presupuesto.totales, acumulado);

    const excedidas = hojas.filter((fila) => fila.saldo.metrado?.isNegative());
    if (excedidas.length > 0) {
        issues.push(`${excedidas.length} partidas superan su metrado contratado en el acumulado: ${excedidas.slice(0, 5).map((f) => f.node.codigo).join(', ')}.`);
    }
    if (posteriores > 0) {
        issues.push(`Hay ${posteriores} metrados registrados en meses posteriores a la valorización; no entran en esta valorización.`);
    }
    if (acumulado.total.gt(presupuesto.totales.total)) {
        issues.push('El acumulado valorizado supera el monto del presupuesto.');
    }

    return { mes, filas, porId, pies: { presupuesto: presupuesto.totales, anterior, actual, acumulado, saldo }, issues };
}
