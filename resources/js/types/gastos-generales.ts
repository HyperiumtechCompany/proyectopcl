export type TipoFilaFijo = 'seccion' | 'grupo' | 'detalle';

export interface GGFijoNode {
    id?: number;
    presupuesto_id?: number;
    parent_id?: number | null;
    tipo_fila: TipoFilaFijo;
    item_codigo: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    costo_unitario: number;
    parcial: number;
    item_order: number;
    _level?: number;
    _expanded?: boolean;
}

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
    participacion: number;
    precio: number;
    parcial: number;
    item_order: number;
    _level?: number;
    _expanded?: boolean;
    _fromRemuneraciones?: boolean;
    _remuneracion_id?: number;
}

export interface GastoGeneralRow {
    id?: number;
    presupuesto_id?: number;
    tipo: 'fijo' | 'variable';
    descripcion: string;
    monto: number;
    orden: number;
}

export interface SupervisionRow {
    id?: number | null;
    presupuesto_id?: number;
    tipo: 'fijo' | 'variable';
    descripcion: string;
    monto: number;
    orden: number;
}

export interface SupervisionDbRow {
    id: number;
    presupuesto_id: number;
    tipo: 'fijo' | 'variable';
    descripcion: string;
    monto: number;
    orden: number;
}

export interface SupervisionGGDetalleRow {
    id?: number | null;
    presupuesto_id?: number;
    parent_id?: number | null;
    descripcion: string;
    unidad: string;
    cantidad_desc: number;
    cantidad_tiempo: number;
    participacion: number;
    precio: number;
    parcial: number;
    orden: number;
    hijos?: SupervisionGGDetalleRow[];
}
