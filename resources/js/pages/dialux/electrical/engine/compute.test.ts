/**
 * Tests del cálculo derivado completo (computeElectricalDerived).
 * Los catálogos mock replican la data del seeder del backend.
 */

import { describe, expect, it } from 'vitest';
import { computeElectricalDerived } from './compute';
import type {
    Circuit,
    ConductorCatalog,
    ElectricalCatalogs,
    ElectricalDocument,
    ElectricalRoom,
    LuminaireType,
    OutletRule,
    Panel,
    RoomLuminaire,
    RoomOutletGroup,
} from './types';

// ─── Catálogos mock (misma data del seeder) ──────────────────────────────────

let conductorId = 0;
function cu(section_mm2: number, ampacity_a: number, awg_ref: string, price_per_meter: number | null = null): ConductorCatalog {
    conductorId += 1;
    return { id: conductorId, user_id: null, material: 'cobre', section_mm2, awg_ref, insulation: 'THW-90', ampacity_a, price_per_meter };
}

const CONDUCTORS: ConductorCatalog[] = [
    cu(2.5, 20, '14', 2.5),
    cu(4, 25, '12', 3.5),
    cu(6, 35, '10', 5),
    cu(10, 50, '8'),
    cu(16, 65, '6'),
    cu(25, 85, '4'),
    cu(35, 100, '2'),
    cu(50, 125, '1/0'),
    cu(70, 160, '2/0'),
];

const OUTLET_RULES: OutletRule[] = [
    { id: 1, user_id: null, room_type: 'aula', method: 'area', value: 10, unit: 'm2_per_point', power_per_outlet_va: 180 },
    { id: 2, user_id: null, room_type: 'comedor', method: 'area', value: 15, unit: 'm2_per_point', power_per_outlet_va: 180 },
    { id: 3, user_id: null, room_type: 'exterior', method: 'perimeter', value: 9, unit: 'm_per_point', power_per_outlet_va: 180 },
];

const CATALOGS: ElectricalCatalogs = {
    outletRules: OUTLET_RULES,
    outletTypes: [{ id: 1, user_id: null, code: 'TOM-01', name: 'Tomacorriente doble con tierra', height_m: 0.4 }],
    conductors: CONDUCTORS,
    circuitDefaults: [
        { id: 1, user_id: null, circuit_type: 'lighting', installation_category: 'residencial', min_section_mm2: 2.5, max_voltage_drop_pct: 2.5, demand_factor: 1, breaker_poles: 2 },
        { id: 2, user_id: null, circuit_type: 'outlets', installation_category: 'residencial', min_section_mm2: 4, max_voltage_drop_pct: 2.5, demand_factor: 1, breaker_poles: 2 },
        { id: 3, user_id: null, circuit_type: 'feeder', installation_category: 'residencial', min_section_mm2: 6, max_voltage_drop_pct: 2.5, demand_factor: 0.8, breaker_poles: 2 },
        { id: 4, user_id: null, circuit_type: 'special', installation_category: 'residencial', min_section_mm2: 4, max_voltage_drop_pct: 2.5, demand_factor: 1, breaker_poles: 2 },
        // Industrial: mínimos más altos, usados en los tests de categoría de instalación.
        { id: 5, user_id: null, circuit_type: 'lighting', installation_category: 'industrial', min_section_mm2: 2.5, max_voltage_drop_pct: 3, demand_factor: 1, breaker_poles: 2 },
        { id: 6, user_id: null, circuit_type: 'outlets', installation_category: 'industrial', min_section_mm2: 6, max_voltage_drop_pct: 3, demand_factor: 1, breaker_poles: 2 },
        { id: 7, user_id: null, circuit_type: 'feeder', installation_category: 'industrial', min_section_mm2: 16, max_voltage_drop_pct: 3, demand_factor: 0.85, breaker_poles: 3 },
        { id: 8, user_id: null, circuit_type: 'special', installation_category: 'industrial', min_section_mm2: 10, max_voltage_drop_pct: 3, demand_factor: 1, breaker_poles: 3 },
    ],
};

// ─── Builders de documento ───────────────────────────────────────────────────

function makeDoc(overrides: Partial<ElectricalDocument> = {}): ElectricalDocument {
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
        },
        floors: [{ id: 'f1', name: 'Primer piso', level: 1 }],
        rooms: [],
        luminaireTypes: [],
        roomLuminaires: [],
        roomOutlets: [],
        circuits: [],
        panels: [],
        feeders: [],
        ...overrides,
    };
}

function makeRoom(overrides: Partial<ElectricalRoom> & { id: string }): ElectricalRoom {
    return {
        floorId: 'f1',
        name: overrides.id,
        roomType: 'aula',
        lengthM: 8,
        widthM: 5,
        heightM: 3,
        requiredLux: 300,
        utilizationFactor: 0.6,
        maintenanceFactor: 0.8,
        ...overrides,
    };
}

