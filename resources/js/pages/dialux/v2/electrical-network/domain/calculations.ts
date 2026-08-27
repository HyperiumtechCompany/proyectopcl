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
    /**
     * Caída de tensión acumulada en VOLTIOS desde el TG real (raíz de la red
     * general) hasta el extremo receptor de este alimentador — incluye la
     * caída propia de este tramo. A diferencia de `accumulatedVoltageDropPercent`,
     * este valor en voltios es el que se inyecta como `upstreamVoltageDropV`
     * en el tablero raíz de un módulo (ver `ElectricalNetwork.tsx`), para que
     * su propio árbol TD→C encadene la caída real con la MISMA fórmula que
     * usa `calculatePanelCircuitSummaries` dentro del módulo.
     */
    accumulatedVoltageDropV: number;
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
    const walk = (nodeId: string, upstreamV: number): void => {
        for (const edge of children.get(nodeId) ?? []) {
            const load = loadAt(edge.targetNodeId);
            const powerFactor =
                edge.powerFactor ?? network.settings.defaultPowerFactor;
            // El % de caída de tensión se define contra el voltaje NOMINAL
            // del circuito que recibe la carga — no contra el voltaje del
            // sistema general. Un tablero de módulo (module_panel_port) casi
            // siempre publica su propio voltaje/fases reales (ej. 220V
            // monofásico colgado de un sistema 380V trifásico); usar el
            // voltaje global del TG ahí subestima o distorsiona el % real
            // (confirmado: la misma caída en voltios daba "conforme" contra
            // 380V y "no conforme" contra los 220V reales del tablero). Los
            // nodos sin puerto propio (Medidor, TG) sí usan el voltaje
            // general, porque ahí no hay un circuito receptor más específico.
            const targetPort = portByNode.get(edge.targetNodeId);
            const edgeVoltageV =
                targetPort?.nominalVoltageV || network.settings.nominalVoltageV;
            const edgePhases = targetPort?.phases ?? network.settings.phases;
            const currentA = circuitCurrent(
                load.demand,
                edgeVoltageV,
                edgePhases,
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
                edgeVoltageV,
                edgePhases,
                material,
            );
            const ownVoltageDropV = (ownPercent * edgeVoltageV) / 100;
            // Los VOLTIOS acumulados sí se suman sin ambigüedad (son una
            // cantidad física, no dependen de la base elegida); el % de
            // caída acumulada se recalcula aquí contra el voltaje de ESTE
            // tramo — nunca sumando porcentajes ya calculados con voltajes
            // distintos aguas arriba, que es matemáticamente inválido.
            const accumulatedV = upstreamV + ownVoltageDropV;
            const accumulatedPercent = (accumulatedV / edgeVoltageV) * 100;
            const suggestion = selectConductor({
                designCurrentA,
                lengthM,
                voltageV: edgeVoltageV,
                phases: edgePhases,
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
            // `selectConductor` cae al calibre más grande del catálogo
            // cuando NINGUNA sección cumple ampacidad + caída de tensión —
            // eso es un caso de "no hay solución local", no una sugerencia
            // válida. Ofrecerla igual (botón "Aplicar sección sugerida" o el
            // auto-corrector del árbol) puede saltar a un calibre absurdo
            // (ej. 300 mm²) sin que ese salto resuelva nada realmente. Solo
            // se expone `suggestedSectionMm2` cuando el propio motor no
            // reportó advertencias sobre esa elección; si las reportó, se
            // muestran como advertencia normal para que un humano revise el
            // alimentador (o el que está aguas arriba) manualmente.
            if (suggestion.warnings.length > 0) {
                warnings.push(...suggestion.warnings);
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
                suggestedSectionMm2:
                    suggestion.warnings.length === 0
                        ? suggestion.sectionMm2 || undefined
                        : undefined,
                ownVoltageDropV,
                ownVoltageDropPercent: ownPercent,
                accumulatedVoltageDropPercent: accumulatedPercent,
                accumulatedVoltageDropV: accumulatedV,
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
            walk(edge.targetNodeId, accumulatedV);
        }
    };
    if (network.rootNodeId) walk(network.rootNodeId, 0);

    return results;
}
