import { Loader2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { moApi } from './moApi';
import type { MoPlantilla } from './types';

interface Props {
    onClose: () => void;
    onSubmit: (plantillaId: number, nombre: string) => Promise<void>;
}

export default function MoApplyPlantillaDialog({ onClose, onSubmit }: Props) {
    const [plantillas, setPlantillas] = useState<MoPlantilla[] | null>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [nombre, setNombre] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        void moApi.listPlantillas().then((res) => setPlantillas(res.plantillas));
    }, []);

    const deletePlantilla = async (id: number) => {
        if (!window.confirm('¿Eliminar esta plantilla? No se puede deshacer.')) return;
        await moApi.deletePlantilla(id);
        setPlantillas((prev) => prev?.filter((p) => p.id !== id) ?? null);
        if (selectedId === id) setSelectedId(null);
    };

    const submit = async () => {
        if (selectedId === null || !nombre.trim()) return;
        setBusy(true);
        try {
            await onSubmit(selectedId, nombre.trim());
            onClose();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900">
                <div>
                    <h2 className="font-semibold">Institución desde plantilla</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Trae los bloques, partidas, metrados y precios de una plantilla guardada — no empiezas desde cero.
                    </p>
                </div>

                {plantillas === null ? (
                    <div className="flex items-center justify-center py-8 text-slate-400">
                        <Loader2 size={18} className="animate-spin" />
                    </div>
                ) : plantillas.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        Todavía no tienes plantillas guardadas. Ve a una institución ya armada (clic derecho → "Guardar como plantilla")
                        para crear la primera.
                    </p>
                ) : (
                    <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-1 dark:border-slate-700">
                        {plantillas.map((p) => (
                            <div
                                key={p.id}
                                onClick={() => setSelectedId(p.id)}
                                className={`flex cursor-pointer items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-sm ${
                                    selectedId === p.id ? 'bg-blue-50 ring-1 ring-blue-400 dark:bg-blue-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                            >
                                <div className="min-w-0">
                                    <div className="truncate font-medium">{p.nombre}</div>
                                    {p.descripcion && <div className="truncate text-xs text-slate-500 dark:text-slate-400">{p.descripcion}</div>}
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        void deletePlantilla(p.id);
                                    }}
                                    className="shrink-0 text-slate-300 hover:text-rose-500"
                                    title="Eliminar plantilla"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Nombre de la institución nueva"
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                />

                <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={() => void submit()}
                        disabled={busy || selectedId === null || !nombre.trim()}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        {busy ? 'Creando…' : 'Crear institución'}
                    </button>
                </div>
            </div>
        </div>
    );
}
