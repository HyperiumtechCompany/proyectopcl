import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useControl } from '../../hooks/useControl';
import { usePartidaContextMenu } from '../../hooks/usePartidaContextMenu';
import { usePartidaTree } from '../../hooks/usePartidaTree';
import { diffTotals } from '../../lib/budget';
import { D, safeDiv } from '../../lib/money';
import { IssuesPanel } from '../../shared/IssuesPanel';
import { BudgetSummaryFooter } from '../../shared/tree/BudgetSummaryFooter';
import { PartidaTreeTable } from '../../shared/tree/PartidaTreeTable';
import type { TreeColumn } from '../../shared/tree/PartidaTreeTable';
import { TreeToolbar } from '../../shared/tree/TreeToolbar';
import { fmtMoney, fmtNumber, fmtPct } from '../../utils/format';
import type { CalendarioFila } from '../calendario/computeCalendario';

const num = 'font-mono tabular-nums';

/** Hoja PROG VS. EJEC: por partida, lo programado vs lo ejecutado en un mes (por defecto, el valorizado). */
export default function ProgVsEjecSheet() {
    const { programado, ejecutado, presupuesto, parametros, mesValorizacion, periodos, input } = useControl();
    const tree = usePartidaTree(presupuesto.tree);
    const menu = usePartidaContextMenu({ onCreated: tree.reveal });
    const [mes, setMes] = useState(mesValorizacion);
    const periodo = periodos.find((p) => p.key === mes) ?? periodos[0];
    const progMes = programado.meses.find((m) => m.periodo.key === periodo?.key);
    const ejecMes = ejecutado.meses.find((m) => m.periodo.key === periodo?.key);
    const pct = (fila: CalendarioFila | undefined) => fila?.meses[periodo?.key ?? '']?.pct;
    const monto = (fila: CalendarioFila | undefined) => fila?.meses[periodo?.key ?? '']?.monto;

    const columns: TreeColumn<CalendarioFila>[] = [
        { id: 'total', header: 'Total (S/)', group: 'Presupuesto', className: num, cell: (fila) => fmtNumber(fila.total) },
        { id: 'p-pct', header: '%', group: `Programado · ${periodo?.label ?? ''}`, className: cn(num, 'text-stone-500'), cell: (fila) => (pct(programado.porId.get(fila.node.id)) ? fmtPct(pct(programado.porId.get(fila.node.id))) : '') },
        { id: 'p-costo', header: 'Costo (S/)', group: `Programado · ${periodo?.label ?? ''}`, className: num, cell: (fila) => fmtNumber(monto(programado.porId.get(fila.node.id))) },
        {
            // El Excel ponía aquí el metrado de junio bajo el título "%": aquí va el metrado REAL del mes elegido.
            id: 'e-met',
            header: 'Metrado',
            group: `Ejecutado · ${periodo?.label ?? ''}`,
            className: num,
            cell: (fila) => (fila.node.esHoja ? fmtNumber(input.metrados.ejecutado[fila.node.id]?.[periodo?.key ?? ''] ?? null) : ''),
        },
        { id: 'e-pct', header: '%', group: `Ejecutado · ${periodo?.label ?? ''}`, className: cn(num, 'text-stone-500'), cell: (fila) => (pct(ejecutado.porId.get(fila.node.id)) ? fmtPct(pct(ejecutado.porId.get(fila.node.id))) : '') },
        { id: 'e-costo', header: 'Costo (S/)', group: `Ejecutado · ${periodo?.label ?? ''}`, className: cn(num, 'bg-orange-50/40 dark:bg-orange-500/5'), cell: (fila) => fmtNumber(monto(ejecutado.porId.get(fila.node.id))) },
        {
            id: 'dif',
            header: 'Ejec. − prog.',
            group: 'Diferencia',
            className: num,
            cell: (fila) => {
                const p = monto(programado.porId.get(fila.node.id));
                const e = monto(ejecutado.porId.get(fila.node.id));
                if (!p && !e) {
                    return '';
                }
                const dif = D(e ?? 0).sub(p ?? 0);

                return <span className={dif.isNegative() ? 'text-red-600 dark:text-red-400' : 'text-stone-700 dark:text-stone-300'}>{fmtNumber(dif)}</span>;
            },
        },
    ];

    const cumplimiento = progMes && ejecMes ? safeDiv(ejecMes.totales.total, progMes.totales.total) : null;

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <h2 className="text-lg font-bold text-stone-900 sm:text-xl dark:text-stone-50">Avance programado vs ejecutado</h2>
                    <p className="text-xs text-stone-500 sm:text-sm dark:text-stone-400">Comparación por partida en el mes elegido.</p>
                </div>
                <div className="flex flex-wrap gap-1" role="tablist" aria-label="Mes">
                    {periodos.map((p) => (
                        <button
                            key={p.key}
                            type="button"
                            role="tab"
                            aria-selected={p.key === periodo?.key}
                            onClick={() => setMes(p.key)}
                            className={cn(
                                'rounded-md border px-2.5 py-1 text-xs font-semibold',
                                p.key === periodo?.key ? 'border-orange-500 bg-orange-50 text-orange-800 dark:bg-orange-500/10 dark:text-orange-200' : 'border-stone-300 bg-white text-stone-600 hover:border-orange-400 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300',
                            )}
                        >
                            {p.label}{p.key === mesValorizacion ? ' ★' : ''}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-2 @min-[28rem]:grid-cols-2 @min-[64rem]:grid-cols-4">
                {[
                    ['Programado del mes', fmtMoney(progMes?.totales.total), fmtPct(progMes?.totales.pesoCD)],
                    ['Ejecutado del mes', fmtMoney(ejecMes?.totales.total), fmtPct(ejecMes?.totales.pesoCD)],
                    ['Diferencia', progMes && ejecMes ? fmtMoney(ejecMes.totales.total.sub(progMes.totales.total)) : '—', 'Ejecutado − programado'],
                    ['Cumplimiento del mes', fmtPct(cumplimiento), 'Ejecutado / programado'],
                ].map(([label, value, hint]) => (
                    <div key={label} className="rounded-lg border border-stone-200 bg-white px-3 py-2 dark:border-stone-800 dark:bg-stone-900">
                        <p className="text-[11px] leading-relaxed font-semibold tracking-wide text-stone-600 uppercase dark:text-stone-300">{label}</p>
                        <p className="mt-1 font-mono text-sm font-semibold text-stone-900 tabular-nums wrap-break-word dark:text-stone-100">{value}</p>
                        <p className="mt-1 text-xs text-stone-600 dark:text-stone-300">{hint}</p>
                    </div>
                ))}
            </div>

            <IssuesPanel issues={[...programado.issues, ...ejecutado.issues]} />
            <TreeToolbar state={tree} />

            <PartidaTreeTable
                caption="Programado vs ejecutado"
                rows={programado.filas}
                columns={columns}
                state={tree}
                activeId={menu.activeId}
                onRowContextMenu={menu.onRowContextMenu}
                rowActions={menu.rowActions}
                footer={
                    progMes && ejecMes ? (
                        <BudgetSummaryFooter
                            labelColSpan={2}
                            parametros={parametros}
                            cells={[presupuesto.totales, null, progMes.totales, null, null, ejecMes.totales, diffTotals(ejecMes.totales, progMes.totales), null]}
                            totalLabel="Monto valorizado mensual"
                            showPeso
                            pesoLabel="Avance físico mensual"
                        />
                    ) : undefined
                }
            />
            {menu.element}
        </div>
    );
}
