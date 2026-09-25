import { describe, expect, it } from 'vitest';
import { validateElectricalNetwork } from '../../electrical-network/domain/graph';
import type {
    ElectricalNetworkData,
    ModuleElectricalPort,
} from '../../electrical-network/domain/types';
import type { LuminairePhotometry } from '../lib/luminaireCatalog';
import { suggestProjectionGrid } from './siteFixtureProjection';
import { calculateSiteLighting } from './siteLightingCalculation';
import { applySiteToNetwork, sitePanelNodeId } from './siteNetworkBridge';
import { calculateNetworkWithSite } from './siteNetworkLive';
import type { SiteCircuit, SiteData, SiteElement } from './types';

/**
 * Fase 6 — prueba integral del flujo completo de la planta general (plan
 * `plan_compatibilizacion_planta_general_red_ct.md`): un colegio en miniatura
 * dibujado en 2D debe quedar enlazado a la red, calcular cargas y ΔU en
 * cascada, generar las salidas CT del motor V1 y el alumbrado exterior.
 */

const settings: ElectricalNetworkData['settings'] = {
    nominalVoltageV: 380,
    phases: 3,
    connectionType: 'star',
    frequencyHz: 60,
    conductorMaterial: 'copper',
    workingTemperatureC: 40,
    defaultPowerFactor: 0.9,
    feederDropLimitPercent: 2.5,
    totalDropLimitPercent: 4,
};

const baseNetwork = (): ElectricalNetworkData => ({
    schemaVersion: 1,
    rootNodeId: 'svc',
    settings,
    nodes: [
        { id: 'svc', type: 'service', label: 'Suministro', position: { x: 0, y: 0 } },
        { id: 'mtr', type: 'meter', label: 'Medidor', position: { x: 240, y: 0 } },
        { id: 'tg', type: 'main_panel', label: 'TG', position: { x: 480, y: 0 } },
    ],
    edges: [
        {
            id: 'e-svc',
            sourceNodeId: 'svc',
            targetNodeId: 'mtr',
            lengthMode: 'manual',
            horizontalLengthM: 5,
            verticalLengthM: 0,
            conductorType: 'N2XOH',
            conductorMaterial: 'copper',
            sectionMm2: 50,
            wireConfiguration: '3F+N+T',
        },
        {
            id: 'e-tg',
            sourceNodeId: 'mtr',
            targetNodeId: 'tg',
            lengthMode: 'manual',
            horizontalLengthM: 10,
            verticalLengthM: 0,
            conductorType: 'N2XOH',
            conductorMaterial: 'copper',
            sectionMm2: 35,
            wireConfiguration: '3F+N+T',
        },
    ],
});

const style = { fillColor: '#000', strokeColor: '#000' };
const rect = (id: string, type: SiteElement['type'], x: number, y: number, w: number, h: number, extra: Partial<SiteElement> = {}): SiteElement => ({
    id,
    type,
    label: id.toUpperCase(),
    vertices: [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
    ],
    style,
    ...extra,
});
const at = (id: string, type: SiteElement['type'], x: number, y: number, config?: SiteElement['config']): SiteElement => ({
    id,
    type,
    label: id.toUpperCase(),
    vertices: [{ x, y }],
    config,
    style,
});
const pole = (id: string, x: number, y: number) =>
    at(id, 'pole', x, y, {
        kind: 'pole',
        heightM: 8,
        armLengthM: 0,
        armDirectionDeg: 0,
        fixtures: 1,
        lumens: 12000,
        wattage: 100,
        maintenanceFactor: 0.8,
    } as SiteElement['config']);
const cable = (id: string, from: string, to: string, points: Array<[number, number]>, extra: Partial<SiteCircuit> = {}): SiteCircuit => ({
    id,
    sourceId: from,
    targetId: to,
    waypoints: points.map(([x, y]) => ({ x, y })),
    calculatedLengthM: 0,
    wireCount: 3,
    wastePct: 0,
    sectionMm2: 6,
    ...extra,
});

