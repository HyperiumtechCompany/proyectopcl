import type { EdgeCalculation } from './calculations';
import { conductorResistivity, FEEDER_REACTANCE_OHM_PER_M } from './feederVoltageDrop';
import { networkRootIds } from './graph';
import { sizeSupplies } from './supplySizing';
import type {
    ElectricalEdge,
    ElectricalNetworkData,
    ElectricalNode,
    ModuleElectricalPort,
} from './types';

/**
 * Corriente de cortocircuito máxima en cada tablero de la red (R3 de
 * `plan_red_ct_dimensionamiento_multimodulo.md`), por el método de las
 * impedancias de IEC 60909-0:2016:
 *
 *     I''k3 = c · Un / (√3·|Z|)   (falla trifásica; vale en estrella y en delta)
 *     I''k1 ≈ c · U1 / |Z_lazo|    (tablero 1Φ: U1 = su tensión — fase-neutro
 *                                  en estrella, fase-fase en delta o red 1Φ)
 * La tensión es la PROPIA de cada tablero si la declara (puerto del módulo o
 * `nominalVoltageV` del nodo), igual que la caída de tensión en `calculations.ts`.
 *
 *  - c = cmax = 1,05: redes de BT con tolerancia de +6 % (IEC 60909-0, Tabla 1).
 *  - Red aguas arriba: Z_Q = c·Un² / S''kQ, X_Q = 0,995·Z_Q, R_Q = 0,1·X_Q
 *    (IEC 60909-0, 6.2). S''kQ por defecto 500 MVA (dato de la distribuidora).
 *  - Transformador: Z_T = uk·Un² / S_rT. Sin pérdidas en carga conocidas se
 *    toma como reactancia pura (R_T = 0): |Z| menor → I''k mayor, lado
 *    seguro para el poder de corte. uk por defecto según IEC 60076-5 (Tabla 1):
 *    ≤ 630 kVA → 4 %, ≤ 1250 kVA → 5 %, ≤ 2500 kVA → 6 %.
 *  - Cables: R a 20 °C (I''k máxima, IEC 60909-0 §6.3), X = 0,08 mΩ/m.
 *    Tramo trifásico: se suma la impedancia de fase (falla trifásica, I''k3).
 *    Tramo monofásico: se suma el lazo fase + neutro (2·Z_L) y el resultado es
 *    la falla fase-neutro I''k1 aproximada (neutro de igual sección, Z0 del
 *    transformador Dyn ≈ Z1). Se indica en `kind`.
 *
 * Verificación térmica del cable ante la falla (IEC 60364-4-43, 434.5.2 —
 * régimen adiabático): S ≥ I·√t / k, con I = I''k en el ORIGEN del cable (el
 * mayor valor que puede circular por él) y t = tiempo de despeje. k:
 * Cu PVC 115, Cu XLPE 143, Al PVC 76, Al XLPE 94 (IEC 60364-4-43, Tabla 43A).
 */
export const SHORT_CIRCUIT_VOLTAGE_FACTOR = 1.05;
export const DEFAULT_UPSTREAM_SHORT_CIRCUIT_MVA = 500;
export const DEFAULT_FAULT_CLEARING_TIME_S = 0.1;

export function defaultTransformerUkPercent(kva: number): number {
    if (kva <= 630) return 4;
    if (kva <= 1250) return 5;
    return 6;
}

interface Impedance {
    r: number;
    x: number;
}

const add = (a: Impedance, b: Impedance, factor = 1): Impedance => ({
    r: a.r + b.r * factor,
    x: a.x + b.x * factor,
});
const magnitude = (z: Impedance) => Math.hypot(z.r, z.x);

export interface NodeShortCircuit {
    nodeId: string;
    /** I''k máxima en las barras del tablero, kA. */
    ikKa: number;
    /** '3F' = trifásica; '1F' = fase-neutro aproximada (tablero alimentado en 1Φ). */
    kind: '3F' | '1F';
    impedanceOhm: number;
    breakingCapacityKa?: number;
    /** Poder de corte ≥ I''k (solo si el usuario lo definió). */
    breakingCapacityOk?: boolean;
}