function makeLuminaireType(overrides: Partial<LuminaireType> & { id: string }): LuminaireType {
    return { code: overrides.id, powerW: 36, lumens: 3600, ...overrides };
}

function makeRoomLuminaire(overrides: Partial<RoomLuminaire> & { id: string; roomId: string; luminaireTypeId: string }): RoomLuminaire {
    return { manualQty: null, ...overrides };
}

function makeOutletGroup(overrides: Partial<RoomOutletGroup> & { id: string; roomId: string }): RoomOutletGroup {
    return { outletTypeCode: 'TOM-01', manualQty: null, extraQty: 0, ...overrides };
}

function makeCircuit(overrides: Partial<Circuit> & { id: string; panelId: string }): Circuit {
    return { code: overrides.id, type: 'lighting', lengthM: 25, ...overrides };
}

function makePanel(overrides: Partial<Panel> & { id: string }): Panel {
    return { parentPanelId: null, code: overrides.id, name: overrides.id, reservePct: 0, ...overrides };
}

/** Proyecto completo: aula con luminarias (Caso A), tomacorrientes, TG→TP y alimentador. */
function makeFullDoc(): ElectricalDocument {
    return makeDoc({
        rooms: [
            makeRoom({ id: 'r1', name: 'Aula 101', lengthM: 8, widthM: 5 }), // 40 m²
            makeRoom({ id: 'r2', name: 'Aula 102', lengthM: 8, widthM: 6, requiredLux: 0 }), // 48 m²
            makeRoom({ id: 'r3', name: 'Comedor', roomType: 'comedor', lengthM: 12, widthM: 6, requiredLux: 0 }), // 72 m²
            makeRoom({ id: 'r4', name: 'Patio', roomType: 'Exterior', lengthM: 20, widthM: 5, requiredLux: 0 }), // perímetro 50 m
        ],
        luminaireTypes: [makeLuminaireType({ id: 'lt1', code: 'LUM-A', brand: 'Philips', model: 'CoreLine', unitPrice: 180 })],
        roomLuminaires: [makeRoomLuminaire({ id: 'rl1', roomId: 'r1', luminaireTypeId: 'lt1', circuitId: 'c1' })],
        roomOutlets: [
            makeOutletGroup({ id: 'o1', roomId: 'r2', circuitId: 'c2' }),
            makeOutletGroup({ id: 'o2', roomId: 'r3' }),
            makeOutletGroup({ id: 'o3', roomId: 'r4' }),
        ],
        circuits: [
            makeCircuit({ id: 'c1', panelId: 'tg', code: 'C-1', type: 'lighting', lengthM: 25 }),
            makeCircuit({ id: 'c2', panelId: 'tp', code: 'C-2', type: 'outlets', lengthM: 18 }),
        ],
        panels: [makePanel({ id: 'tg', code: 'TG-01', reservePct: 25 }), makePanel({ id: 'tp', code: 'TP-01', parentPanelId: 'tg' })],
        feeders: [{ id: 'fd1', fromPanelId: 'tg', toPanelId: 'tp', lengthM: 20 }],
    });
}

// ─── Geometría ───────────────────────────────────────────────────────────────

describe('roomGeometry', () => {
    it('calcula área y perímetro desde largo×ancho', () => {
        const derived = computeElectricalDerived(makeFullDoc(), CATALOGS);
        expect(derived.roomGeometry.r1).toEqual({ areaM2: 40, perimeterM: 26 });
        expect(derived.roomGeometry.r4).toEqual({ areaM2: 100, perimeterM: 50 });
    });

    it('respeta los overrides del plano CAD', () => {
        const doc = makeDoc({ rooms: [makeRoom({ id: 'r1', areaOverrideM2: 48.5, perimeterOverrideM: 31 })] });
        const derived = computeElectricalDerived(doc, CATALOGS);
        expect(derived.roomGeometry.r1).toEqual({ areaM2: 48.5, perimeterM: 31 });
    });

    it('dimensiones inválidas producen 0 (nunca NaN)', () => {
        const doc = makeDoc({ rooms: [makeRoom({ id: 'r1', lengthM: -8, widthM: Number.NaN })] });
        const derived = computeElectricalDerived(doc, CATALOGS);
        expect(derived.roomGeometry.r1).toEqual({ areaM2: 0, perimeterM: 0 });
    });
});

// ─── Luminarias ──────────────────────────────────────────────────────────────

