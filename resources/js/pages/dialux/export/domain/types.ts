import type { SceneComparisonEntry } from '@/pages/dialux/domain/calculation/compareLightingScenes';
import type { EmergencyRequirementEvaluation } from '@/pages/dialux/domain/calculation/emergencyCompliance';
import type { CalculationWarning } from '@/pages/dialux/domain/calculation/types';
import type {
    Canopy,
    Door,
    DxfEntity,
    DxfExtents,
    Fixture,
    IsoluxMode,
    LightingResult,
    Project,
    Room,
    ScaleConfig,
    Scene,
    Wall,
    Window as SceneWindow,
} from '@/pages/dialux/hooks/useEditorStore';

/**
 * Evaluación explícita de un requisito normativo contra un valor calculado.
 * Reemplaza los checks booleanos decorativos: toda conformidad debe derivarse
 * de esta estructura (metric + operator + requiredValue -> status).
 */
export interface RequirementEvaluation {
    metric: string;
    calculatedValue: number | null;
    operator: '>=' | '<=' | '>' | '<' | '=';
    requiredValue: number | null;
    unit: string;
    status: 'pass' | 'fail' | 'not-evaluated' | 'stale';
    source?: string;
}

/** Procedencia del cálculo fotométrico: qué motor lo produjo y su vigencia. */
export interface CalculationProvenance {
    engine: string;
    engineVersion: string;
    calculatedAt: string | null;
    status: 'calculated' | 'stale' | 'imported' | 'not-calculated';
    /**
     * Hash del `CalculationSnapshot` que produjo este resultado (Fase 11,
     * §11: "cada valor visible puede trazarse a una ejecución") —
     * `CalculationRun.snapshotHash`. Presente solo cuando el cálculo pasó
     * por `runDirectPreviewEngine`/`runProjectLightingCalculation`;
     * `undefined` en cálculos legacy directos (`calculateLightingResult`
     * sin motor de ejecución detrás, ej. tests que no pasan `calculationRun`).
     */
    snapshotHash?: string;
    /**
     * Resumen legible de la configuración usada (oclusión, interreflexión,
     * modelo de UGR) — "trazarse a... una configuración" (plan §11 Fase 11).
     * Mismo criterio de opcionalidad que `snapshotHash`.
     */
    configSummary?: string;
}

export interface DialuxAmbientMetrics {
    area: number;
    illuminanceLux: number;
    fixtureCount: number;
    fixtureLumens: number;
    fixtureLumensSource: 'detected' | 'fallback';
    lumensRequired: number;
    exactQuantity: number;
    roundedQuantity: number;
    estimatedUniformity: number;
    coverage: 'optimal' | 'insufficient' | 'excessive';
    avgLux: number | null;
    minLux: number | null;
    maxLux: number | null;
    uniformity: number | null;
    g2: number | null;
    ugr: number | null;
    /** `true` cuando `ugr` viene de `Room.manualUgr`/`AmbientConfig.manualUgr` (cargado a mano) en vez del motor de posición de Guth — ver doc-comment de `Room.manualUgr`. */
    ugrIsManual: boolean;
    usefulPlaneHeight: number;
    marginalZone: number;
    uniformityTarget: number | null;
    ugrLimit: number | null;
    /** Peor Ra/CRI entre las luminarias instaladas en el ambiente; `null` si ninguna declara CRI. */
    ra: number | null;
    /** Ra mínimo exigido por la actividad normativa asignada; `null` si no aplica o no hay actividad asignada. */
    raRequired: number | null;
    complies: boolean;
    requirementEvaluations: RequirementEvaluation[];
    provenance: CalculationProvenance;
    /**
     * Advertencias del motor específicas de este ambiente (Fase 11, §11:
     * "warnings... visibles") — ej. oclusión no convergida, luminarias
     * excluidas de UGR, etc. `[]` cuando no hubo ninguna o cuando el cálculo
     * no pasó por una ejecución completa (`CalculationRun`).
     */
    warnings: CalculationWarning[];
}

export interface DialuxAmbientExport {
    id: string;
    sceneId: string;
    sceneName: string;
    floorIndex: number;
    roomId: string;
    roomName: string;
    index: number;
    configKey: string;
    name: string;
    activity: string | null;
    sourceRoom: Room;
    room: Room;
    fixtures: Fixture[];
    result: LightingResult | null;
    metrics: DialuxAmbientMetrics;
}

export interface DialuxExportVisualConfig {
    showGrid: boolean;
    showIsolux: boolean;
    show3DView: boolean;
    isoluxMode: IsoluxMode;
    zoom: number;
    panX: number;
    panY: number;
    selectedId: string | null;
}

