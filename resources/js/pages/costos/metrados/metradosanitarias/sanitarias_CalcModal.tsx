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
      <DialogContent className="z-[9999] w-[95vw] max-w-[900px] max-h-[90vh] overflow-y-auto gap-0 rounded-2xl border-0 bg-slate-900 p-0 shadow-2xl">
        
        {/* HEADER */}
        <DialogHeader className="border-b border-slate-700 bg-blue-700 px-5 py-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-white">
              <Calculator className="h-5 w-5" />
              Calculadora de Metrado
              <span className="rounded bg-blue-800 px-2.5 py-0.5 text-xs font-bold uppercase text-blue-100">
                {unit}
              </span>
            </DialogTitle>
            <button onClick={onClose} className="text-blue-200 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
          {rowData.descripcion && (
            <DialogDescription className="truncate text-sm text-blue-200">
              {String(rowData.descripcion).trim()}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 bg-slate-900 px-5 py-5">
          
          {/* DESCRIPCIÓN */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Descripción
            </Label>
            <Input
              value={descripcion}
              placeholder="Descripción del ítem"
              onChange={(e) => setDescripcion(e.target.value)}
              className="h-10 border-slate-600 bg-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* UNIDAD */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Unidad
              </Label>
              <select
                value={unidad}
                onChange={(e) => { setUnidad(e.target.value); setUseCustom(false); }}
                className="flex h-10 w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u.toUpperCase()}</option>
                ))}
              </select>
            </div>

            {/* VERSIÓN - TABS */}
            {!useCustom && unitProfiles.length > 1 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Versión
                </Label>
                <div className="flex gap-1">
                  {unitProfiles.slice(0, 5).map((p, idx) => {
                    const versionNum = idx + 1;
                    const isActive = selectedVersion === p.key;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setSelectedVersion(p.key)}
                        className={cn(
                          'flex-1 rounded-md px-2 py-2 text-xs font-bold transition-colors',
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
              </div>
            )}
          </div>

          {/* FÓRMULA */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {profile.label || 'Fórmula'}
            </div>
            <div className="mt-1 text-sm font-medium text-blue-300">
              {profile.formula}
            </div>
          </div>

          {/* VALORES */}
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Valores {activeInputs.map(k => `(${INPUT_LABELS[k]})`).join(' • ')}
              </Label>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {ALL_INPUTS.map((key) => {
                const isActive = activeInputs.includes(key);
                return (
                  <div key={key} className={cn('space-y-1', !isActive && 'opacity-40')}>
                    <Label className="text-[10px] font-medium uppercase text-slate-500">
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
                        'h-10 text-right font-mono text-sm',
                        isActive
                          ? 'border-slate-600 bg-slate-800 text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                          : 'cursor-not-allowed border-slate-700 bg-slate-800/50 text-slate-500',
                      )}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* FÓRMULA PERSONALIZADA */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="custom-formula"
              checked={useCustom}
              onChange={(e) => setUseCustom(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="custom-formula" className="text-sm font-medium text-slate-300">
              Fórmula personalizada
            </label>
          </div>

          {useCustom && (
            <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
              <div>
                <Label className="text-xs text-slate-400">Expresión</Label>
                <Input
                  className="mt-1 border-slate-600 bg-slate-800 font-mono text-sm text-slate-100"
                  placeholder="ej: elsim * (largo + ancho) * nveces"
                  value={customExpr}
                  onChange={(e) => setCustomExpr(e.target.value)}
                />
                {customErr && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
                    <TriangleAlert className="h-3 w-3" /> {customErr}
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs text-slate-400">Resultado en:</Label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {OUTPUT_COLUMNS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setCustomOut(col)}
                      className={cn(
                        'rounded px-2.5 py-1 text-xs font-bold uppercase transition-colors',
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

          {/* RESULTADO */}
          <div className={cn(
            'rounded-lg border-2 p-4',
            hasResult 
              ? 'border-emerald-500/40 bg-emerald-950/20'
              : 'border-slate-700 bg-slate-800/50',
          )}>
            <Label className="mb-3 block text-xs font-bold uppercase tracking-wider text-slate-400">
              Resultado
            </Label>
            {hasResult ? (
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                {/* Inputs activos con sus valores */}
                {(useCustom ? ALL_INPUTS : profile.activeInputs)
                  .filter((key) => vals[key] !== 0)
                  .map((key, idx, arr) => (
                    <React.Fragment key={key}>
                      <div className="text-center">
                        <div className="mb-1 text-[10px] font-medium uppercase text-slate-400">
                          {INPUT_LABELS[key]}
                        </div>
                        <div className="rounded bg-slate-800 px-2.5 py-1.5 font-mono text-sm font-semibold text-slate-200">
                          {r4(vals[key]).toLocaleString('es-PE', { maximumFractionDigits: 4 })}
                        </div>
                      </div>
                      {idx < arr.length - 1 && (
                        <span className="mt-4 text-lg font-bold text-slate-500">×</span>
                      )}
                    </React.Fragment>
                  ))}
                
                {/* Signo igual */}
                <span className="mt-4 text-lg font-bold text-slate-500">=</span>
                
                {/* Resultado final */}
                <div className="text-center">
                  <div className="mb-1 text-[10px] font-bold uppercase text-emerald-400">
                    {OUTPUT_LABELS[activeOut] ?? activeOut}
                  </div>
                  <div className="rounded-lg bg-emerald-950/40 px-4 py-2 text-3xl font-bold text-emerald-400 shadow-lg shadow-emerald-900/30">
                    {outVal.toLocaleString('es-PE', { maximumFractionDigits: 4 })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-6 text-sm text-slate-500">
                Ingresa valores para calcular
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <DialogFooter className="flex gap-2 border-t border-slate-700 bg-slate-800/50 px-5 py-4">
          <Button variant="outline" size="sm" onClick={onClose} className="border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700">
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
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40"
          >
            <Calculator className="mr-1.5 h-4 w-4" />
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}