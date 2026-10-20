import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronLeft, ChevronRight, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import MoNumberCell from '../../mantenimiento/mo/MoNumberCell';
import MoTextCell from '../../mantenimiento/mo/MoTextCell';
import { money } from '../../mantenimiento/shared/format';
import { errorMessage, gastFinApi } from '../gastFinApi';
import { DIVIDER, qty, RESULT, TITLE } from '../styles';
import { sameDecimal } from '../types';
import type { GastFinGrupo, MatCompra, MatDeltaResponse, MatPayload, MatResponse, MatRow } from '../types';

interface Props {
    projectId: number;
    grupo: GastFinGrupo;
    initial: MatPayload;
    onRevision: (revision: number, payload: MatPayload) => void;
}

const ROW_HEIGHT = 28;

// Anchos fijos en px: la grilla es CSS grid por fila (virtualizada), así que encabezado, filas y
// pie comparten el mismo grid-template-columns y los sticky left/right calzan sin medir el DOM.
const W = { desc: 300, und: 56, qty: 96, pu: 84, money: 108, proveedor: 120, total: 116 };
const STICKY_SALDO: React.CSSProperties = { position: 'sticky', right: 0, zIndex: 5 };
const STICKY_TOTAL: React.CSSProperties = { position: 'sticky', right: W.total, zIndex: 5 };
const STICKY_DESC: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 5 };

function compraCols(collapsed: boolean): number[] {
    return collapsed ? [W.money] : [W.qty, W.pu, W.money, W.proveedor];
}

