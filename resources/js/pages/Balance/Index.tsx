import { router, usePage } from '@inertiajs/react';
import {
  AlertCircle, CheckCircle2, Loader2, Save,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Luckysheet from '@/components/costos/tablas/Luckysheet';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

import { ALL_COLS, CI, SAVE_DEBOUNCE, SHEETS, ROWS, COLS, RESUMEN_LABELS } from './balance_constants';
import {
  buildRecalcUpdates, buildBalanceRows, rowsToSheet, sheetToRows, toNum,
  buildResumenRows, buildResumenInternoUpdates,
} from './balance_utils';
import type { BalancePageProps } from './balance_types';

import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, Area
} from 'recharts';

type ViewTab = 'balance-real' | 'presupuesto' | 'resumen' | 'grafico';

// ============================================================================
//  HOOK: Luckysheet con helpers centralizados
// ============================================================================
function useLuckysheet() {
  const ls = () => (window as any).luckysheet as any;

  const getActive = () => {
    const sheets = ls()?.getAllSheets?.() ?? [];
    return sheets.find((s: any) => s.status === 1) ?? sheets[0] ?? null;
  };

  const getAllSheets = (): any[] => ls()?.getAllSheets?.() ?? [];

  const setCells = (updates: Array<{ r: number; c: number; v: any }>, order: number) => {
    const inst = ls();
    if (!inst || !updates.length) return;
    
    //  VALIDAR que el order existe antes de escribir
    const allSheets = inst.getAllSheets?.() ?? [];
    const targetSheet = allSheets.find((s: any) => s.order === order);
    
    if (!targetSheet) {
      // Silencioso: no mostrar warning en cada cambio de tab para no saturar consola
      return;
    }
    
    updates.forEach((u, i) => {
      try {
        inst.setCellValue(u.r, u.c, u.v, {
          order,
          isRefresh: i === updates.length - 1,
        });
      } catch (error) {
        // Silenciar errores de order inválido para no saturar consola
        if (String(error).includes('order')) {
          return;
        }
        console.error(`Error setting cell [${u.r},${u.c}] en order ${order}:`, error);
      }
    });
  };

  const getSheetByName = (sheets: any[], name: string) => {
    return sheets.find(s => s.name === name) ?? null;
  };

  //  Helper para leer fila por label en resúmenes
  const getRowByLabel = (sheet: any, label: string) => {
    if (!sheet?.data) return null;
    return sheet.data.find((row: any) => row?.[COLS.LABEL]?.v === label);
  };

  //  Helper para extraer valor numérico de celda
  const getValue = (row: any, col: number) => {
    return toNum(row?.[col]?.v ?? 0);
  };

  return { ls, getActive, getAllSheets, setCells, getSheetByName, getRowByLabel, getValue };
}

