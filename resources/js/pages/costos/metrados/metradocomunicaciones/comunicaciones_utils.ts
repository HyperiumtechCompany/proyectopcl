// ═══════════════════════════════════════════════════
// utils.ts — Helpers puros + conversión Luckysheet
// ═══════════════════════════════════════════════════

import {
  ALL_COLS, CI, LEAF_STYLE, LEVEL_PALETTE, MAIN_COLS,
  MAX_LEVELS, NBSP, RESUMEN_COLS, UNIT_PROFILES, OUTPUT_KEYS,
} from './comunicaciones_constants';
import type { ColumnDef, MeasureInputs, RowEntry, RowKind } from './comunicaciones_types';

export const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const r4 = (n: number): number => Math.round(n * 1e4) / 1e4;
export const blank = (v: any): boolean => v === null || v === undefined || v === '' || v === 0;
export const trim0 = (v: unknown): string => String(v ?? '').trimStart();
export const isZeroLike = (v: unknown): boolean => {
  if (v === null || v === undefined || v === '') return true;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) < 0.0000001;
};

export const pad2 = (n: number): string => String(Math.floor(n)).padStart(2, '0');

export const colLetter = (i: number): string => {
  let r = '', t = i;
  while (t >= 0) { r = String.fromCharCode((t % 26) + 65) + r; t = Math.floor(t / 26) - 1; }
  return r;
};

export const cellRaw = (cell: any): any => {
  if (!cell) return null;
  const r = cell.v;
  return r && typeof r === 'object' && 'v' in r ? (r.v ?? null) : (r ?? null);
};

export const mkBlank = (extra: Record<string, any> = {}) => ({
  v: '',
  m: '',
  ct: { fa: '@', t: 'g' },
  ...extra,
});

export const mkNum = (v: number, keepZero = false) => {
  if (!keepZero && isZeroLike(v)) {
    return mkBlank();
  }
  return {
    v,
    m: String(v),
    ct: { fa: '#,##0.0000', t: 'n' },
  };
};

export const mkTxt = (v: string, extra: Record<string, any> = {}) => ({
  v, m: v,
  ct: { fa: '@', t: 'g' },
  ...extra,
});

export const styledNum = (v: number, st: { bg: string; fc: string; bl: number }, keepZero = false) => ({
  ...mkNum(v, keepZero), bl: st.bl, fs: 10, bg: st.bg, fc: st.fc,
});

export const styledTxt = (v: string, display: string, st: { bg: string; fc: string; bl: number }) => ({
  v, m: display,
  ct: { fa: '@', t: 'g' },
  bl: st.bl, fs: 10, bg: st.bg, fc: st.fc,
});

export const levelStyle = (l: number) =>
  LEVEL_PALETTE[Math.min(l - 1, MAX_LEVELS - 1)];

export const indent = (level: number, isLeaf: boolean): string =>
  NBSP.repeat(isLeaf ? level : Math.max(0, level - 1));

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

const BLANKABLE_NUMERIC_KEYS = new Set([
  'elsim', 'largo', 'ancho', 'alto', 'nveces', 'lon', 'area', 'vol', 'kg', 'und', 'total',
]);

const hasItemCode = (value: unknown): boolean => {
  const raw = String(value ?? '').trim();
  return raw !== '' && raw !== '0' && raw.toLowerCase() !== 'null';
};

