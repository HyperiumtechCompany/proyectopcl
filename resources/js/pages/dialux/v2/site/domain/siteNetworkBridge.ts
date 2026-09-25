import { canConnect } from '../../electrical-network/domain/graph';
import type {
    ElectricalEdge,
    ElectricalNetworkData,
    ElectricalNode,
    ModuleElectricalPort,
} from '../../electrical-network/domain/types';
import { feederLengthBreakdown } from './aerialCableGeometry';
import { cableWaypointElevations } from './cableElevation';
import type { SiteCircuit, SiteData, SiteElement } from './types';
import { resolveWireEndpoints } from './wireAnchors';

/**
 * Puente Planta General → Red y CT (Fase 2 del plan
 * `planes/Dialuxv2/plan_compatibilizacion_planta_general_red_ct.md`).
 *
 * La planta (`SiteData`) y la red (`ElectricalNetworkData`) son documentos
 * distintos; este módulo, PURO, incorpora a la red lo que el cliente dibujó en
 * la planta:
 *  - cada `tg_location` → nodo `main_panel` (el primero reclama el TG que ya
 *    trae la red; los siguientes se crean con su PROPIO suministro y medidor),
 *  - cada `sub_panel` → nodo `site_panel`,
 *  - cada `SiteCircuit` que une dos tableros → alimentador con la longitud
 *    real del recorrido dibujado (`lengthMode: 'site'`).
 *
 * Reglas (agregar, no destruir):
 *  - Idempotente: ids deterministas (`site-…`) y vínculos guardados en la red
 *    (`node.siteElementId`, `edge.siteCircuitId`); re-aplicarlo no duplica.
 *  - Nunca borra nodos/aristas creados por el usuario ni cambia un
 *    alimentador puesto a mano: si choca, lo reporta en `conflicts`.
 *  - Suministro dinámico: un TG de la planta sin alimentador recupera su
 *    suministro propio; si el usuario lo reconecta a otro medidor/TG, la
 *    cadena propia que quedó vacía se retira sola (solo la creada aquí).
 *  - Los nombres se copian de la planta solo al crear el nodo — después el
 *    usuario puede renombrarlo en la red sin que se pise.
 *  - Borrar un objeto o cable en la planta no borra su nodo/arista: queda
 *    reportado como huérfano (la acción de retirarlo es de la Fase 5).
 */

type SitePanelKind = 'tg' | 'sub' | 'ats';

export interface SiteBridgeConflict {
    code:
        | 'feeder-taken'
        | 'cycle'
        | 'orphan-node'
        | 'orphan-edge'
        | 'block-unlinked'
        | 'module-no-panel'
        | 'module-panel-ambiguous'
        | 'backup-source';
    message: string;
    siteElementId?: string;
    siteCircuitId?: string;
    nodeId?: string;
    edgeId?: string;
}

export interface SiteBridgeResult {
    data: ElectricalNetworkData;
    changed: boolean;
    addedNodes: number;
    addedEdges: number;
    conflicts: SiteBridgeConflict[];
}

export const sitePanelNodeId = (elementId: string) => `site-${elementId}`;
const supplyNodeId = (elementId: string) => `site-supply-${elementId}`;
const meterNodeId = (elementId: string) => `site-meter-${elementId}`;
const supplyEdgeId = (elementId: string) => `site-supply-edge-${elementId}`;
const meterEdgeId = (elementId: string) => `site-meter-edge-${elementId}`;
export const siteCircuitEdgeId = (circuitId: string) =>
    `site-circuit-${circuitId}`;
const modulePortNodeId = (moduleId: number, panelId: string) =>
    `site-port-${moduleId}-${panelId}`;

export interface SiteBridgeOptions {
    /** Tableros publicados por cada módulo (los mismos que usa la red). */
    ports?: ModuleElectricalPort[];
    /**
     * Subida vertical (m) hasta el tablero dentro de su módulo (elevación del
     * piso + altura de montaje), si se conoce — se suma al cable de la planta.
     */
    panelVerticalM?: (panelId: string) => number | undefined;
}

/**
 * Tableros raíz de un módulo (sin padre dentro del módulo): a los que llega
 * un cable desde la planta general.
 */
