import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { usePartidaContextMenu } from '../../hooks/usePartidaContextMenu';
import { usePartidaTree } from '../../hooks/usePartidaTree';
import { useValorizacionMensual } from '../../hooks/useValorizacionMensual';
import type { BudgetTotals } from '../../lib/budget';
import { formatMonthYear } from '../../lib/dates';
import { parseMontoOPorcentaje } from '../../lib/money';
import { EditableCell } from '../../shared/EditableCell';
import { IssuesPanel } from '../../shared/IssuesPanel';
import { BudgetSummaryFooter } from '../../shared/tree/BudgetSummaryFooter';
import { PartidaTreeTable } from '../../shared/tree/PartidaTreeTable';
import type { TreeColumn } from '../../shared/tree/PartidaTreeTable';
import { TreeToolbar } from '../../shared/tree/TreeToolbar';
import { useValorizacionStore } from '../../store/ValorizacionStoreProvider';
import { fmtMoney, fmtNumber, fmtPct } from '../../utils/format';
import type { BloqueVM, ValorizacionFila } from './computeValorizacionMensual';

const num = 'font-mono tabular-nums';

type BloqueKey = 'anterior' | 'actual' | 'acumulado' | 'saldo';

const BLOQUES: Array<{ key: BloqueKey; label: string; tone?: string }> = [
    { key: 'anterior', label: 'Acumulado anterior' },
    { key: 'actual', label: 'Actual', tone: 'bg-orange-50/50 dark:bg-orange-500/5' },
    { key: 'acumulado', label: 'Acumulado actual' },
    { key: 'saldo', label: 'Saldo' },
];

function Tarjeta({ label, totals, highlight = false }: { label: string; totals: BudgetTotals; highlight?: boolean }) {
    return (
        <div className={cn('rounded-lg border px-3 py-2', highlight ? 'border-orange-300 bg-orange-50/60 dark:border-orange-500/40 dark:bg-orange-500/10' : 'border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900')}>
            <p className="text-[11px] leading-relaxed font-semibold tracking-wide text-stone-600 uppercase dark:text-stone-300">{label}</p>
            <p className="mt-1 font-mono text-sm font-semibold text-stone-900 tabular-nums wrap-break-word dark:text-stone-100">{fmtMoney(totals.total)}</p>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-300">
                CD {fmtMoney(totals.costoDirecto)} · <span className="font-mono font-semibold text-stone-700 dark:text-stone-300">{fmtPct(totals.pesoCD)}</span>
            </p>
        </div>
    );
}