describe('roomLuminaires', () => {
    it('Caso A: aula de 40 m² a 300 lux con 3600 lm → 7 luminarias, ≈302.4 lux, cumple', () => {
        const derived = computeElectricalDerived(makeFullDoc(), CATALOGS);
        const result = derived.roomLuminaires.find((rl) => rl.roomLuminaireId === 'rl1');
        expect(result).toBeDefined();
        expect(result?.minQty).toBe(7);
        expect(result?.selectedQty).toBe(7);
        expect(result?.estimatedLux).toBeCloseTo(302.4, 3);
        expect(result?.status).toBe('cumple');
        expect(result?.compliancePct).toBeCloseTo(100.8, 3);
        expect(result?.totalPowerW).toBe(252);
        // Grilla sugerida para 7: 3 columnas × 3 filas.
        expect(result?.suggestedCols).toBe(3);
        expect(result?.suggestedRows).toBe(3);
        expect(result?.warnings).toEqual([]);
    });

    it('Caso B: 4 grandes y 8 medianas cumplen; 12 pequeñas quedan en advertencia', () => {
        // Mismo ambiente (40 m², 450 lux, CU 0.6, FM 0.8) con tres alternativas.
        const doc = makeDoc({
            rooms: [makeRoom({ id: 'r1', requiredLux: 450 })],
            luminaireTypes: [
                makeLuminaireType({ id: 'g', code: 'GRANDE', lumens: 10000, powerW: 100 }),
                makeLuminaireType({ id: 'm', code: 'MEDIANA', lumens: 5000, powerW: 50 }),
                makeLuminaireType({ id: 'p', code: 'PEQUENA', lumens: 3000, powerW: 30 }),
            ],
            roomLuminaires: [
                makeRoomLuminaire({ id: 'rlg', roomId: 'r1', luminaireTypeId: 'g', manualQty: 4 }),
                makeRoomLuminaire({ id: 'rlm', roomId: 'r1', luminaireTypeId: 'm', manualQty: 8 }),
                makeRoomLuminaire({ id: 'rlp', roomId: 'r1', luminaireTypeId: 'p', manualQty: 12 }),
            ],
        });
        const derived = computeElectricalDerived(doc, CATALOGS);
        const byId = new Map(derived.roomLuminaires.map((rl) => [rl.roomLuminaireId, rl]));

        // 4×10000 lm → 480 lux (106.7 %) y 8×5000 lm → 480 lux: cumplen.
        expect(byId.get('rlg')?.estimatedLux).toBeCloseTo(480, 3);
        expect(byId.get('rlg')?.status).toBe('cumple');
        expect(byId.get('rlm')?.estimatedLux).toBeCloseTo(480, 3);
        expect(byId.get('rlm')?.status).toBe('cumple');
        // 12×3000 lm → 432 lux (96 %): advertencia.
        expect(byId.get('rlp')?.estimatedLux).toBeCloseTo(432, 3);
        expect(byId.get('rlp')?.status).toBe('advertencia');
    });

    it('la cantidad manual manda sobre la mínima y puede generar no_cumple con warning', () => {
        const doc = makeDoc({
            rooms: [makeRoom({ id: 'r1' })],
            luminaireTypes: [makeLuminaireType({ id: 'lt1' })],
            roomLuminaires: [makeRoomLuminaire({ id: 'rl1', roomId: 'r1', luminaireTypeId: 'lt1', manualQty: 3 })],
        });
        const result = computeElectricalDerived(doc, CATALOGS).roomLuminaires[0];
        expect(result.minQty).toBe(7);
        expect(result.selectedQty).toBe(3);
        expect(result.status).toBe('no_cumple');
        expect(result.warnings.some((w) => w.includes('No cumple'))).toBe(true);
    });

    it('respeta filas/columnas manuales solo si ambas son > 0', () => {
        const doc = makeDoc({
            rooms: [makeRoom({ id: 'r1' })],
            luminaireTypes: [makeLuminaireType({ id: 'lt1' })],
            roomLuminaires: [
                makeRoomLuminaire({ id: 'rl1', roomId: 'r1', luminaireTypeId: 'lt1', manualQty: 8, rows: 2, cols: 4 }),
                makeRoomLuminaire({ id: 'rl2', roomId: 'r1', luminaireTypeId: 'lt1', manualQty: 8, rows: 2, cols: 0 }),
            ],
        });
        const derived = computeElectricalDerived(doc, CATALOGS);
        expect(derived.roomLuminaires[0].suggestedRows).toBe(2);
        expect(derived.roomLuminaires[0].suggestedCols).toBe(4);
        // cols inválidas → grilla sugerida automática (8 → 3×3).
        expect(derived.roomLuminaires[1].suggestedCols).toBe(3);
        expect(derived.roomLuminaires[1].suggestedRows).toBe(3);
    });

    it('área 0 y flujo 0 producen 0 con warnings (nunca NaN)', () => {
        const doc = makeDoc({
            rooms: [makeRoom({ id: 'r1', lengthM: 0 }), makeRoom({ id: 'r2' })],
            luminaireTypes: [makeLuminaireType({ id: 'lt1' }), makeLuminaireType({ id: 'lt0', lumens: 0 })],
            roomLuminaires: [
                makeRoomLuminaire({ id: 'rl1', roomId: 'r1', luminaireTypeId: 'lt1' }),
                makeRoomLuminaire({ id: 'rl2', roomId: 'r2', luminaireTypeId: 'lt0' }),
            ],
        });
        const derived = computeElectricalDerived(doc, CATALOGS);
        const [byArea, byLumens] = derived.roomLuminaires;
        expect(byArea.minQty).toBe(0);
        expect(byArea.estimatedLux).toBe(0);
        expect(byArea.warnings.some((w) => w.includes('área inválida'))).toBe(true);
        expect(byLumens.minQty).toBe(0);
        expect(byLumens.warnings.some((w) => w.includes('flujo luminoso'))).toBe(true);
        expect(Number.isFinite(byArea.compliancePct)).toBe(true);
    });

    it('ambiente o tipo inexistente genera warning sin romper el cálculo', () => {
        const doc = makeDoc({
            luminaireTypes: [makeLuminaireType({ id: 'lt1' })],
            roomLuminaires: [makeRoomLuminaire({ id: 'rl1', roomId: 'fantasma', luminaireTypeId: 'lt-fantasma' })],
        });
        const result = computeElectricalDerived(doc, CATALOGS).roomLuminaires[0];
        expect(result.selectedQty).toBe(0);
        expect(result.totalPowerW).toBe(0);
        expect(result.warnings.some((w) => w.includes('no existe'))).toBe(true);
    });
});

