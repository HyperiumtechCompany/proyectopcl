import { feederVoltageDrop } from '../../electrical-network/domain/feederVoltageDrop';
import {
    MIN_FEEDER_SECTION_MM2,
    STANDARD_SECTIONS_MM2,
} from '../../electrical-network/domain/sectionOptimizer';
import type { ModuleElectricalPort } from '../../electrical-network/domain/types';
import { pointInPolygon } from './geometry';
import { elementBox } from './layoutFit';
import type { SiteCircuitFeed } from './siteNetworkLive';
import type { Point2D, SiteData, SiteElement } from './types';
import { buildingEntryPoint, PASS_THROUGH_TYPES } from './wireAnchors';

/**
 * Conexión guiada tablero de la planta → edificio de un módulo (fase C1 de
 * `plan_conexion_edificio_modulo_caida_tension.md`): propone el recorrido
 * del cable desde el tablero hasta la ACOMETIDA del edificio (su fachada más
 * cercana), recto o en L, eligiendo el que no atraviesa otros edificios. El
 * usuario puede editar los puntos después, como cualquier cable dibujado.
 */

/** Cuántos edificios (distintos de `ignoreIds`) atraviesa un recorrido; muestreo cada ~`stepM` metros. */
export function buildingsCrossed(
    path: Point2D[],
    elements: SiteElement[],
    ignoreIds: Set<string>,
    scaleM: number,
    stepM = 0.5,
): number {
    const blocks = elements.filter(
        (element) =>
            element.type === 'building_block' &&
            element.visible !== false &&
            element.vertices.length >= 3 &&
            !ignoreIds.has(element.id),
    );
    const hit = new Set<string>();
    for (let i = 1; i < path.length; i++) {
        const a = path[i - 1];
        const b = path[i];
        const lengthM = Math.hypot(b.x - a.x, b.y - a.y) * scaleM;
        const steps = Math.max(1, Math.ceil(lengthM / stepM));
        // Se excluyen los extremos del tramo (tocan el tablero y la fachada).
        for (let k = 1; k < steps; k++) {
            const t = k / steps;
            const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
            for (const block of blocks) {
                if (!hit.has(block.id) && pointInPolygon(p, block.vertices)) hit.add(block.id);
            }
        }
    }
    return hit.size;
}

const pathLength = (path: Point2D[]) =>
    path.reduce((sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(p.x - path[i - 1].x, p.y - path[i - 1].y)), 0);

/**
 * Recorrido propuesto (planta) desde `from` (anclaje del tablero) hasta la
 * acometida del edificio: recto si no cruza edificios; si no, la L (codo
 * horizontal-vertical o vertical-horizontal) que cruce menos y, a igualdad,
 * la más corta. Siempre termina en la fachada del edificio.
 */
export function proposeBlockCableRoute(
    from: Point2D,
    block: SiteElement,
    elements: SiteElement[],
    scaleM: number,
    ignoreIds: string[] = [],
): { waypoints: Point2D[]; crossings: number } {
    const ignore = new Set([block.id, ...ignoreIds]);
    const entry = buildingEntryPoint(block, from);
    const direct = [from, entry];
    const candidates: Point2D[][] = [
        direct,
        [from, { x: entry.x, y: from.y }, buildingEntryPoint(block, { x: entry.x, y: from.y })],
        [from, { x: from.x, y: entry.y }, buildingEntryPoint(block, { x: from.x, y: entry.y })],
    ];
    let best = { waypoints: direct, crossings: buildingsCrossed(direct, elements, ignore, scaleM) };
    for (const candidate of candidates.slice(1)) {
        const crossings = buildingsCrossed(candidate, elements, ignore, scaleM);
        if (
            crossings < best.crossings ||
            (crossings === best.crossings && crossings > 0 && pathLength(candidate) < pathLength(best.waypoints))
        ) {
            best = { waypoints: candidate, crossings };
        }
    }
    return best;
}

