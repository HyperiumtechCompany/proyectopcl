// ═══════════════════════════════════════════════════════════════
// comunicacionesIndex.tsx — Página principal refactorizada
//
// Estructura de archivos:
//   comunicaciones/
//     types.ts          → interfaces TypeScript
//     constants.ts      → columnas, perfiles de unidad, paleta
//     utils.ts          → helpers puros + buildRecalcUpdates
//     CalcModal.tsx     → modal calculadora (campos por unidad)
//     NumberingModal.tsx → modal numeración + buildNumberingUpdates
//     comunicacionesIndex.tsx ← ESTE ARCHIVO
// ═══════════════════════════════════════════════════════════════

import { router, usePage } from '@inertiajs/react';
import {
  AlertCircle, Calculator, CheckCircle2,
  ChevronLeft, Hash, Loader2, RefreshCcw, Save,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Luckysheet from '@/components/costos/tablas/Luckysheet';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

// Módulo local
import { injectTemplateIfEmpty } from './lib/metrado_templates';
import { CalcModal }     from './metradocomunicaciones/comunicaciones_CalcModal';
import {ALL_COLS, CI, LEAF_STYLE, LEVEL_PALETTE, RESUMEN_COLS,SAVE_DEBOUNCE, UNITS} from './metradocomunicaciones/comunicaciones_constants';
import { NumberingModal, buildNumberingUpdates } from './metradocomunicaciones/comunicaciones_NumberingModal';
import type { CalcPayload, ComunicacionesPageProps, RowKind } from './metradocomunicaciones/comunicaciones_types';
import {
  buildRecalcUpdates, buildResumenRows, colLetter, mkBlank,
  mkNum, mkTxt, r4, readRow, rowMeta, rowsToSheet,
  sheetToRows, styledNum, styledTxt, toNum, trim0, indent,
  levelStyle,
} from './metradocomunicaciones/comunicaciones_utils';

// ═══════════════════════════════════════════════════════════════
// COMPONENTES UI LOCALES
// ═══════════════════════════════════════════════════════════════

function Divider() {
  return <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />;
}

function HeaderBadge({ children, style }: {
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

function SaveIndicator({ saving, error, lastSaved }: {
  saving: boolean; error: string | null; lastSaved: Date | null;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1
      text-[10px] font-semibold
      bg-slate-100 dark:bg-slate-800">
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
// Encapsula toda la interacción con window.luckysheet
// ═══════════════════════════════════════════════════════════════

function useLuckysheet() {
  const ls = () => (window as any).luckysheet as any;

  const getActive = () => {
    const sheets = ls()?.getAllSheets?.() ?? [];
    return sheets.find((s: any) => s.status === 1) ?? sheets[0] ?? null;
  };

  const getAllSheets = (): any[] =>
    ls()?.getAllSheets?.() ?? [];

  const setCells = (
    updates: Array<{ r: number; c: number; v: any }>,
    order:   number,
  ) => {
    const inst = ls();
    if (!inst || !updates.length) return;
    updates.forEach((u, i) => {
      inst.setCellValue(u.r, u.c, u.v, {
        order,
        isRefresh: i === updates.length - 1,
      });
    });
  };

  return { ls, getActive, getAllSheets, setCells };
}

// ═══════════════════════════════════════════════════════════════
// HOOK: useAutoSave
// ═══════════════════════════════════════════════════════════════

function useAutoSave(projectId: number) {
  const [saving,    setSaving]    = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const timer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSheets = useRef<any[]>([]);

  const doSave = useCallback(async (sheets: any[]) => {
    setSaving(true);
    setSaveError(null);

    const csrf    = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
    const headers = {
      'Content-Type':     'application/json',
      'X-CSRF-TOKEN':     csrf,
      'X-Requested-With': 'XMLHttpRequest',
    };

    try {
      const results = await Promise.all(
        sheets
          .filter((s) => s?.name === 'Metrado' || s?.name === 'Resumen')
          .map((s) => {
            const isMet = s.name === 'Metrado';
            return fetch(
              `/costos/${projectId}/metrado-comunicaciones/${isMet ? 'metrado' : 'resumen'}`,
              {
                method:  'PATCH',
                headers,
                body:    JSON.stringify({
                  rows: sheetToRows(s, isMet ? ALL_COLS : RESUMEN_COLS),
                }),
              },
            ).then(async (r) => {
              const json = await r.json().catch(() => null);
              return { ok: r.ok, status: r.status, sheet: s, json, isRes: !isMet };
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
              const sheetIdx = inst.getSheetIndex(sheet.order);
              if (sheetIdx !== null && sheetIdx !== undefined) {
                const file = inst.getFile()[sheetIdx];
                const sheetData = file?.data;
                const dbIdColIdx = isRes ? 0 : CI['_dbid'];
                
                if (sheetData && dbIdColIdx !== undefined && dbIdColIdx >= 0) {
                  json.rows.forEach((dbRow: any, i: number) => {
                    const r = i + 1; // Fila 0 es cabecera
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
      }
    } catch (e: any) {
      setSaveError(e.message ?? 'Error de red');
    } finally {
      setSaving(false);
    }
  }, [projectId]);

  const scheduleSave = useCallback((sheets: any[]) => {
    latestSheets.current = sheets;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => doSave(latestSheets.current), SAVE_DEBOUNCE);
  }, [doSave]);

  const saveNow = useCallback(() => doSave(latestSheets.current), [doSave]);

  return { saving, lastSaved, saveError, scheduleSave, saveNow, latestSheets };
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════

export default function comunicacionesIndex() {
  const { project, metrado, resumen } = usePage<ComunicacionesPageProps>().props;

  const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Costos',             href: '/costos' },
    { title: project.nombre,       href: `/costos/${project.id}` },
    { title: 'Metrado Comunicaciones', href: '#' },
  ];

  // ── Hooks ──────────────────────────────────────────────────
  const { ls, getActive, getAllSheets, setCells } = useLuckysheet();
  const { saving, lastSaved, saveError, scheduleSave, saveNow, latestSheets } =
    useAutoSave(project.id);

  // ── UI State ───────────────────────────────────────────────
  const [syncing,  setSyncing]  = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [numOpen,  setNumOpen]  = useState(false);
  const [calcRow,  setCalcRow]  = useState<{ ri: number; rowData: Record<string, any> }>({
    ri: 0, rowData: {},
  });

  // ── Guard de recálculo (evita bucles) ──────────────────────
  const progCount = useRef(0);

  // ── Datos iniciales ────────────────────────────────────────
  const resumenRows = useMemo(() =>
    buildResumenRows(metrado?.length ? metrado : (resumen ?? [])),
  []);// eslint-disable-line

  const initialSheets = useMemo(() => [
    rowsToSheet(injectTemplateIfEmpty(metrado ?? [], 'comunicaciones'), ALL_COLS,     'Metrado', 0),
    rowsToSheet(resumenRows,   RESUMEN_COLS, 'Resumen', 1),
  ], []);// eslint-disable-line

  // ═══════════════════════════════════════════════════════════
  // RECÁLCULO PRINCIPAL
  // Llama a buildRecalcUpdates (utils.ts) y aplica en Luckysheet
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
      if (all.length) scheduleSave(all);
    }, 120);
  }, [ls, getActive, setCells, getAllSheets, scheduleSave]);

  // ═══════════════════════════════════════════════════════════
  // APLICAR RESULTADO DEL MODAL DE CÁLCULO
  // Escribe inputs + output en la fila y re-recalcula
  // ═══════════════════════════════════════════════════════════

  const applyCalc = useCallback(({ ri, descripcion, unidad, inputs, outputs, outputKey }: CalcPayload) => {
    const active = getActive();
    if (!active || active.name === 'Resumen') return;

    const sheetOrder = active.order ?? 0;
    const ups: Array<{ r: number; c: number; v: any }> = [];

  if (descripcion && CI.descripcion !== undefined) {
        ups.push({
          r: ri,
          c: CI.descripcion,
          v: mkTxt(descripcion.trim())
        });
      }  
  
      if (CI.unidad !== undefined) {
        ups.push({ r: ri, c: CI.unidad, v: mkTxt(unidad) });
      }

    // Inputs
    (['elsim', 'largo', 'ancho', 'alto', 'nveces', 'kg'] as const).forEach((k) => {
      const c = CI[k];
      if (c !== undefined) ups.push({ r: ri, c, v: mkNum(inputs[k]) });
    });

    // Outputs (solo los que tienen valor)
    (['lon', 'area', 'vol', 'kg', 'und'] as const).forEach((k) => {
      const c = CI[k];
      if (c === undefined) return;

      if (k === outputKey) {
        ups.push({ r: ri, c, v: mkNum(r4(outputs[k] ?? 0)) });
        return;
      }

      ups.push({ r: ri, c, v: mkBlank() });
    });

    progCount.current++;
    ups.forEach(({ r, c, v }, i) => {
      ls()?.setCellValue(r, c, v, {
        order:     sheetOrder,
        isRefresh: i === ups.length - 1,
      });
    });

    setTimeout(() => {
      progCount.current = Math.max(0, progCount.current - 1);
      recalc();
    }, 120);
  }, [getActive, ls, recalc]);

  // ═══════════════════════════════════════════════════════════
  // ABRIR CALCULADORA (lee fila seleccionada en Luckysheet)
  // ═══════════════════════════════════════════════════════════

  const openCalc = useCallback(() => {
    const inst   = ls();
    const range  = inst?.getRange?.();
    if (!range?.length) return;

    const active = getActive();
    if (!active || active.name === 'Resumen') return;

    const ri = range[0].row[0];
    setCalcRow({ ri, rowData: readRow(active.data || [], ri) });
    setCalcOpen(true);
  }, [ls, getActive]);

  // ═══════════════════════════════════════════════════════════
  // NUMERACIÓN JERÁRQUICA
  // Usa buildNumberingUpdates de NumberingModal.tsx
  // ═══════════════════════════════════════════════════════════

  const applyNumbering = useCallback((base: number) => {
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
  }, [getActive, setCells, recalc]);

  // ═══════════════════════════════════════════════════════════
  // SINCRONIZAR RESUMEN
  // Copia filas con ítem desde Metrado hacia la hoja Resumen
  // ═══════════════════════════════════════════════════════════

  const syncResumen = useCallback(() => {
    setSyncing(true);
    setTimeout(() => {
      const inst = ls();
      if (!inst) { setSyncing(false); return; }

      const all        = inst.getAllSheets() as any[];
      let metradoRows: Record<string, any>[] = [];
      let resIdx       = -1;

      all.forEach((sheet: any, idx: number) => {
        if (sheet.name === 'Metrado') metradoRows = sheetToRows(sheet, ALL_COLS);
        if (sheet.name === 'Resumen') resIdx      = idx;
      });

      if (resIdx === -1) { setSyncing(false); return; }

      const newRows   = buildResumenRows(metradoRows);
      const prevOrder = inst.getSheet().order;

      inst.setSheetActive(resIdx);
      inst.clearRange({ row: [0, 600], column: [0, RESUMEN_COLS.length + 1] });

      // Cabecera
      RESUMEN_COLS.forEach((col, c) => {
        inst.setCellValue(0, c, {
          v: col.label, m: col.label,
          ct: { fa: 'General', t: 'g' },
          bg: '#0f172a', fc: '#94a3b8', bl: 1, fs: 10,
        }, { isRefresh: false });
      });

      // Filas
      newRows.forEach((row, ri) => {
        const level = toNum(row._level) || 1;
        const kind  = String(row._kind ?? 'leaf') as RowKind;
        const st    = kind === 'group' ? levelStyle(level) : LEAF_STYLE;

        RESUMEN_COLS.forEach((col, c) => {
          const raw = (row as any)[col.key] ?? '';
          let cell: any;

          if (col.key === 'total') {
            cell = styledNum(toNum(raw), st);
          } else if (col.key === 'partida') {
            cell = styledTxt(String(raw), String(raw), st);
          } else if (col.key === 'descripcion') {
            const desc = String(raw).trim();
            cell = styledTxt(desc, indent(level, kind === 'leaf') + desc, st);
          } else {
            cell = { ...mkTxt(String(raw)), bg: st.bg, fc: st.fc, fs: 10 };
          }

          inst.setCellValue(ri + 1, c, cell, { isRefresh: false });
        });
      });

      inst.refresh();
      inst.setSheetActive(prevOrder);
      saveNow();
      setSyncing(false);
    }, 400);
  }, [ls, saveNow]);

  // ═══════════════════════════════════════════════════════════
  // EFECTOS
  // ═══════════════════════════════════════════════════════════

  // Dropdown de unidades en columna "Und"
  useEffect(() => {
    let attempts = 0;
    let t: ReturnType<typeof setTimeout>;

    const apply = () => {
      const inst   = ls();
      const sheets = inst?.getAllSheets?.() ?? [];
      if (!inst || typeof inst.setDataVerification !== 'function' || !sheets.length) {
        if (++attempts < 40) t = setTimeout(apply, 250);
        return;
      }
      const ci  = CI['unidad'];
      const rng = `${colLetter(ci)}2:${colLetter(ci)}3000`;
      const opt = { type: 'dropdown', value1: UNITS.join(','), prohibitInput: false };

      sheets
        .filter((s: any) => s.name !== 'Resumen')
        .forEach((s: any) => inst.setDataVerification(opt, { range: rng, order: s.order ?? 0 }));
    };

    t = setTimeout(apply, 400);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  // Recálculo inicial al montar
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
      <div className="flex h-[calc(100vh-65px)] w-full flex-col overflow-hidden
        bg-slate-50 dark:bg-gray-950">

        {/* ━━━━━━ BARRA SUPERIOR ━━━━━━ */}
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between
          gap-2 border-b border-slate-200/80 bg-white/90 px-4 py-2 shadow-sm
          backdrop-blur-md
          dark:border-gray-800/60 dark:bg-gray-900/90">

          {/* ── Izquierda ── */}
          <div className="flex items-center gap-2.5">
            {/* Botón volver */}
            <button
              type="button"
              onClick={() => router.get(`/costos/${project.id}`)}
              className="flex h-7 w-7 items-center justify-center rounded-full
                text-slate-400 transition-colors
                hover:bg-slate-100 hover:text-slate-700
                dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Título */}
            <div className="leading-tight">
              <p className="text-[13px] font-bold text-slate-900 dark:text-gray-100">
                Metrado Comunicaciones
              </p>
              <p className="text-[9px] font-medium uppercase tracking-wider text-slate-400">
                {project.nombre}
              </p>
            </div>

            {/* Leyenda de niveles */}
            <div className="hidden items-center gap-1 xl:flex">
              {LEVEL_PALETTE.slice(0, 4).map((p, i) => (
                <HeaderBadge key={i} style={{ background: p.bg, color: p.fc }}>
                  N{i + 1}
                </HeaderBadge>
              ))}
              <HeaderBadge
                style={{
                  background: LEAF_STYLE.bg,
                  color:      LEAF_STYLE.fc,
                  border:     '1px solid #e2e8f0',
                }}
              >
                Hoja
              </HeaderBadge>
            </div>
          </div>

          {/* ── Derecha ── */}
          <div className="flex flex-wrap items-center gap-1.5">
            <SaveIndicator saving={saving} error={saveError} lastSaved={lastSaved} />

            <Divider />

            {/* Calculadora */}
            <button
              type="button"
              title="Abre la calculadora para la fila seleccionada (Ctrl+K)"
              onClick={openCalc}
              className="inline-flex h-7 items-center gap-1.5 rounded-md
                bg-blue-600 px-3 text-[10px] font-bold text-white
                transition-all hover:bg-blue-700 active:scale-95"
            >
              <Calculator className="h-3 w-3" /> Calcular
            </button>

            {/* Numeración */}
            <button
              type="button"
              title="Numeración jerárquica automática"
              onClick={() => setNumOpen(true)}
              className="inline-flex h-7 items-center gap-1.5 rounded-md
                bg-violet-600 px-3 text-[10px] font-bold text-white
                transition-all hover:bg-violet-700 active:scale-95"
            >
              <Hash className="h-3 w-3" /> Numerar
            </button>

            <Divider />

            {/* Guardar manual */}
            <Button
              variant="outline"
              size="sm"
              onClick={saveNow}
              disabled={saving}
              className="h-7 gap-1.5 text-[11px]"
            >
              {saving
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Save className="h-3 w-3" />}
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>

            {/* Sincronizar Resumen */}
            <Button
              variant="outline"
              size="sm"
              onClick={syncResumen}
              disabled={syncing || saving}
              className="h-7 gap-1.5 text-[11px]"
            >
              <RefreshCcw className={cn('h-3 w-3', syncing && 'animate-spin')} />
              {syncing ? 'Sincronizando…' : 'Sync Resumen'}
            </Button>
          </div>
        </header>

        {/* ━━━━━━ HOJA LUCKYSHEET ━━━━━━ */}
        <main className="relative flex-1 overflow-hidden">
          <Luckysheet
            data={initialSheets}
            onDataChange={scheduleSave}
            height="calc(100vh - 112px)"
            options={{
              title:            'Metrado Comunicaciones',
              showinfobar:      false,
              sheetFormulaBar:  true,
              showstatisticBar: true,
              // Recalcular tras cada edición manual
              afterChange: () => setTimeout(recalc, 80),
              // Menú contextual simplificado (sin botones de fila que ya no existen)
              contextMenu: {
                row: [
                  {
                    text:    '🔢  Calculadora de metrado',
                    type:    'button',
                    onClick: openCalc,
                  },
                  {
                    text:    '#   Numeración jerárquica',
                    type:    'button',
                    onClick: () => setNumOpen(true),
                  },
                  { type: 'separator' },
                  {
                    text:    'Eliminar fila',
                    type:    'button',
                    onClick: () => {
                      const inst  = ls();
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

      {/* ━━━━━━ MODALES ━━━━━━ */}
      <CalcModal
        open    ={calcOpen}
        ri      ={calcRow.ri}
        rowData ={calcRow.rowData}
        onClose ={() => setCalcOpen(false)}
        onApply ={applyCalc}
      />

      <NumberingModal
        open    ={numOpen}
        onClose ={() => setNumOpen(false)}
        onApply ={applyNumbering}
      />
    </AppLayout>
  );
}

