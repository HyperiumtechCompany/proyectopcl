/**
 * useElectricalDocument.ts
 *
 * Estado del documento eléctrico + derivados (motor puro) + autosave.
 * Mismo criterio de guardado que useDialuxProjectSync: fetch JSON debounced
 * con el token CSRF leído de la cookie (siempre vigente en sesiones largas).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { polygonAreaM2 } from '@/pages/dialux/geometry/polygonGeometry';
import { computeElectricalDerived } from './engine';
import type {
    ElectricalCatalogs,
    ElectricalDerived,
    ElectricalDocument,
    ElectricalFloor,
    ElectricalRoom,
    CalculatedLengths,
} from './engine/types';
import type { Scene } from '../hooks/types';
import { calculateConductorGroupLength } from '../hooks/wireLengthCalculations';

const AUTOSAVE_DEBOUNCE_MS = 2500;

export type ElectricalSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function newId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildEmptyDocument(): ElectricalDocument {
    const floorId = newId();

    return {
        version: 1,
        settings: {
            voltageV: 220,
            phases: 1,
            frequencyHz: 60,
            powerFactor: 0.9,
            referenceStandard: 'CNE-Utilización',
            cableReserveFactor: 1.1,
            installationCategory: 'residencial',
        },
        floors: [{ id: floorId, name: 'Piso 1', level: 1 }],
        rooms: [],
        luminaireTypes: [],
        roomLuminaires: [],
        roomOutlets: [],
        circuits: [],
        panels: [],
        feeders: [],
    };
}

function readXsrfTokenFromCookie(): string {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : '';
}

// ─── Import de ambientes desde el plano CAD (rooms poligonales) ──────────────

interface CadVertex {
    x: number;
    y: number;
}

interface CadRoom {
    id: string;
    name?: string;
    vertices?: CadVertex[];
    height?: number;
    illuminanceLux?: number;
    normativeActivity?: string;
}

export interface CadProjectData {
    scenes?: Scene[];
}

function polygonArea(vertices: CadVertex[]): number {
    return polygonAreaM2(vertices);
}

function polygonPerimeter(vertices: CadVertex[]): number {
    if (vertices.length < 2) {
        return 0;
    }
    let sum = 0;
    for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i];
        const b = vertices[(i + 1) % vertices.length];
        sum += Math.hypot(b.x - a.x, b.y - a.y);
    }
    return sum;
}

function boundingBox(vertices: CadVertex[]): { width: number; height: number } {
    if (vertices.length === 0) {
        return { width: 0, height: 0 };
    }
    const xs = vertices.map((v) => v.x);
    const ys = vertices.map((v) => v.y);
    return {
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
    };
}

/**
 * Importa los ambientes del plano CAD que aún no existen en el documento
 * (por sourceRoomId). Devuelve el documento actualizado y cuántos se importaron.
 */
export function importRoomsFromCad(
    doc: ElectricalDocument,
    cad: CadProjectData | null,
): { doc: ElectricalDocument; imported: number } {
    if (!cad?.scenes?.length) {
        return { doc, imported: 0 };
    }

    const existingSourceIds = new Set(
        doc.rooms.map((r) => r.sourceRoomId).filter(Boolean),
    );
    const floors = [...doc.floors];
    const rooms = [...doc.rooms];
    let imported = 0;

    for (const scene of cad.scenes) {
        const level = (scene.floorIndex ?? 0) + 1;
        let floor: ElectricalFloor | undefined = floors.find(
            (f) => f.level === level,
        );
        if (!floor) {
            floor = { id: newId(), name: scene.name || `Piso ${level}`, level };
            floors.push(floor);
        }

        for (const cadRoom of scene.rooms ?? []) {
            if (
                !cadRoom.vertices ||
                cadRoom.vertices.length < 3 ||
                existingSourceIds.has(cadRoom.id)
            ) {
                continue;
            }

            const area = polygonArea(cadRoom.vertices);
            const perimeter = polygonPerimeter(cadRoom.vertices);
            const box = boundingBox(cadRoom.vertices);

            const room: ElectricalRoom = {
                id: newId(),
                floorId: floor.id,
                name: cadRoom.name || `Ambiente ${rooms.length + 1}`,
                roomType: 'personalizado',
                lengthM: Number(box.width.toFixed(2)),
                widthM: Number(box.height.toFixed(2)),
                heightM: cadRoom.height ?? 2.7,
                areaOverrideM2: Number(area.toFixed(2)),
                perimeterOverrideM: Number(perimeter.toFixed(2)),
                requiredLux: cadRoom.illuminanceLux ?? 300,
                utilizationFactor: 0.6,
                maintenanceFactor: 0.8,
                observations: cadRoom.normativeActivity
                    ? `Actividad normativa: ${cadRoom.normativeActivity}`
                    : undefined,
                sourceRoomId: cadRoom.id,
            };

            rooms.push(room);
            imported++;
        }
    }

    if (imported === 0) {
        return { doc, imported: 0 };
    }

    return { doc: { ...doc, floors, rooms }, imported };
}

