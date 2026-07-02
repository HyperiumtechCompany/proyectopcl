import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, CheckCircle, Search, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ACURowSummary } from '@/types/presupuestos';
import type { DelphinRow } from '../types';

type CompatStatus = 'sin_acu' | 'acu_vacio' | 'precio_diferente';
type CompatSortKey = 'partida' | 'descripcion' | 'presupuestoPrice' | 'acuPrice' | 'diff';
type CompatSortState = { key: CompatSortKey; direction: 'asc' | 'desc' };

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

function normalizedPartida(value: string): string {
    return String(value).split('.').filter(Boolean).map(p => p.padStart(2, '0')).join('.');
}

const fmt = (n: number) =>
    n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function SortableCompatHeader({
    label,
    sortKey,
    sort,
    align = 'left',
    onSort,
}: {
    label: string;
    sortKey: CompatSortKey;
    sort: CompatSortState;
    align?: 'left' | 'right' | 'center';
    onSort: (key: CompatSortKey) => void;
}) {
    const active = sort.key === sortKey;
    const Icon = !active ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown;
    const alignment =
        align === 'right' ? 'justify-end text-right'
            : align === 'center' ? 'justify-center text-center'
                : 'justify-start text-left';

    return (
        <th className={`border-b border-slate-700 p-0 ${alignment}`}>
            <button
                type="button"
                className={`flex w-full items-center gap-1 p-2 transition-colors hover:bg-slate-700 hover:text-slate-100 ${active ? 'text-sky-300' : ''} ${alignment}`}
                onClick={() => onSort(sortKey)}
                title={`Ordenar por ${label.toLowerCase()}`}
            >
                <span>{label}</span>
                <Icon size={11} className={active ? 'opacity-100' : 'opacity-40'} />
            </button>
        </th>
    );
}

