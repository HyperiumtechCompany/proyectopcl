import { AlertTriangle } from 'lucide-react';
import React from 'react';
import type { DeletionAnalysis } from '@/pages/dialux/hooks/useEditorStore';

interface DeleteConfirmDialogProps {
    analysis: DeletionAnalysis | null;
    onCancel: () => void;
    onConfirm: () => void;
}

const KIND_LABEL: Record<string, string> = {
    fixture: 'luminaria(s)',
    switch: 'interruptor(es)',
    'electrical-device': 'dispositivo(s) eléctrico(s)',
    window: 'ventana(s)',
    door: 'puerta(s)',
    conductor: 'cable(s)',
};

/**
 * Confirmación obligatoria antes de eliminar un contenedor (recinto/ambiente
 * con hijos, o muro con aberturas). Nunca se borra en cascada de forma
 * implícita — el usuario ve exactamente qué se perderá y decide.
 */
export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
    analysis,
    onCancel,
    onConfirm,
}) => {
    if (!analysis) return null;

    const counts = analysis.children.reduce<Record<string, number>>((acc, c) => {
        acc[c.kind] = (acc[c.kind] ?? 0) + 1;
        return acc;
    }, {});

    return (
        // Sin backdrop-blur: overlaya el canvas CAD en vivo y el blur forzaba
        // recomputarse cada frame sobre ese lienzo (lo relentizaba y pixelaba).
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="w-full max-w-md rounded-2xl border border-red-700/40 bg-slate-200 dark:bg-slate-900 p-5 shadow-2xl">
                <div className="mb-4 flex items-start gap-3">
                    <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-400" />
                    <div>
                        <p className="text-sm font-semibold text-red-300">
                            Eliminar {analysis.label}
                        </p>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                            {analysis.children.length > 0
                                ? 'Esta operación es irreversible desde aquí (aunque puedes deshacerla con Ctrl+Z). Se eliminarán también los siguientes objetos:'
                                : 'Este objeto delimita el proyecto. Confirma que realmente quieres eliminarlo (puedes deshacerlo con Ctrl+Z).'}
                        </p>
                    </div>
                </div>

                {analysis.children.length > 0 && (
                    <div className="mb-4 space-y-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-300 dark:bg-slate-950/60 p-3 text-xs text-slate-700 dark:text-slate-300">
                        {Object.entries(counts).map(([kind, count]) => (
                            <p key={kind}>
                                <span className="font-semibold text-amber-200">{count}</span>{' '}
                                {KIND_LABEL[kind] ?? kind}
                            </p>
                        ))}
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-700"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="rounded-lg border border-red-700/50 bg-red-900/70 px-3 py-1.5 text-xs text-red-100 hover:bg-red-800/70"
                    >
                        {analysis.children.length > 0 ? 'Eliminar todo' : 'Eliminar'}
                    </button>
                </div>
            </div>
        </div>
    );
};
