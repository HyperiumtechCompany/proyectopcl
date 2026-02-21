// ─── Tipos base de nodos del árbol ───────────────────────────────────────────

export type RowType = 'group' | 'subgroup' | 'subsubgroup' | 'datarow' | 'splitrow';

export interface SplitItem {
    descripcion: string;
    puntos: string | number;
    cargaInstalada: string | number;
}

export interface TableRowData {
    tablero: string;
    voltage: string; // '220' | '380'
    descripcion: string;
    puntos: string | number;
    cargaInstalada: string | number;
    potenciaInstalada: number;
    factorDemanda: number;
    maximaDemanda: number;
    corrienteA: number;
    corrienteDiseno: number;
    longitudConductor: string | number;
    longitudFormula?: string;
    seccion: number;
    caidaTension: number;
    caidaTensionPorcentaje: number;
    interruptor: string;
    tipoConductor: string;
    ducto: string;
}

export interface TableRowNode {
    id: string | number;
    type: RowType;
    parentId: string | number | null;
    data: TableRowData;
    splitData: SplitItem[];
    isSplit: boolean;
    voltage: string;
    calculationHistory: { expression: string; result: number }[];
    children: TableRowNode[];
}

// ─── Columnas de cabecera ─────────────────────────────────────────────────────

export type CellType = 'text' | 'number' | 'calculation' | 'formula' | 'select' | 'select_dynamic' | 'calculated';

export interface HeaderColumn {
    key: string;
    label: string;
    type: CellType;
    options?: { label: string; value: string }[];
}

// ─── Fila aplanada (para renderizado de tabla) ────────────────────────────────

export interface FlatCell {
    key: string;
    value: string | number;
    type: CellType;
    colspan?: number;
    rowspan?: number;
    visible?: boolean;
}

export interface FlatRow {
    id: string | number;
    uniqueId: string;
    type: RowType;
    level: number;
    cells: FlatCell[];
    parentId: string | number | null;
    splitIndex: number;
    isSplit: boolean;
    calculationHistory: { expression: string; result: number }[];
}

// ─── TG (Tablero General) ─────────────────────────────────────────────────────

export interface TGRow {
    id: string;
    alimentador: string;
    tablero: string;
    sistema: string;
    potenciaInstalada: number;
    factorSimultaniedad: number;
    maximaDemanda: number;
    corrienteA: number;
    corrienteDiseno: number;
    longitudConductor: number;
    longitudFormula: string;
    seccion: number;
    caidaTension: number;
    caidaTensionPorcentaje: number;
    interruptor: string;
    tipoConductor: string;
    ducto: string;
    isMainRow: boolean;
    isStaticTG: boolean;
    rowspan: number;
}

export interface ATSRow {
    id: string;
    alimentador: string;
    tablero: string;
    sistema: string;
    maximademandaats: number;
    corrienteA: number;
    corrienteDiseno: number;
    longitudConductor: number;
    longitudFormula: string;
    seccion: number;
    caidaTension: number;
    caidaTensionPorcentaje: number;
    interruptor: string;
    tipoConductor: string;
    ducto: string;
}

export interface TGTableRow {
    id: string;
    alimentador: string;
    tablero: string;
    sistema: string;
    maximademandaTG: number;
    corrienteA: number;
    corrienteDiseno: number;
    longitudConductor: number;
    longitudFormula: string;
    seccion: number;
    caidaTension: number;
    caidaTensionPorcentaje: number;
    interruptor: string;
    tipoConductor: string;
    ducto: string;
}

// ─── Selección de Grupo Electrógeno ──────────────────────────────────────────

export interface SelectionData {
    cantidadPotenciaWatts: number;
    factorDemanda: number;
    factorCarga1: number;
    factorCarga2: number;
    potenciaEstabilizadaStandby: number;
}

// ─── Spreadsheet completo ─────────────────────────────────────────────────────

export interface CollaboratorUser {
    id: number;
    name: string;
    email: string;
    avatar: string | null;
    role: 'viewer' | 'editor';
}

export interface SpreadsheetOwner {
    id: number;
    name: string;
    email: string;
    avatar: string | null;
}

export interface CaidaTensionSpreadsheet {
    id: number;
    name: string;
    project_name: string | null;
    td_data: TableRowNode[] | null;
    tg_data: {
        flattenedData: TGRow[];
        atsData: ATSRow[];
        tgData: TGTableRow[];
    } | null;
    selection_data: SelectionData | null;
    is_collaborative: boolean;
    collab_code: string | null;
    owner: SpreadsheetOwner;
    collaborators: CollaboratorUser[];
    can_edit: boolean;
    is_owner: boolean;
}

export interface CaidaTensionSpreadsheetSummary {
    id: number;
    name: string;
    project_name: string | null;
    is_collaborative: boolean;
    collab_code: string | null;
    owner: SpreadsheetOwner;
    updated_at: string;
    is_owner: boolean;
}

// ─── Estado de celda en edición ───────────────────────────────────────────────

export interface EditingCell {
    rowId: string | number | null;
    cellKey: string | null;
    splitIndex?: number;
    tableType?: 'main' | 'ats' | 'tg' | null;
}

// ─── Opciones de selects ──────────────────────────────────────────────────────

export const VOLTAGE_OPTIONS = [
    { label: '1ɸ', value: '220' },
    { label: '3ɸ', value: '380' },
    { label: '', value: '' },
] as const;

export const INTERRUPTOR_OPTIONS: Record<string, Record<string, string>> = {
    '220': {
        '2x6': '2x6', '2x10': '2x10', '2x16': '2x16', '2x20': '2x20',
        '2x25': '2x25', '2x32': '2x32', '2x40': '2x40', '2x50': '2x50',
        '2x63': '2x63', '2x80': '2x80', '2x100': '2x100', '2x125': '2x125',
        '2x160': '2x160', '2x200': '2x200', '': '',
    },
    '380': {
        '4x6': '4x6', '4x10': '4x10', '4x16': '4x16', '4x20': '4x20',
        '4x25': '4x25', '4x32': '4x32', '4x40': '4x40', '4x50': '4x50',
        '4x63': '4x63', '4x80': '4x80', '4x100': '4x100', '4x125': '4x125',
        '4x160': '4x160', '4x200': '4x200', '': '',
    },
};

export const DUCTO_OPTIONS: Record<string, string> = {
    '15': '15', '20': '20', '25': '25', '35': '35', '40': '40',
    '50': '50', '65': '65', '80': '80', '100': '100', '150': '150', '': '',
};

export const CONDUCTOR_OPTIONS = [
    { label: 'LSOH', value: 'LSOH' },
    { label: 'N2XOH', value: 'N2XOH' },
    { label: 'THW', value: 'THW' },
    { label: 'THHN', value: 'THHN' },
    { label: '', value: '' },
] as const;
