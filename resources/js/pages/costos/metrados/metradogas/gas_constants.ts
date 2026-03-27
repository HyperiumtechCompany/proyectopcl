// ═══════════════════════════════════════════════════
// constants.ts — Constantes del módulo Eléctricas
// ═══════════════════════════════════════════════════

import type { ColumnDef, MeasureInputs, UnitProfile } from './gas_types';

// ── Unidades disponibles ──────────────────────────────────────
export const UNITS = ['und', 'm', 'm2', 'm3', 'kg', 'glb', 'pto', 'pza', 'ml'] as const;
export type Unit = (typeof UNITS)[number];

// ── Columnas visibles de la hoja Metrado ─────────────────────
export const MAIN_COLS: ColumnDef[] = [
  { key: 'partida',     label: 'Ítem',          width: 110 },
  { key: 'descripcion', label: 'Descripción',   width: 300 },
  { key: 'unidad',      label: 'Und',           width: 60  },
  { key: 'elsim',       label: 'Elem.Simil.',   width: 82  },
  { key: 'largo',       label: 'Largo',         width: 70  },
  { key: 'ancho',       label: 'Ancho',         width: 70  },
  { key: 'alto',        label: 'Alto',          width: 70  },
  { key: 'nveces',      label: 'N° Veces',      width: 72  },
  { key: 'lon',         label: 'Long.',         width: 76  },
  { key: 'area',        label: 'Área',          width: 76  },
  { key: 'vol',         label: 'Vol.',          width: 76  },
  { key: 'kg',          label: 'Kg.',           width: 76  },
  { key: 'und',         label: 'Parcial',       width: 76  },
  { key: 'total',       label: 'Total',         width: 95  },
  { key: 'observacion', label: 'Observaciones', width: 148 },
];

// ── Columnas de metadatos ocultas ─────────────────────────────
export const META_COLS: ColumnDef[] = [
  { key: '_dbid',  label: '', width: 1 },
  { key: '_level', label: '', width: 1 },
  { key: '_kind',  label: '', width: 1 },
];

export const ALL_COLS: ColumnDef[] = [...MAIN_COLS, ...META_COLS];

/** Índice columna-key → posición numérica */
export const CI = Object.fromEntries(ALL_COLS.map((c, i) => [c.key, i]));

// ── Columnas de la hoja Resumen ───────────────────────────────
export const RESUMEN_COLS: ColumnDef[] = [
  { key: '_dbid',       label: '',             width: 1   },
  { key: 'partida',     label: 'Ítem',         width: 120 },
  { key: 'descripcion', label: 'Descripción',  width: 360 },
  { key: 'unidad',      label: 'Und',          width: 65  },
  { key: 'total',       label: 'Total',        width: 115 },
];

// ── Perfiles de unidad ────────────────────────────────────────
/**
 * Cada unidad define:
 *  - activeInputs: qué campos se ingresan
 *  - outputKey: a qué columna va el resultado
 *  - formula: descripción legible
 *  - fn: función de cálculo
 *
 * Esto se usa tanto en CalcModal (mostrar solo campos activos)
 * como en recalc() (solo escribir la columna de resultado).
 */
