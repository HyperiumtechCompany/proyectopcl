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
                    } | null,
                ) => {
                    if (cancelled || !payload?.network) return;
                    const data = payload.network.data;
                    const ports = payload.ports ?? [];
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
