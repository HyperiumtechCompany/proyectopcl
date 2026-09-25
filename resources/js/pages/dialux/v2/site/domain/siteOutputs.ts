import { createScaleConfig } from '@/pages/dialux/hooks/storeHelpers';
import {
    DEFAULT_OUTLET_POWER_W,
    type Conductor,
    type ElectricalDevice,
    type Fixture,
    type Scene,
} from '@/pages/dialux/hooks/types';
import {
    calculatePanelCircuitSummaries,
    type PanelCircuitSummary,
} from '@/pages/dialux/hooks/wireLengthCalculations';
import type { ElectricalNetworkData } from '../../electrical-network/domain/types';
import { poleInstalledPowerW } from './exteriorLightingPort';
import { gateEntrance, gateLightsPowerW } from './gateLayout';
import { canopyLightCount, canopyLights } from './siteLightPlacement';
import { siteCircuitLengthM } from './siteNetworkBridge';
import { normalizeTgOutputs } from './tgPanel';
import type { SiteCircuit, SiteData, SiteElement } from './types';

/**
 * Salidas de los tableros de la Planta General (Fase 4) calculadas con el
 * MISMO motor CT por luminaria de la V1
 * (`hooks/wireLengthCalculations.ts::calculatePanelCircuitSummaries`), sin
 * modificarlo: cada tablero de la planta se traduce a una escena V1
 * equivalente y el motor hace todo el cálculo (potencia luminaria por
 * luminaria, balance de fases, factores K1/K2, ρ por temperatura, ITM/DIF,
 * capacidad del cable, ΔU con su límite y la alerta de circuito mixto
 * alumbrado + tomacorriente).
 *
 * Traducción planta → escena V1:
 *  - tablero (TG / sub tablero) → `sub_panel` (en la V1 la fila resumen de un
 *    `main_panel` solo suma sus TD, no sus circuitos directos), con la tensión
 *    y fases de la red y `upstreamVoltageDropV` = caída que la red calculó
 *    hasta ese tablero (el mismo mecanismo que Red y CT usa con los módulos).
 *    `lengthM`/`sectionMm2` del tablero en 0: su alimentador ya lo calcula la
 *    red, no se cuenta dos veces.
 *  - poste / portón con luces → una luminaria con su potencia real;
 *    tomacorriente → `outlet_waterproof` con su potencia; caja de pase /
 *    buzón / otros → `junction_box` (paso).
 *  - cable → conductor `floor` con la longitud EXACTA de la planta
 *    (`siteCircuitLengthM`: catenaria, zanja, cotas, desperdicio). Los nodos
 *    se ubican en línea a esa distancia; la V1 suma 5 cm de holgura por
 *    extremo, que se descuentan aquí para que el total coincida.
 *  - 2–3 conductores = 1Φ (fases R/S/T repartidas entre salidas); 4+ = 3Φ.
 */

export const OUTLET_REFERENCE_W = DEFAULT_OUTLET_POWER_W;
const ASSUMED_SECTION_MM2 = 2.5;
const DEFAULT_CONDUCTOR = 'THW-90';
/** Holgura que la V1 suma por conductor (5 cm por extremo, `nodeVerticalAllowance`). */
const V1_SLACK_PER_CONDUCTOR_M = 0.1;
const PANEL_TYPES = new Set<SiteElement['type']>(['tg_location', 'sub_panel']);
const PHASE_ROTATION = ['R', 'S', 'T'] as const;

export function siteElementLoadW(element: SiteElement): {
    watts: number;
    estimated: boolean;
} {
    if (element.visible === false) return { watts: 0, estimated: false };
    if (element.type === 'pole') return poleInstalledPowerW(element);
    if (element.type === 'gate') {
        return { watts: gateLightsPowerW(element), estimated: false };
    }
    if (element.type === 'canopy') {
        const lights = canopyLights(element);
        return {
            watts: lights ? canopyLightCount(lights) * lights.wattage : 0,
            estimated: false,
        };
    }
    if (element.type === 'outlet') {
        const powerW =
            element.config?.kind === 'outlet' ? element.config.powerW : undefined;
        return {
            watts: powerW ?? OUTLET_REFERENCE_W,
            estimated: powerW === undefined,
        };
    }
    return { watts: 0, estimated: false };
}

/** Fila CT de una salida de tablero de la planta: la fila del motor V1 + contexto de la planta. */
export interface SiteOutputRow extends PanelCircuitSummary {
    /** Tablero de la planta (`SiteElement.id`) del que sale el circuito. */
    panelElementId: string;
    /** Salida del TG (o etiqueta del cable raíz). */
    outputLabel: string;
    /** Destino del primer tramo (p.ej. "Poste 3"). */
    firstTargetLabel: string;
    /** "3×100 W alumbrado + 1×180 W tomacorriente" (detalle del motor V1). */
    loadsDetail: string;
    /** Todos los cables (`SiteCircuit.id`) de la rama de esta salida. */
    circuitIds: string[];
    assumptions: string[];
}

