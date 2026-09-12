import { useState } from 'react';
import type { MatRow } from './types';

interface Props {
    rows: MatRow[];
    onClose: () => void;
    onSubmit: (data: { partida_id: string; descripcion: string; unidad: string | null; cantidad: string | null; precio_unitario: string | null }) => Promise<void>;
}

export default function MatAddMaterialDialog({ rows, onClose, onSubmit }: Props) {
    const partidas = rows.filter((row) => row.tipo === 'partida');
    const [partidaId, setPartidaId] = useState(partidas[0]?.partida_id ?? '');
    const [descripcion, setDescripcion] = useState('');
    const [unidad, setUnidad] = useState('');
    const [cantidad, setCantidad] = useState('');
    const [precio, setPrecio] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!partidaId || !descripcion.trim()) return;
        setBusy(true);
        try {
            await onSubmit({
                partida_id: partidaId,
                descripcion: descripcion.trim(),
                unidad: unidad.trim() || null,
                cantidad: cantidad.trim() || null,
                precio_unitario: precio.trim() || null,
            });
            onClose();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900">
                <h2 className="font-semibold">Agregar material</h2>
                {partidas.length === 0 ? (
                    <p className="text-sm text-amber-700">Primero agrega una partida (botón “Agregar fila” en MO o importa el presupuesto).</p>
                ) : (
                    <>
                        <label className="block text-xs font-medium text-slate-500">
                            Partida
                            <select value={partidaId} onChange={(e) => setPartidaId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950">
                                {partidas.map((row) => (
                                    <option key={row.partida_id} value={row.partida_id}>{row.item} · {row.descripcion}</option>
                                ))}
                            </select>
                        </label>
                        <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción del material" required className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" />
                        <div className="grid grid-cols-3 gap-2">
                            <input value={unidad} onChange={(e) => setUnidad(e.target.value)} placeholder="Und" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" />
                            <input value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="Cantidad" inputMode="decimal" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" />
                            <input value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="P.U." inputMode="decimal" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" />
                        </div>
                    </>
                )}
                <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
                    <button type="button" onClick={() => void submit()} disabled={busy || !partidaId || !descripcion.trim()} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Agregar</button>
                </div>
            </div>
        </div>
    );
}
