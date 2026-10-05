import type Decimal from 'decimal.js';
import { calcBudgetTotals } from '../../lib/budget';
import type { BudgetTotals } from '../../lib/budget';
import { D, roundMoney, roundPct, safeDiv } from '../../lib/money';
import type { PartidaNode } from '../../lib/partidaTree';
import type { Periodo } from '../../lib/periodos';
import type { CalendarioInput, MesKey, ParametrosPresupuesto, TipoCalendario } from '../../types';
import type { PresupuestoCalculado } from '../presupuesto/computePresupuesto';

export interface CeldaMes {
    /** Monto sin redondear (null = sin dato ese mes). */
    monto: Decimal | null;
    /** ROUND(monto / total partida, 4). */
    pct: Decimal | null;
}

/** Programado: debe sumar 100 %. Ejecutado: no debe pasar de 100 %. */
export type EstadoFila = 'completo' | 'parcial' | 'excedido' | 'sin-datos';

export interface CalendarioFila {
    node: PartidaNode;
    total: Decimal;
    meses: Record<MesKey, CeldaMes>;
    suma: Decimal;
    sumaPct: Decimal;
    /** total − suma de meses (redondeado). */
    saldo: Decimal;
    estado: EstadoFila;
}

export interface CalendarioMes {
    periodo: Periodo;
    /** Pie del mes: CD = ROUND(SUM(montos), 2) → GG → UT → IGV → total; pesoCD = avance mensual. */
    totales: BudgetTotals;
    /** % acumulado hasta este mes. */
    acumulado: Decimal;
}

export interface CalendarioCalculado {
    tipo: TipoCalendario;
    periodos: Periodo[];
    filas: CalendarioFila[];
    porId: Map<string, CalendarioFila>;
    meses: CalendarioMes[];
    /** Pie de la suma de todos los meses. */
    totalMeses: BudgetTotals;
    issues: string[];
}

interface Acumulado {
    suma: Decimal;
    tieneDato: boolean;
}

/**
 * Hojas CALEN. PROG. y CALEN. VALO. Réplica de:
 *   I15 = ROUND(J15/$G15, 4)            % de la partida en el mes
 *   J156 = ROUND(SUM(J12:J155), 2)      CD del mes (suma montos SIN redondear)
 *   J157…J161                           pie GG/UT/IGV/total (calcBudgetTotals)
 *   J162 = ROUND(J156/$G156, 4)         avance mensual
 *   M163 = J163 + M162                  avance acumulado
 * (El Excel calcula el acumulado del primer mes como ROUND(GG_mes/GG_total, 4);
 * es el mismo peso salvo diferencias de redondeo de 1e-4, aquí se usa el peso.)
 */
