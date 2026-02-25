/**
 * Tipos compartidos para el módulo de Cálculo de Agua (calc-agua).
 * Usados en TuberiasRD, RedesInteriores y RedRiego.
 */

// ─── Enumeraciones y literales ────────────────────────────────────────────────

export type Grado = 'inicial' | 'primaria' | 'secundaria';

export type AccesorioTipo =
    | 'codo45'
    | 'codo90'
    | 'tee'
    | 'valCompuerta'
    | 'valCheck'
    | 'canastilla'
    | 'reduccion1'
    | 'reduccion2';

/** Campos de accesorios en la tabla (nombre de columna → tipo de accesorio) */
export type AccesorioKey = 'codo90' | 'tee' | 'val_compuerta' | 'reduccion2';

// ─── Datos de tabla ───────────────────────────────────────────────────────────

export interface DiametroOption {
    label: string;
    value: number; // pulgadas
}

/** Una fila de la tabla hidráulica (Tabulator row) */
export interface FilaTabla {
    id: string | number;
    /** Si es true, es la fila estática de encabezado del módulo (no editable/eliminable) */
    isStatic?: boolean;

    // Identificación del segmento
    segmento: string;
    punto: string;

    // Cota con soporte de fórmulas (prefijo "=")
    cota: number | string;
    rawCota?: string | null;

    // Unidades hidráulicas
    uh_parcial: number | string;
    uh_total: number | string;
    caudal: number | string;

    // Geometría
    longitud: number | string;
    diametro: string; // label: "2 1/2 pulg", etc.

    // Accesorios (cantidad × longitud equivalente)
    n1: number | string;
    codo90: number | string;
    n2: number | string;
    tee: number | string;
    n3: number | string;
    val_compuerta: number | string;
    n4: number | string;
    reduccion2: number | string;
    longitudtotal: number | string;

    // Parámetros hidráulicos Hazen-Williams
    coefrug: number | string;
    s: number | string;       // gradiente hidráulico (m/m)
    hf: number | string;      // pérdida de carga (m)
    hpiez: number | string;   // altura piezométrica (m)
    velocidad: number | string; // m/s
    presion: number | string; // mca

    // Verificaciones de diseño
    verificacion1: string; // velocidad: 'cumple' | 'no cumple' | ''
    verificacion2: string; // presión:   'cumple' | 'no cumple' | ''
}

// ─── Módulos y tablas ─────────────────────────────────────────────────────────

/** Un módulo (circuito) dentro de un grado educativo */
export interface Modulo {
    id: number;
    nombre: string;
    data: FilaTabla[];
}

/** Estado de la tabla de un grado (expansión + módulos) */
export interface TabulatorGradeState {
    modules: Modulo[];
    expanded: boolean;
}

/** Configuración de qué accesorio representa cada columna (cambios por header filter) */
export interface AccesoriosConfig {
    codo90: string;       // AccesorioTipo actual en columna codo90
    tee: string;          // AccesorioTipo actual en columna tee
    val_compuerta: string;
    reduccion2: string;
}

/** Configuración de nivel del tanque (compartida TuberiasRD / RedesInteriores / RedRiego) */
export interface TanqueConfig {
    npisoterminado: number;
    altasumfondotanqueelevado: number;
}

// ─── Propagación entre capítulos ─────────────────────────────────────────────

/** Datos que viajan desde MaximaDemandaSimultanea a los tabs hidráulicos */
export interface MaximaDemandaPayload {
    grades: Record<Grado, boolean>;
    totals: {
        totalUDPorGrado: Partial<Record<Grado, number>>;
    };
    exterioresData: Record<string, {
        nombre?: string;
        uhTotal?: number;
        salidasRiego?: number;
        uh?: number;
    }>;
}

/** Props comunes a todos los tabs de tabulator hidráulico */
export interface TabHidraulicoProps {
    initialData?: Record<string, any>;
    canEdit: boolean;
    editMode: boolean;
    onChange?: (data: any) => void;
    maximaDemandaData?: MaximaDemandaPayload;
}
