/**
 * Motor de cálculo derivado del documento eléctrico DIALux.
 *
 * `computeElectricalDerived` es una función pura: recibe el documento
 * persistido + los catálogos del backend y devuelve TODOS los resultados
 * calculados (geometría, luminarias, tomacorrientes, circuitos, tableros,
 * alimentadores, metrados y totales). Nunca muta sus argumentos ni retorna
 * NaN/Infinity: los datos inválidos producen 0 y un warning en español.
 */

import {
    cableLength,
    circuitCurrent,
    complianceStatus,
    computeMinLuminaires,
    computeOutletsAuto,
    estimateIlluminance,
    isNonNegative,
    isPositive,
    selectBreaker,
    selectConductor,
    suggestGrid,
} from './formulas';
import type {
    Circuit,
    CircuitDefaults,
    CircuitResult,
    ConductorCatalog,
    ElectricalCatalogs,
    ElectricalDerived,
    ElectricalDocument,
    FeederResult,
    InstallationCategory,
    OutletRule,
    Panel,
    PanelResult,
    RoomGeometry,
    RoomLuminaireResult,
    RoomOutletResult,
    TakeoffItem,
} from './types';

// ─── Constantes internas ─────────────────────────────────────────────────────

/** Factor de seguridad para la corriente de diseño (NEC/CNE: 125 %). */
const DESIGN_FACTOR = 1.25;

/** Potencia por punto de tomacorriente cuando ni el grupo ni la regla la definen. */
const DEFAULT_OUTLET_VA = 180;

/** Parámetros de respaldo cuando el catálogo no trae defaults para un tipo de circuito. */
const FALLBACK_DEFAULTS: Pick<CircuitDefaults, 'min_section_mm2' | 'max_voltage_drop_pct' | 'demand_factor' | 'breaker_poles'> = {
    min_section_mm2: 2.5,
    max_voltage_drop_pct: 2.5,
    demand_factor: 1,
    breaker_poles: 2,
};

// ─── Helpers internos ────────────────────────────────────────────────────────

/** Etiqueta legible del conductor: "4 mm² Cu THW-90 (ref. AWG 12)". */
function conductorLabel(conductor: ConductorCatalog | null): string {
    if (!conductor) {
        return 'sin conductor';
    }

    const material = conductor.material === 'cobre' ? 'Cu' : 'Al';
    const awg = conductor.awg_ref ? ` (ref. AWG ${conductor.awg_ref})` : '';

    return `${conductor.section_mm2} mm² ${material} ${conductor.insulation}${awg}`;
}

/** Texto legible de la regla de tomacorrientes aplicada. */
function outletRuleLabel(rule: OutletRule | undefined): string {
    if (!rule) {
        return 'sin regla';
    }

    switch (rule.method) {
        case 'area':
            return `1 punto / ${rule.value} m²`;
        case 'perimeter':
            return `1 punto / ${rule.value} m de perímetro`;
        case 'fixed':
            return 'cantidad fija';
        default:
            return 'sin regla';
    }
}

/**
 * Defaults del catálogo para un tipo de circuito y tipo de instalación, con
 * respaldo seguro. Si no hay fila para la categoría exacta (p.ej. documento
 * legado sin `installationCategory`, o catálogo de usuario incompleto), cae a
 * cualquier fila del mismo `circuit_type` antes de usar el respaldo genérico.
 */
function defaultsFor(
    catalogs: ElectricalCatalogs,
    circuitType: CircuitDefaults['circuit_type'],
    installationCategory: InstallationCategory,
): { defaults: typeof FALLBACK_DEFAULTS; found: boolean } {
    const found =
        catalogs.circuitDefaults.find((d) => d.circuit_type === circuitType && d.installation_category === installationCategory) ??
        catalogs.circuitDefaults.find((d) => d.circuit_type === circuitType);
    if (!found) {
        return { defaults: FALLBACK_DEFAULTS, found: false };
    }

    return {
        defaults: {
            min_section_mm2: isPositive(found.min_section_mm2) ? found.min_section_mm2 : FALLBACK_DEFAULTS.min_section_mm2,
            max_voltage_drop_pct: isPositive(found.max_voltage_drop_pct) ? found.max_voltage_drop_pct : FALLBACK_DEFAULTS.max_voltage_drop_pct,
            demand_factor: isPositive(found.demand_factor) ? found.demand_factor : FALLBACK_DEFAULTS.demand_factor,
            breaker_poles: isPositive(found.breaker_poles) ? found.breaker_poles : FALLBACK_DEFAULTS.breaker_poles,
        },
        found: true,
    };
}

/** Número de conductores por circuito: fase(s) + neutro + tierra (3 mono, 4 tri). */
function wireCountFor(phases: 1 | 3): number {
    return phases === 3 ? 4 : 3;
}