export const UNIT_PROFILES: Record<string, UnitProfile> = {
  // Unidades de conteo
  und: {
    activeInputs: ['elsim', 'nveces'],
    outputKey:    'und',
    formula:      'Parcial = Elem.Simil × N° Veces',
    fn: (v) => ({ und: v.elsim * v.nveces }),
  },
  pza: {
    activeInputs: ['elsim', 'nveces'],
    outputKey:    'und',
    formula:      'Parcial = Elem.Simil × N° Veces',
    fn: (v) => ({ und: v.elsim * v.nveces }),
  },
  glb: {
    activeInputs: ['elsim', 'nveces'],
    outputKey:    'und',
    formula:      'Parcial = Elem.Simil × N° Veces',
    fn: (v) => ({ und: v.elsim * v.nveces }),
  },
  pto: {
    activeInputs: ['elsim', 'nveces'],
    outputKey:    'und',
    formula:      'Parcial = Elem.Simil × N° Veces',
    fn: (v) => ({ und: v.elsim * v.nveces }),
  },

  // Longitud
  m: {
    activeInputs: ['elsim', 'largo', 'ancho', 'alto', 'nveces'],
    outputKey:    'lon',
    formula:      'Long. = Elem.Simil × (Largo + Ancho + Alto) × N° Veces',
    fn: (v) => ({ lon: v.elsim * (v.largo + v.ancho + v.alto) * v.nveces }),
  },
  ml: {
    activeInputs: ['elsim', 'largo', 'ancho', 'alto', 'nveces'],
    outputKey:    'lon',
    formula:      'Long. = Elem.Simil × (Largo + Ancho + Alto) × N° Veces',
    fn: (v) => ({ lon: v.elsim * (v.largo + v.ancho + v.alto) * v.nveces }),
  },

  // Área
  m2: {
    activeInputs: ['elsim', 'largo', 'ancho', 'nveces'],
    outputKey:    'area',
    formula:      'Área = Elem.Simil × Largo × Ancho × N° Veces',
    fn: (v) => ({ area: v.elsim * v.largo * v.ancho * v.nveces }),
  },

  // Volumen
  m3: {
    activeInputs: ['elsim', 'largo', 'ancho', 'alto', 'nveces'],
    outputKey:    'vol',
    formula:      'Vol. = Elem.Simil × Largo × Ancho × Alto × N° Veces',
    fn: (v) => ({ vol: v.elsim * v.largo * v.ancho * v.alto * v.nveces }),
  },

  // Peso
  kg: {
    activeInputs: ['elsim', 'largo', 'ancho', 'nveces'],
    outputKey:    'kg',
    formula:      'Kg = Elem.Simil × Largo × Ancho × N° Veces',
    fn: (v) => ({ kg: v.elsim * v.largo * v.ancho * v.nveces }),
  },
};

/** Fallback cuando la unidad no está registrada */
export const DEFAULT_PROFILE: UnitProfile = {
  activeInputs: ['elsim', 'largo', 'ancho', 'alto', 'nveces'],
  outputKey:    'und',
  formula:      'Ingresa los valores y selecciona fórmula personalizada',
  fn: (v) => ({ und: v.elsim * v.nveces }),
};

// ── Columnas de OUTPUT (para limpiar al recalcular) ───────────
export const OUTPUT_KEYS = ['lon', 'area', 'vol', 'kg', 'und'] as const;

// ── Etiquetas de columnas de salida ──────────────────────────
export const OUTPUT_LABELS: Record<string, string> = {
  lon:  'Long.',
  area: 'Área',
  vol:  'Vol.',
  kg:   'Kg.',
  und:  'Parcial',
};

// ── Paleta de niveles (Luckysheet no usa Tailwind CSS) ────────
export const LEVEL_PALETTE = [
  { bg: '#0c1e3a', fc: '#ffffff', bl: 1 },
  { bg: '#133163', fc: '#ffffff', bl: 1 },
  { bg: '#1a4480', fc: '#ffffff', bl: 1 },
  { bg: '#1d5fa8', fc: '#ffffff', bl: 1 },
  { bg: '#2563eb', fc: '#ffffff', bl: 1 },
  { bg: '#3b82f6', fc: '#ffffff', bl: 1 },
  { bg: '#60a5fa', fc: '#0f172a', bl: 0 },
  { bg: '#93c5fd', fc: '#0f172a', bl: 0 },
  { bg: '#bfdbfe', fc: '#0f172a', bl: 0 },
  { bg: '#dbeafe', fc: '#0f172a', bl: 0 },
] as const;

export const LEAF_STYLE = { bg: '#f8fafc', fc: '#374151', bl: 0 } as const;

export const MAX_LEVELS = 10;
export const SAVE_DEBOUNCE = 1800;
export const NBSP = '\u00A0\u00A0\u00A0';

// ── Nombres de campos de entrada ─────────────────────────────
export const INPUT_LABELS: Record<keyof MeasureInputs, string> = {
  elsim:  'Elem.Simil.',
  largo:  'Largo',
  ancho:  'Ancho',
  alto:   'Alto',
  nveces: 'N° Veces',
  kg:     'Kg.',
};

export const ALL_INPUTS: (keyof MeasureInputs)[] = [
  'elsim', 'largo', 'ancho', 'alto', 'nveces', 'kg',
];

