import { useState } from 'react';
import type { NewPartida } from './moApi';

interface RowLike {
    partida_id: string;
    tipo: string;
    item?: string | null;
    descripcion: string;
    nivel: number;
}

interface Props {
    rows: RowLike[];
    initialParentId?: string | null;
    initialTipo?: 'ie' | 'bloque' | 'partida';
    onClose: () => void;
    onSubmit: (data: NewPartida) => Promise<void>;
}

export default function MoAddRowDialog({ rows, initialParentId, initialTipo, onClose, onSubmit }: Props) {
    const [tipo, setTipo] = useState<'ie' | 'bloque' | 'partida'>(initialTipo ?? 'partida');
    const [parentId, setParentId] = useState(initialParentId ?? '');
    const [item, setItem] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [unidad, setUnidad] = useState('');
    const [metrado, setMetrado] = useState('');
    const [moPu, setMoPu] = useState('');
    const [busy, setBusy] = useState(false);

    // Cualquier fila puede ser padre: si es una partida (hoja), el backend la asciende
    // a bloque automáticamente en cuanto se le agrega un hijo.
    const parents = rows;
    const selectedParent = parents.find((row) => row.partida_id === parentId);

    const submit = async () => {
        if (!descripcion.trim()) return;
        setBusy(true);
        try {
            await onSubmit({
                tipo,
                parent_id: tipo === 'ie' || !parentId ? null : parentId,
                item: item.trim() || null,
                descripcion: descripcion.trim(),
                unidad: unidad.trim() || null,
                metrado: metrado.trim() || null,
                mo_pu: moPu.trim() || null,
            });
            onClose();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900">
                <h2 className="font-semibold">Agregar fila</h2>

                <div className="flex gap-1 text-xs">
                    {(['ie', 'bloque', 'partida'] as const).map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => setTipo(option)}
                            className={`flex-1 rounded-md border px-2 py-1.5 font-medium capitalize ${
                                tipo === option ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'border-slate-300 dark:border-slate-700'
                            }`}
                        >
                            {option === 'ie' ? 'Institución' : option}
                        </button>
                    ))}
                </div>

                {tipo !== 'ie' && (
                    <label className="block text-xs font-medium text-slate-500">
                        Depende de
                        <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950">
                            <option value="">— raíz —</option>
                            {parents.map((row) => (
                                <option key={row.partida_id} value={row.partida_id}>
                                    {'—'.repeat(row.nivel)} {row.item} {row.descripcion}
                                </option>
                            ))}
                        </select>
                        {selectedParent?.tipo === 'partida' && (
                            <span className="mt-1 block text-[11px] font-normal text-amber-600 dark:text-amber-400">
                                "{selectedParent.descripcion}" es una partida (hoja); al agregarle esta fila se convertirá automáticamente en bloque (categoría).
                            </span>
                        )}
                    </label>
                )}

                <div className="grid grid-cols-3 gap-2">
                    <input value={item} onChange={(e) => setItem(e.target.value)} placeholder={tipo === 'ie' ? 'Ítem' : 'Automático'} title="Déjalo vacío para numerarlo solo según su posición en el árbol" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" />
                    <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción" required className="col-span-2 rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" />
                </div>

                {tipo === 'partida' && (
                    <div className="grid grid-cols-3 gap-2">
                        <input value={unidad} onChange={(e) => setUnidad(e.target.value)} placeholder="Und" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" />
                        <input value={metrado} onChange={(e) => setMetrado(e.target.value)} placeholder="Metrado" inputMode="decimal" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" />
                        <input value={moPu} onChange={(e) => setMoPu(e.target.value)} placeholder="P.U. M.O." inputMode="decimal" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" />
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
                    <button type="button" onClick={() => void submit()} disabled={busy || !descripcion.trim()} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                        Agregar
                    </button>
                </div>
            </div>
        </div>
    );
}