// ─── Tomacorrientes ──────────────────────────────────────────────────────────

describe('roomOutlets', () => {
    it('aula 48 m² regla 10 → 5; comedor 72 m² regla 15 → 5; exterior 50 m regla 9 → 6', () => {
        const derived = computeElectricalDerived(makeFullDoc(), CATALOGS);
        const byId = new Map(derived.roomOutlets.map((ro) => [ro.roomOutletId, ro]));
        expect(byId.get('o1')?.autoQty).toBe(5);
        expect(byId.get('o1')?.ruleApplied).toBe('1 punto / 10 m²');
        expect(byId.get('o2')?.autoQty).toBe(5);
        expect(byId.get('o2')?.ruleApplied).toBe('1 punto / 15 m²');
        // roomType 'Exterior' matchea la regla 'exterior' sin distinguir mayúsculas.
        expect(byId.get('o3')?.autoQty).toBe(6);
        expect(byId.get('o3')?.ruleApplied).toBe('1 punto / 9 m de perímetro');
    });

    it('altura del tipo de catálogo y potencia VA de la regla por defecto', () => {
        const derived = computeElectricalDerived(makeFullDoc(), CATALOGS);
        const o1 = derived.roomOutlets.find((ro) => ro.roomOutletId === 'o1');
        expect(o1?.heightM).toBe(0.4);
        expect(o1?.totalPowerVA).toBe(5 * 180);
    });

    it('cantidad manual + extra con mínimo 0 y overrides de altura/VA', () => {
        const doc = makeDoc({
            rooms: [makeRoom({ id: 'r1', lengthM: 8, widthM: 6 })],
            roomOutlets: [
                makeOutletGroup({ id: 'o1', roomId: 'r1', manualQty: 3, extraQty: 2, heightM: 1.2, powerVA: 250 }),
                makeOutletGroup({ id: 'o2', roomId: 'r1', manualQty: 0, extraQty: 0 }),
            ],
        });
        const derived = computeElectricalDerived(doc, CATALOGS);
        expect(derived.roomOutlets[0].finalQty).toBe(5);
        expect(derived.roomOutlets[0].heightM).toBe(1.2);
        expect(derived.roomOutlets[0].totalPowerVA).toBe(5 * 250);
        expect(derived.roomOutlets[1].finalQty).toBe(0);
    });

    it('sin regla para el tipo de ambiente: autoQty 0 y "sin regla"', () => {
        const doc = makeDoc({
            rooms: [makeRoom({ id: 'r1', roomType: 'deposito' })],
            roomOutlets: [makeOutletGroup({ id: 'o1', roomId: 'r1' })],
        });
        const result = computeElectricalDerived(doc, CATALOGS).roomOutlets[0];
        expect(result.autoQty).toBe(0);
        expect(result.ruleApplied).toBe('sin regla');
        // Sin regla, el VA por punto usa el respaldo de 180 VA.
        expect(result.totalPowerVA).toBe(0);
    });
});

