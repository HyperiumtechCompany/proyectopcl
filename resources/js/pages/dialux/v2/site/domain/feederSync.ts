import type { EdgeCalculation } from '../../electrical-network/domain/calculations';
import type { ElectricalEdge } from '../../electrical-network/domain/types';
import { polylineLength } from './geometry';
import type { FeederPath } from './types';

/**
 * Sincroniza la longitud de los alimentadores de la red con el trazado real
 * dibujado en el emplazamiento. En cuanto un `FeederPath` referencia un
 * `ElectricalEdge` (por `networkEdgeId`), el plano pasa a mandar sobre ese
 * tramo: se fuerza `lengthMode: 'site'` y `horizontalLengthM` toma la
 * longitud de la polilínea — sin importar el modo que tuviera antes. Si el
 * usuario borra el trazado, el alimentador se queda "congelado" en su último
 * valor `site` hasta que se le asigne otro modo manualmente (no hay forma
 * automática de saber a qué otro modo volver).
 *
 * Los edges sin trazado asociado no se tocan.
 */
export function syncFeederLengths(
    edges: ElectricalEdge[],
    feederPaths: FeederPath[],
): ElectricalEdge[] {
    if (feederPaths.length === 0) return edges;
    const pathByEdge = new Map(
        feederPaths.map((path) => [path.networkEdgeId, path]),
    );
    return edges.map((edge) => {
        const path = pathByEdge.get(edge.id);
        if (!path) return edge;
        const lengthM = path.calculatedLengthM || polylineLength(path.waypoints);
        if (
            edge.lengthMode === 'site' &&
            Math.abs(edge.horizontalLengthM - lengthM) < 1e-6
        ) {
            return edge;
        }
        return { ...edge, lengthMode: 'site', horizontalLengthM: lengthM };
    });
}

export type FeederStatus = EdgeCalculation['status'];

/** Estado real (del motor de cálculo de la red) del alimentador que un trazado representa. */
export function deriveFeederStatus(
    networkEdgeId: string,
    calculations: EdgeCalculation[],
): FeederStatus {
    return (
        calculations.find((item) => item.edgeId === networkEdgeId)?.status ??
        'incomplete'
    );
}

const FEEDER_STATUS_COLOR: Record<FeederStatus, string> = {
    complete: '#16a34a',
    warning: '#d97706',
    non_compliant: '#dc2626',
    incomplete: '#94a3b8',
};

/** Color verde/ámbar/rojo/gris para pintar el trazado según su estado real de caída de tensión. */
export function feederStatusColor(status: FeederStatus): string {
    return FEEDER_STATUS_COLOR[status];
}

/** Esqueleto de `FeederPath` para un edge recién vinculado — dos puntos que el usuario ajusta dibujando. */
export function buildFeederPathFromNetwork(
    edge: Pick<ElectricalEdge, 'id' | 'label'>,
    sourcePoint: { x: number; y: number },
    targetPoint: { x: number; y: number },
): Omit<FeederPath, 'id'> {
    const waypoints = [sourcePoint, targetPoint];
    return {
        networkEdgeId: edge.id,
        waypoints,
        calculatedLengthM: polylineLength(waypoints),
        label: edge.label,
    };
}
