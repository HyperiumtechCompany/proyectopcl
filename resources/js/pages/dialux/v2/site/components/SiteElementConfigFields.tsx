import { openFenceEnds } from '../domain/fenceGaps';
import { FENCE_MODEL, fenceThicknessM } from '../domain/fenceModel';
import {
    DEFAULT_BOOTH,
    ENTRANCE_PRESETS,
    entrancePreset,
    gateEntrance,
    gateSpanM,
    isSpanGate,
    type EntrancePresetId,
} from '../domain/gateLayout';
import {
    elementBox,
    fitRampToElement,
    polygonForLayout,
    stairRunDirection,
    type LayoutFit,
} from '../domain/layoutFit';
import {
    applyAutoLinkToRamp,
    applyAutoLinkToStair,
    autoLinkLevels,
    autoLinkStairFromPolygon,
    naturalFootprint,
} from '../domain/levelAuto';
import {
    checkLevelLink,
    shiftToReachArrival,
    suggestCotasFromPlatforms,
    type LevelLinkReport,
} from '../domain/levelLink';
import { platformCotasUnder, stairAsRampConfig } from '../domain/rampLayout';
import {
    evaluatePlatformRetention,
    evaluateRamp,
    evaluateStair,
    planStairFlights,
    rampMaxSlopePct,
    STAIR_NORM,
    stairStepCount,
    planRampFlights,
    platformRetentionDropM,
    RAMP_NORM,
    RETAINING_NORM,
    type NormFinding,
} from '../domain/siteNorms';
import {
    normalizeTgOutputs,
    resizeTgOutputs,
    tgFootprintVertices,
} from '../domain/tgPanel';
import type {
    AtsConfig,
    CableVaultConfig,
    CanopyConfig,
    CanopyLights,
    SidewalkConfig,
    SidewalkMaterial,
    CourtConfig,
    CourtSport,
    EarthPitConfig,
    GeneratorConfig,
    GreenAreaConfig,
    MtCellArrivalConfig,
    MtCellProtectionConfig,
    MtCellTransformationConfig,
    RoofKind,
    TreeConfig,
    TreeSpecies,
    FenceConfig,
    GateConfig,
    GateVariant,
    OutletConfig,
    PoleConfig,
    PullBoxConfig,
    RampConfig,
    RampFlight,
    SiteElement,
    SiteElementConfig,
    StairConfig,
    SubPanelConfig,
    SubPanelMount,
    TerracePlatformConfig,
    TgConfig,
    TransformerConfig,
} from '../domain/types';
import type { UseSiteEditorReturn } from '../hooks/useSiteEditor';
import { defaultConfigFor, SUB_PANEL_MOUNT_STYLE } from '../lib/siteDefaults';
import { LightProductSelect } from './LightProductSelect';
import { PoleLuminairePanel } from './PoleLuminairePanel';
import { useSitePaletteStore } from './SitePalette';

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

