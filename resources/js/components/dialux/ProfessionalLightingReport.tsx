/**
 * ProfessionalLightingReport.tsx
 * 
 * Panel profesional para visualizar cálculos de iluminación
 * Estilo senior con formato ejecutivo
 */

import React from 'react';
import { BarChart3, TrendingUp, CheckCircle, AlertTriangle, Zap } from 'lucide-react';
import type { RoomLightingCalculation } from '@/hooks/dialux/useEditorStore';

interface ProfessionalLightingReportProps {
    calculations: RoomLightingCalculation[];
    projectName?: string;
    moduleName?: string;
}

/**
 * Componente de reporte profesional de iluminación
 * Diseñado para presentación ejecutiva de cálculos
 */
export const ProfessionalLightingReport: React.FC<ProfessionalLightingReportProps> = ({
    calculations,
    projectName = 'Proyecto de Iluminación',
    moduleName = 'Módulo General',
}) => {
    if (calculations.length === 0) {
        return (
            <div className="p-6 bg-slate-900 rounded-lg border border-slate-700 text-center">
                <Zap className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No hay cálculos disponibles</p>
            </div>
        );
    }

    const totalFixtures = calculations.reduce((sum, c) => sum + c.recommendedQuantity, 0);
    const averageUniformity =
        calculations.reduce((sum, c) => sum + (c.uniformityEstimate || 0), 0) /
        calculations.length;

    const optimalCount = calculations.filter((c) => c.coverage === 'optimal').length;
    const insufficientCount = calculations.filter((c) => c.coverage === 'insufficient').length;
    const excessiveCount = calculations.filter((c) => c.coverage === 'excessive').length;

    return (
        <div className="space-y-6 p-6 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 rounded-lg border border-slate-700">
            {/* Encabezado */}
            <div className="border-b border-slate-700 pb-4">
                <h2 className="text-2xl font-bold text-white mb-1">📊 Reporte de Iluminación</h2>
                <p className="text-sm text-slate-400">
                    {projectName} • {moduleName}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                    Generado: {new Date().toLocaleDateString('es-PE', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </p>
            </div>

            {/* Resumen Ejecutivo */}
            <div className="grid grid-cols-4 gap-3">
                <div className="bg-slate-700/50 p-4 rounded border border-slate-600 text-center">
                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">
                        Total Recintos
                    </p>
                    <p className="text-3xl font-bold text-cyan-400">
                        {calculations.length}
                    </p>
                </div>
                <div className="bg-slate-700/50 p-4 rounded border border-slate-600 text-center">
                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">
                        Luminarias Totales
                    </p>
                    <p className="text-3xl font-bold text-emerald-400">{totalFixtures}</p>
                </div>
                <div className="bg-slate-700/50 p-4 rounded border border-slate-600 text-center">
                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">
                        Uniformidad Prom.
                    </p>
                    <p className="text-3xl font-bold text-blue-400">
                        {(averageUniformity * 100).toFixed(0)}%
                    </p>
                </div>
                <div className="bg-slate-700/50 p-4 rounded border border-slate-600">
                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">
                        Estado
                    </p>
                    <div className="flex gap-2 justify-center">
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-xs text-emerald-400">{optimalCount}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                            <span className="text-xs text-amber-400">{insufficientCount}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-orange-500" />
                            <span className="text-xs text-orange-400">{excessiveCount}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabla de Cálculos */}
            <div className="border border-slate-700 rounded overflow-hidden">
                <div className="bg-slate-800 px-6 py-3 border-b border-slate-700 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-amber-400" />
                    <h3 className="font-semibold text-white">Detalles por Recinto</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-700/50 border-b border-slate-600">
                            <tr className="text-left text-xs text-slate-400 uppercase tracking-wider">
                                <th className="px-6 py-3">#</th>
                                <th className="px-4 py-3">Recinto</th>
                                <th className="px-4 py-3 text-right">Área (m²)</th>
                                <th className="px-4 py-3 text-right">Norma (lx)</th>
                                <th className="px-4 py-3">Luminaria</th>
                                <th className="px-4 py-3 text-right">Lm Req.</th>
                                <th className="px-4 py-3 text-right">Cant. Exacta</th>
                                <th className="px-4 py-3 text-right">Cant. Rec.</th>
                                <th className="px-4 py-3 text-center">Uniformidad</th>
                                <th className="px-4 py-3 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {calculations.map((calc, idx) => (
                                <tr
                                    key={calc.id}
                                    className="hover:bg-slate-700/30 transition-colors"
                                >
                                    <td className="px-6 py-3 font-semibold text-slate-300">
                                        {idx + 1}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="font-medium text-cyan-400">
                                            {calc.name}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-slate-300">
                                        {calc.area.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-slate-300">
                                        {calc.normaLux}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-400">
                                        {calc.fixtureType}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-amber-400">
                                        {calc.lumensRequired.toLocaleString('es-PE')}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-blue-400">
                                        {calc.exactQuantity.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-emerald-400 font-bold text-lg">
                                        {calc.recommendedQuantity}
                                    </td>
                                    <td className="px-4 py-3 text-center font-mono text-slate-300">
                                        <span
                                            className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                                                (calc.uniformityEstimate || 0) > 0.75
                                                    ? 'bg-emerald-900/40 text-emerald-400'
                                                    : (calc.uniformityEstimate || 0) > 0.5
                                                      ? 'bg-amber-900/40 text-amber-400'
                                                      : 'bg-orange-900/40 text-orange-400'
                                            }`}
                                        >
                                            {((calc.uniformityEstimate || 0) * 100).toFixed(0)}%
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {calc.coverage === 'optimal' ? (
                                            <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto" />
                                        ) : (
                                            <AlertTriangle className="w-4 h-4 text-amber-400 mx-auto" />
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Notas y Observaciones */}
            <div className="bg-slate-700/30 border border-slate-600 rounded p-4">
                <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                    Análisis
                </h4>
                <ul className="space-y-1 text-sm text-slate-300">
                    <li>
                        ✓ <strong>Recintos Óptimos:</strong> {optimalCount}/{calculations.length}{' '}
                        con cobertura adecuada
                    </li>
                    {insufficientCount > 0 && (
                        <li>
                            ⚠️ <strong>Cobertura Insuficiente:</strong> {insufficientCount} recinto
                            {insufficientCount !== 1 ? 's' : ''} pueden requerir luminarias adicionales
                        </li>
                    )}
                    {excessiveCount > 0 && (
                        <li>
                            ⚠️ <strong>Cobertura Excesiva:</strong> {excessiveCount} recinto
                            {excessiveCount !== 1 ? 's' : ''} pueden optimizar cantidad de luminarias
                        </li>
                    )}
                    <li>
                        📊 <strong>Uniformidad Promedio:</strong>{' '}
                        {(averageUniformity * 100).toFixed(1)}% (Objetivo: &gt;60%)
                    </li>
                </ul>
            </div>

            {/* Pie de página */}
            <div className="text-xs text-slate-500 text-center border-t border-slate-700 pt-4">
                <p>Cálculos según EN 12464-1 | Fórmula: ((Área × Norma) / 0.8) / 0.99</p>
            </div>
        </div>
    );
};
