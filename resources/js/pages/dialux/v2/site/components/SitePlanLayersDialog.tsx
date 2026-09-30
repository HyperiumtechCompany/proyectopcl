import { Layers, Search, X } from 'lucide-react';
import { useState } from 'react';
import type { DialuxPlanLightStatus } from '@/pages/dialux/hooks/dialuxPlanStorage';

const mb = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

/**
 * Elegir qué capas del plano cargar — como el administrador de capas de
 * AutoCAD. El plano completo no cabe en el navegador: cada capa muestra su
 * peso (con los bloques que solo ella usa, p.ej. los árboles en "Arboles y
 * Arbustos") y la barra estima el tamaño final contra el tope. Las
 * decorativas (mobiliario, sillas, árboles, sanitarios…) vienen desmarcadas.
 */
export function SitePlanLayersDialog({
    light,
    onConfirm,
    onClose,
}: {
    light: DialuxPlanLightStatus;
    onConfirm: (keep: string[]) => Promise<void>;
    onClose: () => void;
}) {
    const layers = light.layers ?? [];
    const [keep, setKeep] = useState<Set<string>>(
        () => new Set(layers.filter((layer) => layer.keep).map((layer) => layer.name)),
    );
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cap = light.cap_bytes;
    const estimate =
        (light.base_bytes ?? 0) +
        layers.filter((layer) => keep.has(layer.name)).reduce((sum, layer) => sum + layer.bytes, 0);
    const fits = estimate <= cap;
    const ratio = Math.min(1, estimate / Math.max(cap, 1));
    const visible = layers.filter((layer) => layer.name.toLowerCase().includes(query.trim().toLowerCase()));

    const toggle = (name: string) =>
        setKeep((current) => {
            const next = new Set(current);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    const setAll = (value: boolean) =>
        setKeep((current) => {
            const next = new Set(current);
            for (const layer of visible) {
                if (value) next.add(layer.name);
                else next.delete(layer.name);
            }
            return next;
        });

    const confirm = async () => {
        setBusy(true);
        setError(null);
        try {
            await onConfirm(layers.filter((layer) => keep.has(layer.name)).map((layer) => layer.name));
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'No se pudo generar el plano.');
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && onClose()}>
            <div
                className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900"
                onClick={(event) => event.stopPropagation()}
            >
                <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/10">
                    <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                        <Layers className="h-4 w-4 text-amber-500" />
                        Elegir capas del plano
                    </h2>
                    <button type="button" onClick={onClose} disabled={busy} title="Cerrar" className="text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-white">
                        <X className="h-4 w-4" />
                    </button>
                </header>

                <div className="space-y-2 border-b border-slate-200 px-4 py-3 text-[11px] text-slate-600 dark:border-white/10 dark:text-slate-300">
                    <p>
                        {`El plano completo (${mb(light.dxf_bytes ?? light.size_bytes)} en DXF) no cabe en el navegador. Elige las capas que necesitas para dibujar y trazar la instalación: se conservan con sus coordenadas exactas. Las decorativas vienen desmarcadas.`}
                    </p>
                    {light.error && (
                        <p className="rounded-md bg-amber-50 p-2 font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">{light.error}</p>
                    )}
                    <div>
                        <div className="mb-1 flex items-center justify-between">
                            <span className="font-semibold">Tamaño estimado</span>
                            <span className={fits ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'font-bold text-rose-600 dark:text-rose-400'}>
                                {`${mb(estimate)} de ${mb(cap)} máx.`}
                            </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                            <div className={`h-full ${fits ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.max(2, ratio * 100)}%` }} />
                        </div>
                        {!fits && <p className="mt-1 text-rose-600 dark:text-rose-400">Desmarca capas (las de más arriba son las más pesadas) hasta quedar dentro del máximo.</p>}
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="flex flex-1 items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 dark:border-white/10">
                            <Search className="h-3.5 w-3.5 text-slate-400" />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Buscar capa…"
                                className="w-full bg-transparent text-[11px] outline-none"
                            />
                        </label>
                        <button type="button" onClick={() => setAll(true)} className="rounded border border-slate-300 px-2 py-1 text-[10px] hover:bg-slate-100 dark:border-white/15 dark:hover:bg-white/5">
                            Marcar
                        </button>
                        <button type="button" onClick={() => setAll(false)} className="rounded border border-slate-300 px-2 py-1 text-[10px] hover:bg-slate-100 dark:border-white/15 dark:hover:bg-white/5">
                            Desmarcar
                        </button>
                    </div>
                </div>

                <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto px-2 py-1 dark:divide-white/5">
                    {visible.map((layer) => (
                        <li key={layer.name}>
                            <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[11px] hover:bg-slate-50 dark:hover:bg-white/5">
                                <input
                                    type="checkbox"
                                    className="h-3.5 w-3.5 accent-amber-600"
                                    checked={keep.has(layer.name)}
                                    onChange={() => toggle(layer.name)}
                                />
                                <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200" title={layer.name}>
                                    {layer.name || '(sin nombre)'}
                                </span>
                                <span className="shrink-0 text-slate-400">{`${layer.entities.toLocaleString('es-PE')} obj.`}</span>
                                <span className="w-16 shrink-0 text-right font-semibold text-slate-600 dark:text-slate-300">{mb(layer.bytes)}</span>
                            </label>
                        </li>
                    ))}
                    {visible.length === 0 && <li className="px-2 py-3 text-[11px] text-slate-400">Ninguna capa coincide.</li>}
                </ul>

                <footer className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 dark:border-white/10">
                    <span className="text-[10px] text-slate-500">{`${keep.size} de ${layers.length} capas`}</span>
                    {error && <span className="flex-1 text-[10px] text-rose-600">{error}</span>}
                    <button
                        type="button"
                        disabled={busy || keep.size === 0 || !fits}
                        onClick={() => void confirm()}
                        title={!fits ? 'Supera el máximo: desmarca capas' : undefined}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                    >
                        {busy ? 'Enviando…' : 'Generar plano ligero'}
                    </button>
                </footer>
            </div>
        </div>
    );
}
