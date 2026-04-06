import type { ColumnDef, MeasureInputs, UnitProfile } from './electricas_types';
import { r4, toNum, isZeroLike } from './electricas_utils';

// ── Unidades disponibles ──────────────────────────────────────
export const UNITS = ['und', 'm', 'm2', 'm3', 'kg', 'glb', 'pto', 'pza', 'ml'] as const;
export type Unit = (typeof UNITS)[number];

// ── Columnas visibles de las hojas Metrado ─────────────────────
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
  { key: 'kgm', label: '', width: 1 },
  { key: '_formula_key', label: '', width: 1 },
  { key: '_formula_output', label: '', width: 1 },
  { key: '_formula_expr', label: '', width: 1 },
  { key: '_formula_label', label: '', width: 1 },
];

export const ALL_COLS: ColumnDef[] = [...MAIN_COLS, ...META_COLS];

/** Índice columna-key → posición numérica */
export const CI = Object.fromEntries(ALL_COLS.map((c, i) => [c.key, i]));

// ── Columnas de la hoja Resumen ───────────────────────────────
export const RESUMEN_BASE_COLS: ColumnDef[] = [
  { key: '_dbid',       label: '',             width: 1   },
  { key: 'partida',     label: 'Ítem',         width: 120 },
  { key: 'descripcion', label: 'Descripción',  width: 360 },
  { key: 'unidad',      label: 'Und',          width: 65  },
];

// ── Perfiles de unidad ────────────────────────────────────────
/**
 * Cada unidad define:
 *  - activeInputs: qué campos se ingresan
 *  - outputKey: a qué columna va el resultado
 *  - formula: descripción legible
 *  - fn: función de cálculo
 */
