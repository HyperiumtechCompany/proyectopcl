import { Loader2, Sun } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { buildWallOcclusionBoxes } from '@/pages/dialux/domain/geometry/occlusionBoxes';
import { calculateDaylightFactor, type DaylightFactorResult } from '@/pages/dialux/hooks/daylightFactorEngine';
import type { EnclosureReflectances } from '@/pages/dialux/hooks/roomPatches';
import type { Room } from '@/pages/dialux/hooks/types';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import { PanelCard } from '../primitives';

/**
 * Fase 17 del plan maestro ("Luz natural" — Daylight Factor, primer ciclo).
 * Conecta el motor `daylightFactorEngine.ts` (ya construido y probado) con
 * la UI — mismo patrón que `EmergenciaPanel.tsx`: cálculo bajo demanda, sin
 * persistir en el store global ni en `CalculationConfig` (el DF es un motor
 * paralelo al de luz eléctrica, ver el comentario de cabecera del motor).
 */

/** Igual criterio que `resolveMaterialId` (`buildCalculationSnapshot.ts`, Fase 16): sin los 3 campos, no hay material asignado. */
function resolveReflectances(room: Room): EnclosureReflectances | null {
    if (room.ceilingReflectance == null && room.wallReflectance == null && room.floorReflectance == null) {
        return null;
    }
    return {
        ceiling: room.ceilingReflectance ?? 0,
        wall: room.wallReflectance ?? 0,
        floor: room.floorReflectance ?? 0,
    };
}

export const LuzNaturalPanel: React.FC = () => {
    const scene = useEditorStore((s) => s.activeScene());
    const [resultsByRoom, setResultsByRoom] = useState<Record<string, DaylightFactorResult> | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);

    const rooms = useMemo(() => (scene?.rooms ?? []).filter((room) => room.roomType === 'ambient'), [scene]);

    const handleCalculate = () => {
        if (!scene) return;
        setIsCalculating(true);
        try {
            const obstacles = buildWallOcclusionBoxes(scene.walls, scene.windows, scene.doors);
            const next: Record<string, DaylightFactorResult> = {};
            for (const room of rooms) {
                next[room.id] = calculateDaylightFactor(room, scene.windows, scene.walls, resolveReflectances(room), obstacles);
            }
            setResultsByRoom(next);
        } finally {
            setIsCalculating(false);
        }
    };

    return (
        <div className="flex flex-col gap-2.5">
            <PanelCard title="Daylight Factor — cielo cubierto CIE">
                <p className="mb-2 text-[9.5px] leading-snug text-gray-500">
                    Componente de cielo (SC) + reflejada interna (IRC) bajo el cielo cubierto estándar (CIE Standard
                    Overcast Sky) — no depende de fecha, hora ni orientación del edificio (ver
                    `hooks/cieOvercastSky.ts`). Asigna vidrio a las ventanas (panel "Ventana") y reflectancia de
                    superficies al recinto (sección "Materiales fotométricos") antes de calcular.
                </p>
                <button
                    type="button"
                    onClick={handleCalculate}
                    disabled={!scene || isCalculating || rooms.length === 0}
                    className="flex w-full items-center justify-center gap-1.5 rounded bg-yellow-700/80 px-2 py-1.5 text-[11px] font-semibold text-yellow-50 transition hover:bg-yellow-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {isCalculating ? <Loader2 size={13} className="animate-spin" /> : <Sun size={13} />}
                    {isCalculating ? 'Calculando...' : 'Calcular Daylight Factor'}
                </button>
                <p className="mt-2 text-[9.5px] leading-snug text-gray-600">
                    Componente reflejada externa (ERC) no modelada en este ciclo — sin geometría de obstrucción/terreno
                    exterior, el resultado es una cota inferior conservadora del DF real, nunca un falso "cumple".
                </p>
            </PanelCard>

            {resultsByRoom && (
                <PanelCard title={`Resultados (${rooms.length} recinto${rooms.length === 1 ? '' : 's'})`}>
                    {rooms.length === 0 ? (
                        <p className="text-[10px] text-gray-500">Este nivel no tiene ambientes.</p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {rooms.map((room) => {
                                const result = resultsByRoom[room.id];
                                if (!result) {
                                    return null;
                                }
                                return (
                                    <div key={room.id} className="rounded border border-gray-700/30 p-2">
                                        <p className="mb-1 text-[11px] font-semibold text-gray-200">{room.name}</p>
                                        <p className="font-mono text-[10px] text-gray-300">
                                            avg {result.avg_df.toFixed(2)}% · min {result.min_df.toFixed(2)}% · max {result.max_df.toFixed(2)}%
                                        </p>
                                        {result.warnings.map((warning) => (
                                            <p key={warning.code} className="mt-1 text-[9.5px] text-amber-400">
                                                {warning.message}
                                            </p>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </PanelCard>
            )}
        </div>
    );
};
