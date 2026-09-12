import { AlertTriangle, ChevronDown, ChevronRight, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import MoDescriptionCell from '../mo/MoDescriptionCell';
import MoNumberCell from '../mo/MoNumberCell';
import MoTextCell from '../mo/MoTextCell';
import MoUnitSelect from '../mo/MoUnitSelect';
import { money } from '../shared/format';
import GgAddLineaDialog from './GgAddLineaDialog';
import { ggApi } from './ggApi';
import type { GgGrupo, GgPago, GgPayload, GgResponse } from './types';

interface Props {
    projectId: number;
    documentId: string;
    initial: GgPayload;
    onRevision: (revision: number) => void;
}

const DIVIDER = 'border-l-2 border-slate-300 dark:border-slate-700';

// Total pagado / Saldo van congelados a la derecha: los pagos fechados son un N que crece o
// decrece sin límite (uno por cada desembolso real al personal), así que el scroll horizontal
// recorre solo esa zona dinámica mientras el resultado final queda siempre a la vista.
const SALDO_WIDTH = 104;
const TOTAL_PAGADO_WIDTH = 120;
const saldoStyle: React.CSSProperties = { position: 'sticky', right: 0, width: SALDO_WIDTH, minWidth: SALDO_WIDTH };
const totalPagadoStyle: React.CSSProperties = { position: 'sticky', right: SALDO_WIDTH, width: TOTAL_PAGADO_WIDTH, minWidth: TOTAL_PAGADO_WIDTH };

export default function GgSheet({ projectId, documentId, initial, onRevision }: Props) {
    const [payload, setPayload] = useState<GgPayload>(initial);
    const [collapsed, setCollapsed] = useState<Set<GgGrupo>>(new Set());
    const [busy, setBusy] = useState(false);
    const [dialog, setDialog] = useState<'linea' | null>(null);

    const apply = (res: GgResponse) => {
        setPayload(res.gg);
        onRevision(res.revision);
    };

    const run = async (task: () => Promise<GgResponse>) => {
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

    const toggle = (grupo: GgGrupo) =>
        setCollapsed((prev) => {
            const next = new Set(prev);
            next.has(grupo) ? next.delete(grupo) : next.add(grupo);
            return next;
        });

    const pagos = payload.pagos;
    const total = payload.totales;
    const hasLineas = payload.rows.some((row) => row.tipo === 'linea');

    const pagoHeader = (p: GgPago) => (
        <div className="flex items-center justify-center gap-1">
            <span>{p.etiqueta ?? `Pago ${p.indice}`}</span>
            <input type="date" defaultValue={p.fecha ?? ''} onChange={(e) => void run(() => ggApi.updatePago(projectId, documentId, p.id, { fecha: e.target.value || null }))} className="bg-transparent text-[10px] text-slate-500 outline-none" />
            <button type="button" onClick={() => void run(() => ggApi.deletePago(projectId, documentId, p.id))} className="text-slate-300 hover:text-rose-500"><Trash2 size={10} /></button>
        </div>
    );

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
                <div className="flex items-center gap-1">
                    {payload.scenarios.map((s) => (
                        <button key={s.id} type="button" onClick={() => s.id !== payload.scenario.id && run(() => ggApi.activateScenario(projectId, documentId, s.id))}
                            className={`rounded-md px-2.5 py-1 text-xs font-medium ${s.id === payload.scenario.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}>
                            {s.nombre}
                        </button>
                    ))}
                    <button type="button" onClick={() => {
                        const nombre = window.prompt('Nombre del escenario (p. ej. "GG (2)")')?.trim();
                        if (nombre) void (async () => { setBusy(true); try { const c = await ggApi.addScenario(projectId, documentId, nombre, payload.scenario.id); apply(await ggApi.activateScenario(projectId, documentId, c.scenario.id)); } finally { setBusy(false); } })();
                    }} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800" title="Duplicar escenario"><Plus size={14} /></button>
                </div>
                <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
                <button type="button" onClick={() => void run(() => ggApi.addPago(projectId, documentId, null, null))} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"><Plus size={13} /> Pago</button>
                <button type="button" onClick={() => setDialog('linea')} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"><Plus size={13} /> Línea</button>
                {busy && <Loader2 size={14} className="animate-spin text-blue-500" />}
                <span className="ml-auto text-xs">
                    <b>GASTO E.T.</b> {money(total.general.gasto_et)} · <b>PROYECTADO</b> {money(total.general.gasto_proyectado)} · <b>PAGADO</b> {money(total.general.total_pagado)} ·{' '}
                    <span className={total.general.saldo.startsWith('-') ? 'text-amber-600' : 'text-emerald-600'}>SALDO {money(total.general.saldo)}</span>
                </span>
            </div>

            {total.sobregiros > 0 && (
                <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                    <AlertTriangle size={13} /> {total.sobregiros} línea(s) con pagos por encima de lo proyectado.
                </div>
            )}

            {!hasLineas && (
                <div className="flex flex-wrap items-center gap-2 border-b border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
                    <span>Todavía no hay líneas de gasto general.</span>
                    <button type="button" onClick={() => void run(() => ggApi.seedPlantilla(projectId, documentId))} className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700">
                        <Sparkles size={12} /> Cargar estructura estándar
                    </button>
                    <span className="text-blue-400">o</span>
                    <button type="button" onClick={() => setDialog('linea')} className="text-blue-700 underline hover:text-blue-900 dark:text-blue-300">agrega una línea manualmente</button>
                </div>
            )}

            {dialog === 'linea' && (
                <GgAddLineaDialog rows={payload.rows} onClose={() => setDialog(null)} onSubmit={async (data) => { apply(await ggApi.addLinea(projectId, documentId, data)); }} />
            )}

            <div className="min-h-0 flex-1 overflow-auto">
                <table className="border-separate border-spacing-0 text-xs whitespace-nowrap">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                        <tr className="[&>th]:border-b [&>th]:border-slate-200 [&>th]:px-2 [&>th]:py-1.5 [&>th]:font-semibold dark:[&>th]:border-slate-700">
                            <th className="sticky left-0 z-20 min-w-16 bg-slate-50 text-left dark:bg-slate-900">Ítem</th>
                            <th className="sticky left-16 z-20 min-w-56 bg-slate-50 text-left dark:bg-slate-900">Descripción</th>
                            <th>Und</th>
                            <th className="min-w-16 text-right">Cant.</th>
                            <th className="min-w-20 text-right">Costo U.</th>
                            <th className={`${DIVIDER} bg-rose-50 text-right dark:bg-rose-950/30`}>Gasto E.T.</th>
                            <th className={`${DIVIDER} bg-emerald-50 text-right dark:bg-emerald-950/30`}>Gasto Proyectado</th>
                            {pagos.map((p, i) => <th key={p.id} className={`${i === 0 ? DIVIDER : ''} bg-sky-50 text-center dark:bg-sky-950/30`}>{pagoHeader(p)}</th>)}
                            <th className={`${DIVIDER} z-20 bg-slate-50 text-right dark:bg-slate-900`} style={totalPagadoStyle}>Total pagado</th>
                            <th className="z-20 bg-slate-50 text-right dark:bg-slate-900" style={saldoStyle}>Saldo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {payload.rows.map((row) => {
                            if (row.tipo === 'grupo') {
                                const isCollapsed = collapsed.has(row.grupo);
                                return (
                                    <tr key={`grupo-${row.grupo}`} className="bg-slate-800 text-white dark:bg-slate-950">
                                        <td className="sticky left-0 z-10 bg-slate-800 px-1 py-1.5 font-semibold dark:bg-slate-950">
                                            <button type="button" onClick={() => toggle(row.grupo)} className="flex items-center gap-1">
                                                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                                                {row.item}
                                            </button>
                                        </td>
                                        <td className="sticky left-16 z-10 bg-slate-800 px-1 py-1.5 font-semibold dark:bg-slate-950">{row.descripcion}</td>
                                        <td colSpan={3} />
                                        <td className={`${DIVIDER} px-2 text-right tabular-nums`}>{money(row.gasto_et)}</td>
                                        <td className={`${DIVIDER} px-2 text-right tabular-nums`}>{money(row.gasto_proyectado)}</td>
                                        {pagos.map((p, i) => <td key={p.id} className={`${i === 0 ? DIVIDER : ''} px-2 text-right tabular-nums`}>{money(row.por_pago[p.id] ?? '0')}</td>)}
                                        <td className={`${DIVIDER} bg-slate-800 px-2 text-right tabular-nums dark:bg-slate-950`} style={totalPagadoStyle}>{money(row.total_pagado)}</td>
                                        <td className="bg-slate-800 px-2 text-right tabular-nums dark:bg-slate-950" style={saldoStyle}>{money(row.saldo)}</td>
                                    </tr>
                                );
                            }

                            if (collapsed.has(row.grupo)) return null;

                            if (row.tipo === 'rubro') {
                                return (
                                    <tr key={`rubro-${row.grupo}-${row.rubro}`} className="group bg-orange-50 font-semibold text-orange-900 [&>td]:border-b [&>td]:border-slate-200 dark:bg-orange-950/30 dark:text-orange-200 dark:[&>td]:border-slate-800">
                                        <td className="sticky left-0 z-10 bg-orange-50 px-2 py-1 dark:bg-orange-950/30">{row.item}</td>
                                        <td className="sticky left-16 z-10 bg-orange-50 px-0 dark:bg-orange-950/30">
                                            <div className="flex items-center gap-1">
                                                <MoTextCell
                                                    value={row.rubro}
                                                    editable
                                                    className="font-semibold text-orange-900 dark:text-orange-200"
                                                    onCommit={(v) => v.trim() && v.trim() !== row.rubro && void run(() => ggApi.renameRubro(projectId, documentId, row.grupo, row.rubro, v.trim()))}
                                                />
                                                <button type="button" onClick={() => { if (window.confirm(`¿Eliminar el rubro "${row.rubro}" y todas sus líneas?`)) void run(() => ggApi.deleteRubro(projectId, documentId, row.grupo, row.rubro)); }}
                                                    className="opacity-0 transition group-hover:opacity-100 hover:text-rose-500" aria-label="Eliminar rubro"><Trash2 size={11} /></button>
                                            </div>
                                        </td>
                                        <td colSpan={3} />
                                        <td className={`${DIVIDER} px-2 text-right tabular-nums`}>{money(row.gasto_et)}</td>
                                        <td className={`${DIVIDER} px-2 text-right tabular-nums`}>{money(row.gasto_proyectado)}</td>
                                        {pagos.map((p, i) => <td key={p.id} className={`${i === 0 ? DIVIDER : ''} px-2 text-right tabular-nums`}>{money(row.por_pago[p.id] ?? '0')}</td>)}
                                        <td className={`${DIVIDER} bg-orange-50 px-2 text-right tabular-nums dark:bg-orange-950/30`} style={totalPagadoStyle}>{money(row.total_pagado)}</td>
                                        <td className="bg-orange-50 px-2 text-right tabular-nums dark:bg-orange-950/30" style={saldoStyle}>{money(row.saldo)}</td>
                                    </tr>
                                );
                            }

                            return (
                                <tr key={row.linea_id} className="group odd:bg-white even:bg-slate-50/50 [&>td]:border-b [&>td]:border-slate-100 dark:odd:bg-slate-900 dark:even:bg-slate-900/40 dark:[&>td]:border-slate-800">
                                    <td className="sticky left-0 z-10 bg-inherit" />
                                    <td className="sticky left-16 z-10 bg-inherit px-0" style={{ paddingLeft: '14px' }}>
                                        <div className="flex items-center gap-1">
                                            <button type="button" onClick={() => { if (window.confirm(`¿Eliminar "${row.descripcion}"?`)) void run(() => ggApi.deleteLinea(projectId, documentId, row.linea_id)); }}
                                                className="shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-500"><Trash2 size={11} /></button>
                                            <MoDescriptionCell value={row.descripcion} editable className="min-w-40" onCommit={(v) => void run(() => ggApi.updateLinea(projectId, documentId, row.linea_id, { descripcion: v }))} />
                                        </div>
                                    </td>
                                    <td className="p-0"><MoUnitSelect value={row.unidad ?? ''} editable onCommit={(v) => void run(() => ggApi.updateLinea(projectId, documentId, row.linea_id, { unidad: v }))} /></td>
                                    <td className="p-0"><MoNumberCell value={row.cantidad} editable onCommit={(v) => void run(() => ggApi.updateLinea(projectId, documentId, row.linea_id, { cantidad: v ?? '0' }))} /></td>
                                    <td className="p-0"><MoNumberCell value={row.costo_unitario} editable decimals={3} onCommit={(v) => void run(() => ggApi.updateLinea(projectId, documentId, row.linea_id, { costo_unitario: v ?? '0' }))} /></td>
                                    <td className={`${DIVIDER} bg-rose-50/40 px-2 text-right tabular-nums text-rose-700 dark:bg-rose-950/10 dark:text-rose-300`}>{money(row.gasto_et)}</td>
                                    <td className={`${DIVIDER} bg-emerald-50/40 p-0 dark:bg-emerald-950/10`}>
                                        <MoNumberCell value={row.gasto_proyectado} editable muted={!row.gasto_proyectado_manual} onCommit={(v) => void run(() => ggApi.updateLinea(projectId, documentId, row.linea_id, { gasto_proyectado: v }))} />
                                    </td>
                                    {pagos.map((p, i) => (
                                        <td key={p.id} className={`${i === 0 ? DIVIDER : ''} p-0`}>
                                            <MoNumberCell value={row.por_pago[p.id] ?? ''} editable onCommit={(v) => void run(() => ggApi.setPagoValor(projectId, documentId, p.id, row.linea_id, v))} />
                                        </td>
                                    ))}
                                    <td className={`${DIVIDER} bg-inherit px-2 text-right font-semibold tabular-nums`} style={totalPagadoStyle}>{money(row.total_pagado)}</td>
                                    <td className={`px-2 text-right font-semibold tabular-nums ${row.descuadra ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' : 'bg-inherit text-slate-500'}`} style={saldoStyle}>{money(row.saldo)}</td>
                                </tr>
                            );
                        })}

                        {payload.rows.length > 0 && (
                            <tr className="sticky bottom-0 bg-slate-100 font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-100 [&>td]:px-2 [&>td]:py-1.5">
                                <td className="sticky left-0 bg-slate-100 dark:bg-slate-800" />
                                <td className="sticky left-16 bg-slate-100 dark:bg-slate-800">TOTAL</td>
                                <td colSpan={3} />
                                <td className={`${DIVIDER} text-right tabular-nums text-rose-700 dark:text-rose-300`}>{money(total.general.gasto_et)}</td>
                                <td className={`${DIVIDER} text-right tabular-nums`}>{money(total.general.gasto_proyectado)}</td>
                                {pagos.map((p, i) => <td key={p.id} className={`${i === 0 ? DIVIDER : ''} text-right tabular-nums`}>{money(total.por_pago[p.id] ?? '0')}</td>)}
                                <td className={`${DIVIDER} bg-slate-100 text-right tabular-nums dark:bg-slate-800`} style={totalPagadoStyle}>{money(total.general.total_pagado)}</td>
                                <td className={`bg-slate-100 text-right tabular-nums dark:bg-slate-800 ${total.general.saldo.startsWith('-') ? 'text-amber-700 dark:text-amber-300' : ''}`} style={saldoStyle}>{money(total.general.saldo)}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
