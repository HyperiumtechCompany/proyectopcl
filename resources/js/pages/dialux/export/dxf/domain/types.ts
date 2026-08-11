import type {
    Canopy,
    Conductor,
    Door,
    DxfEntity,
    DxfExtents,
    ElectricalDevice,
    Fixture,
    JunctionBox,
    LightSwitch,
    Room,
    Wall,
    Window as SceneWindow,
} from '@/pages/dialux/hooks/types';

/**
 * Modelo intermedio de láminas DXF (plan maestro, sección 6).
 *
 * Un `DxfDrawingPackage` es la representación del proyecto YA separada por
 * nivel, antes de que el builder de láminas (Fase 3+) decida escala, marco o
 * distribución. `sheetConfig`/`sheets` (Fase 3/8) se agregan cuando esas
 * fases lleguen — este archivo cubre solo lo que Fase 1 necesita: que cada
 * entidad exportable pertenezca a exactamente un nivel.
 */

/** Procedencia del fondo CAD asignado a un nivel (sección 6.2). */
export type DxfLevelBasePlanSource = 'shared' | 'scene' | 'drawn-only' | 'none';

export interface DxfLevelBasePlan {
    source: DxfLevelBasePlanSource;
    entities: DxfEntity[];
    extents: DxfExtents | null;
}

export interface DxfArchitectureEntities {
    rooms: Room[];
    walls: Wall[];
    windows: SceneWindow[];
    doors: Door[];
    canopies: Canopy[];
}

export interface DxfElectricalEntities {
    fixtures: Fixture[];
    lightSwitches: LightSwitch[];
    electricalDevices: ElectricalDevice[];
    conductors: Conductor[];
    junctionBoxes: JunctionBox[];
}

export interface DxfBounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

export interface DxfLevelPackage {
    sceneId: string;
    floorIndex: number;
    floorElevation: number;
    floorHeight: number;
    name: string;
    /** `Scene.visible === false` se excluye de `DxfDrawingPackage.levels` (ver `buildDxfDrawingPackage`). */
    visible: boolean;
    basePlan: DxfLevelBasePlan;
    architecture: DxfArchitectureEntities;
    electrical: DxfElectricalEntities;
    bounds: DxfBounds;
}

export type DxfExportWarningCode =
    | 'shared-base-plan-not-configured'
    | 'level-without-base-plan'
    | 'duplicate-level-name'
    | 'level-hidden-excluded'
    | 'unknown-device-type'
    | 'unclassified-junction-box'
    | 'shared-junction-box'
    | 'conductor-dangling-endpoint'
    | 'conductor-inconclusive-endpoints'
    | 'conductor-mixed-disciplines'
    | 'sheet-scale-does-not-fit'
    | 'empty-sheet-skipped'
    | 'legend-overflow'
    | 'base-plan-entity-unsupported';

export interface DxfExportWarning {
    code: DxfExportWarningCode;
    message: string;
    sceneId: string | null;
    levelName: string | null;
}

export interface DxfDrawingPackage {
    version: '2.0.0';
    projectId: string;
    projectName: string;
    units: 'm';
    levels: DxfLevelPackage[];
    warnings: DxfExportWarning[];
}

/**
 * Clasificación por especialidad (Fase 2, sección 5.3). `'shared'` cubre
 * tableros/medidores y cajas de pase conectadas a ambas disciplinas — se
 * incluyen en los dos planos, no es un estado de error. `'unclassified'` sí
 * lo es: siempre viene acompañado de un `DxfExportWarning`, nunca se oculta
 * en silencio.
 */
export type DxfDiscipline = 'lighting' | 'outlets';
export type DxfEntitySpecialty = DxfDiscipline | 'shared' | 'unclassified';

export interface DxfLevelClassification {
    /** `ElectricalDevice.id` -> especialidad (incluye los de tipo `junction_box`). */
    deviceSpecialty: Map<string, DxfEntitySpecialty>;
    /** `JunctionBox.id` (legacy) -> especialidad. */
    junctionBoxSpecialty: Map<string, DxfEntitySpecialty>;
    /** `Conductor.id` -> especialidad. */
    conductorDiscipline: Map<string, DxfEntitySpecialty>;
    warnings: DxfExportWarning[];
}

/** Subconjunto de `DxfElectricalEntities` de una sola especialidad, listo para una lámina (Fase 8). */
export interface DxfDisciplineEntities {
    discipline: DxfDiscipline;
    fixtures: Fixture[];
    lightSwitches: LightSwitch[];
    electricalDevices: ElectricalDevice[];
    conductors: Conductor[];
    junctionBoxes: JunctionBox[];
}

