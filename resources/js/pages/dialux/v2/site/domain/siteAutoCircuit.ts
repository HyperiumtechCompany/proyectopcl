import { analyzeSiteOutputs, siteElementLoadW } from './siteOutputs';
import { normalizeTgOutputs, resizeTgOutputs, TG_MAX_OUTPUTS } from './tgPanel';
import type { Point2D, SiteCircuit, SiteData, SiteElement, TgOutput } from './types';

/**
 * Auto-circuitado de la Planta General (fase E1 de
 * `plan_pendientes_exterior_electrico_documentos.md`): agrupa las cargas SIN
 * cablear (postes, portones y techados con luces, tomacorrientes) en
 * circuitos de un tablero, traza los cables, reparte las fases y elige la
 * sección — en un clic, con vista previa antes de aplicar.
 *
 * Reglas (criterios de PROYECTO, editables; no son cifras normativas):
 *  1. Alumbrado y tomacorrientes en circuitos separados (el motor CT de la V1
 *     ya alerta los circuitos mixtos).
 *  2. Cada carga va al tablero más cercano de la planta (si hay varios).
 *  3. Agrupación por BARRIDO ANGULAR alrededor del tablero (algoritmo de
 *     barrido de Gillett y Miller, 1974, para rutas con capacidad): se
 *     ordenan las cargas por ángulo, empezando en el mayor hueco angular, y
 *     se corta un circuito al superar la potencia o los puntos máximos.
 *  4. Dentro de cada circuito, recorrido del vecino más cercano desde el
 *     tablero (cables en cadena, sin cruces innecesarios).
 *  5. Fases: el circuito de mayor potencia a la fase menos cargada (LPT),
 *     partiendo de las salidas 1Φ que el tablero ya tiene.
 *  6. Sección: la menor de la serie cuyo resultado del motor CT de la V1
 *     (`analyzeSiteOutputs` → `calculatePanelCircuitSummaries`, sin
 *     modificar) tiene ΔU acumulada dentro del límite y cable con capacidad.
 */

export interface AutoCircuitRules {
    maxLightingW: number;
    maxOutletW: number;
    maxLightingPoints: number;
    maxOutletPoints: number;
    sectionsMm2: number[];
    conductorType: string;
}

export const DEFAULT_AUTO_CIRCUIT_RULES: AutoCircuitRules = {
    // ≈ 80 % de un circuito de 16 A a 220 V con margen para ΔU en recorridos
    // exteriores largos (criterio de proyecto).
    maxLightingW: 2000,
    maxOutletW: 1800,
    maxLightingPoints: 12,
    maxOutletPoints: 8,
    sectionsMm2: [2.5, 4, 6, 10, 16, 25],
    conductorType: 'THW-90',
};

type Settings = Parameters<typeof analyzeSiteOutputs>[1];

/** Sistema supuesto si el proyecto aún no tiene red: 380/220 V 3Φ estrella, cos φ 0,9. */
export const DEFAULT_SITE_NETWORK_SETTINGS: Settings = {
    nominalVoltageV: 380,
    phases: 3,
    connectionType: 'star',
    defaultPowerFactor: 0.9,
    designFactor: 1.25,
};
type Phase = 'R' | 'S' | 'T';
const PHASES: Phase[] = ['R', 'S', 'T'];
const PANEL_TYPES = new Set<SiteElement['type']>(['tg_location', 'sub_panel']);

export interface AutoCircuitGroup {
    kind: 'lighting' | 'outlets';
    /** Cargas en el orden del recorrido (tablero → primera → …). */
    loadIds: string[];
    powerW: number;
    phase: Phase;
    tgOutputId?: string;
    sectionMm2: number;
    /** ΔU acumulada (%) y límite del motor CT de la V1 con la sección elegida. */
    voltageDropPct: number;
    maxVoltageDropPct: number;
    capacityOk: boolean;
    /** Cumple ΔU y capacidad con alguna sección de la serie. */
    ok: boolean;
    lengthM: number;
}

