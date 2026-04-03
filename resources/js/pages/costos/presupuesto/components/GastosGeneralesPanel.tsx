// components/GastosGeneralesPanel.tsx
import { Loader2, Plus, Trash2, Save, Wallet } from 'lucide-react';
import React from 'react';
import type { GastoGeneralRow } from '../stores/gastosGeneralesStore';
import { useGastosGeneralesStore } from '../stores/gastosGeneralesStore';

interface GastosGeneralesPanelProps {
    loading: boolean;
    rows: GastoGeneralRow[];
    onSaveGastoGeneral: (data: GastoGeneralRow[]) => Promise<any>;
    projectId: number;
}

export function GastosGeneralesPanel({
    loading,
    rows,
    onSaveGastoGeneral,
    projectId,
}: GastosGeneralesPanelProps) {
    const { updateCell, addRow, removeRow, calculateTotal, isDirty } = useGastosGeneralesStore();

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center bg-slate-900/50 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
                    <span className="text-xs font-medium tracking-widest text-slate-400 uppercase">Cargando gastos...</span>
                </div>
            </div>
        );
    }

    const total = calculateTotal();

    return (
        <div className="flex h-full flex-col bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800/80 px-4 py-3 backdrop-blur-sm">
                <div className="flex flex-col">
                    <h2 className="flex items-center gap-2 text-sm font-bold tracking-widest text-slate-200 uppercase">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"></span>
                        Gastos Generales
                    </h2>
                    <p className="mt-0.5 text-[10px] font-medium text-slate-500 uppercase tracking-tight">Gastos fijos, variables y administrativos</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">Subtotal</span>
                        <span className="text-sm font-mono font-bold text-amber-400">
                            {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(total)}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-800/90 text-[10px] font-bold tracking-wider text-slate-400 uppercase backdrop-blur-sm">
                        <tr>
                            <th className="border-b border-slate-700 p-3 pl-4">Concepto / Gasto</th>
                            <th className="w-20 border-b border-slate-700 p-3 text-center">Unidad</th>
                            <th className="w-24 border-b border-slate-700 p-3 text-right">Cant.</th>
                            <th className="w-32 border-b border-slate-700 p-3 text-right">Precio Unit.</th>
                            <th className="w-32 border-b border-slate-700 p-3 text-right">Total</th>
                            <th className="w-12 border-b border-slate-700 p-3 text-center"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {rows.map((row, index) => (
                            <tr key={index} className="group transition-colors hover:bg-slate-800/30">
                                <td className="p-1 pl-4">
                                    <input
                                        type="text"
                                        className="w-full border-none bg-transparent p-2 text-slate-300 focus:bg-slate-800 focus:ring-1 focus:ring-amber-500/50 rounded transition-all"
                                        value={row.descripcion ?? ''}
                                        onChange={(e) => updateCell(index, 'descripcion', e.target.value)}
                                        placeholder="Descripción del gasto..."
                                    />
                                </td>
                                <td className="p-1">
                                    <input
                                        type="text"
                                        className="w-full border-none bg-transparent p-2 text-center text-slate-400 focus:bg-slate-800 focus:ring-1 focus:ring-amber-500/50 rounded transition-all"
                                        value={row.unidad ?? ''}
                                        onChange={(e) => updateCell(index, 'unidad', e.target.value)}
                                    />
                                </td>
                                <td className="p-1">
                                    <input
                                        type="number"
                                        className="w-full border-none bg-transparent p-2 text-right font-mono text-slate-300 focus:bg-slate-800 focus:ring-1 focus:ring-amber-500/50 rounded transition-all"
                                        value={row.cantidad ?? ''}
                                        onChange={(e) => updateCell(index, 'cantidad', parseFloat(e.target.value) || 0)}
                                    />
                                </td>
                                <td className="p-1">
                                    <input
                                        type="number"
                                        className="w-full border-none bg-transparent p-2 text-right font-mono text-amber-400/80 focus:bg-slate-800 focus:ring-1 focus:ring-amber-500/50 rounded transition-all"
                                        value={row.precio_unitario ?? ''}
                                        onChange={(e) => updateCell(index, 'precio_unitario', parseFloat(e.target.value) || 0)}
                                    />
                                </td>
                                <td className="p-3 text-right font-mono font-semibold text-slate-200">
                                    {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(row.parcial)}
                                </td>
                                <td className="p-1 text-center">
                                    <button
                                        onClick={() => removeRow(index)}
                                        className="rounded p-2 text-slate-600 hover:bg-red-900/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={6} className="p-12 text-center text-slate-500 italic">
                                    No hay gastos registrados. Haz clic en el botón "+" para añadir conceptos.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-700 bg-slate-800/40 p-4 backdrop-blur-sm">
                <button
                    onClick={addRow}
                    className="flex items-center gap-2 rounded-lg bg-slate-700/50 px-4 py-2 text-xs font-bold text-slate-300 transition-all hover:bg-slate-700 hover:text-white"
                >
                    <Plus className="h-4 w-4" /> Añadir Concepto
                </button>
                <div className="flex items-center gap-4">
                    {isDirty && (
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                            Cambios pendientes
                        </span>
                    )}
                    <button
                        className={`flex items-center gap-2 rounded-lg px-6 py-2 text-xs font-bold text-white transition-all shadow-lg ${
                            isDirty 
                            ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/20 active:scale-95' 
                            : 'bg-slate-700 cursor-not-allowed opacity-60'
                        }`}
                        onClick={() => onSaveGastoGeneral(rows)}
                        disabled={!isDirty || loading}
                    >
                        <Save className="h-4 w-4" />
                        {loading ? 'Guardando...' : 'Guardar Gastos Generales'}
                    </button>
                </div>
            </div>
        </div>
    );
}
