import { AlertTriangle, ChevronDown, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import MoNumberCell from '../../mantenimiento/mo/MoNumberCell';
import MoTextCell from '../../mantenimiento/mo/MoTextCell';
import { money } from '../../mantenimiento/shared/format';
import { errorMessage, gastFinApi } from '../gastFinApi';
import GrupoTipoSelect from '../GrupoTipoSelect';
import { DIVIDER, GROUP_BAR, qty, RESULT, TITLE } from '../styles';
import { sameDecimal } from '../types';
import type { Franja, MoGrupo, MoPayload, MoResponse } from '../types';

interface Props {
    projectId: number;
    initial: MoPayload;
    onRevision: (revision: number, payload: MoPayload) => void;
}

const FRANJAS: Array<{ key: Franja; label: string }> = [
    { key: 'valorizacion', label: 'VALORIZACIONES' },
    { key: 'adelanto', label: 'ADELANTOS' },
];

// Pagado / Saldo congelados a la derecha: las columnas de pago crecen sin límite (una por
// valorización o adelanto) y el resultado debe quedar siempre a la vista, como en GG.
const SALDO_WIDTH = 116;
const PAGADO_WIDTH = 116;
const saldoStyle: React.CSSProperties = { position: 'sticky', right: 0, width: SALDO_WIDTH, minWidth: SALDO_WIDTH };
const pagadoStyle: React.CSSProperties = { position: 'sticky', right: SALDO_WIDTH, width: PAGADO_WIDTH, minWidth: PAGADO_WIDTH };
const LEFT_COLS = 5;

export default function GastFinMoSheet({ projectId, initial, onRevision }: Props) {
    const [payload, setPayload] = useState<MoPayload>(initial);
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState(false);
    const [nuevoPago, setNuevoPago] = useState<{ nombre: string; fecha: string } | null>(null);

    const run = async (task: () => Promise<MoResponse>) => {
        setBusy(true);
        try {
            const res = await task();
            setPayload(res.mo);
            onRevision(res.revision, res.mo);
        } catch (error) {
            window.alert(errorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    const toggle = (ref: string) =>
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(ref)) next.delete(ref);
            else next.add(ref);
            return next;
        });

    const pagos = payload.pagos;
    const totalCols = LEFT_COLS + pagos.length + 2;
    const general = payload.totales.general;

    const submitPago = () => {
        if (!nuevoPago || nuevoPago.nombre.trim() === '') return;
        const data = { nombre: nuevoPago.nombre.trim(), fecha: nuevoPago.fecha || null };
        setNuevoPago(null);
        void run(() => gastFinApi.addMoPago(projectId, data));
    };

    const renderGrupo = (grupo: MoGrupo, index: number) => {
        const isCollapsed = collapsed.has(grupo.ref);
        const t = grupo.totales;

        return (
            <tbody key={grupo.ref} className={index > 0 ? 'border-t-4 border-slate-300 dark:border-slate-700' : ''}>
                <tr className={GROUP_BAR}>
                    <td colSpan={totalCols} className="px-2 py-1">
                        <div className="flex flex-wrap items-center gap-3">
                            <button type="button" onClick={() => toggle(grupo.ref)} className="flex items-center gap-1 font-semibold uppercase">
                                {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                                {grupo.descripcion}
                            </button>
                            {grupo.ref !== '_' && (
                                <GrupoTipoSelect
                                    value={grupo.tipo}
                                    onChange={(tipo) => void run(() => gastFinApi.updateGrupo(projectId, grupo.ref, { tipo }))}
                                />
                            )}
                            <span className="ml-auto flex items-center gap-1 text-[11px] font-normal">
                                Presupuesto aprobado
                                <span className="w-28 rounded bg-white/10" title={t.aprobado_manual ? 'Vaciar = volver al E.T.' : 'Sugerido = E.T. del nivel; escribe para fijarlo'}>
                                    <MoNumberCell
                                        value={t.aprobado}
                                        editable
                                        muted={!t.aprobado_manual}
                                        onCommit={(v) => {
                                            if (!(v === null ? !t.aprobado_manual : Number(v) === Number(t.aprobado))) {
                                                void run(() => gastFinApi.updateGrupo(projectId, grupo.ref, { mo_aprobado: v }));
                                            }
                                        }}
                                    />
                                </span>
                            </span>
                        </div>
                    </td>
                </tr>

                {!isCollapsed && grupo.sin_metrado > 0 && (
                    <tr className="bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                        <td colSpan={totalCols} className="px-2 py-1 text-[11px]">
                            {grupo.sin_metrado} partida{grupo.sin_metrado === 1 ? '' : 's'} de este nivel tiene{grupo.sin_metrado === 1 ? '' : 'n'} ACU pero metrado 0 en el presupuesto: su mano de obra aparece con cantidad 0 hasta que se le asigne metrado.
                        </td>
                    </tr>
                )}

                {!isCollapsed && grupo.rows.length === 0 && (
                    <tr>
                        <td colSpan={totalCols} className="px-2 py-2 text-center text-slate-500">Este nivel no tiene mano de obra en sus ACU.</td>
                    </tr>
                )}

                {!isCollapsed && grupo.rows.map((row, i) => (
                    <tr key={row.key} className={i % 2 ? 'bg-slate-50/60 dark:bg-slate-900/40' : 'bg-white dark:bg-slate-950'}>
                        <td className="sticky left-0 z-10 bg-inherit px-2 py-1">{row.descripcion}</td>
                        <td className="px-2 py-1 text-center">{row.unidad}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{qty(row.cantidad)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{money(row.precio)}</td>
                        <td className={`px-2 py-1 text-right font-medium tabular-nums ${RESULT}`}>{money(row.parcial)}</td>
                        {pagos.map((pago) => <td key={pago.id} className={DIVIDER} />)}
                        <td style={pagadoStyle} className="bg-inherit" />
                        <td style={saldoStyle} className="bg-inherit" />
                    </tr>
                ))}

                {!isCollapsed && FRANJAS.map((franja) => (
                    <tr key={franja.key} className="bg-sky-50/60 dark:bg-sky-950/20">
                        <td colSpan={LEFT_COLS} className="sticky left-0 z-10 bg-inherit px-2 py-1 text-right text-[10px] font-semibold tracking-wide text-sky-800 dark:text-sky-300">
                            {franja.label}
                        </td>
                        {pagos.map((pago) => {
                            const celda = grupo.valores[pago.id]?.[franja.key] ?? null;
                            return (
                                <td key={pago.id} className={`${DIVIDER} p-0 align-top`}>
                                    <MoTextCell
                                        value={celda?.etiqueta ?? ''}
                                        editable
                                        placeholder="nota"
                                        className="text-center text-[10px] text-slate-500"
                                        onCommit={(v) => {
                                            if (v.trim() !== (celda?.etiqueta ?? '')) void run(() => gastFinApi.setMoValor(projectId, pago.id, grupo.ref, franja.key, { etiqueta: v }));
                                        }}
                                    />
                                    <MoNumberCell
                                        value={celda?.monto ?? ''}
                                        editable
                                        decimals={2}
                                        onCommit={(v) => {
                                            if (!sameDecimal(celda?.monto, v)) void run(() => gastFinApi.setMoValor(projectId, pago.id, grupo.ref, franja.key, { monto: v }));
                                        }}
                                    />
                                </td>
                            );
                        })}
                        <td style={pagadoStyle} className={`px-2 py-1 text-right tabular-nums ${RESULT}`}>
                            {money(franja.key === 'valorizacion' ? t.valorizado : t.adelantos)}
                        </td>
                        <td style={saldoStyle} className="bg-inherit" />
                    </tr>
                ))}

                <tr className={`font-semibold ${RESULT}`}>
                    <td colSpan={LEFT_COLS - 1} className="sticky left-0 z-10 bg-inherit px-2 py-1 text-right">TOTAL {grupo.descripcion}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{money(t.et_parcial)}</td>
                    {pagos.map((pago) => <td key={pago.id} className={DIVIDER} />)}
                    <td style={pagadoStyle} className="bg-inherit px-2 py-1 text-right tabular-nums">{money(t.pagado)}</td>
                    <td style={saldoStyle} className={`bg-inherit px-2 py-1 text-right tabular-nums ${t.sobregiro ? 'text-red-600 dark:text-red-400' : ''}`}>
                        {money(t.saldo)}
                    </td>
                </tr>
            </tbody>
        );
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col text-xs">
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-1.5 dark:border-slate-800">
                {nuevoPago ? (
                    <form
                        className="flex items-center gap-1"
                        onSubmit={(event) => {
                            event.preventDefault();
                            submitPago();
                        }}
                    >
                        <input
                            autoFocus
                            value={nuevoPago.nombre}
                            onChange={(event) => setNuevoPago({ ...nuevoPago, nombre: event.target.value })}
                            placeholder="VAL 01 - S1 / ADELANTO 1"
                            maxLength={60}
                            className="w-44 rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                        />
                        <input
                            type="date"
                            value={nuevoPago.fecha}
                            onChange={(event) => setNuevoPago({ ...nuevoPago, fecha: event.target.value })}
                            className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                        />
                        <button type="submit" className="rounded bg-amber-600 px-2 py-1 font-medium text-white hover:bg-amber-700">Agregar</button>
                        <button type="button" onClick={() => setNuevoPago(null)} className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
                    </form>
                ) : (
                    <button
                        type="button"
                        onClick={() => setNuevoPago({ nombre: '', fecha: '' })}
                        className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                        <Plus size={12} /> Columna de pago
                    </button>
                )}
                <span className="text-slate-500">Cada columna es una valorización o adelanto; en cada nivel se registra en su franja.</span>
                {busy && <Loader2 size={14} className="ml-auto animate-spin text-blue-500" />}
            </div>

            {payload.grupos.length === 0 ? (
                <div className="flex flex-1 items-center justify-center p-6 text-slate-500">
                    El presupuesto no tiene mano de obra en sus ACU todavía.
                </div>
            ) : (
                <div className="min-h-0 flex-1 overflow-auto">
                    <table className="w-max min-w-full border-separate border-spacing-0 whitespace-nowrap [&_td]:border-b [&_td]:border-slate-100 dark:[&_td]:border-slate-800">
                        <thead className="sticky top-0 z-20">
                            <tr className={`${TITLE} [&>th]:border-b [&>th]:border-amber-200 [&>th]:px-2 [&>th]:py-1.5 [&>th]:font-semibold dark:[&>th]:border-amber-900`}>
                                <th className={`sticky left-0 z-10 min-w-64 text-left ${TITLE}`}>Descripción (mano de obra E.T.)</th>
                                <th className="min-w-12">Und</th>
                                <th className="min-w-24 text-right">Cantidad</th>
                                <th className="min-w-20 text-right">P.U.</th>
                                <th className="min-w-28 text-right">Parcial</th>
                                {pagos.map((pago) => (
                                    <th key={pago.id} className={`${DIVIDER} w-32 min-w-32 p-0 align-top`}>
                                        <div className="flex items-center">
                                            <MoTextCell
                                                value={pago.nombre}
                                                editable
                                                className="text-center font-semibold"
                                                onCommit={(v) => {
                                                    if (v.trim() !== '') void run(() => gastFinApi.updateMoPago(projectId, pago.id, { nombre: v.trim() }));
                                                }}
                                            />
                                            <button
                                                type="button"
                                                title="Eliminar columna de pago"
                                                onClick={() => {
                                                    if (window.confirm(`¿Eliminar la columna "${pago.nombre}" con todos sus montos?`)) {
                                                        void run(() => gastFinApi.deleteMoPago(projectId, pago.id));
                                                    }
                                                }}
                                                className="px-1 text-slate-400 hover:text-red-600"
                                            >
                                                <Trash2 size={11} />
                                            </button>
                                        </div>
                                        <input
                                            type="date"
                                            value={pago.fecha ?? ''}
                                            onChange={(event) => void run(() => gastFinApi.updateMoPago(projectId, pago.id, { fecha: event.target.value || null }))}
                                            className="w-full bg-transparent px-1 pb-1 text-center text-[10px] font-normal outline-none"
                                        />
                                    </th>
                                ))}
                                <th style={pagadoStyle} className={`text-right ${TITLE}`}>Pagado</th>
                                <th style={saldoStyle} className={`text-right ${TITLE}`}>Saldo</th>
                            </tr>
                        </thead>
                        {payload.grupos.map(renderGrupo)}
                        <tfoot className="sticky bottom-0 z-20">
                            <tr className={`font-bold ${TITLE}`}>
                                <td colSpan={LEFT_COLS - 1} className={`sticky left-0 z-10 px-2 py-1.5 text-right ${TITLE}`}>TOTAL GENERAL</td>
                                <td className="px-2 py-1.5 text-right tabular-nums">{money(general.et_parcial)}</td>
                                {pagos.map((pago) => <td key={pago.id} className={DIVIDER} />)}
                                <td style={pagadoStyle} className={`px-2 py-1.5 text-right tabular-nums ${TITLE}`}>{money(general.final)}</td>
                                <td style={saldoStyle} className={`px-2 py-1.5 text-right tabular-nums ${TITLE}`}>
                                    <span className="inline-flex items-center gap-1">
                                        {general.saldo.startsWith('-') && <AlertTriangle size={11} className="text-red-600" />}
                                        {money(general.saldo)}
                                    </span>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}
