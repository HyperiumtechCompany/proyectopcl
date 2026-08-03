import type { Conductor, ElectricalDevice } from './types';

const PANEL_TYPES = new Set<ElectricalDevice['type']>([
    'main_panel',
    'sub_panel',
    'arrival_panel',
    'transfer_switch',
]);

export function panelBoundaryIds(
    electricalDevices: ElectricalDevice[] = [],
): Set<string> {
    return new Set(
        electricalDevices
            .filter((device) => PANEL_TYPES.has(device.type))
            .map((device) => device.id),
    );
}

/**
 * Devuelve todos los tramos del circuito seleccionado. Los tableros actúan
 * como límites: se incluye el tramo que llega al tablero, pero no se atraviesa
 * el tablero para incorporar sus otras salidas.
 */
export function connectedCircuitConductorIds(
    conductors: Conductor[],
    selectedConductorId: string,
    boundaryNodeIds: ReadonlySet<string>,
): string[] {
    const selected = conductors.find(
        (conductor) => conductor.id === selectedConductorId,
    );
    if (!selected) return [];

    if (selected.circuitGroupId) {
        const persistedGroup = conductors
            .filter(
                (conductor) =>
                    conductor.circuitGroupId === selected.circuitGroupId,
            )
            .map((conductor) => conductor.id);
        if (persistedGroup.length > 1) return persistedGroup;
    }

    const conductorsByNode = new Map<string, Conductor[]>();
    conductors.forEach((conductor) => {
        conductorsByNode.set(conductor.sourceId, [
            ...(conductorsByNode.get(conductor.sourceId) ?? []),
            conductor,
        ]);
        conductorsByNode.set(conductor.targetId, [
            ...(conductorsByNode.get(conductor.targetId) ?? []),
            conductor,
        ]);
    });

    const found = new Set<string>([selected.id]);
    const pending = [selected];

    while (pending.length > 0) {
        const conductor = pending.pop();
        if (!conductor) continue;

        for (const nodeId of [conductor.sourceId, conductor.targetId]) {
            if (boundaryNodeIds.has(nodeId)) continue;

            for (const adjacent of conductorsByNode.get(nodeId) ?? []) {
                if (found.has(adjacent.id)) continue;
                found.add(adjacent.id);
                pending.push(adjacent);
            }
        }
    }

    return conductors
        .filter((conductor) => found.has(conductor.id))
        .map((conductor) => conductor.id);
}
