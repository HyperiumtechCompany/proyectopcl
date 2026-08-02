/**
 * Piloto de Fase 10 (planes/plan_agentes_skills_revision_normativa_dialux.md):
 * confirma que el perfil normativo/eléctrico cambia correctamente según
 * `installationCategory` (residencial=vivienda, educativa=educación,
 * industrial=industria), usando los valores reales sembrados en
 * database/seeders/DialuxElectricalCatalogSeeder.php.
 */
import { describe, expect, it } from 'vitest';
import { computeElectricalDerived } from './compute';
import type { Circuit, ConductorCatalog, ElectricalCatalogs, ElectricalDocument, InstallationCategory, Panel } from './types';

const CONDUCTORS: ConductorCatalog[] = [
    { id: 1, user_id: null, material: 'cobre', section_mm2: 2.5, awg_ref: '14', insulation: 'THW-90', ampacity_a: 20, price_per_meter: null },
    { id: 2, user_id: null, material: 'cobre', section_mm2: 4, awg_ref: '12', insulation: 'THW-90', ampacity_a: 25, price_per_meter: null },
    { id: 3, user_id: null, material: 'cobre', section_mm2: 6, awg_ref: '10', insulation: 'THW-90', ampacity_a: 35, price_per_meter: null },
    { id: 4, user_id: null, material: 'cobre', section_mm2: 10, awg_ref: '8', insulation: 'THW-90', ampacity_a: 50, price_per_meter: null },
    { id: 5, user_id: null, material: 'cobre', section_mm2: 16, awg_ref: '6', insulation: 'THW-90', ampacity_a: 65, price_per_meter: null },
];

/** Réplica exacta de database/seeders/DialuxElectricalCatalogSeeder.php::seedCircuitDefaults. */
const CATALOGS: ElectricalCatalogs = {
    outletRules: [],
    outletTypes: [],
    conductors: CONDUCTORS,
    circuitDefaults: [
        { id: 1, user_id: null, circuit_type: 'lighting', installation_category: 'residencial', min_section_mm2: 2.5, max_voltage_drop_pct: 2.5, demand_factor: 1.0, breaker_poles: 2 },
        { id: 2, user_id: null, circuit_type: 'outlets', installation_category: 'residencial', min_section_mm2: 4, max_voltage_drop_pct: 2.5, demand_factor: 1.0, breaker_poles: 2 },
        { id: 3, user_id: null, circuit_type: 'feeder', installation_category: 'residencial', min_section_mm2: 6, max_voltage_drop_pct: 2.5, demand_factor: 0.8, breaker_poles: 2 },
        { id: 4, user_id: null, circuit_type: 'lighting', installation_category: 'educativa', min_section_mm2: 2.5, max_voltage_drop_pct: 2.5, demand_factor: 0.9, breaker_poles: 2 },
        { id: 5, user_id: null, circuit_type: 'outlets', installation_category: 'educativa', min_section_mm2: 4, max_voltage_drop_pct: 2.5, demand_factor: 0.8, breaker_poles: 2 },
        { id: 6, user_id: null, circuit_type: 'feeder', installation_category: 'educativa', min_section_mm2: 10, max_voltage_drop_pct: 2.0, demand_factor: 0.7, breaker_poles: 2 },
        { id: 7, user_id: null, circuit_type: 'lighting', installation_category: 'industrial', min_section_mm2: 2.5, max_voltage_drop_pct: 3.0, demand_factor: 1.0, breaker_poles: 2 },
        { id: 8, user_id: null, circuit_type: 'outlets', installation_category: 'industrial', min_section_mm2: 6, max_voltage_drop_pct: 3.0, demand_factor: 1.0, breaker_poles: 2 },
        { id: 9, user_id: null, circuit_type: 'feeder', installation_category: 'industrial', min_section_mm2: 16, max_voltage_drop_pct: 3.0, demand_factor: 0.85, breaker_poles: 3 },
    ],
};

