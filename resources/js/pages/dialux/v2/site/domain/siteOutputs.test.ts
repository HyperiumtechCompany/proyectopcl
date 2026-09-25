import { describe, expect, it } from 'vitest';
import type { ElectricalNetworkData } from '../../electrical-network/domain/types';
import { applySiteToNetwork } from './siteNetworkBridge';
import { calculateNetworkWithSite } from './siteNetworkLive';
import { analyzeSiteOutputs, OUTLET_REFERENCE_W } from './siteOutputs';
import type { SiteCircuit, SiteData, SiteElement } from './types';

const settings: ElectricalNetworkData['settings'] = {
    nominalVoltageV: 380,
    phases: 3,
    connectionType: 'star',
    frequencyHz: 60,
    conductorMaterial: 'copper',
    workingTemperatureC: 20,
    defaultPowerFactor: 0.9,
    feederDropLimitPercent: 2.5,
    totalDropLimitPercent: 4,
};

const at = (
    id: string,
    type: SiteElement['type'],
    x: number,
    config?: SiteElement['config'],
): SiteElement => ({
    id,
    type,
    label: id.toUpperCase(),
    vertices: [{ x, y: 0 }],
    config,
    style: { fillColor: '#000', strokeColor: '#000' },
});
const pole = (id: string, x: number) =>
    at(id, 'pole', x, {
        kind: 'pole',
        heightM: 8,
        lumens: 10000,
        wattage: 100,
        fixtures: 1,
    } as SiteElement['config']);
const wire = (
    id: string,
    from: string,
    to: string,
    x0: number,
    x1: number,
    extra: Partial<SiteCircuit> = {},
): SiteCircuit => ({
    id,
    sourceId: from,
    targetId: to,
    waypoints: [
        { x: x0, y: 0 },
        { x: x1, y: 0 },
    ],
    calculatedLengthM: Math.abs(x1 - x0),
    wireCount: 3,
    wastePct: 0,
    sectionMm2: 4,
    ...extra,
});
const site = (elements: SiteElement[], circuits: SiteCircuit[]): SiteData => ({
    schemaVersion: 1,
    terrainScaleM: 1,
    gridSizeM: 1,
    canvasWidth: 100,
    canvasHeight: 100,
    elements,
    feederPaths: [],
    circuits,
    layers: [],
});

// TG → caja → P1 → P2 (una salida de alumbrado) y TG → tomacorriente (otra salida).
const plant = site(
    [
        at('tg', 'tg_location', 0),
        at('box', 'pull_box', 10),
        pole('p1', 30),
        pole('p2', 60),
        at('out', 'outlet', -20, { kind: 'outlet', heightM: 0.4 }),
    ],
    [
        wire('c1', 'tg', 'box', 0, 10),
        wire('c2', 'box', 'p1', 10, 30),
        wire('c3', 'p1', 'p2', 30, 60),
        wire('c4', 'tg', 'out', 0, -20),
    ],
);

