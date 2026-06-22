import { ArrowDown, ArrowUp, ArrowUpDown, Briefcase, Check, Layers, Package, Search, Users, Wrench, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ACUComponenteRow, ACURowSummary } from '@/types/presupuestos';

type InsumoType = 'mano_de_obra' | 'materiales' | 'equipos' | 'subcontratos' | 'subpartidas';

interface Props {
    open: boolean;
    acuRows: ACURowSummary[];
    projectName: string;
    onClose: () => void;
}

interface RawInsumo {
    sourceKey: string;
    type: InsumoType;
    codigo: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    precio: number;
    parcial: number;
    usos: number;
}

interface ConsolidatedInsumo {
    key: string;
    type: InsumoType;
    codigo: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    precio: number;
    parcial: number;
    usos: number;
    sourceKeys: string[];
    variantes: string[];
}

export type InsumoSortKey = 'descripcion' | 'codigo' | 'cantidad' | 'parcial' | 'usos';
type SortState = { key: InsumoSortKey; direction: 'asc' | 'desc' };

const INSUMO_TYPES: Array<{ key: InsumoType; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
    { key: 'mano_de_obra', label: 'Mano de obra', icon: Users },
    { key: 'materiales', label: 'Materiales', icon: Package },
    { key: 'equipos', label: 'Equipos', icon: Wrench },
    { key: 'subcontratos', label: 'Sub contratos', icon: Briefcase },
    { key: 'subpartidas', label: 'Sub partidas', icon: Layers },
];

const fmt = (value: number, digits = 2) =>
    value.toLocaleString('es-PE', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });

const normalizeText = (value: string) =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

const normalizeKey = (value: string) =>
    normalizeText(value)
        .replace(/[^\w\s.-]/g, '')
        .replace(/\s+/g, ' ');

function itemPrecio(type: InsumoType, item: ACUComponenteRow): number {
    return type === 'equipos'
        ? Number(item.precio_hora ?? item.precio_unitario ?? 0)
        : Number(item.precio_unitario ?? item.precio_hora ?? 0);
}

function itemParcial(type: InsumoType, item: ACUComponenteRow): number {
    if (item.parcial !== null && item.parcial !== undefined) {
        return Number(item.parcial ?? 0);
    }

    const cantidad = Number(item.cantidad ?? 0);
    const precio = itemPrecio(type, item);
    const factor = type === 'materiales' ? Math.max(1, Number(item.factor_desperdicio ?? 1)) : 1;

    return cantidad * precio * factor;
}

function flattenInsumos(acuRows: ACURowSummary[]): RawInsumo[] {
    const rows: RawInsumo[] = [];

    for (const acu of acuRows) {
        for (const { key } of INSUMO_TYPES) {
            for (const item of acu[key] ?? []) {
                const descripcion = String(item.descripcion ?? '').trim();
                if (!descripcion) {
                    continue;
                }

                const unidad = String(item.unidad ?? '').trim() || '-';
                const codigo = String(item.cod_insumo ?? item.codigo ?? '').trim();
                const cantidad = Number(item.cantidad ?? 0);
                const precio = itemPrecio(key, item);
                const parcial = itemParcial(key, item);
                const baseKey = [
                    key,
                    normalizeKey(descripcion),
                    normalizeKey(unidad),
                    codigo ? normalizeKey(codigo) : '',
                ].join('|');

                rows.push({
                    sourceKey: baseKey,
                    type: key,
                    codigo,
                    descripcion,
                    unidad,
                    cantidad,
                    precio,
                    parcial,
                    usos: 1,
                });
            }
        }
    }

    return rows;
}