export interface SiteOutputsAnalysis {
    rows: SiteOutputRow[];
    /** Carga propia de cada tablero de la planta por sus salidas (por `SiteElement.id`). */
    panelLoads: Map<string, { installed: number; demand: number }>;
    /** Cargas (postes, portones…) ya alimentadas por una salida de tablero. */
    coveredLoadIds: Set<string>;
}

interface Settings {
    nominalVoltageV: number;
    phases: 1 | 3;
    connectionType: 'star' | 'delta';
    defaultPowerFactor: number;
    designFactor?: number;
}

const isStop = (element: SiteElement | undefined) =>
    !element ||
    PANEL_TYPES.has(element.type) ||
    element.type === 'building_block' ||
    // suministro / transferencia / respaldo: ese cable es un alimentador
    element.type === 'transformer' ||
    element.type === 'ats' ||
    element.type === 'generator';

/**
 * Subida (m) por el equipo desde el nivel del cable hasta el punto de
 * conexión: altura del poste, de las luces del portón, del alero del techado
 * o de montaje del tomacorriente. Declarada como supuesto en cada fila.
 */
function equipmentRiserM(element: SiteElement): number {
    const config = element.config;
    if (element.type === 'pole') {
        return config?.kind === 'pole' ? config.heightM : (element.heightM ?? 6);
    }
    if (element.type === 'gate' && config?.kind === 'gate') {
        const { lights } = gateEntrance(config);
        return lights.enabled ? lights.heightM : 0;
    }
    if (element.type === 'canopy' && config?.kind === 'canopy') {
        return config.heightM;
    }
    if (element.type === 'outlet' && config?.kind === 'outlet') {
        // 0,4 m por defecto (zócalo exterior, `OutletConfig`): datos viejos sin altura.
        return Number.isFinite(config.heightM) ? config.heightM : 0.4;
    }
    return 0;
}

/** Escena V1 vacía en metros (mismos defaults que un módulo nuevo). */
function blankScene(id: string, name: string): Scene {
    return {
        id,
        name,
        floorIndex: 0,
        floorElevation: 0,
        floorHeight: 3,
        scaleConfig: createScaleConfig('m', 1, 'Metros (1 = 1m)'),
        rooms: [],
        walls: [],
        windows: [],
        doors: [],
        canopies: [],
        fixtures: [],
        lightSwitches: [],
        conductors: [],
        junctionBoxes: [],
        electricalDevices: [],
        partitions: [],
        visible: true,
    };
}

/**
 * Traduce UN tablero de la planta y sus salidas a una escena V1. Devuelve la
 * escena y lo necesario para rotular las filas.
 */
