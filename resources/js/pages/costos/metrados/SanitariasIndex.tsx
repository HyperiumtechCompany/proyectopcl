// ═══════════════════════════════════════════════════════════════
// SanitariasIndex.tsx — Página principal
// ═══════════════════════════════════════════════════════════════
import { FileDown, Upload } from 'lucide-react';
import { exportarMetradoExcelMultiSheet } from './exportador/metradosExcelExport';
import { router, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    Calculator,
    CheckCircle2,
    ChevronLeft,
    Hash,
    Loader2,
    RefreshCcw,
    Save,
} from 'lucide-react';
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import Luckysheet from '@/components/costos/tablas/Luckysheet';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

// Módulo local Sanitarias
import { injectTemplateIfEmpty } from './lib/metrado_templates';
import { isLuckysheetReady, safeSetCellValue, safeSetDataVerification } from './lib/luckysheet_runtime';
import { CalcModal } from './metradosanitarias/sanitarias_CalcModal';
import {
    ALL_COLS,
    CI,
    LEAF_STYLE,
    LEVEL_PALETTE,
    RESUMEN_BASE_COLS,
    SAVE_DEBOUNCE,
    UNITS,
} from './metradosanitarias/sanitarias_constants';
import {
    NumberingModal,
    buildNumberingUpdates,
} from './metradosanitarias/sanitarias_NumberingModal';
import type {
    CalcPayload,
    SanitariasPageProps,
    RowKind,
} from './metradosanitarias/sanitarias_types';
import {
    buildRecalcUpdates,
    buildRowFormulaMeta,
    buildTotalUpdates,
    buildResumenRows,
    buildSanitariasResumenRows,
    colLetter,
    mkBlank,
    mkFormula,
    mkNum,
    mkTxt,
    r4,
    readRow,
    rowMeta,
    rowsToSheet,
    sheetToRows,
    styledNum,
    styledTxt,
    toNum,
    indent,
    levelStyle,
    toRoman,
} from './metradosanitarias/sanitarias_utils';


// ═══════════════════════════════════════════════════════════════
// COMPONENTES UI LOCALES
// ═══════════════════════════════════════════════════════════════

function Divider() {
    return <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />;
}

function HeaderBadge({
    children,
    style,
}: {
    children: React.ReactNode;
    style?: React.CSSProperties;
}) {
    return (
        <span
            className="rounded px-1.5 py-0.5 text-[9px] font-bold"
            style={style}
        >
            {children}
        </span>
    );
}

function SaveIndicator({
    saving,
    error,
    lastSaved,
}: {
    saving: boolean;
    error: string | null;
    lastSaved: Date | null;
}) {
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold dark:bg-slate-800">
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
                    {lastSaved.toLocaleTimeString('es-PE', {
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </span>
            ) : (
                <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
                    <Save className="h-2.5 w-2.5" /> Sin cambios
                </span>
            )}
        </span>
    );
}

// ═══════════════════════════════════════════════════════════════
// HOOK: useLuckysheet
// Encapsula toda la interacción con window.luckysheet
// ═══════════════════════════════════════════════════════════════
function useLuckysheet() {
    const ls = () => (window as any).luckysheet as any;

    const getActive = () => {
        const sheets = ls()?.getAllSheets?.() ?? [];
        return sheets.find((s: any) => s.status === 1) ?? sheets[0] ?? null;
    };

    const getAllSheets = (): any[] => ls()?.getAllSheets?.() ?? [];

    const setCells = (
        updates: Array<{ r: number; c: number; v: any }>,
        order: number,
    ) => {
        const inst = ls();
        if (!inst || !updates.length || !isLuckysheetReady()) return;
        updates.forEach((u, i) => {
            safeSetCellValue(u.r, u.c, u.v, {
                order,
                isRefresh: i === updates.length - 1,
            });
        });
    };

    return { ls, getActive, getAllSheets, setCells };
}