export const UNIT_PROFILES: Record<string, UnitProfile[]> = {

  // ─────────────────────────────────────────────────────────────
  // METROS CUADRADOS (m²) — 5 versiones
  // ─────────────────────────────────────────────────────────────
  m2: [
    {
      key: 'm2_v1',
      label: '(Largo + Ancho) × Veces × Elem',
      activeInputs: ['largo', 'ancho', 'nveces', 'elsim'],
      outputKey: 'lon',
      formula: 'Lon. = (Largo + Ancho) × N° Veces × Elem. Similar',
      fn: (v) => ({ lon: (v.largo + v.ancho) * v.nveces * v.elsim }),
    },
    {
      key: 'm2_v2',
      label: 'Perímetro × Alto × Veces',
      activeInputs: ['largo', 'ancho', 'alto', 'nveces'],
      outputKey: 'area',
      formula: 'Área = (Largo + Ancho) × 2 × Alto × N° Veces',
      fn: (v) => ({ area: (v.largo + v.ancho) * 2 * v.alto * v.nveces }),
    },
    {
      key: 'm2_v3',
      label: 'Largo × Alto × Veces',
      activeInputs: ['largo', 'alto', 'nveces'],
      outputKey: 'area',
      formula: 'Área = Largo × Alto × N° Veces',
      fn: (v) => ({ area: v.largo * v.alto * v.nveces }),
    },
    {
      key: 'm2_v4',
      label: 'Área Total × Factor',
      activeInputs: ['largo', 'ancho', 'elsim'],
      outputKey: 'area',
      formula: 'Área = Área Total × Factor',
      fn: (v) => ({ area: (v.largo * v.ancho) * v.elsim }),
    },
    {
      key: 'm2_v5',
      label: 'Perímetro × Alto',
      activeInputs: ['largo', 'ancho', 'alto'],
      outputKey: 'area',
      formula: 'Área = (Largo + Ancho) × 2 × Alto',
      fn: (v) => ({ area: (v.largo + v.ancho) * 2 * v.alto }),
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // METROS CÚBICOS (m³) — 7 versiones
  // ─────────────────────────────────────────────────────────────
  m3: [
    {
      key: 'm3_v1',
      label: 'Largo × Ancho × Alto × Veces',
      activeInputs: ['largo', 'ancho', 'alto', 'nveces'],
      outputKey: 'vol',
      formula: 'Vol. = Largo × Ancho × Alto × N° Veces',
      fn: (v) => ({ vol: v.largo * v.ancho * v.alto * v.nveces }),
    },
    {
      key: 'm3_v2',
      label: 'Área × Espesor × Veces',
      activeInputs: ['largo', 'ancho', 'alto', 'nveces'],
      outputKey: 'vol',
      formula: 'Vol. = (Largo × Ancho) × Espesor × N° Veces',
      fn: (v) => ({ vol: (v.largo * v.ancho) * v.alto * v.nveces }),
    },
    {
      key: 'm3_v3',
      label: 'Perímetro × Alto × N',
      activeInputs: ['largo', 'ancho', 'alto', 'nveces'],
      outputKey: 'vol',
      formula: 'Vol. = (Largo + Ancho) × 2 × Alto × N',
      fn: (v) => ({ vol: (v.largo + v.ancho) * 2 * v.alto * v.nveces }),
    },
    {
      key: 'm3_v4',
      label: 'Área × Altura × Veces',
      activeInputs: ['largo', 'ancho', 'alto', 'nveces'],
      outputKey: 'vol',
      formula: 'Vol. = (Largo × Ancho) × Altura × N° Veces',
      fn: (v) => ({ vol: (v.largo * v.ancho) * v.alto * v.nveces }),
    },
    {
      key: 'm3_v5',
      label: 'Excavación - Relleno',
      activeInputs: ['largo', 'ancho', 'alto', 'elsim'],
      outputKey: 'vol',
      formula: 'Vol. = Vol. Excavación - Vol. Relleno',
      fn: (v) => ({ vol: (v.largo * v.ancho * v.alto) - v.elsim }),
    },
    {
      key: 'm3_v6',
      label: 'Excavación × Esponjamiento',
      activeInputs: ['largo', 'ancho', 'alto', 'elsim'],
      outputKey: 'vol',
      formula: 'Vol. = Vol. Excavación × Factor Esponjamiento',
      fn: (v) => ({ vol: (v.largo * v.ancho * v.alto) * v.elsim }),
    },
    {
      key: 'm3_v7',
      label: 'Largo × Ancho × Profundidad × N',
      activeInputs: ['largo', 'ancho', 'alto', 'nveces'],
      outputKey: 'vol',
      formula: 'Vol. = Largo × Ancho × Profundidad × N',
      fn: (v) => ({ vol: v.largo * v.ancho * v.alto * v.nveces }),
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // KILOGRAMOS (kg) — 5 versiones
  // ─────────────────────────────────────────────────────────────
  kg: [
    {
      key: 'kg_vbase',
      label: 'Simil × (L+A+H) × Veces × kg/m',
      activeInputs: ['elsim', 'largo', 'ancho', 'alto', 'nveces', 'kgm'],
      outputKey: 'kg',
      formula: 'Kg = [Elsim × (Largo + Ancho + Alto) × Veces] × kg/m',

      fn: (v) => {
        const lon = v.elsim * (v.largo + v.ancho + v.alto) * v.nveces;
        const kg = lon * v.kgm;

        if (!v.kgm) {
          return {
            lon: r4(lon),
            kg: 0,
          };
        }
        return { lon: r4(lon), kg: r4(kg) };
      },
    },
    {
      key: 'kg_v1',
      label: 'Longitud × kg/m',
      activeInputs: ['largo', 'kg'],
      outputKey: 'kg',
      formula: 'Peso = Longitud × kg/m',
      fn: (v) => ({ kg: v.largo * v.kg }),
    },
    {
      key: 'kg_v2',
      label: 'Largo Barra × Barras × Veces',
      activeInputs: ['largo', 'elsim', 'nveces'],
      outputKey: 'kg',
      formula: 'Long. = Largo Barra × N° Barras × N° Veces',
      fn: (v) => ({ kg: v.largo * v.elsim * v.nveces }),
    },
    {
      key: 'kg_v3',
      label: '(Largo + Gancho + Empalme) × Nb × N',
      activeInputs: ['largo', 'ancho', 'alto', 'nveces'],
      outputKey: 'kg',
      formula: 'Long. = (Largo + Gancho + Empalme) × Nb × N',
      fn: (v) => ({ kg: (v.largo + v.ancho + v.alto) * v.nveces }),
    },
    {
      key: 'kg_v4',
      label: 'Σ Longitud × kg/m',
      activeInputs: ['largo', 'kg', 'elsim'],
      outputKey: 'kg',
      formula: 'Peso = Σ(Long. por diámetro × kg/m)',
      fn: (v) => ({ kg: v.largo * v.kg * v.elsim }),
    },
    {
      key: 'kg_v5',
      label: 'Peso Manual',
      activeInputs: ['kg'],
      outputKey: 'kg',
      formula: 'Peso = Valor manual ingresado',
      fn: (v) => ({ kg: v.kg }),
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // METROS LINEALES (m) — 4 versiones
  // ─────────────────────────────────────────────────────────────
  m: [
    {
      key: 'm_v1',
      label: 'Largo × Veces',
      activeInputs: ['largo', 'nveces'],
      outputKey: 'lon',
      formula: 'Lon. = Largo × N° Veces',
      fn: (v) => ({ lon: v.largo * v.nveces }),
    },
    {
      key: 'm_v2',
      label: '(Largo + Ancho) × Veces × Elem',
      activeInputs: ['largo', 'ancho', 'nveces', 'elsim'],
      outputKey: 'lon',
      formula: 'Lon. = (Largo + Ancho) × N° Veces × Elem. Similar',
      fn: (v) => ({ lon: (v.largo + v.ancho) * v.nveces * v.elsim }),
    },
    {
      key: 'm_v3',
      label: 'Largo × Cables',
      activeInputs: ['largo', 'elsim'],
      outputKey: 'lon',
      formula: 'Lon. = Largo × N° Cables',
      fn: (v) => ({ lon: v.largo * v.elsim }),
    },
    {
      key: 'm_v4',
      label: 'Perímetro × Veces',
      activeInputs: ['largo', 'ancho', 'nveces'],
      outputKey: 'lon',
      formula: 'Lon. = (Largo + Ancho) × 2 × N° Veces',
      fn: (v) => ({ lon: (v.largo + v.ancho) * 2 * v.nveces }),
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // METROS LINEALES (ml) — mismas versiones que 'm'
  // ─────────────────────────────────────────────────────────────
  ml: [
    {
      key: 'ml_v1',
      label: 'Largo × Veces',
      activeInputs: ['largo', 'nveces'],
      outputKey: 'lon',
      formula: 'Lon. = Largo × N° Veces',
      fn: (v) => ({ lon: v.largo * v.nveces }),
    },
    {
      key: 'ml_v2',
      label: '(Largo + Ancho) × Veces',
      activeInputs: ['largo', 'ancho', 'nveces'],
      outputKey: 'lon',
      formula: 'Lon. = (Largo + Ancho) × N° Veces',
      fn: (v) => ({ lon: (v.largo + v.ancho) * v.nveces }),
    },
    {
      key: 'ml_v3',
      label: 'Largo × Cables',
      activeInputs: ['largo', 'elsim'],
      outputKey: 'lon',
      formula: 'Lon. = Largo × N° Cables',
      fn: (v) => ({ lon: v.largo * v.elsim }),
    },
    {
      key: 'ml_v4',
      label: 'Perímetro × Veces',
      activeInputs: ['largo', 'ancho', 'nveces'],
      outputKey: 'lon',
      formula: 'Lon. = (Largo + Ancho) × 2 × N° Veces',
      fn: (v) => ({ lon: (v.largo + v.ancho) * 2 * v.nveces }),
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // UNIDADES (und) — 5 versiones
  // ─────────────────────────────────────────────────────────────
  und: [
    {
      key: 'und_v1',
      label: 'Elem. Similar × Veces',
      activeInputs: ['elsim', 'nveces'],
      outputKey: 'und',
      formula: 'Und. = Elem. Similar × N° Veces',
      fn: (v) => ({ und: v.elsim * v.nveces }),
    },
    {
      key: 'und_v2',
      label: '1 × Veces',
      activeInputs: ['nveces'],
      outputKey: 'und',
      formula: 'Und. = 1 × N° Veces',
      fn: (v) => ({ und: 1 * v.nveces }),
    },
    {
      key: 'und_v3',
      label: 'Área × Factor',
      activeInputs: ['largo', 'ancho', 'elsim'],
      outputKey: 'und',
      formula: 'Und. = (Largo × Ancho) × Factor (und/m²)',
      fn: (v) => ({ und: (v.largo * v.ancho) * v.elsim }),
    },
    {
      key: 'und_v4',
      label: 'Conteo Directo',
      activeInputs: ['elsim'],
      outputKey: 'und',
      formula: 'Und. = Conteo directo',
      fn: (v) => ({ und: v.elsim }),
    },
    {
      key: 'und_v5',
      label: 'N° Equipos × 1',
      activeInputs: ['elsim'],
      outputKey: 'und',
      formula: 'Und. = N° Equipos × 1',
      fn: (v) => ({ und: v.elsim * 1 }),
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // PIEZAS (pza) — mismas versiones que 'und'
  // ─────────────────────────────────────────────────────────────
  pza: [
    {
      key: 'pza_v1',
      label: 'Elem. Similar × Veces',
      activeInputs: ['elsim', 'nveces'],
      outputKey: 'und',
      formula: 'Und. = Elem. Similar × N° Veces',
      fn: (v) => ({ und: v.elsim * v.nveces }),
    },
    {
      key: 'pza_v2',
      label: '1 × Veces',
      activeInputs: ['nveces'],
      outputKey: 'und',
      formula: 'Und. = 1 × N° Veces',
      fn: (v) => ({ und: 1 * v.nveces }),
    },
    {
      key: 'pza_v3',
      label: 'Área × Factor',
      activeInputs: ['largo', 'ancho', 'elsim'],
      outputKey: 'und',
      formula: 'Und. = (Largo × Ancho) × Factor',
      fn: (v) => ({ und: (v.largo * v.ancho) * v.elsim }),
    },
    {
      key: 'pza_v4',
      label: 'Conteo Directo',
      activeInputs: ['elsim'],
      outputKey: 'und',
      formula: 'Und. = Conteo directo',
      fn: (v) => ({ und: v.elsim }),
    },
    {
      key: 'pza_v5',
      label: 'N° Equipos × 1',
      activeInputs: ['elsim'],
      outputKey: 'und',
      formula: 'Und. = N° Equipos × 1',
      fn: (v) => ({ und: v.elsim }),
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // GLOBAL (glb) — 1 versión
  // ─────────────────────────────────────────────────────────────
  glb: [
    {
      key: 'glb_v1',
      label: 'Elem. Similar × Veces',
      activeInputs: ['elsim', 'nveces'],
      outputKey: 'und',
      formula: 'Und. = Elem. Similar × N° Veces',
      fn: (v) => ({ und: v.elsim * v.nveces }),
    },
  ],

  // ─────────────────────────────────────────────────────────────
  // PUNTOS (pto) — 1 versión
  // ─────────────────────────────────────────────────────────────
  pto: [
    {
      key: 'pto_v1',
      label: 'Elem. Similar × Veces',
      activeInputs: ['elsim', 'nveces'],
      outputKey: 'und',
      formula: 'Und. = Elem. Similar × N° Veces',
      fn: (v) => ({ und: v.elsim * v.nveces }),
    },
  ],
};

/** Fallback cuando la unidad no está registrada */
export const DEFAULT_PROFILE: UnitProfile = {
  key: 'default_v1',
  label: 'Fórmula Genérica',
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

// ── Paleta de niveles ──────────────────────────
export const LEVEL_PALETTE = [
  { bg: '#ffffff', fc: '#7e22ce', bl: 1 }, // L1: Morado
  { bg: '#ffffff', fc: '#dc2626', bl: 1 }, // L2: Rojo
  { bg: '#ffffff', fc: '#2563eb', bl: 1 }, // L3: Azul
  { bg: '#ffffff', fc: '#000000', bl: 1 }, // L4: Negro
  { bg: '#ffffff', fc: '#000000', bl: 1 }, // L5: Negro
  { bg: '#ffffff', fc: '#000000', bl: 0 }, // L6: Negro
  { bg: '#ffffff', fc: '#000000', bl: 0 }, // L7: Negro
  { bg: '#ffffff', fc: '#000000', bl: 0 }, // L8: Negro
  { bg: '#ffffff', fc: '#000000', bl: 0 }, // L9: Negro
  { bg: '#ffffff', fc: '#000000', bl: 0 }, // L10: Negro
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
  kgm: 'kg/m',
};

export const ALL_INPUTS: (keyof MeasureInputs)[] = [
  'elsim', 'largo', 'ancho', 'alto', 'nveces', 'kg', 'kgm'
];
