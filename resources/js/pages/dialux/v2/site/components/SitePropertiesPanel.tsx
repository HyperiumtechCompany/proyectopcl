import {
    Copy,
    Eye,
    EyeOff,
    Layers,
    Lock,
    Route,
    Settings2,
    Trash2,
    Unlock,
} from 'lucide-react';
import { useState } from 'react';
import { feederPathLengthM } from '../domain/aerialCableGeometry';
import { cableWaypointElevations } from '../domain/cableElevation';
import { continuationCandidates } from '../domain/circuitContinuation';
import { isSpanGate } from '../domain/gateLayout';
import { polygonArea, polygonPerimeter } from '../domain/geometry';
import { SITE_CALCULATION_AREA_TYPES } from '../domain/siteLightingCalculation';
import { normalizeTgOutputs } from '../domain/tgPanel';
import type { Point2D, SiteCircuit, SiteElement } from '../domain/types';
import { resolveWireEndpoints } from '../domain/wireAnchors';
import type { UseSiteEditorReturn } from '../hooks/useSiteEditor';
import { defaultConfigFor } from '../lib/siteDefaults';
import { SiteAutoCircuitPanel } from './SiteAutoCircuitPanel';
import { SiteElementConfigFields } from './SiteElementConfigFields';
import { POINT_ELEMENT_TYPES } from './SiteElementSymbol';
import { SiteFeederRoutePanel } from './SiteFeederRoutePanel';
import { RepeatSection, SiteGroupPanel } from './SiteGroupPanel';
import { NORM_AREA_TYPES, SiteNormRequirementFields } from './SiteNormPanels';
import { SiteObjectsPanel } from './SiteObjectsPanel';
import { useSitePaletteStore } from './SitePalette';

interface ModuleOption {
    id: number;
    name: string;
}

interface Props {
    editor: UseSiteEditorReturn;
    modules: ModuleOption[];
}

const inputClass =
    'mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white';

type SidebarTab = 'objects' | 'properties';

