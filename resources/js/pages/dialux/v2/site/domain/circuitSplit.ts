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
    /**
     * Extremo del lado del tablero (de `circuitRuns`). Sin él se asume el
     * origen dibujado — mal si el tramo se dibujó al revés (del poste al TG).
     */
    upstreamNodeId?: string,
    /**
     * ¿La conexión es de la MISMA salida que el tramo borrado? (de
     * `circuitRuns`). Una caja de pase la comparten varias salidas del TG:
     * sin esto, borrar una salida se llevaba todas las que pasan por la caja.
     */
    sameOutput?: (circuitId: string) => boolean,
): string[] {
    const start = circuits.find((circuit) => circuit.id === circuitId);
    if (!start) return [];
    const follows = (circuit: SiteCircuit) =>
        (sameOutput ? sameOutput(circuit.id) : true) &&
        !(start.tgOutputId && circuit.tgOutputId && circuit.tgOutputId !== start.tgOutputId);
    const typeOf = new Map(elements.map((element) => [element.id, element.type]));
    const result = new Set<string>([start.id]);
    const upstream = upstreamNodeId === start.targetId ? start.targetId : start.sourceId;
    const visitedNodes = new Set<string>([upstream]);
    const queue = [upstream === start.sourceId ? start.targetId : start.sourceId];
    while (queue.length > 0) {
        const node = queue.shift()!;
        if (visitedNodes.has(node)) continue;
        visitedNodes.add(node);
        const type = typeOf.get(node);
        if (type && STOP_TYPES.has(type)) continue;
        for (const circuit of circuits) {
            if (result.has(circuit.id)) continue;
            if (circuit.sourceId !== node && circuit.targetId !== node) continue;
            if (!follows(circuit)) continue;
            result.add(circuit.id);
            queue.push(circuit.sourceId === node ? circuit.targetId : circuit.sourceId);
        }
    }
    return [...result];
}

/**
 * Cable RE-TRAZADO (se borró un tramo y se volvió a dibujar desde un punto,
 * p. ej. por otra zanja/caja): conserva todo lo del cable — sección,
 * conductor, salida del TG, fase, tendido — y cambia su recorrido. Si llega a
 * otro objeto, el tablero del módulo y el recorrido interior del anterior ya
 * no aplican.
 */
export function reroutedCircuitDraft(
    circuit: SiteCircuit,
    waypoints: Point2D[],
    modes: Array<'aerial' | 'underground'>,
    targetId: string,
): CircuitDraft {
    const { modulePanelId, interiorLengthM, ...rest } = circuit;
    const draft: Partial<SiteCircuit> = { ...rest };
    delete draft.id;
    delete draft.calculatedLengthM;
    const sameTarget = targetId === circuit.targetId;
    return {
        ...(draft as CircuitDraft),
        targetId,
        waypoints,
        segmentModes: modes.length === waypoints.length - 1 ? modes : undefined,
        ...(sameTarget && modulePanelId ? { modulePanelId } : {}),
        ...(sameTarget && interiorLengthM !== undefined ? { interiorLengthM } : {}),
    };
}

/**
 * Cables que quedan al BORRAR objetos (como en CAD, deshacible):
 *  - objeto de paso con exactamente dos cables (caja, buzón, poste
 *    intermedio…): los dos tramos se UNEN en uno — el cable sigue conectado,
 *    solo deja de pasar por ese objeto;
 *  - cualquier otro cable que toque un objeto borrado se elimina (no queda
 *    un cable colgando a la nada que sume al metrado).
 */
export function circuitsAfterRemovingElements(
    circuits: SiteCircuit[],
    removedIds: Set<string>,
    /**
     * Salida a la que pertenece cada cable (clave de `circuitRuns`). Una caja
     * COMPARTIDA por varias salidas se quita uniendo los dos tramos de CADA
     * salida por separado — nunca se borran las salidas que pasan por ella.
     */
    outputOf: (circuit: SiteCircuit) => string | undefined = (circuit) => circuit.tgOutputId,
): SiteCircuit[] {
    let result = circuits;
    for (const node of removedIds) {
        const touching = result.filter(
            (circuit) => circuit.sourceId === node || circuit.targetId === node,
        );
        const groups = new Map<string, SiteCircuit[]>();
        if (touching.length === 2) {
            groups.set('', touching);
        } else {
            for (const circuit of touching) {
                const key = outputOf(circuit) ?? `sin-salida:${circuit.id}`;
                groups.set(key, [...(groups.get(key) ?? []), circuit]);
            }
        }
        for (const pair of groups.values()) {
            if (pair.length === 2) result = mergeAtNode(result, pair[0], pair[1], node);
        }
    }
    return result.filter(
        (circuit) => !removedIds.has(circuit.sourceId) && !removedIds.has(circuit.targetId),
    );
}

/** Une dos tramos que se encuentran en `node` (objeto que se quita) en un solo cable. */
function mergeAtNode(
    result: SiteCircuit[],
    first: SiteCircuit,
    second: SiteCircuit,
    node: string,
): SiteCircuit[] {
    {
        const otherOf = (circuit: SiteCircuit) =>
            circuit.sourceId === node ? circuit.targetId : circuit.sourceId;
        if (
            first.sourceId === first.targetId ||
            second.sourceId === second.targetId ||
            // (varias cajas seguidas borradas se unen una tras otra)
            otherOf(first) === otherOf(second)
        ) {
            return result;
        }
        // `first` orientado HACIA el nodo, `second` DESDE el nodo.
        const into =
            first.targetId === node
                ? first
                : {
                      ...first,
                      sourceId: first.targetId,
                      targetId: first.sourceId,
                      waypoints: [...first.waypoints].reverse(),
                      segmentModes: first.segmentModes ? [...first.segmentModes].reverse() : undefined,
                  };
        const out =
            second.sourceId === node
                ? second
                : {
                      ...second,
                      sourceId: second.targetId,
                      targetId: second.sourceId,
                      waypoints: [...second.waypoints].reverse(),
                      segmentModes: second.segmentModes ? [...second.segmentModes].reverse() : undefined,
                  };
        const modesOf = (circuit: SiteCircuit): Array<'aerial' | 'underground'> =>
            circuit.segmentModes ??
            circuit.waypoints.slice(1).map(() => (circuit.route?.kind === 'aerial' ? 'aerial' : 'underground'));
        const anyModes = Boolean(into.segmentModes || out.segmentModes || into.route || out.route);
        // Manda el tramo con salida de TG (o el primero): conserva su id, sección y salida.
        const keep = second.tgOutputId && !first.tgOutputId ? second : first;
        const merged: SiteCircuit = {
            ...keep,
            sourceId: into.sourceId,
            targetId: out.targetId,
            waypoints: [...into.waypoints, ...out.waypoints.slice(1)],
            segmentModes: anyModes ? [...modesOf(into), ...modesOf(out)] : undefined,
            calculatedLengthM: 0,
            ...(out.modulePanelId ? { modulePanelId: out.modulePanelId } : {}),
            ...(out.interiorLengthM !== undefined ? { interiorLengthM: out.interiorLengthM } : {}),
        };
        const dropId = keep.id === first.id ? second.id : first.id;
        return result
            .filter((circuit) => circuit.id !== dropId)
            .map((circuit) => (circuit.id === keep.id ? merged : circuit));
    }
}