export interface DialuxExportSummary {
    roomCount: number;
    ambientCount: number;
    fixtureCount: number;
    wallCount: number;
    windowCount: number;
    doorCount: number;
    canopyCount: number;
    calculatedAmbientCount: number;
    compliantAmbientCount: number;
    averageLux: number;
    averageUniformity: number;
}

/**
 * Anexo comparativo de escenas lumínicas (Fase 13, §11: "añadir anexos
 * comparativos"). Envuelve `SceneComparisonEntry[]` (`compareLightingScenes`,
 * Fase 10) con los nombres legibles de las dos escenas comparadas — hoy
 * NINGUNA UI permite crear más de una `lightingScenes` por nivel, así que
 * `DialuxExportSnapshot.sceneComparisons` es `[]` en todo proyecto real
 * (plomería lista para cuando esa UI exista, sin costo mientras tanto).
 */
export interface DialuxSceneComparisonSummary {
    id: string;
    levelId: string;
    levelName: string;
    baselineSceneName: string;
    comparisonSceneName: string;
    entries: SceneComparisonEntry[];
}

export interface DialuxExportSnapshot {
    formatVersion: '1.0.0';
    exportedAt: string;
    project: Project;
    scene: Scene;
    scaleConfig: ScaleConfig;
    dxfEntities: DxfEntity[];
    dxfExtents: DxfExtents | null;
    rooms: Room[];
    walls: Wall[];
    windows: SceneWindow[];
    doors: Door[];
    canopies: Canopy[];
    fixtures: Fixture[];
    ambients: DialuxAmbientExport[];
    resultsByRoom: Record<string, LightingResult>;
    /**
     * Advertencias del motor SIN objeto asociado (Fase 11, §11: "warnings...
     * visibles") — ej. `interreflection-maxBounces-too-low`, `scene-not-found`
     * (ver `domain/calculation/runDirectPreviewEngine.ts`). `[]` cuando no
     * hubo ninguna o cuando el snapshot no trae `calculationRun`.
     */
    globalWarnings: CalculationWarning[];
    /** Fase 13: `[]` en todo proyecto sin 2+ `lightingScenes` por nivel — ver `DialuxSceneComparisonSummary`. */
    sceneComparisons: DialuxSceneComparisonSummary[];
    visualConfig: DialuxExportVisualConfig;
    summary: DialuxExportSummary;
}

export type DialuxAssetPurpose =
    | 'formal-cover'
    | 'cad-overview'
    | 'cad-base'
    | 'drawn-terrain'
    | 'viewer-capture'
    | 'ambient-plan'
    | 'ambient-catalog'
    | 'lighting-results'
    | 'isolux'
    | 'chart'
    | 'technical-appendix'
    | 'project-summary'
    | 'luminaire-list';

export interface DialuxStructuredColumn {
    key: string;
    label: string;
}

export interface DialuxStructuredTableData {
    type: 'table';
    columns: DialuxStructuredColumn[];
    rows: Array<Record<string, string | number | null>>;
}

export interface DialuxStructuredSummaryData {
    type: 'summary';
    items: Array<{ label: string; value: string }>;
}

export interface DialuxStructuredJsonData {
    type: 'json';
    data: unknown;
}

export type DialuxStructuredAssetData =
    | DialuxStructuredTableData
    | DialuxStructuredSummaryData
    | DialuxStructuredJsonData;

interface DialuxExportAssetBase {
    id: string;
    title: string;
    purpose: DialuxAssetPurpose;
}

export interface DialuxBitmapAsset extends DialuxExportAssetBase {
    kind: 'bitmap';
    mimeType: 'image/png' | 'image/jpeg';
    dataUrl: string;
    width: number;
    height: number;
    cssWidth?: number;
    cssHeight?: number;
    physicalWidth?: number;
    physicalHeight?: number;
}

export interface DialuxVectorAsset extends DialuxExportAssetBase {
    kind: 'vector';
    mimeType: 'image/svg+xml';
    svg: string;
    width: number;
    height: number;
}

export interface DialuxStructuredAsset extends DialuxExportAssetBase {
    kind: 'structured';
    mimeType: 'application/json';
    data: DialuxStructuredAssetData;
}

export type DialuxExportAsset =
    | DialuxBitmapAsset
    | DialuxVectorAsset
    | DialuxStructuredAsset;

export type DialuxExportSectionKind =
    | 'project-summary'
    | 'cad-overview'
    | 'ambient-catalog'
    | 'lighting-results-table'
    | 'isolux'
    | 'charts'
    | 'technical-appendix';

