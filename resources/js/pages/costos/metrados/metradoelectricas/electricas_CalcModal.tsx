// ═══════════════════════════════════════════════════
// CalcModal.tsx — Calculadora de Metrado con campos
//                 adaptados por unidad
// ═══════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';
import { Calculator, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

import {
  ALL_INPUTS, DEFAULT_PROFILE, INPUT_LABELS, OUTPUT_LABELS,
  UNIT_PROFILES,
} from './electricas_constants';
import type { CalcPayload, MeasureInputs, MeasureOutputs } from './electricas_types';
import { r4, toNum } from './electricas_utils';

// ── Props ─────────────────────────────────────────────────────
export interface CalcModalProps {
  open:    boolean;
  ri:      number;
  rowData: Record<string, any>;
  onClose: () => void;
  onApply: (payload: CalcPayload) => void;
}

// ══════════════════════════════════════════════════════════════
// CalcModal
// ══════════════════════════════════════════════════════════════
export function CalcModal({ open, ri, rowData, onClose, onApply }: CalcModalProps) {
  const [vals, setVals] = useState<MeasureInputs>({
    elsim: 0, largo: 0, ancho: 0, alto: 0, nveces: 1, kg: 0,
  });
  const [customExpr, setCustomExpr] = useState('');
  const [customErr,  setCustomErr]  = useState('');
  const [useCustom,  setUseCustom]  = useState(false);
  const [customOut,  setCustomOut]  = useState<keyof MeasureOutputs>('und');

  const unit    = String(rowData.unidad ?? '').trim().toLowerCase();
  const profile = UNIT_PROFILES[unit] ?? DEFAULT_PROFILE;
  const known   = !!UNIT_PROFILES[unit];

  // Inicializar valores al abrir
  useEffect(() => {
    if (!open) return;
    setVals({
      elsim:  toNum(rowData.elsim),
      largo:  toNum(rowData.largo),
      ancho:  toNum(rowData.ancho),
      alto:   toNum(rowData.alto),
      nveces: toNum(rowData.nveces) || 1,
      kg:     toNum(rowData.kg),
    });
    setCustomExpr('');
    setCustomErr('');
    setUseCustom(!known);
  }, [open]); // eslint-disable-line

  // Resultado en vivo
  const preview = useMemo((): MeasureOutputs => {
    if (!useCustom) {
      try { return profile.fn(vals); } catch { return {}; }
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
      setCustomErr(e.message ?? 'Error en expresión');
      return {};
    }
  }, [useCustom, profile, vals, customExpr, customOut]);

  const outVal = r4((preview[profile.outputKey] ?? preview[customOut] ?? 0) as number);
  const hasResult = outVal !== 0;

  // ── Renderizar campo de input ──────────────────────────────
  const renderField = (key: keyof MeasureInputs) => {
    const isActive = useCustom
      ? true
      : profile.activeInputs.includes(key);

    return (
      <div key={key} className={cn('flex flex-col gap-1', !isActive && 'opacity-30')}>
        <Label className={cn(
          'text-[10px] font-semibold uppercase tracking-wider',
          isActive
            ? 'text-slate-600 dark:text-slate-300'
            : 'text-slate-400 dark:text-slate-600',
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
          onChange={(e) => setVals((v) => ({ ...v, [key]: toNum(e.target.value) }))}
          className={cn(
            'h-8 text-right font-mono text-[12px]',
            !isActive && 'cursor-not-allowed bg-slate-50 dark:bg-slate-900',
          )}
        />
      </div>
    );
  };

  const activeOut = useCustom ? customOut : profile.outputKey;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        // z-[9999] garantiza que el modal siempre quede sobre Luckysheet
        className="z-[9999] max-w-[680px] gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-2xl"
        style={{ zIndex: 9999 }}
      >
        {/* ── Header ── */}
        <DialogHeader className="border-b border-slate-100 bg-gradient-to-r
          from-blue-600 to-blue-700 px-5 py-4 dark:border-slate-800">
          <DialogTitle className="flex items-center gap-2 text-[14px] font-bold text-white">
            <Calculator className="h-4.5 w-4.5" />
            Calculadora de Metrado
            {unit && (
              <span className="ml-1 rounded-full bg-white/20 px-2.5 py-0.5
                text-[10px] font-bold uppercase tracking-widest text-white">
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
          {/* ── Fórmula activa ── */}
          <div className={cn(
            'flex items-center gap-2 rounded-xl px-3 py-2.5 text-[11px] font-medium',
            known
              ? 'border border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
              : 'border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-300',
          )}>
            {known
              ? <span>📐 <strong>{unit}</strong>: {profile.formula}</span>
              : (
                <span className="flex items-center gap-1.5">
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                  Unidad <strong>"{unit || 'sin unidad'}"</strong> no reconocida.
                  Usa la fórmula personalizada abajo.
                </span>
              )}
          </div>

          {/* ── Campos de entrada ── */}
          <div>
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Valores de medición
              {!useCustom && (
                <span className="ml-2 normal-case text-slate-300 dark:text-slate-600">
                  (campos marcados con * son requeridos para esta unidad)
                </span>
              )}
            </p>
            <div className="grid grid-cols-6 gap-2.5 rounded-xl border border-slate-200
              bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
              {ALL_INPUTS.map((key) => renderField(key))}
            </div>
          </div>

          {/* ── Fórmula personalizada (opcional) ── */}
          <div>
            <button
              type="button"
              onClick={() => setUseCustom((v) => !v)}
              className={cn(
                'mb-2 text-[10px] font-semibold transition-colors',
                useCustom
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
              )}
            >
              {useCustom ? '▼' : '▶'} Fórmula personalizada
            </button>

            {useCustom && (
              <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50
                p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <div>
                  <Label className="text-[10px] text-slate-600 dark:text-slate-400">
                    Expresión
                    <span className="ml-1.5 font-normal text-slate-400">
                      vars: elsim, largo, ancho, alto, nveces, kg, Math
                    </span>
                  </Label>
                  <Input
                    className="mt-1 font-mono text-[11px]"
                    placeholder="ej: elsim * largo * ancho * nveces"
                    value={customExpr}
                    onChange={(e) => setCustomExpr(e.target.value)}
                  />
                  {customErr && (
                    <p className="mt-1 text-[10px] text-red-500 dark:text-red-400">{customErr}</p>
                  )}
                </div>

                <div>
                  <Label className="text-[10px] text-slate-600 dark:text-slate-400">
                    Escribe el resultado en:
                  </Label>
                  <div className="mt-1.5 flex gap-1.5">
                    {(['lon', 'area', 'vol', 'kg', 'und'] as (keyof MeasureOutputs)[]).map((col) => (
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

          {/* ── Resultado ── */}
          <div className={cn(
            'rounded-xl border p-4 transition-all',
            hasResult
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
              : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/30',
          )}>
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Resultado
            </p>

            {/* Inputs activos que tienen valor */}
            <div className="flex flex-wrap items-center gap-3">
              {(useCustom ? ALL_INPUTS : profile.activeInputs)
                .filter((k) => vals[k] !== 0)
                .map((k, idx, arr) => (
                  <React.Fragment key={k}>
                    <div className="text-center">
                      <p className="text-[9px] uppercase text-slate-400">{INPUT_LABELS[k]}</p>
                      <p className="font-mono text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                        {r4(vals[k]).toLocaleString('es-PE', { maximumFractionDigits: 4 })}
                      </p>
                    </div>
                    {idx < arr.length - 1 && (
                      <span className="text-[14px] text-slate-300 dark:text-slate-600">×</span>
                    )}
                  </React.Fragment>
                ))}

              {hasResult && (
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
              )}

              {!hasResult && (
                <p className="text-[11px] text-slate-400">
                  Ingresa los valores para ver el resultado
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <DialogFooter className="gap-2 border-t border-slate-100 bg-white px-5 py-3
          dark:border-slate-800 dark:bg-slate-900">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!hasResult}
            onClick={() => {
              onApply({
                ri,
                inputs: vals,
                outputs: useCustom
                  ? { [customOut]: outVal }
                  : profile.fn(vals),
              });
              onClose();
            }}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40"
          >
            <Calculator className="mr-1.5 h-3.5 w-3.5" />
            Aplicar a la fila
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