// ─── Circuitos ───────────────────────────────────────────────────────────────

describe('circuits', () => {
    it('circuito de alumbrado: 252 W → 2.5 mm², ITM 10 A, estado ok', () => {
        const derived = computeElectricalDerived(makeFullDoc(), CATALOGS);
        const c1 = derived.circuits.find((c) => c.circuitId === 'c1');
        expect(c1?.connectedLuminaires).toBe(7);
        expect(c1?.totalPowerW).toBe(252);
        expect(c1?.demandFactor).toBe(1);
        expect(c1?.currentA).toBeCloseTo(252 / (220 * 0.9), 4);
        expect(c1?.designCurrentA).toBeCloseTo((252 / (220 * 0.9)) * 1.25, 4);
        expect(c1?.sectionMm2).toBe(2.5);
        expect(c1?.sectionSource).toBe('auto');
        expect(c1?.conductorLabel).toBe('2.5 mm² Cu THW-90 (ref. AWG 14)');
        expect(c1?.breakerA).toBe(10);
        expect(c1?.breakerSource).toBe('auto');
        expect(c1?.voltageDropPct).toBeLessThan(2.5);
        expect(c1?.voltageDropV).toBeCloseTo(((c1?.voltageDropPct ?? 0) / 100) * 220, 6);
        expect(c1?.status).toBe('ok');
    });

    it('circuito de tomacorrientes: 900 VA·fp → 810 W y sección mínima de 4 mm²', () => {
        const derived = computeElectricalDerived(makeFullDoc(), CATALOGS);
        const c2 = derived.circuits.find((c) => c.circuitId === 'c2');
        expect(c2?.connectedOutlets).toBe(5);
        expect(c2?.totalPowerW).toBeCloseTo(900 * 0.9, 6);
        expect(c2?.sectionMm2).toBe(4);
        expect(c2?.conductorLabel).toBe('4 mm² Cu THW-90 (ref. AWG 12)');
        expect(c2?.status).toBe('ok');
    });

    it('carga elevada a 60 m sube de sección por caída de tensión', () => {
        // 12500 VA·0.9 = 11250 W → I diseño ≈ 71 A: por ampacidad bastaría
        // 25 mm² (85 A), pero su caída a 60 m supera 2.5 % → sube a 35 mm².
        const doc = makeDoc({
            rooms: [makeRoom({ id: 'r1' })],
            roomOutlets: [makeOutletGroup({ id: 'o1', roomId: 'r1', manualQty: 10, powerVA: 1250, circuitId: 'c1' })],
            circuits: [makeCircuit({ id: 'c1', panelId: 'tg', type: 'outlets', lengthM: 60 })],
            panels: [makePanel({ id: 'tg' })],
        });
        const c1 = computeElectricalDerived(doc, CATALOGS).circuits[0];
        expect(c1.demandPowerW).toBeCloseTo(11250, 6);
        expect(c1.sectionMm2).toBe(35);
        expect(c1.voltageDropPct).toBeLessThanOrEqual(2.5);
        expect(c1.status).toBe('ok');
    });

    it('interruptor manual que supera la ampacidad del conductor → advertencia', () => {
        const doc = makeDoc({
            rooms: [makeRoom({ id: 'r1' })],
            luminaireTypes: [makeLuminaireType({ id: 'lt1' })],
            roomLuminaires: [makeRoomLuminaire({ id: 'rl1', roomId: 'r1', luminaireTypeId: 'lt1', circuitId: 'c1' })],
            circuits: [makeCircuit({ id: 'c1', panelId: 'tg', manualBreakerA: 32 })],
            panels: [makePanel({ id: 'tg' })],
        });
        const c1 = computeElectricalDerived(doc, CATALOGS).circuits[0];
        expect(c1.breakerA).toBe(32);
        expect(c1.breakerSource).toBe('manual');
        expect(c1.status).toBe('advertencia');
        expect(c1.warnings.some((w) => w.includes('supera la ampacidad'))).toBe(true);
    });

    it('sección manual se reporta con source manual', () => {
        const doc = makeDoc({
            circuits: [makeCircuit({ id: 'c1', panelId: 'tg', manualSectionMm2: 6 })],
            panels: [makePanel({ id: 'tg' })],
        });
        const c1 = computeElectricalDerived(doc, CATALOGS).circuits[0];
        expect(c1.sectionMm2).toBe(6);
        expect(c1.sectionSource).toBe('manual');
    });

    it('catálogo de conductores vacío → estado error y "sin conductor"', () => {
        const doc = makeDoc({
            circuits: [makeCircuit({ id: 'c1', panelId: 'tg' })],
            panels: [makePanel({ id: 'tg' })],
        });
        const c1 = computeElectricalDerived(doc, { ...CATALOGS, conductors: [] }).circuits[0];
        expect(c1.sectionMm2).toBe(0);
        expect(c1.conductorLabel).toBe('sin conductor');
        expect(c1.status).toBe('error');
    });

    it('circuitId inexistente: la carga no se contabiliza y la luminaria recibe warning', () => {
        const doc = makeDoc({
            rooms: [makeRoom({ id: 'r1' })],
            luminaireTypes: [makeLuminaireType({ id: 'lt1' })],
            roomLuminaires: [makeRoomLuminaire({ id: 'rl1', roomId: 'r1', luminaireTypeId: 'lt1', circuitId: 'no-existe' })],
            circuits: [makeCircuit({ id: 'c1', panelId: 'tg' })],
            panels: [makePanel({ id: 'tg' })],
        });
        const derived = computeElectricalDerived(doc, CATALOGS);
        expect(derived.circuits[0].totalPowerW).toBe(0);
        expect(derived.circuits[0].connectedLuminaires).toBe(0);
        expect(derived.roomLuminaires[0].warnings.some((w) => w.includes('no-existe'))).toBe(true);
    });
});

