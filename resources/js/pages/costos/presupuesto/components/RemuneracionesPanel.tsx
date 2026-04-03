// components/RemuneracionesPanel.tsx
import { Loader2, Plus, Trash2, Save, RefreshCw, Clock } from 'lucide-react';
import React from 'react';
import { useProjectParamsStore } from '../stores/projectParamsStore';
import type {
    RemuneracionRow} from '../stores/remuneracionesStore';
import {
    useRemuneracionesStore
} from '../stores/remuneracionesStore';

interface RemuneracionesPanelProps {
    loading: boolean;
    rows: RemuneracionRow[];
    onSaveRemuneracion: (data: RemuneracionRow[]) => Promise<any>;
    projectId: number;
}

export function RemuneracionesPanel({
    loading,
    rows,
    onSaveRemuneracion,
    projectId,
}: RemuneracionesPanelProps) {
    const {
        updateCell,
        addRow,
        removeRow,
        calculateTotal,
        getSummary,
        isDirty,
        setMesesAll,
    } = useRemuneracionesStore();

    const duracionMeses = useProjectParamsStore(s => s.getDuracionMeses());
    const rmvValue = useProjectParamsStore(s => s.getRmv());

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center bg-slate-900/50 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
                    <span className="text-xs font-medium tracking-widest text-slate-400 uppercase">
                        Cargando remuneraciones...
                    </span>
                </div>
            </div>
        );
    }

    const total = calculateTotal();
    const { mensual, total: projectTotal } = getSummary();

    return (
        <div className="flex h-full flex-col bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800/80 px-4 py-3 backdrop-blur-sm">
                <div className="flex flex-col">
                    <h2 className="flex items-center gap-2 text-sm font-bold tracking-widest text-slate-200 uppercase">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
                        Desglose de Remuneraciones
                    </h2>
                    <p className="mt-0.5 text-[10px] font-medium tracking-tight text-slate-500 uppercase">
                        Cálculo detallado de beneficios y leyes sociales
                    </p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="flex flex-col items-center px-4 py-1 border-x border-slate-700/50">
                        <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-sky-400" /> Tiempo Proyecto
                        </span>
                        <span className="font-mono text-sm font-black text-sky-400">
                            {duracionMeses} Meses
                        </span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">
                            Total Proyecto
                        </span>
                        <span className="font-mono text-sm font-bold text-emerald-400" id="total-proyecto-header">
                            {new Intl.NumberFormat('es-PE', {
                                style: 'currency',
                                currency: 'PEN',
                            }).format(total)}
                        </span>
                    </div>
                </div>
            </div>

            <div className="custom-scrollbar flex-1 overflow-auto">
                <div className="min-w-[1400px]">
                    <table className="w-full border-collapse text-left text-[11px]">
                        <thead className="sticky top-0 z-10 bg-slate-800/95 text-[10px] font-bold tracking-wider text-slate-400 uppercase backdrop-blur-md">
                            <tr>
                                <th className="w-16 border-b border-slate-700 p-3 text-right">
                                    % Part.
                                </th>
                                <th className="w-16 border-b border-slate-700 p-3 text-right">
                                    Cant.
                                </th>
                                <th className="border-b border-slate-700 p-3 pl-4">
                                    Cargo / Variable
                                </th>
                                <th className="w-24 border-b border-slate-700 p-3">
                                    Categoría
                                </th>
                                <th className="w-16 border-b border-slate-700 p-3 text-right">
                                    Meses
                                </th>
                                <th className="w-24 border-b border-slate-700 p-3 text-right text-emerald-300">
                                    Precio Unit.
                                </th>
                                <th className="w-24 border-b border-slate-700 p-3 text-right text-slate-500 italic">
                                    SNP (13%)
                                </th>
                                <th className="w-24 border-b border-slate-700 p-3 text-right">
                                    Asig. Fam
                                </th>
                                <th className="w-20 border-b border-slate-700 p-3 text-right text-slate-500 italic">
                                    Essalud (9%)
                                </th>
                                <th className="w-20 border-b border-slate-700 p-3 text-right text-slate-500 italic">
                                    CTS
                                </th>
                                <th className="w-20 border-b border-slate-700 p-3 text-right text-slate-500 italic">
                                    Vac.
                                </th>
                                <th className="w-20 border-b border-slate-700 p-3 text-right text-slate-500 italic">
                                    Gratif.
                                </th>
                                <th className="w-28 border-b border-slate-700 bg-emerald-950/20 p-3 text-right text-emerald-400">
                                    Mensual Unit.
                                </th>
                                <th className="w-32 border-b border-slate-700 bg-slate-800 p-3 text-right opacity-20 transition-opacity hover:opacity-100 cursor-help" title="Columna en modo 'dormido' temporalmente">
                                    Total Proyecto
                                </th>
                                <th className="w-10 border-b border-slate-700 p-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {rows.map((row, index) => (
                                <tr
                                    key={index}
                                    className="group transition-colors hover:bg-slate-800/30"
                                >
                                    {/* % Participación */}
                                    <td className="p-0">
                                        <input
                                            type="number"
                                            className="w-full border-none bg-transparent p-2 text-right font-mono text-slate-300 focus:outline-none focus:bg-slate-700/30"
                                            value={row.participacion ?? ''}
                                            onChange={(e) =>
                                                updateCell(
                                                    index,
                                                    'participacion',
                                                    parseFloat(e.target.value) || 0,
                                                )
                                            }
                                        />
                                    </td>

                                    {/* Cantidad */}
                                    <td className="p-0">
                                        <input
                                            type="number"
                                            className="w-full border-none bg-transparent p-2 text-right font-mono text-slate-300 focus:outline-none focus:bg-slate-700/30"
                                            value={row.cantidad ?? ''}
                                            onChange={(e) =>
                                                updateCell(
                                                    index,
                                                    'cantidad',
                                                    parseFloat(e.target.value) || 0,
                                                )
                                            }
                                        />
                                    </td>

                                    {/* Cargo / Variable */}
                                    <td className="p-2 pl-4">
                                        <div className="flex flex-col">
                                            <input
                                                type="text"
                                                className="w-full border-none bg-transparent p-0 font-semibold text-slate-300 focus:outline-none focus:bg-slate-700/30 rounded"
                                                value={
                                                    (row as any).cargo_gg ||
                                                    row.cargo
                                                }
                                                onChange={(e) =>
                                                    updateCell(
                                                        index,
                                                        'cargo',
                                                        e.target.value,
                                                    )
                                                }
                                                readOnly={
                                                    !!(row as any).cargo_gg
                                                }
                                            />
                                            <span className="text-[9px] text-slate-500">
                                                {row.gg_variable_id
                                                    ? `REF ID: ${row.gg_variable_id}`
                                                    : 'MANUAL'}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Categoría */}
                                    <td className="p-1">
                                        <select
                                            className="w-full border-none bg-transparent p-1 text-[10px] text-slate-400 focus:outline-none focus:bg-slate-700/30"
                                            value={row.categoria ?? ''}
                                            onChange={(e) =>
                                                updateCell(
                                                    index,
                                                    'categoria',
                                                    e.target.value,
                                                )
                                            }
                                        >
                                            <option value="Profesional">Profesional</option>
                                            <option value="Técnico">Técnico</option>
                                            <option value="Auxiliar">Auxiliar</option>
                                        </select>
                                    </td>

                                    {/* Meses */}
                                    <td className="p-0">
                                        <input
                                            type="number"
                                            className="w-full border-none bg-transparent p-2 text-right font-mono text-slate-300 focus:outline-none focus:bg-slate-700/30"
                                            value={row.meses ?? ''}
                                            onChange={(e) =>
                                                updateCell(
                                                    index,
                                                    'meses',
                                                    parseFloat(e.target.value) || 0,
                                                )
                                            }
                                        />
                                    </td>

                                    {/* Precio Unitario */}
                                    <td className="bg-emerald-950/5 p-0">
                                        <input
                                            type="number"
                                            className="w-full border-none bg-transparent p-2 text-right font-mono text-emerald-400 focus:outline-none focus:bg-slate-700/30"
                                            value={row.sueldo_basico ?? ''}
                                            onChange={(e) =>
                                                updateCell(
                                                    index,
                                                    'sueldo_basico',
                                                    parseFloat(e.target.value) || 0,
                                                )
                                            }
                                        />
                                    </td>

                                    <td className="bg-slate-900/30 p-2 text-right font-mono text-slate-500">
                                        {(Number(row.snp) || 0).toFixed(2)}
                                    </td>

                                    {/* Asignación Familiar */}
                                    <td className="bg-slate-900/30 p-2 text-right font-mono text-slate-500">
                                        {(Number(row.asignacion_familiar) || 0).toFixed(2)}
                                    </td>

                                    {/* Essalud */}
                                    <td className="bg-slate-900/30 p-2 text-right font-mono text-slate-500">
                                        {(Number(row.essalud) || 0).toFixed(2)}
                                    </td>

                                    {/* CTS */}
                                    <td className="bg-slate-900/30 p-2 text-right font-mono text-slate-500">
                                        {(Number(row.cts) || 0).toFixed(2)}
                                    </td>

                                    {/* Vacaciones */}
                                    <td className="bg-slate-900/30 p-2 text-right font-mono text-slate-500">
                                        {(Number(row.vacaciones) || 0).toFixed(2)}
                                    </td>

                                    {/* Gratificación */}
                                    <td className="bg-slate-900/30 p-2 text-right font-mono text-slate-500">
                                        {(Number(row.gratificacion) || 0).toFixed(2)}
                                    </td>

                                    {/* Mensual Unitario */}
                                    <td className="bg-emerald-950/10 p-2 text-right font-mono font-bold text-emerald-400">
                                        {new Intl.NumberFormat('es-PE', {
                                            minimumFractionDigits: 2,
                                        }).format(row.total_mensual_unitario)}
                                    </td>

                                    {/* Total Proyecto */}
                                    <td className="bg-slate-800 p-2 text-right font-mono font-bold text-slate-600 opacity-20 transition-opacity group-hover:opacity-40">
                                        {new Intl.NumberFormat('es-PE', {
                                            minimumFractionDigits: 2,
                                        }).format(row.total_proyecto)}
                                    </td>

                                    {/* Acciones */}
                                    <td className="p-1 text-center">
                                        <button
                                            onClick={() => removeRow(index)}
                                            className="rounded p-1.5 text-slate-600 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-900/20 hover:text-red-400"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {/* Fila Resumen Mensual */}
                            <tr className="bg-slate-800/50 font-bold border-t-2 border-slate-700">
                                <td colSpan={2} className="p-2 text-right text-slate-400 text-[9px] uppercase tracking-tighter">Resumen</td>
                                <td className="p-2 pl-4 text-emerald-400 uppercase tracking-widest text-[10px]">Mensual Total</td>
                                <td colSpan={2}></td>
                                <td className="p-2 text-right font-mono text-emerald-400 border-x border-slate-700/50">
                                    {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(mensual.pu)}
                                </td>
                                <td className="p-2 text-right font-mono text-slate-400 italic">
                                    {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(mensual.snp)}
                                </td>
                                <td className="p-2 text-right font-mono text-slate-400">
                                    {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(mensual.af)}
                                </td>
                                <td className="p-2 text-right font-mono text-slate-400 italic">
                                    {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(mensual.essalud)}
                                </td>
                                <td className="p-2 text-right font-mono text-slate-400 italic">
                                    {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(mensual.cts)}
                                </td>
                                <td className="p-2 text-right font-mono text-slate-400 italic">
                                    {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(mensual.vac)}
                                </td>
                                <td className="p-2 text-right font-mono text-slate-400 italic">
                                    {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(mensual.gratif)}
                                </td>
                                <td className="p-2 text-right font-mono text-emerald-300 bg-emerald-950/20 border-l border-emerald-500/30">
                                    {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(mensual.total)}
                                </td>
                                <td className="bg-slate-800"></td>
                                <td></td>
                            </tr>

                            {/* Fila Resumen Proyecto */}
                            <tr className="bg-slate-800/80 font-bold border-t border-slate-600">
                                <td colSpan={2} className="p-2 text-right text-slate-400 text-[9px] uppercase tracking-tighter">Total</td>
                                <td className="p-2 pl-4 text-emerald-500 uppercase tracking-widest text-[10px]">Proyecto Total</td>
                                <td colSpan={2}></td>
                                <td className="p-2 text-right font-mono text-emerald-500 border-x border-slate-700/50">
                                    {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(projectTotal.pu)}
                                </td>
                                <td className="p-2 text-right font-mono text-slate-200 italic">
                                    {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(projectTotal.snp)}
                                </td>
                                <td className="p-2 text-right font-mono text-slate-200">
                                    {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(projectTotal.af)}
                                </td>
                                <td className="p-2 text-right font-mono text-slate-200 italic">
                                    {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(projectTotal.essalud)}
                                </td>
                                <td className="p-2 text-right font-mono text-slate-200 italic">
                                    {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(projectTotal.cts)}
                                </td>
                                <td className="p-2 text-right font-mono text-slate-200 italic">
                                    {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(projectTotal.vac)}
                                </td>
                                <td className="p-2 text-right font-mono text-slate-200 italic">
                                    {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(projectTotal.gratif)}
                                </td>
                                <td className="bg-emerald-950/30 border-l border-emerald-500/20"></td>
                                <td className="p-2 text-right font-mono text-slate-600 opacity-20 bg-slate-700/80">
                                    {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(projectTotal.total)}
                                </td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-700 bg-slate-800/40 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => addRow(null, projectId, 'Nuevo Cargo')}
                        className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-[10px] font-bold text-slate-200 transition-all hover:bg-slate-600 hover:text-white"
                    >
                        <Plus className="h-3.5 w-3.5" /> Añadir Personal
                    </button>
                    <button
                        onClick={() => setMesesAll(duracionMeses)}
                        className="flex items-center gap-2 rounded-lg bg-sky-900/40 px-4 py-2 text-[10px] font-bold text-sky-300 transition-all hover:bg-sky-900/60 border border-sky-800/40"
                        title="Sincronizar todos los meses al tiempo de proyecto"
                    >
                        <RefreshCw className="h-3.5 w-3.5" /> Sincronizar Meses
                    </button>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 italic">
                        * Cálculos basados en RMV {rmvValue} (Sincronizado)
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {isDirty && (
                        <span className="flex animate-pulse items-center gap-1.5 text-[10px] font-bold tracking-widest text-amber-500 uppercase">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                            Cambios pendientes
                        </span>
                    )}
                    <button
                        className={`flex items-center gap-2 rounded-lg px-6 py-2 text-xs font-bold text-white shadow-lg transition-all ${
                            isDirty
                                ? 'bg-emerald-600 shadow-emerald-900/20 hover:bg-emerald-500 active:scale-95'
                                : 'cursor-not-allowed bg-slate-700 opacity-60'
                        }`}
                        onClick={() => onSaveRemuneracion(rows)}
                        disabled={!isDirty || loading}
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {loading
                            ? 'Guardando...'
                            : 'Guardar y Sincronizar con GG'}
                    </button>
                </div>
            </div>
        </div>
    );
}
