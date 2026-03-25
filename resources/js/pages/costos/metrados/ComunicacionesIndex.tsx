
import { router, usePage } from '@inertiajs/react';
import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import AppLayout from '@/layouts/app-layout';
import Luckysheet from '@/components/costos/tablas/Luckysheet';
import type { BreadcrumbItem } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ChevronLeft, Save, RefreshCcw,
  CheckCircle2, AlertCircle, Loader2,
  ArrowUp, ArrowDown, Plus, FolderPlus, Folder, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
// DEFINICIÓN DE COLUMNAS
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
// UNIDADES Y MAPA DE CÁLCULO
// ═══════════════════════════════════════════════════════════════════════
const UNIDAD_OPTIONS = ['und', 'm', 'ml', 'm2', 'm3', 'kg', 'lt', 'gl', 'pza'];

// ═══════════════════════════════════════════════════════════════════════
// NUMERACIÓN BASE PARA METRADO
// ═══════════════════════════════════════════════════════════════════════
const TOP_LEVEL_START = 6;
const DEFAULT_DESC_GROUP = 'Nuevo grupo';
const DEFAULT_DESC_LEAF = 'Nueva partida';

// ═══════════════════════════════════════════════════════════════════════
// ESTILOS VISUALES — 10 niveles de azul degradado
// ═══════════════════════════════════════════════════════════════════════
const MAX_LEVELS = 10;
const GROUP_PALETTE: { bg: string; fc: string; bl: number }[] = [
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
];

const LEAF_STYLE = { bg: '#f8fafc', fc: '#374151', bl: 0 };
const groupStyle = (level: number) => GROUP_PALETTE[Math.min(level - 1, MAX_LEVELS - 1)];
const NBSP = '\u00A0\u00A0\u00A0';
const indent = (level: number, isLeaf: boolean) =>
  NBSP.repeat(isLeaf ? level : Math.max(0, level - 1));

const SAVE_DEBOUNCE = 1800;