// ─── Categoría de instalación (residencial/educativa/industrial) ────────────

describe('installationCategory', () => {
    it('residencial (por defecto) usa la sección mínima de tomacorrientes de 4 mm²', () => {
        const doc = makeDoc({
            roomOutlets: [makeOutletGroup({ id: 'o1', roomId: 'r1', manualQty: 1, powerVA: 10, circuitId: 'c1' })],
            rooms: [makeRoom({ id: 'r1' })],
            circuits: [makeCircuit({ id: 'c1', panelId: 'tg', type: 'outlets' })],
            panels: [makePanel({ id: 'tg' })],
        });
        const c1 = computeElectricalDerived(doc, CATALOGS).circuits[0];
        expect(c1.sectionMm2).toBe(4);
    });

    it('industrial sube la sección mínima de tomacorrientes a 6 mm² con la misma carga', () => {
        const doc = makeDoc({
            settings: { voltageV: 220, phases: 1, frequencyHz: 60, powerFactor: 0.9, referenceStandard: 'CNE', cableReserveFactor: 1.1, installationCategory: 'industrial' },
            roomOutlets: [makeOutletGroup({ id: 'o1', roomId: 'r1', manualQty: 1, powerVA: 10, circuitId: 'c1' })],
            rooms: [makeRoom({ id: 'r1' })],
            circuits: [makeCircuit({ id: 'c1', panelId: 'tg', type: 'outlets' })],
            panels: [makePanel({ id: 'tg' })],
        });
        const c1 = computeElectricalDerived(doc, CATALOGS).circuits[0];
        expect(c1.sectionMm2).toBe(6);
    });

    it('categoría desconocida o documento legado sin el campo cae a residencial', () => {
        const doc = makeDoc({
            settings: {
                voltageV: 220,
                phases: 1,
                frequencyHz: 60,
                powerFactor: 0.9,
                referenceStandard: 'CNE',
                cableReserveFactor: 1.1,
                // @ts-expect-error simula un documento legado sin este campo
                installationCategory: undefined,
            },
            circuits: [makeCircuit({ id: 'c1', panelId: 'tg' })],
            panels: [makePanel({ id: 'tg' })],
        });
        const c1 = computeElectricalDerived(doc, CATALOGS).circuits[0];
        expect(c1.sectionMm2).toBe(2.5); // sección mínima residencial de alumbrado
    });
});

// ─── Cable como propiedad del objeto (luminaria/tomacorriente) ──────────────