const getDepthFromItem = (value: unknown): number => {
  const raw = String(value ?? '').trim();
  const parts = raw.split(/[\.,]/).filter((part) => part !== '' && !Number.isNaN(Number(part)));
  return Math.max(1, Math.min(MAX_LEVELS, parts.length || 1));
};

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
    const kind = String(row._kind ?? 'leaf') === 'group' ? 'group' : 'leaf' as RowKind;
    const level = Math.max(1, Math.min(MAX_LEVELS, toNum(row._level) || 1));
    const st = kind === 'group' ? levelStyle(level) : LEAF_STYLE;
    const rIdx = ri + 1;

    cols.forEach((col, ci) => {
      let val = (row[col.key] === null || row[col.key] === undefined)
        ? (col.key === '_dbid' ? row.id ?? null : col.key === '_level' ? level : col.key === '_kind' ? kind : null)
        : row[col.key];

      if (val === null) return;

      let store: any = val;
      let display = String(val);

      if (col.key === 'descripcion' && typeof val === 'string') {
        store = val.trimStart();
        display = indent(level, kind === 'leaf') + store;
      }

      const isPartida = col.key === 'partida';
      const isBlankNumeric = !isPartida && BLANKABLE_NUMERIC_KEYS.has(col.key) && isZeroLike(store);
      const isNum = !isPartida && (
        typeof store === 'number' ||
        (store !== '' && !Number.isNaN(Number(store)) && store !== '')
      );

      if (isBlankNumeric) {
        const cell: Record<string, any> = { ...mkBlank(), fs: 10 };
        if (st.bg) {
          cell.bg = st.bg;
          cell.fc = st.fc;
        }
        cells.push({ r: rIdx, c: ci, v: cell });
        return;
      }

      const cell: Record<string, any> = {
        v: isNum ? Number(store) : String(store),
        m: display,
        ct: {
          fa: isNum ? '#,##0.0000' : '@',
          t: isNum ? 'n' : 'g',
        },
        bl: (col.key === 'descripcion' || col.key === 'partida') ? st.bl : 0,
        fs: 10,
      };
      if (st.bg) {
        cell.bg = st.bg;
        cell.fc = st.fc;
      }
      cells.push({ r: rIdx, c: ci, v: cell });
    });
  });

  const columnlen: Record<number, number> = {};
  const colhidden: Record<number, number> = {};
  cols.forEach((col, ci) => {
    columnlen[ci] = col.width;
    if (col.key === '_dbid' || col.key === '_level' || col.key === '_kind') colhidden[ci] = 1;
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

export function buildRecalcUpdates(
  data: any[][],
): Array<{ r: number; c: number; v: any }> {
  const entries: RowEntry[] = [];

  for (let r = 1; r < data.length; r++) {
    const row = readRow(data, r);
    if (!ALL_COLS.some((col) => row[col.key] !== null && row[col.key] !== '')) continue;
    const { level, kind } = rowMeta(row);
    entries.push({ ri: r, row, level, kind, total: 0 });
  }
  if (!entries.length) return [];

  const updates: Array<{ r: number; c: number; v: any }> = [];
  const set = (r: number, key: string, v: any) => {
    const c = CI[key];
    if (c !== undefined) updates.push({ r, c, v });
  };
  const setBlank = (r: number, key: string, st?: { bg: string; fc: string; bl: number }) => {
    set(r, key, st ? { ...mkBlank(), bg: st.bg, fc: st.fc, bl: st.bl, fs: 10 } : mkBlank());
  };

  let currentItemLevel = 1;

  entries.forEach((entry) => {
    const { ri, row } = entry;
    const rawPartida = String(row.partida ?? '').trim();

    if (hasItemCode(rawPartida)) {
      entry.kind = 'group';
      entry.level = getDepthFromItem(rawPartida);
      currentItemLevel = entry.level;

      const st = levelStyle(entry.level);
      set(ri, 'partida', styledTxt(rawPartida, rawPartida, st));
      row.partida = rawPartida;

      if (toNum(row._level) !== entry.level) {
        set(ri, '_level', mkNum(entry.level, true));
        row._level = entry.level;
      }
      if (row._kind !== 'group') {
        set(ri, '_kind', mkTxt('group'));
        row._kind = 'group';
      }

      const desc = trim0(row.descripcion);
      if (desc !== '') {
        set(ri, 'descripcion', styledTxt(desc, indent(entry.level, false) + desc, st));
      }
      return;
    }

    entry.kind = 'leaf';
    entry.level = currentItemLevel;

    if (toNum(row._level) !== currentItemLevel) {
      set(ri, '_level', mkNum(currentItemLevel, true));
      row._level = currentItemLevel;
    }
    if (row._kind !== 'leaf') {
      set(ri, '_kind', mkTxt('leaf'));
      row._kind = 'leaf';
    }

    const desc = trim0(row.descripcion);
    if (desc !== '') {
      set(ri, 'descripcion', styledTxt(desc, indent(currentItemLevel, true) + desc, LEAF_STYLE));
    }
  });

  let inheritedUnit = '';
  entries.forEach(({ ri, row }) => {
    if (hasItemCode(row.partida)) {
      inheritedUnit = String(row.unidad ?? '').trim();
      return;
    }

    if (inheritedUnit && String(row.unidad ?? '').trim() !== inheritedUnit) {
      row.unidad = inheritedUnit;
      set(ri, 'unidad', { ...mkTxt(inheritedUnit), bg: LEAF_STYLE.bg, fc: LEAF_STYLE.fc, fs: 10 });
    }
  });

  entries.forEach((entry) => {
    const { row, ri } = entry;
    const isAnchor = hasItemCode(row.partida);
    const st = isAnchor ? levelStyle(entry.level) : LEAF_STYLE;

    OUTPUT_KEYS.forEach((key) => {
      row[key] = null;
      setBlank(ri, key, st);
    });
    setBlank(ri, 'total', st);

    const unit = String(row.unidad ?? '').trim().toLowerCase();
    const profile = UNIT_PROFILES[unit];
    if (!profile) {
      entry.total = 0;
      return;
    }

    const inputs: MeasureInputs = {
      elsim: toNum(row.elsim),
      largo: toNum(row.largo),
      ancho: toNum(row.ancho),
      alto: toNum(row.alto),
      nveces: toNum(row.nveces),
      kg: toNum(row.kg),
    };

    const outputs = profile.fn(inputs);
    const outVal = r4(outputs[profile.outputKey] ?? 0);

    row[profile.outputKey] = outVal;
    set(ri, profile.outputKey, isAnchor ? styledNum(outVal, st) : mkNum(outVal));
    entry.total = isAnchor ? 0 : outVal;
  });

  let currentAnchor: RowEntry | null = null;
  entries.forEach((entry) => {
    if (hasItemCode(entry.row.partida)) {
      currentAnchor = entry;
      currentAnchor.total = 0;
      return;
    }

    if (currentAnchor) {
      currentAnchor.total = r4(currentAnchor.total + entry.total);
    }
  });

  entries.forEach((entry) => {
    if (!hasItemCode(entry.row.partida)) {
      return;
    }

    entry.row.total = entry.total;
    const st = levelStyle(entry.level);
    if (isZeroLike(entry.total)) {
      setBlank(entry.ri, 'total', st);
      return;
    }

    set(entry.ri, 'total', styledNum(entry.total, st));
  });

  return updates;
}

export function buildResumenRows(src: Record<string, any>[]): Record<string, any>[] {
  return src
    .filter((row) => {
      const p = String(row.partida ?? '').trim();
      return p !== '' && p !== '0' && p !== 'null';
    })
    .map((row) => ({
      _dbid:       row._dbid ?? row.id ?? null,
      partida:     String(row.partida ?? ''),
      descripcion: trim0(row.descripcion),
      unidad:      String(row.unidad ?? ''),
      total:       toNum(row.total),
      _level:      row._level,
      _kind:       row._kind,
    }));
}

