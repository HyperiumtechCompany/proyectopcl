import { circuitsAfterRemovingElements } from './circuitSplit';
import { normalizeTgOutputs } from './tgPanel';
import type { SiteCircuit, SiteData, SiteElement } from './types';

/**
 * Recorrido completo de cada SALIDA de tablero en la planta.
 *
 * Un cable dibujado por cajas de pase, postes o buzones queda guardado como
 * varias conexiones (TG → caja → caja → poste…); solo la primera toca el TG.
 * Aquí se recorre cada salida desde su tablero — con el MISMO criterio que el
 * cálculo CT (`siteOutputs.ts`): sin cruzar a otro tablero, edificio,
 * transformador, ATS ni grupo — para que TODAS sus conexiones sepan de qué
 * salida son (número, color) y se puedan seleccionar, colorear y rotular como
 * un solo cable.
 */

export interface CircuitRun {
    /** Clave estable de la salida: `${panelId}::${outputId | cable raíz}`. */
    key: string;
    panelId: string;
    panelLabel: string;
    /** Salida del TG (solo si el tablero es un TG y el cable raíz la declara). */
    outputId?: string;
    /** "1", "2"… (TG) o "Salida n" (sub tablero). */
    outputLabel: string;
    /** Color de la salida del TG; undefined en sub tableros (manda el del cable). */
    outputColor?: string;
    /** Todas las conexiones de la salida, en orden de recorrido. */
    circuitIds: string[];
    /** Extremo del lado del tablero de cada conexión (aguas arriba), por id de cable. */
    upstreamNodeOf: Record<string, string>;
}

const PANEL_TYPES = new Set<SiteElement['type']>(['tg_location', 'sub_panel']);
const STOP_TYPES = new Set<SiteElement['type']>([
    'tg_location',
    'sub_panel',
    'building_block',
    'transformer',
    'ats',
    'generator',
]);

/**
 * ¿El recorrido de una salida sigue del cable `current` al cable `next` (que
 * comparten un objeto de paso)? Una caja de pase/buzón puede ser COMPARTIDA
 * por varios cables en la misma zanja sin estar conectados entre sí:
 *  - un cable de OTRO TG (sale de él con su propia salida) nunca es de esta;
 *  - si ambos declaran salida del TG y son distintas, son circuitos distintos.
 */
const NOT_AN_OUTPUT = new Set<SiteElement['type']>([
    'ats',
    'transformer',
    'generator',
    'earth_pit',
    'mt_cell_arrival',
    'mt_cell_protection',
    'mt_cell_transformation',
]);

export function continuesRun(
    current: SiteCircuit,
    next: SiteCircuit,
    panelId: string,
    typeOf: (elementId: string) => SiteElement['type'] | undefined,
): boolean {
    if (
        next.tgOutputId &&
        [next.sourceId, next.targetId].some(
            (id) => id !== panelId && typeOf(id) === 'tg_location',
        )
    ) {
        return false;
    }
    return !(current.tgOutputId && next.tgOutputId && current.tgOutputId !== next.tgOutputId);
}

/**
 * Nombre visible de un tablero de la planta. Varios TG de nombre genérico
 * ("TG") → TG-1, TG-2… en el orden de la planta (la misma numeración que Red
 * y CT), para que el plano, el panel y el PDF no muestren dos "TG" iguales.
 */
export function sitePanelLabeler(elements: SiteElement[]): (panel: SiteElement) => string {
    const tgs = elements.filter((element) => element.type === 'tg_location');
    return (panel: SiteElement) => {
        const label = panel.label?.trim() || (panel.type === 'tg_location' ? 'TG' : 'TD');
        return panel.type === 'tg_location' && tgs.length > 1 && /^TG$/i.test(label)
            ? `TG-${tgs.findIndex((item) => item.id === panel.id) + 1}`
            : label;
    };
}

