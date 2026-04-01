// ─────────────────────────────────────────────
// TIPOS COMPARTIDOS — ETTP
// ─────────────────────────────────────────────

/** Sección editable del panel lateral */
export interface Section {
    id?: number;
    title: string;
    slug?: string;
    content: string;
    origen?: string;
    orden?: number;
    imagenes?: ImagenData[];
}

/** Datos de imagen */
export interface ImagenData {
    id: number;
    nombre_archivo: string;
    nombre_original: string;
    caption?: string;
    url: string;
    orden: number;
}

/** Partida ETTP del servidor */
export interface EttpPartidaData {
    id: number;
    item: string;
    partida?: string;
    descripcion: string;
    unidad?: string;
    especialidad?: string;
    estado?: string;
    huerfano?: boolean;
    nivel?: number;
    secciones?: Section[];
    _children?: EttpPartidaData[];
    detallesTecnicos?: Record<string, any>;
    metrado?: string | number;
}

/** Props del componente principal */
export interface EttpPageProps {
    proyecto?: {
        id: number;
        nombre: string;
        plantilla_logo_izq_url?: string | null;
        plantilla_logo_der_url?: string | null;
        portada_logo_center_url?: string | null;
        plantilla_firma_url?: string | null;
    };
    partidas?: EttpPartidaData[];
    especialidades?: EspecialidadInfo[];
}

/** Info de especialidad disponible */
export interface EspecialidadInfo {
    nombre: string;
    tabla: string;
    total: number;
    disponible: boolean;
}

/** Checkbox state de secciones seleccionadas */
export interface SelectedSections {
    estructura: boolean;
    arquitectura: boolean;
    sanitarias: boolean;
    electricas: boolean;
    comunicaciones: boolean;
    gas: boolean;
}

/** Campos del JSON de templates a excluir (metadatos, no contenido técnico) */
export const CAMPOS_EXCLUIDOS_TEMPLATE = [
    'codigo',
    'codigo_completo',
    'nivel',
    'subpartidas',
    'titulo',
    'unidad_medida',
    'codigo_original',
    'autogenerado',
];

/** Secciones por defecto al crear una partida */
export const SECCIONES_DEFAULT: Omit<Section, 'id'>[] = [
    { title: 'Descripción', slug: 'descripcion', content: '', orden: 1 },
    { title: 'Materiales y Herramientas', slug: 'materiales', content: '', orden: 2 },
    { title: 'Método de Ejecución', slug: 'metodo_ejecucion', content: '', orden: 3 },
    { title: 'Método de Medición', slug: 'metodo_medicion', content: '', orden: 4 },
    { title: 'Condiciones de Pago', slug: 'condiciones_pago', content: '', orden: 5 },
];

/** Mapeo de especialidad → label para UI */
export const ESPECIALIDADES_CONFIG = [
    { key: 'estructura' as const, label: '🏗️ Estructuras', desc: 'Metrados de concreto y acero' },
    { key: 'arquitectura' as const, label: '🏛️ Arquitectura', desc: 'Acabados y elementos arquitectónicos' },
    { key: 'sanitarias' as const, label: '🚰 Inst. Sanitarias', desc: 'Agua y desagüe' },
    { key: 'electricas' as const, label: '⚡ Inst. Eléctricas', desc: 'Iluminación y fuerza' },
    { key: 'comunicaciones' as const, label: '📡 Comunicaciones', desc: 'Datos y telefonía' },
    { key: 'gas' as const, label: '🔥 Inst. de Gas', desc: 'Redes de gas natural' },
];

/** Mapeo de key → label para Word */
export const SECTION_LABELS: Record<string, string> = {
    estructura: 'ESTRUCTURAS',
    arquitectura: 'ARQUITECTURA',
    sanitarias: 'INSTALACIONES SANITARIAS',
    electricas: 'INSTALACIONES ELECTRICAS',
    comunicaciones: 'INSTALACIONES DE COMUNICACIONES',
    gas: 'INSTALACIONES DE GAS',
};

/** Mapeo de campos JSON → títulos legibles */
export const FIELD_MAPPING = [
    { jsonKey: 'descripción', title: 'Descripción' },
    { jsonKey: 'descripcion', title: 'Descripción' },
    { jsonKey: 'materiales,_herramientas_y/o_equipos', title: 'Materiales y Herramientas' },
    { jsonKey: 'materiales,_herramientas_y_/o_equipos', title: 'Materiales y Herramientas' },
    { jsonKey: 'materiales,_equipos_y/o_herramientas', title: 'Materiales y Herramientas' },
    { jsonKey: 'materiales', title: 'Materiales' },
    { jsonKey: 'método_de_ejecución', title: 'Método de Ejecución' },
    { jsonKey: 'metodo_de_ejecucion', title: 'Método de Ejecución' },
    { jsonKey: 'método_de_medición', title: 'Método de Medición' },
    { jsonKey: 'metodo_de_medicion', title: 'Método de Medición' },
    { jsonKey: 'condiciones_de_pago', title: 'Condiciones de Pago' },
    { jsonKey: 'condición_de_pago', title: 'Condiciones de Pago' },
];
