import { AlertTriangle, ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, Plus, Trash2 } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import MoAddRowDialog from '../mo/MoAddRowDialog';
import MoDescriptionCell from '../mo/MoDescriptionCell';
import MoNumberCell from '../mo/MoNumberCell';
import MoTextCell from '../mo/MoTextCell';
import MoUnitSelect from '../mo/MoUnitSelect';
import { moApi, type NewPartida } from '../mo/moApi';
import PartidaContextMenu from '../mo/PartidaContextMenu';
import { money } from '../shared/format';
import MatMaterialContextMenu from './MatMaterialContextMenu';
import MatQuickAddPanel from './MatQuickAddPanel';
import { matApi } from './matApi';
import type { MatCompra, MatPayload, MatResponse, MatRow } from './types';

interface Props {
    projectId: number;
    documentId: string;
    initial: MatPayload;
    onRevision: (revision: number) => void;
}

// Línea divisoria de cada "recorte" (sección) de la hoja.
const DIVIDER = 'border-l-2 border-slate-300 dark:border-slate-700';
const COT_SLOTS = [1, 2, 3] as const;

// Total comprado / Saldo (el resultado de cada fila) quedan congelados a la derecha: las
// Compras son un N que crece sin límite, así que el scroll horizontal recorre solo esa zona
// dinámica mientras el resultado queda siempre a la vista — mismo patrón que GgSheet.
const TOTAL_COMPRADO_WIDTH = 112;
const MAT_SALDO_WIDTH = 104;
const totalCompradoStyle: React.CSSProperties = { position: 'sticky', right: MAT_SALDO_WIDTH, width: TOTAL_COMPRADO_WIDTH, minWidth: TOTAL_COMPRADO_WIDTH };
const matSaldoStyle: React.CSSProperties = { position: 'sticky', right: 0, width: MAT_SALDO_WIDTH, minWidth: MAT_SALDO_WIDTH };

function puMinimo(value: string | null | undefined): string {
    if (value == null) return '—';
    const n = Number(value);
    return Number.isNaN(n) ? value : n.toFixed(3);
}

