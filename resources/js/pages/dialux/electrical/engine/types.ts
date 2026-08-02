/**
 * Tipos del módulo eléctrico DIALux.
 *
 * El documento eléctrico (ElectricalDocument) se persiste como JSON en
 * dialux_electrical_projects.data. Todo lo derivado (cantidades mínimas,
 * lux estimado, corrientes, secciones, caídas de tensión, metrados) se
 * recalcula con el motor puro de ./index.ts y NO se persiste como fuente
 * de verdad: se guarda solo como caché de lectura.
 */

// ─── Catálogos (vienen del backend, tablas dialux_*) ─────────────────────────

export interface OutletRule {
    id: number;
    user_id: number | null;
    room_type: string;
    method: 'area' | 'perimeter' | 'fixed';
    value: number;
    unit: 'm2_per_point' | 'm_per_point' | 'points';
    power_per_outlet_va: number;
    notes?: string | null;
}

export interface OutletTypeCatalog {
    id: number;
    user_id: number | null;
    code: string;
    name: string;
    height_m: number | null;
    height_label?: string | null;
    use_description?: string | null;
    ip_rating?: string | null;
    box_type?: string | null;
    notes?: string | null;
}

export interface ConductorCatalog {
    id: number;
    user_id: number | null;
    material: 'cobre' | 'aluminio';
    section_mm2: number;
    awg_ref?: string | null;
    insulation: string;
    ampacity_a: number;
    price_per_meter?: number | null;
}

/** Tipo de instalación: residencial (casas), educativa (colegios) o industrial (zona industrial). */
export type InstallationCategory = 'residencial' | 'educativa' | 'industrial';

export interface CircuitDefaults {
    id: number;
    user_id: number | null;
    circuit_type: 'lighting' | 'outlets' | 'feeder' | 'special';
    installation_category: InstallationCategory;
    min_section_mm2: number;
    max_voltage_drop_pct: number;
    demand_factor: number;
    breaker_poles: number;
}

export interface ElectricalCatalogs {
    outletRules: OutletRule[];
    outletTypes: OutletTypeCatalog[];
    conductors: ConductorCatalog[];
    circuitDefaults: CircuitDefaults[];
}

export interface NormativeRequirementRow {
    id: number;
    standard: string;
    category_key: string;
    category: string;
    subcategory_key: string | null;
    subcategory: string | null;
    area_name: string;
    em_lux: number | null;
    ugrl: number | null;
    uo: number | null;
    ra: number | null;
    requirements: string[] | null;
}

// ─── Documento eléctrico persistido ──────────────────────────────────────────

export interface ElectricalSettings {
    voltageV: number;
    phases: 1 | 3;
    frequencyHz: 50 | 60;
    powerFactor: number; // cos φ global por defecto
    referenceStandard: string;
    cableReserveFactor: number; // p.ej. 1.10 (RN metrados)
    /** Determina qué fila de CircuitDefaults (RN-05) aplica por tipo de circuito. */
    installationCategory: InstallationCategory;
    /**
     * Límite normativo de caída de tensión TOTAL acumulada desde el tablero
     * raíz hasta el punto más alejado (suma de todos los tramos en cascada,
     * no un tramo individual). `null`/`undefined` = sin límite configurado:
     * `cumulativeVoltageDropPct` se calcula igual (es un hecho físico, no un
     * juicio normativo), pero ningún resultado se marca como error por esta
     * razón mientras no exista un valor confirmado. Ver
     * `.claude/skills/normativa-dialux/references/normativa.md` — este valor
     * sigue `pending-confirmation` en todo el proyecto.
     */
    maxTotalVoltageDropPct?: number | null;
}

export interface ElectricalFloor {
    id: string;
    name: string;
    level: number;
}

export interface RoomNormativeRef {
    standard: string;
    categoryKey: string;
    category: string;
    areaName: string;
    emLux: number | null;
    ugrl: number | null;
    uo: number | null;
    ra: number | null;
}

