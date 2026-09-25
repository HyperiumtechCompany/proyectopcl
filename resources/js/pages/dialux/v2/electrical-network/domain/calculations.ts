import {
    circuitCurrent,
    selectBreaker,
    selectConductor,
} from '@/pages/dialux/electrical/engine/formulas';
import type { ConductorCatalog } from '@/pages/dialux/electrical/engine/types';
import { feederVoltageDrop } from './feederVoltageDrop';
import { networkRootIds } from './graph';
import type {
    ElectricalNetworkData,
    ElectricalNode,
    ModuleElectricalPort,
} from './types';

export interface EdgeCalculation {
    edgeId: string;
    lengthM: number;
    installedPowerW: number;
    /** Demanda del tablero receptor, ya con su factor de simultaneidad. */
    demandPowerW: number;
    /** Suma simple de las demandas de las salidas del tablero receptor (sin fs). */
    outgoingDemandPowerW: number;
    /** Factor de simultaneidad aplicado en el tablero receptor (1 = ninguno). */
    simultaneityFactor: number;
    currentA: number;
    designCurrentA: number;
    ampacityA?: number;
    breakerA: number;
    suggestedSectionMm2?: number;
    ownVoltageDropV: number;
    ownVoltageDropPercent: number;
    accumulatedVoltageDropPercent: number;
    /**
     * Caída acumulada desde el suministro hasta el extremo receptor de este
     * alimentador, en VOLTIOS expresados en la base de ESTE tramo
     * (= `accumulatedVoltageDropPercent` × tensión del tablero receptor). Es
     * lo que se inyecta como `upstreamVoltageDropV` en el tablero raíz de un
     * módulo (ver `ElectricalNetwork.tsx`), en la misma base con la que el
     * motor CT de la V1 evalúa ese tablero.
     */
    accumulatedVoltageDropV: number;
    status: 'complete' | 'warning' | 'non_compliant' | 'incomplete';
    warnings: string[];
    /** Tensión, sistema y cos φ con que se evaluó el tramo (los usa el optimizador R5). */
    voltageV?: number;
    phases?: 1 | 3;
    powerFactor?: number;
}

/** Factor de simultaneidad válido del tablero (0 < fs ≤ 1); si no, 1. */
export function simultaneityFactorOf(node: ElectricalNode | undefined): number {
    const fs = node?.simultaneityFactor;
    return typeof fs === 'number' && fs > 0 && fs <= 1 ? fs : 1;
}

/**
 * Factor de simultaneidad de REFERENCIA para un tablero de distribución según
 * su número de circuitos de salida: IEC 61439-1 (factor de simultaneidad
 * asignado supuesto) — 2–3 → 0,9; 4–5 → 0,8; 6–9 → 0,7; ≥ 10 → 0,6. Solo se
 * SUGIERE en la interfaz (el usuario decide aplicarlo); verificar la edición
 * vigente de la norma antes de citarlo.
 */
export function suggestedSimultaneityFactor(outgoingCircuits: number): number {
    if (outgoingCircuits <= 1) return 1;
    if (outgoingCircuits <= 3) return 0.9;
    if (outgoingCircuits <= 5) return 0.8;
    if (outgoingCircuits <= 9) return 0.7;
    return 0.6;
}