const port = (panelId: string, parentPanelId: string | null, demandW: number): ModuleElectricalPort => ({
    key: `7:s1:${panelId}`,
    moduleId: 7,
    moduleName: 'Módulo 7',
    sceneId: 's1',
    sceneName: 'Piso 1',
    panelId,
    panelLabel: panelId.toUpperCase(),
    parentPanelId,
    panelRole: parentPanelId ? 'sub_distribution' : 'distribution',
    nominalVoltageV: 380,
    phases: 3,
    installedPowerW: demandW,
    demandPowerW: demandW,
    ownInstalledPowerW: demandW,
    ownDemandPowerW: demandW,
    currentA: 0,
    mainBreakerA: 32,
    circuitsCount: 3,
    revision: 'r1',
});
const ports = [port('td', null, 6000), port('td-01', 'td', 3000)];

const site: SiteData = {
    schemaVersion: 1,
    terrainScaleM: 1,
    gridSizeM: 1,
    canvasWidth: 200,
    canvasHeight: 200,
    elements: [
        at('trafo', 'transformer', 0, 0),
        at('tg1', 'tg_location', 20, 0),
        at('tg2', 'tg_location', 20, 40),
        rect('bloque', 'building_block', 60, 30, 20, 20, { moduleId: 7, moduleName: 'Módulo 7', heightM: 6 }),
        at('caja', 'pull_box', 40, 0),
        pole('p1', 60, 0),
        pole('p2', 90, 0),
        rect('cancha', 'court', 50, -20, 50, 25),
        rect('techo', 'canopy', 20, 60, 12, 8, {
            config: {
                kind: 'canopy',
                heightM: 3,
                roof: 'gable',
                translucent: false,
                columnSpacingM: 4,
                columnDiameterM: 0.2,
                lights: { enabled: true, count: 4, rows: 2, columns: 2, lumens: 2000, wattage: 18 },
            } as SiteElement['config'],
        }),
    ],
    feederPaths: [],
    circuits: [
        cable('c-tg1', 'trafo', 'tg1', [[0, 0], [20, 0]], { wireCount: 4, sectionMm2: 35 }),
        cable('c-tg2', 'trafo', 'tg2', [[0, 0], [0, 40], [20, 40]], { wireCount: 4, sectionMm2: 35 }),
        cable('c-mod', 'tg2', 'bloque', [[20, 40], [70, 40]], { wireCount: 4, sectionMm2: 16 }),
        cable('c-s1', 'tg1', 'caja', [[20, 0], [40, 0]]),
        cable('c-s2', 'caja', 'p1', [[40, 0], [60, 0]]),
        cable('c-s3', 'p1', 'p2', [[60, 0], [90, 0]]),
        cable('c-techo', 'tg2', 'techo', [[20, 40], [26, 64]]),
    ],
    layers: [],
};

const NO_PHOTOMETRY = new Map<number, LuminairePhotometry>();

