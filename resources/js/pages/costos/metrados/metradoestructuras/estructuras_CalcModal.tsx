import { Calculator, TriangleAlert, X, Save, Trash2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import {
    ALL_INPUTS,
    DEFAULT_PROFILE,
    INPUT_LABELS,
    OUTPUT_LABELS,
    UNITS,
    UNIT_PROFILES,
} from './estructuras_constants';
import type {
    CalcPayload,
    MeasureInputs,
    MeasureOutputs,
    UnitProfile,
} from './estructuras_types';
import { buildRowFormulaMeta, r4, toNum } from './estructuras_utils';

const FORMULA_VARIABLES = [
    { key: 'elsim', label: 'Elem.Sim.', desc: 'Elemento Similar' },
    { key: 'largo', label: 'Largo', desc: 'Largo' },
    { key: 'ancho', label: 'Ancho', desc: 'Ancho' },
    { key: 'alto', label: 'Alto', desc: 'Alto' },
    { key: 'nveces', label: 'N°Veces', desc: 'Número de veces' },
    { key: 'kgm', label: 'kg/m', desc: 'Peso por metro (kg/m)' },
    { key: 'kg', label: 'Kg.', desc: 'Kilogramos' },
    { key: 'lon', label: 'Long.', desc: 'Longitud' },
    { key: 'area', label: 'Área', desc: 'Área' },
    { key: 'vol', label: 'Vol.', desc: 'Volumen' },
    { key: 'und', label: 'Und.', desc: 'Unidad/Parcial' },
];

const OPERATORS = [
    { symbol: '+', label: 'Suma' },
    { symbol: '-', label: 'Resta' },
    { symbol: '*', label: 'Multiplicación' },
    { symbol: '/', label: 'División' },
    { symbol: '(', label: 'Paréntesis apertura' },
    { symbol: ')', label: 'Paréntesis cierre' },
];

//detectar variables se usan en una fórmula personalizada
const detectVariablesInFormula = (
    expression: string,
): (keyof MeasureInputs)[] => {
    const variables: (keyof MeasureInputs)[] = [];
    const allVars: (keyof MeasureInputs)[] = [
        'elsim',
        'largo',
        'ancho',
        'alto',
        'nveces',
        'kg',
        'kgm',
    ];

    allVars.forEach((variable) => {
        const regex = new RegExp(`\\b${variable}\\b`, 'g');
        if (regex.test(expression)) {
            variables.push(variable);
        }
    });

    return variables.length > 0 ? variables : ALL_INPUTS;
};

const createCustomProfile = (
    formula: {
        id: string;
        name: string;
        expression: string;
        activeInputs?: (keyof MeasureInputs)[];
    },
    unit: string,
): UnitProfile => {
    const activeInputs =
        formula.activeInputs || detectVariablesInFormula(formula.expression);

    return {
        key: `custom_${formula.id}`,
        label: `★ ${formula.name.slice(0, 20)}${formula.name.length > 20 ? '...' : ''}`,
        activeInputs,
        outputKey: 'und',
        formula: formula.expression,
        fn: (v) => {
            try {
                const { elsim, largo, ancho, alto, nveces, kg, kgm } = v;
                 
                const result = new Function(
                    'elsim',
                    'largo',
                    'ancho',
                    'alto',
                    'nveces',
                    'kg',
                    'kgm',
                    'Math',
                    `"use strict"; return (${formula.expression});`,
                )(elsim, largo, ancho, alto, nveces, kg, kgm, Math);
                return { und: Number(result) };
            } catch {
                return { und: 0 };
            }
        },
    };
};

export interface CalcModalProps {
    open: boolean;
    ri: number;
    rowData: Record<string, any>;
    onClose: () => void;
    onApply: (payload: CalcPayload) => void;
}

const OUTPUT_COLUMNS: (keyof MeasureOutputs)[] = [
    'lon',
    'area',
    'vol',
    'kg',
    'und',
];

export function CalcModal({
    open,
    ri,
    rowData,
    onClose,
    onApply,
}: CalcModalProps) {
    const [descripcion, setDescripcion] = useState('');
    const [unidad, setUnidad] = useState('und');
    const [vals, setVals] = useState<MeasureInputs>({
        elsim: 0,
        largo: 0,
        ancho: 0,
        alto: 0,
        nveces: 1,
        kg: 0,
        kgm: 0,
    });
    const [customExpr, setCustomExpr] = useState('');
    const [customErr, setCustomErr] = useState('');
    const [useCustom, setUseCustom] = useState(false);
    const [customOut, setCustomOut] = useState<keyof MeasureOutputs>('und');
    const [selectedVersion, setSelectedVersion] = useState<string>('');
    const [formulaName, setFormulaName] = useState('');

    // Cargar fórmulas guardadas
    const [savedFormulas, setSavedFormulas] = useState<
        Array<{
            id: string;
            name: string;
            expression: string;
            activeInputs?: (keyof MeasureInputs)[];
        }>
    >(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('customFormulas');
            return stored ? JSON.parse(stored) : [];
        }
        return [];
    });

    // Guardar fórmulas en localStorage
    useEffect(() => {
        localStorage.setItem('customFormulas', JSON.stringify(savedFormulas));
    }, [savedFormulas]);

    const unit = unidad.trim().toLowerCase();
    const unitProfiles = UNIT_PROFILES[unit] ?? [DEFAULT_PROFILE];
    const known = !!UNIT_PROFILES[unit];

    // Fusiona perfiles nativos + fórmulas guardadas para la unidad actual
    const mergedProfiles = useMemo(() => {
        const base = UNIT_PROFILES[unit] ?? [DEFAULT_PROFILE];
        const customs = savedFormulas.map((f) => createCustomProfile(f, unit));
        return [...base, ...customs];
    }, [unit, savedFormulas]);

    const profile = useMemo(() => {
        const selected = selectedVersion
            ? mergedProfiles.find((p) => p.key === selectedVersion)
            : mergedProfiles[0];
        return selected ?? DEFAULT_PROFILE;
    }, [mergedProfiles, selectedVersion]);

    const activeOut = profile.outputKey;

    useEffect(() => {
        if (!open) return;

        const incomingUnit = String(rowData.unidad ?? '')
            .trim()
            .toLowerCase();
        setDescripcion(String(rowData.descripcion ?? '').trim());
        setUnidad(incomingUnit || 'und');
        setVals({
            elsim: toNum(rowData.elsim),
            largo: toNum(rowData.largo),
            ancho: toNum(rowData.ancho),
            alto: toNum(rowData.alto),
            nveces: toNum(rowData.nveces) || 1,
            kg: toNum(rowData.kg),
            kgm: toNum(rowData.kgm),
        });
        setCustomExpr(String(rowData._formula_expr ?? ''));
        setCustomErr('');
        const hasProfiles = !!UNIT_PROFILES[incomingUnit];
        const storedFormulaKey = String(rowData._formula_key ?? '').trim();
        const storedFormulaOutput = String(
            rowData._formula_output ?? 'und',
        ) as keyof MeasureOutputs;
        const isStoredCustom =
            !!rowData._formula_expr ||
            storedFormulaKey.startsWith('custom_') ||
            storedFormulaKey === 'custom_inline';
        setUseCustom(isStoredCustom || (incomingUnit ? !hasProfiles : false));
        setFormulaName(String(rowData._formula_label ?? ''));

        // Selecciona primera versión disponible (nativa o custom)
        const profiles = UNIT_PROFILES[incomingUnit];
        const availableProfiles = profiles ?? [DEFAULT_PROFILE];
        const customs = savedFormulas.map((f) =>
            createCustomProfile(f, incomingUnit),
        );
        const allProfiles = [...availableProfiles, ...customs];

        if (storedFormulaKey) {
            setSelectedVersion(storedFormulaKey);
        } else if (allProfiles[0]?.key) {
            setSelectedVersion(allProfiles[0].key);
        } else {
            setSelectedVersion('');
        }
        setCustomOut(storedFormulaOutput);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, rowData]);

    const preview = useMemo((): MeasureOutputs => {
        try {
            return profile.fn(vals);
        } catch {
            return {};
        }
    }, [profile, vals]);

    const outVal = r4((preview[activeOut] ?? 0) as number);
    const hasResult = outVal !== 0;
    const formulaPreview = useMemo(() => {
        const appliedOutputKey = useCustom ? customOut : activeOut;
        const appliedFormulaKey = useCustom
            ? 'custom_inline'
            : selectedVersion || profile.key;
        const appliedFormulaExpression = useCustom
            ? customExpr
            : selectedVersion.startsWith('custom_')
              ? profile.formula
              : '';
        const appliedFormulaLabel = useCustom
            ? formulaName.trim() || customExpr
            : profile.formula || profile.label;

        return buildRowFormulaMeta({
            rowIndex: ri + 1,
            outputKey: appliedOutputKey,
            formulaKey: appliedFormulaKey,
            formulaExpression: appliedFormulaExpression,
            formulaLabel: appliedFormulaLabel,
            fallbackProfile: profile,
            value: outVal,
        });
    }, [
        activeOut,
        customExpr,
        customOut,
        formulaName,
        outVal,
        profile,
        ri,
        selectedVersion,
        useCustom,
    ]);

    const activeInputs = useCustom ? ALL_INPUTS : profile.activeInputs;

    const addToFormula = (text: string) => {
        setCustomExpr((prev) => prev + text);
    };

    const saveFormula = () => {
        if (!formulaName.trim() || !customExpr.trim()) return;

        const activeInputs = detectVariablesInFormula(customExpr);

        const newFormula = {
            id: Date.now().toString(),
            name: formulaName,
            expression: customExpr,
            activeInputs,
        };
        setSavedFormulas((prev) => [...prev, newFormula]);
        setFormulaName('');
    };

    const clearFormula = () => {
        setCustomExpr('');
        setCustomErr('');
    };

    const loadFormula = (formula: {
        id: string;
        name: string;
        expression: string;
    }) => {
        setCustomExpr(formula.expression);
        setFormulaName(formula.name);
        setUseCustom(true);
        const customKey = `custom_${formula.id}`;
        setSelectedVersion(customKey);
    };

    const deleteFormula = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSavedFormulas((prev) => prev.filter((f) => f.id !== id));
        // Si la fórmula eliminada está seleccionada, limpiar selección
        if (selectedVersion === `custom_${id}`) {
            setSelectedVersion('');
            setUseCustom(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent
                aria-describedby="calc-modal-description"
                className={cn(
                    'z-[9999] w-[95vw] max-w-[1300px] min-w-[1100px]',
                    'gap-0 rounded-lg border-0 bg-slate-900 shadow-2xl',
                    'flex max-h-[95vh] flex-col',
                )}
            >
                {/* HEADER */}
                <DialogHeader className="flex-shrink-0 border-b border-slate-700 bg-blue-700 px-5 py-2.5">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="flex items-center gap-2 text-base font-bold text-white">
                            <Calculator className="h-5 w-5" />
                            Calculadora de Metrado
                            <span className="rounded bg-blue-800 px-2.5 py-0.5 text-xs font-bold text-blue-100 uppercase">
                                {unit}
                            </span>
                        </DialogTitle>
                    </div>
                </DialogHeader>

                <DialogDescription
                    id="calc-modal-description"
                    className="sr-only"
                >
                    Calculadora de metrado para elementos sanitarios. Ingrese
                    los valores y obtenga el cálculo automático.
                </DialogDescription>

                {/* CONTENIDO */}
                <div className="space-y-3 overflow-y-auto px-5 py-3">
                    {/* Fila 1: Descripción + Unidad + Versión */}
                    <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-5">
                            <Label className="mb-1 block text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
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
                            <Label className="mb-1 block text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                                Unidad
                            </Label>
                            <select
                                value={unidad}
                                onChange={(e) => {
                                    setUnidad(e.target.value);
                                    const profiles =
                                        UNIT_PROFILES[e.target.value];
                                    setSelectedVersion(
                                        profiles?.[0]?.key ?? '',
                                    );
                                }}
                                className="flex h-8 w-full rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            >
                                {UNITS.map((u) => (
                                    <option key={u} value={u}>
                                        {u.toUpperCase()}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="col-span-4">
                            {/* Versiones nativas (botones) */}
                            {!useCustom && unitProfiles.length > 0 && (
                                <>
                                    <Label className="mb-1 block text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                                        Versión
                                    </Label>
                                    <div className="flex flex-wrap gap-1">
                                        {unitProfiles
                                            .slice(0, 8)
                                            .map((p, idx) => {
                                                const isActive =
                                                    selectedVersion === p.key;
                                                return (
                                                    <button
                                                        key={p.key}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedVersion(
                                                                p.key,
                                                            );
                                                            setUseCustom(false);
                                                        }}
                                                        className={cn(
                                                            'min-w-[40px] flex-1 rounded border px-1.5 py-1.5 text-[9px] font-bold transition-all',
                                                            isActive
                                                                ? 'border-blue-400 bg-blue-600 text-white'
                                                                : 'border-slate-600 bg-slate-700 text-slate-300 hover:bg-slate-600',
                                                        )}
                                                        title={p.label}
                                                    >
                                                        V{idx + 1}
                                                    </button>
                                                );
                                            })}
                                    </div>
                                </>
                            )}

                            {/* Select de Fórmulas Guardadas */}
                            {savedFormulas.length > 0 && (
                                <div className="mt-2">
                                    <Label className="mb-1 block text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                                        Fórmulas Guardadas
                                    </Label>
                                    <select
                                        value={
                                            selectedVersion.startsWith(
                                                'custom_',
                                            )
                                                ? selectedVersion
                                                : ''
                                        }
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (value) {
                                                setSelectedVersion(value);
                                                const formula =
                                                    savedFormulas.find(
                                                        (f) =>
                                                            `custom_${f.id}` ===
                                                            value,
                                                    );
                                                if (formula) {
                                                    setCustomExpr(
                                                        formula.expression,
                                                    );
                                                    setFormulaName(
                                                        formula.name,
                                                    );
                                                    setUseCustom(false);
                                                }
                                            }
                                        }}
                                        className="flex h-8 w-full rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                    >
                                        <option value="">
                                            Seleccionar fórmula...
                                        </option>
                                        {savedFormulas.map((formula) => (
                                            <option
                                                key={formula.id}
                                                value={`custom_${formula.id}`}
                                            >
                                                {formula.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Fila 2: Fórmula Genérica */}
                    {!useCustom && (
                        <>
                            <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2">
                                <div className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                                    {profile.label || 'FÓRMULA GENÉRICA'}
                                </div>
                                <div className="mt-0.5 text-xs font-medium text-blue-300">
                                    {profile.formula ||
                                        'Ingresa los valores y selecciona fórmula personalizada'}
                                </div>
                            </div>

                            {/* Inputs */}
                            <div className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2.5">
                                <div className="mb-2">
                                    <Label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                                        Valores de Entrada
                                    </Label>
                                    <div className="mt-0.5 text-[9px] text-slate-500">
                                        {activeInputs
                                            .map((k) => INPUT_LABELS[k])
                                            .join(' • ')}
                                    </div>
                                </div>
                                <div className="grid grid-cols-6 gap-2">
                                    {ALL_INPUTS.map((key) => {
                                        const isActive =
                                            activeInputs.includes(key);
                                        return (
                                            <div
                                                key={key}
                                                className={cn(
                                                    'space-y-1',
                                                    !isActive && 'opacity-30',
                                                )}
                                            >
                                                <Label className="block text-center text-[9px] font-medium text-slate-500 uppercase">
                                                    {INPUT_LABELS[key]}
                                                </Label>
                                                <Input
                                                    type="number"
                                                    step="any"
                                                    disabled={!isActive}
                                                    value={
                                                        vals[key] === 0
                                                            ? ''
                                                            : vals[key]
                                                    }
                                                    placeholder="0"
                                                    onChange={(e) =>
                                                        setVals((v) => ({
                                                            ...v,
                                                            [key]: toNum(
                                                                e.target.value,
                                                            ),
                                                        }))
                                                    }
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
                    <div className="flex items-center gap-2.5 border-t border-slate-700 py-2">
                        <input
                            type="checkbox"
                            id="custom-formula-toggle"
                            checked={useCustom}
                            onChange={(e) => setUseCustom(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500"
                        />
                        <label
                            htmlFor="custom-formula-toggle"
                            className="cursor-pointer text-sm font-bold text-blue-400 transition-colors hover:text-blue-300"
                        >
                            Usar Fórmula Personalizada
                        </label>
                    </div>

                    {/* Fila 3: Fórmula Personalizada */}
                    {useCustom && (
                        <div className="animate-in space-y-3 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 duration-200 fade-in slide-in-from-top-2">
                            {/* HEADER: Nombre + Botones */}
                            <div className="flex items-center justify-between border-b border-slate-600 pb-2">
                                <div className="text-sm font-bold text-slate-200">
                                    Constructor de Fórmula
                                </div>
                                <div className="flex gap-1.5">
                                    <Input
                                        value={formulaName}
                                        onChange={(e) =>
                                            setFormulaName(
                                                e.target.value.slice(0, 50),
                                            )
                                        }
                                        placeholder="Nombre fórmula..."
                                        maxLength={50}
                                        className="h-7 w-40 border-slate-600 bg-slate-800 text-xs text-slate-100 placeholder:text-slate-500"
                                    />
                                    {/* Contador visual opcional */}
                                    <div className="mt-0.5 text-right text-[8px] text-slate-500">
                                        {formulaName.length}/50
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={saveFormula}
                                        disabled={
                                            !formulaName.trim() ||
                                            !customExpr.trim()
                                        }
                                        className="h-7 bg-emerald-600 px-2 text-xs hover:bg-emerald-700 disabled:opacity-40"
                                    >
                                        <Save className="mr-1 h-3.5 w-3.5" />
                                        Guardar
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={clearFormula}
                                        className="h-7 border-slate-600 bg-slate-800 px-2 text-xs text-slate-300 hover:bg-slate-700"
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
                                        <div className="mb-2 text-[9px] font-bold text-slate-400 uppercase">
                                            Variables disponibles (click para
                                            agregar):
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {FORMULA_VARIABLES.map(
                                                (variable) => (
                                                    <button
                                                        key={variable.key}
                                                        type="button"
                                                        onClick={() =>
                                                            addToFormula(
                                                                variable.key,
                                                            )
                                                        }
                                                        title={variable.desc}
                                                        className={cn(
                                                            'rounded border px-2 py-1.5 text-[9px] font-bold transition-all',
                                                            'bg-slate-700 text-slate-200 hover:bg-blue-600 hover:text-white',
                                                            'border-slate-600 hover:border-blue-500',
                                                        )}
                                                    >
                                                        {variable.label}
                                                    </button>
                                                ),
                                            )}
                                        </div>
                                    </div>

                                    {/* Separador */}
                                    <div className="w-px bg-slate-600" />

                                    {/* Columna derecha: Operadores */}
                                    <div className="flex flex-col items-start">
                                        <div className="mb-2 text-[9px] font-bold text-orange-400 uppercase">
                                            Operadores:
                                        </div>
                                        <div className="flex gap-1">
                                            {OPERATORS.map((op) => (
                                                <button
                                                    key={op.symbol}
                                                    type="button"
                                                    onClick={() =>
                                                        addToFormula(op.symbol)
                                                    }
                                                    title={op.label}
                                                    className={cn(
                                                        'rounded border px-3 py-1.5 text-sm font-bold transition-all',
                                                        'bg-slate-700 text-orange-300 hover:bg-orange-600 hover:text-white',
                                                        'border-slate-600 hover:border-orange-500',
                                                    )}
                                                >
                                                    <span className="text-lg font-bold">
                                                        {op.symbol}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* FILA : Expresión construida */}
                            <div className="rounded-lg border border-blue-600/50 bg-slate-900 p-2">
                                <div className="mb-1 flex items-center justify-between">
                                    <div className="text-[9px] font-bold text-slate-400 uppercase">
                                        Expresión construida :
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setCustomExpr('')}
                                        className="rounded px-2 py-0.5 text-[9px] text-red-400 transition-colors hover:bg-red-950/30 hover:text-red-300"
                                    >
                                        Limpiar
                                    </button>
                                </div>
                                <Input
                                    value={customExpr}
                                    onChange={(e) =>
                                        setCustomExpr(e.target.value)
                                    }
                                    placeholder="Click en variables y operadores o escribe directamente..."
                                    className="h-10 border border-slate-700 bg-slate-800 font-mono text-sm text-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                />
                            </div>

                            {/* FILA : Valores de Entrada + Inputs */}
                            <div className="rounded-lg border border-slate-600 bg-slate-800 p-2">
                                <div className="mb-2 text-[9px] font-bold text-emerald-400 uppercase">
                                    Valores de Entrada:
                                </div>
                                <div className="grid grid-cols-6 gap-2">
                                    {ALL_INPUTS.map((key) => (
                                        <div key={key} className="space-y-1">
                                            <Label className="block text-center text-[8px] font-medium text-slate-400 uppercase">
                                                {INPUT_LABELS[key]}
                                            </Label>
                                            <Input
                                                type="number"
                                                step="any"
                                                value={
                                                    vals[key] === 0
                                                        ? ''
                                                        : vals[key]
                                                }
                                                placeholder="0"
                                                onChange={(e) =>
                                                    setVals((v) => ({
                                                        ...v,
                                                        [key]: toNum(
                                                            e.target.value,
                                                        ),
                                                    }))
                                                }
                                                className="h-8 border-slate-600 bg-slate-700 text-center font-mono text-xs font-bold text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* FILA : Resultado en */}
                            <div className="rounded-lg border border-slate-600 bg-slate-800 p-2">
                                <div className="mb-2 text-[9px] font-bold text-slate-400 uppercase">
                                    Resultado en:
                                </div>
                                <div className="flex gap-2">
                                    {OUTPUT_COLUMNS.map((col) => {
                                        const isActive =
                                            String(customOut) === String(col);
                                        return (
                                            <button
                                                key={col}
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setCustomOut(
                                                        col as keyof MeasureOutputs,
                                                    );
                                                }}
                                                className={cn(
                                                    'cursor-pointer rounded border px-3 py-2 text-[9px] font-bold uppercase transition-all select-none',
                                                    isActive
                                                        ? 'scale-[1.02] border-blue-400 bg-blue-600 text-white shadow-lg ring-2 shadow-blue-500/40 ring-blue-400/50'
                                                        : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500 hover:bg-slate-600 hover:text-white',
                                                )}
                                            >
                                                {OUTPUT_LABELS[col] ??
                                                    col.toUpperCase()}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Debug visual */}
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[8px] text-slate-500">
                                    <span>Output:</span>
                                    <span className="rounded border border-blue-600/30 bg-blue-950/50 px-2 py-0.5 font-mono text-blue-400">
                                        {customOut}
                                    </span>
                                    <span>→</span>
                                    <span className="rounded border border-emerald-600/30 bg-emerald-950/50 px-2 py-0.5 font-bold text-emerald-400">
                                        {OUTPUT_LABELS[customOut] ?? customOut}
                                    </span>
                                </div>
                            </div>

                            {/* FILA : Fórmulas guardadas */}
                            {savedFormulas.length > 0 && (
                                <div className="rounded-lg border border-slate-600 bg-slate-800/50 p-2">
                                    <div className="mb-2 border-b border-slate-600 pb-1 text-[9px] font-bold text-slate-400 uppercase">
                                        Fórmulas Guardadas (click para cargar):
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {savedFormulas.map((formula) => (
                                            <div
                                                key={formula.id}
                                                onClick={() =>
                                                    loadFormula(formula)
                                                }
                                                className="flex cursor-pointer items-center gap-2 rounded border border-slate-600 bg-slate-700/50 px-3 py-2 transition-colors hover:bg-slate-700"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-[10px] font-medium text-slate-200">
                                                        {formula.name}
                                                    </div>
                                                    <div className="font-mono text-[8px] text-slate-400">
                                                        {formula.expression}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) =>
                                                        deleteFormula(
                                                            formula.id,
                                                            e,
                                                        )
                                                    }
                                                    className="text-slate-400 transition-colors hover:text-red-400"
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
                                <p className="flex items-center gap-1 rounded border border-red-600/30 bg-red-950/30 px-2 py-1 text-[10px] text-red-400">
                                    <TriangleAlert className="h-3 w-3" />{' '}
                                    {customErr}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Fila 4: RESULTADO */}
                    <div
                        className={cn(
                            'rounded-lg border-2 px-4 py-3',
                            hasResult
                                ? 'border-emerald-500/40 bg-emerald-950/20'
                                : 'border-slate-700 bg-slate-800/50',
                        )}
                    >
                        <Label className="mb-2 block text-center text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                            Resultado
                        </Label>
                        {hasResult ? (
                            <div className="space-y-3">
                                {/* Para unidad KG: mostrar cálculo paso a paso */}
                                {unit === 'kg' &&
                                preview.lon !== undefined &&
                                preview.lon !== 0 ? (
                                    <div className="space-y-3">
                                        {/* PASO 1: Longitud Parcial */}
                                        <div className="rounded-lg border border-blue-600/40 bg-blue-950/30 p-3">
                                            <div className="mb-2 flex items-center justify-between">
                                                <div className="text-[10px] font-bold text-blue-400 uppercase">
                                                    Paso 1: Longitud Parcial
                                                </div>
                                                <div className="text-[9px] text-blue-300/60">
                                                    (Elem.Sim. × (L+A+H) ×
                                                    N°Veces)
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {(() => {
                                                        const inputs =
                                                            profile.activeInputs.filter(
                                                                (k) =>
                                                                    k !== 'kgm',
                                                            );
                                                        return inputs.map(
                                                            (key, idx) => (
                                                                <React.Fragment
                                                                    key={key}
                                                                >
                                                                    <span className="rounded bg-blue-900/50 px-2 py-1 font-mono text-xs text-blue-300">
                                                                        {
                                                                            INPUT_LABELS[
                                                                                key
                                                                            ]
                                                                        }
                                                                        :{' '}
                                                                        {r4(
                                                                            vals[
                                                                                key
                                                                            ],
                                                                        )}
                                                                    </span>
                                                                    {idx <
                                                                        inputs.length -
                                                                            1 && (
                                                                        <span className="font-bold text-blue-400">
                                                                            ×
                                                                        </span>
                                                                    )}
                                                                </React.Fragment>
                                                            ),
                                                        );
                                                    })()}
                                                </div>
                                                <div className="text-2xl font-bold text-blue-400">
                                                    ={' '}
                                                    {r4(
                                                        preview.lon,
                                                    ).toLocaleString('es-PE', {
                                                        maximumFractionDigits: 4,
                                                    })}{' '}
                                                    m
                                                </div>
                                            </div>
                                        </div>

                                        {/* PASO 2: KG Final */}
                                        <div className="rounded-lg border border-emerald-600/40 bg-emerald-950/30 p-3">
                                            <div className="mb-2 flex items-center justify-between">
                                                <div className="text-[10px] font-bold text-emerald-400 uppercase">
                                                    Paso 2: Peso KG
                                                </div>
                                                <div className="text-[9px] text-emerald-300/60">
                                                    (Long.Parcial × kg/m)
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="rounded bg-emerald-900/50 px-2 py-1 font-mono text-xs text-emerald-300">
                                                        Long: {r4(preview.lon)}
                                                    </span>
                                                    <span className="font-bold text-emerald-400">
                                                        ×
                                                    </span>
                                                    <span className="rounded bg-emerald-900/50 px-2 py-1 font-mono text-xs text-emerald-300">
                                                        kg/m: {r4(vals.kgm)}
                                                    </span>
                                                </div>
                                                <div className="text-3xl font-bold text-emerald-400">
                                                    {outVal.toLocaleString(
                                                        'es-PE',
                                                        {
                                                            maximumFractionDigits: 4,
                                                        },
                                                    )}{' '}
                                                    kg
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* Para otras unidades: mostrar resultado normal */
                                    <div className="flex items-center justify-center gap-6">
                                        <div className="text-center">
                                            <div className="mb-1 text-[10px] font-bold text-emerald-400 uppercase">
                                                {OUTPUT_LABELS[activeOut] ??
                                                    activeOut}
                                            </div>
                                            <div className="rounded-lg bg-emerald-950/40 px-5 py-2.5 text-3xl font-bold text-emerald-400">
                                                {outVal.toLocaleString(
                                                    'es-PE',
                                                    {
                                                        maximumFractionDigits: 4,
                                                    },
                                                )}
                                            </div>
                                        </div>

                                        <div className="h-14 w-px bg-slate-600" />

                                        <div className="text-center">
                                            <div className="mb-1 text-[10px] font-bold text-slate-400 uppercase">
                                                Operación
                                            </div>
                                            <div className="max-w-[340px] rounded-lg bg-slate-800 px-3 py-2 text-left">
                                                <div className="mb-1 text-[11px] text-slate-300">
                                                    {useCustom
                                                        ? formulaName.trim() ||
                                                          customExpr
                                                        : profile.formula ||
                                                          profile.label}
                                                </div>
                                                <div className="font-mono text-[11px] text-amber-300">
                                                    {formulaPreview.formula ||
                                                        'Sin formula'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center py-2 text-center text-xs text-slate-500">
                                Ingresa valores para calcular
                            </div>
                        )}
                    </div>
                </div>

                {/* FOOTER */}
                <DialogFooter className="flex flex-shrink-0 gap-2 border-t border-slate-700 bg-slate-800/50 px-5 py-2.5">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onClose}
                        className="border-slate-600 bg-slate-800 px-4 text-xs text-slate-200 hover:bg-slate-700"
                    >
                        Cancelar
                    </Button>
                    <Button
                        size="sm"
                        disabled={!hasResult}
                        onClick={() => {
                            const appliedOutputKey = useCustom
                                ? customOut
                                : activeOut;
                            const appliedFormulaKey = useCustom
                                ? 'custom_inline'
                                : selectedVersion || profile.key;
                            const appliedFormulaExpression = useCustom
                                ? customExpr
                                : selectedVersion.startsWith('custom_')
                                  ? profile.formula
                                  : '';
                            const appliedFormulaLabel = useCustom
                                ? formulaName.trim() || customExpr
                                : profile.formula || profile.label;

                            onApply({
                                ri,
                                descripcion: descripcion.trim(),
                                unidad: unit,
                                outputKey: appliedOutputKey,
                                inputs: vals,
                                outputs: useCustom
                                    ? { [appliedOutputKey]: outVal }
                                    : profile.fn(vals),
                                formulaKey: appliedFormulaKey,
                                formulaLabel: appliedFormulaLabel,
                                formulaExpression: appliedFormulaExpression,
                                formula: useCustom
                                    ? customExpr
                                    : profile.formula || '',
                            });
                            onClose();
                        }}
                        className="bg-blue-600 px-4 text-xs hover:bg-blue-700 disabled:opacity-40"
                    >
                        <Calculator className="mr-1.5 h-3.5 w-3.5" />
                        Aplicar Cálculo
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
