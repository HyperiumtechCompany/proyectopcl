// ═══════════════════════════════════════════════════════════════
// EstructurasIndex.tsx — Página principal
// ═══════════════════════════════════════════════════════════════

import { router, usePage } from '@inertiajs/react';
import { AlertCircle, Calculator, CheckCircle2, ChevronLeft, Hash, Loader2, RefreshCcw, Save, Upload } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Luckysheet from '@/components/costos/tablas/Luckysheet';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

// Módulo local Estructuras
import { injectTemplateIfEmpty } from './lib/metrado_templates';
import { isLuckysheetReady, safeSetCellValue, safeSetDataVerification } from './lib/luckysheet_runtime';
import { CalcModal } from './metradoestructuras/estructuras_CalcModal';
import { ALL_COLS, CI, LEAF_STYLE, LEVEL_PALETTE, RESUMEN_BASE_COLS, SAVE_DEBOUNCE, UNITS } from './metradoestructuras/estructuras_constants';
import { NumberingModal, buildNumberingUpdates } from './metradoestructuras/estructuras_NumberingModal';
import type { CalcPayload, EstructurasPageProps, RowKind } from './metradoestructuras/estructuras_types';
import { buildRecalcUpdates, buildRowFormulaMeta, buildResumenRows, buildEstructurasResumenRows, colLetter, mkBlank, mkFormula, mkNum, mkTxt, r4, readRow, rowMeta, rowsToSheet, sheetToRows, styledNum, styledTxt, toNum, indent, levelStyle, toRoman, isZeroLike, } from './metradoestructuras/estructuras_utils';
import { ImportarMetradoEstructurasModal, type ImportedMetradoRow } from './metradoestructuras/ImportarMetradoEstructurasModal';

// ═══════════════════════════════════════════════════════════════
// COMPONENTES UI LOCALES
// ═══════════════════════════════════════════════════════════════

function Divider() {
  return <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />;
}

function HeaderBadge({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={style}>
      {children}
    </span>
  );
}

function SaveIndicator({ saving, error, lastSaved }: { saving: boolean; error: string | null; lastSaved: Date | null }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1
      text-[10px] font-semibold bg-slate-100 dark:bg-slate-800">
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
        <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
          <Save className="h-2.5 w-2.5" /> Sin cambios
        </span>
      )}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// HOOK: useLuckysheet
// ═══════════════════════════════════════════════════════════════
function useLuckysheet() {
  const ls = () => (window as any).luckysheet as any;

  const getActive = () => {
    const sheets = ls()?.getAllSheets?.() ?? [];
    return sheets.find((s: any) => s.status === 1) ?? sheets[0] ?? null;
  };

  const getAllSheets = (): any[] => ls()?.getAllSheets?.() ?? [];

  const setCells = (updates: Array<{ r: number; c: number; v: any }>, order: number) => {
    const inst = ls();
    if (!inst || !updates.length || !isLuckysheetReady()) return;

    const all = inst.getAllSheets() as any[];
    const sheetIdx = all.findIndex((s: any) => s.order === order);
    if (sheetIdx < 0) return;
    const sheetObj = all[sheetIdx];

    const flowDataArr = typeof inst.flowdata === 'function' ? inst.flowdata() : inst.flowdata;
    const data = (sheetObj.status === 1 && flowDataArr) ? flowDataArr : sheetObj.data;
    if (!data) return;

    updates.forEach((u) => {
      if (data[u.r]) {
        data[u.r][u.c] = u.v;
      }
    });

    inst.refresh();
  };

  return { ls, getActive, getAllSheets, setCells };
}

