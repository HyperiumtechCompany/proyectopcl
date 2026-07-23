import { describe, expect, it } from 'vitest';
import type { Conductor, ElectricalDevice, Fixture, LightSwitch } from '@/pages/dialux/hooks/types';
import { classifyConductorLayer, isElectricalItemVisible } from './electricalLayerVisibility';

const conductor = (sourceId: string, targetId: string): Conductor => ({
    id: `${sourceId}-${targetId}`,
    sourceId,
    targetId,
    wireCount: 3,
    routeType: 'wall_ceiling',
    tubeSize: 20,
    conductorType: 'Cu LSOH',
    sectionMm2: 2.5,
    waypoints: [],
});

const fixtures = [{ id: 'fixture-1' }] as Fixture[];
const switches = [{ id: 'switch-1' }] as LightSwitch[];
const devices = [
    { id: 'outlet-1', type: 'outlet_floor' },
    { id: 'panel-1', type: 'distribution_panel' },
] as ElectricalDevice[];

describe('classifyConductorLayer', () => {
    it('agrupa el cableado de luminarias con las luminarias', () => {
        expect(classifyConductorLayer(conductor('switch-1', 'fixture-1'), fixtures, switches, devices)).toBe('fixtures');
    });

    it('agrupa el cableado de tomacorrientes con los tomacorrientes', () => {
        expect(classifyConductorLayer(conductor('panel-1', 'outlet-1'), fixtures, switches, devices)).toBe('outlets');
    });

    it('conserva cableados no identificados en un grupo independiente', () => {
        expect(classifyConductorLayer(conductor('panel-1', 'panel-2'), fixtures, switches, devices)).toBe('wires');
    });
});

describe('isElectricalItemVisible', () => {
    const scene = {
        fixtures,
        lightSwitches: switches,
        electricalDevices: devices,
        conductors: [conductor('switch-1', 'fixture-1'), conductor('panel-1', 'outlet-1')],
    } as never;
    const visibility = { cad: true, fixtures: true, wires: true, switches: true, outlets: true, panels: true };

    it('protege luminarias y su cableado cuando el grupo está oculto', () => {
        const hiddenFixtures = { ...visibility, fixtures: false };
        expect(isElectricalItemVisible(scene, hiddenFixtures, [], 'fixture-1')).toBe(false);
        expect(isElectricalItemVisible(scene, hiddenFixtures, [], 'switch-1-fixture-1')).toBe(false);
        expect(isElectricalItemVisible(scene, hiddenFixtures, [], 'outlet-1')).toBe(true);
    });

    it('excluye de selección un elemento ocultado individualmente', () => {
        expect(isElectricalItemVisible(scene, visibility, ['outlet-1'], 'outlet-1')).toBe(false);
    });
});