export function buildSitePanelScene(
    site: SiteData,
    panel: SiteElement,
    settings: Settings,
): {
    scene: Scene;
    rootOutputLabel: Map<string, string>;
    firstTargetLabel: Map<string, string>;
    loadIds: Set<string>;
    estimatedLoads: boolean;
    assumedSectionCircuitIds: Set<string>;
    /** Cable → cable raíz (salida) de su rama. */
    rootOfCircuit: Map<string, string>;
} {
    const elements = site.elements ?? [];
    const byId = new Map(elements.map((element) => [element.id, element]));
    const scaleM = site.terrainScaleM || 1;
    const incident = new Map<string, SiteCircuit[]>();
    for (const circuit of site.circuits ?? []) {
        for (const end of [circuit.sourceId, circuit.targetId]) {
            incident.set(end, [...(incident.get(end) ?? []), circuit]);
        }
    }

    const scene = blankScene(`site-${panel.id}`, panel.label);
    const devices: ElectricalDevice[] = [
        {
            id: panel.id,
            type: 'sub_panel',
            x: 0,
            y: 0,
            label: panel.label || 'TG',
            mountingHeight: 0,
            properties: {
                voltage: `${settings.nominalVoltageV}V`,
                phases: settings.phases === 3 ? '3Φ' : '1Φ',
                connectionType: settings.connectionType,
                defaultPowerFactor: settings.defaultPowerFactor,
                designFactor: settings.designFactor ?? 1.25,
                // La caída de aguas arriba se suma en % después (ver
                // `analyzeSiteOutputs`): el motor V1 mezclaría la base de
                // línea (3Φ) con la de fase de sus circuitos 1Φ.
                upstreamVoltageDropV: 0,
                lengthM: 0,
                sectionMm2: 0,
            },
        } as unknown as ElectricalDevice,
    ];
    const fixtures: Fixture[] = [];
    const conductors: Conductor[] = [];
    const rootOutputLabel = new Map<string, string>();
    const firstTargetLabel = new Map<string, string>();
    const loadIds = new Set<string>();
    const assumedSectionCircuitIds = new Set<string>();
    const rootOfCircuit = new Map<string, string>();
    let estimatedLoads = false;

    const outputs =
        panel.type === 'tg_location'
            ? normalizeTgOutputs(
                  panel.config?.kind === 'tg' ? panel.config.outputs : undefined,
              )
            : [];
    const position = new Map<string, number>([[panel.id, 0]]);
    const placed = new Set<string>([panel.id]);
    const usedCircuits = new Set<string>();

    const addNode = (element: SiteElement, x: number) => {
        const load = siteElementLoadW(element);
        if (
            load.watts > 0 &&
            (element.type === 'pole' ||
                element.type === 'gate' ||
                element.type === 'canopy')
        ) {
            fixtures.push({
                id: element.id,
                name: element.label,
                x,
                y: 0,
                z: 0,
                mountingHeight: 0,
                power: load.watts,
            } as unknown as Fixture);
        } else if (element.type === 'outlet') {
            devices.push({
                id: element.id,
                type: 'outlet_waterproof',
                x,
                y: 0,
                label: element.label,
                mountingHeight: 0,
                properties: { ratedPowerW: load.watts },
            } as unknown as ElectricalDevice);
        } else {
            devices.push({
                id: element.id,
                type: 'junction_box',
                x,
                y: 0,
                label: element.label,
                mountingHeight: 0,
                properties: {},
            } as unknown as ElectricalDevice);
        }
        if (load.watts > 0) {
            loadIds.add(element.id);
            estimatedLoads ||= load.estimated;
        }
    };

    // Recorre las ramas desde el tablero, sin cruzar a otro tablero/bloque/trafo.
    const queue: Array<{
        from: string;
        circuit: SiteCircuit;
        rootIndex: number;
        rootId: string;
    }> = (incident.get(panel.id) ?? []).map((circuit, rootIndex) => ({
        from: panel.id,
        circuit,
        rootIndex,
        rootId: circuit.id,
    }));
    while (queue.length > 0) {
        const { from, circuit, rootIndex, rootId } = queue.shift()!;
        if (usedCircuits.has(circuit.id)) continue;
        usedCircuits.add(circuit.id);
        const toId =
            circuit.sourceId === from ? circuit.targetId : circuit.sourceId;
        const to = byId.get(toId);
        if (!to || isStop(to) || placed.has(toId)) continue;
        // Recorrido dibujado + subida por el equipo hasta la luminaria o el
        // tomacorriente (una sola vez por equipo, aunque la rama siga).
        const lengthM =
            siteCircuitLengthM(circuit, elements, scaleM) + equipmentRiserM(to);
        const x =
            (position.get(from) ?? 0) +
            Math.max(0, lengthM - V1_SLACK_PER_CONDUCTOR_M);
        position.set(toId, x);
        placed.add(toId);
        rootOfCircuit.set(circuit.id, rootId);
        addNode(to, x);
        const isRoot = from === panel.id;
        const phases: 1 | 3 = circuit.wireCount >= 4 ? 3 : 1;
        if (circuit.sectionMm2 === undefined) {
            assumedSectionCircuitIds.add(circuit.id);
        }
        conductors.push({
            id: circuit.id,
            sourceId: from,
            targetId: toId,
            wireCount: circuit.wireCount,
            wireLabel: circuit.wireLabel,
            routeType: 'floor',
            tubeSize: 20,
            conductorType: circuit.conductorType ?? DEFAULT_CONDUCTOR,
            sectionMm2: circuit.sectionMm2 ?? ASSUMED_SECTION_MM2,
            waypoints: [],
            ...(isRoot
                ? {
                      ct: {
                          system: phases,
                          ...(phases === 1
                              ? {
                                    phaseBalance:
                                        circuit.phase ??
                                        PHASE_ROTATION[rootIndex % 3],
                                }
                              : {}),
                      },
                  }
                : {}),
        } as unknown as Conductor);
        if (isRoot) {
            rootOutputLabel.set(
                circuit.id,
                outputs.find((output) => output.id === circuit.tgOutputId)
                    ?.label ??
                    circuit.label ??
                    `Salida ${rootIndex + 1}`,
            );
            firstTargetLabel.set(circuit.id, to.label);
        }
        for (const next of incident.get(toId) ?? []) {
            if (!usedCircuits.has(next.id)) {
                queue.push({ from: toId, circuit: next, rootIndex, rootId });
            }
        }
    }

    scene.fixtures = fixtures;
    scene.electricalDevices = devices;
    scene.conductors = conductors;
    return {
        scene,
        rootOutputLabel,
        firstTargetLabel,
        loadIds,
        estimatedLoads,
        assumedSectionCircuitIds,
        rootOfCircuit,
    };
}

