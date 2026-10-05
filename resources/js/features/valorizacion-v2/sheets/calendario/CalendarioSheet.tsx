import { ArrowRight, CalendarRange, Info, Pencil } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { readCalendarioProgramadoExcel } from '../../data/importers/readCalendarioExcel';
import { useCalendario } from '../../hooks/useCalendario';
import { usePartidaContextMenu } from '../../hooks/usePartidaContextMenu';
import { usePartidaTree } from '../../hooks/usePartidaTree';
import { ExcelFileButton } from '../../shared/ExcelFileButton';
import { ImportSummaryPanel } from '../../shared/ImportSummaryPanel';
import type { ImportSummaryData } from '../../shared/ImportSummaryPanel';
import { IssuesPanel } from '../../shared/IssuesPanel';
import { MesesResumen } from '../../shared/MesesResumen';
import { BudgetSummaryFooter } from '../../shared/tree/BudgetSummaryFooter';
import { PartidaTreeTable } from '../../shared/tree/PartidaTreeTable';
import { TreeToolbar } from '../../shared/tree/TreeToolbar';
import { useValorizacionStore } from '../../store/ValorizacionStoreProvider';
import type { TipoCalendario } from '../../types';
import { fmtPct } from '../../utils/format';
import { calendarioColumns } from './calendarioColumns';

const TITULOS: Record<TipoCalendario, { titulo: string; descripcion: string }> = {
    programado: {
        titulo: 'Calendario valorizado programado',
        descripcion: 'Distribución mensual del presupuesto adecuada al inicio de la obra. Cada partida debe sumar 100 %.',
    },
    ejecutado: {
        titulo: 'Calendario valorizado ejecutado',
        descripcion: 'Montos ejecutados por mes = metrado ejecutado × precio unitario. Ninguna partida debe superar su presupuesto.',
    },
};

/** Hojas CALEN. PROG. (se ingresa) y CALEN. VALO. (se deriva de METRADOS). */
export function CalendarioSheet({ tipo }: { tipo: TipoCalendario }) {
    const { calculado, presupuesto, parametros, mesValorizacion } = useCalendario(tipo);
    const partidas = useValorizacionStore((state) => state.input.presupuesto.partidas);
    const setMontoProgramado = useValorizacionStore((state) => state.setMontoProgramado);
    const replaceCalendarioProgramado = useValorizacionStore((state) => state.replaceCalendarioProgramado);
    const tree = usePartidaTree(presupuesto.tree);
    const menu = usePartidaContextMenu({ onCreated: tree.reveal });
    const [editing, setEditing] = useState(false);
    const [showPct, setShowPct] = useState(true);
    const [importSummary, setImportSummary] = useState<ImportSummaryData | null>(null);
    const { periodos, meses, issues } = calculado;
    const editable = tipo === 'programado';

    const onFile = async (data: ArrayBuffer, fileName: string) => {
        const result = await readCalendarioProgramadoExcel(data, partidas);
        const ok = result.enlazadas > 0;
        if (ok && window.confirm(`Se leyeron montos de ${result.enlazadas} partidas en la hoja "${result.sheetName}". ¿Reemplazar el calendario programado? Puedes deshacerlo con Ctrl+Z.`)) {
            replaceCalendarioProgramado(result.data);
        }
        setImportSummary({
            ok,
            title: ok ? `“${fileName}” · hoja ${result.sheetName} · ${result.enlazadas} partidas · meses ${result.meses.join(', ')}` : `No se importó “${fileName}”`,
            warnings: result.warnings,
        });
    };

    const monthCells = <T,>(value: (index: number) => T | null): Array<T | null> => meses.flatMap((_, index) => (showPct ? [null, value(index)] : [value(index)]));

    return (
        <div className="space-y-3">
            <div className="min-w-0">
                <h2 className="text-lg font-bold text-stone-900 sm:text-xl dark:text-stone-50">{TITULOS[tipo].titulo}</h2>
                <p className="text-xs text-stone-500 sm:text-sm dark:text-stone-400">{TITULOS[tipo].descripcion}</p>
            </div>

            {!editable && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
                    <Info className="size-4 shrink-0 text-orange-600" />
                    <p className="flex-1">Esta hoja se calcula sola desde los metrados ejecutados. Para cambiar un monto, edita el metrado del mes.</p>
                    <a href="#metrados" className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 hover:underline dark:text-orange-300">
                        Ir a Metrados <ArrowRight className="size-3.5" />
                    </a>
                </div>
            )}

            {importSummary && <ImportSummaryPanel summary={importSummary} onClose={() => setImportSummary(null)} />}

            <MesesResumen meses={meses} mesValorizacion={mesValorizacion} />

            <IssuesPanel issues={issues} />

            <TreeToolbar state={tree}>
                <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
                    <button
                        type="button"
                        onClick={() => setShowPct((value) => !value)}
                        aria-pressed={showPct}
                        className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:border-orange-400 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
                    >
                        <CalendarRange className="size-3.5" /> {showPct ? 'Ocultar %' : 'Mostrar %'}
                    </button>
                    {editable && <ExcelFileButton onFile={onFile} />}
                    {editable && (
                        <button
                            type="button"
                            onClick={() => setEditing((value) => !value)}
                            aria-pressed={editing}
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold',
                                editing ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-stone-900 text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900',
                            )}
                        >
                            <Pencil className="size-3.5" /> {editing ? 'Terminar edición' : 'Editar montos'}
                        </button>
                    )}
                </div>
            </TreeToolbar>

            <PartidaTreeTable
                caption={TITULOS[tipo].titulo}
                rows={calculado.filas}
                columns={calendarioColumns({
                    tipo,
                    periodos,
                    mesValorizacion,
                    editing: editable && editing,
                    showPct,
                    onMonto: (fila, mes, monto) => setMontoProgramado(fila.node.id, mes, monto),
                })}
                state={tree}
                activeId={menu.activeId}
                onRowContextMenu={menu.onRowContextMenu}
                rowActions={menu.rowActions}
                footer={
                    <BudgetSummaryFooter
                        labelColSpan={2}
                        parametros={parametros}
                        cells={[presupuesto.totales, ...monthCells((index) => meses[index].totales), null, null, null]}
                        totalLabel="Monto valorizado mensual"
                        showPeso
                        pesoLabel="Avance mensual"
                        extraRows={[{ label: 'Avance acumulado', cells: [null, ...monthCells((index) => fmtPct(meses[index].acumulado)), null, null, null] }]}
                    />
                }
            />
            {menu.element}
        </div>
    );
}