export interface DialuxExportSection {
    id: string;
    kind: DialuxExportSectionKind;
    title: string;
    description?: string;
    visualAssetIds: string[];
    structuredAssetIds: string[];
}

export interface DialuxExportDocument {
    title: string;
    subtitle: string;
    fileBaseName: string;
    generatedAt: string;
    header: {
        title: string;
        subtitle: string;
    };
    footer: {
        left: string;
        right: string;
    };
    metadata: Array<{ label: string; value: string }>;
    summary: DialuxExportSummary;
    sections: DialuxExportSection[];
    assets: DialuxExportAsset[];
}

/** Una fila de la tabla de referencia UGR de producto — Fase 15, Parte B. */
export interface ProductUgrTableEntry {
    /** Etiqueta de la sala de referencia, ej. "4×4 m (2H×2H)". */
    roomLabel: string;
    ugrCrosswise: number | null;
    ugrEndwise: number | null;
}

/**
 * Tabla de referencia UGR de un producto — Fase 15, Parte B del plan
 * maestro. `provenance: 'engine-calculated'` es un cálculo PROPIO (motor de
 * Fase 9, `evaluateUGR`) sobre un subconjunto acotado de salas normalizadas,
 * NUNCA una reproducción certificada de la tabla CIE 117 publicada por
 * fabricantes — el `disclaimer` debe mostrarse siempre junto a la tabla.
 * `provenance: 'manufacturer'` queda reservado para cuando el propio
 * fabricante provea la tabla (hoy ningún importador la genera).
 */
export interface ProductUgrTable {
    provenance: 'manufacturer' | 'engine-calculated';
    method: string;
    disclaimer: string;
    shr: number;
    reflectances: { ceiling: number; wall: number; floor: number };
    entries: ProductUgrTableEntry[];
}

export interface DialuxLuminaireListItem {
    id: string;
    name: string;
    model: string;
    brand: string | null;
    articleNumber: string | null;
    fixtureShape: string | null;
    shape: string | null;
    lumens: number | null;
    powerWatts: number | null;
    efficiency: number | null;
    roomName: string | null;
    ambientName: string | null;
    quantity: number;
    cct?: number | null;
    cri?: number | null;
    description?: string | null;
    applications?: string | null;
    reportData?: {
        technical_table?: Array<{ label: string; value: string }>;
        warnings?: string[];
        ugrTableComputed?: ProductUgrTable | null;
    } | null;
    reportAssets?: {
        polar_svg?: string | null;
        product_photo_url?: string | null;
        brand_logo_url?: string | null;
    } | null;
    ugrTable?: number[][] | null;
    ugrDiagramValue?: string | null;
    polarDiagramAssetId?: string | null;
    productPhotoAssetId?: string | null;
    brandLogoAssetId?: string | null;
    lineDrawingAssetId?: string | null;
}

export interface DialuxLuminaireTotals {
    totalLumens: number;
    totalPowerWatts: number;
    overallEfficiency: number;
}

/**
 * Agregado de luminarias y cumplimiento a escala de nivel (Scene). Se calcula
 * dinámicamente para cada nivel presente en el snapshot — funciona igual con
 * 1 nivel (solo planta baja) o con N niveles, no asume una cantidad fija.
 */
export interface DialuxLevelSummary {
    sceneId: string;
    sceneName: string;
    floorIndex: number;
    ambientCount: number;
    calculatedAmbientCount: number;
    compliantAmbientCount: number;
    fixtureCount: number;
    luminaires: DialuxLuminaireListItem[];
    luminaireTotals: DialuxLuminaireTotals;
}

export type DialuxAmbientLuminaireItem = DialuxLuminaireListItem;

/** Defaults fotométricos cuando el proyecto no define reflectancias/factor de mantenimiento propios. */
export const DEFAULT_REFLECTANCE_CEILING = 70;
export const DEFAULT_REFLECTANCE_WALL = 50;
export const DEFAULT_REFLECTANCE_FLOOR = 20;
export const DEFAULT_MAINTENANCE_FACTOR = 0.8;

/**
 * Campos fotométricos opcionales que un proyecto puede definir a nivel global.
 * No forman parte del contrato persistido de `Project`; se leen de forma tipada
 * (en vez de un cast inseguro a `Record<string, unknown>`) y caen a los defaults
 * de arriba cuando el proyecto no los define.
 */
export interface DialuxProjectPhotometricDefaults {
    maintenanceFactor?: number;
    reflectionCeiling?: number;
    reflectionWall?: number;
    reflectionFloor?: number;
}

