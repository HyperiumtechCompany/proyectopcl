
export interface ColumnDef {
  key: string;
  label: string;
  width: number;
}

export interface GasPageProps {
  project: { id: number; nombre: string };
  metrado: Record<string, any>[];
  resumen: Record<string, any>[];
  [key: string]: unknown;
}

export type RowKind = 'group' | 'leaf';

export interface RowEntry {
  ri: number;
  row: Record<string, any>;
  level: number;
  kind: RowKind;
  total: number;
}

// ── Medición ──────────────────────────────────────────────────
/** Todos los posibles campos de entrada de una fila de medición */
export interface MeasureInputs {
  elsim: number;
  largo: number;
  ancho: number;
  alto: number;
  nveces: number;
  kg: number;
  kgm: number;
}

/** Columnas de resultado (solo una se activa según la unidad) */
export interface MeasureOutputs {
  lon?: number;
  area?: number;
  vol?: number;
  kg?: number;
  und?: number; // Parcial
}

/** Perfil de una unidad: qué inputs necesita y qué columna produce */
export interface UnitProfile {
  key: string;
  label: string;
  activeInputs: (keyof MeasureInputs)[];
  outputKey: keyof MeasureOutputs;
  formula: string;
  fn: (vals: MeasureInputs) => MeasureOutputs;
}

/** Payload que devuelve el CalcModal al confirmar */
export interface CalcPayload {
  ri: number;
  descripcion: string;
  unidad: string;
  outputKey: keyof MeasureOutputs;
  inputs: MeasureInputs;
  outputs: MeasureOutputs;
  formulaKey?: string;
  formulaLabel?: string;
  formulaExpression?: string;
  formula: string;
}

// ── Guardado ─────────────────────────────────────────────────
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
