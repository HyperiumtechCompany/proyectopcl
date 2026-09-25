import { useEffect, useState } from 'react';
import { show } from '@/actions/App/Http/Controllers/Dialux/V2/ElectricalNetworkController';
import type { ConductorCatalog } from '@/pages/dialux/electrical/engine/types';
import {
    calculateElectricalNetwork,
    type EdgeCalculation,
} from '../../electrical-network/domain/calculations';
import type {
    ElectricalNetworkData,
    ModuleElectricalPort,
} from '../../electrical-network/domain/types';
import { applySiteToNetwork } from '../domain/siteNetworkBridge';
import type { SiteData } from '../domain/types';
import type { SiteModuleScene } from '../engine/SiteBuilder3D';

export interface NetworkEdgeOption {
    id: string;
    label: string;
}

interface NetworkSnapshotForSite {
    edges: NetworkEdgeOption[];
    calculations: EdgeCalculation[];
    /** Módulos hijos (con sus escenas completas) — solo se usa para la vista 3D del emplazamiento (interiores read-only). */
    moduleScenes: SiteModuleScene[];
    /** Red guardada tal cual (sin la planta): el editor 2D la combina con la planta EN VIVO (`deriveSiteNetworkLive`). */
    network: ElectricalNetworkData | null;
    ports: ModuleElectricalPort[];
    conductors: ConductorCatalog[];
    loading: boolean;
}

/**
 * Lectura de solo consulta de la red eléctrica v2 (reusa el mismo endpoint
 * `ElectricalNetworkController::show`, en modo JSON) para que el editor de
 * emplazamiento pueda (a) ofrecer un selector de alimentadores al vincular
 * un trazado nuevo con `draw_feeder`, y (b) colorear los trazados existentes
 * según su estado real de caída de tensión — reusando el mismo motor de
 * cálculo (`calculateElectricalNetwork`) en vez de reimplementarlo.
 */
export function useNetworkSnapshotForSite(
    projectId: number,
): NetworkSnapshotForSite {
    const [state, setState] = useState<NetworkSnapshotForSite>({
        edges: [],
        calculations: [],
        moduleScenes: [],
        network: null,
        ports: [],
        conductors: [],
        loading: true,
    });

    useEffect(() => {
        let cancelled = false;
        // El estado inicial ya arranca en `loading: true`; no hace falta
        // re-forzarlo de forma síncrona aquí (evita un setState directo en
        // el cuerpo del efecto).
        fetch(show.url(projectId), {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
        })
            .then((response) => (response.ok ? response.json() : null))
            .then(
                (
                    payload: {
                        network?: { data: ElectricalNetworkData };
                        ports?: ModuleElectricalPort[];
                        conductors?: ConductorCatalog[];
                        moduleScenes?: SiteModuleScene[];
                        siteData?: SiteData | null;
                    } | null,
                ) => {
                    if (cancelled || !payload?.network) return;
                    // Misma incorporación de la planta que hace la página Red y CT.
                    const ports = payload.ports ?? [];
                    const data = applySiteToNetwork(
                        payload.network.data,
                        payload.siteData,
                        { ports },
                    ).data;
                    const conductors = payload.conductors ?? [];
                    const nodesById = new Map(
                        data.nodes.map((node) => [node.id, node]),
                    );
                    const edges = data.edges.map((edge) => ({
                        id: edge.id,
                        label:
                            edge.label ??
                            `${nodesById.get(edge.sourceNodeId)?.label ?? 'Origen'} → ${nodesById.get(edge.targetNodeId)?.label ?? 'Destino'}`,
                    }));
                    setState({
                        edges,
                        calculations: calculateElectricalNetwork(
                            data,
                            ports,
                            conductors,
                        ),
                        moduleScenes: payload.moduleScenes ?? [],
                        network: payload.network.data,
                        ports,
                        conductors,
                        loading: false,
                    });
                },
            )
            .catch(() => {
                if (!cancelled) {
                    setState((current) => ({ ...current, loading: false }));
                }
            });
        return () => {
            cancelled = true;
        };
    }, [projectId]);

    return state;
}
