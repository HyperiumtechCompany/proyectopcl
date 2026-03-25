
import { router, usePage } from '@inertiajs/react';
import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import AppLayout from '@/layouts/app-layout';
import Luckysheet from '@/components/costos/tablas/Luckysheet';
import type { BreadcrumbItem } from '@/types';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft, Save, RefreshCcw,
  CheckCircle2, AlertCircle, Loader2,
  ArrowUp, ArrowDown, FolderPlus, Folder, FileText,
  Download, Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// ═══════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════
interface ColumnDef { key: string; label: string; width: number }

interface ComunicacionesPageProps {
  project: { id: number; nombre: string };
  metrado: Record<string, any>[];
  resumen: Record<string, any>[];
  [key: string]: unknown;
}

type EntryKind = 'group' | 'leaf';

interface Entry {
  ri: number;
  row: Record<string, any>;
  level: number;
  kind: EntryKind;
  total: number;
}

// ═══════════════════════════════════════════════════════════════════════
// COLUMNAS
// ═══════════════════════════════════════════════════════════════════════
const VISIBLE_COLS: ColumnDef[] = [
  { key: 'partida',     label: 'Partida',       width: 105 },
  { key: 'descripcion', label: 'Descripción',   width: 295 },
  { key: 'unidad',      label: 'Und',           width: 60  },
  { key: 'elsim',       label: 'Elem.Simil.',   width: 82  },
  { key: 'largo',       label: 'Largo',         width: 70  },
  { key: 'ancho',       label: 'Ancho',         width: 70  },
  { key: 'alto',        label: 'Alto',          width: 70  },
  { key: 'nveces',      label: 'N° Veces',      width: 70  },
  { key: 'lon',         label: 'Lon.',          width: 76  },
  { key: 'area',        label: 'Área',          width: 76  },
  { key: 'vol',         label: 'Vol.',          width: 76  },
  { key: 'kg',          label: 'Kg.',           width: 76  },
  { key: 'und',         label: 'Parcial',       width: 76  },
  { key: 'total',       label: 'Total',         width: 95  },
  { key: 'observacion', label: 'Observaciones', width: 148 },
];

const HIDDEN_COLS: ColumnDef[] = [
  { key: '_level', label: '_level', width: 1 },
  { key: '_kind',  label: '_kind',  width: 1 },
];

const BASE_COLS: ColumnDef[] = [...VISIBLE_COLS, ...HIDDEN_COLS];

const COL: Record<string, number> = Object.fromEntries(
  BASE_COLS.map((c, i) => [c.key, i]),
);

const RESUMEN_BASE: ColumnDef[] = [
  { key: 'item',        label: 'Items',        width: 80  },
  { key: 'descripcion', label: 'Descripción',  width: 350 },
  { key: 'und',         label: 'Und',           width: 60  },
  { key: 'parcial',     label: 'Parcial',      width: 100 },
  { key: 'total',       label: 'Total',         width: 100 },
];

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════
const UNIDAD_OPTIONS = ['und', 'm', 'ml', 'm2', 'm3', 'kg', 'lt', 'gl', 'pza'];
const TOP_LEVEL_START = 6;
const DEFAULT_DESC_GROUP = 'Nuevo grupo';
const DEFAULT_DESC_LEAF  = 'Nueva partida';
const MAX_LEVELS  = 10;
const SAVE_DEBOUNCE = 1800;

// ─── 1. COLORES DE TEXTO JERÁRQUICO (sin fondo de celda) ─────────────
// Cada nivel usa un color de fuente distinto. Los grupos tienen texto
// en azules oscuros → claros según profundidad. Las hojas: gris neutro.
const HIER_TEXT: Array<{ fc: string; bl: number; fs: number }> = [
  { fc: '#0f2d5c', bl: 1, fs: 11 }, // L1 — azul marino
  { fc: '#1a4480', bl: 1, fs: 11 }, // L2 — azul real
  { fc: '#1d5fa8', bl: 1, fs: 10 }, // L3 — azul medio
  { fc: '#2563eb', bl: 1, fs: 10 }, // L4 — blue-600
  { fc: '#3b82f6', bl: 1, fs: 10 }, // L5 — blue-500
  { fc: '#0369a1', bl: 0, fs: 10 }, // L6 — sky-700
  { fc: '#0284c7', bl: 0, fs: 10 }, // L7 — sky-600
  { fc: '#0ea5e9', bl: 0, fs: 10 }, // L8 — sky-500
  { fc: '#38bdf8', bl: 0, fs: 10 }, // L9 — sky-400
  { fc: '#7dd3fc', bl: 0, fs: 10 }, // L10 — sky-300
];

const LEAF_TEXT = { fc: '#374151', bl: 0, fs: 10 } as const;

const hierText = (level: number) =>
  HIER_TEXT[Math.min(level - 1, HIER_TEXT.length - 1)];

// ─── 2. RESALTADO DE CAMPOS POR UNIDAD ───────────────────────────────
// Los campos que el usuario DEBE rellenar se marcan en amarillo.
// Los campos CALCULADOS se marcan en verde claro.
// Los campos INACTIVOS para esa unidad se marcan en gris muy suave.
// Fórmula: resultado = elsim * (largo + ancho + alto) * nveces
const UNIT_INPUTS: Record<string, readonly string[]> = {
  'm':   ['elsim', 'largo', 'ancho', 'alto', 'nveces'],
  'ml':  ['elsim', 'largo', 'ancho', 'alto', 'nveces'],
  'm2':  ['elsim', 'largo', 'ancho', 'alto', 'nveces'],
  'm3':  ['elsim', 'largo', 'ancho', 'alto', 'nveces'],
  'lt':  ['elsim', 'largo', 'ancho', 'alto', 'nveces'],
  'gl':  ['elsim', 'largo', 'ancho', 'alto', 'nveces'],
  'kg':  ['elsim', 'kg', 'nveces'],
  'und': ['elsim', 'nveces'],
  'pza': ['elsim', 'nveces'],
};

const UNIT_OUTPUTS: Record<string, readonly string[]> = {
  'm':   ['lon', 'area', 'vol'],
  'ml':  ['lon', 'area', 'vol'],
  'm2':  ['lon', 'area', 'vol'],
  'm3':  ['lon', 'area', 'vol'],
  'lt':  ['lon', 'area', 'vol'],
  'gl':  ['lon', 'area', 'vol'],
  'kg':  ['und'],
  'und': ['und'],
  'pza': ['und'],
};

// Todos los campos numéricos de hoja (para aplicar colores)
const LEAF_NUM_FIELDS = ['elsim', 'largo', 'ancho', 'alto', 'nveces',
                         'lon', 'area', 'vol', 'kg', 'und', 'parcial', 'total'] as const;

const FIELD_BG = {
  input:    '#fef9c3',  // amarillo suave  → hay que rellenar
  output:   '#dcfce7',  // verde suave     → calculado
  inactive: '#f8fafc',  // gris muy suave  → no aplica para esta unidad
  total:    '#dbeafe',  // azul suave      → resultado total
  totalFc:  '#1d4ed8',  // azul            → texto del total
} as const;

