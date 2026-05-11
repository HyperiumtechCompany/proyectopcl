import React from 'react';
import { Package, Save, Trash2, ArrowLeft, Download, BarChart2 } from 'lucide-react';
import { Link } from '@inertiajs/react';
import { ViewMode, ResumenProyecto } from '../types';

interface Props {
    project:      string;
    projectName?: string;
    viewMode:     ViewMode;
    setViewMode:  (m: ViewMode) => void;
    estaGuardado: boolean;
    saving:       boolean;
    deleting:     boolean;
    resumen:      ResumenProyecto;
    onSave:       () => void;
    onDelete:     () => void;
    onExportExcel: () => void;
}

const fmt = (v: number) =>
    new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(v);

const HeaderMateriales: React.FC<Props> = ({
    project, projectName, viewMode, setViewMode,
    estaGuardado, saving, deleting, resumen,
    onSave, onDelete, onExportExcel,
}) => {
    return (
        <div className="mb-6">
            {/* Fila principal */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-5">
                {/* Título */}
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-lg shadow-blue-200">
                        <Package className="w-7 h-7 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">
                                Cronograma de Materiales
                            </h1>
                            {estaGuardado && (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full uppercase tracking-wide border border-emerald-200">
                                    Guardado
                                </span>
                            )}
                        </div>
                        <p className="text-slate-500 text-xs font-semibold mt-0.5">
                            {projectName || `Proyecto ID: ${project}`}
                            {resumen.total_partidas > 0 && (
                                <span className="ml-2 text-slate-400">
                                    · {resumen.total_partidas} partidas · {resumen.duracion_meses} meses
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Controles */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Toggle vista */}
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                        {(['cantidad', 'monto'] as ViewMode[]).map(mode => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${
                                    viewMode === mode
                                        ? 'bg-white text-blue-600 shadow-sm border border-blue-100'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {mode === 'cantidad' ? '📦 Cantidades' : '💰 S/. Montos'}
                            </button>
                        ))}
                    </div>

                    {/* Exportar Excel */}
                    <button
                        onClick={onExportExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black rounded-xl transition-all border border-slate-200"
                        title="Exportar a Excel"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Excel
                    </button>

                    {/* Guardar */}
                    <button
                        onClick={onSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[10px] font-black rounded-xl transition-all shadow-md shadow-emerald-200"
                    >
                        <Save className="w-3.5 h-3.5" />
                        {saving ? 'Guardando…' : 'Guardar'}
                    </button>

                    {/* Eliminar */}
                    {estaGuardado && (
                        <button
                            onClick={onDelete}
                            disabled={deleting}
                            className="flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 disabled:opacity-60 text-rose-600 text-[10px] font-black rounded-xl transition-all border border-rose-200"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            {deleting ? 'Eliminando…' : 'Limpiar'}
                        </button>
                    )}

                    {/* Volver */}
                    <Link
                        href={`/costos/${project}`}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black rounded-xl transition-all shadow-md"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Volver
                    </Link>
                </div>
            </div>

            {/* KPI Cards */}
            {resumen.total_materiales > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KpiCard
                        label="Total Materiales"
                        value={resumen.total_materiales.toLocaleString()}
                        sub="insumos únicos"
                        color="blue"
                        icon="📦"
                    />
                    <KpiCard
                        label="Presupuesto Materiales"
                        value={fmt(resumen.presupuesto_total)}
                        sub="costo total directo"
                        color="emerald"
                        icon="💰"
                    />
                    <KpiCard
                        label="Duración"
                        value={`${resumen.duracion_meses} meses`}
                        sub={`${resumen.total_partidas} partidas activas`}
                        color="violet"
                        icon="📅"
                    />
                    <KpiCard
                        label="Mes Pico"
                        value={resumen.mes_pico
                            ? new Date(resumen.mes_pico + '-01').toLocaleDateString('es-PE', { month: 'short', year: 'numeric' })
                            : '—'}
                        sub={resumen.monto_mes_pico > 0 ? fmt(resumen.monto_mes_pico) : 'sin datos'}
                        color="amber"
                        icon="🔝"
                    />
                </div>
            )}
        </div>
    );
};

// ── Sub-componente KPI Card ────────────────────────────────────────────────────
const colorMap: Record<string, string> = {
    blue:    'bg-blue-50 border-blue-100 text-blue-700',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    violet:  'bg-violet-50 border-violet-100 text-violet-700',
    amber:   'bg-amber-50 border-amber-100 text-amber-700',
};

const KpiCard: React.FC<{
    label: string; value: string; sub: string; color: string; icon: string;
}> = ({ label, value, sub, color, icon }) => (
    <div className={`p-4 rounded-2xl border shadow-sm ${colorMap[color]}`}>
        <div className="flex items-start justify-between">
            <div>
                <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</p>
                <p className="text-lg font-black leading-tight">{value}</p>
                <p className="text-[10px] font-semibold opacity-50 mt-0.5">{sub}</p>
            </div>
            <span className="text-2xl">{icon}</span>
        </div>
    </div>
);

export default HeaderMateriales;