export function circuitRuns(site: SiteData | null | undefined): Map<string, CircuitRun> {
    const byCircuit = new Map<string, CircuitRun>();
    if (!site) return byCircuit;
    const elements = site.elements ?? [];
    const byId = new Map(elements.map((element) => [element.id, element]));
    const incident = new Map<string, SiteCircuit[]>();
    for (const circuit of site.circuits ?? []) {
        for (const end of new Set([circuit.sourceId, circuit.targetId])) {
            incident.set(end, [...(incident.get(end) ?? []), circuit]);
        }
    }
    // Los TG primero: una conexión compartida entre un TG y un sub tablero es del TG.
    const panels = elements
        .filter((element) => PANEL_TYPES.has(element.type))
        .sort((a, b) => Number(b.type === 'tg_location') - Number(a.type === 'tg_location'));

    const panelLabelOf = sitePanelLabeler(elements);
    for (const panel of panels) {
        const outputs =
            panel.type === 'tg_location'
                ? normalizeTgOutputs(panel.config?.kind === 'tg' ? panel.config.outputs : undefined)
                : [];
        const runs = new Map<string, CircuitRun>();
        let rootIndex = 0;
        for (const root of incident.get(panel.id) ?? []) {
            if (byCircuit.has(root.id)) continue;
            // El cable que LLEGA al tablero (ATS, transformador, grupo, celda)
            // y el de puesta a tierra no son salidas.
            const rootOther = byId.get(root.sourceId === panel.id ? root.targetId : root.sourceId);
            if (rootOther && NOT_AN_OUTPUT.has(rootOther.type)) continue;
            const output = outputs.find((item) => item.id === root.tgOutputId);
            const key = `${panel.id}::${output ? output.id : root.id}`;
            let run = runs.get(key);
            if (!run) {
                rootIndex += 1;
                run = {
                    key,
                    panelId: panel.id,
                    panelLabel: panelLabelOf(panel),
                    ...(output ? { outputId: output.id, outputColor: output.color } : {}),
                    outputLabel: output?.label ?? `Salida ${rootIndex}`,
                    circuitIds: [],
                    upstreamNodeOf: {},
                };
                runs.set(key, run);
            }
            const queue: Array<{ from: string; circuit: SiteCircuit }> = [{ from: panel.id, circuit: root }];
            const visitedNodes = new Set<string>([panel.id]);
            while (queue.length > 0) {
                const { from, circuit } = queue.shift()!;
                if (byCircuit.has(circuit.id)) continue;
                byCircuit.set(circuit.id, run);
                run.circuitIds.push(circuit.id);
                run.upstreamNodeOf[circuit.id] = from;
                const toId = circuit.sourceId === from ? circuit.targetId : circuit.sourceId;
                const to = byId.get(toId);
                if (!to || STOP_TYPES.has(to.type) || visitedNodes.has(toId)) continue;
                visitedNodes.add(toId);
                for (const next of incident.get(toId) ?? []) {
                    if (
                        !byCircuit.has(next.id) &&
                        // La salida es la de la RAÍZ (un tramo dibujado a mano puede no declararla).
                        continuesRun(
                            { ...circuit, tgOutputId: circuit.tgOutputId ?? root.tgOutputId },
                            next,
                            panel.id,
                            (id) => byId.get(id)?.type,
                        )
                    ) {
                        queue.push({ from: toId, circuit: next });
                    }
                }
            }
        }
    }
    return byCircuit;
}

/** Color con el que se dibuja una conexión: el de su salida del TG, si no el propio del cable. */
export function circuitColor(
    circuit: SiteCircuit,
    run: CircuitRun | undefined,
    fallback = '#0891b2',
): string {
    return run?.outputColor ?? circuit.style?.color ?? fallback;
}

/** Rótulo corto de la salida para el plano: "TG·2", "TD-01·S1". */
export function circuitRunTag(run: CircuitRun | undefined): string | null {
    if (!run) return null;
    const output = run.outputId ? run.outputLabel : run.outputLabel.replace(/^Salida\s*/i, 'S');
    return `${run.panelLabel}·${output}`;
}

/**
 * Cables que quedan tras borrar objetos de la planta: en una caja compartida
 * se unen los tramos de CADA salida por separado (ver
 * `circuitsAfterRemovingElements`); la salida se toma del recorrido real.
 */
export function siteCircuitsAfterRemoving(site: SiteData, removedIds: Set<string>): SiteCircuit[] {
    const runs = circuitRuns(site);
    return circuitsAfterRemovingElements(
        site.circuits ?? [],
        removedIds,
        (circuit) => runs.get(circuit.id)?.key ?? circuit.tgOutputId,
    );
}