export interface AutoCircuitPlan {
    panelId: string;
    groups: AutoCircuitGroup[];
    /** Cables a crear (sin id: los asigna el editor). */
    circuits: Array<Omit<SiteCircuit, 'id' | 'calculatedLengthM'>>;
    /** Salidas del TG si hubo que agregar más (ausente = no cambian). */
    tgOutputs?: TgOutput[];
    warnings: string[];
}

const centerOf = (element: SiteElement): Point2D => {
    const n = element.vertices.length || 1;
    return {
        x: element.vertices.reduce((sum, v) => sum + v.x, 0) / n,
        y: element.vertices.reduce((sum, v) => sum + v.y, 0) / n,
    };
};

const isLoad = (element: SiteElement) =>
    element.visible !== false &&
    (element.type === 'pole' ||
        element.type === 'outlet' ||
        ((element.type === 'gate' || element.type === 'canopy') &&
            siteElementLoadW(element).watts > 0));

/** Barrido angular: ordena por ángulo empezando después del mayor hueco. */
export function sweepOrder(origin: Point2D, points: Array<{ id: string; at: Point2D }>) {
    const withAngle = points
        .map((point) => ({
            ...point,
            angle: Math.atan2(point.at.y - origin.y, point.at.x - origin.x),
        }))
        .sort((a, b) => a.angle - b.angle || a.id.localeCompare(b.id));
    if (withAngle.length < 2) return withAngle;
    let gapIndex = 0;
    let gap = -Infinity;
    for (let i = 0; i < withAngle.length; i++) {
        const next = withAngle[(i + 1) % withAngle.length];
        const delta =
            (next.angle - withAngle[i].angle + 2 * Math.PI) % (2 * Math.PI) ||
            (withAngle.length === 1 ? 2 * Math.PI : 0);
        if (delta > gap) {
            gap = delta;
            gapIndex = (i + 1) % withAngle.length;
        }
    }
    return [...withAngle.slice(gapIndex), ...withAngle.slice(0, gapIndex)];
}

/** Recorrido del vecino más cercano desde el tablero. */
export function nearestNeighbourChain(
    origin: Point2D,
    points: Array<{ id: string; at: Point2D }>,
): string[] {
    const left = [...points];
    const chain: string[] = [];
    let current = origin;
    while (left.length > 0) {
        let best = 0;
        for (let i = 1; i < left.length; i++) {
            if (
                Math.hypot(left[i].at.x - current.x, left[i].at.y - current.y) <
                Math.hypot(left[best].at.x - current.x, left[best].at.y - current.y)
            ) {
                best = i;
            }
        }
        const [next] = left.splice(best, 1);
        chain.push(next.id);
        current = next.at;
    }
    return chain;
}