export interface DialuxAmbientDetail {
    ambientId: string;
    sceneId: string;
    sceneName: string;
    floorIndex: number;
    roomId: string;
    roomName: string;
    ambientName: string;
    activity: string | null;
    area: number;
    /** Perímetro del recinto en metros (misma escala que area). */
    perimeter: number;
    /** Área del plano útil: recinto menos la zona marginal en todo el contorno. */
    usefulArea: number;
    targetLux: number;
    avgLux: number | null;
    minLux: number | null;
    maxLux: number | null;
    uniformity: number | null;
    g2: number | null;
    uniformityTarget: number | null;
    ugr: number | null;
    /** `true` cuando `ugr` viene de `Room.manualUgr`/`AmbientConfig.manualUgr` (cargado a mano) en vez del motor de posición de Guth — ver doc-comment de `Room.manualUgr`. */
    ugrIsManual: boolean;
    ugrLimit: number | null;
    /** Peor Ra/CRI entre las luminarias instaladas en el ambiente; `null` si ninguna declara CRI. */
    ra: number | null;
    /** Ra mínimo exigido por la actividad normativa asignada; `null` si no aplica o no hay actividad asignada. */
    raRequired: number | null;
    interiorHeight: number;
    /** `null` cuando el motor NO usó ninguna reflectancia real para este ambiente (warning `object-without-material-reflectance` — el cálculo corrió en luz 100% directa). Nunca mostrar un valor numérico de reserva en ese caso: ver `ambientDossier.ts`. */
    reflectionCeiling: number | null;
    reflectionWall: number | null;
    reflectionFloor: number | null;
    maintenanceFactor: number;
    /** Horas de operación diarias asumidas para "Consumo (kWh/a)" — ver `ProjectSiteSettings.dailyOperatingHours`. Default 8. */
    dailyOperatingHours: number;
    usefulPlaneHeight: number;
    marginalZone: number;
    calculationIndex: string;
    fixtureCount: number;
    totalPowerWatts: number | null;
    lumensRequired: number;
    fixtureLumens: number;
    exactQuantity: number;
    roundedQuantity: number;
    coverage: string;
    complianceLabel: string;
    planAssetId: string | null;
    isoluxAssetId: string | null;
    requirementEvaluations: RequirementEvaluation[];
    provenance: CalculationProvenance;
    warnings: CalculationWarning[];
    luminaires: DialuxAmbientLuminaireItem[];
    fixturePositions: Array<{
        id: string;
        name: string;
        productName: string;
        x: number;
        y: number;
        mountingHeight: number | null;
        brand: string | null;
        articleNumber: string | null;
        lumens: number | null;
        powerWatts: number | null;
    }>;
}

/**
 * Fase 14 ("Emergencia", plan maestro §11). Una fila del informe de
 * emergencia — un ambiente `roomType: 'evacuation-route'|'antipanic-area'`
 * con su resultado calculado en `config.emergencyMode: true` y su
 * evaluación normativa (RNE A.130 / EN 1838, SIEMPRE por separado, ver
 * `domain/calculation/emergencyCompliance.ts`). El builder ya arma este
 * objeto completo — igual que `DialuxSceneComparisonSummary` (Fase 13), sin
 * join en el backend.
 */
export interface DialuxEmergencyRoomReport {
    roomId: string;
    roomName: string;
    roomType: 'evacuation-route' | 'antipanic-area';
    levelId: string;
    levelName: string;
    /** `null` si el ambiente no tiene resultado de emergencia calculado todavía. */
    minLux: number | null;
    /** Punto más oscuro de la malla (Fase 11, `findResultExtremum`) — el "punto crítico" de esta ruta/área. `null` si no se pudo localizar. */
    criticalPoint: { x: number; y: number } | null;
    evaluations: EmergencyRequirementEvaluation[];
}

export type DialuxFormalPageKind =
    | 'cover'
    | 'preliminary-observations'
    | 'toc'
    | 'luminaire-list'
    | 'product-sheet'
    | 'terrain-cad'
    | 'terrain-drawn'
    | 'terrain-architectural'
    | 'ambient-list'
    | 'calculation-object-list'
    | 'ambient-summary'
    | 'ambient-results'
    | 'ambient-plan'
    | 'ambient-luminaires'
    | 'ambient-products'
    | 'ambient-calculation-object'
    | 'ambient-useful-plane'
    | 'room-ambient-list'
    | 'room-luminaires'
    | 'room-calculation-object'
    | 'level-luminaire-list'
    | 'lighting-scene-comparison'
    | 'emergency-cover'
    | 'emergency-compliance-table'
    | 'glossary'
    | 'placeholder';

