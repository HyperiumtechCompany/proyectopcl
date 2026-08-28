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

/**
 * Porcentajes/montos reales del presupuesto del proyecto (tabla
 * gg_consolidado, la misma fuente que usa Delphin/Consolidado) — se usan
 * como valores iniciales de la sección "Resumen Financiero" del valorizado
 * en vez de placeholders fijos. Siguen siendo editables ahí (clic en la
 * celda), esto solo evita arrancar con un % que no es el real del proyecto.
 */
export interface ComponenteExtra {
    id:    string;
    name:  string;
    monto: number;
}

/**
 * "amarillo" y "rojo" replican la nomenclatura del Excel de referencia
 * (plan_valorizado_compatibilidad.md):
 *  - amarillo: se SUMA al Presupuestado de Obra (Componente I+II+extra) para
 *    formar "Presupuesto Sub Total". Todos los amarillos comparten esa misma
 *    base (no son cascada entre sí).
 *  - rojo: % (o monto) aplicado sobre "Presupuesto Sub Total" — es decir,
 *    YA con los amarillos sumados. Todos los rojos normales comparten esa
 *    base entre sí (tampoco cascada entre ellos).
 *  - rojo_final: un escalón más allá — aplicado sobre el resultado de sumar
 *    los rojos normales (ej. Control Concurrente, que en el Excel se calcula
 *    sobre el "Presupuesto Total" intermedio, no sobre el Sub Total).
 * tipo ('porcentaje' | 'monto') es independiente de la categoría: un
 * amarillo puede ser monto fijo (ej. costo real de elaborar el expediente
 * técnico) o porcentaje, igual que un rojo.
 * Por compatibilidad con datos guardados antes de que existiera este campo,
 * `categoria` es opcional — ausente se trata como 'rojo' (ver TablaValorizada.tsx).
 */
export type CategoriaConcepto = 'amarillo' | 'rojo' | 'rojo_final';

export interface ConceptoAdicional {
    id: string;
    name: string;
    tipo: 'porcentaje' | 'monto';
    valor: number;
    categoria?: CategoriaConcepto;
}

export interface FinDefaults {
    pctGastosGenerales?: number;
    pctUtilidad?:        number;
    pctIGV?:             number;
    montoMobiliario?:    number;
    pctIGVMobiliario?:   number;
    pctSupervision?:     number;
    componentesExtra?:   ComponenteExtra[];
    conceptosAdicionales?: ConceptoAdicional[];
}

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
    jerarquiaPresupuesto?: Record<string, string>;
    projectData?: any;
     materiales?: any[];           // Datos de materiales
    materialesResumen?: any;
    finDefaults?: FinDefaults;
}
