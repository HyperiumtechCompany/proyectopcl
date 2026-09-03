import { AlertTriangle, Layers, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { extractDxfEntitiesFromEngineDocument } from '@/pages/dialux/hooks/engineDxfExtraction';
import type { ScaleConfig } from '@/pages/dialux/hooks/types';
import { loadWasmModule } from '@/pages/dialux/hooks/useWasmEngine';
import type { Point2D } from '../domain/types';

interface LayerGroup {
    layer: string;
    polylines: Point2D[][];
}

interface Props {
    onImport: (
        polylines: Point2D[][],
        startElevationM: number,
        intervalM: number,
    ) => void;
    onClose: () => void;
}

// Coords en unidades CAD nativas (sin escalar) — mismo espacio que la
// geometría del emplazamiento. Y se niega abajo (el sitio dibuja Y hacia abajo).
const RAW_SCALE: ScaleConfig = {
    unit: 'm',
    factor: 1,
    displayUnit: 'm',
    calibrationFactor: 1,
    isCalibrated: false,
};

export function SiteContourImportDialog({ onImport, onClose }: Props) {
    const [groups, setGroups] = useState<LayerGroup[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [startElev, setStartElev] = useState('0');
    const [interval, setInterval] = useState('0');

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const wasm = await loadWasmModule();
                const { entities } = extractDxfEntitiesFromEngineDocument(
                    RAW_SCALE,
                    wasm,
                );
                if (cancelled) return;
                const byLayer = new Map<string, Point2D[][]>();
                for (const e of entities) {
                    if (e.type !== 'polyline') continue;
                    if (!Array.isArray(e.vertices) || e.vertices.length < 2) {
                        continue;
                    }
                    const pts = e.vertices.map(([x, y]) => ({ x, y: -y }));
                    const arr = byLayer.get(e.layer) ?? [];
                    arr.push(pts);
                    byLayer.set(e.layer, arr);
                }
                const list = [...byLayer.entries()]
                    .map(([layer, polylines]) => ({ layer, polylines }))
                    .sort((a, b) => b.polylines.length - a.polylines.length);
                setGroups(list);
                if (list.length > 0) setSelected(list[0].layer);
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : String(err));
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const chosen = groups?.find((g) => g.layer === selected) ?? null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-slate-900"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                        Extraer curvas de nivel del plano
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {!groups && !error && (
                    <p className="text-xs text-slate-500">
                        Leyendo polilíneas del plano CAD…
                    </p>
                )}

                {error && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {error}
                    </div>
                )}

                {groups && groups.length === 0 && (
                    <p className="text-xs text-slate-500">
                        No se encontraron polilíneas en el plano (puede que
                        estén dentro de bloques que el lector no expande).
                        Dibuja las curvas a mano con la herramienta “Curva de
                        nivel”.
                    </p>
                )}

                {groups && groups.length > 0 && (
                    <>
                        <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
                            Elige la capa con las curvas de nivel. El DXF no
                            trae la cota — se asigna por orden; ajústala luego
                            en el panel de cada curva.
                        </p>
                        <div className="mb-3 max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-1 dark:border-white/10">
                            {groups.map((g) => (
                                <button
                                    key={g.layer}
                                    type="button"
                                    onClick={() => setSelected(g.layer)}
                                    className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[11px] ${
                                        selected === g.layer
                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
                                    }`}
                                >
                                    <span className="flex items-center gap-1.5 truncate">
                                        <Layers className="h-3 w-3 shrink-0" />
                                        {g.layer || '(sin capa)'}
                                    </span>
                                    <span className="shrink-0 text-slate-400">
                                        {g.polylines.length} polil.
                                    </span>
                                </button>
                            ))}
                        </div>
                        <div className="mb-3 grid grid-cols-2 gap-2">
                            <label className="text-[11px] text-slate-500">
                                Cota de la 1.ª curva (m)
                                <input
                                    type="number"
                                    step="0.5"
                                    className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                    value={startElev}
                                    onChange={(e) =>
                                        setStartElev(e.target.value)
                                    }
                                />
                            </label>
                            <label className="text-[11px] text-slate-500">
                                Intervalo entre curvas (m)
                                <input
                                    type="number"
                                    step="0.5"
                                    className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                    value={interval}
                                    onChange={(e) =>
                                        setInterval(e.target.value)
                                    }
                                />
                            </label>
                        </div>
                        <button
                            type="button"
                            disabled={!chosen}
                            onClick={() =>
                                chosen &&
                                onImport(
                                    chosen.polylines,
                                    Number(startElev) || 0,
                                    Number(interval) || 0,
                                )
                            }
                            className="h-8 w-full rounded-md bg-amber-600 text-xs font-semibold text-white disabled:opacity-40"
                        >
                            Importar {chosen?.polylines.length ?? 0} curvas
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
