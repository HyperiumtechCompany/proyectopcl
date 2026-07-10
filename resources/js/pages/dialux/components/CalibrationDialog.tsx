import React, { useMemo, useState } from 'react';

interface CalibrationDialogProps {
    open: boolean;
    cadDistance: number;
    onCancel: () => void;
    onApply: (realDistanceMeters: number, displayValue: number, unit: 'm' | 'cm' | 'mm') => void;
}

const UNIT_FACTORS = {
    m: 1,
    cm: 0.01,
    mm: 0.001,
} as const;

function fmt(value: number, digits = 4) {
    return Number.isFinite(value) ? value.toFixed(digits).replace(/\.?0+$/, '') : '0';
}

export const CalibrationDialog: React.FC<CalibrationDialogProps> = ({
    open,
    cadDistance,
    onCancel,
    onApply,
}) => {
    const [value, setValue] = useState('1');
    const [unit, setUnit] = useState<'m' | 'cm' | 'mm'>('m');
    // 'side' → el usuario ingresa la longitud del lado directamente
    // 'area' → el usuario ingresa el área; el lado se calcula como √área
    const [inputMode, setInputMode] = useState<'side' | 'area'>('side');
    const [areaValue, setAreaValue] = useState('');

    const numericValue = Number(value);
    const numericArea  = Number(areaValue);

    /**
     * Distancia real en metros.
     *
     * Caso típico del usuario:
     *   - Plano AutoCAD con cuadrado de área real = 3.39 m²
     *   - Al medir un lado en el CAD se obtienen 1.58 ud CAD
     *   - El lado real = √3.39 ≈ 1.842 m
     *
     * Con modo 'area':  el usuario ingresa 3.39 → lado = √3.39 = 1.8439 m
     * Con modo 'side':  el usuario ingresa 1.8439 directamente
     * En ambos casos: effectiveScale = 1.8439 / 1.58 ≈ 1.1670 m/ud_CAD
     */
    const realDistanceMeters = useMemo<number>(() => {
        if (inputMode === 'area') {
            if (!Number.isFinite(numericArea) || numericArea <= 0) return 0;
            return Math.sqrt(numericArea);
        }
        if (!Number.isFinite(numericValue) || numericValue <= 0) return 0;
        return numericValue * UNIT_FACTORS[unit];
    }, [inputMode, numericArea, numericValue, unit]);

    /** metros / unidad_CAD — lo que applyCalibration calculará */
    const previewFactor = cadDistance > 0 ? realDistanceMeters / cadDistance : 0;

    /**
     * Área del cuadrado resultante para verificación:
     *   Al dibujar el mismo tramo (cadDistance ud CAD) en el sistema,
     *   representará (realDistanceMeters) metros.
     *   Un cuadrado de ese lado tendrá área = realDistanceMeters².
     */
    const resultArea = realDistanceMeters > 0 ? realDistanceMeters * realDistanceMeters : 0;

    // Semáforo de calidad
    const factorQuality: 'ok' | 'warn' | 'bad' =
        previewFactor <= 0 || previewFactor < 0.001 || previewFactor > 1000 ? 'bad'
        : previewFactor < 0.1 || previewFactor > 10 ? 'warn'
        : 'ok';

    const qualityColors = {
        ok:   { label: 'text-emerald-300', badge: 'text-emerald-400' },
        warn: { label: 'text-amber-300',   badge: 'text-amber-400'   },
        bad:  { label: 'text-red-400',     badge: 'text-red-500'     },
    }[factorQuality];

    const isApplicable = realDistanceMeters > 0 && cadDistance > 0;

    if (!open) return null;

    return (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-amber-600/30 bg-slate-900 p-5 shadow-2xl">

                {/* ── Header ─────────────────────────────────────────────────── */}
                <div className="mb-4">
                    <p className="text-sm font-semibold text-amber-300">
                        Calibrar escala por referencia
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                        Indica la medida real del tramo que acabas de trazar sobre el plano.
                        El sistema calculará el factor de conversión CAD → metros.
                    </p>
                </div>

                <div className="space-y-3">

                    {/* ── Resumen de la medición CAD ─────────────────────────── */}
                    <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-xs text-slate-300">
                        <p>
                            Distancia medida en el plano CAD:{' '}
                            <span className="font-semibold text-amber-200">
                                {fmt(cadDistance, 4)} ud CAD
                            </span>
                        </p>
                        {previewFactor > 0 && (
                            <p className={`mt-1 ${qualityColors.label}`}>
                                Factor resultante:{' '}
                                <span className="font-semibold">
                                    1 ud CAD = {fmt(previewFactor, 6)} m
                                </span>
                                {factorQuality === 'warn' && (
                                    <span className="ml-1 opacity-70"> ⚠ Factor inusual</span>
                                )}
                                {factorQuality === 'bad' && (
                                    <span className="ml-1 opacity-80"> ✗ Factor fuera de rango</span>
                                )}
                            </p>
                        )}
                    </div>

                    {/* ── Selector de modo de entrada ────────────────────────── */}
                    <div className="flex rounded-lg border border-slate-700 bg-slate-950/40 p-0.5 text-xs">
                        <button
                            type="button"
                            onClick={() => setInputMode('side')}
                            className={`flex-1 rounded-md px-2 py-1.5 font-medium transition-colors ${
                                inputMode === 'side'
                                    ? 'bg-amber-600 text-slate-950'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            Ingresar longitud real
                        </button>
                        <button
                            type="button"
                            onClick={() => setInputMode('area')}
                            className={`flex-1 rounded-md px-2 py-1.5 font-medium transition-colors ${
                                inputMode === 'area'
                                    ? 'bg-cyan-600 text-slate-950'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            Calcular desde área (m²)
                        </button>
                    </div>

                    {/* ── Modo: longitud del lado ─────────────────────────────── */}
                    {inputMode === 'side' && (
                        <div>
                            <label
                                htmlFor="dialux-calibration-value"
                                className="mb-1 block text-[11px] font-medium text-slate-300"
                            >
                                Medida real del tramo
                            </label>
                            <div className="flex gap-2">
                                <input
                                    id="dialux-calibration-value"
                                    autoFocus
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={value}
                                    onChange={(e) => setValue(e.target.value)}
                                    className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-0 focus:border-amber-500"
                                />
                                <select
                                    value={unit}
                                    onChange={(e) => setUnit(e.target.value as 'm' | 'cm' | 'mm')}
                                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
                                >
                                    <option value="m">m</option>
                                    <option value="cm">cm</option>
                                    <option value="mm">mm</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {/* ── Modo: calcular desde área ───────────────────────────── */}
                    {inputMode === 'area' && (
                        <div>
                            <label
                                htmlFor="dialux-calibration-area"
                                className="mb-1 block text-[11px] font-medium text-slate-300"
                            >
                                Área real del recinto cuadrado (m²)
                            </label>
                            <input
                                id="dialux-calibration-area"
                                autoFocus
                                type="number"
                                min="0"
                                step="any"
                                placeholder="ej. 3.39"
                                value={areaValue}
                                onChange={(e) => setAreaValue(e.target.value)}
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-0 focus:border-cyan-500"
                            />
                            {numericArea > 0 && (
                                <p className="mt-1.5 text-[11px] text-cyan-300">
                                    Lado real calculado:{' '}
                                    <span className="font-mono">√{fmt(numericArea, 2)}</span>
                                    {' = '}
                                    <span className="font-semibold">
                                        {fmt(Math.sqrt(numericArea), 6)} m
                                    </span>
                                </p>
                            )}
                            <p className="mt-1 text-[10px] text-slate-500">
                                Útil cuando conoces el área exacta del recinto (ej. 3.39 m²)
                                pero no el lado (√3.39 ≈ 1.8439 m).
                            </p>
                        </div>
                    )}

                    {/* ── Verificación del área resultante ───────────────────── */}
                    {isApplicable && (
                        <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3 text-xs">
                            <p className="mb-1.5 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
                                Verificación de la calibración
                            </p>
                            <div className="space-y-1 text-slate-300">
                                <p>
                                    <span className="w-36 inline-block text-slate-500">Tramo CAD:</span>
                                    <span className="font-mono text-amber-200">
                                        {fmt(cadDistance, 4)} ud
                                    </span>
                                    <span className="mx-1 text-slate-600">→</span>
                                    <span className="font-mono font-semibold text-emerald-300">
                                        {fmt(realDistanceMeters, 4)} m
                                    </span>
                                </p>
                                <p>
                                    <span className="w-36 inline-block text-slate-500">
                                        Área cuadrado resultante:
                                    </span>
                                    <span className={`font-mono font-semibold ${qualityColors.badge}`}>
                                        {fmt(resultArea, 4)} m²
                                    </span>
                                    <span className="ml-1 text-slate-600">
                                        ({fmt(realDistanceMeters, 4)}²)
                                    </span>
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Acciones ───────────────────────────────────────────────── */}
                <div className="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        disabled={!isApplicable}
                        onClick={() => onApply(realDistanceMeters, numericValue, unit)}
                        className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Aplicar calibración
                    </button>
                </div>
            </div>
        </div>
    );
};
