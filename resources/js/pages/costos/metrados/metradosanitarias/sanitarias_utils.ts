
import {
  ALL_COLS, CI, LEAF_STYLE, LEVEL_PALETTE,
  MAX_LEVELS, NBSP, UNIT_PROFILES, OUTPUT_KEYS,
} from './sanitarias_constants';
import type { ColumnDef, MeasureInputs, RowEntry, RowKind } from './sanitarias_types';

export const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const r4 = (n: number): number => Math.round(n * 1e4) / 1e4;
export const formatNumber = (n: number): string => {
  if (isZeroLike(n)) return '';
  const rounded = Math.round(n * 100) / 100; // Redondea a 2 decimales
  return Number.isInteger(rounded) 
    ? String(rounded) 
    : rounded.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
};
export const blank = (v: any): boolean => v === null || v === undefined || v === '' || v === 0;
export const trim0 = (v: unknown): string => String(v ?? '').trimStart();
export const isZeroLike = (v: unknown): boolean => {
  if (v === null || v === undefined || v === '') return true;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) < 0.0000001;
};

export const pad2 = (n: number | string): string => {
  const num = Number(n) || 0;
  return num.toString().padStart(2, '0');
};

export const toRoman = (n: number): string => {
  if (!Number.isFinite(n) || n <= 0) return String(n);
  const map: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let value = Math.floor(n);
  let out = '';
  for (const [num, roman] of map) {
    while (value >= num) {
      out += roman;
      value -= num;
    }
  }
  return out;
};

export const colLetter = (i: number): string => {
  let r = '';
  let t = i;
  while (t >= 0) {
    r = String.fromCharCode((t % 26) + 65) + r;
    t = Math.floor(t / 26) - 1;
  }
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

  const display = formatNumber(v);
  
  if (!display) return mkBlank();

  return {
    v,
    m: display,
    ct: { fa: 'General', t: 'n' }, 
  };
};

// fórmula tipo Excel (fx)
export const mkFormula = (formula: string, value: number | string = '') => {
  return {
    f: formula,
    v: value === '' ? '' : value,
    m: value !== undefined ? String(value) : formula,
    ct: { fa: 'General', t:'f' },
  };
};

export const mkTxt = (v: string, extra: Record<string, any> = {}) => ({
  v,
  m: v,
  ct: { fa: '@', t: 'g' },
  ...extra,
});

export const styledNum = (v: number, st: { bg: string; fc: string; bl: number }, keepZero = false) => {
  if (!keepZero && isZeroLike(v)) {
    return { ...mkBlank(), bg: st.bg, fc: st.fc, bl: st.bl, fs: 10 };
  }

  const display = formatNumber(v);
  if (!display) {
    return { ...mkBlank(), bg: st.bg, fc: st.fc, bl: st.bl, fs: 10 };
  }

  return {
    v,
    m: display,
    ct: { fa: 'General', t: 'n' }, 
    bl: st.bl,
    fs: 10,
    bg: st.bg,
    fc: st.fc,
  };
};

