/**
 * types.ts — Tipos de dominio del editor DIAlux
 *
 * Separados del store para permitir:
 *   1. Importarlos sin arrastrar la lógica del store.
 *   2. Reutilizarlos en Rust/WASM bridge y en tests.
 *   3. Compilación más rápida (menos interdependencias).
 */

// ─── Herramientas y UI ────────────────────────────────────────────────────────

export type DrawTool =
    | 'select' | 'room' | 'wall' | 'window' | 'door' | 'canopy' | 'corridor'
    | 'fixture' | 'fixture-grid' | 'measure' | 'pan' | 'calibrate';

export type SidebarTab = 'catalog' | 'objects' | 'properties' | 'results';
export type IsoluxMode = 'functional' | 'waves' | 'temperature';
export type AngleSnapMode = 'smart' | 'free' | 'orthogonal' | 'diagonal';

// ─── Geometría 2D ─────────────────────────────────────────────────────────────

export interface ScaleConfig {
    unit: 'mm' | 'cm' | 'm';
    factor: number;      // Multiply DXF units by this to get meters. (e.g. if unit is mm, factor is 0.001)
    displayUnit: string;
    calibrationFactor: number;
    isCalibrated: boolean;
}

export interface Vertex { x: number; y: number }

export interface AmbientConfig {
    name?: string;
    activity?: string;
}

/** Recinto (espacio cerrado con polígono arbitrario) */
export interface Room {
    id: string;
    name: string;
    roomType?: 'room' | 'corridor';
    /** Polígono arbitrario en metros en el plano XY de la escena */
    vertices: Vertex[];
    height: number;        // metros
    color: string;
    illuminanceLux?: number;
    fixtureLumens?: number;
    normativeStandard?: 'en_12464' | 'ies_na' | 'rne_peru';
    normativeCategory?: string;
    normativeSection?: string;
    normativeActivity?: string;
    normativeLabel?: string;
    ugrLimit?: number | null;
    uniformityTarget?: number | null;
    colorRenderingRa?: number | null;
    specificRequirements?: string | null;
    usefulPlaneHeight?: number | null;
    marginalZone?: number | null;
    norma?: number;        // Nivel de lux requerido (EN 12464-1)
    fixtureFlux?: number;  // Lúmenes de la luminaria seleccionada (cálculo teórico)
    ambientConfigs?: Record<string, AmbientConfig>;
}

/** Pared: polilínea en planta */
export interface Wall {
    id: string;
    vertices: Vertex[];  // ≥ 2 puntos, en metros
    thickness: number;   // metros (default 0.20)
    height: number;      // metros (default 2.80)
    material?: 'brick' | 'adobe';
    normativeUse?: 'housing' | 'generic';
    mortarJointMin?: number;
    mortarJointMax?: number;
}

/** Ventana colocada sobre una pared */
export interface Window {
    id: string;
    wallId: string;
    offsetAlongWall: number;  // metros desde el inicio de la pared
    width: number;            // metros
    height: number;           // metros
    sillHeight: number;       // altura del antepecho en metros (default 0.90)
    windowType?: 'fixed' | 'sliding' | 'casement' | 'awning' | 'bathroom';
    windowShape?: 'rectangular' | 'arched' | 'circular';
    /** Si true, el offset se recalcula automáticamente al centro de la pared */
    centered?: boolean;
}

/** Puerta colocada sobre una pared */
export interface Door {
    id: string;
    wallId: string;
    offsetAlongWall: number;   // metros desde el inicio de la pared
    width: number;             // metros (default 0.90)
    height: number;            // metros (default 2.10)
    doorType?: 'single' | 'double' | 'sliding' | 'folding';
    openingDirection?: 'inward' | 'outward';
    /** Lado donde está la bisagra: 'left' = inicio de la pared, 'right' = fin */
    hingeDirection?: 'left' | 'right';
    openingAngle?: number;     // grados (default 90)
    /** Si true, el offset se recalcula automáticamente al centro de la pared */
    centered?: boolean;
}

/** Voladizo / alero */
export interface Canopy {
    id: string;
    x1: number; y1: number;  // punto de anclaje al muro (metros)
    x2: number; y2: number;  // extremo libre (metros)
    width: number;           // anchura a lo largo del muro (metros)
    slabThickness: number;   // grosor de losa (metros, default 0.15)
    height: number;          // altura de montaje desde el suelo (metros)
}

