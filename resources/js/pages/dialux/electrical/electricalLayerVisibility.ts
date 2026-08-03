import type {
    Conductor,
    ElectricalDevice,
    ElectricalLayerGroup,
    Fixture,
    LightSwitch,
    Scene,
} from '@/pages/dialux/hooks/types';

export type ConductorLayer = 'fixtures' | 'outlets' | 'wires';

const isOutlet = (device: ElectricalDevice): boolean => device.type.startsWith('outlet_');

/**
 * Relaciona cada conductor con el sistema al que alimenta para evitar que el
 * control genérico de cableado oculte instalaciones eléctricas no relacionadas.
 */
export function classifyConductorLayer(
    conductor: Conductor,
    fixtures: Fixture[],
    lightSwitches: LightSwitch[],
    electricalDevices: ElectricalDevice[],
): ConductorLayer {
    const endpointIds = new Set([conductor.sourceId, conductor.targetId]);

    if (electricalDevices.some((device) => isOutlet(device) && endpointIds.has(device.id))) {
        return 'outlets';
    }

    if (
        fixtures.some((fixture) => endpointIds.has(fixture.id))
        || lightSwitches.some((lightSwitch) => endpointIds.has(lightSwitch.id))
    ) {
        return 'fixtures';
    }

    return 'wires';
}

export function isElectricalItemVisible(
    scene: Scene,
    visibility: Record<ElectricalLayerGroup, boolean>,
    hiddenIds: readonly string[],
    id: string,
): boolean {
    if (hiddenIds.includes(id)) return false;

    if (scene.fixtures.some((item) => item.id === id)) return visibility.fixtures;
    if ((scene.lightSwitches ?? []).some((item) => item.id === id)) return visibility.switches;

    const device = (scene.electricalDevices ?? []).find((item) => item.id === id);
    if (device) return device.type.startsWith('outlet_') ? visibility.outlets : visibility.panels;

    const conductor = (scene.conductors ?? []).find((item) => item.id === id);
    if (conductor) {
        return visibility[classifyConductorLayer(
            conductor,
            scene.fixtures,
            scene.lightSwitches ?? [],
            scene.electricalDevices ?? [],
        )];
    }

    return true;
}