export interface ElectricalRoom {
    id: string;
    floorId: string;
    name: string;
    roomType: string; // clave de OutletRule.room_type (aula, comedor, exterior, ...)
    lengthM: number;
    widthM: number;
    heightM: number;
    /** Si se importó del plano CAD, área real del polígono (manda sobre largo×ancho). */
    areaOverrideM2?: number | null;
    perimeterOverrideM?: number | null;
    requiredLux: number;
    utilizationFactor: number; // CU
    maintenanceFactor: number; // FM
    occupancy?: string;
    usersCount?: number | null;
    observations?: string;
    normative?: RoomNormativeRef | null;
    /** id del Room del editor CAD del que se importó (trazabilidad). */
    sourceRoomId?: string | null;
}

export interface LuminaireType {
    id: string;
    code: string;
    brand?: string;
    model?: string;
    fixtureType?: string;
    powerW: number;
    lumens: number;
    colorTempK?: number | null;
    cri?: number | null;
    mounting?: string;
    mountingHeightM?: number | null;
    ipRating?: string;
    powerFactor?: number | null;
    lifeHours?: number | null;
    unitPrice?: number | null;
    observations?: string;
}

export interface RoomLuminaire {
    id: string;
    roomId: string;
    luminaireTypeId: string;
    /** null = usar la cantidad mínima calculada. */
    manualQty: number | null;
    rows?: number | null;
    cols?: number | null;
    circuitId?: string | null;
    /** Resultado real medido/validado en DIALux (Fase 8, trazabilidad). */
    dialuxVerifiedLux?: number | null;
    /** Override manual de la sección del cable de este punto (mm²); null = heredar la del circuito asignado. */
    conductorOverrideMm2?: number | null;
}

export interface RoomOutletGroup {
    id: string;
    roomId: string;
    outletTypeCode: string; // clave de OutletTypeCatalog.code
    /** null = usar la cantidad automática de la regla del ambiente. */
    manualQty: number | null;
    /** Puntos adicionales manuales sobre la cantidad base. */
    extraQty: number;
    heightM?: number | null; // override de la altura del tipo
    wallOrZone?: string;
    location?: string;
    useDescription?: string;
    powerVA?: number | null; // override del VA por punto de la regla
    isSpecial?: boolean;
    circuitId?: string | null;
    notes?: string;
    /** Override manual de la sección del cable de este punto (mm²); null = heredar la del circuito asignado. */
    conductorOverrideMm2?: number | null;
}

export type CircuitType = 'lighting' | 'outlets' | 'special';

export interface Circuit {
    id: string;
    panelId: string;
    code: string; // C-1, C-2, ...
    type: CircuitType;
    description?: string;
    lengthM: number;
    installationType?: string; // empotrado, tubería, bandeja...
    /** null = selección automática por ampacidad + caída de tensión. */
    manualSectionMm2?: number | null;
    /** null = selección automática. */
    manualBreakerA?: number | null;
    demandFactorOverride?: number | null;
    observations?: string;
}

export interface Panel {
    id: string;
    floorId?: string | null;
    /** null = tablero general (raíz del árbol). */
    parentPanelId: string | null;
    code: string; // TG-01, TP-02...
    name: string;
    panelType?: string;
    voltageV?: number | null; // null = usar settings
    phases?: 1 | 3 | null;
    location?: string;
    reservePct: number; // reserva de crecimiento (p.ej. 25)
    manualMainBreakerA?: number | null;
    observations?: string;
}

export interface Feeder {
    id: string;
    fromPanelId: string;
    toPanelId: string;
    lengthM: number;
    /** null = selección automática (≥ mínimo de feeder). */
    manualSectionMm2?: number | null;
    conduit?: string;
    observations?: string;
}

export interface ElectricalDocument {
    version: 1;
    settings: ElectricalSettings;
    floors: ElectricalFloor[];
    rooms: ElectricalRoom[];
    luminaireTypes: LuminaireType[];
    roomLuminaires: RoomLuminaire[];
    roomOutlets: RoomOutletGroup[];
    circuits: Circuit[];
    panels: Panel[];
    feeders: Feeder[];
}

// ─── Resultados derivados (calculados, no editables) ─────────────────────────

export type ComplianceStatus = 'cumple' | 'advertencia' | 'no_cumple' | 'exceso';

export interface RoomGeometry {
    areaM2: number;
    perimeterM: number;
}