// ═══════════════════════════════════════════════════════════════
// HOOK: useAutoSave
// ═══════════════════════════════════════════════════════════════
function useAutoSave(projectId: number, resumenCols: Array<{ key: string; label: string; width: number }>) {
  const [saving,    setSaving]    = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const timer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSheets = useRef<any[]>([]);
  const dirtySheetNames = useRef<Set<string>>(new Set());

  const doSave = useCallback(async (sheets: any[], targetSheetNames?: string[]) => {
    setSaving(true);
    setSaveError(null);

    const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
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
            : sheets.map((s) => String(s?.name ?? ''))
      );
      const sheetsToSave = sheets.filter((s) => targetNames.has(String(s?.name ?? '')));

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

          if (isRes) url = `/costos/${projectId}/metrado-estructuras/resumen`;
          else if (isExt) url = `/costos/${projectId}/metrado-estructuras/exterior`;
          else if (isCis) url = `/costos/${projectId}/metrado-estructuras/cisterna`;
          else {
            const match = s.name.match(/Módulo (\d+)/i);
            if (match) {
              const num = match[1];
              url = `/costos/${projectId}/metrado-estructuras/modulo/${num}`;
            } else {
              return Promise.resolve({ ok: true, status: 200, sheet: s, json: null, isRes: false });
            }
          }

          return fetch(url, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              rows: sheetToRows(s, isRes ? resumenCols : ALL_COLS),
            }),
          }).then(async (r) => {
            const json = await r.json().catch(() => null);
            return { ok: r.ok, status: r.status, sheet: s, json, isRes };
          });
        })
      );

      const good = results.filter((r) => r.ok);
      const bad = results.find((r) => !r.ok);

      if (bad) {
        setSaveError(`Error ${bad.status}`);
      } else {
        setLastSaved(new Date());

        const inst = (window as any).luckysheet;
        if (inst && typeof inst.getFile === 'function') {
          good.forEach(({ sheet, json, isRes }) => {
            if (json?.rows) {
              const sheetIdx = inst.getSheetIndex(sheet.order);
              if (sheetIdx !== null && sheetIdx !== undefined) {
                const file = inst.getFile()[sheetIdx];
                const sheetData = file?.data;
                const dbIdColIdx = isRes ? 0 : CI['_dbid'];

                if (sheetData && dbIdColIdx !== undefined && dbIdColIdx >= 0) {
                  json.rows.forEach((dbRow: any, i: number) => {
                    const r = i + 1;
                    if (sheetData[r]) {
                      if (!sheetData[r][dbIdColIdx]) {
                        sheetData[r][dbIdColIdx] = { v: dbRow.id, m: String(dbRow.id) };
                      } else {
                        sheetData[r][dbIdColIdx].v = dbRow.id;
                        sheetData[r][dbIdColIdx].m = String(dbRow.id);
                      }
                    }
                  });
                }
              }
            }
          });
        }

        targetNames.forEach((name) => dirtySheetNames.current.delete(name));
      }
    } catch (e: any) {
      setSaveError(e.message ?? 'Error de red');
    } finally {
      setSaving(false);
    }
  }, [projectId, resumenCols]);

  const scheduleSave = useCallback((sheets: any[], changedSheetNames?: string[]) => {
    latestSheets.current = sheets;
    (changedSheetNames ?? []).forEach((name) => dirtySheetNames.current.add(name));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => doSave(latestSheets.current), SAVE_DEBOUNCE);
  }, [doSave]);

  const saveNow = useCallback((targetSheetNames?: string[]) => doSave(latestSheets.current, targetSheetNames), [doSave]);

  return { saving, lastSaved, saveError, scheduleSave, saveNow, latestSheets };
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL (EstructurasIndex)
// ═══════════════════════════════════════════════════════════════
export default function EstructurasIndex() {
  const { project, config, modulos, exterior, cisterna, resumen } = usePage<EstructurasPageProps>().props;
  const moduleCount = Math.max(1, Number(config?.cantidad_modulos ?? 1));

  const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Costos',               href: '/costos' },
    { title: project?.nombre || 'Proyecto',         href: `/costos/${project?.id || 0}` },
    { title: 'Metrado Estructuras',   href: '#' },
  ];

  const resumenCols = useMemo(() => ([
    ...RESUMEN_BASE_COLS,
    ...Array.from({ length: moduleCount }, (_, idx) => ({
      key: `modulo_${idx + 1}`,
      label: `Módulo ${toRoman(idx + 1)}`,
      width: 110,
    })),
    { key: 'exterior', label: 'Exterior', width: 110 },
    { key: 'cisterna', label: 'Cisterna', width: 110 },
    { key: 'total', label: 'Total', width: 115 },
  ]), [moduleCount]);

  const resumenRows = useMemo(() => {
    const generated = buildEstructurasResumenRows(modulos, exterior, cisterna, moduleCount, resumen ?? []);
    return generated.length ? generated : (resumen?.length ? resumen : buildResumenRows(modulos[1] || []));
  }, [modulos, exterior, cisterna, moduleCount, resumen]);

  const { ls, getActive, getAllSheets, setCells } = useLuckysheet();
  const { saving, lastSaved, saveError, scheduleSave, saveNow, latestSheets } = useAutoSave(project?.id || 0, resumenCols);

  const [syncing,     setSyncing]     = useState(false);
  const [calcOpen,    setCalcOpen]    = useState(false);
  const [numOpen,     setNumOpen]     = useState(false);
  const [importOpen,  setImportOpen]  = useState(false);
  const [calcRow,     setCalcRow]     = useState<{ ri: number; rowData: Record<string, any> }>({ ri: 0, rowData: {} });

  const progCount = useRef(0);
  const isProgrammaticChange = useRef(false);

  const initialSheets = useMemo(() => {
    const sheets = [];
    let currentOrder = 0;

    for (let i = 1; i <= moduleCount; i++) {
      const data = injectTemplateIfEmpty(modulos[i] || [], 'estructuras');
      const sheet = rowsToSheet(data, ALL_COLS, `Módulo ${i}`, currentOrder++);
      sheets.push(sheet);
    }

    sheets.push(rowsToSheet(injectTemplateIfEmpty(exterior || [], 'estructuras'), ALL_COLS, 'Exterior', currentOrder++));
    sheets.push(rowsToSheet(injectTemplateIfEmpty(cisterna || [], 'estructuras'), ALL_COLS, 'Cisterna', currentOrder++));
    sheets.push(rowsToSheet(resumenRows, resumenCols, 'Resumen', currentOrder++));

    return sheets;
  }, [moduleCount, modulos, exterior, cisterna, resumenRows, resumenCols]);

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
      if (all.length) scheduleSave(all, active?.name ? [String(active.name)] : undefined);
    }, 120);
  }, [ls, getActive, setCells, getAllSheets, scheduleSave]);

  const applyCalc = useCallback(({ ri, descripcion, unidad, outputKey, inputs, outputs, formulaKey, formulaLabel, formulaExpression, formula }: CalcPayload) => {
    const active = getActive();
    if (!active || active.name === 'Resumen') return;

    const sheetOrder = active.order ?? 0;
    const ups: Array<{ r: number; c: number; v: any }> = [];
    const currentRow = readRow(active.data || [], ri);
    const { level, kind } = rowMeta(currentRow);
    const rowStyle = kind === 'group' ? levelStyle(level) : LEAF_STYLE;
    const descripcionLimpia = descripcion.trim();

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

    ([
      ['_formula_key', formulaKey || ''],
      ['_formula_output', outputKey || ''],
      ['_formula_expr', formulaExpression || ''],
      ['_formula_label', formulaLabel || formula || ''],
    ] as const).forEach(([key, value]) => {
      const c = CI[key];
      if (c !== undefined) {
        ups.push({ r: ri, c, v: value ? mkTxt(String(value)) : mkBlank() });
      }
    });

    (['elsim', 'largo', 'ancho', 'alto', 'nveces', 'kg', 'kgm'] as const).forEach((k) => {
      const c = CI[k];
      if (c !== undefined) ups.push({ r: ri, c, v: mkNum(inputs[k]) });
    });

    (['lon', 'area', 'vol', 'kg', 'und'] as const).forEach((k) => {
      const c = CI[k];
      if (c === undefined) return;

      if (k === outputKey) {
        const { formula: cellFormula } = buildRowFormulaMeta({
          rowIndex: ri + 1,
          outputKey: k,
          formulaKey,
          formulaExpression,
          formulaLabel: formulaLabel || formula,
          value: r4(outputs[k] ?? 0),
        });
        ups.push({ r: ri, c, v: cellFormula ? mkFormula(cellFormula, r4(outputs[k] ?? 0)) : mkNum(r4(outputs[k] ?? 0), true) });
        return;
      }

      ups.push({ r: ri, c, v: mkBlank() });
    });

    if (CI.total !== undefined) {
      ups.push({ r: ri, c: CI.total, v: mkNum(r4(outputs[outputKey] ?? 0), true) });
    }

    isProgrammaticChange.current = true;

    progCount.current++;
    ups.forEach(({ r, c, v }, i) => {
      safeSetCellValue(r, c, v, {
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
  }, [getActive, ls, recalc]);

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

  const applyNumbering = useCallback((base: number) => {
    const active = getActive();
    if (!active || active.name === 'Resumen') return;

    const updates = buildNumberingUpdates(active.data || [], active.order ?? 0, base);
    if (!updates.length) return;

    progCount.current++;
    setCells(updates, active.order ?? 0);

    setTimeout(() => {
      progCount.current = Math.max(0, progCount.current - 1);
      recalc();
    }, 200);
  }, [getActive, setCells, recalc]);

  // ═══════════════════════════════════════════════════════════════
  // FUNCIÓN: applyImport — aplica filas importadas del Excel a la hoja destino
  // ═══════════════════════════════════════════════════════════════
  const applyImport = useCallback((rows: ImportedMetradoRow[], targetSheet: string) => {
    const inst = ls();
    if (!inst || !isLuckysheetReady()) return;

    const all = inst.getAllSheets() as any[];
    const targetIdx = all.findIndex((s: any) => s.name === targetSheet);
    if (targetIdx < 0) throw new Error(`No se encontró la hoja "${targetSheet}"`);

    const targetSheetObj = all[targetIdx];

    // Cambiar a la hoja destino
    inst.setSheetActive(targetIdx);

    // Ajustar el número de filas de la hoja destino para albergar la importación
    const buffer = 50;
    const neededRows = rows.length + 1 + buffer; // cabecera + filas + buffer
    const curRows = targetSheetObj.data?.length || targetSheetObj.row || 100;

    if (curRows < neededRows) {
      inst.insertRow(curRows - 1, { number: neededRows - curRows });
    } else if (curRows > neededRows) {
      inst.deleteRow(neededRows, curRows - 1);
    }

    const flowDataArr = typeof inst.flowdata === 'function' ? inst.flowdata() : inst.flowdata;
    const data = flowDataArr || targetSheetObj.data;
    if (!data) return;

    // ── Escribir fila de cabecera ──────────────────────────────
    ALL_COLS.forEach((col, c) => {
      data[0][c] = {
        v: col.label, m: col.label,
        ct: { fa: 'General', t: 'g' },
        bg: '#0f172a', fc: '#94a3b8', bl: 1, fs: 10,
      };
    });

    // ── Escribir filas de datos ────────────────────────────────
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

        // Columnas de metadatos ocultas
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
        // Descripción — con sangría y estilo de nivel
        else if (col.key === 'descripcion') {
          const desc = String(val ?? '').trimStart();
          if (desc) {
            cell = styledTxt(desc, indent(level, kind === 'leaf') + desc, st);
          } else {
            cell = { ...mkBlank(), bg: st.bg, fc: st.fc, bl: st.bl, fs: 10 };
          }
        }
        // Partida — con estilo de nivel
        else if (col.key === 'partida') {
          const p = String(val ?? '').trim();
          cell = p ? styledTxt(p, p, st) : mkBlank();
        }
        // Unidad — texto con color de nivel
        else if (col.key === 'unidad') {
          const u = String(val ?? '').trim();
          cell = u
            ? { ...mkTxt(u), bg: st.bg, fc: st.fc, fs: 10 }
            : { ...mkBlank(), bg: st.bg, fc: st.fc, fs: 10 };
        }
        // Observación — texto plano
        else if (col.key === 'observacion') {
          const o = String(val ?? '').trim();
          cell = o ? mkTxt(o) : mkBlank();
        }
        // Columnas numéricas
        else {
          const n = toNum(val);
          cell = isZeroLike(n)
            ? { ...mkBlank(), bg: st.bg, fc: st.fc, fs: 10 }
            : styledNum(n, st, false);
        }

        data[rIdx][c] = cell;
      });
    });

    // Limpiar celdas en las filas sobrantes del buffer
    for (let r = rows.length + 1; r < data.length; r++) {
      if (data[r]) {
        for (let c = 0; c < data[r].length; c++) {
          data[r][c] = null;
        }
      }
    }

    // Refrescar y guardar
    inst.refresh();

    setTimeout(() => {
      progCount.current = 0;
      recalc();
      const refreshed = inst.getAllSheets() as any[];
      scheduleSave(refreshed, [targetSheet]);
      saveNow([targetSheet]);
    }, 300);
  }, [ls, scheduleSave, saveNow, recalc]);

  const syncResumen = useCallback(() => {
    setSyncing(true);
    setTimeout(() => {
      const inst = ls();
      if (!isLuckysheetReady()) { setSyncing(false); return; }
      if (!inst) { setSyncing(false); return; }

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

          const match = String(sheet.name ?? '').match(/Módulo (\d+)/i);
          if (match) {
            mods[Number(match[1])] = rows;
          }
        }
      });

      if (resIdx === -1) { setSyncing(false); return; }

      const previousResumenRows = resIdx >= 0 ? sheetToRows(all[resIdx], resumenCols) : [];
      const newRows = buildEstructurasResumenRows(mods, ext, cis, moduleCount, previousResumenRows);
      const prevOrder = inst.getSheet().order;

      inst.setSheetActive(resIdx);

      const resumenSheetObj = all[resIdx];
      const neededResRows = newRows.length + 1;
      const curResRows = resumenSheetObj.data?.length || resumenSheetObj.row || 100;

      if (curResRows < neededResRows) {
        inst.insertRow(curResRows - 1, { number: neededResRows - curResRows });
      } else if (curResRows > neededResRows) {
        inst.deleteRow(neededResRows, curResRows - 1);
      }

      const resFlowDataArr = typeof inst.flowdata === 'function' ? inst.flowdata() : inst.flowdata;
      const resData = resFlowDataArr || resumenSheetObj.data;

      if (resData) {
        // Escribir cabecera
        resumenCols.forEach((col, c) => {
          resData[0][c] = {
            v: col.label, m: col.label,
            ct: { fa: 'General', t: 'g' },
            bg: '#0f172a', fc: '#94a3b8', bl: 1, fs: 10,
          };
        });

        // Escribir datos
        newRows.forEach((row, ri) => {
          const level = toNum(row._level) || 1;
          const kind  = String(row._kind ?? 'leaf') as RowKind;
          const st    = kind === 'group' ? levelStyle(level) : LEAF_STYLE;

          if (!resData[ri + 1]) {
            resData[ri + 1] = Array(resumenCols.length + 1).fill(null);
          }

          resumenCols.forEach((col, c) => {
            const raw = (row as any)[col.key] ?? '';
            let cell: any;

            if (col.key === 'total' || col.key === 'exterior' || col.key === 'cisterna' || col.key.startsWith('modulo_')) {
              cell = styledNum(toNum(raw), st);
            } else if (col.key === 'partida') {
              cell = styledTxt(String(raw), String(raw), st);
            } else if (col.key === 'descripcion') {
              const desc = String(raw).trim();
              cell = styledTxt(desc, indent(level, kind === 'leaf') + desc, st);
            } else {
              cell = { ...mkTxt(String(raw)), bg: st.bg, fc: st.fc, fs: 10 };
            }

            resData[ri + 1][c] = cell;
          });
        });

        // Limpiar filas sobrantes
        for (let r = newRows.length + 1; r < resData.length; r++) {
          if (resData[r]) {
            for (let c = 0; c < resData[r].length; c++) {
              resData[r][c] = null;
            }
          }
        }
      }

      inst.refresh();
      inst.setSheetActive(prevOrder);
      const refreshedSheets = inst.getAllSheets() as any[];
      scheduleSave(refreshedSheets, ['Resumen']);
      saveNow(['Resumen']);
      setSyncing(false);
    }, 400);
  }, [ls, moduleCount, resumenCols, saveNow, scheduleSave]);

  useEffect(() => {
    let attempts = 0;
    let t: ReturnType<typeof setTimeout>;

    const apply = () => {
      const inst = ls();
      const sheets = inst?.getAllSheets?.() ?? [];
      if (!inst || typeof inst.setDataVerification !== 'function' || !sheets.length || !isLuckysheetReady()) {
        if (++attempts < 40) t = setTimeout(apply, 250);
        return;
      }
      const ci  = CI['unidad'];
      const rng = `${colLetter(ci)}2:${colLetter(ci)}6000`;
      const opt = { type: 'dropdown', value1: UNITS.join(','), prohibitInput: false };

      sheets
        .filter((s: any) => s.name !== 'Resumen')
        .forEach((s: any) => safeSetDataVerification(opt, { range: rng, order: s.order ?? 0 }));
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

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="flex h-[calc(100vh-65px)] w-full flex-col overflow-hidden bg-slate-50 dark:bg-gray-950">

        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between
          gap-2 border-b border-slate-200/80 bg-white/90 px-4 py-2 shadow-sm backdrop-blur-md
          dark:border-gray-800/60 dark:bg-gray-900/90">

          <div className="flex items-center gap-2.5">
            <button type="button" onClick={() => router.get(`/costos/${project?.id || 0}`)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400
                transition-colors hover:bg-slate-100 hover:text-slate-700
                dark:hover:bg-gray-800 dark:hover:text-gray-200">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="leading-tight">
              <p className="text-[13px] font-bold text-slate-900 dark:text-gray-100">
                Metrado Estructuras
              </p>
              <p className="text-[9px] font-medium uppercase tracking-wider text-slate-400">
                {project?.nombre || 'Proyecto'}
              </p>
            </div>
            <div className="hidden items-center gap-1 xl:flex">
              {LEVEL_PALETTE.slice(0, 4).map((p, i) => (
                <HeaderBadge key={i} style={{ background: p.bg, color: p.fc }}>
                  N{i + 1}
                </HeaderBadge>
              ))}
              <HeaderBadge style={{ background: LEAF_STYLE.bg, color: LEAF_STYLE.fc, border: '1px solid #e2e8f0' }}>
                Hoja
              </HeaderBadge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <SaveIndicator saving={saving} error={saveError} lastSaved={lastSaved} />
            <Divider />

            <button type="button" title="Abre la calculadora para la fila seleccionada (Ctrl+K)" onClick={openCalc}
              className="inline-flex h-7 items-center gap-1.5 rounded-md
                bg-blue-600 px-3 text-[10px] font-bold text-white
                transition-all hover:bg-blue-700 active:scale-95">
              <Calculator className="h-3 w-3" /> Calcular
            </button>

            <button type="button" title="Numeración jerárquica automática" onClick={() => setNumOpen(true)}
              className="inline-flex h-7 items-center gap-1.5 rounded-md
                bg-violet-600 px-3 text-[10px] font-bold text-white
                transition-all hover:bg-violet-700 active:scale-95">
              <Hash className="h-3 w-3" /> Numerar
            </button>

            <button
              type="button"
              title="Importar metrado desde un archivo Excel (.xlsx)"
              onClick={() => setImportOpen(true)}
              className="inline-flex h-7 items-center gap-1.5 rounded-md
                bg-green-600 px-3 text-[10px] font-bold text-white
                transition-all hover:bg-green-700 active:scale-95"
            >
              <Upload className="h-3 w-3" /> Importar
            </button>

            <Divider />

            <Button variant="outline" size="sm" onClick={() => saveNow()} disabled={saving} className="h-7 gap-1.5 text-[11px]">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>

            <Button variant="outline" size="sm" onClick={syncResumen} disabled={syncing || saving} className="h-7 gap-1.5 text-[11px]">
              <RefreshCcw className={cn('h-3 w-3', syncing && 'animate-spin')} />
              {syncing ? 'Sincronizando…' : 'Sync Resumen'}
            </Button>
          </div>
        </header>

        <main className="relative flex-1 overflow-hidden">
          <Luckysheet
            data={initialSheets}
            onDataChange={(sheets) => {
              const active = getActive();
              scheduleSave(sheets, active?.name ? [String(active.name)] : undefined);
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
                  { text: '🔢  Calculadora de metrado', type: 'button', onClick: openCalc },
                  { text: '#   Numeración jerárquica', type: 'button', onClick: () => setNumOpen(true) },
                  { type: 'separator' },
                  {
                    text: 'Eliminar fila',
                    type: 'button',
                    onClick: () => {
                      const inst = ls();
                      const range = inst?.getRange?.();
                      if (range?.length) {
                        inst.deleteRow(range[0].row[0], 1);
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

      <CalcModal open={calcOpen} ri={calcRow.ri} rowData={calcRow.rowData} onClose={() => setCalcOpen(false)} onApply={applyCalc}/>

      <NumberingModal open={numOpen} onClose={() => setNumOpen(false)} onApply={applyNumbering}/>

      <ImportarMetradoEstructurasModal
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
    </AppLayout>
  );
}
