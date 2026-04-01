// resources/js/types/presupuestos.ts

export interface PresupuestoRow {
    id?: number;
    partida: string;
    descripcion: string;
    unidad: string;
    metrado: number;
    precio_unitario: number;
    parcial: number;
    metrado_source?: string;
    item_order: number;
}

export interface ACUComponente {
    id?: number;
    insumo_id?: number | null;
    descripcion: string;
    unidad: string;
    cantidad: number;
    recursos?: number;
    precio_unitario: number;
    factor_desperdicio?: number;
    precio_hora?: number;
    parcial: number;
}

export interface ACU {
    id?: number;
    partida: string;
    descripcion: string;
    unidad: string;
    rendimiento: number;
    mano_de_obra: ACUComponente[];
    materiales: ACUComponente[];
    equipos: ACUComponente[];
    subcontratos?: ACUComponente[];
    subpartidas?: ACUComponente[];
    costo_mano_obra: number;
    costo_materiales: number;
    costo_equipos: number;
    costo_subcontratos?: number;
    costo_subpartidas?: number;
    costo_unitario_total: number;
    item_order: number;
}

export interface GastoGeneral {
    id?: number;
    codigo: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    precio_unitario: number;
    parcial: number;
    categoria?: string;
    item_order: number;
}

export interface Insumo {
    id?: number;
    codigo: string;
    descripcion: string;
    unidad: string;
    precio_unitario: number;
    tipo: 'material' | 'mano_obra' | 'equipo';
    categoria?: string;
    item_order: number;
}

export interface Remuneracion {
    id?: number;
    presupuesto_id: number;
    gg_variable_id: number | null;
    cargo: string;
    categoria?: string;
    participacion: number;
    cantidad: number;
    meses: number;
    sueldo_basico: number;
    asignacion_familiar: number;
    snp: number;
    essalud: number;
    cts: number;
    vacaciones: number;
    gratificacion: number;
    total_mensual_unitario: number;
    total_proyecto: number;
}

export interface IndicePolinomico {
    id?: number;
    simbolo: string;
    descripcion: string;
    coeficiente: number;
    indice_base: number;
    indice_actual: number;
    monomio: number;
    fecha_indice_base?: string;
    fecha_indice_actual?: string;
    item_order: number;
}

export interface MetradoInfo {
    type: string;
    label: string;
    rowCount: number;
}

// ─── Catálogo de Insumos (Delphin/S10) ───────────────────────────────────────

export interface Diccionario {
    id: number;
    codigo: string;
    descripcion: string;
}

export interface Unidad {
    id: number;
    descripcion: string;
    descripcion_singular: string;
    orden: string;
    informacion_unidad: string;
    abreviatura_unidad: string;
}

export interface InsumoProducto {
    id: number;
    codigo?: string;
    descripcion: string;
    especificaciones?: string | null;
    diccionario_id: number;
    unidad_id: number;
    tipo_proveedor: string;
    precio: number;
    costo_unitario_lista: number;
    costo_flete: number;
    tipo: 'mano_de_obra' | 'materiales' | 'equipos';
    diccionario?: Diccionario | null;
    unidad?: Unidad | null;
}

export type PresupuestoSubsection =
    | 'general'
    | 'acus'
    | 'consolidado'
    | 'gastos_generales'
    | 'gastos_fijos'
    | 'supervision'
    | 'control_concurrente'
    | 'remuneraciones'
    | 'insumos'
    | 'indices'
    | 'materiales'
    | 'equipos'
    | 'f_polinomica';

export type ColumnType = 'string' | 'number' | 'date' | 'json';

export interface ColumnDef {
    key: string;
    label: string;
    width: number;
    type: ColumnType;
    readonly?: boolean;
}

export type RendimientoModo = 'dia' | 'hora' | 'global';

export interface ACUComponenteRow {
    id?: number;
    insumo_id?: number | null;
    codigo?: string | null;
    descripcion: string;
    unidad?: string | null;
    cantidad?: number | null;
    recursos?: number | null;
    precio_unitario?: number | null;
    precio_hora?: number | null;
    factor_desperdicio?: number | null;
    parcial?: number | null;
}

export interface ACURowSummary {
    id: number;
    partida: string;
    descripcion: string;
    unidad: string;
    rendimiento: number;
    costo_mano_obra: number;
    costo_materiales: number;
    costo_equipos: number;
    costo_subcontratos: number;
    costo_subpartidas: number;
    costo_unitario_total: number;
    mano_de_obra: ACUComponenteRow[];
    materiales: ACUComponenteRow[];
    equipos: ACUComponenteRow[];
    subcontratos: ACUComponenteRow[];
    subpartidas: ACUComponenteRow[];
}

