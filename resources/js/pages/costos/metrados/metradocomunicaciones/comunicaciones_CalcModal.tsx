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
} from './comunicaciones_constants';
import type { CalcPayload, MeasureInputs, MeasureOutputs } from './comunicaciones_types';
import { r4, toNum } from './comunicaciones_utils';

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
      {/* ✅ MODAL RECTANGULAR - Todo visible sin scroll */}
      <DialogContent className={cn(
        "z-[9999] w-[95vw] max-w-[1250px] min-w-[1000px]",
        "gap-0 rounded-lg border-0 bg-slate-900 shadow-2xl",
        "flex flex-col"
      )}>
        
        {/* HEADER - Más compacto */}
        <DialogHeader className="border-b border-slate-700 bg-blue-700 px-5 py-2.5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-white">
              <Calculator className="h-5 w-5" />
              Calculadora de Metrado
              <span className="rounded bg-blue-800 px-2.5 py-0.5 text-xs font-bold uppercase text-blue-100">
                {unit}
              </span>
            </DialogTitle>
            <button 
              type="button" 
              onClick={onClose} 
              className="text-blue-200 hover:text-white hover:bg-blue-800 rounded-md p-1 transition-colors"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </DialogHeader>

        {/* CONTENIDO - Compacto sin scroll */}
        <div className="px-5 py-3 space-y-3">
          
          {/* Fila 1: Descripción + Unidad + Versión */}
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-5">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1 block">
                Descripción
              </Label>
              <Input
                value={descripcion}
                placeholder="Descripción del ítem"
                onChange={(e) => setDescripcion(e.target.value)}
                className="h-8 border-slate-600 bg-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            
            <div className="col-span-3">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1 block">
                Unidad
              </Label>
              <select
                value={unidad}
                onChange={(e) => { setUnidad(e.target.value); setUseCustom(false); }}
                className="flex h-8 w-full rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u.toUpperCase()}</option>
                ))}
              </select>
            </div>

            <div className="col-span-4">
              {!useCustom && unitProfiles.length > 1 && (
                <>
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1 block">
                    Versión
                  </Label>
                  <div className="flex gap-1">
                    {unitProfiles.slice(0, 5).map((p, idx) => {
                      const isActive = selectedVersion === p.key;
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => setSelectedVersion(p.key)}
                          className={cn(
                            'flex-1 rounded px-1.5 py-1.5 text-[10px] font-bold transition-colors',
                            isActive
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
                          )}
                        >
                          V{idx + 1}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Fila 2: Fórmula - Más compacta */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {profile.label || 'Fórmula'}
            </div>
            <div className="mt-0.5 text-xs font-medium text-blue-300">
              {profile.formula}
            </div>
          </div>

          {/* Fila 3: Inputs - Grid de 6 columnas compacto */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5">
            <div className="mb-2">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Valores de Entrada
              </Label>
              <div className="text-[9px] text-slate-500 mt-0.5">
                {activeInputs.map(k => INPUT_LABELS[k]).join(' • ')}
              </div>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {ALL_INPUTS.map((key) => {
                const isActive = activeInputs.includes(key);
                return (
                  <div key={key} className={cn('space-y-1', !isActive && 'opacity-30')}>
                    <Label className="text-[9px] font-medium uppercase text-slate-500 text-center block">
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
                        'h-8 text-center font-mono text-sm font-bold',
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

          {/* Fila 4: Fórmula Personalizada - Compacta */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/30 px-3 py-2.5">
            <div className="flex items-center gap-2.5 mb-2">
              <input
                type="checkbox"
                id="custom-formula"
                checked={useCustom}
                onChange={(e) => setUseCustom(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="custom-formula" className="text-xs font-medium text-slate-300 cursor-pointer">
                Fórmula personalizada
              </label>
            </div>
            
            {useCustom && (
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-8">
                  <Label className="text-[10px] text-slate-400 mb-1 block">Expresión</Label>
                  <Input
                    className="h-7 border-slate-600 bg-slate-800 font-mono text-xs text-slate-100"
                    placeholder="ej: elsim * (largo + ancho) * nveces"
                    value={customExpr}
                    onChange={(e) => setCustomExpr(e.target.value)}
                  />
                  {customErr && (
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-red-400">
                      <TriangleAlert className="h-2.5 w-2.5" /> {customErr}
                    </p>
                  )}
                </div>
                <div className="col-span-4">
                  <Label className="text-[10px] text-slate-400 mb-1 block">Resultado en:</Label>
                  <div className="flex gap-1">
                    {OUTPUT_COLUMNS.map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setCustomOut(col)}
                        className={cn(
                          'flex-1 rounded px-1.5 py-1 text-[9px] font-bold uppercase transition-colors',
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
          </div>

          {/* Fila 5: RESULTADO - Compacto */}
          <div className={cn(
            'rounded-lg border-2 px-4 py-3',
            hasResult 
              ? 'border-emerald-500/40 bg-emerald-950/20'
              : 'border-slate-700 bg-slate-800/50',
          )}>
            <Label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center">
              Resultado
            </Label>
            {hasResult ? (
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <div className="mb-1 text-[10px] font-bold uppercase text-emerald-400">
                    {OUTPUT_LABELS[activeOut] ?? activeOut}
                  </div>
                  <div className="rounded-lg bg-emerald-950/40 px-5 py-2.5 text-3xl font-bold text-emerald-400">
                    {outVal.toLocaleString('es-PE', { maximumFractionDigits: 4 })}
                  </div>
                </div>
                
                <div className="h-12 w-px bg-slate-600" />
                
                <div className="text-center">
                  <div className="mb-1 text-[10px] font-bold uppercase text-slate-400">
                    Operación
                  </div>
                  <div className="rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-300 font-mono">
                    {(useCustom ? ALL_INPUTS : profile.activeInputs)
                      .filter((key) => vals[key] !== 0)
                      .map((key) => `${r4(vals[key])}`)
                      .join(' × ')}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-2 text-xs text-slate-500 text-center">
                Ingresa valores para calcular
              </div>
            )}
          </div>
        </div>

        {/* FOOTER - Compacto */}
        <DialogFooter className="flex gap-2 border-t border-slate-700 bg-slate-800/50 px-5 py-2.5 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 px-4 text-xs">
            Cancelar
          </Button>
          <Button
            size="sm"
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
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-4 text-xs"
          >
            <Calculator className="mr-1.5 h-3.5 w-3.5" />
            Aplicar Cálculo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}