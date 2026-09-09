import { AlertTriangle, ArrowRight, CheckCircle, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { CircularPredecessorIssue } from '../../cronogramas/v2/utils/predecessorCycles';

interface Props {
    open: boolean;
    issues: CircularPredecessorIssue[];
    onClose: () => void;
    onSelectTask: (taskId: number) => void;
}

export function CircularPredecessorsModal({ open, issues, onClose, onSelectTask }: Props) {
    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4">
            <div className="flex max-h-[calc(100vh-2rem)] w-[60vw] max-w-3xl flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl">

                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-3">
                    <div>
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                            <AlertTriangle size={15} className="text-red-400" />
                            Referencias circulares en predecesoras
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-400">
                            Una subfila no puede tener como predecesora a su propia fila padre/grupo — MS Project bloquea el cálculo de todo el archivo cuando exporta esto.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                        onClick={onClose}
                        aria-label="Cerrar"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="min-h-0 flex-1 overflow-auto">
                    {issues.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                            <CheckCircle size={40} className="text-emerald-400" />
                            <p className="text-sm font-semibold text-emerald-300">Sin referencias circulares</p>
                            <p className="text-xs text-slate-400">
                                Ninguna subfila referencia a su propio grupo como predecesora.
                            </p>
                        </div>
                    ) : (
                        <table className="w-full border-collapse text-left text-[11px]">
                            <thead className="sticky top-0 z-10 bg-slate-800 text-[10px] tracking-wider text-slate-400 uppercase">
                                <tr>
                                    <th className="border-b border-slate-700 p-2">Partida</th>
                                    <th className="border-b border-slate-700 p-2">Tarea</th>
                                    <th className="border-b border-slate-700 p-2">Predecesora inválida (es su ancestro)</th>
                                    <th className="w-8 border-b border-slate-700 p-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {issues.map((issue) => (
                                    <tr
                                        key={`${issue.taskId}-${issue.ancestorId}`}
                                        className="cursor-pointer transition-colors hover:bg-slate-700/50"
                                        title="Ir a esta tarea en el cronograma"
                                        onClick={() => {
                                            onSelectTask(issue.taskId);
                                            onClose();
                                        }}
                                    >
                                        <td className="p-2 font-mono text-sky-300 whitespace-nowrap">{issue.taskPartida}</td>
                                        <td className="p-2 max-w-xs">
                                            <div className="truncate font-medium text-slate-100">{issue.taskDescripcion}</div>
                                        </td>
                                        <td className="p-2 max-w-xs">
                                            <div className="truncate text-red-300">
                                                {issue.ancestorPartida} — {issue.ancestorDescripcion}
                                            </div>
                                        </td>
                                        <td className="p-2 text-center">
                                            <ArrowRight size={12} className="mx-auto text-slate-500" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="flex shrink-0 items-center justify-between border-t border-slate-700 bg-slate-800/40 px-4 py-2 text-[11px] text-slate-500">
                    <span>
                        {issues.length === 0
                            ? 'Sin referencias circulares'
                            : `${issues.length} referencia${issues.length !== 1 ? 's' : ''} circular${issues.length !== 1 ? 'es' : ''}`}
                    </span>
                    <span>
                        Corrige o elimina el vínculo de predecesora en la fila afectada; no requiere borrar la fila.
                    </span>
                </div>
            </div>
        </div>,
        document.body,
    );
}
