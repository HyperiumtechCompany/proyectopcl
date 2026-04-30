/**
 * useLightingEngine - Motor de calculo luminico en JavaScript puro.
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
