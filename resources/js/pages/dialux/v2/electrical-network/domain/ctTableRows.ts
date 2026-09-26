import type { PanelCircuitSummary } from '@/pages/dialux/hooks/wireLengthCalculations';
import type {
    ElectricalEdge,
    ElectricalNetworkData,
    ElectricalNodeType,
} from './types';

export type ModuleCtCircuit = PanelCircuitSummary & {
    moduleId: number;
    moduleName: string;
};

export function rowsForDistributionPanel(
    circuits: ModuleCtCircuit[],
    moduleId: number,
    panelId: string | undefined,
): {
    outputRows: ModuleCtCircuit[];
    summaryRows: ModuleCtCircuit[];
} {
    const panelRows = circuits.filter(
        (circuit) =>
            circuit.moduleId === moduleId &&
            circuit.panelId === panelId &&
            circuit.panelType !== 'main_panel',
    );

    return {
        outputRows: panelRows.filter((circuit) => !circuit.isPanelSummary),
        summaryRows: panelRows.filter((circuit) => circuit.isPanelSummary),
    };
}

/** Tableros que tienen filas propias en la tabla CT. */
const CT_PANEL_TYPES = new Set<ElectricalNodeType>([
    'main_panel',
    'module_panel_port',
    'site_panel',
]);

/**
 * Un tablero de la tabla CT en el orden del árbol (como la planilla de CT:
 * TG con sus salidas, luego cada TD que cuelga de él con sus salidas, luego
 * sus Sub‑TD…). `edgeId` = alimentador que llega al tablero.
 */
export interface CtTreeBlock {
    nodeId: string;
    edgeId: string | null;
    parentPanelId: string | null;
    depth: number;
}

/**
 * Recorrido en profundidad desde cada TG. Los equipos de paso (ATS, UPS…)
 * se atraviesan sin fila propia; los hijos se ordenan por nombre
 * ("TD-2" antes que "TD-10"). `unreachable` = tableros que no cuelgan de
 * ningún TG (se listan aparte como desconectados).
 */
export function ctTreeOrder(data: ElectricalNetworkData): {
    blocks: CtTreeBlock[];
    unreachable: string[];
} {
    const nodes = new Map(data.nodes.map((node) => [node.id, node]));
    const childrenOf = new Map<string, ElectricalEdge[]>();
    for (const edge of data.edges) {
        const list = childrenOf.get(edge.sourceNodeId) ?? [];
        list.push(edge);
        childrenOf.set(edge.sourceNodeId, list);
    }
    const byLabel = (left: ElectricalEdge, right: ElectricalEdge) =>
        (nodes.get(left.targetNodeId)?.label ?? '').localeCompare(
            nodes.get(right.targetNodeId)?.label ?? '',
            'es',
            { numeric: true },
        );
    const blocks: CtTreeBlock[] = [];
    const visited = new Set<string>();
    const visit = (
        nodeId: string,
        edgeId: string | null,
        parentPanelId: string | null,
        depth: number,
    ) => {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        const node = nodes.get(nodeId);
        if (!node) return;
        const isPanel = CT_PANEL_TYPES.has(node.type);
        if (isPanel) blocks.push({ nodeId, edgeId, parentPanelId, depth });
        for (const edge of [...(childrenOf.get(nodeId) ?? [])].sort(byLabel)) {
            visit(
                edge.targetNodeId,
                edge.id,
                isPanel ? nodeId : parentPanelId,
                isPanel ? depth + 1 : depth,
            );
        }
    };
    for (const node of data.nodes) {
        if (node.type !== 'main_panel') continue;
        const feeder = data.edges.find((edge) => edge.targetNodeId === node.id);
        visit(node.id, feeder?.id ?? null, null, 0);
    }
    const unreachable = data.nodes
        .filter(
            (node) => CT_PANEL_TYPES.has(node.type) && !visited.has(node.id),
        )
        .map((node) => node.id);
    return { blocks, unreachable };
}
