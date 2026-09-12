import { router } from '@inertiajs/react';
import { AlertTriangle, ChevronDown, ChevronRight, Download, Loader2, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { money } from '../shared/format';
import MoAddRowDialog from './MoAddRowDialog';
import MoDescriptionCell from './MoDescriptionCell';
import MoImportDialog from './MoImportDialog';
import MoNumberCell from './MoNumberCell';
import MoTextCell from './MoTextCell';
import MoUnitSelect from './MoUnitSelect';
import { moApi, type NewPartida } from './moApi';
import PartidaContextMenu from './PartidaContextMenu';
import type { MoPayload, MoResponse, MoRow } from './types';

interface Props {
    projectId: number;
    documentId: string;
    initial: MoPayload;
    imported: boolean;
    presupuestoDisponible: boolean;
    onRevision: (revision: number) => void;
}

// Final y Saldo (el resultado de la fila) quedan congelados a la derecha: los Parciales P.M.O.
// son un N que crece sin límite (un pago más = una columna más), así que el scroll horizontal
// recorre solo esa zona dinámica mientras el resultado queda siempre a la vista — mismo patrón
// que GgSheet con Total pagado/Saldo.
const FINAL_WIDTH = 108;
const SALDO_WIDTH = 108;
const finalStyle: React.CSSProperties = { position: 'sticky', right: SALDO_WIDTH, width: FINAL_WIDTH, minWidth: FINAL_WIDTH };
const saldoStyle: React.CSSProperties = { position: 'sticky', right: 0, width: SALDO_WIDTH, minWidth: SALDO_WIDTH };

export default function MoSheet({ projectId, documentId, initial, imported, onRevision }: Props) {
    const [payload, setPayload] = useState<MoPayload>(initial);
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState(false);
    const [dialog, setDialog] = useState<'import' | 'add' | null>(null);
    const [addDefaults, setAddDefaults] = useState<{ parentId: string | null; tipo: 'ie' | 'bloque' | 'partida' } | null>(null);
    const [menu, setMenu] = useState<{ x: number; y: number; row: MoRow } | null>(null);

    const apply = (res: MoResponse) => {
        setPayload(res.mo);
        onRevision(res.revision);
    };

    const run = async (task: () => Promise<MoResponse>) => {
        setBusy(true);
        try {
            apply(await task());
        } catch (error) {
            const data = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data;
            window.alert(data?.message ?? Object.values(data?.errors ?? {})[0]?.[0] ?? 'No se pudo guardar el cambio.');
        } finally {
            setBusy(false);
        }
    };

    const patch = (partidaId: string, field: string, value: string | null) =>
        run(() => moApi.updatePartida(projectId, documentId, partidaId, { [field]: value }));

    const duplicateScenario = async () => {
        const nombre = window.prompt('Nombre del escenario (p. ej. "MO 1.")')?.trim();
        if (!nombre) return;
        setBusy(true);
        try {
            const created = await moApi.addScenario(projectId, documentId, nombre, payload.scenario.id);
            apply(await moApi.activateScenario(projectId, documentId, created.scenario.id));
        } finally {
            setBusy(false);
        }
    };

    const parentOf = useMemo(() => {
        const map = new Map<string, string | null>();
        payload.rows.forEach((row) => map.set(row.partida_id, row.parent_id));
        return map;
    }, [payload.rows]);

    const isHidden = (row: MoRow): boolean => {
        let cursor = row.parent_id;
        while (cursor) {
            if (collapsed.has(cursor)) return true;
            cursor = parentOf.get(cursor) ?? null;
        }
        return false;
    };

    const hasChildren = useMemo(() => {
        const set = new Set<string>();
        payload.rows.forEach((row) => row.parent_id && set.add(row.parent_id));
        return set;
    }, [payload.rows]);

    const toggle = (id: string) =>
        setCollapsed((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    const deleteRow = (row: MoRow) => {
        if (window.confirm(`¿Eliminar "${row.descripcion}"?`)) void run(() => moApi.deletePartida(projectId, documentId, row.partida_id));
    };

    const openAddDialog = (defaults: { parentId: string | null; tipo: 'ie' | 'bloque' | 'partida' } | null) => {
        setAddDefaults(defaults);
        setDialog('add');
    };

    // Presupuesto/Saldo son un único valor por institución (la bolsa de la que se van
    // descontando los P.M.O de todas sus partidas), así que se muestran una sola vez con
    // rowSpan cubriendo todas las filas visibles de esa institución.
    const institucionIdOf = useMemo(() => {
        const map = new Map<string, string>();
        const resolve = (id: string): string => {
            const cached = map.get(id);
            if (cached) return cached;
            const parent = parentOf.get(id);
            const result = parent ? resolve(parent) : id;
            map.set(id, result);
            return result;
        };
        payload.rows.forEach((row) => resolve(row.partida_id));
        return map;
    }, [payload.rows, parentOf]);

    const series = payload.series;
    const totalCols = 3 + 3 + 3 + 1 + series.length + 2;

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
                <div className="flex items-center gap-1">
                    {payload.scenarios.map((scenario) => (
                        <button
                            key={scenario.id}
                            type="button"
                            onClick={() => scenario.id !== payload.scenario.id && run(() => moApi.activateScenario(projectId, documentId, scenario.id))}
                            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                                scenario.id === payload.scenario.id
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                        >
                            {scenario.nombre}
                        </button>
                    ))}
                    <button type="button" onClick={() => void duplicateScenario()} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800" title="Duplicar escenario">
                        <Plus size={14} />
                    </button>
                </div>
                <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
                <button type="button" onClick={() => void run(() => moApi.addSeries(projectId, documentId, null, null))} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                    <Plus size={13} /> Parcial P.M.O
                </button>
                <button type="button" onClick={() => openAddDialog(null)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                    <Plus size={13} /> Agregar fila
                </button>
                <button type="button" onClick={() => setDialog('import')} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                    <Download size={13} /> {imported ? 'Actualizar desde Presupuesto' : 'Importar desde Presupuesto'}
                </button>
                {busy && <Loader2 size={14} className="animate-spin text-blue-500" />}
            </div>

            {!payload.totales.cuadra && payload.rows.length > 0 && (
                <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                    <AlertTriangle size={13} />
                    {payload.totales.descuadres} partida(s) sin cuadrar · Saldo total <b>{money(payload.totales.general.saldo)}</b> (FINAL debe igualar al Presupuesto)
                </div>
            )}

            {dialog === 'add' && (
                <MoAddRowDialog
                    rows={payload.rows}
                    initialParentId={addDefaults?.parentId}
                    initialTipo={addDefaults?.tipo}
                    onClose={() => setDialog(null)}
                    onSubmit={async (data: NewPartida) => {
                        apply(await moApi.addPartida(projectId, documentId, data));
                    }}
                />
            )}
            {dialog === 'import' && (
                <MoImportDialog projectId={projectId} documentId={documentId} onClose={() => setDialog(null)} onImported={() => router.reload()} />
            )}
            {menu && (
                <PartidaContextMenu
                    x={menu.x}
                    y={menu.y}
                    onClose={() => setMenu(null)}
                    onAddChild={() => openAddDialog({ parentId: menu.row.partida_id, tipo: menu.row.tipo === 'ie' ? 'bloque' : 'partida' })}
                    onAddSibling={() => openAddDialog({ parentId: menu.row.parent_id, tipo: menu.row.tipo })}
                    onDelete={() => deleteRow(menu.row)}
                />
            )}

            <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full border-separate border-spacing-0 text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                        <tr className="[&>th]:border-b [&>th]:border-slate-200 [&>th]:px-2 [&>th]:py-2 [&>th]:text-left [&>th]:font-semibold dark:[&>th]:border-slate-700">
                            <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-900">Ítem</th>
                            <th className="min-w-55">Descripción</th>
                            <th>Und</th>
                            <th className="bg-rose-50 text-right dark:bg-rose-950/30" colSpan={3}>MO Expediente Técnico</th>
                            <th className="bg-emerald-50 text-right dark:bg-emerald-950/30" colSpan={3}>MO Cotizado</th>
                            <th className="min-w-24 text-right">Presup.</th>
                            {series.map((serie) => (
                                <th key={serie.id} className="min-w-24 text-right align-top">
                                    <div className="flex items-start justify-end gap-1">
                                        <div className="flex flex-col items-end">
                                            <MoTextCell
                                                value={serie.etiqueta ?? `P.M.O ${serie.indice}`}
                                                editable
                                                className="w-24 text-right text-xs font-semibold"
                                                onCommit={(v) => void run(() => moApi.updateSeries(projectId, documentId, serie.id, { etiqueta: v || null }))}
                                            />
                                            <input
                                                type="date"
                                                defaultValue={serie.fecha ?? ''}
                                                onChange={(e) => void run(() => moApi.updateSeries(projectId, documentId, serie.id, { fecha: e.target.value || null }))}
                                                className="w-24 bg-transparent text-right text-[10px] font-normal text-slate-400 outline-none"
                                            />
                                        </div>
                                        <button type="button" onClick={() => void run(() => moApi.deleteSeries(projectId, documentId, serie.id))} className="mt-0.5 text-slate-300 hover:text-rose-500">
                                            <Trash2 size={11} />
                                        </button>
                                    </div>
                                </th>
                            ))}
                            <th className="z-20 bg-slate-50 text-right dark:bg-slate-900" style={finalStyle}>Final</th>
                            <th className="z-20 bg-slate-50 text-right dark:bg-slate-900" style={saldoStyle}>Saldo</th>
                        </tr>
                        <tr className="[&>th]:border-b [&>th]:border-slate-200 [&>th]:px-2 [&>th]:py-1 [&>th]:text-right [&>th]:font-medium dark:[&>th]:border-slate-700">
                            <th className="sticky left-0 bg-slate-50 dark:bg-slate-900" />
                            <th /><th />
                            <th className="min-w-16">Cant.</th><th className="min-w-20">P.U.</th><th>Parcial</th>
                            <th className="min-w-16">Cant.</th><th className="min-w-20">P.U.</th><th>Parcial</th>
                            <th />
                            {series.map((serie) => <th key={serie.id}>Monto</th>)}
                            <th className="z-20 bg-slate-50 dark:bg-slate-900" style={finalStyle}>=Σ P.M.O</th>
                            <th className="z-20 bg-slate-50 dark:bg-slate-900" style={saldoStyle}>Presup−Final</th>
                        </tr>
                    </thead>
                    <tbody>
                        {payload.rows.length === 0 && (
                            <tr>
                                <td colSpan={totalCols} className="px-4 py-10 text-center text-sm text-slate-400">
                                    Sin partidas todavía. Usa <b>Importar desde Presupuesto</b> o <b>Agregar fila</b> para construir la estructura.
                                </td>
                            </tr>
                        )}
                        {(() => {
                            const visibleRows = payload.rows.filter((row) => !isHidden(row));
                            const spanFrom = (startIndex: number): number => {
                                const rootId = institucionIdOf.get(visibleRows[startIndex].partida_id);
                                let span = 1;
                                while (startIndex + span < visibleRows.length && institucionIdOf.get(visibleRows[startIndex + span].partida_id) === rootId) {
                                    span++;
                                }
                                return span;
                            };

                            return visibleRows.map((row, index) => {
                                const del = (
                                    <button
                                        type="button"
                                        onClick={() => deleteRow(row)}
                                        className="opacity-0 transition group-hover:opacity-100 hover:text-rose-500"
                                        aria-label="Eliminar fila"
                                    >
                                        <Trash2 size={11} />
                                    </button>
                                );
                                const onContextMenu = (event: React.MouseEvent) => {
                                    event.preventDefault();
                                    setMenu({ x: event.clientX, y: event.clientY, row });
                                };

                                if (row.tipo === 'ie') {
                                    const span = spanFrom(index);
                                    return (
                                        <tr key={row.partida_id} onContextMenu={onContextMenu} className="group bg-slate-800 text-white dark:bg-slate-950">
                                            <td className="sticky left-0 bg-slate-800 px-2 py-1.5 dark:bg-slate-950">
                                                <button type="button" onClick={() => toggle(row.partida_id)} className="align-middle">
                                                    {collapsed.has(row.partida_id) ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                                                </button>
                                            </td>
                                            <td className="py-1.5 pr-2 font-semibold" colSpan={8}>
                                                <span className="flex items-start gap-2">
                                                    <MoDescriptionCell value={row.descripcion} editable className="font-semibold text-white" onCommit={(v) => void patch(row.partida_id, 'descripcion', v)} />
                                                    {del}
                                                </span>
                                            </td>
                                            <td rowSpan={span} className="border-l border-slate-700 bg-slate-800/60 p-0 align-middle dark:bg-slate-900">
                                                <MoNumberCell value={row.presupuesto ?? ''} muted={row.presupuesto_source === 'sugerido'} editable onCommit={(v) => void patch(row.partida_id, 'presupuesto', v)} />
                                            </td>
                                            {series.length > 0 && <td colSpan={series.length} />}
                                            <td className="bg-slate-800 px-2 text-right font-semibold tabular-nums dark:bg-slate-950" style={finalStyle}>{money(row.final)}</td>
                                            <td
                                                rowSpan={span}
                                                className={`border-l border-slate-700 px-2 text-right align-middle font-semibold tabular-nums ${
                                                    row.descuadra ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800/60 dark:bg-slate-900'
                                                }`}
                                                style={saldoStyle}
                                            >
                                                {money(row.saldo ?? '0')}
                                            </td>
                                        </tr>
                                    );
                                }

                                const isBloque = row.tipo === 'bloque';
                                const rowClass = isBloque
                                    ? 'bg-orange-50 font-semibold text-orange-900 dark:bg-orange-950/30 dark:text-orange-200'
                                    : 'odd:bg-white even:bg-slate-50/60 dark:odd:bg-slate-900 dark:even:bg-slate-900/50';
                                const partidaEditable = row.tipo === 'partida';

                                return (
                                    <tr key={row.partida_id} onContextMenu={onContextMenu} className={`group ${rowClass} [&>td]:border-b [&>td]:border-slate-100 dark:[&>td]:border-slate-800`}>
                                        <td className={`sticky left-0 px-1 py-0 ${isBloque ? 'bg-orange-50 dark:bg-orange-950/30' : 'bg-inherit'}`} style={{ paddingLeft: `${row.nivel * 12}px` }}>
                                            <span className="flex items-center gap-1">
                                                {hasChildren.has(row.partida_id) ? (
                                                    <button type="button" onClick={() => toggle(row.partida_id)}>
                                                        {collapsed.has(row.partida_id) ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                                                    </button>
                                                ) : (
                                                    <span className="w-3" />
                                                )}
                                                <MoTextCell value={row.item ?? ''} editable className="w-16 text-xs" onCommit={(v) => void patch(row.partida_id, 'item', v || null)} />
                                                {del}
                                            </span>
                                        </td>
                                        <td className="p-0"><MoDescriptionCell value={row.descripcion} editable onCommit={(v) => void patch(row.partida_id, 'descripcion', v)} /></td>
                                        <td className="p-0"><MoUnitSelect value={row.unidad ?? ''} editable onCommit={(v) => void patch(row.partida_id, 'unidad', v)} /></td>

                                        <td className="p-0"><MoNumberCell value={row.et.cantidad ?? ''} editable={partidaEditable} muted onCommit={(v) => void patch(row.partida_id, 'metrado', v ?? '0')} /></td>
                                        <td className="p-0"><MoNumberCell value={row.et.precio ?? ''} editable={partidaEditable} muted decimals={3} onCommit={(v) => void patch(row.partida_id, 'mo_pu', v ?? '0')} /></td>
                                        <td className="px-2 text-right tabular-nums text-rose-700 dark:text-rose-300">{money(row.et.parcial)}</td>

                                        <td className="p-0"><MoNumberCell value={row.cot.cantidad ?? ''} editable={row.editable.cot} onCommit={(v) => void patch(row.partida_id, 'cot_cantidad', v)} /></td>
                                        <td className="p-0"><MoNumberCell value={row.cot.precio ?? ''} editable={row.editable.cot} decimals={3} onCommit={(v) => void patch(row.partida_id, 'cot_precio', v)} /></td>
                                        <td className="px-2 text-right tabular-nums text-emerald-700 dark:text-emerald-300">{money(row.cot.parcial)}</td>

                                        {series.map((serie) => (
                                            <td key={serie.id} className="p-0">
                                                <MoNumberCell value={row.parciales[serie.id] ?? '0.00'} editable onCommit={(v) => void run(() => moApi.setParcial(projectId, documentId, serie.id, row.partida_id, v))} />
                                            </td>
                                        ))}

                                        <td className="bg-inherit px-2 text-right font-semibold tabular-nums" style={finalStyle}>{money(row.final)}</td>
                                    </tr>
                                );
                            });
                        })()}

                        {payload.rows.length > 0 && (
                            <tr className="sticky bottom-0 bg-slate-100 font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-100 [&>td]:px-2 [&>td]:py-1.5">
                                <td className="sticky left-0 bg-slate-100 dark:bg-slate-800" />
                                <td colSpan={2}>TOTAL</td>
                                <td colSpan={2} />
                                <td className="text-right tabular-nums">{money(payload.totales.general.et_parcial)}</td>
                                <td colSpan={2} />
                                <td className="text-right tabular-nums">{money(payload.totales.general.cot_parcial)}</td>
                                <td className="text-right tabular-nums">{money(payload.totales.general.presupuesto)}</td>
                                {series.map((serie) => (
                                    <td key={serie.id} className="text-right tabular-nums">{money(payload.totales.por_serie[serie.id] ?? '0.00')}</td>
                                ))}
                                <td className="bg-slate-100 text-right tabular-nums dark:bg-slate-800" style={finalStyle}>{money(payload.totales.general.final)}</td>
                                <td
                                    className={`bg-slate-100 text-right tabular-nums dark:bg-slate-800 ${payload.totales.cuadra ? '' : 'text-amber-700 dark:text-amber-300'}`}
                                    style={saldoStyle}
                                >
                                    {money(payload.totales.general.saldo)}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