export function SitePropertiesPanel({ editor, modules }: Props) {
    const element = editor.siteData?.elements.find(
        (item) => item.id === editor.selectedElementId,
    );
    const selectedFeederPath =
        editor.selectedWireId?.kind === 'feeder'
            ? editor.siteData?.feederPaths.find(
                  (path) => path.id === editor.selectedWireId?.id,
              )
            : undefined;
    const selectedCircuit =
        editor.selectedWireId?.kind === 'circuit'
            ? editor.siteData?.circuits?.find(
                  (circuit) => circuit.id === editor.selectedWireId?.id,
              )
            : undefined;
    const [tab, setTab] = useState<SidebarTab>('properties');
    const isGroup = editor.selectedElementIds.length > 1;

    return (
        <aside className="flex min-h-0 w-full flex-col overflow-y-auto border-t border-slate-200 bg-white xl:w-72 xl:border-t-0 xl:border-l dark:border-white/10 dark:bg-[#101218]">
            <div className="flex shrink-0 items-stretch border-b border-slate-200 dark:border-white/10">
                {(
                    [
                        { id: 'objects', label: 'Objetos', icon: Layers },
                        {
                            id: 'properties',
                            label: 'Propiedades',
                            icon: Settings2,
                        },
                    ] as const
                ).map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setTab(id)}
                        className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 text-[11px] font-semibold ${
                            tab === id
                                ? 'border-b-2 border-amber-500 text-amber-700 dark:text-amber-400'
                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                        }`}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                    </button>
                ))}
            </div>
            {tab === 'objects' && (
                <SiteObjectsPanel
                    editor={editor}
                    onSelect={() => setTab('properties')}
                />
            )}
            {tab === 'properties' && (
                <>
                    <div className="shrink-0 border-b border-slate-200 p-4 dark:border-white/10">
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                            Propiedades
                        </h2>
                        <p className="text-[11px] text-slate-500">
                            {isGroup
                                ? 'Selección múltiple'
                                : element
                                  ? 'Elemento del emplazamiento'
                                  : editor.selectedWireId
                                    ? 'Cable seleccionado — abajo'
                                    : 'Selecciona un elemento del plano'}
                        </p>
                    </div>
                    {editor.calibrationPoints.length === 2 && (
                        <CalibrationPanel editor={editor} />
                    )}
                    {isGroup && <SiteGroupPanel editor={editor} />}
                    {element && !isGroup && (
                        <>
                            <ElementProperties
                                key={element.id}
                                element={element}
                                editor={editor}
                                modules={modules}
                            />
                            <div className="shrink-0 border-t border-slate-200 p-3 dark:border-white/10">
                                <RepeatSection editor={editor} />
                            </div>
                        </>
                    )}
                    {!element && !editor.selectedWireId && (
                        <ImportedPlanPanel editor={editor} />
                    )}
                </>
            )}
            {tab === 'properties' && selectedFeederPath && (
                <div className="border-t border-slate-200 p-4 dark:border-white/10">
                    <div className="mb-2 flex items-center justify-between">
                        <p className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                            Alimentadores trazados
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                if (
                                    window.confirm(
                                        `¿Borrar los ${editor.siteData?.feederPaths.length} alimentadores trazados?`,
                                    )
                                )
                                    editor.clearAllFeederPaths();
                            }}
                            className="text-[10px] font-semibold text-rose-500 hover:text-rose-700"
                        >
                            Vaciar todo
                        </button>
                    </div>
                    <ul className="space-y-1">
                        {[selectedFeederPath].map((path) => {
                            const wireSelected =
                                editor.selectedWireId?.kind === 'feeder' &&
                                editor.selectedWireId.id === path.id;
                            return (
                                <li
                                    key={path.id}
                                    onClick={() =>
                                        editor.selectWire({
                                            kind: 'feeder',
                                            id: path.id,
                                        })
                                    }
                                    className={`cursor-pointer rounded-md border px-2 py-1.5 text-[11px] ${
                                        wireSelected
                                            ? 'border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30'
                                            : 'border-slate-200 dark:border-white/10'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="truncate text-slate-600 dark:text-slate-300">
                                            {path.label ?? path.networkEdgeId}
                                        </span>
                                        <span className="shrink-0 text-slate-400">
                                            {feederPathLengthM(
                                                path,
                                                editor.terrainScaleM,
                                            ).toFixed(1)}{' '}
                                            m
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                editor.removeFeederPath(
                                                    path.id,
                                                );
                                            }}
                                            title="Eliminar todo el trazado"
                                            className="shrink-0 text-rose-500 hover:text-rose-700"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                    {path.waypoints.length > 2 && (
                                        <WireSegments
                                            waypoints={path.waypoints}
                                            onRemove={(i) =>
                                                editor.removeFeederPathWaypoint(
                                                    path.id,
                                                    i,
                                                )
                                            }
                                        />
                                    )}
                                    <SiteFeederRoutePanel
                                        path={path}
                                        scaleM={editor.terrainScaleM}
                                    />
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
            {tab === 'properties' && selectedCircuit && (
                <div className="border-t border-slate-200 p-4 dark:border-white/10">
                    <div className="mb-2 flex items-center justify-between">
                        <p className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                            Cableado de instalaciones
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                if (
                                    window.confirm(
                                        `¿Borrar los ${editor.siteData?.circuits?.length} cableados de instalación?`,
                                    )
                                )
                                    editor.clearAllCircuits();
                            }}
                            className="text-[10px] font-semibold text-rose-500 hover:text-rose-700"
                        >
                            Vaciar todo
                        </button>
                    </div>
                    <ul className="space-y-1">
                        {[selectedCircuit].map((circuit) => {
                            const labelOf = (id: string) =>
                                editor.siteData?.elements.find(
                                    (el) => el.id === id,
                                )?.label ?? '?';
                            const wireSelected =
                                editor.selectedWireId?.kind === 'circuit' &&
                                editor.selectedWireId.id === circuit.id;
                            // Extremos EN VIVO (siguen al artefacto anclado si
                            // se movió) — la longitud y el trazo se calculan
                            // sobre estos, no sobre los waypoints guardados.
                            const liveWaypoints = resolveWireEndpoints(
                                circuit.waypoints,
                                circuit.sourceId,
                                circuit.targetId,
                                (id) =>
                                    editor.siteData?.elements.find(
                                        (el) => el.id === id,
                                    ),
                                editor.terrainScaleM,
                                circuit.tgOutputId,
                            );
                            const liveCircuit = {
                                ...circuit,
                                waypoints: liveWaypoints,
                            };
                            const waypointElevations = cableWaypointElevations(
                                liveWaypoints,
                                editor.siteData?.elements ?? [],
                                editor.terrainScaleM,
                            );
                            const tg = editor.siteData?.elements.find(
                                (item) =>
                                    item.type === 'tg_location' &&
                                    (item.id === circuit.sourceId ||
                                        item.id === circuit.targetId),
                            );
                            const tgOutputs = tg
                                ? normalizeTgOutputs(
                                      tg.config?.kind === 'tg'
                                          ? tg.config.outputs
                                          : undefined,
                                  )
                                : [];
                            // Extremo en un bloque de módulo: el cable llega a
                            // un tablero de ESE módulo en la red.
                            const block = editor.siteData?.elements.find(
                                (item) =>
                                    item.type === 'building_block' &&
                                    (item.id === circuit.sourceId ||
                                        item.id === circuit.targetId),
                            );
                            const blockPorts = block?.moduleId
                                ? editor.networkPorts.filter(
                                      (port) =>
                                          port.moduleId === block.moduleId,
                                  )
                                : [];
                            const feed = editor.circuitFeeds[circuit.id];
                            const output = editor.circuitOutputs[circuit.id];
                            const outputOk =
                                output &&
                                output.installedPowerW > 0 &&
                                output.voltageDropOk &&
                                output.capacityConforms &&
                                !output.normativeViolation;
                            return (
                                <li
                                    key={circuit.id}
                                    onClick={() =>
                                        editor.selectWire({
                                            kind: 'circuit',
                                            id: circuit.id,
                                        })
                                    }
                                    className={`cursor-pointer rounded-md border px-2 py-1.5 text-[11px] ${
                                        wireSelected
                                            ? 'border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30'
                                            : 'border-slate-200 dark:border-white/10'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="truncate text-slate-600 dark:text-slate-300">
                                            {circuit.label ??
                                                `${labelOf(circuit.sourceId)} → ${labelOf(circuit.targetId)}`}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                editor.removeSiteCircuit(
                                                    circuit.id,
                                                );
                                            }}
                                            title="Eliminar todo el cableado"
                                            className="shrink-0 text-rose-500 hover:text-rose-700"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                    {liveWaypoints.length > 2 && (
                                        <WireSegments
                                            waypoints={liveWaypoints}
                                            onRemove={(i) =>
                                                editor.removeSiteCircuitWaypoint(
                                                    circuit.id,
                                                    i,
                                                )
                                            }
                                        />
                                    )}
                                    {tgOutputs.length > 0 && (
                                        <label className="mt-1 block text-[10px] text-slate-500">
                                            Salida del TG
                                            <select
                                                className={inputClass}
                                                value={
                                                    circuit.tgOutputId ??
                                                    tgOutputs[0].id
                                                }
                                                onChange={(event) =>
                                                    editor.updateSiteCircuit(
                                                        circuit.id,
                                                        {
                                                            tgOutputId:
                                                                event.target
                                                                    .value,
                                                        },
                                                    )
                                                }
                                            >
                                                {tgOutputs.map((output) => (
                                                    <option
                                                        key={output.id}
                                                        value={output.id}
                                                    >
                                                        {output.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    )}
                                    {block && blockPorts.length > 1 && (
                                        <label className="mt-1 block text-[10px] text-slate-500">
                                            Tablero del módulo al que llega
                                            <select
                                                className={inputClass}
                                                value={
                                                    circuit.modulePanelId ?? ''
                                                }
                                                onChange={(event) =>
                                                    editor.updateSiteCircuit(
                                                        circuit.id,
                                                        {
                                                            modulePanelId:
                                                                event.target
                                                                    .value ||
                                                                undefined,
                                                        },
                                                    )
                                                }
                                            >
                                                <option value="">
                                                    Automático (tablero raíz)
                                                </option>
                                                {blockPorts.map((port) => (
                                                    <option
                                                        key={port.key}
                                                        value={port.panelId}
                                                    >
                                                        {port.panelLabel}
                                                        {port.parentPanelId
                                                            ? ' (sub tablero)'
                                                            : ''}
                                                        {` · ${port.sceneName}`}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    )}
                                    {block && !block.moduleId && (
                                        <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                                            El bloque no tiene módulo vinculado:
                                            vincúlalo para que este cable
                                            alimente su tablero.
                                        </p>
                                    )}
                                    {feed && (
                                        <p className="mt-1 rounded bg-cyan-50 px-1.5 py-1 text-[10px] text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300">
                                            En Red y CT: {feed.fromLabel} →{' '}
                                            {feed.moduleName
                                                ? `${feed.moduleName}: `
                                                : ''}
                                            {feed.toLabel}
                                            {circuit.sectionMm2 === undefined &&
                                                ` · ${feed.sectionMm2} mm² ${feed.conductorType} (de la red)`}
                                            {feed.calculation &&
                                                feed.calculation.status !==
                                                    'incomplete' &&
                                                ` · ΔU acum. ${feed.calculation.accumulatedVoltageDropPercent.toFixed(2)} %`}
                                        </p>
                                    )}
                                    {output && (
                                        <div
                                            className={`mt-1 rounded px-1.5 py-1 text-[10px] ${
                                                outputOk
                                                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                    : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                            }`}
                                        >
                                            <p className="font-semibold">
                                                CT {output.panelLabel} ·{' '}
                                                {output.code} ({output.outputLabel})
                                                {outputOk ? ' ✓' : ' ⚠'}
                                            </p>
                                            <p>
                                                {output.loadsDetail || 'Sin carga'}{' '}
                                                · {output.phases === 3 ? '3Φ' : '1Φ'}{' '}
                                                {output.phaseBalance} · I{' '}
                                                {output.currentA.toFixed(2)} A ·
                                                ITM {output.itm}
                                            </p>
                                            <p>
                                                Rama {output.lengthM.toFixed(1)} m ·{' '}
                                                {output.sectionMm2} mm² · ΔU{' '}
                                                {output.voltageDropPct.toFixed(2)} % /{' '}
                                                {output.maxVoltageDropPct} %
                                                {!output.capacityConforms &&
                                                    ' · capacidad del cable insuficiente'}
                                                {output.normativeViolation &&
                                                    ' · alumbrado y tomacorriente mezclados'}
                                            </p>
                                        </div>
                                    )}
                                    <div className="mt-1 grid grid-cols-2 gap-1">
                                        <label className="text-[10px] text-slate-500">
                                            N.º de conductores
                                            <input
                                                type="number"
                                                min={2}
                                                max={6}
                                                step={1}
                                                className={inputClass}
                                                value={circuit.wireCount}
                                                onChange={(e) =>
                                                    editor.updateSiteCircuit(
                                                        circuit.id,
                                                        {
                                                            wireCount: Math.max(
                                                                2,
                                                                Math.round(
                                                                    Number(
                                                                        e.target
                                                                            .value,
                                                                    ),
                                                                ),
                                                            ),
                                                        },
                                                    )
                                                }
                                            />
                                        </label>
                                        <label className="text-[10px] text-slate-500">
                                            Sección (mm²)
                                            <input
                                                type="number"
                                                min={1}
                                                step={0.5}
                                                className={inputClass}
                                                placeholder="—"
                                                value={circuit.sectionMm2 ?? ''}
                                                onChange={(e) =>
                                                    editor.updateSiteCircuit(
                                                        circuit.id,
                                                        {
                                                            sectionMm2: e.target
                                                                .value
                                                                ? Math.max(
                                                                      1,
                                                                      Number(
                                                                          e
                                                                              .target
                                                                              .value,
                                                                      ),
                                                                  )
                                                                : undefined,
                                                        },
                                                    )
                                                }
                                            />
                                        </label>
                                    </div>
                                    <CircuitContinuationControl
                                        key={`${circuit.id}:${circuit.targetId}`}
                                        circuit={circuit}
                                        editor={editor}
                                    />
                                    <SiteFeederRoutePanel
                                        path={liveCircuit}
                                        scaleM={editor.terrainScaleM}
                                        context="circuit"
                                        onSetRoute={editor.setSiteCircuitRoute}
                                        elevationsM={waypointElevations}
                                        onWastePctChange={(wastePct) =>
                                            editor.updateSiteCircuit(
                                                circuit.id,
                                                {
                                                    wastePct,
                                                },
                                            )
                                        }
                                    />
                                </li>
                            );
                        })}
                    </ul>
                    <p className="mt-2 text-[10px] text-slate-400">
                        Cableado de postes, tomacorrientes, tableros,
                        transformadores, celdas MT, buzones, cajas de pase,
                        portones y techados. El metrado incluye recorrido en
                        planta, amarres o zanja, desniveles entre plataformas y
                        reserva. Todavía no entra al cálculo de caída de tensión
                        ni a la Tabla CT. Haz clic en un cable para
                        seleccionarlo y borrarlo con Supr, o borra solo un tramo
                        suyo abajo.
                    </p>
                </div>
            )}
        </aside>
    );
}

function circuitDisplayColor(
    circuit: SiteCircuit,
    editor: UseSiteEditorReturn,
): string {
    const tg = editor.siteData?.elements.find(
        (element) =>
            element.type === 'tg_location' &&
            (element.id === circuit.sourceId ||
                element.id === circuit.targetId),
    );
    const output = tg
        ? normalizeTgOutputs(
              tg.config?.kind === 'tg' ? tg.config.outputs : undefined,
          ).find((item) => item.id === circuit.tgOutputId)
        : undefined;
    return output?.color ?? circuit.style?.color ?? '#0891b2';
}

function CircuitContinuationControl({
    circuit,
    editor,
}: {
    circuit: SiteCircuit;
    editor: UseSiteEditorReturn;
}) {
    const candidates = continuationCandidates(
        editor.siteData?.circuits ?? [],
        circuit.id,
    );
    const [selectedIds, setSelectedIds] = useState<string[]>([circuit.id]);
    const targetLabel =
        editor.siteData?.elements.find(
            (element) => element.id === circuit.targetId,
        )?.label ?? 'extremo actual';
    const selectedCount = selectedIds.filter((id) =>
        candidates.some((candidate) => candidate.id === id),
    ).length;

    const circuitLabel = (candidate: SiteCircuit) => {
        const tg = editor.siteData?.elements.find(
            (element) =>
                element.type === 'tg_location' &&
                (element.id === candidate.sourceId ||
                    element.id === candidate.targetId),
        );
        const output = tg
            ? normalizeTgOutputs(
                  tg.config?.kind === 'tg' ? tg.config.outputs : undefined,
              ).find((item) => item.id === candidate.tgOutputId)
            : undefined;
        return (
            output?.label ??
            candidate.label ??
            `Circuito ${candidate.id.slice(0, 6)}`
        );
    };

    return (
        <div
            className="mt-2 rounded-md border border-cyan-200 bg-cyan-50/70 p-2 dark:border-cyan-900/70 dark:bg-cyan-950/20"
            onClick={(event) => event.stopPropagation()}
        >
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="text-[10px] font-bold text-cyan-800 dark:text-cyan-300">
                        Continuar desde {targetLabel}
                    </p>
                    <p className="text-[9px] leading-4 text-slate-500 dark:text-slate-400">
                        Marca los colores que compartirán el siguiente
                        recorrido.
                    </p>
                </div>
                {candidates.length > 1 && (
                    <button
                        type="button"
                        className="shrink-0 text-[9px] font-semibold text-cyan-700 hover:text-cyan-900 dark:text-cyan-400"
                        onClick={() =>
                            setSelectedIds(
                                selectedCount === candidates.length
                                    ? []
                                    : candidates.map((item) => item.id),
                            )
                        }
                    >
                        {selectedCount === candidates.length
                            ? 'Ninguno'
                            : 'Todos'}
                    </button>
                )}
            </div>
            <div className="mt-1.5 max-h-28 space-y-1 overflow-y-auto pr-1">
                {candidates.map((candidate) => (
                    <label
                        key={candidate.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-[10px] text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/5"
                    >
                        <input
                            type="checkbox"
                            className="h-3 w-3 rounded border-slate-300 accent-cyan-600"
                            checked={selectedIds.includes(candidate.id)}
                            onChange={() =>
                                setSelectedIds((current) =>
                                    current.includes(candidate.id)
                                        ? current.filter(
                                              (id) => id !== candidate.id,
                                          )
                                        : [...current, candidate.id],
                                )
                            }
                        />
                        <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10"
                            style={{
                                backgroundColor: circuitDisplayColor(
                                    candidate,
                                    editor,
                                ),
                            }}
                        />
                        <span className="truncate">
                            {circuitLabel(candidate)}
                        </span>
                    </label>
                ))}
            </div>
            <button
                type="button"
                disabled={selectedCount === 0}
                onClick={() => editor.startCircuitContinuation(selectedIds)}
                className="mt-2 flex h-7 w-full items-center justify-center gap-1.5 rounded bg-cyan-600 px-2 text-[10px] font-bold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
                <Route className="h-3 w-3" />
                Continuar {selectedCount}{' '}
                {selectedCount === 1 ? 'circuito' : 'circuitos'}
            </button>
        </div>
    );
}

/**
 * "Eliminar por tramo": lista los puntos INTERIORES de un cableado (no los 2
 * extremos, que son los artefactos anclados) para quitar uno sin borrar toda
 * la conexión — fusiona los dos tramos que tocaba en uno directo.
 */
function WireSegments({
    waypoints,
    onRemove,
}: {
    waypoints: Point2D[];
    onRemove: (vertexIndex: number) => void;
}) {
    return (
        <div className="mt-1 flex flex-wrap gap-1">
            {waypoints.slice(1, -1).map((_, i) => (
                <button
                    key={i}
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove(i + 1);
                    }}
                    title={`Quitar el punto intermedio ${i + 1} (une los dos tramos que tocaba)`}
                    className="rounded border border-slate-300 px-1.5 py-0.5 text-[9px] text-slate-500 hover:border-rose-400 hover:text-rose-600 dark:border-slate-700 dark:text-slate-400"
                >
                    Quitar tramo {i + 1}
                </button>
            ))}
        </div>
    );
}

type PropTab = 'general' | 'position' | 'config';

/** Propiedades de un elemento seleccionado, organizadas en pestañas para que
 * quepan en el ancho fijo del panel sin depender solo de scroll vertical. */
function ElementProperties({
    element,
    editor,
    modules,
}: {
    element: SiteElement;
    editor: UseSiteEditorReturn;
    modules: ModuleOption[];
}) {
    const isTopo =
        element.type === 'contour' ||
        element.type === 'spot_elevation' ||
        element.type === 'terrace_platform';
    const isFootprint =
        element.type !== 'ramp' && element.type !== 'stair' && !isTopo;
    const hasConfigTab =
        !!element.config ||
        element.type === 'building_block' ||
        // Tipos con configuración por defecto (canchas, áreas verdes, techados…) aunque el objeto sea anterior a esas opciones.
        defaultConfigFor(element.type) !== undefined ||
        NORM_AREA_TYPES.has(element.type) ||
        SITE_CALCULATION_AREA_TYPES.has(element.type);

    const tabs: Array<{ id: PropTab; label: string }> = [
        { id: 'general', label: 'General' },
        { id: 'position', label: 'Posición' },
        ...(hasConfigTab ? [{ id: 'config' as const, label: 'Config.' }] : []),
    ];
    const [tab, setTab] = useState<PropTab>('general');
    // `hasConfigTab` es fijo para un `element.id` dado (depende solo de su
    // tipo), así que no hace falta un efecto: si la pestaña ya no aplica,
    // se deriva directo en el render.
    const activeTab = tab === 'config' && !hasConfigTab ? 'general' : tab;

    const centroid = element.vertices.reduce(
        (a, v) => ({
            x: a.x + v.x / element.vertices.length,
            y: a.y + v.y / element.vertices.length,
        }),
        { x: 0, y: 0 },
    );
    const ground = editor.groundElevationAt(centroid.x, centroid.y);
    const abs = ground + (element.baseElevationM ?? 0);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 gap-1 border-b border-slate-200 px-2 pt-2 dark:border-white/10">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        className={`rounded-t-md px-2.5 py-1.5 text-[11px] font-semibold ${
                            activeTab === t.id
                                ? 'bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white'
                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="grid flex-1 gap-3 overflow-y-auto p-4">
                {activeTab === 'general' && (
                    <>
                        <label className="text-[11px] text-slate-500">
                            Nombre
                            <input
                                className={inputClass}
                                value={element.label}
                                onChange={(event) =>
                                    editor.updateSiteElement(element.id, {
                                        label: event.target.value,
                                    })
                                }
                            />
                        </label>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">Tipo</span>
                            <strong className="text-slate-900 dark:text-white">
                                {element.type}
                            </strong>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="text-[11px] text-slate-500">
                                Color
                                <input
                                    type="color"
                                    className="mt-1 h-8 w-full rounded-md border border-slate-200 dark:border-slate-700"
                                    value={element.style.fillColor}
                                    onChange={(event) =>
                                        editor.updateSiteElement(element.id, {
                                            style: {
                                                ...element.style,
                                                fillColor: event.target.value,
                                            },
                                        })
                                    }
                                />
                            </label>
                            <label className="text-[11px] text-slate-500">
                                Borde
                                <input
                                    type="color"
                                    className="mt-1 h-8 w-full rounded-md border border-slate-200 dark:border-slate-700"
                                    value={element.style.strokeColor}
                                    onChange={(event) =>
                                        editor.updateSiteElement(element.id, {
                                            style: {
                                                ...element.style,
                                                strokeColor: event.target.value,
                                            },
                                        })
                                    }
                                />
                            </label>
                        </div>
                        <label className="text-[11px] text-slate-500">
                            Opacidad (
                            {Math.round((element.style.opacity ?? 1) * 100)}%)
                            <input
                                type="range"
                                min={0.1}
                                max={1}
                                step={0.05}
                                value={element.style.opacity ?? 1}
                                onChange={(event) =>
                                    editor.updateSiteElement(element.id, {
                                        style: {
                                            ...element.style,
                                            opacity: Number(event.target.value),
                                        },
                                    })
                                }
                                className="mt-1 w-full"
                            />
                        </label>

                        {element.vertices.length >= 3 && (
                            <div className="rounded-lg border border-slate-200 p-2 text-xs dark:border-white/10">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500">Área</span>
                                    <strong>
                                        {(
                                            polygonArea(element.vertices) *
                                            editor.terrainScaleM *
                                            editor.terrainScaleM
                                        ).toFixed(1)}{' '}
                                        m²
                                    </strong>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500">
                                        Perímetro
                                    </span>
                                    <strong>
                                        {(
                                            polygonPerimeter(element.vertices) *
                                            editor.terrainScaleM
                                        ).toFixed(1)}{' '}
                                        m
                                    </strong>
                                </div>
                                {editor.terrainScaleM === 1 && (
                                    <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                                        Plano sin calibrar — usa “Calibrar
                                        plano”.
                                    </p>
                                )}
                                <p className="mt-1 text-[10px] text-slate-400">
                                    {element.vertices.length} vértices — clic en
                                    el punto claro de un lado para agregar uno
                                    nuevo ahí; doble clic en un vértice para
                                    quitarlo.
                                </p>
                            </div>
                        )}

                        {(element.type === 'building_block' ||
                            element.type === 'fence' ||
                            element.type === 'pool' ||
                            element.type === 'custom_zone') && (
                            <label className="text-[11px] text-slate-500">
                                {element.type === 'pool'
                                    ? 'Profundidad (m)'
                                    : 'Altura (m)'}
                                <input
                                    type="number"
                                    min={0}
                                    step="0.1"
                                    className={inputClass}
                                    value={
                                        element.heightM ??
                                        (element.type === 'pool' ? 1.4 : 0)
                                    }
                                    onChange={(event) =>
                                        editor.updateSiteElement(element.id, {
                                            heightM: Number(event.target.value),
                                        })
                                    }
                                />
                            </label>
                        )}
                    </>
                )}

                {activeTab === 'position' && (
                    <>
                        <label className="text-[11px] text-slate-500">
                            {isTopo
                                ? 'Cota (m)'
                                : editor.terrainModeled
                                  ? 'Cota sobre el terreno (m)'
                                  : 'Cota base (m)'}
                            <input
                                type="number"
                                step={isTopo ? 0.5 : 0.1}
                                className={inputClass}
                                value={element.baseElevationM ?? 0}
                                onChange={(event) =>
                                    editor.updateSiteElement(element.id, {
                                        baseElevationM: Number(
                                            event.target.value,
                                        ),
                                    })
                                }
                            />
                            {editor.terrainModeled && isFootprint && (
                                <span className="mt-0.5 block text-[10px] text-slate-400">
                                    Terreno natural aquí: {ground.toFixed(2)} m
                                    · cota absoluta ≈ {abs.toFixed(2)} m
                                </span>
                            )}
                        </label>

                        {POINT_ELEMENT_TYPES.has(element.type) &&
                            !isSpanGate(element) && (
                                <label className="text-[11px] text-slate-500">
                                    Rotación (°)
                                    <input
                                        type="number"
                                        step="15"
                                        className={inputClass}
                                        value={element.rotation ?? 0}
                                        onChange={(event) =>
                                            editor.updateSiteElement(
                                                element.id,
                                                {
                                                    rotation:
                                                        Number(
                                                            event.target.value,
                                                        ) % 360,
                                                },
                                            )
                                        }
                                    />
                                </label>
                            )}
                    </>
                )}

                {activeTab === 'config' && hasConfigTab && (
                    <>
                        <SiteElementConfigFields
                            element={element}
                            editor={editor}
                        />

                        {NORM_AREA_TYPES.has(element.type) && (
                            <SiteNormRequirementFields
                                element={element}
                                editor={editor}
                            />
                        )}

                        {(element.type === 'tg_location' ||
                            element.type === 'sub_panel') && (
                            <SiteAutoCircuitPanel
                                key={element.id}
                                element={element}
                                editor={editor}
                            />
                        )}

                        {SITE_CALCULATION_AREA_TYPES.has(element.type) &&

                            element.vertices.length >= 3 && (

                                <OpenLightingButton />

                            )}

                        {element.type === 'building_block' && (
                            <label className="text-[11px] text-slate-500">
                                Módulo vinculado
                                <select
                                    className={inputClass}
                                    value={element.moduleId ?? ''}
                                    onChange={(event) => {
                                        const moduleId = event.target.value
                                            ? Number(event.target.value)
                                            : undefined;
                                        const moduleName = modules.find(
                                            (item) => item.id === moduleId,
                                        )?.name;
                                        editor.updateSiteElement(element.id, {
                                            moduleId,
                                            moduleName,
                                        });
                                    }}
                                >
                                    <option value="">Sin vincular</option>
                                    {modules.map((module) => (
                                        <option
                                            key={module.id}
                                            value={module.id}
                                        >
                                            {module.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}
                    </>
                )}
            </div>

            <div className="flex shrink-0 items-center gap-2 border-t border-slate-200 p-3 dark:border-white/10">
                <button
                    type="button"
                    onClick={() =>
                        editor.updateSiteElement(element.id, {
                            visible: element.visible === false,
                        })
                    }
                    title={element.visible === false ? 'Mostrar' : 'Ocultar'}
                    className="flex-1 rounded-md border border-slate-200 py-1.5 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                >
                    {element.visible === false ? (
                        <EyeOff className="mx-auto h-3.5 w-3.5" />
                    ) : (
                        <Eye className="mx-auto h-3.5 w-3.5" />
                    )}
                </button>
                {!element.locked && editor.isFrozen(element) && (
                    <button
                        type="button"
                        onClick={() => editor.setBaseLocked(false)}
                        title="La base está bloqueada para que no se mueva al dibujar encima. Clic para desbloquearla y poder editar este objeto."
                        className="flex-1 rounded-md border border-amber-400 py-1.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/30"
                    >
                        Base bloqueada · Desbloquear
                    </button>
                )}
                <button
                    type="button"
                    onClick={() =>
                        editor.updateSiteElement(element.id, {
                            locked: !element.locked,
                        })
                    }
                    title={element.locked ? 'Desbloquear' : 'Bloquear'}
                    className="flex-1 rounded-md border border-slate-200 py-1.5 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                >
                    {element.locked ? (
                        <Lock className="mx-auto h-3.5 w-3.5" />
                    ) : (
                        <Unlock className="mx-auto h-3.5 w-3.5" />
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        const newId = editor.duplicateSiteElement(element.id);
                        if (newId) editor.selectElement(newId);
                    }}
                    title="Duplicar"
                    className="flex-1 rounded-md border border-slate-200 py-1.5 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                >
                    <Copy className="mx-auto h-3.5 w-3.5" />
                </button>
                <button
                    type="button"
                    onClick={() => {
                        editor.removeSiteElement(element.id);
                        editor.selectElement(null);
                    }}
                    title="Eliminar"
                    className="flex-1 rounded-md border border-rose-300 py-1.5 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/30"
                >
                    <Trash2 className="mx-auto h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}

/** Panel de gestión del plano importado (DXF/DWG convertido a imagen) — opacidad, visibilidad, calibrar, eliminar. */
function ImportedPlanPanel({ editor }: { editor: UseSiteEditorReturn }) {
    const plan = editor.siteData?.importedPlan;
    if (!plan) return null;

    return (
        <div className="border-b border-slate-200 p-4 dark:border-white/10">
            <p className="mb-2 text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                Plano importado
            </p>
            <p className="mb-1 truncate text-[11px] text-slate-600 dark:text-slate-300">
                {plan.originalName}
            </p>
            <p className="mb-2 text-[10px] text-slate-500">
                {editor.terrainScaleM === 1 ? (
                    <span className="text-amber-600 dark:text-amber-400">
                        Sin calibrar — 1 unidad del plano = 1 m
                    </span>
                ) : (
                    <>
                        Escala: 1 unidad = {editor.terrainScaleM.toPrecision(4)}{' '}
                        m
                    </>
                )}
            </p>
            <label className="text-[11px] text-slate-500">
                Opacidad ({Math.round(plan.opacity * 100)}%)
                <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={plan.opacity}
                    onChange={(event) =>
                        editor.updateImportedPlan({
                            opacity: Number(event.target.value),
                        })
                    }
                    className="mt-1 w-full"
                />
            </label>
            <div className="mt-2 flex items-center gap-2">
                <button
                    type="button"
                    onClick={() =>
                        editor.updateImportedPlan({ visible: !plan.visible })
                    }
                    title={plan.visible ? 'Ocultar' : 'Mostrar'}
                    className="flex-1 rounded-md border border-slate-200 py-1.5 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                >
                    {plan.visible ? (
                        <Eye className="mx-auto h-3.5 w-3.5" />
                    ) : (
                        <EyeOff className="mx-auto h-3.5 w-3.5" />
                    )}
                </button>
                <button
                    type="button"
                    onClick={editor.startCalibratePlan}
                    title="Calibrar con una distancia real conocida"
                    className="flex-1 rounded-md border border-slate-200 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                >
                    Calibrar
                </button>
                <button
                    type="button"
                    onClick={editor.removeImportedPlan}
                    title="Eliminar plano importado"
                    className="flex-1 rounded-md border border-rose-300 py-1.5 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/30"
                >
                    <Trash2 className="mx-auto h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}

/** Panel de calibración — aparece con los 2 clics ya hechos, pide la distancia real y fija la escala del emplazamiento. */
function CalibrationPanel({ editor }: { editor: UseSiteEditorReturn }) {
    const [distance, setDistance] = useState('');
    const [p1, p2] = editor.calibrationPoints;
    const measured = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const preview =
        Number(distance) > 0 && measured > 0
            ? Number(distance) / measured
            : null;

    return (
        <div className="border-b border-fuchsia-200 bg-fuchsia-50 p-4 dark:border-fuchsia-900/50 dark:bg-fuchsia-950/20">
            <p className="mb-2 text-[10px] font-bold tracking-wide text-fuchsia-600 uppercase dark:text-fuchsia-400">
                Calibrar plano
            </p>
            <p className="mb-2 text-[11px] text-slate-600 dark:text-slate-300">
                Distancia medida en el plano:{' '}
                <strong>{measured.toFixed(2)} u</strong>. ¿Cuánto mide esa misma
                distancia en la realidad?
            </p>
            {preview !== null && (
                <p className="mb-2 text-[10px] text-fuchsia-700 dark:text-fuchsia-300">
                    Escala resultante: 1 u = {preview.toPrecision(4)} m
                </p>
            )}
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    min={0}
                    step="0.01"
                    autoFocus
                    placeholder="Metros reales"
                    value={distance}
                    onChange={(event) => setDistance(event.target.value)}
                    className={inputClass}
                />
                <button
                    type="button"
                    disabled={!(Number(distance) > 0)}
                    onClick={() =>
                        editor.applyPlanCalibration(Number(distance))
                    }
                    className="h-8 shrink-0 rounded-md bg-fuchsia-600 px-3 text-xs font-semibold text-white disabled:opacity-40"
                >
                    Aplicar
                </button>
                <button
                    type="button"
                    onClick={editor.cancelCalibration}
                    className="h-8 shrink-0 rounded-md border border-slate-200 px-3 text-xs text-slate-600 dark:border-white/10 dark:text-slate-300"
                >
                    Cancelar
                </button>
            </div>
        </div>
    );
}

/** Lleva a la pestaña Iluminación de la paleta (proyección y cálculo viven ahí). */
function OpenLightingButton() {
    const setCategory = useSitePaletteStore((state) => state.setCategory);
    return (
        <button
            type="button"
            onClick={() => setCategory('lighting')}
            className="mt-3 w-full rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
        >
            Proyectar / calcular luminarias → Iluminación
        </button>
    );
}