// export const SUBSECTION_COLUMNS: Record<PresupuestoSubsection, ColumnDef[]> = {
//     general: [
//         { key: 'partida', label: 'Partida', width: 100, type: 'string' },
//         {
//             key: 'descripcion',
//             label: 'Descripcion',
//             width: 250,
//             type: 'string',
//         },
//         { key: 'unidad', label: 'Und.', width: 70, type: 'string' },
//         { key: 'metrado', label: 'Cantidad', width: 100, type: 'number' },
//         {
//             key: 'precio_unitario',
//             label: 'Precio',
//             width: 120,
//             type: 'number',
//         },
//         {
//             key: 'parcial',
//             label: 'Total',
//             width: 130,
//             type: 'number',
//             readonly: true,
//         },
//     ],
//     acus: [
//         { key: 'partida', label: 'Partida', width: 110, type: 'string' },
//         {
//             key: 'descripcion',
//             label: 'Descripcion',
//             width: 320,
//             type: 'string',
//         },
//         { key: 'unidad', label: 'Unidad', width: 90, type: 'string' },
//         {
//             key: 'rendimiento',
//             label: 'Rendimiento',
//             width: 110,
//             type: 'number',
//         },
//         {
//             key: 'costo_mano_obra',
//             label: 'Costo Mano Obra',
//             width: 150,
//             type: 'number',
//         },
//         {
//             key: 'costo_materiales',
//             label: 'Costo Materiales',
//             width: 140,
//             type: 'number',
//         },
//         {
//             key: 'costo_equipos',
//             label: 'Costo Equipos',
//             width: 130,
//             type: 'number',
//         },
//         {
//             key: 'costo_unitario_total',
//             label: 'CU Total',
//             width: 120,
//             type: 'number',
//             readonly: true,
//         },
//         {
//             key: 'mano_de_obra',
//             label: 'Mano de Obra (JSON)',
//             width: 260,
//             type: 'json',
//         },
//         {
//             key: 'materiales',
//             label: 'Materiales (JSON)',
//             width: 260,
//             type: 'json',
//         },
//         { key: 'equipos', label: 'Equipos (JSON)', width: 260, type: 'json' },
//     ],
//     gastos_generales: [
//         { key: 'codigo', label: 'Codigo', width: 110, type: 'string' },
//         {
//             key: 'descripcion',
//             label: 'Descripcion',
//             width: 360,
//             type: 'string',
//         },
//         { key: 'unidad', label: 'Unidad', width: 90, type: 'string' },
//         { key: 'cantidad', label: 'Cantidad', width: 110, type: 'number' },
//         {
//             key: 'precio_unitario',
//             label: 'Precio Unitario',
//             width: 130,
//             type: 'number',
//         },
//         {
//             key: 'parcial',
//             label: 'Parcial',
//             width: 130,
//             type: 'number',
//             readonly: true,
//         },
//         { key: 'categoria', label: 'Categoria', width: 140, type: 'string' },
//     ],
//     insumos: [
//         { key: 'codigo', label: 'Codigo', width: 110, type: 'string' },
//         {
//             key: 'descripcion',
//             label: 'Descripcion',
//             width: 360,
//             type: 'string',
//         },
//         { key: 'unidad', label: 'Unidad', width: 90, type: 'string' },
//         {
//             key: 'precio_unitario',
//             label: 'Precio Unitario',
//             width: 130,
//             type: 'number',
//         },
//         { key: 'tipo', label: 'Tipo', width: 120, type: 'string' },
//         { key: 'categoria', label: 'Categoria', width: 140, type: 'string' },
//     ],
//     remuneraciones: [
//         { key: 'cargo', label: 'Cargo', width: 220, type: 'string' },
//         { key: 'categoria', label: 'Categoria', width: 130, type: 'string' },
//         {
//             key: 'sueldo_basico',
//             label: 'Sueldo Basico',
//             width: 130,
//             type: 'number',
//         },
//         {
//             key: 'bonificaciones',
//             label: 'Bonificaciones',
//             width: 130,
//             type: 'number',
//         },
//         {
//             key: 'beneficios_sociales',
//             label: 'Beneficios Sociales',
//             width: 150,
//             type: 'number',
//         },
//         {
//             key: 'total_mensual',
//             label: 'Total Mensual',
//             width: 130,
//             type: 'number',
//             readonly: true,
//         },
//         { key: 'meses', label: 'Meses', width: 90, type: 'number' },
//         {
//             key: 'total_proyecto',
//             label: 'Total Proyecto',
//             width: 130,
//             type: 'number',
//             readonly: true,
//         },
//     ],
//     indices: [
//         { key: 'simbolo', label: 'Simbolo', width: 90, type: 'string' },
//         {
//             key: 'descripcion',
//             label: 'Descripcion',
//             width: 320,
//             type: 'string',
//         },
//         {
//             key: 'coeficiente',
//             label: 'Coeficiente',
//             width: 110,
//             type: 'number',
//         },
//         {
//             key: 'indice_base',
//             label: 'Indice Base',
//             width: 120,
//             type: 'number',
//         },
//         {
//             key: 'indice_actual',
//             label: 'Indice Actual',
//             width: 120,
//             type: 'number',
//         },
//         {
//             key: 'monomio',
//             label: 'Monomio',
//             width: 110,
//             type: 'number',
//             readonly: true,
//         },
//         {
//             key: 'fecha_indice_base',
//             label: 'Fecha Base',
//             width: 120,
//             type: 'date',
//         },
//         {
//             key: 'fecha_indice_actual',
//             label: 'Fecha Actual',
//             width: 120,
//             type: 'date',
//         },
//     ],
// };
