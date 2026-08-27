import {
    ChevronDown,
    ChevronRight,
    RefreshCw,
    X,
    TrendingUp,
    AlertTriangle,
    Lock,
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import React, { useState, useRef, useMemo, useCallback } from 'react';
import type {
    ItemValorizado,
    Periodo,
    ViewMode,
    TotalesColumna,
    FinDefaults,
} from '../types';

// FORMATOS
const fmtN = (v: number) =>
    (v ?? 0).toLocaleString('es-PE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
const fmtS = (v: number) => `S/. ${fmtN(v)}`;
const fmtP = (v: number) => `${(v ?? 0).toFixed(4)}%`;

const nivel = (item: string) => (item?.split('.').length ?? 1) - 1;

const bgNivel = (n: number, isLeaf: boolean): string => {
    if (isLeaf) return '';
    if (n === 0) return 'bg-slate-800 text-white';
    if (n === 1) return 'bg-slate-200 text-slate-900';
    if (n === 2) return 'bg-slate-100 text-slate-800';
    return 'bg-slate-50 text-slate-700';
};

const parentCodes = (code: string): string[] => {
    const parts = code.split('.').filter(Boolean);
    return parts.slice(0, -1).map((_, idx) => parts.slice(0, idx + 1).join('.'));
};

const emptyDistribucion = (periodos: Periodo[]) =>
    Object.fromEntries(
        periodos.map((p) => [p.key, { monto: 0, porcentaje: 0 }]),
    ) as ItemValorizado['distribucion'];

// TIPOS
interface FinancieroState {
    pctGastosGenerales: number;
    pctUtilidad: number;
    pctIGV: number;
    montoMobiliario: number;
    pctIGVMobiliario: number;
    pctSupervision: number;
}

// CELDA EDITABLE PARTIDAS
interface EditableCellProps {
    value: number;
    viewMode: ViewMode;
    parcial: number;
    onChange: (v: number) => void;
    isPico: boolean;
    bloqueada: boolean;
}
const EditableCell: React.FC<EditableCellProps> = ({
    value,
    viewMode,
    parcial,
    onChange,
    isPico,
    bloqueada,
}) => {
    const [editing, setEditing] = useState(false);
    const [rawVal, setRawVal] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    if (bloqueada)
        return (
            <td
                className="cursor-not-allowed border border-slate-200 bg-slate-50 p-2 text-center"
                title="Fuera del rango de ejecución"
            >
                <Lock className="mx-auto h-3 w-3 text-slate-300" />
            </td>
        );

    const startEdit = () => {
        setRawVal(value.toFixed(2));
        setEditing(true);
        setTimeout(() => inputRef.current?.select(), 30);
    };
    const commitEdit = () => {
        const parsed = parseFloat(rawVal.replace(/,/g, '.'));
        if (!isNaN(parsed)) {
            const finalVal =
                viewMode === 'porcentaje' ? (parsed / 100) * parcial : parsed;
            onChange(Math.max(0, finalVal));
        }
        setEditing(false);
    };
    const display =
        viewMode === 'monto'
            ? fmtN(value)
            : fmtP(parcial > 0 ? (value / parcial) * 100 : 0);
    const hasValue = value > 0;

    if (editing)
        return (
            <td
                className={`border border-slate-200 p-0 ${isPico ? 'ring-1 ring-amber-400 ring-inset' : ''}`}
            >
                <input
                    ref={inputRef}
                    type="text"
                    value={rawVal}
                    onChange={(e) => setRawVal(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit();
                        if (e.key === 'Escape') setEditing(false);
                    }}
                    className="h-full w-full border-0 bg-yellow-50 px-2 py-2 text-right font-mono text-xs outline-none focus:ring-2 focus:ring-blue-400"
                />
            </td>
        );

    return (
        <td
            onClick={startEdit}
            title="Clic para editar"
            className={`cursor-pointer border border-slate-200 p-2 text-right font-mono text-[11px] transition-colors select-none ${hasValue ? 'font-semibold text-slate-800 hover:bg-blue-50' : 'text-slate-300 hover:bg-slate-50'} ${isPico && hasValue ? 'bg-amber-50/20 ring-1 ring-amber-300 ring-inset' : ''}`}
        >
            {hasValue ? display : '—'}
        </td>
    );
};

// CELDA % EDITABLE
const PctCell: React.FC<{ value: number; onChange: (v: number) => void }> = ({
    value,
    onChange,
}) => {
    const [editing, setEditing] = useState(false);
    const [raw, setRaw] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const startEdit = () => {
        setRaw(value.toFixed(2));
        setEditing(true);
        setTimeout(() => inputRef.current?.select(), 30);
    };
    const commit = () => {
        const p = parseFloat(raw.replace(/,/g, '.'));
        if (!isNaN(p)) onChange(Math.max(0, p));
        setEditing(false);
    };

    if (editing)
        return (
            <td className="w-20 border border-slate-300 p-0">
                <input
                    ref={inputRef}
                    type="text"
                    value={raw}
                    onChange={(e) => setRaw(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') commit();
                        if (e.key === 'Escape') setEditing(false);
                    }}
                    className="h-full w-full border-0 bg-yellow-50 px-2 py-1.5 text-center font-mono text-[11px] text-slate-900 outline-none"
                />
            </td>
        );
    return (
        <td
            onClick={startEdit}
            title="Clic para editar %"
            className="w-20 cursor-pointer border border-slate-300 bg-slate-100 p-2 text-center text-[11px] font-semibold text-slate-600 transition-colors select-none hover:bg-yellow-50"
        >
            {value.toFixed(2)}%
        </td>
    );
};

// CELDA MONTO EDITABLE
const MontoCell: React.FC<{ value: number; onChange: (v: number) => void }> = ({
    value,
    onChange,
}) => {
    const [editing, setEditing] = useState(false);
    const [raw, setRaw] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const startEdit = () => {
        setRaw(value.toFixed(2));
        setEditing(true);
        setTimeout(() => inputRef.current?.select(), 30);
    };
    const commit = () => {
        const p = parseFloat(raw.replace(/,/g, '.'));
        if (!isNaN(p)) onChange(Math.max(0, p));
        setEditing(false);
    };

    if (editing)
        return (
            <td className="border border-slate-300 p-0">
                <input
                    ref={inputRef}
                    type="text"
                    value={raw}
                    onChange={(e) => setRaw(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') commit();
                        if (e.key === 'Escape') setEditing(false);
                    }}
                    className="h-full w-full border-0 bg-yellow-50 px-2 py-1.5 text-right font-mono text-[11px] text-slate-900 outline-none"
                />
            </td>
        );
    return (
        <td
            onClick={startEdit}
            title="Clic para editar monto"
            className="cursor-pointer border border-slate-300 bg-slate-100 p-2 text-right text-[11px] font-semibold text-slate-700 tabular-nums transition-colors select-none hover:bg-yellow-50"
        >
            {value > 0 ? fmtS(value) : '—'}
        </td>
    );
};

// BADGE DESVÍO
const BadgeDesviacion: React.FC<{ desvio: number }> = ({ desvio }) => {
    if (desvio <= 0.01) return null;
    return (
        <span
            title={`Diferencia: S/. ${fmtN(desvio)}`}
            className="ml-1 inline-flex items-center gap-0.5 rounded-full border border-rose-300 bg-rose-100 px-1.5 py-0.5 text-[8px] font-black text-rose-700"
        >
            <AlertTriangle className="h-2.5 w-2.5" />
            S/. {fmtN(desvio)}
        </span>
    );
};

// PROPS
interface Props {
    items: ItemValorizado[];
    periodos: Periodo[];
    viewMode: ViewMode;
    totales: Record<string, TotalesColumna>;
    totalPresupuesto: number;
    onEditarCelda: (
        itemId: number | string,
        key: string,
        monto: number,
    ) => void;
    onRedistribuir: (itemId: number | string) => void;
    onRedistribuirGauss: (itemId: number | string) => void;
    onLimpiar: (itemId: number | string) => void;
    mesPicoKey?: string;
    diasPorMes?: Record<string, number>;
    jerarquiaPresupuesto?: Record<string, string>;
    desviaciones?: Record<string | number, number>;
    totalDesviadas?: number;
    isPeriodoBloqueado: (item: ItemValorizado, key: string) => boolean;
    totalesPorItem?: Record<string | number, number>;
    totalGeneralPeriodos?: number;
    // Valores iniciales de la sección financiera (% reales del presupuesto,
    // ver CronoValorizadoController::resolveFinDefaults())
    finDefaults?: FinDefaults;
}

// COMPONENTE PRINCIPAL
const TablaValorizada: React.FC<Props> = ({
    items = [],
    periodos = [],
    viewMode,
    totales = {},
    totalPresupuesto = 0,
    onEditarCelda,
    onRedistribuir,
    onRedistribuirGauss,
    onLimpiar,
    mesPicoKey,
    diasPorMes,
    jerarquiaPresupuesto = {},
    desviaciones = {},
    totalDesviadas = 0,
    isPeriodoBloqueado,
    totalesPorItem = {},
    totalGeneralPeriodos = 0,
    finDefaults = {},
}) => {
    const tableRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

    const [fin, setFin] = useState<FinancieroState>({
        pctGastosGenerales: finDefaults.pctGastosGenerales ?? 11.56,
        pctUtilidad: finDefaults.pctUtilidad ?? 5.0,
        pctIGV: finDefaults.pctIGV ?? 18.0,
        montoMobiliario: finDefaults.montoMobiliario ?? 0,
        pctIGVMobiliario: finDefaults.pctIGVMobiliario ?? 18.0,
        pctSupervision: finDefaults.pctSupervision ?? 5.13,
    });
    const setPct = useCallback((key: keyof FinancieroState, val: number) => {
        setFin((prev) => ({ ...prev, [key]: val }));
    }, []);

    const toggleCollapse = useCallback((code: string) => {
        setCollapsed((prev) => {
            const n = new Set(prev);
            if (n.has(code)) n.delete(code);
            else n.add(code);
            return n;
        });
    }, []);

    const treeItems = useMemo<ItemValorizado[]>(() => {
        const byCode = new Map<string, ItemValorizado>();

        items.forEach((item) => {
            const code = item.item || '';
            if (!code) return;
            byCode.set(code, { ...item });

            parentCodes(code).forEach((parentCode) => {
                if (!byCode.has(parentCode)) {
                    byCode.set(parentCode, {
                        parent_id: null,
                        id: `group:${parentCode}`,
                        item: parentCode,
                        descripcion:
                            jerarquiaPresupuesto[parentCode] ??
                            `Partida ${parentCode}`,
                        und: '',
                        metrado: 0,
                        precio: 0,
                        parcial: 0,
                        is_leaf: false,
                        distribucion: emptyDistribucion(periodos),
                    });
                }
            });
        });

        const codes = [...byCode.keys()].sort((a, b) =>
            a.localeCompare(b, 'es', { numeric: true }),
        );

        const hasChildren = new Set<string>();
        codes.forEach((code) => {
            parentCodes(code).forEach((parentCode) => hasChildren.add(parentCode));
        });

        const leafItems = items.filter(
            (item) => item.item && !hasChildren.has(item.item),
        );

        codes.forEach((code) => {
            const row = byCode.get(code);
            if (!row || !hasChildren.has(code)) return;

            const descendants = leafItems.filter((item) =>
                item.item.startsWith(`${code}.`),
            );
            const parcial = descendants.reduce(
                (acc, item) => acc + (item.parcial ?? 0),
                0,
            );
            const distribucion = emptyDistribucion(periodos);

            descendants.forEach((item) => {
                periodos.forEach((periodo) => {
                    const monto = item.distribucion?.[periodo.key]?.monto ?? 0;
                    distribucion[periodo.key].monto += monto;
                });
            });

            periodos.forEach((periodo) => {
                const monto = distribucion[periodo.key].monto;
                distribucion[periodo.key] = {
                    monto: Math.round(monto * 100) / 100,
                    porcentaje:
                        parcial > 0 ? (monto / parcial) * 100 : 0,
                };
            });

            byCode.set(code, {
                ...row,
                parcial,
                distribucion,
                is_leaf: false,
            });
        });

        return codes
            .map((code) => byCode.get(code))
            .filter((item): item is ItemValorizado => Boolean(item));
    }, [items, periodos, jerarquiaPresupuesto]);

    const childCodes = useMemo(() => {
        const result = new Set<string>();
        treeItems.forEach((item) => {
            parentCodes(item.item || '').forEach((parentCode) =>
                result.add(parentCode),
            );
        });
        return result;
    }, [treeItems]);

    const visibleItems = useMemo(
        () =>
            treeItems.filter((item) => {
                const code = item.item || '';
                for (const col of collapsed) {
                    if (
                        code.startsWith(`${col}.`) ||
                        code.startsWith(`${col} `)
                    )
                        return false;
                }
                return true;
            }),
        [treeItems, collapsed],
    );

    const nCols = 7 + periodos.length + 1;
    const rowVirtualizer = useVirtualizer({
        count: visibleItems.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => 42,
        overscan: 18,
    });
    const virtualRows = rowVirtualizer.getVirtualItems();
    const topSpacer = virtualRows.length > 0 ? virtualRows[0].start : 0;
    const bottomSpacer =
        virtualRows.length > 0
            ? rowVirtualizer.getTotalSize() -
              virtualRows[virtualRows.length - 1].end
            : 0;

    if (items.length === 0)
        return (
            <div className="rounded-xl border border-slate-200 bg-white p-16 text-center text-slate-400">
                <span className="text-5xl">📋</span>
                <p className="mt-4 font-bold">No hay partidas para mostrar</p>
            </div>
        );

    const lastKey =
        periodos.length > 0 ? periodos[periodos.length - 1].key : '';
    const totalAcumuladoFinal = totales[lastKey]?.acumuladoMonto ?? 0;

    const costoDirecto =
        totalPresupuesto > 0 ? totalPresupuesto : totalGeneralPeriodos;

    const cdPorPeriodo: Record<string, number> = {};
    periodos.forEach((p) => {
        cdPorPeriodo[p.key] = totales[p.key]?.monto ?? 0;
    });
    const cdTotalReal = Object.values(cdPorPeriodo).reduce((a, b) => a + b, 0);

    const montoGG = costoDirecto * (fin.pctGastosGenerales / 100);
    const montoUT = costoDirecto * (fin.pctUtilidad / 100);
    const subTotal = costoDirecto + montoGG + montoUT;
    const montoIGV = subTotal * (fin.pctIGV / 100);
    const presupI = subTotal + montoIGV;

    const montoIGVMob = fin.montoMobiliario * (fin.pctIGVMobiliario / 100);
    const subTotalII = fin.montoMobiliario + montoIGVMob;
    const totalI_II = presupI + subTotalII;

    const montoSup = presupI * (fin.pctSupervision / 100);
    const presupTotal = totalI_II + montoSup;

    const propDist = (total: number): Record<string, number> => {
        const r: Record<string, number> = {};
        periodos.forEach((p) => {
            r[p.key] =
                cdTotalReal > 0
                    ? total * ((cdPorPeriodo[p.key] ?? 0) / cdTotalReal)
                    : 0;
        });
        return r;
    };

    const distGG = propDist(montoGG);
    const distUT = propDist(montoUT);
    const distSub = propDist(subTotal);
    const distIGV = propDist(montoIGV);
    const distPresI = propDist(presupI);
    const distSup = propDist(montoSup);

    // Avance acumulado
    let acumCD = 0;
    const avAcumReal: Record<string, number> = {};
    periodos.forEach((p) => {
        acumCD += cdPorPeriodo[p.key] ?? 0;
        avAcumReal[p.key] =
            costoDirecto > 0 ? (acumCD / costoDirecto) * 100 : 0;
    });

    const finTd = (v: number, key: string, cls: string) => (
        <td
            key={key}
            className={`border border-slate-300 p-2 text-right text-[11px] font-medium tabular-nums ${cls} ${v > 0 ? 'text-slate-700' : 'text-slate-300'} ${key === mesPicoKey && v > 0 ? 'ring-1 ring-amber-400 ring-inset' : ''}`}
        >
            {v > 0 ? fmtN(v) : '—'}
        </td>
    );

    return (
        <div
            ref={tableRef}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
            {/* Leyenda */}
            <div className="flex items-center gap-5 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[9px] font-semibold tracking-wider text-slate-500 uppercase">
                <span>📌 Clic en celda para editar</span>
                <span>⟳ = Uniforme</span>
                <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> = Gauss (Curva S)
                </span>
                <span>✕ = Limpiar</span>
                <span className="flex items-center gap-1">
                    <Lock className="h-3 w-3" /> = Fuera de rango
                </span>
                <span className="ml-auto flex items-center gap-4">
                    {totalDesviadas > 0 && (
                        <span className="flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-600">
                            <AlertTriangle className="h-3 w-3" />
                            {totalDesviadas} partida
                            {totalDesviadas > 1 ? 's' : ''} con desvío
                        </span>
                    )}
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-3 rounded-sm bg-amber-400" />{' '}
                        Mes pico
                    </span>
                </span>
            </div>

            <div ref={scrollRef} className="max-h-[72vh] overflow-auto">
                <table
                    className="w-full border-collapse text-[11px]"
                    style={{
                        minWidth: `${Math.max(1240, 820 + periodos.length * 95)}px`,
                    }}
                >
                    {/* ══════════════ ENCABEZADO ══════════════ */}
                    <thead className="sticky top-0 z-20">
                        <tr className="bg-slate-900 text-[10px] font-bold tracking-wider text-white uppercase">
                            <th className="w-10 border border-slate-700 p-2.5 text-center">
                                N°
                            </th>
                            <th className="sticky left-0 z-30 min-w-[360px] border border-slate-700 bg-slate-900 p-2.5 text-left">
                                ÍTEM / DESCRIPCIÓN
                            </th>
                            <th className="w-12 border border-slate-700 p-2.5 text-center">
                                UND
                            </th>
                            <th className="w-24 border border-slate-700 p-2.5 text-right">
                                METRADO
                            </th>
                            <th className="w-28 border border-slate-700 p-2.5 text-right">
                                P.U. (S/.)
                            </th>
                            <th className="w-32 border border-slate-700 bg-blue-900 p-2.5 text-right">
                                PARCIAL (S/.)
                            </th>
                            <th className="w-20 border border-slate-700 bg-slate-800 p-2.5 text-center">
                                ACC.
                            </th>
                            {periodos.map((p) => (
                                <th
                                    key={p.key}
                                    className={`min-w-[88px] border border-slate-700 p-2.5 text-center ${p.key === mesPicoKey ? 'bg-amber-700' : ''}`}
                                >
                                    <div>{p.label}</div>
                                    <div className="text-[8px] font-normal text-slate-400 normal-case">
                                        {p.labelCal}
                                    </div>
                                </th>
                            ))}
                            <th className="sticky right-0 z-30 min-w-[110px] border border-slate-700 bg-emerald-900 p-2.5 text-center text-emerald-200">
                                <div>TOTAL</div>
                                <div className="text-[8px] font-normal text-emerald-400 normal-case">
                                    S/. acumulado
                                </div>
                            </th>
                        </tr>
                    </thead>

                    {/* ══════════════ CUERPO ══════════════ */}
                    <tbody>
                        {topSpacer > 0 && (
                            <tr aria-hidden="true">
                                <td
                                    colSpan={nCols}
                                    style={{
                                        height: topSpacer,
                                        padding: 0,
                                        border: 0,
                                    }}
                                />
                            </tr>
                        )}
                        {virtualRows.map((virtualRow) => {
                            const item = visibleItems[virtualRow.index];
                            if (!item) return null;
                            const idx = virtualRow.index;
                            const n = nivel(item.item);
                            const hasKids = childCodes.has(item.item);
                            const isLeaf = !hasKids;
                            const isCollapsed = collapsed.has(item.item);
                            const bg = bgNivel(n, isLeaf);
                            const desvio = isLeaf
                                ? (desviaciones[item.id] ?? 0)
                                : 0;
                            const tieneDesv = desvio > 0.01;
                            const totalFila = isLeaf
                                ? (totalesPorItem[item.id] ?? 0)
                                : periodos.reduce(
                                      (acc, p) =>
                                          acc +
                                          (item.distribucion?.[p.key]?.monto ??
                                              0),
                                      0,
                                  );

                            return (
                                <tr
                                    key={item.id}
                                    data-index={virtualRow.index}
                                    ref={rowVirtualizer.measureElement}
                                    className={`${bg || (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40')} transition-colors hover:bg-blue-50/30 ${tieneDesv ? 'ring-1 ring-rose-200 ring-inset' : ''}`}
                                >
                                    <td className="border border-slate-200 p-2 text-center text-slate-400 tabular-nums">
                                        {idx + 1}
                                    </td>
                                    <td
                                        className={`sticky left-0 z-10 border border-slate-200 p-2 shadow-[1px_0_4px_rgba(0,0,0,0.05)] ${
                                            n === 0
                                                ? 'bg-slate-800 text-white'
                                                : n === 1
                                                  ? 'bg-slate-200 text-slate-900'
                                                  : n === 2
                                                    ? 'bg-slate-100 text-slate-800'
                                                    : 'bg-white text-slate-700'
                                        }`}
                                        style={{
                                            paddingLeft: `${8 + n * 18}px`,
                                        }}
                                    >
                                        <div className="flex min-w-0 items-center gap-1.5">
                                            {hasKids ? (
                                                <button
                                                    onClick={() =>
                                                        toggleCollapse(
                                                            item.item,
                                                        )
                                                    }
                                                    className="h-3.5 w-3.5 shrink-0 text-slate-400 hover:text-blue-600"
                                                    title={
                                                        isCollapsed
                                                            ? 'Expandir'
                                                            : 'Colapsar'
                                                    }
                                                >
                                                    {isCollapsed ? (
                                                        <ChevronRight className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <ChevronDown className="h-3.5 w-3.5" />
                                                    )}
                                                </button>
                                            ) : (
                                                <span className="h-3.5 w-3.5 shrink-0" />
                                            )}
                                            <span
                                                className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] leading-none ${
                                                    n === 0
                                                        ? 'border-slate-500 bg-slate-700 text-slate-100'
                                                        : n === 1
                                                          ? 'border-slate-400 bg-white/70 text-slate-700'
                                                          : 'border-slate-200 bg-slate-50 text-slate-500'
                                                }`}
                                            >
                                                {item.item}
                                            </span>
                                            <span
                                                className={`min-w-0 leading-tight ${n <= 1 ? 'font-bold' : n === 2 ? 'font-semibold' : 'font-normal'} ${isLeaf ? 'italic' : ''}`}
                                            >
                                                {item.descripcion}
                                            </span>
                                            {tieneDesv && (
                                                <BadgeDesviacion
                                                    desvio={desvio}
                                                />
                                            )}
                                        </div>
                                    </td>
                                    <td className="border border-slate-200 p-2 text-center text-[10px] text-slate-500 uppercase">
                                        {item.und || '—'}
                                    </td>
                                    <td className="border border-slate-200 p-2 text-right font-mono text-slate-600 tabular-nums">
                                        {item.metrado > 0
                                            ? fmtN(item.metrado)
                                            : '—'}
                                    </td>
                                    <td className="border border-slate-200 p-2 text-right font-mono text-slate-600 tabular-nums">
                                        {item.precio > 0
                                            ? fmtN(item.precio)
                                            : '—'}
                                    </td>
                                    <td className="border border-slate-200 bg-blue-50/20 p-2 text-right font-bold text-blue-800 tabular-nums">
                                        {item.parcial > 0
                                            ? fmtS(item.parcial)
                                            : '—'}
                                    </td>
                                    <td className="border border-slate-200 bg-slate-50 p-2 text-center">
                                        {isLeaf && (
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() =>
                                                        onRedistribuir(item.id)
                                                    }
                                                    className="rounded p-1 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                                                    title="Redistribuir uniformemente"
                                                >
                                                    <RefreshCw className="h-3 w-3" />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        onRedistribuirGauss(
                                                            item.id,
                                                        )
                                                    }
                                                    className="rounded p-1 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                                                    title="Redistribuir con curva Gauss"
                                                >
                                                    <TrendingUp className="h-3 w-3" />
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        onLimpiar(item.id)
                                                    }
                                                    className="rounded p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                                    title="Limpiar distribución"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                    {periodos.map((p) => {
                                        const dist = item.distribucion?.[p.key];
                                        const monto = dist?.monto ?? 0;
                                        const isPico = p.key === mesPicoKey;
                                        if (!isLeaf)
                                            return (
                                                <td
                                                    key={p.key}
                                                    className={`border border-slate-200 p-2 text-right text-[11px] font-semibold tabular-nums ${monto > 0 ? 'text-slate-700' : 'text-slate-200'} ${isPico && monto > 0 ? 'bg-amber-50/30' : ''}`}
                                                >
                                                    {monto > 0
                                                        ? viewMode === 'monto'
                                                            ? fmtN(monto)
                                                            : fmtP(
                                                                  item.parcial >
                                                                      0
                                                                      ? (monto /
                                                                            item.parcial) *
                                                                            100
                                                                      : 0,
                                                              )
                                                        : '—'}
                                                </td>
                                            );
                                        const bloqueada = isPeriodoBloqueado(
                                            item,
                                            p.key,
                                        );
                                        return (
                                            <EditableCell
                                                key={p.key}
                                                value={monto}
                                                viewMode={viewMode}
                                                parcial={item.parcial}
                                                onChange={(v) =>
                                                    onEditarCelda(
                                                        item.id,
                                                        p.key,
                                                        v,
                                                    )
                                                }
                                                isPico={isPico}
                                                bloqueada={bloqueada}
                                            />
                                        );
                                    })}
                                    <td
                                        className={`sticky right-0 z-10 border border-slate-200 p-2 text-right text-[11px] font-bold tabular-nums shadow-[-1px_0_4px_rgba(0,0,0,0.05)] ${
                                            totalFila > 0
                                                ? tieneDesv
                                                    ? 'bg-rose-50 text-rose-700'
                                                    : 'bg-emerald-50/60 text-emerald-800'
                                                : 'bg-slate-50 text-slate-300'
                                        }`}
                                        title={
                                            tieneDesv
                                                ? `Desvío: S/. ${fmtN(desvio)}`
                                                : 'Total acumulado'
                                        }
                                    >
                                        {totalFila > 0 ? fmtS(totalFila) : '—'}
                                    </td>
                                </tr>
                            );
                        })}
                        {bottomSpacer > 0 && (
                            <tr aria-hidden="true">
                                <td
                                    colSpan={nCols}
                                    style={{
                                        height: bottomSpacer,
                                        padding: 0,
                                        border: 0,
                                    }}
                                />
                            </tr>
                        )}
                    </tbody>

                    {/* ══════════════ FOOTER ══════════════ */}
                    <tfoot className="text-[11px]">
                        {/* ════════ BANDA DIVISORIA PARTIDAS → RESUMEN FINANCIERO ════════ */}
                        <tr>
                            <td
                                colSpan={nCols}
                                style={{ padding: 0, border: 'none' }}
                            >
                                <div
                                    style={{
                                        background: '#1e293b',
                                        padding: '5px 16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        borderTop: '3px solid #475569',
                                        borderBottom: '3px solid #475569',
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 9,
                                            fontWeight: 700,
                                            color: '#94a3b8',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.12em',
                                        }}
                                    >
                                        ▼ RESUMEN FINANCIERO DEL PRESUPUESTO
                                    </span>
                                </div>
                            </td>
                        </tr>

                        {/* ── COSTO DIRECTO ── */}
                        <tr className="bg-slate-100 font-bold text-slate-900">
                            <td className="border border-slate-300 p-2 text-center text-[10px] text-slate-400" />
                            <td className="sticky left-0 z-10 border border-slate-300 bg-slate-100 p-2.5 text-left text-[11px] tracking-wide uppercase">
                                COSTO DIRECTO
                            </td>
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2.5 text-right tabular-nums">
                                {costoDirecto > 0 ? fmtS(costoDirecto) : '—'}
                            </td>
                            <td className="border border-slate-300 p-2" />
                            {periodos.map((p) =>
                                finTd(
                                    cdPorPeriodo[p.key] ?? 0,
                                    p.key,
                                    'bg-white',
                                ),
                            )}
                            <td className="sticky right-0 z-10 border border-slate-300 bg-slate-100 p-2.5 text-right font-bold tabular-nums">
                                {costoDirecto > 0 ? fmtS(costoDirecto) : '—'}
                            </td>
                        </tr>

                        {/* ── GASTOS GENERALES ── */}
                        <tr className="bg-white text-slate-800">
                            <PctCell
                                value={fin.pctGastosGenerales}
                                onChange={(v) =>
                                    setPct('pctGastosGenerales', v)
                                }
                            />
                            <td className="sticky left-0 z-10 border border-slate-300 bg-white p-2.5 text-left text-[11px] font-semibold tracking-wide uppercase">
                                GASTOS GENERALES
                            </td>
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2.5 text-right font-semibold tabular-nums">
                                {fmtS(montoGG)}
                            </td>
                            <td className="border border-slate-300 p-2" />
                            {periodos.map((p) =>
                                finTd(distGG[p.key] ?? 0, p.key, 'bg-white'),
                            )}
                            <td className="sticky right-0 z-10 border border-slate-300 bg-white p-2.5 text-right font-semibold tabular-nums">
                                {fmtS(montoGG)}
                            </td>
                        </tr>

                        {/* ── UTILIDAD ── */}
                        <tr className="bg-white text-slate-800">
                            <PctCell
                                value={fin.pctUtilidad}
                                onChange={(v) => setPct('pctUtilidad', v)}
                            />
                            <td className="sticky left-0 z-10 border border-slate-300 bg-white p-2.5 text-left text-[11px] font-semibold tracking-wide uppercase">
                                UTILIDAD
                            </td>
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2.5 text-right font-semibold tabular-nums">
                                {fmtS(montoUT)}
                            </td>
                            <td className="border border-slate-300 p-2" />
                            {periodos.map((p) =>
                                finTd(distUT[p.key] ?? 0, p.key, 'bg-white'),
                            )}
                            <td className="sticky right-0 z-10 border border-slate-300 bg-white p-2.5 text-right font-semibold tabular-nums">
                                {fmtS(montoUT)}
                            </td>
                        </tr>

                        {/* ── SUB TOTAL ── */}
                        <tr className="bg-slate-200 font-bold text-slate-900">
                            <td
                                colSpan={6}
                                className="border border-slate-300 p-2.5 text-right text-[10px] tracking-wider uppercase"
                            >
                                SUB TOTAL
                            </td>
                            <td className="border border-slate-300 bg-slate-300" />
                            {periodos.map((p) =>
                                finTd(
                                    distSub[p.key] ?? 0,
                                    p.key,
                                    'bg-slate-50',
                                ),
                            )}
                            <td className="sticky right-0 z-10 border border-slate-300 bg-slate-200 p-2.5 text-right font-bold tabular-nums">
                                {fmtS(subTotal)}
                            </td>
                        </tr>

                        {/* ── I.G.V. ── */}
                        <tr className="bg-white text-slate-800">
                            <PctCell
                                value={fin.pctIGV}
                                onChange={(v) => setPct('pctIGV', v)}
                            />
                            <td className="sticky left-0 z-10 border border-slate-300 bg-white p-2.5 text-left text-[11px] font-semibold tracking-wide uppercase">
                                I.G.V.
                            </td>
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2.5 text-right font-semibold tabular-nums">
                                {fmtS(montoIGV)}
                            </td>
                            <td className="border border-slate-300 p-2" />
                            {periodos.map((p) =>
                                finTd(distIGV[p.key] ?? 0, p.key, 'bg-white'),
                            )}
                            <td className="sticky right-0 z-10 border border-slate-300 bg-white p-2.5 text-right font-semibold tabular-nums">
                                {fmtS(montoIGV)}
                            </td>
                        </tr>

                        {/* ── PRESUPUESTADO COMP. I ── */}
                        <tr className="bg-slate-700 font-bold text-white">
                            <td
                                colSpan={6}
                                className="border border-slate-600 p-2.5 text-right text-[10px] tracking-wide uppercase"
                            >
                                PRESUPUESTADO DE OBRA INFRAESTRUCTURA COMPONENTE
                                I
                            </td>
                            <td className="border border-slate-600 bg-slate-800" />
                            {periodos.map((p) =>
                                finTd(
                                    distPresI[p.key] ?? 0,
                                    p.key,
                                    'bg-slate-700 text-slate-200',
                                ),
                            )}
                            <td className="sticky right-0 z-10 border border-slate-600 bg-slate-800 p-2.5 text-right font-bold text-white tabular-nums">
                                {fmtS(presupI)}
                            </td>
                        </tr>

                        {/* SEPARADOR COMPONENTE II */}
                        <tr>
                            <td
                                colSpan={nCols}
                                style={{
                                    height: 2,
                                    padding: 0,
                                    border: 'none',
                                    background: '#94a3b8',
                                }}
                            />
                        </tr>

                        {/* ── MOBILIARIO Y EQUIPAMIENTO COMP. II ── */}
                        <tr className="bg-white text-slate-700">
                            <td className="border border-slate-300 p-2 text-center text-[9px] text-slate-400 italic">
                                monto
                            </td>
                            <td className="sticky left-0 z-10 border border-slate-300 bg-white p-2.5 text-left text-[11px] font-semibold tracking-wide uppercase">
                                MOBILIARIO Y EQUIPAMIENTO COMPONENTE II
                            </td>
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <MontoCell
                                value={fin.montoMobiliario}
                                onChange={(v) => setPct('montoMobiliario', v)}
                            />
                            <td className="border border-slate-300 p-2" />
                            {periodos.map((p) => (
                                <td
                                    key={p.key}
                                    className="border border-slate-300 p-2 text-center text-[10px] text-slate-300"
                                >
                                    —
                                </td>
                            ))}
                            <td className="sticky right-0 z-10 border border-slate-300 bg-white p-2.5 text-right font-semibold tabular-nums">
                                {fin.montoMobiliario > 0
                                    ? fmtS(fin.montoMobiliario)
                                    : '—'}
                            </td>
                        </tr>

                        {/* ── IGV MOBILIARIO ── */}
                        <tr className="bg-white text-slate-700">
                            <PctCell
                                value={fin.pctIGVMobiliario}
                                onChange={(v) => setPct('pctIGVMobiliario', v)}
                            />
                            <td className="sticky left-0 z-10 border border-slate-300 bg-white p-2.5 text-left text-[11px] font-semibold tracking-wide uppercase">
                                IGV (MOBILIARIO Y EQUIPAMIENTO)
                            </td>
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2.5 text-right font-semibold tabular-nums">
                                {fin.montoMobiliario > 0
                                    ? fmtS(montoIGVMob)
                                    : '—'}
                            </td>
                            <td className="border border-slate-300 p-2" />
                            {periodos.map((p) => (
                                <td
                                    key={p.key}
                                    className="border border-slate-300 p-2 text-center text-[10px] text-slate-300"
                                >
                                    —
                                </td>
                            ))}
                            <td className="sticky right-0 z-10 border border-slate-300 bg-white p-2.5 text-right font-semibold tabular-nums">
                                {fin.montoMobiliario > 0
                                    ? fmtS(montoIGVMob)
                                    : '—'}
                            </td>
                        </tr>

                        {/* ── SUB TOTAL COMPONENTE II ── */}
                        <tr className="bg-slate-100 font-bold text-slate-800">
                            <td
                                colSpan={6}
                                className="border border-slate-300 p-2.5 text-right text-[10px] tracking-wider uppercase"
                            >
                                SUB TOTAL COMPONENTE II
                            </td>
                            <td className="border border-slate-300 bg-slate-200" />
                            {periodos.map((p) => (
                                <td
                                    key={p.key}
                                    className="border border-slate-300 p-2 text-center text-[10px] text-slate-300"
                                >
                                    —
                                </td>
                            ))}
                            <td className="sticky right-0 z-10 border border-slate-300 bg-slate-100 p-2.5 text-right font-bold tabular-nums">
                                {subTotalII > 0 ? fmtS(subTotalII) : '—'}
                            </td>
                        </tr>

                        {/* ── TOTAL PRESUPUESTO COMPONENTE I+II ── */}
                        <tr className="bg-slate-800 font-bold text-white">
                            <td
                                colSpan={6}
                                className="border border-slate-600 p-2.5 text-right text-[10px] tracking-wide uppercase"
                            >
                                TOTAL PRESUPUESTO DE OBRA COMPONENTE I+II
                            </td>
                            <td className="border border-slate-600 bg-slate-900" />
                            {periodos.map((p) => (
                                <td
                                    key={p.key}
                                    className="border border-slate-600 p-2 text-center text-[10px] text-slate-500"
                                >
                                    —
                                </td>
                            ))}
                            <td className="sticky right-0 z-10 border border-slate-600 bg-slate-900 p-2.5 text-right text-[12px] font-bold tabular-nums">
                                {fmtS(totalI_II)}
                            </td>
                        </tr>

                        {/* SEPARADOR */}
                        <tr>
                            <td
                                colSpan={nCols}
                                style={{
                                    height: 2,
                                    padding: 0,
                                    border: 'none',
                                    background: '#94a3b8',
                                }}
                            />
                        </tr>

                        {/* ── GASTOS DE SUPERVISIÓN ── */}
                        <tr className="bg-white text-slate-800">
                            <PctCell
                                value={fin.pctSupervision}
                                onChange={(v) => setPct('pctSupervision', v)}
                            />
                            <td className="sticky left-0 z-10 border border-slate-300 bg-white p-2.5 text-left text-[11px] font-semibold tracking-wide uppercase">
                                GASTOS DE SUPERVISIÓN Y LIQUIDACIÓN
                            </td>
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2" />
                            <td className="border border-slate-300 p-2.5 text-right font-semibold tabular-nums">
                                {fmtS(montoSup)}
                            </td>
                            <td className="border border-slate-300 p-2" />
                            {periodos.map((p) =>
                                finTd(distSup[p.key] ?? 0, p.key, 'bg-white'),
                            )}
                            <td className="sticky right-0 z-10 border border-slate-300 bg-white p-2.5 text-right font-semibold tabular-nums">
                                {fmtS(montoSup)}
                            </td>
                        </tr>

                        {/* ── PRESUPUESTO TOTAL ── */}
                        <tr className="bg-slate-900 text-[12px] font-bold text-white">
                            <td
                                colSpan={6}
                                className="border border-slate-700 p-3 text-right text-[11px] tracking-widest uppercase"
                            >
                                PRESUPUESTO TOTAL
                            </td>
                            <td className="border border-slate-700" />
                            {periodos.map((p) => {
                                const v =
                                    (distPresI[p.key] ?? 0) +
                                    (distSup[p.key] ?? 0);
                                return (
                                    <td
                                        key={p.key}
                                        className={`border border-slate-700 p-2.5 text-right font-bold tabular-nums ${v > 0 ? 'text-slate-200' : 'text-slate-600'} ${p.key === mesPicoKey && v > 0 ? 'ring-1 ring-amber-400 ring-inset' : ''}`}
                                    >
                                        {v > 0 ? fmtN(v) : '—'}
                                    </td>
                                );
                            })}
                            <td className="sticky right-0 z-10 border-2 border-emerald-500 bg-slate-900 p-3 text-right text-[13px] font-bold text-emerald-300 tabular-nums">
                                {fmtS(presupTotal)}
                            </td>
                        </tr>

                        {/* ════════ BANDA DIVISORIA RESUMEN → VALORIZACIÓN ════════ */}
                        <tr>
                            <td
                                colSpan={nCols}
                                style={{ padding: 0, border: 'none' }}
                            >
                                <div
                                    style={{
                                        background: '#0f172a',
                                        padding: '5px 16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        borderTop: '3px solid #334155',
                                        borderBottom: '3px solid #334155',
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 9,
                                            fontWeight: 700,
                                            color: '#64748b',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.12em',
                                        }}
                                    >
                                        ▼ VALORIZACIÓN Y AVANCE DE OBRA
                                    </span>
                                </div>
                            </td>
                        </tr>

                        {/* ── VALORIZACIÓN MENSUAL (S/.) ── */}
                        <tr className="bg-[#0d2060] font-bold text-white">
                            <td
                                colSpan={6}
                                className="border border-[#1a3070] p-2.5 text-right text-[10px] tracking-wide uppercase"
                            >
                                Valorización Mensual (S/.)
                            </td>
                            <td className="border border-[#1a3070] bg-[#081840]" />
                            {periodos.map((p) => (
                                <td
                                    key={p.key}
                                    className={`border border-[#1a3070] p-2.5 text-center tabular-nums ${p.key === mesPicoKey ? 'bg-amber-700' : ''}`}
                                >
                                    {(totales[p.key]?.monto ?? 0) > 0
                                        ? fmtN(totales[p.key].monto)
                                        : '—'}
                                </td>
                            ))}
                            <td className="sticky right-0 border border-[#1a3070] bg-emerald-900 p-2.5 text-center font-bold text-emerald-200 tabular-nums">
                                {totalGeneralPeriodos > 0
                                    ? fmtN(totalGeneralPeriodos)
                                    : '—'}
                            </td>
                        </tr>

                        {/* ── % AVANCE MENSUAL ── */}
                        <tr className="bg-[#1a2030] text-[10px] text-slate-400">
                            <td
                                colSpan={6}
                                className="border border-[#2a3044] p-2 text-right tracking-wider uppercase"
                            >
                                % Avance Mensual
                            </td>
                            <td className="border border-[#2a3044]" />
                            {periodos.map((p) => (
                                <td
                                    key={p.key}
                                    className="border border-[#2a3044] p-2 text-center tabular-nums"
                                >
                                    {(totales[p.key]?.porcentaje ?? 0) > 0
                                        ? `${totales[p.key].porcentaje.toFixed(3)}%`
                                        : '—'}
                                </td>
                            ))}
                            <td className="sticky right-0 border border-[#2a3044] bg-[#111824] p-2 text-center">
                                —
                            </td>
                        </tr>

                        {/* ── DÍAS TRABAJADOS ── */}
                        {diasPorMes && (
                            <tr className="bg-[#141e38] text-[10px] text-slate-300">
                                <td
                                    colSpan={6}
                                    className="border border-[#1e2a4a] p-2 text-right font-semibold tracking-wider uppercase"
                                >
                                    Días Trabajados
                                </td>
                                <td className="border border-[#1e2a4a]" />
                                {periodos.map((p) => {
                                    const dias = diasPorMes[p.key] ?? 0;
                                    return (
                                        <td
                                            key={p.key}
                                            className="border border-[#1e2a4a] p-2 text-center font-mono tabular-nums"
                                        >
                                            {dias > 0 ? dias : '—'}
                                        </td>
                                    );
                                })}
                                <td className="sticky right-0 border border-[#1e2a4a] bg-[#0c1428] p-2 text-center">
                                    —
                                </td>
                            </tr>
                        )}

                        {/* ── VALORIZACIÓN ACUMULADA (S/.) ── */}
                        <tr className="bg-[#0a2e1a] font-bold text-white">
                            <td
                                colSpan={6}
                                className="border border-[#0e4025] p-2.5 text-right text-[10px] tracking-wide uppercase"
                            >
                                Valorización Acumulada (S/.)
                            </td>
                            <td className="border border-[#0e4025] bg-[#062010]" />
                            {periodos.map((p) => (
                                <td
                                    key={p.key}
                                    className="border border-[#0e4025] p-2.5 text-center text-emerald-300 tabular-nums"
                                >
                                    {(totales[p.key]?.acumuladoMonto ?? 0) > 0
                                        ? fmtN(totales[p.key].acumuladoMonto)
                                        : '—'}
                                </td>
                            ))}
                            <td className="sticky right-0 border border-[#0e4025] bg-[#062010] p-2.5 text-center text-emerald-200 tabular-nums">
                                {totalAcumuladoFinal > 0
                                    ? fmtN(totalAcumuladoFinal)
                                    : '—'}
                            </td>
                        </tr>

                        {/* ── % AVANCE ACUMULADO (CURVA S) ── */}
                        <tr className="bg-[#0a1e10] text-[10px] text-slate-400">
                            <td
                                colSpan={6}
                                className="border border-[#0e2a18] p-2 text-right tracking-wider uppercase"
                            >
                                % Avance Acumulado (Curva S)
                            </td>
                            <td className="border border-[#0e2a18]" />
                            {periodos.map((p) => {
                                const pct =
                                    totales[p.key]?.acumuladoPorcentaje ?? 0;
                                return (
                                    <td
                                        key={p.key}
                                        className="border border-[#0e2a18] p-2 text-center tabular-nums"
                                    >
                                        {pct > 0 ? (
                                            <span className="font-bold text-emerald-400">
                                                {pct.toFixed(2)}%
                                            </span>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                );
                            })}
                            <td className="sticky right-0 border border-[#0e2a18] bg-[#062010] p-2 text-center">
                                {totalAcumuladoFinal > 0 &&
                                totalPresupuesto > 0 ? (
                                    <span className="font-bold text-emerald-400">
                                        {(
                                            (totalAcumuladoFinal /
                                                totalPresupuesto) *
                                            100
                                        ).toFixed(2)}
                                        %
                                    </span>
                                ) : (
                                    '—'
                                )}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default TablaValorizada;