export default function MatSheet({ projectId, documentId, initial, onRevision }: Props) {
    const [payload, setPayload] = useState<MatPayload>(initial);
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [collapsedCot, setCollapsedCot] = useState<Set<number>>(new Set());
    const [collapsedCompras, setCollapsedCompras] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState(false);
    const [dialog, setDialog] = useState<'fila' | null>(null);
    const [addDefaults, setAddDefaults] = useState<{ parentId: string | null; tipo: 'ie' | 'bloque' | 'partida' } | null>(null);
    const [menu, setMenu] = useState<{ x: number; y: number; row: MatRow } | null>(null);
    const [quickAddPartidaId, setQuickAddPartidaId] = useState<string | null>(null);
    const [materialMenu, setMaterialMenu] = useState<{ x: number; y: number; row: MatRow } | null>(null);

    const apply = (res: MatResponse) => {
        setPayload(res.mat);
        onRevision(res.revision);
    };

    const run = async (task: () => Promise<MatResponse>) => {
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

    // Cambios estructurales de partidas: usan los endpoints del árbol compartido (MO) y luego
    // refrescan solo el payload de MAT (evita el router.reload() de página completa, que era
    // notablemente lento: recargaba MO+MAT+GG+RESUMEN y re-renderizaba todo el Editor).
    const structural = async (task: () => Promise<unknown>) => {
        setBusy(true);
        try {
            await task();
            apply(await matApi.refresh(projectId, documentId));
        } catch (error) {
            const data = (error as { response?: { data?: { message?: string } } }).response?.data;
            window.alert(data?.message ?? 'No se pudo aplicar el cambio.');
        } finally {
            setBusy(false);
        }
    };

    const partidaOf = useMemo(() => {
        const byId = new Map<string, MatRow>();
        payload.rows.forEach((row) => { if (!row.es_material) byId.set(row.partida_id, row); });
        return byId;
    }, [payload.rows]);

    const materialsByPartida = useMemo(() => {
        const map = new Map<string, MatRow[]>();
        payload.rows.forEach((row) => {
            if (row.es_material) {
                const list = map.get(row.partida_id) ?? [];
                list.push(row);
                map.set(row.partida_id, list);
            }
        });
        return map;
    }, [payload.rows]);

    const isHidden = (parentId: string | null | undefined): boolean => {
        let cursor = parentId ?? null;
        while (cursor) {
            if (collapsed.has(cursor)) return true;
            cursor = partidaOf.get(cursor)?.parent_id ?? null;
        }
        return false;
    };

    const hasKids = useMemo(() => {
        const set = new Set<string>();
        payload.rows.forEach((row) => {
            if (row.es_material) set.add(row.partida_id);
            else if (row.parent_id) set.add(row.parent_id);
        });
        return set;
    }, [payload.rows]);

    const toggle = (id: string) =>
        setCollapsed((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    const toggleCot = (slot: number) =>
        setCollapsedCot((prev) => {
            const next = new Set(prev);
            next.has(slot) ? next.delete(slot) : next.add(slot);
            return next;
        });

    const deletePartidaRow = (row: MatRow) => {
        if (window.confirm(`¿Eliminar "${row.descripcion}" y todo su contenido?`)) void structural(() => moApi.deletePartida(projectId, documentId, row.partida_id));
    };

    const openAddDialog = (defaults: { parentId: string | null; tipo: 'ie' | 'bloque' | 'partida' } | null) => {
        setAddDefaults(defaults);
        setDialog('fila');
    };

    const toggleCompra = (id: string) =>
        setCollapsedCompras((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    // Guarda N materiales en secuencia; aplica solo la última respuesta (evita N re-renders)
    const addMaterialsBatch = async (
        partidaId: string,
        lines: Array<{ descripcion: string; unidad: string | null; cantidad: string | null; precio_unitario: string | null }>,
    ) => {
        setBusy(true);
        try {
            let res!: MatResponse;
            for (const line of lines) {
                res = await matApi.addMaterial(projectId, documentId, { partida_id: partidaId, ...line });
            }
            apply(res);
            setQuickAddPartidaId(null);
        } catch (error) {
            const data = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response?.data;
            window.alert(data?.message ?? Object.values(data?.errors ?? {})[0]?.[0] ?? 'No se pudo guardar el material.');
            throw error; // re-throw para que el panel no se cierre
        } finally {
            setBusy(false);
        }
    };

    const compras = payload.compras;
    const conc = payload.totales.conciliacion;

    // Cotización y Compra son columnas dinámicas/colapsables; el resto de la hoja es estático.
    const cotSpan = (slot: number) => (collapsedCot.has(slot) ? 1 : 4);
    const cotTotalSpan = COT_SLOTS.reduce((sum, s) => sum + cotSpan(s), 0);
    const compraSpan = (id: string) => (collapsedCompras.has(id) ? 1 : 3);
    const comprasTotalSpan = compras.reduce((sum, c) => sum + compraSpan(c.id), 0);
    const matCols = 5 + cotTotalSpan + 2 + comprasTotalSpan + 2; // ancho de la zona de material (sin las 4 col de partida)

    const allCotCollapsed = collapsedCot.size === COT_SLOTS.length;
    const allComprasCollapsed = compras.length > 0 && collapsedCompras.size === compras.length;
    const toggleAllCot = () => setCollapsedCot(allCotCollapsed ? new Set() : new Set(COT_SLOTS));
    const toggleAllCompras = () => setCollapsedCompras(allComprasCollapsed ? new Set() : new Set(compras.map((c) => c.id)));

    // ── Celdas de un material (nombre + E.T. + cotizaciones + compras + total/saldo) ──
    const materialCells = (row: MatRow) => (
        <>
            <td className={`${DIVIDER} group p-0`}>
                <div className="flex items-center gap-1">
                    <button type="button" onClick={() => { if (window.confirm(`¿Eliminar "${row.descripcion}"?`)) void run(() => matApi.deleteMaterial(projectId, documentId, row.material_id!)); }}
                        className="shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-500"><Trash2 size={11} /></button>
                    <MoDescriptionCell value={row.descripcion} editable className="min-w-40" onCommit={(v) => void run(() => matApi.updateMaterial(projectId, documentId, row.material_id!, { descripcion: v }))} />
                </div>
            </td>
            <td className="p-0"><MoUnitSelect value={row.unidad ?? ''} editable onCommit={(v) => void run(() => matApi.updateMaterial(projectId, documentId, row.material_id!, { unidad: v }))} /></td>
            <td className="p-0"><MoNumberCell value={row.et?.cantidad ?? ''} editable onCommit={(v) => void run(() => matApi.updateMaterial(projectId, documentId, row.material_id!, { cantidad: v ?? '0' }))} /></td>
            <td className="bg-rose-50/40 p-0 dark:bg-rose-950/10"><MoNumberCell value={row.et?.precio ?? ''} editable decimals={3} onCommit={(v) => void run(() => matApi.updateMaterial(projectId, documentId, row.material_id!, { precio_unitario: v ?? '0' }))} /></td>
            <td className="bg-rose-50/40 px-2 text-right tabular-nums text-rose-700 dark:bg-rose-950/10 dark:text-rose-300">{money(row.et?.pt ?? '0')}</td>

            {COT_SLOTS.map((slot) => {
                if (collapsedCot.has(slot)) {
                    return <td key={slot} className={`${DIVIDER} bg-emerald-50/30 dark:bg-emerald-950/10`} />;
                }
                const cot = row.cotizaciones?.find((c) => c.slot === slot);
                if (!cot) return <Fragment key={slot}><td className={DIVIDER} /><td /><td /><td /></Fragment>;
                const esMin = row.pu_minimo != null && cot.precio === row.pu_minimo;
                return (
                    <Fragment key={cot.slot}>
                        <td className={`${DIVIDER} p-0`}><MoTextCell value={cot.proveedor ?? ''} editable className="w-20 text-[11px]" onCommit={(v) => void run(() => matApi.setCotizacion(projectId, documentId, row.material_id!, cot.slot, { proveedor: v || null }))} /></td>
                        <td className="p-0"><MoNumberCell value={cot.cantidad} editable muted onCommit={(v) => void run(() => matApi.setCotizacion(projectId, documentId, row.material_id!, cot.slot, { cantidad: v }))} /></td>
                        <td className={`p-0 ${esMin ? 'bg-emerald-100 dark:bg-emerald-900/40' : ''}`}><MoNumberCell value={cot.precio ?? ''} editable decimals={3} onCommit={(v) => void run(() => matApi.setCotizacion(projectId, documentId, row.material_id!, cot.slot, { precio: v }))} /></td>
                        <td className="px-2 text-right tabular-nums text-slate-500">{money(cot.pt)}</td>
                    </Fragment>
                );
            })}
            <td className={`${DIVIDER} bg-emerald-100/60 px-2 text-right font-semibold tabular-nums text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300`}>{puMinimo(row.pu_minimo)}</td>
            <td className="bg-emerald-100/60 px-2 text-right tabular-nums text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">{row.pt_referencia ? money(row.pt_referencia) : '—'}</td>

            {compras.map((c) => {
                if (collapsedCompras.has(c.id)) {
                    return <td key={c.id} className={`${DIVIDER} bg-sky-50/30 dark:bg-sky-950/10`} />;
                }
                const cell = row.compras?.[c.id];
                return (
                    <Fragment key={c.id}>
                        <td className={`${DIVIDER} p-0`}><MoNumberCell value={cell?.cantidad ?? ''} editable onCommit={(v) => void run(() => matApi.setCompraValor(projectId, documentId, c.id, row.material_id!, { cantidad: v }))} /></td>
                        <td className="p-0"><MoNumberCell value={cell?.precio ?? ''} editable decimals={3} onCommit={(v) => void run(() => matApi.setCompraValor(projectId, documentId, c.id, row.material_id!, { precio: v }))} /></td>
                        <td className="bg-sky-50/40 px-2 text-right tabular-nums dark:bg-sky-950/10">{money(cell?.subtotal ?? '0')}</td>
                    </Fragment>
                );
            })}
            <td className={`${DIVIDER} bg-inherit px-2 text-right font-semibold tabular-nums`} style={totalCompradoStyle}>{money(row.total_comprado)}</td>
            <td
                className={`px-2 text-right font-semibold tabular-nums ${row.descuadra ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' : 'bg-inherit text-slate-500'}`}
                style={matSaldoStyle}
            >
                {money(row.saldo)}
            </td>
        </>
    );

    const compraHeader = (c: MatCompra) => {
        const isCollapsed = collapsedCompras.has(c.id);
        return (
            <div className="flex items-center justify-center gap-1">
                <button type="button" onClick={() => toggleCompra(c.id)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" title={isCollapsed ? 'Expandir' : 'Contraer'}>
                    {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                </button>
                {!isCollapsed && (
                    <>
                        <span>{c.etiqueta ?? `Compra ${c.indice}`}</span>
                        <input type="date" defaultValue={c.fecha ?? ''} onChange={(e) => void run(() => matApi.updateCompra(projectId, documentId, c.id, { fecha: e.target.value || null }))} className="bg-transparent text-[10px] text-slate-500 outline-none" />
                        <button type="button" onClick={() => void run(() => matApi.deleteCompra(projectId, documentId, c.id))} className="text-slate-300 hover:text-rose-500"><Trash2 size={10} /></button>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
                <div className="flex items-center gap-1">
                    {payload.scenarios.map((s) => (
                        <button key={s.id} type="button" onClick={() => s.id !== payload.scenario.id && run(() => matApi.activateScenario(projectId, documentId, s.id))}
                            className={`rounded-md px-2.5 py-1 text-xs font-medium ${s.id === payload.scenario.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}>
                            {s.nombre}
                        </button>
                    ))}
                    <button type="button" onClick={() => {
                        const nombre = window.prompt('Nombre del escenario (p. ej. "MAT (2)")')?.trim();
                        if (nombre) void (async () => { setBusy(true); try { const c = await matApi.addScenario(projectId, documentId, nombre, payload.scenario.id); apply(await matApi.activateScenario(projectId, documentId, c.scenario.id)); } finally { setBusy(false); } })();
                    }} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800" title="Duplicar escenario"><Plus size={14} /></button>
                </div>
                <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
                <button type="button" onClick={() => void run(() => matApi.addCompra(projectId, documentId, null, null))} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"><Plus size={13} /> Compra</button>
                <button type="button" onClick={() => { const first = payload.rows.find((r) => !r.es_material && r.tipo === 'partida'); if (first) setQuickAddPartidaId(first.partida_id); }} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"><Plus size={13} /> Material</button>
                <button type="button" onClick={() => openAddDialog(null)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"><Plus size={13} /> Partida / bloque</button>
                <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
                <button type="button" onClick={toggleAllCot} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" title={allCotCollapsed ? 'Expandir cotizaciones' : 'Contraer cotizaciones'}>
                    {allCotCollapsed ? <ChevronsRight size={13} /> : <ChevronsLeft size={13} />} Cotizaciones
                </button>
                {compras.length > 0 && (
                    <button type="button" onClick={toggleAllCompras} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" title={allComprasCollapsed ? 'Expandir compras' : 'Contraer compras'}>
                        {allComprasCollapsed ? <ChevronsRight size={13} /> : <ChevronsLeft size={13} />} Compras
                    </button>
                )}
                {busy && <Loader2 size={14} className="animate-spin text-blue-500" />}
                <span className="ml-auto text-xs">
                    <b>EXP. TÉC.</b> {money(conc.exp_tec)} · <b>CORREGIDO</b> {money(conc.corregido)} ·{' '}
                    <span className={conc.estado === 'deficit' ? 'text-rose-600' : conc.estado === 'superavit' ? 'text-emerald-600' : ''}>
                        {conc.estado === 'cuadra' ? 'CUADRA' : conc.estado.toUpperCase()} {money(conc.diferencia)}
                    </span>
                </span>
            </div>

            {payload.totales.descuadres > 0 && (
                <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                    <AlertTriangle size={13} /> {payload.totales.descuadres} partida(s) cuyas compras no cuadran contra el P.T. del expediente técnico.
                </div>
            )}

            {dialog === 'fila' && (
                <MoAddRowDialog
                    rows={payload.rows.filter((r) => !r.es_material).map((r) => ({ partida_id: r.partida_id, tipo: r.tipo, item: r.item ?? null, nivel: r.nivel, descripcion: r.descripcion }))}
                    initialParentId={addDefaults?.parentId}
                    initialTipo={addDefaults?.tipo}
                    onClose={() => setDialog(null)}
                    onSubmit={async (data: NewPartida) => { await structural(() => moApi.addPartida(projectId, documentId, data)); }} />
            )}
            {menu && (
                <PartidaContextMenu
                    x={menu.x}
                    y={menu.y}
                    onClose={() => setMenu(null)}
                    onAddChild={() => openAddDialog({ parentId: menu.row.partida_id, tipo: menu.row.tipo === 'ie' ? 'bloque' : 'partida' })}
                    onAddSibling={() => openAddDialog({ parentId: menu.row.parent_id ?? null, tipo: menu.row.tipo as 'ie' | 'bloque' | 'partida' })}
                    onDelete={() => deletePartidaRow(menu.row)}
                />
            )}
            {materialMenu && (
                <MatMaterialContextMenu
                    x={materialMenu.x}
                    y={materialMenu.y}
                    materialName={materialMenu.row.descripcion}
                    onClose={() => setMaterialMenu(null)}
                    onAddMaterial={() => setQuickAddPartidaId(materialMenu.row.partida_id)}
                    onDelete={() => {
                        if (window.confirm(`¿Eliminar "${materialMenu.row.descripcion}"?`)) {
                            void run(() => matApi.deleteMaterial(projectId, documentId, materialMenu.row.material_id!));
                        }
                    }}
                />
            )}
            {quickAddPartidaId && (
                <MatQuickAddPanel
                    partidaNombre={partidaOf.get(quickAddPartidaId)?.descripcion ?? ''}
                    onClose={() => setQuickAddPartidaId(null)}
                    onSave={(lines) => addMaterialsBatch(quickAddPartidaId, lines)}
                />
            )}

            <div className="min-h-0 flex-1 overflow-auto">
                <table className="border-separate border-spacing-0 text-xs whitespace-nowrap">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                        <tr className="[&>th]:border-b [&>th]:border-slate-200 [&>th]:px-2 [&>th]:py-1.5 [&>th]:font-semibold dark:[&>th]:border-slate-700">
                            <th className="sticky left-0 z-20 bg-slate-50 text-left dark:bg-slate-900">Ítem</th>
                            <th className="sticky left-16 z-20 min-w-48 bg-slate-50 text-left dark:bg-slate-900">Descripción (partida)</th>
                            <th>Und</th>
                            <th className="text-right">Met.</th>
                            <th className={`${DIVIDER} bg-rose-50 text-left dark:bg-rose-950/30`} colSpan={5}>Expediente técnico (material)</th>
                            {COT_SLOTS.map((s) => (
                                <th key={s} colSpan={cotSpan(s)} className={`${DIVIDER} bg-emerald-50 text-center dark:bg-emerald-950/30`}>
                                    <button type="button" onClick={() => toggleCot(s)} className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200" title={collapsedCot.has(s) ? 'Expandir' : 'Contraer'}>
                                        {collapsedCot.has(s) ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                                        {!collapsedCot.has(s) && <span>Cotización {s}</span>}
                                    </button>
                                </th>
                            ))}
                            <th className={`${DIVIDER} bg-emerald-100 text-right dark:bg-emerald-900/40`}>P.U. mín</th>
                            <th className="bg-emerald-100 text-right dark:bg-emerald-900/40">P.T. ref</th>
                            {compras.map((c) => <th key={c.id} colSpan={compraSpan(c.id)} className={`${DIVIDER} bg-sky-50 text-center dark:bg-sky-950/30`}>{compraHeader(c)}</th>)}
                            <th className={`${DIVIDER} z-20 bg-slate-50 text-right dark:bg-slate-900`} style={totalCompradoStyle}>Total comprado</th>
                            <th className="z-20 bg-slate-50 text-right dark:bg-slate-900" style={matSaldoStyle}>Saldo</th>
                        </tr>
                        <tr className="[&>th]:border-b [&>th]:border-slate-200 [&>th]:px-2 [&>th]:py-1 [&>th]:text-right [&>th]:font-medium dark:[&>th]:border-slate-700">
                            <th className="sticky left-0 bg-slate-50 dark:bg-slate-900" />
                            <th className="sticky left-16 bg-slate-50 dark:bg-slate-900" />
                            <th /><th />
                            <th className={`${DIVIDER} text-left`}>Material</th><th>Und</th><th className="min-w-16">Cant.</th><th className="min-w-20">P.U.</th><th>P.T.</th>
                            {COT_SLOTS.map((s) => collapsedCot.has(s) ? (
                                <th key={`h${s}`} className={DIVIDER} />
                            ) : (
                                <Fragment key={`h${s}`}><th className={DIVIDER}>Prov.</th><th className="min-w-16">Cant.</th><th className="min-w-20">P.U.</th><th>P.T.</th></Fragment>
                            ))}
                            <th className={DIVIDER} /><th />
                            {compras.map((c) => collapsedCompras.has(c.id) ? (
                                <th key={`hc${c.id}`} className={DIVIDER} />
                            ) : (
                                <Fragment key={`hc${c.id}`}><th className={`${DIVIDER} min-w-16`}>Cant.</th><th className="min-w-20">P.U.</th><th>Subtotal</th></Fragment>
                            ))}
                            <th className={`${DIVIDER} z-20 bg-slate-50 dark:bg-slate-900`} style={totalCompradoStyle} /><th className="z-20 bg-slate-50 dark:bg-slate-900" style={matSaldoStyle} />
                        </tr>
                    </thead>
                    <tbody>
                        {payload.rows.length === 0 && (
                            <tr><td className="px-4 py-10 text-center text-sm text-slate-400" colSpan={24}>Importa el presupuesto (pestaña MO) o agrega materiales / partidas manualmente.</td></tr>
                        )}

                        {payload.rows.filter((row) => !row.es_material && !isHidden(row.parent_id)).map((row) => {
                            const delPartida = (
                                <button type="button" onClick={() => deletePartidaRow(row)}
                                    className="opacity-0 transition group-hover:opacity-100 hover:text-rose-500" aria-label="Eliminar fila"><Trash2 size={11} /></button>
                            );
                            const onContextMenu = (event: React.MouseEvent) => {
                                event.preventDefault();
                                setMenu({ x: event.clientX, y: event.clientY, row });
                            };

                            if (row.tipo === 'ie' || row.tipo === 'bloque') {
                                const dark = row.tipo === 'ie';
                                return (
                                    <tr key={row.partida_id} onContextMenu={onContextMenu} className={`group ${dark ? 'bg-slate-800 text-white dark:bg-slate-950' : 'bg-orange-50 font-semibold text-orange-900 dark:bg-orange-950/30 dark:text-orange-200'}`}>
                                        <td className={`sticky left-0 z-10 px-1 ${dark ? 'bg-slate-800 dark:bg-slate-950' : 'bg-orange-50 dark:bg-orange-950/30'}`} style={{ paddingLeft: `${row.nivel * 10}px` }}>
                                            <span className="flex items-center gap-1">
                                                {hasKids.has(row.partida_id) && <button type="button" onClick={() => toggle(row.partida_id)}>{collapsed.has(row.partida_id) ? <ChevronRight size={12} /> : <ChevronDown size={12} />}</button>}
                                                {row.item}
                                            </span>
                                        </td>
                                        <td className={`sticky left-16 z-10 px-0 ${dark ? 'bg-slate-800 dark:bg-slate-950' : 'bg-orange-50 dark:bg-orange-950/30'}`}>
                                            <span className="flex items-start gap-1">
                                                <MoDescriptionCell value={row.descripcion} editable className={dark ? 'font-semibold text-white' : 'font-semibold'} onCommit={(v) => void structural(() => moApi.updatePartida(projectId, documentId, row.partida_id, { descripcion: v }))} />
                                                {delPartida}
                                            </span>
                                        </td>
                                        <td colSpan={2} />
                                        <td colSpan={4} className={`${DIVIDER} bg-rose-50/20 dark:bg-rose-950/10`} />
                                        <td className="bg-rose-50/40 px-2 text-right font-semibold tabular-nums text-rose-700 dark:bg-rose-950/10 dark:text-rose-300">{money(row.pt_et ?? '0')}</td>
                                        <td colSpan={cotTotalSpan} className={`${DIVIDER} bg-emerald-50/20`} /><td colSpan={2} className={`${DIVIDER} bg-emerald-100/30`} />
                                        {compras.map((c) => <td key={c.id} colSpan={compraSpan(c.id)} className={`${DIVIDER} bg-sky-50/20 px-2 text-right tabular-nums text-slate-500`}>{collapsedCompras.has(c.id) ? '' : money(row.por_compra?.[c.id] ?? '0')}</td>)}
                                        <td className={`${DIVIDER} bg-inherit px-2 text-right font-semibold tabular-nums`} style={totalCompradoStyle}>{money(row.total_comprado)}</td>
                                        <td
                                            className={`px-2 text-right font-semibold tabular-nums ${row.descuadra ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' : 'bg-inherit text-slate-500'}`}
                                            style={matSaldoStyle}
                                        >
                                            {money(row.saldo)}
                                        </td>
                                    </tr>
                                );
                            }

                            // partida: cabecera con rowSpan sobre sus materiales, centrada verticalmente
                            const mats = materialsByPartida.get(row.partida_id) ?? [];
                            const span = Math.max(mats.length, 1) + 1; // + fila subtotal
                            const headCells = (
                                <>
                                    <td rowSpan={span} onContextMenu={onContextMenu} className="sticky left-0 z-10 border-b border-slate-200 bg-white px-1 align-middle dark:border-slate-800 dark:bg-slate-900" style={{ paddingLeft: `${row.nivel * 10}px` }}>
                                        <span className="flex items-center gap-1">
                                            {hasKids.has(row.partida_id) && <button type="button" onClick={() => toggle(row.partida_id)}>{collapsed.has(row.partida_id) ? <ChevronRight size={12} /> : <ChevronDown size={12} />}</button>}
                                            <MoTextCell value={row.item ?? ''} editable className="w-16 text-xs" onCommit={(v) => void structural(() => moApi.updatePartida(projectId, documentId, row.partida_id, { item: v || null }))} />
                                        </span>
                                    </td>
                                    <td rowSpan={span} onContextMenu={onContextMenu} className="group sticky left-16 z-10 border-b border-slate-200 bg-white px-0 align-middle dark:border-slate-800 dark:bg-slate-900">
                                        <div className="flex items-start gap-1">
                                            <MoDescriptionCell value={row.descripcion} editable onCommit={(v) => void structural(() => moApi.updatePartida(projectId, documentId, row.partida_id, { descripcion: v }))} />
                                            {delPartida}
                                        </div>
                                    </td>
                                    <td rowSpan={span} className="border-b border-slate-200 p-0 align-middle dark:border-slate-800"><MoUnitSelect value={row.unidad ?? ''} editable onCommit={(v) => void structural(() => moApi.updatePartida(projectId, documentId, row.partida_id, { unidad: v }))} /></td>
                                    <td rowSpan={span} className="border-b border-slate-200 p-0 align-middle dark:border-slate-800"><MoNumberCell value={row.metrado ?? ''} editable onCommit={(v) => void structural(() => moApi.updatePartida(projectId, documentId, row.partida_id, { metrado: v ?? '0' }))} /></td>
                                </>
                            );

                            const subtotalRow = (
                                <tr key={`${row.partida_id}-sub`} className="bg-yellow-50 text-[11px] font-semibold text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-300 [&>td]:border-b [&>td]:border-slate-200 dark:[&>td]:border-slate-800">
                                    <td colSpan={3} className={DIVIDER} />
                                    <td className="bg-rose-50/40 dark:bg-rose-950/10" />
                                    <td className="bg-rose-50/40 px-2 text-right tabular-nums dark:bg-rose-950/10">{money(row.pt_et ?? '0')}</td>
                                    <td colSpan={cotTotalSpan} className={DIVIDER} /><td colSpan={2} className={DIVIDER} />
                                    {compras.map((c) => <td key={c.id} colSpan={compraSpan(c.id)} className={`${DIVIDER} px-2 text-right tabular-nums`}>{collapsedCompras.has(c.id) ? '' : money(row.por_compra?.[c.id] ?? '0')}</td>)}
                                    <td className={`${DIVIDER} bg-inherit px-2 text-right tabular-nums`} style={totalCompradoStyle}>{money(row.total_comprado)}</td>
                                    <td className={`px-2 text-right tabular-nums ${row.descuadra ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40' : 'bg-inherit'}`} style={matSaldoStyle}>{money(row.saldo)}</td>
                                </tr>
                            );

                            if (mats.length === 0) {
                                return (
                                    <Fragment key={row.partida_id}>
                                        <tr className="[&>td]:border-b [&>td]:border-slate-100 dark:[&>td]:border-slate-800">
                                            {headCells}
                                            <td colSpan={matCols} className={`${DIVIDER} px-3 py-1 text-slate-400`}>
                                                Sin materiales.{' '}
                                                <button
                                                    type="button"
                                                    onClick={() => setQuickAddPartidaId(row.partida_id)}
                                                    className="text-blue-600 hover:underline"
                                                >
                                                    Agregar material
                                                </button>
                                            </td>
                                        </tr>
                                        {subtotalRow}
                                    </Fragment>
                                );
                            }

                            return (
                                <Fragment key={row.partida_id}>
                                    {mats.map((mat, index) => (
                                        <tr
                                            key={mat.material_id}
                                            className="group odd:bg-white even:bg-slate-50/50 dark:odd:bg-slate-900 dark:even:bg-slate-900/40 [&>td]:border-b [&>td]:border-slate-100 dark:[&>td]:border-slate-800"
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                setMaterialMenu({ x: e.clientX, y: e.clientY, row: mat });
                                            }}
                                        >
                                            {index === 0 && headCells}
                                            {materialCells(mat)}
                                        </tr>
                                    ))}
                                    {subtotalRow}
                                </Fragment>
                            );
                        })}

                        {payload.rows.length > 0 && (
                            <tr className="sticky bottom-0 bg-slate-100 font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-100 [&>td]:px-2 [&>td]:py-1.5">
                                <td className="sticky left-0 bg-slate-100 dark:bg-slate-800" />
                                <td className="sticky left-16 bg-slate-100 dark:bg-slate-800">TOTAL</td>
                                <td colSpan={2} />
                                <td colSpan={3} className={DIVIDER} /><td />
                                <td className="text-right tabular-nums text-rose-700 dark:text-rose-300">{money(payload.totales.general.pt_et)}</td>
                                <td colSpan={cotTotalSpan} className={DIVIDER} /><td colSpan={2} className={DIVIDER} />
                                {compras.map((c) => <td key={c.id} colSpan={compraSpan(c.id)} className={`${DIVIDER} text-right tabular-nums`}>{collapsedCompras.has(c.id) ? '' : money(payload.totales.por_compra[c.id] ?? '0')}</td>)}
                                <td className={`${DIVIDER} bg-slate-100 text-right tabular-nums dark:bg-slate-800`} style={totalCompradoStyle}>{money(payload.totales.general.total_comprado)}</td>
                                <td
                                    className={`bg-slate-100 text-right tabular-nums dark:bg-slate-800 ${conc.estado === 'cuadra' ? '' : 'text-amber-700 dark:text-amber-300'}`}
                                    style={matSaldoStyle}
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
