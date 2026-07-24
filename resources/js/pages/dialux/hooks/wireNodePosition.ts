import type { ElectricalDevice, Fixture, LightSwitch } from './types';

export interface WireNodeLookup {
    fixtures: Fixture[];
    lightSwitches: LightSwitch[];
    electricalDevices: ElectricalDevice[];
}

/** Resuelve la posición en escena (metros) de un extremo de cable por su id. */
export function resolveWireNodePosition(
    id: string,
    ctx: WireNodeLookup,
): { x: number; y: number } | null {
    const node =
        ctx.lightSwitches.find((s) => s.id === id) ??
        ctx.fixtures.find((f) => f.id === id) ??
        ctx.electricalDevices.find((d) => d.id === id);
    return node ? { x: node.x, y: node.y } : null;
}
