import type { ElectricalDevice, Fixture, LightSwitch } from './types';

export type WireNodeKind = 'switch' | 'fixture' | 'device';

export interface WireLegacyContext {
    lightSwitches: LightSwitch[];
    fixtures: Fixture[];
    electricalDevices: ElectricalDevice[];
}

export function classifyWireNode(id: string, ctx: WireLegacyContext): WireNodeKind | null {
    if (ctx.lightSwitches.some((s) => s.id === id)) return 'switch';
    if (ctx.fixtures.some((f) => f.id === id)) return 'fixture';
    if (ctx.electricalDevices.some((d) => d.id === id)) return 'device';
    return null;
}

export type LegacyLinkUpdate =
    | { kind: 'switch'; id: string; connectedFixtureIds: string[] }
    | {
          kind: 'device';
          id: string;
          patch: Partial<
              Pick<ElectricalDevice, 'connectedFixtureIds' | 'connectedSwitchIds' | 'connectedDeviceIds'>
          >;
      };

/**
 * Calcula la actualización de los arrays legacy (connectedFixtureIds/
 * connectedSwitchIds/connectedDeviceIds) al conectar o desconectar dos nodos
 * mediante un cable. Estos arrays siguen alimentando el visor 3D
 * (House3DBuilder), que todavía no lee `Conductor` directamente — por eso
 * hay que mantenerlos en sync aunque el cable "real" viva en `conductors`.
 *
 * `aId`/`bId` deben pasarse en el mismo orden que `sourceId`/`targetId` del
 * conductor: el caso tablero-tablero solo actualiza el equipo en posición A
 * (igual que hacía la lógica original de `onConnectWire`).
 */
export function computeLegacyLinkUpdate(
    aId: string,
    bId: string,
    ctx: WireLegacyContext,
    connect: boolean,
): LegacyLinkUpdate | null {
    const aKind = classifyWireNode(aId, ctx);
    const bKind = classifyWireNode(bId, ctx);

    const switchId = aKind === 'switch' ? aId : bKind === 'switch' ? bId : null;
    const fixtureId = aKind === 'fixture' ? aId : bKind === 'fixture' ? bId : null;
    const deviceId = aKind === 'device' ? aId : bKind === 'device' ? bId : null;
    const isDeviceToDevice = aKind === 'device' && bKind === 'device';

    const toggle = (list: string[], id: string): string[] =>
        connect ? (list.includes(id) ? list : [...list, id]) : list.filter((x) => x !== id);

    if (switchId && fixtureId) {
        const sw = ctx.lightSwitches.find((s) => s.id === switchId);
        if (!sw) return null;
        return {
            kind: 'switch',
            id: switchId,
            connectedFixtureIds: toggle(sw.connectedFixtureIds || [], fixtureId),
        };
    }

    if (deviceId && fixtureId) {
        const dev = ctx.electricalDevices.find((d) => d.id === deviceId);
        if (!dev) return null;
        return {
            kind: 'device',
            id: deviceId,
            patch: { connectedFixtureIds: toggle(dev.connectedFixtureIds || [], fixtureId) },
        };
    }

    if (deviceId && switchId) {
        const dev = ctx.electricalDevices.find((d) => d.id === deviceId);
        if (!dev) return null;
        return {
            kind: 'device',
            id: deviceId,
            patch: { connectedSwitchIds: toggle(dev.connectedSwitchIds || [], switchId) },
        };
    }

    if (isDeviceToDevice) {
        const dev = ctx.electricalDevices.find((d) => d.id === aId);
        if (!dev) return null;
        return {
            kind: 'device',
            id: aId,
            patch: { connectedDeviceIds: toggle(dev.connectedDeviceIds || [], bId) },
        };
    }

    return null;
}

/** Aplica un LegacyLinkUpdate usando los setters del store. */
export function applyLegacyLinkUpdate(
    update: LegacyLinkUpdate | null,
    store: {
        updateLightSwitch: (id: string, patch: Partial<LightSwitch>) => void;
        updateElectricalDevice: (id: string, patch: Partial<ElectricalDevice>) => void;
    },
): void {
    if (!update) return;
    if (update.kind === 'switch') {
        store.updateLightSwitch(update.id, { connectedFixtureIds: update.connectedFixtureIds });
    } else {
        store.updateElectricalDevice(update.id, update.patch);
    }
}