function consolidateInsumos(rawRows: RawInsumo[], aliases: Record<string, string>): ConsolidatedInsumo[] {
    const map = new Map<string, ConsolidatedInsumo>();

    for (const row of rawRows) {
        const displayName = aliases[row.sourceKey] ?? row.descripcion;
        const key = [row.type, normalizeKey(displayName), normalizeKey(row.unidad)].join('|');
        const existing = map.get(key);

        if (existing) {
            existing.cantidad += row.cantidad;
            existing.parcial += row.parcial;
            existing.usos += row.usos;
            if (row.codigo && !existing.codigo.includes(row.codigo)) {
                existing.codigo = existing.codigo ? `${existing.codigo}, ${row.codigo}` : row.codigo;
            }
            if (!existing.sourceKeys.includes(row.sourceKey)) {
                existing.sourceKeys.push(row.sourceKey);
            }
            if (!existing.variantes.includes(row.descripcion)) {
                existing.variantes.push(row.descripcion);
            }
        } else {
            map.set(key, {
                key,
                type: row.type,
                codigo: row.codigo,
                descripcion: displayName,
                unidad: row.unidad,
                cantidad: row.cantidad,
                precio: row.precio,
                parcial: row.parcial,
                usos: row.usos,
                sourceKeys: [row.sourceKey],
                variantes: [row.descripcion],
            });
        }
    }

    return Array.from(map.values())
        .map((row) => ({
            ...row,
            precio: row.cantidad !== 0 ? row.parcial / row.cantidad : row.precio,
        }))
        .sort((a, b) => b.parcial - a.parcial);
}

export function sortInsumos<T extends Pick<ConsolidatedInsumo, InsumoSortKey>>(rows: T[], sort: SortState): T[] {
    const direction = sort.direction === 'asc' ? 1 : -1;

    return [...rows].sort((first, second) => {
        const firstValue = first[sort.key];
        const secondValue = second[sort.key];

        if (typeof firstValue === 'string' && typeof secondValue === 'string') {
            return firstValue.localeCompare(secondValue, 'es', { numeric: true, sensitivity: 'base' }) * direction;
        }

        return (Number(firstValue) - Number(secondValue)) * direction;
    });
}

export function sumInsumoTotals(totals: Array<{ total: number }>): number {
    return totals.reduce((sum, item) => sum + item.total, 0);
}

function SortableHeader({ label, sortKey, sort, align = 'left', onSort }: {
    label: string;
    sortKey: InsumoSortKey;
    sort: SortState;
    align?: 'left' | 'right' | 'center';
    onSort: (key: InsumoSortKey) => void;
}) {
    const active = sort.key === sortKey;
    const Icon = !active ? ArrowUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown;
    const alignment = align === 'right'
        ? 'justify-end text-right'
        : align === 'center'
            ? 'justify-center text-center'
            : 'justify-start text-left';

    return (
        <th className={`border-b border-slate-700 p-0 ${alignment}`}>
            <button
                type="button"
                className={`flex w-full items-center gap-1 p-2 transition-colors hover:bg-slate-700 hover:text-slate-100 ${active ? 'text-sky-300' : ''} ${alignment}`}
                onClick={() => onSort(sortKey)}
                title={`Ordenar por ${label.toLowerCase()}`}>
                <span>{label}</span>
                <Icon size={11} className={active ? 'opacity-100' : 'opacity-40'} />
            </button>
        </th>
    );
}

