import type { Point2D, SiteCircuit, SiteElement } from './types';

/**
 * Cableado por CONEXIONES (objeto → objeto). Un recorrido dibujado de corrido
 * TG → P1 → P2 → P3 se guardaba como UN solo cable TG → P3 con P1 y P2 como
 * puntos de paso: no se podía borrar solo un tramo y, en el cálculo, P1 y P2
 * no quedaban conectados (el análisis de salidas solo mira origen y destino).
 * Aquí se corta en una conexión por objeto, conservando salida del TG, fase,
 * sección, conductor, tendido por tramo y desperdicio.
 */

export type CircuitDraft = Omit<SiteCircuit, 'id' | 'calculatedLengthM'> & {
    calculatedLengthM?: number;
};

/**
 * Corta el cable en cada punto intermedio que es el anclaje de un objeto
 * (`anchorIdAt` devuelve su id o null). `null` si no pasa por ningún objeto.
 */
export function splitCircuitAtAnchors(
    circuit: CircuitDraft,
    anchorIdAt: (point: Point2D) => string | null,
): CircuitDraft[] | null {
    const points = circuit.waypoints;
    const cuts: Array<{ index: number; id: string }> = [];
    let previousId = circuit.sourceId;
    for (let i = 1; i < points.length - 1; i++) {
        const id = anchorIdAt(points[i]);
        if (!id || id === previousId || id === circuit.targetId || id === circuit.sourceId) continue;
        cuts.push({ index: i, id });
        previousId = id;
    }
    if (cuts.length === 0) return null;
    const bounds = [{ index: 0, id: circuit.sourceId }, ...cuts, { index: points.length - 1, id: circuit.targetId }];
    const pieces: CircuitDraft[] = [];
    for (let k = 0; k < bounds.length - 1; k++) {
        const from = bounds[k];
        const to = bounds[k + 1];
        const { phase, modulePanelId, label, ...common } = circuit;
        // Cada conexión recalcula su largo (el del cable completo no aplica).
        delete common.calculatedLengthM;
        pieces.push({
            ...common,
            sourceId: from.id,
            targetId: to.id,
            waypoints: points.slice(from.index, to.index + 1),
            ...(circuit.segmentModes ? { segmentModes: circuit.segmentModes.slice(from.index, to.index) } : {}),
            // La fase es de la SALIDA (primer tramo); el tablero del módulo, del último.
            ...(k === 0 && phase ? { phase } : {}),
            ...(k === bounds.length - 2 && modulePanelId ? { modulePanelId } : {}),
            ...(label ? { label: `${label} (${k + 1}/${bounds.length - 1})` } : {}),
        });
    }
    return pieces;
}

/** Tableros: la búsqueda aguas abajo no los cruza (ahí empieza otra red). */
const STOP_TYPES = new Set<SiteElement['type']>([
    'tg_location',
    'sub_panel',
    'transformer',
    'building_block',
    'ats',
    'generator',
]);

/**
 * Conexiones que cuelgan de `circuitId` (ella incluida), recorriendo desde su
 * extremo lejano hacia afuera sin volver y sin cruzar tableros. Sirve para
 * "eliminar desde aquí": lo de antes del tramo queda intacto.
 */
export function downstreamCircuitIds(
    circuits: SiteCircuit[],
    elements: SiteElement[],
    circuitId: string,
): string[] {
    const start = circuits.find((circuit) => circuit.id === circuitId);
    if (!start) return [];
    const typeOf = new Map(elements.map((element) => [element.id, element.type]));
    const result = new Set<string>([start.id]);
    const visitedNodes = new Set<string>([start.sourceId]);
    const queue = [start.targetId];
    while (queue.length > 0) {
        const node = queue.shift()!;
        if (visitedNodes.has(node)) continue;
        visitedNodes.add(node);
        const type = typeOf.get(node);
        if (type && STOP_TYPES.has(type)) continue;
        for (const circuit of circuits) {
            if (result.has(circuit.id)) continue;
            if (circuit.sourceId !== node && circuit.targetId !== node) continue;
            result.add(circuit.id);
            queue.push(circuit.sourceId === node ? circuit.targetId : circuit.sourceId);
        }
    }
    return [...result];
}
