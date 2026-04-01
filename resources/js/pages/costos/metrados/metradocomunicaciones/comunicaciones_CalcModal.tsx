import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator, TriangleAlert, X, Save, Trash2 } from 'lucide-react';
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

const FORMULA_VARIABLES = [
  { key: 'elsim', label: 'Elem.Sim.', desc: 'Elemento Similar' },
  { key: 'largo', label: 'Largo', desc: 'Largo' },
  { key: 'ancho', label: 'Ancho', desc: 'Ancho' },
  { key: 'alto', label: 'Alto', desc: 'Alto' },
  { key: 'nveces', label: 'N°Veces', desc: 'Número de veces' },
  { key: 'long', label: 'Long.', desc: 'Longitud' },
  { key: 'area', label: 'Área', desc: 'Área' },
  { key: 'vol', label: 'Vol.', desc: 'Volumen' },
  { key: 'kg', label: 'Kg.', desc: 'Kilogramos' },
  { key: 'parcial', label: 'Parcial', desc: 'Parcial' },
];

const OPERATORS = [
  { symbol: '+', label: 'Suma' },
  { symbol: '-', label: 'Resta' },
  { symbol: '*', label: 'Multiplicación' },
  { symbol: '/', label: 'División' },
  { symbol: '(', label: 'Paréntesis apertura' },
  { symbol: ')', label: 'Paréntesis cierre' },
];

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
    elsim: 0, largo: 0, ancho: 0, alto: 0, nveces: 1, kg: 0, kgm: 0,
  });
  const [customExpr, setCustomExpr] = useState('');
  const [customErr, setCustomErr] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [customOut, setCustomOut] = useState<keyof MeasureOutputs>('und');
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [formulaName, setFormulaName] = useState('');
  const [savedFormulas, setSavedFormulas] = useState<Array<{ id: string; name: string; expression: string }>>([]);

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
      alto: toNum(rowData.alto), nveces: toNum(rowData.nveces) || 1, kg: toNum(rowData.kg), kgm: 0,
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

  const addToFormula = (text: string) => {
    setCustomExpr(prev => prev + text);
  };

  const saveFormula = () => {
    if (!formulaName.trim() || !customExpr.trim()) return;
    const newFormula = {
      id: Date.now().toString(),
      name: formulaName,
      expression: customExpr,
    };
    setSavedFormulas(prev => [...prev, newFormula]);
    setFormulaName('');
  };

  const clearFormula = () => {
    setCustomExpr('');
    setCustomErr('');
  };

  const loadFormula = (formula: { id: string; name: string; expression: string }) => {
    setCustomExpr(formula.expression);
    setFormulaName(formula.name);
  };

  const deleteFormula = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedFormulas(prev => prev.filter(f => f.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={cn(
        "z-[9999] w-[95vw] max-w-[1300px] min-w-[1100px]",
        "gap-0 rounded-lg border-0 bg-slate-900 shadow-2xl",
        "flex flex-col max-h-[95vh]"
      )}>
        
        {/* HEADER */}
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

        {/* CONTENIDO */}
        <div className="px-5 py-3 space-y-3 overflow-y-auto">
          
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
                onChange={(e) => { 
                  setUnidad(e.target.value); 
                  const profiles = UNIT_PROFILES[e.target.value];
                  setSelectedVersion(profiles?.[0]?.key ?? '');
                }}
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

          {/* Fila 2: Fórmula Genérica */}
          {!useCustom && (
            <>
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {profile.label || 'FÓRMULA GENÉRICA'}
                </div>
                <div className="mt-0.5 text-xs font-medium text-blue-300">
                  {profile.formula || 'Ingresa los valores y selecciona fórmula personalizada'}
                </div>
              </div>

              {/* Inputs */}
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
            </>
          )}

          {/* Checkbox de Fórmula Personalizada */}
          <div className="flex items-center gap-2.5 py-2 border-t border-slate-700">
            <input
              type="checkbox"
              id="custom-formula-toggle"
              checked={useCustom}
              onChange={(e) => setUseCustom(e.target.checked)}
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="custom-formula-toggle" className="text-sm font-bold text-blue-400 cursor-pointer hover:text-blue-300 transition-colors">
              Usar Fórmula Personalizada
            </label>
          </div>

          {/* Fila 3: Fórmula Personalizada */}
          {useCustom && (
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              
              {/* HEADER: Nombre + Botones */}
              <div className="flex items-center justify-between border-b border-slate-600 pb-2">
                <div className="text-sm font-bold text-slate-200">
                  Constructor de Fórmula
                </div>
                <div className="flex gap-1.5">
                  <Input
                    value={formulaName}
                    onChange={(e) => setFormulaName(e.target.value)}
                    placeholder="Nombre fórmula..."
                    className="h-7 border-slate-600 bg-slate-800 text-xs text-slate-100 placeholder:text-slate-500 w-40"
                  />
                  <Button
                    size="sm"
                    onClick={saveFormula}
                    disabled={!formulaName.trim() || !customExpr.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-xs h-7 px-2"
                  >
                    <Save className="h-3.5 w-3.5 mr-1" />
                    Guardar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={clearFormula}
                    className="border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs h-7 px-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* FILA 1: Variables + Operadores */}
              <div className="rounded-lg border border-slate-600 bg-slate-800 p-2">
                <div className="flex gap-4">
                  {/* Columna izquierda: Variables */}
                  <div className="flex-1">
                    <div className="text-[9px] font-bold uppercase text-slate-400 mb-2">
                      Variables disponibles (click para agregar):
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {FORMULA_VARIABLES.map((variable) => (
                        <button
                          key={variable.key}
                          type="button"
                          onClick={() => addToFormula(variable.key)}
                          title={variable.desc}
                          className={cn(
                            "rounded px-2 py-1.5 text-[9px] font-bold transition-all border",
                            "bg-slate-700 text-slate-200 hover:bg-blue-600 hover:text-white",
                            "border-slate-600 hover:border-blue-500"
                          )}
                        >
                          {variable.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Separador */}
                  <div className="w-px bg-slate-600" />
                  
                  {/* Columna derecha: Operadores */}
                  <div className="flex flex-col items-start">
                    <div className="text-[9px] font-bold uppercase text-orange-400 mb-2">
                      Operadores:
                    </div>
                    <div className="flex gap-1">
                      {OPERATORS.map((op) => (
                        <button
                          key={op.symbol}
                          type="button"
                          onClick={() => addToFormula(op.symbol)}
                          title={op.label}
                          className={cn(
                            "rounded px-3 py-1.5 text-sm font-bold transition-all border",
                            "bg-slate-700 text-orange-300 hover:bg-orange-600 hover:text-white",
                            "border-slate-600 hover:border-orange-500"
                          )}
                        >
                          <span className="text-lg font-bold">{op.symbol}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {/* FILA 2: Valores de Entrada + Inputs */}
              <div className="rounded-lg border border-slate-600 bg-slate-800 p-2">
                <div className="text-[9px] font-bold uppercase text-emerald-400 mb-2">
                  Valores de Entrada:
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {ALL_INPUTS.map((key) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-[8px] font-medium uppercase text-slate-400 text-center block">
                        {INPUT_LABELS[key]}
                      </Label>
                      <Input
                        type="number"
                        step="any"
                        value={vals[key] === 0 ? '' : vals[key]}
                        placeholder="0"
                        onChange={(e) => setVals((v) => ({ ...v, [key]: toNum(e.target.value) }))}
                        className="h-8 text-center font-mono text-xs font-bold border-slate-600 bg-slate-700 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* FILA 4: Expresión construida */}
              <div className="rounded-lg border border-blue-600/50 bg-slate-900 p-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[9px] font-bold uppercase text-slate-400">
                    Expresión construida :
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomExpr('')}
                    className="text-[9px] text-red-400 hover:text-red-300 transition-colors px-2 py-0.5 rounded hover:bg-red-950/30"
                  >
                    Limpiar
                  </button>
                </div>
                <Input
                  value={customExpr}
                  onChange={(e) => setCustomExpr(e.target.value)}
                  placeholder="Click en variables y operadores o escribe directamente..."
                  className="font-mono text-sm text-blue-300 bg-slate-800 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 h-10"
                />
              </div>

              {/* FILA 5: Resultado en */}
              <div className="rounded-lg border border-slate-600 bg-slate-800 p-2">
                <div className="text-[9px] font-bold uppercase text-slate-400 mb-2">
                  Resultado en:
                </div>
                <div className="flex gap-2">
                  {OUTPUT_COLUMNS.map((col) => {
                    const isActive = String(customOut) === String(col);
                    return (
                      <button
                        key={col}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setCustomOut(col as keyof MeasureOutputs);
                          setTimeout(() => {
                          }, 0);
                        }}
                        className={cn(
                          'rounded px-3 py-2 text-[9px] font-bold uppercase transition-all border cursor-pointer select-none',
                          isActive
                            ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-500/40 ring-2 ring-blue-400/50 scale-[1.02]'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white border-slate-600 hover:border-slate-500'
                        )}
                      >
                        {OUTPUT_LABELS[col] ?? col.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
                
                {/* Debug visual */}
                <div className="text-[8px] text-slate-500 mt-2 flex items-center gap-2 flex-wrap">
                  <span>Output:</span>
                  <span className="px-2 py-0.5 rounded font-mono bg-blue-950/50 text-blue-400 border border-blue-600/30">
                    {customOut}
                  </span>
                  <span>→</span>
                  <span className="px-2 py-0.5 rounded font-bold bg-emerald-950/50 text-emerald-400 border border-emerald-600/30">
                    {OUTPUT_LABELS[customOut] ?? customOut}
                  </span>
                </div>
              </div>

              {/* FILA 6: Fórmulas guardadas */}
              {savedFormulas.length > 0 && (
                <div className="rounded-lg border border-slate-600 bg-slate-800/50 p-2">
                  <div className="text-[9px] font-bold uppercase text-slate-400 mb-2 border-b border-slate-600 pb-1">
                    Fórmulas Guardadas (click para cargar):
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {savedFormulas.map((formula) => (
                      <div
                        key={formula.id}
                        onClick={() => loadFormula(formula)}
                        className="flex items-center gap-2 rounded bg-slate-700/50 px-3 py-2 cursor-pointer hover:bg-slate-700 transition-colors border border-slate-600"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-medium text-slate-200">
                            {formula.name}
                          </div>
                          <div className="text-[8px] text-slate-400 font-mono">
                            {formula.expression}
                          </div>
                        </div>
                        <button
                          onClick={(e) => deleteFormula(formula.id, e)}
                          className="text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error */}
              {customErr && (
                <p className="flex items-center gap-1 text-[10px] text-red-400 bg-red-950/30 rounded px-2 py-1 border border-red-600/30">
                  <TriangleAlert className="h-3 w-3" /> {customErr}
                </p>
              )}
            </div>
          )}

          {/* Fila 4: RESULTADO */}
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

        {/* FOOTER */}
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
                outputs: useCustom ? { [activeOut]: outVal } : profile.fn(vals),
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