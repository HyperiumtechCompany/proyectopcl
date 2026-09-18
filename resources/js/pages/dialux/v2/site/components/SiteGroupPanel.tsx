import { Copy, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import type { PoleConfig } from '../domain/types';
import type { UseSiteEditorReturn } from '../hooks/useSiteEditor';
import { SITE_ELEMENT_DEFAULTS } from '../lib/siteDefaults';
import { PoleLuminairePanel } from './PoleLuminairePanel';

const inputClass =
    'mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white';

/** "Repetir en línea": crea N copias de la selección cada X m hacia un rumbo — p. ej. una hilera de postes. */
export function RepeatSection({ editor }: { editor: UseSiteEditorReturn }) {
    const [count, setCount] = useState(4);
    const [spacingM, setSpacingM] = useState(10);
    const [bearingDeg, setBearingDeg] = useState(90);
    const [created, setCreated] = useState<number | null>(null);

    return (
        <div className="grid gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
            <p className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                Repetir en línea
            </p>
            <div className="grid grid-cols-3 gap-1">
                <label className="text-[11px] text-slate-500">
                    Copias
                    <input
                        type="number"
                        min={1}
                        max={200}
                        step={1}
                        className={inputClass}
                        value={count}
                        onChange={(e) => setCount(Number(e.target.value))}
                    />
                </label>
                <label className="text-[11px] text-slate-500">
                    Cada (m)
                    <input
                        type="number"
                        min={0.5}
                        step={0.5}
                        className={inputClass}
                        value={spacingM}
                        onChange={(e) => setSpacingM(Number(e.target.value))}
                    />
                </label>
                <label className="text-[11px] text-slate-500">
                    Rumbo (°)
                    <input
                        type="number"
                        step={15}
                        className={inputClass}
                        value={bearingDeg}
                        onChange={(e) => setBearingDeg(Number(e.target.value))}
                    />
                </label>
            </div>
            <button
                type="button"
                onClick={() =>
                    setCreated(editor.repeatSelected(count, spacingM, bearingDeg))
                }
                className="rounded-md border border-cyan-500 py-1 text-[11px] font-semibold text-cyan-700 hover:bg-cyan-50 dark:text-cyan-300 dark:hover:bg-cyan-950/30"
            >
                Crear copias
            </button>
            <p className="text-[10px] text-slate-400">
                Rumbo: 0° = arriba en el plano, 90° = derecha, 180° = abajo.
                {created !== null && created > 0
                    ? ` Se crearon ${created} objetos (quedan seleccionados; Ctrl+Z los deshace de una vez).`
                    : ''}
            </p>
        </div>
    );
}

/** Panel para una selección de VARIOS objetos: resumen, acciones en bloque y repetición en línea. */
export function SiteGroupPanel({ editor }: { editor: UseSiteEditorReturn }) {
    const selected = (editor.siteData?.elements ?? []).filter((element) =>
        editor.selectedElementIds.includes(element.id),
    );
    // Postes con config de poste: se les puede asignar la misma luminaria de una vez.
    const poles = selected.filter(
        (element) =>
            element.type === 'pole' && element.config?.kind === 'pole',
    );
    const counts = new Map<string, number>();
    for (const element of selected) {
        const label = SITE_ELEMENT_DEFAULTS[element.type]?.label ?? element.type;
        counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    return (
        <div className="grid gap-3 p-4">
            <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {selected.length} objetos seleccionados
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                    {[...counts.entries()]
                        .map(([label, n]) => `${n} × ${label}`)
                        .join(' · ')}
                </p>
            </div>
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => {
                        editor.copySelectedElement();
                        editor.pasteElement();
                    }}
                    title="Duplica todo el grupo, desplazado 3 m"
                    className="flex flex-1 items-center justify-center gap-1 rounded-md border border-slate-200 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                >
                    <Copy className="h-3.5 w-3.5" /> Duplicar
                </button>
                <button
                    type="button"
                    onClick={() => editor.deleteSelected()}
                    className="flex flex-1 items-center justify-center gap-1 rounded-md border border-rose-300 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/30"
                >
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                </button>
            </div>
            {poles.length === selected.length && poles.length > 0 && (
                <PoleLuminairePanel
                    count={poles.length}
                    config={poles[0].config as PoleConfig}
                    onPatch={(patch) => {
                        // Un solo paso de deshacer para todo el grupo.
                        const history = useEditorStore.getState();
                        history.beginHistoryGesture();
                        for (const pole of poles) {
                            editor.updateSiteElement(pole.id, {
                                config: { ...(pole.config as PoleConfig), ...patch },
                            });
                        }
                        history.endHistoryGesture();
                    }}
                />
            )}
            <RepeatSection editor={editor} />
            <p className="text-[10px] text-slate-400">
                Arrastra cualquiera de los seleccionados para mover todo el
                grupo. Mayús/Ctrl + clic agrega o quita uno; Mayús/Ctrl +
                arrastrar sobre el fondo selecciona por recuadro; Ctrl+A
                selecciona todo; Ctrl+C / Ctrl+V copian y pegan el grupo; Supr
                lo elimina; Esc deselecciona.
            </p>
        </div>
    );
}