/** Luminaria */
export interface Fixture {
    id: string;
    name: string;
    x: number; y: number; z: number;  // posición en metros en la escena
    lumens: number;
    power?: number;
    efficiency: number;  // 0-1, factor de aprovechamiento
    fixtureType: 'recessed' | 'pendant' | 'surface' | 'spot' | 'strip' | 'panel' | 'tube';
    fixtureShape?: 'round' | 'square' | 'rectangular' | 'cylindrical';
    dimensions?: { length: number; width: number; height: number }; // En metros
    brand?: string;
    articleNumber?: string;
    productId?: number;
    productSourceFormat?: string;
    lightColor: string;  // hex, e.g. '#fff5e1' blanco cálido
    wallId?: string;     // opcional: ID de la pared donde está colocada (para drag/drop)
    roomId?: string;     // opcional: ID del recinto al que pertenece
    gridGroupId?: string; // opcional: ID de grupo de grilla para conectar visualmente
    cct?: number | null;
    cri?: number | null;
    description?: string | null;
    applications?: string | null;
    reportData?: {
        technical_table?: Array<{ label: string; value: string }>;
        warnings?: string[];
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

/** Configuración para inserción de grilla de luminarias */
export interface FixtureGridConfig {
    rows: number;                       // filas de focos (≥1)
    columns: number;                    // columnas de focos (≥1)
    roomId: string;                     // recinto donde se coloca la grilla
    fixtureTemplate: Partial<Fixture>;  // template para cada foco
    mountingHeight?: number;            // altura de montaje (default 2.7m)
    ambientVertices?: Vertex[];         // vértices del ambiente derivado (si se omite, usa room.vertices)
}

// ─── Cálculos de Iluminación (Lighting Calculations) ───────────────────────

/** Cálculo de iluminación para un recinto específico */
export interface RoomLightingCalculation {
    id: string;
    roomId: string;
    name: string;
    
    // Entrada: Datos del recinto
    area: number;                    // m², calculada del polígono
    scaledUnit: 'mm' | 'cm' | 'm';  // unidad de medida escalada
    normaLux: number;               // 200, 300, o 500 lux (EN 12464-1)
    
    // Paso 1: Cálculo de lúmenes requeridos
    lumensRequired: number;          // ((area * normaLux) / 0.8) / 0.99
    
    // Entrada: Tipo de luminaria seleccionada
    fixtureType: string;            // nombre o modelo de la luminaria
    fixtureLumens: number;          // lumenes del foco seleccionado
    
    // Paso 2: Cantidad de luminarias
    exactQuantity: number;          // lumensRequired / fixtureLumens
    roundedQuantity: number;        // CEIL(exactQuantity)
    
    // Paso 3: Recomendación final del usuario
    recommendedQuantity: number;    // cantidad que el usuario finalmente considera
    
    // Resultado: Resumen
    uniformityEstimate?: number;    // estimación de uniformidad (0-1)
    coverage?: 'optimal' | 'insufficient' | 'excessive';
    
    // Metadata
    createdAt: string;
    updatedAt: string;
}

/** Colección de cálculos por módulo (cada módulo tiene al menos un recinto) */
export interface ModuleLightingCalculations {
    id: string;
    moduleName: string;
    calculations: RoomLightingCalculation[];
}

// ─── Escena ───────────────────────────────────────────────────────────────────

export interface Scene {
    id: string;
    name: string;
    scaleConfig: ScaleConfig;
    rooms: Room[];
    walls: Wall[];
    windows: Window[];
    doors: Door[];
    canopies: Canopy[];
    fixtures: Fixture[];
}

// ─── Proyecto ─────────────────────────────────────────────────────────────────

export interface Project {
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
    scenes: Scene[];
}

// ─── Resultados lumínicos ─────────────────────────────────────────────────────

export interface LightingResult {
    avg_lux: number;
    min_lux: number;
    max_lux: number;
    uniformity: number;
    ugr: number;
    grid_rows: number;
    grid_cols: number;
    grid_values: Array<number | null>;
    grid_active?: boolean[];
    grid_origin_x?: number;
    grid_origin_y?: number;
    grid_cell_width?: number;
    grid_cell_height?: number;
    room_vertices?: Vertex[];
    useful_plane_height?: number;
    marginal_zone?: number;
}

// ─── Entidades DXF ────────────────────────────────────────────────────────────

export interface DxfLineEntity {
    id: string; type: 'line';
    x1: number; y1: number; x2: number; y2: number;
    layer: string;
}

export interface DxfPolylineEntity {
    id: string; type: 'polyline';
    vertices: [number, number][];
    closed: boolean;
    layer: string;
}

export interface DxfCircleEntity {
    id: string; type: 'circle';
    cx: number; cy: number; r: number;
    layer: string;
}

export interface DxfArcEntity {
    id: string; type: 'arc';
    cx: number; cy: number; r: number;
    start_angle: number; end_angle: number;
    layer: string;
}

export interface DxfEllipseEntity {
    id: string; type: 'ellipse';
    cx: number; cy: number;
    major_x: number; major_y: number;
    minor_ratio: number;
    start_param: number; end_param: number;
    layer: string;
}

export interface DxfTextEntity {
    id: string; type: 'text';
    x: number; y: number;
    text: string; height: number; rotation: number;
    layer: string;
}

export interface DxfPointEntity {
    id: string; type: 'point';
    x: number; y: number;
    layer: string;
}

export interface DxfRectangleEntity {
    id: string; type: 'rectangle';
    x: number; y: number;
    width: number; height: number; rotation: number;
    layer: string;
}

export interface DxfPolygonEntity {
    id: string; type: 'polygon';
    vertices: [number, number][];
    closed: boolean;
    layer: string;
}

export interface DxfHatchEntity {
    id: string; type: 'hatch';
    pattern_name: string; solid: boolean;
    boundary_paths: [number, number][][];
    layer: string;
}

export interface DxfSplineEntity {
    id: string; type: 'spline';
    control_points: [number, number][];
    closed: boolean; degree: number;
    layer: string;
}

export interface DxfSolidEntity {
    id: string; type: 'solid';
    vertices: [number, number][];
    layer: string;
}

export type DxfEntity =
    | DxfLineEntity | DxfPolylineEntity | DxfCircleEntity
    | DxfArcEntity  | DxfEllipseEntity  | DxfTextEntity
    | DxfPointEntity | DxfRectangleEntity | DxfPolygonEntity
    | DxfHatchEntity | DxfSplineEntity   | DxfSolidEntity;

export interface DxfExtents {
    min_x: number; min_y: number;
    max_x: number; max_y: number;
}