/** El cable del punto se resuelve DESPUÉS de los circuitos (hereda su conductor); ver `resolveObjectConductor`. */
type RoomLuminaireResultPending = Omit<RoomLuminaireResult, 'sectionMm2' | 'conductorLabel' | 'sectionSource'>;
type RoomOutletResultPending = Omit<RoomOutletResult, 'sectionMm2' | 'conductorLabel' | 'sectionSource'>;

/**
 * Resuelve el cable que alimenta un punto (luminaria o tomacorriente) como
 * propiedad propia del objeto: un override manual en mm² tiene prioridad;
 * si no hay override, se hereda la sección ya calculada del circuito
 * asignado; sin override ni circuito, no hay cable que mostrar.
 */
function resolveObjectConductor(
    circuitId: string | null | undefined,
    manualOverrideMm2: number | null | undefined,
    circuitResultById: Map<string, CircuitResult>,
    conductors: ConductorCatalog[],
): { sectionMm2: number; conductorLabel: string; sectionSource: 'auto' | 'manual' | 'sin-circuito' } {
    if (manualOverrideMm2 != null && isPositive(manualOverrideMm2)) {
        const candidates = conductors
            .filter((c) => c.material === 'cobre' && isPositive(c.section_mm2))
            .sort((a, b) => a.section_mm2 - b.section_mm2);
        const match = candidates.find((c) => c.section_mm2 >= manualOverrideMm2) ?? candidates[candidates.length - 1] ?? null;
        return { sectionMm2: match?.section_mm2 ?? 0, conductorLabel: conductorLabel(match), sectionSource: 'manual' };
    }

    if (circuitId) {
        const circuitResult = circuitResultById.get(circuitId);
        if (circuitResult) {
            return { sectionMm2: circuitResult.sectionMm2, conductorLabel: circuitResult.conductorLabel, sectionSource: circuitResult.sectionSource };
        }
    }

    return { sectionMm2: 0, conductorLabel: 'sin circuito asignado', sectionSource: 'sin-circuito' };
}

// ─── Cálculo principal ───────────────────────────────────────────────────────

