import type { ConductorCatalog } from '@/pages/dialux/electrical/engine/types';
import type { EdgeCalculation } from './calculations';
import { feederVoltageDrop } from './feederVoltageDrop';
import { networkRootIds } from './graph';
import type { ShortCircuitResult } from './shortCircuit';
import { calculateShortCircuits } from './shortCircuit';
import type {
    ElectricalEdge,
    ElectricalNetworkData,
    ModuleElectricalPort,
} from './types';

/**
 * Reparto óptimo de la caída de tensión en el árbol de la red (R5 de
 * `plan_red_ct_dimensionamiento_multimodulo.md`).
 *
 * Problema: elegir la sección de TODOS los alimentadores a la vez para
 * minimizar la masa de conductor, con estas restricciones por alimentador y
 * por camino suministro → tablero:
 *   1. ΔU propia ≤ límite del alimentador (`feederDropLimitPercent`);
 *   2. ΔU acumulada + reserva interna del tablero ≤ límite total
 *      (`totalDropLimitPercent`). La reserva es la mayor ΔU propia de los
 *      circuitos que el módulo publica para ese tablero (lo que todavía caerá
 *      dentro del módulo);
 *   3. ampacidad del catálogo ≥ corriente de diseño;
 *   4. sección ≥ la mínima por cortocircuito (R3) y ≥ 2,5 mm².
 * La ΔU de cada candidata usa la MISMA fórmula que la red (IEC 60364-5-52
 * Anexo G, `feederVoltageDrop`) con la corriente ya calculada (no depende de
 * la sección).
 *
 * Método: programación dinámica exacta sobre el árbol con el presupuesto de
 * ΔU discretizado en pasos de `stepPercent` (0,01 %). Cada ΔU y cada reserva
 * se redondea HACIA ARRIBA al paso, así que toda solución encontrada cumple
 * las restricciones con los valores exactos; el costo puede quedar a lo sumo
 * un paso por encima del óptimo continuo. Complejidad O(tramos × secciones ×
 * pasos).
 *
 * El corrector anterior ("sección sugerida", tramo a tramo) cumple el límite
 * de CADA alimentador por separado; el óptimo reparte el presupuesto total:
 * engrosa los tramos cortos y cargados y adelgaza los largos y livianos.
 */

/** Serie de secciones normalizadas (IEC 60228) si el catálogo no tiene datos. */
export const STANDARD_SECTIONS_MM2 = [
    2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300,
];
export const MIN_FEEDER_SECTION_MM2 = 2.5;
/** kg por mm²·m (densidad 8,96 g/cm³ cobre, 2,70 g/cm³ aluminio). */
const DENSITY_KG_PER_MM2_M = { copper: 0.00896, aluminium: 0.0027 } as const;

export interface SectionChange {
    edgeId: string;
    label: string;
    currentMm2: number;
    optimalMm2: number;
    /** Sección del corrector tramo a tramo (la actual si no hay sugerencia). */
    perFeederMm2: number;
    dropPercent: number;
    accumulatedPercent: number;
}

export interface SectionOptimization {
    feasible: boolean;
    /** Raíces sin solución (ninguna combinación cumple los límites). */
    infeasibleRoots: string[];
    changes: SectionChange[];
    /** Masa de conductores activos (kg): actual, tramo a tramo y óptima. */
    massKg: { current: number; perFeeder: number; optimal: number };
    /** ΔU acumulada máxima (incluida la reserva) con la solución óptima, %. */
    maxAccumulatedPercent: number;
    usedCatalog: boolean;
    /**
     * Alimentadores que el optimizador NO puede cambiar (sección fijada en el
     * cable de la planta, o sin datos) y que ya superan el límite propio del
     * alimentador: la solución no es conforme aunque el total lo sea.
     */
    fixedOverLimitEdgeIds: string[];
    /**
     * Alimentadores cuya sección óptima no pasa la verificación térmica al
     * recalcular el cortocircuito CON las secciones óptimas (engrosar un tramo
     * aguas arriba sube la I″k aguas abajo) tras 3 iteraciones.
     */
    thermalRecheckFailures: string[];
}

