import axios from 'axios';
import { Loader2, Search, X, Check, Edit2, PackageSearch } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import type { InsumoProducto } from '@/types/presupuestos';

interface ReemplazarInsumoModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: number;
    targetInsumo: any | null;
    tipo: string;
    onSuccess: () => void;
}

export function ReemplazarInsumoModal({ isOpen, onClose, projectId, targetInsumo, tipo, onSuccess }: ReemplazarInsumoModalProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<InsumoProducto[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedInsumo, setSelectedInsumo] = useState<InsumoProducto | null>(null);
    const [replacing, setReplacing] = useState(false);
    const [mode, setMode] = useState<'search' | 'edit'>('search');
    const [newDescripcion, setNewDescripcion] = useState('');

    useEffect(() => {
        if (isOpen && targetInsumo) {
            setSearchQuery('');
            setSearchResults([]);
            setSelectedInsumo(null);
            setMode('search');
            setNewDescripcion(targetInsumo.descripcion);
            searchCatalog('');
        }
    }, [isOpen, targetInsumo]);

    const searchCatalog = (q: string) => {
        setLoading(true);
        axios.get(`/costos/proyectos/${projectId}/presupuesto/insumos/search?tipo=${tipo}&q=${q}`)
            .then(res => {
                if (res.data?.success) {
                    setSearchResults(res.data.productos || []);
                }
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    };

    // Debounce search
    useEffect(() => {
        if (!isOpen) return;
        const timer = setTimeout(() => {
            searchCatalog(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, isOpen]);

    const handleReplace = () => {
        if (mode === 'search' && !selectedInsumo) return;
        if (mode === 'edit' && !newDescripcion.trim()) return;

        setReplacing(true);

        const payload = {
            tipo,
            old_insumo_id: targetInsumo.insumo_id || null,
            old_descripcion: targetInsumo.insumo_id ? null : targetInsumo.descripcion,
            new_insumo_id: mode === 'search' ? selectedInsumo?.id : null,
            new_descripcion: mode === 'edit' ? newDescripcion : null,
        };

        axios.post(`/costos/proyectos/${projectId}/presupuesto/insumos/replace-project-insumo`, payload)
            .then(res => {
                if (res.data.success) {
                    onSuccess();
                    onClose();
                }
            })
            .catch(err => {
                console.error(err);
                alert('Error al reemplazar el insumo.');
            })
            .finally(() => setReplacing(false));
    };

    if (!isOpen || !targetInsumo) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700/50 rounded-lg shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-700/50 p-4 bg-slate-800/80">
                    <div>
                        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                            <PackageSearch className="w-5 h-5 text-sky-400" />
                            Reemplazar o Editar Insumo
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                            Insumo actual: <span className="text-slate-200 font-semibold">{targetInsumo.descripcion}</span>
                            <span className="ml-2 bg-slate-800 px-1.5 py-0.5 rounded text-[10px] uppercase font-mono">{targetInsumo.codigo}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 border-b border-slate-800 px-4 bg-slate-800/40">
                    <button 
                        onClick={() => setMode('search')}
                        className={`py-3 px-2 text-sm font-semibold border-b-2 transition-colors ${mode === 'search' ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                    >
                        Buscar en Catálogo Master
                    </button>
                    <button 
                        onClick={() => setMode('edit')}
                        className={`py-3 px-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${mode === 'edit' ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                        Renombrar Manualmente
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col p-4 bg-slate-900/50">
                    {mode === 'search' ? (
                        <>
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Buscar insumo por descripción o código..."
                                    className="w-full bg-slate-950/50 border border-slate-700 rounded-md py-2 pl-9 pr-4 text-sm text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-medium"
                                />
                            </div>

                            <div className="flex-1 overflow-auto border border-slate-700/50 rounded-md bg-slate-950/30 custom-scrollbar">
                                <table className="w-full text-left text-xs whitespace-nowrap">
                                    <thead className="sticky top-0 bg-slate-800/90 backdrop-blur-sm shadow-sm text-slate-400 uppercase tracking-wider text-[10px]">
                                        <tr>
                                            <th className="p-3 font-semibold">Código</th>
                                            <th className="p-3 font-semibold">Descripción</th>
                                            <th className="p-3 font-semibold text-center">Unidad</th>
                                            <th className="p-3 font-semibold text-right">Precio</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={4} className="p-8 text-center text-slate-500">
                                                    <Loader2 className="w-6 h-6 animate-spin text-sky-500 mx-auto mb-2" />
                                                    Cargando catálogo...
                                                </td>
                                            </tr>
                                        ) : searchResults.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="p-8 text-center text-slate-500">
                                                    No se encontraron resultados en el catálogo para esta búsqueda.
                                                </td>
                                            </tr>
                                        ) : (
                                            searchResults.map(insumo => (
                                                <tr 
                                                    key={insumo.id} 
                                                    onClick={() => setSelectedInsumo(insumo)}
                                                    className={`cursor-pointer transition-colors ${selectedInsumo?.id === insumo.id ? 'bg-sky-900/40' : 'hover:bg-slate-800/40'}`}
                                                >
                                                    <td className="p-3 font-mono text-slate-400">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${selectedInsumo?.id === insumo.id ? 'border-sky-400 bg-sky-500' : 'border-slate-600'}`}>
                                                                {selectedInsumo?.id === insumo.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                            </div>
                                                            {insumo.codigo}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 font-medium text-slate-200 whitespace-normal min-w-[300px]">{insumo.descripcion}</td>
                                                    <td className="p-3 text-center text-slate-400">{insumo.unidad?.abreviatura_unidad ?? insumo.unidad?.descripcion_singular ?? ''}</td>
                                                    <td className="p-3 text-right font-mono text-emerald-400">
                                                        {new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2 }).format(insumo.precio ?? 0)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col pt-4">
                            <label className="text-sm font-medium text-slate-300 mb-2">Nuevo nombre del insumo:</label>
                            <input
                                type="text"
                                value={newDescripcion}
                                onChange={(e) => setNewDescripcion(e.target.value)}
                                className="w-full bg-slate-950/50 border border-slate-700 rounded-md py-3 px-4 text-sm text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-medium"
                                placeholder="Escribe la nueva descripción..."
                                autoFocus
                            />
                            <p className="text-xs text-slate-500 mt-3">
                                Nota: Esto actualizará el nombre de este insumo específico en todos los análisis de costos (ACU) del proyecto actual donde se esté usando.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-700/50 p-4 bg-slate-800/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={replacing}
                        className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleReplace}
                        disabled={replacing || (mode === 'search' && !selectedInsumo) || (mode === 'edit' && !newDescripcion.trim())}
                        className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-400 rounded-md transition-colors"
                    >
                        {replacing ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
                        ) : (
                            <><Check className="w-4 h-4" /> Aceptar y Reemplazar</>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}
