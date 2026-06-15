// ─────────────────────────────────────────────────────────────────────────────
// TIPOS — CRONOGRAMA DE MATERIALES (Ingeniería Civil)
// ─────────────────────────────────────────────────────────────────────────────

export interface Periodo {
    label:    string;   // "MES 1"
    labelCal: string;   // "May 2026"
    key:      string;   // "2026-05"
}

export interface DistribucionMensual {
    cantidad: number;
    monto:    number;
}

export type TipoInsumo =
    | 'mano_de_obra'
    | 'materiales'
    | 'equipos'
    | 'subcontratos'
    | 'subpartidas'
    | 'otros';

export interface MaterialItem {
    partida_origen: string;
    descripcion_partida?: string;
    descripcion:    string;
    unidad:         string;
    tipo:           TipoInsumo;
    precio:         number;
    cantidad_total: number;
    costo_total:    number;
    distribucion:   Record<string, DistribucionMensual>;
}

export interface MaterialesPorTipo {
    mano_de_obra:  MaterialItem[];
    materiales:    MaterialItem[];
    equipos:       MaterialItem[];
    subcontratos:  MaterialItem[];
    subpartidas:   MaterialItem[];
    otros:         MaterialItem[];
}

export interface ResumenProyecto {
    total_materiales:  number;
    presupuesto_total: number;
    duracion_meses:    number;
    mes_pico:          string | null;
    mes_pico_key:      string | null;
    monto_mes_pico:    number;
    total_partidas:    number;
}

export interface CronogramaProps {
    project:            string;
    projectName?:       string;
    materiales:         MaterialItem[];
    materialesPorTipo?: MaterialesPorTipo;
    periodos:           Periodo[];
    resumen:            ResumenProyecto;
    estaGuardado:       boolean;
    sinGantt?:          boolean;
    projectData:        any;
    sinLayout?:         boolean;
}

export type ViewMode  = 'cantidad' | 'monto';
export type SortField = 'descripcion' | 'precio' | 'cantidad_total' | 'costo_total';
export type SortDir   = 'asc' | 'desc';

export interface FiltroState {
    busqueda:    string;
    soloConCant: boolean;
    tipoFiltro?: string;
}

export interface CurvaSPoint {
    mes:        string;
    key:        string;
    mensual:    number;
    acumulado:  number;
    porcentaje: number;
}

export const TIPO_META: Record<string, {
    label:      string;
    emoji:      string;
    bg:         string;
    text:       string;
    border:     string;
    headerBg:   string;
    headerArgb: string;
}> = {
    mano_de_obra: {
        label: 'Mano de Obra', emoji: '👷',
        bg: '#fff7ed', text: '#c2410c', border: '#fed7aa',
        headerBg: '#ea580c', headerArgb: 'FFEA580C',
    },
    materiales: {
        label: 'Materiales', emoji: '🧱',
        bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe',
        headerBg: '#2563eb', headerArgb: 'FF2563EB',
    },
    equipos: {
        label: 'Equipos', emoji: '⚙️',
        bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe',
        headerBg: '#7c3aed', headerArgb: 'FF7C3AED',
    },
    subcontratos: {
        label: 'Subcontratos', emoji: '🤝',
        bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0',
        headerBg: '#16a34a', headerArgb: 'FF16A34A',
    },
    subpartidas: {
        label: 'Subpartidas', emoji: '📐',
        bg: '#f0fdfa', text: '#0f766e', border: '#99f6e4',
        headerBg: '#0d9488', headerArgb: 'FF0D9488',
    },
    otros: {
        label: 'Otros', emoji: '📦',
        bg: '#f8fafc', text: '#475569', border: '#cbd5e1',
        headerBg: '#64748b', headerArgb: 'FF64748B',
    },
};

export const getTipoMeta = (tipo: string) => TIPO_META[tipo] ?? TIPO_META['otros'];

export const getMontoMensual = (m: MaterialItem, key: string): number =>
    m.distribucion[key]?.monto ?? 0;

export const getCantidadMensual = (m: MaterialItem, key: string): number =>
    m.distribucion[key]?.cantidad ?? 0;

export const fmtSoles = (v: number) =>
    `S/. ${v.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtSolesCurrency = (v: number) =>
    new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(v);

export const fmtNum = (v: number, dec = 2) =>
    v.toLocaleString('es-PE', { minimumFractionDigits: dec, maximumFractionDigits: dec });