export interface RoomLuminaireResult {
    roomLuminaireId: string;
    roomId: string;
    luminaireTypeId: string;
    minQty: number;
    selectedQty: number;
    estimatedLux: number;
    requiredLux: number;
    deltaLux: number;
    compliancePct: number;
    status: ComplianceStatus;
    totalPowerW: number;
    suggestedRows: number;
    suggestedCols: number;
    warnings: string[];
    /** Sección del cable que alimenta este punto: la del circuito asignado, o la del override manual. */
    sectionMm2: number;
    conductorLabel: string;
    sectionSource: 'auto' | 'manual' | 'sin-circuito';
}

export interface RoomOutletResult {
    roomOutletId: string;
    roomId: string;
    outletTypeCode: string;
    autoQty: number;
    finalQty: number;
    heightM: number | null;
    ruleApplied: string; // texto legible: "1 punto / 10 m²"
    totalPowerVA: number;
    /** Sección del cable que alimenta este punto: la del circuito asignado, o la del override manual. */
    sectionMm2: number;
    conductorLabel: string;
    sectionSource: 'auto' | 'manual' | 'sin-circuito';
}

export interface CircuitResult {
    circuitId: string;
    code: string;
    type: CircuitType;
    panelId: string;
    connectedLuminaires: number;
    connectedOutlets: number;
    totalPowerW: number;
    demandFactor: number;
    demandPowerW: number;
    currentA: number;
    designCurrentA: number; // corriente × 1.25
    sectionMm2: number;
    sectionSource: 'auto' | 'manual';
    conductorLabel: string; // "4 mm² Cu THW-90 (ref. AWG 12)"
    breakerA: number;
    breakerSource: 'auto' | 'manual';
    voltageDropPct: number;
    voltageDropV: number;
    maxVoltageDropPct: number;
    /**
     * Caída de tensión TOTAL acumulada desde el tablero raíz hasta el punto
     * final de este circuito: suma de la caída de cada alimentador aguas
     * arriba (tablero general → ... → tablero de este circuito) más la
     * caída propia del circuito. A diferencia de `voltageDropPct` (solo el
     * tramo final), este valor es el que un instalador mediría con un
     * voltímetro en el punto de uso. Ver nota de `ElectricalSettings.maxTotalVoltageDropPct`.
     */
    cumulativeVoltageDropPct: number;
    status: 'ok' | 'advertencia' | 'error';
    warnings: string[];
}

export interface PanelResult {
    panelId: string;
    code: string;
    circuitCount: number;
    installedPowerW: number; // circuitos propios + tableros hijos
    demandPowerW: number;
    currentA: number;
    designCurrentA: number;
    mainBreakerA: number;
    childPanelIds: string[];
    depth: number; // nivel en el árbol (0 = tablero general)
    /** Caída de tensión acumulada en la barra de este tablero (0 en el tablero raíz). */
    cumulativeVoltageDropPct: number;
    warnings: string[];
}

export interface FeederResult {
    feederId: string;
    fromPanelCode: string;
    toPanelCode: string;
    demandPowerW: number;
    currentA: number;
    designCurrentA: number;
    sectionMm2: number;
    sectionSource: 'auto' | 'manual';
    conductorLabel: string;
    breakerA: number;
    voltageDropPct: number;
    /** Caída de tensión acumulada en el extremo receptor de este alimentador (incluye este tramo). */
    cumulativeVoltageDropPct: number;
    status: 'ok' | 'advertencia' | 'error';
    warnings: string[];
}

export interface TakeoffItem {
    category: string; // Luminarias | Tomacorrientes | Conductores | Tableros | Protecciones | Canalización
    description: string;
    unit: string; // und | m | glb
    quantity: number;
    unitPrice: number | null;
    subtotal: number | null;
}

export interface ElectricalDerived {
    roomGeometry: Record<string, RoomGeometry>;
    roomLuminaires: RoomLuminaireResult[];
    roomOutlets: RoomOutletResult[];
    circuits: CircuitResult[];
    panels: PanelResult[];
    feeders: FeederResult[];
    takeoff: TakeoffItem[];
    totals: {
        rooms: number;
        luminaires: number;
        outlets: number;
        panels: number;
        installedPowerW: number;
        demandPowerW: number;
        cableTotalM: number;
        takeoffTotal: number | null;
    };
}