export function calculateElectricalNetwork(
    network: ElectricalNetworkData,
    ports: ModuleElectricalPort[],
    conductors: ConductorCatalog[] = [],
    /**
     * Carga propia adicional por nodo (p.ej. las salidas de un TG de la
     * Planta General hacia postes/tomacorrientes, `site/domain/siteOutputs`).
     */
    extraLoads: Map<string, { installed: number; demand: number }> = new Map(),
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

    const nodeById = new Map(network.nodes.map((node) => [node.id, node]));
    const loadMemo = new Map<
        string,
        { installed: number; demand: number; outgoingDemand: number; fs: number }
    >();
    // Guarda anti-ciclo: un dato con ciclo (que `validateElectricalNetwork`
    // ya reporta) no debe colgar el cálculo con recursión infinita.
    const loading = new Set<string>();
    const loadAt = (
        nodeId: string,
    ): { installed: number; demand: number; outgoingDemand: number; fs: number } => {
        if (loadMemo.has(nodeId)) return loadMemo.get(nodeId)!;
        if (loading.has(nodeId)) {
            return { installed: 0, demand: 0, outgoingDemand: 0, fs: 1 };
        }
        loading.add(nodeId);
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
        const extra = extraLoads.get(nodeId);
        // Simultaneidad (R1): se aplica a las SALIDAS del tablero (hijos +
        // salidas de la planta), nunca a su carga propia ni a la potencia
        // instalada. Sin factor → 1 → suma simple (resultado anterior).
        const fs = simultaneityFactorOf(nodeById.get(nodeId));
        const outgoingDemand = (extra?.demand ?? 0) + downstream.demand;
        const result = {
            installed:
                (port?.ownInstalledPowerW ?? port?.installedPowerW ?? 0) +
                (extra?.installed ?? 0) +
                downstream.installed,
            demand:
                (port?.ownDemandPowerW ?? port?.demandPowerW ?? 0) +
                fs * outgoingDemand,
            outgoingDemand,
            fs,
        };
        loadMemo.set(nodeId, result);
        loading.delete(nodeId);
        return result;
    };
    const roots = networkRootIds(network);
    for (const root of roots) loadAt(root);

    const results: EdgeCalculation[] = [];
    const walked = new Set<string>();
    /**
     * `upstreamPercent` = caída acumulada (%) hasta `nodeId`. Se acumulan
     * PORCENTAJES, no voltios: en un sistema en estrella balanceado (p.ej.
     * 380/220 V) el % de un tramo trifásico es el mismo referido a la tensión
     * de línea o a la de fase, así que la suma de % es exacta al pasar de un
     * tramo 3Φ (√3·I·Z, base de línea) a uno 1Φ (2·I·Z, base de fase). Sumar
     * VOLTIOS de ambas bases sobrestimaba la caída (auditoría
     * `dialux-electrical-reviewer`, Fase 6).
     */
    const walk = (nodeId: string, upstreamPercent: number): void => {
        if (walked.has(nodeId)) return;
        walked.add(nodeId);
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
            // Tableros sin puerto (TG/sub tablero de la planta, ATS): su
            // sistema propio si se definió en Red y CT; si no, el general.
            const targetNode = nodeById.get(edge.targetNodeId);
            const edgePhases =
                targetPort?.phases ?? targetNode?.phases ?? network.settings.phases;
            const edgeVoltageV =
                targetPort?.nominalVoltageV ||
                targetNode?.nominalVoltageV ||
                (edgePhases === 1 &&
                network.settings.phases === 3 &&
                network.settings.connectionType === 'star'
                    ? network.settings.nominalVoltageV / Math.sqrt(3)
                    : network.settings.nominalVoltageV);
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
            // IEC 60364-5-52 Anexo G (cos φ + reactancia), ver feederVoltageDrop.ts.
            const { dropPercent: ownPercent, dropV: ownVoltageDropV } =
                feederVoltageDrop({
                    currentA,
                    lengthM,
                    sectionMm2: edge.sectionMm2,
                    voltageV: edgeVoltageV,
                    phases: edgePhases,
                    material,
                    powerFactor,
                    temperatureC: network.settings.workingTemperatureC,
                });
            // % acumulado exacto (ver `walk`); los voltios acumulados se
            // expresan en la base de ESTE tramo (la del tablero que lo
            // recibe) — así se inyectan como `upstreamVoltageDropV` al motor
            // CT de la V1 en la misma base con la que ese tablero calcula.
            const accumulatedPercent = upstreamPercent + ownPercent;
            const accumulatedV = (accumulatedPercent / 100) * edgeVoltageV;
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
            if (!selected && catalog.length === 0) {
                warnings.push(
                    `No hay conductores de ${material} en el catálogo: la caída se calcula con su resistividad, pero no se verifica la ampacidad. Cárgalos en Catálogos.`,
                );
            } else if (!selected) {
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
                outgoingDemandPowerW: load.outgoingDemand,
                simultaneityFactor: load.fs,
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
                voltageV: edgeVoltageV,
                phases: edgePhases,
                powerFactor,
            });
            walk(edge.targetNodeId, accumulatedPercent);
        }
    };
    for (const root of roots) walk(root, 0);

    return results;
}
