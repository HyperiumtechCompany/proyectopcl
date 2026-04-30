import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Zap, TrendingUp } from 'lucide-react';
import type { RoomLightingCalculation } from '@/hooks/dialux/useEditorStore';
import {
    calculateLumensRequired,
    calculateExactQuantity,
    calculateRoundedQuantity,
    estimateUniformity,
    determineCoverage,
    validateCalculationInputs,
    formatCalculationResult,
} from '@/hooks/dialux/lightingCalculations';

interface LightingCalculationPanelProps {
    roomId: string;
    roomName: string;
    areaM2: number;
    onCalculationComplete: (calculation: RoomLightingCalculation) => void;
}

/**
 * LightingCalculationPanel - Panel profesional para cálculos de iluminación
 * Interfaz completa para calcular cantidad de luminarias por recinto
 */
export const LightingCalculationPanel: React.FC<LightingCalculationPanelProps> = ({
    roomId,
    roomName,
    areaM2,
    onCalculationComplete,
}) => {
    const [step, setStep] = useState<'inputs' | 'review' | 'complete'>('inputs');
    
    // Paso 1: Capturar inputs
    const [normaLux, setNormaLux] = useState<200 | 300 | 500>(300);
    const [fixtureType, setFixtureType] = useState('LED Panel');
    const [fixtureLumens, setFixtureLumens] = useState(4000);
    
    // Paso 2: Cálculos derivados
    const lumensRequired = calculateLumensRequired(areaM2, normaLux);
    const exactQuantity = calculateExactQuantity(lumensRequired, fixtureLumens);
    const roundedQuantity = calculateRoundedQuantity(exactQuantity);
    const uniformity = estimateUniformity(roundedQuantity);
    const coverage = determineCoverage(exactQuantity, roundedQuantity);
    
    // Paso 3: Decisión del usuario
    const [recommendedQuantity, setRecommendedQuantity] = useState(roundedQuantity);
    
    // Validación
    const validation = validateCalculationInputs(areaM2, normaLux, fixtureLumens);
    
    const handleCalculate = () => {
        if (!validation.valid) {
            alert(validation.errors.join('\n'));
            return;
        }
        setStep('review');
    };
    
    const handleComplete = () => {
        const calculation: RoomLightingCalculation = {
            id: `calc-${roomId}-${Date.now()}`,
            roomId,
            name: roomName,
            area: areaM2,
            scaledUnit: 'm',
            normaLux,
            lumensRequired: Math.round(lumensRequired),
            fixtureType,
            fixtureLumens,
            exactQuantity: Math.round(exactQuantity * 100) / 100,
            roundedQuantity,
            recommendedQuantity,
            uniformityEstimate: uniformity,
            coverage,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        
        onCalculationComplete(calculation);
        setStep('complete');
        
        console.log(formatCalculationResult(calculation));
    };
    
    // ─── PASO 1: INPUTS ───────────────────────────────────────────────────────
    if (step === 'inputs') {
        return (
            <div className="space-y-4 p-4 bg-gradient-to-b from-slate-900 to-slate-800 rounded-lg border border-slate-700">
                <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-5 h-5 text-amber-400" />
                    <h3 className="font-semibold text-white">Cálculo de Iluminación</h3>
                </div>
                
                {/* Info del Recinto */}
                <div className="bg-slate-800/50 p-3 rounded border border-slate-700/50">
                    <p className="text-xs text-slate-400 mb-1">RECINTO</p>
                    <p className="font-mono text-sm text-cyan-400">{roomName}</p>
                    <p className="text-xs text-slate-400 mt-2">ÁREA</p>
                    <p className="font-mono text-sm text-green-400">{areaM2.toFixed(2)} m²</p>
                </div>
                
                {/* Seleccionar Norma */}
                <div>
                    <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">
                        Norma de Iluminación (EN 12464-1)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {[200, 300, 500].map((norm) => (
                            <button
                                key={norm}
                                onClick={() => setNormaLux(norm as 200 | 300 | 500)}
                                className={`py-2 px-3 rounded border transition-all text-sm font-semibold ${
                                    normaLux === norm
                                        ? 'bg-blue-600 border-blue-400 text-white'
                                        : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500'
                                }`}
                            >
                                {norm} lx
                            </button>
                        ))}
                    </div>
                </div>
                
                {/* Tipo de Luminaria */}
                <div>
                    <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">
                        Tipo de Luminaria
                    </label>
                    <input
                        type="text"
                        value={fixtureType}
                        onChange={(e) => setFixtureType(e.target.value)}
                        placeholder="Ej: LED Panel, Downlight, Suspensión..."
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                </div>
                
                {/* Lúmenes del Foco */}
                <div>
                    <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">
                        Lúmenes del Foco (lm)
                    </label>
                    <input
                        type="number"
                        value={fixtureLumens}
                        onChange={(e) => setFixtureLumens(Math.max(1, parseInt(e.target.value) || 1))}
                        min="1"
                        step="100"
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                        Lumenes útiles de la luminaria seleccionada
                    </p>
                </div>
                
                {/* Botón Calcular */}
                <button
                    onClick={handleCalculate}
                    disabled={!validation.valid}
                    className={`w-full py-2 rounded font-semibold transition-all ${
                        validation.valid
                            ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-500 hover:to-blue-400'
                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                >
                    Calcular Iluminación
                </button>
                
                {!validation.valid && (
                    <div className="bg-red-900/20 border border-red-700/50 rounded p-2">
                        {validation.errors.map((err, i) => (
                            <p key={i} className="text-xs text-red-400">{err}</p>
                        ))}
                    </div>
                )}
            </div>
        );
    }
    
    // ─── PASO 2: REVISAR CÁLCULOS ─────────────────────────────────────────────
    if (step === 'review') {
        return (
            <div className="space-y-4 p-4 bg-gradient-to-b from-slate-900 to-slate-800 rounded-lg border border-slate-700 overflow-y-auto max-h-96">
                <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-semibold text-white">Resultados del Cálculo</h3>
                </div>
                
                {/* Resumen de Cálculos */}
                <div className="bg-slate-800/50 border border-slate-700 rounded p-3 space-y-3">
                    <div>
                        <p className="text-xs text-slate-400 uppercase mb-1">Lúmenes Requeridos</p>
                        <p className="text-xl font-bold text-cyan-400">
                            {lumensRequired.toLocaleString('es-PE', { maximumFractionDigits: 0 })} lm
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            Fórmula: ((Área × Norma) / 0.8) / 0.99
                        </p>
                    </div>
                    
                    <div className="border-t border-slate-700 pt-3">
                        <p className="text-xs text-slate-400 uppercase mb-1">Cantidad de Luminarias</p>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-slate-700 p-2 rounded">
                                <p className="text-xs text-slate-400">Exacta</p>
                                <p className="text-lg font-mono text-blue-400">
                                    {exactQuantity.toFixed(2)}
                                </p>
                            </div>
                            <div className="bg-slate-700 p-2 rounded">
                                <p className="text-xs text-slate-400">Redondeada</p>
                                <p className="text-lg font-mono text-green-400 font-bold">
                                    {roundedQuantity}
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="border-t border-slate-700 pt-3">
                        <p className="text-xs text-slate-400 uppercase mb-1">Métricas</p>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Uniformidad Est.:</span>
                                <span className="text-white font-mono">
                                    {(uniformity * 100).toFixed(1)}%
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">Cobertura:</span>
                                <span className={`font-semibold flex items-center gap-1 ${
                                    coverage === 'optimal' ? 'text-emerald-400' :
                                    coverage === 'insufficient' ? 'text-amber-400' : 'text-orange-400'
                                }`}>
                                    {coverage === 'optimal' && <CheckCircle size={14} />}
                                    {coverage === 'insufficient' && <AlertCircle size={14} />}
                                    {coverage === 'excessive' && <AlertCircle size={14} />}
                                    {coverage.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="border-t border-slate-700 pt-3">
                        <label className="text-xs text-slate-400 uppercase mb-2 block">
                            Cantidad Recomendada (tu decisión)
                        </label>
                        <input
                            type="number"
                            value={recommendedQuantity}
                            onChange={(e) => setRecommendedQuantity(Math.max(1, parseInt(e.target.value) || roundedQuantity))}
                            min="1"
                            step="1"
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                        />
                    </div>
                </div>
                
                {/* Botones de Acción */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setStep('inputs')}
                        className="flex-1 py-2 rounded font-semibold bg-slate-700 text-white hover:bg-slate-600 transition-all"
                    >
                        Atrás
                    </button>
                    <button
                        onClick={handleComplete}
                        className="flex-1 py-2 rounded font-semibold bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-500 hover:to-emerald-400 transition-all"
                    >
                        Guardar Cálculo
                    </button>
                </div>
            </div>
        );
    }
    
    // ─── PASO 3: COMPLETADO ───────────────────────────────────────────────────
    return (
        <div className="space-y-3 p-4 bg-gradient-to-b from-emerald-900/30 to-emerald-800/20 rounded-lg border border-emerald-700/50">
            <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-emerald-400">Cálculo Completado</h3>
            </div>
            <p className="text-sm text-slate-300">
                Se guardó el cálculo con {recommendedQuantity} luminaria{recommendedQuantity !== 1 ? 's' : ''}.
            </p>
            <button
                onClick={() => {
                    setStep('inputs');
                    setRecommendedQuantity(roundedQuantity);
                }}
                className="w-full py-2 rounded font-semibold text-sm bg-slate-700 text-white hover:bg-slate-600 transition-all"
            >
                Nuevo Cálculo
            </button>
        </div>
    );
};
