/**
 * Tipos compartidos para el módulo de Cálculo de Desagüe (calc-desague).
 * Usados en UdDesague, ColectorDesague, CajaRegistroDesague, UvDesague y TrampaGrasaDesague.
 */

// ─── Grados educativos ────────────────────────────────────────────────────────
export type GradeKey = 'inicial' | 'primaria' | 'secundaria';

export type GradeMap = Record<GradeKey, boolean>;

// ─── Props estándar de cada tab (recibidos desde Show.tsx) ────────────────────
export interface TabDesagueProps {
    editMode: boolean;
    canEdit: boolean;
    initialData?: any;
    onChange?: (data: any) => void;
}

// ─── UdDesague ────────────────────────────────────────────────────────────────

/** Fila del Anexo-06 (aparato sanitario → valor UD) */
export interface AnexoRow {
    id: string;
    aparato: string;
    tipo: string;
    ud: number;
}

/** Columna derivada del Anexo (agrupada por tipo de aparato) */
export interface UdColumn {
    key: string;
    label: string;
    udValue: number;
}

/** Nodo en el árbol de la tabla de grado (módulo, detalle, hijo, nieto) */
export interface UdTableNode {
    id: string;
    name?: string;    // nombre del módulo
    nivel?: string;   // nivel educativo
    desc?: string;    // descripción
    qty: Record<string, string | number>; // cantidades por columna (col.key → qty)
    details?: UdTableNode[];
    children?: UdTableNode[];
}

export interface UdGradeTable {
    modules: UdTableNode[];
    multipliers?: Record<string, number>;
}

export interface UdState {
    grades: GradeMap;
    anexo: AnexoRow[];
    tables: Record<GradeKey, UdGradeTable>;
}

// ─── ColectorDesague ──────────────────────────────────────────────────────────

export interface ColectorRow {
    id: number | string;
    tramo: string;
    longitud: number;
    ud: number;
    diametro: string;
    pendiente: string;
    cr1_num: string;
    cr1_nval: string;
    cr1_ct: number;
    cr1_cf: number;
    cr1_h: number;
    cr1_dim: string;
    cr2_num: string;
    cr2_nval: string;
    cr2_ct: number;
    cr2_cf: number;
    cr2_h: number;
    cr2_dim: string;
    isStatic: boolean;
}

export type ColectorState = Partial<Record<GradeKey, ColectorRow[]>>;

// ─── CajaRegistroDesague ─────────────────────────────────────────────────────

export interface CajaRegistroRow {
    id: string | number;
    tramocajalabel: string;
    tramocajavalue: string | number;
    ctcaja: number;
    cfcaja: number;
    hcaja: number;
    dimensionescaja: string;
    isStatic: boolean;
}

export interface ResumenItem {
    descripcioncaja: string;
    tipo: string;
    cantidad: number;
}

export type CajaRegistroState = Partial<Record<GradeKey, CajaRegistroRow[]>>;

// ─── UvDesague ────────────────────────────────────────────────────────────────

export interface UvDimensionRow {
    id: string;
    diametro: string;
    tipo: string;
    size2: string;
    size3: string;
    size4: string;
}

export type UvRowType = 'module' | 'child' | 'grandchild';

export interface UvGradeRow {
    id: string;
    tipo: UvRowType;
    nivel: string;
    descripcion: string;
    totalUD: number;
    diametroVentilacion: string;
    _children?: UvGradeRow[];
    [key: string]: any; // acc_* dynamic accessory fields
}

export interface UvAccessory {
    key: string;
    label: string;
    totalCategoryCount: number;
}

export interface UvState {
    dimensionRows: UvDimensionRow[];
    gradeData: Record<GradeKey, UvGradeRow[]>;
    multipliers?: Record<GradeKey, Record<string, number>>;
}

// ─── TrampaGrasaDesague ───────────────────────────────────────────────────────

export interface TrampaAparato {
    id: string;
    aparato: string;
    cantidad: number;
    tipo: string;
    ug: number;
    totalUG: number;
}

export interface TrampaCaracteristica {
    id: string;
    caracteristica: string;
    valor: string;
}

export interface TrampaParametro {
    id: string;
    parametro: string;
    calculos: number | string;
    unidad: string;
    editable?: boolean; // si el usuario puede cambiar el valor directamente
}

export interface TrampaMedida {
    id: string;
    medida: string;
    valor: number;
    unidad: string;
}

export interface TrampaState {
    aparatos: TrampaAparato[];
    caracteristicas: TrampaCaracteristica[];
    parametrosFinal: TrampaParametro[];
    medidas: TrampaMedida[];
    comentario?: string;
}
