// ═══════════════════════════════════════════════════════════════
// sanitarias_CalcModal.tsx — Modal de Calculadora de Metrado
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';

import {
  ALL_INPUTS,
  DEFAULT_PROFILE,
  INPUT_LABELS,
  OUTPUT_LABELS,
  UNITS,
  UNIT_PROFILES,
} from './sanitarias_constants';
import type { CalcPayload, MeasureInputs, MeasureOutputs } from './sanitarias_types';
import { r4, toNum } from './sanitarias_utils';

export interface CalcModalProps {
  open: boolean;
  ri: number;
  rowData: Record<string, any>;
  onClose: () => void;
  onApply: (payload: CalcPayload) => void;
}

const OUTPUT_COLUMNS: (keyof MeasureOutputs)[] = ['lon', 'area', 'vol', 'kg', 'und'];

export function CalcModal({ open, ri, rowData, onClose, onApply }: CalcModalProps) {
  const [descripcion, setDescripcion] = useState('');
  const [unidad, setUnidad] = useState('und');
  const [vals, setVals] = useState<MeasureInputs>({
    elsim: 0, largo: 0, ancho: 0, alto: 0, nveces: 1, kg: 0,
  });
  const [customExpr, setCustomExpr] = useState('');
  const [customErr, setCustomErr] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [customOut, setCustomOut] = useState<keyof MeasureOutputs>('und');
  const [selectedVersion, setSelectedVersion] = useState<string>('');

  const unit = unidad.trim().toLowerCase();
  const unitProfiles = UNIT_PROFILES[unit] ?? [DEFAULT_PROFILE];
  const known = !!UNIT_PROFILES[unit];

  const profile = useMemo(() => {
    if (useCustom) return DEFAULT_PROFILE;
    const selected = selectedVersion 
      ? unitProfiles.find(p => p.key === selectedVersion) 
      : unitProfiles[0];
    return selected ?? DEFAULT_PROFILE;
  }, [unitProfiles, selectedVersion, useCustom]);

  const activeOut = useCustom ? customOut : profile.outputKey;

  useEffect(() => {
    if (!open) return;
    const incomingUnit = String(rowData.unidad ?? '').trim().toLowerCase();
    setDescripcion(String(rowData.descripcion ?? '').trim());
    setUnidad(incomingUnit || 'und');
    setVals({
      elsim: toNum(rowData.elsim), largo: toNum(rowData.largo), ancho: toNum(rowData.ancho),
      alto: toNum(rowData.alto), nveces: toNum(rowData.nveces) || 1, kg: toNum(rowData.kg),
    });
    setCustomExpr(''); setCustomErr('');
    const hasProfiles = !!UNIT_PROFILES[incomingUnit];
    setUseCustom(incomingUnit ? !hasProfiles : false);
    const profiles = UNIT_PROFILES[incomingUnit];
    setSelectedVersion(profiles?.[0]?.key ?? '');
    setCustomOut('und');
  }, [open, rowData]);

  const preview = useMemo((): MeasureOutputs => {
    if (!useCustom) {
      try { return profile.fn(vals); } catch { return {}; }
    }
    if (!customExpr.trim()) return {};
    try {
      const { elsim, largo, ancho, alto, nveces, kg } = vals;
      // eslint-disable-next-line no-new-func
      const result = new Function('elsim', 'largo', 'ancho', 'alto', 'nveces', 'kg', 'Math',
        `"use strict"; return (${customExpr});`,
      )(elsim, largo, ancho, alto, nveces, kg, Math);
      setCustomErr('');
      return { [customOut]: Number(result) };
    } catch (e: any) {
      setCustomErr(e.message ?? 'Error en expresión');
      return {};
    }
  }, [customExpr, customOut, profile, useCustom, vals]);

  const outVal = r4((preview[activeOut] ?? 0) as number);
  const hasResult = outVal !== 0;

  const activeInputs = useCustom ? ALL_INPUTS : profile.activeInputs;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      {/* ✅ MODAL MUY ANCHO HORIZONTAL - Casi toda la pantalla */}
      <DialogContent className={cn(
        "z-[9999] w-[95vw] max-w-[1800px] min-w-[1200px]",
        "max-h-[70vh] h-auto",
        "gap-0 rounded-lg border-0 bg-slate-900 shadow-2xl",
        "flex flex-col overflow-hidden"
      )}>
        
        {/* HEADER */}
        <DialogHeader className="border-b border-slate-700 bg-blue-700 px-8 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
              <Calculator className="h-6 w-6" />
              Calculadora de Metrado
              <span className="rounded bg-blue-800 px-3 py-1 text-sm font-bold uppercase text-blue-100">
                {unit}
              </span>
            </DialogTitle>
            <button 
              type="button" 
              onClick={onClose} 
              className="text-blue-200 hover:text-white hover:bg-blue-800 rounded-md p-1 transition-colors"
            >
              <X className="h-6 w-6" strokeWidth={2} />
            </button>
          </div>
        </DialogHeader>

        {/* CONTENIDO - Layout horizontal */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="space-y-6">
            
            {/* PRIMERA FILA: Descripción + Unidad + Versión */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 block">
                  Descripción
                </Label>
                <Input
                  value={descripcion}
                  placeholder="Descripción del ítem"
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="h-11 border-slate-600 bg-slate-800 text-base text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              
              <div className="col-span-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 block">
                  Unidad
                </Label>
                <select
                  value={unidad}
                  onChange={(e) => { setUnidad(e.target.value); setUseCustom(false); }}
                  className="flex h-11 w-full rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-base text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div className="col-span-4">
                {!useCustom && unitProfiles.length > 1 && (
                  <>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 block">
                      Versión
                    </Label>
                    <div className="flex gap-2">
                      {unitProfiles.slice(0, 5).map((p, idx) => {
                        const versionNum = idx + 1;
                        const isActive = selectedVersion === p.key;
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => setSelectedVersion(p.key)}
                            className={cn(
                              'flex-1 rounded-md px-3 py-2.5 text-sm font-bold transition-colors',
                              isActive
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
                            )}
                          >
                            V{versionNum}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* SEGUNDA FILA: Fórmula */}
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <div className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                {profile.label || 'Fórmula'}
              </div>
              <div className="mt-1 text-base font-medium text-blue-300">
                {profile.formula}
              </div>
            </div>

            {/* TERCERA FILA: Inputs en una sola línea horizontal */}
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6">
              <div className="mb-4">
                <Label className="text-sm font-bold uppercase tracking-wider text-slate-400">
                  Valores de Entrada
                </Label>
                <div className="text-xs text-slate-500 mt-1">
                  {activeInputs.map(k => INPUT_LABELS[k]).join(' • ')}
                </div>
              </div>
              
              {/* Grid de 6 columnas para los inputs */}
              <div className="grid grid-cols-6 gap-4">
                {ALL_INPUTS.map((key) => {
                  const isActive = activeInputs.includes(key);
                  return (
                    <div key={key} className={cn('space-y-2', !isActive && 'opacity-30')}>
                      <Label className="text-xs font-medium uppercase text-slate-500 text-center block">
                        {INPUT_LABELS[key]}
                      </Label>
                      <Input
                        type="number"
                        step="any"
                        disabled={!isActive}
                        value={vals[key] === 0 ? '' : vals[key]}
                        placeholder="0"
                        onChange={(e) => setVals((v) => ({ ...v, [key]: toNum(e.target.value) }))}
                        className={cn(
                          'h-12 text-center font-mono text-xl font-bold',
                          isActive
                            ? 'border-slate-600 bg-slate-800 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                            : 'cursor-not-allowed border-slate-700 bg-slate-800/50 text-slate-500',
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Fórmula personalizada (si está activa) */}
            {useCustom && (
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <Label className="text-xs text-slate-400 mb-2 block">Expresión</Label>
                  <Input
                    className="border-slate-600 bg-slate-800 font-mono text-sm text-slate-100"
                    placeholder="ej: elsim * (largo + ancho) * nveces"
                    value={customExpr}
                    onChange={(e) => setCustomExpr(e.target.value)}
                  />
                  {customErr && (
                    <p className="mt-2 flex items-center gap-1 text-xs text-red-400">
                      <TriangleAlert className="h-3 w-3" /> {customErr}
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <Label className="text-xs text-slate-400 mb-2 block">Resultado en:</Label>
                  <div className="flex gap-2">
                    {OUTPUT_COLUMNS.map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setCustomOut(col)}
                        className={cn(
                          'flex-1 rounded px-3 py-2 text-sm font-bold uppercase transition-colors',
                          customOut === col
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
                        )}
                      >
                        {OUTPUT_LABELS[col]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* RESULTADO - Grande y destacado */}
            <div className={cn(
              'rounded-lg border-2 p-6',
              hasResult 
                ? 'border-emerald-500/40 bg-emerald-950/20'
                : 'border-slate-700 bg-slate-800/50',
            )}>
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <Label className="mb-2 block text-sm font-bold uppercase tracking-wider text-slate-400">
                    Resultado
                  </Label>
                  {hasResult ? (
                    <div className="text-center">
                      <div className="mb-3 text-sm font-bold uppercase text-emerald-400">
                        {OUTPUT_LABELS[activeOut] ?? activeOut}
                      </div>
                      <div className="rounded-xl bg-emerald-950/40 px-8 py-4 text-5xl font-bold text-emerald-400 shadow-lg shadow-emerald-900/30">
                        {outVal.toLocaleString('es-PE', { maximumFractionDigits: 4 })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-4 text-base text-slate-500">
                      Ingresa valores para calcular
                    </div>
                  )}
                </div>

                {hasResult && (
                  <>
                    <div className="h-20 w-px bg-slate-600" />
                    <div className="text-center">
                      <div className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-400">
                        Operación
                      </div>
                      <div className="rounded-lg bg-slate-800 px-6 py-4 text-lg text-slate-300 font-mono">
                        {(useCustom ? ALL_INPUTS : profile.activeInputs)
                          .filter((key) => vals[key] !== 0)
                          .map((key) => `${r4(vals[key])}`)
                          .join(' × ')}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <DialogFooter className="flex gap-3 border-t border-slate-700 bg-slate-800/50 px-8 py-4 flex-shrink-0">
          <Button variant="outline" size="lg" onClick={onClose} className="border-slate-600 bg-slate-800 px-6 text-base text-slate-200 hover:bg-slate-700">
            Cancelar
          </Button>
          <Button
            size="lg"
            disabled={!hasResult}
            onClick={() => {
              onApply({
                ri,
                descripcion: descripcion.trim(),
                unidad: unit,
                outputKey: activeOut,
                inputs: vals,
                outputs: useCustom ? { [customOut]: outVal } : profile.fn(vals),
              });
              onClose();
            }}
            className="bg-blue-600 px-8 text-base hover:bg-blue-700 disabled:opacity-40"
          >
            <Calculator className="mr-2 h-5 w-5" />
            Aplicar Cálculo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}