export function computeElectricalDerived(doc: ElectricalDocument, catalogs: ElectricalCatalogs): ElectricalDerived {
    const settings = doc.settings;
    const voltageV = isPositive(settings.voltageV) ? settings.voltageV : 0;
    const phases: 1 | 3 = settings.phases === 3 ? 3 : 1;
    const powerFactor = isPositive(settings.powerFactor) ? settings.powerFactor : 0;
    const reserveFactor = isPositive(settings.cableReserveFactor) ? settings.cableReserveFactor : 1;
    // Documentos creados antes de esta categoría (o con dato corrupto) caen a residencial.
    const installationCategory: InstallationCategory =
        settings.installationCategory === 'educativa' || settings.installationCategory === 'industrial' ? settings.installationCategory : 'residencial';

    const roomsById = new Map(doc.rooms.map((r) => [r.id, r]));
    const luminaireTypesById = new Map(doc.luminaireTypes.map((t) => [t.id, t]));
    const circuitsById = new Map(doc.circuits.map((c) => [c.id, c]));
    const panelsById = new Map(doc.panels.map((p) => [p.id, p]));

    // ── Geometría por ambiente ──────────────────────────────────────────────
    // area = override del plano CAD ?? largo·ancho; perímetro = override ?? 2·(largo+ancho).
    const roomGeometry: Record<string, RoomGeometry> = {};
    for (const room of doc.rooms) {
        const length = isPositive(room.lengthM) ? room.lengthM : 0;
        const width = isPositive(room.widthM) ? room.widthM : 0;
        const areaM2 = isPositive(room.areaOverrideM2) ? (room.areaOverrideM2 as number) : length * width;
        const perimeterM = isPositive(room.perimeterOverrideM) ? (room.perimeterOverrideM as number) : 2 * (length + width);
        roomGeometry[room.id] = { areaM2, perimeterM };
    }

    // ── Luminarias por ambiente ─────────────────────────────────────────────
    const roomLuminaires: RoomLuminaireResultPending[] = doc.roomLuminaires.map((rl) => {
        const warnings: string[] = [];
        const room = roomsById.get(rl.roomId);
        const type = luminaireTypesById.get(rl.luminaireTypeId);

        if (!room) {
            warnings.push(`El ambiente "${rl.roomId}" no existe en el documento.`);
        }
        if (!type) {
            warnings.push(`El tipo de luminaria "${rl.luminaireTypeId}" no existe en el documento.`);
        }
        if (rl.circuitId != null && !circuitsById.has(rl.circuitId)) {
            warnings.push(`El circuito "${rl.circuitId}" asignado a la luminaria no existe; la carga no se contabiliza en ningún circuito.`);
        }

        const geometry = room ? roomGeometry[room.id] : { areaM2: 0, perimeterM: 0 };
        const requiredLux = room && isPositive(room.requiredLux) ? room.requiredLux : 0;
        const cu = room?.utilizationFactor ?? 0;
        const fm = room?.maintenanceFactor ?? 0;
        const lumens = type?.lumens ?? 0;
        const powerW = type && isPositive(type.powerW) ? type.powerW : 0;

        if (room && !isPositive(geometry.areaM2)) {
            warnings.push(`El ambiente "${room.name}" tiene área inválida (${geometry.areaM2} m²); los cálculos de iluminación resultan 0.`);
        }
        if (type && !isPositive(lumens)) {
            warnings.push(`El tipo de luminaria "${type.code}" tiene flujo luminoso inválido (${type.lumens} lm).`);
        }
        if (type && !isPositive(type.powerW)) {
            warnings.push(`El tipo de luminaria "${type.code}" tiene potencia inválida (${type.powerW} W).`);
        }

        const minQty = computeMinLuminaires(requiredLux, geometry.areaM2, lumens, cu, fm);

        let selectedQty = minQty;
        if (rl.manualQty != null) {
            if (isNonNegative(rl.manualQty)) {
                selectedQty = Math.round(rl.manualQty);
            } else {
                warnings.push(`La cantidad manual (${rl.manualQty}) es inválida; se usa la cantidad mínima calculada (${minQty}).`);
            }
        }

        const estimatedLux = estimateIlluminance(selectedQty, lumens, cu, fm, geometry.areaM2);
        const compliance = complianceStatus(estimatedLux, requiredLux);

        if (compliance.status === 'no_cumple') {
            warnings.push(
                `No cumple el nivel requerido: ${estimatedLux.toFixed(1)} lux estimados frente a ${requiredLux} lux requeridos (${compliance.pct.toFixed(1)}%).`,
            );
        }

        // Grilla: se respetan filas/columnas manuales solo si ambas son > 0.
        const grid = isPositive(rl.rows) && isPositive(rl.cols) ? { rows: rl.rows as number, cols: rl.cols as number } : suggestGrid(selectedQty);

        return {
            roomLuminaireId: rl.id,
            roomId: rl.roomId,
            luminaireTypeId: rl.luminaireTypeId,
            minQty,
            selectedQty,
            estimatedLux,
            requiredLux,
            deltaLux: compliance.deltaLux,
            compliancePct: compliance.pct,
            status: compliance.status,
            totalPowerW: selectedQty * powerW,
            suggestedRows: grid.rows,
            suggestedCols: grid.cols,
            warnings,
        };
    });

    // ── Tomacorrientes por ambiente ─────────────────────────────────────────
    const roomOutlets: RoomOutletResultPending[] = doc.roomOutlets.map((group) => {
        const room = roomsById.get(group.roomId);
        const geometry = room ? roomGeometry[room.id] : { areaM2: 0, perimeterM: 0 };

        // La regla se busca por tipo de ambiente, sin distinguir mayúsculas.
        const roomType = room?.roomType?.trim().toLowerCase() ?? '';
        const rule = roomType !== '' ? catalogs.outletRules.find((r) => r.room_type.trim().toLowerCase() === roomType) : undefined;

        const outletType = catalogs.outletTypes.find((t) => t.code.trim().toLowerCase() === group.outletTypeCode.trim().toLowerCase());

        const autoQty = computeOutletsAuto(rule, geometry.areaM2, geometry.perimeterM);
        const baseQty = group.manualQty != null && isNonNegative(group.manualQty) ? Math.round(group.manualQty) : autoQty;
        const extraQty = isNonNegative(group.extraQty) ? Math.round(group.extraQty) : 0;
        const finalQty = Math.max(0, baseQty + extraQty);

        const heightM = group.heightM ?? outletType?.height_m ?? null;
        const powerVAPerPoint = isPositive(group.powerVA)
            ? (group.powerVA as number)
            : isPositive(rule?.power_per_outlet_va)
              ? (rule as OutletRule).power_per_outlet_va
              : DEFAULT_OUTLET_VA;

        return {
            roomOutletId: group.id,
            roomId: group.roomId,
            outletTypeCode: group.outletTypeCode,
            autoQty,
            finalQty,
            heightM,
            ruleApplied: outletRuleLabel(rule),
            totalPowerVA: finalQty * powerVAPerPoint,
        };
    });

    // ── Circuitos ───────────────────────────────────────────────────────────
    // Las luminarias aportan W directos; los tomacorrientes aportan VA·fp.
    // Se suman todas las cargas asignadas al circuito, sea cual sea su tipo.
    const circuits: CircuitResult[] = doc.circuits.map((circuit) => {
        const warnings: string[] = [];

        const connectedLums = roomLuminaires.filter((rl) => doc.roomLuminaires.find((d) => d.id === rl.roomLuminaireId)?.circuitId === circuit.id);
        const connectedOuts = roomOutlets.filter((ro) => doc.roomOutlets.find((d) => d.id === ro.roomOutletId)?.circuitId === circuit.id);

        const lumPowerW = connectedLums.reduce((sum, rl) => sum + rl.totalPowerW, 0);
        const outPowerW = connectedOuts.reduce((sum, ro) => sum + ro.totalPowerVA * powerFactor, 0);
        const totalPowerW = lumPowerW + outPowerW;

        const { defaults, found } = defaultsFor(catalogs, circuit.type, installationCategory);
        if (!found) {
            warnings.push(`No hay parámetros por defecto para circuitos de tipo "${circuit.type}"; se usan valores de respaldo.`);
        }

        let demandFactor = defaults.demand_factor;
        if (circuit.demandFactorOverride != null) {
            if (isPositive(circuit.demandFactorOverride)) {
                demandFactor = circuit.demandFactorOverride;
            } else {
                warnings.push(`El factor de demanda manual (${circuit.demandFactorOverride}) es inválido; se usa ${demandFactor}.`);
            }
        }

        const demandPowerW = totalPowerW * demandFactor;

        if (!isPositive(voltageV)) {
            warnings.push('La tensión del proyecto es inválida; las corrientes resultan 0.');
        }
        if (!isPositive(powerFactor)) {
            warnings.push('El factor de potencia del proyecto es inválido; las corrientes resultan 0.');
        }

        const currentA = circuitCurrent(demandPowerW, voltageV, phases, powerFactor);
        const designCurrentA = currentA * DESIGN_FACTOR;

        const selection = selectConductor({
            designCurrentA,
            lengthM: circuit.lengthM,
            voltageV,
            phases,
            minSectionMm2: defaults.min_section_mm2,
            maxVoltageDropPct: defaults.max_voltage_drop_pct,
            conductors: catalogs.conductors,
            manualSectionMm2: circuit.manualSectionMm2 ?? null,
            material: 'cobre',
        });
        warnings.push(...selection.warnings);

        const breaker = selectBreaker(designCurrentA, circuit.manualBreakerA ?? null);

        // El interruptor no debe superar la ampacidad del conductor: de lo
        // contrario el cable queda desprotegido ante sobrecarga.
        if (selection.conductor && breaker.amps > selection.conductor.ampacity_a) {
            warnings.push(
                `El interruptor de ${breaker.amps} A supera la ampacidad del conductor de ${selection.sectionMm2} mm² (${selection.conductor.ampacity_a} A).`,
            );
        }

        const ampacityFails = selection.conductor === null || selection.conductor.ampacity_a < designCurrentA;
        const dropFails = selection.voltageDropPct > defaults.max_voltage_drop_pct;
        const status: CircuitResult['status'] = ampacityFails || dropFails ? 'error' : warnings.length > 0 ? 'advertencia' : 'ok';

        return {
            circuitId: circuit.id,
            code: circuit.code,
            type: circuit.type,
            panelId: circuit.panelId,
            connectedLuminaires: connectedLums.reduce((sum, rl) => sum + rl.selectedQty, 0),
            connectedOutlets: connectedOuts.reduce((sum, ro) => sum + ro.finalQty, 0),
            totalPowerW,
            demandFactor,
            demandPowerW,
            currentA,
            designCurrentA,
            sectionMm2: selection.sectionMm2,
            sectionSource: selection.source,
            conductorLabel: conductorLabel(selection.conductor),
            breakerA: breaker.amps,
            breakerSource: breaker.source,
            voltageDropPct: selection.voltageDropPct,
            voltageDropV: (selection.voltageDropPct / 100) * voltageV,
            maxVoltageDropPct: defaults.max_voltage_drop_pct,
            // Se completa más abajo, tras calcular la cascada de alimentadores.
            cumulativeVoltageDropPct: 0,
            status,
            warnings,
        };
    });

    const circuitResultsByPanel = new Map<string, CircuitResult[]>();
    for (const result of circuits) {
        const list = circuitResultsByPanel.get(result.panelId) ?? [];
        list.push(result);
        circuitResultsByPanel.set(result.panelId, list);
    }

    // ── Cable como propiedad del objeto (luminaria/tomacorriente) ──────────
    // Se resuelve DESPUÉS de los circuitos porque hereda su conductor cuando
    // el punto no tiene override propio.
    const circuitResultById = new Map(circuits.map((c) => [c.circuitId, c]));
    const roomLuminairesWithConductor: RoomLuminaireResult[] = roomLuminaires.map((rl) => {
        const docLuminaire = doc.roomLuminaires.find((d) => d.id === rl.roomLuminaireId);
        return {
            ...rl,
            ...resolveObjectConductor(docLuminaire?.circuitId, docLuminaire?.conductorOverrideMm2, circuitResultById, catalogs.conductors),
        };
    });
    const roomOutletsWithConductor: RoomOutletResult[] = roomOutlets.map((ro) => {
        const docOutlet = doc.roomOutlets.find((d) => d.id === ro.roomOutletId);
        return {
            ...ro,
            ...resolveObjectConductor(docOutlet?.circuitId, docOutlet?.conductorOverrideMm2, circuitResultById, catalogs.conductors),
        };
    });

    // ── Tableros (árbol por parentPanelId) ──────────────────────────────────
    const childrenByParent = new Map<string, Panel[]>();
    const panelWarnings = new Map<string, string[]>();
    for (const panel of doc.panels) {
        panelWarnings.set(panel.id, []);
        if (panel.parentPanelId != null) {
            if (!panelsById.has(panel.parentPanelId)) {
                panelWarnings.get(panel.id)?.push(`El tablero padre "${panel.parentPanelId}" no existe; el tablero se trata como raíz.`);
            } else {
                const list = childrenByParent.get(panel.parentPanelId) ?? [];
                list.push(panel);
                childrenByParent.set(panel.parentPanelId, list);
            }
        }
    }

    // Agregación recursiva de potencias con memoización y detección de ciclos.
    const aggregateMemo = new Map<string, { installedPowerW: number; demandPowerW: number }>();
    const aggregate = (panelId: string, stack: Set<string>): { installedPowerW: number; demandPowerW: number } => {
        const memo = aggregateMemo.get(panelId);
        if (memo) {
            return memo;
        }
        if (stack.has(panelId)) {
            // Ciclo detectado: se corta la recursión para no colgar el cálculo.
            panelWarnings.get(panelId)?.push('Se detectó un ciclo en la jerarquía de tableros; se corta la agregación en este punto.');
            return { installedPowerW: 0, demandPowerW: 0 };
        }

        stack.add(panelId);
        const own = circuitResultsByPanel.get(panelId) ?? [];
        let installedPowerW = own.reduce((sum, c) => sum + c.totalPowerW, 0);
        let demandPowerW = own.reduce((sum, c) => sum + c.demandPowerW, 0);
        for (const child of childrenByParent.get(panelId) ?? []) {
            const childTotals = aggregate(child.id, stack);
            installedPowerW += childTotals.installedPowerW;
            demandPowerW += childTotals.demandPowerW;
        }
        stack.delete(panelId);

        const result = { installedPowerW, demandPowerW };
        aggregateMemo.set(panelId, result);
        return result;
    };

    // Profundidad: se sube por la cadena de padres; ciclos y padres perdidos → raíz.
    const depthOf = (panel: Panel): number => {
        let depth = 0;
        const visited = new Set<string>([panel.id]);
        let current = panel;
        while (current.parentPanelId != null) {
            const parent = panelsById.get(current.parentPanelId);
            if (!parent || visited.has(parent.id)) {
                break;
            }
            visited.add(parent.id);
            depth += 1;
            current = parent;
        }
        return depth;
    };

    const panels: PanelResult[] = doc.panels.map((panel) => {
        const warnings = panelWarnings.get(panel.id) ?? [];
        const totals = aggregate(panel.id, new Set());
        const ownCircuits = circuitResultsByPanel.get(panel.id) ?? [];

        const panelVoltage = isPositive(panel.voltageV) ? (panel.voltageV as number) : voltageV;
        const panelPhases: 1 | 3 = panel.phases === 3 ? 3 : panel.phases === 1 ? 1 : phases;

        // La reserva de crecimiento NO suma carga: solo dimensiona el
        // interruptor general (designCurrent·(1+reserva)).
        const currentA = circuitCurrent(totals.demandPowerW, panelVoltage, panelPhases, powerFactor);
        const designCurrentA = currentA * DESIGN_FACTOR;
        const reservePct = isNonNegative(panel.reservePct) ? panel.reservePct : 0;
        const breaker = selectBreaker(designCurrentA * (1 + reservePct / 100), panel.manualMainBreakerA ?? null);

        return {
            panelId: panel.id,
            code: panel.code,
            circuitCount: ownCircuits.length,
            installedPowerW: totals.installedPowerW,
            demandPowerW: totals.demandPowerW,
            currentA,
            designCurrentA,
            mainBreakerA: breaker.amps,
            childPanelIds: (childrenByParent.get(panel.id) ?? []).map((p) => p.id),
            depth: depthOf(panel),
            // Se completa más abajo, tras calcular la cascada de alimentadores.
            cumulativeVoltageDropPct: 0,
            warnings,
        };
    });

    const panelResultsById = new Map(panels.map((p) => [p.panelId, p]));

    // ── Alimentadores ───────────────────────────────────────────────────────
    const { defaults: feederDefaults, found: feederDefaultsFound } = defaultsFor(catalogs, 'feeder', installationCategory);

    const feeders: FeederResult[] = doc.feeders.map((feeder) => {
        const warnings: string[] = [];
        const fromPanel = panelsById.get(feeder.fromPanelId);
        const toPanel = panelsById.get(feeder.toPanelId);
        const toResult = panelResultsById.get(feeder.toPanelId);

        if (!fromPanel) {
            warnings.push(`El tablero de origen "${feeder.fromPanelId}" no existe.`);
        }
        if (!toPanel) {
            warnings.push(`El tablero de destino "${feeder.toPanelId}" no existe; la carga del alimentador resulta 0.`);
        }
        if (!feederDefaultsFound) {
            warnings.push('No hay parámetros por defecto para alimentadores; se usan valores de respaldo.');
        }

        // La carga del alimentador es la demanda del tablero destino (el
        // factor de demanda ya está aplicado en los circuitos del tablero).
        const demandPowerW = toResult?.demandPowerW ?? 0;
        const feederVoltage = isPositive(toPanel?.voltageV) ? (toPanel?.voltageV as number) : voltageV;
        const feederPhases: 1 | 3 = toPanel?.phases === 3 ? 3 : toPanel?.phases === 1 ? 1 : phases;

        const currentA = circuitCurrent(demandPowerW, feederVoltage, feederPhases, powerFactor);
        const designCurrentA = currentA * DESIGN_FACTOR;

        const selection = selectConductor({
            designCurrentA,
            lengthM: feeder.lengthM,
            voltageV: feederVoltage,
            phases: feederPhases,
            minSectionMm2: feederDefaults.min_section_mm2,
            maxVoltageDropPct: feederDefaults.max_voltage_drop_pct,
            conductors: catalogs.conductors,
            manualSectionMm2: feeder.manualSectionMm2 ?? null,
            material: 'cobre',
        });
        warnings.push(...selection.warnings);

        const breaker = selectBreaker(designCurrentA);
        if (selection.conductor && breaker.amps > selection.conductor.ampacity_a) {
            warnings.push(
                `El interruptor de ${breaker.amps} A supera la ampacidad del conductor de ${selection.sectionMm2} mm² (${selection.conductor.ampacity_a} A).`,
            );
        }

        const ampacityFails = selection.conductor === null || selection.conductor.ampacity_a < designCurrentA;
        const dropFails = selection.voltageDropPct > feederDefaults.max_voltage_drop_pct;
        const status: FeederResult['status'] = !toPanel || ampacityFails || dropFails ? 'error' : warnings.length > 0 ? 'advertencia' : 'ok';

        return {
            feederId: feeder.id,
            fromPanelCode: fromPanel?.code ?? feeder.fromPanelId,
            toPanelCode: toPanel?.code ?? feeder.toPanelId,
            demandPowerW,
            currentA,
            designCurrentA,
            sectionMm2: selection.sectionMm2,
            sectionSource: selection.source,
            conductorLabel: conductorLabel(selection.conductor),
            breakerA: breaker.amps,
            voltageDropPct: selection.voltageDropPct,
            // Se completa más abajo, tras calcular la cascada de alimentadores.
            cumulativeVoltageDropPct: 0,
            status,
            warnings,
        };
    });

    // ── Caída de tensión acumulada (cascada tablero → tablero) ──────────────
    //
    // `voltageDropPct` de cada circuito/alimentador es SOLO su propio tramo.
    // Un circuito puede cumplir su límite local y, aun así, recibir una caída
    // real mucho mayor si arrastra la de los tableros aguas arriba (tablero
    // general → tablero de piso → tablero de distribución → circuito). Sin
    // esta acumulación, el sistema no puede detectar ese caso — ver
    // planes/plan_agentes_skills_revision_normativa_dialux.md, hallazgo de
    // Fase 3. `maxTotalVoltageDropPct` (ElectricalSettings) sigue sin un
    // valor normativo confirmado: por eso esta sección SOLO agrega un
    // `warning`/`status: 'error'` cuando el proyecto configura ese límite
    // explícitamente; si no está configurado, el campo numérico se expone
    // igual (es un hecho físico), pero nunca se marca como incumplimiento
    // sin una fuente normativa detrás.
    const feederByEdge = new Map<string, FeederResult>();
    for (const feederDoc of doc.feeders) {
        const feederResult = feeders.find((f) => f.feederId === feederDoc.id);
        if (feederResult) {
            feederByEdge.set(`${feederDoc.fromPanelId}->${feederDoc.toPanelId}`, feederResult);
        }
    }

    const cumulativeDropCache = new Map<string, number>();
    function cumulativeDropAtPanel(panelId: string): number {
        const cached = cumulativeDropCache.get(panelId);
        if (cached !== undefined) {
            return cached;
        }

        let total = 0;
        const visited = new Set<string>([panelId]);
        let current = panelsById.get(panelId);

        while (current && current.parentPanelId != null) {
            const parent = panelsById.get(current.parentPanelId);
            if (!parent || visited.has(parent.id)) {
                // Ciclo o tablero padre inexistente: ya se advirtió en
                // `panelWarnings`; no seguir acumulando más allá de este punto.
                break;
            }
            visited.add(parent.id);
            const edgeFeeder = feederByEdge.get(`${parent.id}->${current.id}`);
            if (edgeFeeder) {
                total += edgeFeeder.voltageDropPct;
            }
            current = parent;
        }

        cumulativeDropCache.set(panelId, total);
        return total;
    }

    for (const panelResult of panels) {
        panelResult.cumulativeVoltageDropPct = cumulativeDropAtPanel(panelResult.panelId);
    }
    for (const feederResult of feeders) {
        const feederDoc = doc.feeders.find((f) => f.id === feederResult.feederId);
        feederResult.cumulativeVoltageDropPct = feederDoc ? cumulativeDropAtPanel(feederDoc.toPanelId) : feederResult.voltageDropPct;
    }

    const maxTotalVoltageDropPct = doc.settings.maxTotalVoltageDropPct;
    for (const circuitResult of circuits) {
        circuitResult.cumulativeVoltageDropPct = cumulativeDropAtPanel(circuitResult.panelId) + circuitResult.voltageDropPct;

        if (isPositive(maxTotalVoltageDropPct) && circuitResult.cumulativeVoltageDropPct > maxTotalVoltageDropPct) {
            circuitResult.warnings.push(
                `La caída de tensión acumulada desde el tablero raíz (${circuitResult.cumulativeVoltageDropPct.toFixed(2)}%) supera el límite total configurado (${maxTotalVoltageDropPct}%).`,
            );
            circuitResult.status = 'error';
        }
    }

    // ── Metrados (take-off) ─────────────────────────────────────────────────
    const takeoff: TakeoffItem[] = [];

    // Luminarias: agrupadas por tipo usado.
    for (const type of doc.luminaireTypes) {
        const qty = roomLuminaires.filter((rl) => rl.luminaireTypeId === type.id).reduce((sum, rl) => sum + rl.selectedQty, 0);
        if (qty <= 0) {
            continue;
        }
        const description = [type.code, type.brand, type.model, `${type.powerW} W`].filter(Boolean).join(' ');
        const unitPrice = isPositive(type.unitPrice) ? (type.unitPrice as number) : null;
        takeoff.push({
            category: 'Luminarias',
            description,
            unit: 'und',
            quantity: qty,
            unitPrice,
            subtotal: unitPrice != null ? qty * unitPrice : null,
        });
    }

    // Tomacorrientes: agrupados por código de tipo.
    const outletQtyByCode = new Map<string, number>();
    for (const ro of roomOutlets) {
        outletQtyByCode.set(ro.outletTypeCode, (outletQtyByCode.get(ro.outletTypeCode) ?? 0) + ro.finalQty);
    }
    for (const [code, qty] of outletQtyByCode) {
        if (qty <= 0) {
            continue;
        }
        const outletType = catalogs.outletTypes.find((t) => t.code.trim().toLowerCase() === code.trim().toLowerCase());
        takeoff.push({
            category: 'Tomacorrientes',
            description: outletType ? `${outletType.name} (${outletType.code})` : `Tomacorriente ${code}`,
            unit: 'und',
            quantity: qty,
            unitPrice: null,
            subtotal: null,
        });
    }

    // Conductores: metros por sección usada en circuitos y alimentadores.
    // Cada tramo lleva fase(s) + neutro + tierra: 3 conductores mono, 4 tri.
    const conductorMeters = new Map<string, { conductor: ConductorCatalog; meters: number }>();
    const addConductorRun = (conductor: ConductorCatalog | null, lengthM: number, runPhases: 1 | 3): void => {
        if (!conductor) {
            return;
        }
        const meters = cableLength(lengthM, wireCountFor(runPhases), reserveFactor);
        if (meters <= 0) {
            return;
        }
        const key = `${conductor.material}-${conductor.section_mm2}-${conductor.insulation}`;
        const entry = conductorMeters.get(key) ?? { conductor, meters: 0 };
        entry.meters += meters;
        conductorMeters.set(key, entry);
    };

    for (const result of circuits) {
        const circuit = circuitsById.get(result.circuitId) as Circuit;
        const conductor = catalogs.conductors.find((c) => c.material === 'cobre' && c.section_mm2 === result.sectionMm2) ?? null;
        addConductorRun(conductor, circuit.lengthM, phases);
    }
    for (const result of feeders) {
        const feeder = doc.feeders.find((f) => f.id === result.feederId);
        const toPanel = feeder ? panelsById.get(feeder.toPanelId) : undefined;
        const runPhases: 1 | 3 = toPanel?.phases === 3 ? 3 : toPanel?.phases === 1 ? 1 : phases;
        const conductor = catalogs.conductors.find((c) => c.material === 'cobre' && c.section_mm2 === result.sectionMm2) ?? null;
        addConductorRun(conductor, feeder?.lengthM ?? 0, runPhases);
    }

    let cableTotalM = 0;
    for (const { conductor, meters } of conductorMeters.values()) {
        cableTotalM += meters;
        const unitPrice = isPositive(conductor.price_per_meter) ? (conductor.price_per_meter as number) : null;
        takeoff.push({
            category: 'Conductores',
            description: `Conductor ${conductorLabel(conductor)}`,
            unit: 'm',
            quantity: meters,
            unitPrice,
            subtotal: unitPrice != null ? meters * unitPrice : null,
        });
    }

    // Protecciones: interruptores agrupados por polos×amperaje.
    const breakerQty = new Map<string, { poles: number; amps: number; qty: number }>();
    const addBreaker = (poles: number, amps: number): void => {
        if (!isPositive(amps)) {
            return;
        }
        const key = `${poles}x${amps}`;
        const entry = breakerQty.get(key) ?? { poles, amps, qty: 0 };
        entry.qty += 1;
        breakerQty.set(key, entry);
    };
    for (const result of circuits) {
        const { defaults } = defaultsFor(catalogs, result.type, installationCategory);
        addBreaker(defaults.breaker_poles, result.breakerA);
    }
    for (const result of feeders) {
        const feeder = doc.feeders.find((f) => f.id === result.feederId);
        const toPanel = feeder ? panelsById.get(feeder.toPanelId) : undefined;
        const runPhases: 1 | 3 = toPanel?.phases === 3 ? 3 : toPanel?.phases === 1 ? 1 : phases;
        addBreaker(runPhases === 3 ? 3 : 2, result.breakerA);
    }
    for (const result of panels) {
        const panel = panelsById.get(result.panelId);
        const panelPhases: 1 | 3 = panel?.phases === 3 ? 3 : panel?.phases === 1 ? 1 : phases;
        addBreaker(panelPhases === 3 ? 3 : 2, result.mainBreakerA);
    }
    for (const { poles, amps, qty } of breakerQty.values()) {
        takeoff.push({
            category: 'Protecciones',
            description: `ITM ${poles}x${amps} A`,
            unit: 'und',
            quantity: qty,
            unitPrice: null,
            subtotal: null,
        });
    }

    // Tableros: un ítem por tablero.
    for (const panel of doc.panels) {
        takeoff.push({
            category: 'Tableros',
            description: `Tablero ${panel.code}${panel.name ? ` ${panel.name}` : ''}`,
            unit: 'und',
            quantity: 1,
            unitPrice: null,
            subtotal: null,
        });
    }

    // ── Totales ─────────────────────────────────────────────────────────────
    // La potencia global sale de los tableros raíz (los ciclos quedan fuera,
    // ya advertidos en sus tableros). Sin tableros, se suman los circuitos.
    const rootPanels = panels.filter((p) => {
        const panel = panelsById.get(p.panelId);
        return panel != null && (panel.parentPanelId == null || !panelsById.has(panel.parentPanelId));
    });
    const installedPowerW =
        doc.panels.length > 0
            ? rootPanels.reduce((sum, p) => sum + p.installedPowerW, 0)
            : circuits.reduce((sum, c) => sum + c.totalPowerW, 0);
    const demandPowerW =
        doc.panels.length > 0 ? rootPanels.reduce((sum, p) => sum + p.demandPowerW, 0) : circuits.reduce((sum, c) => sum + c.demandPowerW, 0);

    const subtotals = takeoff.filter((item) => item.subtotal != null).map((item) => item.subtotal as number);

    return {
        roomGeometry,
        roomLuminaires: roomLuminairesWithConductor,
        roomOutlets: roomOutletsWithConductor,
        circuits,
        panels,
        feeders,
        takeoff,
        totals: {
            rooms: doc.rooms.length,
            luminaires: roomLuminaires.reduce((sum, rl) => sum + rl.selectedQty, 0),
            outlets: roomOutlets.reduce((sum, ro) => sum + ro.finalQty, 0),
            panels: doc.panels.length,
            installedPowerW,
            demandPowerW,
            cableTotalM,
            takeoffTotal: subtotals.length > 0 ? subtotals.reduce((sum, s) => sum + s, 0) : null,
        },
    };
}
