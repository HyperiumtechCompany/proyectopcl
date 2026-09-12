import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { moApi, type ImportPreview } from './moApi';

interface Props {
    projectId: number;
    documentId: string;
    onClose: () => void;
    onImported: () => void;
}

export default function MoImportDialog({ projectId, documentId, onClose, onImported }: Props) {
    const [preview, setPreview] = useState<ImportPreview | null>(null);
    const [busy, setBusy] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        moApi
            .importPreview(projectId, documentId)
            .then(setPreview)
            .catch(() => setError('No se pudo consultar el presupuesto.'))
            .finally(() => setBusy(false));
    }, [projectId, documentId]);

    const confirm = async () => {
        if (!preview?.source_hash) return;
        setBusy(true);
        try {
            await moApi.runImport(projectId, documentId, preview.source_hash);
            onImported();
        } catch {
            setError('La importación falló.');
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-sm space-y-3 rounded-xl bg-white p-5 text-sm shadow-xl dark:bg-slate-900">
                <h2 className="font-semibold">Importar desde Presupuesto</h2>

                {busy && !preview && <p className="flex items-center gap-2 text-slate-500"><Loader2 size={14} className="animate-spin" /> Consultando…</p>}

                {error && <p className="rounded-lg bg-rose-50 p-2 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}

                {preview && !preview.available && (
                    <p className="rounded-lg bg-amber-50 p-2 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                        {preview.reason} Puedes construir la estructura manualmente con “Agregar fila”.
                    </p>
                )}

                {preview?.available && preview.stats && (
                    <ul className="space-y-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <li>Instituciones educativas: <b>{preview.stats.instituciones}</b></li>
                        <li>Bloques: <b>{preview.stats.bloques}</b></li>
                        <li>Partidas: <b>{preview.stats.partidas}</b></li>
                        <li>Con ACU de mano de obra: <b>{preview.stats.mo_incluidos}</b></li>
                        {preview.already_imported && <li className="text-amber-600">Ya importado — se actualizará el diff.</li>}
                    </ul>
                )}

                <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">Cerrar</button>
                    {preview?.available && (
                        <button type="button" onClick={() => void confirm()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                            {busy && <Loader2 size={14} className="animate-spin" />} Importar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
