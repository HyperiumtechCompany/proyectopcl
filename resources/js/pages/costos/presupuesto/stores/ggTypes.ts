export type TipoFilaVariable = 'seccion' | 'grupo' | 'detalle';

export interface GGVariableNode {
    id?: number;
    presupuesto_id?: number;
    parent_id?: number | null;
    tipo_fila: TipoFilaVariable;
    item_codigo: string;
    descripcion: string;
    unidad: string;
    cantidad_descripcion: number;
    cantidad_tiempo: number;
    participacion: number;   // 0-100
    precio: number;
    parcial: number;         // cant_desc × cant_tiempo × (part/100) × precio (calculated)
    item_order: number;
    // UI helpers
    _level?: number;
    _expanded?: boolean;
    _fromRemuneraciones?: boolean; // marks rows imported from remuneraciones
    // Para vínculo con remuneraciones
    _remuneracion_id?: number;     // ID de la remuneración fuente
}
