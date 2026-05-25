import React, { useState, useRef, useMemo } from 'react';
import { RefreshCw, X, TrendingUp, AlertTriangle, Lock } from 'lucide-react';
import { ItemValorizado, Periodo, ViewMode, TotalesColumna } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// FORMATOS
// ─────────────────────────────────────────────────────────────────────────────
const fmtN = (v: number) =>
    (v ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtS = (v: number) => `S/. ${fmtN(v)}`;
const fmtP = (v: number) => `${(v ?? 0).toFixed(4)}%`;

const nivel = (item: string) => (item?.split('.').length ?? 1) - 1;

const bgNivel = (n: number, isLeaf: boolean): string => {
    if (isLeaf)  return '';
    if (n === 0) return 'bg-slate-800 text-white';
    if (n === 1) return 'bg-slate-200 text-slate-900';
    if (n === 2) return 'bg-slate-100 text-slate-800';
    return 'bg-slate-50 text-slate-700';
};

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS INTERNOS PARA SECCIÓN FINANCIERA
// ─────────────────────────────────────────────────────────────────────────────
interface FinancieroState {
    // Porcentajes editables
    pctGastosGenerales:  number; // e.g. 11.56
    pctUtilidad:         number; // e.g. 5.00
    pctIGV:              number; // e.g. 18.00
    // Componente II
    montoMobiliario:     number; // monto fijo editable
    pctIGVMobiliario:    number; // e.g. 18.00
    // Supervisión
    pctSupervision:      number; // e.g. 5.13
}

// ─────────────────────────────────────────────────────────────────────────────
// CELDA EDITABLE (partidas mensuales)
// ─────────────────────────────────────────────────────────────────────────────
interface EditableCellProps {
    value:     number;
    viewMode:  ViewMode;
    parcial:   number;
    onChange:  (v: number) => void;
    isPico:    boolean;
    bloqueada: boolean;
}

const EditableCell: React.FC<EditableCellProps> = ({
    value, viewMode, parcial, onChange, isPico, bloqueada,
}) => {
    const [editing, setEditing] = useState(false);
    const [rawVal, setRawVal]   = useState('');
    const inputRef              = useRef<HTMLInputElement>(null);

    if (bloqueada) {
        return (
            <td
                className="p-2 border border-slate-200 text-center bg-slate-100/70 cursor-not-allowed select-none"
                title="Fuera del rango de ejecución de esta partida"
            >
                <Lock className="w-3 h-3 text-slate-300 mx-auto" />
            </td>
        );
    }

    const startEdit = () => {
        setRawVal(value.toFixed(2));
        setEditing(true);
        setTimeout(() => inputRef.current?.select(), 30);
    };

    const commitEdit = () => {
        const parsed = parseFloat(rawVal.replace(/,/g, '.'));
        if (!isNaN(parsed)) {
            const finalVal = viewMode === 'porcentaje'
                ? (parsed / 100) * parcial
                : parsed;
            onChange(Math.max(0, finalVal));
        }
        setEditing(false);
    };

    const display  = viewMode === 'monto' ? fmtN(value) : fmtP(parcial > 0 ? (value / parcial) * 100 : 0);
    const hasValue = value > 0;

    if (editing) {
        return (
            <td className={`p-0 border border-slate-200 ${isPico ? 'ring-1 ring-inset ring-amber-400' : ''}`}>
                <input
                    ref={inputRef}
                    type="text"
                    value={rawVal}
                    onChange={e => setRawVal(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => {
                        if (e.key === 'Enter')  commitEdit();
                        if (e.key === 'Escape') setEditing(false);
                    }}
                    className="w-full h-full px-2 py-2 text-xs text-right font-mono bg-yellow-50 border-0 outline-none focus:ring-2 focus:ring-blue-500"
                />
            </td>
        );
    }

    return (
        <td
            onClick={startEdit}
            className={`p-2 text-right text-[11px] font-mono border border-slate-200 cursor-pointer transition-colors select-none
                ${hasValue
                    ? 'text-slate-900 font-bold hover:bg-blue-50'
                    : 'text-slate-200 hover:bg-blue-50 hover:text-slate-500'
                }
                ${isPico && hasValue ? 'ring-1 ring-inset ring-amber-300 bg-amber-50/30' : ''}
            `}
            title="Clic para editar"
        >
            {hasValue ? display : '—'}
        </td>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// CELDA EDITABLE PARA PORCENTAJE FINANCIERO
// ─────────────────────────────────────────────────────────────────────────────
interface EditablePctCellProps {
    value:    number;  // porcentaje como número (ej: 11.56)
    onChange: (v: number) => void;
    suffix?:  string;
    className?: string;
}

const EditablePctCell: React.FC<EditablePctCellProps> = ({ value, onChange, suffix = '%', className = '' }) => {
    const [editing, setEditing] = useState(false);
    const [raw, setRaw]         = useState('');
    const inputRef              = useRef<HTMLInputElement>(null);

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

    if (editing) {
        return (
            <td className={`p-0 border border-slate-600 ${className}`}>
                <input
                    ref={inputRef}
                    type="text"
                    value={raw}
                    onChange={e => setRaw(e.target.value)}
                    onBlur={commit}
                    onKeyDown={e => {
                        if (e.key === 'Enter')  commit();
                        if (e.key === 'Escape') setEditing(false);
                    }}
                    className="w-full h-full px-2 py-1 text-xs text-right font-mono bg-yellow-100 text-slate-900 border-0 outline-none focus:ring-2 focus:ring-yellow-400"
                />
            </td>
        );
    }

    return (
        <td
            onClick={startEdit}
            title="Clic para editar"
            className={`p-2 text-center text-[11px] font-black border border-slate-600 cursor-pointer hover:bg-yellow-100/20 transition-colors select-none ${className}`}
        >
            {value.toFixed(2)}{suffix}
        </td>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// CELDA EDITABLE PARA MONTO FIJO (Mobiliario)
// ─────────────────────────────────────────────────────────────────────────────
interface EditableMontoFinProps {
    value:    number;
    onChange: (v: number) => void;
    className?: string;
}

const EditableMontoFin: React.FC<EditableMontoFinProps> = ({ value, onChange, className = '' }) => {
    const [editing, setEditing] = useState(false);
    const [raw, setRaw]         = useState('');
    const inputRef              = useRef<HTMLInputElement>(null);

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

    if (editing) {
        return (
            <td className={`p-0 border border-slate-600 ${className}`}>
                <input
                    ref={inputRef}
                    type="text"
                    value={raw}
                    onChange={e => setRaw(e.target.value)}
                    onBlur={commit}
                    onKeyDown={e => {
                        if (e.key === 'Enter')  commit();
                        if (e.key === 'Escape') setEditing(false);
                    }}
                    className="w-full h-full px-2 py-1 text-xs text-right font-mono bg-yellow-100 text-slate-900 border-0 outline-none focus:ring-2 focus:ring-yellow-400"
                />
            </td>
        );
    }

    return (
        <td
            onClick={startEdit}
            title="Clic para editar monto"
            className={`p-2 text-right text-[11px] font-black border border-slate-600 cursor-pointer hover:bg-yellow-100/20 transition-colors select-none ${className}`}
        >
            {fmtS(value)}
        </td>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// BADGE DE DESVÍO
// ─────────────────────────────────────────────────────────────────────────────
const BadgeDesviacion: React.FC<{ desvio: number }> = ({ desvio }) => {
    if (desvio <= 0.01) return null;
    return (
        <span
            title={`Diferencia: S/. ${fmtN(desvio)}`}
            className="inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 bg-rose-100 border border-rose-300 text-rose-700 text-[8px] font-black rounded-full"
        >
            <AlertTriangle className="w-2.5 h-2.5" />
            S/. {fmtN(desvio)}
        </span>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// PROPS TABLA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
    items:               ItemValorizado[];
    periodos:            Periodo[];
    viewMode:            ViewMode;
    totales:             Record<string, TotalesColumna>;
    totalPresupuesto:    number;
    onEditarCelda:       (itemId: number | string, key: string, monto: number) => void;
    onRedistribuir:      (itemId: number | string) => void;
    onRedistribuirGauss: (itemId: number | string) => void;
    onLimpiar:           (itemId: number | string) => void;
    mesPicoKey?:         string;
    diasPorMes?:         Record<string, number>;
    desviaciones?:       Record<string | number, number>;
    totalDesviadas?:     number;
    isPeriodoBloqueado:  (item: ItemValorizado, key: string) => boolean;
    totalesPorItem?:     Record<string | number, number>;
    totalGeneralPeriodos?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
const TablaValorizada: React.FC<Props> = ({
    items = [], periodos = [], viewMode, totales = {},
    totalPresupuesto = 0,
    onEditarCelda, onRedistribuir, onRedistribuirGauss, onLimpiar,
    mesPicoKey,
    diasPorMes,
    desviaciones = {},
    totalDesviadas = 0,
    isPeriodoBloqueado,
    totalesPorItem = {},
    totalGeneralPeriodos = 0,
}) => {
    const tableRef = useRef<HTMLDivElement>(null);
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

    // ── Estado financiero editable ──────────────────────────────────────────
    const [fin, setFin] = useState<FinancieroState>({
        pctGastosGenerales: 11.56,
        pctUtilidad:        5.00,
        pctIGV:             18.00,
        montoMobiliario:    667586.00,
        pctIGVMobiliario:   18.00,
        pctSupervision:     5.13,
    });

    const setPct = (key: keyof FinancieroState, val: number) =>
        setFin(prev => ({ ...prev, [key]: val }));

    const toggleCollapse = (item: string) => {
        setCollapsed(prev => {
            const next = new Set(prev);
            if (next.has(item)) next.delete(item);
            else next.add(item);
            return next;
        });
    };

    const visibleItems = items.filter(item => {
        const code = item.item || '';
        for (const col of collapsed) {
            if (code.startsWith(col + '.') || code.startsWith(col + ' ')) return false;
        }
        return true;
    });

    if (items.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-400">
                <span className="text-5xl">📋</span>
                <p className="mt-4 font-bold">No hay partidas para mostrar</p>
            </div>
        );
    }

    const lastKey             = periodos.length > 0 ? periodos[periodos.length - 1].key : '';
    const totalAcumuladoFinal = totales[lastKey]?.acumuladoMonto ?? 0;

    // ── Cálculos financieros derivados ─────────────────────────────────────
    // Costo directo total = suma de totalesPorItem (todas las hojas sumadas por período)
    // O bien usamos totalGeneralPeriodos que ya trae el backend.
    const costoDirecto = totalGeneralPeriodos > 0 ? totalGeneralPeriodos : totalPresupuesto;

    const montoGastosGenerales = costoDirecto * (fin.pctGastosGenerales / 100);
    const montoUtilidad        = costoDirecto * (fin.pctUtilidad / 100);
    const subTotal             = costoDirecto + montoGastosGenerales + montoUtilidad;
    const montoIGV             = subTotal * (fin.pctIGV / 100);
    const presupuestoCompI     = subTotal + montoIGV;

    const montoIGVMobiliario   = fin.montoMobiliario * (fin.pctIGVMobiliario / 100);
    const subTotalCompII       = fin.montoMobiliario + montoIGVMobiliario;

    const totalCompIII         = presupuestoCompI + subTotalCompII;

    const montoSupervision     = presupuestoCompI * (fin.pctSupervision / 100);
    const presupuestoTotal     = totalCompIII + montoSupervision;

    // ── Distribución financiera mensual ───────────────────────────────────
    // Gastos Generales, Utilidad, IGV, Supervisión se distribuyen
    // proporcionalmente al Costo Directo mensual de cada período.
    const cdMensual: Record<string, number> = {};
    periodos.forEach(p => {
        cdMensual[p.key] = totales[p.key]?.monto ?? 0;
    });

    const distFinRow = (monto: number): Record<string, number> => {
        const result: Record<string, number> = {};
        periodos.forEach(p => {
            const cd = cdMensual[p.key] ?? 0;
            result[p.key] = costoDirecto > 0 ? monto * (cd / costoDirecto) : 0;
        });
        return result;
    };

    const distGG   = distFinRow(montoGastosGenerales);
    const distUT   = distFinRow(montoUtilidad);
    const distSub  = distFinRow(subTotal - costoDirecto); // solo el agregado GG+UT
    const distIGV  = distFinRow(montoIGV);
    const distPresI = distFinRow(presupuestoCompI);
    const distSup  = distFinRow(montoSupervision);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER FILA FINANCIERA GENÉRICA
    // ─────────────────────────────────────────────────────────────────────────
    const renderFilaFinanciera = (
        label: string,
        montoTotal: number,
        distMensual: Record<string, number>,
        rowCls: string,       // clases Tailwind para la fila
        pctNode?: React.ReactNode,  // nodo opcional con porcentaje editable
        stickyRightCls?: string,
    ) => (
        <tr className={rowCls}>
            {/* N° vacío */}
            <td className="p-2 border border-slate-700 text-center text-[10px]" />
            {/* ÍTEM vacío */}
            <td className="p-2 border border-slate-700 text-center text-[10px]">
                {pctNode ?? null}
            </td>
            {/* DESCRIPCIÓN */}
            <td className="p-2 border border-slate-700 text-left font-black text-[11px] uppercase tracking-wide sticky left-0 z-10"
                style={{ background: 'inherit' }}>
                {label}
            </td>
            {/* UND */}
            <td className="p-2 border border-slate-700 text-center text-[10px]" />
            {/* METRADO */}
            <td className="p-2 border border-slate-700 text-right text-[10px]" />
            {/* P.U. */}
            <td className="p-2 border border-slate-700 text-right text-[10px]" />
            {/* PARCIAL = total de esta fila */}
            <td className="p-2 border border-slate-700 text-right font-black text-[11px]">
                {montoTotal > 0 ? fmtS(montoTotal) : '—'}
            </td>
            {/* ACC. */}
            <td className="p-2 border border-slate-700 text-center text-[10px]" />
            {/* Celdas mensuales */}
            {periodos.map(p => {
                const v = distMensual[p.key] ?? 0;
                const isPico = p.key === mesPicoKey;
                return (
                    <td
                        key={p.key}
                        className={`p-2 text-right text-[11px] border border-slate-700 font-semibold
                            ${v > 0 ? '' : 'opacity-30'}
                            ${isPico && v > 0 ? 'ring-1 ring-inset ring-amber-400' : ''}
                        `}
                    >
                        {v > 0 ? fmtN(v) : '—'}
                    </td>
                );
            })}
            {/* TOTAL sticky derecha */}
            <td className={`p-2 text-right text-[11px] font-black border border-slate-700 sticky right-0 z-10 ${stickyRightCls ?? ''}`}>
                {montoTotal > 0 ? fmtS(montoTotal) : '—'}
            </td>
        </tr>
    );

    // Fila de subtotal/resumen sin distribución mensual
    const renderFilaResumen = (
        label: string,
        montoTotal: number,
        rowCls: string,
        stickyRightCls?: string,
        colSpanLabel?: number,
    ) => (
        <tr className={rowCls}>
            <td colSpan={colSpanLabel ?? 7}
                className="p-2 border border-slate-700 text-right font-black text-[11px] uppercase tracking-wider">
                {label}
            </td>
            <td className="p-2 border border-slate-700" />
            {periodos.map(p => (
                <td key={p.key} className="p-2 border border-slate-700 text-center text-[10px] opacity-30">—</td>
            ))}
            <td className={`p-2 text-right font-black text-[11px] border border-slate-700 sticky right-0 z-10 ${stickyRightCls ?? ''}`}>
                {montoTotal > 0 ? fmtS(montoTotal) : '—'}
            </td>
        </tr>
    );

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER PRINCIPAL
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div ref={tableRef} className="rounded-2xl border border-slate-200 shadow-xl bg-white overflow-hidden">

            {/* ── Leyenda ── */}
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-4 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                <span>📌 Clic en celda para editar</span>
                <span>⟳ = Uniforme</span>
                <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> = Gauss (curva S)
                </span>
                <span>✕ = Limpiar</span>
                <span className="flex items-center gap-1">
                    <Lock className="w-3 h-3" /> = Fuera de rango
                </span>
                <span className="ml-auto flex items-center gap-3">
                    {totalDesviadas > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-rose-100 border border-rose-300 text-rose-700 rounded-full">
                            <AlertTriangle className="w-3 h-3" />
                            {totalDesviadas} partida{totalDesviadas > 1 ? 's' : ''} con desvío
                        </span>
                    )}
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-2 rounded-sm bg-amber-300 inline-block" /> Mes pico
                    </span>
                </span>
            </div>

            <div className="overflow-x-auto">
                <table
                    className="w-full text-[11px] border-collapse"
                    style={{ minWidth: `${Math.max(1300, 900 + periodos.length * 95)}px` }}
                >
                    {/* ══════════════════ ENCABEZADO ══════════════════ */}
                    <thead className="sticky top-0 z-20">
                        <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                            <th className="p-3 border border-slate-700 text-center w-12">N°</th>
                            <th className="p-3 border border-slate-700 text-center w-24">ÍTEM</th>
                            <th className="p-3 border border-slate-700 text-left min-w-[260px] sticky left-0 bg-slate-900 z-30">DESCRIPCIÓN</th>
                            <th className="p-3 border border-slate-700 text-center w-14">UND</th>
                            <th className="p-3 border border-slate-700 text-right w-24">METRADO</th>
                            <th className="p-3 border border-slate-700 text-right w-28">P.U. (S/.)</th>
                            <th className="p-3 border border-slate-700 text-right w-32 bg-blue-900">PARCIAL (S/.)</th>
                            <th className="p-3 border border-slate-700 text-center w-20 bg-slate-800">ACC.</th>
                            {periodos.map(p => (
                                <th
                                    key={p.key}
                                    className={`p-3 border border-slate-700 text-center min-w-[90px] ${
                                        p.key === mesPicoKey ? 'bg-amber-700' : ''
                                    }`}
                                >
                                    <div>{p.label}</div>
                                    <div className="text-[8px] font-normal text-slate-400 normal-case">{p.labelCal}</div>
                                </th>
                            ))}
                            <th className="p-3 border border-slate-700 text-center min-w-[110px] bg-emerald-900 text-emerald-100 sticky right-0 z-30">
                                <div>TOTAL</div>
                                <div className="text-[8px] font-normal text-emerald-300 normal-case">S/. acumulado</div>
                            </th>
                        </tr>
                    </thead>

                    {/* ══════════════════ CUERPO ══════════════════ */}
                    <tbody>
                        {visibleItems.map((item, idx) => {
                            const n           = nivel(item.item);
                            const isLeaf      = item.is_leaf;
                            const hasKids     = items.some(
                                i => i.item.startsWith(item.item + '.') || i.item.startsWith(item.item + ' ')
                            );
                            const isCollapsed = collapsed.has(item.item);
                            const bg          = bgNivel(n, isLeaf);
                            const desvio      = isLeaf ? (desviaciones[item.id] ?? 0) : 0;
                            const tieneDesv   = desvio > 0.01;
                            const totalFila   = totalesPorItem[item.id] ?? 0;

                            return (
                                <tr
                                    key={item.id}
                                    className={`${bg || (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30')} hover:bg-blue-50/40 transition-colors group ${tieneDesv ? 'ring-1 ring-inset ring-rose-200' : ''}`}
                                >
                                    {/* N° */}
                                    <td className="p-2 border border-slate-200 text-center text-slate-500 font-semibold">
                                        {idx + 1}
                                    </td>
                                    {/* ÍTEM */}
                                    <td className={`p-2 border border-slate-200 text-center font-mono text-xs ${n === 0 ? 'text-white' : 'text-slate-500'}`}>
                                        {item.item}
                                    </td>
                                    {/* DESCRIPCIÓN — sticky */}
                                    <td
                                        className={`p-2 border border-slate-200 sticky left-0 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.04)] ${
                                            n === 0 ? 'bg-slate-800 text-white' :
                                            n === 1 ? 'bg-slate-200 text-slate-900' :
                                            n === 2 ? 'bg-slate-100 text-slate-800' :
                                            'bg-white text-slate-700'
                                        }`}
                                        style={{ paddingLeft: `${8 + n * 12}px` }}
                                    >
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {hasKids && (
                                                <button
                                                    onClick={() => toggleCollapse(item.item)}
                                                    className="w-4 h-4 flex-shrink-0 text-slate-400 hover:text-blue-600 transition-colors"
                                                    title={isCollapsed ? 'Expandir' : 'Colapsar'}
                                                >
                                                    {isCollapsed ? '▶' : '▼'}
                                                </button>
                                            )}
                                            <span className={`leading-tight ${n <= 1 ? 'font-black' : n === 2 ? 'font-bold' : 'font-medium'} ${item.is_leaf ? 'italic' : ''}`}>
                                                {item.descripcion}
                                            </span>
                                            {tieneDesv && <BadgeDesviacion desvio={desvio} />}
                                        </div>
                                    </td>
                                    {/* UND */}
                                    <td className="p-2 border border-slate-200 text-center text-slate-500 uppercase text-[10px]">
                                        {item.und || '—'}
                                    </td>
                                    {/* METRADO */}
                                    <td className="p-2 border border-slate-200 text-right font-mono text-slate-600">
                                        {item.metrado > 0 ? fmtN(item.metrado) : '—'}
                                    </td>
                                    {/* P.U. */}
                                    <td className="p-2 border border-slate-200 text-right font-mono text-slate-600">
                                        {item.precio > 0 ? fmtN(item.precio) : '—'}
                                    </td>
                                    {/* PARCIAL */}
                                    <td className="p-2 border border-slate-200 text-right font-black text-blue-800 bg-blue-50/30">
                                        {item.parcial > 0 ? fmtS(item.parcial) : '—'}
                                    </td>
                                    {/* ACCIONES */}
                                    <td className="p-2 border border-slate-200 text-center bg-slate-50">
                                        {isLeaf && (
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => onRedistribuir(item.id)}
                                                    className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                    title="Redistribuir uniformemente"
                                                >
                                                    <RefreshCw className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => onRedistribuirGauss(item.id)}
                                                    className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                                    title="Redistribuir con curva Gauss (MS Project)"
                                                >
                                                    <TrendingUp className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => onLimpiar(item.id)}
                                                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                    title="Limpiar distribución"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                    {/* CELDAS MENSUALES */}
                                    {periodos.map(p => {
                                        const dist   = item.distribucion?.[p.key];
                                        const monto  = dist?.monto ?? 0;
                                        const isPico = p.key === mesPicoKey;

                                        if (!isLeaf) {
                                            return (
                                                <td
                                                    key={p.key}
                                                    className={`p-2 text-right text-[11px] border border-slate-200 font-semibold ${
                                                        monto > 0 ? 'text-slate-700' : 'text-slate-200'
                                                    } ${isPico && monto > 0 ? 'bg-amber-50/40' : ''}`}
                                                >
                                                    {monto > 0
                                                        ? (viewMode === 'monto'
                                                            ? fmtN(monto)
                                                            : fmtP(item.parcial > 0 ? (monto / item.parcial) * 100 : 0))
                                                        : '—'
                                                    }
                                                </td>
                                            );
                                        }

                                        const bloqueada = isPeriodoBloqueado(item, p.key);
                                        return (
                                            <EditableCell
                                                key={p.key}
                                                value={monto}
                                                viewMode={viewMode}
                                                parcial={item.parcial}
                                                onChange={v => onEditarCelda(item.id, p.key, v)}
                                                isPico={isPico}
                                                bloqueada={bloqueada}
                                            />
                                        );
                                    })}
                                    {/* TOTAL fila — sticky derecha */}
                                    <td
                                        className={`p-2 text-right text-[11px] font-black border border-slate-200 sticky right-0 z-10 shadow-[-2px_0_4px_rgba(0,0,0,0.04)] ${
                                            totalFila > 0
                                                ? tieneDesv
                                                    ? 'bg-rose-50 text-rose-700'
                                                    : 'bg-emerald-50 text-emerald-800'
                                                : 'bg-slate-50 text-slate-300'
                                        }`}
                                        title={tieneDesv
                                            ? `Desvío: S/. ${fmtN(desvio)} — no cuadra con el parcial`
                                            : 'Total acumulado de todos los meses'}
                                    >
                                        {totalFila > 0 ? fmtS(totalFila) : '—'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>

                    {/* ══════════════════ FOOTER ══════════════════ */}
                    <tfoot className="font-black text-[11px] sticky bottom-0 z-10">

                        {/* ── Valorización Mensual ── */}
                        <tr className="bg-blue-900 text-white">
                            <td colSpan={7} className="p-3 text-right border border-blue-800 uppercase tracking-wider text-xs">
                                Valorización Mensual (S/.)
                            </td>
                            <td className="border border-blue-800 bg-blue-950" />
                            {periodos.map(p => (
                                <td key={p.key} className={`p-3 text-center border border-blue-800 ${p.key === mesPicoKey ? 'bg-amber-700' : ''}`}>
                                    {totales[p.key]?.monto > 0 ? fmtN(totales[p.key].monto) : '—'}
                                </td>
                            ))}
                            <td className="p-3 text-center border border-blue-800 bg-emerald-900 text-emerald-100 sticky right-0 font-black">
                                {totalGeneralPeriodos > 0 ? fmtN(totalGeneralPeriodos) : '—'}
                            </td>
                        </tr>

                        {/* ── % Avance Mensual ── */}
                        <tr className="bg-slate-700 text-slate-200">
                            <td colSpan={7} className="p-2 text-right border border-slate-600 text-[10px] uppercase tracking-wider">
                                % Avance Mensual
                            </td>
                            <td className="border border-slate-600" />
                            {periodos.map(p => (
                                <td key={p.key} className="p-2 text-center border border-slate-600 text-[10px]">
                                    {totales[p.key]?.porcentaje > 0 ? `${totales[p.key].porcentaje.toFixed(3)}%` : '—'}
                                </td>
                            ))}
                            <td className="p-2 text-center border border-slate-600 bg-slate-800 sticky right-0">—</td>
                        </tr>

                        {/* ── Días Trabajados ── */}
                        {diasPorMes && (
                            <tr className="bg-indigo-900 text-indigo-100">
                                <td colSpan={7} className="p-2 text-right border border-indigo-800 text-[10px] uppercase tracking-wider font-bold">
                                    Días Trabajados
                                </td>
                                <td className="border border-indigo-800" />
                                {periodos.map(p => {
                                    const dias = diasPorMes[p.key] ?? 0;
                                    return (
                                        <td key={p.key} className="p-2 text-center border border-indigo-800 text-[11px] font-mono">
                                            {dias > 0 ? dias : '—'}
                                        </td>
                                    );
                                })}
                                <td className="p-2 text-center border border-indigo-800 bg-indigo-950 sticky right-0">—</td>
                            </tr>
                        )}

                        {/* ── Valorización Acumulada ── */}
                        <tr className="bg-emerald-900 text-white">
                            <td colSpan={7} className="p-3 text-right border border-emerald-800 uppercase tracking-wider text-xs">
                                Valorización Acumulada (S/.)
                            </td>
                            <td className="border border-emerald-800" />
                            {periodos.map(p => (
                                <td key={p.key} className="p-3 text-center border border-emerald-800 text-emerald-200">
                                    {totales[p.key]?.acumuladoMonto > 0 ? fmtN(totales[p.key].acumuladoMonto) : '—'}
                                </td>
                            ))}
                            <td className="p-3 text-center border border-emerald-800 bg-emerald-800 text-white font-black sticky right-0">
                                {totalAcumuladoFinal > 0 ? fmtN(totalAcumuladoFinal) : '—'}
                            </td>
                        </tr>

                        {/* ── % Avance Acumulado — Curva S ── */}
                        <tr className="bg-slate-900 text-slate-300">
                            <td colSpan={7} className="p-2 text-right border border-slate-700 text-[10px] uppercase tracking-wider">
                                % Avance Acumulado (Curva S)
                            </td>
                            <td className="border border-slate-700" />
                            {periodos.map(p => {
                                const pct = totales[p.key]?.acumuladoPorcentaje ?? 0;
                                return (
                                    <td key={p.key} className="p-2 text-center border border-slate-700 text-[10px]">
                                        {pct > 0
                                            ? <span className="text-emerald-400 font-black">{pct.toFixed(2)}%</span>
                                            : '—'
                                        }
                                    </td>
                                );
                            })}
                            <td className="p-2 text-center border border-slate-700 bg-slate-800 sticky right-0">
                                {totalAcumuladoFinal > 0 && totalPresupuesto > 0
                                    ? <span className="text-emerald-400 font-black">
                                        {((totalAcumuladoFinal / totalPresupuesto) * 100).toFixed(2)}%
                                      </span>
                                    : '—'
                                }
                            </td>
                        </tr>

                        {/* ════════════════════════════════════════════════════════════
                            SECCIÓN FINANCIERA — separador visual
                        ════════════════════════════════════════════════════════════ */}
                        <tr>
                            <td
                                colSpan={8 + periodos.length + 1}
                                className="p-0 border-0 bg-slate-950"
                                style={{ height: '4px' }}
                            />
                        </tr>

                        {/* ── COSTO DIRECTO ── */}
                        {renderFilaFinanciera(
                            'COSTO DIRECTO',
                            costoDirecto,
                            cdMensual,
                            'bg-sky-900 text-sky-100 font-black',
                            undefined,
                            'bg-sky-800 text-sky-100',
                        )}

                        {/* ── GASTOS GENERALES ── */}
                        <tr className="bg-teal-900 text-teal-100">
                            <td className="p-2 border border-slate-700 text-center text-[10px]" />
                            {/* % editable en columna ÍTEM */}
                            <EditablePctCell
                                value={fin.pctGastosGenerales}
                                onChange={v => setPct('pctGastosGenerales', v)}
                                className="bg-teal-800 text-teal-100 text-center"
                            />
                            <td className="p-2 border border-slate-700 text-left font-black text-[11px] uppercase sticky left-0 z-10 bg-teal-900">
                                GASTOS GENERALES
                            </td>
                            <td className="p-2 border border-slate-700" />
                            <td className="p-2 border border-slate-700" />
                            <td className="p-2 border border-slate-700" />
                            <td className="p-2 border border-slate-700 text-right font-black text-[11px]">
                                {fmtS(montoGastosGenerales)}
                            </td>
                            <td className="p-2 border border-slate-700" />
                            {periodos.map(p => {
                                const v = distGG[p.key] ?? 0;
                                return (
                                    <td key={p.key}
                                        className={`p-2 text-right text-[11px] border border-slate-700 font-semibold ${v > 0 ? '' : 'opacity-30'} ${p.key === mesPicoKey && v > 0 ? 'ring-1 ring-inset ring-amber-400' : ''}`}>
                                        {v > 0 ? fmtN(v) : '—'}
                                    </td>
                                );
                            })}
                            <td className="p-2 text-right font-black text-[11px] border border-slate-700 sticky right-0 z-10 bg-teal-800">
                                {fmtS(montoGastosGenerales)}
                            </td>
                        </tr>

                        {/* ── UTILIDAD ── */}
                        <tr className="bg-lime-900 text-lime-100">
                            <td className="p-2 border border-slate-700 text-center text-[10px]" />
                            <EditablePctCell
                                value={fin.pctUtilidad}
                                onChange={v => setPct('pctUtilidad', v)}
                                className="bg-lime-800 text-lime-100 text-center"
                            />
                            <td className="p-2 border border-slate-700 text-left font-black text-[11px] uppercase sticky left-0 z-10 bg-lime-900">
                                UTILIDAD
                            </td>
                            <td className="p-2 border border-slate-700" />
                            <td className="p-2 border border-slate-700" />
                            <td className="p-2 border border-slate-700" />
                            <td className="p-2 border border-slate-700 text-right font-black text-[11px]">
                                {fmtS(montoUtilidad)}
                            </td>
                            <td className="p-2 border border-slate-700" />
                            {periodos.map(p => {
                                const v = distUT[p.key] ?? 0;
                                return (
                                    <td key={p.key}
                                        className={`p-2 text-right text-[11px] border border-slate-700 font-semibold ${v > 0 ? '' : 'opacity-30'} ${p.key === mesPicoKey && v > 0 ? 'ring-1 ring-inset ring-amber-400' : ''}`}>
                                        {v > 0 ? fmtN(v) : '—'}
                                    </td>
                                );
                            })}
                            <td className="p-2 text-right font-black text-[11px] border border-slate-700 sticky right-0 z-10 bg-lime-800">
                                {fmtS(montoUtilidad)}
                            </td>
                        </tr>

                        {/* ── SUB TOTAL ── */}
                        <tr className="bg-slate-800 text-white">
                            <td colSpan={7} className="p-3 text-right border border-slate-700 uppercase tracking-wider text-xs font-black">
                                SUB TOTAL
                            </td>
                            <td className="border border-slate-700 bg-slate-900" />
                            {periodos.map(p => {
                                const v = (cdMensual[p.key] ?? 0) + (distGG[p.key] ?? 0) + (distUT[p.key] ?? 0);
                                return (
                                    <td key={p.key}
                                        className={`p-2 text-right text-[11px] border border-slate-700 font-black ${v > 0 ? '' : 'opacity-30'} ${p.key === mesPicoKey && v > 0 ? 'bg-amber-900/40' : ''}`}>
                                        {v > 0 ? fmtN(v) : '—'}
                                    </td>
                                );
                            })}
                            <td className="p-3 text-right font-black text-[11px] border border-slate-700 sticky right-0 z-10 bg-slate-700">
                                {fmtS(subTotal)}
                            </td>
                        </tr>

                        {/* ── I.G.V. ── */}
                        <tr className="bg-orange-900 text-orange-100">
                            <td className="p-2 border border-slate-700 text-center text-[10px]" />
                            <EditablePctCell
                                value={fin.pctIGV}
                                onChange={v => setPct('pctIGV', v)}
                                className="bg-orange-800 text-orange-100 text-center"
                            />
                            <td className="p-2 border border-slate-700 text-left font-black text-[11px] uppercase sticky left-0 z-10 bg-orange-900">
                                I.G.V.
                            </td>
                            <td className="p-2 border border-slate-700" />
                            <td className="p-2 border border-slate-700" />
                            <td className="p-2 border border-slate-700" />
                            <td className="p-2 border border-slate-700 text-right font-black text-[11px]">
                                {fmtS(montoIGV)}
                            </td>
                            <td className="p-2 border border-slate-700" />
                            {periodos.map(p => {
                                const v = distIGV[p.key] ?? 0;
                                return (
                                    <td key={p.key}
                                        className={`p-2 text-right text-[11px] border border-slate-700 font-semibold ${v > 0 ? '' : 'opacity-30'} ${p.key === mesPicoKey && v > 0 ? 'ring-1 ring-inset ring-amber-400' : ''}`}>
                                        {v > 0 ? fmtN(v) : '—'}
                                    </td>
                                );
                            })}
                            <td className="p-2 text-right font-black text-[11px] border border-slate-700 sticky right-0 z-10 bg-orange-800">
                                {fmtS(montoIGV)}
                            </td>
                        </tr>

                        {/* ── PRESUPUESTADO DE OBRA INFRAESTRUCTURA COMPONENTE I ── */}
                        <tr className="bg-violet-900 text-violet-100 font-black">
                            <td colSpan={7} className="p-3 text-right border border-slate-700 uppercase tracking-wider text-xs">
                                PRESUPUESTADO DE OBRA INFRAESTRUCTURA COMPONENTE I
                            </td>
                            <td className="border border-slate-700 bg-violet-950" />
                            {periodos.map(p => {
                                const v = distPresI[p.key] ?? 0;
                                return (
                                    <td key={p.key}
                                        className={`p-2 text-right text-[11px] border border-slate-700 font-black ${v > 0 ? '' : 'opacity-30'} ${p.key === mesPicoKey && v > 0 ? 'bg-amber-900/40' : ''}`}>
                                        {v > 0 ? fmtN(v) : '—'}
                                    </td>
                                );
                            })}
                            <td className="p-3 text-right font-black text-[11px] border border-slate-700 sticky right-0 z-10 bg-violet-800">
                                {fmtS(presupuestoCompI)}
                            </td>
                        </tr>

                        {/* ═══ SEPARADOR COMPONENTE II ═══ */}
                        <tr>
                            <td
                                colSpan={8 + periodos.length + 1}
                                className="p-0 border-0 bg-slate-800"
                                style={{ height: '3px' }}
                            />
                        </tr>

                        {/* ── MOBILIARIO Y EQUIPAMIENTO COMPONENTE II ── */}
                        <tr className="bg-zinc-800 text-zinc-200">
                            <td className="p-2 border border-slate-700 text-center text-[10px]" />
                            <td className="p-2 border border-slate-700 text-center text-[10px] text-zinc-400 italic">monto</td>
                            <td className="p-2 border border-slate-700 text-left font-black text-[11px] uppercase sticky left-0 z-10 bg-zinc-800">
                                MOBILIARIO Y EQUIPAMIENTO COMPONENTE II
                            </td>
                            <td className="p-2 border border-slate-700" />
                            <td className="p-2 border border-slate-700" />
                            <td className="p-2 border border-slate-700" />
                            {/* PARCIAL editable */}
                            <EditableMontoFin
                                value={fin.montoMobiliario}
                                onChange={v => setPct('montoMobiliario', v)}
                                className="bg-zinc-700 text-yellow-300"
                            />
                            <td className="p-2 border border-slate-700" />
                            {/* Sin distribución mensual para comp II */}
                            {periodos.map(p => (
                                <td key={p.key} className="p-2 text-center border border-slate-700 text-zinc-600 opacity-40">—</td>
                            ))}
                            <td className="p-2 text-right font-black text-[11px] border border-slate-700 sticky right-0 z-10 bg-zinc-700 text-yellow-300">
                                {fmtS(fin.montoMobiliario)}
                            </td>
                        </tr>

                        {/* ── IGV (MOBILIARIO Y EQUIPAMIENTO) ── */}
                        <tr className="bg-zinc-900 text-zinc-300">
                            <td className="p-2 border border-slate-700 text-center text-[10px]" />
                            <EditablePctCell
                                value={fin.pctIGVMobiliario}
                                onChange={v => setPct('pctIGVMobiliario', v)}
                                className="bg-zinc-800 text-zinc-200 text-center"
                            />
                            <td className="p-2 border border-slate-700 text-left font-black text-[11px] uppercase sticky left-0 z-10 bg-zinc-900">
                                IGV (MOBILIARIO Y EQUIPAMIENTO)
                            </td>
                            <td className="p-2 border border-slate-700" />
                            <td className="p-2 border border-slate-700" />
                            <td className="p-2 border border-slate-700" />
                            <td className="p-2 border border-slate-700 text-right font-black text-[11px]">
                                {fmtS(montoIGVMobiliario)}
                            </td>
                            <td className="p-2 border border-slate-700" />
                            {periodos.map(p => (
                                <td key={p.key} className="p-2 text-center border border-slate-700 text-zinc-600 opacity-40">—</td>
                            ))}
                            <td className="p-2 text-right font-black text-[11px] border border-slate-700 sticky right-0 z-10 bg-zinc-800">
                                {fmtS(montoIGVMobiliario)}
                            </td>
                        </tr>

                        {/* ── SUB TOTAL COMPONENTE II ── */}
                        <tr className="bg-zinc-700 text-amber-300 font-black">
                            <td colSpan={7} className="p-3 text-right border border-slate-700 uppercase tracking-wider text-xs">
                                SUB TOTAL COMPONENTE II
                            </td>
                            <td className="border border-slate-700 bg-zinc-800" />
                            {periodos.map(p => (
                                <td key={p.key} className="p-2 text-center border border-slate-700 text-zinc-500 opacity-40">—</td>
                            ))}
                            <td className="p-3 text-right font-black text-[11px] border border-slate-700 sticky right-0 z-10 bg-zinc-600 text-amber-300">
                                {fmtS(subTotalCompII)}
                            </td>
                        </tr>

                        {/* ── TOTAL PRESUPUESTO DE OBRA COMPONENTE I+II ── */}
                        <tr className="bg-slate-950 text-white font-black">
                            <td colSpan={7} className="p-3 text-right border border-slate-700 uppercase tracking-wider text-xs">
                                TOTAL PRESUPUESTO DE OBRA COMPONENTE I+II
                            </td>
                            <td className="border border-slate-700" />
                            {periodos.map(p => (
                                <td key={p.key} className="p-2 text-center border border-slate-700 text-slate-500 opacity-40">—</td>
                            ))}
                            <td className="p-3 text-right font-black text-[12px] border border-slate-700 sticky right-0 z-10 bg-slate-900 text-white">
                                {fmtS(totalCompIII)}
                            </td>
                        </tr>

                        {/* ═══ SEPARADOR ═══ */}
                        <tr>
                            <td
                                colSpan={8 + periodos.length + 1}
                                className="p-0 border-0 bg-rose-950"
                                style={{ height: '3px' }}
                            />
                        </tr>

                        {/* ── GASTOS DE SUPERVISIÓN Y LIQUIDACIÓN ── */}
                        <tr className="bg-rose-900 text-rose-100">
                            <td className="p-2 border border-slate-700 text-center text-[10px]" />
                            <EditablePctCell
                                value={fin.pctSupervision}
                                onChange={v => setPct('pctSupervision', v)}
                                className="bg-rose-800 text-rose-100 text-center"
                            />
                            <td className="p-2 border border-slate-700 text-left font-black text-[11px] uppercase sticky left-0 z-10 bg-rose-900">
                                GASTOS DE SUPERVISIÓN Y LIQUIDACIÓN
                            </td>
                            <td className="p-2 border border-slate-700" />
                            <td className="p-2 border border-slate-700" />
                            <td className="p-2 border border-slate-700" />
                            <td className="p-2 border border-slate-700 text-right font-black text-[11px]">
                                {fmtS(montoSupervision)}
                            </td>
                            <td className="p-2 border border-slate-700" />
                            {periodos.map(p => {
                                const v = distSup[p.key] ?? 0;
                                return (
                                    <td key={p.key}
                                        className={`p-2 text-right text-[11px] border border-slate-700 font-semibold ${v > 0 ? '' : 'opacity-30'} ${p.key === mesPicoKey && v > 0 ? 'ring-1 ring-inset ring-amber-400' : ''}`}>
                                        {v > 0 ? fmtN(v) : '—'}
                                    </td>
                                );
                            })}
                            <td className="p-2 text-right font-black text-[11px] border border-slate-700 sticky right-0 z-10 bg-rose-800">
                                {fmtS(montoSupervision)}
                            </td>
                        </tr>

                        {/* ══ PRESUPUESTO TOTAL ══ */}
                        <tr className="bg-emerald-800 text-white font-black text-[12px]">
                            <td colSpan={7} className="p-4 text-right border border-emerald-700 uppercase tracking-widest text-sm">
                                PRESUPUESTO TOTAL
                            </td>
                            <td className="border border-emerald-700 bg-emerald-900" />
                            {periodos.map(p => {
                                // Para el PRESUPUESTO TOTAL mensual: COMP I mensual + supervisión mensual
                                // (Comp II no tiene distribución mensual)
                                const v = (distPresI[p.key] ?? 0) + (distSup[p.key] ?? 0);
                                return (
                                    <td key={p.key}
                                        className={`p-3 text-right text-[11px] border border-emerald-700 font-black ${v > 0 ? 'text-emerald-200' : 'opacity-30'} ${p.key === mesPicoKey && v > 0 ? 'bg-amber-800/50' : ''}`}>
                                        {v > 0 ? fmtN(v) : '—'}
                                    </td>
                                );
                            })}
                            <td className="p-4 text-right font-black text-[13px] border-2 border-emerald-400 sticky right-0 z-10 bg-emerald-700 text-white">
                                {fmtS(presupuestoTotal)}
                            </td>
                        </tr>

                        {/* ── AVANCE MENSUAL (sobre el total) ── */}
                        <tr className="bg-slate-800 text-slate-300 text-[10px]">
                            <td colSpan={7} className="p-2 text-right border border-slate-700 uppercase tracking-wider font-bold">
                                AVANCE MENSUAL
                            </td>
                            <td className="border border-slate-700" />
                            {periodos.map(p => {
                                const pct = costoDirecto > 0
                                    ? ((cdMensual[p.key] ?? 0) / costoDirecto) * 100
                                    : 0;
                                return (
                                    <td key={p.key} className="p-2 text-center border border-slate-700">
                                        {pct > 0 ? `${pct.toFixed(2)}%` : '—'}
                                    </td>
                                );
                            })}
                            <td className="p-2 text-center border border-slate-700 bg-slate-900 sticky right-0">—</td>
                        </tr>

                        {/* ── AVANCE ACUMULADO ── */}
                        <tr className="bg-slate-900 text-emerald-400 text-[10px] font-black">
                            <td colSpan={7} className="p-2 text-right border border-slate-700 uppercase tracking-wider">
                                AVANCE ACUMULADO
                            </td>
                            <td className="border border-slate-700" />
                            {(() => {
                                let acum = 0;
                                return periodos.map(p => {
                                    acum += cdMensual[p.key] ?? 0;
                                    const pct = costoDirecto > 0 ? (acum / costoDirecto) * 100 : 0;
                                    return (
                                        <td key={p.key} className="p-2 text-center border border-slate-700">
                                            {pct > 0 ? `${pct.toFixed(2)}%` : '—'}
                                        </td>
                                    );
                                });
                            })()}
                            <td className="p-2 text-center border border-slate-700 bg-emerald-900 sticky right-0 text-emerald-300">
                                {costoDirecto > 0 ? '100.00%' : '—'}
                            </td>
                        </tr>

                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default TablaValorizada;