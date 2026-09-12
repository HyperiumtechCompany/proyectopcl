export interface MatCotizacion {
    slot: number;
    proveedor: string | null;
    cantidad: string;
    precio: string | null;
    pt: string;
}

export interface MatCompraCell {
    cantidad: string | null;
    precio: string | null;
    subtotal: string;
}

export interface MatRow {
    partida_id: string;
    material_id?: string;
    parent_id?: string | null;
    tipo: 'ie' | 'bloque' | 'partida' | 'material';
    es_material: boolean;
    item?: string | null;
    item_entero?: boolean;
    nivel: number;
    descripcion: string;
    unidad: string | null;
    metrado?: string;
    origen: 'import' | 'manual';
    et?: { cantidad: string; precio: string; pt: string };
    cotizaciones?: MatCotizacion[];
    pu_minimo?: string | null;
    pt_referencia?: string | null;
    compras?: Record<string, MatCompraCell>;
    pt_et?: string;
    total_comprado: string;
    saldo: string;
    descuadra: boolean;
    por_compra?: Record<string, string>;
}

export interface MatCompra {
    id: string;
    indice: number;
    fecha: string | null;
    etiqueta: string | null;
}

export interface MatScenario {
    id: string;
    nombre: string;
    es_activo: boolean;
}

export interface MatPayload {
    scenario: { id: string; nombre: string };
    scenarios: MatScenario[];
    compras: MatCompra[];
    rows: MatRow[];
    totales: {
        general: Record<'pt_et' | 'total_comprado' | 'saldo', string>;
        por_compra: Record<string, string>;
        conciliacion: { exp_tec: string; corregido: string; diferencia: string; estado: 'cuadra' | 'superavit' | 'deficit' };
        descuadres: number;
    };
}

export interface MatResponse {
    revision: number;
    mat: MatPayload;
}
