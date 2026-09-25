import { compactCircuitTrace, type CircuitSegmentMode } from './circuitTrace';
import type { Point2D, SiteCircuit } from './types';

export interface CircuitContinuationPatch {
    targetId: string;
    waypoints: Point2D[];
    segmentModes: CircuitSegmentMode[];
    route: SiteCircuit['route'];
}

/** Circuitos que pueden continuar juntos desde el extremo final seleccionado. */
export function continuationCandidates(
    circuits: SiteCircuit[],
    selectedCircuitId: string,
): SiteCircuit[] {
    const selected = circuits.find(
        (circuit) => circuit.id === selectedCircuitId,
    );
    if (!selected) return [];

    return circuits.filter((circuit) => circuit.targetId === selected.targetId);
}

/**
 * Anexa un recorrido nuevo sin tocar lo ya ejecutado. El primer punto de la
 * continuación reemplaza la coordenada guardada del extremo anterior para que
 * siga la posición actual de la caja, y luego se conservan todos los puntos
 * nuevos hasta el siguiente artefacto.
 */
export function appendCircuitContinuation(
    circuit: SiteCircuit,
    continuationWaypoints: Point2D[],
    continuationModes: CircuitSegmentMode[],
    nextTargetId: string,
): CircuitContinuationPatch | null {
    const continuation = compactCircuitTrace(
        continuationWaypoints,
        continuationModes,
    );
    if (continuation.waypoints.length < 2) return null;

    const previousModes = circuit.segmentModes?.slice(
        0,
        Math.max(0, circuit.waypoints.length - 1),
    );
    const fallbackMode =
        circuit.route?.kind ?? continuation.modes[0] ?? 'aerial';
    const normalizedPreviousModes = previousModes?.length
        ? previousModes
        : Array.from(
              { length: Math.max(0, circuit.waypoints.length - 1) },
              () => fallbackMode,
          );
    const trace = compactCircuitTrace(
        [...circuit.waypoints.slice(0, -1), ...continuation.waypoints],
        [...normalizedPreviousModes, ...continuation.modes],
    );
    const routeKind: CircuitSegmentMode = trace.modes.includes('aerial')
        ? 'aerial'
        : 'underground';

    return {
        targetId: nextTargetId,
        waypoints: trace.waypoints,
        segmentModes: trace.modes,
        route: {
            ...(circuit.route ?? {}),
            kind: routeKind,
        },
    };
}
