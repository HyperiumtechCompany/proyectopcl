import { AlertTriangle, ArrowRight, CheckCircle, X } from 'lucide-react';
import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { ACURowSummary } from '@/types/presupuestos';
import type { DelphinRow } from '../types';

type CompatStatus = 'sin_acu' | 'acu_vacio' | 'precio_diferente';

interface IncompatiblePartida {
    row: DelphinRow;
    status: CompatStatus;
    presupuestoPrice: number;
    acuPrice: number;
    diff: number;
}

interface Props {
    open: boolean;
    delphinRows: DelphinRow[];
    acuRows: ACURowSummary[];
    groupIds: Set<number>;
    onClose: () => void;
    onSelectPartida: (rowId: number) => void;
}

const STATUS_LABELS: Record<CompatStatus, { label: string; color: string }> = {
    sin_acu:          { label: 'Sin ACU',       color: 'text-red-400 bg-red-950/40 border border-red-800/50' },
    acu_vacio:        { label: 'ACU vacío',      color: 'text-amber-400 bg-amber-950/40 border border-amber-800/50' },
    precio_diferente: { label: 'Precio difiere', color: 'text-orange-400 bg-orange-950/40 border border-orange-800/50' },
};

const STATUS_ORDER: Record<CompatStatus, number> = { sin_acu: 0, acu_vacio: 1, precio_diferente: 2 };

function normalizedPartida(value: string): string {
    return String(value).split('.').filter(Boolean).map(p => p.padStart(2, '0')).join('.');
}