export function InsumosConsolidadosModal({ open, acuRows, projectName, onClose }: Props) {
    const [activeType, setActiveType] = useState<InsumoType>('mano_de_obra');
    const [search, setSearch] = useState('');
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [mergeName, setMergeName] = useState('');
    const [aliases, setAliases] = useState<Record<string, string>>({});
    const [sort, setSort] = useState<SortState>({ key: 'parcial', direction: 'desc' });

    const rawRows = useMemo(() => flattenInsumos(acuRows), [acuRows]);
    const consolidated = useMemo(() => consolidateInsumos(rawRows, aliases), [rawRows, aliases]);
    const typeRows = useMemo(() => {
        const query = normalizeText(search);
        const filteredRows = consolidated.filter((row) => {
            if (row.type !== activeType) {
                return false;
            }
            if (!query) {
                return true;
            }
            return (
                normalizeText(row.descripcion).includes(query) ||
                normalizeText(row.codigo).includes(query) ||
                normalizeText(row.unidad).includes(query)
            );
        });

        return sortInsumos(filteredRows, sort);
    }, [activeType, consolidated, search, sort]);

    const selectedRows = useMemo(
        () => typeRows.filter((row) => selectedKeys.has(row.key)),
        [typeRows, selectedKeys],
    );

    const totalsByType = useMemo(() => {
        return INSUMO_TYPES.reduce<Record<InsumoType, { count: number; total: number }>>((acc, { key }) => {
            const rows = consolidated.filter((row) => row.type === key);
            acc[key] = {
                count: rows.length,
                total: rows.reduce((sum, row) => sum + row.parcial, 0),
            };
            return acc;
        }, {} as Record<InsumoType, { count: number; total: number }>);
    }, [consolidated]);

    const activeTotal = totalsByType[activeType]?.total ?? 0;
    const grandTotal = sumInsumoTotals(Object.values(totalsByType));
    const canMerge = selectedRows.length >= 2 && new Set(selectedRows.map((row) => row.unidad)).size === 1;

    const toggleSelected = (key: string) => {
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const handleMerge = () => {
        if (!canMerge) {
            return;
        }

        const targetName = mergeName.trim() || selectedRows[0].descripcion;
        setAliases((prev) => {
            const next = { ...prev };
            for (const row of selectedRows) {
                for (const sourceKey of row.sourceKeys) {
                    next[sourceKey] = targetName;
                }
            }
            return next;
        });
        setSelectedKeys(new Set());
        setMergeName('');
    };

    const handleTypeChange = (type: InsumoType) => {
        setActiveType(type);
        setSelectedKeys(new Set());
        setMergeName('');
    };

    const handleSort = (key: InsumoSortKey) => {
        setSort((current) => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    if (!open) {
        return null;
    }

    return createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 p-4">
            <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl">
                <div className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-3">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-100">Insumos consolidados</h2>
                        <p className="mt-0.5 text-xs text-slate-400">{projectName}</p>
                    </div>
                    <button
                        className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                        onClick={onClose}
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-[15rem_1fr]">
                    <aside className="min-h-0 border-r border-slate-800 bg-slate-950/30 p-3">
                        <div className="flex flex-col gap-1">
                            {INSUMO_TYPES.map(({ key, label, icon: Icon }) => {
                                const active = activeType === key;
                                const totals = totalsByType[key] ?? { count: 0, total: 0 };
                                return (
                                    <button
                                        key={key}
                                        className={`flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left transition-colors ${
                                            active
                                                ? 'bg-sky-700 text-white'
                                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                        onClick={() => handleTypeChange(key)}
                                    >
                                        <span className="flex min-w-0 items-center gap-2">
                                            <Icon size={14} className="shrink-0" />
                                            <span className="truncate text-xs font-medium">{label}</span>
                                        </span>
                                        <span className="flex shrink-0 flex-col items-end gap-0.5 tabular-nums">
                                            <span className="rounded bg-black/20 px-1.5 py-0.5 text-[10px]">{totals.count}</span>
                                            <span className={`font-mono text-[10px] ${active ? 'text-sky-100' : 'text-slate-500'}`}>
                                                S/ {fmt(totals.total)}
                                            </span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-4 divide-y divide-slate-800 rounded border border-slate-800 bg-slate-900">
                            <div className="p-3">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Subtotal seleccionado</p>
                                <p className="mt-1 font-mono text-lg font-semibold text-sky-300">S/ {fmt(activeTotal)}</p>
                            </div>
                            <div className="bg-emerald-950/30 p-3">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500">Total general</p>
                                <p className="mt-1 font-mono text-lg font-bold text-emerald-300">S/ {fmt(grandTotal)}</p>
                            </div>
                        </div>
                    </aside>

                    <section className="flex min-h-0 flex-col">
                        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3">
                            <div className="relative min-w-64 flex-1">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                <input
                                    className="w-full rounded border border-slate-700 bg-slate-950 px-8 py-1.5 text-xs text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-sky-500"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Buscar insumo, codigo o unidad"
                                />
                            </div>

                            <div className="flex min-w-0 items-center gap-2">
                                <input
                                    className="w-72 rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-sky-500 disabled:opacity-50"
                                    value={mergeName}
                                    disabled={selectedRows.length < 2}
                                    onChange={(event) => setMergeName(event.target.value)}
                                    placeholder="Nombre para fusion manual"
                                />
                                <button
                                    className="flex shrink-0 items-center gap-1.5 rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                                    disabled={!canMerge}
                                    onClick={handleMerge}
                                >
                                    <Check size={13} />
                                    Fusionar
                                </button>
                            </div>
                        </div>

                        {selectedRows.length >= 2 && !canMerge && (
                            <div className="border-b border-amber-900/60 bg-amber-950/40 px-4 py-2 text-xs text-amber-300">
                                Solo se pueden fusionar insumos de la misma unidad.
                            </div>
                        )}

                        <div className="min-h-0 flex-1 overflow-auto">
                            <table className="w-full border-collapse text-left text-[11px]">
                                <thead className="sticky top-0 z-10 bg-slate-800 text-[10px] uppercase tracking-wider text-slate-400">
                                    <tr>
                                        <th className="w-9 border-b border-slate-700 p-2"></th>
                                        <SortableHeader label="Codigo" sortKey="codigo" sort={sort} onSort={handleSort} />
                                        <SortableHeader label="Descripcion consolidada" sortKey="descripcion" sort={sort} onSort={handleSort} />
                                        <th className="border-b border-slate-700 p-2 text-center">Und.</th>
                                        <SortableHeader label="Cantidad" sortKey="cantidad" sort={sort} align="right" onSort={handleSort} />
                                        <th className="border-b border-slate-700 p-2 text-right">P. ref.</th>
                                        <SortableHeader label="Monto" sortKey="parcial" sort={sort} align="right" onSort={handleSort} />
                                        <SortableHeader label="Usos" sortKey="usos" sort={sort} align="center" onSort={handleSort} />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {typeRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="p-10 text-center text-slate-500">
                                                No hay insumos para esta categoria.
                                            </td>
                                        </tr>
                                    ) : (
                                        typeRows.map((row) => {
                                            const selected = selectedKeys.has(row.key);
                                            return (
                                                <tr
                                                    key={row.key}
                                                    className={`transition-colors ${
                                                        selected ? 'bg-sky-950/60' : 'hover:bg-slate-800/50'
                                                    }`}
                                                >
                                                    <td className="p-2 text-center">
                                                        <input
                                                            type="checkbox"
                                                            className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900"
                                                            checked={selected}
                                                            onChange={() => toggleSelected(row.key)}
                                                        />
                                                    </td>
                                                    <td className="max-w-32 truncate p-2 font-mono text-slate-400" title={row.codigo}>
                                                        {row.codigo || '-'}
                                                    </td>
                                                    <td className="min-w-72 p-2">
                                                        <div className="font-medium text-slate-100">{row.descripcion}</div>
                                                        {row.variantes.length > 1 && (
                                                            <div className="mt-0.5 text-[10px] text-slate-500">
                                                                {row.variantes.length} variantes fusionadas
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-2 text-center text-slate-400">{row.unidad}</td>
                                                    <td className="p-2 text-right font-mono text-amber-300">{fmt(row.cantidad, 4)}</td>
                                                    <td className="p-2 text-right font-mono text-emerald-300">{fmt(row.precio)}</td>
                                                    <td className="p-2 text-right font-mono font-semibold text-sky-300">{fmt(row.parcial)}</td>
                                                    <td className="p-2 text-center text-slate-400">{row.usos}</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            </div>
        </div>,
        document.body,
    );
}