// Colores del encabezado de la hoja
const HEADER_STYLE = {
  bg: '#0f172a', fc: '#94a3b8', bl: 1, fs: 10,
} as const;

const NBSP = '\u00A0\u00A0\u00A0';
const indent = (level: number, isLeaf: boolean) =>
  NBSP.repeat(isLeaf ? level : Math.max(0, level - 1));

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════
const toNum  = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const r4     = (n: number)  => Math.round(n * 10000) / 10000;
const trim0  = (v: unknown) => String(v ?? '').trimStart();
const blank  = (v: any)     => v === null || v === undefined || v === '';

const cellRaw = (cell: any): any => {
  if (!cell) return null;
  const r = cell.v;
  return r && typeof r === 'object' && 'v' in r ? r.v ?? null : r ?? null;
};

const colLetter = (i: number) => {
  let r = '', t = i;
  while (t >= 0) { r = String.fromCharCode((t % 26) + 65) + r; t = Math.floor(t / 26) - 1; }
  return r;
};

// ─── Constructores de celdas ─────────────────────────────────────────
const mkTxt = (v: string, extra: Record<string, any> = {}): Record<string, any> => ({
  v, m: v, ct: { fa: 'General', t: 'g' }, ...extra,
});

const mkNum = (v: number): Record<string, any> => ({
  v, m: v === 0 ? '' : String(v), ct: { fa: '#,##0.0000', t: 'n' },
});

/** Texto para un grupo: color de texto jerárquico, sin fondo */
const mkGroupTxt = (raw: string, disp: string, level: number) => {
  const st = hierText(level);
  return { v: raw, m: disp, ct: { fa: 'General', t: 'g' }, ...st };
};

/** Número para un grupo: color de texto jerárquico, sin fondo */
const mkGroupNum = (v: number, level: number) => {
  const st = hierText(level);
  return { v, m: v === 0 ? '' : String(v), ct: { fa: '#,##0.0000', t: 'n' }, ...st };
};

/** Número para una hoja con bg según tipo de campo */
const mkLeafNum = (v: number, bg: string) => ({
  v, m: v === 0 ? '' : String(v),
  ct: { fa: '#,##0.0000', t: 'n' },
  bg, fc: LEAF_TEXT.fc, fs: LEAF_TEXT.fs, bl: 0,
});

// ═══════════════════════════════════════════════════════════════════════
// CONVERSIÓN FILAS ↔ HOJA
// ═══════════════════════════════════════════════════════════════════════
function rowsToSheet(
  rows: Record<string, any>[],
  cols: ColumnDef[],
  name: string,
  order = 0,
  isResumen = false,
) {
  const header: any[] = cols.map((col, ci) => ({
    r: 0, c: ci,
    v: {
      v: col.label, m: col.label,
      ct: { fa: 'General', t: 'g' },
      ...HEADER_STYLE,
    },
  }));

  const cells: any[] = [];

  rows.forEach((row, ri) => {
    const kind  = String(row['_kind']  ?? 'leaf') === 'group' ? 'group' : 'leaf' as EntryKind;
    const level = Math.max(1, Math.min(MAX_LEVELS, toNum(row['_level']) || 1));
    const rIdx  = ri + 1;

    cols.forEach((col, ci) => {
      // Obtener el valor
      let val = row[col.key];
      
      // Determinar si es número
      const isNumField = ['elsim', 'largo', 'ancho', 'alto', 'nveces', 'lon', 'area', 'vol', 'kg', 'parcial', 'total'].includes(col.key);
      const numVal = isNumField ? toNum(val) : 0;
      
      // Para campos numéricos
      if (isNumField && col.key !== '_level' && col.key !== '_kind' && col.key !== 'und') {
        if (numVal === 0 && !isResumen) {
          return; // Omitir ceros en metrado
        }
        // Para el resumen, mostrar 0 si es 0
        if (isResumen && numVal === 0) {
          const st = hierText(level);
          cells.push({ r: rIdx, c: ci, v: { v: 0, m: '0', ct: { fa: '#,##0.0000', t: 'n' }, ...st } });
          return;
        }
        // Crear celda con el valor numérico
        const cell: Record<string, any> = kind === 'group'
          ? mkGroupNum(numVal, level)
          : { ...mkNum(numVal), ...LEAF_TEXT };
        cells.push({ r: rIdx, c: ci, v: cell });
        return;
      }

      // Para campos de texto
      if (blank(val) && !isResumen) return;

      const store = col.key === 'descripcion'
        ? String(val ?? '').trimStart()
        : val;

      if (blank(store) && !isResumen) return;

      // Para el resumen, siempre crear una celda (incluso vacía)
      if (isResumen && blank(store)) {
        const st = hierText(level);
        cells.push({ r: rIdx, c: ci, v: { v: '', m: '', ct: { fa: 'General', t: 'g' }, ...st } });
        return;
      }

      const isNum = typeof store === 'number' || (store !== '' && !isNaN(Number(store)));
      let cell: Record<string, any>;

      if (kind === 'group') {
        // Grupos: coloreado por texto, sin fondo
        if (col.key === 'descripcion') {
          const disp = indent(level, false) + store;
          cell = mkGroupTxt(String(store), disp, level);
        } else if (col.key === 'item' || col.key === 'partida') {
          // item o partida: código del grupo sin indentación
          cell = mkGroupTxt(String(store), String(store), level);
        } else if (isNum) {
          cell = mkGroupNum(Number(store), level);
        } else {
          const st = hierText(level);
          cell = { ...mkTxt(String(store)), ...st };
        }
      } else {
        // Hojas: estilo neutro inicial (recalc aplicará bg de campo)
        if (col.key === 'descripcion') {
          const disp = indent(level, true) + store;
          cell = {
            v: String(store), m: disp,
            ct: { fa: 'General', t: 'g' },
            ...LEAF_TEXT,
          };
        } else if (isNum) {
          cell = { ...mkNum(Number(store)), ...LEAF_TEXT };
        } else {
          cell = { ...mkTxt(String(store)), ...LEAF_TEXT };
        }
      }

      cells.push({ r: rIdx, c: ci, v: cell });
    });
  });

  const columnlen: Record<number, number> = {};
  const colhidden: Record<number, number> = {};
  cols.forEach((col, ci) => {
    columnlen[ci] = col.width;
    if (col.key === '_level' || col.key === '_kind') colhidden[ci] = 1;
  });

  return {
    name, status: order === 0 ? 1 : 0, order,
    row:    Math.max(rows.length + 50, 100),
    column: Math.max(cols.length + 5, 26),
    celldata: [...header, ...cells],
    config: { columnlen, colhidden, rowlen: { 0: 30 } },
    frozen: { type: 'row', range: { row_focus: 0 } },
  };
}

