// ═══════════════════════════════════════════════════
// types.ts — Tipos compartidos del módulo Eléctricas
// ═══════════════════════════════════════════════════

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
  /** Inputs relevantes para esta unidad (en orden de aparición) */
  activeInputs: (keyof MeasureInputs)[];
  /** Columna de resultado */
  outputKey: keyof MeasureOutputs;
  /** Descripción legible de la fórmula */
  formula: string;
  /** Función de cálculo */
  fn: (v: MeasureInputs) => MeasureOutputs;
}

/** Payload que devuelve el CalcModal al confirmar */
export interface CalcPayload {
  ri: number;
  inputs: MeasureInputs;
  outputs: MeasureOutputs;
}

// ── Guardado ─────────────────────────────────────────────────
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

