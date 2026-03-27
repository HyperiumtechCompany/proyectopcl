import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

import {
  ALL_INPUTS,
  DEFAULT_PROFILE,
  INPUT_LABELS,
  OUTPUT_LABELS,
  UNITS,
  UNIT_PROFILES,
} from './arquitectura_constants';
import type { CalcPayload, MeasureInputs, MeasureOutputs } from './arquitectura_types';
import { r4, toNum } from './arquitectura_utils';

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
    elsim: 0,
    largo: 0,
    ancho: 0,
    alto: 0,
    nveces: 1,
    kg: 0,
  });
  const [customExpr, setCustomExpr] = useState('');
  const [customErr, setCustomErr] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [customOut, setCustomOut] = useState<keyof MeasureOutputs>('und');

  const unit = unidad.trim().toLowerCase();
  const profile = UNIT_PROFILES[unit] ?? DEFAULT_PROFILE;
  const known = !!UNIT_PROFILES[unit];
  const activeOut = useCustom ? customOut : profile.outputKey;

  useEffect(() => {
    if (!open) return;

    const incomingUnit = String(rowData.unidad ?? '').trim().toLowerCase();
    setDescripcion(String(rowData.descripcion ?? '').trim());
    setUnidad(incomingUnit || 'und');
    setVals({
      elsim: toNum(rowData.elsim),
      largo: toNum(rowData.largo),
      ancho: toNum(rowData.ancho),
      alto: toNum(rowData.alto),
      nveces: toNum(rowData.nveces) || 1,
      kg: toNum(rowData.kg),
    });
    setCustomExpr('');
    setCustomErr('');
    setUseCustom(incomingUnit ? !UNIT_PROFILES[incomingUnit] : false);
    setCustomOut('und');
  }, [open, rowData]);

  const preview = useMemo((): MeasureOutputs => {
    if (!useCustom) {
      try {
        return profile.fn(vals);
      } catch {
        return {};
      }
    }

    if (!customExpr.trim()) return {};

    try {
      const { elsim, largo, ancho, alto, nveces, kg } = vals;
      // eslint-disable-next-line no-new-func
      const result = new Function(
        'elsim', 'largo', 'ancho', 'alto', 'nveces', 'kg', 'Math',
        `"use strict"; return (${customExpr});`,
      )(elsim, largo, ancho, alto, nveces, kg, Math);

      setCustomErr('');
      return { [customOut]: Number(result) };
    } catch (e: any) {
      setCustomErr(e.message ?? 'Error en expresion');
      return {};
    }
  }, [customExpr, customOut, profile, useCustom, vals]);

  const outVal = r4((preview[activeOut] ?? 0) as number);
  const hasResult = outVal !== 0;

  const renderField = (key: keyof MeasureInputs) => {
    const isActive = useCustom ? true : profile.activeInputs.includes(key);

    return (
      <div key={key} className={cn('flex flex-col gap-1', !isActive && 'opacity-30')}>
        <Label className={cn(
          'text-[10px] font-semibold uppercase tracking-wider',
          isActive ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600',
        )}>
          {INPUT_LABELS[key]}
          {isActive && <span className="ml-1 text-blue-500">*</span>}
        </Label>
        <Input
          type="number"
          step="any"
          disabled={!isActive}
          value={vals[key] === 0 ? '' : vals[key]}
          placeholder="0"
          onChange={(e) => setVals((current) => ({ ...current, [key]: toNum(e.target.value) }))}
          className={cn(
            'h-8 text-right font-mono text-[12px]',
            !isActive && 'cursor-not-allowed bg-slate-50 dark:bg-slate-900',
          )}
        />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="z-9999 max-w-[960px] gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-2xl"
        style={{ zIndex: 9999 }}>
        <DialogHeader className="border-b border-slate-100 bg-linear-to-r from-blue-600 to-blue-700 px-5 py-4 dark:border-slate-800">
          <DialogTitle className="flex items-center gap-2 text-[14px] font-bold text-white">
            <Calculator className="h-4.5 w-4.5" />
            Calculadora de Metrado
            {unit && (
              <span className="ml-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
                {unit}
              </span>
            )}
          </DialogTitle>
          {rowData.descripcion && (
            <DialogDescription className="truncate text-[11px] text-blue-100">
              {String(rowData.descripcion).trim()}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex flex-col gap-4 bg-white px-5 py-4 dark:bg-slate-900">
          <div>
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Descripcion
            </Label>
            <Input
              value={descripcion}
              placeholder="Ingresa la descripcion"
              onChange={(e) => setDescripcion(e.target.value)}
              className="mt-1 h-8 text-[12px]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Unidad y combinacion de calculo
            </Label>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {UNITS.map((candidate) => {
                const candidateProfile = UNIT_PROFILES[candidate];
                const selected = unit === candidate;

                return (
                  <button
                    key={candidate}
                    type="button"
                    onClick={() => {
                      setUnidad(candidate);
                      setUseCustom(false);
                    }}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-left transition-colors',
                      selected
                         ? 'border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-100'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300',
                    )}
                  >
                    <div className="text-[11px] font-bold uppercase">{candidate}</div>
                    <div className="mt-1 text-[10px] leading-relaxed">
                      {candidateProfile?.formula ?? DEFAULT_PROFILE.formula}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={cn(
            'flex items-center gap-2 rounded-xl px-3 py-2.5 text-[11px] font-medium',
            known
              ? 'border border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
              : 'border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-300',
          )}>
            {known ? (
              <span><strong>{unit}</strong>: {profile.formula}</span>
            ) : (
              <span className="flex items-center gap-1.5">
                <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                Unidad <strong>"{unit || 'sin unidad'}"</strong> no reconocida. Usa formula personalizada.
              </span>
            )}
          </div>

          <div>
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Valores de medicion
              {!useCustom && (
                <span className="ml-2 normal-case text-slate-300 dark:text-slate-600">
                  (campos marcados con * son requeridos para esta unidad)
                </span>
              )}
            </p>
            <div className="grid grid-cols-6 gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
              {ALL_INPUTS.map((key) => renderField(key))}
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setUseCustom((value) => !value)}
              className={cn(
                'mb-2 text-[10px] font-semibold transition-colors',
                useCustom ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
              )}
            >
              {useCustom ? '▼' : '▶'} Formula personalizada
            </button>

            {useCustom && (
              <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <div>
                  <Label className="text-[10px] text-slate-600 dark:text-slate-400">Expresion</Label>
                  <Input
                    className="mt-1 font-mono text-[11px]"
                    placeholder="ej: elsim * (largo + ancho + alto) * nveces"
                    value={customExpr}
                    onChange={(e) => setCustomExpr(e.target.value)}
                  />
                  {customErr && (
                    <p className="mt-1 text-[10px] text-red-500 dark:text-red-400">{customErr}</p>
                  )}
                </div>

                <div>
                  <Label className="text-[10px] text-slate-600 dark:text-slate-400">Escribe el resultado en:</Label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {OUTPUT_COLUMNS.map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setCustomOut(col)}
                        className={cn(
                          'rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors',
                          customOut === col
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-200 text-slate-500 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-400',
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

          <div className={cn(
            'rounded-xl border p-4 transition-all',
            hasResult
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
              : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/30',
          )}>
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Resultado
            </p>

            <div className="flex flex-wrap items-center gap-3">
              {(useCustom ? ALL_INPUTS : profile.activeInputs)
                .filter((key) => vals[key] !== 0)
                .map((key, idx, arr) => (
                  <React.Fragment key={key}>
                    <div className="text-center">
                      <p className="text-[9px] uppercase text-slate-400">{INPUT_LABELS[key]}</p>
                      <p className="font-mono text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                        {r4(vals[key]).toLocaleString('es-PE', { maximumFractionDigits: 4 })}
                      </p>
                    </div>
                    {idx < arr.length - 1 && (
                      <span className="text-[14px] text-slate-300 dark:text-slate-600">×</span>
                    )}
                  </React.Fragment>
                ))}

              {hasResult ? (
                <>
                  <span className="text-[14px] text-slate-300 dark:text-slate-600">=</span>
                  <div className="text-center">
                    <p className="text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                      {OUTPUT_LABELS[activeOut] ?? activeOut}
                    </p>
                    <p className="text-[22px] font-bold tabular-nums text-emerald-800 dark:text-emerald-300">
                      {outVal.toLocaleString('es-PE', { maximumFractionDigits: 4 })}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-[11px] text-slate-400">
                  Ingresa los valores para ver el resultado
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-slate-100 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
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
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40">
            <Calculator className="mr-1.5 h-3.5 w-3.5" />
            Aplicar a la fila
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
