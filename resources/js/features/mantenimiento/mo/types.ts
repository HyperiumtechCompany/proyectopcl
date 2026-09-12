export type MoRowTipo = 'ie' | 'bloque' | 'partida';

export interface MoEtCot {
    cantidad: string | null;
    precio: string | null;
    parcial: string;
}

export interface MoRow {
    partida_id: string;
    parent_id: string | null;
    institucion_id: number | null;
    tipo: MoRowTipo;
    item: string | null;
    item_entero: boolean;
    nivel: number;
    descripcion: string;
    unidad: string | null;
    origen: 'import' | 'manual';
    et: MoEtCot;
    cot: MoEtCot;
    // Presupuesto/Saldo solo viven a nivel institución (tipo 'ie'); en el resto de filas son null.
    presupuesto: string | null;
    presupuesto_source: 'sugerido' | 'manual' | null;
    presupuesto_sugerido: string | null;
    parciales: Record<string, string>;
    final: string;
    saldo: string | null;
    descuadra: boolean;
    editable: { cot: boolean; identidad: boolean; ejecucion: boolean };
}

export interface MoSeries {
    id: string;
    indice: number;
    fecha: string | null;
    etiqueta: string | null;
}

export interface MoScenario {
    id: string;
    nombre: string;
    es_activo: boolean;
}

export interface MoPayload {
    scenario: { id: string; nombre: string };
    scenarios: MoScenario[];
    series: MoSeries[];
    rows: MoRow[];
    totales: {
        general: Record<'et_parcial' | 'cot_parcial' | 'presupuesto' | 'final' | 'saldo', string>;
        por_serie: Record<string, string>;
        descuadres: number;
        cuadra: boolean;
    };
}

export interface MoResponse {
    revision: number;
    mo: MoPayload;
}