function sheetToRows(sheet: any, cols: ColumnDef[]): Record<string, any>[] {
  if (!sheet) return [];
  const data: any[][] = sheet.data || [];
  const rows: Record<string, any>[] = [];

  for (let r = 1; r < data.length; r++) {
    const row: Record<string, any> = {};
    let hasData = false;

    cols.forEach((col, ci) => {
      const raw = cellRaw(data[r]?.[ci]);
      if (!blank(raw)) {
        row[col.key] = col.key === 'descripcion'
          ? String(raw).trimStart()
          : raw;
        hasData = true;
      } else {
        row[col.key] = null;
      }
    });

    if (hasData) rows.push(row);
  }

  return rows;
}

function readDataRow(data: any[][], ri: number): Record<string, any> {
  const row: Record<string, any> = {};
  BASE_COLS.forEach((col, ci) => {
    const raw = cellRaw(data[ri]?.[ci]);
    row[col.key] = blank(raw) ? null : raw;
  });
  return row;
}

function rowMeta(row: Record<string, any>): { level: number; kind: EntryKind } {
  return {
    level: Math.max(1, Math.min(MAX_LEVELS, toNum(row['_level']) || 1)),
    kind:  String(row['_kind'] ?? 'leaf') === 'group' ? 'group' : 'leaf',
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 3. PLANTILLA EXCEL PARA IMPORTACIÓN
// ═══════════════════════════════════════════════════════════════════════
function downloadTemplate(projectName: string) {
  const wb = XLSX.utils.book_new();

  // ── Hoja "Metrado" con filas de ejemplo ───────────────────────────
  const exampleRows: Record<string, any>[] = [
    {
      partida: '', descripcion: 'INSTALACIONES DE COMUNICACIONES',
      unidad: 'glb', elsim: '', largo: '', ancho: '', alto: '', nveces: '',
      lon: '', area: '', vol: '', kg: '', und: '', total: '', observacion: '',
      _level: 1, _kind: 'group',
    },
    {
      partida: '', descripcion: 'CABLEADO ESTRUCTURADO',
      unidad: 'm', elsim: '', largo: '', ancho: '', alto: '', nveces: '',
      lon: '', area: '', vol: '', kg: '', und: '', total: '', observacion: '',
      _level: 2, _kind: 'group',
    },
    {
      partida: '', descripcion: 'Cable UTP CAT6 horizontal',
      unidad: 'm', elsim: '', largo: 25, ancho: '', alto: '', nveces: 4,
      lon: '', area: '', vol: '', kg: '', und: '', total: '', observacion: 'Piso 1',
      _level: 3, _kind: 'leaf',
    },
    {
      partida: '', descripcion: 'Canaleta 60x40 mm',
      unidad: 'm', elsim: '', largo: 12, ancho: '', alto: '', nveces: 2,
      lon: '', area: '', vol: '', kg: '', und: '', total: '', observacion: '',
      _level: 3, _kind: 'leaf',
    },
    {
      partida: '', descripcion: 'EQUIPOS ACTIVOS',
      unidad: 'und', elsim: '', largo: '', ancho: '', alto: '', nveces: '',
      lon: '', area: '', vol: '', kg: '', und: '', total: '', observacion: '',
      _level: 2, _kind: 'group',
    },
    {
      partida: '', descripcion: 'Switch 24 puertos POE',
      unidad: 'und', elsim: 1, largo: '', ancho: '', alto: '', nveces: 3,
      lon: '', area: '', vol: '', kg: '', und: '', total: '', observacion: 'Gabinete principal',
      _level: 3, _kind: 'leaf',
    },
  ];

  // Exportar con CLAVES como encabezados (necesario para re-importar)
  const colKeys = BASE_COLS.map(c => c.key);
  const wsData: any[][] = [
    colKeys, // fila 0: headers = claves exactas
    ...exampleRows.map(r => colKeys.map(k => r[k] ?? '')),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Anchos aproximados
  ws['!cols'] = BASE_COLS.map(c => ({ wpx: c.width }));

  XLSX.utils.book_append_sheet(wb, ws, 'Metrado');

  // ── Hoja "Instrucciones" ──────────────────────────────────────────
  const instrRows = [
    ['INSTRUCCIONES DE IMPORTACIÓN', '', ''],
    ['', '', ''],
    ['CAMPO', 'DESCRIPCIÓN', 'VALORES POSIBLES'],
    ['_level', 'Nivel jerárquico (1 = mayor, 10 = más profundo)',   '1, 2, 3, 4 ... 10'],
    ['_kind',  'Tipo de fila',                                      'group | leaf'],
    ['partida','Código (se calcula automáticamente al importar)',   'Dejar vacío'],
    ['descripcion','Nombre de la partida o grupo',                 'Texto libre'],
    ['unidad', 'Unidad de medida',                                  'und, m, ml, m2, m3, kg, lt, gl, pza'],
    ['elsim',  'Elementos similares (Und = elsim × nveces)',        'Número'],
    ['largo',  'Dimensión largo',                                   'Número (m)'],
    ['ancho',  'Dimensión ancho  (m2 = largo × ancho × nveces)',   'Número (m)'],
    ['alto',   'Dimensión alto   (m3 = largo × ancho × alto × nveces)', 'Número (m)'],
    ['nveces', 'Número de veces',                                   'Número entero'],
    ['lon',    'Calculado automáticamente (largo × nveces)',        'No ingresar'],
    ['area',   'Calculado automáticamente (largo × ancho × nveces)','No ingresar'],
    ['vol',    'Calculado automáticamente (largo × ancho × alto × nveces)', 'No ingresar'],
    ['kg',     'Peso en kg (solo para unidad = kg)',                'Número'],
    ['und',    'Parcial calculado (elsim × nveces)',                'No ingresar'],
    ['total',  'Total calculado automáticamente',                   'No ingresar'],
    ['observacion','Comentarios opcionales',                        'Texto libre'],
    ['', '', ''],
    ['CÁLCULOS AUTOMÁTICOS POR UNIDAD', '', ''],
    ['Unidad', 'Campos a rellenar', 'Resultado'],
    ['m / ml', 'largo, nveces',     'lon'],
    ['m2',     'largo, ancho, nveces', 'area'],
    ['m3 / lt / gl', 'largo, ancho, alto, nveces', 'vol'],
    ['kg',     'kg',                'total = kg'],
    ['und / pza', 'elsim, nveces',  'und (parcial)'],
    ['', '', ''],
    ['JERARQUÍA', '', ''],
    ['• _kind=group → grupo/cabecera (no lleva dimensiones)',       '', ''],
    ['• _kind=leaf  → partida/detalle (lleva dimensiones)',         '', ''],
    ['• Los grupos anidan grupos o partidas según su _level',       '', ''],
    ['• El sistema recalcula los totales y la numeración automáticamente', '', ''],
  ];

  const wsInstr = XLSX.utils.aoa_to_sheet(instrRows);
  wsInstr['!cols'] = [{ wpx: 280 }, { wpx: 300 }, { wpx: 200 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instrucciones');

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buffer]), `plantilla_metrado_${projectName}.xlsx`);
}

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════
export default function ComunicacionesIndex() {
  const { project, metrado, resumen } = usePage<ComunicacionesPageProps>().props;

  const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Costos',                 href: '/costos' },
    { title: project.nombre,           href: `/costos/${project.id}` },
    { title: 'Metrado Comunicaciones', href: '#' },
  ];

  const [saving,    setSaving]    = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const saveTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSheets    = useRef<any[]>([]);
  const progUpdateCount = useRef(0);

  // ═══════════════════════════════════════════════════════════════════
  // RESUMEN
  // ═══════════════════════════════════════════════════════════════════
  const buildResumenRows = useCallback((
    metradoData: Record<string, any>[],
  ) => {
    // Simplemente extraer los grupos del metrado y transformarlos al formato del resumen
    const resumen: Array<Record<string, any>> = [];
    let itemCounter = 0;
    
    metradoData.forEach((row) => {
      const kind = String(row['_kind'] ?? 'leaf') === 'group' ? 'group' : 'leaf';
      const level = toNum(row['_level']) || 1;
      
      // Solo procesar grupos
      if (kind === 'group') {
        itemCounter++;
        const itemCode = row.partida
          ? String(row.partida).trim()
          : String(itemCounter).padStart(2, '0');
        
        // Determinar la unidad - buscar en el grupo o heredarla
        let und = row.unidad || row.und || 'gl';
        // Si la unidad está vacía, buscar en los siblings o hijos
        if (!und || und === '') {
          und = 'gl';
        }
        
        resumen.push({
          _level: level,
          _kind: 'group',
          item: itemCode || String(itemCounter).padStart(2, '0'),
          descripcion: row.descripcion || '',
          und: und,
          parcial: toNum(row.total),
          total: toNum(row.total),
        });
      }
    });

    return resumen;
  }, []);

  const resumenRows = useMemo(() => {
    // Primero: usar los datos del resumen del servidor si están disponibles
    if (resumen && Array.isArray(resumen) && resumen.length > 0) {
      return resumen.map((row: any, idx: number) => ({
        _level: row._level ?? row.nivel ?? 1,
        _kind: 'group',
        item: row.item || row.partida || String(idx + 1).padStart(2, '0'),
        descripcion: row.descripcion || row.titulo || '',
        und: row.und || row.unidad || 'gl',
        parcial: toNum(row.parcial ?? 0),
        total: toNum(row.total ?? row.parcial ?? 0),
      }));
    }
    
    // Segundo: construir desde el metrado si no hay resumen del servidor
    const metradoData = metrado ?? [];
    if (metradoData.length > 0) {
      return buildResumenRows(metradoData);
    }
    
    return [];
  }, [resumen, metrado, buildResumenRows]);

  const initialSheets = useMemo(() => [
    rowsToSheet(metrado ?? [],  BASE_COLS,    'Metrado', 0),
    rowsToSheet(resumenRows,    RESUMEN_BASE, 'Resumen', 1, true),
  ], [metrado, resumenRows]);

  // ═══════════════════════════════════════════════════════════════════
  // GUARDAR
  // ═══════════════════════════════════════════════════════════════════
  const doSave = useCallback(async (sheets: any[]) => {
    setSaving(true);
    setSaveError(null);

    const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
    const headers = {
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': csrf,
      'X-Requested-With': 'XMLHttpRequest',
    };

    const reqs = sheets
      .filter((s: any) => s?.name === 'Metrado' || s?.name === 'Resumen')
      .map((sheet: any) => ({
        url: `/costos/${project.id}/metrado-comunicaciones/${sheet.name === 'Metrado' ? 'metrado' : 'resumen'}`,
        body: {
          rows: sheetToRows(sheet, sheet.name === 'Metrado' ? BASE_COLS : RESUMEN_BASE),
        },
      }));

    try {
      const results = await Promise.all(
        reqs.map((r) =>
          fetch(r.url, { method: 'PATCH', headers, body: JSON.stringify(r.body) })
            .then((res) => ({ ok: res.ok, status: res.status })),
        ),
      );
      const bad = results.find((r) => !r.ok);
      if (bad) setSaveError(`Error ${bad.status} al guardar`);
      else setLastSaved(new Date());
    } catch (e: any) {
      setSaveError(e.message ?? 'Error de red');
    } finally {
      setSaving(false);
    }
  }, [project.id]);

  const scheduleSave = useCallback((sheets: any[]) => {
    latestSheets.current = sheets;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(latestSheets.current), SAVE_DEBOUNCE);
  }, [doSave]);

  // ═══════════════════════════════════════════════════════════════════
  // RECÁLCULO — núcleo del sistema
  // ═══════════════════════════════════════════════════════════════════
  const recalcActiveSheet = useCallback(() => {
    if (progUpdateCount.current > 2) return;

    const ls = (window as any).luckysheet;
    if (!ls) return;

    const sheets = ls.getAllSheets?.() ?? [];
    const active = sheets.find((s: any) => s.status === 1) ?? sheets[0];
    if (!active || active.name === 'Resumen') return;

    const data: any[][] = active.data || [];
    const sheetOrder    = active.order ?? 0;

    // Recolectar entradas válidas
    const entries: Entry[] = [];
    for (let r = 1; r < data.length; r++) {
      const row     = readDataRow(data, r);
      const hasData = BASE_COLS.some((col) => !blank(row[col.key]));
      if (!hasData) continue;
      const { level, kind } = rowMeta(row);
      entries.push({ ri: r, row, level, kind, total: 0 });
    }
    if (entries.length === 0) return;

    const updates: Array<{ r: number; c: number; v: any }> = [];
    const set = (r: number, key: string, v: any) => {
      const c = COL[key];
      if (c !== undefined) updates.push({ r, c, v });
    };

    // ── 1. Numeración y estilos de texto jerárquico ──────────────────
    const counters = new Array(MAX_LEVELS + 1).fill(0);
    counters[1] = Math.max(0, TOP_LEVEL_START - 1);

    entries.forEach(({ ri, row, level, kind }) => {
      if (kind === 'leaf') {
        // Hojas: limpiar código, aplicar estilo neutro
        if (!blank(row.partida)) {
          set(ri, 'partida', mkTxt(''));
          row.partida = '';
        }
        const desc = trim0(row.descripcion);
        if (desc) {
          set(ri, 'descripcion', {
            v: desc, m: indent(level, true) + desc,
            ct: { fa: 'General', t: 'g' }, ...LEAF_TEXT,
          });
          row.descripcion = desc;
        }
        if (row['_kind'] !== 'leaf') set(ri, '_kind', 'leaf');
        return;
      }

      // Grupos: generar código y colorear texto
      for (let i = level + 1; i <= MAX_LEVELS; i++) counters[i] = 0;
      counters[level]++;

      const code = counters
        .slice(1, level + 1)
        .map((n) => String(n).padStart(2, '0'))
        .join('.');

      if (row.partida !== code) {
        set(ri, 'partida', mkGroupTxt(code, code, level));
        row.partida = code;
      }

      const desc = trim0(row.descripcion);
      if (desc) {
        set(ri, 'descripcion', mkGroupTxt(desc, indent(level, false) + desc, level));
        row.descripcion = desc;
      }

      if (row['_kind'] !== 'group') set(ri, '_kind', 'group');
    });

    // ── 2. Herencia de unidad ─────────────────────────────────────────
    const unitStack = new Array(MAX_LEVELS + 1).fill('');

    entries.forEach(({ ri, row, level, kind }) => {
      if (kind === 'group') {
        for (let i = level; i <= MAX_LEVELS; i++) unitStack[i] = '';
        unitStack[level] = String(row.unidad ?? '').trim();
      } else {
        let inherited = '';
        for (let l = level - 1; l >= 1; l--) {
          if (unitStack[l]) { inherited = unitStack[l]; break; }
        }
        if (inherited && String(row.unidad ?? '').trim() !== inherited) {
          row.unidad = inherited;
          set(ri, 'unidad', { ...mkTxt(inherited), ...LEAF_TEXT });
        }
      }
    });

    // ── 3. Cálculos + coloreado de campos por unidad ─────────────────
    entries.forEach((e) => {
      if (e.kind !== 'leaf') return;
      const { row, ri } = e;

      const unidad    = String(row.unidad ?? '').trim().toLowerCase();
      const inputSet  = new Set(UNIT_INPUTS[unidad]  ?? []);
      const outputSet = new Set(UNIT_OUTPUTS[unidad] ?? []);

      /** Determina el color de fondo de un campo de hoja */
      const fieldBg = (key: string): string => {
        if (inputSet.has(key))  return FIELD_BG.input;
        if (outputSet.has(key)) return FIELD_BG.output;
        return FIELD_BG.inactive;
      };

      const elsim  = toNum(row.elsim);
      const nveces = toNum(row.nveces);
      const largo  = toNum(row.largo);
      const ancho  = toNum(row.ancho);
      const alto   = toNum(row.alto);

      // Cálculo: m = elsim * (largo + ancho + alto) * nveces
      const newLon  = r4(elsim * (largo + ancho + alto) * nveces);
      const newArea = r4(elsim * (largo + ancho + alto) * nveces);
      const newVol  = r4(elsim * (largo + ancho + alto) * nveces);
      const newUnd  = r4(elsim * nveces);

      // Inputs con bg de color guía
      (['elsim', 'largo', 'ancho', 'alto', 'nveces'] as const).forEach((key) => {
        set(ri, key, mkLeafNum(toNum(row[key]), fieldBg(key)));
      });

      // kg: especial (solo activo si unidad === kg)
      set(ri, 'kg', mkLeafNum(toNum(row.kg), fieldBg('kg')));

      // Resultados calculados
      set(ri, 'lon',  mkLeafNum(newLon,  fieldBg('lon')));
      set(ri, 'area', mkLeafNum(newArea, fieldBg('area')));
      set(ri, 'vol',  mkLeafNum(newVol,  fieldBg('vol')));
      set(ri, 'und',  mkLeafNum(newUnd,  fieldBg('und')));

      // Actualizar row para el roll-up
      Object.assign(row, { lon: newLon, area: newArea, vol: newVol, und: newUnd });

      // Total
      let tVal = 0;
      if (unidad === 'm' || unidad === 'ml')  tVal = newLon;
      else if (unidad === 'm2')               tVal = newArea;
      else if (unidad === 'm3' || unidad === 'lt' || unidad === 'gl') tVal = newVol;
      else if (unidad === 'kg')               tVal = toNum(row.kg);
      else if (unidad === 'und' || unidad === 'pza') tVal = newUnd;

      e.total  = tVal;
      row.total = tVal;

      set(ri, 'total', {
        v: tVal, m: tVal === 0 ? '' : String(tVal),
        ct: { fa: '#,##0.0000', t: 'n' },
        bg: FIELD_BG.total, fc: FIELD_BG.totalFc, fs: 10, bl: 1,
      });
    });

    // ── 4. Roll-up de totales hacia los grupos ────────────────────────
    // Sumar TODOS los totales de leaves (partidas/detalles) dentro de cada grupo
    const maxLvl = entries.reduce((m, e) => Math.max(m, e.level), 1);

    for (let lvl = maxLvl; lvl >= 1; lvl--) {
      entries.forEach((e, idx) => {
        if (e.kind !== 'group' || e.level !== lvl) return;
        let sum = 0;
        // Sumar todos los totals de entries que están dentro de este grupo
        for (let j = idx + 1; j < entries.length; j++) {
          const child = entries[j];
          if (child.level <= lvl) break; // Salir si encontramos un sibling o ancestor
          // Solo sumar totals de leaves (partidas/detalles)
          if (child.kind === 'leaf') {
            sum = r4(sum + child.total);
          }
        }
        e.total = sum;
        e.row.total = sum;
        set(e.ri, 'total', mkGroupNum(sum, lvl));
      });
    }

    if (updates.length === 0 || updates.length > 10000) return;

    progUpdateCount.current++;
    updates.forEach((u, idx) => {
      ls.setCellValue(u.r, u.c, u.v, {
        order: sheetOrder,
        isRefresh: idx === updates.length - 1,
      });
    });

    setTimeout(() => {
      progUpdateCount.current = Math.max(0, progUpdateCount.current - 1);
      const all = ls.getAllSheets?.() ?? [];
      if (all.length > 0) {
        scheduleSave(all);
        handleSyncResumen();
      }
    }, 120);
  }, [scheduleSave]); // eslint-disable-line react-hooks/exhaustive-deps

  const afterChange = useCallback((_data: any) => {
    setTimeout(() => recalcActiveSheet(), 80);
  }, [recalcActiveSheet]);

  const handleDataChange = useCallback((sheets: any[]) => {
    scheduleSave(sheets);
  }, [scheduleSave]);

  // ═══════════════════════════════════════════════════════════════════
  // MOVER BLOQUE
  // ═══════════════════════════════════════════════════════════════════
  const moveBlock = useCallback((direction: 'up' | 'down') => {
    const ls = (window as any).luckysheet;
    if (!ls) return;

    const sheets = ls.getAllSheets?.() ?? [];
    const active = sheets.find((s: any) => s.status === 1);
    if (!active || active.name === 'Resumen') return;

    const range = ls.getRange?.();
    if (!range?.length) return;

    const selRow    = range[0].row[0];
    const data: any[][] = active.data || [];
    const sheetOrder    = active.order ?? 0;

    type RI = { ri: number; level: number; kind: EntryKind };
    const riList: RI[] = [];

    for (let r = 1; r < data.length; r++) {
      const row = readDataRow(data, r);
      const hasData = BASE_COLS.some((col) => !blank(row[col.key]));
      if (!hasData) continue;
      const { level, kind } = rowMeta(row);
      riList.push({ ri: r, level, kind });
    }

    const selIdx   = riList.findIndex((e) => e.ri === selRow);
    if (selIdx === -1) return;

    const selLevel = riList[selIdx].level;
    let blockEnd   = selRow;

    for (let i = selIdx + 1; i < riList.length; i++) {
      if (riList[i].level <= selLevel) break;
      blockEnd = riList[i].ri;
    }

    const blockEndIdx = riList.findIndex((e) => e.ri === blockEnd);

    const readBlock = (from: number, to: number) => {
      const out: any[][] = [];
      for (let r = from; r <= to; r++) out.push(data[r] ? [...data[r]] : []);
      return out;
    };

    const writeBlock = (rows: any[][], startRow: number, isLast: boolean) => {
      rows.forEach((rowData, i) => {
        const r = startRow + i;
        BASE_COLS.forEach((_, ci) => {
          const val = rowData[ci] ?? null;
          const isLastCell = isLast && i === rows.length - 1 && ci === BASE_COLS.length - 1;
          ls.setCellValue(r, ci, blank(val) ? '' : val, {
            order: sheetOrder, isRefresh: isLastCell,
          });
        });
      });
    };

    progUpdateCount.current++;

    if (direction === 'up') {
      let prevSibIdx = -1;
      for (let i = selIdx - 1; i >= 0; i--) {
        if (riList[i].level < selLevel) break;
        if (riList[i].level === selLevel) { prevSibIdx = i; break; }
      }
      if (prevSibIdx === -1) { progUpdateCount.current--; return; }

      const prevStart = riList[prevSibIdx].ri;
      let prevEnd     = prevStart;
      for (let i = prevSibIdx + 1; i < selIdx; i++) {
        if (riList[i].level <= selLevel) break;
        prevEnd = riList[i].ri;
      }

      const prevBlock = readBlock(prevStart, prevEnd);
      const ourBlock  = readBlock(selRow, blockEnd);
      writeBlock(ourBlock,  prevStart,               false);
      writeBlock(prevBlock, prevStart + ourBlock.length, true);
    } else {
      let nextSibIdx = -1;
      for (let i = blockEndIdx + 1; i < riList.length; i++) {
        if (riList[i].level < selLevel) break;
        if (riList[i].level === selLevel) { nextSibIdx = i; break; }
      }
      if (nextSibIdx === -1) { progUpdateCount.current--; return; }

      const nextStart = riList[nextSibIdx].ri;
      let nextEnd     = nextStart;
      for (let i = nextSibIdx + 1; i < riList.length; i++) {
        if (riList[i].level <= selLevel) break;
        nextEnd = riList[i].ri;
      }

      const nextBlock = readBlock(nextStart, nextEnd);
      const ourBlock  = readBlock(selRow, blockEnd);
      writeBlock(nextBlock, selRow,                    false);
      writeBlock(ourBlock,  selRow + nextBlock.length, true);
    }

    setTimeout(() => {
      progUpdateCount.current = Math.max(0, progUpdateCount.current - 1);
    }, 100);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════════════════════════════════════════════════════════════════
  // AGREGAR FILAS
  // ═══════════════════════════════════════════════════════════════════
  const addRow = useCallback((kind: EntryKind, sameLevelAsSelected = true) => {
    const ls = (window as any).luckysheet;
    if (!ls) return;

    const sheets = ls.getAllSheets?.() ?? [];
    const active = sheets.find((s: any) => s.status === 1) ?? sheets[0];
    if (!active || active.name === 'Resumen') return;

    const data: any[][] = active.data || [];
    const sheetOrder    = active.order ?? 0;

    const range   = ls.getRange?.();
    const selRow  = range?.[0]?.row?.[1] ?? range?.[0]?.row?.[0] ?? 1;
    const selData = readDataRow(data, selRow);
    const { level: selLevel, kind: selKind } = rowMeta(selData);

    let newLevel: number;
    if (kind === 'leaf') {
      newLevel = selKind === 'group' ? selLevel + 1 : selLevel;
    } else {
      newLevel = sameLevelAsSelected ? selLevel : Math.min(selLevel + 1, MAX_LEVELS);
    }

    let insertAfter = selRow;
    if (sameLevelAsSelected && kind === 'group') {
      for (let r = selRow + 1; r < data.length; r++) {
        const rd      = readDataRow(data, r);
        const hasData = BASE_COLS.some((col) => !blank(rd[col.key]));
        if (!hasData) break;
        const { level } = rowMeta(rd);
        if (level <= selLevel) break;
        insertAfter = r;
      }
    }

    ls.insertRow(insertAfter + 1, 1);
    const r = insertAfter + 1;

    ls.setCellValue(r, COL['_level'], newLevel,   { order: sheetOrder });
    ls.setCellValue(r, COL['_kind'],  kind,        { order: sheetOrder });
    ls.setCellValue(r, COL['descripcion'],
      kind === 'group' ? DEFAULT_DESC_GROUP : DEFAULT_DESC_LEAF,
      { order: sheetOrder },
    );

    if (kind === 'group') {
      ['elsim','largo','ancho','alto','nveces','lon','area','vol','kg','und','total']
        .forEach((key) => ls.setCellValue(r, COL[key], '', { order: sheetOrder }));
    }

    setTimeout(() => recalcActiveSheet(), 120);
  }, [recalcActiveSheet]);

  // ═══════════════════════════════════════════════════════════════════
  // DROPDOWN UNIDADES
  // ═══════════════════════════════════════════════════════════════════
  const applyUnitDropdowns = useCallback(() => {
    let attempts = 0;
    const ls = (window as any).luckysheet;
    const apply = () => {
      const sheets = ls?.getAllSheets?.() ?? [];
      if (!ls || typeof ls.setDataVerification !== 'function' || sheets.length === 0) {
        if (++attempts < 40) setTimeout(apply, 250);
        return;
      }
      const ci    = COL['unidad'];
      const range = `${colLetter(ci)}2:${colLetter(ci)}3000`;
      const opt   = {
        type: 'dropdown', value1: UNIDAD_OPTIONS.join(','),
        prohibitInput: false, hint: 'Seleccione una unidad',
      };
      sheets.forEach((s: any) => {
        if (s.name === 'Resumen') return;
        ls.setDataVerification(opt, { range, order: s.order ?? 0 });
      });
    };
    apply();
  }, []);

  useEffect(() => {
    const timer = setTimeout(applyUnitDropdowns, 400);
    return () => clearTimeout(timer);
  }, [initialSheets, applyUnitDropdowns]);

  useEffect(() => {
    let intentos = 0;
    const run = () => {
      const ls = (window as any).luckysheet;
      if (!ls || typeof ls.getAllSheets !== 'function') {
        if (intentos++ < 20) setTimeout(run, 300);
        return;
      }
      recalcActiveSheet();
    };
    run();
  }, [recalcActiveSheet]);

  // ═══════════════════════════════════════════════════════════════════
  // SINCRONIZAR RESUMEN
  // ═══════════════════════════════════════════════════════════════════
  const handleSyncResumen = useCallback(() => {
    setIsSyncing(true);

    setTimeout(() => {
      const ls = (window as any).luckysheet;
      if (!ls) { setIsSyncing(false); return; }

      const all: any[]       = ls.getAllSheets();
      let metradoData: Record<string, any>[] = [];
      let resIdx = -1;

      all.forEach((sheet: any, idx: number) => {
        if (sheet.name === 'Metrado')  metradoData = sheetToRows(sheet, BASE_COLS);
        if (sheet.name === 'Resumen')  resIdx = idx;
      });

      if (resIdx === -1) { setIsSyncing(false); return; }

      const newRows      = buildResumenRows(metradoData);
      const currentOrder = ls.getSheet().order;

      ls.setSheetActive(resIdx);
      ls.clearRange({ row: [0, 500], column: [0, 20] });

      RESUMEN_BASE.forEach((col, c) =>
        ls.setCellValue(0, c, col.label, { isRefresh: false }),
      );

      newRows.forEach((row, r) => {
        RESUMEN_BASE.forEach((col, c) => {
          const val = row[col.key as keyof typeof row] ?? '';
          ls.setCellValue(r + 1, c, val, { isRefresh: false });
        });
      });

      ls.refresh();
      ls.setSheetActive(currentOrder);
      doSave(all);
      setIsSyncing(false);
    }, 400);
  }, [buildResumenRows, doSave]);

  // ═══════════════════════════════════════════════════════════════════
  // 4. EXPORTAR (compatible con re-importación — incluye _level/_kind)
  // ═══════════════════════════════════════════════════════════════════
  const exportToExcel = useCallback(() => {
    const ls = (window as any).luckysheet;
    if (!ls) return;

    const wb    = XLSX.utils.book_new();
    const sheets: any[] = ls.getAllSheets();

    sheets.forEach((sheet: any) => {
      const cols = sheet.name === 'Resumen' ? RESUMEN_BASE : BASE_COLS;
      const rows = sheetToRows(sheet, cols);

      // Los headers deben ser las CLAVES (para que la re-importación funcione)
      const colKeys = cols.map((c) => c.key);
      const wsData: any[][] = [
        colKeys,
        ...rows.map((r) => colKeys.map((k) => r[k] ?? '')),
      ];

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = cols.map((c) => ({ wpx: c.width }));
      XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    });

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buffer]), `metrado_${project.nombre}.xlsx`);
  }, [project.nombre]);

  // ═══════════════════════════════════════════════════════════════════
  // IMPORTAR EXCEL
  // ═══════════════════════════════════════════════════════════════════
  const handleImport = useCallback((file: File) => {
    if (!file.name.endsWith('.xlsx')) {
      alert('Solo se aceptan archivos Excel (.xlsx)');
      return;
    }

    const reader = new FileReader();

    reader.onload = (e: any) => {
      try {
        const data     = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        const newSheets: any[] = [];

        workbook.SheetNames.forEach((name, index) => {
          const ws   = workbook.Sheets[name];
          const isResumenSheet = name === 'Resumen';
          const cols = name === 'Instrucciones' ? null
                     : isResumenSheet          ? RESUMEN_BASE
                     :                            BASE_COLS;

          if (!cols) return; // Ignorar hoja de instrucciones

          // sheet_to_json usa la primera fila como headers → deben ser las claves
          const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });

          const normalized = json.map((row) => {
            // Si tiene numeración en 'partida' → es grupo, si no → es leaf (partida/detalle)
            const hasPartida = !blank(row.partida) && String(row.partida).trim() !== '';
            const kind = hasPartida ? 'group' : 'leaf';
            
            return {
              ...row,
              _level: row._level ?? 1,
              _kind:  kind,
            };
          });

          newSheets.push(rowsToSheet(normalized, cols, name, index, isResumenSheet));
        });

        if (newSheets.length === 0) {
          alert('No se encontraron hojas válidas en el archivo.');
          return;
        }

        const ls = (window as any).luckysheet;
        if (!ls) return;

        // Verificar que el contenedor DOM esté disponible antes de destruir/recrear
        const container = document.getElementById('luckysheet');
        if (!container) {
          console.error('[Import] Contenedor luckysheet no encontrado en el DOM');
          return;
        }

        ls.destroy();
        
        // Esperar a que el DOM se actualice antes de crear la nueva hoja
        setTimeout(() => {
          const containerAfter = document.getElementById('luckysheet');
          if (!containerAfter) {
            console.error('[Import] Contenedor luckysheet no existe después de destroy');
            return;
          }
          ls.create({ container: 'luckysheet', data: newSheets });

          // Recalcular, aplicar dropdowns y sincronizar resumen
          setTimeout(() => {
            recalcActiveSheet();
            // Aplicar dropdowns de unidades después de importar
            applyUnitDropdowns();
            setTimeout(() => handleSyncResumen(), 600);
          }, 300);
        }, 100);

      } catch (err) {
        console.error('Error al importar:', err);
        alert('Error al procesar el archivo. Verifique que sea una plantilla válida.');
      }
    };

    reader.readAsArrayBuffer(file);
  }, [recalcActiveSheet, handleSyncResumen, applyUnitDropdowns]);

  const triggerRecalc = () => setTimeout(() => recalcActiveSheet(), 0);

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="flex h-[calc(100vh-65px)] w-full flex-col overflow-hidden bg-slate-50 dark:bg-gray-950">

        {/* HEADER */}
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between
          gap-2 border-b border-slate-200/80 bg-white/92 px-4 py-2 shadow-sm
          backdrop-blur-md dark:border-gray-800/60 dark:bg-gray-900/92">

          <div className="flex items-center gap-2.5">
            <button type="button"
              onClick={() => router.get(`/costos/${project.id}`)}
              className="flex h-7 w-7 items-center justify-center rounded-full
                text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700
                dark:hover:bg-gray-800 dark:hover:text-gray-200">
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="leading-tight">
              <p className="text-[13px] font-bold text-slate-900 dark:text-gray-100">
                Metrado Comunicaciones
              </p>
              <p className="text-[9px] font-medium uppercase tracking-wider text-slate-400">
                {project.nombre}
              </p>
            </div>

            {/* Leyenda de colores de jerarquía */}
            <div className="hidden items-center gap-1 xl:flex">
              {HIER_TEXT.slice(0, 5).map((st, i) => (
                <span key={i}
                  className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-white border border-slate-200"
                  style={{ color: st.fc }}>
                  N{i + 1}
                </span>
              ))}
              <span className="rounded px-1.5 py-0.5 text-[9px] border border-slate-200 bg-white"
                style={{ color: LEAF_TEXT.fc }}>
                Hoja
              </span>
              <span className="ml-1 text-[9px] text-slate-300">|</span>
              {/* Leyenda campos */}
              <span className="rounded px-1.5 py-0.5 text-[9px]" style={{ background: FIELD_BG.input, color: '#92400e' }}>
                Ingresar
              </span>
              <span className="rounded px-1.5 py-0.5 text-[9px]" style={{ background: FIELD_BG.output, color: '#166534' }}>
                Calculado
              </span>
              <span className="rounded px-1.5 py-0.5 text-[9px]" style={{ background: FIELD_BG.total, color: FIELD_BG.totalFc }}>
                Total
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <SaveStatus saving={saving} error={saveError} lastSaved={lastSaved} />

            <Divider />

            {/* Insertar filas */}
            <div className="flex items-center gap-1">
              <ActionBtn
                icon={<FolderPlus className="h-3 w-3" />}
                label="Grupo"
                title="Insertar grupo al mismo nivel"
                style={{ background: '#0f2d5c', color: '#fff' }}
                onClick={() => addRow('group', true)}
              />
              <ActionBtn
                icon={<Folder className="h-3 w-3" />}
                label="Sub-grupo"
                title="Insertar sub-grupo (nivel + 1)"
                style={{ background: '#2563eb', color: '#fff' }}
                onClick={() => addRow('group', false)}
              />
              <ActionBtn
                icon={<FileText className="h-3 w-3" />}
                label="Partida"
                title="Insertar partida (hoja)"
                style={{ background: '#f1f5f9', color: '#1e3a5f', border: '1px solid #cbd5e1' }}
                onClick={() => addRow('leaf', false)}
              />
            </div>

            <Divider />

            <ActionBtn
              icon={<ArrowUp className="h-3 w-3" />}
              label="↑"
              title="Mover bloque arriba"
              style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}
              onClick={() => moveBlock('up')}
            />
            <ActionBtn
              icon={<ArrowDown className="h-3 w-3" />}
              label="↓"
              title="Mover bloque abajo"
              style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}
              onClick={() => moveBlock('down')}
            />

            <Divider />

            <Button variant="outline" size="sm"
              onClick={() => doSave(latestSheets.current)}
              disabled={saving}
              className="h-7 gap-1 text-[11px]">
              {saving
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Save className="h-3 w-3" />}
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>

            <Button variant="outline" size="sm"
              onClick={handleSyncResumen}
              disabled={isSyncing || saving}
              className="h-7 gap-1 text-[11px]">
              <RefreshCcw className={cn('h-3 w-3', isSyncing && 'animate-spin')} />
              {isSyncing ? 'Sincronizando…' : 'Sync'}
            </Button>

            <Divider />

            {/* Exportar */}
            <Button variant="outline" size="sm"
              onClick={exportToExcel}
              className="h-7 gap-1 text-[11px]">
              <Download className="h-3 w-3" />
              Exportar
            </Button>

            {/* Descargar plantilla */}
            <Button variant="outline" size="sm"
              onClick={() => downloadTemplate(project.nombre)}
              className="h-7 gap-1 text-[11px] text-emerald-700 border-emerald-300
                hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700
                dark:hover:bg-emerald-950/30">
              <Download className="h-3 w-3" />
              Plantilla
            </Button>

            {/* Importar */}
            <label className="inline-flex h-7 cursor-pointer items-center gap-1
              rounded-md border border-slate-200 bg-white px-2 text-[11px]
              font-medium text-slate-700 transition-colors hover:bg-slate-50
              dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200
              dark:hover:bg-gray-700">
              <Upload className="h-3 w-3" />
              Importar
              <input
                type="file"
                accept=".xlsx"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleImport(file);
                    e.target.value = ''; // reset para permitir re-importar mismo archivo
                  }
                }}
              />
            </label>
          </div>
        </header>

        {/* HOJA */}
        <main className="relative flex-1 overflow-hidden">
          <Luckysheet
            data={initialSheets}
            onDataChange={handleDataChange}
            height="calc(100vh - 112px)"
            options={{
              title:            'Metrado Comunicaciones',
              showinfobar:      false,
              showtoolbar:      false,
              showsheet:        false,
              sheetFormulaBar:  true,
              showstatisticBar: false,
              afterChange:      afterChange,
              contextMenu: {
                row: [
                  ctxItem('Insertar Grupo (mismo nivel)', 'group', true,  triggerRecalc, addRow),
                  ctxItem('Insertar Sub-grupo (N+1)',      'group', false, triggerRecalc, addRow),
                  ctxItem('Insertar Partida (hoja)',       'leaf',  false, triggerRecalc, addRow),
                  { type: 'separator' },
                  { text: '↑ Mover bloque arriba', type: 'button', onClick: () => moveBlock('up') },
                  { text: '↓ Mover bloque abajo',  type: 'button', onClick: () => moveBlock('down') },
                  { type: 'separator' },
                  {
                    text: 'Eliminar fila',
                    type: 'button',
                    onClick: () => {
                      const ls = (window as any).luckysheet;
                      if (!ls) return;
                      const r = ls.getRange?.();
                      if (!r?.length) return;
                      ls.deleteRow(r[0].row[0], 1);
                      triggerRecalc();
                    },
                  },
                ],
              },
            }}
          />
        </main>
      </div>
    </AppLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SUBCOMPONENTES
