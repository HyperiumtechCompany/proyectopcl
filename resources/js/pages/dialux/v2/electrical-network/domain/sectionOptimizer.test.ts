import { describe, expect, it } from 'vitest';
import { calculateElectricalNetwork } from './calculations';
import { feederVoltageDrop } from './feederVoltageDrop';
import { optimizeFeederSections, STANDARD_SECTIONS_MM2 } from './sectionOptimizer';
import { calculateShortCircuits } from './shortCircuit';
import type { ElectricalEdge, ElectricalNetworkData, ModuleElectricalPort } from './types';

const edge = (id: string, source: string, target: string, lengthM: number, sectionMm2 = 4): ElectricalEdge => ({
    id,
    sourceNodeId: source,
    targetNodeId: target,
    lengthMode: 'manual',
    horizontalLengthM: lengthM,
    verticalLengthM: 0,
    conductorType: 'N2XOH',
    conductorMaterial: 'copper',
    sectionMm2,
    wireConfiguration: '3F+N+T',
    powerFactor: 0.9,
});

const port = (moduleId: number, demandW: number, reservePct = 0): ModuleElectricalPort => ({
    key: `${moduleId}`,
    moduleId,
    moduleName: `Módulo ${moduleId}`,
    sceneId: 's',
    sceneName: 'Piso 1',
    panelId: 'td',
    panelLabel: 'TD',
    panelRole: 'distribution',
    nominalVoltageV: 220,
    phases: 1,
    installedPowerW: demandW,
    demandPowerW: demandW,
    currentA: 0,
    mainBreakerA: 0,
    circuitsCount: 1,
    revision: '1',
    circuits:
        reservePct > 0
            ? [{ circuitId: 'c1', panelId: 'td', code: 'C1', type: 'lighting', totalPowerW: 0, demandPowerW: 0, currentA: 0, designCurrentA: 0, lengthM: 0, calculatedHorizontalLengthM: 0, calculatedVerticalLengthM: 0, sectionMm2: 2.5, breakerA: 16, voltageDropPct: reservePct, cumulativeVoltageDropPct: reservePct, status: 'ok', warnings: [] }]
            : [],
});

function build(edges: ElectricalEdge[]): ElectricalNetworkData {
    return {
        schemaVersion: 1,
        rootNodeId: 'service',
        settings: {
            nominalVoltageV: 380,
            phases: 3,
            connectionType: 'star',
            frequencyHz: 60,
            conductorMaterial: 'copper',
            workingTemperatureC: 40,
            defaultPowerFactor: 0.9,
            feederDropLimitPercent: 2.5,
            totalDropLimitPercent: 4,
        },
        nodes: [
            { id: 'service', type: 'service', label: 'Suministro', position: { x: 0, y: 0 } },
            { id: 'tg', type: 'main_panel', label: 'TG', position: { x: 0, y: 0 } },
            { id: 'm1', type: 'module_panel_port', label: 'TD', moduleId: 1, sceneId: 's', deviceId: 'td', position: { x: 0, y: 0 } },
            { id: 'm2', type: 'module_panel_port', label: 'TD', moduleId: 2, sceneId: 's', deviceId: 'td', position: { x: 0, y: 0 } },
        ],
        edges,
    };
}

const EDGES = () => [edge('e1', 'service', 'tg', 15), edge('e2', 'tg', 'm1', 80), edge('e3', 'tg', 'm2', 30)];