describe('Fase 6 · flujo integral de la planta general', () => {
    const bridged = applySiteToNetwork(baseNetwork(), site, {
        ports,
        panelVerticalM: () => 2,
    });
    const data = bridged.data;
    const { calculations, outputRows } = calculateNetworkWithSite(data, site, ports, []);
    const calc = (edgeId: string | undefined) =>
        calculations.find((item) => item.edgeId === edgeId)!;
    const incoming = (nodeId: string) =>
        data.edges.find((edge) => edge.targetNodeId === nodeId);

    it('la red queda completa: un suministro, sin nodos desconectados, ciclos ni avisos', () => {
        expect(validateElectricalNetwork(data)).toEqual([]);
        expect(data.nodes.filter((node) => node.type === 'service')).toHaveLength(1);
        expect(data.nodes.find((node) => node.id === 'svc')?.siteElementId).toBe('trafo');
        expect(bridged.conflicts).toEqual([]);
    });

    it('los cables dibujados son los alimentadores, con su longitud y sección', () => {
        const toTg1 = incoming('tg')!;
        const toTg2 = incoming(sitePanelNodeId('tg2'))!;
        expect(toTg1).toMatchObject({ sourceNodeId: 'mtr', siteCircuitId: 'c-tg1', sectionMm2: 35 });
        expect(toTg1.horizontalLengthM).toBeCloseTo(20, 6);
        expect(toTg2).toMatchObject({ sourceNodeId: 'mtr', siteCircuitId: 'c-tg2' });
        expect(toTg2.horizontalLengthM).toBeCloseTo(60, 6);
        // El cable al bloque alimenta el TD raíz del módulo (+2 m de subida al tablero).
        const td = data.nodes.find((node) => node.deviceId === 'td')!;
        expect(incoming(td.id)).toMatchObject({
            sourceNodeId: sitePanelNodeId('tg2'),
            siteCircuitId: 'c-mod',
            verticalLengthM: 2,
        });
    });

    it('las cargas suben correctamente por el árbol (sin doble conteo)', () => {
        const tg1Load = calc(incoming('tg')!.id).demandPowerW;
        const tg2Load = calc(incoming(sitePanelNodeId('tg2'))!.id).demandPowerW;
        // TG1: 2 postes de 100 W. TG2: módulo (6000 + 3000 W) + techado (4 × 18 W).
        expect(tg1Load).toBeCloseTo(200, 6);
        expect(tg2Load).toBeCloseTo(9000 + 72, 6);
        // El suministro lleva la suma de ambos TG.
        expect(calc('e-svc').demandPowerW).toBeCloseTo(tg1Load + tg2Load, 6);
    });

    it('la caída de tensión crece en cascada suministro → TG → módulo', () => {
        const svc = calc('e-svc').accumulatedVoltageDropV;
        const tg2 = calc(incoming(sitePanelNodeId('tg2'))!.id).accumulatedVoltageDropV;
        const td = calc(incoming(data.nodes.find((node) => node.deviceId === 'td')!.id)!.id)
            .accumulatedVoltageDropV;
        expect(svc).toBeGreaterThan(0);
        expect(tg2).toBeGreaterThan(svc);
        expect(td).toBeGreaterThan(tg2);
    });

    it('las salidas de cada TG salen del motor CT V1 y arrancan de la caída hasta su tablero', () => {
        const tg1Rows = outputRows.filter((row) => row.panelElementId === 'tg1');
        const tg2Rows = outputRows.filter((row) => row.panelElementId === 'tg2');
        expect(tg1Rows).toHaveLength(1);
        expect(tg1Rows[0]).toMatchObject({ installedPowerW: 200, circuitLoadType: 'lighting' });
        // 70 m dibujados + subida por los 2 postes de 8 m.
        expect(tg1Rows[0].lengthM).toBeCloseTo(70 + 16, 6);
        expect([...tg1Rows[0].circuitIds].sort()).toEqual(['c-s1', 'c-s2', 'c-s3']);
        expect(tg2Rows).toHaveLength(1);
        expect(tg2Rows[0].installedPowerW).toBe(72);
        // La salida 1Φ arranca del % acumulado hasta TG1 (base 220 V).
        expect((tg1Rows[0].upstreamVoltageDropV / 220) * 100).toBeCloseTo(
            calc(incoming('tg')!.id).accumulatedVoltageDropPercent,
            9,
        );
    });

    it('el alumbrado exterior calcula la cancha y el techado con el motor V1', () => {
        const lighting = calculateSiteLighting(site, NO_PHOTOMETRY);
        const court = lighting.areas.find((area) => area.elementId === 'cancha')!;
        const canopy = lighting.areas.find((area) => area.elementId === 'techo')!;
        expect(lighting.luminaires).toBe(2 + 4);
        expect(court.result.avg_lux).toBeGreaterThan(0);
        expect(court.luminairesUsed).toBe(2);
        expect(canopy.result.avg_lux).toBeGreaterThan(0);
    });

    it('la proyección propone una grilla que cumple la regla de separación', () => {
        const suggestion = suggestProjectionGrid({
            site,
            areaId: 'cancha',
            targetLux: 50,
            lumensEach: 12000,
            maintenanceFactor: 0.8,
            mountingHeightM: 8,
        })!;
        expect(50 / suggestion.columns).toBeLessThanOrEqual(24);
        expect(25 / suggestion.rows).toBeLessThanOrEqual(24);
        expect(suggestion.rows * suggestion.columns).toBeGreaterThanOrEqual(
            suggestion.byLumens.count,
        );
    });
});