export default function GastFinMatSheet({ projectId, grupo, initial, onRevision }: Props) {
    const [payload, setPayload] = useState<MatPayload>(initial);
    const [busy, setBusy] = useState(false);
    const [query, setQuery] = useState('');
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [nuevoInsumo, setNuevoInsumo] = useState<{ descripcion: string; unidad: string } | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const guard = async <T,>(task: () => Promise<T>, apply: (res: T) => void) => {
        setBusy(true);
        try {
            apply(await task());
        } catch (error) {
            window.alert(errorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    // Último payload aplicado: las respuestas de varias celdas pueden llegar seguidas y cada delta
    // debe aplicarse sobre el anterior (no sobre el estado del render que disparó la edición).
    const latest = useRef(payload);
    const commit = (revision: number, next: MatPayload) => {
        latest.current = next;
        setPayload(next);
        onRevision(revision, next);
    };

    const runFull = (task: () => Promise<MatResponse>) => void guard(task, (res) => commit(res.revision, res.mat));

    // Edición de celda: el backend responde solo la fila tocada + totales (delta), no la pestaña.
    const runDelta = (task: () => Promise<MatDeltaResponse>) =>
        void guard(task, (res) => {
            const prev = latest.current;
            const changed = res.row;
            commit(res.revision, {
                ...prev,
                totales: res.totales,
                rows: changed ? prev.rows.map((row) => (row.key === changed.key ? changed : row)) : prev.rows,
            });
        });

    const compras = payload.compras;
    const normalizedQuery = query.trim().toLowerCase();
    const rows = normalizedQuery === '' ? payload.rows : payload.rows.filter((row) => row.descripcion.toLowerCase().includes(normalizedQuery));

    const columns = [
        W.desc, W.und,
        W.qty, W.pu, W.money,
        W.qty, W.pu, W.money,
        ...compras.flatMap((compra) => compraCols(collapsed.has(compra.id))),
        W.total, W.total,
    ];
    const template = columns.map((w) => `${w}px`).join(' ');
    const totalWidth = columns.reduce((sum, w) => sum + w, 0);

    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: 12,
    });

    const toggleCompra = (id: string) =>
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const allCollapsed = compras.length > 0 && compras.every((compra) => collapsed.has(compra.id));
    const t = payload.totales;

    const compraHeader = (compra: MatCompra) => {
        const isCollapsed = collapsed.has(compra.id);
        return (
            <div key={compra.id} className={`${DIVIDER} flex items-center gap-1 px-1`} style={{ gridColumn: `span ${compraCols(isCollapsed).length}` }}>
                <button type="button" onClick={() => toggleCompra(compra.id)} title={isCollapsed ? 'Expandir compra' : 'Colapsar compra'} className="text-amber-700 dark:text-amber-300">
                    {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
                </button>
                <span className="font-semibold whitespace-nowrap">COMPRA {String(compra.numero).padStart(2, '0')}:</span>
                <input
                    type="date"
                    value={compra.fecha ?? ''}
                    onChange={(event) => runFull(() => gastFinApi.updateCompra(projectId, compra.id, event.target.value || null))}
                    className="min-w-0 flex-1 bg-transparent text-[10px] outline-none"
                />
                <button
                    type="button"
                    title="Eliminar compra"
                    onClick={() => {
                        if (window.confirm(`¿Eliminar la COMPRA ${compra.numero} con todo lo registrado en ella?`)) {
                            runFull(() => gastFinApi.deleteCompra(projectId, compra.id));
                        }
                    }}
                    className="text-slate-400 hover:text-red-600"
                >
                    <Trash2 size={11} />
                </button>
            </div>
        );
    };

    const renderRow = (row: MatRow) => {
        const editableDesc = row.origen === 'manual' && row.id !== null;
        return (
            <>
                <div style={STICKY_DESC} className="flex items-center gap-1 bg-inherit pr-1">
                    <div className="min-w-0 flex-1 truncate" title={row.descripcion}>
                        {editableDesc ? (
                            <MoTextCell value={row.descripcion} editable onCommit={(v) => {
                                if (v.trim() !== '') runFull(() => gastFinApi.updateInsumo(projectId, row.id as string, { descripcion: v.trim() }));
                            }} />
                        ) : (
                            <span className="block truncate px-2 py-1">{row.descripcion}</span>
                        )}
                    </div>
                    {row.origen !== 'expediente' && (
                        <span className={`shrink-0 rounded px-1 text-[9px] ${row.origen === 'manual' ? 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'}`}
                            title={row.origen === 'manual' ? 'Agregado a mano: no está en el expediente técnico' : 'El insumo ya no está en el ACU (se renombró o eliminó); sus compras se conservan'}>
                            {row.origen === 'manual' ? 'manual' : 'fuera del E.T.'}
                        </span>
                    )}
                    {row.id !== null && row.origen !== 'expediente' && (
                        <button type="button" title="Eliminar fila y lo registrado en ella" className="shrink-0 text-slate-400 hover:text-red-600"
                            onClick={() => {
                                if (window.confirm(`¿Eliminar "${row.descripcion}" con su cotizado y compras?`)) runFull(() => gastFinApi.deleteInsumo(projectId, row.id as string));
                            }}>
                            <Trash2 size={11} />
                        </button>
                    )}
                </div>
                <div className="px-1 py-1 text-center">
                    {editableDesc ? (
                        <MoTextCell value={row.unidad ?? ''} editable className="text-center" onCommit={(v) => runFull(() => gastFinApi.updateInsumo(projectId, row.id as string, { unidad: v.trim() || null }))} />
                    ) : row.unidad}
                </div>

                <div className={`${DIVIDER} px-2 py-1 text-right tabular-nums`}>{qty(row.et?.cantidad)}</div>
                <div className="px-2 py-1 text-right tabular-nums">{row.et ? money(row.et.precio) : ''}</div>
                <div className={`px-2 py-1 text-right tabular-nums ${RESULT}`}>{row.et ? money(row.et.parcial) : ''}</div>

                <div className={DIVIDER}>
                    <MoNumberCell value={row.cot.cantidad ?? ''} editable muted={row.cot.cantidad_source === 'et'}
                        onCommit={(v) => {
                            // Vacío = vuelve a la cantidad del E.T.; igual al valor mostrado (sugerido) = sin cambio.
                            if (v === null ? row.cot.cantidad_source === 'manual' : !sameDecimal(row.cot.cantidad, v)) {
                                runDelta(() => gastFinApi.setCotizacion(projectId, grupo.ref, row.key, { cantidad: v }));
                            }
                        }} />
                </div>
                <div>
                    <MoNumberCell value={row.cot.precio ?? ''} editable decimals={2}
                        onCommit={(v) => !sameDecimal(row.cot.precio, v) && runDelta(() => gastFinApi.setCotizacion(projectId, grupo.ref, row.key, { precio: v }))} />
                </div>
                <div className={`px-2 py-1 text-right tabular-nums ${RESULT}`}>{row.cot.parcial ? money(row.cot.parcial) : ''}</div>

                {compras.map((compra) => {
                    const celda = row.compras[compra.id] ?? null;
                    const subtotal = <div key={`${compra.id}-s`} className={`px-2 py-1 text-right tabular-nums ${RESULT} ${collapsed.has(compra.id) ? DIVIDER : ''}`}>{celda?.subtotal ? money(celda.subtotal) : ''}</div>;
                    if (collapsed.has(compra.id)) return subtotal;
                    return [
                        <div key={`${compra.id}-c`} className={DIVIDER}>
                            <MoNumberCell value={celda?.cantidad ?? ''} editable onCommit={(v) => !sameDecimal(celda?.cantidad, v) && runDelta(() => gastFinApi.setCompraValor(projectId, compra.id, row.key, { cantidad: v }))} />
                        </div>,
                        <div key={`${compra.id}-p`}>
                            <MoNumberCell value={celda?.precio ?? ''} editable decimals={2} onCommit={(v) => !sameDecimal(celda?.precio, v) && runDelta(() => gastFinApi.setCompraValor(projectId, compra.id, row.key, { precio: v }))} />
                        </div>,
                        subtotal,
                        <div key={`${compra.id}-v`}>
                            <MoTextCell value={celda?.proveedor ?? ''} editable placeholder="proveedor" onCommit={(v) => v.trim() !== (celda?.proveedor ?? '') && runDelta(() => gastFinApi.setCompraValor(projectId, compra.id, row.key, { proveedor: v }))} />
                        </div>,
                    ];
                })}

                <div style={STICKY_TOTAL} className={`${DIVIDER} px-2 py-1 text-right tabular-nums ${RESULT}`}>{money(row.total_comprado)}</div>
                <div style={STICKY_SALDO} className={`px-2 py-1 text-right tabular-nums ${RESULT} ${row.saldo.startsWith('-') ? 'text-red-600 dark:text-red-400' : ''}`}>{money(row.saldo)}</div>
            </>
        );
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col text-xs">
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-1.5 dark:border-slate-800">
                <span className="font-semibold uppercase">Insumos {grupo.descripcion}</span>
                <label className="flex items-center gap-1 rounded border border-slate-300 px-1.5 dark:border-slate-700">
                    <Search size={12} className="text-slate-400" />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar insumo" className="w-40 bg-transparent py-1 outline-none" />
                </label>
                <button type="button" onClick={() => runFull(() => gastFinApi.addCompra(projectId, grupo.ref, new Date().toISOString().slice(0, 10)))}
                    className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                    <Plus size={12} /> Compra
                </button>
                {compras.length > 0 && (
                    <button type="button" onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(compras.map((c) => c.id)))}
                        className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                        {allCollapsed ? 'Expandir compras' : 'Colapsar compras'}
                    </button>
                )}
                {nuevoInsumo ? (
                    <form className="flex items-center gap-1" onSubmit={(event) => {
                        event.preventDefault();
                        if (nuevoInsumo.descripcion.trim() === '') return;
                        const data = { descripcion: nuevoInsumo.descripcion.trim(), unidad: nuevoInsumo.unidad.trim() || null };
                        setNuevoInsumo(null);
                        runFull(() => gastFinApi.addInsumo(projectId, grupo.ref, data));
                    }}>
                        <input autoFocus value={nuevoInsumo.descripcion} onChange={(event) => setNuevoInsumo({ ...nuevoInsumo, descripcion: event.target.value })}
                            placeholder="Descripción del insumo" maxLength={500} className="w-64 rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900" />
                        <input value={nuevoInsumo.unidad} onChange={(event) => setNuevoInsumo({ ...nuevoInsumo, unidad: event.target.value })}
                            placeholder="und" maxLength={20} className="w-16 rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900" />
                        <button type="submit" className="rounded bg-amber-600 px-2 py-1 font-medium text-white hover:bg-amber-700">Agregar</button>
                        <button type="button" onClick={() => setNuevoInsumo(null)} className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
                    </form>
                ) : (
                    <button type="button" onClick={() => setNuevoInsumo({ descripcion: '', unidad: '' })} title="Insumo comprado que no está en el expediente técnico"
                        className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                        <Plus size={12} /> Insumo fuera del E.T.
                    </button>
                )}
                <span className="ml-auto flex items-center gap-2">
                    {busy && <Loader2 size={14} className="animate-spin text-blue-500" />}
                    <span className="text-slate-500">{rows.length} de {payload.rows.length} insumos</span>
                    <span className={`rounded px-1.5 py-0.5 font-semibold ${t.estado === 'deficit' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200' : t.estado === 'superavit' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-slate-100 dark:bg-slate-800'}`}>
                        {t.estado === 'deficit' ? 'DÉFICIT' : t.estado === 'superavit' ? 'SUPERÁVIT' : 'CUADRA'} {money(t.saldo)}
                    </span>
                </span>
            </div>

            {payload.sin_metrado > 0 && (
                <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-1 text-[11px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    {payload.sin_metrado} partida{payload.sin_metrado === 1 ? '' : 's'} de este nivel tiene{payload.sin_metrado === 1 ? '' : 'n'} ACU pero metrado 0 en el presupuesto: sus materiales aparecen con cantidad 0 en el expediente técnico hasta que se le asigne metrado.
                </div>
            )}

            <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto">
                <div style={{ width: totalWidth }} className="min-w-full">
                    {/* Encabezado en dos niveles, sticky arriba dentro del mismo scroll (sin sincronizar scrollLeft). */}
                    <div className={`sticky top-0 z-20 ${TITLE} border-b border-amber-200 font-semibold dark:border-amber-900`} style={{ display: 'grid', gridTemplateColumns: template }}>
                        <div style={{ ...STICKY_DESC, gridRow: 'span 2' }} className={`flex items-end px-2 py-1 ${TITLE}`}>Descripción</div>
                        <div style={{ gridRow: 'span 2' }} className="flex items-end justify-center px-1 py-1">Und</div>
                        <div style={{ gridColumn: 'span 3' }} className={`${DIVIDER} px-2 py-1 text-center text-red-700 dark:text-red-300`}>EXPEDIENTE TÉCNICO</div>
                        <div style={{ gridColumn: 'span 3' }} className={`${DIVIDER} px-2 py-1 text-center text-red-700 dark:text-red-300`}>COTIZADO</div>
                        {compras.map(compraHeader)}
                        <div style={{ ...STICKY_TOTAL, gridRow: 'span 2' }} className={`${DIVIDER} flex items-end justify-end px-2 py-1 text-right ${TITLE}`}>Total comprado</div>
                        <div style={{ ...STICKY_SALDO, gridRow: 'span 2' }} className={`flex items-end justify-end px-2 py-1 ${TITLE}`}>Saldo</div>

                        {['Cantidad', 'P.U.', 'Parcial', 'Cantidad', 'P.U.', 'Parcial'].map((label, i) => (
                            <div key={`h-${i}`} className={`${i % 3 === 0 ? DIVIDER : ''} px-2 pb-1 text-right font-medium`}>{label}</div>
                        ))}
                        {compras.flatMap((compra) =>
                            collapsed.has(compra.id)
                                ? [<div key={`${compra.id}-hs`} className={`${DIVIDER} px-2 pb-1 text-right font-medium`}>Sub total</div>]
                                : ['Cantidad', 'P.U.', 'Sub total', 'Proveedor'].map((label, i) => (
                                    <div key={`${compra.id}-h${i}`} className={`${i === 0 ? DIVIDER : ''} px-2 pb-1 font-medium ${i === 3 ? 'text-left' : 'text-right'}`}>{label}</div>
                                )),
                        )}
                    </div>

                    <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                        {virtualizer.getVirtualItems().map((vRow) => {
                            const row = rows[vRow.index];
                            if (!row) return null;
                            return (
                                <div
                                    key={row.key}
                                    style={{ position: 'absolute', top: vRow.start, left: 0, width: totalWidth, height: ROW_HEIGHT, display: 'grid', gridTemplateColumns: template }}
                                    className={`items-center border-b border-slate-100 dark:border-slate-800 ${vRow.index % 2 ? 'bg-slate-50 dark:bg-slate-900' : 'bg-white dark:bg-slate-950'}`}
                                >
                                    {renderRow(row)}
                                </div>
                            );
                        })}
                    </div>

                    <div className={`sticky bottom-0 z-20 ${TITLE} border-t-2 border-amber-300 font-bold dark:border-amber-800`} style={{ display: 'grid', gridTemplateColumns: template }}>
                        <div style={STICKY_DESC} className={`px-2 py-1.5 ${TITLE}`}>TOTAL {grupo.descripcion}</div>
                        <div />
                        <div className={DIVIDER} />
                        <div />
                        <div className="px-2 py-1.5 text-right tabular-nums">{money(t.et)}</div>
                        <div className={DIVIDER} />
                        <div />
                        <div className="px-2 py-1.5 text-right tabular-nums">{money(t.cotizado)}</div>
                        {compras.flatMap((compra) => {
                            const cell = <div key={`${compra.id}-t`} className={`px-2 py-1.5 text-right tabular-nums ${collapsed.has(compra.id) ? DIVIDER : ''}`}>{money(t.compras[compra.id] ?? '0.00')}</div>;
                            return collapsed.has(compra.id) ? [cell] : [<div key={`${compra.id}-t0`} className={DIVIDER} />, <div key={`${compra.id}-t1`} />, cell, <div key={`${compra.id}-t3`} />];
                        })}
                        <div style={STICKY_TOTAL} className={`${DIVIDER} px-2 py-1.5 text-right tabular-nums ${TITLE}`}>{money(t.total_comprado)}</div>
                        <div style={STICKY_SALDO} className={`px-2 py-1.5 text-right tabular-nums ${TITLE} ${t.saldo.startsWith('-') ? 'text-red-600' : ''}`}>{money(t.saldo)}</div>
                    </div>
                </div>

                {payload.rows.length === 0 && (
                    <div className="p-6 text-center text-slate-500">Este nivel no tiene materiales en sus ACU. Puedes agregar insumos fuera del E.T.</div>
                )}
            </div>
        </div>
    );
}