interface Candidate {
    sectionMm2: number;
    dropPercent: number;
    steps: number;
    massKg: number;
}

const activeConductors = (phases: 1 | 3) => (phases === 3 ? 3 : 2);

function optimizeOnce(
    network: ElectricalNetworkData,
    ports: ModuleElectricalPort[],
    calculations: EdgeCalculation[],
    conductors: ConductorCatalog[] = [],
    shortCircuits?: ShortCircuitResult,
    options: {
        stepPercent?: number;
        reserveModuleCircuits?: boolean;
        /** Alimentadores con sección fijada fuera de la red (cable de la planta con sección propia). */
        fixedEdgeIds?: Set<string>;
    } = {},
): SectionOptimization {
    const step = options.stepPercent ?? 0.01;
    const reserveModules = options.reserveModuleCircuits ?? true;
    const { settings } = network;
    const budgetSteps = Math.floor(settings.totalDropLimitPercent / step + 1e-9);
    const calcByEdge = new Map(calculations.map((item) => [item.edgeId, item]));
    const nodeById = new Map(network.nodes.map((node) => [node.id, node]));
    const children = new Map<string, ElectricalEdge[]>();
    for (const edge of network.edges) {
        children.set(edge.sourceNodeId, [
            ...(children.get(edge.sourceNodeId) ?? []),
            edge,
        ]);
    }
    const toSteps = (percent: number) =>
        Math.max(0, Math.ceil(percent / step - 1e-9));

    /** Reserva interna del tablero (mayor ΔU propia de sus circuitos), %. */
    const reserveOf = (nodeId: string): number => {
        if (!reserveModules) return 0;
        const node = nodeById.get(nodeId);
        if (node?.type !== 'module_panel_port') return 0;
        const port = ports.find(
            (item) =>
                item.moduleId === node.moduleId &&
                item.sceneId === node.sceneId &&
                item.panelId === node.deviceId,
        );
        return (port?.circuits ?? [])
            .filter((circuit) => circuit.panelId === port?.panelId)
            .reduce((max, circuit) => Math.max(max, circuit.voltageDropPct || 0), 0);
    };

    let usedCatalog = false;
    // Límite propio de los tramos que no se optimizan (se registran al generar candidatos).
    const fixedOverLimitEdgeIds: string[] = [];
    const candidatesOf = (edge: ElectricalEdge): Candidate[] => {
        const calc = calcByEdge.get(edge.id);
        const lengthM = edge.horizontalLengthM + edge.verticalLengthM;
        const phases = calc?.phases ?? settings.phases;
        const density = DENSITY_KG_PER_MM2_M[edge.conductorMaterial] ?? DENSITY_KG_PER_MM2_M.copper;
        const mass = (sectionMm2: number) =>
            lengthM * sectionMm2 * activeConductors(phases) * density;
        // Sin corriente, sin longitud, sin tensión o con sección fijada en la
        // planta: el tramo no se optimiza (conserva su sección y su ΔU).
        if (
            !calc ||
            !(calc.currentA > 0) ||
            !(lengthM > 0) ||
            !calc.voltageV ||
            options.fixedEdgeIds?.has(edge.id)
        ) {
            if ((calc?.ownVoltageDropPercent ?? 0) > settings.feederDropLimitPercent + 1e-12) {
                fixedOverLimitEdgeIds.push(edge.id);
            }
            return [
                {
                    sectionMm2: edge.sectionMm2,
                    dropPercent: calc?.ownVoltageDropPercent ?? 0,
                    steps: toSteps(calc?.ownVoltageDropPercent ?? 0),
                    massKg: mass(edge.sectionMm2),
                },
            ];
        }
        const material = edge.conductorMaterial === 'aluminium' ? 'aluminio' : 'cobre';
        const sameInsulation = conductors.filter(
            (item) =>
                item.material === material &&
                item.insulation.toLowerCase() === edge.conductorType.toLowerCase(),
        );
        const catalog =
            sameInsulation.length > 0
                ? sameInsulation
                : conductors.filter((item) => item.material === material);
        if (catalog.length > 0) usedCatalog = true;
        const sectionOptions =
            catalog.length > 0
                ? catalog.map((item) => ({
                      sectionMm2: item.section_mm2,
                      ampacityA: item.ampacity_a as number | undefined,
                  }))
                : STANDARD_SECTIONS_MM2.map((sectionMm2) => ({
                      sectionMm2,
                      ampacityA: undefined as number | undefined,
                  }));
        const thermalMin = shortCircuits?.edges.get(edge.id)?.minSectionMm2 ?? 0;
        const seen = new Set<number>();
        const result: Candidate[] = [];
        for (const option of sectionOptions.sort((a, b) => a.sectionMm2 - b.sectionMm2)) {
            if (seen.has(option.sectionMm2)) continue;
            seen.add(option.sectionMm2);
            if (option.sectionMm2 < Math.max(MIN_FEEDER_SECTION_MM2, thermalMin)) continue;
            if (option.ampacityA !== undefined && option.ampacityA < calc.designCurrentA) continue;
            const { dropPercent } = feederVoltageDrop({
                currentA: calc.currentA,
                lengthM,
                sectionMm2: option.sectionMm2,
                voltageV: calc.voltageV,
                phases,
                material,
                powerFactor: calc.powerFactor ?? settings.defaultPowerFactor,
                temperatureC: settings.workingTemperatureC,
            });
            if (dropPercent > settings.feederDropLimitPercent + 1e-12) continue;
            result.push({
                sectionMm2: option.sectionMm2,
                dropPercent,
                steps: toSteps(dropPercent),
                massKg: mass(option.sectionMm2),
            });
        }
        return result;
    };

    // f(node)[b] = masa mínima del subárbol con b pasos de presupuesto disponibles.
    const best = new Map<string, Array<{ candidate: Candidate; childBudget: number } | null>>();
    const candidatesByEdge = new Map<string, Candidate[]>();
    const visiting = new Set<string>();
    const solve = (nodeId: string): number[] => {
        const reserve = toSteps(reserveOf(nodeId));
        const f = Array.from({ length: budgetSteps + 1 }, (_, b) =>
            b >= reserve ? 0 : Infinity,
        );
        if (visiting.has(nodeId)) return f;
        visiting.add(nodeId);
        for (const edge of children.get(nodeId) ?? []) {
            const child = solve(edge.targetNodeId);
            const candidates = candidatesOf(edge);
            candidatesByEdge.set(edge.id, candidates);
            const choice: Array<{ candidate: Candidate; childBudget: number } | null> = [];
            for (let b = 0; b <= budgetSteps; b++) {
                let cost = Infinity;
                let pick: { candidate: Candidate; childBudget: number } | null = null;
                for (const candidate of candidates) {
                    if (candidate.steps > b) continue;
                    const total = candidate.massKg + child[b - candidate.steps];
                    if (total < cost - 1e-12) {
                        cost = total;
                        pick = { candidate, childBudget: b - candidate.steps };
                    }
                }
                choice.push(pick);
                f[b] += cost;
            }
            best.set(edge.id, choice);
        }
        visiting.delete(nodeId);
        return f;
    };

    const chosen = new Map<string, { candidate: Candidate; accumulated: number }>();
    const infeasibleRoots: string[] = [];
    let maxAccumulatedPercent = 0;
    const assign = (nodeId: string, budget: number, accumulated: number, seen: Set<string>) => {
        if (seen.has(nodeId)) return;
        seen.add(nodeId);
        maxAccumulatedPercent = Math.max(maxAccumulatedPercent, accumulated + reserveOf(nodeId));
        for (const edge of children.get(nodeId) ?? []) {
            const pick = best.get(edge.id)?.[budget];
            if (!pick) continue;
            const next = accumulated + pick.candidate.dropPercent;
            chosen.set(edge.id, { candidate: pick.candidate, accumulated: next });
            assign(edge.targetNodeId, pick.childBudget, next, seen);
        }
    };
    for (const root of networkRootIds(network)) {
        const f = solve(root);
        if (!Number.isFinite(f[budgetSteps])) {
            infeasibleRoots.push(root);
            continue;
        }
        assign(root, budgetSteps, 0, new Set());
    }

    const massKg = { current: 0, perFeeder: 0, optimal: 0 };
    const changes: SectionChange[] = [];
    for (const edge of network.edges) {
        const calc = calcByEdge.get(edge.id);
        const lengthM = edge.horizontalLengthM + edge.verticalLengthM;
        const phases = calc?.phases ?? settings.phases;
        const density = DENSITY_KG_PER_MM2_M[edge.conductorMaterial] ?? DENSITY_KG_PER_MM2_M.copper;
        const mass = (section: number) =>
            lengthM * section * activeConductors(phases) * density;
        const perFeederMm2 = calc?.suggestedSectionMm2 ?? edge.sectionMm2;
        massKg.current += mass(edge.sectionMm2);
        massKg.perFeeder += mass(perFeederMm2);
        const pick = chosen.get(edge.id);
        massKg.optimal += mass(pick?.candidate.sectionMm2 ?? edge.sectionMm2);
        if (pick) {
            const source = nodeById.get(edge.sourceNodeId);
            const target = nodeById.get(edge.targetNodeId);
            changes.push({
                edgeId: edge.id,
                label: `${source?.label ?? edge.sourceNodeId} → ${
                    target?.moduleName ? `${target.moduleName} · ` : ''
                }${target?.label ?? edge.targetNodeId}`,
                currentMm2: edge.sectionMm2,
                optimalMm2: pick.candidate.sectionMm2,
                perFeederMm2,
                dropPercent: pick.candidate.dropPercent,
                accumulatedPercent: pick.accumulated,
            });
        }
    }
    return {
        feasible: infeasibleRoots.length === 0 && fixedOverLimitEdgeIds.length === 0,
        fixedOverLimitEdgeIds: [...new Set(fixedOverLimitEdgeIds)],
        thermalRecheckFailures: [],
        infeasibleRoots,
        changes,
        massKg,
        maxAccumulatedPercent,
        usedCatalog,
    };
}