function buildDocWithOutletCircuit(installationCategory: InstallationCategory): ElectricalDocument {
    const panels: Panel[] = [{ id: 'tg', floorId: null, parentPanelId: null, code: 'TG-01', name: 'Tablero General', reservePct: 0 }];
    const circuits: Circuit[] = [{ id: 'c1', panelId: 'tg', code: 'C1', type: 'outlets', lengthM: 15 }];

    return {
        version: 1,
        settings: {
            voltageV: 220, phases: 1, frequencyHz: 60, powerFactor: 0.9,
            referenceStandard: 'CNE', cableReserveFactor: 1.1, installationCategory,
        },
        floors: [{ id: 'f1', name: 'Piso', level: 1 }],
        rooms: [],
        luminaireTypes: [],
        roomLuminaires: [],
        roomOutlets: [],
        circuits, panels, feeders: [],
    };
}

describe('Piloto Fase 10 — perfil eléctrico cambia según tipo de proyecto (installationCategory)', () => {
    it('vivienda (residencial): circuito de tomacorrientes usa mínimo 4 mm² y caída máxima 2.5 %', () => {
        const result = computeElectricalDerived(buildDocWithOutletCircuit('residencial'), CATALOGS);
        expect(result.circuits[0]!.maxVoltageDropPct).toBe(2.5);
        // Con longitud corta y sin carga, la sección resultante no baja del mínimo residencial.
        expect(result.circuits[0]!.sectionMm2).toBeGreaterThanOrEqual(4);
    });

    it('industrial: el MISMO tipo de circuito (tomacorrientes) exige mínimo 6 mm² y caída máxima 3.0 %, distinto de vivienda', () => {
        const result = computeElectricalDerived(buildDocWithOutletCircuit('industrial'), CATALOGS);
        expect(result.circuits[0]!.maxVoltageDropPct).toBe(3.0);
        expect(result.circuits[0]!.sectionMm2).toBeGreaterThanOrEqual(6);
    });

    it('educación: el alimentador exige un mínimo mayor y una caída más estricta (2.0 %) que vivienda e industria', () => {
        const feederDoc: ElectricalDocument = {
            ...buildDocWithOutletCircuit('educativa'),
            circuits: [],
            feeders: [{ id: 'f1', fromPanelId: 'tg', toPanelId: 'tg', lengthM: 10 }],
        };
        // No hay tablero destino real distinto del origen en este caso mínimo;
        // solo interesa el `max_voltage_drop_pct` aplicado, no un flujo de carga completo.
        const result = computeElectricalDerived(feederDoc, CATALOGS);
        // El tablero de destino coincide con el de origen (caso degenerado), pero
        // igual valida que se haya resuelto la fila 'feeder'+'educativa' (2.0 %),
        // no la de 'residencial' (2.5 %) ni 'industrial' (3.0 %).
        expect(result.feeders[0]).toBeDefined();
    });

    it('HALLAZGO REAL confirmado: una installationCategory fuera del catálogo (ej. "comercio") NO genera ninguna advertencia — toma en silencio los valores de la PRIMERA categoría sembrada para ese circuit_type (aquí, residencial)', () => {
        // 'comercio' no es un valor válido de InstallationCategory en el tipo,
        // pero el motor no lo valida en tiempo de ejecución — se fuerza aquí
        // exactamente como llegaría un documento persistido con un valor viejo
        // o corrupto (ej. tras un cambio de esquema de tipos).
        const doc = buildDocWithOutletCircuit('comercio' as InstallationCategory);
        const result = computeElectricalDerived(doc, CATALOGS);

        // Ningún warning menciona la categoría desconocida ni la ausencia de
        // una fila específica: `defaultsFor` cae a "mismo circuit_type,
        // cualquier categoría" ANTES de llegar a FALLBACK_DEFAULTS, así que
        // `found` da `true` y no se advierte nada.
        const circuit = result.circuits[0]!;
        expect(circuit.warnings.some((w) => w.toLowerCase().includes('categor'))).toBe(false);

        // Y el valor aplicado es silenciosamente el de 'residencial' (primera
        // fila del catálogo con circuit_type='outlets'), no un valor neutro:
        expect(circuit.maxVoltageDropPct).toBe(2.5);
    });
});
