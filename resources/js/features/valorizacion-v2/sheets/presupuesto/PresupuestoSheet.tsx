import { AlertTriangle, CheckCircle2, FolderPlus, MousePointerClick, Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { usePartidaContextMenu } from '../../hooks/usePartidaContextMenu';
import { usePartidaTree } from '../../hooks/usePartidaTree';
import { usePresupuesto } from '../../hooks/usePresupuesto';
import { D } from '../../lib/money';
import { Chip } from '../../shared/Chip';
import { EditableCell } from '../../shared/EditableCell';
import { BudgetSummaryFooter } from '../../shared/tree/BudgetSummaryFooter';
import { PartidaTreeTable } from '../../shared/tree/PartidaTreeTable';
import { TreeToolbar } from '../../shared/tree/TreeToolbar';
import { useValorizacionStore } from '../../store/ValorizacionStoreProvider';
import { fmtMoney, fmtPct } from '../../utils/format';
import { ImportPresupuestoButton } from './ImportPresupuestoButton';
import type { ImportSummary } from './ImportPresupuestoButton';
import { presupuestoColumns } from './presupuestoColumns';

function Kpi({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'strong' }) {
    return (
        <div className={tone === 'strong' ? 'rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10' : 'rounded-lg border border-stone-200 bg-white px-3 py-2 dark:border-stone-800 dark:bg-stone-900'}>
            <p className="text-[11px] leading-relaxed font-semibold tracking-wide text-stone-600 uppercase dark:text-stone-300">{label}</p>
            <p className="mt-1 font-mono text-sm leading-relaxed font-semibold text-stone-900 tabular-nums wrap-break-word dark:text-stone-100">{value}</p>
        </div>
    );
}

const iconButton = 'rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-800 dark:hover:bg-stone-800 dark:hover:text-stone-100';
const secondaryButton =
    'inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:border-orange-400 hover:text-orange-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200';

/** Hoja PRESUPUESTO — árbol de partidas editable (clic derecho), importación desde Excel y pie presupuestal. */
export default function PresupuestoSheet() {
    const { parametros, fuente, calculado } = usePresupuesto();
    const contrato = useValorizacionStore((state) => state.input.fichaTecnica.contratista.contrato);
    const tree = usePartidaTree(calculado.tree);
    const [editing, setEditing] = useState(false);
    const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
    const menu = usePartidaContextMenu({
        onCreated: (id) => {
            tree.reveal(id);
            setEditing(true);
        },
    });
    const dirty = useValorizacionStore((state) => state.history.past.length > 0);
    const { totales, diferenciaContrato, tree: { issues } } = calculado;
    const cuadra = diferenciaContrato?.isZero() ?? false;
    const importCdOk = importSummary?.excel.costoDirecto ? totales.costoDirecto.eq(D(importSummary.excel.costoDirecto)) : null;

    const { actions } = menu;

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="min-w-0">
                    <h2 className="text-lg font-bold text-stone-900 sm:text-xl dark:text-stone-50">Presupuesto de obra</h2>
                    <p className="truncate text-xs text-stone-500 sm:text-sm dark:text-stone-400">{contrato} · {calculado.partidasCount} partidas</p>
                </div>
                {diferenciaContrato && (
                    <span className={cuadra ? 'inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 dark:text-stone-300' : 'inline-flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-300'}>
                        {cuadra ? <CheckCircle2 className="size-4 text-orange-600" /> : <AlertTriangle className="size-4" />}
                        {cuadra ? 'El total cuadra con el contrato vigente' : `Diferencia con el contrato vigente: ${fmtMoney(diferenciaContrato)}`}
                    </span>
                )}
            </div>

            {fuente === 'ejemplo-parcial' && (
                <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <p><strong>Presupuesto de ejemplo incompleto.</strong> Usa “Importar Excel” para cargar el presupuesto completo del expediente.</p>
                </div>
            )}

            {importSummary && (
                <div className={cn('rounded-lg border px-4 py-3 text-sm', importSummary.partidas.length > 0 ? 'border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200')}>
                    <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1 space-y-1">
                            <p className="font-medium text-stone-900 dark:text-stone-100">
                                {importSummary.partidas.length > 0
                                    ? `Importado “${importSummary.fileName}” · hoja ${importSummary.sheetName} · ${importSummary.partidas.length} filas`
                                    : `No se importó “${importSummary.fileName}”`}
                            </p>
                            {importCdOk !== null && (
                                <p className={importCdOk ? 'text-xs text-stone-600 dark:text-stone-300' : 'text-xs text-red-700 dark:text-red-300'}>
                                    Costo directo del Excel {fmtMoney(importSummary.excel.costoDirecto)} · calculado {fmtMoney(totales.costoDirecto)} {importCdOk ? '✓ cuadra' : '✗ no cuadra'}
                                </p>
                            )}
                            {importSummary.warnings.length > 0 && (
                                <ul className="list-disc pl-5 text-xs text-stone-600 dark:text-stone-400">
                                    {importSummary.warnings.map((warning) => (
                                        <li key={warning}>{warning}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <button type="button" className={iconButton} aria-label="Cerrar resumen de importación" onClick={() => setImportSummary(null)}>
                            <X className="size-4" />
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-2 @min-[28rem]:grid-cols-2 @min-[48rem]:grid-cols-3 @min-[80rem]:grid-cols-6">
                <Kpi label="Costo directo" value={fmtMoney(totales.costoDirecto)} />
                <Kpi label={`Gastos generales ${fmtPct(parametros.gastosGenerales)}`} value={fmtMoney(totales.gastosGenerales)} />
                <Kpi label={`Utilidad ${fmtPct(parametros.utilidad)}`} value={fmtMoney(totales.utilidad)} />
                <Kpi label="Sub total" value={fmtMoney(totales.subTotal)} />
                <Kpi label={`IGV ${fmtPct(parametros.igv)}`} value={fmtMoney(totales.igv)} />
                <Kpi label="Total presupuesto" value={fmtMoney(totales.total)} tone="strong" />
            </div>

            {issues.length > 0 && (
                <details className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm dark:border-stone-800 dark:bg-stone-900">
                    <summary className="cursor-pointer font-medium text-stone-700 dark:text-stone-200">
                        <Chip tone="orange">{issues.length}</Chip> <span className="ml-1">observaciones por corregir</span>
                    </summary>
                    <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-stone-600 dark:text-stone-400">
                        {issues.map((issue) => (
                            <li key={issue}>{issue}</li>
                        ))}
                    </ul>
                </details>
            )}

            <TreeToolbar state={tree}>
                <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
                    <span className="hidden items-center gap-1 text-[11px] text-stone-400 xl:inline-flex">
                        <MousePointerClick className="size-3.5" /> Clic derecho sobre una fila para agregar, mover o eliminar
                    </span>
                    {dirty && <Chip tone="amber" title="La persistencia llega en la Fase 8: al recargar la página se pierden los cambios.">Sin guardar</Chip>}
                    <button type="button" onClick={actions.addRoot} className={secondaryButton}>
                        <FolderPlus className="size-3.5" /> Componente
                    </button>
                    <ImportPresupuestoButton
                        onImported={setImportSummary}
                    />
                    <button
                        type="button"
                        onClick={() => setEditing((value) => !value)}
                        aria-pressed={editing}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold',
                            editing ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-stone-900 text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900',
                        )}
                    >
                        <Pencil className="size-3.5" /> {editing ? 'Terminar edición' : 'Editar celdas'}
                    </button>
                </div>
            </TreeToolbar>

            <PartidaTreeTable
                caption="Presupuesto de obra"
                rows={calculado.filas}
                columns={presupuestoColumns(editing, actions.update)}
                state={tree}
                activeId={menu.activeId}
                onRowContextMenu={menu.onRowContextMenu}
                renderDescripcion={
                    editing
                        ? (row) => (
                              <EditableCell
                                  label={`Descripción ${row.node.codigo}`}
                                  value={row.node.descripcion}
                                  className={cn(!row.node.esHoja && 'font-semibold')}
                                  onCommit={(descripcion) => descripcion && actions.update(row.node, { descripcion })}
                              />
                          )
                        : undefined
                }
                rowActions={menu.rowActions}
                footer={<BudgetSummaryFooter labelColSpan={5} parametros={parametros} cells={[totales, null, null]} />}
            />

            {menu.element}
        </div>
    );
}
