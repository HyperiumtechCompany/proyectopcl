// ═══════════════════════════════════════════════════
// utils.ts — Helpers puros + conversión Luckysheet
// ═══════════════════════════════════════════════════

import {
  ALL_COLS, CI, LEAF_STYLE, LEVEL_PALETTE, MAIN_COLS,
  MAX_LEVELS, NBSP, RESUMEN_COLS, UNIT_PROFILES, OUTPUT_KEYS,
} from './electricas_constants';
import type { ColumnDef, MeasureInputs, RowEntry, RowKind } from './electricas_types';

// ── Matemáticas básicas ───────────────────────────────────────
export const toNum  = (v: unknown): number => { const n = Number(v); return isFinite(n) ? n : 0; };
export const r4     = (n: number): number  => Math.round(n * 1e4) / 1e4;
export const blank  = (v: any): boolean    => v === null || v === undefined || v === '' || v === 0;
export const trim0  = (v: unknown): string => String(v ?? '').trimStart();

/**
 * pad2: convierte 5 → '05', 12 → '12'
 * Se usa para construir códigos de ítem: 05, 05.01, 05.01.01
 */
export const pad2 = (n: number): string => String(Math.floor(n)).padStart(2, '0');

export const colLetter = (i: number): string => {
  let r = '', t = i;
  while (t >= 0) { r = String.fromCharCode((t % 26) + 65) + r; t = Math.floor(t / 26) - 1; }
  return r;
};

// ── Lectura de celdas Luckysheet ──────────────────────────────
export const cellRaw = (cell: any): any => {
  if (!cell) return null;
  const r = cell.v;
  return r && typeof r === 'object' && 'v' in r ? (r.v ?? null) : (r ?? null);
};

// ── Constructores de celdas ───────────────────────────────────
export const mkNum = (v: number) => ({
  v,
  m: v === 0 ? '' : String(v),
  ct: { fa: '#,##0.0000', t: 'n' },
});

/**
 * mkTxt: crea celda de TEXTO puro.
 * IMPORTANTE: ct.t = 'g' y ct.fa = '@' asegura que Luckysheet
 * no interprete '05' como número (evita borrar ceros iniciales).
 */
export const mkTxt = (v: string, extra: Record<string, any> = {}) => ({
  v, m: v,
  ct: { fa: '@', t: 'g' },
  ...extra,
});

export const styledNum = (v: number, st: { bg: string; fc: string; bl: number }) => ({
  ...mkNum(v), bl: st.bl, fs: 10, bg: st.bg, fc: st.fc,
});

export const styledTxt = (v: string, display: string, st: { bg: string; fc: string; bl: number }) => ({
  v, m: display,
  ct: { fa: '@', t: 'g' },
  bl: st.bl, fs: 10, bg: st.bg, fc: st.fc,
});

// ── Estilo por nivel / tipo ───────────────────────────────────
export const levelStyle = (l: number) =>
  LEVEL_PALETTE[Math.min(l - 1, MAX_LEVELS - 1)];

export const indent = (level: number, isLeaf: boolean): string =>
  NBSP.repeat(isLeaf ? level : Math.max(0, level - 1));

// ── Lectura de fila completa desde data[][] ──────────────────
export function readRow(data: any[][], ri: number): Record<string, any> {
  const row: Record<string, any> = {};
  ALL_COLS.forEach((col, ci) => {
    const raw = cellRaw(data[ri]?.[ci]);
    row[col.key] = raw === null ? null : raw;
  });
  return row;
}

export function rowMeta(row: Record<string, any>): { level: number; kind: RowKind } {
  return {
    level: Math.max(1, Math.min(MAX_LEVELS, toNum(row._level) || 1)),
    kind:  String(row._kind ?? 'leaf') === 'group' ? 'group' : 'leaf',
  };
}