type OptimizeOptions = Parameters<typeof optimizeOnce>[5];

/**
 * Optimiza y RECOMPRUEBA el cortocircuito con las secciones propuestas: la
 * sección mínima térmica depende de la I″k, que sube aguas abajo si el
 * óptimo engrosa un tramo aguas arriba. Se itera (máx. 3) tomando la mayor
 * sección mínima vista por tramo; si aún falla, se informa.
 */
export function optimizeFeederSections(
    network: ElectricalNetworkData,
    ports: ModuleElectricalPort[],
    calculations: EdgeCalculation[],
    conductors: ConductorCatalog[] = [],
    shortCircuits?: ShortCircuitResult,
    options: OptimizeOptions = {},
): SectionOptimization {
    let current = shortCircuits;
    let result = optimizeOnce(network, ports, calculations, conductors, current, options);
    if (!shortCircuits) return result;
    for (let iteration = 0; iteration < 3 && result.infeasibleRoots.length === 0; iteration++) {
        const sections = new Map(result.changes.map((change) => [change.edgeId, change.optimalMm2]));
        const applied: ElectricalNetworkData = {
            ...network,
            edges: network.edges.map((edge) => ({
                ...edge,
                sectionMm2: sections.get(edge.id) ?? edge.sectionMm2,
            })),
        };
        const after = calculateShortCircuits(applied, ports, calculations);
        const failing = result.changes
            .filter(
                (change) =>
                    (after.edges.get(change.edgeId)?.minSectionMm2 ?? 0) >
                    change.optimalMm2 + 1e-9,
            )
            .map((change) => change.edgeId);
        if (failing.length === 0) return result;
        // Mayor sección mínima vista por tramo (monótona → converge).
        const merged = new Map(current?.edges ?? []);
        for (const [edgeId, check] of after.edges) {
            const previous = merged.get(edgeId);
            if (!previous || check.minSectionMm2 > previous.minSectionMm2) {
                merged.set(edgeId, check);
            }
        }
        current = { ...after, edges: merged };
        result = optimizeOnce(network, ports, calculations, conductors, current, options);
        if (iteration === 2) {
            return { ...result, feasible: false, thermalRecheckFailures: failing };
        }
    }
    return result;
}
