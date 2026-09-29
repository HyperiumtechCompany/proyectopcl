import { describe, expect, it } from 'vitest';
import { feederVoltageDrop } from '../../electrical-network/domain/feederVoltageDrop';
import type { ElectricalNetworkData } from '../../electrical-network/domain/types';
import { applySiteToNetwork } from './siteNetworkBridge';
import { calculateNetworkWithSite } from './siteNetworkLive';
import type { SiteCircuit, SiteData, SiteElement, TgSupplyConfig } from './types';

const settings: ElectricalNetworkData['settings'] = {
    nominalVoltageV: 380,
    phases: 3,
    connectionType: 'star',
    frequencyHz: 60,
    conductorMaterial: 'copper',
    workingTemperatureC: 20,
    defaultPowerFactor: 0.9,
    designFactor: 1.25,
    feederDropLimitPercent: 2.5,
    totalDropLimitPercent: 4,
};
const edge = (id: string, source: string, target: string) => ({
    id,
    sourceNodeId: source,
    targetNodeId: target,
    lengthMode: 'manual' as const,
    horizontalLengthM: 0,
    verticalLengthM: 0,
    conductorType: 'N2XOH',
    conductorMaterial: 'copper' as const,
    sectionMm2: 10,
    wireConfiguration: '3F+N+T',
});
// Red recién creada: Suministro → Medidor → TG, ambos tramos en 0 m.
const network: ElectricalNetworkData = {
    schemaVersion: 1,
    rootNodeId: 'svc',
    settings,
    nodes: [
        { id: 'svc', type: 'service', label: 'Suministro', position: { x: 0, y: 0 } },
        { id: 'mtr', type: 'meter', label: 'Medidor', position: { x: 0, y: 0 } },
        { id: 'tgn', type: 'main_panel', label: 'TG', position: { x: 0, y: 0 } },
    ],
    edges: [edge('e1', 'svc', 'mtr'), edge('e2', 'mtr', 'tgn')],
};
const plant = (supply?: TgSupplyConfig): SiteData => {
    const tg: SiteElement = {
        id: 'tg',
        type: 'tg_location',
        label: 'TG',
        vertices: [{ x: 0, y: 0 }],
        style: { fillColor: '#000', strokeColor: '#000' },
        config: { kind: 'tg', mount: 'floor', widthM: 1.2, depthM: 0.4, heightM: 2, ...(supply ? { supply } : {}) },
    };
    const pole: SiteElement = {
        id: 'p1',
        type: 'pole',
        label: 'P1',
        vertices: [{ x: 20, y: 0 }],
        style: { fillColor: '#000', strokeColor: '#000' },
        config: { kind: 'pole', heightM: 8, lumens: 10000, wattage: 2000, fixtures: 1 } as SiteElement['config'],
    };
    const cable: SiteCircuit = {
        id: 'c1',
        sourceId: 'tg',
        targetId: 'p1',
        waypoints: [{ x: 0, y: 0 }, { x: 20, y: 0 }],
        calculatedLengthM: 20,
        wireCount: 3,
        wastePct: 0,
        sectionMm2: 4,
        tgOutputId: 'tg-output-1',
    };
    return { schemaVersion: 1, terrainScaleM: 1, gridSizeM: 1, canvasWidth: 100, canvasHeight: 100, elements: [tg, pole], feederPaths: [], circuits: [cable], layers: [] } as SiteData;
};
const run = (supply?: TgSupplyConfig) => {
    const site = plant(supply);
    const bridged = applySiteToNetwork(network, site).data;
    return { bridged, ...calculateNetworkWithSite(bridged, site, [], []) };
};

describe('Configuración del TG en la planta (acometida y cálculo)', () => {
    it('sin longitud del alimentador al TG la caída queda incompleta; el medidor en 0 m NO es un dato faltante', () => {
        const { calculations } = run();
        expect(calculations.find((item) => item.edgeId === 'e2')?.status).toBe('incomplete');
        expect(calculations.find((item) => item.edgeId === 'e1')?.status).not.toBe('incomplete');
    });

    it('la longitud, sección y temperatura del TG llegan a Red y CT y se calcula la ΔU (caso a mano)', () => {
        const supply: TgSupplyConfig = {
            workingTemperatureC: 40,
            designFactor: 1.25,
            feederHorizontalM: 30,
            feederVerticalM: 2,
            feederSectionMm2: 16,
        };
        const { bridged, calculations } = run(supply);
        expect(bridged.edges.find((item) => item.id === 'e2')).toMatchObject({
            horizontalLengthM: 30,
            verticalLengthM: 2,
            sectionMm2: 16,
        });
        const feeder = calculations.find((item) => item.edgeId === 'e2')!;
        expect(feeder.status).not.toBe('incomplete');
        expect(feeder.lengthM).toBeCloseTo(32, 9);
        expect(feeder.temperatureC).toBe(40);
        // IEC 60364-5-52 Anexo G con ρ del cobre a 40 °C (no a los 20 °C generales).
        const hand = feederVoltageDrop({
            currentA: feeder.currentA,
            lengthM: 32,
            sectionMm2: 16,
            voltageV: 380,
            phases: 3,
            material: 'cobre',
            powerFactor: 0.9,
            temperatureC: 40,
        }).dropPercent;
        expect(feeder.ownVoltageDropPercent).toBeCloseTo(hand, 12);
        const at20 = feederVoltageDrop({
            currentA: feeder.currentA,
            lengthM: 32,
            sectionMm2: 16,
            voltageV: 380,
            phases: 3,
            material: 'cobre',
            powerFactor: 0.9,
            temperatureC: 20,
        }).dropPercent;
        expect(feeder.ownVoltageDropPercent).toBeGreaterThan(at20);
        expect(feeder.designCurrentA).toBeCloseTo(feeder.currentA * 1.25, 12);
    });

    it('el factor de diseño del TG manda sobre el general', () => {
        const { calculations } = run({ designFactor: 1.5, feederHorizontalM: 10 });
        const feeder = calculations.find((item) => item.edgeId === 'e2')!;
        expect(feeder.designCurrentA).toBeCloseTo(feeder.currentA * 1.5, 12);
    });
});

describe('las salidas del TG (motor CT de la V1) usan su configuración', () => {
    it('temperatura de trabajo del TG → ρ de las salidas; sin configurar, la de la V1 (40 °C)', async () => {
        const { analyzeSiteOutputs } = await import('./siteOutputs');
        const drop = (supply?: TgSupplyConfig) => analyzeSiteOutputs(plant(supply), settings).rows[0].voltageDropPct;
        expect(drop({ workingTemperatureC: 40 })).toBeCloseTo(drop(), 9);
        expect(drop({ workingTemperatureC: 70 })).toBeGreaterThan(drop({ workingTemperatureC: 40 }));
    });
});
