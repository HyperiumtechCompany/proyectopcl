/**
 * Cobertura de la caída de tensión ACUMULADA en cascada a través del árbol
 * de tableros (Fase 3 de planes/plan_agentes_skills_revision_normativa_dialux.md).
 *
 * Antes de esta cobertura, `computeElectricalDerived` solo validaba la caída
 * de cada alimentador/circuito contra su propio tramo local. Un circuito
 * final podía mostrarse "ok" mientras la caída real acumulada desde el
 * tablero general (sumando todos los tramos intermedios) ya era excesiva,
 * sin que nada en el motor lo detectara.
 */
import { describe, expect, it } from 'vitest';
import { computeElectricalDerived } from './compute';
import { voltageDropPct } from './formulas';
import type { Circuit, ConductorCatalog, ElectricalCatalogs, ElectricalDocument, Feeder, Panel } from './types';

const CONDUCTORS: ConductorCatalog[] = [
    { id: 1, user_id: null, material: 'cobre', section_mm2: 2.5, awg_ref: '14', insulation: 'THW-90', ampacity_a: 20, price_per_meter: null },
    { id: 2, user_id: null, material: 'cobre', section_mm2: 6, awg_ref: '10', insulation: 'THW-90', ampacity_a: 35, price_per_meter: null },
    { id: 3, user_id: null, material: 'cobre', section_mm2: 10, awg_ref: '8', insulation: 'THW-90', ampacity_a: 50, price_per_meter: null },
];

const CATALOGS: ElectricalCatalogs = {
    outletRules: [],
    outletTypes: [],
    conductors: CONDUCTORS,
    circuitDefaults: [
        { id: 1, user_id: null, circuit_type: 'lighting', installation_category: 'residencial', min_section_mm2: 2.5, max_voltage_drop_pct: 2.5, demand_factor: 1, breaker_poles: 2 },
        { id: 2, user_id: null, circuit_type: 'feeder', installation_category: 'residencial', min_section_mm2: 6, max_voltage_drop_pct: 2.5, demand_factor: 1, breaker_poles: 2 },
    ],
};

/** Tres tableros en cadena: TG (raíz) → TP (piso) → TD (distribución), con un circuito final en TD. */
function buildThreeTierDoc(overrides: Partial<ElectricalDocument['settings']> = {}): ElectricalDocument {
    const panels: Panel[] = [
        { id: 'tg', floorId: null, parentPanelId: null, code: 'TG-01', name: 'Tablero General', reservePct: 0 },
        { id: 'tp', floorId: null, parentPanelId: 'tg', code: 'TP-02', name: 'Tablero Piso 2', reservePct: 0 },
        { id: 'td', floorId: null, parentPanelId: 'tp', code: 'TD-03', name: 'Tablero Distrib. 3', reservePct: 0 },
    ];
    // Recorridos largos, habituales entre tablero general y tablero de
    // distribución en un edificio de varios pisos (industrial/educativo).
    const feeders: Feeder[] = [
        { id: 'f-tg-tp', fromPanelId: 'tg', toPanelId: 'tp', lengthM: 50 },
        { id: 'f-tp-td', fromPanelId: 'tp', toPanelId: 'td', lengthM: 50 },
    ];
    const circuits: Circuit[] = [{ id: 'c1', panelId: 'td', code: 'C1', type: 'lighting', lengthM: 20, manualSectionMm2: 2.5 }];

    return {
        version: 1,
        settings: {
            voltageV: 220,
            phases: 1,
            frequencyHz: 60,
            powerFactor: 0.9,
            referenceStandard: 'CNE',
            cableReserveFactor: 1.1,
            installationCategory: 'residencial',
            ...overrides,
        },
        floors: [{ id: 'f1', name: 'Piso', level: 1 }],
        rooms: [
            {
                id: 'room1', floorId: 'f1', name: 'Aula', roomType: 'aula',
                lengthM: 8, widthM: 5, heightM: 3,
                requiredLux: 300, utilizationFactor: 0.6, maintenanceFactor: 0.8,
            },
        ],
        // Potencia elegida para que la corriente de diseño (×1.25) sea 15A,
        // suficiente para producir una caída no trivial en tramos largos.
        luminaireTypes: [{ id: 'L1', code: 'L1', powerW: 2376, lumens: 20000 }],
        roomLuminaires: [{ id: 'rl1', roomId: 'room1', luminaireTypeId: 'L1', manualQty: 1, circuitId: 'c1' }],
        roomOutlets: [],
        circuits,
        panels,
        feeders,
    };
}

