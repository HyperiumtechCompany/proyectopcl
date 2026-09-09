import axios from 'axios';
import dayjs from 'dayjs';
import { History, RotateCcw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';

interface Snapshot {
    id: number;
    motivo: string | null;
    filas: number;
    created_at: string;
}

interface Props {
    open: boolean;
    /** id o slug del proyecto (el mismo que usa /cronograma/v2/{project}/save) */
    project: string;
    onClose: () => void;
    /** se llama tras un restore exitoso — el contenedor debe recargar los datos */
    onRestored: () => void;
}

const swalDark = {
    background: '#1e293b',
    color: '#e2e8f0',
    confirmButtonColor: '#0ea5e9',
} as const;

const MOTIVO_LABEL: Record<string, string> = {
    cronograma_v2_save: 'Guardado de cronograma',
    pre_restore: 'Antes de restaurar',
    presupuesto_general_save: 'Guardado de partidas',
};

export function GanttSnapshotsModal({ open, project, onClose, onRestored }: Props) {
    const [snaps, setSnaps] = useState<Snapshot[]>([]);
    const [loading, setLoading] = useState(false);
    const [restoringId, setRestoringId] = useState<number | null>(null);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        axios
            .get<{ snapshots: Snapshot[] }>(`/cronograma/v2/${project}/snapshots`)
            .then((r) => setSnaps(r.data.snapshots ?? []))
            .catch(() => setSnaps([]))
            .finally(() => setLoading(false));
    }, [open, project]);

    if (!open) return null;

    const restore = async (snap: Snapshot) => {
        const when = dayjs(snap.created_at).format('DD/MM/YYYY HH:mm');
        const res = await Swal.fire({
            icon: 'warning',
            title: '¿Revertir a este guardado?',
            html: `El cronograma actual se reemplaza por la copia del <b>${when}</b> (${snap.filas} filas).<br>Se guarda una copia del estado actual antes de reemplazar.`,
            showCancelButton: true,
            confirmButtonText: 'Sí, revertir',
            cancelButtonText: 'Cancelar',
            ...swalDark,
            confirmButtonColor: '#dc2626',
        });
        if (!res.isConfirmed) return;

        setRestoringId(snap.id);
        try {
            await axios.post(`/cronograma/v2/${project}/snapshots/restore`, {
                snapshot_id: snap.id,
            });
            await Swal.fire({
                icon: 'success',
                title: 'Cronograma restaurado',
                timer: 1800,
                showConfirmButton: false,
                ...swalDark,
            });
            onClose();
            onRestored();
        } catch {
            await Swal.fire({
                icon: 'error',
                title: 'No se pudo restaurar',
                ...swalDark,
            });
        } finally {
            setRestoringId(null);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4">
            <div className="flex max-h-[calc(100vh-2rem)] w-[52vw] max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl">
                <div className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-3">
                    <div>
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                            <History size={15} className="text-sky-400" />
                            Historial de guardados del cronograma
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-400">
                            Copias automáticas de las últimas 20 reescrituras. Revertir reemplaza
                            el cronograma actual (guarda una copia antes).
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

                <div className="min-h-0 flex-1 overflow-auto">
                    {loading ? (
                        <div className="p-10 text-center text-xs text-slate-500">Cargando…</div>
                    ) : snaps.length === 0 ? (
                        <div className="p-10 text-center text-xs text-slate-500">
                            Sin copias todavía. Se crean automáticamente al guardar.
                            <br />
                            (Si acabas de desplegar, falta correr la migración{' '}
                            <code className="text-slate-400">wbs_snapshots</code> en este proyecto.)
                        </div>
                    ) : (
                        <table className="w-full border-collapse text-left text-[11px]">
                            <thead className="sticky top-0 z-10 bg-slate-800 text-[10px] tracking-wider text-slate-400 uppercase">
                                <tr>
                                    <th className="border-b border-slate-700 p-2">Fecha</th>
                                    <th className="border-b border-slate-700 p-2">Motivo</th>
                                    <th className="border-b border-slate-700 p-2 text-right">Filas</th>
                                    <th className="w-24 border-b border-slate-700 p-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {snaps.map((s) => (
                                    <tr key={s.id} className="hover:bg-slate-700/40">
                                        <td className="p-2 whitespace-nowrap text-slate-200">
                                            {dayjs(s.created_at).format('DD/MM/YYYY HH:mm')}
                                        </td>
                                        <td className="p-2 text-slate-400">
                                            {MOTIVO_LABEL[s.motivo ?? ''] ?? s.motivo ?? '—'}
                                        </td>
                                        <td className="p-2 text-right font-mono text-slate-300">
                                            {s.filas}
                                        </td>
                                        <td className="p-2 text-right">
                                            <button
                                                type="button"
                                                disabled={restoringId !== null}
                                                className="inline-flex items-center gap-1 rounded bg-slate-700 px-2 py-1 text-[10px] font-medium text-slate-200 transition-colors hover:bg-red-700 hover:text-white disabled:opacity-40"
                                                onClick={() => restore(s)}
                                            >
                                                <RotateCcw size={11} />
                                                {restoringId === s.id ? 'Revirtiendo…' : 'Revertir'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}