// ═══════════════════════════════════════════════════════════════════════
function Divider() {
  return <div className="h-5 w-px bg-slate-200 dark:bg-gray-700" />;
}

function SaveStatus({ saving, error, lastSaved }: {
  saving: boolean; error: string | null; lastSaved: Date | null;
}) {
  return (
    <div className="flex items-center rounded-full bg-slate-100/80 px-2.5 py-1
      text-[10px] font-semibold dark:bg-gray-800/60">
      {saving ? (
        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
          <Loader2 className="h-2.5 w-2.5 animate-spin" /> Guardando…
        </span>
      ) : error ? (
        <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
          <AlertCircle className="h-2.5 w-2.5" /> {error}
        </span>
      ) : lastSaved ? (
        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-2.5 w-2.5" />
          {lastSaved.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
        </span>
      ) : (
        <span className="flex items-center gap-1 text-slate-400">
          <Save className="h-2.5 w-2.5" /> Sin cambios
        </span>
      )}
    </div>
  );
}

function ActionBtn({ icon, label, title, style, onClick }: {
  icon: React.ReactNode; label: string; title: string;
  style: React.CSSProperties; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex h-7 items-center gap-1 rounded-md px-2
        text-[10px] font-bold transition-all hover:opacity-85 active:scale-95"
      style={style}>
      {icon} {label}
    </button>
  );
}

function ctxItem(
  text: string,
  kind: EntryKind,
  sameLevelAsSelected: boolean,
  triggerRecalc: () => void,
  addRow: (k: EntryKind, same: boolean) => void,
) {
  return {
    text,
    type: 'button',
    onClick: () => { addRow(kind, sameLevelAsSelected); triggerRecalc(); },
  };
}