/** Hoja VAL. MENSUAL — 5 bloques derivados de los metrados; el metrado ACTUAL se edita aquí o en Metrados (es el mismo dato). */
export default function ValorizacionMensualSheet() {
    const { calculado, presupuesto, parametros, mesValorizacion } = useValorizacionMensual();
    const periodo = useValorizacionStore((state) => state.input.periodo);
    const setMetrado = useValorizacionStore((state) => state.setMetrado);
    const tree = usePartidaTree(presupuesto.tree);
    const menu = usePartidaContextMenu({ onCreated: tree.reveal });
    const [editing, setEditing] = useState(false);
    const [compacto, setCompacto] = useState(false);
    const { pies } = calculado;

    const bloqueColumns = (key: BloqueKey, label: string, tone = ''): TreeColumn<ValorizacionFila>[] => {
        const metrado: TreeColumn<ValorizacionFila> = {
            id: `${key}-met`,
            header: 'Metrado',
            group: label,
            className: cn(num, tone, key === 'actual' && editing && 'w-24'),
            cell: (fila) => {
                if (key === 'actual' && editing && fila.node.esHoja) {
                    return (
                        <EditableCell
                            label={`Metrado actual ${fila.node.codigo}`}
                            kind="number"
                            align="right"
                            title="Metrado del mes (0.48) o porcentaje del contratado (24%)"
                            value={fila.actual.metrado?.toString() ?? null}
                            parse={(raw) => parseMontoOPorcentaje(raw, fila.metradoContratado ?? 0)}
                            onCommit={(value) => setMetrado(fila.node.id, mesValorizacion, value)}
                        />
                    );
                }
                const bloque: BloqueVM = fila[key];

                return bloque.metrado && !bloque.metrado.isZero() ? fmtNumber(bloque.metrado) : '';
            },
        };
        const costo: TreeColumn<ValorizacionFila> = {
            id: `${key}-costo`,
            header: 'Costo (S/)',
            group: label,
            className: cn(num, tone),
            cell: (fila) => (fila[key].costo.isZero() ? '' : fmtNumber(fila[key].costo)),
        };
        const pct: TreeColumn<ValorizacionFila> = {
            id: `${key}-pct`,
            header: '%',
            group: label,
            className: cn(num, 'text-stone-500', tone),
            cell: (fila) => (fila[key].costo.isZero() && key !== 'saldo' ? '' : fmtPct(fila[key].pct)),
        };

        return compacto ? [costo, pct] : [metrado, costo, pct];
    };

    const presupuestoColumns: TreeColumn<ValorizacionFila>[] = [
        ...(compacto
            ? []
            : [
                  { id: 'und', header: 'Und', group: 'Presupuesto', align: 'center' as const, cell: (fila: ValorizacionFila) => fila.node.unidad ?? '' },
                  { id: 'met', header: 'Metrado', group: 'Presupuesto', className: num, cell: (fila: ValorizacionFila) => fmtNumber(fila.metradoContratado) },
                  { id: 'pu', header: 'P. unit.', group: 'Presupuesto', className: num, cell: (fila: ValorizacionFila) => fmtNumber(fila.precioUnitario) },
              ]),
        { id: 'total', header: 'Total (S/)', group: 'Presupuesto', className: num, cell: (fila) => fmtNumber(fila.total) },
    ];
    const columns = [...presupuestoColumns, ...BLOQUES.flatMap((bloque) => bloqueColumns(bloque.key, bloque.label, bloque.tone))];

    // Pie: una celda por columna después de la etiqueta (ítem + descripción + und/metrado/P.U. si no es compacto).
    const blockCells = (totals: BudgetTotals) => (compacto ? [totals, null] : [null, totals, null]);
    const cells = [pies.presupuesto, ...blockCells(pies.anterior), ...blockCells(pies.actual), ...blockCells(pies.acumulado), ...blockCells(pies.saldo), null];

    return (
        <div className="space-y-3">
            <div className="min-w-0">
                <h2 className="text-lg font-bold text-stone-900 sm:text-xl dark:text-stone-50">
                    Valorización N°{String(periodo.numero).padStart(2, '0')} · {formatMonthYear(periodo.mes)}
                </h2>
                <p className="text-xs text-stone-500 sm:text-sm dark:text-stone-400">
                    Todo se calcula desde los metrados ejecutados: anterior = meses previos, actual = metrado del mes.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-2 @min-[28rem]:grid-cols-2 @min-[64rem]:grid-cols-4">
                <Tarjeta label="Acumulado anterior" totals={pies.anterior} />
                <Tarjeta label={`Valorización del mes`} totals={pies.actual} highlight />
                <Tarjeta label="Acumulado actual" totals={pies.acumulado} />
                <Tarjeta label="Saldo por valorizar" totals={pies.saldo} />
            </div>

            <IssuesPanel issues={calculado.issues} />

            <TreeToolbar state={tree}>
                <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
                    <button
                        type="button"
                        onClick={() => setCompacto((value) => !value)}
                        aria-pressed={compacto}
                        className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:border-orange-400 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
                    >
                        {compacto ? 'Vista completa' : 'Vista compacta'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setEditing((value) => !value)}
                        aria-pressed={editing}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold',
                            editing ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-stone-900 text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900',
                        )}
                    >
                        <Pencil className="size-3.5" /> {editing ? 'Terminar edición' : 'Editar metrado actual'}
                    </button>
                </div>
            </TreeToolbar>

            <PartidaTreeTable
                caption="Valorización mensual"
                rows={calculado.filas}
                columns={columns}
                state={tree}
                activeId={menu.activeId}
                onRowContextMenu={menu.onRowContextMenu}
                rowActions={menu.rowActions}
                footer={<BudgetSummaryFooter labelColSpan={compacto ? 2 : 5} parametros={parametros} cells={cells} totalLabel="Monto valorizado mensual" showPeso pesoLabel="Avance físico mensual" />}
            />
            {menu.element}
        </div>
    );
}
