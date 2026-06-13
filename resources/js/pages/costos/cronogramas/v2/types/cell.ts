export type CellType = 'readonly' | 'text' | 'number' | 'date' | 'predecesoras' | 'select';

export type GanttBarLabel = 'descripcion' | 'costo' | 'empty';

export interface ColumnDef {
    key: string;
    label: string;
    type: CellType;
    width: number;
    align: 'left' | 'center' | 'right';
    editable: boolean;
    /** Options for type 'select' cells */
    options?: string[];
}

export interface EditState {
    rowId: number;
    colKey: string;
}

export const ROW_HEIGHT = 40;

export type RowAction =
    | 'addAfter'
    | 'addChild'
    | 'delete'
    | 'indent'
    | 'outdent'
    | 'expand'
    | 'collapse';

export const COLUMNS: ColumnDef[] = [
    { key: 'item_order',    label: 'N°',           type: 'readonly',     width: 42,  align: 'center', editable: false },
    { key: 'descripcion',   label: 'Descripción',  type: 'text',         width: 230, align: 'left',   editable: true  },
    { key: 'duracion_dias', label: 'Dur.',          type: 'number',       width: 55,  align: 'center', editable: true  },
    { key: 'fecha_inicio',  label: 'Inicio',        type: 'date',         width: 100, align: 'center', editable: true  },
    { key: 'fecha_fin',     label: 'Fin',           type: 'date',         width: 100, align: 'center', editable: true  },
    { key: 'predecesoras',  label: 'Pred.',         type: 'predecesoras', width: 75,  align: 'center', editable: true  },
    { key: 'presupuesto',   label: 'Costo (S/)',    type: 'number',       width: 110, align: 'right',  editable: true  },
];

export const EDITABLE_COLUMNS = COLUMNS.filter(c => c.editable);

export const TOTAL_GRID_WIDTH = COLUMNS.reduce((sum, c) => sum + c.width, 0);
