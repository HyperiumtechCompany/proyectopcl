import { router, usePage } from '@inertiajs/react';
import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import AppLayout from '@/layouts/app-layout';
import Luckysheet from '@/components/costos/tablas/Luckysheet';
import type { BreadcrumbItem } from '@/types';
import { Button } from '@/components/ui/button';
import {

  ChevronLeft, Save,

  ChevronLeft, Settings2, Save, RefreshCcw,

  CheckCircle2, AlertCircle, Loader2,
  ArrowUp, ArrowDown, FolderPlus, Folder, FileText,
} from 'lucide-react';

// ─── TIPOS ────────────────────────────────────────────────────────────────────
interface ColumnDef { key: string; label: string; width: number }

interface Spreadsheet {
  id: number;
  name: string;
  project_name?: string;
  project_location?: string;
  sheet_data: any[];
  updated_at?: string;
  can_edit?: boolean;
}

interface GasPageProps {
  spreadsheet: Spreadsheet | null;
  spreadsheets: Spreadsheet[];
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

// ─── COLUMNAS ─────────────────────────────────────────────────────────────────
const VISIBLE_COLS: ColumnDef[] = [
  { key: 'partida', label: 'Partida', width: 105 },
  { key: 'descripcion', label: 'Descripción', width: 295 },
  { key: 'unidad', label: 'Und', width: 60 },
  { key: 'elsim', label: 'Elem.Simil.', width: 82 },
  { key: 'largo', label: 'Largo', width: 70 },
  { key: 'ancho', label: 'Ancho', width: 70 },
  { key: 'alto', label: 'Alto', width: 70 },
  { key: 'nveces', label: 'N° Veces', width: 70 },
  { key: 'lon', label: 'Lon.', width: 76 },
  { key: 'area', label: 'Área', width: 76 },
  { key: 'vol', label: 'Vol.', width: 76 },
  { key: 'kg', label: 'Kg.', width: 76 },
  { key: 'und', label: 'Und.', width: 76 },
  { key: 'total', label: 'Total', width: 95 },
  { key: 'observacion', label: 'Observaciones', width: 148 },
];

const HIDDEN_COLS: ColumnDef[] = [
  { key: '_level', label: '', width: 1 },
  { key: '_kind', label: '', width: 1 },
];

const BASE_COLS: ColumnDef[] = [...VISIBLE_COLS, ...HIDDEN_COLS];

const COL: Record<string, number> = Object.fromEntries(
  BASE_COLS.map((c, i) => [c.key, i]),
);

// ─── UNIDADES ─────────────────────────────────────────────────────────────────
const UNIDAD_OPTIONS = ['und', 'm', 'ml', 'm2', 'm3', 'kg', 'lt', 'gl', 'pza'];

const UNIT_TOTAL_COL: Record<string, string> = {
  'und': 'und',
  'm': 'lon',
  'ml': 'lon',
  'm2': 'area',
  'm3': 'vol',
  'kg': 'kg', // Si usas la columna de kilogramos
};


// ═══════════════════════════════════════════════════════════════════════
// NUMERACIÓN BASE PARA METRADO GAS
// ═══════════════════════════════════════════════════════════════════════
const TOP_LEVEL_START = 7; 

const DEFAULT_DESC_GROUP = 'Nuevo grupo';
const DEFAULT_DESC_LEAF = 'Nueva partida';
const MAX_LEVELS = 10;
const SAVE_DEBOUNCE = 1800;

// URL base de Gas — sin route(), sin dependencias externas
const GAS_BASE_URL = '/metrados/gas';

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const GROUP_PALETTE: { bg: string; fc: string; bl: number }[] = [
  { bg: '#0c1e3a', fc: '#ffffff', bl: 1 },
  { bg: '#133163', fc: '#ffffff', bl: 1 },
  { bg: '#1a4480', fc: '#ffffff', bl: 1 },
  { bg: '#1d5fa8', fc: '#ffffff', bl: 1 },
  { bg: '#2563eb', fc: '#ffffff', bl: 1 },
  { bg: '#3b82f6', fc: '#ffffff', bl: 1 },
  { bg: '#60a5fa', fc: '#0f172a', bl: 1 },
  { bg: '#93c5fd', fc: '#0f172a', bl: 0 },
  { bg: '#bfdbfe', fc: '#0f172a', bl: 0 },
  { bg: '#dbeafe', fc: '#0f172a', bl: 0 },
];

const LEAF_STYLE = { bg: '#f8fafc', fc: '#374151', bl: 0 };
const groupStyle = (level: number) => GROUP_PALETTE[Math.min(level - 1, MAX_LEVELS - 1)];

const NBSP = '\u00A0\u00A0\u00A0';
const indent = (level: number, isLeaf: boolean) =>
  NBSP.repeat(isLeaf ? level : Math.max(0, level - 1));

// ─── HELPERS PUROS ────────────────────────────────────────────────────────────
const toNum = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const trim0 = (v: unknown) => String(v ?? '').trimStart();
const blank = (v: any) => v === null || v === undefined || v === '';

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

// ─── CONVERSIÓN FILAS ↔ HOJA ──────────────────────────────────────────────────
function rowsToSheet(
  rows: Record<string, any>[],
  cols: ColumnDef[],
  name: string,
  order = 0,
) {

  const header: any[] = cols.map((col, ci) => ({
    r: 0, c: ci,
    v: {
      v: col.label, m: col.label, ct: { fa: 'General', t: 'g' },
      bg: '#0f172a', fc: '#94a3b8', bl: 1, fs: 10
    },
  }));

  // ─────────────────────────────────────────
  // HEADER MULTINIVEL
  // ─────────────────────────────────────────
  const header: any[] = [
    // Fila 0
    { r: 0, c: COL.partida, v: mkTxt('ITEM', { bg: '#0f172a', fc: '#fff', bl: 1 }) },
    { r: 0, c: COL.descripcion, v: mkTxt('DESCRIPCIÓN', { bg: '#0f172a', fc: '#fff', bl: 1 }) },
    { r: 0, c: COL.unidad, v: mkTxt('UN', { bg: '#0f172a', fc: '#fff', bl: 1 }) },
    { r: 0, c: COL.elsim, v: mkTxt('Elem.Simil.', { bg: '#0f172a', fc: '#fff', bl: 1 }) },


    { r: 0, c: COL.largo, v: mkTxt('DIMENSIONES', { bg: '#0f172a', fc: '#fff', bl: 1 }) },

    { r: 0, c: COL.nveces, v: mkTxt('N° Veces', { bg: '#0f172a', fc: '#fff', bl: 1 }) },

    { r: 0, c: COL.lon, v: mkTxt('METRADO', { bg: '#0f172a', fc: '#fff', bl: 1 }) },

    { r: 0, c: COL.total, v: mkTxt('Total', { bg: '#0f172a', fc: '#fff', bl: 1 }) },
  ];

  // Fila 1 (subheaders)
  header.push(
    { r: 1, c: COL.largo, v: mkTxt('Largo', { bg: '#0f172a', fc: '#fff', bl: 1 }) },
    { r: 1, c: COL.ancho, v: mkTxt('Ancho', { bg: '#0f172a', fc: '#fff', bl: 1 }) },
    { r: 1, c: COL.alto, v: mkTxt('Alto', { bg: '#0f172a', fc: '#fff', bl: 1 }) },

    { r: 1, c: COL.lon, v: mkTxt('Lon.', { bg: '#0f172a', fc: '#fff', bl: 1 }) },
    { r: 1, c: COL.area, v: mkTxt('Área', { bg: '#0f172a', fc: '#fff', bl: 1 }) },
    { r: 1, c: COL.vol, v: mkTxt('Vol.', { bg: '#0f172a', fc: '#fff', bl: 1 }) },
    { r: 1, c: COL.kg, v: mkTxt('Kg.', { bg: '#0f172a', fc: '#fff', bl: 1 }) },
    { r: 1, c: COL.und, v: mkTxt('Und.', { bg: '#0f172a', fc: '#fff', bl: 1 }) },
  );

  // ─────────────────────────────────────────
  // MERGES (CLAVE)
  // ─────────────────────────────────────────
  const merges = {
    [`0_${COL.partida}`]: { r: 0, c: COL.partida, rs: 2, cs: 1 },
    [`0_${COL.descripcion}`]: { r: 0, c: COL.descripcion, rs: 2, cs: 1 },
    [`0_${COL.unidad}`]: { r: 0, c: COL.unidad, rs: 2, cs: 1 },
    [`0_${COL.elsim}`]: { r: 0, c: COL.elsim, rs: 2, cs: 1 },

    [`0_${COL.largo}`]: { r: 0, c: COL.largo, rs: 1, cs: 3 }, // DIMENSIONES
    [`0_${COL.lon}`]: { r: 0, c: COL.lon, rs: 1, cs: 5 },     // METRADO

    [`0_${COL.nveces}`]: { r: 0, c: COL.nveces, rs: 2, cs: 1 },
    [`0_${COL.total}`]: { r: 0, c: COL.total, rs: 2, cs: 1 },
  };

  // ─────────────────────────────────────────
  // DATA (empieza en fila 2 ⚡)
  // ─────────────────────────────────────────
  const cells: any[] = [];
  rows.forEach((row, ri) => {

    const kind = String(row['_kind'] ?? 'leaf') === 'group' ? 'group' : 'leaf' as EntryKind;
    const level = Math.max(1, Math.min(MAX_LEVELS, toNum(row['_level']) || 1));
    const st = kind === 'group' ? groupStyle(level) : LEAF_STYLE;
    const rIdx = ri + 1;

    const kind  = String(row['_kind'] ?? 'leaf') === 'group' ? 'group' : 'leaf';
    const level = Math.max(1, Math.min(MAX_LEVELS, toNum(row['_level']) || 1));
    const st    = kind === 'group' ? groupStyle(level) : LEAF_STYLE;
    const rIdx  = ri + 1;


    cols.forEach((col, ci) => {
      let val = blank(row[col.key])
        ? (col.key === '_level' ? level : col.key === '_kind' ? kind : null)
        : row[col.key];
      if (blank(val)) return;


      let store: any = val;
      let display = String(val);

      if (col.key === 'descripcion' && typeof val === 'string') {
        store = val.trimStart();
        display = indent(level, kind === 'leaf') + store;

      let display = String(val);

      if (col.key === 'descripcion' && typeof val === 'string') {
        display = indent(level, kind === 'leaf') + val.trimStart();

      }

      const isNum = typeof store === 'number' ||
        (store !== '' && !isNaN(Number(store)));


      const cell: Record<string, any> = {
        v: isNum ? Number(store) : store,

      const cell = {
        v: isNum ? Number(val) : val,

        m: display,
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

    name,
    status: order === 0 ? 1 : 0,
    order,

    row: Math.max(rows.length + 50, 100),
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


  for (let r = 2; r < data.length; r++) {

    const row: Record<string, any> = {};
    let hasData = false;
    cols.forEach((col, ci) => {
      const raw = cellRaw(data[r]?.[ci]);
      if (!blank(raw)) {
        row[col.key] = col.key === 'descripcion' ? String(raw).trimStart() : raw;
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
    kind: String(row['_kind'] ?? 'leaf') === 'group' ? 'group' : 'leaf',
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL — modo lista si no hay spreadsheet
// ═══════════════════════════════════════════════════════════════════════════════
export default function GasIndex() {
  const { spreadsheet, spreadsheets } = usePage<GasPageProps>().props;

  if (!spreadsheet) {
    return (
      <AppLayout breadcrumbs={[{ title: 'Metrado Gas', href: GAS_BASE_URL }]}>
        <div className="p-8">
          <h1 className="mb-6 text-xl font-bold text-slate-800 dark:text-slate-100">
            Metrado Gas — Proyectos
          </h1>
          {spreadsheets.length === 0 ? (
            <p className="text-sm text-slate-400">No hay proyectos disponibles.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {spreadsheets.map((ss) => (
                <button key={ss.id} type="button"
                  onClick={() => router.get(`${GAS_BASE_URL}/${ss.id}`)}
                  className="group flex flex-col gap-1 rounded-xl border border-slate-200
                                        bg-white p-4 text-left shadow-sm transition-all
                                        hover:border-blue-300 hover:shadow-md
                                        dark:border-gray-700 dark:bg-gray-900">
                  <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                    {ss.name}
                  </span>
                  {ss.project_name && (
                    <span className="text-[11px] text-slate-500">{ss.project_name}</span>
                  )}
                  {ss.updated_at && (
                    <span className="text-[10px] text-slate-400">
                      Actualizado: {ss.updated_at}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  return <GasEditor spreadsheet={spreadsheet} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDITOR
// ═══════════════════════════════════════════════════════════════════════════════
function GasEditor({ spreadsheet }: { spreadsheet: Spreadsheet }) {

  const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Costos', href: '/costos' },
    { title: 'Metrado Gas', href: GAS_BASE_URL },
    { title: spreadsheet.name, href: '#' },

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════
export default function GasIndex() {  
  const { project, metrado, resumen } = usePage<GasPageProps>().props;

  const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Costos',           href: '/costos' },
    { title: project.nombre,     href: `/costos/${project.id}` },
    { title: 'Metrado Gas',      href: '#' },  

  ];

  // ── State ──────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSheets = useRef<any[]>([]);
  const progUpdateCount = useRef(0);


  // ── Hoja inicial ───────────────────────────────────────────────────────

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
    const c = buildResumenRows(metrado ?? []);
    return c.length > 0 ? c : (resumen ?? []);
  }, [buildResumenRows, metrado, resumen]);

  // ── Hojas iniciales (SOLO 2: Metrado y Resumen) ───────────────────────

  const initialSheets = useMemo(() => {
    if (Array.isArray(spreadsheet.sheet_data) && spreadsheet.sheet_data.length > 0) {
      return spreadsheet.sheet_data.map((s: any, i: number) => ({
        ...s,
        status: i === 0 ? 1 : 0,
      }));
    }
    return [rowsToSheet([], BASE_COLS, 'Metrado Gas', 0)];
  }, [spreadsheet.sheet_data]);

  // ═══════════════════════════════════════════════════════════════════════
  // GUARDAR
  // ═══════════════════════════════════════════════════════════════════════
  const doSave = useCallback(async (sheets: any[]) => {
    setSaving(true);
    setSaveError(null);

    const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';

    try {
      const res = await fetch(`${GAS_BASE_URL}/${spreadsheet.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrf,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ sheet_data: sheets }),
      });
      if (!res.ok) setSaveError(`Error ${res.status} al guardar`);
      else setLastSaved(new Date());
    } catch (e: any) {
      setSaveError(e.message ?? 'Error de red');
    } finally {
      setSaving(false);
    }
  }, [spreadsheet.id]);

  const scheduleSave = useCallback((sheets: any[]) => {
    latestSheets.current = sheets;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(latestSheets.current), SAVE_DEBOUNCE);
  }, [doSave]);

  // ═══════════════════════════════════════════════════════════════════════
  // RECÁLCULO AUTOMÁTICO — N NIVELES
  // ═══════════════════════════════════════════════════════════════════════
  const recalcActiveSheet = useCallback(() => {
    const ls = (window as any).luckysheet;
    if (!ls) return;

    const sheets = ls.getAllSheets?.() ?? [];
    const active = sheets.find((s: any) => s.status === 1) ?? sheets[0];
    if (!active) return;

    const data: any[][] = active.data || [];
    const sheetOrder = active.order ?? 0;

    const entries: Entry[] = [];
    for (let r = 1; r < data.length; r++) {
      const row = readDataRow(data, r);
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

    // Pase 1 — Identificación y Formato Visual (Sin fondos, solo letras de color)
    const counters = new Array(MAX_LEVELS + 1).fill(0);
    counters[1] = Math.max(0, TOP_LEVEL_START - 1);

    entries.forEach(({ ri, row, level, kind }) => {
      // Resetear fondo a blanco en todas las columnas de la fila
      BASE_COLS.forEach((_, ci) => {
        ls.setCellFormat(ri, ci, "bg", null, { order: sheetOrder });
      });

      if (kind === 'group') {
        for (let i = level + 1; i <= MAX_LEVELS; i++) counters[i] = 0;
        counters[level]++;
        const code = counters.slice(1, level + 1).map((n) => String(n).padStart(2, '0')).join('.');
        const colorLetra = (level === 1) ? "#ef4444" : "#3b82f6";

        set(ri, 'partida', { ...mkTxt(code), fc: colorLetra, bl: 1 });
        const desc = trim0(row.descripcion);
        if (desc) {
          set(ri, 'descripcion', { ...mkTxt(indent(level, false) + desc), fc: colorLetra, bl: 1 });
          row.descripcion = desc;
        }
        row.partida = code;
        if (row['_kind'] !== 'group') set(ri, '_kind', 'group');
      } else {
        // Partidas normales: Letra negra, sin fondo
        if (!blank(row.partida)) { set(ri, 'partida', mkTxt('')); row.partida = ''; }
        const desc = trim0(row.descripcion);
        if (desc) {
          set(ri, 'descripcion', { ...mkTxt(indent(level, true) + desc), fc: "#000000", bl: 0 });
          row.descripcion = desc;
        }
        if (row['_kind'] !== 'leaf') set(ri, '_kind', 'leaf');
      }
    });

    // Pase 2 — Propagación de unidad
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
          set(ri, 'unidad', { ...mkTxt(inherited), bg: LEAF_STYLE.bg, fc: LEAF_STYLE.fc, fs: 10 });
        }
      }
    });

// Pase 3 — Cálculo numérico
// Pase 3 — Cálculo numérico corregido
entries.forEach((e) => {
  if (e.kind !== 'leaf') return;
  const { row, ri } = e;
  
  const valNum = (k: string) => toNum(row[k]);
  const elsim = valNum('elsim'), nveces = valNum('nveces');
  const largo = valNum('largo'), ancho = valNum('ancho'), alto = valNum('alto');

  // Columnas de apoyo (Cálculos automáticos ocultos)
  const upd = (k: string, v: number) => { 
    if (valNum(k) !== v) { set(ri, k, mkNum(v)); row[k] = v; } 
  };
  
  // IMPORTANTE: Calculamos la cantidad base (Similares * Veces)
  const cantBase = r4(elsim * nveces);
  
  upd('und', cantBase);
  upd('lon', r4(largo * nveces));
  upd('area', r4(largo * ancho * nveces));
  upd('vol', r4(largo * ancho * alto * nveces));


  // ASIGNACIÓN AL TOTAL SEGÚN LA UNIDAD SELECCIONADA
  const unidad = String(row.unidad ?? '').trim().toLowerCase();
  let finalTotal = 0;

      const newUnd  = r4(elsim * nveces);
      const newLon  = r4((ancho + alto) * (nveces || 1));
      const newArea = r4(largo * ancho * nveces);
      const newVol  = r4(largo * ancho * alto * nveces);


  if (unidad === 'und' || unidad === 'pza' || unidad === 'gl') {
    // Si la unidad es 'und', el total es solo la cantidad
    finalTotal = cantBase;
  } else if (unidad === 'm3') {
    finalTotal = r4(largo * ancho * alto * nveces * elsim);
  } else if (unidad === 'm2') {
    finalTotal = r4(largo * ancho * nveces * elsim);
  } else if (unidad === 'm' || unidad === 'ml') {
    finalTotal = r4(largo * nveces * elsim);
  } else {
    // Por defecto, usa la cantidad base
    finalTotal = cantBase;
  }

  e.total = finalTotal;
  row.total = finalTotal;
  set(ri, 'total', mkNum(finalTotal));
});
    // Pase 4 — Roll-up (Suma de hijos a padres)
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      if (e.kind === 'group') {
        // Sumamos los totales de las filas que están inmediatamente debajo de este grupo
        let sum = 0;
        for (let j = i + 1; j < entries.length; j++) {
          if (entries[j].level <= e.level) break; // Salimos si llegamos a otro grupo del mismo nivel
          if (entries[j].level === e.level + 1) {
            sum += entries[j].total;
          }
        }
        e.total = sum;
        set(e.ri, 'total', mkNum(sum));
        e.row.total = sum;
      }
    }


    // Pase 5 — Limpiar filas vacías (quitar estilos y datos huérfanos)
    for (let r = 1; r < data.length; r++) {
      const row = readDataRow(data, r);
      const hasVisibleData = VISIBLE_COLS.some((col) => !blank(row[col.key]));

      if (!hasVisibleData) {
        BASE_COLS.forEach((_, ci) => {
          const cell = data[r]?.[ci];
          // Si la celda tiene rastro de color o valor, la reseteamos
          if (cell && (cell.bg || cell.v !== null)) {
            ls.setCellValue(r, ci, null, { order: sheetOrder });
            // Estas 2 líneas eliminan el color de fondo y fuente
            ls.setCellFormat(r, ci, "bg", null, { order: sheetOrder });
            ls.setCellFormat(r, ci, "fc", null, { order: sheetOrder });
          }
        });
      }
    }
    // Pase 5 — Flush
    if (updates.length === 0) return;
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
      if (all.length > 0) scheduleSave(all);
    }, 0);
  }, [scheduleSave]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const afterChange = useCallback(() => {
    if (progUpdateCount.current > 0) return;
    recalcActiveSheet();
  }, [recalcActiveSheet]);

  const handleCellUpdated = useCallback((r: number, c: number) => {
    if (progUpdateCount.current > 0) return;

    const triggerCols = new Set([
      COL['descripcion'],
      COL['unidad'], // Detecta cuando cambias a m3
      COL['elsim'],
      COL['largo'],
      COL['ancho'],
      COL['alto'],
      COL['nveces'],
      COL['partida']
    ]);

    if (triggerCols.has(c)) {
      recalcActiveSheet(); // Esto dispara el proceso de cálculo
    }
  }, [recalcActiveSheet]);

  const handleDataChange = useCallback((sheets: any[]) => {
    scheduleSave(sheets);
  }, [scheduleSave]);

  //Limpiar hoja
 const limpiarHojaCompletamente = useCallback(() => {
  const ls = (window as any).luckysheet;
  if (!ls) return;

  // Confirmación para seguridad
  if (!window.confirm("¿Deseas borrar todo el contenido y formatos de esta hoja?")) return;

  const sheets = ls.getAllSheets?.() ?? [];
  const active = sheets.find((s: any) => s.status === 1) ?? sheets[0];
  if (!active) return;
  const sheetOrder = active.order ?? 0;

  // IMPORTANTE: Limpiamos un rango controlado (100 filas y 15 columnas)
  // Asegúrate de que el segundo bucle use c++ y no r++
  for (let r = 1; r <= 100; r++) {
    for (let c = 0; c <= 15; c++) { 
      // Usamos una validación para evitar el error de lectura '0'
      ls.setCellValue(r, c, null, { order: sheetOrder, isRefresh: false });
      ls.setCellFormat(r, c, "bg", null, { order: sheetOrder }); // Quita fondo
      ls.setCellFormat(r, c, "fc", "#000000", { order: sheetOrder }); // Texto negro
      ls.setCellFormat(r, c, "bl", 0, { order: sheetOrder }); // Quita negrita
    }
  }

  // Refrescar al final para desbloquear la interfaz
  setTimeout(() => {
    recalcActiveSheet();
    ls.refresh(); 
  }, 100);
}, [recalcActiveSheet]);


  // ═══════════════════════════════════════════════════════════════════════
  // MOVER BLOQUE
  // ═══════════════════════════════════════════════════════════════════════
  const moveBlock = useCallback((direction: 'up' | 'down') => {
    const ls = (window as any).luckysheet;
    if (!ls) return;

    const sheets = ls.getAllSheets?.() ?? [];
    const active = sheets.find((s: any) => s.status === 1);
    if (!active) return;

    const range = ls.getRange?.();
    if (!range?.length) return;
    const selRow = range[0].row[0];
    const data: any[][] = active.data || [];
    const sheetOrder = active.order ?? 0;

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

    const readBlock = (from: number, to: number): any[][] => {
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
      const ourBlock = readBlock(selRow, blockEnd);
      progUpdateCount.current++;
      writeBlock(ourBlock, prevStart, false);
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
      const ourBlock = readBlock(selRow, blockEnd);
      progUpdateCount.current++;
      writeBlock(nextBlock, selRow, false);
      writeBlock(ourBlock, selRow + nextBlock.length, true);
    }

    setTimeout(() => {
      progUpdateCount.current = Math.max(0, progUpdateCount.current - 1);
      afterChange();
    }, 150);
  }, [afterChange]);

  // ═══════════════════════════════════════════════════════════════════════
  // AGREGAR FILAS
  // ═══════════════════════════════════════════════════════════════════════
  const addRow = useCallback((kind: EntryKind, sameLevelAsSelected = true) => {
    const ls = (window as any).luckysheet;
    if (!ls) return;

    const sheets = ls.getAllSheets?.() ?? [];
    const active = sheets.find((s: any) => s.status === 1) ?? sheets[0];
    if (!active) return;

    const data: any[][] = active.data || [];
    const sheetOrder = active.order ?? 0;
    const range = ls.getRange?.();
    const selRow = range?.[0]?.row?.[0] ?? 1;
    const selData = readDataRow(data, selRow);
    const { level: selLevel, kind: selKind } = rowMeta(selData);

    let newLevel: number;
    if (kind === 'leaf') {
      newLevel = selKind === 'group' ? selLevel + 1 : selLevel;
    } else {
      newLevel = sameLevelAsSelected ? selLevel : Math.min(selLevel + 1, MAX_LEVELS);
    }

    // Siempre insertar justo después de la fila seleccionada
    const insertAfter = selRow;

    ls.insertRow(insertAfter + 1, 1);
    const r = insertAfter + 1;
    ls.setCellValue(r, COL['_level'], newLevel, { order: sheetOrder });
    ls.setCellValue(r, COL['_kind'], kind, { order: sheetOrder });
    ls.setCellValue(r, COL['descripcion'], kind === 'group' ? DEFAULT_DESC_GROUP : DEFAULT_DESC_LEAF, { order: sheetOrder });

    if (kind === 'group') {
      ['elsim', 'largo', 'ancho', 'alto', 'nveces', 'lon', 'area', 'vol', 'kg', 'und', 'total']
        .forEach((key) => ls.setCellValue(r, COL[key], '', { order: sheetOrder }));
    }

    setTimeout(() => afterChange(), 120);
  }, [afterChange]);

  // ── Dropdown de unidades ───────────────────────────────────────────────
  useEffect(() => {
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;

    const applyVerification = () => {
      const ls = (window as any).luckysheet;
      const sheets = ls?.getAllSheets?.() ?? [];
      if (!ls || typeof ls.setDataVerification !== 'function' || sheets.length === 0) {
        if (++attempts < 40) timer = setTimeout(applyVerification, 250);
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
        ls.setDataVerification(opt, { range, order: s.order ?? 0 });
      });
    };

    timer = setTimeout(applyVerification, 400);
    return () => clearTimeout(timer);
  }, [initialSheets]);

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="flex h-[calc(100vh-65px)] w-full flex-col overflow-hidden bg-slate-50 dark:bg-gray-950">

        {/* ━━━━━━━━━━━━━━━━━━━━━━━ HEADER ━━━━━━━━━━━━━━━━━━━━━━━ */}
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between
                    gap-2 border-b border-slate-200/80 bg-white/92 px-4 py-2 shadow-sm
                    backdrop-blur-md dark:border-gray-800/60 dark:bg-gray-900/92">

          <div className="flex items-center gap-2.5">
            <button type="button"
              onClick={() => router.get(GAS_BASE_URL)}
              className="flex h-7 w-7 items-center justify-center rounded-full
                                text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700
                                dark:hover:bg-gray-800 dark:hover:text-gray-200">
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="leading-tight">
              <p className="text-[13px] font-bold text-slate-900 dark:text-gray-100">
                Metrado Gas
              </p>
              <p className="text-[9px] font-medium uppercase tracking-wider text-slate-400">
                {spreadsheet.name}
              </p>
            </div>

            <div className="hidden items-center gap-1 xl:flex">
              {GROUP_PALETTE.slice(0, 4).map((p, i) => (
                <span key={i}
                  className="rounded px-1.5 py-0.5 text-[9px] font-bold"
                  style={{ background: p.bg, color: p.fc }}>
                  N{i + 1}
                </span>
              ))}
              <span className="rounded px-1.5 py-0.5 text-[9px] font-bold"
                style={{ background: LEAF_STYLE.bg, color: LEAF_STYLE.fc, border: '1px solid #cbd5e1' }}>
                Hoja
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <SaveStatus saving={saving} error={saveError} lastSaved={lastSaved} />

            <div className="h-5 w-px bg-slate-200 dark:bg-gray-700" />

            <div className="flex items-center gap-1">
              <ActionBtn
                icon={<FolderPlus className="h-3 w-3" />}
                label="Grupo"
                title="Insertar grupo al mismo nivel que la fila seleccionada"
                style={{ background: GROUP_PALETTE[0].bg, color: '#fff' }}
                onClick={() => addRow('group', true)}
              />
              <ActionBtn
                icon={<Folder className="h-3 w-3" />}
                label="Sub-grupo"
                title="Insertar grupo un nivel más profundo"
                style={{ background: GROUP_PALETTE[2].bg, color: '#fff' }}
                onClick={() => addRow('group', false)}
              />
              <ActionBtn
                icon={<FileText className="h-3 w-3" />}
                label="Partida"
                title="Insertar hoja de cálculo bajo el grupo activo"
                style={{ background: LEAF_STYLE.bg, color: '#1e3a5f', border: '1px solid #cbd5e1' }}
                onClick={() => addRow('leaf', false)}
              />
            </div>

            <div className="h-5 w-px bg-slate-200 dark:bg-gray-700" />

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

            <ActionBtn
              icon={<AlertCircle className="h-3 w-3" />}
              label="Limpiar Hoja"
              title="Borra todo el contenido y formatos de la hoja actual"
              style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' }}
              onClick={limpiarHojaCompletamente}
            />

            <div className="h-5 w-px bg-slate-200 dark:bg-gray-700" />

            <Button variant="outline" size="sm"
              onClick={() => doSave(latestSheets.current)}
              disabled={saving}
              className="h-7 gap-1 text-[11px]">
              {saving
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Save className="h-3 w-3" />}
              {saving ? 'Guardando…' : 'Guardar'}
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
              title: 'Metrado Gas',
              showinfobar: false,
              sheetFormulaBar: true,
              showstatisticBar: true,
              hook: {
                cellUpdated: handleCellUpdated,
              },
              afterChange,
              updated: afterChange,
              contextMenu: {
                row: [
                  ctxItem('Insertar Grupo al mismo nivel', 'group', true, afterChange, addRow),
                  ctxItem('Insertar Sub-grupo (N+1)', 'group', false, afterChange, addRow),
                  ctxItem('Insertar Partida (hoja)', 'leaf', false, afterChange, addRow),
                  { type: 'separator' },
                  { text: '↑ Mover bloque arriba', type: 'button', onClick: () => moveBlock('up') },
                  { text: '↓ Mover bloque abajo', type: 'button', onClick: () => moveBlock('down') },
                  { type: 'separator' },
                  {
                    text: 'Eliminar fila',
                    type: 'button',
                    onClick: () => {
                      const ls = (window as any).luckysheet;
                      if (!ls) return;
                      const range = ls.getRange?.();
                      if (!range?.length) return;

                      // Eliminamos la fila físicamente
                      ls.deleteRow(range[0].row[0], 1);

                      // Forzamos el recálculo para re-numerar y limpiar colores
                      setTimeout(() => {
                        recalcActiveSheet();
                      }, 150);
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

// ─── SUBCOMPONENTES ───────────────────────────────────────────────────────────
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
    <button type="button" onClick={onClick} title={title}
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
  afterChange: () => void,
  addRow: (k: EntryKind, same: boolean) => void,
) {
  return { text, type: 'button', onClick: () => addRow(kind, sameLevelAsSelected) };
}