describe('object-level conductor', () => {
    it('hereda el conductor del circuito asignado cuando no hay override', () => {
        const derived = computeElectricalDerived(makeFullDoc(), CATALOGS);
        const rl1 = derived.roomLuminaires.find((r) => r.roomLuminaireId === 'rl1');
        expect(rl1?.sectionSource).toBe('auto');
        expect(rl1?.sectionMm2).toBe(2.5);
        expect(rl1?.conductorLabel).toBe('2.5 mm² Cu THW-90 (ref. AWG 14)');

        const o1 = derived.roomOutlets.find((r) => r.roomOutletId === 'o1');
        expect(o1?.sectionMm2).toBe(4);
        expect(o1?.sectionSource).toBe('auto');
    });

    it('sin circuito asignado y sin override → "sin circuito asignado"', () => {
        const derived = computeElectricalDerived(makeFullDoc(), CATALOGS);
        // o2 y o3 en makeFullDoc no tienen circuitId.
        const o2 = derived.roomOutlets.find((r) => r.roomOutletId === 'o2');
        expect(o2?.sectionSource).toBe('sin-circuito');
        expect(o2?.sectionMm2).toBe(0);
        expect(o2?.conductorLabel).toBe('sin circuito asignado');
    });

    it('el override manual del punto tiene prioridad sobre el circuito asignado', () => {
        const doc = makeFullDoc();
        doc.roomLuminaires[0].conductorOverrideMm2 = 6; // rl1 está en el circuito c1 (2.5 mm² auto)
        const derived = computeElectricalDerived(doc, CATALOGS);
        const rl1 = derived.roomLuminaires.find((r) => r.roomLuminaireId === 'rl1');
        expect(rl1?.sectionSource).toBe('manual');
        expect(rl1?.sectionMm2).toBe(6);
    });

    it('override manual sin conductor exacto en catálogo redondea hacia arriba', () => {
        const doc = makeFullDoc();
        doc.roomOutlets[0].conductorOverrideMm2 = 5; // no existe 5 mm² en CATALOGS → sube a 6
        const derived = computeElectricalDerived(doc, CATALOGS);
        const o1 = derived.roomOutlets.find((r) => r.roomOutletId === 'o1');
        expect(o1?.sectionSource).toBe('manual');
        expect(o1?.sectionMm2).toBe(6);
    });
});

// ─── Tableros ────────────────────────────────────────────────────────────────

describe('panels', () => {
    it('agrega potencias recursivamente por el árbol TG → TP', () => {
        const derived = computeElectricalDerived(makeFullDoc(), CATALOGS);
        const tg = derived.panels.find((p) => p.panelId === 'tg');
        const tp = derived.panels.find((p) => p.panelId === 'tp');

        expect(tp?.installedPowerW).toBeCloseTo(810, 6);
        expect(tp?.demandPowerW).toBeCloseTo(810, 6);
        expect(tp?.depth).toBe(1);
        expect(tp?.circuitCount).toBe(1);

        expect(tg?.installedPowerW).toBeCloseTo(1062, 6);
        expect(tg?.demandPowerW).toBeCloseTo(1062, 6);
        expect(tg?.depth).toBe(0);
        expect(tg?.childPanelIds).toEqual(['tp']);
        expect(tg?.currentA).toBeCloseTo(1062 / (220 * 0.9), 4);
        // La reserva del 25 % no suma carga: solo dimensiona el ITM general.
        expect(tg?.designCurrentA).toBeCloseTo((1062 / (220 * 0.9)) * 1.25, 4);
        expect(tg?.mainBreakerA).toBe(10);
    });

    it('el ITM general manual tiene prioridad', () => {
        const doc = makeDoc({ panels: [makePanel({ id: 'tg', manualMainBreakerA: 63 })] });
        const tg = computeElectricalDerived(doc, CATALOGS).panels[0];
        expect(tg.mainBreakerA).toBe(63);
    });

    it('detecta ciclos en la jerarquía sin colgarse', () => {
        const doc = makeDoc({
            panels: [makePanel({ id: 'pa', parentPanelId: 'pb' }), makePanel({ id: 'pb', parentPanelId: 'pa' })],
        });
        const derived = computeElectricalDerived(doc, CATALOGS);
        expect(derived.panels).toHaveLength(2);
        expect(derived.panels.some((p) => p.warnings.some((w) => w.includes('ciclo')))).toBe(true);
        for (const panel of derived.panels) {
            expect(Number.isFinite(panel.installedPowerW)).toBe(true);
            expect(Number.isFinite(panel.demandPowerW)).toBe(true);
        }
    });

    it('un padre inexistente genera warning y el tablero se trata como raíz', () => {
        const doc = makeDoc({ panels: [makePanel({ id: 'tp', parentPanelId: 'fantasma' })] });
        const tp = computeElectricalDerived(doc, CATALOGS).panels[0];
        expect(tp.depth).toBe(0);
        expect(tp.warnings.some((w) => w.includes('no existe'))).toBe(true);
    });
});

// ─── Alimentadores ───────────────────────────────────────────────────────────

describe('feeders', () => {
    it('usa la demanda del tablero destino y la sección mínima de alimentador (6 mm²)', () => {
        const derived = computeElectricalDerived(makeFullDoc(), CATALOGS);
        const feeder = derived.feeders[0];
        expect(feeder.fromPanelCode).toBe('TG-01');
        expect(feeder.toPanelCode).toBe('TP-01');
        expect(feeder.demandPowerW).toBeCloseTo(810, 6);
        expect(feeder.currentA).toBeCloseTo(810 / (220 * 0.9), 4);
        expect(feeder.designCurrentA).toBeCloseTo((810 / (220 * 0.9)) * 1.25, 4);
        expect(feeder.sectionMm2).toBe(6);
        expect(feeder.conductorLabel).toBe('6 mm² Cu THW-90 (ref. AWG 10)');
        expect(feeder.status).toBe('ok');
    });

    it('tablero destino inexistente → carga 0, warning y estado error', () => {
        const doc = makeDoc({
            panels: [makePanel({ id: 'tg' })],
            feeders: [{ id: 'fd1', fromPanelId: 'tg', toPanelId: 'fantasma', lengthM: 20 }],
        });
        const feeder = computeElectricalDerived(doc, CATALOGS).feeders[0];
        expect(feeder.demandPowerW).toBe(0);
        expect(feeder.status).toBe('error');
        expect(feeder.warnings.some((w) => w.includes('no existe'))).toBe(true);
    });
});

