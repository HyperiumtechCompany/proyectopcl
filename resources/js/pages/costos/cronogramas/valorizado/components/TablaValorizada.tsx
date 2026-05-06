import React, { useState, useRef } from 'react';
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
// CELDA EDITABLE
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
// TABLA PRINCIPAL
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
    // 🆕 Total por fila (suma de todos los meses)
    totalesPorItem?:     Record<string | number, number>;
    // 🆕 Total general de la columna TOTAL
    totalGeneralPeriodos?: number;
}

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

    // Total acumulado de la fila VALORIZACIÓN ACUMULADA (último período)
    const lastKey          = periodos.length > 0 ? periodos[periodos.length - 1].key : '';
    const totalAcumuladoFinal = totales[lastKey]?.acumuladoMonto ?? 0;

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
                    {/* ── ENCABEZADO ── */}
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
                            {/* 🆕 Columna TOTAL al final */}
                            <th className="p-3 border border-slate-700 text-center min-w-[110px] bg-emerald-900 text-emerald-100 sticky right-0 z-30">
                                <div>TOTAL</div>
                                <div className="text-[8px] font-normal text-emerald-300 normal-case">S/. acumulado</div>
                            </th>
                        </tr>
                    </thead>

                    {/* ── CUERPO ── */}
                    <tbody>
                        {visibleItems.map((item, idx) => {
                            const n         = nivel(item.item);
                            const isLeaf    = item.is_leaf;
                            const hasKids   = items.some(
                                i => i.item.startsWith(item.item + '.') || i.item.startsWith(item.item + ' ')
                            );
                            const isCollapsed = collapsed.has(item.item);
                            const bg          = bgNivel(n, isLeaf);
                            const desvio      = isLeaf ? (desviaciones[item.id] ?? 0) : 0;
                            const tieneDesv   = desvio > 0.01;
                            // Total de esta fila (suma de todos sus meses)
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
                                    {/* 🆕 Celda TOTAL por fila — sticky derecha */}
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

                    {/* ── FOOTER ── */}
                    <tfoot className="font-black text-[11px] sticky bottom-0 z-10">
                        {/* Valorización Mensual */}
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
                            {/* Total general mensual */}
                            <td className="p-3 text-center border border-blue-800 bg-emerald-900 text-emerald-100 sticky right-0 font-black">
                                {totalGeneralPeriodos > 0 ? fmtN(totalGeneralPeriodos) : '—'}
                            </td>
                        </tr>

                        {/* % Avance Mensual */}
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

                        {/* Días Trabajados */}
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

                        {/* Valorización Acumulada */}
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
                            {/* Total acumulado final */}
                            <td className="p-3 text-center border border-emerald-800 bg-emerald-800 text-white font-black sticky right-0">
                                {totalAcumuladoFinal > 0 ? fmtN(totalAcumuladoFinal) : '—'}
                            </td>
                        </tr>

                        {/* % Avance Acumulado — Curva S */}
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
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default TablaValorizada;