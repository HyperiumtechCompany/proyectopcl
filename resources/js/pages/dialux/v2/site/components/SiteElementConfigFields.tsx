import { platformCotasUnder } from '../domain/rampLayout';
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
import type {
    FenceConfig,
    GateConfig,
    GateVariant,
    PoleConfig,
    RampConfig,
    RampFlight,
    SiteElement,
    SiteElementConfig,
    StairConfig,
    TerracePlatformConfig,
    TgConfig,
    TransformerConfig,
} from '../domain/types';
import type { UseSiteEditorReturn } from '../hooks/useSiteEditor';
import { defaultConfigFor } from '../lib/siteDefaults';
import { PoleLuminairePanel } from './PoleLuminairePanel';

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

const FLIGHT_DIRECTIONS: { value: RampFlight['direction']; label: string }[] =
    [
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
                        En 3D, el portón se pega sobre la línea del cerco
                        (a menos de 3 m si es automático), con su misma altura
                        y cota, y el cerco deja libre el ingreso. El dibujo 2D
                        no cambia.
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
                    Tipo de cerco
                    <select
                        className={input}
                        value={f.fenceKind ?? 'wall'}
                        onChange={(e) =>
                            set({
                                ...f,
                                fenceKind: e.target.value as FenceConfig['fenceKind'],
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
                                conform: e.target.value as FenceConfig['conform'],
                            })
                        }
                    >
                        <option value="stepped">
                            Escalonado (paneles a nivel)
                        </option>
                        <option value="sloped">
                            Inclinado (sigue la pendiente)
                        </option>
                        <option value="flat">
                            Plano (bloque a cota fija)
                        </option>
                    </select>
                </label>
                <div className="grid grid-cols-2 gap-1">
                    <Num
                        label="Espesor (m)"
                        value={f.thicknessM ?? 0.2}
                        step={0.05}
                        min={0.05}
                        onChange={(thicknessM) => set({ ...f, thicknessM })}
                    />
                    <Num
                        label="Largo de panel (m)"
                        value={f.panelLengthM ?? 2.5}
                        step={0.5}
                        min={0.5}
                        onChange={(panelLengthM) => set({ ...f, panelLengthM })}
                    />
                </div>
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
                Math.round((r.toElevationM - r.fromElevationM - before) * 1000) /
                1000;
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
                            Math.round((Math.abs(riseM) / (slope / 100)) * 100) /
                            100,
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
                    onChange={(widthM) => set({ ...r, widthM })}
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
                {shape === 'straight' ? (
                    <NormNotes
                        title="Referencia normativa · rampa"
                        source={RAMP_NORM.source}
                        findings={evaluateRamp({
                            widthM: r.widthM,
                            fromElevationM: r.fromElevationM,
                            toElevationM: r.toElevationM,
                            flights,
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
                <p className="text-[9px] text-slate-400">
                    {RAMP_NORM.note}
                </p>
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
        ).length;
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
                    onChange={(widthM) => set({ ...s, widthM })}
                />
                <label className={field}>
                    Forma
                    <select
                        className={input}
                        value={s.run}
                        onChange={(e) =>
                            set({ ...s, run: e.target.value as StairConfig['run'] })
                        }
                    >
                        <option value="straight">
                            Recta (con descanso en línea si pasa del máximo)
                        </option>
                        <option value="L">En L (giro de 90° en el descanso)</option>
                        <option value="U">En U (vuelta de 180°, tramos paralelos)</option>
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
                        label="Máx. peldaños por tramo"
                        value={s.maxStepsPerFlight ?? STAIR_NORM.maxStepsBeforeLanding}
                        step={1}
                        min={4}
                        onChange={(maxStepsPerFlight) =>
                            set({ ...s, maxStepsPerFlight })
                        }
                    />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">
                        Peldaños (contrahuella ≤ {STAIR_NORM.maxRiserM * 100} cm)
                        · tramos
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
                <NormNotes
                    title="Referencia normativa · escalera"
                    source={STAIR_NORM.source}
                    findings={evaluateStair({
                        fromElevationM: s.fromElevationM,
                        toElevationM: s.toElevationM,
                        widthM: s.widthM,
                        maxStepsPerFlight: s.maxStepsPerFlight,
                        shape: s.run,
                    })}
                />
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