// ============================================================================
//  HOOK: AutoSave (actualizado con nuevos nombres de sheets)
// ============================================================================
function useAutoSave(balanceId: string | number) {
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSave = useCallback(async (balanceSheets: any[], presupuestoSheets: any[]) => {
    if (!balanceId) return;
    setSaving(true);
    setSaveError(null);

    const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
    const headers = {
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': csrf,
      'X-Requested-With': 'XMLHttpRequest',
    };

    try {
      let allRows: any[] = [];

      // Procesar Balance Real (usando nombres con prefijo)
      [SHEETS.BR.INGRESOS, SHEETS.BR.GASTOS].forEach(sheetName => {
        const sheet = balanceSheets.find(s => s.name === sheetName);
        if (!sheet) return;
        
        const rows = sheetToRows(sheet);
        rows.forEach((r: any) => {
          if (!r.descripcion?.trim() || r._kind === 'header') return;
          allRows.push({
            tipo: sheetName === SHEETS.BR.INGRESOS ? 'ingreso' : 'gasto',
            categoria: r.category ?? 'otros',
            descripcion: r.descripcion,
            balance_type: 'real',
            ene: toNum(r.ene), febr: toNum(r.febr), mar: toNum(r.mar),
            abr: toNum(r.abr), may: toNum(r.may), jun: toNum(r.jun),
            jul: toNum(r.jul), agos: toNum(r.agos), set: toNum(r.set),
            oct: toNum(r.oct), nov: toNum(r.nov), dic: toNum(r.dic),
          });
        });
      });

      // Procesar Presupuesto
      [SHEETS.PR.INGRESOS, SHEETS.PR.GASTOS].forEach(sheetName => {
        const sheet = presupuestoSheets.find(s => s.name === sheetName);
        if (!sheet) return;
        
        const rows = sheetToRows(sheet);
        rows.forEach((r: any) => {
          if (!r.descripcion?.trim() || r._kind === 'header') return;
          allRows.push({
            tipo: sheetName === SHEETS.PR.INGRESOS ? 'ingreso' : 'gasto',
            categoria: r.category ?? 'otros',
            descripcion: r.descripcion,
            balance_type: 'presupuesto',
            ene: toNum(r.ene), febr: toNum(r.febr), mar: toNum(r.mar),
            abr: toNum(r.abr), may: toNum(r.may), jun: toNum(r.jun),
            jul: toNum(r.jul), agos: toNum(r.agos), set: toNum(r.set),
            oct: toNum(r.oct), nov: toNum(r.nov), dic: toNum(r.dic),
          });
        });
      });

      const response = await fetch(`/balance/${balanceId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ rows: allRows }),
      });

      if (!response.ok) throw new Error(`Error ${response.status}`);
      setLastSaved(new Date());
    } catch (error) {
      setSaveError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }, [balanceId]);

  const scheduleSave = useCallback((balanceSheets: any[], presupuestoSheets: any[]) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => doSave(balanceSheets, presupuestoSheets), SAVE_DEBOUNCE);
  }, [doSave]);

  const saveNow = useCallback((balanceSheets: any[], presupuestoSheets: any[]) => 
    doSave(balanceSheets, presupuestoSheets), [doSave]);

  return { saving, lastSaved, saveError, scheduleSave, saveNow };
}

// ============================================================================
//  COMPONENTE PRINCIPAL
// ============================================================================
export default function BalanceIndex() {
  const page = usePage<BalancePageProps & Record<string, any>>();
  const balance = page.props.balance;

  const breadcrumbs: BreadcrumbItem[] = [{ title: 'Balance', href: '/balance' }];
  
  //  Destructuramos los nuevos helpers
  const { 
    ls, getActive, getAllSheets, setCells, 
    getSheetByName, getRowByLabel, getValue 
  } = useLuckysheet();
  
  const { saving, lastSaved, saveError, scheduleSave, saveNow } = useAutoSave(balance.id);
  const progCount = useRef(0);
  
  const [activeView, setActiveView] = useState<ViewTab>('balance-real');
  const [balanceSheetIndex, setBalanceSheetIndex] = useState(0);
  const [presupuestoSheetIndex, setPresupuestoSheetIndex] = useState(0);

  // Datos iniciales (sin cambios)
  const initialRows = useMemo(() => {
    const items = balance?.items ?? [];
    const ingresos = items.filter((i: any) => i.tipo === 'ingreso');
    const gastos = items.filter((i: any) => i.tipo === 'gasto');
    
    if (ingresos.length === 0 && gastos.length === 0) {
      return buildBalanceRows();
    }
    
    const rows: any[] = [];
    
    if (ingresos.length > 0) {
      rows.push({
        _kind: 'header' as const,
        descripcion: 'INGRESOS TOTALES',
        category: 'header',
        ene: 0, febr: 0, mar: 0, abr: 0, may: 0, jun: 0,
        jul: 0, agos: 0, set: 0, oct: 0, nov: 0, dic: 0, total: 0,
      });
    }
    
    rows.push(...ingresos.map((r: any) => ({ ...r, _kind: 'ingreso' as const })));
    
    if (gastos.length > 0) {
      rows.push({
        _kind: 'header' as const,
        descripcion: 'GASTOS TOTALES',
        category: 'header',
        ene: 0, febr: 0, mar: 0, abr: 0, may: 0, jun: 0,
        jul: 0, agos: 0, set: 0, oct: 0, nov: 0, dic: 0, total: 0,
      });
    }
    
    rows.push(...gastos.map((r: any) => ({ ...r, _kind: 'gasto' as const })));
    
    return rows;
  }, [balance]);

  // ============================================================================
  //  SHEETS CON NOMENCLATURA CORRECTA (CLAVE)
  // ============================================================================
  
  // Balance Real con prefijo BR_
  const balanceRealSheets = useMemo(() => {
    const ingresosRows = initialRows.filter(r =>
      r._kind === 'ingreso' ||
      (r._kind === 'header' && r.descripcion === 'INGRESOS TOTALES')
    );

    const gastosRows = initialRows.filter(r =>
      r._kind === 'gasto' ||
      (r._kind === 'header' && r.descripcion === 'GASTOS TOTALES')
    );

    return [
      rowsToSheet(ingresosRows, SHEETS.BR.INGRESOS, 0),
      rowsToSheet(gastosRows, SHEETS.BR.GASTOS, 1),
      rowsToSheet(buildResumenRows(), SHEETS.BR.RESUMEN, 2)
    ];
  }, [initialRows]);

  // Presupuesto con prefijo PR_
  const presupuestoSheets = useMemo(() => {
    const ingresosRows = initialRows.filter(r =>
      r._kind === 'ingreso' ||
      (r._kind === 'header' && r.descripcion === 'INGRESOS TOTALES')
    );

    const gastosRows = initialRows.filter(r =>
      r._kind === 'gasto' ||
      (r._kind === 'header' && r.descripcion === 'GASTOS TOTALES')
    );

    return [
      rowsToSheet(ingresosRows, SHEETS.PR.INGRESOS, 3),
      rowsToSheet(gastosRows, SHEETS.PR.GASTOS, 4),
      rowsToSheet(buildResumenRows(), SHEETS.PR.RESUMEN, 5)
    ];
  }, [initialRows]);

  // Resumen General (solo una hoja)
  const resumenSheets = useMemo(() => {
    return [rowsToSheet([], SHEETS.GENERAL, 6)];
  }, []);

  // ============================================================================
  //  FUNCIÓN CLAVE: recalcResumen 
  // ============================================================================
  const recalcResumen = useCallback(() => {
    const inst = ls();
    if (!inst) return;

    const allSheets = inst.getAllSheets?.() ?? [];
    const resumenSheet = getSheetByName(allSheets, SHEETS.GENERAL);
    if (!resumenSheet) return;

    // Obtener resúmenes internos
    const brResumen = getSheetByName(allSheets, SHEETS.BR.RESUMEN);
    const prResumen = getSheetByName(allSheets, SHEETS.PR.RESUMEN);
    if (!brResumen?.data || !prResumen?.data) return;

    // Construir updates comparativos
    const updates = buildResumenGeneralComparativo(brResumen, prResumen, 0);

    if (updates.length) {
      setCells(updates, resumenSheet.order);
    }
  }, [ls, setCells, getSheetByName]);

  // ============================================================================
  //  Recálculo general (actualizado con nuevos nombres)
  // ============================================================================
  const recalc = useCallback((view: ViewTab) => {
    if (progCount.current > 2) return;
    const inst = ls();
    if (!inst) return;

    const allSheets = inst.getAllSheets?.() ?? [];
    const active = getActive();
    
    // Recalcular solo si estamos en hojas de detalle (con prefijos)
    if (
      active &&
      Array.isArray(active.data) &&
      active.data.length > 0 &&
      [SHEETS.BR.INGRESOS, SHEETS.BR.GASTOS, SHEETS.PR.INGRESOS, SHEETS.PR.GASTOS].includes(active.name)
    ) {
      const updates = buildRecalcUpdates(active.data);
      if (updates.length && updates.length < 12000) {
        progCount.current++;
        setCells(updates, active.order ?? 0);
      }
    }

    // === NUEVO: Recalcular resúmenes internos (BR_Resumen / PR_Resumen) ===
    const brIngresos = getSheetByName(allSheets, SHEETS.BR.INGRESOS);
    const brGastos = getSheetByName(allSheets, SHEETS.BR.GASTOS);
    const prIngresos = getSheetByName(allSheets, SHEETS.PR.INGRESOS);
    const prGastos = getSheetByName(allSheets, SHEETS.PR.GASTOS);

    if (brIngresos && brGastos) {
      const brUpdates = buildResumenInternoUpdates(brIngresos, brGastos, 0);
      if (brUpdates.length) {
        const brResumen = getSheetByName(allSheets, SHEETS.BR.RESUMEN);
        if (brResumen) {
          setCells(brUpdates, brResumen.order);
        }
      }
    }

    if (prIngresos && prGastos) {
      const prUpdates = buildResumenInternoUpdates(prIngresos, prGastos, 0);
      if (prUpdates.length) {
        const prResumen = getSheetByName(allSheets, SHEETS.PR.RESUMEN);
        if (prResumen) {
          setCells(prUpdates, prResumen.order);
        }
      }
    }

    setTimeout(() => {
      progCount.current = Math.max(0, progCount.current - 1);
      if (view !== 'resumen') {
        recalcResumen();
      }
      
      //  Filtrar por nombres, no por order
      scheduleSave(
        allSheets.filter((s: { name: string; }) => [SHEETS.BR.INGRESOS, SHEETS.BR.GASTOS, SHEETS.BR.RESUMEN].includes(s.name as any)),
        allSheets.filter((s: { name: string; }) => [SHEETS.PR.INGRESOS, SHEETS.PR.GASTOS, SHEETS.PR.RESUMEN].includes(s.name as any))
      );
    }, 300);
  }, [ls, getActive, setCells, recalcResumen, scheduleSave]);

  // Inicialización
  useEffect(() => {
    let mounted = true;
    let attempts = 0;

    const run = () => {
      if (!mounted) return;

      const inst = ls();
      const sheets = inst?.getAllSheets?.();

      if (!Array.isArray(sheets) || sheets.length === 0) {
        if (attempts++ < 20) setTimeout(run, 300);
        return;
      }

      //  esperar a que TODAS las sheets tengan data
      const ready = sheets.every((s: any) => Array.isArray(s.data));

      if (!ready) {
        if (attempts++ < 20) setTimeout(run, 300);
        return;
      }

      if (activeView !== 'resumen') {
        recalc(activeView);
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, [activeView]); 

  // ============================================================================
  //  Datos para gráfico
  // ============================================================================
  const chartData = useMemo(() => {
    const inst = ls();
    if (!inst) return [];
    const allSheets = inst.getAllSheets?.() ?? [];
    
    //  Usar nombres con prefijo
    const brIngresos = getSheetByName(allSheets, SHEETS.BR.INGRESOS);
    const brGastos = getSheetByName(allSheets, SHEETS.BR.GASTOS);
    const prIngresos = getSheetByName(allSheets, SHEETS.PR.INGRESOS);
    const prGastos = getSheetByName(allSheets, SHEETS.PR.GASTOS);
    
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
    const colStart = COLS.ene;

    const monthlyData = months.map((month, i) => {
      // Sumar columna completa (ajustar según tu estructura real)
      const sumCol = (sheet: any) => {
        if (!sheet?.data) return 0;
        let sum = 0;
        for (let r = 1; r < sheet.data.length; r++) {
          sum += toNum(sheet.data[r]?.[colStart + i]?.v ?? 0);
        }
        return sum;
      };

      const balanceReal = sumCol(brIngresos) - sumCol(brGastos);
      const presupuesto = sumCol(prIngresos) - sumCol(prGastos);
      
      return {
        name: month,
        'Balance Real': balanceReal,
        'Presupuesto': presupuesto,
      };
    });

    // Curva S 
    let acumReal = 0;
    let acumPresu = 0;
    
    return monthlyData.map((data) => {
      acumReal += data['Balance Real'];
      acumPresu += data['Presupuesto'];
      
      return {
        ...data,
        'Curva S - Real': acumReal,
        'Curva S - Presupuesto': acumPresu,
      };
    });
  }, [ls, getSheetByName, activeView, getValue]);

  // ============================================================================
  //  Tabs 
  // ============================================================================
  const viewTabs: Array<{ id: ViewTab; label: string }> = [
    { id: 'balance-real', label: 'Bal. Real' },
    { id: 'presupuesto', label: 'Presupuesto' },
    { id: 'resumen', label: 'Resumen Gral' }, 
    { id: 'grafico', label: 'Gráfico' },
  ];

  const balanceSheetTabs = [
    { index: 0, label: 'Ingreso', sheetName: SHEETS.BR.INGRESOS },
    { index: 1, label: 'Gastos', sheetName: SHEETS.BR.GASTOS },
    { index: 2, label: 'Resumen', sheetName: SHEETS.BR.RESUMEN },
  ];

  // ============================================================================
  //  Renderizado 
  // ============================================================================
  const renderViewContent = () => {
    switch (activeView) {
      case 'grafico':
        return (
          <div className="h-full w-full p-4 md:p-6 overflow-auto bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900">
            <div className="mb-4 flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-100">
                 Evolución Mensual y Curva S Acumulada
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Barras: valores mensuales • Líneas: acumulado (Curva S)
              </p>
            </div>
            <div className="h-[28rem] md:h-96 w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart 
                  data={chartData} 
                  margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
                >
                  <defs>
                    <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorPresu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" className="dark:stroke-gray-700" />
                  <XAxis 
                    dataKey="name" 
                    fontSize={11} 
                    tick={{ fill: '#64748b' }} 
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={{ stroke: '#cbd5e1' }}
                  />
                  
                  <YAxis 
                    yAxisId="left"
                    fontSize={11} 
                    tick={{ fill: '#64748b' }} 
                    tickFormatter={(v) => {
                      if (Math.abs(v) >= 1_000_000) return `S/ ${v/1_000_000}M`;
                      if (Math.abs(v) >= 1_000) return `S/ ${v/1_000}k`;
                      return `S/ ${v}`;
                    }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={{ stroke: '#cbd5e1' }}
                  />
                  
                  <YAxis 
                    yAxisId="right" 
                    orientation="right"
                    fontSize={11} 
                    tick={{ fill: '#64748b' }} 
                    tickFormatter={(v) => {
                      if (Math.abs(v) >= 1_000_000) return `S/ ${v/1_000_000}M`;
                      if (Math.abs(v) >= 1_000) return `S/ ${v/1_000}k`;
                      return `S/ ${v}`;
                    }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={{ stroke: '#cbd5e1' }}
                  />
                  
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                    formatter={(value: number, name: string) => {
                      const formatted = `S/ ${Math.abs(value).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                      const prefix = value < 0 ? '- ' : '';
                      const label = name.includes('Curva S') 
                        ? `${name.replace('Curva S - ', '')} (Acumulado)` 
                        : `${name} (Mensual)`;
                      return [`${prefix}${formatted}`, label];
                    }}
                    labelStyle={{ fontWeight: 600, color: '#1e293b' }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '10px' }}
                    iconType="round"
                    formatter={(value) => <span className="text-xs text-slate-600 dark:text-slate-300">{value}</span>}
                  />
                  
                  <Bar 
                    yAxisId="left"
                    dataKey="Balance Real" 
                    fill="#22c55e" 
                    radius={[4, 4, 0, 0]} 
                    name="Balance Real"
                    opacity={0.9}
                  />
                  
                  <Bar 
                    yAxisId="left"
                    dataKey="Presupuesto" 
                    fill="#3b82f6" 
                    radius={[4, 4, 0, 0]} 
                    name="Presupuesto"
                    opacity={0.9}
                  />
                  
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="Curva S - Real" 
                    stroke="#16a34a" 
                    strokeWidth={2.5} 
                    dot={{ r: 3, fill: '#16a34a', stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                    name="Curva S - Real"
                  />
                  
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="Curva S - Presupuesto" 
                    stroke="#2563eb" 
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                    dot={{ r: 3, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                    name="Curva S - Presupuesto"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-slate-200 dark:border-gray-700">
                <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                <span className="text-slate-600 dark:text-slate-300">Real (Mensual)</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-slate-200 dark:border-gray-700">
                <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                <span className="text-slate-600 dark:text-slate-300">Presupuesto (Mensual)</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-slate-200 dark:border-gray-700">
                <div className="w-5 h-0.5 bg-green-700"></div>
                <span className="text-slate-600 dark:text-slate-300">Curva S Real</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-slate-200 dark:border-gray-700">
                <div className="w-5 h-0.5 bg-blue-700 border-t border-dashed border-blue-700"></div>
                <span className="text-slate-600 dark:text-slate-300">Curva S Presupuesto</span>
              </div>
            </div>
          </div>
        );

      case 'resumen':
        return (
          <Luckysheet
            key="resumen-sheet"
            data={resumenSheets}
            height="100%"
            options={{
              title: 'Resumen General',
              showinfobar: false,
              sheetFormulaBar: false,
              showstatisticBar: false,
              allowUpdate: false,
              showGridLines: false,
            }}
          />
        );

      case 'balance-real':
        return (
          <>
            <Luckysheet
              key="balance-real-sheet"
              data={balanceRealSheets}
              height="100%"
              options={{
                title: 'Balance Real',
                showinfobar: false,
                sheetFormulaBar: true,
                showstatisticBar: true,
                afterChange: () => setTimeout(() => recalc('balance-real'), 80),
              }}
            />
            <div className="border-t border-slate-200 bg-slate-100 dark:border-gray-800 dark:bg-gray-800">
              <div className="flex items-center gap-2 px-4 py-2">
                <span className="text-xs font-medium text-slate-500 mr-2">Hojas:</span>
                {balanceSheetTabs.map((tab) => (
                  <button
                    key={tab.index}
                    onClick={() => {
                      setBalanceSheetIndex(tab.index);
                      const inst = ls();
                      if (inst) inst.setSheetActive(tab.index);
                    }}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded transition-colors",
                      balanceSheetIndex === tab.index
                        ? "bg-white text-blue-600 shadow-sm border border-slate-200 dark:bg-gray-700 dark:text-blue-400"
                        : "bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-gray-700 dark:text-slate-300 dark:hover:bg-gray-600"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        );

      case 'presupuesto':
        return (
          <>
            <Luckysheet
              key="presupuesto-sheet"
              data={presupuestoSheets}
              height="100%"
              options={{
                title: 'Presupuesto',
                showinfobar: false,
                sheetFormulaBar: true,
                showstatisticBar: true,
                afterChange: () => setTimeout(() => recalc('presupuesto'), 80),
              }}
            />
            <div className="border-t border-slate-200 bg-slate-100 dark:border-gray-800 dark:bg-gray-800">
              <div className="flex items-center gap-2 px-4 py-2">
                <span className="text-xs font-medium text-slate-500 mr-2">Hojas:</span>
                {balanceSheetTabs.map((tab) => (
                  <button
                    key={tab.index}
                    onClick={() => {
                      setPresupuestoSheetIndex(tab.index);
                      const inst = ls();
                      if (inst) inst.setSheetActive(tab.index + 3);
                    }}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded transition-colors",
                      presupuestoSheetIndex === tab.index
                        ? "bg-white text-blue-600 shadow-sm border border-slate-200 dark:bg-gray-700 dark:text-blue-400"
                        : "bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-gray-700 dark:text-slate-300 dark:hover:bg-gray-600"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="flex h-[calc(100vh-65px)] w-full flex-col overflow-hidden bg-slate-50 dark:bg-gray-950">
        <header className="sticky top-0 z-20 flex flex-col border-b border-slate-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-3">
              <button onClick={() => router.get('/balance')} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
                ← Volver
              </button>
              <div>
                <h1 className="text-sm font-bold text-slate-900 dark:text-gray-100">Balance General</h1>
                <p className="text-[10px] uppercase text-slate-400">{balance.nombre}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold transition-colors",
                saving ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" : 
                saveError ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : 
                lastSaved ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : 
                "bg-slate-100 text-slate-400 dark:bg-gray-800 dark:text-slate-500"
              )}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saveError ? <AlertCircle className="h-3 w-3" /> : lastSaved ? <CheckCircle2 className="h-3 w-3" /> : <Save className="h-3 w-3" />}
                {saving ? 'Guardando…' : saveError ? saveError : lastSaved ? 'Guardado' : 'Sin cambios'}
              </span>
              <Button variant="outline" size="sm" onClick={() => {
                const inst = ls();
                const allSheets = inst?.getAllSheets?.() ?? [];
                saveNow(
                  allSheets.filter((s: { name: string; }) => [SHEETS.BR.INGRESOS, SHEETS.BR.GASTOS, SHEETS.BR.RESUMEN].includes(s.name as any)),
                  allSheets.filter((s: { name: string; }) => [SHEETS.PR.INGRESOS, SHEETS.PR.GASTOS, SHEETS.PR.RESUMEN].includes(s.name as any))
                );
              }} disabled={saving} className="h-7 gap-1.5 text-[11px]">
                <Save className="h-3 w-3" /> Guardar
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-1 px-4 pb-2">
            {viewTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-t-lg transition-all duration-200",
                  activeView === tab.id
                    ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-gray-100 dark:hover:bg-gray-800"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>
        <main className="flex-1 overflow-hidden bg-white dark:bg-gray-900">
          {renderViewContent()}
        </main>
      </div>
    </AppLayout>
  );
}
