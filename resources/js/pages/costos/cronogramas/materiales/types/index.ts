// ─────────────────────────────────────────────────────────────────────────────
// TIPOS PARA CRONOGRAMA DE MATERIALES (VERSIÓN PROFESIONAL)
// ─────────────────────────────────────────────────────────────────────────────

export interface Periodo {
    label: string;      // "MES 1"
    labelCal: string;   // "May 2026"
    key: string;        // "2026-05"
}

export interface DistribucionMensual {
    cantidad: number;
    monto: number;
}

export interface MaterialItem {
    partida_origen: string;
    descripcion: string;
    unidad: string;
    tipo: 'mano_de_obra' | 'materiales' | 'equipos' | 'subcontratos' | 'otros';
    precio: number;
    cantidad_total: number;
    costo_total: number;
    distribucion: Record<string, DistribucionMensual>;
}

export interface MaterialesPorTipo {
    mano_de_obra: MaterialItem[];
    materiales: MaterialItem[];
    equipos: MaterialItem[];
    subcontratos: MaterialItem[];
    otros: MaterialItem[];
}

export interface ResumenProyecto {
    total_materiales: number;
    presupuesto_total: number;
    duracion_meses: number;
    mes_pico: string | null;
    mes_pico_key: string | null;
    monto_mes_pico: number;
    total_partidas: number;
}

export interface CronogramaProps {
    project: string;
    projectName?: string;
    materiales: MaterialItem[];           // Versión plana (todos los materiales)
    materialesPorTipo?: MaterialesPorTipo; // Versión agrupada por tipo
    periodos: Periodo[];
    resumen: ResumenProyecto;
    estaGuardado: boolean;
    sinGantt?: boolean;
}

export type ViewMode = 'cantidad' | 'monto';
export type SortField = 'descripcion' | 'precio' | 'cantidad_total' | 'costo_total';
export type SortDir = 'asc' | 'desc';

export interface FiltroState {
    busqueda: string;
    soloConCant: boolean;
    tipoFiltro?: string;  // nuevo: filtrar por tipo de material
}

// Helper para obtener el monto mensual de un material
export const getMontoMensual = (material: MaterialItem, key: string): number => {
    return material.distribucion[key]?.monto ?? 0;
};

// Helper para obtener la cantidad mensual de un material
export const getCantidadMensual = (material: MaterialItem, key: string): number => {
    return material.distribucion[key]?.cantidad ?? 0;
};