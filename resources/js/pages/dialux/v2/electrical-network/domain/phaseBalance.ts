import type { EdgeCalculation } from './calculations';
import { simultaneityFactorOf } from './calculations';
import { networkRootIds } from './graph';
import type {
    ElectricalNetworkData,
    ElectricalNode,
    ModuleElectricalPort,
} from './types';

/**
 * Balance de fases de la red (R4 de `plan_red_ct_dimensionamiento_multimodulo.md`).
 *
 * En cada tablero TRIFÁSICO se suman las corrientes por fase de lo que cuelga
 * de él:
 *  - carga propia del tablero (puerto de módulo): repartida por igual (el
 *    detalle interno de fases vive en el CT de la V1 de ese módulo);
 *  - hijos trifásicos: su propio vector R/S/T (recursivo);
 *  - hijos monofásicos (módulo 1Φ, sub tablero 1Φ de la planta): toda su
 *    corriente en la fase a la que se conectan (`ElectricalNode.phase`);
 *  - salidas de la planta: en la fase de su fila CT (`phaseBalance`).
 * Los hijos y salidas van por el factor de simultaneidad del tablero (R1).
 * Las corrientes se suman aritméticamente (mismo cos φ): lado seguro.
 *
 * Propuesta: los hijos 1Φ SIN fase fijada se asignan con el algoritmo LPT
 * (mayor corriente primero, a la fase menos cargada; empate R → S → T). Una
 * fase que el usuario fijó NUNCA se cambia.
 *
 * Desbalance = max |Iᵢ − Ī| / Ī × 100 (definición de desbalance de corriente
 * ADAPTADA a corrientes: NEMA MG 1 e IEEE 1159 la definen para el
 * desbalance de TENSIÓN (motores / calidad de energía), no para corrientes de
 * tableros). No hay un límite
 * normativo único para tableros; `PROJECT_UNBALANCE_LIMIT_PERCENT` es un
 * criterio de proyecto usual, solo informativo.
 */
export type Phase = 'R' | 'S' | 'T';
export const PHASES: Phase[] = ['R', 'S', 'T'];
export const PROJECT_UNBALANCE_LIMIT_PERCENT = 10;

export type PhaseCurrents = Record<Phase, number>;

export interface PhaseAssignment {
    nodeId: string;
    edgeId: string;
    label: string;
    currentA: number;
    /** Fase fijada por el usuario (si la hay). */
    fixedPhase?: Phase;
    /** Fase propuesta por el balance (= la fijada si existe). */
    phase: Phase;
}

export interface NodePhaseBalance {
    nodeId: string;
    currents: PhaseCurrents;
    averageA: number;
    maxPhaseA: number;
    unbalancePercent: number;
    /** Hijos 1Φ directos del tablero y su fase (fijada o propuesta). */
    singlePhaseChildren: PhaseAssignment[];
    /** Hay hijos 1Φ sin fase fijada: las corrientes incluyen la propuesta. */
    usesProposal: boolean;
}

/** Salida de la planta ya ubicada en su tablero de la red. */
export interface SitePhaseLoad {
    nodeId: string;
    phaseBalance: string;
    currentA: number;
}

const zero = (): PhaseCurrents => ({ R: 0, S: 0, T: 0 });

function phasesOfBalance(balance: string): Phase[] {
    const phases = PHASES.filter((phase) => balance.includes(phase));
    return phases.length > 0 ? phases : PHASES;
}

export function unbalancePercent(currents: PhaseCurrents): number {
    const average = (currents.R + currents.S + currents.T) / 3;
    if (!(average > 0)) return 0;
    return (
        (Math.max(...PHASES.map((phase) => Math.abs(currents[phase] - average))) /
            average) *
        100
    );
}