export type DialuxFormalSectionId =
    | 'cover'
    | 'content'
    | 'preliminary-observations'
    | 'luminaire-list'
    | 'terrain'
    | 'cad-overview'
    | 'architectural-overview'
    | 'ambient-catalog'
    | 'lighting-results'
    | 'isolux'
    | 'charts'
    | 'technical-appendix'
    | 'glossary'
    | `product-sheet:${string}`
    | 'product-sheets-header'
    | 'terrain-header'
    | 'edification-header'
    | `scene-group-label-${string}`
    | `scene-group-heading-${string}`
    | `room-group-label-${string}`
    | `room-group-heading-${string}`
    | `ambient-group-label-${string}`
    | `ambient-group-heading-${string}`
    | 'ambient-list'
    | 'calculation-object-list'
    | `ambient-detail:${string}`
    | `ambient-summary:${string}`
    | `ambient-results:${string}`
    | `ambient-plan:${string}`
    | `ambient-luminaires:${string}`
    | `ambient-products:${string}`
    | `ambient-calculation-object:${string}`
    | `ambient-useful-plane:${string}`
    | `room-ambient-list:${string}`
    | `room-luminaires:${string}`
    | `room-calculation-object:${string}`
    | `level-luminaire-list:${string}`
    | 'cad-overview-luminaires'
    | 'emergency-cover'
    | 'emergency-compliance-table';

export interface DialuxTocEntry {
    sectionId: DialuxFormalSectionId;
    title: string;
    subtitle: string | null;
    level: number;
    pageNumber: number;
    kind?: 'item' | 'section-label' | 'section-heading';
    size?: 'small' | 'large';
}

export interface DialuxDocumentPage {
    id: string;
    kind: DialuxFormalPageKind;
    sectionId: DialuxFormalSectionId;
    pageNumber: number;
    title: string;
    subtitle: string | null;
    assetIds: string[];
    notes: string[];
    ambientId?: string | null;
    roomId?: string | null;
    sceneId?: string | null;
    sceneName?: string | null;
    /**
     * Rango [start, end) sobre la lista completa de luminarias del alcance
     * de esta página (proyecto o nivel), cuando esa lista se dividió en
     * varias páginas de continuación. Ausente = mostrar la lista completa.
     */
    rowRangeStart?: number | null;
    rowRangeEnd?: number | null;
    /** Fase 13: datos completos de UNA comparación de escenas (`kind: 'lighting-scene-comparison'`). El builder ya tiene el objeto a mano — sin join en el backend. */
    sceneComparison?: DialuxSceneComparisonSummary | null;
    /** Fase 14: filas del informe de emergencia (`kind: 'emergency-compliance-table'`). El builder ya tiene el objeto a mano — sin join en el backend. */
    emergencyRooms?: DialuxEmergencyRoomReport[] | null;
}

/**
 * Entrada del glosario. Catálogo propio del sistema (no transcrito de
 * DIALux) — ver `document/glossaryCatalog.ts`. Solo se incluyen en el
 * documento los términos que el propio informe efectivamente utiliza.
 */
export interface GlossaryEntry {
    letter: string;
    term: string;
    definition: string;
    abbreviation?: string | null;
}

/** Versión del contrato del documento formal. Laravel rechaza valores no soportados. */
export const DIALUX_FORMAL_DOCUMENT_SCHEMA_VERSION = 1 as const;

export interface DialuxFormalDocument {
    formatVersion: '1.0.0';
    schemaVersion: typeof DIALUX_FORMAL_DOCUMENT_SCHEMA_VERSION;
    title: string;
    subtitle: string;
    fileBaseName: string;
    generatedAt: string;
    paper: {
        format: 'A4';
        orientation: 'portrait';
    };
    header: {
        title: string;
        subtitle: string;
    };
    footer: {
        left: string;
        right: string;
    };
    metadata: Array<{ label: string; value: string }>;
    pages: DialuxDocumentPage[];
    toc: DialuxTocEntry[];
    luminaires: DialuxLuminaireListItem[];
    luminaireTotals: DialuxLuminaireTotals;
    levels: DialuxLevelSummary[];
    ambientDetails: DialuxAmbientDetail[];
    assets: DialuxExportAsset[];
    glossary: GlossaryEntry[];
}

export interface DialuxFormalPdfPayload {
    document: DialuxFormalDocument;
}

export interface DialuxPdfRenderOptions {
    autoPrint?: boolean;
    targetWindow?: Window | null;
}

export interface DialuxPdfRenderResult {
    html: string;
    mode: 'print-dialog';
}

export interface DialuxPdfRenderer {
    render(
        document: DialuxExportDocument,
        options?: DialuxPdfRenderOptions,
    ): Promise<DialuxPdfRenderResult>;
}