// ── Conversión filas → hoja Luckysheet ───────────────────────
export function rowsToSheet(
  rows: Record<string, any>[],
  cols: ColumnDef[],
  name: string,
  order = 0,
) {
  const header = cols.map((col, ci) => ({
    r: 0, c: ci,
    v: {
      v: col.label, m: col.label,
      ct: { fa: 'General', t: 'g' },
      bg: '#0f172a', fc: '#94a3b8', bl: 1, fs: 10,
    },
  }));

  const cells: any[] = [];
  rows.forEach((row, ri) => {
    const kind  = String(row._kind ?? 'leaf') === 'group' ? 'group' : 'leaf' as RowKind;
    const level = Math.max(1, Math.min(MAX_LEVELS, toNum(row._level) || 1));
    const st    = kind === 'group' ? levelStyle(level) : LEAF_STYLE;
    const rIdx  = ri + 1;

    cols.forEach((col, ci) => {
      let val = (row[col.key] === null || row[col.key] === undefined)
        ? (col.key === '_level' ? level : col.key === '_kind' ? kind : null)
        : row[col.key];
      if (val === null) return;

      let store: any = val;
      let display    = String(val);

      if (col.key === 'descripcion' && typeof val === 'string') {
        store   = val.trimStart();
        display = indent(level, kind === 'leaf') + store;
      }

      // partida siempre como texto para preservar '05', '05.01', etc.
      const isPartida = col.key === 'partida';
      const isNum     = !isPartida &&
        (typeof store === 'number' ||
          (store !== '' && !isNaN(Number(store)) && store !== ''));

      const cell: Record<string, any> = {
        v:  isNum ? Number(store) : String(store),
        m:  display,
        ct: {
          fa: isNum ? '#,##0.0000' : '@',
          t:  isNum ? 'n' : 'g',
        },
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
    name,
    status:   order === 0 ? 1 : 0,
    order,
    row:      Math.max(rows.length + 50, 100),
    column:   Math.max(cols.length + 5, 26),
    celldata: [...header, ...cells],
    config:   { columnlen, colhidden, rowlen: { 0: 30 } },
    frozen:   { type: 'row', range: { row_focus: 0 } },
  };
}

// ── Conversión hoja Luckysheet → filas ───────────────────────
export function sheetToRows(sheet: any, cols: ColumnDef[]): Record<string, any>[] {
  if (!sheet) return [];
  const rows: Record<string, any>[] = [];
  const data: any[][] = sheet.data || [];

  for (let r = 1; r < data.length; r++) {
    const row: Record<string, any> = {};
    let hasData = false;

    cols.forEach((col, ci) => {
      const raw = cellRaw(data[r]?.[ci]);
      row[col.key] = raw === null ? null : (col.key === 'descripcion' ? String(raw).trimStart() : raw);
      if (raw !== null && raw !== '') hasData = true;
    });

    if (hasData) rows.push(row);
  }
  return rows;
}

// ── Recálculo de hoja (Excel-like) ───────────────────────────
/**
 * Ejecuta 4 pasos sobre la hoja activa de Luckysheet:
 *  1. Estilo visual según nivel/tipo
 *  2. Propagación de unidad (grupo → hojas hijas)
 *  3. Cálculo por PERFIL de unidad (solo columna relevante)
 *  4. Roll-up de totales (bottom-up)
 *
 * FIX: ya no escribe en TODAS las columnas de salida,
 * solo en la que corresponde a la unidad del row.
 */
export function buildRecalcUpdates(
  data: any[][],
): Array<{ r: number; c: number; v: any }> {
  const entries: RowEntry[] = [];

  for (let r = 1; r < data.length; r++) {
    const row = readRow(data, r);
    if (!ALL_COLS.some((col) => row[col.key] !== null)) continue;
    const { level, kind } = rowMeta(row);
    entries.push({ ri: r, row, level, kind, total: 0 });
  }
  if (!entries.length) return [];

  const updates: Array<{ r: number; c: number; v: any }> = [];
  const set = (r: number, key: string, v: any) => {
    const c = CI[key];
    if (c !== undefined) updates.push({ r, c, v });
  };

  // ── Pase 1: Identificación de Niveles, Numeración Secuencial y Estilos ──
  const counters = new Array(MAX_LEVELS + 1).fill(0);
  let hasFoundBase = false;

  entries.forEach((e) => {
    const { ri, row } = e;
    const rawPartida = String(row.partida ?? '').trim();

    if (rawPartida && rawPartida !== '0' && rawPartida.toLowerCase() !== 'null') {
      e.kind = 'group';
      // Determine depth from typed text
      const parts = rawPartida.split(/[\.,]/).filter(p => !isNaN(Number(p)) && p !== '');
      let depth = Math.max(1, Math.min(MAX_LEVELS, parts.length > 0 ? parts.length : 1));

      // Si es el PRIMER item de todo el metrado o el primer item de nivel 1 que vemos, adoptar la base de él si es nivel 1.
      if (!hasFoundBase && depth === 1 && parts.length > 0) {
        const firstNum = parseInt(parts[0], 10);
        if (!isNaN(firstNum) && firstNum > 0) {
           counters[1] = firstNum - 1;
           hasFoundBase = true;
        }
      } else if (!hasFoundBase && parts.length > 0) {
        // Fallback if the very first item is e.g. level 2
        const firstNum = parseInt(parts[0], 10);
        if (!isNaN(firstNum) && firstNum > 0) {
           counters[1] = firstNum; // offset base so we don't start at 0
           hasFoundBase = true;
        }
      }

      for (let i = depth + 1; i <= MAX_LEVELS; i++) counters[i] = 0;
      counters[depth]++;
      e.level = depth;

      const newCode = counters.slice(1, depth + 1).map(pad2).join('.');
      const st = levelStyle(depth);

      if (row.partida !== newCode) {
        set(ri, 'partida', styledTxt(newCode, newCode, st));
        row.partida = newCode;
      } else {
        set(ri, 'partida', styledTxt(newCode, newCode, st));
      }

      if (toNum(row._level) !== depth) {
        set(ri, '_level', mkNum(depth));
        row._level = depth;
      }
      if (row._kind !== 'group') {
        set(ri, '_kind', mkTxt('group'));
        row._kind = 'group';
      }

      const desc = trim0(row.descripcion);
      if (desc !== null && desc !== undefined && desc !== '') {
        set(ri, 'descripcion', styledTxt(desc, indent(depth, false) + desc, st));
      }
    } else {
      e.kind = 'leaf';
      let parentLvl = 1;
      for (let l = entries.indexOf(e) - 1; l >= 0; l--) {
        if (entries[l].kind === 'group') {
          parentLvl = entries[l].level;
          break;
        }
      }
      e.level = parentLvl;

      if (toNum(row._level) !== parentLvl) {
        set(ri, '_level', mkNum(parentLvl));
        row._level = parentLvl;
      }
      if (row._kind !== 'leaf') {
        set(ri, '_kind', mkTxt('leaf'));
        row._kind = 'leaf';
      }

      const desc = trim0(row.descripcion);
      if (desc !== null && desc !== undefined && desc !== '') {
        set(ri, 'descripcion', styledTxt(desc, indent(parentLvl, true) + desc, LEAF_STYLE));
      }
    }
  });

  // ── Pase 2: Propagación de unidad ────────────────────────
  const unitStack: string[] = new Array(MAX_LEVELS + 1).fill('');
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

  // ── Pase 3: Cálculo por perfil de unidad ─────────────────
  entries.forEach((e) => {
    if (e.kind !== 'leaf') return;
    const { row, ri } = e;

    const unit    = String(row.unidad ?? '').trim().toLowerCase();
    const profile = UNIT_PROFILES[unit];
    if (!profile) return; // unidad no registrada → no tocar

    const inputs: MeasureInputs = {
      elsim:  toNum(row.elsim),
      largo:  toNum(row.largo),
      ancho:  toNum(row.ancho),
      alto:   toNum(row.alto),
      nveces: toNum(row.nveces),
      kg:     toNum(row.kg),
    };

    const outputs = profile.fn(inputs);
    const outVal  = r4(outputs[profile.outputKey] ?? 0);

    // Limpiar columnas de salida NO relevantes para esta unidad
    OUTPUT_KEYS.forEach((k) => {
      const isActive = k === profile.outputKey;
      const currVal  = toNum(row[k]);
      if (!isActive && currVal !== 0) {
        set(ri, k, mkNum(0));
        row[k] = 0;
      }
    });

    // Escribir resultado en la columna correspondiente
    if (toNum(row[profile.outputKey]) !== outVal) {
      set(ri, profile.outputKey, mkNum(outVal));
      row[profile.outputKey] = outVal;
    }

    e.total = outVal;
    set(ri, 'total', mkNum(outVal));
  });

  // ── Pase 4: Roll-up de grupos (bottom-up) ────────────────
  const maxLvl = entries.reduce((m, e) => Math.max(m, e.level), 1);
  for (let lvl = maxLvl; lvl >= 1; lvl--) {
    entries.forEach((e, idx) => {
      if (e.kind !== 'group' || e.level !== lvl) return;
      let sum = 0;
      for (let j = idx + 1; j < entries.length; j++) {
        const child = entries[j];
        if (child.level <= lvl) break;
        if (child.level === lvl + 1) sum = r4(sum + child.total);
      }
      e.total     = sum;
      e.row.total = sum;
      set(e.ri, 'total', styledNum(sum, levelStyle(lvl)));
    });
  }

  return updates;
}

// ── Cálculo de filas del Resumen ─────────────────────────────
export function buildResumenRows(src: Record<string, any>[]): Record<string, any>[] {
  return src
    .filter((row) => {
      const p = String(row.partida ?? '').trim();
      return p !== '' && p !== '0' && p !== 'null';
    })
    .map((row) => ({
      partida:     String(row.partida ?? ''),
      descripcion: trim0(row.descripcion),
      unidad:      String(row.unidad ?? ''),
      total:       toNum(row.total),
      _level:      row._level,
      _kind:       row._kind,
    }));
}