describe('optimizeFeederSections (R5: reparto óptimo de ΔU)', () => {
    it('coincide con la fuerza bruta (mismo redondeo) y la solución cumple con los valores exactos', () => {
        const network = build(EDGES());
        const ports = [port(1, 10000, 1.2), port(2, 4000, 0.8)];
        const calculations = calculateElectricalNetwork(network, ports, []);
        const result = optimizeFeederSections(network, ports, calculations);
        expect(result.feasible).toBe(true);

        // Fuerza bruta sobre la serie completa (15³ combinaciones).
        const calc = new Map(calculations.map((item) => [item.edgeId, item]));
        const drop = (id: string, section: number) => {
            const item = calc.get(id)!;
            return feederVoltageDrop({
                currentA: item.currentA,
                lengthM: item.lengthM,
                sectionMm2: section,
                voltageV: item.voltageV!,
                phases: item.phases!,
                material: 'cobre',
                powerFactor: 0.9,
                temperatureC: 40,
            }).dropPercent;
        };
        const up = (p: number) => Math.ceil(p / 0.01 - 1e-9);
        const massOf = (id: string, section: number) => {
            const item = calc.get(id)!;
            return item.lengthM * section * (item.phases === 3 ? 3 : 2) * 0.00896;
        };
        let bestRounded = Infinity;
        let bestExact = Infinity;
        for (const s1 of STANDARD_SECTIONS_MM2) {
            for (const s2 of STANDARD_SECTIONS_MM2) {
                for (const s3 of STANDARD_SECTIONS_MM2) {
                    const [d1, d2, d3] = [drop('e1', s1), drop('e2', s2), drop('e3', s3)];
                    if (Math.max(d1, d2, d3) > 2.5) continue;
                    const m = massOf('e1', s1) + massOf('e2', s2) + massOf('e3', s3);
                    if (d1 + d2 + 1.2 <= 4 && d1 + d3 + 0.8 <= 4) bestExact = Math.min(bestExact, m);
                    if (up(d1) + up(d2) + up(1.2) <= 400 && up(d1) + up(d3) + up(0.8) <= 400) {
                        bestRounded = Math.min(bestRounded, m);
                    }
                }
            }
        }
        expect(result.massKg.optimal).toBeCloseTo(bestRounded, 9);
        expect(result.massKg.optimal).toBeGreaterThanOrEqual(bestExact - 1e-9);

        // Aplicar la solución y recalcular la red: todo dentro de los límites.
        const sections = new Map(result.changes.map((change) => [change.edgeId, change.optimalMm2]));
        const applied = build(EDGES().map((item) => ({ ...item, sectionMm2: sections.get(item.id)! })));
        const after = calculateElectricalNetwork(applied, ports, []);
        const byId = new Map(after.map((item) => [item.edgeId, item]));
        expect(byId.get('e2')!.accumulatedVoltageDropPercent + 1.2).toBeLessThanOrEqual(4 + 1e-9);
        expect(byId.get('e3')!.accumulatedVoltageDropPercent + 0.8).toBeLessThanOrEqual(4 + 1e-9);
        for (const item of after) expect(item.ownVoltageDropPercent).toBeLessThanOrEqual(2.5 + 1e-9);
        expect(result.maxAccumulatedPercent).toBeLessThanOrEqual(4 + 1e-9);
    });

    it('nunca pesa más que el corrector tramo a tramo cuando éste es factible', () => {
        const network = build(EDGES());
        const ports = [port(1, 10000), port(2, 4000)];
        const calculations = calculateElectricalNetwork(network, ports, []);
        const result = optimizeFeederSections(network, ports, calculations);
        const perFeeder = build(
            EDGES().map((item) => ({
                ...item,
                sectionMm2: calculations.find((c) => c.edgeId === item.id)!.suggestedSectionMm2 ?? item.sectionMm2,
            })),
        );
        const perFeederCalc = calculateElectricalNetwork(perFeeder, ports, []);
        if (perFeederCalc.every((item) => item.accumulatedVoltageDropPercent <= 4)) {
            expect(result.massKg.optimal).toBeLessThanOrEqual(result.massKg.perFeeder + 1e-9);
        }
    });

    it('sin solución posible lo informa (reserva interna mayor que el límite total)', () => {
        const network = build(EDGES());
        const ports = [port(1, 10000, 4.5), port(2, 4000)];
        const result = optimizeFeederSections(network, ports, calculateElectricalNetwork(network, ports, []));
        expect(result.feasible).toBe(false);
        expect(result.infeasibleRoots).toEqual(['service']);
    });

    it('respeta la ampacidad del catálogo y la sección mínima por cortocircuito', () => {
        const network = build(EDGES());
        const ports = [port(1, 10000), port(2, 4000)];
        const calculations = calculateElectricalNetwork(network, ports, []);
        const catalog = STANDARD_SECTIONS_MM2.map((section, index) => ({
            id: index,
            user_id: null,
            material: 'cobre' as const,
            section_mm2: section,
            insulation: 'N2XOH',
            ampacity_a: section * 6,
        }));
        const shortCircuits = {
            nodes: new Map(),
            edges: new Map([['e3', { edgeId: 'e3', ikAtOriginKa: 5, k: 143, clearingTimeS: 0.1, minSectionMm2: 11, ok: false }]]),
            rootsWithoutSource: [],
        };
        const result = optimizeFeederSections(network, ports, calculations, catalog, shortCircuits);
        expect(result.usedCatalog).toBe(true);
        for (const change of result.changes) {
            const design = calculations.find((c) => c.edgeId === change.edgeId)!.designCurrentA;
            expect(change.optimalMm2 * 6).toBeGreaterThanOrEqual(design);
        }
        expect(result.changes.find((change) => change.edgeId === 'e3')!.optimalMm2).toBeGreaterThanOrEqual(16);
    });

    it('un alimentador con sección fijada en la planta conserva su sección', () => {
        const network = build(EDGES());
        const ports = [port(1, 10000), port(2, 4000)];
        const result = optimizeFeederSections(
            network,
            ports,
            calculateElectricalNetwork(network, ports, []),
            [],
            undefined,
            { fixedEdgeIds: new Set(['e3']) },
        );
        expect(result.changes.find((change) => change.edgeId === 'e3')!.optimalMm2).toBe(4);
    });

    it('un tramo fijado que ya supera su límite propio no se declara factible — auditoría R6', () => {
        const network = build([edge('e1', 'service', 'tg', 15), edge('e2', 'tg', 'm1', 300, 2.5), edge('e3', 'tg', 'm2', 30)]);
        const ports = [port(1, 10000), port(2, 4000)];
        const calculations = calculateElectricalNetwork(network, ports, []);
        expect(calculations.find((c) => c.edgeId === 'e2')!.ownVoltageDropPercent).toBeGreaterThan(2.5);
        const result = optimizeFeederSections(network, ports, calculations, [], undefined, {
            fixedEdgeIds: new Set(['e2']),
        });
        expect(result.fixedOverLimitEdgeIds).toEqual(['e2']);
        expect(result.feasible).toBe(false);
    });

    it('recomprueba la térmica con las secciones óptimas (cortocircuito recalculado)', () => {
        const network = build(EDGES());
        network.nodes[0] = { ...network.nodes[0], transformerKva: 400 };
        const ports = [port(1, 10000), port(2, 4000)];
        const calculations = calculateElectricalNetwork(network, ports, []);
        const shortCircuits = calculateShortCircuits(network, ports, calculations);
        const result = optimizeFeederSections(network, ports, calculations, [], shortCircuits);
        const sections = new Map(result.changes.map((c) => [c.edgeId, c.optimalMm2]));
        const applied = { ...network, edges: network.edges.map((e) => ({ ...e, sectionMm2: sections.get(e.id)! })) };
        const after = calculateShortCircuits(applied, ports, calculations);
        if (result.thermalRecheckFailures.length === 0) {
            for (const change of result.changes) {
                expect(change.optimalMm2).toBeGreaterThanOrEqual(after.edges.get(change.edgeId)!.minSectionMm2 - 1e-9);
            }
        }
    });
});
