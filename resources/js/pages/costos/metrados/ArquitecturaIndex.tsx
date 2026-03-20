import { router, usePage } from '@inertiajs/react';
import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import AppLayout from '@/layouts/app-layout';
import Luckysheet from '@/components/costos/tablas/Luckysheet';
import type { BreadcrumbItem } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ChevronLeft, Settings2, Save, RefreshCcw,
  CheckCircle2, AlertCircle, Loader2,
  ArrowUp, ArrowDown, FolderPlus, Folder, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════
interface ColumnDef { key: string; label: string; width: number }

interface ArquitecturaPageProps {
  project: { id: number; nombre: string };
  metrado: Record<string, any>[];
  resumen: Record<string, any>[];
  [key: string]: unknown;
}

type EntryKind = 'group' | 'leaf';

interface Entry {
  ri: number;              // row index en la hoja (1-based, 0 = cabecera)
  row: Record<string, any>; // datos de la fila (mutables durante recálculo)
  level: number;           // profundidad 1–MAX_LEVELS
  kind: EntryKind;
  total: number;           // calculado durante recálculo
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

/** Columnas internas — ocultas en Luckysheet */
const HIDDEN_COLS: ColumnDef[] = [
  { key: '_level', label: '', width: 1 },
  { key: '_kind',  label: '', width: 1 },
];

const BASE_COLS: ColumnDef[] = [...VISIBLE_COLS, ...HIDDEN_COLS];

/** Lookup estático key → índice de columna */
const COL: Record<string, number> = Object.fromEntries(
  BASE_COLS.map((c, i) => [c.key, i]),
);

const RESUMEN_BASE: ColumnDef[] = [
  { key: 'partida',     label: 'Código',       width: 105 },
  { key: 'descripcion', label: 'Descripción',  width: 295 },
  { key: 'unidad',      label: 'Und',          width: 60  },
  { key: 'total',       label: 'Total',        width: 115 },
  { key: 'observacion', label: 'Obs.',         width: 120 },
];

// ═══════════════════════════════════════════════════════════════════════
// UNIDADES Y MAPA DE CÁLCULO
// ═══════════════════════════════════════════════════════════════════════
const UNIDAD_OPTIONS = ['und', 'm', 'ml', 'm2', 'm3', 'kg', 'lt', 'gl', 'pza'];

const UNIT_TOTAL_COL: Record<string, string> = {
  und: 'und', pza: 'und',
  m:   'lon', ml:  'lon',
  m2:  'area',
  m3:  'vol', lt: 'vol', gl: 'vol',
  kg:  'kg',
};

// ═══════════════════════════════════════════════════════════════════════
// NUMERACIÓN BASE PARA METRADO ARQUITECTURA
// ═══════════════════════════════════════════════════════════════════════
const TOP_LEVEL_START = 1; //
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
    v: { v: col.label, m: col.label, ct: { fa: 'General', t: 'g' },
      bg: '#0f172a', fc: '#94a3b8', bl: 1, fs: 10 },
  }));

  const cells: any[] = [];
  rows.forEach((row, ri) => {
    const kind  = String(row['_kind']  ?? 'leaf') === 'group' ? 'group' : 'leaf' as EntryKind;
    const level = Math.max(1, Math.min(MAX_LEVELS, toNum(row['_level']) || 1));
    const st    = kind === 'group' ? groupStyle(level) : LEAF_STYLE;
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
    kind:  String(row['_kind'] ?? 'leaf') === 'group' ? 'group' : 'leaf',
  };
}

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════
export default function ArquitecturaIndex() {
  const { project, metrado, resumen } = usePage<ArquitecturaPageProps>().props;

  const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Costos',               href: '/costos' },
    { title: project.nombre,         href: `/costos/${project.id}` },
    { title: 'Metrado Arquitectura', href: '#' },
  ];

  // ── State ──────────────────────────────────────────────────────────────
  const [saving,    setSaving]    = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

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

      const code = `${row._level}|${String(row.descripcion ?? '').trim()}`;
      if (!code) return;

      const e = ensure(code, String(row.descripcion ?? ''), String(row.unidad ?? ''), toNum(row['_level']) || 1);
      e.total += toNum(row.total);
    });

    return codeOrder.map((code) => {
      const v = byCode[code];
      return {
        _level: v.level, _kind: 'group',
        partida: code, descripcion: v.desc, unidad: v.und,
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
          url: `/costos/${project.id}/metrado-arquitectura/metrado`,
          body: { rows: sheetToRows(sheet, BASE_COLS) },
        });
      } else if (name === 'Resumen') {
        reqs.push({
          url: `/costos/${project.id}/metrado-arquitectura/resumen`,
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
  // RECÁLCULO AUTOMÁTICO — N NIVELES
  // ═══════════════════════════════════════════════════════════════════════
  const recalcActiveSheet = useCallback(() => {
    if (progUpdateCount.current > 2) return;

    const ls = (window as any).luckysheet;
    if (!ls) return;

    const sheets = ls.getAllSheets?.() ?? [];
    const active = sheets.find((s: any) => s.status === 1) ?? sheets[0];

    if (!active || active.name === 'Resumen') return;

    const data: any[][] = active.data || [];
    const sheetOrder = active.order ?? 0;

    // ── Leer todas las filas con datos ──────────────────────────────────
    const entries: Entry[] = [];
    for (let r = 1; r < data.length; r++) {
      const row = readDataRow(data, r);
      const hasData = BASE_COLS.some((col) => !blank(row[col.key]));
      if (!hasData) continue;

      const { level, kind } = rowMeta(row);
      entries.push({ ri: r, row, level, kind, total: 0 });
    }

    if (entries.length === 0) return;

    // ── Acumular cambios para un único flush ────────────────────────────
    const updates: Array<{ r: number; c: number; v: any }> = [];
    const set = (r: number, key: string, v: any) => {
      const c = COL[key];
      if (c !== undefined) updates.push({ r, c, v });
    };

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PASE 1 — NUMERACIÓN AUTOMÁTICA (BASE 3)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const counters = new Array(MAX_LEVELS + 1).fill(0);
    counters[1] = Math.max(0, TOP_LEVEL_START - 1); // ⚡ INICIA EN 3

    entries.forEach(({ ri, row, level, kind }) => {
      if (kind === 'leaf') {
        if (!blank(row.partida)) {
          set(ri, 'partida', mkTxt(''));
          row.partida = '';
        }

        const desc = trim0(row.descripcion);
        if (desc) {
          set(ri, 'descripcion', styledTxt(desc, indent(level, true) + desc, LEAF_STYLE));
          row.descripcion = desc;
        }

        if (row['_kind'] !== 'leaf') set(ri, '_kind', 'leaf');
        return;
      }

      // GRUPO: incrementar contador en este nivel, resetear los más profundos
      for (let i = level + 1; i <= MAX_LEVELS; i++) counters[i] = 0;
      counters[level]++;

      const code = counters.slice(1, level + 1)
        .map((n) => String(n).padStart(2, '0'))
        .join('.');

      const st = groupStyle(level);

      if (row.partida !== code) {
        set(ri, 'partida', styledTxt(code, code, st));
        row.partida = code;
      }

      const desc = trim0(row.descripcion);
      if (desc) {
        set(ri, 'descripcion', styledTxt(desc, indent(level, false) + desc, st));
        row.descripcion = desc;
      }

      if (row['_kind'] !== 'group') set(ri, '_kind', 'group');
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PASE 2 — PROPAGACIÓN DE UNIDAD
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PASE 3 — CÁLCULO NUMÉRICO DE HOJAS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    entries.forEach((e) => {
      if (e.kind !== 'leaf') return;

      const { row, ri } = e;
      const elsim  = toNum(row.elsim);
      const nveces = toNum(row.nveces);
      const largo  = toNum(row.largo);
      const ancho  = toNum(row.ancho);
      const alto   = toNum(row.alto);

      const newUnd  = r4(elsim * nveces);
      const newLon  = r4(largo * nveces);
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
      else if (unidad === 'kg') tVal = toNum(row.kg);
      else if (unidad === 'und' || unidad === 'pza') tVal = newUnd;

      e.total = tVal;
      set(ri, 'total', mkNum(tVal));
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PASE 4 — ROLL-UP: de la profundidad máxima hasta el nivel 1
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const maxLevel = entries.reduce((m, e) => Math.max(m, e.level), 1);

    for (let lvl = maxLevel; lvl >= 1; lvl--) {
      entries.forEach((e, idx) => {
        if (e.kind !== 'group' || e.level !== lvl) return;

        let sum = 0;
        for (let j = idx + 1; j < entries.length; j++) {
          const child = entries[j];
          if (child.level <= lvl) break;
          if (child.level === lvl + 1) {
            sum = r4(sum + child.total);
          }
        }

        e.total = sum;
        e.row.total = sum;
        set(e.ri, 'total', styledNum(sum, groupStyle(lvl)));
      });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PASE 5 — FLUSH
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (updates.length === 0) return;
    if (updates.length > 10000) return;

    progUpdateCount.current++;

    updates.forEach((u, idx) => {
      ls.setCellValue(u.r, u.c, u.v, {
        order:     sheetOrder,
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
  }, [scheduleSave]);

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

  // ═══════════════════════════════════════════════════════════════════════
  // MOVER BLOQUE
  // ═══════════════════════════════════════════════════════════════════════
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
      for (let r = from; r <= to; r++) {
        out.push(data[r] ? [...data[r]] : []);
      }
      return out;
    };

    const writeBlock = (rows: any[][], startRow: number, isLast: boolean) => {
      rows.forEach((rowData, i) => {
        const r = startRow + i;
        BASE_COLS.forEach((_, ci) => {
          const val = rowData[ci] ?? null;
          const isLastCell = isLast && i === rows.length - 1 && ci === BASE_COLS.length - 1;
          ls.setCellValue(r, ci, blank(val) ? '' : val, {
            order: sheetOrder,
            isRefresh: isLastCell,
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
  }, [recalcActiveSheet]);

  // ═══════════════════════════════════════════════════════════════════════
  // AGREGAR FILAS
  // ═══════════════════════════════════════════════════════════════════════
  const addRow = useCallback((kind: EntryKind, sameLevelAsSelected = true) => {
    const ls = (window as any).luckysheet;
    if (!ls) return;

    const sheets = ls.getAllSheets?.() ?? [];
    const active = sheets.find((s: any) => s.status === 1) ?? sheets[0];
    if (!active || active.name === 'Resumen') return;

    const data: any[][] = active.data || [];
    const sheetOrder = active.order ?? 0;

    const range    = ls.getRange?.();
    const selRow   = range?.[0]?.row?.[1] ?? range?.[0]?.row?.[0] ?? 1;
    const selData  = readDataRow(data, selRow);
    const { level: selLevel, kind: selKind } = rowMeta(selData);

    let newLevel: number;
    if (kind === 'leaf') {
      newLevel = (selKind === 'group' ? selLevel + 1 : selLevel);
    } else {
      newLevel = sameLevelAsSelected
        ? selLevel
        : Math.min(selLevel + 1, MAX_LEVELS);
    }

    let insertAfter = selRow;
    if (!sameLevelAsSelected || kind === 'leaf') {
      insertAfter = selRow;
    } else {
      for (let r = selRow + 1; r < data.length; r++) {
        const rd = readDataRow(data, r);
        const hasData = BASE_COLS.some((col) => !blank(rd[col.key]));
        if (!hasData) break;

        const { level } = rowMeta(rd);
        if (level <= selLevel) break;
        insertAfter = r;
      }
    }

    ls.insertRow(insertAfter + 1, 1);

    const r = insertAfter + 1;
    ls.setCellValue(r, COL['_level'], newLevel, { order: sheetOrder });
    ls.setCellValue(r, COL['_kind'],  kind,     { order: sheetOrder });

    if (kind === 'group') {
      ['elsim','largo','ancho','alto','nveces','lon','area','vol','kg','und','total']
        .forEach((key) => ls.setCellValue(r, COL[key], '', { order: sheetOrder }));
    }

    if (kind === 'group') {
      ls.setCellValue(r, COL['descripcion'], DEFAULT_DESC_GROUP, { order: sheetOrder });
    } else {
      ls.setCellValue(r, COL['descripcion'], DEFAULT_DESC_LEAF, { order: sheetOrder });
    }

    setTimeout(() => recalcActiveSheet(), 120);
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
        if (++attempts < MAX_ATTEMPTS) timer = setTimeout(applyVerification, 250);
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
  }, [initialSheets]);

  useEffect(() => {
    let intentos = 0;
    const ejecutar = () => {
      const ls = (window as any).luckysheet;
      if (!ls || typeof ls.getAllSheets !== 'function') {
        if (intentos < 20) {
          intentos++;
          setTimeout(ejecutar, 300);
        }
        return;
      }
      recalcActiveSheet();
    };
    ejecutar();
  }, [recalcActiveSheet]);

  // ═══════════════════════════════════════════════════════════════════════
  // SINCRONIZAR RESUMEN
  // ═══════════════════════════════════════════════════════════════════════
  const handleSyncResumen = useCallback(() => {
    setIsSyncing(true);

    setTimeout(() => {
      const ls = (window as any).luckysheet;
      if (!ls) { setIsSyncing(false); return; }

      const all: any[] = ls.getAllSheets();
      let metradoData: Record<string, any>[] = [];
      let resIdx = -1;

      all.forEach((sheet: any, idx: number) => {
        if (sheet.name === 'Metrado') {
          metradoData = sheetToRows(sheet, BASE_COLS);
        } else if (sheet.name === 'Resumen') {
          resIdx = idx;
        }
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
      ls.setSheetActive(currentSheet);
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
  // ═══════════════════════════════════════════════════════════════════════
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
                Metrado Eléctricas
              </p>
              <p className="text-[9px] font-medium uppercase tracking-wider text-slate-400">
                {project.nombre}
              </p>
            </div>

            {/* Leyenda visual de niveles */}
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

          {/* Derecha */}
          <div className="flex flex-wrap items-center gap-1.5">
            <SaveStatus saving={saving} error={saveError} lastSaved={lastSaved} />

            <div className="h-5 w-px bg-slate-200 dark:bg-gray-700" />

            {/* ── Botones de inserción ── */}
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
              {isSyncing ? 'Sincronizando…' : 'Sync Resumen'}
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
              title:            'Metrado Eléctricas',
              showinfobar:      false,
              sheetFormulaBar:  true,
              showstatisticBar: true,
              afterChange:      afterChange,
              contextMenu: {
                row: [
                  ctxItem('Insertar Grupo al mismo nivel', 'group', true,  triggerRecalc, addRow),
                  ctxItem('Insertar Sub-grupo (N+1)',       'group', false, triggerRecalc, addRow),
                  ctxItem('Insertar Partida (hoja)',        'leaf',  false, triggerRecalc, addRow),
                  { type: 'separator' },
                  {
                    text: '↑ Mover bloque arriba',
                    type: 'button',
                    onClick: () => moveBlock('up'),
                  },
                  {
                    text: '↓ Mover bloque abajo',
                    type: 'button',
                    onClick: () => moveBlock('down'),
                  },
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
  triggerRecalc: () => void,
  addRow: (k: EntryKind, same: boolean) => void,
) {
  return {
    text,
    type: 'button',
    onClick: () => {
      addRow(kind, sameLevelAsSelected);
      triggerRecalc();
    },
  };
}
