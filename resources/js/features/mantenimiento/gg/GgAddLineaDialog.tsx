import { useMemo, useState } from 'react';
import type { GgGrupo, GgRow } from './types';

interface Props {
    rows: GgRow[];
    onClose: () => void;
    onSubmit: (data: { grupo: GgGrupo; rubro: string; descripcion: string; unidad: string | null; cantidad: string | null; costo_unitario: string | null }) => Promise<void>;
}

export default function GgAddLineaDialog({ rows, onClose, onSubmit }: Props) {
    const rubrosPorGrupo = useMemo(() => {
        const map: Record<GgGrupo, string[]> = { fijo: [], variable: [] };
        rows.forEach((row) => {
            if (row.tipo === 'rubro' && !map[row.grupo].includes(row.rubro)) {
                map[row.grupo].push(row.rubro);
            }
        });
        return map;
    }, [rows]);

    const [grupo, setGrupo] = useState<GgGrupo>('fijo');
    const [rubro, setRubro] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [unidad, setUnidad] = useState('');
    const [cantidad, setCantidad] = useState('');
    const [costoUnitario, setCostoUnitario] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!rubro.trim() || !descripcion.trim()) return;
        setBusy(true);
        try {
            await onSubmit({
                grupo,
                rubro: rubro.trim(),
                descripcion: descripcion.trim(),
                unidad: unidad.trim() || null,
                cantidad: cantidad.trim() || null,
                costo_unitario: costoUnitario.trim() || null,
            });
            onClose();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900">
                <h2 className="font-semibold">Agregar línea de gasto general</h2>
                <label className="block text-xs font-medium text-slate-500">
                    Grupo
                    <select value={grupo} onChange={(e) => setGrupo(e.target.value as GgGrupo)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950">
                        <option value="fijo">Gastos Generales Fijos</option>
                        <option value="variable">Gastos Generales Variables</option>
                    </select>
                </label>
                <label className="block text-xs font-medium text-slate-500">
                    Rubro
                    <input
                        list="gg-rubros"
                        value={rubro}
                        onChange={(e) => setRubro(e.target.value)}
                        placeholder='p. ej. "Fianzas: Contratación"'
                        className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                    />
                    <datalist id="gg-rubros">
                        {rubrosPorGrupo[grupo].map((r) => <option key={r} value={r} />)}
                    </datalist>
                </label>
                <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción de la línea" required className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" />
                <div className="grid grid-cols-3 gap-2">
                    <input value={unidad} onChange={(e) => setUnidad(e.target.value)} placeholder="Und" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" />
                    <input value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="Cantidad" inputMode="decimal" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" />
                    <input value={costoUnitario} onChange={(e) => setCostoUnitario(e.target.value)} placeholder="Costo U." inputMode="decimal" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">Cancelar</button>
                    <button type="button" onClick={() => void submit()} disabled={busy || !rubro.trim() || !descripcion.trim()} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Agregar</button>
                </div>
            </div>
        </div>
    );
}
