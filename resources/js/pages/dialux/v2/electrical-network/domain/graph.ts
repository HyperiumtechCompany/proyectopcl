import type { ElectricalNetworkData, GraphIssue } from './types';

export function validateElectricalNetwork(
    network: ElectricalNetworkData,
): GraphIssue[] {
    const issues: GraphIssue[] = [];
    const nodes = new Map(network.nodes.map((node) => [node.id, node]));
    const incoming = new Map<string, number>();
    const children = new Map<string, string[]>();

    if (!network.rootNodeId || !nodes.has(network.rootNodeId)) {
        issues.push({
            code: 'missing-root',
            message: 'La red necesita un origen válido.',
        });
    }

    for (const edge of network.edges) {
        if (!nodes.has(edge.sourceNodeId) || !nodes.has(edge.targetNodeId)) {
            issues.push({
                code: 'missing-node',
                edgeId: edge.id,
                message: 'El alimentador referencia un nodo inexistente.',
            });
            continue;
        }
        if (edge.sourceNodeId === edge.targetNodeId) {
            issues.push({
                code: 'self-link',
                edgeId: edge.id,
                message: 'Un equipo no puede alimentarse a sí mismo.',
            });
            continue;
        }
        incoming.set(
            edge.targetNodeId,
            (incoming.get(edge.targetNodeId) ?? 0) + 1,
        );
        children.set(edge.sourceNodeId, [
            ...(children.get(edge.sourceNodeId) ?? []),
            edge.targetNodeId,
        ]);
    }

    for (const [nodeId, count] of incoming) {
        if (count > 1)
            issues.push({
                code: 'multiple-parents',
                nodeId,
                message:
                    'Un tablero sólo puede tener un alimentador aguas arriba.',
            });
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();
    const walk = (nodeId: string): void => {
        if (visiting.has(nodeId)) {
            issues.push({
                code: 'cycle',
                nodeId,
                message: 'La red contiene una conexión circular.',
            });
            return;
        }
        if (visited.has(nodeId)) return;
        visiting.add(nodeId);
        for (const child of children.get(nodeId) ?? []) walk(child);
        visiting.delete(nodeId);
        visited.add(nodeId);
    };
    if (network.rootNodeId && nodes.has(network.rootNodeId))
        walk(network.rootNodeId);
    for (const node of network.nodes) {
        if (!visited.has(node.id))
            issues.push({
                code: 'disconnected',
                nodeId: node.id,
                message: `${node.label} no está conectado al suministro.`,
            });
    }

    return issues;
}

export function canConnect(
    network: ElectricalNetworkData,
    sourceNodeId: string,
    targetNodeId: string,
): boolean {
    const candidate = {
        ...network,
        edges: [
            ...network.edges,
            {
                id: '__candidate__',
                sourceNodeId,
                targetNodeId,
                lengthMode: 'manual' as const,
                horizontalLengthM: 0,
                verticalLengthM: 0,
                conductorType: '',
                conductorMaterial: 'copper' as const,
                sectionMm2: 1,
                wireConfiguration: '',
            },
        ],
    };
    return !validateElectricalNetwork(candidate).some((issue) =>
        ['missing-node', 'self-link', 'multiple-parents', 'cycle'].includes(
            issue.code,
        ),
    );
}