const fmt = (n: number) =>
    n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PartidasSinAcuModal({ open, delphinRows, acuRows, groupIds, onClose, onSelectPartida }: Props) {
    const incompatibles = useMemo<IncompatiblePartida[]>(() => {
        const acuByPartida = new Map(
            acuRows.map(acu => [normalizedPartida(acu.partida), acu]),
        );

        const results: IncompatiblePartida[] = [];

        for (const row of delphinRows) {
            if (groupIds.has(row.id)) continue;
            if (!row.unidad?.trim()) continue;

            const normPartida = normalizedPartida(String(row.partida ?? ''));
            const acu = acuByPartida.get(normPartida);

            if (!acu) {
                results.push({
                    row, status: 'sin_acu',
                    presupuestoPrice: row.precio_unitario,
                    acuPrice: 0,
                    diff: row.precio_unitario,
                });
            } else if (acu.costo_unitario_total === 0) {
                results.push({
                    row, status: 'acu_vacio',
                    presupuestoPrice: row.precio_unitario,
                    acuPrice: 0,
                    diff: row.precio_unitario,
                });
            } else {
                const diff = Math.abs(row.precio_unitario - acu.costo_unitario_total);
                if (diff > 0.01) {
                    results.push({
                        row, status: 'precio_diferente',
                        presupuestoPrice: row.precio_unitario,
                        acuPrice: acu.costo_unitario_total,
                        diff,
                    });
                }
            }
        }

        return results.sort((a, b) => {
            const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
            return s !== 0 ? s : b.diff - a.diff;
        });
    }, [delphinRows, acuRows, groupIds]);

    // Estimated monetary impact (metrado × price gap)
    const totalImpact = useMemo(() =>
        incompatibles.reduce((sum, item) => {
            return sum + item.row.metrado * (item.presupuestoPrice - item.acuPrice);
        }, 0),
        [incompatibles],
    );

    const counts = useMemo(() => ({
        sin_acu:          incompatibles.filter(i => i.status === 'sin_acu').length,
        acu_vacio:        incompatibles.filter(i => i.status === 'acu_vacio').length,
        precio_diferente: incompatibles.filter(i => i.status === 'precio_diferente').length,
    }), [incompatibles]);

    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4">
            <div className="flex h-[82vh] w-[75vw] max-h-[calc(100vh-2rem)] max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl">

                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-3">
                    <div>
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                            <AlertTriangle size={15} className="text-amber-400" />
                            Compatibilidad Presupuesto ↔ ACU
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-400">
                            Partidas cuyo precio en presupuesto no coincide con el costo calculado en el ACU
                        </p>
                    </div>
                    <button
                        type="button"
                        className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                        onClick={onClose}
                        aria-label="Cerrar"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Summary chips */}
                {incompatibles.length > 0 && (
                    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-700 bg-slate-800/40 px-4 py-2">
                        {counts.sin_acu > 0 && (
                            <span className="flex items-center gap-1.5 rounded border border-red-800/50 bg-red-950/40 px-2 py-0.5 text-[11px] text-red-400">
                                <span className="font-bold">{counts.sin_acu}</span> sin ACU
                            </span>
                        )}
                        {counts.acu_vacio > 0 && (
                            <span className="flex items-center gap-1.5 rounded border border-amber-800/50 bg-amber-950/40 px-2 py-0.5 text-[11px] text-amber-400">
                                <span className="font-bold">{counts.acu_vacio}</span> ACU vacío
                            </span>
                        )}
                        {counts.precio_diferente > 0 && (
                            <span className="flex items-center gap-1.5 rounded border border-orange-800/50 bg-orange-950/40 px-2 py-0.5 text-[11px] text-orange-400">
                                <span className="font-bold">{counts.precio_diferente}</span> precio difiere
                            </span>
                        )}
                        <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
                            <span>
                                Impacto estimado:&nbsp;
                                <span className={`font-mono font-semibold ${Math.abs(totalImpact) < 0.01 ? 'text-slate-300' : totalImpact > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                    S/ {fmt(Math.abs(totalImpact))}
                                </span>
                            </span>
                            <span className="text-[10px] text-slate-500">· Clic en fila para navegar</span>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="min-h-0 flex-1 overflow-auto">
                    {incompatibles.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                            <CheckCircle size={44} className="text-emerald-400" />
                            <p className="text-sm font-semibold text-emerald-300">Todo compatibilizado</p>
                            <p className="text-xs text-slate-400">
                                Todas las partidas tienen un ACU con precio coincidente.
                            </p>
                        </div>
                    ) : (
                        <table className="w-full border-collapse text-left text-[11px]">
                            <thead className="sticky top-0 z-10 bg-slate-800 text-[10px] tracking-wider text-slate-400 uppercase">
                                <tr>
                                    <th className="border-b border-slate-700 p-2">Partida</th>
                                    <th className="border-b border-slate-700 p-2">Descripción</th>
                                    <th className="border-b border-slate-700 p-2 text-center">Und.</th>
                                    <th className="border-b border-slate-700 p-2 text-right">P. Presupuesto</th>
                                    <th className="border-b border-slate-700 p-2 text-right">Costo ACU</th>
                                    <th className="border-b border-slate-700 p-2 text-right">Diferencia</th>
                                    <th className="border-b border-slate-700 p-2 text-center">Estado</th>
                                    <th className="w-8 border-b border-slate-700 p-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {incompatibles.map(({ row, status, presupuestoPrice, acuPrice, diff }) => {
                                    const badge = STATUS_LABELS[status];
                                    return (
                                        <tr
                                            key={row.id}
                                            className="cursor-pointer transition-colors hover:bg-slate-700/50"
                                            title="Ir a esta partida en el presupuesto"
                                            onClick={() => {
                                                onSelectPartida(row.id);
                                                onClose();
                                            }}
                                        >
                                            <td className="p-2 font-mono text-sky-300 whitespace-nowrap">{row.partida}</td>
                                            <td className="p-2 max-w-xs">
                                                <div className="truncate font-medium text-slate-100">{row.descripcion}</div>
                                            </td>
                                            <td className="p-2 text-center text-slate-400">{row.unidad}</td>
                                            <td className="p-2 text-right font-mono text-slate-200">
                                                {presupuestoPrice > 0
                                                    ? fmt(presupuestoPrice)
                                                    : <span className="text-slate-500">—</span>}
                                            </td>
                                            <td className="p-2 text-right font-mono text-slate-200">
                                                {acuPrice > 0
                                                    ? fmt(acuPrice)
                                                    : <span className="text-slate-500">—</span>}
                                            </td>
                                            <td className="p-2 text-right font-mono font-semibold text-amber-300">
                                                {diff > 0.01 ? fmt(diff) : '—'}
                                            </td>
                                            <td className="p-2 text-center">
                                                <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${badge.color}`}>
                                                    {badge.label}
                                                </span>
                                            </td>
                                            <td className="p-2 text-center">
                                                <ArrowRight size={12} className="mx-auto text-slate-500" />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="flex shrink-0 items-center justify-between border-t border-slate-700 bg-slate-800/40 px-4 py-2 text-[11px] text-slate-500">
                    <span>
                        {incompatibles.length > 0
                            ? `${incompatibles.length} partida${incompatibles.length !== 1 ? 's' : ''} con incompatibilidad`
                            : 'Sin incompatibilidades'}
                    </span>
                    <span>
                        Los totales de Insumos consolidados y Costo Directo solo coincidirán cuando todas las partidas estén compatibilizadas.
                    </span>
                </div>
            </div>
        </div>,
        document.body,
    );
}
