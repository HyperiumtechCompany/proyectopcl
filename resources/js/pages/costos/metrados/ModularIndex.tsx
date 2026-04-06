import { router, usePage } from '@inertiajs/react';
import {
    ChevronLeft, Settings2, Save, RefreshCcw,
    CheckCircle2, AlertCircle, Loader2,
    ArrowUp, ArrowDown, FolderPlus, Folder, FileText,
} from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import * as XLSX from "xlsx";
import Luckysheet from '@/components/costos/tablas/Luckysheet';
import { Button } from '@/components/ui/button';
import {
    Dialog, DialogContent, DialogDescription,
    DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';
import { detectDiscipline, injectTemplateIfEmpty } from './lib/metrado_templates';

// TIPOS
interface ColumnDef { key: string; label: string; width: number }
type BaseKeys =
    | 'partida' | 'descripcion' | 'unidad'
    | 'largo' | 'ancho' | 'alto'
    | 'elsim' | 'nveces'
    | '_level' | '_kind';

type ImportRow = Record<BaseKeys, any> & {
    [key: string]: any;
};

interface ModularMetradoPageProps {
    project:  { id: number; nombre: string };
    titulo:   string;
    baseURL:  string;
    config:   { cantidad_modulos: number };
    modulos:  Record<string, Record<string, any>[]>;
    exterior: Record<string, any>[];
    cisterna: Record<string, any>[];
    resumen:  Record<string, any>[];
    [key: string]: unknown;
}

type EntryKind = 'group' | 'leaf';

interface Entry {
    ri:    number;              // row index en la hoja (1-based, 0 = cabecera)
    row:   Record<string, any>; // datos de la fila (mutables durante recálculo)
    level: number;              // profundidad 1–MAX_LEVELS
    kind:  EntryKind;
    total: number;              // calculado durante recálculo
}


// DEFINICIÓN DE COLUMNAS
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
    { key: '_level', label: '', width: 1 }, // número 1-10
    { key: '_kind',  label: '', width: 1 }, // 'group' | 'leaf'
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
];

// UNIDADES Y MAPA DE CÁLCULO
const UNIDAD_OPTIONS = ['und', 'm', 'ml', 'm2', 'm3', 'kg', 'lt', 'gl', 'pza', 'pto', 'glb'];

const UNIT_TOTAL_COL: Record<string, string> = {
  und: 'und', pza: 'und', pto: 'und',
  m:   'lon', ml:  'lon',
  m2:  'area',
  m3:  'vol', lt: 'vol', gl: 'vol',
  kg:  'kg',
  glb: 'total',
};

// Numeración base para Metrado Sanitarias
const TOP_LEVEL_START = 4; // inicia en 04
const DEFAULT_DESC_GROUP = 'Nuevo grupo';
const DEFAULT_DESC_LEAF = 'Nueva partida';


// ESTILOS VISUALES — 10 niveles de azul degradado
const MAX_LEVELS = 10;

/** Un degradado de azul marino → azul claro para grupos de nivel 1 → 10 */
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

/** Indentación visual: 3 NBSP por nivel (grupos: level-1, hojas: level) */
const NBSP = '\u00A0\u00A0\u00A0';
const indent = (level: number, isLeaf: boolean) =>
    NBSP.repeat(isLeaf ? level : Math.max(0, level - 1));

const SAVE_DEBOUNCE = 1800;

// HELPERS PUROS
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

