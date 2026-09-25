import type { EdgeCalculation } from '../../electrical-network/domain/calculations';
import type { ElectricalEdge } from '../../electrical-network/domain/types';
import { feederPathLengthM } from './aerialCableGeometry';
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
    scaleM = 1,
): ElectricalEdge[] {
    if (feederPaths.length === 0) return edges;
    const pathByEdge = new Map(
        feederPaths.map((path) => [path.networkEdgeId, path]),
    );
    return edges.map((edge) => {
        const path = pathByEdge.get(edge.id);
        if (!path) return edge;
        // Con ruta aérea/subterránea suma catenaria y tramos verticales; con escala ≠ 1 convierte a metros.
        const lengthM = feederPathLengthM(path, scaleM);
        // El material y el tipo de cable elegidos en el trazado mandan sobre el alimentador de la red.
        const material = path.route?.conductorMaterial ?? edge.conductorMaterial;
        const cableType = path.route?.cableType ?? edge.conductorType;
        if (
            edge.lengthMode === 'site' &&
            Math.abs(edge.horizontalLengthM - lengthM) < 1e-6 &&
            edge.conductorMaterial === material &&
            edge.conductorType === cableType
        ) {
            return edge;
        }
        return {
            ...edge,
            lengthMode: 'site',
            horizontalLengthM: lengthM,
            conductorMaterial: material,
            conductorType: cableType,
        };
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
