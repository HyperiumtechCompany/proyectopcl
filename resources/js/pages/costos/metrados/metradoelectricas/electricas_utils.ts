import {
    ALL_COLS,
    CI,
    LEAF_STYLE,
    LEVEL_PALETTE,
    MAX_LEVELS,
    NBSP,
    UNIT_PROFILES,
    OUTPUT_KEYS,
} from './electricas_constants';
import type {
    ColumnDef,
    MeasureInputs,
    MeasureOutputs,
    RowEntry,
    RowKind,
    UnitProfile,
} from './electricas_types';

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
        : rounded.toLocaleString('es-PE', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 2,
          });
};
export const blank = (v: any): boolean =>
    v === null || v === undefined || v === '' || v === 0;
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
        [1000, 'M'],
        [900, 'CM'],
        [500, 'D'],
        [400, 'CD'],
        [100, 'C'],
        [90, 'XC'],
        [50, 'L'],
        [40, 'XL'],
        [10, 'X'],
        [9, 'IX'],
        [5, 'V'],
        [4, 'IV'],
        [1, 'I'],
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

const FORMULA_META_KEYS = new Set([
    '_formula_key',
    '_formula_output',
    '_formula_expr',
    '_formula_label',
]);

const getCellRef = (key: string, rowIndex: number): string => {
  const colIndex = CI[key];
  return colIndex === undefined ? '' : `${colLetter(colIndex)}${rowIndex}`;
};
const buildFormulaExpressionFromKey = (formulaKey: string, rowIndex: number): string => {
  const E = getCellRef('elsim', rowIndex);
  const L = getCellRef('largo', rowIndex);
  const A = getCellRef('ancho', rowIndex);
  const H = getCellRef('alto', rowIndex);
  const N = getCellRef('nveces', rowIndex);
  const K = getCellRef('kg', rowIndex);
  const KGM = getCellRef('kgm', rowIndex);
  switch (formulaKey) {
    case 'm2_v1':
    case 'm_v2':
        return `=(${L}+${A})*${N}*${E}`;
    case 'm2_v2':
    case 'm3_v3':
        return `=(${L}+${A})*2*${H}*${N}`;
    case 'm2_v3':
        return `=${L}*${H}*${N}`;
    case 'm2_v4':
    case 'und_v3':
    case 'pza_v3':
        return `=${L}*${A}*${E}`;
    case 'm2_v5':
        return `=(${L}+${A})*2*${H}`;
    case 'm3_v1':
    case 'm3_v2':
    case 'm3_v4':
    case 'm3_v7':
        return `=${L}*${A}*${H}*${N}`;
    case 'm3_v5':
        return `=${L}*${A}*${H}-${E}`;
    case 'm3_v6':
        return `=${L}*${A}*${H}*${E}`;
    case 'kg_vbase':
        return KGM
            ? `=(${E}*(${L}+${A}+${H})*${N})*${KGM}`
            : `=${E}*(${L}+${A}+${H})*${N}`;
    case 'kg_v1':
        return `=${L}*${K}`;
    case 'kg_v2':
        return `=${L}*${E}*${N}`;
    case 'kg_v3':
        return `=(${L}+${A}+${H})*${N}`;
    case 'kg_v4':
        return `=${L}*${K}*${E}`;
    case 'kg_v5':
        return K ? `=${K}` : '';
    case 'm_v1':
    case 'ml_v1':
        return `=${L}*${N}`;
    case 'm_v3':
    case 'ml_v3':
        return `=${L}*${E}`;
    case 'm_v4':
    case 'ml_v4':
        return `=(${L}+${A})*2*${N}`;
    case 'ml_v2':
        return `=(${L}+${A})*${N}`;
    case 'und_v1':
    case 'pza_v1':
    case 'glb_v1':
    case 'pto_v1':
        return `=${E}*${N}`;
    case 'und_v2':
    case 'pza_v2':
        return `=${N}`;
    case 'und_v4':
    case 'und_v5':
    case 'pza_v4':
    case 'pza_v5':
        return `=${E}`;
    default:
        return '';
  }
};
const buildFormulaExpressionFromCustom = (expression: string, rowIndex: number): string => {
  if (!expression.trim()) return '';
  const refs: Record<string, string> = {
    elsim: getCellRef('elsim', rowIndex),
    largo: getCellRef('largo', rowIndex),
    ancho: getCellRef('ancho', rowIndex),
    alto: getCellRef('alto', rowIndex),
    nveces: getCellRef('nveces', rowIndex),
    kg: getCellRef('kg', rowIndex),
    kgm: getCellRef('kgm', rowIndex),
    lon: getCellRef('lon', rowIndex),
    area: getCellRef('area', rowIndex),
    vol: getCellRef('vol', rowIndex),
    und: getCellRef('und', rowIndex),
  };
  let translated = expression;
  Object.entries(refs).forEach(([key, ref]) => {
    if (!ref) return;
    translated = translated.replace(new RegExp('\\b' + key + '\\b', 'g'), ref);
  });
  return translated.startsWith('=') ? translated : '=' + translated;
};
export const evaluateCustomFormula = (expression: string, inputs: MeasureInputs): number => {
  try {
    const { elsim, largo, ancho, alto, nveces, kg, kgm } = inputs;
    const result = new Function(
      'elsim', 'largo', 'ancho', 'alto', 'nveces', 'kg', 'kgm', 'Math',
      `"use strict"; return (${expression});`,
    )(elsim, largo, ancho, alto, nveces, kg, kgm, Math);
    return toNum(result);
  } catch {
    return 0;
  }
};