// ─── Hook principal ──────────────────────────────────────────────────────────

interface UseElectricalDocumentArgs {
    dialuxProjectId: string;
    initialDocument: ElectricalDocument | null;
    catalogs: ElectricalCatalogs;
    cadData: CadProjectData | null;
    saveUrl?: string;
}

export interface MaterializeOutletsArgs {
    circuitId: string;
    sourceRoomId: string;
    quantity: number;
    outletTypeCode: string;
    startOffset?: number | null;
    panelId?: string | null;
}

export type MaterializeOutletsResult =
    | {
          ok: true;
          message: string;
          createdCount: number;
          conductorsCreated: number;
      }
    | { ok: false; message: string };

export interface PlacePanelArgs {
    panelId: string;
    code: string;
    isRoot: boolean;
    floorLevel?: number | null;
}

export type PlacePanelResult =
    | { ok: true; message: string; created: boolean }
    | { ok: false; message: string };

export interface ElectricalDocumentApi {
    doc: ElectricalDocument;
    derived: ElectricalDerived;
    saveStatus: ElectricalSaveStatus;
    /** Mutación inmutable del documento; dispara recompute + autosave. */
    update: (fn: (doc: ElectricalDocument) => ElectricalDocument) => void;
    saveNow: () => Promise<void>;
    /**
     * Puente TD/TG (Fase D): pide al backend que dibuje en el plano CAD los
     * tomacorrientes que este circuito ya tiene calculados -- server-side
     * porque esta página y el editor de plano no comparten estado en vivo
     * (ver `ElectricalProjectController::materializeOutlets`).
     */
    materializeOutlets: (
        args: MaterializeOutletsArgs,
    ) => Promise<MaterializeOutletsResult>;
    /** Puente TD/TG (Fase D.1): ubica o renombra el símbolo de un tablero en el plano CAD. */
    placePanel: (args: PlacePanelArgs) => Promise<PlacePanelResult>;
}

