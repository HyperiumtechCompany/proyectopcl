// ─────────────────────────────────────────────────────────────────────────────
// TIPOS PARA CRONOGRAMA DE MATERIALES
// ─────────────────────────────────────────────────────────────────────────────

export interface Periodo {
    label: string;   // "Abr 2026"
    key:   string;   // "2026-04"
}

export interface Material {
    descripcion:    string;
    unidad:         string;
    precio:         number;
    cantidad_total: number;
    presupuesto:    number;
    mensual:        Record<string, number>;  // key = "2026-04", value = cantidad
}

export interface ResumenProyecto {
    total_materiales:   number;
    presupuesto_total:  number;
    duracion_meses:     number;
    mes_pico:           string | null;
    monto_mes_pico:     number;
    total_partidas:     number;
}

export interface CronogramaProps {
    project:      string;
    projectName?: string;
    materiales:   Material[];
    periodos:     Periodo[];
    resumen:      ResumenProyecto;
    estaGuardado: boolean;
    sinGantt?:    boolean;
}

export type ViewMode   = 'cantidad' | 'monto';
export type SortField  = 'descripcion' | 'precio' | 'cantidad_total' | 'presupuesto';
export type SortDir    = 'asc' | 'desc';

export interface FiltroState {
    busqueda:   string;
    soloConCant: boolean;
}