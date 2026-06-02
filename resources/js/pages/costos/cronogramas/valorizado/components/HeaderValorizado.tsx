import React from 'react';
import { Search, FileDown, FileText, Trash2, Save, ArrowLeft, AlertTriangle, DollarSign  } from 'lucide-react';
import { Link } from '@inertiajs/react';
import { ViewMode } from '../types';


interface Props {
    project:         string;
    projectName:     string;
    viewMode:        ViewMode;
    setViewMode:     (v: ViewMode) => void;
    searchTerm:      string;
    setSearchTerm:   (s: string) => void;
    estaGuardado:    boolean;
    saving:          boolean;
    deleting:        boolean;
    onSave:          () => void;
    onDelete:        () => void;
    onExportExcel:   () => void;
    onExportPDF:     () => void;
    totalDesviadas?: number;
    onOpenDesembolso?: () => void; 
}

const HeaderValorizado: React.FC<Props> = ({
    project, projectName,
    viewMode, setViewMode,
    searchTerm, setSearchTerm,
    estaGuardado, saving, deleting,
    onSave, onDelete, onExportExcel, onExportPDF,
    totalDesviadas = 0,
    onOpenDesembolso, 
}) => (
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">

        {/* ── Título ── */}
        <div>
            <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                    Cronograma de Valorización
                </h1>

                {estaGuardado && (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded-full uppercase border border-emerald-200">
                        Guardado
                    </span>
                )}

                {totalDesviadas > 0 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-700 text-[9px] font-black rounded-full uppercase border border-rose-200">
                        <AlertTriangle className="w-3 h-3" />
                        {totalDesviadas} con desvío
                    </span>
                )}
            </div>

            <p className="text-xs text-slate-500 font-semibold mt-0.5 uppercase tracking-wide">
                {projectName}
            </p>
        </div>

        {/* ── Controles ── */}
        <div className="flex flex-wrap items-center gap-2">

            {/* Buscador */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar partida..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-8 pr-8 py-2 w-52 text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                />
                {searchTerm && (
                    <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm"
                    >✕</button>
                )}
            </div>

            {/* Toggle S/. / % */}
            <div className="flex bg-slate-200 p-1 rounded-xl border border-slate-300">
                {(['monto', 'porcentaje'] as ViewMode[]).map(mode => (
                    <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                            viewMode === mode
                                ? 'bg-white shadow-md text-blue-700 scale-105'
                                : 'text-slate-600 hover:text-slate-800'
                        }`}
                    >
                        {mode === 'monto' ? 'S/.' : '%'}
                    </button>
                ))}
            </div>

            {/* Exportar Excel */}  
            <button
                onClick={onExportExcel}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-black rounded-xl border border-emerald-200 transition-all"
                title="Exportar a Excel"
            >
                <FileDown className="w-3.5 h-3.5" /> Excel
            </button>

            {/* Exportar PDF */}
            <button
                onClick={onExportPDF}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-black rounded-xl border border-rose-200 transition-all"
                title="Exportar a PDF"
            >
                <FileText className="w-3.5 h-3.5" /> PDF
            </button>

            {/* BOTÓN: CRONOGRAMA DE DESEMBOLSOS */}
            <button
                onClick={onOpenDesembolso}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-black rounded-xl border border-amber-200 transition-all"
                title="Ver cronograma de desembolsos"
                >
                    <DollarSign className='w-3.5 h-3.5' /> Desembolso
                </button>

            {/* Guardar */}
            <button
                onClick={onSave}
                disabled={saving}
                title={totalDesviadas > 0
                    ? `Hay ${totalDesviadas} partida(s) sin cuadrar — revisa antes de guardar`
                    : 'Guardar cronograma'}
                className={`flex items-center gap-1.5 px-4 py-2 disabled:opacity-60 text-white text-xs font-black rounded-xl shadow-md transition-all ${
                    totalDesviadas > 0
                        ? 'bg-amber-500 hover:bg-amber-600'
                        : 'bg-blue-600 hover:bg-blue-700'
                }`}
            >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Guardando…' : totalDesviadas > 0 ? `Guardar (${totalDesviadas} ⚠)` : 'Guardar'}
            </button>

            {/* Eliminar */}
            {estaGuardado && (
                <button
                    onClick={onDelete}
                    disabled={deleting}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-600 text-xs font-black rounded-xl border border-slate-300 transition-all"
                    title="Eliminar datos guardados y recalcular"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deleting ? 'Eliminando…' : 'Limpiar'}
                </button>
            )}

            {/* Volver */}
            <Link
                href={`/costos/${project}`}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black rounded-xl shadow-md transition-all"
            >
                <ArrowLeft className="w-3.5 h-3.5" /> Volver
            </Link>
        </div>
    </div>
);

export default HeaderValorizado;