function Choice<T extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: T;
    options: { value: T; label: string }[];
    onChange: (v: T) => void;
}) {
    return (
        <label className={field}>
            {label}
            <select
                className={input}
                value={value}
                onChange={(e) => onChange(e.target.value as T)}
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

const ROOF_OPTIONS: { value: RoofKind; label: string }[] = [
    { value: 'flat', label: 'Plana' },
    { value: 'gable', label: 'A dos aguas' },
    { value: 'arched', label: 'En arco (tipo arcotecho)' },
];

const SPORT_OPTIONS: { value: CourtSport; label: string }[] = [
    { value: 'multi', label: 'Multiuso (básquet + vóley + fútbol sala)' },
    { value: 'futsal', label: 'Fútbol sala / losa' },
    { value: 'basketball', label: 'Básquet' },
    { value: 'volleyball', label: 'Vóley' },
    { value: 'none', label: 'Solo losa (sin marcas)' },
];

const SPECIES_OPTIONS: { value: TreeSpecies; label: string }[] = [
    { value: 'broadleaf', label: 'Frondoso' },
    { value: 'palm', label: 'Palmera' },
    { value: 'conifer', label: 'Conífera' },
];

const FLIGHT_DIRECTIONS: { value: RampFlight['direction']; label: string }[] = [
    { value: 'north', label: 'Norte' },
    { value: 'south', label: 'Sur' },
    { value: 'east', label: 'Este' },
    { value: 'west', label: 'Oeste' },
];

let flightCounter = 0;
function newFlightId(): string {
    flightCounter += 1;
    return `flight-${Date.now()}-${flightCounter}`;
}

/** Resultado del ajuste del layout al espacio dibujado + interruptor para respetar las medidas a mano. */
function FitNotes({
    fit,
    enabled,
    onToggle,
}: {
    fit: LayoutFit;
    enabled: boolean;
    onToggle: (on: boolean) => void;
}) {
    const overflow = Math.max(fit.overflowXM, fit.overflowZM);
    return (
        <div className="grid gap-1 rounded-md border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5">
            <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => onToggle(e.target.checked)}
                />
                Ajustar al espacio dibujado
            </label>
            <p className="text-[10px] text-slate-500">
                Espacio disponible: {fit.boxWidthM.toFixed(1)} ×{' '}
                {fit.boxDepthM.toFixed(1)} m.
                {enabled &&
                    fit.changed &&
                    !overflow &&
                    ' Los tramos y el ancho se ajustaron para que quepan (las cotas no cambian: la pendiente puede subir, revisa la referencia normativa).'}
            </p>
            {enabled && overflow > 0 && (
                <p className="text-[10px] text-amber-700 dark:text-amber-400">
                    ⚠ Aun ajustada, sobresale {overflow.toFixed(1)} m del
                    espacio: agranda el polígono o reduce los tramos/descansos.
                </p>
            )}
        </div>
    );
}

/** ¿La rampa/escalera une de verdad dos niveles y respeta a sus vecinos? */
function LevelLinkNotes({
    report,
    onSuggestCotas,
    onReachArrival,
    onAutoLink,
    onFitPolygon,
    autoLinkAvailable = true,
    overflows = false,
}: {
    report: LevelLinkReport | null;
    /** Deduce cotas y sentido por las plataformas de cada extremo. */
    onAutoLink?: () => void;
    autoLinkAvailable?: boolean;
    /** Agranda/ajusta el polígono al recorrido natural. */
    onFitPolygon?: () => void;
    overflows?: boolean;
    /** Aplica las cotas de las plataformas vecinas de INICIO y FIN. */
    onSuggestCotas?: () => void;
    /** Desplaza el objeto para que el FIN toque la plataforma de llegada. */
    onReachArrival?: () => void;
}) {
    if (!report) return null;
    const rows = [report.start, report.end];
    return (
        <div className="grid gap-1 rounded-md border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5">
            <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                Conexión entre niveles
            </p>
            {rows.map((row) => (
                <p
                    key={row.role}
                    className={`text-[10px] ${row.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}
                >
                    {row.ok ? '✔ ' : '⚠ '}
                    {row.message}
                </p>
            ))}
            <div className="flex flex-wrap gap-1 pt-0.5">
                {onAutoLink && (
                    <button
                        type="button"
                        onClick={onAutoLink}
                        disabled={!autoLinkAvailable}
                        title={
                            autoLinkAvailable
                                ? 'Toma la plataforma más baja que toca un extremo como origen y la más alta que toca el otro como destino (con el sentido correcto).'
                                : 'Ningún extremo toca una plataforma, o ambos tocan la misma cota: acerca o extiende el trazo hasta las dos plataformas.'
                        }
                        className="rounded-md border border-emerald-500 px-2 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                    >
                        Conectar niveles automáticamente
                    </button>
                )}
                {onFitPolygon && overflows && (
                    <button
                        type="button"
                        onClick={onFitPolygon}
                        title="Reemplaza el trazo por un rectángulo del tamaño del recorrido natural, centrado donde está."
                        className="rounded-md border border-cyan-500 px-2 py-1 text-[10px] font-semibold text-cyan-700 hover:bg-cyan-50 dark:text-cyan-300 dark:hover:bg-cyan-950/30"
                    >
                        Ajustar el polígono al recorrido
                    </button>
                )}
            </div>
            {!report.start.ok || !report.end.ok ? (
                <div className="flex flex-wrap gap-1 pt-0.5">
                    {onSuggestCotas && (
                        <button
                            type="button"
                            onClick={onSuggestCotas}
                            className="rounded-md border border-cyan-500 px-2 py-1 text-[10px] font-semibold text-cyan-700 hover:bg-cyan-50 dark:text-cyan-300 dark:hover:bg-cyan-950/30"
                        >
                            Tomar cotas de las plataformas vecinas
                        </button>
                    )}
                    {onReachArrival && (
                        <button
                            type="button"
                            onClick={onReachArrival}
                            className="rounded-md border border-cyan-500 px-2 py-1 text-[10px] font-semibold text-cyan-700 hover:bg-cyan-50 dark:text-cyan-300 dark:hover:bg-cyan-950/30"
                        >
                            Acercar el FIN a la plataforma de llegada
                        </button>
                    )}
                </div>
            ) : null}
            {report.overlaps.length > 0 && (
                <p className="text-[10px] text-rose-700 dark:text-rose-400">
                    ⚠ Invade el espacio de:{' '}
                    {report.overlaps.map((o) => o.label).join(', ')}.
                </p>
            )}
            {report.obstacles.length > 0 && (
                <p className="text-[10px] text-rose-700 dark:text-rose-400">
                    ⚠ Hay obstáculos dentro del recorrido:{' '}
                    {report.obstacles.map((o) => o.label).join(', ')}.
                </p>
            )}
        </div>
    );
}

/** Observaciones contra valores de REFERENCIA normativa — nunca dice "cumple": los valores no están confirmados por un especialista. */
function NormNotes({
    title,
    findings,
    source,
}: {
    title: string;
    findings: NormFinding[];
    source: string;
}) {
    return (
        <div className="grid gap-1 rounded-md border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5">
            <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                {title}
            </p>
            {findings.map((finding, index) => (
                <p
                    key={index}
                    className={`text-[10px] ${
                        finding.level === 'review'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-slate-500'
                    }`}
                >
                    {finding.level === 'review' ? '⚠ Revisar: ' : ''}
                    {finding.text}
                </p>
            ))}
            <p className="text-[9px] text-slate-400">
                Fuente: {source}. Valor de referencia no confirmado por
                especialista — no sustituye la firma del ingeniero responsable.
            </p>
        </div>
    );
}

const GATE_VARIANTS: { value: GateVariant; label: string }[] = [
    { value: 'open', label: 'Paso libre (sin hoja)' },
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
                    label="Altura del portón (m) — vacía = la del cerco"
                    value={g.heightM ?? element.heightM ?? 2.2}
                    step={0.1}
                    min={0.5}
                    onChange={(heightM) =>
                        set({ ...g, heightM: Math.max(0.5, heightM) })
                    }
                />
                {g.heightM !== undefined && (
                    <button
                        type="button"
                        onClick={() => set({ ...g, heightM: undefined })}
                        className="text-left text-[10px] font-semibold text-cyan-700 hover:underline dark:text-cyan-300"
                    >
                        Usar la altura del cerco asociado
                    </button>
                )}
                {isSpanGate(element) ? (
                    <p className="text-[11px] text-slate-500">
                        Vano trazado:{' '}
                        <strong>
                            {gateSpanM(element, editor.terrainScaleM).toFixed(
                                2,
                            )}{' '}
                            m
                        </strong>{' '}
                        (arrastra sus extremos en el plano; el cerco se abre
                        solo, esté abierto o cerrado).
                    </p>
                ) : (
                    <Num
                        label="Ancho (m)"
                        value={g.widthM}
                        min={0}
                        onChange={(widthM) => set({ ...g, widthM })}
                    />
                )}
                {isSpanGate(element) && (
                    <label className={field}>
                        Tipo de ingreso (punto de partida)
                        <select
                            className={input}
                            value=""
                            onChange={(e) => {
                                if (!e.target.value) return;
                                set({
                                    ...g,
                                    ...entrancePreset(
                                        e.target.value as EntrancePresetId,
                                    ),
                                });
                            }}
                        >
                            <option value="">Aplicar una plantilla…</option>
                            {ENTRANCE_PRESETS.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.label}
                                </option>
                            ))}
                        </select>
                        <span className="mt-0.5 block text-[10px] text-slate-400">
                            Solo cambia las partes que definen el tipo; después
                            ajusta cada una (zona, puesto, muros, cubierta,
                            luminarias) a tu proyecto.
                        </span>
                    </label>
                )}
                {isSpanGate(element) && (
                    <div className="grid gap-2 rounded-md bg-slate-50 p-2 dark:bg-white/5">
                        <p className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                            Partes del ingreso
                        </p>
                        {(() => {
                            const e = gateEntrance(g);
                            return (
                                <>
                                    <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={e.sideWalls.enabled}
                                            onChange={(ev) =>
                                                set({
                                                    ...g,
                                                    sideWalls: {
                                                        ...e.sideWalls,
                                                        enabled:
                                                            ev.target.checked,
                                                    },
                                                })
                                            }
                                        />
                                        Muros a ambos lados del paso
                                    </label>
                                    {e.sideWalls.enabled && (
                                        <div className="grid grid-cols-3 gap-1">
                                            <Num
                                                label="Largo (m)"
                                                value={e.sideWalls.depthM}
                                                min={0.5}
                                                onChange={(depthM) =>
                                                    set({
                                                        ...g,
                                                        sideWalls: {
                                                            ...e.sideWalls,
                                                            depthM: Math.max(
                                                                0.5,
                                                                depthM,
                                                            ),
                                                        },
                                                    })
                                                }
                                            />
                                            <Num
                                                label="Altura (m)"
                                                value={e.sideWalls.heightM}
                                                min={1}
                                                onChange={(heightM) =>
                                                    set({
                                                        ...g,
                                                        sideWalls: {
                                                            ...e.sideWalls,
                                                            heightM: Math.max(
                                                                1,
                                                                heightM,
                                                            ),
                                                        },
                                                    })
                                                }
                                            />
                                            <Num
                                                label="Espesor (m)"
                                                value={e.sideWalls.thicknessM}
                                                min={0.1}
                                                step={0.05}
                                                onChange={(thicknessM) =>
                                                    set({
                                                        ...g,
                                                        sideWalls: {
                                                            ...e.sideWalls,
                                                            thicknessM:
                                                                Math.max(
                                                                    0.1,
                                                                    thicknessM,
                                                                ),
                                                        },
                                                    })
                                                }
                                            />
                                        </div>
                                    )}
                                    <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={e.canopy.enabled}
                                            onChange={(ev) =>
                                                set({
                                                    ...g,
                                                    canopy: {
                                                        ...e.canopy,
                                                        enabled:
                                                            ev.target.checked,
                                                    },
                                                })
                                            }
                                        />
                                        Cubierta sobre el ingreso
                                    </label>
                                    {e.canopy.enabled && (
                                        <div className="grid grid-cols-2 gap-1">
                                            <Choice
                                                label="Forma"
                                                value={e.canopy.roof}
                                                options={[
                                                    {
                                                        value: 'mono',
                                                        label: 'Un agua',
                                                    },
                                                    {
                                                        value: 'gable',
                                                        label: 'Dos aguas',
                                                    },
                                                    {
                                                        value: 'flat',
                                                        label: 'Plana (losa)',
                                                    },
                                                ]}
                                                onChange={(roof) =>
                                                    set({
                                                        ...g,
                                                        canopy: {
                                                            ...e.canopy,
                                                            roof,
                                                        },
                                                    })
                                                }
                                            />
                                            <Choice
                                                label="Material"
                                                value={e.canopy.material}
                                                options={[
                                                    {
                                                        value: 'tile',
                                                        label: 'Teja',
                                                    },
                                                    {
                                                        value: 'concrete',
                                                        label: 'Losa de concreto',
                                                    },
                                                    {
                                                        value: 'metal',
                                                        label: 'Calamina / metálica',
                                                    },
                                                    {
                                                        value: 'polycarbonate',
                                                        label: 'Policarbonato',
                                                    },
                                                ]}
                                                onChange={(material) =>
                                                    set({
                                                        ...g,
                                                        canopy: {
                                                            ...e.canopy,
                                                            material,
                                                        },
                                                    })
                                                }
                                            />
                                            <Num
                                                label="Fondo (m)"
                                                value={e.canopy.depthM}
                                                min={1}
                                                onChange={(depthM) =>
                                                    set({
                                                        ...g,
                                                        canopy: {
                                                            ...e.canopy,
                                                            depthM: Math.max(
                                                                1,
                                                                depthM,
                                                            ),
                                                        },
                                                    })
                                                }
                                            />
                                            <Num
                                                label="Altura alero (m)"
                                                value={e.canopy.heightM}
                                                min={2}
                                                onChange={(heightM) =>
                                                    set({
                                                        ...g,
                                                        canopy: {
                                                            ...e.canopy,
                                                            heightM: Math.max(
                                                                2,
                                                                heightM,
                                                            ),
                                                        },
                                                    })
                                                }
                                            />
                                            <Num
                                                label="Desnivel del techo (m)"
                                                value={e.canopy.riseM}
                                                min={0}
                                                onChange={(riseM) =>
                                                    set({
                                                        ...g,
                                                        canopy: {
                                                            ...e.canopy,
                                                            riseM: Math.max(
                                                                0,
                                                                riseM,
                                                            ),
                                                        },
                                                    })
                                                }
                                            />
                                            <Num
                                                label="Vuelo lateral (m)"
                                                value={e.canopy.overhangM}
                                                min={0}
                                                onChange={(overhangM) =>
                                                    set({
                                                        ...g,
                                                        canopy: {
                                                            ...e.canopy,
                                                            overhangM: Math.max(
                                                                0,
                                                                overhangM,
                                                            ),
                                                        },
                                                    })
                                                }
                                            />
                                        </div>
                                    )}
                                    <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={e.lights.enabled}
                                            onChange={(ev) =>
                                                set({
                                                    ...g,
                                                    lights: {
                                                        ...e.lights,
                                                        enabled:
                                                            ev.target.checked,
                                                    },
                                                })
                                            }
                                        />
                                        Luminarias del ingreso
                                    </label>
                                    {e.lights.enabled && (
                                        <div className="grid grid-cols-2 gap-1">
                                            <Num
                                                label="Cantidad"
                                                value={e.lights.count}
                                                step={1}
                                                min={1}
                                                onChange={(count) =>
                                                    set({
                                                        ...g,
                                                        lights: {
                                                            ...e.lights,
                                                            count: Math.max(
                                                                1,
                                                                Math.round(
                                                                    count,
                                                                ),
                                                            ),
                                                        },
                                                    })
                                                }
                                            />
                                            <Num
                                                label="Altura (m)"
                                                value={e.lights.heightM}
                                                min={1}
                                                onChange={(heightM) =>
                                                    set({
                                                        ...g,
                                                        lights: {
                                                            ...e.lights,
                                                            heightM: Math.max(
                                                                1,
                                                                heightM,
                                                            ),
                                                        },
                                                    })
                                                }
                                            />
                                            <Num
                                                label="Flujo c/u (lm)"
                                                value={e.lights.lumens}
                                                step={100}
                                                min={100}
                                                onChange={(lumens) =>
                                                    set({
                                                        ...g,
                                                        lights: {
                                                            ...e.lights,
                                                            lumens: Math.max(
                                                                100,
                                                                lumens,
                                                            ),
                                                        },
                                                    })
                                                }
                                            />
                                            <Num
                                                label="Potencia c/u (W)"
                                                value={e.lights.wattage}
                                                step={1}
                                                min={1}
                                                onChange={(wattage) =>
                                                    set({
                                                        ...g,
                                                        lights: {
                                                            ...e.lights,
                                                            wattage: Math.max(
                                                                1,
                                                                wattage,
                                                            ),
                                                        },
                                                    })
                                                }
                                            />
                                            <LightProductSelect
                                                productId={e.lights.productId}
                                                onChange={(patch) =>
                                                    set({
                                                        ...g,
                                                        lights: {
                                                            ...e.lights,
                                                            ...patch,
                                                        },
                                                    })
                                                }
                                            />
                                        </div>
                                    )}
                                    {e.lights.enabled && (
                                        <p className="text-[10px] text-slate-400">
                                            Entran al alumbrado exterior (Modo
                                            Noche, mapa de lux y carga del
                                            tablero "Alumbrado exterior").
                                        </p>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                )}
                {isSpanGate(element) && (
                    <div className="grid gap-2 rounded-md bg-slate-50 p-2 dark:bg-white/5">
                        <Num
                            label="Zona de acceso hacia adentro (m, 0 = sin zona)"
                            value={g.accessDepthM ?? 0}
                            min={0}
                            step={0.5}
                            onChange={(accessDepthM) =>
                                set({
                                    ...g,
                                    accessDepthM: Math.max(0, accessDepthM),
                                })
                            }
                        />
                        <label className={field}>
                            Lado interior del predio
                            <select
                                className={input}
                                value={g.inwardSide ?? 'left'}
                                onChange={(e) =>
                                    set({
                                        ...g,
                                        inwardSide: e.target.value as
                                            'left' | 'right',
                                    })
                                }
                            >
                                <option value="left">Izquierda (a→b)</option>
                                <option value="right">Derecha (a→b)</option>
                            </select>
                        </label>
                        <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                            <input
                                type="checkbox"
                                checked={g.booth?.enabled ?? false}
                                onChange={(e) =>
                                    set({
                                        ...g,
                                        booth: {
                                            ...DEFAULT_BOOTH,
                                            ...(g.booth ?? {}),
                                            enabled: e.target.checked,
                                        },
                                    })
                                }
                            />
                            Puesto de ingreso (caseta de control)
                        </label>
                        {g.booth?.enabled && (
                            <div className="grid grid-cols-2 gap-1">
                                <Num
                                    label="Largo (m)"
                                    value={g.booth.widthM}
                                    min={1}
                                    onChange={(widthM) =>
                                        set({
                                            ...g,
                                            booth: {
                                                ...g.booth!,
                                                widthM: Math.max(1, widthM),
                                            },
                                        })
                                    }
                                />
                                <Num
                                    label="Fondo (m)"
                                    value={g.booth.depthM}
                                    min={1}
                                    onChange={(depthM) =>
                                        set({
                                            ...g,
                                            booth: {
                                                ...g.booth!,
                                                depthM: Math.max(1, depthM),
                                            },
                                        })
                                    }
                                />
                                <Num
                                    label="Altura (m)"
                                    value={g.booth.heightM}
                                    min={2}
                                    onChange={(heightM) =>
                                        set({
                                            ...g,
                                            booth: {
                                                ...g.booth!,
                                                heightM: Math.max(2, heightM),
                                            },
                                        })
                                    }
                                />
                                <Num
                                    label="Separación del vano (m)"
                                    value={g.booth.gapM}
                                    min={0}
                                    onChange={(gapM) =>
                                        set({
                                            ...g,
                                            booth: {
                                                ...g.booth!,
                                                gapM: Math.max(0, gapM),
                                            },
                                        })
                                    }
                                />
                                <Num
                                    label="Retranqueo del cerco (m)"
                                    value={g.booth.setbackM}
                                    min={0}
                                    onChange={(setbackM) =>
                                        set({
                                            ...g,
                                            booth: {
                                                ...g.booth!,
                                                setbackM: Math.max(0, setbackM),
                                            },
                                        })
                                    }
                                />
                                <label className={field}>
                                    Junto al extremo
                                    <select
                                        className={input}
                                        value={g.booth.end}
                                        onChange={(e) =>
                                            set({
                                                ...g,
                                                booth: {
                                                    ...g.booth!,
                                                    end: e.target.value as
                                                        'a' | 'b',
                                                },
                                            })
                                        }
                                    >
                                        <option value="a">
                                            Primer punto (a)
                                        </option>
                                        <option value="b">
                                            Segundo punto (b)
                                        </option>
                                    </select>
                                </label>
                            </div>
                        )}
                    </div>
                )}
                <label className={field}>
                    Cerco asociado
                    <select
                        className={input}
                        value={g.fenceId ?? ''}
                        onChange={(e) =>
                            set({
                                ...g,
                                fenceId: e.target.value || undefined,
                            })
                        }
                    >
                        <option value="">Automático (cerco más cercano)</option>
                        <option value="none">Ninguno (posición propia)</option>
                        {(editor.siteData?.elements ?? [])
                            .filter((el) => el.type === 'fence')
                            .map((el) => (
                                <option key={el.id} value={el.id}>
                                    {el.label}
                                </option>
                            ))}
                    </select>
                    <span className="mt-0.5 block text-[10px] text-slate-400">
                        En 3D, el portón se pega sobre la línea del cerco (a
                        menos de 3 m si es automático), con su misma altura y
                        cota, y el cerco deja libre el ingreso. El dibujo 2D no
                        cambia.
                    </span>
                </label>
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
                <PoleLuminairePanel
                    config={p}
                    onPatch={(patch) => set({ ...p, ...patch })}
                />
            </div>
        );
    }

    if (cfg.kind === 'outlet') {
        const o = cfg as OutletConfig;
        return (
            <div className="grid gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                <Num
                    label="Altura de montaje (m)"
                    value={o.heightM}
                    step={0.05}
                    min={0.1}
                    onChange={(heightM) =>
                        set({ ...o, heightM: Math.max(0.1, heightM) })
                    }
                />
                <Num
                    label="Potencia para CT (W)"
                    value={o.powerW ?? 180}
                    step={10}
                    min={0}
                    onChange={(powerW) =>
                        set({ ...o, powerW: Math.max(0, powerW) })
                    }
                />
                <label className={field}>
                    Etiqueta de circuito (informativa)
                    <input
                        type="text"
                        className={input}
                        placeholder="TC-01"
                        value={o.circuitLabel ?? ''}
                        onChange={(e) =>
                            set({
                                ...o,
                                circuitLabel: e.target.value || undefined,
                            })
                        }
                    />
                </label>
                <p className="text-[10px] text-slate-400">
                    Tomacorriente exterior IP65. Altura y tipo no tienen fuente
                    normativa cargada — solo modelado. Sin potencia definida, la
                    Tabla CT usa 180 W de referencia (no normativo). Para cablearlo, usa
                    "Cablear (instalaciones)" en la paleta.
                </p>
            </div>
        );
    }

    if (cfg.kind === 'sub_panel') {
        const sp = cfg as SubPanelConfig;
        const MOUNT_OPTIONS: { value: SubPanelMount; label: string }[] = [
            {
                value: 'molded_case',
                label: 'Caja moldeada — Tablero de distribución (rojo)',
            },
            {
                value: 'din_rail',
                label: 'Riel DIN — Sub tablero de distribución (magenta)',
            },
            { value: 'stabilized', label: 'Estabilizado (amarillo)' },
            { value: 'pump_control', label: 'Control de bombas (celeste)' },
            { value: 'freestanding', label: 'Autosoportado' },
            { value: 'surface', label: 'Adosado' },
        ];
        return (
            <div className="grid gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                <Choice
                    label="Montaje"
                    value={sp.mount}
                    options={MOUNT_OPTIONS}
                    onChange={(mount) =>
                        editor.updateSiteElement(element.id, {
                            config: { ...sp, mount },
                            // Cada montaje tiene su propio color de leyenda
                            // real del cliente — se aplica solo, no hay que
                            // recolorear a mano.
                            style:
                                SUB_PANEL_MOUNT_STYLE[mount] ?? element.style,
                        })
                    }
                />
                <div className="grid grid-cols-3 gap-1">
                    <Num
                        label="Ancho"
                        value={sp.widthM}
                        min={0.1}
                        onChange={(widthM) => set({ ...sp, widthM })}
                    />
                    <Num
                        label="Fondo"
                        value={sp.depthM}
                        min={0.05}
                        onChange={(depthM) => set({ ...sp, depthM })}
                    />
                    <Num
                        label="Alto"
                        value={sp.heightM}
                        min={0.1}
                        onChange={(heightM) => set({ ...sp, heightM })}
                    />
                </div>
                <p className="text-[10px] text-slate-400">
                    Sub tablero de distribución (TD) — objeto propio del
                    emplazamiento, no comparte datos con el "sub_panel" del
                    editor de interiores. Wireable con "Cablear" en la paleta.
                </p>
            </div>
        );
    }

    if (cfg.kind === 'ats') {
        const a = cfg as AtsConfig;
        return (
            <div className="grid gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                <div className="grid grid-cols-3 gap-1">
                    <Num
                        label="Ancho"
                        value={a.widthM}
                        min={0.1}
                        onChange={(widthM) => set({ ...a, widthM })}
                    />
                    <Num
                        label="Fondo"
                        value={a.depthM}
                        min={0.05}
                        onChange={(depthM) => set({ ...a, depthM })}
                    />
                    <Num
                        label="Alto"
                        value={a.heightM}
                        min={0.1}
                        onChange={(heightM) => set({ ...a, heightM })}
                    />
                </div>
                <p className="text-[10px] text-slate-400">
                    Tablero de transferencia automática (ATS). Color naranja,
                    igual que la leyenda real del cliente.
                </p>
            </div>
        );
    }

    if (cfg.kind === 'generator') {
        const g = cfg as GeneratorConfig;
        return (
            <div className="grid gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                <Num
                    label="Potencia (kVA)"
                    value={g.kva ?? 0}
                    step={10}
                    min={0}
                    onChange={(kva) => set({ ...g, kva: kva || undefined })}
                />
                <div className="grid grid-cols-3 gap-1">
                    <Num
                        label="Ancho"
                        value={g.widthM}
                        min={0.5}
                        onChange={(widthM) => set({ ...g, widthM })}
                    />
                    <Num
                        label="Fondo"
                        value={g.depthM}
                        min={0.5}
                        onChange={(depthM) => set({ ...g, depthM })}
                    />
                    <Num
                        label="Alto"
                        value={g.heightM}
                        min={0.5}
                        onChange={(heightM) => set({ ...g, heightM })}
                    />
                </div>
                <p className="text-[10px] text-slate-400">
                    Grupo electrógeno (GE) en cabina insonorizada. Color morado,
                    igual que la leyenda real del cliente.
                </p>
            </div>
        );
    }

    if (cfg.kind === 'earth_pit') {
        const e = cfg as EarthPitConfig;
        return (
            <div className="grid gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                <label className={field}>
                    Etiqueta del pozo
                    <input
                        type="text"
                        className={input}
                        placeholder="PAT-01"
                        value={e.label ?? ''}
                        onChange={(ev) =>
                            set({ ...e, label: ev.target.value || undefined })
                        }
                    />
                </label>
                <p className="text-[10px] text-slate-400">
                    Pozo de puesta a tierra (PAT). Mismo color/símbolo que v1
                    (círculo amarillo). Profundidad y resistencia de puesta a
                    tierra son datos de obra/medición, no del modelo 3D.
                </p>
            </div>
        );
    }

    if (
        cfg.kind === 'mt_cell_arrival' ||
        cfg.kind === 'mt_cell_protection' ||
        cfg.kind === 'mt_cell_transformation'
    ) {
        const c = cfg as
            | MtCellArrivalConfig
            | MtCellProtectionConfig
            | MtCellTransformationConfig;
        const titles: Record<typeof c.kind, string> = {
            mt_cell_arrival: 'Celda de llegada (CMP-V + CMR remonte)',
            mt_cell_protection: 'Celda de protección (CMP-F + CMR remonte)',
            mt_cell_transformation: 'Celda de transformación',
        };
        return (
            <div className="grid gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {titles[c.kind]}
                </p>
                <div className="grid grid-cols-3 gap-1">
                    <Num
                        label="Ancho"
                        value={c.widthM}
                        min={0.3}
                        onChange={(widthM) => set({ ...c, widthM })}
                    />
                    <Num
                        label="Fondo"
                        value={c.depthM}
                        min={0.3}
                        onChange={(depthM) => set({ ...c, depthM })}
                    />
                    <Num
                        label="Alto"
                        value={c.heightM}
                        min={1}
                        onChange={(heightM) => set({ ...c, heightM })}
                    />
                </div>
                <p className="text-[10px] text-slate-400">
                    Dimensiones por defecto = el bloque CAD real del cliente
                    (celdas de llegada/protección 1.05 × 0.85 m; celda de
                    transformación 1.5 × 1.05 m). Colócalas en fila para calcar
                    el plano exacto de la cámara de media tensión.
                </p>
            </div>
        );
    }

    if (cfg.kind === 'cable_vault') {
        const v = cfg as CableVaultConfig;
        return (
            <div className="grid gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                <div className="grid grid-cols-3 gap-1">
                    <Num
                        label="Ancho"
                        value={v.widthM}
                        min={0.1}
                        onChange={(widthM) => set({ ...v, widthM })}
                    />
                    <Num
                        label="Fondo"
                        value={v.depthM}
                        min={0.1}
                        onChange={(depthM) => set({ ...v, depthM })}
                    />
                    <Num
                        label="Alto"
                        value={v.heightM}
                        min={0.1}
                        onChange={(heightM) => set({ ...v, heightM })}
                    />
                </div>
                <label className={field}>
                    Etiqueta (ej. "BZ-01")
                    <input
                        type="text"
                        className={input}
                        placeholder="BZ-01"
                        value={v.label ?? ''}
                        onChange={(e) =>
                            set({ ...v, label: e.target.value || undefined })
                        }
                    />
                </label>
                <p className="text-[10px] text-slate-400">
                    Buzón de C.A. de registro y derivación del alimentador
                    (650×650×950 mm real). Distinto de las cajas de paso
                    pequeñas que se autogeneran a mitad de tramo en un cableado
                    subterráneo — este se coloca a mano donde el plano real lo
                    marca. Wireable con "Cablear" en la paleta.
                </p>
            </div>
        );
    }

    if (cfg.kind === 'pull_box') {
        const p = cfg as PullBoxConfig;
        return (
            <div className="grid gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                <div className="grid grid-cols-3 gap-1">
                    <Num
                        label="Ancho"
                        value={p.widthM}
                        min={0.05}
                        onChange={(widthM) => set({ ...p, widthM })}
                    />
                    <Num
                        label="Fondo"
                        value={p.depthM}
                        min={0.05}
                        onChange={(depthM) => set({ ...p, depthM })}
                    />
                    <Num
                        label="Alto"
                        value={p.heightM}
                        min={0.02}
                        onChange={(heightM) => set({ ...p, heightM })}
                    />
                </div>
                <p className="text-[10px] text-slate-400">
                    Caja de pase (100×100×50 mm real) para cambios de dirección
                    en zanja. Wireable con "Cablear" en la paleta.
                </p>
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
                        <option value="cells">
                            Celdas MT (llegada + protección + transformación)
                        </option>
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
                        label={t.mount === 'cells' ? 'Ancho total' : 'Ancho'}
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
                {t.mount === 'cells' && (
                    <p className="text-[10px] text-slate-400">
                        Subestación compacta de 3 celdas en línea (referencia:
                        plano del cliente con TRAFOMIX 3Ø). El ancho total se
                        reparte en partes iguales entre las 3 celdas.
                    </p>
                )}
            </div>
        );
    }

    if (cfg.kind === 'tg') {
        const t = cfg as TgConfig;
        const outputs = normalizeTgOutputs(t.outputs);
        const center = element.vertices.reduce(
            (sum, point) => ({
                x: sum.x + point.x / element.vertices.length,
                y: sum.y + point.y / element.vertices.length,
            }),
            { x: 0, y: 0 },
        );
        const setDimensions = (patch: Partial<TgConfig>) => {
            const config = { ...t, ...patch };
            editor.updateSiteElement(element.id, {
                config,
                vertices: tgFootprintVertices(
                    center,
                    config,
                    editor.terrainScaleM,
                    element.rotation ?? 0,
                ),
            });
        };
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
                        min={0.3}
                        onChange={(widthM) => setDimensions({ widthM })}
                    />
                    <Num
                        label="Fondo"
                        value={t.depthM}
                        min={0.15}
                        onChange={(depthM) => setDimensions({ depthM })}
                    />
                    <Num
                        label="Alto"
                        value={t.heightM}
                        min={0.6}
                        onChange={(heightM) => setDimensions({ heightM })}
                    />
                </div>
                <p className="text-[10px] leading-relaxed text-slate-400">
                    Dimensiones físicas del gabinete: ancho × fondo × alto. El
                    valor inicial es 1.20 × 0.40 × 2.00 m. La EM.010 remite al
                    CNE–Utilización: el tamaño final depende del fabricante y
                    del proyecto; el espacio de operación y mantenimiento debe
                    quedar libre alrededor del tablero. Cuando existan partes
                    vivas expuestas, la altura libre mínima del espacio de
                    trabajo es 2.20 m (Regla 020-308).
                </p>
                <label className={field}>
                    Cantidad de salidas
                    <input
                        type="number"
                        min={1}
                        max={24}
                        step={1}
                        className={input}
                        value={outputs.length}
                        onChange={(event) =>
                            set({
                                ...t,
                                outputs: resizeTgOutputs(
                                    outputs,
                                    Number(event.target.value),
                                ),
                            })
                        }
                    />
                </label>
                <div className="grid gap-1.5">
                    <p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                        Identificación de salidas
                    </p>
                    {outputs.map((output, index) => (
                        <div
                            key={output.id}
                            className="grid grid-cols-[2.25rem_1fr] gap-1"
                        >
                            <input
                                type="color"
                                aria-label={`Color de salida ${index + 1}`}
                                className="mt-1 h-8 w-full cursor-pointer rounded-md border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900"
                                value={output.color}
                                onChange={(event) =>
                                    set({
                                        ...t,
                                        outputs: outputs.map(
                                            (item, itemIndex) =>
                                                itemIndex === index
                                                    ? {
                                                          ...item,
                                                          color: event.target
                                                              .value,
                                                      }
                                                    : item,
                                        ),
                                    })
                                }
                            />
                            <label className={field}>
                                Salida {index + 1}
                                <input
                                    type="text"
                                    className={input}
                                    value={output.label}
                                    onChange={(event) =>
                                        set({
                                            ...t,
                                            outputs: outputs.map(
                                                (item, itemIndex) =>
                                                    itemIndex === index
                                                        ? {
                                                              ...item,
                                                              label: event
                                                                  .target.value,
                                                          }
                                                        : item,
                                            ),
                                        })
                                    }
                                />
                            </label>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (cfg.kind === 'fence') {
        const f = cfg as FenceConfig;
        return (
            <div className="grid gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                <label className={field}>
                    Tipo de cerco
                    <select
                        className={input}
                        value={f.fenceKind ?? 'wall'}
                        onChange={(e) =>
                            set({
                                ...f,
                                fenceKind: e.target
                                    .value as FenceConfig['fenceKind'],
                            })
                        }
                    >
                        <option value="wall">Muro ciego</option>
                        <option value="grille">
                            Reja (zócalo + paño translúcido)
                        </option>
                    </select>
                </label>
                <label className={field}>
                    Adaptación al terreno
                    <select
                        className={input}
                        value={f.conform ?? 'stepped'}
                        onChange={(e) =>
                            set({
                                ...f,
                                conform: e.target
                                    .value as FenceConfig['conform'],
                            })
                        }
                    >
                        <option value="stepped">
                            Escalonado (paneles a nivel)
                        </option>
                        <option value="sloped">
                            Inclinado (sigue la pendiente)
                        </option>
                        <option value="flat">Plano (bloque a cota fija)</option>
                    </select>
                </label>
                <div className="grid grid-cols-2 gap-1">
                    <Num
                        label="Espesor (m)"
                        value={fenceThicknessM(f)}
                        step={0.05}
                        min={FENCE_MODEL.minThicknessM}
                        onChange={(thicknessM) =>
                            set({
                                ...f,
                                thicknessM: Math.max(
                                    FENCE_MODEL.minThicknessM,
                                    thicknessM,
                                ),
                            })
                        }
                    />
                    <Num
                        label="Largo de panel (m)"
                        value={f.panelLengthM ?? 2.5}
                        step={0.5}
                        min={0.5}
                        onChange={(panelLengthM) => set({ ...f, panelLengthM })}
                    />
                </div>
                <label className={field}>
                    Se apoya en la plataforma
                    <select
                        className={input}
                        value={f.groundPlatformId ?? ''}
                        onChange={(e) =>
                            set({
                                ...f,
                                groundPlatformId: e.target.value || undefined,
                            })
                        }
                    >
                        <option value="">
                            Automática (en el borde entre dos niveles: el de
                            abajo)
                        </option>
                        {(editor.siteData?.elements ?? [])
                            .filter((el) => el.type === 'terrace_platform')
                            .sort(
                                (p, q) =>
                                    (p.baseElevationM ?? 0) -
                                    (q.baseElevationM ?? 0),
                            )
                            .map((el) => (
                                <option key={el.id} value={el.id}>
                                    {el.label} · ▲{' '}
                                    {(el.baseElevationM ?? 0).toFixed(2)} m
                                </option>
                            ))}
                    </select>
                    <span className="mt-0.5 block text-[10px] text-slate-400">
                        Si el cerco corre justo sobre el borde de dos
                        plataformas y no debe quedar al ras de la de abajo,
                        elige aquí la de arriba.
                    </span>
                </label>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <label className="flex items-center gap-2 text-[11px] text-slate-500">
                        <input
                            type="checkbox"
                            checked={f.pilasters !== false}
                            onChange={(e) =>
                                set({ ...f, pilasters: e.target.checked })
                            }
                        />
                        Pilastras en juntas y esquinas (sellan los cambios de
                        nivel)
                    </label>
                    <label className="flex items-center gap-2 text-[11px] text-slate-500">
                        <input
                            type="checkbox"
                            checked={f.cap !== false}
                            onChange={(e) =>
                                set({ ...f, cap: e.target.checked })
                            }
                        />
                        Viga de coronación
                    </label>
                </div>
                <p className="text-[10px] text-slate-400">
                    Espesor mínimo {FENCE_MODEL.minThicknessM.toFixed(2)} m: es
                    el "mínimo operativo" de la app para muro de ladrillo, no
                    una exigencia de RNE E.070 ni de la municipalidad (sin
                    fuente cargada). El espesor real y la altura los fija el
                    proyecto estructural y la ordenanza.
                </p>
                <label className="flex items-center gap-2 text-[11px] text-slate-500">
                    <input
                        type="checkbox"
                        checked={f.closed ?? true}
                        onChange={(e) =>
                            set({ ...f, closed: e.target.checked })
                        }
                    />
                    Perímetro cerrado (el último punto vuelve al primero)
                </label>
                {(() => {
                    const issues = openFenceEnds(
                        element,
                        editor.siteData?.elements ?? [],
                        editor.terrainScaleM,
                    );
                    return (
                        <div className="grid gap-1 rounded-md border border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/5">
                            <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                                Cierre del cerco (por dónde se puede pasar)
                            </p>
                            {issues.length === 0 ? (
                                <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                                    ✔ Sin extremos abiertos: el cerco cierra
                                    contra sí mismo, otros cercos, portones o
                                    edificios.
                                </p>
                            ) : (
                                issues.map((issue) => (
                                    <p
                                        key={issue.end}
                                        className="text-[10px] text-amber-700 dark:text-amber-400"
                                    >
                                        ⚠ {issue.message}
                                    </p>
                                ))
                            )}
                            <p className="text-[9px] text-slate-400">
                                Comprobación geométrica (huecos ≤ 3 m se avisan
                                como rendija). No verifica altura ni tipo de
                                cerco exigidos por la norma o la municipalidad:
                                no hay fuente cargada.
                            </p>
                        </div>
                    );
                })()}
                <NormNotes
                    title="Referencia normativa · cerco"
                    source={RETAINING_NORM.source}
                    findings={[
                        {
                            level: 'info',
                            text: `Un cerco perimétrico en un terreno sin Estudio de Mecánica de Suelos exige EMS (num. 6.2.1 g); si el zócalo hace de muro de contención de más de ${RETAINING_NORM.emsRequiredAboveM.toFixed(2)} m, también. Altura máxima y tipo de cerco: los define la municipalidad/zonificación — no hay fuente cargada, por eso no se valida.`,
                        },
                    ]}
                />
                <p className="text-[10px] text-slate-400">
                    El cerco toma la cota de la plataforma bajo cada panel; la
                    altura se define en la pestaña General. La cota base solo
                    aplica en modo Plano. Los escalones ocurren entre paneles:
                    reduce el largo de panel para seguir mejor un desnivel.
                </p>
            </div>
        );
    }

    if (cfg.kind === 'ramp') {
        const r = cfg as RampConfig;
        const shape = r.shape ?? 'straight';
        const flights = r.flights ?? [];
        const runM =
            Math.hypot(
                (element.vertices[1]?.x ?? 0) - (element.vertices[0]?.x ?? 0),
                (element.vertices[1]?.y ?? 0) - (element.vertices[0]?.y ?? 0),
            ) * editor.terrainScaleM || 1;
        const slopePct =
            (Math.abs(r.toElevationM - r.fromElevationM) / runM) * 100;
        const rampFit = fitRampToElement(r, element, editor.terrainScaleM);
        const siteElements = editor.siteData?.elements ?? [];
        const rampLink = checkLevelLink(
            element,
            siteElements,
            editor.terrainScaleM,
            rampFit.config,
        );
        const rampAuto = autoLinkLevels(
            element,
            siteElements,
            editor.terrainScaleM,
            r,
        );

        const updateFlight = (index: number, patch: Partial<RampFlight>) =>
            set({
                ...r,
                flights: flights.map((f, i) =>
                    i === index ? { ...f, ...patch } : f,
                ),
            });
        // El giro se aplica DESPUÉS de un tramo: al agregar uno nuevo, el
        // que hasta ahora era el último recibe la vuelta en U (180°) y su
        // descanso — si no, el tramo nuevo quedaba acoplado en línea recta
        // delante del anterior.
        const addFlight = () => {
            const prev = flights[flights.length - 1];
            const sign = r.toElevationM < r.fromElevationM ? -1 : 1;
            const riseM = 0.6 * sign;
            const newFlight: RampFlight = {
                id: newFlightId(),
                direction: prev?.direction ?? 'north',
                lengthM: Math.round((Math.abs(riseM) / 0.08) * 100) / 100,
                riseM,
                landingLengthM: 0,
                turnAfterDeg: 0,
            };
            const head = prev
                ? [
                      ...flights.slice(0, -1),
                      {
                          ...prev,
                          turnAfterDeg: prev.turnAfterDeg || 180,
                          landingLengthM: Math.max(
                              prev.landingLengthM ?? 0,
                              RAMP_NORM.landingLengthM,
                          ),
                      },
                  ]
                : [];
            set({ ...r, flights: [...head, newFlight] });
        };
        // Cambia la subida del ÚLTIMO tramo para que los tramos sumen exactamente
        // el desnivel hasta la cota destino (la rampa termina a ras de la plataforma).
        const adjustLastFlight = () => {
            if (flights.length === 0) return;
            const before = flights
                .slice(0, -1)
                .reduce((acc, f) => acc + f.riseM, 0);
            const riseM =
                Math.round(
                    (r.toElevationM - r.fromElevationM - before) * 1000,
                ) / 1000;
            const slope = rampMaxSlopePct(riseM) ?? 8;
            const last = flights[flights.length - 1];
            set({
                ...r,
                flights: [
                    ...flights.slice(0, -1),
                    {
                        ...last,
                        riseM,
                        lengthM:
                            Math.round(
                                (Math.abs(riseM) / (slope / 100)) * 100,
                            ) / 100,
                    },
                ],
            });
        };
        // Recorre el mismo trazado al revés (INICIO ↔ FIN) sin tocar las cotas.
        const reversePath = () => set({ ...r, reversed: !r.reversed });
        const platformCotas = platformCotasUnder(
            element.vertices,
            editor.siteData?.elements ?? [],
        );
        const useCotas = () =>
            set({
                ...r,
                fromElevationM: platformCotas[0],
                toElevationM: platformCotas[platformCotas.length - 1],
            });
        const removeFlight = (index: number) =>
            set({ ...r, flights: flights.filter((_, i) => i !== index) });

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
                    onChange={(widthM) => {
                        const next: RampConfig = {
                            ...r,
                            widthM: Math.max(0.3, widthM),
                        };
                        // El polígono acompaña al ancho cuando el recorrido ya no cabe (solo crece).
                        const poly = polygonForLayout(
                            element,
                            editor.terrainScaleM,
                            next,
                        );
                        editor.updateSiteElement(element.id, {
                            config: next,
                            ...(poly ? { vertices: poly } : {}),
                        });
                    }}
                />
                <Num
                    label="Altura de baranda (m)"
                    value={r.handrailHeightM ?? RAMP_NORM.handrailHeightM}
                    step={0.05}
                    min={0.3}
                    onChange={(handrailHeightM) =>
                        set({
                            ...r,
                            handrailHeightM: Math.max(0.3, handrailHeightM),
                        })
                    }
                />
                {shape === 'straight' && flights.length > 0 && (
                    <Num
                        label="Descanso de llegada (m, 0 = sin descanso)"
                        value={r.arrivalLandingM ?? RAMP_NORM.landingLengthM}
                        step={0.1}
                        min={0}
                        onChange={(arrivalLandingM) =>
                            set({ ...r, arrivalLandingM })
                        }
                    />
                )}
                {shape === 'straight' &&
                    flights.length > 0 &&
                    Math.abs(
                        flights.reduce((acc, f) => acc + f.riseM, 0) -
                            (r.toElevationM - r.fromElevationM),
                    ) > 0.005 && (
                        <button
                            type="button"
                            onClick={adjustLastFlight}
                            className="rounded-md border border-amber-500 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30"
                        >
                            Ajustar último tramo a la cota destino
                        </button>
                    )}
                <label className={field}>
                    Estructura
                    <select
                        className={input}
                        value={shape}
                        onChange={(e) =>
                            set({
                                ...r,
                                shape: e.target.value as RampConfig['shape'],
                            })
                        }
                    >
                        <option value="straight">
                            Recta (un tramo o varios con giros)
                        </option>
                        <option value="spiral">Helicoidal (espiral)</option>
                    </select>
                </label>

                {shape === 'straight' && (
                    <div className="grid gap-2">
                        <p className="text-[10px] text-slate-400">
                            Sin tramos: la rampa clásica de un solo tramo sobre
                            el polígono dibujado. Con tramos: cada uno sube
                            `Δcota` en su propia longitud y puede girar antes
                            del siguiente — arma un zigzag entre dos niveles.
                        </p>
                        {flights.map((flight, index) => (
                            <div
                                key={flight.id}
                                className="grid gap-1 rounded-md border border-slate-200 p-1.5 dark:border-white/10"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold text-slate-500">
                                        Tramo {index + 1}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => removeFlight(index)}
                                        className="text-[10px] text-red-500 hover:underline"
                                    >
                                        Quitar
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                    <label className={field}>
                                        Dirección inicial
                                        <select
                                            className={input}
                                            value={flight.direction}
                                            onChange={(e) =>
                                                updateFlight(index, {
                                                    direction: e.target
                                                        .value as RampFlight['direction'],
                                                })
                                            }
                                        >
                                            {FLIGHT_DIRECTIONS.map((d) => (
                                                <option
                                                    key={d.value}
                                                    value={d.value}
                                                >
                                                    {d.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <Num
                                        label="Giro tras el tramo (°)"
                                        value={flight.turnAfterDeg ?? 0}
                                        step={15}
                                        onChange={(turnAfterDeg) =>
                                            updateFlight(index, {
                                                turnAfterDeg,
                                            })
                                        }
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-1">
                                    <Num
                                        label="Longitud (m)"
                                        value={flight.lengthM}
                                        min={0.5}
                                        onChange={(lengthM) =>
                                            updateFlight(index, { lengthM })
                                        }
                                    />
                                    <Num
                                        label="Sube/baja (m)"
                                        value={flight.riseM}
                                        onChange={(riseM) =>
                                            updateFlight(index, { riseM })
                                        }
                                    />
                                    <Num
                                        label="Descanso (m)"
                                        value={flight.landingLengthM ?? 0}
                                        min={0}
                                        onChange={(landingLengthM) =>
                                            updateFlight(index, {
                                                landingLengthM,
                                            })
                                        }
                                    />
                                </div>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={addFlight}
                            className="rounded-md border border-dashed border-slate-300 py-1 text-[11px] text-slate-500 hover:border-cyan-500 hover:text-cyan-600 dark:border-slate-700"
                        >
                            + Agregar tramo
                        </button>
                    </div>
                )}

                {shape === 'spiral' && (
                    <div className="grid gap-2">
                        <p className="text-[10px] text-slate-400">
                            Gira alrededor del centro del polígono dibujado
                            mientras sube de la cota origen a la destino — el
                            radio lo da el tamaño de ese polígono.
                        </p>
                        <div className="grid grid-cols-2 gap-1">
                            <Num
                                label="Vueltas"
                                value={r.turns ?? 1}
                                step={0.25}
                                min={0.25}
                                onChange={(turns) => set({ ...r, turns })}
                            />
                            <Num
                                label="Ángulo inicial (°)"
                                value={r.startAngleDeg ?? 0}
                                step={15}
                                onChange={(startAngleDeg) =>
                                    set({ ...r, startAngleDeg })
                                }
                            />
                        </div>
                        <label className="flex items-center gap-2 text-[11px] text-slate-500">
                            <input
                                type="checkbox"
                                checked={r.clockwise !== false}
                                onChange={(e) =>
                                    set({
                                        ...r,
                                        clockwise: e.target.checked,
                                    })
                                }
                            />
                            Sentido horario (visto en planta)
                        </label>
                    </div>
                )}

                {shape === 'straight' && flights.length === 0 && (
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
                )}
                {platformCotas.length >= 2 && (
                    <button
                        type="button"
                        onClick={useCotas}
                        className="rounded-md border border-slate-300 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/5"
                    >
                        Subir de {platformCotas[0].toFixed(2)} m a{' '}
                        {platformCotas[platformCotas.length - 1].toFixed(2)} m
                        (plataformas bajo la rampa)
                    </button>
                )}
                {shape === 'straight' && flights.length > 0 && (
                    <button
                        type="button"
                        onClick={reversePath}
                        className="rounded-md border border-slate-300 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/5"
                    >
                        Invertir recorrido (INICIO ↔ FIN)
                        {r.reversed ? ' · activo' : ''}
                    </button>
                )}
                {shape === 'straight' && (
                    <button
                        type="button"
                        disabled={r.toElevationM === r.fromElevationM}
                        onClick={() =>
                            set({
                                ...r,
                                shape: 'straight',
                                widthM: Math.max(r.widthM, RAMP_NORM.minWidthM),
                                flights: planRampFlights(
                                    r.toElevationM - r.fromElevationM,
                                ),
                            })
                        }
                        className="rounded-md border border-cyan-500 py-1 text-[11px] font-semibold text-cyan-700 hover:bg-cyan-50 disabled:opacity-40 dark:text-cyan-300 dark:hover:bg-cyan-950/30"
                    >
                        Generar tramos reglamentarios
                    </button>
                )}
                {shape === 'straight' && flights.length > 0 && (
                    <LevelLinkNotes
                        report={rampLink}
                        onSuggestCotas={() => {
                            const cotas =
                                rampLink &&
                                suggestCotasFromPlatforms(
                                    rampLink,
                                    siteElements,
                                    editor.terrainScaleM,
                                );
                            if (cotas) set({ ...r, ...cotas });
                        }}
                        onReachArrival={() => {
                            const shift =
                                rampLink &&
                                shiftToReachArrival(
                                    rampLink,
                                    siteElements,
                                    editor.terrainScaleM,
                                );
                            if (shift) {
                                editor.updateSiteElement(element.id, {
                                    vertices: element.vertices.map((v) => ({
                                        x: v.x + shift.x,
                                        y: v.y + shift.y,
                                    })),
                                });
                            }
                        }}
                        autoLinkAvailable={rampAuto !== null}
                        onAutoLink={() => {
                            if (rampAuto) set(applyAutoLinkToRamp(r, rampAuto));
                        }}
                        overflows={
                            Math.max(rampFit.overflowXM, rampFit.overflowZM) > 0
                        }
                        onFitPolygon={() => {
                            const pts = naturalFootprint(
                                element,
                                editor.terrainScaleM,
                                { ...r, fitToPolygon: false },
                            );
                            if (pts)
                                editor.updateSiteElement(element.id, {
                                    vertices: pts,
                                });
                        }}
                    />
                )}
                {shape === 'straight' && flights.length > 0 && (
                    <FitNotes
                        fit={rampFit}
                        enabled={r.fitToPolygon !== false}
                        onToggle={(on) => set({ ...r, fitToPolygon: on })}
                    />
                )}
                {shape === 'straight' ? (
                    <NormNotes
                        title="Referencia normativa · rampa"
                        source={RAMP_NORM.source}
                        findings={evaluateRamp({
                            widthM: rampFit.config.widthM,
                            fromElevationM: r.fromElevationM,
                            toElevationM: r.toElevationM,
                            flights: rampFit.config.flights ?? flights,
                            singleRunM: runM,
                            arrivalLandingM: r.arrivalLandingM,
                        })}
                    />
                ) : (
                    <NormNotes
                        title="Referencia normativa · rampa"
                        source={RAMP_NORM.source}
                        findings={[
                            {
                                level: 'info',
                                text: 'La rampa helicoidal no se evalúa contra el cuadro de pendientes; verifica pendiente ≤ 8 %, tramo ≤ 9 m y descansos con tu especialista.',
                            },
                        ]}
                    />
                )}
                <p className="text-[9px] text-slate-400">{RAMP_NORM.note}</p>
            </div>
        );
    }

    if (cfg.kind === 'stair') {
        const s = cfg as StairConfig;
        const rise = Math.abs(s.toElevationM - s.fromElevationM);
        const steps = stairStepCount(rise);
        const flightCount = planStairFlights(
            rise,
            s.widthM,
            s.maxStepsPerFlight ?? STAIR_NORM.maxStepsBeforeLanding,
            s.run,
            s.landings === 'none',
        ).length;
        const stairDir = stairRunDirection(s, element, editor.terrainScaleM);
        const stairFit = fitRampToElement(
            stairAsRampConfig(s, stairDir),
            element,
            editor.terrainScaleM,
            { lockLengths: true },
        );
        const stairAuto = autoLinkStairFromPolygon(
            element,
            editor.siteData?.elements ?? [],
            editor.terrainScaleM,
            stairDir,
        );
        const stairLink = checkLevelLink(
            element,
            editor.siteData?.elements ?? [],
            editor.terrainScaleM,
            stairFit.config,
        );
        const stairCotas = platformCotasUnder(
            element.vertices,
            editor.siteData?.elements ?? [],
        );
        return (
            <div className="grid gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                <div className="grid grid-cols-2 gap-1">
                    <Num
                        label="Cota origen (m)"
                        value={s.fromElevationM}
                        onChange={(fromElevationM) =>
                            set({ ...s, fromElevationM })
                        }
                    />
                    <Num
                        label="Cota destino (m)"
                        value={s.toElevationM}
                        onChange={(toElevationM) => set({ ...s, toElevationM })}
                    />
                </div>
                <Num
                    label="Ancho (m)"
                    value={s.widthM}
                    min={0}
                    onChange={(widthM) => {
                        // El polígono sigue al ancho en el eje TRANSVERSAL al recorrido (crece hacia los lados,
                        // no a lo largo); en el otro eje solo crece si el recorrido lo necesita.
                        const next: StairConfig = {
                            ...s,
                            widthM: Math.max(0.3, widthM),
                        };
                        const poly = polygonForLayout(
                            element,
                            editor.terrainScaleM,
                            stairAsRampConfig(next, stairDir),
                            stairDir === 'east' ? 'y' : 'x',
                        );
                        editor.updateSiteElement(element.id, {
                            config: next,
                            ...(poly ? { vertices: poly } : {}),
                        });
                    }}
                />
                <label className={field}>
                    Sentido del recorrido
                    <select
                        className={input}
                        value={stairDir}
                        onChange={(e) => {
                            const next: StairConfig = {
                                ...s,
                                direction: e.target.value as 'east' | 'south',
                            };
                            const poly = polygonForLayout(
                                element,
                                editor.terrainScaleM,
                                stairAsRampConfig(
                                    next,
                                    next.direction ?? 'east',
                                ),
                            );
                            editor.updateSiteElement(element.id, {
                                config: next,
                                ...(poly ? { vertices: poly } : {}),
                            });
                        }}
                    >
                        <option value="east">
                            Horizontal (el ancho crece en vertical)
                        </option>
                        <option value="south">
                            Vertical (el ancho crece en horizontal)
                        </option>
                    </select>
                </label>
                <label className={field}>
                    Tipo de escalera
                    <select
                        className={input}
                        value={s.landings ?? 'auto'}
                        onChange={(e) =>
                            set({
                                ...s,
                                landings: e.target.value as 'auto' | 'none',
                            })
                        }
                    >
                        <option value="auto">
                            Con descanso (cada cierta cantidad de peldaños)
                        </option>
                        <option value="none">
                            Recta continua (un solo tramo, sin descanso)
                        </option>
                    </select>
                </label>
                <label className={field}>
                    Forma
                    <select
                        className={input}
                        disabled={s.landings === 'none'}
                        value={s.landings === 'none' ? 'straight' : s.run}
                        onChange={(e) =>
                            set({
                                ...s,
                                run: e.target.value as StairConfig['run'],
                            })
                        }
                    >
                        <option value="straight">
                            Recta (con descanso en línea si pasa del máximo)
                        </option>
                        <option value="L">
                            En L (giro de 90° en el descanso)
                        </option>
                        <option value="U">
                            En U (vuelta de 180°, tramos paralelos)
                        </option>
                    </select>
                </label>
                <div className="grid grid-cols-2 gap-1">
                    <Num
                        label="Descanso de llegada (m)"
                        value={s.arrivalLandingM ?? STAIR_NORM.landingM}
                        step={0.1}
                        min={0}
                        onChange={(arrivalLandingM) =>
                            set({ ...s, arrivalLandingM })
                        }
                    />
                    <Num
                        label={
                            s.landings === 'none'
                                ? 'Peldaños por tramo (no aplica)'
                                : 'Peldaños antes del descanso'
                        }
                        value={
                            s.maxStepsPerFlight ??
                            STAIR_NORM.maxStepsBeforeLanding
                        }
                        step={1}
                        min={4}
                        onChange={(maxStepsPerFlight) =>
                            set({ ...s, maxStepsPerFlight })
                        }
                    />
                </div>
                <div className="grid grid-cols-2 gap-1">
                    {s.landings !== 'none' && (
                        <Num
                            label="Fondo del descanso (m)"
                            value={
                                s.landingDepthM ??
                                Math.max(s.widthM, STAIR_NORM.landingM)
                            }
                            step={0.1}
                            min={0.5}
                            onChange={(landingDepthM) =>
                                set({
                                    ...s,
                                    landingDepthM: Math.max(0.5, landingDepthM),
                                })
                            }
                        />
                    )}
                    <Num
                        label="Altura de baranda (m)"
                        value={s.handrailHeightM ?? STAIR_NORM.handrailHeightM}
                        step={0.05}
                        min={0.3}
                        onChange={(handrailHeightM) =>
                            set({
                                ...s,
                                handrailHeightM: Math.max(0.3, handrailHeightM),
                            })
                        }
                    />
                </div>
                {s.landings !== 'none' && s.landingDepthM !== undefined && (
                    <button
                        type="button"
                        onClick={() => set({ ...s, landingDepthM: undefined })}
                        className="text-left text-[10px] font-semibold text-cyan-700 hover:underline dark:text-cyan-300"
                    >
                        Volver al fondo automático (≥ el ancho)
                    </button>
                )}
                <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">
                        Peldaños (contrahuella ≤ {STAIR_NORM.maxRiserM * 100}{' '}
                        cm) · tramos
                    </span>
                    <strong>
                        {steps} · {flightCount}
                    </strong>
                </div>
                <p className="text-[10px] text-slate-400">
                    Los tramos, los descansos y el descanso de llegada se
                    generan solos según la forma; para poner un descanso más
                    abajo, reduce "Máx. peldaños por tramo". La escalera se
                    centra en el polígono dibujado.
                </p>
                {stairCotas.length >= 2 && (
                    <button
                        type="button"
                        onClick={() =>
                            set({
                                ...s,
                                fromElevationM: stairCotas[0],
                                toElevationM: stairCotas[stairCotas.length - 1],
                            })
                        }
                        className="rounded-md border border-slate-300 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/5"
                    >
                        Subir de {stairCotas[0].toFixed(2)} m a{' '}
                        {stairCotas[stairCotas.length - 1].toFixed(2)} m
                        (plataformas bajo la escalera)
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => set({ ...s, reversed: !s.reversed })}
                    className="rounded-md border border-slate-300 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/5"
                >
                    Invertir recorrido (INICIO ↔ FIN)
                    {s.reversed ? ' · activo' : ''}
                </button>
                <LevelLinkNotes
                    report={stairLink}
                    onSuggestCotas={() => {
                        const cotas =
                            stairLink &&
                            suggestCotasFromPlatforms(
                                stairLink,
                                editor.siteData?.elements ?? [],
                                editor.terrainScaleM,
                            );
                        if (cotas) set({ ...s, ...cotas });
                    }}
                    onReachArrival={() => {
                        const shift =
                            stairLink &&
                            shiftToReachArrival(
                                stairLink,
                                editor.siteData?.elements ?? [],
                                editor.terrainScaleM,
                            );
                        if (shift) {
                            editor.updateSiteElement(element.id, {
                                vertices: element.vertices.map((v) => ({
                                    x: v.x + shift.x,
                                    y: v.y + shift.y,
                                })),
                            });
                        }
                    }}
                    autoLinkAvailable={stairAuto !== null}
                    onAutoLink={() => {
                        if (stairAuto) set(applyAutoLinkToStair(s, stairAuto));
                    }}
                    overflows={
                        Math.max(stairFit.overflowXM, stairFit.overflowZM) > 0
                    }
                    onFitPolygon={() => {
                        const pts = naturalFootprint(
                            element,
                            editor.terrainScaleM,
                            {
                                ...stairAsRampConfig(s, stairDir),
                                fitToPolygon: false,
                            },
                        );
                        if (pts)
                            editor.updateSiteElement(element.id, {
                                vertices: pts,
                            });
                    }}
                />
                <FitNotes
                    fit={stairFit}
                    enabled={s.fitToPolygon !== false}
                    onToggle={(on) => set({ ...s, fitToPolygon: on })}
                />
                <NormNotes
                    title="Referencia normativa · escalera"
                    source={STAIR_NORM.source}
                    findings={evaluateStair({
                        fromElevationM: s.fromElevationM,
                        toElevationM: s.toElevationM,
                        widthM: stairFit.config.widthM,
                        maxStepsPerFlight: s.maxStepsPerFlight,
                        shape: s.run,
                        continuous: s.landings === 'none',
                        landingDepthM: s.landingDepthM,
                    })}
                />
            </div>
        );
    }

    if (cfg.kind === 'sidewalk') {
        const w = cfg as SidewalkConfig;
        const box = elementBox(element, editor.terrainScaleM);
        return (
            <div className="grid gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                <Choice<SidewalkMaterial>
                    label="Acabado"
                    value={w.material}
                    options={[
                        { value: 'paving', label: 'Adoquín / loseta' },
                        { value: 'concrete', label: 'Concreto' },
                    ]}
                    onChange={(material) => set({ ...w, material })}
                />
                <Num
                    label="Altura sobre el suelo (m)"
                    value={w.heightM}
                    step={0.02}
                    min={0.02}
                    onChange={(heightM) =>
                        set({
                            ...w,
                            heightM: Math.min(0.5, Math.max(0.02, heightM)),
                        })
                    }
                />
                <p className="text-[10px] text-slate-400">
                    Caja del trazo: {box.widthM.toFixed(1)} ×{' '}
                    {box.depthM.toFixed(1)} m. El ancho se cambia moviendo los
                    vértices en el plano.
                </p>
            </div>
        );
    }

    if (cfg.kind === 'canopy') {
        const c = cfg as CanopyConfig;
        return (
            <div className="grid gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                <Choice
                    label="Cubierta"
                    value={c.roof}
                    options={ROOF_OPTIONS}
                    onChange={(roof) => set({ ...c, roof })}
                />
                <div className="grid grid-cols-2 gap-1">
                    <Num
                        label="Altura al alero (m)"
                        value={c.heightM}
                        min={2}
                        onChange={(heightM) =>
                            set({ ...c, heightM: Math.max(2, heightM) })
                        }
                    />
                    <Num
                        label="Separación columnas (m)"
                        value={c.columnSpacingM}
                        min={1}
                        onChange={(columnSpacingM) =>
                            set({
                                ...c,
                                columnSpacingM: Math.max(1, columnSpacingM),
                            })
                        }
                    />
                    <Num
                        label="Ø columna (m)"
                        value={c.columnDiameterM}
                        step={0.05}
                        min={0.1}
                        onChange={(columnDiameterM) =>
                            set({
                                ...c,
                                columnDiameterM: Math.max(0.1, columnDiameterM),
                            })
                        }
                    />
                </div>
                <label className="flex items-center gap-2 text-[11px] text-slate-500">
                    <input
                        type="checkbox"
                        checked={c.translucent}
                        onChange={(e) =>
                            set({ ...c, translucent: e.target.checked })
                        }
                    />
                    Cubierta translúcida (policarbonato)
                </label>
                <CanopyLightsSummary lights={c.lights} />
                <p className="text-[10px] text-slate-400">
                    Entrada techada, cobertizo o pérgola: cubierta sobre
                    columnas en los lados largos. Las dimensiones salen del
                    contorno dibujado.
                </p>
            </div>
        );
    }

    if (cfg.kind === 'court') {
        const c = cfg as CourtConfig;
        return (
            <div className="grid gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                <Choice
                    label="Deporte / marcas"
                    value={c.sport}
                    options={SPORT_OPTIONS}
                    onChange={(sport) => set({ ...c, sport })}
                />
                <label className="flex items-center gap-2 text-[11px] text-slate-500">
                    <input
                        type="checkbox"
                        checked={c.covered}
                        onChange={(e) =>
                            set({ ...c, covered: e.target.checked })
                        }
                    />
                    Cancha techada
                </label>
                {c.covered && (
                    <>
                        <Choice
                            label="Cubierta"
                            value={c.roof}
                            options={ROOF_OPTIONS}
                            onChange={(roof) => set({ ...c, roof })}
                        />
                        <Num
                            label="Altura libre al alero (m)"
                            value={c.roofHeightM}
                            min={3}
                            onChange={(roofHeightM) =>
                                set({
                                    ...c,
                                    roofHeightM: Math.max(3, roofHeightM),
                                })
                            }
                        />
                    </>
                )}
                <p className="text-[10px] text-slate-400">
                    Las marcas son esquemáticas, escaladas al largo × ancho del
                    contorno dibujado (el lado mayor es el largo); no reemplazan
                    el trazado oficial. La iluminancia exigible para deportes
                    aún no tiene fuente normativa cargada: no se declara
                    cumplimiento.
                </p>
            </div>
        );
    }

    if (cfg.kind === 'green_area') {
        const g = cfg as GreenAreaConfig;
        return (
            <div className="grid gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                <Choice
                    label="Forma"
                    value={g.form}
                    options={[
                        { value: 'flat', label: 'Plana (césped)' },
                        {
                            value: 'terraced',
                            label: 'En gradas (jardín escalonado)',
                        },
                    ]}
                    onChange={(form) => set({ ...g, form })}
                />
                {g.form === 'terraced' && (
                    <>
                        <div className="grid grid-cols-2 gap-1">
                            <Num
                                label="N.º de gradas"
                                value={g.terraces}
                                step={1}
                                min={2}
                                onChange={(terraces) =>
                                    set({
                                        ...g,
                                        terraces: Math.min(
                                            12,
                                            Math.max(2, Math.round(terraces)),
                                        ),
                                    })
                                }
                            />
                            <Num
                                label="Desnivel por grada (m)"
                                value={g.terraceRiseM}
                                step={0.05}
                                min={0.1}
                                onChange={(terraceRiseM) =>
                                    set({
                                        ...g,
                                        terraceRiseM: Math.max(
                                            0.1,
                                            terraceRiseM,
                                        ),
                                    })
                                }
                            />
                        </div>
                        <p className="text-[10px] text-slate-400">
                            Las gradas suben a lo largo del lado mayor del
                            contorno (gira el objeto para cambiar el sentido).
                        </p>
                    </>
                )}
            </div>
        );
    }

    if (cfg.kind === 'tree') {
        const t = cfg as TreeConfig;
        return (
            <div className="grid gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                <Choice
                    label="Especie"
                    value={t.species}
                    options={SPECIES_OPTIONS}
                    onChange={(species) => set({ ...t, species })}
                />
                <div className="grid grid-cols-2 gap-1">
                    <Num
                        label="Altura (m)"
                        value={t.heightM}
                        min={1}
                        onChange={(heightM) =>
                            set({ ...t, heightM: Math.max(1, heightM) })
                        }
                    />
                    <Num
                        label="Copa Ø (m)"
                        value={t.crownM}
                        min={0.5}
                        onChange={(crownM) =>
                            set({ ...t, crownM: Math.max(0.5, crownM) })
                        }
                    />
                </div>
            </div>
        );
    }

    if (cfg.kind === 'terrace_platform') {
        const t = cfg as TerracePlatformConfig;
        return (
            <div className="grid gap-2 rounded-lg border border-slate-200 p-2 dark:border-white/10">
                <Num
                    label="Ángulo del talud (° desde la horizontal)"
                    value={t.taludAngleDeg}
                    step={5}
                    min={1}
                    onChange={(taludAngleDeg) =>
                        set({
                            ...t,
                            taludAngleDeg: Math.min(
                                89,
                                Math.max(1, taludAngleDeg),
                            ),
                        })
                    }
                />
                <NormNotes
                    title="Referencia normativa · contención"
                    source={RETAINING_NORM.source}
                    findings={evaluatePlatformRetention(
                        platformRetentionDropM(
                            element,
                            editor.siteData?.elements ?? [],
                        ),
                    )}
                />
                <p className="text-[10px] text-slate-400">
                    Plataforma a su cota (pestaña Posición). El talud baja de su
                    borde hasta el terreno natural — o hasta la cota base si aún
                    no hay topografía modelada — con este ángulo. Usa una
                    plataforma por cada nivel de la ladera.
                </p>
            </div>
        );
    }

    return null;
}

/**
 * Resumen de las luminarias del techado: se proyectan y editan en la pestaña
 * Iluminación (un solo lugar, sin duplicar controles).
 */
function CanopyLightsSummary({ lights }: { lights: CanopyLights | undefined }) {
    const setCategory = useSitePaletteStore((state) => state.setCategory);
    const active = lights?.enabled ? lights : null;
    return (
        <div className="rounded-md bg-slate-50 p-2 text-[11px] text-slate-600 dark:bg-white/5 dark:text-slate-300">
            <p>
                Luminarias:{' '}
                <strong>
                    {active
                        ? active.rows && active.columns
                            ? `${active.columns} × ${active.rows} = ${active.rows * active.columns}`
                            : `${active.count}`
                        : 'ninguna'}
                </strong>
                {active && ` · ${active.lumens} lm · ${active.wattage} W c/u`}
            </p>
            <button
                type="button"
                onClick={() => setCategory('lighting')}
                className="mt-1 w-full rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
            >
                Proyectar / editar en Iluminación
            </button>
        </div>
    );
}