// ═══════════════════════════════════════════════════════════════
// HOOK: useAutoSave
// Modificado para guardar correctamente cada pestaña de Sanitarias
// ═══════════════════════════════════════════════════════════════
function useAutoSave(
    projectId: number,
    resumenCols: Array<{ key: string; label: string; width: number }>,
) {
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestSheets = useRef<any[]>([]);
    const dirtySheetNames = useRef<Set<string>>(new Set());

    const doSave = useCallback(
        async (sheets: any[], targetSheetNames?: string[]) => {
            setSaving(true);
            setSaveError(null);

            const csrf =
                document.querySelector<HTMLMetaElement>(
                    'meta[name="csrf-token"]',
                )?.content ?? '';
            const headers = {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrf,
                'X-Requested-With': 'XMLHttpRequest',
            };

            try {
                const targetNames = new Set(
                    targetSheetNames?.length
                        ? targetSheetNames
                        : dirtySheetNames.current.size
                            ? Array.from(dirtySheetNames.current)
                            : sheets.map((s) => String(s?.name ?? '')),
                );
                const sheetsToSave = sheets.filter((s) =>
                    targetNames.has(String(s?.name ?? '')),
                );

                if (!sheetsToSave.length) {
                    setSaving(false);
                    return;
                }

                const results = await Promise.all(
                    sheetsToSave.map((s) => {
                        let url = '';
                        const isRes = s.name === 'Resumen';
                        const isExt = s.name === 'Exterior';
                        const isCis = s.name === 'Cisterna';

                        if (isRes)
                            url = `/costos/${projectId}/metrado-sanitarias/resumen`;
                        else if (isExt)
                            url = `/costos/${projectId}/metrado-sanitarias/exterior`;
                        else if (isCis)
                            url = `/costos/${projectId}/metrado-sanitarias/cisterna`;
                        else {
                            // "Módulo X"
                            const match = s.name.match(/Módulo (\d+)/i);
                            if (match) {
                                const num = match[1];
                                url = `/costos/${projectId}/metrado-sanitarias/modulo/${num}`;
                            } else {
                                // si hay una pestaña desconocida, no la guardamos
                                return Promise.resolve({
                                    ok: true,
                                    status: 200,
                                    sheet: s,
                                    json: null,
                                    isRes: false,
                                });
                            }
                        }

                        return fetch(url, {
                            method: 'PATCH',
                            headers,
                            body: JSON.stringify({
                                rows: sheetToRows(
                                    s,
                                    isRes ? resumenCols : ALL_COLS,
                                ),
                            }),
                        }).then(async (r) => {
                            const json = await r.json().catch(() => null);
                            return {
                                ok: r.ok,
                                status: r.status,
                                sheet: s,
                                json,
                                isRes,
                            };
                        });
                    }),
                );

                const good = results.filter((r) => r.ok);
                const bad = results.find((r) => !r.ok);

                if (bad) {
                    setSaveError(`Error ${bad.status}`);
                } else {
                    setLastSaved(new Date());

                    // Inyectar IDs devueltos por la BD en Luckysheet para no duplicar filas
                    const inst = (window as any).luckysheet;
                    if (inst && typeof inst.getFile === 'function') {
                        good.forEach(({ sheet, json, isRes }) => {
                            if (json?.rows) {
                                const sheetIdx = inst.getSheetIndex(
                                    sheet.order,
                                );
                                if (
                                    sheetIdx !== null &&
                                    sheetIdx !== undefined
                                ) {
                                    const file = inst.getFile()[sheetIdx];
                                    const sheetData = file?.data;
                                    const dbIdColIdx = isRes ? 0 : CI['_dbid'];

                                    if (
                                        sheetData &&
                                        dbIdColIdx !== undefined &&
                                        dbIdColIdx >= 0
                                    ) {
                                        json.rows.forEach(
                                            (dbRow: any, i: number) => {
                                                const r = i + 1; // Fila 0 es cabecera
                                                if (sheetData[r]) {
                                                    if (
                                                        !sheetData[r][
                                                        dbIdColIdx
                                                        ]
                                                    ) {
                                                        sheetData[r][
                                                            dbIdColIdx
                                                        ] = {
                                                            v: dbRow.id,
                                                            m: String(dbRow.id),
                                                        };
                                                    } else {
                                                        sheetData[r][
                                                            dbIdColIdx
                                                        ].v = dbRow.id;
                                                        sheetData[r][
                                                            dbIdColIdx
                                                        ].m = String(dbRow.id);
                                                    }
                                                }
                                            },
                                        );
                                    }
                                }
                            }
                        });
                    }

                    targetNames.forEach((name) =>
                        dirtySheetNames.current.delete(name),
                    );
                }
            } catch (e: any) {
                setSaveError(e.message ?? 'Error de red');
            } finally {
                setSaving(false);
            }
        },
        [projectId, resumenCols],
    );

    const scheduleSave = useCallback(
        (sheets: any[], changedSheetNames?: string[]) => {
            latestSheets.current = sheets;
            (changedSheetNames ?? []).forEach((name) =>
                dirtySheetNames.current.add(name),
            );
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(
                () => doSave(latestSheets.current),
                SAVE_DEBOUNCE,
            );
        },
        [doSave],
    );

    const saveNow = useCallback(
        (targetSheetNames?: string[]) =>
            doSave(latestSheets.current, targetSheetNames),
        [doSave],
    );

    return {
        saving,
        lastSaved,
        saveError,
        scheduleSave,
        saveNow,
        latestSheets,
    };
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL (SanitariasIndex)
// ═══════════════════════════════════════════════════════════════
export default function SanitariasIndex() {
    const { project, config, modulos, exterior, cisterna, resumen } =
        usePage<SanitariasPageProps>().props;
    const moduleCount = Math.max(1, Number(config?.cantidad_modulos ?? 1));

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Costos', href: '/costos' },
        { title: project?.nombre || 'Proyecto', href: `/costos/${project?.id || 0}` },
        { title: 'Metrado Sanitarias', href: '#' },
    ];

    // ── Hooks ──────────────────────────────────────────────────
    const resumenCols = useMemo(
        () => [
            ...RESUMEN_BASE_COLS,
            ...Array.from({ length: moduleCount }, (_, idx) => ({
                key: `modulo_${idx + 1}`,
                label: `Módulo ${toRoman(idx + 1)}`,
                width: 110,
            })),
            { key: 'exterior', label: 'Exterior', width: 110 },
            { key: 'cisterna', label: 'Cisterna', width: 110 },
            { key: 'total', label: 'Total', width: 115 },
        ],
        [moduleCount],
    );

    const resumenRows = useMemo(() => {
        const generated = buildSanitariasResumenRows(
            modulos,
            exterior,
            cisterna,
            moduleCount,
            resumen ?? [],
        );
        return generated.length
            ? generated
            : resumen?.length
                ? resumen
                : buildResumenRows(modulos[1] || []);
    }, [modulos, exterior, cisterna, moduleCount, resumen]);

    const { ls, getActive, getAllSheets, setCells } = useLuckysheet();
    const {
        saving,
        lastSaved,
        saveError,
        scheduleSave,
        saveNow,
        latestSheets,
    } = useAutoSave(project?.id || 0, resumenCols);

    // ── UI State ───────────────────────────────────────────────
    const [syncing, setSyncing] = useState(false);
    const [calcOpen, setCalcOpen] = useState(false);
    const [numOpen, setNumOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
    const [calcRow, setCalcRow] = useState<{
        ri: number;
        rowData: Record<string, any>;
    }>({ ri: 0, rowData: {} });

    const progCount = useRef(0);
    const isProgrammaticChange = useRef(false);

    // ── Datos iniciales (N hojas dynamically generadas) ─────────
    const initialSheets = useMemo(() => {
        const sheets = [];
        let currentOrder = 0;

        // Modulos 1..N
        for (let i = 1; i <= moduleCount; i++) {
            const data = injectTemplateIfEmpty(modulos[i] || [], 'sanitarias');
            const sheet = rowsToSheet(
                data,
                ALL_COLS,
                `Módulo ${i}`,
                currentOrder++,
            );
            sheets.push(sheet);
        }

        // Exterior
        sheets.push(
            rowsToSheet(
                injectTemplateIfEmpty(exterior || [], 'sanitarias'),
                ALL_COLS,
                'Exterior',
                currentOrder++,
            ),
        );

        // Cisterna
        sheets.push(
            rowsToSheet(
                injectTemplateIfEmpty(cisterna || [], 'sanitarias'),
                ALL_COLS,
                'Cisterna',
                currentOrder++,
            ),
        );

        sheets.push(
            rowsToSheet(resumenRows, resumenCols, 'Resumen', currentOrder++),
        );

        return sheets;
    }, [moduleCount, modulos, exterior, cisterna, resumenRows, resumenCols]);

    // ═══════════════════════════════════════════════════════════
    // RECÁLCULO PRINCIPAL
    // ═══════════════════════════════════════════════════════════
    const recalc = useCallback(() => {
        if (progCount.current > 2) return;
        const inst = ls();
        if (!inst) return;

        const active = getActive();
        if (!active || active.name === 'Resumen') return;

        const updates = buildRecalcUpdates(active.data || []);
        if (!updates.length || updates.length > 12000) return;

        progCount.current++;
        setCells(updates, active.order ?? 0);

        setTimeout(() => {
            progCount.current = Math.max(0, progCount.current - 1);
            const all = getAllSheets();
            if (all.length)
                scheduleSave(
                    all,
                    active?.name ? [String(active.name)] : undefined,
                );
        }, 120);
    }, [ls, getActive, setCells, getAllSheets, scheduleSave]);

    // ═══════════════════════════════════════════════════════════
    // APLICAR RESULTADO DEL MODAL DE CÁLCULO
    // ═══════════════════════════════════════════════════════════════
    const applyCalc = useCallback(
        ({
            ri,
            descripcion,
            unidad,
            outputKey,
            inputs,
            outputs,
            formulaKey,
            formulaLabel,
            formulaExpression,
            formula,
        }: CalcPayload) => {
            const active = getActive();
            if (!active || active.name === 'Resumen') return;

            const sheetOrder = active.order ?? 0;
            const ups: Array<{ r: number; c: number; v: any }> = [];
            const currentRow = readRow(active.data || [], ri);
            const { level, kind } = rowMeta(currentRow);
            const rowStyle = kind === 'group' ? levelStyle(level) : LEAF_STYLE;
            const descripcionLimpia = descripcion.trim();
            const rowNum = ri + 1;

            if (CI.descripcion !== undefined) {
                ups.push({
                    r: ri,
                    c: CI.descripcion,
                    v: styledTxt(
                        descripcionLimpia,
                        indent(level, kind === 'leaf') + descripcionLimpia,
                        rowStyle,
                    ),
                });
            }

            if (CI.unidad !== undefined) {
                ups.push({ r: ri, c: CI.unidad, v: mkTxt(unidad) });
            }

            (
                [
                    ['_formula_key', formulaKey || ''],
                    ['_formula_output', outputKey || ''],
                    ['_formula_expr', formulaExpression || ''],
                    ['_formula_label', formulaLabel || formula || ''],
                ] as const
            ).forEach(([key, value]) => {
                const c = CI[key];
                if (c !== undefined) {
                    ups.push({
                        r: ri,
                        c,
                        v: value ? mkTxt(String(value)) : mkBlank(),
                    });
                }
            });

            (
                [
                    'elsim',
                    'largo',
                    'ancho',
                    'alto',
                    'nveces',
                    'kg',
                    'kgm',
                ] as const
            ).forEach((k) => {
                const c = CI[k];
                if (c !== undefined)
                    ups.push({ r: ri, c, v: mkNum(inputs[k]) });
            });

            (['lon', 'area', 'vol', 'kg', 'und'] as const).forEach((k) => {
                const c = CI[k];
                if (c === undefined) return;

                if (k === outputKey) {
                    const { formula: cellFormula } = buildRowFormulaMeta({
                        rowIndex: rowNum,
                        outputKey: k,
                        formulaKey,
                        formulaExpression,
                        formulaLabel: formulaLabel || formula,
                        value: r4(outputs[k] ?? 0),
                    });

                    ups.push({
                        r: ri,
                        c,
                        v: mkFormula(
                            cellFormula,
                            r4(outputs[k] ?? 0),
                        ),
                    });

                    return;
                }

                ups.push({ r: ri, c, v: mkBlank() });
            });

            if (CI.total !== undefined) {
                const totalValue = r4(outputs[outputKey] ?? 0);

                ups.push({
                    r: ri,
                    c: CI.total,
                    v: mkNum(totalValue, true),
                });
            }

            isProgrammaticChange.current = true;

            progCount.current++;
            ups.forEach(({ c, v }, i) => {
                safeSetCellValue(ri, c, v, {
                    order: sheetOrder,
                    isRefresh: i === ups.length - 1,
                });
            });

            setTimeout(() => {
                progCount.current = Math.max(0, progCount.current - 1);
                recalc();

                setTimeout(() => {
                    isProgrammaticChange.current = false;
                }, 50);
            }, 120);
        },
        [getActive, ls, recalc],
    );

    const openCalc = useCallback(() => {
        const inst = ls();
        const range = inst?.getRange?.();
        if (!range?.length) return;

        const active = getActive();
        if (!active || active.name === 'Resumen') return;

        const ri = range[0].row[0];
        setCalcRow({ ri, rowData: readRow(active.data || [], ri) });
        setCalcOpen(true);
    }, [ls, getActive]);

    const applyNumbering = useCallback(
        (base: number) => {
            const active = getActive();
            if (!active || active.name === 'Resumen') return;

            const updates = buildNumberingUpdates(
                active.data || [],
                active.order ?? 0,
                base,
            );
            if (!updates.length) return;

            progCount.current++;
            setCells(updates, active.order ?? 0);

            setTimeout(() => {
                progCount.current = Math.max(0, progCount.current - 1);
                recalc();
            }, 200);
        },
        [getActive, setCells, recalc],
    );

    // ═══════════════════════════════════════════════════════════
    // SINCRONIZAR RESUMEN (Consolida todas las pestañas)
    // ═══════════════════════════════════════════════════════════
    const syncResumen = useCallback(() => {
        setSyncing(true);
        setTimeout(() => {
            const inst = ls();
            if (!isLuckysheetReady()) {
                setSyncing(false);
                return;
            }
            if (!inst) {
                setSyncing(false);
                return;
            }

            const all = inst.getAllSheets() as any[];
            const mods: Record<number, Record<string, any>[]> = {};
            let ext: Record<string, any>[] = [];
            let cis: Record<string, any>[] = [];
            let resIdx = -1;

            all.forEach((sheet: any, idx: number) => {
                if (sheet.name === 'Resumen') {
                    resIdx = idx;
                } else {
                    const rows = sheetToRows(sheet, ALL_COLS);
                    if (sheet.name === 'Exterior') {
                        ext = rows;
                        return;
                    }
                    if (sheet.name === 'Cisterna') {
                        cis = rows;
                        return;
                    }

                    const match = String(sheet.name ?? '').match(
                        /Módulo (\d+)/i,
                    );
                    if (match) {
                        mods[Number(match[1])] = rows;
                    }
                }
            });

            if (resIdx === -1) {
                setSyncing(false);
                return;
            }

            const previousResumenRows =
                resIdx >= 0 ? sheetToRows(all[resIdx], resumenCols) : [];
            const newRows = buildSanitariasResumenRows(
                mods,
                ext,
                cis,
                moduleCount,
                previousResumenRows,
            );
            const prevOrder = inst.getSheet().order;

            inst.setSheetActive(resIdx);
            inst.clearRange({
                row: [0, 6000],
                column: [0, resumenCols.length + 1],
            });

            // Cabecera
            resumenCols.forEach((col, c) => {
                safeSetCellValue(
                    0,
                    c,
                    {
                        v: col.label,
                        m: col.label,
                        ct: { fa: 'General', t: 'g' },
                        bg: '#0f172a',
                        fc: '#94a3b8',
                        bl: 1,
                        fs: 10,
                    },
                    { isRefresh: false },
                );
            });

            // Filas
            newRows.forEach((row, ri) => {
                const level = toNum(row._level) || 1;
                const kind = String(row._kind ?? 'leaf') as RowKind;
                const st = kind === 'group' ? levelStyle(level) : LEAF_STYLE;

                resumenCols.forEach((col, c) => {
                    const raw = (row as any)[col.key] ?? '';
                    let cell: any;

                    if (
                        col.key === 'total' ||
                        col.key === 'exterior' ||
                        col.key === 'cisterna' ||
                        col.key.startsWith('modulo_')
                    ) {
                        cell = styledNum(toNum(raw), st);
                    } else if (col.key === 'partida') {
                        cell = styledTxt(String(raw), String(raw), st);
                    } else if (col.key === 'descripcion') {
                        const desc = String(raw).trim();
                        cell = styledTxt(
                            desc,
                            indent(level, kind === 'leaf') + desc,
                            st,
                        );
                    } else {
                        cell = {
                            ...mkTxt(String(raw)),
                            bg: st.bg,
                            fc: st.fc,
                            fs: 10,
                        };
                    }

                    safeSetCellValue(ri + 1, c, cell, { isRefresh: false });
                });
            });

            inst.refresh();
            inst.setSheetActive(prevOrder);
            const refreshedSheets = inst.getAllSheets() as any[];
            scheduleSave(refreshedSheets, ['Resumen']);
            saveNow(['Resumen']);
            setSyncing(false);
        }, 400);
    }, [ls, moduleCount, resumenCols, saveNow, scheduleSave]);

    
  const applyImport = useCallback((rows: ImportedMetradoRow[], targetSheet: string) => {
    const inst = ls();
    if (!inst || !isLuckysheetReady()) return;

    const all = inst.getAllSheets() as any[];
    const targetIdx = all.findIndex((s: any) => s.name === targetSheet);
    if (targetIdx < 0) throw new Error(`No se encontró la hoja "${targetSheet}"`);

    const targetSheetObj = all[targetIdx];

    inst.setSheetActive(targetIdx);

    const buffer = 50;
    const neededRows = rows.length + 1 + buffer;
    const curRows = targetSheetObj.data?.length || targetSheetObj.row || 100;

    if (curRows < neededRows) {
      inst.insertRow(curRows - 1, { number: neededRows - curRows });
    } else if (curRows > neededRows) {
      inst.deleteRow(neededRows, curRows - 1);
    }

    const flowDataArr = typeof inst.flowdata === 'function' ? inst.flowdata() : inst.flowdata;
    const data = flowDataArr || targetSheetObj.data;
    if (!data) return;

    ALL_COLS.forEach((col, c) => {
      data[0][c] = {
        v: col.label, m: col.label,
        ct: { fa: 'General', t: 'g' },
        bg: '#0f172a', fc: '#94a3b8', bl: 1, fs: 10,
      };
    });

    const FORMULA_META = new Set(['_formula_key', '_formula_output', '_formula_expr', '_formula_label']);

    rows.forEach((row, ri) => {
      const rIdx   = ri + 1;
      const kind   = (String(row._kind ?? 'leaf') === 'group' ? 'group' : 'leaf') as RowKind;
      const level  = Math.max(1, Math.min(10, toNum(row._level) || 1));
      const st     = kind === 'group' ? levelStyle(level) : LEAF_STYLE;

      if (!data[rIdx]) {
        data[rIdx] = Array(targetSheetObj.column || 26).fill(null);
      }

      ALL_COLS.forEach((col, c) => {
        const val = (row as any)[col.key];
        let cell: any;

        if (col.key === '_dbid') {
          cell = mkBlank();
        } else if (col.key === '_level') {
          cell = mkNum(level, true);
        } else if (col.key === '_kind') {
          cell = mkTxt(kind);
        } else if (FORMULA_META.has(col.key)) {
          const s = val ? String(val) : '';
          cell = s ? mkTxt(s) : mkBlank();
        }
        else if (col.key === 'descripcion') {
          const desc = String(val ?? '').trim();
          cell = styledTxt(desc, indent(level, kind === 'leaf') + desc, st);
        }
        else if (col.key === 'partida' || col.key === 'unidad') {
          cell = styledTxt(String(val ?? ''), String(val ?? ''), st);
        }
        else if (['elsim', 'largo', 'ancho', 'alto', 'nveces'].includes(col.key)) {
          cell = val !== undefined && val !== null && String(val).trim() !== ''
            ? styledNum(toNum(val), st)
            : { ...mkBlank(), bg: st.bg };
        }
        else if (['lon', 'area', 'vol', 'kg', 'parcial', 'total'].includes(col.key)) {
          const fExpr = (row as any)['_formula_expr'];
          const fOut  = (row as any)['_formula_output'];
          if (fOut === col.key && fExpr) {
            cell = mkFormula(fExpr, styledNum(toNum(val), st));
          } else {
            cell = val !== undefined && val !== null && String(val).trim() !== ''
              ? styledNum(toNum(val), st)
              : { ...mkBlank(), bg: st.bg };
          }
        }
        else {
          cell = { ...mkBlank(), bg: st.bg };
        }

        data[rIdx][c] = cell;
      });
    });

    inst.refresh();
    const active = getActive();
    scheduleSave(inst.getAllSheets(), active?.name ? [String(active.name)] : undefined);
    saveNow(active?.name ? [String(active.name)] : undefined);
  }, [ls, getActive, scheduleSave, saveNow]);


  const handleExportarExcel = useCallback(async () => {
        try {
            const inst = ls();
            if (!inst) {
                alert('No se pudo acceder a la tabla');
                return;
            }

            const allSheets = getAllSheets();
            if (!allSheets.length) {
                alert('No hay hojas para exportar');
                return;
            }

            const sheetsData: any[] = [];

            for (const sheet of allSheets) {
                const data = sheet.data || [];
                const items: any[] = [];

                for (let rowIdx = 1; rowIdx < data.length; rowIdx++) {
                    const row = data[rowIdx];
                    if (!row || row.length === 0) continue;

                    const descripcion = row[CI.descripcion]?.v || row[CI.descripcion] || '';
                    if (descripcion && descripcion.toString().trim() !== '') {
                        const item: any = {
                            item: row[CI.partida]?.v || row[CI.partida] || '',
                            descripcion: descripcion.toString(),
                            und: row[CI.unidad]?.v || row[CI.unidad] || '',
                            elsim: Number(row[CI.elsim]?.v || row[CI.elsim] || 0),
                            largo: Number(row[CI.largo]?.v || row[CI.largo] || 0),
                            ancho: Number(row[CI.ancho]?.v || row[CI.ancho] || 0),
                            alto: Number(row[CI.alto]?.v || row[CI.alto] || 0),
                            nveces: Number(row[CI.nveces]?.v || row[CI.nveces] || 1),
                            lon: Number(row[CI.lon]?.v || row[CI.lon] || 0),
                            area: Number(row[CI.area]?.v || row[CI.area] || 0),
                            vol: Number(row[CI.vol]?.v || row[CI.vol] || 0),
                            kg: Number(row[CI.kg]?.v || row[CI.kg] || 0),
                            parcial: Number(row[CI.parcial]?.v || row[CI.parcial] || 0),
                            total: Number(row[CI.total]?.v || row[CI.total] || 0),
                        };

                        if (sheet.name === 'Resumen') {
                            item.modulo1 = Number(row[4]?.v || row[4] || 0);
                            item.modulo2 = Number(row[5]?.v || row[5] || 0);
                            item.modulo3 = Number(row[6]?.v || row[6] || 0);
                            item.exterior = Number(row[7]?.v || row[7] || 0);
                            item.cisterna = Number(row[8]?.v || row[8] || 0);
                        }

                        items.push(item);
                    }
                }

                if (items.length > 0) {
                    sheetsData.push({
                        name: sheet.name,
                        items: items,
                        esResumen: sheet.name === 'Resumen',
                    });
                }
            }

            if (sheetsData.length === 0) {
                alert('No hay datos para exportar');
                return;
            }

            const proyectoExport = {
                nombre: project?.nombre || 'PROYECTO',
                codigo_cui: (project as any)?.codigo_cui || '',
                codigo_local: (project as any)?.codigo_local || '',
                codigos_modulares: (project as any)?.codigos_modulares || '',
                unidad_ejecutora: (project as any)?.unidad_ejecutora || '',
                propietario: (project as any)?.propietario || '',
                modulo: 'GENERAL',
                plantilla_logo_izq: (project as any)?.plantilla_logo_izq_url || '',
                plantilla_logo_der: (project as any)?.plantilla_logo_der_url || '',
            };

            await exportarMetradoExcelMultiSheet('sanitarias', sheetsData, proyectoExport);

        } catch (error: any) {
            console.error('Error en exportación:', error);
            alert(error.message || 'Error al exportar');
        }
    }, [ls, getAllSheets, project]);


    // ═══════════════════════════════════════════════════════════
    // EFECTOS
    // ════════════════════════

    useEffect(() => {
        let attempts = 0;
        let t: ReturnType<typeof setTimeout>;

        const apply = () => {
            const inst = ls();
            const sheets = inst?.getAllSheets?.() ?? [];
            if (
                !inst ||
                typeof inst.setDataVerification !== 'function' ||
                !sheets.length ||
                !isLuckysheetReady()
            ) {
                if (++attempts < 40) t = setTimeout(apply, 250);
                return;
            }
            const ci = CI['unidad'];
            const rng = `${colLetter(ci)}2:${colLetter(ci)}6000`; // Ampliado por precaución
            const opt = {
                type: 'dropdown',
                value1: UNITS.join(','),
                prohibitInput: false,
            };

            sheets
                .filter((s: any) => s.name !== 'Resumen')
                .forEach((s: any) =>
                    safeSetDataVerification(opt, {
                        range: rng,
                        order: s.order ?? 0,
                    }),
                );
        };

        t = setTimeout(apply, 400);
        return () => clearTimeout(t);
    }, []); // eslint-disable-line

    useEffect(() => {
        let attempts = 0;
        const run = () => {
            const inst = ls();
            if (!inst?.getAllSheets) {
                if (attempts++ < 20) setTimeout(run, 300);
                return;
            }
            recalc();
        };
        run();
    }, [recalc]);

    // ═══════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="flex h-[calc(100vh-65px)] w-full flex-col overflow-hidden bg-slate-50 dark:bg-gray-950">
                <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-white/90 px-4 py-2 shadow-sm backdrop-blur-md dark:border-gray-800/60 dark:bg-gray-900/90">
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => router.get(`/costos/${project.id}`)}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <div className="leading-tight">
                            <p className="text-[13px] font-bold text-slate-900 dark:text-gray-100">
                                Metrado Sanitarias
                            </p>
                            <p className="text-[9px] font-medium tracking-wider text-slate-400 uppercase">
                                {project.nombre}
                            </p>
                        </div>
                        <div className="hidden items-center gap-1 xl:flex">
                            {LEVEL_PALETTE.slice(0, 4).map((p, i) => (
                                <HeaderBadge
                                    key={i}
                                    style={{ background: p.bg, color: p.fc }}
                                >
                                    N{i + 1}
                                </HeaderBadge>
                            ))}
                            <HeaderBadge
                                style={{
                                    background: LEAF_STYLE.bg,
                                    color: LEAF_STYLE.fc,
                                    border: '1px solid #e2e8f0',
                                }}
                            >
                                Hoja
                            </HeaderBadge>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                        <SaveIndicator
                            saving={saving}
                            error={saveError}
                            lastSaved={lastSaved}
                        />
                        <Divider />

                        <button
                            type="button"
                            title="Abre la calculadora para la fila seleccionada (Ctrl+K)"
                            onClick={openCalc}
                            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-[10px] font-bold text-white transition-all hover:bg-blue-700 active:scale-95"
                        >
                            <Calculator className="h-3 w-3" /> Calcular
                        </button>

                        <button
                            type="button"
                            title="Numeración jerárquica automática"
                            onClick={() => setNumOpen(true)}
                            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-violet-600 px-3 text-[10px] font-bold text-white transition-all hover:bg-violet-700 active:scale-95"
                        >
                            <Hash className="h-3 w-3" /> Numerar
                        </button>

                        <button
                            type="button"
                            title="Exportar metrado a Excel"
                            onClick={handleExportarExcel}
                            className="inline-flex h-7 items-center gap-1.5 rounded-md
    bg-emerald-600 px-3 text-[10px] font-bold text-white
    transition-all hover:bg-emerald-700 active:scale-95"
                        >
                            <FileDown className="h-3 w-3" /> Exportar Excel
                        </button>

                        <Divider />

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => saveNow()}
                            disabled={saving}
                            className="h-7 gap-1.5 text-[11px]"
                        >
                            {saving ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <Save className="h-3 w-3" />
                            )}
                            {saving ? 'Guardando…' : 'Guardar'}
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={syncResumen}
                            disabled={syncing || saving}
                            className="h-7 gap-1.5 text-[11px]"
                        >
                            <RefreshCcw
                                className={cn(
                                    'h-3 w-3',
                                    syncing && 'animate-spin',
                                )}
                            />
                            {syncing ? 'Sincronizando…' : 'Sync Resumen'}
                        </Button>
                    </div>
                </header>

                <main className="relative flex-1 overflow-hidden">
                    <Luckysheet
                        data={initialSheets}
                        onDataChange={(sheets) => {
                            const active = getActive();
                            scheduleSave(
                                sheets,
                                active?.name
                                    ? [String(active.name)]
                                    : undefined,
                            );
                        }}
                        height="calc(100vh - 112px)"
                        options={{
                            title: 'Metrado Estructuras',
                            showinfobar: false,
                            sheetFormulaBar: true,
                            showstatisticBar: true,
                            afterChange: () => setTimeout(recalc, 80),
                            contextMenu: {
                                row: [
                                    {
                                        text: '🔢  Calculadora de metrado',
                                        type: 'button',
                                        onClick: openCalc,
                                    },
                                    {
                                        text: '#   Numeración jerárquica',
                                        type: 'button',
                                        onClick: () => setNumOpen(true),
                                    },
                                    { type: 'separator' },
                                    {
                                        text: 'Eliminar fila',
                                        type: 'button',
                                        onClick: () => {
                                            const inst = ls();
                                            const range = inst?.getRange?.();
                                            if (range?.length) {
                                                inst.deleteRow(
                                                    range[0].row[0],
                                                    1,
                                                );
                                                setTimeout(recalc, 80);
                                            }
                                        },
                                    },
                                ],
                            },
                        }}
                    />
                </main>
            </div>

            <CalcModal
                open={calcOpen}
                ri={calcRow.ri}
                rowData={calcRow.rowData}
                onClose={() => setCalcOpen(false)}
                onApply={applyCalc}
            />

            
      <ImportarMetradoSanitariasModal
        open={importOpen}
        moduleCount={moduleCount}
        activeSheetName={(() => {
          try { return (ls()?.getSheet?.() as any)?.name ?? 'Módulo 1'; } catch { return 'Módulo 1'; }
        })()}
        onClose={() => setImportOpen(false)}
        onImport={(rows, targetSheet) => {
          applyImport(rows, targetSheet);
        }}
      />

      <NumberingModal
                open={numOpen}
                onClose={() => setNumOpen(false)}
                onApply={applyNumbering}
            />
        </AppLayout>
    );
}