export interface FeederSectionSuggestion {
    sectionMm2: number;
    /** ΔU propia del alimentador con esa sección, %. */
    ownPercent: number;
    /** ΔU de punta a punta: aguas arriba + alimentador + circuito más desfavorable del módulo, %. */
    totalPercent: number;
}

/**
 * Sección mínima normalizada del alimentador tablero → edificio que cumple
 * a la vez (C3 del plan): ΔU propia ≤ límite de alimentador y ΔU de punta a
 * punta (aguas arriba + alimentador + circuito más desfavorable del módulo)
 * ≤ límite total. Misma fórmula que la red (IEC 60364-5-52 Anexo G,
 * `feederVoltageDrop`), con la corriente ya calculada (no depende de la
 * sección). `minSectionMm2` = la del corrector de la red (ampacidad).
 * null si ni la mayor sección cumple.
 */
export function suggestFeederSection(input: {
    currentA: number;
    lengthM: number;
    voltageV: number;
    phases: 1 | 3;
    powerFactor: number;
    material: 'cobre' | 'aluminio';
    temperatureC: number;
    /** ΔU acumulada hasta el tablero de origen (sin este alimentador), %. */
    upstreamPercent: number;
    /** ΔU del circuito más desfavorable dentro del módulo, %. */
    downstreamPercent: number;
    feederLimitPercent: number;
    totalLimitPercent: number;
    minSectionMm2?: number;
}): FeederSectionSuggestion | null {
    const floor = Math.max(MIN_FEEDER_SECTION_MM2, input.minSectionMm2 ?? 0);
    for (const sectionMm2 of STANDARD_SECTIONS_MM2) {
        if (sectionMm2 < floor - 1e-9) continue;
        const { dropPercent } = feederVoltageDrop({
            currentA: input.currentA,
            lengthM: input.lengthM,
            sectionMm2,
            voltageV: input.voltageV,
            phases: input.phases,
            material: input.material,
            powerFactor: input.powerFactor,
            temperatureC: input.temperatureC,
        });
        const totalPercent = input.upstreamPercent + dropPercent + input.downstreamPercent;
        if (dropPercent <= input.feederLimitPercent + 1e-9 && totalPercent <= input.totalLimitPercent + 1e-9) {
            return { sectionMm2, ownPercent: dropPercent, totalPercent };
        }
    }
    return null;
}

/**
 * Circuito más desfavorable de un módulo: la mayor ΔU acumulada DENTRO del
 * módulo (desde su tablero raíz) entre los circuitos que publica. Sumada a la
 * ΔU acumulada hasta el tablero raíz da la ΔU de punta a punta del edificio.
 */
export function moduleWorstCircuit(
    ports: ModuleElectricalPort[],
    moduleId: number | undefined,
): { code: string; panelLabel: string; percent: number } | null {
    if (moduleId === undefined) return null;
    let worst: { code: string; panelLabel: string; percent: number } | null = null;
    for (const port of ports) {
        if (port.moduleId !== moduleId) continue;
        for (const circuit of port.circuits ?? []) {
            if (!worst || circuit.cumulativeVoltageDropPct > worst.percent) {
                worst = { code: circuit.code, panelLabel: port.panelLabel, percent: circuit.cumulativeVoltageDropPct };
            }
        }
    }
    return worst;
}

export interface BuildingFeedRow {
    blockId: string;
    blockLabel: string;
    moduleName: string;
    panelLabel: string;
    fromLabel: string;
    lengthM: number;
    interiorLengthM: number;
    sectionMm2: number;
    conductorType: string;
    feederPercent: number;
    worstCircuit: { code: string; panelLabel: string; percent: number } | null;
    /** Alimentador + circuito más desfavorable, % (null sin datos del módulo). */
    totalPercent: number | null;
    withinLimits: boolean;
}

/**
 * Una fila por cable que alimenta un edificio de módulo desde la planta
 * (lo que muestran el panel del edificio, el PDF y el unifilar).
 */