export interface EdgeThermalCheck {
    edgeId: string;
    /** I''k en el origen del cable, kA. */
    ikAtOriginKa: number;
    k: number;
    clearingTimeS: number;
    minSectionMm2: number;
    ok: boolean;
}

export interface ShortCircuitResult {
    nodes: Map<string, NodeShortCircuit>;
    edges: Map<string, EdgeThermalCheck>;
    /** Raíces sin potencia de transformador (ni fijada ni sugerida): sin cálculo. */
    rootsWithoutSource: string[];
}

/** k de IEC 60364-4-43 Tabla 43A según material y aislamiento. */
export function thermalConstantK(edge: ElectricalEdge): number {
    const xlpe = /xlpe|n2x|xhhw|nyy|\bxh/i.test(edge.conductorType ?? '');
    if (edge.conductorMaterial === 'aluminium') return xlpe ? 94 : 76;
    return xlpe ? 143 : 115;
}

function portOf(node: ElectricalNode | undefined, ports: ModuleElectricalPort[]) {
    return node?.type === 'module_panel_port'
        ? ports.find(
              (item) =>
                  item.moduleId === node.moduleId &&
                  item.sceneId === node.sceneId &&
                  item.panelId === node.deviceId,
          )
        : undefined;
}

function edgePhases(
    edge: ElectricalEdge,
    network: ElectricalNetworkData,
    nodeById: Map<string, ElectricalNode>,
    ports: ModuleElectricalPort[],
): 1 | 3 {
    const target = nodeById.get(edge.targetNodeId);
    const port =
        target?.type === 'module_panel_port'
            ? ports.find(
                  (item) =>
                      item.moduleId === target.moduleId &&
                      item.sceneId === target.sceneId &&
                      item.panelId === target.deviceId,
              )
            : undefined;
    return port?.phases ?? target?.phases ?? network.settings.phases;
}

