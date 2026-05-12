import React, { useRef } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, Filter } from 'lucide-react';
import { Material, Periodo, ViewMode, SortField, SortDir, FiltroState } from '../types';

interface Props {
    materiales:       Material[];
    periodos:         Periodo[];
    viewMode:         ViewMode;
    totalesMensuales: Record<string, number>;
    totalGeneral:     number;
    sortField:        SortField;
    sortDir:          SortDir;
    filtro:           FiltroState;
    mesPicoKey:       string;
    destacado:        string | null;
    setDestacado:     (d: string | null) => void;
    onToggleSort:     (field: SortField) => void;
    onFiltroChange:   (f: Partial<FiltroState>) => void;
    getIntensidad:    (val: number) => number;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────────────────
const fmtNum = (v: number, decimales = 2) =>
    v.toLocaleString('es-PE', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

const fmtSoles = (v: number) =>
    `S/. ${fmtNum(v)}`;

const intensidadBg = (i: number): string => {
    if (i === 0)   return '';
    if (i < 0.15)  return 'bg-blue-50';
    if (i < 0.35)  return 'bg-blue-100';
    if (i < 0.60)  return 'bg-blue-200';
    if (i < 0.85)  return 'bg-blue-300 text-blue-900';
    return 'bg-blue-500 text-white font-black';
};

// ─────────────────────────────────────────────────────────────────────────────
// ENCABEZADO DE COLUMNA ORDENABLE
// ─────────────────────────────────────────────────────────────────────────────
const SortTh: React.FC<{
    field:    SortField;
    current:  SortField;
    dir:      SortDir;
    label:    string;
    align?:   string;
    onClick:  (f: SortField) => void;
}> = ({ field, current, dir, label, align = 'left', onClick }) => {
    const isActive = current === field;
    return (
        <th
            className={`p-3 text-${align} cursor-pointer select-none whitespace-nowrap group border-r border-slate-200 hover:bg-slate-100 transition-colors`}
            onClick={() => onClick(field)}
        >
            <span className="flex items-center gap-1 justify-end">
                <span className={`text-[10px] font-black uppercase tracking-wider ${isActive ? 'text-blue-600' : 'text-slate-500'}`}>
                    {label}
                </span>
                {isActive
                    ? (dir === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />)
                    : <ChevronsUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500" />
                }
            </span>
        </th>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
const TablaMateriales: React.FC<Props> = ({
    materiales, periodos, viewMode,
    totalesMensuales, totalGeneral,
    sortField, sortDir, filtro, mesPicoKey,
    destacado, setDestacado,
    onToggleSort, onFiltroChange, getIntensidad,
}) => {
    const tableRef = useRef<HTMLDivElement>(null);

    const totalMensualGeneral = Object.values(totalesMensuales).reduce((a, b) => a + b, 0);

    // Sin resultados
    if (materiales.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                <BarraFiltro filtro={filtro} onFiltroChange={onFiltroChange} count={0} total={0} />
                <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                    <span className="text-5xl mb-4">📦</span>
                    <p className="text-sm font-bold">No hay materiales que mostrar</p>
                    <p className="text-xs mt-1">Ajuste los filtros o verifique el Gantt general</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            {/* Barra de filtros */}
            <BarraFiltro
                filtro={filtro}
                onFiltroChange={onFiltroChange}
                count={materiales.length}
                total={materiales.length}
            />

            {/* Tabla */}
            <div ref={tableRef} className="overflow-x-auto">
                <table className="w-full text-left border-collapse" style={{ minWidth: `${Math.max(1200, 800 + periodos.length * 110)}px` }}>
                    {/* ENCABEZADOS */}
                    <thead className="sticky top-0 z-20">
                        <tr className="bg-slate-900 text-white">
                            <th className="p-3 text-[10px] font-black uppercase tracking-wider sticky left-0 bg-slate-900 z-30 min-w-[300px] border-r border-slate-700">
                                Insumo / Descripción
                            </th>
                            <th className="p-3 text-center text-[10px] font-black uppercase tracking-wider border-r border-slate-700 min-w-[60px]">
                                Und
                            </th>
                            <SortTh field="precio"         current={sortField} dir={sortDir} label="Precio"         onClick={onToggleSort} />
                            <SortTh field="cantidad_total" current={sortField} dir={sortDir} label="Cantidad Total"  onClick={onToggleSort} />
                            <SortTh field="presupuesto"    current={sortField} dir={sortDir} label="Presupuesto S/." onClick={onToggleSort} />
                            {periodos.map(p => (
                                <th
                                    key={p.key}
                                    className={`p-3 text-center text-[10px] font-black uppercase tracking-wider border-r border-slate-700 min-w-[100px] ${
                                        p.key === mesPicoKey ? 'bg-amber-600' : ''
                                    }`}
                                >
                                    {p.key === mesPicoKey && <span className="text-amber-200 text-[8px] block">🔝 PICO</span>}
                                    {p.label}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    {/* CUERPO */}
                    <tbody className="divide-y divide-slate-100">
                        {materiales.map((mat, i) => {
                            const isDestacado = destacado === mat.descripcion;
                            return (
                                <tr
                                    key={`${mat.descripcion}-${i}`}
                                    className={`transition-all cursor-pointer group ${
                                        isDestacado
                                            ? 'bg-yellow-50 ring-2 ring-inset ring-yellow-300'
                                            : i % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/40 hover:bg-slate-100/60'
                                    }`}
                                    onClick={() => setDestacado(isDestacado ? null : mat.descripcion)}
                                >
                                    {/* Descripción */}
                                    <td className={`p-3 sticky left-0 z-10 border-r border-slate-100 shadow-[2px_0_4px_rgba(0,0,0,0.03)] transition-colors ${
                                        isDestacado ? 'bg-yellow-50' : i % 2 === 0 ? 'bg-white group-hover:bg-slate-50' : 'bg-slate-50/40 group-hover:bg-slate-100'
                                    }`}>
                                        <div className="flex items-center gap-2">
                                            {isDestacado && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
                                            <span className="text-[11px] font-bold text-slate-800 leading-tight">
                                                {mat.descripcion}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Unidad */}
                                    <td className="p-3 text-center text-[10px] font-bold text-slate-500 border-r border-slate-100 uppercase">
                                        {mat.unidad}
                                    </td>

                                    {/* Precio */}
                                    <td className="p-3 text-right text-[11px] font-mono text-slate-600 border-r border-slate-100">
                                        {fmtSoles(mat.precio)}
                                    </td>

                                    {/* Cantidad total */}
                                    <td className="p-3 text-right text-[11px] font-black text-slate-800 border-r border-slate-100">
                                        {fmtNum(mat.cantidad_total, 3)}
                                    </td>

                                    {/* Presupuesto */}
                                    <td className="p-3 text-right text-[11px] font-black text-emerald-700 border-r border-slate-100">
                                        {fmtSoles(mat.presupuesto)}
                                    </td>

                                    {/* Mensual */}
                                    {periodos.map(p => {
                                        const cant  = mat.mensual[p.key] || 0;
                                        const monto = cant * mat.precio;
                                        const disp  = viewMode === 'cantidad' ? cant : monto;
                                        const intens = viewMode === 'monto'
                                            ? getIntensidad((totalesMensuales[p.key] || 0))
                                            : getIntensidad(cant / Math.max(mat.cantidad_total, 1));
                                        const bgClass = cant > 0 ? intensidadBg(intens) : '';

                                        return (
                                            <td
                                                key={p.key}
                                                className={`p-3 text-right text-[11px] font-mono border-r border-slate-100 transition-colors ${
                                                    bgClass || (cant === 0 ? 'text-slate-200' : 'text-slate-800')
                                                } ${p.key === mesPicoKey && cant > 0 ? 'ring-1 ring-inset ring-amber-300' : ''}`}
                                            >
                                                {cant > 0
                                                    ? (viewMode === 'cantidad'
                                                        ? fmtNum(disp, 3)
                                                        : fmtSoles(disp))
                                                    : <span className="text-slate-200">—</span>
                                                }
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>

                    {/* TOTALES */}
                    <tfoot>
                        <tr className="bg-slate-800 text-white">
                            <td colSpan={4} className="p-3 text-right text-[10px] font-black uppercase tracking-wider border-r border-slate-700 sticky left-0 bg-slate-800">
                                Totales Acumulados ({materiales.length} insumos)
                            </td>
                            <td className="p-3 text-right text-[11px] font-black text-emerald-300 border-r border-slate-700">
                                {fmtSoles(totalGeneral)}
                            </td>
                            {periodos.map(p => {
                                const v  = totalesMensuales[p.key] || 0;
                                const isPico = p.key === mesPicoKey && v > 0;
                                return (
                                    <td
                                        key={p.key}
                                        className={`p-3 text-right text-[11px] font-black border-r border-slate-700 ${
                                            isPico ? 'text-amber-300 bg-amber-900/40' : 'text-blue-200'
                                        }`}
                                    >
                                        {v > 0
                                            ? (viewMode === 'monto' ? fmtSoles(v) : fmtNum(v, 2))
                                            : <span className="opacity-30">—</span>
                                        }
                                    </td>
                                );
                            })}
                        </tr>
                        {/* Porcentaje del total */}
                        <tr className="bg-slate-900 text-slate-400">
                            <td colSpan={5} className="p-2 text-right text-[9px] font-bold uppercase tracking-wider border-r border-slate-700 sticky left-0 bg-slate-900">
                                % sobre total mensual acumulado
                            </td>
                            {periodos.map(p => {
                                const v   = totalesMensuales[p.key] || 0;
                                const pct = totalMensualGeneral > 0 ? (v / totalMensualGeneral) * 100 : 0;
                                return (
                                    <td key={p.key} className="p-2 text-right text-[9px] font-bold border-r border-slate-800">
                                        {pct > 0 ? `${pct.toFixed(1)}%` : ''}
                                    </td>
                                );
                            })}
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// BARRA DE FILTROS
// ─────────────────────────────────────────────────────────────────────────────
const BarraFiltro: React.FC<{
    filtro: FiltroState;
    onFiltroChange: (f: Partial<FiltroState>) => void;
    count: number;
    total: number;
}> = ({ filtro, onFiltroChange, count, total }) => (
    <div className="flex items-center gap-3 p-4 border-b border-slate-100 bg-slate-50/50">
        <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
                type="text"
                placeholder="Buscar material o unidad..."
                value={filtro.busqueda}
                onChange={e => onFiltroChange({ busqueda: e.target.value })}
                className="w-full pl-8 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            />
            {filtro.busqueda && (
                <button
                    onClick={() => onFiltroChange({ busqueda: '' })}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm"
                >✕</button>
            )}
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
                type="checkbox"
                checked={filtro.soloConCant}
                onChange={e => onFiltroChange({ soloConCant: e.target.checked })}
                className="w-4 h-4 rounded accent-blue-600"
            />
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                Solo con cantidad
            </span>
        </label>

        <div className="ml-auto text-[10px] font-bold text-slate-400 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            {count} insumos
        </div>
    </div>
);

export default TablaMateriales;