import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import React, { useState } from 'react';
import {
    evaluateEmergencyCompliance,
    type EmergencyRequirementEvaluation,
} from '@/pages/dialux/domain/calculation/emergencyCompliance';
import { runProjectLightingCalculation } from '@/pages/dialux/domain/calculation/runProjectLightingCalculation';
import { DEFAULT_DIRECT_PREVIEW_CONFIG } from '@/pages/dialux/domain/calculation/types';
import { useDialuxEmergencyPdfExport } from '@/pages/dialux/export';
import type { DrawTool, Room } from '@/pages/dialux/hooks/types';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import { PanelCard, PanelToolBtn } from '../primitives';

/**
 * Fase 16 (a pedido del usuario): completa el gap de la Fase 14, que dejó
 * el motor/normativa de emergencia listos (`emergencyCompliance.ts`,
 * `runDirectPreviewEngine.ts` con `emergencyMode`, `useDialuxEmergencyPdfExport`)
 * pero SIN ninguna UI para marcar un `Room` como ruta de evacuación/área
 * antipánico ni para ver su cumplimiento. Este panel conecta esas piezas ya
 * construidas — no agrega motor nuevo.
 */

const DRAW_TOOLS: Array<{ tool: DrawTool; tip: string; sublabel: string }> = [
    { tool: 'evacuation-route', tip: 'Ruta de evacuación', sublabel: 'Poligono unico (A.130 + EN 1838)' },
    { tool: 'antipanic-area', tip: 'Área antipánico', sublabel: 'Poligono unico (solo EN 1838)' },
];

function StandardBadge({ evaluation }: { evaluation: EmergencyRequirementEvaluation }) {
    const icon =
        evaluation.status === 'pass' ? (
            <CheckCircle2 size={12} className="text-emerald-400" />
        ) : evaluation.status === 'fail' ? (
            <XCircle size={12} className="text-red-400" />
        ) : (
            <AlertTriangle size={12} className="text-gray-500 dark:text-gray-500" />
        );

    return (
        <div className="flex items-start gap-1.5 rounded border border-gray-300 dark:border-gray-700/40 bg-gray-200 dark:bg-gray-900/40 px-2 py-1.5">
            {icon}
            <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-gray-800 dark:text-gray-800 dark:text-gray-200">
                    {evaluation.source} {evaluation.mandatory ? '(obligatoria en Perú)' : '(referencia)'}
                </p>
                <p className="text-[9.5px] text-gray-500 dark:text-gray-500">
                    {evaluation.status === 'not-evaluated'
                        ? `Requiere ${evaluation.requiredLux} lx — aún no calculado`
                        : `${evaluation.calculatedLux?.toFixed(1)} lx (mínimo) — requiere ≥${evaluation.requiredLux} lx`}
                </p>
            </div>
        </div>
    );
}

