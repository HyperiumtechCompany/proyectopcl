import { describe, expect, it } from 'vitest';
import {
    classifyWireNode,
    computeLegacyLinkUpdate,
    type WireLegacyContext,
} from './wireLegacySync';
import type { ElectricalDevice, Fixture, LightSwitch } from './types';

function fixture(id: string): Fixture {
    return { id, name: id, x: 0, y: 0, z: 0, lumens: 1000, power: 10, efficiency: 100, fixtureType: 'panel' } as unknown as Fixture;
}
function lightSwitch(id: string, connectedFixtureIds: string[] = []): LightSwitch {
    return { id, x: 0, y: 0, mountingHeight: 1.4, type: 'single', connectedFixtureIds } as LightSwitch;
}
function device(id: string, patch: Partial<ElectricalDevice> = {}): ElectricalDevice {
    return { id, type: 'sub_panel', x: 0, y: 0, mountingHeight: 1.4, ...patch } as unknown as ElectricalDevice;
}

function ctx(over: Partial<WireLegacyContext> = {}): WireLegacyContext {
    return {
        lightSwitches: over.lightSwitches ?? [],
        fixtures: over.fixtures ?? [],
        electricalDevices: over.electricalDevices ?? [],
    };
}

describe('classifyWireNode', () => {
    it('reconoce cada tipo de nodo', () => {
        const c = ctx({ fixtures: [fixture('f1')], lightSwitches: [lightSwitch('s1')], electricalDevices: [device('d1')] });
        expect(classifyWireNode('f1', c)).toBe('fixture');
        expect(classifyWireNode('s1', c)).toBe('switch');
        expect(classifyWireNode('d1', c)).toBe('device');
        expect(classifyWireNode('nope', c)).toBeNull();
    });
});

describe('computeLegacyLinkUpdate', () => {
    it('conecta interruptor→luminaria agregando el fixture al switch', () => {
        const c = ctx({ fixtures: [fixture('f1')], lightSwitches: [lightSwitch('s1')] });
        const update = computeLegacyLinkUpdate('s1', 'f1', c, true);
        expect(update).toEqual({ kind: 'switch', id: 's1', connectedFixtureIds: ['f1'] });
    });

    it('desconecta interruptor→luminaria quitando el fixture del switch', () => {
        const c = ctx({ fixtures: [fixture('f1')], lightSwitches: [lightSwitch('s1', ['f1', 'f2'])] });
        const update = computeLegacyLinkUpdate('f1', 's1', c, false);
        expect(update).toEqual({ kind: 'switch', id: 's1', connectedFixtureIds: ['f2'] });
    });

    it('no duplica el fixture si ya estaba conectado', () => {
        const c = ctx({ fixtures: [fixture('f1')], lightSwitches: [lightSwitch('s1', ['f1'])] });
        const update = computeLegacyLinkUpdate('s1', 'f1', c, true);
        expect(update).toEqual({ kind: 'switch', id: 's1', connectedFixtureIds: ['f1'] });
    });

    it('conecta equipo→luminaria en connectedFixtureIds', () => {
        const c = ctx({ fixtures: [fixture('f1')], electricalDevices: [device('d1')] });
        const update = computeLegacyLinkUpdate('d1', 'f1', c, true);
        expect(update).toEqual({ kind: 'device', id: 'd1', patch: { connectedFixtureIds: ['f1'] } });
    });

    it('conecta equipo→interruptor en connectedSwitchIds', () => {
        const c = ctx({ lightSwitches: [lightSwitch('s1')], electricalDevices: [device('d1')] });
        const update = computeLegacyLinkUpdate('d1', 's1', c, true);
        expect(update).toEqual({ kind: 'device', id: 'd1', patch: { connectedSwitchIds: ['s1'] } });
    });

    it('conecta equipo→equipo en connectedDeviceIds del nodo A', () => {
        const c = ctx({ electricalDevices: [device('d1'), device('d2')] });
        const update = computeLegacyLinkUpdate('d1', 'd2', c, true);
        expect(update).toEqual({ kind: 'device', id: 'd1', patch: { connectedDeviceIds: ['d2'] } });
    });

    it('devuelve null para luminaria→luminaria (sin vínculo legacy)', () => {
        const c = ctx({ fixtures: [fixture('f1'), fixture('f2')] });
        expect(computeLegacyLinkUpdate('f1', 'f2', c, true)).toBeNull();
    });
});
