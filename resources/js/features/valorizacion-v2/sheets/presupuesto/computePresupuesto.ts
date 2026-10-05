import type Decimal from 'decimal.js';
import { calcBudgetTotals, calcPartidaTotal } from '../../lib/budget';
import type { BudgetTotals } from '../../lib/budget';
import { D, roundMoney, roundPct, safeDiv } from '../../lib/money';
import type { DecimalInput } from '../../lib/money';
import { buildPartidaTree, rollup } from '../../lib/partidaTree';
import type { PartidaNode, PartidaTree } from '../../lib/partidaTree';
import type { ParametrosPresupuesto, PresupuestoInput } from '../../types';

export interface PresupuestoFila {
    node: PartidaNode;
    metrado: Decimal | null;
    precioUnitario: Decimal | null;
    /** Hoja: ROUND(metrado × P.U., 2). Título: suma de sus partidas. */
    total: Decimal;
    /** Incidencia en el costo directo: ROUND(total / CD, 4). */
    incidencia: Decimal;
}

export interface PresupuestoCalculado {
    tree: PartidaTree;
    filas: PresupuestoFila[];
    porId: Map<string, PresupuestoFila>;
    porCodigo: Map<string, PresupuestoFila>;
    /** Filas de nivel 2 (los componentes 01.01 … 01.13 de RESUMEN VAL.). */
    componentes: PresupuestoFila[];
    totales: BudgetTotals;
    partidasCount: number;
    /** Total del presupuesto − monto de contrato vigente (0 = cuadra). */
    diferenciaContrato: Decimal | null;
}

const parseOrNull = (value: string | null): Decimal | null => (value === null || value === '' ? null : D(value));

/**
 * Hoja PRESUPUESTO. CD = ROUND(SUM(G12:G155), 2): en el Excel los títulos valen
 * 0, así que sumar solo hojas es equivalente; aquí los títulos muestran además
 * su subtotal. Una partida sin metrado o P.U. vale 0 (y el árbol lo reporta).
 */
export function computePresupuesto(
    presupuesto: PresupuestoInput,
    parametros: ParametrosPresupuesto,
    montoContrato: DecimalInput | null = null,
): PresupuestoCalculado {
    const tree = buildPartidaTree(presupuesto.partidas);
    const leafTotal = (node: PartidaNode): Decimal => calcPartidaTotal(node.input.metrado ?? 0, node.input.precioUnitario ?? 0);
    const totalesPorId = rollup(tree, leafTotal);

    const leaves = tree.ordered.filter((node) => node.esHoja);
    const costoDirectoBruto = leaves.reduce((acc, node) => acc.add(totalesPorId.get(node.id) ?? 0), D(0));
    const totales = calcBudgetTotals(costoDirectoBruto, {
        gastosGenerales: parametros.gastosGenerales,
        utilidad: parametros.utilidad,
        igv: parametros.igv,
    });

    const filas = tree.ordered.map((node): PresupuestoFila => {
        const total = roundMoney(totalesPorId.get(node.id) ?? 0);

        return {
            node,
            metrado: node.esHoja ? parseOrNull(node.input.metrado) : null,
            precioUnitario: node.esHoja ? parseOrNull(node.input.precioUnitario) : null,
            total,
            incidencia: roundPct(safeDiv(total, totales.costoDirecto)),
        };
    });
    const porId = new Map(filas.map((fila) => [fila.node.id, fila]));
    const porCodigo = new Map(filas.map((fila) => [fila.node.codigo, fila]));

    return {
        tree,
        filas,
        porId,
        porCodigo,
        componentes: filas.filter((fila) => fila.node.nivel === 2),
        totales,
        partidasCount: leaves.length,
        diferenciaContrato: montoContrato === null ? null : roundMoney(totales.total.sub(D(montoContrato))),
    };
}