describe('analyzeSiteOutputs (motor CT por luminaria de la V1)', () => {
    it('una fila por salida del tablero, con las cargas de toda la rama', () => {
        const { rows, panelLoads, coveredLoadIds } = analyzeSiteOutputs(
            plant,
            settings,
        );
        expect(rows).toHaveLength(2);
        const lighting = rows.find((row) => row.rootConductorId === 'c1')!;
        const outlet = rows.find((row) => row.rootConductorId === 'c4')!;

        expect(lighting.installedPowerW).toBe(200);
        expect(lighting.circuitLoadType).toBe('lighting');
        expect(lighting.loadsDetail).toBe('2×100 W alumbrado');
        expect(lighting.firstTargetLabel).toBe('BOX');
        // Los 3 cables de la rama apuntan a esta salida (para rotularlos en 2D).
        expect([...lighting.circuitIds].sort()).toEqual(['c1', 'c2', 'c3']);
        expect(outlet.circuitIds).toEqual(['c4']);
        // Longitud de la rama = 3 tramos dibujados (10 + 20 + 30 m) + subida
        // por cada poste hasta la luminaria (2 × 8 m).
        expect(lighting.lengthM).toBeCloseTo(60 + 16, 6);
        expect(lighting.phases).toBe(1);

        expect(outlet.installedPowerW).toBe(OUTLET_REFERENCE_W);
        expect(outlet.circuitLoadType).toBe('outlet');
        expect(outlet.assumptions.join(' ')).toMatch(/referencia/);
        // Salidas monofásicas repartidas entre fases.
        expect(new Set(rows.map((row) => row.phaseBalance)).size).toBe(2);

        expect(panelLoads.get('tg')?.installed).toBe(200 + OUTLET_REFERENCE_W);
        expect([...coveredLoadIds].sort()).toEqual(['out', 'p1', 'p2']);
    });

    it('la ΔU acumulada = % hasta el tablero + % propio de la salida', () => {
        const base = analyzeSiteOutputs(plant, settings).rows.find(
            (row) => row.rootConductorId === 'c1',
        )!;
        const withUpstream = analyzeSiteOutputs(plant, settings, () => 2).rows.find(
            (row) => row.rootConductorId === 'c1',
        )!;
        // 2 % hasta el tablero, expresado en la base de la salida 1Φ (220 V).
        expect(withUpstream.upstreamVoltageDropV).toBeCloseTo(4.4, 9);
        expect(withUpstream.voltageDropPct).toBeCloseTo(base.voltageDropPct + 2, 9);
    });

    it('marca la salida que mezcla alumbrado y tomacorriente (regla de la V1)', () => {
        const mixed = site(
            [at('tg', 'tg_location', 0), pole('p1', 20), at('out', 'outlet', 40, { kind: 'outlet', heightM: 0.4, powerW: 300 })],
            [wire('c1', 'tg', 'p1', 0, 20), wire('c2', 'p1', 'out', 20, 40)],
        );
        const [row] = analyzeSiteOutputs(mixed, settings).rows;
        expect(row.circuitLoadType).toBe('mixed');
        expect(row.normativeViolation).toBe(true);
        expect(row.installedPowerW).toBe(400);
    });

    it('la carga de las salidas sube al TG en la red', () => {
        const edge = (id: string, source: string, target: string) => ({
            id,
            sourceNodeId: source,
            targetNodeId: target,
            lengthMode: 'manual' as const,
            horizontalLengthM: 10,
            verticalLengthM: 0,
            conductorType: 'N2XOH',
            conductorMaterial: 'copper' as const,
            sectionMm2: 10,
            wireConfiguration: '3F+N+T',
        });
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
        const bridged = applySiteToNetwork(network, plant).data;
        const { calculations, outputRows } = calculateNetworkWithSite(
            bridged,
            plant,
            [],
            [],
        );
        const feeder = calculations.find((item) => item.edgeId === 'e2')!;
        expect(feeder.demandPowerW).toBe(200 + OUTLET_REFERENCE_W);
        const c1 = outputRows.find((row) => row.rootConductorId === 'c1')!;
        // Misma caída hasta el TG, comparada en % (bases distintas: 380 V / 220 V).
        expect((c1.upstreamVoltageDropV / 220) * 100).toBeCloseTo(
            feeder.accumulatedVoltageDropPercent,
            9,
        );
    });
});

describe('analyzeSiteOutputs · techado con luminarias', () => {
    it('la carga del techado entra a la salida del TG', () => {
        const techo: SiteElement = {
            id: 'techo',
            type: 'canopy',
            label: 'TECHO',
            vertices: [
                { x: 10, y: -5 },
                { x: 20, y: -5 },
                { x: 20, y: 5 },
                { x: 10, y: 5 },
            ],
            config: {
                kind: 'canopy',
                heightM: 3,
                roof: 'flat',
                translucent: false,
                columnSpacingM: 3,
                columnDiameterM: 0.2,
                lights: { enabled: true, count: 4, lumens: 2000, wattage: 18 },
            } as SiteElement['config'],
            style: { fillColor: '#000', strokeColor: '#000' },
        };
        const { rows } = analyzeSiteOutputs(
            site([at('tg', 'tg_location', 0), techo], [wire('c1', 'tg', 'techo', 0, 15)]),
            settings,
        );
        expect(rows[0].installedPowerW).toBe(72);
    });
});
