// ═══════════════════════════════════════════════════
// CalcModal.tsx — Calculadora de Metrado COMPACTA
// ═══════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';
import { Calculator, TriangleAlert, FileText } from 'lucide-react';
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
  const [descripcion, setDescripcion] = useState('');

  //selector unidad
  const unitFromRow = String(rowData.unidad ?? '').trim().toLowerCase();
  const [selectedUnit, setSelectedUnit] = useState(unitFromRow);
  const [selectedProfileIndex, setSelectedProfileIndex] = useState(0);

  const profiles = useMemo(() => {
    return UNIT_PROFILES[selectedUnit] ?? [DEFAULT_PROFILE];
  }, [selectedUnit]);

  const known = useMemo(() => {
    return !!UNIT_PROFILES[selectedUnit];
  }, [selectedUnit]);

  const profile = useMemo(() => {
    return profiles[selectedProfileIndex] ?? DEFAULT_PROFILE;
  }, [profiles, selectedProfileIndex]);

  useEffect(() => {
    if (!open) return;
    setSelectedUnit(unitFromRow);
    setVals({
      elsim:  toNum(rowData.elsim),
      largo:  toNum(rowData.largo),
      ancho:  toNum(rowData.ancho),
      alto:   toNum(rowData.alto),
      nveces: toNum(rowData.nveces) || 1,
      kg:     toNum(rowData.kg),
    });
    setDescripcion(String(rowData.descripcion ?? '').trim());
    setCustomExpr('');
    setCustomErr('');
    setUseCustom(!unitFromRow || !known);
    setSelectedProfileIndex(0);
  }, [open, unitFromRow, known]);

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
  const hasResult = Object.values(vals).some(v => v !== 0);

  const renderField = (key: keyof MeasureInputs) => {
    const isActive = useCustom ? true : profile.activeInputs.includes(key);
    return (
      <div key={key} className={cn('flex flex-col gap-1', !isActive && 'opacity-40')}>
        <Label className={cn(
          'text-[9px] font-semibold uppercase tracking-wider',
          isActive ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600',
        )}>
          {INPUT_LABELS[key]}
          {isActive && <span className="ml-1 text-blue-500">*</span>}
        </Label>
        <Input
          type="number"
          step="any"
          value={vals[key] ?? ''}
          placeholder="0"
          onChange={(e) => setVals((v) => ({ ...v, [key]: toNum(e.target.value) }))}
          className={cn(
            'h-7 text-right font-mono text-[11px]',
            isActive 
              ? 'border-slate-300 focus:border-blue-500 dark:border-slate-600' 
              : 'border-slate-200 bg-slate-50/50 dark:bg-slate-800/30 dark:border-slate-700',
          )}
        />
      </div>
    );
  };

  const activeOut = useCustom ? customOut : profile.outputKey;

  return (
    <Dialog open={open} onOpenChange={onClose} modal>
      <DialogContent
        className="fixed left-1/2 top-1/2 z-[99999] w-[750px] max-w-[95vw] max-h-[90vh]
                  -translate-x-1/2 -translate-y-1/2
                  gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-2xl"
      >
        {/* Header */}
        <DialogHeader className="border-b border-slate-100 bg-gradient-to-r
          from-blue-600 to-blue-700 px-4 py-3 dark:border-slate-800">
          <DialogTitle className="flex items-center gap-2 text-[13px] font-bold text-white">
            <Calculator className="h-4 w-4" />
            Calculadora de Metrado
            {selectedUnit && (
              <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5
                text-[9px] font-bold uppercase tracking-widest text-white">
                {selectedUnit}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Contenido scrollable */}
        <div className="flex flex-col gap-3 bg-white px-4 py-3 dark:bg-slate-900 overflow-y-auto max-h-[calc(90vh-140px)]">
          
          {/* Descripción */}
          <div>
            <Label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Descripción
            </Label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción del ítem..."
              rows={1}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] text-slate-700 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          {/* Selector Unidad y Versión */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1 block">
                Unidad
              </Label>
              <select
                value={selectedUnit}
                onChange={(e) => {
                  setSelectedUnit(e.target.value);
                  setSelectedProfileIndex(0);
                  setUseCustom(!UNIT_PROFILES[e.target.value]);
                }}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[12px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Seleccionar...</option>
                {Object.keys(UNIT_PROFILES).sort().map((u) => (
                  <option key={u} value={u}>{u.toUpperCase()}</option>
                ))}
              </select>
            </div>

            {selectedUnit && profiles.length > 1 && (
              <div>
                <Label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1 block">
                  Versión
                </Label>
                <div className="flex gap-1 flex-wrap">
                  {profiles.map((p, i) => (
                    <button
                      key={p.key}
                      onClick={() => { setSelectedProfileIndex(i); setUseCustom(false); }}
                      className={cn(
                        'flex-1 min-w-[40px] h-8 px-1.5 rounded-lg text-[10px] font-bold border',
                        i === selectedProfileIndex
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                      )}
                    >
                      V{i + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Preview Fórmula */}
          {selectedUnit && known && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-2 dark:border-blue-800 dark:bg-blue-950/30">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[8px] font-bold uppercase text-blue-600 dark:text-blue-400">
                  {profiles[selectedProfileIndex]?.label}
                </span>
                <span className="text-[7px] text-blue-400">•</span>
                <span className="text-[8px] text-blue-600/70 dark:text-blue-400/70">
                  {profile.activeInputs.map(k => INPUT_LABELS[k]).join(' + ')}
                </span>
              </div>
              <p className="text-[11px] font-mono font-semibold text-blue-800 dark:text-blue-300">
                {profile.formula}
              </p>
            </div>
          )}

          {/* Alerta */}
          {!selectedUnit || (!known && !useCustom) ? (
            <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/30">
              <TriangleAlert className="h-3 w-3 shrink-0" />
              Unidad no reconocida. Usa fórmula personalizada.
            </div>
          ) : null}

          {/* Campos */}
          <div>
            <p className="mb-1.5 text-[8px] font-bold uppercase tracking-widest text-slate-400">
              Valores {!useCustom && known && <span className="normal-case text-slate-300">(* requeridos)</span>}
            </p>
            <div className="grid grid-cols-6 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/50">
              {ALL_INPUTS.map((key) => renderField(key))}
            </div>
          </div>

          {/* Fórmula personalizada toggle */}
          <button
            onClick={() => setUseCustom((v) => !v)}
            className={cn('text-[9px] font-semibold', useCustom ? 'text-blue-600' : 'text-slate-400')}
          >
            {useCustom ? '▼' : '▶'} Fórmula personalizada
          </button>

          {useCustom && (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/50">
              <div>
                <Label className="text-[9px] text-slate-600 dark:text-slate-400">
                  Expresión (vars: elsim, largo, ancho, alto, nveces, kg, Math)
                </Label>
                <Input
                  className="mt-0.5 font-mono text-[10px] h-7"
                  placeholder="ej: elsim * largo * ancho"
                  value={customExpr}
                  onChange={(e) => setCustomExpr(e.target.value)}
                />
                {customErr && <p className="mt-0.5 text-[9px] text-red-500">{customErr}</p>}
              </div>
              <div>
                <Label className="text-[9px] text-slate-600 dark:text-slate-400">Resultado en:</Label>
                <div className="mt-0.5 flex gap-1">
                  {(['lon', 'area', 'vol', 'kg', 'und'] as (keyof MeasureOutputs)[]).map((col) => (
                    <button
                      key={col}
                      onClick={() => setCustomOut(col)}
                      className={cn(
                        'flex-1 rounded px-1.5 py-1 text-[9px] font-bold uppercase',
                        customOut === col ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700'
                      )}
                    >
                      {OUTPUT_LABELS[col]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Resultado */}
          <div className={cn(
            'rounded-lg border p-3',
            hasResult ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/30',
          )}>
            <p className="mb-1.5 text-[8px] font-bold uppercase tracking-widest text-slate-400">Resultado</p>
            <div className="flex flex-wrap items-center gap-2">
              {(useCustom ? ALL_INPUTS : profile.activeInputs)
                .filter((k) => vals[k] !== 0)
                .map((k, idx, arr) => (
                  <React.Fragment key={k}>
                    <div className="text-center">
                      <p className="text-[8px] uppercase text-slate-400">{INPUT_LABELS[k]}</p>
                      <p className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        {r4(vals[k])}
                      </p>
                    </div>
                    {idx < arr.length - 1 && <span className="text-[12px] text-slate-300">×</span>}
                  </React.Fragment>
                ))}
              {hasResult && (
                <>
                  <span className="text-[12px] text-slate-300">=</span>
                  <div className="text-center">
                    <p className="text-[8px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                      {OUTPUT_LABELS[activeOut]}
                    </p>
                    <p className="text-[18px] font-bold text-emerald-800 dark:text-emerald-300">
                      {outVal.toLocaleString('es-PE', { maximumFractionDigits: 4 })}
                    </p>
                  </div>
                </>
              )}
              {!hasResult && <p className="text-[10px] text-slate-400">Ingresa valores</p>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="gap-2 border-t border-slate-100 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-[11px]">
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!hasResult}
            onClick={() => {
              onApply({ 
                ri, 
                inputs: vals, 
                outputs: useCustom ? { [customOut]: outVal } : profile.fn(vals), 
                descripcion: descripcion.trim(),
                total: outVal,
                unidad: selectedUnit,  
              });
              onClose();
            }}
                        className="h-8 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-[11px]"
          >
            <Calculator className="mr-1 h-3 w-3" />
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}