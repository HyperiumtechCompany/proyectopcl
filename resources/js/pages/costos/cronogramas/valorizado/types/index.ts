export interface Periodo {
    label:    string;
    labelCal: string;
    key:      string;
}

export interface DistribucionMes {
    monto:      number;
    porcentaje: number;
}

export interface ItemValorizado {
    parent_id:    any;
    id:           number | string;
    item:         string;
    descripcion:  string;
    und:          string;
    metrado:      number;
    precio:       number;
    parcial:      number;
    is_leaf:      boolean;
    distribucion: Record<string, DistribucionMes>;
    // Fechas reales del Gantt — para bloquear celdas fuera de rango
    start_date?:  string | null;
    end_date?:    string | null;
    // Total calculado 
    total_monto?: number;
}

export interface TotalesColumna {
    monto:               number;
    porcentaje:          number;
    acumuladoMonto:      number;
    acumuladoPorcentaje: number;
}

export interface ResumenProyecto {
    total_partidas:    number;
    presupuesto_total: number;
    duracion_meses:    number;
    mes_pico:          string | null;
    mes_pico_key:      string | null;
    monto_mes_pico:    number;
    pct_mes_pico:      number;
}

export type ViewMode = 'monto' | 'porcentaje';

/**
 * Modo de cálculo de períodos:
 *  - 'calendario' → corte al último día de cada mes (Regla de Ejecución)
 *  - '30dias'     → bloques exactos de 30 días    (Regla de Inicialización)
 */
export type ModoCalculo = 'calendario' | '30dias';

export interface ValorizadoProps {
    project:          string;
    projectName:      string;
    items:            ItemValorizado[];
    periodos:         Periodo[];
    totalPresupuesto: number;
    resumen:          ResumenProyecto;
    sinGantt?:        boolean;
    estaGuardado?:    boolean;
    diasPorMes?:      Record<string, number>;
    modoCalculo?:     ModoCalculo;
    projectData?: any;
}