// ── Fase 3: papel, escala y geometría de lámina (sección 7/8) ────────────────

export type DxfPaperFormat = 'A0' | 'A1' | 'A2' | 'A3' | 'A4';
export type DxfPaperOrientation = 'landscape' | 'portrait';

export interface DxfPaperSize {
    widthMm: number;
    heightMm: number;
}

/** Cuánto se reserva del marco interior para márgenes, columna de leyenda y cajetín (mm de papel). */
export interface DxfSheetReservedZonesMm {
    marginMm: number;
    legendColumnWidthMm: number;
    titleBlockHeightMm: number;
}

/**
 * Geometría de UNA lámina aislada, en metros de Model Space y en coordenadas
 * LOCALES a esa lámina (origen = esquina inferior izquierda del marco
 * exterior, en (0,0)). Fase 8 la traslada a su posición final dentro del
 * dibujo completo; Fase 4 la usa para dibujar marco/cajetín/leyenda.
 */
export interface DxfSheetGeometry {
    paper: DxfPaperSize;
    scaleDenominator: number;
    /** false si ni la escala más chica (denominador más grande) de la lista permitida hace caber el plano. */
    scaleFits: boolean;
    frameOuter: DxfBounds;
    frameInner: DxfBounds;
    planArea: DxfBounds;
    legendArea: DxfBounds;
    titleBlockArea: DxfBounds;
    /** Sumar a cualquier punto del nivel (coordenadas reales) para centrarlo en `planArea` sin deformarlo. */
    modelToPlanOffset: { x: number; y: number };
}

// ── Fase 4: numeración de láminas y cajetín (sección 8.4/14.1) ───────────────

/** Identidad de una lámina: un nivel + una especialidad (aún sin geometría de papel resuelta). */
export interface DxfSheetIdentity {
    sceneId: string;
    levelName: string;
    discipline: DxfDiscipline;
}

/** Una lámina ya numerada en orden estable (sótanos → planta baja → pisos, alumbrado antes de tomacorrientes). */
export interface DxfNumberedSheet extends DxfSheetIdentity {
    /** 1-based, en el orden estable de numeración. */
    sheetIndex: number;
    sheetCount: number;
    /** Ej. "01/06". */
    sheetNumber: string;
}

/** Datos mínimos del cajetín (sección 8.4) para una lámina ya numerada. */
export interface DxfSheetMetadata extends DxfNumberedSheet {
    projectName: string;
    disciplineLabel: string;
    scaleDenominator: number;
    units: string;
    /** Fecha de exportación ya formateada para mostrarse (no un ISO crudo). */
    exportedAtLabel: string;
    drawnBy?: string | null;
    reviewedBy?: string | null;
    revision?: string | null;
}

// ── Fase 6/7: filas de leyenda (sección 9/10) ─────────────────────────────────

/**
 * Referencia al símbolo de una fila de leyenda — la celda de símbolo invoca
 * el MISMO renderer de la Fase 5 que dibuja la entidad en planta (criterio
 * de cierre de la Fase 5, sección 9.3). `null` para filas sin símbolo
 * geométrico propio (cableado).
 */
export interface DxfLegendSymbolRef {
    kind: 'fixture' | 'switch' | 'device' | 'junctionBox';
    catalogSymbol?: string | null;
    deviceType?: string;
}

export type DxfLegendRowKind = 'fixture' | 'switch' | 'emergency' | 'cable' | 'outlet' | 'panel' | 'junctionBox';

export interface DxfLegendRow {
    kind: DxfLegendRowKind;
    symbolRef: DxfLegendSymbolRef | null;
    code: string;
    description: string;
    /** Campos técnicos adicionales en el orden en que deben mostrarse (potencia, flujo, montaje, sección, canalización, altura...). */
    technicalFields: string[];
    quantity: number;
}

/**
 * Definición de una columna de datos de la tabla de leyenda (sección
 * 9.2/10.2 del plan maestro) — la columna SÍMBOLO no forma parte de este
 * arreglo, ya está resuelta aparte por `renderRowSymbol`. Exactamente una
 * columna debe usar `widthMm: 'flex'` (normalmente DESCRIPCIÓN); el resto
 * usa un ancho fijo en mm de papel.
 */
export interface DxfLegendColumnDef {
    header: string;
    widthMm: number | 'flex';
    extract: (row: DxfLegendRow) => string;
}