export const resolveUnitProfile = (
    unit: string,
    formulaKey?: string | null,
    row?: Record<string, any> | null,
): UnitProfile | null => {
    const profiles = UNIT_PROFILES[String(unit ?? '').trim().toLowerCase()] ?? [];
    if (!profiles.length) return null;

    if (formulaKey) {
        const match = profiles.find((profile) => profile.key === formulaKey);
        if (match) return match;
    }

    if (row) {
        const currentOutputKey = OUTPUT_KEYS.find(
            (key) => !isZeroLike(row[key]),
        );
        const scored = profiles
            .map((profile) => {
                const activeCount = profile.activeInputs.filter(
                    (inputKey) => !isZeroLike(row[inputKey]),
                ).length;
                const outputScore =
                    currentOutputKey && profile.outputKey === currentOutputKey
                        ? 10
                        : 0;
                return {
                    profile,
                    score: outputScore + activeCount,
                };
            })
            .sort((a, b) => b.score - a.score);

        if (scored[0]?.score > 0) return scored[0].profile;
    }

    return profiles[0] ?? null;
};

export const buildRowFormulaMeta = ({
    rowIndex,
    outputKey,
    formulaKey,
    formulaExpression,
    formulaLabel,
    fallbackProfile,
    value,
}: {
    rowIndex: number;
    outputKey: keyof MeasureOutputs;
    formulaKey?: string | null;
    formulaExpression?: string | null;
    formulaLabel?: string | null;
    fallbackProfile?: UnitProfile | null;
    value?: number;
}): { formula: string; formulaDisplay: string } => {
  const formula =
    formulaExpression && formulaExpression.trim()
      ? buildFormulaExpressionFromCustom(formulaExpression, rowIndex)
      : buildFormulaExpressionFromKey(formulaKey ?? '', rowIndex);
  const label =
    formulaLabel?.trim() ||
    fallbackProfile?.formula ||
    fallbackProfile?.label ||
    String(outputKey);
  return {
    formula,
    formulaDisplay:
      value === undefined || isZeroLike(value)
        ? label
        : `${label} = ${formatNumber(value)}`,
  };
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
export const mkFormula = (
    formula: string,
    value: number | string = '',
    _formulaDisplay?: string,
) => {
    // Always show the numeric value as display, NOT the formula description text.
    // The formula description is stored separately in _formula_label metadata column.
    const numericDisplay =
        value === '' || value === undefined
            ? ''
            : typeof value === 'number'
              ? formatNumber(value) || String(value)
              : String(value);
    return {
        f: formula,
        v: value === '' ? '' : value,
        m: numericDisplay,
        ct: { fa: 'General', t: typeof value === 'number' ? 'n' : 'g' },
    };
};

export const mkTxt = (v: string, extra: Record<string, any> = {}) => ({
    v,
    m: v,
    ct: { fa: '@', t: 'g' },
    ...extra,
});

export const styledNum = (
    v: number,
    st: { bg: string; fc: string; bl: number },
    keepZero = false,
) => {
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

export const styledTxt = (
    v: string,
    display: string,
    st: { bg: string; fc: string; bl: number },
) => ({
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

export function rowMeta(row: Record<string, any>): {
    level: number;
    kind: RowKind;
} {
    return {
        level: Math.max(1, Math.min(MAX_LEVELS, toNum(row._level) || 1)),
        kind: String(row._kind ?? 'leaf') === 'group' ? 'group' : 'leaf',
    };
}

const BLANKABLE_NUMERIC_KEYS = new Set([
    'elsim',
    'largo',
    'ancho',
    'alto',
    'nveces',
    'lon',
    'area',
    'vol',
    'kg',
    'und',
    'total',
]);

const hasItemCode = (value: unknown): boolean => {
    const raw = String(value ?? '').trim();
    return raw !== '' && raw !== '0' && raw.toLowerCase() !== 'null';
};

const getDepthFromItem = (value: unknown): number => {
    const raw = String(value ?? '').trim();
    const parts = raw
        .split(/[\.,]/)
        .filter((part) => part !== '' && !Number.isNaN(Number(part)));
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
        const kind =
            String(row._kind ?? 'leaf') === 'group'
                ? 'group'
                : ('leaf' as RowKind);
        const level = Math.max(1, Math.min(MAX_LEVELS, toNum(row._level) || 1));
        const st = kind === 'group' ? levelStyle(level) : LEAF_STYLE;
        const rIdx = ri + 1;

        cols.forEach((col, ci) => {
            const val =
                row[col.key] === null || row[col.key] === undefined
                    ? col.key === '_dbid'
                        ? (row.id ?? null)
                        : col.key === '_level'
                          ? level
                          : col.key === '_kind'
                            ? kind
                            : null
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
            const isBlankNumeric =
                !isPartida &&
                BLANKABLE_NUMERIC_KEYS.has(col.key) &&
                isZeroLike(store);
            const isNum =
                !isPartida &&
                (typeof store === 'number' ||
                    (store !== '' &&
                        !Number.isNaN(Number(store)) &&
                        store !== ''));

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
                    bl:
                        col.key === 'descripcion' || col.key === 'partida'
                            ? st.bl
                            : 0,
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
                bl:
                    col.key === 'descripcion' || col.key === 'partida'
                        ? st.bl
                        : 0,
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
        if (
            col.key === '_dbid' ||
            col.key === '_level' ||
            col.key === '_kind' ||
            FORMULA_META_KEYS.has(col.key)
        )
            colhidden[ci] = 1;
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

export function sheetToRows(
    sheet: any,
    cols: ColumnDef[],
): Record<string, any>[] {
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
                row[col.key] =
                    raw === null
                        ? null
                        : col.key === 'descripcion'
                          ? String(raw).trimStart()
                          : raw;
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
        if (
            !ALL_COLS.some(
                (col) => row[col.key] !== null && row[col.key] !== '',
            )
        )
            continue;
        const { level, kind } = rowMeta(row);
        entries.push({ ri: r, row, level, kind, total: 0 });
    }
    if (!entries.length) return [];

    const updates: Array<{ r: number; c: number; v: any }> = [];
    const set = (r: number, key: string, v: any) => {
        const c = CI[key];
        if (c !== undefined) updates.push({ r, c, v });
    };
    const setBlank = (
        r: number,
        key: string,
        st?: { bg: string; fc: string; bl: number },
    ) => {
        set(
            r,
            key,
            st
                ? { ...mkBlank(), bg: st.bg, fc: st.fc, bl: st.bl, fs: 10 }
                : mkBlank(),
        );
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
                set(
                    ri,
                    'descripcion',
                    styledTxt(desc, indent(entry.level, false) + desc, st),
                );
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
            set(
                ri,
                'descripcion',
                styledTxt(
                    desc,
                    indent(currentItemLevel, true) + desc,
                    LEAF_STYLE,
                ),
            );
        }
    });

    let inheritedUnit = '';
    entries.forEach(({ ri, row }) => {
        if (hasItemCode(row.partida)) {
            inheritedUnit = String(row.unidad ?? '').trim();
            return;
        }

        if (
            inheritedUnit &&
            String(row.unidad ?? '').trim() !== inheritedUnit
        ) {
            row.unidad = inheritedUnit;
            set(ri, 'unidad', {
                ...mkTxt(inheritedUnit),
                bg: LEAF_STYLE.bg,
                fc: LEAF_STYLE.fc,
                fs: 10,
            });
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

        const unit = String(row.unidad ?? '')
            .trim()
            .toLowerCase();
        const activeProfile = resolveUnitProfile(unit, row._formula_key, row);
        if (!activeProfile && !row._formula_expr) {
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

        const formulaOutputKey = String(
            row._formula_output ?? activeProfile?.outputKey ?? '',
        ) as keyof MeasureOutputs;
        const outputs =
            row._formula_expr && formulaOutputKey
                ? {
                      [formulaOutputKey]: evaluateCustomFormula(
                          String(row._formula_expr),
                          inputs,
                      ),
                  }
                : (activeProfile?.fn(inputs) ?? {});

        OUTPUT_KEYS.forEach((key) => {
            const out = outputs[key];

            // ignorar si no hay valor
            if (out === undefined || isZeroLike(out)) return;

            const val = r4(out);
            row[key] = val;

            const rowIndex = ri + 1;
            const { formula } = buildRowFormulaMeta({
                rowIndex,
                outputKey: key,
                formulaKey: row._formula_key,
                formulaExpression: row._formula_expr,
                formulaLabel: row._formula_label,
                fallbackProfile: activeProfile,
                value: val,
            });

            if (formula) {
                // Pass only the formula and numeric value — mkFormula handles display
                set(ri, key, mkFormula(formula, val));
            } else {
                // fallback limpio
                set(ri, key, mkNum(val, true));
            }
        });

        const manualFromOutputs =
            OUTPUT_KEYS.map((k) => toNum(row[k])).find((v) => !isZeroLike(v)) ??
            0;

        const resolvedOutputKey =
            formulaOutputKey || activeProfile?.outputKey || 'und';
        const outVal = r4(outputs[resolvedOutputKey] ?? 0);

        entry.total = isAnchor
            ? 0
            : !isZeroLike(manualTotal)
              ? manualTotal
              : !isZeroLike(manualFromOutputs)
                ? manualFromOutputs
                : outVal;

        if (!isAnchor) {
            setBlank(ri, 'total');
        }
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
        if (
            !ALL_COLS.some(
                (col) => row[col.key] !== null && row[col.key] !== '',
            )
        )
            continue;

        const totalCol = CI.total;
        if (totalCol === undefined) continue;

        const lon = toNum(row.lon);
        const area = toNum(row.area);
        const vol = toNum(row.vol);
        const kg = toNum(row.kg);
        const und = toNum(row.und);

        const total = lon || area || vol || kg || und;

        updates.push({
            r,
            c: totalCol,
            v: mkNum(total),
        });
    }

    return updates;
}

export function buildResumenRows(
    src: Record<string, any>[],
): Record<string, any>[] {
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

export function buildElectricasResumenRows(
    metrado: Record<string, any>[] | undefined,
    previousResumen: Record<string, any>[] = [],
): Record<string, any>[] {
    const metradoSafe = metrado || [];
    type Agg = {
        partida: string;
        descripcion: string;
        unidad: string;
        level: number;
        kind: RowKind;
        total: number;
    };

    const byKey: Record<string, Agg> = {};
    const orderedKeys: string[] = [];
    const previousByKey: Record<string, Record<string, any>> = {};

    const makeKey = (row: Record<string, any>) =>
        [
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
                kind:
                    String(row._kind ?? 'leaf') === 'group' ? 'group' : 'leaf',
                total: 0,
            };
            orderedKeys.push(key);
        }
        return byKey[key];
    };

    // Agregar desde metrado
    metradoSafe.forEach((row) => {
        const agg = ensure(row);
        if (!agg) return;

        // Sumar valores numéricos relevantes (lon, area, vol, kg, und, total)
        ['lon', 'area', 'vol', 'kg', 'und', 'total'].forEach((col) => {
            const val = toNum(row[col]);
            if (val) agg.total += val;
        });
    });

    // Convertir a filas
    const rows: Record<string, any>[] = orderedKeys.map((key) => {
        const agg = byKey[key];
        const prev = previousByKey[makeKey(agg)];

        return {
            ...prev,
            partida: agg.partida,
            descripcion: agg.descripcion,
            unidad: agg.unidad,
            _level: agg.level,
            _kind: agg.kind,
            total: r4(agg.total),
        };
    });

    return rows;
}