describe('cumulativeVoltageDropPct — cascada tablero → tablero', () => {
    it('acumula la caída de TODOS los tramos aguas arriba, no solo el tramo local del circuito', () => {
        const doc = buildThreeTierDoc();
        const result = computeElectricalDerived(doc, CATALOGS);

        const feederTgTp = result.feeders.find((f) => f.feederId === 'f-tg-tp')!;
        const feederTpTd = result.feeders.find((f) => f.feederId === 'f-tp-td')!;
        const circuit = result.circuits[0]!;

        // El tablero raíz no tiene caída acumulada (nada aguas arriba).
        const tgPanel = result.panels.find((p) => p.panelId === 'tg')!;
        expect(tgPanel.cumulativeVoltageDropPct).toBe(0);

        // El primer alimentador acumula exactamente su propio tramo.
        expect(feederTgTp.cumulativeVoltageDropPct).toBeCloseTo(feederTgTp.voltageDropPct, 6);

        // El segundo alimentador acumula el suyo MÁS el del primero.
        expect(feederTpTd.cumulativeVoltageDropPct).toBeCloseTo(
            feederTgTp.voltageDropPct + feederTpTd.voltageDropPct,
            6,
        );

        // El circuito final acumula los dos alimentadores más su propio tramo:
        // esto es lo que un instalador mediría con un voltímetro en la salida.
        const expectedCumulative = feederTgTp.voltageDropPct + feederTpTd.voltageDropPct + circuit.voltageDropPct;
        expect(circuit.cumulativeVoltageDropPct).toBeCloseTo(expectedCumulative, 6);

        // Caso ya confirmado en el análisis de Fase 3: cada tramo individual
        // cumple su límite local (2.5%) pero el acumulado real lo excede
        // ampliamente cuando el recorrido es largo (edificio de varios pisos).
        expect(feederTgTp.voltageDropPct).toBeLessThan(2.5);
        expect(feederTpTd.voltageDropPct).toBeLessThan(2.5);
        expect(circuit.voltageDropPct).toBeLessThan(2.5);
        expect(circuit.cumulativeVoltageDropPct).toBeGreaterThan(4);
    });

    it('sin maxTotalVoltageDropPct configurado: el valor se calcula igual pero NO se marca como error (pending-confirmation)', () => {
        const doc = buildThreeTierDoc(); // sin maxTotalVoltageDropPct
        const result = computeElectricalDerived(doc, CATALOGS);
        const circuit = result.circuits[0]!;

        expect(circuit.cumulativeVoltageDropPct).toBeGreaterThan(0);
        expect(circuit.status).not.toBe('error');
        expect(circuit.warnings.some((w) => w.includes('acumulada'))).toBe(false);
    });

    it('con maxTotalVoltageDropPct configurado y excedido: marca error y advierte con el límite citado', () => {
        const doc = buildThreeTierDoc({ maxTotalVoltageDropPct: 4 });
        const result = computeElectricalDerived(doc, CATALOGS);
        const circuit = result.circuits[0]!;

        expect(circuit.cumulativeVoltageDropPct).toBeGreaterThan(4);
        expect(circuit.status).toBe('error');
        expect(circuit.warnings.some((w) => w.includes('4%'))).toBe(true);
    });

    it('con maxTotalVoltageDropPct configurado holgado: no marca error', () => {
        const doc = buildThreeTierDoc({ maxTotalVoltageDropPct: 10 });
        const result = computeElectricalDerived(doc, CATALOGS);
        const circuit = result.circuits[0]!;

        expect(circuit.status).not.toBe('error');
    });

    it('un tablero de un solo nivel (sin padre) no acumula nada', () => {
        const doc: ElectricalDocument = {
            ...buildThreeTierDoc(),
            panels: [{ id: 'tg', floorId: null, parentPanelId: null, code: 'TG-01', name: 'Tablero General', reservePct: 0 }],
            feeders: [],
            circuits: [{ id: 'c1', panelId: 'tg', code: 'C1', type: 'lighting', lengthM: 10, manualSectionMm2: 2.5 }],
        };
        const result = computeElectricalDerived(doc, CATALOGS);
        const circuit = result.circuits[0]!;
        expect(circuit.cumulativeVoltageDropPct).toBeCloseTo(circuit.voltageDropPct, 6);
    });

    it('protege contra ciclos en la jerarquía de tableros (no entra en loop infinito)', () => {
        // Jerarquía corrupta: tg->tp->td->tg (ciclo). No debe colgarse ni lanzar.
        const doc: ElectricalDocument = {
            ...buildThreeTierDoc(),
            panels: [
                { id: 'tg', floorId: null, parentPanelId: 'td', code: 'TG-01', name: 'Tablero General', reservePct: 0 },
                { id: 'tp', floorId: null, parentPanelId: 'tg', code: 'TP-02', name: 'Tablero Piso 2', reservePct: 0 },
                { id: 'td', floorId: null, parentPanelId: 'tp', code: 'TD-03', name: 'Tablero Distrib. 3', reservePct: 0 },
            ],
        };

        expect(() => computeElectricalDerived(doc, CATALOGS)).not.toThrow();
    });

    it('referencia cruzada: el cálculo manual con voltageDropPct coincide con el motor completo', () => {
        // Verifica que el motor use la misma fórmula pura que el resto del
        // sistema (ninguna lógica de acumulación duplicada/divergente).
        const doc = buildThreeTierDoc();
        const result = computeElectricalDerived(doc, CATALOGS);
        const circuit = result.circuits[0]!;

        const manualCircuitDrop = voltageDropPct(circuit.designCurrentA, 20, 2.5, 220, 1, 'cobre');
        expect(circuit.voltageDropPct).toBeCloseTo(manualCircuitDrop, 6);
    });
});
