import React, { useRef } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, Filter } from 'lucide-react';
import { MaterialItem, Periodo, ViewMode, SortField, SortDir, FiltroState } from '../types';

interface Props {
    materiales:       MaterialItem[];
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

// UTILIDADES

const fmtNum = (v: number, decimales = 2) =>
    v.toLocaleString('es-PE', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

const fmtSoles = (v: number) =>
    `S/. ${fmtNum(v)}`;

const intensidadBg = (i: number): string => {
    if (i === 0)   return '';
    if (i < 0.15)  return 'bg-blue-50';
    if (i < 0.35)  return 'bg-blue-100';
    if (i < 0.60)  return 'bg-blue-200';
    if (i < 0.85)  return 'bg-blue-300';
    return 'bg-blue-500 text-white';
};

// Obtener valor según modo de vista
const getCantidad = (material: MaterialItem, key: string): number => {
    return material.distribucion[key]?.cantidad || 0;
};

const getMonto = (material: MaterialItem, key: string): number => {
    return material.distribucion[key]?.monto || 0;
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
    onToggleSort, onFiltroChange,
}) => {
    const tableRef = useRef<HTMLDivElement>(null);

    // Calcular máximos para intensidad de celdas (modo independiente)
    const maxCantidadPorPeriodo: Record<string, number> = {};
    const maxMontoPorPeriodo: Record<string, number> = {};
    
    periodos.forEach(p => {
        maxCantidadPorPeriodo[p.key] = Math.max(...materiales.map(m => getCantidad(m, p.key)), 1);
        maxMontoPorPeriodo[p.key] = Math.max(...materiales.map(m => getMonto(m, p.key)), 1);
    });

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

    // Ancho total de la tabla: columnas fijas + (periodos × 2 subcolumnas)
    const anchoTabla = 500 + (periodos.length * 180);

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
                <table className="w-full text-left border-collapse" style={{ minWidth: `${anchoTabla}px` }}>
                    {/* ENCABEZADOS - DOS FILAS */}
                    <thead className="sticky top-0 z-20">
                        {/* Primera fila: Tipo, Descripción, Und, Precio, Totales */}
                        <tr className="bg-slate-900 text-white">
                            <th rowSpan={2} className="p-3 text-[10px] font-black uppercase tracking-wider sticky left-0 bg-slate-900 z-30 min-w-[180px] border-r border-slate-700">
                                Tipo
                            </th>
                            <th rowSpan={2} className="p-3 text-[10px] font-black uppercase tracking-wider sticky left-[180px] bg-slate-900 z-30 min-w-[250px] border-r border-slate-700">
                                Descripción
                            </th>
                            <th rowSpan={2} className="p-3 text-center text-[10px] font-black uppercase tracking-wider border-r border-slate-700 min-w-[60px]">
                                Und
                            </th>
                            <th rowSpan={2} className="p-3 text-right text-[10px] font-black uppercase tracking-wider border-r border-slate-700 min-w-[90px]">
                                Precio Unit.
                            </th>
                            {/* Subcolumnas de meses */}
                            {periodos.map(p => (
                                <th
                                    key={`${p.key}-header`}
                                    colSpan={2}
                                    className={`p-3 text-center text-[10px] font-black uppercase tracking-wider border-r border-slate-700 min-w-[140px] ${
                                        p.key === mesPicoKey ? 'bg-amber-600' : ''
                                    }`}
                                >
                                    {p.key === mesPicoKey && <span className="text-amber-200 text-[8px] block">🔝 PICO</span>}
                                    {p.labelCal || p.label}
                                </th>
                            ))}
                            <th rowSpan={2} className="p-3 text-right text-[10px] font-black uppercase tracking-wider border-r border-slate-700 min-w-[120px]">
                                Total Cantidad
                            </th>
                            <th rowSpan={2} className="p-3 text-right text-[10px] font-black uppercase tracking-wider border-r border-slate-700 min-w-[120px]">
                                Total Parcial S/.
                            </th>
                        </tr>
                        {/* Segunda fila: Cantidad | Parcial */}
                        <tr className="bg-slate-800 text-white">
                            {periodos.map(p => (
                                <React.Fragment key={`${p.key}-sub`}>
                                    <th className="p-2 text-center text-[9px] font-black uppercase tracking-wider border-r border-slate-600 bg-slate-800">
                                        Cantidad
                                    </th>
                                    <th className="p-2 text-center text-[9px] font-black uppercase tracking-wider border-r border-slate-600 bg-slate-800">
                                        Parcial S/.
                                    </th>
                                </React.Fragment>
                            ))}
                        </tr>
                    </thead>

                    {/* CUERPO */}
                    <tbody className="divide-y divide-slate-100">
                        {materiales.map((mat, idx) => {
                            const isDestacado = destacado === mat.descripcion;
                            const tipoMostrar = mat.tipo?.replace(/_/g, ' ').toUpperCase() || 'MATERIALES';
                            
                            return (
                                <tr
                                    key={`${mat.descripcion}-${idx}`}
                                    className={`transition-all cursor-pointer group ${
                                        isDestacado
                                            ? 'bg-yellow-50 ring-2 ring-inset ring-yellow-300'
                                            : idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/40 hover:bg-slate-100'
                                    }`}
                                    onClick={() => setDestacado(isDestacado ? null : mat.descripcion)}
                                >
                                    {/* Tipo */}
                                    <td className={`p-3 text-[10px] font-black text-slate-600 sticky left-0 z-10 border-r border-slate-100 ${
                                        isDestacado ? 'bg-yellow-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                                    }`}>
                                        {tipoMostrar}
                                    </td>

                                    {/* Descripción */}
                                    <td className={`p-3 sticky left-[180px] z-10 border-r border-slate-100 ${
                                        isDestacado ? 'bg-yellow-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
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

                                    {/* Precio Unitario */}
                                    <td className="p-3 text-right text-[11px] font-mono text-slate-600 border-r border-slate-100">
                                        {fmtSoles(mat.precio)}
                                    </td>

                                    {/* Datos mensuales: Cantidad + Parcial por cada mes */}
                                    {periodos.map(p => {
                                        const cantidad = getCantidad(mat, p.key);
                                        const monto = getMonto(mat, p.key);
                                        
                                        const intensidadCantidad = maxCantidadPorPeriodo[p.key] > 0 
                                            ? cantidad / maxCantidadPorPeriodo[p.key] 
                                            : 0;
                                        const intensidadMonto = maxMontoPorPeriodo[p.key] > 0 
                                            ? monto / maxMontoPorPeriodo[p.key] 
                                            : 0;
                                        
                                        return (
                                            <React.Fragment key={`${mat.descripcion}-${p.key}`}>
                                                {/* Cantidad */}
                                                <td className={`p-3 text-right text-[11px] font-mono border-r border-slate-100 transition-colors ${
                                                    cantidad > 0 ? intensidadBg(intensidadCantidad) : 'text-slate-300'
                                                } ${p.key === mesPicoKey && cantidad > 0 ? 'ring-1 ring-inset ring-amber-300' : ''}`}>
                                                    {cantidad > 0 ? fmtNum(cantidad, 4) : <span className="text-slate-300">—</span>}
                                                </td>
                                                {/* Parcial */}
                                                <td className={`p-3 text-right text-[11px] font-mono border-r border-slate-100 transition-colors ${
                                                    monto > 0 ? intensidadBg(intensidadMonto) : 'text-slate-300'
                                                } ${p.key === mesPicoKey && monto > 0 ? 'ring-1 ring-inset ring-amber-300' : ''}`}>
                                                    {monto > 0 ? fmtSoles(monto) : <span className="text-slate-300">—</span>}
                                                </td>
                                            </React.Fragment>
                                        );
                                    })}

                                    {/* Total Cantidad */}
                                    <td className="p-3 text-right text-[11px] font-black text-slate-800 border-r border-slate-100">
                                        {fmtNum(mat.cantidad_total, 4)}
                                    </td>

                                    {/* Total Parcial */}
                                    <td className="p-3 text-right text-[11px] font-black text-emerald-700 border-r border-slate-100">
                                        {fmtSoles(mat.costo_total)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>

                    {/* TOTALES GENERALES */}
                    <tfoot>
                        {/* Fila de totales numéricos */}
                        <tr className="bg-slate-800 text-white">
                            <td colSpan={4} className="p-3 text-right text-[10px] font-black uppercase tracking-wider sticky left-0 bg-slate-800 border-r border-slate-700">
                                TOTALES GENERALES
                            </td>
                            {periodos.map(p => {
                                const totalCantidad = materiales.reduce((sum, m) => sum + getCantidad(m, p.key), 0);
                                const totalMonto = materiales.reduce((sum, m) => sum + getMonto(m, p.key), 0);
                                return (
                                    <React.Fragment key={`total-${p.key}`}>
                                        <td className="p-3 text-right text-[11px] font-black text-emerald-300 border-r border-slate-700">
                                            {fmtNum(totalCantidad, 2)}
                                        </td>
                                        <td className="p-3 text-right text-[11px] font-black text-emerald-300 border-r border-slate-700">
                                            {fmtSoles(totalMonto)}
                                        </td>
                                    </React.Fragment>
                                );
                            })}
                            <td className="p-3 text-right text-[11px] font-black text-emerald-300 border-r border-slate-700">
                                {fmtNum(materiales.reduce((sum, m) => sum + m.cantidad_total, 0), 2)}
                            </td>
                            <td className="p-3 text-right text-[11px] font-black text-emerald-300 border-r border-slate-700">
                                {fmtSoles(totalGeneral)}
                            </td>
                        </tr>

                        {/* Fila de porcentajes */}
                        <tr className="bg-slate-900 text-slate-400">
                            <td colSpan={4} className="p-2 text-right text-[9px] font-bold uppercase tracking-wider sticky left-0 bg-slate-900 border-r border-slate-800">
                                % del total mensual
                            </td>
                            {periodos.map(p => {
                                const totalMonto = materiales.reduce((sum, m) => sum + getMonto(m, p.key), 0);
                                const pct = totalMensualGeneral > 0 ? (totalMonto / totalMensualGeneral) * 100 : 0;
                                return (
                                    <React.Fragment key={`pct-${p.key}`}>
                                        <td colSpan={2} className="p-2 text-center text-[9px] font-bold border-r border-slate-800">
                                            {pct > 0 ? `${pct.toFixed(1)}%` : ''}
                                        </td>
                                    </React.Fragment>
                                );
                            })}
                            <td colSpan={2} className="p-2 text-right text-[9px] font-bold">
                                100%
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// BARRA DE FILTROS (MEJORADA)
// ─────────────────────────────────────────────────────────────────────────────
const BarraFiltro: React.FC<{
    filtro: FiltroState;
    onFiltroChange: (f: Partial<FiltroState>) => void;
    count: number;
    total: number;
}> = ({ filtro, onFiltroChange, count, total }) => (
    <div className="flex items-center gap-3 p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
                type="text"
                placeholder="Buscar material, unidad o tipo..."
                value={filtro.busqueda}
                onChange={e => onFiltroChange({ busqueda: e.target.value })}
                className="w-full pl-10 pr-8 py-2.5 text-sm text-slate-700 font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300 transition-all placeholder:text-slate-400 shadow-sm"
            />
            {filtro.busqueda && (
                <button
                    onClick={() => onFiltroChange({ busqueda: '' })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full p-1 transition-colors"
                >
                    ✕
                </button>
            )}
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-2 rounded-lg bg-white border border-slate-200 shadow-sm">
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

        <select
            value={filtro.tipoFiltro || ''}
            onChange={e => onFiltroChange({ tipoFiltro: e.target.value || undefined })}
            className="text-[10px] font-bold border border-slate-200 rounded-lg px-3 py-2.5 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
        >
            <option value="">Todos los tipos</option>
            <option value="mano_de_obra">👷 Mano de Obra</option>
            <option value="materiales">📦 Materiales</option>
            <option value="equipos">🔧 Equipos</option>
            <option value="subcontratos">📋 Subcontratos</option>
            <option value="otros">📎 Otros</option>
        </select>

        <div className="ml-auto flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100">
            <Filter className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] font-bold text-slate-600">
                {count} {count === 1 ? 'insumo' : 'insumos'}
            </span>
        </div>
    </div>
);

export default TablaMateriales;