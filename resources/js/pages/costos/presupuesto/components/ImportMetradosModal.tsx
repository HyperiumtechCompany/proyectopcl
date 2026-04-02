import axios from 'axios';
import { X, CheckSquare, Square, Download, AlertCircle } from 'lucide-react';
import React, { useState } from 'react';

interface ImportMetradosModalProps {
    projectId: number;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const METRADO_TYPES = [
    { id: 'metrado_estructura', label: 'Estructuras', number: 1 },
    { id: 'metrado_arquitectura', label: 'Arquitectura', number: 2 },
    { id: 'metrado_sanitarias', label: 'Sanitarias', number: 3 },
    { id: 'metrado_electricas', label: 'Eléctricas', number: 4 },
    { id: 'metrado_comunicaciones', label: 'Comunicaciones', number: 5 },
    { id: 'metrado_gas', label: 'Gas', number: 6 },
];

export const ImportMetradosModal: React.FC<ImportMetradosModalProps> = ({
    projectId,
    isOpen,
    onClose,
    onSuccess,
}) => {
    const [selected, setSelected] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const toggleSelection = (id: string) => {
        setSelected((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const selectAll = () => {
        if (selected.length === METRADO_TYPES.length) {
            setSelected([]);
        } else {
            setSelected(METRADO_TYPES.map((t) => t.id));
        }
    };

    const handleImport = async () => {
        if (selected.length === 0) {
            setError('Debe seleccionar al menos un metrado para importar.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Sort selected types based on predefined order
            const orderedSelections = selected.sort((a, b) => {
                const indexA = METRADO_TYPES.findIndex((t) => t.id === a);
                const indexB = METRADO_TYPES.findIndex((t) => t.id === b);
                return indexA - indexB;
            });

            await axios.post(`/costos/proyectos/${projectId}/presupuesto/import-batch-metrados`, {
                metrados: orderedSelections,
            });

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error importing metrados', err);
            setError(err.response?.data?.message || 'Ocurrió un error al importar los metrados.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-700/50 bg-slate-900/50 px-5 py-4">
                    <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                        <Download className="h-5 w-5 text-sky-400" />
                        Importar Metrados
                    </h3>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex flex-col gap-4 p-5">
                    <p className="text-sm text-slate-300">
                        Seleccione los tipos de metrado existentes en el proyecto que desea consolidar dentro de su presupuesto general. Se insertarán respetando este orden:
                    </p>

                    {error && (
                        <div className="flex items-center gap-2 rounded bg-red-900/40 p-3 text-sm text-red-400 border border-red-800">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="rounded-lg border border-slate-700 bg-slate-900/30 overflow-hidden">
                        <div className="flex items-center gap-3 border-b border-slate-700 bg-slate-800/40 px-4 py-3">
                            <button
                                onClick={selectAll}
                                className="text-slate-400 hover:text-sky-400 transition-colors"
                            >
                                {selected.length === METRADO_TYPES.length ? (
                                    <CheckSquare size={18} className="text-sky-400" />
                                ) : (
                                    <Square size={18} />
                                )}
                            </button>
                            <span className="text-sm font-semibold text-slate-300">
                                Seleccionar Todos
                            </span>
                        </div>
                        <div className="flex flex-col">
                            {METRADO_TYPES.map((type) => {
                                const isSelected = selected.includes(type.id);
                                return (
                                    <button
                                        key={type.id}
                                        onClick={() => toggleSelection(type.id)}
                                        className={`flex items-center gap-3 border-b border-slate-800 px-4 py-3 transition-colors hover:bg-slate-800 ${
                                            isSelected ? 'bg-sky-900/10' : ''
                                        }`}
                                    >
                                        <div className="text-slate-400">
                                            {isSelected ? (
                                                <CheckSquare size={18} className="text-sky-400" />
                                            ) : (
                                                <Square size={18} />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-slate-300">
                                                {type.number}
                                            </span>
                                            <span
                                                className={`text-sm ${
                                                    isSelected ? 'text-sky-300 font-medium' : 'text-slate-300'
                                                }`}
                                            >
                                                {type.label}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-slate-700/50 bg-slate-900/50 p-4">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="rounded bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-600 disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={isLoading || selected.length === 0}
                        className="flex items-center gap-2 rounded bg-sky-600 px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500"
                    >
                        {isLoading ? 'Importando...' : 'Importar Selección'}
                    </button>
                </div>
            </div>
        </div>
    );
};