export function calculateShortCircuits(
    network: ElectricalNetworkData,
    ports: ModuleElectricalPort[],
    calculations: EdgeCalculation[],
): ShortCircuitResult {
    const { settings } = network;
    const c = SHORT_CIRCUIT_VOLTAGE_FACTOR;
    const un = settings.nominalVoltageV;
    // Tensión de la falla 1Φ por defecto: fase-neutro en estrella trifásica;
    // fase-fase (= Un) en delta o en una red monofásica.
    const singlePhaseDefaultV =
        settings.phases === 3 && settings.connectionType === 'star'
            ? un / Math.sqrt(3)
            : un;
    const clearingTimeS =
        settings.faultClearingTimeS && settings.faultClearingTimeS > 0
            ? settings.faultClearingTimeS
            : DEFAULT_FAULT_CLEARING_TIME_S;
    const nodeById = new Map(network.nodes.map((node) => [node.id, node]));
    const children = new Map<string, ElectricalEdge[]>();
    for (const edge of network.edges) {
        children.set(edge.sourceNodeId, [
            ...(children.get(edge.sourceNodeId) ?? []),
            edge,
        ]);
    }
    const sizing = new Map(
        sizeSupplies(network, calculations).map((item) => [item.nodeId, item]),
    );
    const nodes = new Map<string, NodeShortCircuit>();
    const edges = new Map<string, EdgeThermalCheck>();
    const rootsWithoutSource: string[] = [];

    /** Tensión con la que se evalúa la falla en ese tablero (V). */
    const faultVoltage = (node: ElectricalNode | undefined, kind: '3F' | '1F') => {
        const own = portOf(node, ports)?.nominalVoltageV || node?.nominalVoltageV;
        if (kind === '3F') return (own && own > 0 ? own : un) / Math.sqrt(3);
        return own && own > 0 ? own : singlePhaseDefaultV;
    };
    const record = (
        node: ElectricalNode | undefined,
        nodeId: string,
        z: Impedance,
        kind: '3F' | '1F',
    ): number => {
        const impedanceOhm = magnitude(z);
        const ikKa =
            impedanceOhm > 0
                ? (c * faultVoltage(node, kind)) / impedanceOhm / 1000
                : Infinity;
        const breakingCapacityKa =
            node?.breakingCapacityKa && node.breakingCapacityKa > 0
                ? node.breakingCapacityKa
                : undefined;
        nodes.set(nodeId, {
            nodeId,
            ikKa,
            kind,
            impedanceOhm,
            breakingCapacityKa,
            breakingCapacityOk:
                breakingCapacityKa === undefined
                    ? undefined
                    : breakingCapacityKa >= ikKa,
        });
        return ikKa;
    };

    const visited = new Set<string>();
    const walk = (
        nodeId: string,
        z: Impedance,
        kind: '3F' | '1F',
        ikKa: number,
    ): void => {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        for (const edge of children.get(nodeId) ?? []) {
            const lengthM = edge.horizontalLengthM + edge.verticalLengthM;
            const material =
                edge.conductorMaterial === 'aluminium' ? 'aluminio' : 'cobre';
            const cable: Impedance =
                edge.sectionMm2 > 0 && lengthM > 0
                    ? {
                          r: (conductorResistivity(material, 20) * lengthM) / edge.sectionMm2,
                          x: FEEDER_REACTANCE_OHM_PER_M * lengthM,
                      }
                    : { r: 0, x: 0 };
            const phases = edgePhases(edge, network, nodeById, ports);
            // 1Φ: lazo fase + neutro. Aguas abajo de un tramo 1Φ todo es 1F.
            const childKind: '3F' | '1F' = phases === 1 || kind === '1F' ? '1F' : '3F';
            const childZ = add(z, cable, childKind === '1F' ? 2 : 1);
            const k = thermalConstantK(edge);
            const minSectionMm2 =
                Number.isFinite(ikKa) && ikKa > 0
                    ? (ikKa * 1000 * Math.sqrt(clearingTimeS)) / k
                    : 0;
            edges.set(edge.id, {
                edgeId: edge.id,
                ikAtOriginKa: ikKa,
                k,
                clearingTimeS,
                minSectionMm2,
                ok: edge.sectionMm2 >= minSectionMm2,
            });
            const childIk = record(
                nodeById.get(edge.targetNodeId),
                edge.targetNodeId,
                childZ,
                childKind,
            );
            walk(edge.targetNodeId, childZ, childKind, childIk);
        }
    };

    for (const rootId of networkRootIds(network)) {
        const root = nodeById.get(rootId);
        const supply = sizing.get(rootId);
        const kva = supply?.ratedKva ?? supply?.suggestedKva;
        if (!kva) {
            rootsWithoutSource.push(rootId);
            continue;
        }
        const skMva =
            root?.upstreamShortCircuitMva && root.upstreamShortCircuitMva > 0
                ? root.upstreamShortCircuitMva
                : DEFAULT_UPSTREAM_SHORT_CIRCUIT_MVA;
        const zq = (c * un * un) / (skMva * 1e6);
        const xq = 0.995 * zq;
        const uk =
            root?.transformerUkPercent && root.transformerUkPercent > 0
                ? root.transformerUkPercent
                : defaultTransformerUkPercent(kva);
        const zt = ((uk / 100) * un * un) / (kva * 1000);
        const source: Impedance = { r: 0.1 * xq, x: xq + zt };
        const kind: '3F' | '1F' = settings.phases === 3 ? '3F' : '1F';
        const ik = record(root, rootId, source, kind);
        walk(rootId, source, kind, ik);
    }
    return { nodes, edges, rootsWithoutSource };
}
