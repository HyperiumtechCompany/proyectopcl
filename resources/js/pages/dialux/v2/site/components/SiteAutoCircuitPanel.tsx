import { Cable, Check, Wand2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import type { AutoCircuitPlan, AutoCircuitRules } from '../domain/siteAutoCircuit';
import { DEFAULT_AUTO_CIRCUIT_RULES } from '../domain/siteAutoCircuit';
import type { Point2D, SiteElement } from '../domain/types';
import type { UseSiteEditorReturn } from '../hooks/useSiteEditor';

/** Vista previa de los cables propuestos (la dibuja el 2D, `AutoCircuitPreviewLayer`). */
interface AutoCircuitPreviewStore {
    segments: Array<{ from: Point2D; to: Point2D; color: string }> | null;
    set: (segments: AutoCircuitPreviewStore['segments']) => void;
}

export const useAutoCircuitPreview = create<AutoCircuitPreviewStore>((set) => ({
    segments: null,
    set: (segments) => set({ segments }),
}));

const PHASE_COLOR = { R: '#ef4444', S: '#f59e0b', T: '#0ea5e9' } as const;

const fmt = (value: number, digits = 1) =>
    Number.isFinite(value)
        ? value.toLocaleString('es-PE', { maximumFractionDigits: digits })
        : '—';

function RuleField({
    label,
    value,
    step,
    onChange,
}: {
    label: string;
    value: number;
    step: number;
    onChange: (value: number) => void;
}) {
    return (
        <label className="text-[10px] text-slate-500">
            {label}
            <input
                type="number"
                min={step}
                step={step}
                value={value}
                onChange={(event) => onChange(Math.max(step, Number(event.target.value) || step))}
                className="mt-0.5 h-7 w-full rounded border border-slate-300 bg-white px-1.5 text-[11px] text-slate-800 dark:border-white/15 dark:bg-slate-900 dark:text-slate-100"
            />
        </label>
    );
}

/**
 * Auto-circuitado del tablero (E1): propone circuitos para TODAS las cargas
 * sin cablear más cercanas a este tablero, los muestra sobre el plano y los
 * crea con un clic ("Aplicar" = un solo paso de deshacer).
 */
export function SiteAutoCircuitPanel({
    element,
    editor,
}: {
    element: SiteElement;
    editor: UseSiteEditorReturn;
}) {
    const [rules, setRules] = useState<AutoCircuitRules>(DEFAULT_AUTO_CIRCUIT_RULES);
    const [plan, setPlan] = useState<AutoCircuitPlan | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const setPreview = useAutoCircuitPreview((state) => state.set);

    const propose = () => {
        const next = editor.planPanelAutoCircuits(element.id, rules);
        setPlan(next);
        setMessage(null);
    };

    // Cables "fantasma" coloreados por fase mientras hay propuesta.
    useEffect(() => {
        if (!plan) {
            setPreview(null);
            return;
        }
        const byId = new Map((editor.siteData?.elements ?? []).map((item) => [item.id, item]));
        const phaseOfLoad = new Map(
            plan.groups.flatMap((group) => group.loadIds.map((id) => [id, group.phase] as const)),
        );
        setPreview(
            plan.circuits
                .filter((circuit) => byId.has(circuit.sourceId) && byId.has(circuit.targetId))
                .map((circuit) => ({
                    from: circuit.waypoints[0],
                    to: circuit.waypoints[circuit.waypoints.length - 1],
                    color: PHASE_COLOR[phaseOfLoad.get(circuit.targetId) ?? 'R'],
                })),
        );
    }, [plan, editor.siteData, setPreview]);
    useEffect(() => () => setPreview(null), [setPreview]);

    const apply = () => {
        if (!plan) return;
        const created = editor.applyAutoCircuits(plan);
        setMessage(`Creados ${plan.groups.length} circuitos (${created} cables). Ctrl+Z los deshace.`);
        setPlan(null);
    };

    return (
        <section className="space-y-2 rounded-lg border border-cyan-200 bg-cyan-50/50 p-2 dark:border-cyan-500/20 dark:bg-cyan-500/5">
            <div className="flex items-center gap-2">
                <Cable className="h-4 w-4 text-cyan-600" />
                <p className="flex-1 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    Auto-circuitar este tablero
                </p>
                <button
                    type="button"
                    onClick={propose}
                    className="inline-flex items-center gap-1 rounded-md bg-cyan-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-cyan-700"
                >
                    <Wand2 className="h-3.5 w-3.5" />
                    {plan ? 'Recalcular' : 'Proponer'}
                </button>
            </div>

            {plan && (
                <>
                    {plan.warnings.map((warning) => (
                        <p key={warning} className="rounded bg-amber-100 px-2 py-1 text-[10px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            {warning}
                        </p>
                    ))}
                    {plan.groups.length > 0 && (
                        <>
                            <table className="w-full text-left text-[10px]">
                                <thead className="text-slate-500">
                                    <tr>
                                        <th className="py-0.5">Circuito</th>
                                        <th className="py-0.5 text-right">Pts</th>
                                        <th className="py-0.5 text-right">W</th>
                                        <th className="py-0.5 text-center">Fase</th>
                                        <th className="py-0.5 text-right">mm²</th>
                                        <th className="py-0.5 text-right">ΔU</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {plan.groups.map((group, index) => (
                                        <tr key={index} className="border-t border-slate-100 dark:border-white/5">
                                            <td className="py-0.5">
                                                {group.kind === 'lighting' ? 'Alumbrado' : 'Tomas'} {index + 1}
                                            </td>
                                            <td className="py-0.5 text-right tabular-nums">{group.loadIds.length}</td>
                                            <td className="py-0.5 text-right tabular-nums">{fmt(group.powerW, 0)}</td>
                                            <td className="py-0.5 text-center font-bold" style={{ color: PHASE_COLOR[group.phase] }}>
                                                {group.phase}
                                            </td>
                                            <td className="py-0.5 text-right tabular-nums">{group.sectionMm2}</td>
                                            <td
                                                className={`py-0.5 text-right tabular-nums ${group.ok ? '' : 'font-semibold text-red-600 dark:text-red-400'}`}
                                                title={`Límite ${fmt(group.maxVoltageDropPct)} % · ${fmt(group.lengthM)} m`}
                                            >
                                                {fmt(group.voltageDropPct, 2)} %
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button
                                type="button"
                                onClick={apply}
                                className="flex w-full items-center justify-center gap-1 rounded-md bg-emerald-600 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                            >
                                <Check className="h-3.5 w-3.5" />
                                Aplicar {plan.groups.length} circuitos
                            </button>
                        </>
                    )}
                </>
            )}
            {message && <p className="text-[10px] text-emerald-700 dark:text-emerald-300">{message}</p>}

            <details className="rounded-md border border-slate-200 bg-white px-2 py-1 dark:border-white/10 dark:bg-slate-900">
                <summary className="cursor-pointer text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                    Reglas del circuitado
                </summary>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5 pb-1">
                    <RuleField label="Máx. W alumbrado" value={rules.maxLightingW} step={100} onChange={(v) => setRules({ ...rules, maxLightingW: v })} />
                    <RuleField label="Máx. puntos alumbrado" value={rules.maxLightingPoints} step={1} onChange={(v) => setRules({ ...rules, maxLightingPoints: v })} />
                    <RuleField label="Máx. W tomas" value={rules.maxOutletW} step={100} onChange={(v) => setRules({ ...rules, maxOutletW: v })} />
                    <RuleField label="Máx. puntos tomas" value={rules.maxOutletPoints} step={1} onChange={(v) => setRules({ ...rules, maxOutletPoints: v })} />
                </div>
                <p className="pb-1 text-[9px] leading-snug text-slate-400">
                    Criterios de proyecto (editables, no normativos). Solo cargas
                    sin cablear y más cercanas a este tablero. Alumbrado y tomas
                    separados; agrupación por barrido angular; cables en cadena
                    (vecino más cercano); fases por mayor carga a la fase menos
                    cargada; sección = la menor con ΔU y capacidad dentro del
                    límite del motor CT de la V1. Cables en línea recta: ajusta el
                    recorrido si cruza edificios.
                </p>
            </details>
        </section>
    );
}

/** Cables propuestos por el auto-circuitado (línea punteada por fase). */
export function AutoCircuitPreviewLayer({
    toScreen,
}: {
    toScreen: (point: Point2D) => Point2D;
}) {
    const segments = useAutoCircuitPreview((state) => state.segments);
    if (!segments || segments.length === 0) return null;
    return (
        <g className="pointer-events-none" aria-hidden>
            {segments.map((segment, index) => {
                const a = toScreen(segment.from);
                const b = toScreen(segment.to);
                return (
                    <line
                        key={index}
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke={segment.color}
                        strokeWidth={2.5}
                        strokeDasharray="6 4"
                        strokeLinecap="round"
                        opacity={0.9}
                    />
                );
            })}
        </g>
    );
}