// CONVERSIÓN FILAS ↔ DATOS DE HOJA LUCKYSHEET
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
            const val = blank(row[col.key])
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
            const cell = data[r]?.[ci];

            let raw = null;
            if (cell && typeof cell === 'object') {
                raw = cell.v?.v ?? cell.v ?? null;
            } else {
                raw = cell ?? null;
            }

            if (!blank(raw)) {
                row[col.key] =
                    col.key === 'descripcion'
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

/** Lee una fila completa desde data[][] en un objeto plano */
function readDataRow(data: any[][], ri: number): Record<string, any> {
    const row: Record<string, any> = {};
    BASE_COLS.forEach((col, ci) => {
        const raw = cellRaw(data[ri]?.[ci]);
        row[col.key] = blank(raw) ? null : raw;
    });
    return row;
}

/** Obtiene level y kind de una fila cruda */
function rowMeta(row: Record<string, any>): { level: number; kind: EntryKind } {
    return {
        level: Math.max(1, Math.min(MAX_LEVELS, toNum(row['_level']) || 1)),
        kind:  String(row['_kind'] ?? 'leaf') === 'group' ? 'group' : 'leaf',
    };
}

// COMPONENTE PRINCIPAL
export default function ModularIndex() {
    const { project, titulo, baseURL, config, modulos, exterior, cisterna, resumen } =
        usePage<ModularMetradoPageProps>().props;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Costos',             href: '/costos' },
        { title: project?.nombre || 'Proyecto',       href: `/costos/${project?.id || 0}` },
        { title: titulo, href: '#' },
    ];

    const moduleCount = Math.max(1, Number(config?.cantidad_modulos ?? 1));

    // Detectar la disciplina a partir del título para las plantillas
    const discipline = detectDiscipline(titulo);

    // ── State ──────────────────────────────────────────────────────────────
    const [isConfigOpen,     setIsConfigOpen]     = useState(false);
    const [newModuleCount,   setNewModuleCount]   = useState(moduleCount);
    const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);
    const [saving,    setSaving]    = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    // ── Refs ───────────────────────────────────────────────────────────────
    const saveTimer            = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestSheets         = useRef<any[]>([]);
    const progUpdateCount = useRef(0); // contador: >0 = escritura programática en curso
    const recalcTimer = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // ── Columnas del resumen (dinámicas por N módulos) ─────────────────────
    const resumenCols = useMemo<ColumnDef[]>(() => [
        ...RESUMEN_BASE,
        ...Array.from({ length: moduleCount }, (_, i) => ({
        key: `modulo_${i + 1}`, label: `Módulo ${i + 1}`, width: 110,
        })),
        { key: 'total_modulos',  label: 'Total Módulos',  width: 110 },
        { key: 'total_exterior', label: 'Total Exterior', width: 110 },
        { key: 'total_cisterna', label: 'Total Cisterna', width: 110 },
        { key: 'total_general',  label: 'Total General',  width: 115 },
        { key: 'observacion',    label: 'Obs.',           width: 120 },
    ], [moduleCount]);

    // ═══════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR DE FILAS RESUMEN
    // Agrega los totales de los GRUPOs (todos los niveles) por módulo/ext/cis
    // ═══════════════════════════════════════════════════════════════════════
    const buildResumenRows = useCallback((
        modulosData: Record<string, Record<string, any>[]>,
        extData:     Record<string, any>[],
        cisData:     Record<string, any>[],
    ) => {
        type Agg = {
            code: string; desc: string; und: string; level: number;
            mod: Record<number, number>; ext: number; cis: number;
        };
        const byCode: Record<string, Agg> = {};
        const codeOrder: string[] = [];

        const ensure = (code: string, desc: string, und: string, level: number) => {
            if (!byCode[code]) {
                byCode[code] = {
                    code,
                    desc,
                    und,
                    level,
                    mod: {},
                    ext: 0,
                    cis: 0
                };
                codeOrder.push(code);
            }
            return byCode[code];
        };

        const process = (rows: Record<string, any>[], modIdx?: number, isExt = false, isCis = false) => {
            rows.forEach((row) => {
                const kind  = String(row['_kind'] ?? 'leaf') === 'group' ? 'group' : 'leaf';
                if (kind !== 'group') return;
                const fullCode = String(row.partida ?? '').trim();
                if (!fullCode) return;
                const code = fullCode;
                if (!code) return;
                const e = ensure(
                    code,
                    byCode[code]?.desc || String(row.descripcion ?? ''),
                    byCode[code]?.und || String(row.unidad ?? ''),
                    toNum(row['_level']) || 1
                );
                const t = r4(toNum(row.total ?? 0));
                if (modIdx !== undefined) e.mod[modIdx] = (e.mod[modIdx] || 0) + t;
                if (isExt) e.ext += t;
                if (isCis) e.cis += t;
            });
        };

        for (let i = 1; i <= moduleCount; i++) process(modulosData?.[String(i)] ?? [], i);
        process(extData  ?? [], undefined, true,  false);
        process(cisData  ?? [], undefined, false, true);

        codeOrder.sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true })
        );

        return codeOrder.map((code) => {
            const v = byCode[code];
            const modTotals: Record<string, number> = {};
            let sumMod = 0;
            for (let i = 1; i <= moduleCount; i++) {
                const val = toNum(v.mod[i] || 0);
                modTotals[`modulo_${i}`] = val;
                sumMod += val;
            }
            return {
                _level: v.level, _kind: 'group',
                partida: code, descripcion: v.desc, unidad: v.und,
                total_modulos: sumMod, total_exterior: v.ext, total_cisterna: v.cis,
                total_general: sumMod + v.ext + v.cis, ...modTotals,
            };
        });
    }, [moduleCount]);

    const resumenRows = useMemo(() => {
        const c = buildResumenRows(modulos ?? {}, exterior ?? [], cisterna ?? []);
        return c.length > 0 ? c : (resumen ?? []);
    }, [buildResumenRows, modulos, exterior, cisterna, resumen]);

    // ── Hojas iniciales ────────────────────────────────────────────────────
    const initialSheets = useMemo(() => {
        const sheets: any[] = [];
        let order = 0;
        for (let i = 1; i <= moduleCount; i++) {
            sheets.push(rowsToSheet(injectTemplateIfEmpty(modulos?.[String(i)] ?? [], discipline), BASE_COLS, `Módulo ${i}`, order++));
        }
        sheets.push(rowsToSheet(injectTemplateIfEmpty(exterior  ?? [], discipline), BASE_COLS,   `Exterior`, order++));
        sheets.push(rowsToSheet(injectTemplateIfEmpty(cisterna  ?? [], discipline), BASE_COLS,   `Cisterna`, order++));
        sheets.push(rowsToSheet(resumenRows,     resumenCols, `Resumen`,  order++));
        return sheets;
    }, [moduleCount, modulos, exterior, cisterna, resumenRows, resumenCols]);

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
            if (name.startsWith('Módulo')) {
                const m = name.match(/(\d+)/);
                const n = m ? Number(m[1]) : NaN;
                if (!isNaN(n)) reqs.push({
                    url:  `${baseURL}/modulo/${n}`,
                    body: { rows: sheetToRows(sheet, BASE_COLS), modulo_nombre: name },
                });
            } else if (name === 'Exterior') {
                reqs.push({ url: `${baseURL}/exterior`, body: { rows: sheetToRows(sheet, BASE_COLS) } });
            } else if (name === 'Cisterna') {
                reqs.push({ url: `${baseURL}/cisterna`, body: { rows: sheetToRows(sheet, BASE_COLS) } });
            } else if (name === 'Resumen') {
                reqs.push({ url: `${baseURL}/resumen`, body: { rows: sheetToRows(sheet, resumenCols) } });
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
    }, [project?.id || 0, resumenCols]);

    const scheduleSave = useCallback((sheets: any[]) => {
        latestSheets.current = sheets;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => doSave(latestSheets.current), SAVE_DEBOUNCE);
    }, [doSave]);

    // ═══════════════════════════════════════════════════════════════════════
    // RECÁLCULO AUTOMÁTICO — N NIVELES
    // ═══════════════════════════════════════════════════════════════════════
    const recalcActiveSheet = useCallback(() => {

        if (progUpdateCount.current > 3) return;
        const ls = (window as any).luckysheet;
        if (!ls) return;

        const active = ls.getSheet();
        if (!active || active.name === 'Resumen') return;

        const data: any[][] = active.data || [];
        const sheetOrder = ls.getSheet().order;

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

        // PASE 1 — NUMERACIÓN AUTOMÁTICA
        const counters = new Array(MAX_LEVELS + 1).fill(0); // counters[1..MAX_LEVELS]
        counters[1] = Math.max(0, TOP_LEVEL_START - 1);

        entries.forEach(({ ri, row, level, kind }) => {
            if (kind === 'leaf') {
                // Limpiar número si había alguno
                if (!blank(row.partida)) {
                    set(ri, 'partida', mkTxt(''));
                    row.partida = '';
                }
                // Estilar descripción con indentación de hoja
                const desc = trim0(row.descripcion);
                if (desc) {
                    set(ri, 'descripcion', styledTxt(desc, indent(level, true) + desc, LEAF_STYLE));
                    row.descripcion = desc;
                }
                // Normalizar columnas internas
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
        const unitStack: Array<string> = new Array(MAX_LEVELS + 1).fill('');

        entries.forEach(({ ri, row, level, kind }) => {
            if (kind === 'group') {
                // Limpiar niveles ≥ este nivel (salimos del scope anterior)
                for (let i = level; i <= MAX_LEVELS; i++) unitStack[i] = '';
                unitStack[level] = String(row.unidad ?? '').trim();
            } else {
                // Buscar unidad heredada: del nivel más cercano al más lejano
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
            if (toNum(row[key]) !== val) {
            set(ri, key, mkNum(val));
            row[key] = val;
            }
        };

        upd('lon', newLon);
        upd('area', newArea);
        upd('vol', newVol);
        upd('und', newUnd);

        const unidadRaw = String(row.unidad ?? '').trim().toLowerCase();
        const unidad = unidadRaw.replace(/\s+/g, '');


        let tVal = 0;
        const totalCol = UNIT_TOTAL_COL[unidad];

        if (totalCol === 'lon') tVal = newLon;
        else if (totalCol === 'area') tVal = newArea;
        else if (totalCol === 'vol') tVal = newVol;
        else if (totalCol === 'kg') tVal = toNum(row.kg);
        else if (totalCol === 'und') tVal = newUnd;


        e.total = tVal;
        set(ri, 'total', mkNum(tVal));
        });
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PASE 4 — ROLL-UP: de la profundidad máxima hasta el nivel 1
        // Cada GRUPO acumula la suma de sus HIJOS DIRECTOS (level + 1)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const maxLevel = entries.reduce((m, e) => Math.max(m, e.level), 1);

        for (let lvl = maxLevel; lvl >= 1; lvl--) {
            entries.forEach((e, idx) => {
                if (e.kind !== 'group' || e.level !== lvl) return;

                let sum = 0;
                for (let j = idx + 1; j < entries.length; j++) {
                    const child = entries[j];
                    if (child.level <= lvl) break;          // fuera del subtree
                    if (child.level === lvl + 1) {          // hijo directo
                        sum = r4(sum + child.total);
                    }
                }
                e.total  = sum;
                e.row.total = sum;
                set(e.ri, 'total', styledNum(sum, groupStyle(lvl)));
            });
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PASE 5 — FLUSH (un único batch de setCellValue)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

            const active = ls.getSheet();
            if (active) {
                scheduleSave([active]);
            }

        }, 120);
    }, [scheduleSave]);

    // ── Handlers Luckysheet ────────────────────────────────────────────────
    const afterChange = useCallback((data: any) => {
        if (!data) return;

        if (progUpdateCount.current > 0) return;

        clearTimeout(recalcTimer.current);

        recalcTimer.current = setTimeout(() => {
            progUpdateCount.current = 0;
            recalcActiveSheet();
        }, 120);

    }, [recalcActiveSheet]);

    const handleDataChange = useCallback((sheets: any[]) => {
        const active = sheets.find((s: any) => s.status === 1);
        if (active) scheduleSave([active]);
    }, [scheduleSave]);

    // ═══════════════════════════════════════════════════════════════════════
    // MOVER BLOQUE (intercambia con hermano anterior/siguiente)
    //
    // ALGORITMO
    //  1. Determina el "bloque activo" = fila seleccionada + todas las filas
    //     consecutivas con level > fila.level (sus descendientes).
    //  2. Busca el hermano (nodo al mismo nivel padre que no sea descendiente)
    //     en la dirección indicada y delimita su bloque.
    //  3. Lee ambos bloques de la data[][] en memoria.
    //  4. Los escribe en orden invertido usando setCellValue (en batch).
    // ═══════════════════════════════════════════════════════════════════════
    const moveBlock = useCallback((direction: 'up' | 'down') => {
        const ls = (window as any).luckysheet;
        if (!ls) return;

        const active = ls.getSheet();
        if (!active || active.name === 'Resumen') return;

        const range = ls.getRange?.();
        if (!range?.length) return;
        const selRow = range[0].row[0]; // 1-based (row 0 = cabecera)
        const data: any[][] = active.data || [];
        const sheetOrder = ls.getSheet().order;

        // ── Leer índice de filas con datos ──────────────────────────────────
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

        // ── Delimitar el bloque activo ──────────────────────────────────────
        let blockEnd = selRow;
        for (let i = selIdx + 1; i < riList.length; i++) {
            if (riList[i].level <= selLevel) break;
            blockEnd = riList[i].ri;
        }
        const blockEndIdx = riList.findIndex((e) => e.ri === blockEnd);

        // ── Leer N filas de data[][] (incluyendo filas vacías intermedias) ──
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
            // ── Buscar hermano anterior: mismo nivel, no descendiente ───────
            let prevSibIdx = -1;
            for (let i = selIdx - 1; i >= 0; i--) {
                if (riList[i].level < selLevel) break;   // hit parent → no sibling above
                if (riList[i].level === selLevel) { prevSibIdx = i; break; }
            }
            if (prevSibIdx === -1) return; // ya es el primer hermano

            // Delimitar bloque del hermano anterior
            const prevStart = riList[prevSibIdx].ri;
            let prevEnd = prevStart;
            for (let i = prevSibIdx + 1; i < selIdx; i++) {
                if (riList[i].level <= selLevel) break;
                prevEnd = riList[i].ri;
            }

            // Leer los dos bloques
            const prevBlock = readBlock(prevStart, prevEnd);
            const ourBlock  = readBlock(selRow, blockEnd);

            // Escribir: ourBlock en prevStart, prevBlock después
            progUpdateCount.current++;
            writeBlock(ourBlock,  prevStart,               false);
            writeBlock(prevBlock, prevStart + ourBlock.length, true);

        } else {
            // ── Buscar hermano siguiente ─────────────────────────────────────
            let nextSibIdx = -1;
            for (let i = blockEndIdx + 1; i < riList.length; i++) {
                if (riList[i].level < selLevel) break;
                if (riList[i].level === selLevel) { nextSibIdx = i; break; }
            }
            if (nextSibIdx === -1) return; // ya es el último hermano

            // Delimitar bloque del hermano siguiente
            const nextStart = riList[nextSibIdx].ri;
            let nextEnd = nextStart;
            for (let i = nextSibIdx + 1; i < riList.length; i++) {
                if (riList[i].level <= selLevel) break;
                nextEnd = riList[i].ri;
            }

            const nextBlock = readBlock(nextStart, nextEnd);
            const ourBlock  = readBlock(selRow, blockEnd);

            // Escribir: nextBlock en selRow, ourBlock después
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
    // Opciones:
    //   addGroup(sameLevel)  → grupo al mismo nivel que la fila activa
    //   addGroup(!sameLevel) → subgrupo (nivel + 1)
    //   addLeaf()            → hoja (nivel = nivel del grupo activo + 1)
    // ═══════════════════════════════════════════════════════════════════════
    const addRow = useCallback((kind: EntryKind, sameLevelAsSelected = true) => {
        const ls = (window as any).luckysheet;
        if (!ls) return;

        const active = ls.getSheet();
        if (!active) return;
        if (!active || active.name === 'Resumen') return;

        const data: any[][] = active.data || [];
        const sheetOrder = ls.getSheet().order;

        // Determinar nivel de la fila seleccionada
        const range    = ls.getRange?.();
        const selRow   = range?.[0]?.row?.[1] ?? range?.[0]?.row?.[0] ?? 1;
        const selData  = readDataRow(data, selRow);
        const { level: selLevel, kind: selKind } = rowMeta(selData);

        let newLevel: number;
        if (kind === 'leaf') {
            // Hoja va un nivel más profundo que el grupo seleccionado
            newLevel = (selKind === 'group' ? selLevel + 1 : selLevel);
        } else {
            // Grupo: mismo nivel o un nivel más profundo
            newLevel = sameLevelAsSelected
                ? selLevel
                : Math.min(selLevel + 1, MAX_LEVELS);
        }

        // Insertar después del bloque completo (selected + descendants)
        let insertAfter = selRow;
        if (!sameLevelAsSelected || kind === 'leaf') {
            // Insertar justo después de la fila seleccionada
            insertAfter = selRow;
        } else {
            // Para mismo nivel: insertar después del bloque completo
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

        // Escribir columnas internas
        const r = insertAfter + 1;
        ls.setCellValue(r, COL['_level'], newLevel, { order: sheetOrder });
        ls.setCellValue(r, COL['_kind'],  kind,     { order: sheetOrder });

        // Limpiar columnas numéricas para grupos
        if (kind === 'group') {
            ['elsim','largo','ancho','alto','nveces','lon','area','vol','kg','und','total']
                .forEach((key) => ls.setCellValue(r, COL[key], '', { order: sheetOrder }));
        }
        // Asegurar descripción mínima al agregar
        if (kind === 'group') {
            ls.setCellValue(r, COL['descripcion'], DEFAULT_DESC_GROUP, { order: sheetOrder });
        } else {
            ls.setCellValue(r, COL['descripcion'], DEFAULT_DESC_LEAF, { order: sheetOrder });
        }

        setTimeout(() => recalcActiveSheet(), 120);
    }, [recalcActiveSheet]);
    //  Dropdown de unidades  retry hasta que Luckysheet esté listo
    useEffect(() => {
        let attempts = 0;
        const MAX_ATTEMPTS = 40; // 40  250ms = 10s máximo
        let timer: ReturnType<typeof setTimeout>;

        const applyVerification = () => {
            const ls = (window as any).luckysheet;
            const sheets = ls?.getAllSheets?.() ?? [];
            // Luckysheet no está listo si no hay hojas con datos
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
            const current = ls.getSheet().order;

            sheets.forEach((s: any) => {
                if (s.name === 'Resumen') return;

                ls.setDataVerification(opt, {
                    range,
                    order: s.order
                });
            });

            ls.setSheetActive(current);
        };

        timer = setTimeout(applyVerification, 400);
        return () => clearTimeout(timer);

    }, [initialSheets]);

    // ═══════════════════════════════════════════════════════════════════════
    // SINCRONIZAR RESUMEN
    // ═══════════════════════════════════════════════════════════════════════
    const handleSyncResumen = useCallback(() => {
        setIsSyncing(true);

        setTimeout(() => {
            const ls = (window as any).luckysheet;
            if (!ls) { setIsSyncing(false); return; }

            // ✅ FORZAR recálculo antes de leer datos
            recalcActiveSheet();

            const all: any[] = ls.getAllSheets();

            all.forEach((sheet: any) => {
                ls.setSheetActive(sheet.order);
                recalcActiveSheet();
            });

            const mods: Record<string, Record<string, any>[]> = {};
            let ext: Record<string, any>[] = [];
            let cis: Record<string, any>[] = [];
            let resIdx = -1;

            all.forEach((sheet: any, idx: number) => {
                if (sheet.name.startsWith('Módulo')) {
                    const m = sheet.name.match(/(\d+)/);
                    const n = m ? Number(m[1]) : NaN;
                    if (!isNaN(n)) {
                        mods[String(n)] = sheetToRows(sheet, BASE_COLS);
                    }
                } else if (sheet.name === 'Exterior') {
                    ext = sheetToRows(sheet, BASE_COLS);
                } else if (sheet.name === 'Cisterna') {
                    cis = sheetToRows(sheet, BASE_COLS);
                } else if (sheet.name === 'Resumen') {
                    resIdx = idx;
                }
            });

            if (resIdx === -1) {
                setIsSyncing(false);
                return;
            }

            const newRows = buildResumenRows(mods, ext, cis);

            const currentSheet = ls.getSheet().order;

            const resumenSheet = all[resIdx];

            ls.clearRange({
                range: {
                    row: [1, 2000],
                    column: [0, resumenCols.length],
                },
                order: resumenSheet.order
            });

            // ✅ LLENAR DATOS
            newRows.forEach((row, r) => {
                resumenCols.forEach((col, c) => {
                    const val = row[col.key as keyof typeof row] ?? '';
                    ls.setCellValue(r + 1, c, val, {
                        isRefresh: false
                    });
                });
            });

            // ✅ HEADERS
            resumenCols.forEach((col, c) => {
                ls.setCellValue(0, c, col.label, {
                    isRefresh: false
                });
            });

            ls.refresh();

            ls.setSheetActive(currentSheet);

            // ✅ AHORA sí guardar todo
            doSave(ls.getAllSheets());

            setIsSyncing(false);
        }, 300);
    }, [buildResumenRows, resumenCols, doSave, recalcActiveSheet]);

    // ── Config módulos ─────────────────────────────────────────────────────
    const handleUpdateConfig = async () => {
        if (newModuleCount === moduleCount) { setIsConfigOpen(false); return; }
        setIsUpdatingConfig(true);
        try {
            await router.patch(
                `${baseURL}/config`,
                { cantidad_modulos: newModuleCount },
                { onSuccess: () => setIsConfigOpen(false), preserveScroll: true },
            );
        } catch { setSaveError('Error al actualizar la configuración.'); }
        finally { setIsUpdatingConfig(false); }
    };

    const triggerRecalc = () => {
        setTimeout(() => {
            recalcActiveSheet();
        }, 0);
    };

    //export
    const handleExportExcel = () => {
        const ls = (window as any).luckysheet;
        if (!ls) return;

        const wb = XLSX.utils.book_new();
        const sheets = ls.getAllSheets();

        sheets.forEach((sheet: any) => {
            const name = sheet.name;

            let cols = BASE_COLS;
            if (name === "Resumen") cols = resumenCols;

            const rows = sheetToRows(sheet, cols);

            const clean = rows.map((r) => {
                const obj: any = {};
                cols.forEach(c => {
                    if (!c.key.startsWith("_")) {
                        let val = r[c.key];

                        if (typeof val === "number") {
                            val = Number(val.toFixed(4));
                        }

                        obj[c.key] = val ?? "";
                    }
                });
                return obj;
            });

            const ws = XLSX.utils.json_to_sheet(clean);
            XLSX.utils.book_append_sheet(wb, ws, name);
        });

        XLSX.writeFile(wb, `${titulo.toLowerCase().replace(/\s+/g, '_')}.xlsx`);
    };


    //import
    const importExcel = (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = (evt: any) => {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: "array" });

            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

            const parsed: ImportRow[] = json.map((row) => {
                const partida = String(row.partida || "").trim();
                const hasCode = partida !== "";

                return {
                    partida,
                    descripcion: row.descripcion || "",
                    unidad: row.unidad || "",

                    largo: Number(row.largo) || 0,
                    ancho: Number(row.ancho) || 0,
                    alto: Number(row.alto) || 0,
                    elsim: Number(row.elsim) || 0,
                    nveces: Number(row.nveces) || 0,

                    _level: hasCode ? partida.split(".").length : 1,
                    _kind: hasCode ? "group" : "leaf",
                };
            });

            const ls = (window as any).luckysheet;
            if (!ls) return;

            const sheets = ls.getAllSheets();
            const active = (window as any).luckysheet.getSheet();

            if (!active || active.name === "Resumen") {
                alert("Selecciona una hoja válida (Módulo, Exterior o Cisterna)");
                return;
            }

            const sheetOrder = ls.getSheet().order;

            ls.clearRange({
                row: [1, 2000],
                column: [0, BASE_COLS.length],
            });

            parsed.forEach((row, r) => {
                BASE_COLS.forEach((col, c) => {
                    let val = row[col.key];

                    if (val === undefined) val = "";

                    ls.setCellValue(r + 1, c, val, {
                        order: sheetOrder,
                        isRefresh: false,
                    });
                });
            });

            ls.refresh();

            setTimeout(() => {
                progUpdateCount.current = 0;
                recalcActiveSheet();
            }, 300);
        };

        reader.readAsArrayBuffer(file);
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
                            onClick={() => router.get(`/costos/${project?.id || 0}`)}
                            className="flex h-7 w-7 items-center justify-center rounded-full
                                text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700
                                dark:hover:bg-gray-800 dark:hover:text-gray-200">
                            <ChevronLeft className="h-4 w-4" />
                        </button>

                        <div className="leading-tight">
                            <p className="text-[13px] font-bold text-slate-900 dark:text-gray-100">
                                {titulo}
                            </p>
                            <p className="text-[9px] font-medium uppercase tracking-wider text-slate-400">
                                {project?.nombre || 'Proyecto'}
                            </p>
                        </div>

                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px]
                            font-bold text-blue-700 ring-1 ring-blue-200
                            dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800">
                            {moduleCount} {moduleCount === 1 ? 'módulo' : 'módulos'}
                        </span>

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
                            {/* Grupo raíz / mismo nivel */}
                            <ActionBtn
                                icon={<FolderPlus className="h-3 w-3" />}
                                label="GRUPO"
                                title="Insertar grupo al mismo nivel que la fila seleccionada"
                                style={{ background: GROUP_PALETTE[0].bg, color: '#fff' }}
                                onClick={() => addRow('group', true)}
                            />
                            {/* Sub-grupo (nivel + 1) */}
                            <ActionBtn
                                icon={<Folder className="h-3 w-3" />}
                                label="Sub-grupo"
                                title="Insertar grupo un nivel más profundo"
                                style={{ background: GROUP_PALETTE[2].bg, color: '#fff' }}
                                onClick={() => addRow('group', false)}
                            />
                            {/* Hoja de cálculo */}
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

                        <ActionBtn
                            label="Export Excel"
                            title="Exportar todo a Excel"
                            icon={<Save className="h-3 w-3" />}
                            style={{ background: '#16a34a', color: 'white' }}
                            onClick={handleExportExcel}
                        />

                        <ActionBtn
                            label="Import Excel"
                            title="Importar desde Excel"
                            icon={<ArrowUp className="h-3 w-3" />}
                            style={{ background: '#2563eb', color: 'white' }}
                            onClick={() => fileInputRef.current?.click()}
                        />
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            ref={fileInputRef}
                            onChange={importExcel}
                            className="hidden"
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

                        <Button variant="secondary" size="sm"
                            onClick={() => setIsConfigOpen(true)}
                            className="h-7 gap-1 text-[11px]">
                            <Settings2 className="h-3 w-3" />
                            Config
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
                            title:            titulo,
                            showinfobar:      false,
                            sheetFormulaBar:  true,
                            showstatisticBar: true,
                            cellUpdated: () => {

                                if (progUpdateCount.current > 0) return;

                                clearTimeout(recalcTimer.current);

                                recalcTimer.current = setTimeout(() => {
                                    progUpdateCount.current = 0;
                                    recalcActiveSheet();
                                }, 80);
                            },
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

                {/* ━━━━━━━━━━━━━━━━━━━━ MODAL CONFIG ━━━━━━━━━━━━━━━━━━━━ */}
                <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
                    <DialogContent className="sm:max-w-[420px]">
                        <DialogHeader>
                            <DialogTitle>Configuración de Módulos</DialogTitle>
                            <DialogDescription>
                                Ajusta la cantidad de módulos dinámicos para este proyecto.
                                <span className="mt-2 block font-semibold text-amber-600 dark:text-amber-400">
                                    ⚠️ Reducir módulos puede causar pérdida de datos.
                                </span>
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="mod-count" className="text-right">Cantidad</Label>
                                <Input id="mod-count" type="number" min={1} max={50}
                                    value={newModuleCount}
                                    onChange={(e) => setNewModuleCount(parseInt(e.target.value) || 1)}
                                    className="col-span-3" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setIsConfigOpen(false)}>Cancelar</Button>
                            <Button onClick={handleUpdateConfig} disabled={isUpdatingConfig} className="gap-2">
                                {isUpdatingConfig && <Loader2 className="h-4 w-4 animate-spin" />}
                                Guardar Cambios
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </div>
        </AppLayout>
    );
}

// SUBCOMPONENTES
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

/** Factory de ítems del menú contextual de Luckysheet */
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

