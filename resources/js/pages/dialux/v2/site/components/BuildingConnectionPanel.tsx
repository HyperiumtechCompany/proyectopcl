import { Cable, Zap } from 'lucide-react';
import { useState } from 'react';
import { moduleWorstCircuit, suggestFeederSection } from '../domain/blockConnection';
import { normalizeTgOutputs } from '../domain/tgPanel';
import type { SiteElement } from '../domain/types';
import type { UseSiteEditorReturn } from '../hooks/useSiteEditor';

interface ModuleOption {
    id: number;
    name: string;
}

const inputClass =
    'mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white';

/** Límites por defecto (columna "<4% final / <2.5% aliment." de la tabla CT) si la red no está cargada. */
const DEFAULT_FEEDER_LIMIT_PCT = 2.5;
const DEFAULT_TOTAL_LIMIT_PCT = 4;

const pct = (value: number) => `${value.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
const meters = (value: number) => `${value.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m`;

/**
 * "Conexión eléctrica" de un edificio de la planta (fase C1/C2/C3 de
 * `plan_conexion_edificio_modulo_caida_tension.md`): módulo vinculado,
 * tablero al que llega, cable que lo alimenta (longitud exterior hasta la
 * acometida + recorrido interior) y la caída de tensión de punta a punta:
 * alimentador TG → tablero del módulo + circuito más desfavorable del módulo.
 */
export function BuildingConnectionPanel({
    element,
    editor,
    modules,
}: {
    element: SiteElement;
    editor: UseSiteEditorReturn;
    modules: ModuleOption[];
}) {
    const elements = editor.siteData?.elements ?? [];
    const panels = elements.filter((item) => item.type === 'tg_location' || item.type === 'sub_panel');
    const [panelId, setPanelId] = useState<string>('');
    const [outputId, setOutputId] = useState<string>('');
    const chosenPanel = panels.find((item) => item.id === (panelId || panels[0]?.id));
    const outputs =
        chosenPanel?.type === 'tg_location' && chosenPanel.config?.kind === 'tg'
            ? normalizeTgOutputs(chosenPanel.config.outputs)
            : [];

    const ports = element.moduleId
        ? editor.networkPorts.filter((port) => port.moduleId === element.moduleId)
        : [];
    const rootPorts = ports.filter((port) => !port.parentPanelId);
    const cables = (editor.siteData?.circuits ?? []).filter(
        (circuit) => circuit.targetId === element.id || circuit.sourceId === element.id,
    );
    const conflicts = editor.bridgeConflicts.filter((conflict) => conflict.siteElementId === element.id);
    const settings = editor.networkSettings;
    const FEEDER_LIMIT_PCT = settings?.feederDropLimitPercent ?? DEFAULT_FEEDER_LIMIT_PCT;
    const TOTAL_LIMIT_PCT = settings?.totalDropLimitPercent ?? DEFAULT_TOTAL_LIMIT_PCT;
    // Circuito más desfavorable del módulo (caída propia del módulo desde su tablero).
    const worstCircuit = moduleWorstCircuit(editor.networkPorts, element.moduleId);

    return (
        <section className="grid gap-2 rounded-lg border border-cyan-200 bg-cyan-50/40 p-2 text-[11px] dark:border-cyan-500/20 dark:bg-cyan-500/5">
            <p className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-200">
                <Zap className="h-3.5 w-3.5 text-cyan-600" />
                Conexión eléctrica
            </p>
            <label className="text-[10px] text-slate-500">
                Módulo del edificio
                <select
                    className={inputClass}
                    value={element.moduleId ?? ''}
                    onChange={(event) => {
                        const moduleId = event.target.value ? Number(event.target.value) : undefined;
                        editor.updateSiteElement(element.id, {
                            moduleId,
                            moduleName: modules.find((item) => item.id === moduleId)?.name,
                        });
                    }}
                >
                    <option value="">Sin vincular</option>
                    {modules.map((module) => (
                        <option key={module.id} value={module.id}>
                            {module.name}
                        </option>
                    ))}
                </select>
            </label>

            {element.moduleId && (
                <p className="text-[10px] text-slate-500">
                    Tablero de llegada:{' '}
                    {rootPorts.length === 0 ? (
                        <span className="text-amber-600">el módulo aún no tiene tablero</span>
                    ) : (
                        <strong className="text-slate-700 dark:text-slate-200">
                            {rootPorts.map((port) => port.panelLabel).join(', ')}
                        </strong>
                    )}
                    {rootPorts.length > 1 && ' (elige cuál en el cable)'}
                </p>
            )}

            {cables.map((circuit) => {
                const feed = editor.circuitFeeds[circuit.id];
                const calc = feed?.calculation;
                const feederPct = calc?.accumulatedVoltageDropPercent ?? null;
                const totalPct =
                    feederPct !== null && worstCircuit ? feederPct + worstCircuit.percent : null;
                const failing =
                    calc &&
                    ((feederPct ?? 0) > FEEDER_LIMIT_PCT + 1e-9 || (totalPct ?? 0) > TOTAL_LIMIT_PCT + 1e-9);
                // Sección mínima que cumple ambos límites (misma fórmula que la red).
                const suggestion =
                    calc && settings && calc.currentA > 0
                        ? suggestFeederSection({
                              currentA: calc.currentA,
                              lengthM: calc.lengthM,
                              voltageV: calc.voltageV ?? settings.nominalVoltageV,
                              phases: calc.phases ?? settings.phases,
                              powerFactor: calc.powerFactor ?? settings.defaultPowerFactor,
                              material: circuit.route?.conductorMaterial === 'aluminium' ? 'aluminio' : 'cobre',
                              temperatureC: settings.workingTemperatureC,
                              upstreamPercent: calc.accumulatedVoltageDropPercent - calc.ownVoltageDropPercent,
                              downstreamPercent: worstCircuit?.percent ?? 0,
                              feederLimitPercent: FEEDER_LIMIT_PCT,
                              totalLimitPercent: TOTAL_LIMIT_PCT,
                              minSectionMm2: calc.suggestedSectionMm2,
                          })
                        : null;
                const other = elements.find(
                    (item) => item.id === (circuit.sourceId === element.id ? circuit.targetId : circuit.sourceId),
                );
                return (
                    <div
                        key={circuit.id}
                        className="grid gap-1 rounded-md border border-slate-200 bg-white p-1.5 dark:border-white/10 dark:bg-slate-950/40"
                    >
                        <button
                            type="button"
                            onClick={() => editor.selectWire({ kind: 'circuit', id: circuit.id })}
                            className="flex items-center gap-1 text-left font-semibold text-cyan-700 hover:underline dark:text-cyan-300"
                        >
                            <Cable className="h-3 w-3" />
                            {feed ? `${feed.fromLabel} → ${feed.toLabel}` : `${other?.label ?? '?'} → ${element.label}`}
                        </button>
                        {calc ? (
                            <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-[10px]">
                                <dt className="text-slate-400">Longitud</dt>
                                <dd>
                                    {meters(calc.lengthM)} (exterior hasta la acometida + {meters(circuit.interiorLengthM ?? 0)} dentro + subida)
                                </dd>
                                <dt className="text-slate-400">Alimentador</dt>
                                <dd>
                                    {feed.sectionMm2} mm² {feed.conductorType} · ΔU acumulada{' '}
                                    <strong className={feederPct !== null && feederPct > FEEDER_LIMIT_PCT ? 'text-rose-600' : 'text-emerald-600'}>
                                        {pct(feederPct ?? 0)}
                                    </strong>{' '}
                                    (límite {FEEDER_LIMIT_PCT} %)
                                </dd>
                                {worstCircuit && totalPct !== null && (
                                    <>
                                        <dt className="text-slate-400">Punta a punta</dt>
                                        <dd>
                                            + circuito más desfavorable {worstCircuit.code} ({worstCircuit.panelLabel},{' '}
                                            {pct(worstCircuit.percent)}) ={' '}
                                            <strong className={totalPct > TOTAL_LIMIT_PCT ? 'text-rose-600' : 'text-emerald-600'}>
                                                {pct(totalPct)}
                                            </strong>{' '}
                                            (límite {TOTAL_LIMIT_PCT} %)
                                        </dd>
                                    </>
                                )}
                            </dl>
                        ) : (
                            <p className="text-[10px] text-amber-600">
                                Este cable aún no alimenta un tablero en la red (revisa los avisos de abajo).
                            </p>
                        )}
                        {failing &&
                            (suggestion ? (
                                <button
                                    type="button"
                                    onClick={() => editor.updateSiteCircuit(circuit.id, { sectionMm2: suggestion.sectionMm2 })}
                                    className="rounded-md border border-emerald-500 px-2 py-1 text-left text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                                    title="Sección mínima normalizada que cumple el límite del alimentador y el de punta a punta (IEC 60364-5-52 Anexo G, misma fórmula que Red y CT)"
                                >
                                    Sugerir sección: aplicar {suggestion.sectionMm2} mm² → alimentador {pct(suggestion.ownPercent)} · punta a punta {pct(suggestion.totalPercent)}
                                </button>
                            ) : (
                                <p className="text-[10px] text-rose-600">
                                    Ninguna sección hasta 300 mm² cumple: la caída aguas arriba y la del módulo ya agotan el
                                    límite. Acerca el tablero, sube el alimentador anterior o revisa los circuitos del módulo.
                                </p>
                            ))}
                        {(() => {
                            // Cable directo del tablero cruzando la planta: si hay una caja
                            // de pase ya cableada más cerca, conviene derivar desde ella.
                            const panelEnd = other && (other.type === 'tg_location' || other.type === 'sub_panel') ? other : null;
                            const origin = panelEnd ? editor.blockFeedOrigin(panelEnd.id, element.id) : null;
                            if (!origin?.viaPassThrough) return null;
                            return (
                                <button
                                    type="button"
                                    onClick={() => editor.rerouteBlockCableViaPassThrough(circuit.id)}
                                    className="rounded-md border border-cyan-500 px-2 py-1 text-left text-[10px] font-semibold text-cyan-700 hover:bg-cyan-50 dark:text-cyan-300 dark:hover:bg-cyan-950/30"
                                    title="El alimentador pasa a ser tablero → cajas de pase (cables existentes) → edificio, con la longitud real de todo el recorrido"
                                >
                                    Re-trazar desde la caja de pase "{origin.element.label}" (a {origin.distanceM.toFixed(1)} m del edificio) en vez de cruzar la planta
                                </button>
                            );
                        })()}
                        <label className="text-[10px] text-slate-500">
                            Recorrido dentro del edificio, de la acometida al tablero (m)
                            <input
                                type="number"
                                min={0}
                                step={0.5}
                                className={inputClass}
                                value={circuit.interiorLengthM ?? 0}
                                onChange={(event) =>
                                    editor.updateSiteCircuit(circuit.id, {
                                        interiorLengthM: Math.max(0, Number(event.target.value) || 0),
                                    })
                                }
                            />
                        </label>
                    </div>
                );
            })}

            {cables.length === 0 && panels.length > 0 && (
                <div className="grid gap-1 rounded-md border border-dashed border-cyan-300 p-1.5 dark:border-cyan-500/30">
                    <p className="text-[10px] text-slate-500">
                        Sin cable: el edificio no está alimentado desde la planta y su caída de tensión no cuenta la
                        distancia real.
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                        <label className="text-[10px] text-slate-500">
                            Desde el tablero
                            <select
                                className={inputClass}
                                value={panelId || panels[0]?.id}
                                onChange={(event) => {
                                    setPanelId(event.target.value);
                                    setOutputId('');
                                }}
                            >
                                {panels.map((panel) => (
                                    <option key={panel.id} value={panel.id}>
                                        {panel.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        {outputs.length > 0 && (
                            <label className="text-[10px] text-slate-500">
                                Salida
                                <select className={inputClass} value={outputId} onChange={(event) => setOutputId(event.target.value)}>
                                    <option value="">Automática</option>
                                    {outputs.map((output) => (
                                        <option key={output.id} value={output.id}>
                                            {output.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}
                    </div>
                    <button
                        type="button"
                        disabled={!chosenPanel}
                        onClick={() => chosenPanel && editor.connectBlockToPanel(element.id, chosenPanel.id, outputId || undefined)}
                        className="flex items-center justify-center gap-1.5 rounded-md bg-cyan-600 px-2 py-1.5 font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
                    >
                        <Cable className="h-3.5 w-3.5" />
                        Conectar al tablero
                    </button>
                    <p className="text-[9px] text-slate-400">
                        Si ya hay cajas de pase cableadas desde ese tablero, el cable sale de la más cercana al edificio
                        (el alimentador suma tablero → cajas → edificio). Si no, va directo desde el tablero, recto o en L
                        si hay otro edificio en medio. Luego puedes mover sus puntos como cualquier cable.
                    </p>
                </div>
            )}

            {conflicts.map((conflict, index) => (
                <p key={`${conflict.code}-${index}`} className="rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                    {conflict.message}
                </p>
            ))}
        </section>
    );
}
