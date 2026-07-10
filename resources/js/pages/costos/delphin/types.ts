import type { ColumnDef } from '../cronogramas/v2/types/cell';
import type { GanttTask } from '../cronogramas/v2/types/task';

// ── Unified row: gantt task + budget fields ───────────────────────────────────
export interface DelphinRow extends GanttTask {
    unidad: string;
    metrado: number;
    precio_unitario: number;
    parcial: number;
}

export interface BudgetFields {
    unidad: string;
    metrado: number;
    precio_unitario: number;
    parcial: number;
}

export function defaultBudget(): BudgetFields {
    return { unidad: '', metrado: 0, precio_unitario: 0, parcial: 0 };
}

export const BUDGET_FIELD_KEYS = new Set(['unidad', 'metrado', 'precio_unitario', 'parcial']);

// ── Column definitions ────────────────────────────────────────────────────────
export const BUDGET_COLUMNS: ColumnDef[] = [
    { key: 'descripcion',     label: 'Descripción', type: 'text',     width: 260, align: 'left',   editable: true  },
    { key: 'unidad',          label: 'Und.',        type: 'select',   width: 72,  align: 'center', editable: true,
      options: ['', 'und', 'm', 'm2', 'm3', 'kg', 'tn', 'glb', 'est', 'jg', 'ml', 'día', 'sem', 'mes', 'vje', 'pt', 'bls', 'gal', 'lt', 'rll'] },
    { key: 'metrado',         label: 'Cantidad',    type: 'number',   width: 80,  align: 'right',  editable: true,  decimals: 2 },
    { key: 'precio_unitario', label: 'P. Unit.',    type: 'number',   width: 90,  align: 'right',  editable: true,  decimals: 2 },
    { key: 'parcial',         label: 'Total',       type: 'readonly', width: 100, align: 'right',  editable: false, decimals: 2 },
];

export const CPM_COLUMNS: ColumnDef[] = [
    { key: 'descripcion',   label: 'Descripción', type: 'text',         width: 230, align: 'left',   editable: true  },
    { key: 'duracion_dias', label: 'Dur.',         type: 'number',       width: 55,  align: 'center', editable: true  },
    { key: 'fecha_inicio',  label: 'Inicio',       type: 'date',         width: 100, align: 'center', editable: true  },
    { key: 'fecha_fin',     label: 'Fin',          type: 'date',         width: 100, align: 'center', editable: true  },
    { key: 'predecesoras',  label: 'Pred.',        type: 'predecesoras', width: 75,  align: 'center', editable: true  },
    // readonly: refleja presupuesto_general (metrado × precio_unitario), no un valor propio —
    // editar el costo debe hacerse desde el modo Presupuesto para no desincronizar ambas tablas.
    { key: 'presupuesto',   label: 'Costo (S/)',   type: 'readonly',     width: 110, align: 'right',  editable: false, decimals: 2 },
];

export type DelphinMode = 'budget' | 'cpm';
export type DelphinBudgetView = 'presupuesto' | 'formula_polinomica';
export type DelphinSubView = 'gantt' | 'network';
export type InsumosScope = 'especialidad' | 'presupuesto';