export function moduleRootPorts(
    ports: ModuleElectricalPort[],
    moduleId: number,
): ModuleElectricalPort[] {
    return ports.filter(
        (port) => port.moduleId === moduleId && !port.parentPanelId,
    );
}

function sitePanelKind(element: SiteElement): SitePanelKind | null {
    if (element.type === 'tg_location') return 'tg';
    if (element.type === 'sub_panel') return 'sub';
    if (element.type === 'ats') return 'ats';
    return null;
}

/** Rango aguas arriba: el cable va del de mayor rango al de menor. */
const PANEL_RANK: Record<SitePanelKind, number> = { tg: 2, sub: 1, ats: 2.5 };
/** Transformador de la planta: punto de suministro (encima de cualquier TG). */
const SUPPLY_RANK = 3;
const SUPPLY_TYPES = new Set<SiteElement['type']>(['transformer']);

/**
 * Longitud (m) de un cable de la planta para el cálculo — la MISMA fórmula
 * que muestra la lista de objetos (`SiteObjectsPanel`): extremos en vivo,
 * catenaria/zanja, cotas de plataformas y reserva por desperdicio.
 */
export function siteCircuitLengthM(
    circuit: SiteCircuit,
    elements: SiteElement[],
    scaleM: number,
): number {
    const waypoints = resolveWireEndpoints(
        circuit.waypoints,
        circuit.sourceId,
        circuit.targetId,
        (id) => elements.find((element) => element.id === id),
        scaleM,
        circuit.tgOutputId,
    );
    return feederLengthBreakdown(
        waypoints,
        scaleM,
        circuit.route,
        circuit.segmentModes,
        cableWaypointElevations(waypoints, elements, scaleM),
        circuit.wastePct ?? 5,
    ).totalM;
}

function baseEdge(
    id: string,
    sourceNodeId: string,
    targetNodeId: string,
    label: string,
): ElectricalEdge {
    return {
        id,
        sourceNodeId,
        targetNodeId,
        label,
        origin: 'site',
        lengthMode: 'manual',
        horizontalLengthM: 0,
        verticalLengthM: 0,
        conductorType: 'N2XOH',
        conductorMaterial: 'copper',
        sectionMm2: 10,
        wireConfiguration: '3F+N+T',
        powerFactor: 0.9,
    };
}