export function planAutoCircuits(
    site: SiteData,
    panelId: string,
    settings: Settings,
    options: {
        rules?: Partial<AutoCircuitRules>;
        upstreamPercent?: (panelElementId: string) => number;
    } = {},
): AutoCircuitPlan {
    const rules = { ...DEFAULT_AUTO_CIRCUIT_RULES, ...options.rules };
    const elements = site.elements ?? [];
    const byId = new Map(elements.map((element) => [element.id, element]));
    const panel = byId.get(panelId);
    const warnings: string[] = [];
    const empty: AutoCircuitPlan = { panelId, groups: [], circuits: [], warnings };
    if (!panel || !PANEL_TYPES.has(panel.type)) {
        warnings.push('Elige un tablero general o sub tablero de la planta.');
        return empty;
    }
    const upstream = options.upstreamPercent ?? (() => 0);
    const before = analyzeSiteOutputs(site, settings, upstream);
    const connected = new Set<string>(before.coveredLoadIds);
    for (const circuit of site.circuits ?? []) {
        connected.add(circuit.sourceId);
        connected.add(circuit.targetId);
    }
    const panels = elements.filter(
        (element) => PANEL_TYPES.has(element.type) && element.visible !== false,
    );
    const origin = centerOf(panel);
    const nearestPanel = (at: Point2D) =>
        panels.reduce((best, candidate) => {
            const d = (p: SiteElement) =>
                Math.hypot(centerOf(p).x - at.x, centerOf(p).y - at.y);
            return d(candidate) < d(best) ? candidate : best;
        }, panel).id;
    const pending = elements
        .filter((element) => isLoad(element) && !connected.has(element.id))
        .map((element) => ({ element, at: centerOf(element) }))
        .filter(({ at }) => nearestPanel(at) === panel.id);
    if (pending.length === 0) {
        warnings.push('No hay cargas sin cablear más cercanas a este tablero.');
        return empty;
    }

    // 1–3: separar por tipo y cortar el barrido por potencia / puntos.
    const rawGroups: Array<{ kind: AutoCircuitGroup['kind']; ids: string[]; powerW: number }> = [];
    for (const kind of ['lighting', 'outlets'] as const) {
        const maxW = kind === 'lighting' ? rules.maxLightingW : rules.maxOutletW;
        const maxPoints = kind === 'lighting' ? rules.maxLightingPoints : rules.maxOutletPoints;
        const ofKind = pending.filter(({ element }) =>
            kind === 'outlets' ? element.type === 'outlet' : element.type !== 'outlet',
        );
        let current: { ids: string[]; powerW: number } = { ids: [], powerW: 0 };
        for (const point of sweepOrder(
            origin,
            ofKind.map(({ element, at }) => ({ id: element.id, at })),
        )) {
            const watts = siteElementLoadW(byId.get(point.id)!).watts;
            if (watts > maxW) {
                warnings.push(
                    `${byId.get(point.id)!.label}: ${watts} W supera el máximo por circuito (${maxW} W); va en un circuito propio.`,
                );
            }
            if (
                current.ids.length > 0 &&
                (current.powerW + watts > maxW || current.ids.length >= maxPoints)
            ) {
                rawGroups.push({ kind, ...current });
                current = { ids: [], powerW: 0 };
            }
            current.ids.push(point.id);
            current.powerW += watts;
        }
        if (current.ids.length > 0) rawGroups.push({ kind, ...current });
    }

    // 5: fases (LPT) partiendo de las salidas 1Φ existentes del tablero.
    const phaseLoad: Record<Phase, number> = { R: 0, S: 0, T: 0 };
    for (const row of before.rows) {
        if (row.panelElementId !== panel.id) continue;
        if (row.phases === 3) {
            for (const phase of PHASES) phaseLoad[phase] += row.installedPowerW / 3;
        } else {
            for (const phase of PHASES) {
                if (row.phaseBalance.includes(phase)) phaseLoad[phase] += row.installedPowerW;
            }
        }
    }
    const phaseOf = new Map<number, Phase>();
    [...rawGroups.keys()]
        .sort((a, b) => rawGroups[b].powerW - rawGroups[a].powerW || a - b)
        .forEach((index) => {
            const phase = PHASES.reduce((best, candidate) =>
                phaseLoad[candidate] < phaseLoad[best] - 1e-9 ? candidate : best,
            );
            phaseOf.set(index, phase);
            phaseLoad[phase] += rawGroups[index].powerW;
        });

    // Salidas del TG: libres primero; si faltan, se agregan (máx. 24).
    let tgOutputs: TgOutput[] | undefined;
    const outputIds: Array<string | undefined> = rawGroups.map(() => undefined);
    if (panel.type === 'tg_location' && panel.config?.kind === 'tg') {
        const used = new Set(
            (site.circuits ?? [])
                .filter((c) => c.sourceId === panel.id || c.targetId === panel.id)
                .map((c) => c.tgOutputId)
                .filter(Boolean),
        );
        let outputs = normalizeTgOutputs(panel.config.outputs);
        const free = () => outputs.filter((output) => !used.has(output.id));
        if (free().length < rawGroups.length) {
            const needed = Math.min(TG_MAX_OUTPUTS, outputs.length + rawGroups.length - free().length);
            outputs = resizeTgOutputs(outputs, needed);
            tgOutputs = outputs;
            if (free().length < rawGroups.length) {
                warnings.push(
                    `El TG admite hasta ${TG_MAX_OUTPUTS} salidas: algunos circuitos comparten salida.`,
                );
            }
        }
        const available = free();
        rawGroups.forEach((_, index) => {
            outputIds[index] = available[index % Math.max(1, available.length)]?.id;
        });
    }

    // 4: cables en cadena (vecino más cercano).
    const chains = rawGroups.map((group) =>
        nearestNeighbourChain(
            origin,
            group.ids.map((id) => ({ id, at: centerOf(byId.get(id)!) })),
        ),
    );
    const sectionIndex = rawGroups.map(() => 0);
    const buildCircuits = () =>
        chains.flatMap((chain, g) =>
            chain.map((loadId, i) => {
                const fromId = i === 0 ? panel.id : chain[i - 1];
                return {
                    sourceId: fromId,
                    targetId: loadId,
                    waypoints: [centerOf(byId.get(fromId)!), centerOf(byId.get(loadId)!)],
                    wireCount: 3,
                    wireLabel: 'F+N+T',
                    conductorType: rules.conductorType,
                    sectionMm2: rules.sectionsMm2[sectionIndex[g]],
                    wastePct: 5,
                    ...(i === 0 ? { phase: phaseOf.get(g)! } : {}),
                    ...(outputIds[g] ? { tgOutputId: outputIds[g] } : {}),
                    label: `${rawGroups[g].kind === 'lighting' ? 'Alumbrado' : 'Tomas'} ${g + 1}`,
                };
            }),
        );

    // 6: sección por ΔU y capacidad con el motor CT de la V1.
    let circuits = buildCircuits();
    let rowsByGroup: Array<(typeof before.rows)[number] | undefined> = [];
    for (let iteration = 0; iteration <= rules.sectionsMm2.length; iteration++) {
        const trialCircuits = circuits.map((circuit, index) => ({
            ...circuit,
            id: `__auto_${index}`,
            calculatedLengthM: 0,
        }));
        const rootIds: string[] = [];
        let cursor = 0;
        for (const chain of chains) {
            rootIds.push(`__auto_${cursor}`);
            cursor += chain.length;
        }
        const trial: SiteData = { ...site, circuits: [...(site.circuits ?? []), ...trialCircuits] };
        const rows = analyzeSiteOutputs(trial, settings, upstream).rows;
        rowsByGroup = rootIds.map((rootId) => rows.find((row) => row.rootConductorId === rootId));
        let bumped = false;
        rowsByGroup.forEach((row, g) => {
            const fine = row ? row.voltageDropOk && row.capacityConforms : false;
            if (!fine && sectionIndex[g] < rules.sectionsMm2.length - 1) {
                sectionIndex[g] += 1;
                bumped = true;
            }
        });
        if (!bumped) break;
        circuits = buildCircuits();
    }

    const groups: AutoCircuitGroup[] = rawGroups.map((group, g) => {
        const row = rowsByGroup[g];
        const ok = row ? row.voltageDropOk && row.capacityConforms : false;
        if (!ok) {
            warnings.push(
                `Circuito ${g + 1}: ni con ${rules.sectionsMm2[rules.sectionsMm2.length - 1]} mm² queda dentro del límite de ΔU/capacidad — divídelo (menos puntos) o acerca un sub tablero.`,
            );
        }
        return {
            kind: group.kind,
            loadIds: chains[g],
            powerW: group.powerW,
            phase: phaseOf.get(g)!,
            ...(outputIds[g] ? { tgOutputId: outputIds[g] } : {}),
            sectionMm2: rules.sectionsMm2[sectionIndex[g]],
            voltageDropPct: row?.voltageDropPct ?? 0,
            maxVoltageDropPct: row?.maxVoltageDropPct ?? 0,
            capacityOk: row?.capacityConforms ?? false,
            ok,
            lengthM: row?.lengthM ?? 0,
        };
    });
    return { panelId, groups, circuits, ...(tgOutputs ? { tgOutputs } : {}), warnings };
}