export const styledTxt = (v: string, display: string, st: { bg: string; fc: string; bl: number }) => ({
  v,
  m: display,
  ct: { fa: '@', t: 'g' },
  bl: st.bl,
  fs: 10,
  bg: st.bg,
  fc: st.fc,
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
    kind: String(row._kind ?? 'leaf') === 'group' ? 'group' : 'leaf',
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

const normalizeCode = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  return raw
    .split('.')
    .map((part) => pad2(part))
    .join('.');
};

export function rowsToSheet(
  rows: Record<string, any>[],
  cols: ColumnDef[],
  name: string,
  order = 0,
) {
  const header = cols.map((col, ci) => ({
    r: 0,
    c: ci,
    v: {
      v: col.label,
      m: col.label,
      ct: { fa: 'General', t: 'g' },
      bg: '#0f172a',
      fc: '#94a3b8',
      bl: 1,
      fs: 10,
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

      if (col.key === 'item' && val !== null && val !== '') {
        const formatted = pad2(val);
        store = formatted;
        display = formatted;
      }

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

      if (col.key === 'partida' && val) {
        const normalized = String(val)
          .split('.')
          .map((p) => pad2(p))
          .join('.');

        store = normalized;
        display = normalized;
      }

      if (isBlankNumeric) {
        const cell: Record<string, any> = {
          v: '',  
          m: '',  
          ct: {
            fa: 'General',  
            t: isNum ? 'n' : 'g',
          },
          bl: (col.key === 'descripcion' || col.key === 'partida') ? st.bl : 0,
          fs: 10,
        };
        cells.push({ r: rIdx, c: ci, v: cell });
        return;
      }

      const cell: Record<string, any> = {
        v: isNum ? Number(store) : String(store),
        m: isNum ? formatNumber(Number(store)) : display,
        ct: {
          fa: 'General',
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
    status: order === 0 ? 1 : 0,
    order,
    row: Math.max(rows.length + 50, 100),
    column: Math.max(cols.length + 5, 26),
    celldata: [...header, ...cells],
    config: { columnlen, colhidden, rowlen: { 0: 30 } },
    frozen: { type: 'row', range: { row_focus: 0 } },
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
      if (col.key === 'partida' && raw !== null && raw !== '') {
        row[col.key] = normalizeCode(raw); 
      } else {
        row[col.key] = raw === null 
          ? null 
          : (col.key === 'descripcion' ? String(raw).trimStart() : raw);
      }
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
    let rawPartida = String(row.partida ?? '').trim();

    if (rawPartida) {
      rawPartida = normalizeCode(rawPartida);
    }

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
      const val = toNum(row[key]);

      // SOLO limpiar si está vacío
      if (isZeroLike(val)) {
        row[key] = null;
        setBlank(ri, key, st);
      }
    });

    // conservar total manual si existe
    const manualTotal = toNum(row.total);

    // Solo limpiar total si NO hay valor manual
    if (isZeroLike(manualTotal)) {
      setBlank(ri, 'total', st);
    }

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
      kgm: toNum(row.kgm),
    };

    const activeProfile = Array.isArray(profile) ? profile[0] : profile;
    let outputs = activeProfile.fn(inputs);

    OUTPUT_KEYS.forEach((key) => {
      const out = outputs[key];

      if (out === undefined || isZeroLike(out)) return;

      const val = r4(out);
      row[key] = val;

      let formula = '';

      const rowIndex = ri + 1;

      const L = colLetter(CI.largo);
      const A = colLetter(CI.ancho);
      const H = colLetter(CI.alto);
      const N = colLetter(CI.nveces);
      const K = colLetter(CI.kg);

      if (key === 'area') {
        formula = `=${L}${rowIndex}*${A}${rowIndex}`;
      }
      else if (key === 'vol') {
        formula = `=${L}${rowIndex}*${A}${rowIndex}*${H}${rowIndex}`;
      }

      else if (key === 'lon') {
        formula = `=${L}${rowIndex}`;
      }

      else if (key === 'und') {
        formula = `=${N}${rowIndex}`;
      }

      else if (key === 'kg') {
        formula = `=${K}${rowIndex}`;
      }

      if (formula) {
        set(ri, key, {
          f: formula,
          v: val,
          m: formatNumber(val),
          ct: { fa: 'General', t: 'n' },
        });
      } else {
        set(ri, key, mkNum(val, true));
      }
    });

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

// SOLO TOTALES (modo manual + modal)
export function buildTotalUpdates(data: any[][]) {
  const updates: Array<{ r: number; c: number; v: any }> = [];

  for (let r = 1; r < data.length; r++) {
    const row = readRow(data, r);

    // Ignorar filas vacías
    if (!ALL_COLS.some((col) => row[col.key] !== null && row[col.key] !== '')) continue;

    const totalCol = CI.total;
    if (totalCol === undefined) continue;

    const lon  = toNum(row.lon);
    const area = toNum(row.area);
    const vol  = toNum(row.vol);
    const kg   = toNum(row.kg);
    const und  = toNum(row.und);

    const total = lon || area || vol || kg || und;

    updates.push({
      r,
      c: totalCol,
      v: mkNum(total),
    });
  }

  return updates;
}

export function buildResumenRows(src: Record<string, any>[]): Record<string, any>[] {
  return src
    .filter((row) => {
      const p = String(row.partida ?? '').trim();
      return p !== '' && p !== '0' && p !== 'null';
    })
    .map((row) => ({
      _dbid: row._dbid ?? row.id ?? null,
      partida: String(row.partida ?? ''),
      descripcion: trim0(row.descripcion),
      unidad: String(row.unidad ?? ''),
      total: toNum(row.total),
      _level: row._level,
      _kind: row._kind,
    }));
}

export function buildSanitariasResumenRows(
  modulos: Record<number, Record<string, any>[]>,
  exterior: Record<string, any>[],
  cisterna: Record<string, any>[],
  moduleCount: number,
  previousResumen: Record<string, any>[] = [],
): Record<string, any>[] {
  type Agg = {
    partida: string;
    descripcion: string;
    unidad: string;
    level: number;
    kind: RowKind;
    modulos: Record<number, number>;
    exterior: number;
    cisterna: number;
  };

  const byKey: Record<string, Agg> = {};
  const orderedKeys: string[] = [];
  const previousByKey: Record<string, Record<string, any>> = {};

  const makeKey = (row: Record<string, any>) => [
    String(row.partida ?? '').trim(),
    String(row.descripcion ?? '').trim(),
    String(row.unidad ?? '').trim(),
  ].join('|');

  previousResumen.forEach((row) => {
    previousByKey[makeKey(row)] = row;
  });

  const ensure = (row: Record<string, any>) => {
    const partida = String(row.partida ?? '').trim();
    if (!partida || partida === '0' || partida === 'null') return null;

    const key = partida;
    if (!byKey[key]) {
      byKey[key] = {
        partida,
        descripcion: trim0(row.descripcion),
        unidad: String(row.unidad ?? ''),
        level: Math.max(1, toNum(row._level) || 1),
        kind: String(row._kind ?? 'leaf') === 'group' ? 'group' : 'leaf',
        modulos: {},
        exterior: 0,
        cisterna: 0,
      };
      orderedKeys.push(key);
    }

    const current = byKey[key];
    if (!current.descripcion) current.descripcion = trim0(row.descripcion);
    if (!current.unidad) current.unidad = String(row.unidad ?? '');
    current.level = Math.min(current.level, Math.max(1, toNum(row._level) || 1));
    if (String(row._kind ?? 'leaf') === 'group') current.kind = 'group';
    return current;
  };

  const accumulate = (
    rows: Record<string, any>[],
    source: 'modulo' | 'exterior' | 'cisterna',
    moduloNumber?: number,
  ) => {
    rows.forEach((row) => {
      const entry = ensure(row);
      if (!entry) return;

      const total = r4(toNum(row.total));
      if (source === 'modulo' && moduloNumber !== undefined) {
        entry.modulos[moduloNumber] = r4((entry.modulos[moduloNumber] || 0) + total);
      } else if (source === 'exterior') {
        entry.exterior = r4(entry.exterior + total);
      } else {
        entry.cisterna = r4(entry.cisterna + total);
      }
    });
  };

  for (let i = 1; i <= moduleCount; i++) {
    accumulate(modulos[i] || [], 'modulo', i);
  }
  accumulate(exterior || [], 'exterior');
  accumulate(cisterna || [], 'cisterna');

  orderedKeys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return orderedKeys.map((key) => {
    const item = byKey[key];
    const previousRow = previousByKey[makeKey(item)] ?? null;
    const row: Record<string, any> = {
      _dbid: previousRow?._dbid ?? previousRow?.id ?? null,
      partida: item.partida,
      descripcion: item.descripcion,
      unidad: item.unidad,
      exterior: r4(item.exterior),
      cisterna: r4(item.cisterna),
      _level: item.level,
      _kind: item.kind,
    };

    let total = r4(item.exterior + item.cisterna);
    for (let i = 1; i <= moduleCount; i++) {
      const columnKey = `modulo_${i}`;
      const value = r4(item.modulos[i] || 0);
      row[columnKey] = value;
      total = r4(total + value);
    }
    row.total = total;

    return row;
  });
}
