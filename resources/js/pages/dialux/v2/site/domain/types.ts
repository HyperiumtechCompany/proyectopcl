// ── Geolocalización ──────────────────────────────
export interface GeoLocation {
    lat: number;
    lon: number;
    displayName: string;
    boundingBox?: [number, number, number, number];
    zoneType?: string;
}

// ── Elementos del emplazamiento ──────────────────
export type SiteElementType =
    | 'terrain' // Polígono del terreno/lote completo
    | 'building_block' // Bloque de edificación → referencia DialuxModule
    | 'street' // Calle, vereda, pasaje
    | 'green_area' // Grass, jardín, parque
    | 'fence' // Cerco perimetral, muro
    | 'pool' // Piscina
    | 'ramp' // Rampa con inclinación
    | 'court' // Cancha deportiva
    | 'parking' // Estacionamiento
    | 'tg_location' // Tablero General (posicionado por el cliente)
    | 'transformer' // Subestación / transformador
    | 'pole' // Poste de alumbrado exterior
    | 'gate' // Puerta / portón de acceso
    | 'custom_zone'; // Zona personalizada

export interface Point2D {
    x: number;
    y: number;
}

export interface SiteElementStyle {
    fillColor: string;
    strokeColor: string;
    strokeWidth?: number;
    opacity?: number;
    pattern?: 'solid' | 'hatch' | 'dots' | 'grass' | 'water';
}

export interface SiteElement {
    id: string;
    type: SiteElementType;
    label: string;
    vertices: Point2D[]; // Polígono o polilínea
    heightM?: number; // Altura (cercos, edificios para 3D)
    rotation?: number; // Grados
    moduleId?: number; // → DialuxModule.id si es building_block
    moduleName?: string; // Nombre del módulo referenciado
    locked?: boolean; // No editable (para bloques importados)
    visible?: boolean; // Toggle visibilidad
    zIndex?: number; // Orden de apilamiento
    style: SiteElementStyle;
    metadata?: Record<string, unknown>;
}

// ── Trazado de alimentadores ─────────────────────
export interface FeederPath {
    id: string;
    networkEdgeId: string; // → ElectricalEdge.id en la red
    waypoints: Point2D[]; // Puntos del recorrido sobre el terreno
    calculatedLengthM: number; // Longitud total del recorrido
    label?: string;
    style?: {
        color: string; // verde/naranja/rojo según ΔU
        dashArray?: string;
    };
}

export interface SiteLayer {
    id: string;
    label: string;
    types: SiteElementType[]; // qué tipos pertenecen a esta capa
    visible: boolean;
    locked: boolean;
}

// ── Documento principal ──────────────────────────
export interface SiteData {
    schemaVersion: 1;
    location?: GeoLocation;
    terrainScaleM: number; // metros por unidad de coordenada
    gridSizeM: number; // tamaño de cuadrícula visible
    canvasWidth: number; // ancho del canvas en unidades
    canvasHeight: number; // alto del canvas en unidades
    elements: SiteElement[];
    feederPaths: FeederPath[];
    layers: SiteLayer[];
}

// ── Herramientas del editor ──────────────────────
export type SiteTool =
    | 'select'
    | 'pan'
    | 'draw_polygon'
    | 'draw_polyline'
    | 'draw_rect'
    | 'place_block'
    | 'place_tg'
    | 'draw_feeder'
    | 'measure';