/**
 * @param upstreamVoltageDropPercent caída (%) acumulada desde el suministro
 *   hasta cada tablero de la planta, por `SiteElement.id` — la calcula la red.
 *   Se SUMA en % a la caída propia de cada salida (exacto en 380/220 V
 *   balanceado), en vez de pasar voltios al motor V1.
 */
export function analyzeSiteOutputs(
    site: SiteData | null | undefined,
    settings: Settings,
    upstreamVoltageDropPercent: (panelElementId: string) => number = () => 0,
): SiteOutputsAnalysis {
    const rows: SiteOutputRow[] = [];
    const panelLoads = new Map<string, { installed: number; demand: number }>();
    const coveredLoadIds = new Set<string>();
    if (!site || (site.circuits ?? []).length === 0) {
        return { rows, panelLoads, coveredLoadIds };
    }

    for (const panel of site.elements ?? []) {
        if (!PANEL_TYPES.has(panel.type)) continue;
        const built = buildSitePanelScene(site, panel, settings);
        const upstreamPercent = upstreamVoltageDropPercent(panel.id);
        if ((built.scene.conductors ?? []).length === 0) continue;
        const panelRows = calculatePanelCircuitSummaries(built.scene).filter(
            (row) => !row.isPanelSummary,
        );
        let installed = 0;
        let demand = 0;
        for (const row of panelRows) {
            installed += row.installedPowerW;
            demand += row.maximumDemandKw * 1000;
            const assumptions: string[] = [];
            if (built.assumedSectionCircuitIds.has(row.rootConductorId)) {
                assumptions.push(
                    `Sección supuesta ${ASSUMED_SECTION_MM2} mm² (defínela en el cable).`,
                );
            }
            if (built.estimatedLoads) {
                assumptions.push(
                    'Incluye potencias de referencia (poste sin luminaria / tomacorriente sin potencia).',
                );
            }
            assumptions.push(
                'Incluye la subida por el equipo (altura del poste / luminaria / tomacorriente).',
            );
            // Caída acumulada = % hasta el tablero + % propio de la salida,
            // en la base con la que el motor V1 evalúa ESA salida (220 V en
            // 1Φ, tensión del tablero en 3Φ).
            const base = row.phases === 1 ? 220 : row.voltageV;
            const ownPercent = base > 0 ? (row.voltageDropV / base) * 100 : 0;
            const accumulatedPercent = upstreamPercent + ownPercent;
            const upstreamV = (upstreamPercent / 100) * base;
            rows.push({
                ...row,
                upstreamVoltageDropV: upstreamV,
                voltageDropV: row.voltageDropV + upstreamV,
                voltageDropPct: accumulatedPercent,
                voltageDropOk: accumulatedPercent < row.maxVoltageDropPct,
                panelElementId: panel.id,
                outputLabel:
                    built.rootOutputLabel.get(row.rootConductorId) ?? row.code,
                firstTargetLabel:
                    built.firstTargetLabel.get(row.rootConductorId) ?? '?',
                loadsDetail: row.rooms.map((room) => room.detail).join(' + '),
                circuitIds: [...built.rootOfCircuit.entries()]
                    .filter(([, rootId]) => rootId === row.rootConductorId)
                    .map(([circuitId]) => circuitId),
                assumptions,
            });
        }
        built.loadIds.forEach((id) => coveredLoadIds.add(id));
        if (installed > 0) panelLoads.set(panel.id, { installed, demand });
    }
    return { rows, panelLoads, coveredLoadIds };
}

/**
 * Cargas propias de los tableros de la planta indexadas por NODO de la red
 * (vía `node.siteElementId`), para `calculateElectricalNetwork(extraLoads)`.
 */
export function siteOutputLoadsByNode(
    network: ElectricalNetworkData,
    analysis: SiteOutputsAnalysis,
): Map<string, { installed: number; demand: number }> {
    const result = new Map<string, { installed: number; demand: number }>();
    for (const node of network.nodes) {
        if (
            !node.siteElementId ||
            node.type === 'service' ||
            node.type === 'meter'
        ) {
            continue;
        }
        const load = analysis.panelLoads.get(node.siteElementId);
        if (load) result.set(node.id, load);
    }
    return result;
}
