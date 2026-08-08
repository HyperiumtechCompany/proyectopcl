import React, { useMemo, useState } from 'react';
import type { IfcImportPreview } from '@/pages/dialux/hooks/ifcImport/ifcImportPipeline';

/**
 * Fase 19 del plan maestro ("BIM/IFC" — importar y mapear estructura
 * espacial, primer ciclo). Mismo patrón visual que `CalibrationDialog.tsx`
 * (overlay simple, sin `backdrop-blur` sobre el canvas CAD en vivo): muestra
 * lo que se detectó en el archivo IFC (niveles → espacios) ANTES de crear
 * nada en el editor — nunca se importa a ciegas.
 */
export interface IfcImportSelection {
    /** `expressId` de storey → set de `expressId` de espacio seleccionados dentro de ese storey. Un storey ausente de este mapa no se importa. */
    storeys: Map<number, Set<number>>;
}

interface IfcImportDialogProps {
    open: boolean;
    preview: IfcImportPreview | null;
    onCancel: () => void;
    onApply: (selection: IfcImportSelection) => void;
}

function fmtArea(vertices: Array<{ x: number; y: number }>): number {
    let sum = 0;
    for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i]!;
        const b = vertices[(i + 1) % vertices.length]!;
        sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum) / 2;
}

export const IfcImportDialog: React.FC<IfcImportDialogProps> = ({ open, preview, onCancel, onApply }) => {
    const [selection, setSelection] = useState<IfcImportSelection | null>(null);

    // Por defecto, todo seleccionado — se recalcula cada vez que llega un preview nuevo.
    const effectiveSelection = useMemo<IfcImportSelection>(() => {
        if (selection) return selection;
        const storeys = new Map<number, Set<number>>();
        for (const storey of preview?.storeys ?? []) {
            storeys.set(storey.expressId, new Set(storey.spaces.map((s) => s.expressId)));
        }
        return { storeys };
    }, [preview, selection]);

    if (!open || !preview) return null;

    const toggleStorey = (storeyExpressId: number, spaceExpressIds: number[]) => {
        const next = new Map(effectiveSelection.storeys);
        if (next.has(storeyExpressId)) {
            next.delete(storeyExpressId);
        } else {
            next.set(storeyExpressId, new Set(spaceExpressIds));
        }
        setSelection({ storeys: next });
    };

    const toggleSpace = (storeyExpressId: number, spaceExpressId: number) => {
        const next = new Map(effectiveSelection.storeys);
        const current = new Set(next.get(storeyExpressId) ?? []);
        if (current.has(spaceExpressId)) {
            current.delete(spaceExpressId);
        } else {
            current.add(spaceExpressId);
        }
        next.set(storeyExpressId, current);
        setSelection({ storeys: next });
    };

    const totalSelectedSpaces = [...effectiveSelection.storeys.values()].reduce((sum, set) => sum + set.size, 0);

    return (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70">
            <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-cyan-600/30 bg-slate-200 dark:bg-slate-900 p-5 shadow-2xl">
                <div className="mb-4">
                    <p className="text-sm font-semibold text-cyan-300">Importar IFC — estructura detectada</p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        Revisa los niveles y espacios detectados antes de importar. Cada espacio se mapea a un
                        recinto real (geometría + altura); su `GlobalId` IFC se conserva.
                    </p>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                    {preview.storeys.length === 0 && (
                        <p className="text-xs text-slate-500">No se encontró ningún IfcBuildingStorey en el archivo.</p>
                    )}
                    {preview.storeys.map((storey) => {
                        const spaceIds = storey.spaces.map((s) => s.expressId);
                        const checked = effectiveSelection.storeys.has(storey.expressId);
                        const selectedSpaces = effectiveSelection.storeys.get(storey.expressId) ?? new Set();
                        return (
                            <div key={storey.expressId} className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-300 dark:bg-slate-950/60 p-3">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                                    <input type="checkbox" checked={checked} onChange={() => toggleStorey(storey.expressId, spaceIds)} />
                                    {storey.name ?? `Nivel ${storey.expressId}`}
                                    <span className="font-normal text-slate-500">({storey.spaces.length} espacio{storey.spaces.length === 1 ? '' : 's'})</span>
                                </label>
                                {checked && (
                                    <div className="mt-2 ml-6 space-y-1">
                                        {storey.spaces.map((space) => (
                                            <label key={space.expressId} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedSpaces.has(space.expressId)}
                                                    disabled={!space.footprint}
                                                    onChange={() => toggleSpace(storey.expressId, space.expressId)}
                                                />
                                                <span className={space.footprint ? '' : 'text-slate-600 line-through'}>
                                                    {space.name ?? `Espacio ${space.expressId}`}
                                                </span>
                                                {space.footprint ? (
                                                    <span className="font-mono text-slate-500">
                                                        {fmtArea(space.footprint.vertices).toFixed(1)} m² · {space.footprint.height.toFixed(2)} m alt.
                                                    </span>
                                                ) : (
                                                    <span className="text-red-400">sin geometría reconocible</span>
                                                )}
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-500">{totalSelectedSpaces} espacio(s) seleccionados</p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-200 dark:bg-slate-800"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            disabled={totalSelectedSpaces === 0}
                            onClick={() => onApply(effectiveSelection)}
                            className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Importar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
