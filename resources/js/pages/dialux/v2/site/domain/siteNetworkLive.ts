import type { ConductorCatalog } from '@/pages/dialux/electrical/engine/types';
import {
    calculateElectricalNetwork,
    type EdgeCalculation,
} from '../../electrical-network/domain/calculations';
import type {
    ElectricalNetworkData,
    ModuleElectricalPort,
} from '../../electrical-network/domain/types';
import {
    applySiteToNetwork,
    type SiteBridgeConflict,
} from './siteNetworkBridge';
import {
    analyzeSiteOutputs,
    siteOutputLoadsByNode,
    type SiteOutputRow,
} from './siteOutputs';
import type { SiteData } from './types';

/**
 * Cálculo de la red CON la planta: las salidas de cada tablero de la planta
 * (postes, tomacorrientes…) suman carga a su tablero, y sus filas CT parten de
 * la caída real que la red calculó hasta ese tablero. `data` ya debe traer la
 * planta incorporada (`applySiteToNetwork`).
 */
export function calculateNetworkWithSite(
    data: ElectricalNetworkData,
    site: SiteData | null | undefined,
    ports: ModuleElectricalPort[],
    conductors: ConductorCatalog[],
): { calculations: EdgeCalculation[]; outputRows: SiteOutputRow[] } {
    const loads = analyzeSiteOutputs(site, data.settings);
    const calculations = calculateElectricalNetwork(
        data,
        ports,
        conductors,
        siteOutputLoadsByNode(data, loads),
    );
    if (loads.rows.length === 0) return { calculations, outputRows: [] };
    const calculationByEdge = new Map(
        calculations.map((item) => [item.edgeId, item]),
    );
    const upstreamPercent = (panelElementId: string) => {
        const node = data.nodes.find(
            (item) =>
                item.siteElementId === panelElementId &&
                item.type !== 'service' &&
                item.type !== 'meter',
        );
        const incoming = node
            ? data.edges.find((edge) => edge.targetNodeId === node.id)
            : undefined;
        return incoming
            ? (calculationByEdge.get(incoming.id)?.accumulatedVoltageDropPercent ?? 0)
            : 0;
    };
    return {
        calculations,
        outputRows: analyzeSiteOutputs(site, data.settings, upstreamPercent).rows,
    };
}

/** Lo que un cable de la planta alimenta en la red (para rotularlo en 2D). */
export interface SiteCircuitFeed {
    edgeId: string;
    fromLabel: string;
    toLabel: string;
    moduleName?: string;
    /** Sección y conductor del alimentador en la red (mandan si el cable no los define). */
    sectionMm2: number;
    conductorType: string;
    calculation?: EdgeCalculation;
}

export interface SiteNetworkLive {
    calculations: EdgeCalculation[];
    /** Salidas de los tableros de la planta (postes, tomacorrientes…). */
    outputRows: SiteOutputRow[];
    /** Por `SiteCircuit.id`: solo cables que son alimentadores en la red. */
    feeds: Record<string, SiteCircuitFeed>;
    conflicts: SiteBridgeConflict[];
}

/**
 * La red tal como quedaría con la planta ACTUAL (lo recién dibujado incluido,
 * sin esperar a guardar ni recargar Red y CT): mismo puente y mismo motor de
 * cálculo que la página Red y CT, para que el 2D muestre los mismos números.
 */
export function deriveSiteNetworkLive(
    network: ElectricalNetworkData | null,
    site: SiteData | null | undefined,
    ports: ModuleElectricalPort[],
    conductors: ConductorCatalog[],
): SiteNetworkLive {
    if (!network) {
        return { calculations: [], outputRows: [], feeds: {}, conflicts: [] };
    }
    const bridged = applySiteToNetwork(network, site, { ports });
    const { calculations, outputRows } = calculateNetworkWithSite(
        bridged.data,
        site,
        ports,
        conductors,
    );
    const nodesById = new Map(bridged.data.nodes.map((node) => [node.id, node]));
    const calculationByEdge = new Map(
        calculations.map((item) => [item.edgeId, item]),
    );
    const feeds: Record<string, SiteCircuitFeed> = {};
    for (const edge of bridged.data.edges) {
        if (!edge.siteCircuitId) continue;
        const target = nodesById.get(edge.targetNodeId);
        feeds[edge.siteCircuitId] = {
            edgeId: edge.id,
            fromLabel: nodesById.get(edge.sourceNodeId)?.label ?? '?',
            toLabel: target?.label ?? '?',
            moduleName: target?.moduleName,
            sectionMm2: edge.sectionMm2,
            conductorType: edge.conductorType,
            calculation: calculationByEdge.get(edge.id),
        };
    }
    return { calculations, outputRows, feeds, conflicts: bridged.conflicts };
}
