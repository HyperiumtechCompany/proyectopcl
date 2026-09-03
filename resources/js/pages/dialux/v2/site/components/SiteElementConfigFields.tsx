import type {
    FenceConfig,
    GateConfig,
    GateVariant,
    PoleConfig,
    RampConfig,
    SiteElement,
    SiteElementConfig,
    TgConfig,
    TransformerConfig,
} from '../domain/types';
import type { UseSiteEditorReturn } from '../hooks/useSiteEditor';
import { defaultConfigFor } from '../lib/siteDefaults';

const input =
    'mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white';
const field = 'text-[11px] text-slate-500';

function Num({
    label,
    value,
    step = 0.1,
    min,
    onChange,
}: {
    label: string;
    value: number;
    step?: number;
    min?: number;
    onChange: (n: number) => void;
}) {
    return (
        <label className={field}>
            {label}
            <input
                type="number"
                step={step}
                min={min}
                className={input}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
            />
        </label>
    );
}

const GATE_VARIANTS: { value: GateVariant; label: string }[] = [
    { value: 'swing', label: 'Batiente 1 hoja' },
    { value: 'double-swing', label: 'Batiente 2 hojas' },
    { value: 'sliding', label: 'Corrediza' },
    { value: 'barrier', label: 'Pluma / barrera' },
    { value: 'pedestrian', label: 'Peatonal' },
];

