/**
 * useLightingEngine - Motor de calculo luminico en JavaScript puro.
 *
 * `calculate()` no tiene ningún llamador (auditoría `dialux-calc-reviewer`,
 * ver `planes/plan_cierre_brecha_paridad_dialux_evo.md`) — el único sitio
 * que lo invocaba (`EditorLayout.tsx`, respaldo cuando el Web Worker de
 * cálculo fallaba) fue migrado a `runDirectPreviewEngine()` porque este
 * método llama a `calculateLightingResult(room, fixtures)` SIN oclusión, sin
 * reflectancia/interreflexión, sin UGR de Guth (usa el UGR heredado, que
 * subestima el deslumbramiento en ángulos oblicuos por faltarle el escorzo
 * `cosγ` — ver `hooks/glareCalculation.ts`) y sin factor de mantenimiento.
 * NO reconectar este método a la UI sin resolver esas cuatro omisiones
 * primero — usar `runDirectPreviewEngine()` con
 * `buildProductionCalculationConfig()` en su lugar.
 */

import { useCallback, useState } from 'react';
import { calculateLightingResult } from './lightingEngineCore';
import type { Fixture, LightingResult, Room } from './useEditorStore';

export function useLightingEngine() {
    const [ready] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const calculate = useCallback(
        async (room: Room, fixtures: Fixture[]): Promise<LightingResult> => {
            setError(null);

            return new Promise((resolve) => {
                setTimeout(() => {
                    try {
                        resolve(calculateLightingResult(room, fixtures));
                    } catch (calculationError) {
                        setError(String(calculationError));
                        resolve({
                            avg_lux: 0,
                            min_lux: 0,
                            max_lux: 0,
                            uniformity: 0,
                            ugr: 0,
                            grid_rows: 0,
                            grid_cols: 0,
                            grid_values: [],
                        });
                    }
                }, 0);
            });
        },
        [],
    );

    return { ready, error, calculate };
}
