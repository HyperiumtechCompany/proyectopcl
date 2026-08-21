import {
    circuitCurrent,
    selectBreaker,
    selectConductor,
    voltageDropPct,
} from '@/pages/dialux/electrical/engine/formulas';
import type { ConductorCatalog } from '@/pages/dialux/electrical/engine/types';
import type { ElectricalNetworkData, ModuleElectricalPort } from './types';

export interface EdgeCalculation {
    edgeId: string;
    lengthM: number;
    installedPowerW: number;
    demandPowerW: number;
    currentA: number;
    designCurrentA: number;
    ampacityA?: number;
    breakerA: number;
    suggestedSectionMm2?: number;
    ownVoltageDropV: number;
    ownVoltageDropPercent: number;
    accumulatedVoltageDropPercent: number;
    status: 'complete' | 'warning' | 'non_compliant' | 'incomplete';
    warnings: string[];
}

export function calculateElectricalNetwork(
    network: ElectricalNetworkData,
    ports: ModuleElectricalPort[],
    conductors: ConductorCatalog[] = [],
): EdgeCalculation[] {
    const portByNode = new Map(
        network.nodes
            .filter((node) => node.type === 'module_panel_port')
            .map((node) => [
                node.id,
                ports.find(
                    (port) =>
                        port.moduleId === node.moduleId &&
                        port.sceneId === node.sceneId &&
                        port.panelId === node.deviceId,
                ),
            ]),
    );
    const children = new Map<string, ElectricalNetworkData['edges']>();
    for (const edge of network.edges) {
        children.set(edge.sourceNodeId, [
            ...(children.get(edge.sourceNodeId) ?? []),
            edge,
        ]);
    }

    const loadMemo = new Map<string, { installed: number; demand: number }>();
    const loadAt = (nodeId: string): { installed: number; demand: number } => {
        if (loadMemo.has(nodeId)) return loadMemo.get(nodeId)!;
        const port = portByNode.get(nodeId);
        const downstream = (children.get(nodeId) ?? []).reduce(
            (total, edge) => {
                const child = loadAt(edge.targetNodeId);
                return {
                    installed: total.installed + child.installed,
                    demand: total.demand + child.demand,
                };
            },
            { installed: 0, demand: 0 },
        );
        const result = {
            installed:
                (port?.ownInstalledPowerW ?? port?.installedPowerW ?? 0) +
                downstream.installed,
            demand:
                (port?.ownDemandPowerW ?? port?.demandPowerW ?? 0) +
                downstream.demand,
        };
        loadMemo.set(nodeId, result);
        return result;
    };
    if (network.rootNodeId) loadAt(network.rootNodeId);

    const results: EdgeCalculation[] = [];
    const walk = (nodeId: string, accumulated: number): void => {
        for (const edge of children.get(nodeId) ?? []) {
            const load = loadAt(edge.targetNodeId);
            const powerFactor =
                edge.powerFactor ?? network.settings.defaultPowerFactor;
            const currentA = circuitCurrent(
                load.demand,
                network.settings.nominalVoltageV,
                network.settings.phases,
                powerFactor,
            );
            const designCurrentA =
                currentA * (network.settings.designFactor ?? 1.25);
            const lengthM = edge.horizontalLengthM + edge.verticalLengthM;
            const material =
                edge.conductorMaterial === 'copper' ? 'cobre' : 'aluminio';
            const sameInsulation = conductors.filter(
                (item) =>
                    item.material === material &&
                    item.insulation.toLowerCase() ===
                        edge.conductorType.toLowerCase(),
            );
            const catalog =
                sameInsulation.length > 0
                    ? sameInsulation
                    : conductors.filter((item) => item.material === material);
            const selected = catalog.find(
                (item) => item.section_mm2 === edge.sectionMm2,
            );
            const ownPercent = voltageDropPct(
                currentA,
                lengthM,
                edge.sectionMm2,
                network.settings.nominalVoltageV,
                network.settings.phases,
                material,
            );
            const accumulatedPercent = accumulated + ownPercent;
            const suggestion = selectConductor({
                designCurrentA,
                lengthM,
                voltageV: network.settings.nominalVoltageV,
                phases: network.settings.phases,
                minSectionMm2: 2.5,
                maxVoltageDropPct: network.settings.feederDropLimitPercent,
                conductors: catalog,
                material,
            });
            const breaker = selectBreaker(designCurrentA);
            const warnings: string[] = [];
            if (lengthM <= 0) {
                warnings.push(
                    'Falta definir la longitud del alimentador para calcular la caída de tensión.',
                );
            }
            if (load.demand <= 0) {
                warnings.push(
                    'El módulo todavía no publica máxima demanda. Guarda o recalcula su documento eléctrico.',
                );
            }
            if (!selected) {
                warnings.push(
                    `La sección ${edge.sectionMm2} mm² no existe para ${edge.conductorType || material}.`,
                );
            }
            if (selected && selected.ampacity_a < designCurrentA) {
                warnings.push(
                    `Ampacidad insuficiente: ${selected.ampacity_a} A < ${designCurrentA.toFixed(2)} A.`,
                );
            }
            if (ownPercent > network.settings.feederDropLimitPercent) {
                warnings.push(
                    `La caída del alimentador supera ${network.settings.feederDropLimitPercent}%.`,
                );
            }
            if (accumulatedPercent > network.settings.totalDropLimitPercent) {
                warnings.push(
                    `La caída acumulada supera ${network.settings.totalDropLimitPercent}%.`,
                );
            }

            results.push({
                edgeId: edge.id,
                lengthM,
                installedPowerW: load.installed,
                demandPowerW: load.demand,
                currentA,
                designCurrentA,
                ampacityA: selected?.ampacity_a,
                breakerA: breaker.amps,
                suggestedSectionMm2: suggestion.sectionMm2 || undefined,
                ownVoltageDropV:
                    (ownPercent * network.settings.nominalVoltageV) / 100,
                ownVoltageDropPercent: ownPercent,
                accumulatedVoltageDropPercent: accumulatedPercent,
                status:
                    lengthM <= 0 || load.demand <= 0
                        ? 'incomplete'
                        : warnings.length > 0
                          ? 'non_compliant'
                          : ownPercent >
                              network.settings.feederDropLimitPercent * 0.8
                            ? 'warning'
                            : 'complete',
                warnings,
            });
            walk(edge.targetNodeId, accumulatedPercent);
        }
    };
    if (network.rootNodeId) walk(network.rootNodeId, 0);

    return results;
}