export function useElectricalDocument({
    dialuxProjectId,
    initialDocument,
    catalogs,
    cadData,
    saveUrl = '/dialux/electrical',
}: UseElectricalDocumentArgs): ElectricalDocumentApi {
    const [doc, setDoc] = useState<ElectricalDocument>(
        () => initialDocument ?? buildEmptyDocument(),
    );
    const [saveStatus, setSaveStatus] = useState<ElectricalSaveStatus>('idle');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const skipNextSaveRef = useRef(true);
    const latestDocRef = useRef(doc);
    latestDocRef.current = doc;

    const derived = useMemo(() => {
        const calculatedLengths: CalculatedLengths = {};

        if (cadData?.scenes && cadData.scenes.length > 0) {
            for (const scene of cadData.scenes) {
                const conductors = scene.conductors ?? [];
                if (conductors.length === 0) continue;

                // Alimentadores
                for (const feeder of doc.feeders) {
                    const feederConds = conductors.filter(
                        (c) =>
                            (c.sourceId === feeder.fromPanelId &&
                                c.targetId === feeder.toPanelId) ||
                            (c.sourceId === feeder.toPanelId &&
                                c.targetId === feeder.fromPanelId),
                    );
                    if (feederConds.length > 0) {
                        const len = calculateConductorGroupLength(
                            scene,
                            feederConds.map((c) => c.id),
                        );
                        if (!calculatedLengths[feeder.id]) {
                            calculatedLengths[feeder.id] = {
                                horizontalLengthM: 0,
                                verticalLengthM: 0,
                                totalLengthM: 0,
                            };
                        }
                        calculatedLengths[feeder.id].horizontalLengthM +=
                            len.horizontalLengthM;
                        calculatedLengths[feeder.id].verticalLengthM +=
                            len.verticalLengthM;
                        calculatedLengths[feeder.id].totalLengthM +=
                            len.totalLengthM;
                    }
                }

                // Circuitos
                for (const circuit of doc.circuits) {
                    const circuitNodeIds = new Set<string>();
                    circuitNodeIds.add(circuit.panelId);

                    for (const rl of doc.roomLuminaires) {
                        if (rl.circuitId === circuit.id)
                            circuitNodeIds.add(rl.id);
                    }
                    for (const ro of doc.roomOutlets) {
                        if (ro.circuitId === circuit.id)
                            circuitNodeIds.add(ro.id);
                    }

                    const q = Array.from(circuitNodeIds);
                    const visitedNodes = new Set(q);
                    const visitedConductors = new Set<string>();

                    while (q.length > 0) {
                        const curr = q.shift()!;
                        for (const c of conductors) {
                            if (visitedConductors.has(c.id)) continue;

                            if (c.sourceId === curr || c.targetId === curr) {
                                const otherId =
                                    c.sourceId === curr
                                        ? c.targetId
                                        : c.sourceId;

                                // Evitar saltar a otros tableros
                                const isOtherPanel = doc.panels.some(
                                    (p) => p.id === otherId,
                                );
                                if (
                                    isOtherPanel &&
                                    otherId !== circuit.panelId
                                ) {
                                    continue;
                                }

                                visitedConductors.add(c.id);
                                if (!visitedNodes.has(otherId)) {
                                    visitedNodes.add(otherId);
                                    q.push(otherId);
                                }
                            }
                        }
                    }

                    if (visitedConductors.size > 0) {
                        const len = calculateConductorGroupLength(
                            scene,
                            Array.from(visitedConductors),
                        );
                        if (!calculatedLengths[circuit.id]) {
                            calculatedLengths[circuit.id] = {
                                horizontalLengthM: 0,
                                verticalLengthM: 0,
                                totalLengthM: 0,
                            };
                        }
                        calculatedLengths[circuit.id].horizontalLengthM +=
                            len.horizontalLengthM;
                        calculatedLengths[circuit.id].verticalLengthM +=
                            len.verticalLengthM;
                        calculatedLengths[circuit.id].totalLengthM +=
                            len.totalLengthM;
                    }
                }
            }
        }

        // FIXME: Necesitamos ver cómo obtener las longitudes!
        return computeElectricalDerived(doc, catalogs, calculatedLengths);
    }, [doc, catalogs, cadData]);
    const derivedRef = useRef(derived);
    derivedRef.current = derived;

    const persist = useCallback(
        async (document: ElectricalDocument): Promise<void> => {
            setSaveStatus('saving');
            const totals = derivedRef.current.totals;

            try {
                const response = await fetch(saveUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-XSRF-TOKEN': readXsrfTokenFromCookie(),
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        dialux_project_id: dialuxProjectId,
                        reference_standard: document.settings.referenceStandard,
                        voltage_v: document.settings.voltageV,
                        phases: document.settings.phases,
                        frequency_hz: document.settings.frequencyHz,
                        data: document,
                        total_rooms: totals.rooms,
                        total_luminaires: totals.luminaires,
                        total_outlets: totals.outlets,
                        total_panels: totals.panels,
                        installed_power_w:
                            Math.round(totals.installedPowerW * 100) / 100,
                        demand_power_w:
                            Math.round(totals.demandPowerW * 100) / 100,
                        derived_summary: {
                            version: 1,
                            panels: derivedRef.current.panels.map((panel) => {
                                const sourcePanel = document.panels.find(
                                    (candidate) =>
                                        candidate.id === panel.panelId,
                                );
                                const incomingFeeder = document.feeders.find(
                                    (candidate) =>
                                        candidate.toPanelId === panel.panelId,
                                );
                                const children =
                                    derivedRef.current.panels.filter(
                                        (candidate) =>
                                            panel.childPanelIds.includes(
                                                candidate.panelId,
                                            ),
                                    );
                                return {
                                    panelId: panel.panelId,
                                    panelLabel:
                                        sourcePanel?.code ??
                                        sourcePanel?.name ??
                                        panel.panelId,
                                    parentPanelId:
                                        sourcePanel?.parentPanelId ?? null,
                                    feederLengthM:
                                        incomingFeeder?.manualLengthM ??
                                        incomingFeeder?.lengthM ??
                                        0,
                                    circuitCount: panel.circuitCount,
                                    installedPowerW: panel.installedPowerW,
                                    demandPowerW: panel.demandPowerW,
                                    ownInstalledPowerW: Math.max(
                                        0,
                                        panel.installedPowerW -
                                            children.reduce(
                                                (sum, child) =>
                                                    sum + child.installedPowerW,
                                                0,
                                            ),
                                    ),
                                    ownDemandPowerW: Math.max(
                                        0,
                                        panel.demandPowerW -
                                            children.reduce(
                                                (sum, child) =>
                                                    sum + child.demandPowerW,
                                                0,
                                            ),
                                    ),
                                    currentA: panel.currentA,
                                    mainBreakerA: panel.mainBreakerA,
                                };
                            }),
                        },
                    }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                setSaveStatus('saved');
            } catch {
                setSaveStatus('error');
            }
        },
        [dialuxProjectId, saveUrl],
    );

    useEffect(() => {
        if (skipNextSaveRef.current) {
            skipNextSaveRef.current = false;
            return;
        }

        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
            void persist(doc);
        }, AUTOSAVE_DEBOUNCE_MS);

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [doc, persist]);

    // Flush final al desmontar para no perder los últimos cambios.
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                void persist(latestDocRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dialuxProjectId]);

    const update = useCallback(
        (fn: (d: ElectricalDocument) => ElectricalDocument) => {
            setDoc((prev) => fn(prev));
        },
        [],
    );

    const saveNow = useCallback(async () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        await persist(latestDocRef.current);
    }, [persist]);

    const materializeOutlets = useCallback(
        async (
            args: MaterializeOutletsArgs,
        ): Promise<MaterializeOutletsResult> => {
            try {
                const response = await fetch(
                    `/dialux/${dialuxProjectId}/electrico/materializar-tomacorrientes`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                            'X-XSRF-TOKEN': readXsrfTokenFromCookie(),
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                        credentials: 'same-origin',
                        body: JSON.stringify({
                            circuit_id: args.circuitId,
                            source_room_id: args.sourceRoomId,
                            quantity: args.quantity,
                            outlet_type_code: args.outletTypeCode,
                            start_offset: args.startOffset ?? null,
                            panel_id: args.panelId ?? null,
                        }),
                    },
                );
                const json: {
                    message?: string;
                    createdCount?: number;
                    conductorsCreated?: number;
                } = await response.json().catch(() => ({}));

                if (!response.ok) {
                    return {
                        ok: false,
                        message:
                            json.message ?? `Error HTTP ${response.status}`,
                    };
                }
                return {
                    ok: true,
                    message:
                        json.message ?? 'Tomacorrientes generados en el plano.',
                    createdCount: json.createdCount ?? 0,
                    conductorsCreated: json.conductorsCreated ?? 0,
                };
            } catch {
                return {
                    ok: false,
                    message: 'No se pudo conectar con el servidor.',
                };
            }
        },
        [dialuxProjectId],
    );

    const placePanel = useCallback(
        async (args: PlacePanelArgs): Promise<PlacePanelResult> => {
            try {
                const response = await fetch(
                    `/dialux/${dialuxProjectId}/electrico/ubicar-tablero`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                            'X-XSRF-TOKEN': readXsrfTokenFromCookie(),
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                        credentials: 'same-origin',
                        body: JSON.stringify({
                            panel_id: args.panelId,
                            code: args.code,
                            is_root: args.isRoot,
                            floor_level: args.floorLevel ?? null,
                        }),
                    },
                );
                const json: { message?: string; created?: boolean } =
                    await response.json().catch(() => ({}));

                if (!response.ok) {
                    return {
                        ok: false,
                        message:
                            json.message ?? `Error HTTP ${response.status}`,
                    };
                }
                return {
                    ok: true,
                    message: json.message ?? 'Tablero ubicado en el plano.',
                    created: json.created ?? true,
                };
            } catch {
                return {
                    ok: false,
                    message: 'No se pudo conectar con el servidor.',
                };
            }
        },
        [dialuxProjectId],
    );

    return {
        doc,
        derived,
        saveStatus,
        update,
        saveNow,
        materializeOutlets,
        placePanel,
    };
}
