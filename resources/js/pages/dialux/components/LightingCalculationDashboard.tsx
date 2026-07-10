/**
 * LightingCalculationDashboard.tsx
 * 
 * Dashboard completo profesional para la gestión de cálculos de iluminación
 * Integra:
 * • Vista general por módulo/recinto
 * • Cálculos detallados
 * • Reporte ejecutivo
 * • Gestión de luminarias
 */

import {
    BarChart3,
    Plus,
    Download,
    Filter,
    Home,
    Lightbulb,
    TrendingUp,
} from 'lucide-react';
import React, { useState } from 'react';
import type { RoomLightingCalculation } from '@/pages/dialux/hooks/useEditorStore';
import { ProfessionalLightingReport } from './ProfessionalLightingReport';

interface LightingCalculationDashboardProps {
    projectName: string;
    calculations: RoomLightingCalculation[];
    onAddCalculation: () => void;
    onExportReport: () => void;
}

type ViewMode = 'summary' | 'detailed' | 'report';

/**
 * Dashboard profesional de cálculos de iluminación
 */
export const LightingCalculationDashboard: React.FC<LightingCalculationDashboardProps> = ({
    projectName,
    calculations,
    onAddCalculation,
    onExportReport,
}) => {
    const [viewMode, setViewMode] = useState<ViewMode>('summary');
    const [selectedRoom, setSelectedRoom] = useState<string | null>(
        calculations.length > 0 ? calculations[0].roomId : null
    );

    const selectedCalcs = selectedRoom
        ? calculations.filter((c) => c.roomId === selectedRoom)
        : calculations;

    const totalFixtures = calculations.reduce((sum, c) => sum + c.recommendedQuantity, 0);
    const totalLumens = calculations.reduce((sum, c) => sum + c.lumensRequired, 0);

    const handleExportReport = () => {
        const reportText = formatCompleteReport();
        const blob = new Blob([reportText], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte-iluminacion-${projectName}-${new Date().getTime()}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    const formatCompleteReport = (): string => {
        let report = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    REPORTE PROFESIONAL DE ILUMINACIÓN                        ║
╚══════════════════════════════════════════════════════════════════════════════╝

PROYECTO: ${projectName}
FECHA: ${new Date().toLocaleDateString('es-PE', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        })}
HORA: ${new Date().toLocaleTimeString('es-PE')}

┌──────────────────────────────────────────────────────────────────────────────┐
│ RESUMEN EJECUTIVO                                                            │
└──────────────────────────────────────────────────────────────────────────────┘

• Total de Recintos Analizados: ${calculations.length}
• Luminarias Recomendadas (Total): ${totalFixtures}
• Lúmenes Requeridos (Total): ${totalLumens.toLocaleString('es-PE')} lm
• Cumplimiento: ${calculations.filter((c) => c.coverage === 'optimal').length}/${calculations.length} óptimo

`;

        calculations.forEach((calc, idx) => {
            report += `
┌──────────────────────────────────────────────────────────────────────────────┐
│ ${idx + 1}. ${calc.name.toUpperCase()}
└──────────────────────────────────────────────────────────────────────────────┘

  Datos del Recinto:
  ├─ Área: ${calc.area.toFixed(2)} m²
  ├─ Norma (EN 12464-1): ${calc.normaLux} lux
  └─ Altura: -

  Cálculos:
  ├─ Luminaria: ${calc.fixtureType}
  ├─ Lúmenes por Foco: ${calc.fixtureLumens.toLocaleString('es-PE')} lm
  ├─ Lúmenes Requeridos: ${calc.lumensRequired.toLocaleString('es-PE')} lm
  ├─ Cantidad Exacta: ${calc.exactQuantity.toFixed(2)} unidades
  ├─ Cantidad Redondeada: ${calc.roundedQuantity} unidades
  └─ Cantidad Recomendada: ${calc.recommendedQuantity} unidades ⭐

  Métricas:
  ├─ Uniformidad Estimada: ${((calc.uniformityEstimate || 0) * 100).toFixed(1)}%
  ├─ Cobertura: ${
            calc.coverage === 'optimal'
                ? '✓ ÓPTIMA'
                : calc.coverage === 'insufficient'
                  ? '⚠️ INSUFICIENTE'
                  : '⚠️ EXCESIVA'
        }
  └─ Estado: ${calc.coverage === 'optimal' ? '✅ CUMPLE' : '❌ REVISAR'}

`;
        });

        report += `
┌──────────────────────────────────────────────────────────────────────────────┐
│ NOTAS Y RECOMENDACIONES
└──────────────────────────────────────────────────────────────────────────────┘

1. Todos los cálculos se realizaron según EN 12464-1
2. La fórmula aplicada: ((Área × Norma) / 0.8) / 0.99
3. Se recomienda validar los resultados en simulación lumínica
4. Considerar factores de reflexión y características constructivas
5. Revisar ubicaciones de luminarias para uniformidad óptima

═══════════════════════════════════════════════════════════════════════════════
Generado por: Dialux Professional Lighting Calculator
═══════════════════════════════════════════════════════════════════════════════
`;

        return report;
    };

    return (
        <div className="space-y-6 p-6 bg-gradient-to-b from-slate-900 to-slate-800 rounded-lg border border-slate-700 min-h-screen">
            {/* Encabezado */}
            <div className="border-b border-slate-700 pb-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <BarChart3 className="w-8 h-8 text-amber-400" />
                        <div>
                            <h1 className="text-3xl font-bold text-white">
                                Dashboard de Iluminación
                            </h1>
                            <p className="text-sm text-slate-400">{projectName}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleExportReport}
                            className="px-4 py-2 rounded bg-slate-700 text-white text-sm font-semibold hover:bg-slate-600 transition-all flex items-center gap-2"
                        >
                            <Download size={16} />
                            Exportar
                        </button>
                    </div>
                </div>

                {/* Tabs de Vista */}
                <div className="flex gap-2">
                    {[
                        { mode: 'summary' as const, label: '📊 Resumen', icon: TrendingUp },
                        { mode: 'detailed' as const, label: '📋 Detallado', icon: Filter },
                        { mode: 'report' as const, label: '📄 Reporte', icon: Download },
                    ].map(({ mode, label }) => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`px-4 py-2 rounded text-sm font-semibold transition-all ${
                                viewMode === mode
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Contenido por Vista */}
            {viewMode === 'summary' && (
                <div className="space-y-6">
                    {/* Tarjetas de Resumen */}
                    <div className="grid grid-cols-4 gap-4">
                        <div className="bg-slate-700/50 p-4 rounded border border-slate-600">
                            <p className="text-slate-400 text-xs uppercase mb-2">Recintos</p>
                            <p className="text-4xl font-bold text-cyan-400">
                                {calculations.length}
                            </p>
                        </div>
                        <div className="bg-slate-700/50 p-4 rounded border border-slate-600">
                            <p className="text-slate-400 text-xs uppercase mb-2">
                                Luminarias Total
                            </p>
                            <p className="text-4xl font-bold text-emerald-400">{totalFixtures}</p>
                        </div>
                        <div className="bg-slate-700/50 p-4 rounded border border-slate-600">
                            <p className="text-slate-400 text-xs uppercase mb-2">Lúmenes</p>
                            <p className="text-3xl font-bold text-amber-400">
                                {(totalLumens / 1000).toFixed(1)}k
                            </p>
                        </div>
                        <div className="bg-slate-700/50 p-4 rounded border border-slate-600">
                            <p className="text-slate-400 text-xs uppercase mb-2">Óptimos</p>
                            <p className="text-4xl font-bold text-blue-400">
                                {calculations.filter((c) => c.coverage === 'optimal').length}
                            </p>
                        </div>
                    </div>

                    {/* Selección de Recinto */}
                    {calculations.length > 0 && (
                        <div className="bg-slate-700/30 border border-slate-600 rounded p-4">
                            <p className="text-slate-400 text-xs uppercase mb-3 tracking-wider">
                                Filtrar por Recinto
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setSelectedRoom(null)}
                                    className={`px-3 py-1 rounded text-sm transition-all ${
                                        selectedRoom === null
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                                    }`}
                                >
                                    Todos
                                </button>
                                {calculations.map((calc) => (
                                    <button
                                        key={calc.roomId}
                                        onClick={() => setSelectedRoom(calc.roomId)}
                                        className={`px-3 py-1 rounded text-sm transition-all flex items-center gap-1 ${
                                            selectedRoom === calc.roomId
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                                        }`}
                                    >
                                        <Home size={14} />
                                        {calc.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Lista de Cálculos Seleccionados */}
                    <div className="grid gap-3">
                        {selectedCalcs.map((calc) => (
                            <div
                                key={calc.id}
                                className="bg-slate-700/40 border border-slate-600 rounded p-4 hover:border-slate-500 transition-all"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h4 className="font-semibold text-white text-lg mb-1">
                                            {calc.name}
                                        </h4>
                                        <p className="text-xs text-slate-400">
                                            {calc.fixtureType} • {calc.area.toFixed(2)} m² •{' '}
                                            {calc.normaLux} lux
                                        </p>
                                    </div>
                                    <span
                                        className={`px-3 py-1 rounded font-bold text-lg ${
                                            calc.coverage === 'optimal'
                                                ? 'bg-emerald-900/40 text-emerald-400'
                                                : 'bg-amber-900/40 text-amber-400'
                                        }`}
                                    >
                                        {calc.recommendedQuantity} ✕
                                    </span>
                                </div>
                                <div className="grid grid-cols-4 gap-2 text-xs">
                                    <div>
                                        <p className="text-slate-400">Lm Req.</p>
                                        <p className="font-mono text-amber-400">
                                            {calc.lumensRequired.toLocaleString('es-PE')}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400">Exacta</p>
                                        <p className="font-mono text-blue-400">
                                            {calc.exactQuantity.toFixed(2)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400">Uniformidad</p>
                                        <p className="font-mono text-slate-300">
                                            {((calc.uniformityEstimate || 0) * 100).toFixed(0)}%
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400">Estado</p>
                                        <p
                                            className={`font-semibold ${
                                                calc.coverage === 'optimal'
                                                    ? 'text-emerald-400'
                                                    : 'text-amber-400'
                                            }`}
                                        >
                                            {calc.coverage === 'optimal' ? '✓ OK' : '⚠️ Revisar'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {viewMode === 'detailed' && (
                <ProfessionalLightingReport
                    calculations={selectedCalcs}
                    projectName={projectName}
                />
            )}

            {viewMode === 'report' && (
                <div className="bg-slate-700/30 border border-slate-600 rounded p-4">
                    <p className="text-slate-400 text-sm mb-4">
                        ✓ Reporte exportable en formato texto (.txt)
                    </p>
                    <button
                        onClick={handleExportReport}
                        className="px-6 py-3 rounded bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-all flex items-center gap-2"
                    >
                        <Download size={18} />
                        Descargar Reporte Completo
                    </button>
                </div>
            )}

            {/* Botón Agregar Cálculo */}
            {calculations.length === 0 && (
                <div className="text-center py-12 bg-slate-700/20 border border-dashed border-slate-600 rounded">
                    <Lightbulb className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                    <p className="text-slate-400 mb-4">
                        No hay cálculos aún. Crea el primero seleccionando un recinto.
                    </p>
                    <button
                        onClick={onAddCalculation}
                        className="px-6 py-2 rounded bg-amber-600 text-white font-semibold hover:bg-amber-500 transition-all inline-flex items-center gap-2"
                    >
                        <Plus size={18} />
                        Crear Primer Cálculo
                    </button>
                </div>
            )}
        </div>
    );
};
