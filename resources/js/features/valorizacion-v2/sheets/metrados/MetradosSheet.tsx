import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { readMetradosExcel } from '../../data/importers/readCalendarioExcel';
import { useMetrados } from '../../hooks/useMetrados';
import { usePartidaContextMenu } from '../../hooks/usePartidaContextMenu';
import { usePartidaTree } from '../../hooks/usePartidaTree';
import { parseMontoOPorcentaje } from '../../lib/money';
import { EditableCell } from '../../shared/EditableCell';
import { ExcelFileButton } from '../../shared/ExcelFileButton';
import { ImportSummaryPanel } from '../../shared/ImportSummaryPanel';
import type { ImportSummaryData } from '../../shared/ImportSummaryPanel';
import { IssuesPanel } from '../../shared/IssuesPanel';
import { PartidaTreeTable } from '../../shared/tree/PartidaTreeTable';
import type { TreeColumn } from '../../shared/tree/PartidaTreeTable';
import { TreeToolbar } from '../../shared/tree/TreeToolbar';
import { useValorizacionStore } from '../../store/ValorizacionStoreProvider';
import { fmtNumber, fmtPct } from '../../utils/format';
import type { MetradoFila } from './computeMetrados';

const num = 'font-mono tabular-nums';

const estadoClass = (fila: MetradoFila): string =>
    fila.estado === 'excedido' ? 'text-red-600 dark:text-red-400' : fila.estado === 'completo' ? 'text-orange-700 dark:text-orange-300' : 'text-stone-600 dark:text-stone-300';

/** Hoja METRADOS — metrado ejecutado por mes (único dato de avance), acumulado y saldo por metrar. */
export default function MetradosSheet() {
    const { calculado, presupuesto, periodos, mesValorizacion } = useMetrados();
    const partidas = useValorizacionStore((state) => state.input.presupuesto.partidas);
    const setMetrado = useValorizacionStore((state) => state.setMetrado);
    const replaceMetrados = useValorizacionStore((state) => state.replaceMetrados);
    const tree = usePartidaTree(presupuesto.tree);
    const menu = usePartidaContextMenu({ onCreated: tree.reveal });
    const [editing, setEditing] = useState(false);
    const [importSummary, setImportSummary] = useState<ImportSummaryData | null>(null);
    const completas = calculado.filas.filter((fila) => fila.estado === 'completo').length;
    const enCurso = calculado.filas.filter((fila) => fila.estado === 'en-curso').length;
    const hojas = calculado.filas.filter((fila) => fila.node.esHoja).length;

    const onFile = async (data: ArrayBuffer, fileName: string) => {
        const result = await readMetradosExcel(data, partidas);
        const ok = result.enlazadas > 0;
        if (ok && window.confirm(`Se leyeron metrados de ${result.enlazadas} partidas en la hoja "${result.sheetName}". ¿Reemplazar los metrados ejecutados? Puedes deshacerlo con Ctrl+Z.`)) {
            replaceMetrados(result.data);
        }
        setImportSummary({
            ok,
            title: ok ? `“${fileName}” · hoja ${result.sheetName} · ${result.enlazadas} partidas · meses ${result.meses.join(', ')}` : `No se importó “${fileName}”`,
            warnings: result.warnings,
        });
    };

    const columns: TreeColumn<MetradoFila>[] = [
        { id: 'und', header: 'Und', group: 'Contratado', align: 'center', cell: (fila) => fila.node.unidad ?? '' },
        { id: 'contratado', header: 'Metrado', group: 'Contratado', className: num, cell: (fila) => fmtNumber(fila.contratado) },
        ...periodos.map((periodo): TreeColumn<MetradoFila> => {
            const actual = periodo.key === mesValorizacion;

            return {
                id: periodo.key,
                header: `${periodo.label}${actual ? ' ★' : ''}`,
                group: 'Metrado ejecutado',
                className: cn(num, editing && 'w-24', actual && 'bg-orange-50/50 dark:bg-orange-500/5'),
                cell: (fila) => {
                    if (editing && fila.node.esHoja) {
                        return (
                            <EditableCell
                                label={`Metrado ${periodo.label} ${fila.node.codigo}`}
                                kind="number"
                                align="right"
                                title="Metrado (0.48) o porcentaje del contratado (24%)"
                                value={fila.meses[periodo.key]?.toString() ?? null}
                                parse={(raw) => parseMontoOPorcentaje(raw, fila.contratado ?? 0)}
                                onCommit={(value) => setMetrado(fila.node.id, periodo.key, value)}
                            />
                        );
                    }

                    return fmtNumber(fila.meses[periodo.key]);
                },
            };
        }),
        { id: 'acumulado', header: 'Acumulado', group: 'Control', className: num, cell: (fila) => (fila.node.esHoja && fila.estado !== 'sin-avance' ? fmtNumber(fila.acumulado) : '') },
        {
            id: 'saldo',
            header: 'Saldo por metrar',
            group: 'Control',
            className: num,
            cell: (fila) => (fila.node.esHoja ? <span className={estadoClass(fila)}>{fila.saldo.isZero() ? '—' : fmtNumber(fila.saldo)}</span> : ''),
        },
        {
            id: 'avance',
            header: '% Avance',
            group: 'Control',
            className: num,
            cell: (fila) => (fila.node.esHoja && fila.estado !== 'sin-avance' ? <span className={estadoClass(fila)}>{fmtPct(fila.avance)}</span> : ''),
        },
    ];

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="min-w-0">
                    <h2 className="text-lg font-bold text-stone-900 sm:text-xl dark:text-stone-50">Metrados ejecutados</h2>
                    <p className="text-xs text-stone-500 sm:text-sm dark:text-stone-400">
                        Único dato de avance: el calendario ejecutado y la valorización mensual se calculan desde aquí.
                    </p>
                </div>
                <p className="text-xs text-stone-500">
                    <span className="font-semibold text-orange-700 dark:text-orange-300">{completas}</span> completas · <span className="font-semibold text-stone-800 dark:text-stone-200">{enCurso}</span> en curso · {hojas - completas - enCurso} sin avance
                </p>
            </div>

            {importSummary && <ImportSummaryPanel summary={importSummary} onClose={() => setImportSummary(null)} />}
            <IssuesPanel issues={calculado.issues} />

            <TreeToolbar state={tree}>
                <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
                    <ExcelFileButton onFile={onFile} />
                    <button
                        type="button"
                        onClick={() => setEditing((value) => !value)}
                        aria-pressed={editing}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold',
                            editing ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-stone-900 text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900',
                        )}
                    >
                        <Pencil className="size-3.5" /> {editing ? 'Terminar edición' : 'Editar metrados'}
                    </button>
                </div>
            </TreeToolbar>

            <PartidaTreeTable
                caption="Metrados ejecutados"
                rows={calculado.filas}
                columns={columns}
                state={tree}
                activeId={menu.activeId}
                onRowContextMenu={menu.onRowContextMenu}
                rowActions={menu.rowActions}
            />
            {menu.element}
        </div>
    );
}
