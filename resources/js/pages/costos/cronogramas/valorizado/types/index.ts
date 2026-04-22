// ─────────────────────────────────────────────────────────────────────────────
// TIPOS PARA CRONOGRAMA VALORIZADO
// ─────────────────────────────────────────────────────────────────────────────

export interface Periodo {
    label:    string;   // "MES 1"
    labelCal: string;   // "Abr 2026"
    key:      string;   // "2026-04"
}

export interface DistribucionMes {
    monto:      number;   // S/. distribuido ese mes
    porcentaje: number;   // % sobre el parcial
}

export interface ItemValorizado {
    id:          number;
    item:        string;
    descripcion: string;
    und:         string;
    metrado:     number;
    precio:      number;
    parcial:     number;
    is_leaf:     boolean;
    distribucion: Record<string, DistribucionMes>;   // key = "2026-04"
}

export interface TotalesColumna {
    monto:               number;
    porcentaje:          number;   // % mensual sobre totalPresupuesto
    acumuladoMonto:      number;
    acumuladoPorcentaje: number;   // Curva S
}

export interface ResumenProyecto {
    total_partidas:    number;
    presupuesto_total: number;
    duracion_meses:    number;
    mes_pico:          string | null;
    monto_mes_pico:    number;
    pct_mes_pico:      number;
}

export type ViewMode = 'monto' | 'porcentaje';

export interface ValorizadoProps {
    project:          string;
    projectName:      string;
    items:            ItemValorizado[];
    periodos:         Periodo[];
    totalPresupuesto: number;
    resumen:          ResumenProyecto;
    sinGantt?:        boolean;
    estaGuardado?:    boolean;
}