export function applySiteToNetwork(
    network: ElectricalNetworkData,
    site: SiteData | null | undefined,
    options: SiteBridgeOptions = {},
): SiteBridgeResult {
    const unchanged: SiteBridgeResult = {
        data: network,
        changed: false,
        addedNodes: 0,
        addedEdges: 0,
        conflicts: [],
    };
    if (!site) return unchanged;

    let nodes = [...network.nodes];
    let edges = [...network.edges];
    let changed = false;
    let addedNodes = 0;
    let addedEdges = 0;
    const conflicts: SiteBridgeConflict[] = [];

    const elements = site.elements ?? [];
    const panels = elements.filter((element) => sitePanelKind(element));
    const panelKindById = new Map(
        panels.map((element) => [element.id, sitePanelKind(element)!]),
    );

    let nextY =
        nodes.reduce((max, node) => Math.max(max, node.position.y), 0) + 180;
    const hasNode = (id: string) => nodes.some((node) => node.id === id);
    const addNode = (node: ElectricalNode) => {
        nodes.push(node);
        addedNodes += 1;
        changed = true;
    };
    const addEdge = (edge: ElectricalEdge) => {
        edges.push(edge);
        addedEdges += 1;
        changed = true;
    };
    /** Dos TG llamados "TG" en la planta se distinguen en la red: TG, TG-2… */
    const uniqueLabel = (label: string) => {
        const taken = new Set(nodes.map((node) => node.label));
        if (!taken.has(label)) return label;
        let index = 2;
        while (taken.has(`${label}-${index}`)) index += 1;
        return `${label}-${index}`;
    };
    /** Nodo de TABLERO vinculado a un objeto (no su suministro/medidor). */
    const panelNodeFor = (elementId: string) =>
        nodes.find(
            (node) =>
                node.siteElementId === elementId &&
                node.type !== 'service' &&
                node.type !== 'meter',
        );

    // 1. Tableros de la planta → nodos.
    for (const element of panels) {
        if (panelNodeFor(element.id)) continue;
        const kind = panelKindById.get(element.id)!;
        const label =
            element.label ||
            (kind === 'tg' ? 'TG' : kind === 'ats' ? 'ATS' : 'TD');
        if (kind === 'ats') {
            // Tablero de transferencia: nodo de paso entre el suministro y los TG.
            addNode({
                id: sitePanelNodeId(element.id),
                type: 'ats',
                label: uniqueLabel(label),
                origin: 'site',
                siteElementId: element.id,
                position: { x: 440, y: nextY },
            });
            nextY += 150;
            continue;
        }
        if (kind === 'tg') {
            // El primer TG dibujado ES el TG que la red ya tenía.
            const unclaimed = nodes.find(
                (node) => node.type === 'main_panel' && !node.siteElementId,
            );
            if (unclaimed) {
                nodes = nodes.map((node) =>
                    node.id === unclaimed.id
                        ? { ...node, siteElementId: element.id }
                        : node,
                );
                changed = true;
                continue;
            }
            addNode({
                id: sitePanelNodeId(element.id),
                type: 'main_panel',
                label: uniqueLabel(label),
                origin: 'site',
                siteElementId: element.id,
                position: { x: 560, y: nextY },
            });
            nextY += 180;
            continue;
        }
        addNode({
            id: sitePanelNodeId(element.id),
            type: 'site_panel',
            label: uniqueLabel(label),
            origin: 'site',
            siteElementId: element.id,
            panelRole: 'distribution',
            position: { x: 820, y: nextY },
        });
        nextY += 150;
    }

    // 1b. Suministros dibujados (transformador) → nodo Suministro. El primero
    //     ES el suministro que la red ya tenía; otro transformador trae su
    //     propio medidor (un segundo punto de suministro real).
    const supplyNodeFor = (elementId: string) =>
        nodes.find(
            (node) => node.siteElementId === elementId && node.type === 'service',
        );
    for (const element of elements) {
        if (!SUPPLY_TYPES.has(element.type) || supplyNodeFor(element.id)) {
            continue;
        }
        const root = nodes.find(
            (node) =>
                node.id === network.rootNodeId &&
                node.type === 'service' &&
                !node.siteElementId,
        );
        if (root) {
            nodes = nodes.map((node) =>
                node.id === root.id
                    ? { ...node, siteElementId: element.id }
                    : node,
            );
            changed = true;
            continue;
        }
        const label = element.label || 'Transformador';
        addNode({
            id: supplyNodeId(element.id),
            type: 'service',
            label: uniqueLabel(label),
            origin: 'site',
            siteElementId: element.id,
            position: { x: 80, y: nextY },
        });
        addNode({
            id: meterNodeId(element.id),
            type: 'meter',
            label: `Medidor ${label}`,
            origin: 'site',
            siteElementId: element.id,
            position: { x: 320, y: nextY },
        });
        addEdge(
            baseEdge(
                supplyEdgeId(element.id),
                supplyNodeId(element.id),
                meterNodeId(element.id),
                `${label} → Medidor`,
            ),
        );
        nextY += 180;
    }
    const rankOf = (elementId: string): number => {
        const kind = panelKindById.get(elementId);
        if (kind) return PANEL_RANK[kind];
        const element = elements.find((item) => item.id === elementId);
        return element && SUPPLY_TYPES.has(element.type) ? SUPPLY_RANK : 0;
    };

    // 2. Cables → alimentadores (suministro/tablero → tablero y tablero → bloque de módulo).
    const scaleM = site.terrainScaleM || 1;
    const ports = options.ports ?? [];
    const blockById = new Map(
        elements
            .filter((element) => element.type === 'building_block')
            .map((element) => [element.id, element]),
    );

    /**
     * Nodos de TODOS los tableros del módulo (reusa los que ya estén en la
     * red, p.ej. importados con "Agregar estructura al lienzo") y sus tramos
     * internos padre → hijo cuando falten. Los tramos internos se crean en
     * modo manual a 0 m: el efecto de resincronización de la red los mide
     * con la geometría real del módulo (`deriveAutoEdgeLength`).
     */
    const ensureModulePorts = (
        moduleId: number,
        near: ElectricalNode,
    ): Map<string, ElectricalNode> => {
        const byPanel = new Map<string, ElectricalNode>();
        const modulePorts = ports.filter((port) => port.moduleId === moduleId);
        let row = 0;
        for (const port of modulePorts) {
            const existing = nodes.find(
                (node) =>
                    node.type === 'module_panel_port' &&
                    node.moduleId === moduleId &&
                    node.deviceId === port.panelId,
            );
            if (existing) {
                byPanel.set(port.panelId, existing);
                continue;
            }
            const node: ElectricalNode = {
                id: modulePortNodeId(moduleId, port.panelId),
                type: 'module_panel_port',
                label: port.panelLabel,
                moduleId,
                moduleName: port.moduleName,
                sceneId: port.sceneId,
                sceneName: port.sceneName,
                deviceId: port.panelId,
                panelRole: port.panelRole,
                origin: 'site',
                position: {
                    x: near.position.x + 260 + (port.parentPanelId ? 240 : 0),
                    y: nextY + row * 130,
                },
            };
            row += 1;
            addNode(node);
            byPanel.set(port.panelId, node);
        }
        if (row > 0) nextY += row * 130 + 50;
        for (const port of modulePorts) {
            if (!port.parentPanelId) continue;
            const child = byPanel.get(port.panelId);
            const parent = byPanel.get(port.parentPanelId);
            if (!child || !parent) continue;
            if (edges.some((edge) => edge.targetNodeId === child.id)) continue;
            addEdge(
                baseEdge(
                    `site-internal-${moduleId}-${port.panelId}`,
                    parent.id,
                    child.id,
                    `${parent.label} → ${child.label}`,
                ),
            );
        }
        return byPanel;
    };

    /**
     * Aplica un cable de la planta como el alimentador `upstream → target`.
     * El cable dibujado MANDA: si el tablero ya tenía un alimentador (el
     * automático desde el medidor, uno importado o uno puesto a mano) se
     * REUTILIZA — conserva conductor, sección y factores — y solo cambia su
     * origen y su longitud. Solo se rechaza si otro cable de la planta ya lo
     * alimenta, o si crearía un ciclo. La sección/conductor definidos en el
     * cable pasan a la red; si el cable no los define, manda la red (p.ej. el
     * corrector automático de la Tabla CT).
     */
    const feedWithCable = (
        circuit: SiteCircuit,
        upstream: ElectricalNode,
        target: ElectricalNode,
        horizontalLengthM: number,
        verticalLengthM: number,
        label: string,
    ) => {
        const cablePatch = (edge: ElectricalEdge): Partial<ElectricalEdge> => {
            const patch: Partial<ElectricalEdge> = {};
            if (
                circuit.sectionMm2 !== undefined &&
                edge.sectionMm2 !== circuit.sectionMm2
            ) {
                patch.sectionMm2 = circuit.sectionMm2;
            }
            if (
                circuit.conductorType !== undefined &&
                edge.conductorType !== circuit.conductorType
            ) {
                patch.conductorType = circuit.conductorType;
            }
            return patch;
        };

        const existing = edges.find((edge) => edge.siteCircuitId === circuit.id);
        if (existing) {
            const patch: Partial<ElectricalEdge> = cablePatch(existing);
            if (existing.sourceNodeId !== upstream.id) {
                patch.sourceNodeId = upstream.id;
            }
            if (existing.targetNodeId !== target.id) {
                // El usuario eligió otro tablero para este cable.
                const taken = edges.find(
                    (edge) =>
                        edge.targetNodeId === target.id &&
                        edge.id !== existing.id,
                );
                if (taken?.siteCircuitId) {
                    conflicts.push({
                        code: 'feeder-taken',
                        siteCircuitId: circuit.id,
                        nodeId: target.id,
                        edgeId: taken.id,
                        message: `${target.label} ya está alimentado por otro cable de la planta; este cable sigue en su tablero anterior.`,
                    });
                } else {
                    if (taken) edges = edges.filter((edge) => edge.id !== taken.id);
                    patch.targetNodeId = target.id;
                }
            }
            if (existing.lengthMode === 'site') {
                if (
                    Math.abs(existing.horizontalLengthM - horizontalLengthM) >
                    1e-6
                ) {
                    patch.horizontalLengthM = horizontalLengthM;
                }
                if (
                    Math.abs(existing.verticalLengthM - verticalLengthM) > 1e-6
                ) {
                    patch.verticalLengthM = verticalLengthM;
                }
            }
            if (Object.keys(patch).length > 0) {
                edges = edges.map((edge) =>
                    edge.id === existing.id ? { ...edge, ...patch } : edge,
                );
                changed = true;
            }
            return;
        }

        const siteFields = {
            siteCircuitId: circuit.id,
            origin: 'site' as const,
            lengthMode: 'site' as const,
            horizontalLengthM,
            verticalLengthM,
            label: circuit.label ?? label,
        };
        const incoming = edges.find((edge) => edge.targetNodeId === target.id);
        if (incoming?.siteCircuitId) {
            conflicts.push({
                code: 'feeder-taken',
                siteCircuitId: circuit.id,
                nodeId: target.id,
                edgeId: incoming.id,
                message: `${target.label} ya está alimentado por otro cable de la planta; el cable desde ${upstream.label} no se aplicó.`,
            });
            return;
        }
        const others = incoming
            ? edges.filter((edge) => edge.id !== incoming.id)
            : edges;
        if (
            !canConnect(
                { ...network, nodes, edges: others },
                upstream.id,
                target.id,
            )
        ) {
            conflicts.push({
                code: 'cycle',
                siteCircuitId: circuit.id,
                nodeId: target.id,
                message: `El cable ${upstream.label} → ${target.label} crearía una conexión circular; no se aplicó.`,
            });
            return;
        }
        if (incoming) {
            edges = edges.map((edge) =>
                edge.id === incoming.id
                    ? {
                          ...edge,
                          sourceNodeId: upstream.id,
                          ...siteFields,
                          ...cablePatch(edge),
                      }
                    : edge,
            );
            changed = true;
            return;
        }
        addEdge({
            ...baseEdge(
                siteCircuitEdgeId(circuit.id),
                upstream.id,
                target.id,
                siteFields.label,
            ),
            ...siteFields,
            conductorType: circuit.conductorType ?? 'N2XOH',
            sectionMm2: circuit.sectionMm2 ?? 10,
            wireConfiguration: circuit.wireLabel ?? '3F+N+T',
        });
    };

    /** Cable tablero de la planta → bloque de módulo: alimenta el tablero raíz del módulo. */
    const connectBlock = (
        circuit: SiteCircuit,
        block: SiteElement,
        upstream: ElectricalNode,
    ) => {
        if (!block.moduleId) {
            conflicts.push({
                code: 'block-unlinked',
                siteCircuitId: circuit.id,
                siteElementId: block.id,
                message: `El bloque "${block.label}" no tiene un módulo vinculado: el cable desde ${upstream.label} no llega a ningún tablero.`,
            });
            return;
        }
        const moduleName = block.moduleName ?? block.label;
        const roots = moduleRootPorts(ports, block.moduleId);
        const chosen = circuit.modulePanelId
            ? ports.find(
                  (port) =>
                      port.moduleId === block.moduleId &&
                      port.panelId === circuit.modulePanelId,
              )
            : roots.length === 1
              ? roots[0]
              : undefined;
        if (!chosen) {
            conflicts.push(
                roots.length === 0
                    ? {
                          code: 'module-no-panel',
                          siteCircuitId: circuit.id,
                          siteElementId: block.id,
                          message: `${moduleName} aún no tiene tablero: el cable desde ${upstream.label} se conectará cuando lo crees en el módulo.`,
                      }
                    : {
                          code: 'module-panel-ambiguous',
                          siteCircuitId: circuit.id,
                          siteElementId: block.id,
                          message: `${moduleName} tiene ${roots.length} tableros raíz: elige en el cable (Planta general → propiedades del cable) a cuál llega.`,
                      },
            );
            return;
        }

        const byPanel = ensureModulePorts(block.moduleId, upstream);
        const target = byPanel.get(chosen.panelId);
        if (!target) return;
        feedWithCable(
            circuit,
            upstream,
            target,
            siteCircuitLengthM(circuit, elements, scaleM),
            options.panelVerticalM?.(chosen.panelId) ?? 0,
            `${upstream.label} → ${moduleName}: ${target.label}`,
        );
    };

    /** Punto de la red del que cuelga lo que alimenta un suministro: su medidor si lo tiene. */
    const feedPointOf = (service: ElectricalNode): ElectricalNode => {
        const meterEdge = edges.find(
            (edge) =>
                edge.sourceNodeId === service.id &&
                nodes.find((node) => node.id === edge.targetNodeId)?.type ===
                    'meter',
        );
        return (
            (meterEdge &&
                nodes.find((node) => node.id === meterEdge.targetNodeId)) ||
            service
        );
    };
    /** Nodo de la red que ALIMENTA desde un objeto de la planta (tablero o suministro). */
    const upstreamNodeFor = (elementId: string): ElectricalNode | undefined => {
        if (panelKindById.has(elementId)) return panelNodeFor(elementId);
        const service = supplyNodeFor(elementId);
        return service ? feedPointOf(service) : undefined;
    };

    const circuitIds = new Set<string>();
    for (const circuit of site.circuits ?? []) {
        circuitIds.add(circuit.id);
        const sourceRank = rankOf(circuit.sourceId);
        const targetRank = rankOf(circuit.targetId);
        const block =
            (sourceRank > 0 && blockById.get(circuit.targetId)) ||
            (targetRank > 0 && blockById.get(circuit.sourceId));
        if (block) {
            const upstream = upstreamNodeFor(
                sourceRank > 0 ? circuit.sourceId : circuit.targetId,
            );
            if (upstream) connectBlock(circuit, block, upstream);
            continue;
        }
        // Grupo electrógeno: la red calcula con UNA fuente por tablero (la
        // normal); el respaldo se informa, no entra al cálculo de ΔU.
        const generator = [circuit.sourceId, circuit.targetId]
            .map((id) => elements.find((element) => element.id === id))
            .find((element) => element?.type === 'generator');
        if (generator) {
            conflicts.push({
                code: 'backup-source',
                siteCircuitId: circuit.id,
                siteElementId: generator.id,
                message: `${generator.label || 'Grupo electrógeno'}: fuente de respaldo. Su cable no entra al cálculo de caída de tensión (la red calcula con el suministro normal).`,
            });
            continue;
        }
        // Tablero ↔ tablero o suministro → tablero. Postes/tomacorrientes: Fase 4.
        if (sourceRank === 0 || targetRank === 0) continue;
        if (sourceRank === SUPPLY_RANK && targetRank === SUPPLY_RANK) continue;
        const reversed = targetRank > sourceRank;
        const upstreamElementId = reversed ? circuit.targetId : circuit.sourceId;
        const downstreamElementId = reversed
            ? circuit.sourceId
            : circuit.targetId;
        const upstream = upstreamNodeFor(upstreamElementId);
        const downstream = panelNodeFor(downstreamElementId);
        if (!upstream || !downstream) continue;
        feedWithCable(
            circuit,
            upstream,
            downstream,
            siteCircuitLengthM(circuit, elements, scaleM),
            0,
            `${upstream.label} → ${downstream.label}`,
        );
    }

    // 3. Suministro de los TG sin cable (dinámico):
    //    - por defecto cuelgan del medidor PRINCIPAL (un solo suministro para
    //      todos, lo habitual);
    //    - "Suministro propio" (`supplyMode: 'own'`, elegido en Red y CT)
    //      crea su propia cadena Suministro → Medidor.
    const rootService = nodes.find(
        (node) => node.id === network.rootNodeId && node.type === 'service',
    );
    for (const element of panels) {
        // TG y ATS; un sub tablero sin cable queda "desconectado" (aviso).
        if (panelKindById.get(element.id) === 'sub') continue;
        const panel = panelNodeFor(element.id);
        if (!panel) continue;
        const incoming = edges.find((edge) => edge.targetNodeId === panel.id);
        // Migración: una cadena propia creada automáticamente (versión previa)
        // sin que el usuario la pidiera vuelve al medidor principal.
        if (
            incoming &&
            incoming.id === meterEdgeId(element.id) &&
            panel.supplyMode !== 'own' &&
            rootService
        ) {
            edges = edges.filter((edge) => edge.id !== incoming.id);
            changed = true;
        } else if (incoming) {
            continue;
        }
        const primary = rootService ? feedPointOf(rootService) : undefined;
        if (
            panel.supplyMode !== 'own' &&
            primary &&
            primary.id !== panel.id &&
            // Nunca crear un ciclo (el medidor principal aguas abajo del TG).
            canConnect({ ...network, nodes, edges }, primary.id, panel.id)
        ) {
            addEdge(
                baseEdge(
                    `site-feed-${element.id}`,
                    primary.id,
                    panel.id,
                    `${primary.label} → ${panel.label}`,
                ),
            );
            continue;
        }
        const y = panel.position.y;
        if (!hasNode(supplyNodeId(element.id))) {
            addNode({
                id: supplyNodeId(element.id),
                type: 'service',
                label: `Suministro ${panel.label}`,
                origin: 'site',
                siteElementId: element.id,
                position: { x: panel.position.x - 480, y },
            });
        }
        if (!hasNode(meterNodeId(element.id))) {
            addNode({
                id: meterNodeId(element.id),
                type: 'meter',
                label: `Medidor ${panel.label}`,
                origin: 'site',
                siteElementId: element.id,
                position: { x: panel.position.x - 240, y },
            });
        }
        if (!edges.some((edge) => edge.id === supplyEdgeId(element.id))) {
            addEdge(
                baseEdge(
                    supplyEdgeId(element.id),
                    supplyNodeId(element.id),
                    meterNodeId(element.id),
                    `Suministro → Medidor ${panel.label}`,
                ),
            );
        }
        addEdge(
            baseEdge(
                meterEdgeId(element.id),
                meterNodeId(element.id),
                panel.id,
                `Medidor → ${panel.label}`,
            ),
        );
    }

    // 4. Retirar la cadena propia de un TG que quedó sin uso (el TG pasó a
    //    otro medidor o a un cable). Solo la creada por este puente para un TG.
    for (const node of [...nodes]) {
        if (node.origin !== 'site' || node.type !== 'meter' || !node.siteElementId) {
            continue;
        }
        const ownerKind = panelKindById.get(node.siteElementId);
        if (!ownerKind || ownerKind === 'sub') continue;
        if (node.id !== meterNodeId(node.siteElementId)) continue;
        if (edges.some((edge) => edge.sourceNodeId === node.id)) continue;
        const elementId = node.siteElementId;
        const dropNodes = new Set([node.id, supplyNodeId(elementId)]);
        const supplyHasOtherChildren = edges.some(
            (edge) =>
                edge.sourceNodeId === supplyNodeId(elementId) &&
                edge.targetNodeId !== node.id,
        );
        if (supplyHasOtherChildren) dropNodes.delete(supplyNodeId(elementId));
        nodes = nodes.filter((candidate) => !dropNodes.has(candidate.id));
        edges = edges.filter(
            (edge) =>
                !dropNodes.has(edge.sourceNodeId) &&
                !dropNodes.has(edge.targetNodeId),
        );
        changed = true;
    }

    // 5. Huérfanos: vínculos cuyo objeto/cable ya no existe en la planta.
    const elementIds = new Set(elements.map((element) => element.id));
    for (const node of nodes) {
        if (
            node.siteElementId &&
            node.type !== 'service' &&
            node.type !== 'meter' &&
            !elementIds.has(node.siteElementId)
        ) {
            conflicts.push({
                code: 'orphan-node',
                nodeId: node.id,
                siteElementId: node.siteElementId,
                message: `${node.label} ya no existe en la planta general.`,
            });
        }
    }
    for (const edge of edges) {
        if (edge.siteCircuitId && !circuitIds.has(edge.siteCircuitId)) {
            conflicts.push({
                code: 'orphan-edge',
                edgeId: edge.id,
                siteCircuitId: edge.siteCircuitId,
                message: `El cable "${edge.label ?? edge.id}" ya no existe en la planta general.`,
            });
        }
    }

    if (!changed) return { ...unchanged, conflicts };
    return {
        data: { ...network, nodes, edges },
        changed,
        addedNodes,
        addedEdges,
        conflicts,
    };
}