export function calculatePhaseBalance(
    network: ElectricalNetworkData,
    ports: ModuleElectricalPort[],
    calculations: EdgeCalculation[],
    siteLoads: SitePhaseLoad[] = [],
): Map<string, NodePhaseBalance> {
    const result = new Map<string, NodePhaseBalance>();
    const { settings } = network;
    if (settings.phases !== 3) return result;
    const nodeById = new Map(network.nodes.map((node) => [node.id, node]));
    const calcByEdge = new Map(calculations.map((item) => [item.edgeId, item]));
    const children = new Map<string, typeof network.edges>();
    for (const edge of network.edges) {
        children.set(edge.sourceNodeId, [
            ...(children.get(edge.sourceNodeId) ?? []),
            edge,
        ]);
    }
    const portOf = (node: ElectricalNode | undefined) =>
        node?.type === 'module_panel_port'
            ? ports.find(
                  (item) =>
                      item.moduleId === node.moduleId &&
                      item.sceneId === node.sceneId &&
                      item.panelId === node.deviceId,
              )
            : undefined;
    const phasesOf = (node: ElectricalNode | undefined): 1 | 3 =>
        portOf(node)?.phases ?? node?.phases ?? settings.phases;
    const powerFactor = Math.min(1, Math.max(0.01, settings.defaultPowerFactor));

    const visiting = new Set<string>();
    const vectorOf = (nodeId: string): PhaseCurrents => {
        const cached = result.get(nodeId);
        if (cached) return cached.currents;
        if (visiting.has(nodeId)) return zero();
        visiting.add(nodeId);
        const node = nodeById.get(nodeId);
        const port = portOf(node);
        const fs = simultaneityFactorOf(node);
        const voltageV = port?.nominalVoltageV || node?.nominalVoltageV || settings.nominalVoltageV;
        const ownDemandW = port?.ownDemandPowerW ?? port?.demandPowerW ?? 0;
        const ownPerPhase = ownDemandW / (Math.sqrt(3) * voltageV * powerFactor);
        const currents: PhaseCurrents = { R: ownPerPhase, S: ownPerPhase, T: ownPerPhase };

        for (const load of siteLoads) {
            if (load.nodeId !== nodeId) continue;
            for (const phase of phasesOfBalance(load.phaseBalance)) {
                currents[phase] += fs * load.currentA;
            }
        }
        const singles: PhaseAssignment[] = [];
        for (const edge of children.get(nodeId) ?? []) {
            const target = nodeById.get(edge.targetNodeId);
            if (phasesOf(target) === 3) {
                const child = vectorOf(edge.targetNodeId);
                for (const phase of PHASES) currents[phase] += fs * child[phase];
                continue;
            }
            const currentA = fs * (calcByEdge.get(edge.id)?.currentA ?? 0);
            singles.push({
                nodeId: edge.targetNodeId,
                edgeId: edge.id,
                label: target?.moduleName
                    ? `${target.moduleName} · ${target.label}`
                    : (target?.label ?? edge.targetNodeId),
                currentA,
                fixedPhase: target?.phase,
                phase: target?.phase ?? 'R',
            });
        }
        for (const single of singles) {
            if (single.fixedPhase) currents[single.fixedPhase] += single.currentA;
        }
        // LPT: mayor corriente primero, a la fase menos cargada.
        const free = singles
            .filter((single) => !single.fixedPhase)
            .sort((a, b) => b.currentA - a.currentA || a.nodeId.localeCompare(b.nodeId));
        for (const single of free) {
            const phase = PHASES.reduce((best, candidate) =>
                currents[candidate] < currents[best] - 1e-12 ? candidate : best,
            );
            single.phase = phase;
            currents[phase] += single.currentA;
        }
        const averageA = (currents.R + currents.S + currents.T) / 3;
        result.set(nodeId, {
            nodeId,
            currents,
            averageA,
            maxPhaseA: Math.max(currents.R, currents.S, currents.T),
            unbalancePercent: unbalancePercent(currents),
            singlePhaseChildren: singles,
            usesProposal: free.length > 0,
        });
        visiting.delete(nodeId);
        return currents;
    };
    for (const root of networkRootIds(network)) vectorOf(root);
    // Tableros trifásicos que no cuelgan de ninguna raíz (red incompleta).
    for (const node of network.nodes) {
        if (!result.has(node.id) && phasesOf(node) === 3 && (children.get(node.id)?.length ?? 0) > 0) {
            vectorOf(node.id);
        }
    }
    return result;
}

/** Cambios para aplicar la propuesta: solo hijos 1Φ SIN fase fijada. */
export function proposedPhasePatches(
    balance: NodePhaseBalance | undefined,
): Array<{ nodeId: string; phase: Phase }> {
    return (balance?.singlePhaseChildren ?? [])
        .filter((child) => !child.fixedPhase)
        .map((child) => ({ nodeId: child.nodeId, phase: child.phase }));
}

/** Ubica las salidas de la planta (filas CT por `panelElementId`) en su nodo de la red. */
export function sitePhaseLoads(
    network: ElectricalNetworkData,
    rows: Array<{ panelElementId: string; phaseBalance: string; currentA: number }>,
): SitePhaseLoad[] {
    const nodeBySiteElement = new Map(
        network.nodes
            .filter(
                (node) =>
                    node.siteElementId &&
                    node.type !== 'service' &&
                    node.type !== 'meter',
            )
            .map((node) => [node.siteElementId!, node.id]),
    );
    return rows.flatMap((row) => {
        const nodeId = nodeBySiteElement.get(row.panelElementId);
        return nodeId
            ? [{ nodeId, phaseBalance: row.phaseBalance, currentA: row.currentA }]
            : [];
    });
}