export const EmergenciaPanel: React.FC = () => {
    const project = useEditorStore((s) => s.project);
    const scene = useEditorStore((s) => s.activeScene());
    const activeTool = useEditorStore((s) => s.ui.activeTool);
    const setTool = useEditorStore((s) => s.setTool);
    const { exportEmergencyPdf, isExporting } = useDialuxEmergencyPdfExport();

    const [minLuxByRoom, setMinLuxByRoom] = useState<Record<string, number> | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [calcError, setCalcError] = useState<string | null>(null);

    const emergencyRooms: Room[] = (scene?.rooms ?? []).filter(
        (room): room is Room & { roomType: 'evacuation-route' | 'antipanic-area' } =>
            room.roomType === 'evacuation-route' || room.roomType === 'antipanic-area',
    );

    const handleCalculate = async () => {
        if (!project) return;
        setIsCalculating(true);
        setCalcError(null);
        try {
            const { resultsByRoom } = await runProjectLightingCalculation(project, {
                ...DEFAULT_DIRECT_PREVIEW_CONFIG,
                emergencyMode: true,
            });
            const next: Record<string, number> = {};
            for (const [roomId, result] of Object.entries(resultsByRoom)) {
                next[roomId] = result.min_lux;
            }
            setMinLuxByRoom(next);
        } catch (error) {
            setCalcError(error instanceof Error ? error.message : 'No se pudo calcular el modo de emergencia.');
        } finally {
            setIsCalculating(false);
        }
    };

    return (
        <div className="flex flex-col gap-2.5">
            <PanelCard title="Dibujar" tone="warning">
                <div className="grid grid-cols-1 gap-1">
                    {DRAW_TOOLS.map((tool) => (
                        <PanelToolBtn
                            key={tool.tool}
                            tool={tool.tool}
                            icon={<AlertTriangle size={13} />}
                            tip={tool.tip}
                            sublabel={tool.sublabel}
                            active={activeTool}
                            onSet={setTool}
                        />
                    ))}
                </div>
                <p className="mt-2 text-[9.5px] leading-snug text-gray-600 dark:text-gray-600">
                    Se dibujan como un polígono único, igual que un pasadizo — sin
                    subdivisión por muros interiores.
                </p>
            </PanelCard>

            <PanelCard title={`Ambientes de emergencia (${emergencyRooms.length})`}>
                {emergencyRooms.length === 0 ? (
                    <p className="text-[10px] text-gray-500 dark:text-gray-500">
                        Ningún ambiente marcado todavía. Usa las herramientas de arriba
                        para dibujar una ruta de evacuación o un área antipánico.
                    </p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {emergencyRooms.map((room) => {
                            const minLux = minLuxByRoom?.[room.id] ?? null;
                            const evaluations = evaluateEmergencyCompliance(
                                room.roomType as 'evacuation-route' | 'antipanic-area',
                                minLux,
                            );
                            return (
                                <div key={room.id} className="rounded border border-gray-300 dark:border-gray-700/30 p-2">
                                    <p className="mb-1.5 text-[11px] font-semibold text-gray-800 dark:text-gray-800 dark:text-gray-200">
                                        {room.name}{' '}
                                        <span className="font-normal text-gray-500 dark:text-gray-500">
                                            ({room.roomType === 'evacuation-route' ? 'ruta de evacuación' : 'área antipánico'})
                                        </span>
                                    </p>
                                    <div className="flex flex-col gap-1">
                                        {evaluations.map((evaluation) => (
                                            <StandardBadge key={evaluation.standard} evaluation={evaluation} />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </PanelCard>

            <PanelCard title="Cálculo y exportación">
                <button
                    type="button"
                    onClick={handleCalculate}
                    disabled={!project || isCalculating || emergencyRooms.length === 0}
                    className="mb-1.5 flex w-full items-center justify-center gap-1.5 rounded bg-amber-700/80 px-2 py-1.5 text-[11px] font-semibold text-amber-50 transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {isCalculating ? <Loader2 size={13} className="animate-spin" /> : <AlertTriangle size={13} />}
                    {isCalculating ? 'Calculando...' : 'Calcular emergencia'}
                </button>
                {calcError && <p className="mb-1.5 text-[9.5px] text-red-400">{calcError}</p>}
                <button
                    type="button"
                    onClick={() => void exportEmergencyPdf().catch(() => {})}
                    disabled={!project || isExporting || emergencyRooms.length === 0}
                    className="flex w-full items-center justify-center gap-1.5 rounded border border-amber-700/40 px-2 py-1.5 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-900/30 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {isExporting ? 'Generando...' : 'Exportar informe de emergencia'}
                </button>
                <p className="mt-1.5 text-[9.5px] leading-snug text-gray-600 dark:text-gray-600">
                    A.130 y EN 1838 se evalúan y muestran siempre por separado, nunca
                    fusionados en un solo número — ver `emergencyCompliance.ts`.
                </p>
            </PanelCard>
        </div>
    );
};
