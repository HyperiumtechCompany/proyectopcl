import type { LightingResult } from '@/pages/dialux/hooks/types';

/**
 * Fase 11 del plan maestro ("Resultados profesionales", §11: "saltar a
 * mínimo/máximo"). Función PURA: localiza el punto de malla con el valor
 * mínimo o máximo de un `LightingResult` ya calculado — no recalcula nada,
 * solo recorre `grid_values` y traduce el índice a coordenadas de mundo
 * usando la misma convención de `buildGrid` (`hooks/lightingEngineCore.ts`):
 * `x = origin_x + (col + 0.5) * cell_width`, fila-mayor (`índice = fila·cols + col`).
 */
export interface ResultExtremum {
    value: number;
    x: number;
    y: number;
    rowIndex: number;
    colIndex: number;
}

/**
 * `null` cuando el resultado no tiene metadatos de malla completos (origen/
 * tamaño de celda — un `LightingResult` no producido por
 * `calculateLightingResult`, ej. construido a mano en un test) o no tiene
 * ningún punto activo con valor.
 */
export function findResultExtremum(result: LightingResult, kind: 'min' | 'max'): ResultExtremum | null {
    const { grid_values: gridValues, grid_cols: cols, grid_origin_x: originX, grid_origin_y: originY, grid_cell_width: cellWidth, grid_cell_height: cellHeight } = result;

    if (originX === undefined || originY === undefined || cellWidth === undefined || cellHeight === undefined || cols <= 0) {
        return null;
    }

    let best: ResultExtremum | null = null;

    for (let i = 0; i < gridValues.length; i++) {
        const value = gridValues[i];
        if (value === null) {
            continue;
        }

        if (best === null || (kind === 'min' ? value < best.value : value > best.value)) {
            const rowIndex = Math.floor(i / cols);
            const colIndex = i % cols;
            best = {
                value,
                x: originX + (colIndex + 0.5) * cellWidth,
                y: originY + (rowIndex + 0.5) * cellHeight,
                rowIndex,
                colIndex,
            };
        }
    }

    return best;
}