/** Campos configurables del objeto seleccionado según su tipo. */
export function SiteElementConfigFields({
    element,
    editor,
}: {
    element: SiteElement;
    editor: UseSiteEditorReturn;
}) {
    const set = (config: SiteElementConfig) =>
        editor.updateSiteElement(element.id, { config });
    const fallback = defaultConfigFor(element.type);
    if (!fallback) return null;
    const cfg = (
        element.config?.kind === fallback.kind ? element.config : fallback
    ) as SiteElementConfig;

    if (cfg.kind === 'gate') {
        const g = cfg as GateConfig;
        return (
            <div className="grid gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                <label className={field}>
                    Tipo de portón
                    <select
                        className={input}
                        value={g.variant}
                        onChange={(e) =>
                            set({
                                ...g,
                                variant: e.target.value as GateVariant,
                            })
                        }
                    >
                        {GATE_VARIANTS.map((v) => (
                            <option key={v.value} value={v.value}>
                                {v.label}
                            </option>
                        ))}
                    </select>
                </label>
                <label className={field}>
                    Estado
                    <select
                        className={input}
                        value={g.state}
                        onChange={(e) => {
                            const state = e.target.value as GateConfig['state'];
                            set({
                                ...g,
                                state,
                                openAngleDeg:
                                    state === 'open'
                                        ? 90
                                        : state === 'ajar'
                                          ? 35
                                          : 0,
                            });
                        }}
                    >
                        <option value="closed">Cerrado</option>
                        <option value="ajar">Entreabierto</option>
                        <option value="open">Abierto</option>
                    </select>
                </label>
                {(g.variant === 'swing' ||
                    g.variant === 'double-swing' ||
                    g.variant === 'barrier') && (
                    <Num
                        label="Ángulo de apertura (°)"
                        value={g.openAngleDeg}
                        step={5}
                        onChange={(openAngleDeg) => set({ ...g, openAngleDeg })}
                    />
                )}
                <Num
                    label="Ancho (m)"
                    value={g.widthM}
                    min={0}
                    onChange={(widthM) => set({ ...g, widthM })}
                />
            </div>
        );
    }

    if (cfg.kind === 'pole') {
        const p = cfg as PoleConfig;
        return (
            <div className="grid gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                <Num
                    label="Altura del fuste (m)"
                    value={p.heightM}
                    min={0}
                    onChange={(heightM) => set({ ...p, heightM })}
                />
                <Num
                    label="Largo de brazo (m, 0 = sin brazo)"
                    value={p.armLengthM}
                    min={0}
                    onChange={(armLengthM) => set({ ...p, armLengthM })}
                />
                <Num
                    label="Dirección del brazo (°)"
                    value={p.armDirectionDeg}
                    step={15}
                    onChange={(armDirectionDeg) =>
                        set({ ...p, armDirectionDeg })
                    }
                />
                <Num
                    label="N.º de luminarias"
                    value={p.fixtures}
                    step={1}
                    min={1}
                    onChange={(fixtures) =>
                        set({ ...p, fixtures: Math.round(fixtures) })
                    }
                />
            </div>
        );
    }

    if (cfg.kind === 'transformer') {
        const t = cfg as TransformerConfig;
        return (
            <div className="grid gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                <label className={field}>
                    Montaje
                    <select
                        className={input}
                        value={t.mount}
                        onChange={(e) =>
                            set({
                                ...t,
                                mount: e.target
                                    .value as TransformerConfig['mount'],
                            })
                        }
                    >
                        <option value="pad">Pad-mounted (piso)</option>
                        <option value="pole">Sobre poste</option>
                    </select>
                </label>
                <Num
                    label="Potencia (kVA)"
                    value={t.kva ?? 0}
                    step={5}
                    min={0}
                    onChange={(kva) => set({ ...t, kva: kva || undefined })}
                />
                <div className="grid grid-cols-3 gap-1">
                    <Num
                        label="Ancho"
                        value={t.widthM}
                        onChange={(widthM) => set({ ...t, widthM })}
                    />
                    <Num
                        label="Fondo"
                        value={t.depthM}
                        onChange={(depthM) => set({ ...t, depthM })}
                    />
                    <Num
                        label="Alto"
                        value={t.heightM}
                        onChange={(heightM) => set({ ...t, heightM })}
                    />
                </div>
            </div>
        );
    }

    if (cfg.kind === 'tg') {
        const t = cfg as TgConfig;
        return (
            <div className="grid gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                <label className={field}>
                    Montaje
                    <select
                        className={input}
                        value={t.mount}
                        onChange={(e) =>
                            set({
                                ...t,
                                mount: e.target.value as TgConfig['mount'],
                            })
                        }
                    >
                        <option value="floor">Autosoportado (piso)</option>
                        <option value="pedestal">Sobre pedestal</option>
                        <option value="wall">Adosado a muro</option>
                    </select>
                </label>
                <div className="grid grid-cols-3 gap-1">
                    <Num
                        label="Ancho"
                        value={t.widthM}
                        onChange={(widthM) => set({ ...t, widthM })}
                    />
                    <Num
                        label="Fondo"
                        value={t.depthM}
                        onChange={(depthM) => set({ ...t, depthM })}
                    />
                    <Num
                        label="Alto"
                        value={t.heightM}
                        onChange={(heightM) => set({ ...t, heightM })}
                    />
                </div>
            </div>
        );
    }

    if (cfg.kind === 'fence') {
        const f = cfg as FenceConfig;
        return (
            <div className="grid gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                <label className={field}>
                    Perfil del terreno
                    <select
                        className={input}
                        value={f.slope}
                        onChange={(e) =>
                            set({
                                ...f,
                                slope: e.target.value as FenceConfig['slope'],
                            })
                        }
                    >
                        <option value="flat">Plano (cota constante)</option>
                        <option value="ramp">
                            En pendiente (sube del inicio al fin)
                        </option>
                    </select>
                </label>
                {f.slope === 'ramp' && (
                    <Num
                        label="Cota del extremo final (m)"
                        value={f.endElevationM}
                        onChange={(endElevationM) =>
                            set({ ...f, endElevationM })
                        }
                    />
                )}
                <p className="text-[10px] text-slate-400">
                    Para una ladera con escalones, dibuja un cerco por tramo y
                    dale a cada uno su cota base.
                </p>
            </div>
        );
    }

    if (cfg.kind === 'ramp') {
        const r = cfg as RampConfig;
        const runM =
            Math.hypot(
                (element.vertices[1]?.x ?? 0) - (element.vertices[0]?.x ?? 0),
                (element.vertices[1]?.y ?? 0) - (element.vertices[0]?.y ?? 0),
            ) * editor.terrainScaleM || 1;
        const slopePct =
            (Math.abs(r.toElevationM - r.fromElevationM) / runM) * 100;
        return (
            <div className="grid gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                <div className="grid grid-cols-2 gap-1">
                    <Num
                        label="Cota origen (m)"
                        value={r.fromElevationM}
                        onChange={(fromElevationM) =>
                            set({ ...r, fromElevationM })
                        }
                    />
                    <Num
                        label="Cota destino (m)"
                        value={r.toElevationM}
                        onChange={(toElevationM) => set({ ...r, toElevationM })}
                    />
                </div>
                <Num
                    label="Ancho (m)"
                    value={r.widthM}
                    min={0}
                    onChange={(widthM) => set({ ...r, widthM })}
                />
                <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Pendiente</span>
                    <strong
                        className={
                            slopePct > 12
                                ? 'text-amber-600 dark:text-amber-400'
                                : ''
                        }
                    >
                        {slopePct.toFixed(1)}%
                    </strong>
                </div>
            </div>
        );
    }

    return null;
}
