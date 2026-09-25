import type { EdgeCalculation } from './calculations';
import { simultaneityFactorOf } from './calculations';
import { networkRootIds } from './graph';
import type { ElectricalNetworkData } from './types';

/**
 * Dimensionamiento del suministro / transformador de cada raíz de la red (R2
 * de `plan_red_ct_dimensionamiento_multimodulo.md`).
 *
 *  - Potencia aparente de demanda: S = Σ Pᵢ / cos φᵢ de los alimentadores que
 *    salen de la raíz (suma aritmética de potencias aparentes: lado seguro,
 *    ignora la diferencia de ángulos entre cargas), por el factor de
 *    simultaneidad de la raíz si se definió.
 *  - Potencia requerida = S × (1 + reserva). Reserva por defecto 25 %
 *    (criterio de proyecto, editable; no es un valor normativo).
 *  - Potencia sugerida = la menor potencia normalizada ≥ requerida. Serie:
 *    potencias usuales de distribución (5 … 75 kVA) + serie R10 de
 *    IEC 60076-1 (100 … 2500 kVA).
 */
export const STANDARD_TRANSFORMER_KVA = [
    5, 10, 15, 25, 37.5, 50, 75, 100, 125, 160, 200, 250, 315, 400, 500, 630,
    800, 1000, 1250, 1600, 2000, 2500,
];

export const DEFAULT_SUPPLY_RESERVE_PERCENT = 25;

export interface SupplySizing {
    nodeId: string;
    label: string;
    demandPowerW: number;
    demandKva: number;
    reservePercent: number;
    requiredKva: number;
    /** Ausente si la demanda supera la mayor potencia de la serie. */
    suggestedKva?: number;
    /** Potencia que fijó el usuario (placa del transformador / potencia contratada). */
    ratedKva?: number;
    /** Carga = S demanda / S nominal (fijada o, si no, sugerida), en %. */
    loadingPercent?: number;
    /** Corriente nominal en el secundario con la potencia fijada o sugerida. */
    ratedCurrentA?: number;
    status: 'ok' | 'overloaded' | 'no_load' | 'out_of_range';
}

export function suggestTransformerKva(requiredKva: number): number | undefined {
    if (!(requiredKva > 0)) return undefined;
    return STANDARD_TRANSFORMER_KVA.find((kva) => kva >= requiredKva - 1e-9);
}

export function sizeSupplies(
    network: ElectricalNetworkData,
    calculations: EdgeCalculation[],
): SupplySizing[] {
    const byEdge = new Map(calculations.map((item) => [item.edgeId, item]));
    const nodeById = new Map(network.nodes.map((node) => [node.id, node]));
    const { nominalVoltageV, phases, defaultPowerFactor } = network.settings;
    return networkRootIds(network).map((rootId) => {
        const node = nodeById.get(rootId);
        const fs = simultaneityFactorOf(node);
        let demandPowerW = 0;
        let demandVa = 0;
        for (const edge of network.edges) {
            if (edge.sourceNodeId !== rootId) continue;
            const result = byEdge.get(edge.id);
            if (!result) continue;
            const pf = Math.min(
                1,
                Math.max(0.01, edge.powerFactor ?? defaultPowerFactor),
            );
            demandPowerW += result.demandPowerW;
            demandVa += result.demandPowerW / pf;
        }
        demandPowerW *= fs;
        const demandKva = (demandVa * fs) / 1000;
        const reserve = node?.supplyReservePercent;
        const reservePercent =
            typeof reserve === 'number' && reserve >= 0
                ? reserve
                : DEFAULT_SUPPLY_RESERVE_PERCENT;
        const requiredKva = demandKva * (1 + reservePercent / 100);
        const suggestedKva = suggestTransformerKva(requiredKva);
        const ratedKva =
            typeof node?.transformerKva === 'number' && node.transformerKva > 0
                ? node.transformerKva
                : undefined;
        const nominalKva = ratedKva ?? suggestedKva;
        const loadingPercent =
            nominalKva && demandKva > 0 ? (demandKva / nominalKva) * 100 : undefined;
        const ratedCurrentA = nominalKva
            ? (nominalKva * 1000) /
              (phases === 3 ? Math.sqrt(3) * nominalVoltageV : nominalVoltageV)
            : undefined;
        const status: SupplySizing['status'] =
            demandKva <= 0
                ? 'no_load'
                : ratedKva !== undefined && demandKva > ratedKva
                  ? 'overloaded'
                  : ratedKva === undefined && suggestedKva === undefined
                    ? 'out_of_range'
                    : 'ok';
        return {
            nodeId: rootId,
            label: node?.label ?? rootId,
            demandPowerW,
            demandKva,
            reservePercent,
            requiredKva,
            suggestedKva,
            ratedKva,
            loadingPercent,
            ratedCurrentA,
            status,
        };
    });
}