export function computeCalendario(
    tipo: TipoCalendario,
    presupuesto: PresupuestoCalculado,
    calendario: CalendarioInput,
    periodos: Periodo[],
    parametros: ParametrosPresupuesto,
): CalendarioCalculado {
    const { tree } = presupuesto;
    const issues: string[] = [];
    const rates = { gastosGenerales: parametros.gastosGenerales, utilidad: parametros.utilidad, igv: parametros.igv };
    const cdPresupuesto = presupuesto.totales.costoDirecto;

    // Suma por nodo y mes (hojas: su monto; títulos: suma de sus hojas).
    const porNodoMes = new Map<string, Record<MesKey, Acumulado>>();
    const visit = (node: PartidaNode): Record<MesKey, Acumulado> => {
        const result: Record<MesKey, Acumulado> = {};
        for (const periodo of periodos) {
            result[periodo.key] = { suma: D(0), tieneDato: false };
        }
        if (node.esHoja) {
            const fila = calendario.montos[node.id] ?? {};
            for (const periodo of periodos) {
                const raw = fila[periodo.key];
                if (raw !== undefined && raw !== null && raw !== '') {
                    result[periodo.key] = { suma: D(raw), tieneDato: true };
                }
            }
        } else {
            for (const child of node.children) {
                const childResult = visit(child);
                for (const periodo of periodos) {
                    const acc = result[periodo.key];
                    const add = childResult[periodo.key];
                    result[periodo.key] = { suma: acc.suma.add(add.suma), tieneDato: acc.tieneDato || add.tieneDato };
                }
            }
        }
        porNodoMes.set(node.id, result);

        return result;
    };
    tree.roots.forEach(visit);

    const filas = tree.ordered.map((node): CalendarioFila => {
        const total = presupuesto.porId.get(node.id)?.total ?? D(0);
        const porMes = porNodoMes.get(node.id) ?? {};
        const meses: Record<MesKey, CeldaMes> = {};
        let suma = D(0);
        let tieneDato = false;
        for (const periodo of periodos) {
            const acc = porMes[periodo.key];
            meses[periodo.key] = acc?.tieneDato ? { monto: acc.suma, pct: roundPct(safeDiv(acc.suma, total)) } : { monto: null, pct: null };
            if (acc?.tieneDato) {
                suma = suma.add(acc.suma);
                tieneDato = true;
            }
        }
        const saldo = roundMoney(total.sub(roundMoney(suma)));
        let estado: EstadoFila = 'sin-datos';
        if (tieneDato) {
            estado = saldo.abs().lt('0.005') ? 'completo' : saldo.isNegative() ? 'excedido' : 'parcial';
        }

        return { node, total, meses, suma, sumaPct: roundPct(safeDiv(suma, total)), saldo, estado };
    });

    let acumulado = D(0);
    const meses = periodos.map((periodo): CalendarioMes => {
        const cdMes = tree.roots.reduce((acc, root) => acc.add(porNodoMes.get(root.id)?.[periodo.key]?.suma ?? 0), D(0));
        const totales = calcBudgetTotals(cdMes, rates, cdPresupuesto);
        acumulado = roundPct(acumulado.add(totales.pesoCD));

        return { periodo, totales, acumulado };
    });
    const totalMeses = calcBudgetTotals(
        meses.reduce((acc, mes) => acc.add(mes.totales.costoDirecto), D(0)),
        rates,
        cdPresupuesto,
    );

    // Observaciones.
    const hojas = filas.filter((fila) => fila.node.esHoja);
    const huerfanos = Object.keys(calendario.montos).filter((id) => !tree.byId.has(id) && Object.keys(calendario.montos[id]).length > 0).length;
    if (huerfanos > 0) {
        issues.push(`${huerfanos} partidas con montos ya no existen en el presupuesto (se ignoran; Ctrl+Z las recupera).`);
    }
    const enTitulos = Object.keys(calendario.montos).filter((id) => tree.byId.get(id)?.esHoja === false && Object.keys(calendario.montos[id]).length > 0).length;
    if (enTitulos > 0) {
        issues.push(`${enTitulos} títulos tienen montos propios: solo cuentan los de sus partidas.`);
    }
    if (tipo === 'programado') {
        const faltan = hojas.filter((fila) => fila.estado === 'parcial' || (fila.estado === 'sin-datos' && !fila.total.isZero())).length;
        if (faltan > 0) {
            issues.push(`${faltan} partidas no están programadas al 100 %.`);
        }
    }
    const excedidas = hojas.filter((fila) => fila.estado === 'excedido').length;
    if (excedidas > 0) {
        issues.push(`${excedidas} partidas superan el 100 % de su presupuesto.`);
    }

    return { tipo, periodos, filas, porId: new Map(filas.map((fila) => [fila.node.id, fila])), meses, totalMeses, issues };
}

/** Avance acumulado al mes indicado (o al último mes anterior con periodo). */
export function acumuladoAl(calculado: CalendarioCalculado, mes: MesKey): Decimal {
    let result = D(0);
    for (const item of calculado.meses) {
        if (item.periodo.key <= mes) {
            result = item.acumulado;
        }
    }

    return result;
}
