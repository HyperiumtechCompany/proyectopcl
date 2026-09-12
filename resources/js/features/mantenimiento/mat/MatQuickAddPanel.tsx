import { Check, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import MoUnitSelect from '../mo/MoUnitSelect';

interface Line {
    id: number;
    descripcion: string;
    unidad: string;
    cantidad: string;
    precio: string;
}

interface Props {
    partidaNombre: string;
    onClose: () => void;
    onSave: (
        lines: Array<{ descripcion: string; unidad: string | null; cantidad: string | null; precio_unitario: string | null }>,
    ) => Promise<void>;
}

let _seq = 0;
const mkLine = (): Line => ({ id: ++_seq, descripcion: '', unidad: '', cantidad: '', precio: '' });

// Antes era una fila embebida en la tabla (colSpan=99): heredaba el ancho de TODA la hoja
// MAT (24+ columnas), así que la descripción quedaba estirada a >1000px y el panel se sentía
// "cargado". Ahora es un diálogo flotante de ancho fijo, igual al resto de diálogos del módulo
// (MoAddRowDialog/GgAddLineaDialog), pero conserva la carga rápida de varias líneas seguidas.
export default function MatQuickAddPanel({ partidaNombre, onClose, onSave }: Props) {
    const [lines, setLines] = useState<Line[]>(() => [mkLine()]);
    const [busy, setBusy] = useState(false);

    // Foco automático al agregar nueva línea
    const focusTarget = useRef<number | null>(null);
    const inputMap = useRef<Map<number, HTMLInputElement>>(new Map());

    useEffect(() => {
        if (focusTarget.current !== null) {
            inputMap.current.get(focusTarget.current)?.focus();
            focusTarget.current = null;
        }
    });

    const update = (id: number, field: keyof Omit<Line, 'id'>, value: string) =>
        setLines((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));

    const addLine = () => {
        const line = mkLine();
        focusTarget.current = line.id;
        setLines((prev) => [...prev, line]);
    };

    const removeLine = (id: number) =>
        setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));

    const save = async () => {
        const valid = lines.filter((l) => l.descripcion.trim());
        if (!valid.length) return;
        setBusy(true);
        try {
            await onSave(
                valid.map((l) => ({
                    descripcion: l.descripcion.trim(),
                    unidad: l.unidad.trim() || null,
                    cantidad: l.cantidad.trim() || null,
                    precio_unitario: l.precio.trim() || null,
                })),
            );
        } catch {
            // error ya manejado en el padre (alert + throw)
        } finally {
            setBusy(false);
        }
    };

    const handleKey = (e: React.KeyboardEvent<HTMLInputElement>, id: number, field: keyof Omit<Line, 'id'>) => {
        if (e.key === 'Escape') {
            onClose();
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            // Enter en P.U. de la última línea → nueva fila; en otros campos → siguiente campo (Tab)
            if (field === 'precio' && lines[lines.length - 1].id === id) {
                addLine();
            }
        }
    };

    const validCount = lines.filter((l) => l.descripcion.trim()).length;
    const inputClass =
        'w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-950 dark:focus:ring-blue-800';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-2xl space-y-3 rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900">
                <div>
                    <h2 className="font-semibold">Agregar material</h2>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">a la partida: {partidaNombre}</p>
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="grid grid-cols-[1fr_72px_88px_88px_24px] gap-x-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                        <span>Descripción del material</span>
                        <span>Und</span>
                        <span className="text-right">Cantidad</span>
                        <span className="text-right">P.U.</span>
                        <span />
                    </div>

                    {lines.map((line, idx) => (
                        <div
                            key={line.id}
                            className="grid grid-cols-[1fr_72px_88px_88px_24px] items-center gap-x-2 border-b border-slate-100 px-3 py-1.5 last:border-b-0 dark:border-slate-800"
                        >
                            <input
                                ref={(el) => {
                                    if (el) inputMap.current.set(line.id, el);
                                    else inputMap.current.delete(line.id);
                                }}
                                autoFocus={idx === 0}
                                value={line.descripcion}
                                onChange={(e) => update(line.id, 'descripcion', e.target.value)}
                                onKeyDown={(e) => handleKey(e, line.id, 'descripcion')}
                                placeholder="Descripción del material…"
                                className={inputClass}
                            />
                            <MoUnitSelect
                                value={line.unidad}
                                editable
                                className="rounded border border-slate-300 bg-white text-xs dark:border-slate-600 dark:bg-slate-950"
                                onCommit={(v) => update(line.id, 'unidad', v ?? '')}
                            />
                            <input
                                value={line.cantidad}
                                onChange={(e) => update(line.id, 'cantidad', e.target.value)}
                                onKeyDown={(e) => handleKey(e, line.id, 'cantidad')}
                                placeholder="0"
                                inputMode="decimal"
                                className={`${inputClass} text-right`}
                            />
                            <input
                                value={line.precio}
                                onChange={(e) => update(line.id, 'precio', e.target.value)}
                                onKeyDown={(e) => handleKey(e, line.id, 'precio')}
                                placeholder="0.000"
                                inputMode="decimal"
                                className={`${inputClass} text-right`}
                            />
                            <button
                                type="button"
                                onClick={() => removeLine(line.id)}
                                disabled={lines.length === 1}
                                className="flex items-center justify-center text-slate-300 transition hover:text-rose-500 disabled:opacity-20"
                                title="Quitar línea"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={addLine}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                >
                    <Plus size={12} /> Agregar línea
                </button>

                <div className="flex justify-end gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <X size={13} /> Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={() => void save()}
                        disabled={busy || validCount === 0}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        <Check size={13} />
                        {busy ? 'Guardando…' : validCount > 1 ? `Guardar (${validCount})` : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