// ═══════════════════════════════════════════════════════════════════════
// HELPERS PUROS
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
const mkNum = (v: number): Record<string, any> => ({
  v, m: v === 0 ? '' : String(v), ct: { fa: '#,##0.0000', t: 'n' },
});
const mkTxt = (v: string, extra: Record<string, any> = {}): Record<string, any> => ({
  v, m: v, ct: { fa: 'General', t: 'g' }, ...extra,
});
const styledNum = (v: number, st: { bg: string; fc: string; bl: number }) => ({
  ...mkNum(v), bl: st.bl, fs: 10,
  ...(st.bg ? { bg: st.bg, fc: st.fc } : {}),
});
const styledTxt = (v: string, disp: string, st: { bg: string; fc: string; bl: number }) => ({
  ...mkTxt(v), m: disp, bl: st.bl, fs: 10,
  ...(st.bg ? { bg: st.bg, fc: st.fc } : {}),
});
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
// CONVERSIÓN FILAS ↔ DATOS DE HOJA LUCKYSHEET
// ═══════════════════════════════════════════════════════════════════════
function rowsToSheet(
  rows: Record<string, any>[],
  cols: ColumnDef[],
  name: string,
  order = 0,
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
      let val = blank(row[col.key])
        ? (col.key === '_level' ? level : col.key === '_kind' ? kind : null)
        : row[col.key];
      if (blank(val)) return;
      let store: any = val;
      let display    = String(val);
      if (col.key === 'descripcion' && typeof val === 'string') {
        store   = val.trimStart();
        display = indent(level, kind === 'leaf') + store;
      }
      const isNum = typeof store === 'number' ||
        (store !== '' && !isNaN(Number(store)));
      const cell: Record<string, any> = {
        v:  isNum ? Number(store) : store,
        m:  display,
        ct: { fa: isNum ? '#,##0.0000' : 'General', t: isNum ? 'n' : 'g' },
        bl: (col.key === 'descripcion' || col.key === 'partida') ? st.bl : 0,
        fs: 10,
      };
      if (st.bg) { cell.bg = st.bg; cell.fc = st.fc; }
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
    { title: 'Costos',               href: '/costos' },
    { title: project.nombre,         href: `/costos/${project.id}` },
    { title: 'Metrado Comunicaciones', href: '#' },
  ];

  // ── State ─────────────────────────────────────────────────────────────
  const [saving,    setSaving]    = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Estados para el diálogo Agregar
  const [openAgregar, setOpenAgregar] = useState(false);
  useEffect(() => {
    if (openAgregar) {
      setTimeout(() => {
        document.getElementById('largo')?.focus();
      }, 100);
    }
  }, [openAgregar]);
  const [nivelBase, setNivelBase] = useState<string>('1');
  const [unidadMedida, setUnidadMedida] = useState('UND');
  const [tipoFila, setTipoFila] = useState<'group' | 'leaf'>('group');

  const [elemValor, setElemValor] = useState<string>('');
  const [largoValor, setLargoValor] = useState<string>('');
  const [anchoValor, setAnchoValor] = useState<string>('');
  const [altoValor, setAltoValor] = useState<string>('');
  const [nvecesValor, setNvecesValor] = useState<string>('');
  const preview = useMemo(() => {
    const L = parseFloat(largoValor) || 0;
    const A = parseFloat(anchoValor) || 0;
    const H = parseFloat(altoValor) || 0;
    const N = parseFloat(nvecesValor) || 1;
    const E = parseFloat(elemValor) || 0;

    const u = unidadMedida.toLowerCase();

    if (['m', 'ml'].includes(u)) return (L + A) * N;
    if (u === 'm2') return L * A * N;
    if (['m3', 'lt', 'gl'].includes(u)) return L * A * H * N;
    if (['und', 'pza'].includes(u)) return E * N;
    if (u === 'kg') return E;

    return 0;
  }, [largoValor, anchoValor, altoValor, nvecesValor, elemValor, unidadMedida]);
  const formulaTexto = useMemo(() => {
    const u = unidadMedida.toLowerCase();

    if (['m', 'ml'].includes(u)) return 'Lon = (Largo + Ancho) × N';
    if (u === 'm2') return 'Área = Largo × Ancho × N';
    if (['m3', 'lt', 'gl'].includes(u)) return 'Vol = Largo × Ancho × Alto × N';
    if (['und', 'pza'].includes(u)) return 'Und = Elem × N';
    if (u === 'kg') return 'Total = Kg';

    return '';
  }, [unidadMedida]);

  // ── Refs ───────────────────────────────────────────────────────────────
  const saveTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSheets  = useRef<any[]>([]);
  const progUpdateCount = useRef(0);
  const recalcTimer   = useRef<any>(null);

  // ═══════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR DE FILAS RESUMEN
  // ═══════════════════════════════════════════════════════════════════════
  const buildResumenRows = useCallback((
    metradoData: Record<string, any>[],
  ) => {
    type Agg = {
      code: string; desc: string; und: string; level: number; total: number;
    };
    const byCode: Record<string, Agg> = {};
    const codeOrder: string[] = [];
    const ensure = (code: string, desc: string, und: string, level: number) => {
      if (!byCode[code]) {
        byCode[code] = { code, desc, und, level, total: 0 };
        codeOrder.push(code);
      }
      return byCode[code];
    };
    metradoData.forEach((row) => {
      const kind = String(row['_kind'] ?? 'leaf') === 'group' ? 'group' : 'leaf';
      if (kind !== 'group') return;
      const code = String(row.partida ?? '').trim() || `${row._level}|${String(row.descripcion ?? '').trim()}`;
      if (!code) return;
      const e = ensure(code, String(row.descripcion ?? ''), String(row.unidad ?? ''), toNum(row['_level']) || 1);
      e.total += toNum(row.total);
    });
    return codeOrder.map((code) => {
      const v = byCode[code];
      return {
        _level: v.level, _kind: 'group',
        partida: v.code, descripcion: v.desc, unidad: v.und,
        total: v.total,
      };
    });
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

  // ── Hojas iniciales ───────────────────────────────────────────────────
  const initialSheets = useMemo(() => {
    const sheets: any[] = [];
    sheets.push(rowsToSheet(metrado ?? [], BASE_COLS, 'Metrado', 0));
    sheets.push(rowsToSheet(resumenRows, RESUMEN_BASE, 'Resumen', 1));
    return sheets;
  }, [metrado, resumenRows]);

  // ═══════════════════════════════════════════════════════════════════════
  // GUARDAR EN BASE DE DATOS
  // ═══════════════════════════════════════════════════════════════════════
  const doSave = useCallback(async (sheets: any[]) => {
    setSaving(true);
    setSaveError(null);
    const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
    const headers = {
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': csrf,
      'X-Requested-With': 'XMLHttpRequest',
    };
    const reqs: Array<{ url: string; body: any }> = [];
    sheets.forEach((sheet: any) => {
      const name = String(sheet?.name ?? '');
      if (name === 'Metrado') {
        reqs.push({
          url: `/costos/${project.id}/metrado-comunicaciones/metrado`,
          body: { rows: sheetToRows(sheet, BASE_COLS) },
        });
      } else if (name === 'Resumen') {
        reqs.push({
          url: `/costos/${project.id}/metrado-comunicaciones/resumen`,
          body: { rows: sheetToRows(sheet, RESUMEN_BASE) },
        });
      }
    });
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

  // ═══════════════════════════════════════════════════════════════════════
  // RECÁLCULO AUTOMÁTICO
  // ═══════════════════════════════════════════════════════════════════════
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

    // PASE 1 — NUMERACIÓN AUTOMÁTICA
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
      for (let i = level + 1; i <= MAX_LEVELS; i++) counters[i] = 0;
      counters[level]++;
      const code = counters.slice(1, level + 1)
        .map((n) => String(n).padStart(2, '0'))
        .join('.');
      const st = groupStyle(level);
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

    // PASE 2 — PROPAGACIÓN DE UNIDAD
    const unitStack: Array<string> = new Array(MAX_LEVELS + 1).fill('');
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

    // PASE 3 — CÁLCULO NUMÉRICO
    entries.forEach((e) => {
      if (e.kind !== 'leaf') {

        set(e.ri, 'elsim', '');
        set(e.ri, 'largo', '');
        set(e.ri, 'ancho', '');
        set(e.ri, 'alto', '');
        set(e.ri, 'nveces', '');
        set(e.ri, 'lon', '');
        set(e.ri, 'area', '');
        set(e.ri, 'vol', '');
        set(e.ri, 'und', '');
        return;
      }
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
      const nveces = toNum(row.nveces) || 1;
      const largo  = toNum(row.largo);
      const ancho  = toNum(row.ancho);
      const alto   = toNum(row.alto);
      const newUnd  = r4(elsim * nveces);
      const newLon = r4((largo + ancho) * nveces);
      const newArea = r4(largo * ancho * nveces);
      const newVol  = r4(largo * ancho * alto * nveces);
      const upd = (key: string, val: number) => {
        if (toNum(row[key]) !== val) { set(ri, key, mkNum(val)); row[key] = val; }
      };
      upd('lon', newLon);
      upd('area', newArea);
      upd('vol', newVol);
      upd('und', newUnd);
      const unidad = String(row.unidad ?? '').trim().toLowerCase();
      let tVal = 0;
      if (unidad === 'm' || unidad === 'ml') tVal = newLon;
      else if (unidad === 'm2') tVal = newArea;
      else if (unidad === 'm3' || unidad === 'lt' || unidad === 'gl') tVal = newVol;
      else if (unidad === 'kg')               tVal = toNum(row.kg);
      else if (unidad === 'und' || unidad === 'pza') tVal = newUnd;
      e.total = tVal;
      set(ri, 'total', mkNum(tVal));
    });

    // PASE 4 — ROLL-UP
    const maxLevel = entries.reduce((m, e) => Math.max(m, e.level), 1);
    for (let lvl = maxLevel; lvl >= 1; lvl--) {
      entries.forEach((e, idx) => {
        if (e.kind !== 'group' || e.level !== lvl) return;
        let sum = 0;
        // Sumar todos los totals de entries que están dentro de este grupo
        for (let j = idx + 1; j < entries.length; j++) {
          const child = entries[j];
          if (child.level <= lvl) break;
          if (child.level > lvl) {
            if (child.kind === 'leaf') {
              sum = r4(sum + child.total);
            }
          }
        }
        e.total = sum;
        e.row.total = sum;
        set(e.ri, 'total', mkGroupNum(sum, lvl));
      });
    }

    // PASE 5 — FLUSH
    if (updates.length === 0) return;
    if (updates.length > 10000) return;
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

  // ── Handlers Luckysheet ────────────────────────────────────────────────
  const afterChange = useCallback((data: any) => {
    if (!data) return;
    setTimeout(() => {
      recalcActiveSheet();
    }, 80);
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
    const selRow = range[0].row[0];
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
    const selIdx = riList.findIndex((e) => e.ri === selRow);
    if (selIdx === -1) return;
    const selLevel = riList[selIdx].level;
    let blockEnd = selRow;
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
      if (prevSibIdx === -1) return;
      const prevStart = riList[prevSibIdx].ri;
      let prevEnd = prevStart;
      for (let i = prevSibIdx + 1; i < selIdx; i++) {
        if (riList[i].level <= selLevel) break;
        prevEnd = riList[i].ri;
      }
      const prevBlock = readBlock(prevStart, prevEnd);
      const ourBlock  = readBlock(selRow, blockEnd);
      progUpdateCount.current++;
      writeBlock(ourBlock,  prevStart,               false);
      writeBlock(prevBlock, prevStart + ourBlock.length, true);
    } else {
      let nextSibIdx = -1;
      for (let i = blockEndIdx + 1; i < riList.length; i++) {
        if (riList[i].level < selLevel) break;
        if (riList[i].level === selLevel) { nextSibIdx = i; break; }
      }
      if (nextSibIdx === -1) return;
      const nextStart = riList[nextSibIdx].ri;
      let nextEnd = nextStart;
      for (let i = nextSibIdx + 1; i < riList.length; i++) {
        if (riList[i].level <= selLevel) break;
        nextEnd = riList[i].ri;
      }
      const nextBlock = readBlock(nextStart, nextEnd);
      const ourBlock  = readBlock(selRow, blockEnd);
      progUpdateCount.current++;
      writeBlock(nextBlock, selRow,                   false);
      writeBlock(ourBlock,  selRow + nextBlock.length, true);
    }
    setTimeout(() => {
      progUpdateCount.current = Math.max(0, progUpdateCount.current - 1);
    }, 100);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════════════════════════════════════════════════════════════════════
  // AGREGAR FILAS CON NIVEL PERSONALIZADO
  // ═══════════════════════════════════════════════════════════════════════
  const addRowWithLevel = useCallback((
    kind: EntryKind, 
    customLevel: number,
    valores?: {
      elem: string;
      largo: string;
      ancho: string;
      alto: string;
      nveces: string;
      unidad: string;
    }
  ) => {
    const ls = (window as any).luckysheet;
    if (!ls) return;
    
    const sheets = ls.getAllSheets?.() ?? [];
    const active = sheets.find((s: any) => s.status === 1) ?? sheets[0];
    if (!active || active.name === 'Resumen') return;
    
    const data: any[][] = active.data || [];
    const sheetOrder = active.order ?? 0;
    
    const range = ls.getRange?.();
    const selRow = range?.[0]?.row?.[1] ?? range?.[0]?.row?.[0] ?? 1;
    
    // Insertar nueva fila
    ls.insertRow(selRow + 1, 1);
    const r = selRow + 1;

    // DETECTAR NIVEL REAL SEGÚN CONTEXTO
    const currentRow = readDataRow(data, selRow);
    const parentMeta = rowMeta(currentRow);

    let finalLevel = customLevel;

    if (!customLevel || customLevel === 1) {
      if (kind === 'leaf') {
        // Partida siempre va como hijo
        finalLevel = parentMeta.level + 1;
      } else {
        // Grupo por defecto al mismo nivel
        finalLevel = parentMeta.level;
      }
    }
    
    // Establecer nivel y tipo
    ls.setCellValue(r, COL['_level'], finalLevel, { order: sheetOrder });
    ls.setCellValue(r, COL['_kind'], kind, { order: sheetOrder });
    
    // Si es partida (leaf), establecer valores
    if (kind === 'leaf') {
      // Unidad de medida
      if (valores?.unidad && valores.unidad !== 'UND') {
        ls.setCellValue(r, COL['unidad'], valores.unidad.toLowerCase(), { order: sheetOrder });
      }
      
      // Campos numéricos
      if (valores?.elem) {
        ls.setCellValue(r, COL['elsim'], parseFloat(valores.elem) || 0, { order: sheetOrder });
      }
      if (valores?.largo) {
        ls.setCellValue(r, COL['largo'], parseFloat(valores.largo) || 0, { order: sheetOrder });
      }
      if (valores?.ancho) {
        ls.setCellValue(r, COL['ancho'], parseFloat(valores.ancho) || 0, { order: sheetOrder });
      }
      if (valores?.alto) {
        ls.setCellValue(r, COL['alto'], parseFloat(valores.alto) || 0, { order: sheetOrder });
      }
      if (valores?.nveces) {
        ls.setCellValue(r, COL['nveces'], parseFloat(valores.nveces) || 0, { order: sheetOrder });
      }
    } else {
      // Si es grupo, limpiar campos numéricos
      ['elsim','largo','ancho','alto','nveces','lon','area','vol','kg','und','total']
        .forEach((key) => ls.setCellValue(r, COL[key], '', { order: sheetOrder }));
    }
    
    // Descripción por defecto
    ls.setCellValue(r, COL['descripcion'], 
      kind === 'group' ? DEFAULT_DESC_GROUP : DEFAULT_DESC_LEAF, 
      { order: sheetOrder }
    );
    
    // Forzar refresh y recálculo
    setTimeout(() => {
      ls.refresh();
      recalcActiveSheet();
    }, 200);
  }, [recalcActiveSheet]);

  // ── Dropdown de unidades ───────────────────────────────────────────────
  useEffect(() => {
    let attempts = 0;
    const MAX_ATTEMPTS = 40;
    let timer: ReturnType<typeof setTimeout>;
    const applyVerification = () => {
      const ls = (window as any).luckysheet;
      const sheets = ls?.getAllSheets?.() ?? [];
      if (!ls || typeof ls.setDataVerification !== 'function' || sheets.length === 0) {
        if (++attempts < 40) setTimeout(apply, 250);
        return;
      }
      const ci = COL['unidad'];
      if (ci === undefined) return;
      const range = colLetter(ci) + '2:' + colLetter(ci) + '3000';
      const opt = {
        type: 'dropdown', value1: UNIDAD_OPTIONS.join(','),
        prohibitInput: false, hint: 'Seleccione una unidad',
      };
      sheets.forEach((s: any) => {
        if (s.name === 'Resumen') return;
        ls.setDataVerification(opt, { range, order: s.order ?? 0 });
      });
    };
    timer = setTimeout(applyVerification, 400);
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
      const all: any[] = ls.getAllSheets();
      let metradoData: Record<string, any>[] = [];
      let resIdx = -1;
      all.forEach((sheet: any, idx: number) => {
        if (sheet.name === 'Metrado')  metradoData = sheetToRows(sheet, BASE_COLS);
        if (sheet.name === 'Resumen')  resIdx = idx;
      });
      if (resIdx === -1) { setIsSyncing(false); return; }
      const newRows = buildResumenRows(metradoData);
      const currentSheet = ls.getSheet().order;
      ls.setSheetActive(resIdx);
      ls.clearRange({ row: [0, 500], column: [0, 20] });
      newRows.forEach((row, r) => {
        RESUMEN_BASE.forEach((col, c) => {
          const val = row[col.key as keyof typeof row] ?? '';
          ls.setCellValue(r + 1, c, val, { isRefresh: false });
        });
      });
      RESUMEN_BASE.forEach((col, c) => {
        ls.setCellValue(0, c, col.label, { isRefresh: false });
      });
      ls.refresh();
      ls.setSheetActive(currentOrder);
      doSave(all);
      setIsSyncing(false);
    }, 400);
  }, [buildResumenRows, doSave]);

  const triggerRecalc = () => {
    setTimeout(() => {
      recalcActiveSheet();
    }, 0);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="flex h-[calc(100vh-65px)] w-full flex-col overflow-hidden bg-slate-50 dark:bg-gray-950">
        {/* ━━━━━━━━━━━━━━━━━━━━━━━ HEADER ━━━━━━━━━━━━━━━━━━━━━━━ */}
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between
          gap-2 border-b border-slate-200/80 bg-white/92 px-4 py-2 shadow-sm
          backdrop-blur-md dark:border-gray-800/60 dark:bg-gray-900/92">
          
          {/* Izquierda */}
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
            {/* Leyenda visual de niveles */}
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

          {/* Derecha */}
          <div className="flex flex-wrap items-center gap-1.5">
            <SaveStatus saving={saving} error={saveError} lastSaved={lastSaved} />
            <div className="h-5 w-px bg-slate-200 dark:bg-gray-700" />
            
            {/* ── Botón Agregar con Diálogo ── */}
            <Dialog open={openAgregar} onOpenChange={setOpenAgregar}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-7 gap-1 text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700"
                >
                  <Plus className="h-3 w-3" />
                  Agregar
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[650px]">
                <DialogHeader>
                  <DialogTitle>Agregar Nueva Fila</DialogTitle>
                  <DialogDescription>
                    Configure el nivel de base y las unidades de medida
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-6 py-4">
                  {/* Tipo de Fila y Nivel de Base */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-3">
                      <Label className="text-sm font-semibold">Tipo de Fila</Label>
                      <div className="flex gap-3">
                        <div className="flex gap-3">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="tipoFila"
                              checked={tipoFila === 'group'}
                              onChange={() => setTipoFila('group')}
                            />
                            Grupo
                          </label>

                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="tipoFila"
                              checked={tipoFila === 'leaf'}
                              onChange={() => setTipoFila('leaf')}
                            />
                            Partida
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <Label htmlFor="nivelBase" className="text-sm font-semibold">
                        N° Base (Nivel)
                      </Label>
                      <Input
                        id="nivelBase"
                        type="number"
                        min="1"
                        max="10"
                        value={nivelBase}
                        onChange={(e) => setNivelBase(e.target.value)}
                        placeholder="Ej: 1, 2, 3..."
                        className="h-9"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        {nivelBase === '1' && 'Numeración: 01, 02, 03...'}
                        {nivelBase === '2' && 'Numeración: 01.01, 01.02...'}
                        {nivelBase === '3' && 'Numeración: 01.01.01, 01.01.02...'}
                        {nivelBase === '4' && 'Numeración: 01.01.01.01...'}
                        {['1','2','3','4'].includes(nivelBase) === false && 'Ingrese un nivel del 1 al 10'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Unidades de Medida */}
                    <div className="grid gap-3">
                      <Label className="text-sm font-semibold">Unidades de Medida</Label>
                      <Select value={unidadMedida} onValueChange={setUnidadMedida}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione unidad" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UND">und (Unidad)</SelectItem>
                          <SelectItem value="M">m (Metro)</SelectItem>
                          <SelectItem value="ML">ml (Metro Lineal)</SelectItem>
                          <SelectItem value="m2">m2 (Metro Cuadrado)</SelectItem>
                          <SelectItem value="m3">m3 (Metro Cúbico)</SelectItem>
                          <SelectItem value="Kg">Kg (Kilogramo)</SelectItem>
                          <SelectItem value="lt">lt (Litro)</SelectItem>
                          <SelectItem value="gl">gl (Galón)</SelectItem>
                          <SelectItem value="pza">pza (Pieza)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Versiones de Medida */}
                    <div className="grid gap-3">
                      <Label className="text-sm font-semibold">Fórmula de Cálculo</Label>
                      <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-md text-sm font-mono">
                        {formulaTexto || 'Seleccione una unidad'}
                      </div>
                    </div>
                  </div>

                  {/* Ingresar Valores - Campos dinámicos según versión */}
                  <div className="grid gap-3">
                    <div className="text-right text-sm font-semibold text-emerald-600">
                      Resultado: {preview.toFixed(4)}
                    </div>
                    <Label className="text-sm font-semibold">
                      Ingresar Valores
                    </Label>
                    <div className="grid grid-cols-5 gap-2 p-3 border rounded-md bg-slate-50 dark:bg-slate-900">
                      <div className="grid gap-1.5">
                        <Label htmlFor="elem" className="text-[10px]">Elem</Label>
                        <Input 
                          id="elem"
                          disabled={tipoFila !== 'leaf'} 
                          type="number" 
                          className="h-8 text-sm" 
                          placeholder="0"
                          value={elemValor}
                          onChange={(e) => setElemValor(e.target.value)}
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="largo" className="text-[10px]">Largo</Label>
                        <Input 
                          id="largo"
                          disabled={tipoFila !== 'leaf'} 
                          type="number" 
                          className="h-8 text-sm" 
                          placeholder="0"
                          value={largoValor}
                          onChange={(e) => setLargoValor(e.target.value)}
                        />
                      </div>

                      {/* Versiones de Medida */}
                      {['m', 'ml', 'm2', 'm3', 'lt', 'gl'].includes(unidadMedida.toLowerCase()) && (
                        <div className="grid gap-1.5">
                          <Label htmlFor="ancho" className="text-[10px]">Ancho</Label>
                          <Input 
                            id="ancho"
                            disabled={tipoFila !== 'leaf'} 
                            type="number" 
                            className="h-8 text-sm" 
                            placeholder="0"
                            value={anchoValor}
                            onChange={(e) => setAnchoValor(e.target.value)}
                          />
                        </div>
                      )}

                      {['m3', 'lt', 'gl'].includes(unidadMedida.toLowerCase()) && (
                        <div className="grid gap-1.5">
                          <Label htmlFor="alto" className="text-[10px]">Alto</Label>
                          <Input 
                            id="alto" 
                            disabled={tipoFila !== 'leaf'}
                            type="number" 
                            className="h-8 text-sm" 
                            placeholder="0"
                            value={altoValor}
                            onChange={(e) => setAltoValor(e.target.value)}
                          />
                        </div>
                      )}

                      {['und', 'pza', 'kg'].includes(unidadMedida.toLowerCase()) && (
                        <div className="grid gap-1.5">
                          <Label className="text-[10px]">Elem. Simil.</Label>
                          <Input
                            type="number"
                            value={elemValor}
                            onChange={(e) => setElemValor(e.target.value)}
                          />
                        </div>
                      )}
                      
                        <div className="grid gap-1.5">
                          <Label htmlFor="nveces" className="text-[10px]">N° Veces</Label>
                          <Input 
                            id="nveces" 
                            disabled={tipoFila !== 'leaf'}
                            type="number" 
                            className="h-8 text-sm" 
                            placeholder="0"
                            value={nvecesValor}
                            onChange={(e) => setNvecesValor(e.target.value)}
                          />
                        </div>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setOpenAgregar(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => {
                      const level = parseInt(nivelBase) || 1;

                      if (level < 1 || level > 10) {
                        return; // luego ponemos mensaje 
                      }

                      addRowWithLevel(tipoFila, level, {
                        elem: elemValor,
                        largo: largoValor,
                        ancho: anchoValor,
                        alto: altoValor,
                        nveces: nvecesValor,
                        unidad: unidadMedida,
                      });

                      setOpenAgregar(false);

                      // 🔥 RESET INTELIGENTE
                      setNivelBase('1');
                      setElemValor('');
                      setLargoValor('');
                      setAnchoValor('');
                      setAltoValor('');
                      setNvecesValor('');
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    Agregar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="h-5 w-px bg-slate-200 dark:bg-gray-700" />
            
            {/* ── Mover bloque ── */}
            <ActionBtn
              icon={<ArrowUp className="h-3 w-3" />}
              label="↑ Bloque"
              title="Mover bloque (fila + descendientes) hacia arriba"
              style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}
              onClick={() => moveBlock('up')}
            />
            <ActionBtn
              icon={<ArrowDown className="h-3 w-3" />}
              label="↓ Bloque"
              title="Mover bloque (fila + descendientes) hacia abajo"
              style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}
              onClick={() => moveBlock('down')}
            />
            <div className="h-5 w-px bg-slate-200 dark:bg-gray-700" />
            
            {/* ── Acciones generales ── */}
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
          </div>
        </header>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━ HOJA ━━━━━━━━━━━━━━━━━━━━━━━━ */}
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