export function PartidasSinAcuModal({ open, delphinRows, acuRows, groupIds, onClose, onSelectPartida }: Props) {
    const incompatibles = useMemo<IncompatiblePartida[]>(() => {
        if (!open) return [];

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

        return results.sort((a, b) =>
            normalizedPartida(String(a.row.partida ?? '')).localeCompare(
                normalizedPartida(String(b.row.partida ?? '')),
            ),
        );
    }, [open, delphinRows, acuRows, groupIds]);

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

    const [activeStatus, setActiveStatus] = useState<CompatStatus | 'all'>('all');
    const [search, setSearch] = useState('');
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
    const handleColumnFilterChange = (key: string, value: string) =>
        setColumnFilters((prev) => ({ ...prev, [key]: value }));
    const hasColumnFilters = Object.values(columnFilters).some((v) => v.trim() !== '');
    const [sort, setSort] = useState<CompatSortState>({ key: 'partida', direction: 'asc' });
    const handleSort = (key: CompatSortKey) => {
        setSort((current) => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    const filteredIncompatibles = useMemo(() => {
        const q = search.trim().toLowerCase();
        const activeColumnFilters = Object.entries(columnFilters)
            .map(([key, value]) => [key, value.trim().toLowerCase()] as const)
            .filter(([, value]) => value !== '');

        const filtered = incompatibles.filter((item) => {
            if (activeStatus !== 'all' && item.status !== activeStatus) return false;
            if (q) {
                const matchesQuery =
                    String(item.row.partida ?? '').toLowerCase().includes(q) ||
                    (item.row.descripcion ?? '').toLowerCase().includes(q);
                if (!matchesQuery) return false;
            }
            for (const [key, value] of activeColumnFilters) {
                let cellValue: string;
                switch (key) {
                    case 'partida':      cellValue = String(item.row.partida ?? ''); break;
                    case 'descripcion':  cellValue = item.row.descripcion ?? ''; break;
                    case 'unidad':       cellValue = item.row.unidad ?? ''; break;
                    case 'presupuesto':  cellValue = item.presupuestoPrice > 0 ? fmt(item.presupuestoPrice) : ''; break;
                    case 'acu':          cellValue = item.acuPrice > 0 ? fmt(item.acuPrice) : ''; break;
                    case 'diferencia':   cellValue = item.diff > 0.01 ? fmt(item.diff) : ''; break;
                    default:             cellValue = '';
                }
                if (!cellValue.toLowerCase().includes(value)) return false;
            }
            return true;
        });

        const dir = sort.direction === 'asc' ? 1 : -1;
        return filtered.sort((a, b) => {
            switch (sort.key) {
                case 'partida':
                    return dir * normalizedPartida(String(a.row.partida ?? '')).localeCompare(
                        normalizedPartida(String(b.row.partida ?? '')),
                    );
                case 'descripcion':
                    return dir * (a.row.descripcion ?? '').localeCompare(b.row.descripcion ?? '');
                case 'presupuestoPrice':
                    return dir * (a.presupuestoPrice - b.presupuestoPrice);
                case 'acuPrice':
                    return dir * (a.acuPrice - b.acuPrice);
                case 'diff':
                    return dir * (a.diff - b.diff);
                default:
                    return 0;
            }
        });
    }, [incompatibles, activeStatus, search, columnFilters, sort]);

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

                {/* Filter buttons + search */}
                {incompatibles.length > 0 && (
                    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-700 bg-slate-800/40 px-4 py-2">
                        <button
                            type="button"
                            onClick={() => setActiveStatus('all')}
                            className={`flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] transition-colors ${
                                activeStatus === 'all'
                                    ? 'border-sky-600 bg-sky-950/60 text-sky-300'
                                    : 'border-slate-700 bg-slate-900/40 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                            }`}
                        >
                            <span className="font-bold">{incompatibles.length}</span> todos
                        </button>
                        {counts.sin_acu > 0 && (
                            <button
                                type="button"
                                onClick={() => setActiveStatus((s) => (s === 'sin_acu' ? 'all' : 'sin_acu'))}
                                className={`flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] transition-colors ${
                                    activeStatus === 'sin_acu'
                                        ? 'border-red-500 bg-red-900/60 text-red-300'
                                        : 'border-red-800/50 bg-red-950/40 text-red-400 hover:border-red-600'
                                }`}
                            >
                                <span className="font-bold">{counts.sin_acu}</span> sin ACU
                            </button>
                        )}
                        {counts.acu_vacio > 0 && (
                            <button
                                type="button"
                                onClick={() => setActiveStatus((s) => (s === 'acu_vacio' ? 'all' : 'acu_vacio'))}
                                className={`flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] transition-colors ${
                                    activeStatus === 'acu_vacio'
                                        ? 'border-amber-500 bg-amber-900/60 text-amber-300'
                                        : 'border-amber-800/50 bg-amber-950/40 text-amber-400 hover:border-amber-600'
                                }`}
                            >
                                <span className="font-bold">{counts.acu_vacio}</span> ACU vacío
                            </button>
                        )}
                        {counts.precio_diferente > 0 && (
                            <button
                                type="button"
                                onClick={() => setActiveStatus((s) => (s === 'precio_diferente' ? 'all' : 'precio_diferente'))}
                                className={`flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] transition-colors ${
                                    activeStatus === 'precio_diferente'
                                        ? 'border-orange-500 bg-orange-900/60 text-orange-300'
                                        : 'border-orange-800/50 bg-orange-950/40 text-orange-400 hover:border-orange-600'
                                }`}
                            >
                                <span className="font-bold">{counts.precio_diferente}</span> precio difiere
                            </button>
                        )}

                        <div className="relative min-w-48 flex-1">
                            <Search className="absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-500" size={12} />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar partida o descripción"
                                className="w-full rounded border border-slate-700 bg-slate-950 px-7 py-1 text-[11px] text-slate-100 transition-colors outline-none placeholder:text-slate-600 focus:border-sky-500"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className="absolute top-1/2 right-2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                    aria-label="Limpiar búsqueda"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>

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
                    ) : filteredIncompatibles.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                            <Search size={36} className="text-slate-600" />
                            <p className="text-sm font-semibold text-slate-300">Sin resultados para este filtro</p>
                            <button
                                type="button"
                                onClick={() => { setActiveStatus('all'); setSearch(''); setColumnFilters({}); }}
                                className="text-xs text-sky-400 hover:text-sky-300"
                            >
                                Limpiar filtros
                            </button>
                        </div>
                    ) : (
                        <table className="w-full border-collapse text-left text-[11px]">
                            <thead className="sticky top-0 z-10 bg-slate-800 text-[10px] tracking-wider text-slate-400 uppercase">
                                <tr>
                                    <SortableCompatHeader label="Partida" sortKey="partida" sort={sort} onSort={handleSort} />
                                    <SortableCompatHeader label="Descripción" sortKey="descripcion" sort={sort} onSort={handleSort} />
                                    <th className="border-b border-slate-700 p-2 text-center">Und.</th>
                                    <SortableCompatHeader label="P. Presupuesto" sortKey="presupuestoPrice" sort={sort} align="right" onSort={handleSort} />
                                    <SortableCompatHeader label="Costo ACU" sortKey="acuPrice" sort={sort} align="right" onSort={handleSort} />
                                    <SortableCompatHeader label="Diferencia" sortKey="diff" sort={sort} align="right" onSort={handleSort} />
                                    <th className="border-b border-slate-700 p-2 text-center">Estado</th>
                                    <th className="w-8 border-b border-slate-700 p-2"></th>
                                </tr>
                                <tr className="normal-case">
                                    <th className="border-b border-slate-700 p-1">
                                        <input
                                            value={columnFilters.partida ?? ''}
                                            onChange={(e) => handleColumnFilterChange('partida', e.target.value)}
                                            placeholder="Filtrar…"
                                            className="w-full min-w-0 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[10px] font-normal text-slate-200 tracking-normal outline-none placeholder:text-slate-600 focus:border-sky-500"
                                        />
                                    </th>
                                    <th className="border-b border-slate-700 p-1">
                                        <input
                                            value={columnFilters.descripcion ?? ''}
                                            onChange={(e) => handleColumnFilterChange('descripcion', e.target.value)}
                                            placeholder="Filtrar…"
                                            className="w-full min-w-0 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[10px] font-normal text-slate-200 tracking-normal outline-none placeholder:text-slate-600 focus:border-sky-500"
                                        />
                                    </th>
                                    <th className="border-b border-slate-700 p-1">
                                        <input
                                            value={columnFilters.unidad ?? ''}
                                            onChange={(e) => handleColumnFilterChange('unidad', e.target.value)}
                                            placeholder="…"
                                            className="w-full min-w-0 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-center text-[10px] font-normal text-slate-200 tracking-normal outline-none placeholder:text-slate-600 focus:border-sky-500"
                                        />
                                    </th>
                                    <th className="border-b border-slate-700 p-1">
                                        <input
                                            value={columnFilters.presupuesto ?? ''}
                                            onChange={(e) => handleColumnFilterChange('presupuesto', e.target.value)}
                                            placeholder="…"
                                            className="w-full min-w-0 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-right text-[10px] font-normal text-slate-200 tracking-normal outline-none placeholder:text-slate-600 focus:border-sky-500"
                                        />
                                    </th>
                                    <th className="border-b border-slate-700 p-1">
                                        <input
                                            value={columnFilters.acu ?? ''}
                                            onChange={(e) => handleColumnFilterChange('acu', e.target.value)}
                                            placeholder="…"
                                            className="w-full min-w-0 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-right text-[10px] font-normal text-slate-200 tracking-normal outline-none placeholder:text-slate-600 focus:border-sky-500"
                                        />
                                    </th>
                                    <th className="border-b border-slate-700 p-1">
                                        <input
                                            value={columnFilters.diferencia ?? ''}
                                            onChange={(e) => handleColumnFilterChange('diferencia', e.target.value)}
                                            placeholder="…"
                                            className="w-full min-w-0 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-right text-[10px] font-normal text-slate-200 tracking-normal outline-none placeholder:text-slate-600 focus:border-sky-500"
                                        />
                                    </th>
                                    <th className="border-b border-slate-700 p-1 text-center">
                                        {hasColumnFilters && (
                                            <button
                                                type="button"
                                                title="Limpiar filtros de columna"
                                                className="text-slate-500 transition-colors hover:text-red-400"
                                                onClick={() => setColumnFilters({})}
                                            >
                                                <X size={11} />
                                            </button>
                                        )}
                                    </th>
                                    <th className="border-b border-slate-700 p-1"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {filteredIncompatibles.map(({ row, status, presupuestoPrice, acuPrice, diff }) => {
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
                        {incompatibles.length === 0
                            ? 'Sin incompatibilidades'
                            : activeStatus !== 'all' || search || hasColumnFilters
                                ? `${filteredIncompatibles.length} de ${incompatibles.length} partida${incompatibles.length !== 1 ? 's' : ''}`
                                : `${incompatibles.length} partida${incompatibles.length !== 1 ? 's' : ''} con incompatibilidad`}
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