// ─── Metrados y totales ──────────────────────────────────────────────────────

describe('takeoff y totals', () => {
    it('metrado de conductores usa L·n·reserva (25·3·1.10 = 82.5 m)', () => {
        const derived = computeElectricalDerived(makeFullDoc(), CATALOGS);
        const conductors = derived.takeoff.filter((item) => item.category === 'Conductores');
        const of25 = conductors.find((item) => item.description.includes('2.5 mm²'));
        const of4 = conductors.find((item) => item.description.includes('4 mm²'));
        const of6 = conductors.find((item) => item.description.includes('6 mm²'));
        expect(of25?.quantity).toBeCloseTo(82.5, 5); // C-1: 25 m × 3 × 1.10
        expect(of4?.quantity).toBeCloseTo(59.4, 5); // C-2: 18 m × 3 × 1.10
        expect(of6?.quantity).toBeCloseTo(66, 5); // alimentador: 20 m × 3 × 1.10
        expect(of25?.subtotal).toBeCloseTo(82.5 * 2.5, 5);
    });

    it('agrupa luminarias, tomacorrientes, protecciones y tableros', () => {
        const derived = computeElectricalDerived(makeFullDoc(), CATALOGS);

        const luminaire = derived.takeoff.find((item) => item.category === 'Luminarias');
        expect(luminaire?.description).toBe('LUM-A Philips CoreLine 36 W');
        expect(luminaire?.quantity).toBe(7);
        expect(luminaire?.subtotal).toBeCloseTo(7 * 180, 5);

        const outlets = derived.takeoff.find((item) => item.category === 'Tomacorrientes');
        expect(outlets?.description).toBe('Tomacorriente doble con tierra (TOM-01)');
        expect(outlets?.quantity).toBe(16); // 5 + 5 + 6

        // C-1, C-2, alimentador y los ITM generales de TG/TP: todos de 10 A.
        const breakers = derived.takeoff.find((item) => item.category === 'Protecciones');
        expect(breakers?.description).toBe('ITM 2x10 A');
        expect(breakers?.quantity).toBe(5);

        const panels = derived.takeoff.filter((item) => item.category === 'Tableros');
        expect(panels).toHaveLength(2);
        expect(panels[0].quantity).toBe(1);
    });

    it('totales globales del proyecto', () => {
        const derived = computeElectricalDerived(makeFullDoc(), CATALOGS);
        expect(derived.totals.rooms).toBe(4);
        expect(derived.totals.luminaires).toBe(7);
        expect(derived.totals.outlets).toBe(16);
        expect(derived.totals.panels).toBe(2);
        expect(derived.totals.installedPowerW).toBeCloseTo(1062, 6);
        expect(derived.totals.demandPowerW).toBeCloseTo(1062, 6);
        expect(derived.totals.cableTotalM).toBeCloseTo(82.5 + 59.4 + 66, 5);
        // Subtotales: luminarias 1260 + cobre 2.5 (206.25) + 4 (207.9) + 6 (330).
        expect(derived.totals.takeoffTotal).toBeCloseTo(1260 + 206.25 + 207.9 + 330, 5);
    });

    it('sin precios el total del metrado es null', () => {
        const noPrices: ElectricalCatalogs = {
            ...CATALOGS,
            conductors: CONDUCTORS.map((c) => ({ ...c, price_per_meter: null })),
        };
        const doc = makeFullDoc();
        doc.luminaireTypes = doc.luminaireTypes.map((t) => ({ ...t, unitPrice: null }));
        const derived = computeElectricalDerived(doc, noPrices);
        expect(derived.totals.takeoffTotal).toBeNull();
    });

    it('documento vacío produce ceros y null sin errores', () => {
        const derived = computeElectricalDerived(makeDoc(), CATALOGS);
        expect(derived.totals).toEqual({
            rooms: 0,
            luminaires: 0,
            outlets: 0,
            panels: 0,
            installedPowerW: 0,
            demandPowerW: 0,
            cableTotalM: 0,
            takeoffTotal: null,
        });
        expect(derived.takeoff).toEqual([]);
    });
});