export function buildingFeedRows(
    site: SiteData | null | undefined,
    feeds: Record<string, SiteCircuitFeed>,
    ports: ModuleElectricalPort[],
    limits: { feederPercent: number; totalPercent: number },
): BuildingFeedRow[] {
    const elements = site?.elements ?? [];
    const byId = new Map(elements.map((element) => [element.id, element]));
    const rows: BuildingFeedRow[] = [];
    for (const circuit of site?.circuits ?? []) {
        const feed = feeds[circuit.id];
        const calc = feed?.calculation;
        const block = [byId.get(circuit.targetId), byId.get(circuit.sourceId)].find(
            (element) => element?.type === 'building_block',
        );
        if (!feed || !calc || !block) continue;
        const worst = moduleWorstCircuit(ports, block.moduleId);
        const feederPercent = calc.accumulatedVoltageDropPercent;
        const totalPercent = worst ? feederPercent + worst.percent : null;
        rows.push({
            blockId: block.id,
            blockLabel: block.label,
            moduleName: feed.moduleName ?? block.moduleName ?? '-',
            panelLabel: feed.toLabel,
            fromLabel: feed.fromLabel,
            lengthM: calc.lengthM,
            interiorLengthM: Math.max(0, circuit.interiorLengthM ?? 0),
            sectionMm2: feed.sectionMm2,
            conductorType: feed.conductorType,
            feederPercent,
            worstCircuit: worst,
            totalPercent,
            withinLimits:
                feederPercent <= limits.feederPercent + 1e-9 &&
                (totalPercent === null || totalPercent <= limits.totalPercent + 1e-9),
        });
    }
    return rows;
}

/**
 * Cajas de pase / buzones ya cableados desde `panelId` (recorriendo cables a
 * través de otras cajas, como en obra: TG → caja → caja…). Son los puntos
 * desde donde se puede derivar un alimentador sin tender otro cable por
 * toda la planta.
 */
export function reachablePassThroughs(site: SiteData, panelId: string): SiteElement[] {
    const byId = new Map((site.elements ?? []).map((element) => [element.id, element]));
    const reached = new Set<string>();
    const queue = [panelId];
    const visited = new Set<string>([panelId]);
    while (queue.length > 0) {
        const node = queue.shift()!;
        for (const circuit of site.circuits ?? []) {
            if (circuit.sourceId !== node && circuit.targetId !== node) continue;
            const other = circuit.sourceId === node ? circuit.targetId : circuit.sourceId;
            if (visited.has(other)) continue;
            const element = byId.get(other);
            if (!element || !PASS_THROUGH_TYPES.has(element.type)) continue;
            visited.add(other);
            reached.add(other);
            queue.push(other);
        }
    }
    return [...reached].map((id) => byId.get(id)!).filter(Boolean);
}

/**
 * Desde dónde derivar el cable al edificio: la caja de pase alcanzable desde
 * el tablero más cercana a la fachada, si está más cerca que el propio
 * tablero; si no, el tablero. Distancias en metros.
 */
export function blockFeedOrigin(
    site: SiteData,
    panelId: string,
    block: SiteElement,
    scaleM: number,
): { element: SiteElement; distanceM: number; viaPassThrough: boolean } | null {
    const panel = (site.elements ?? []).find((element) => element.id === panelId);
    if (!panel) return null;
    const distanceTo = (element: SiteElement) => {
        const c = elementBox(element, scaleM).center;
        const entry = buildingEntryPoint(block, c);
        return Math.hypot(entry.x - c.x, entry.y - c.y) * scaleM;
    };
    let best = { element: panel, distanceM: distanceTo(panel), viaPassThrough: false };
    for (const box of reachablePassThroughs(site, panelId)) {
        const distanceM = distanceTo(box);
        if (distanceM < best.distanceM) best = { element: box, distanceM, viaPassThrough: true };
    }
    return best;
}
