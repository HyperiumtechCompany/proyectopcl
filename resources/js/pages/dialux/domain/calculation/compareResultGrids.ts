import type { LightingResult } from '@/pages/dialux/hooks/types';

/**
 * Fase 11 del plan maestro ("Resultados profesionales", §11: "diferencias
 * entre mallas"). Función PURA: compara dos `LightingResult` PUNTO A PUNTO
 * (no solo promedios/agregados, a diferencia de `compareLightingScenes.ts`
 * de la Fase 10) para el mismo ambiente calculado dos veces (ej. antes/
 * después de un cambio, o dos escenas/configuraciones).
 *
 * Requiere que AMBAS mallas tengan exactamente la misma forma (filas,
 * columnas, origen, tamaño de celda) — comparar puntos con coordenadas
 * distintas no tendría sentido sin interpolar, y este ciclo no implementa
 * interpolación entre mallas (documentado como pendiente). Devuelve `null`
 * cuando las mallas no son comparables, en vez de forzar una comparación
 * espuria.
 */
export interface GridDiffPoint {
    x: number;
    y: number;
    valueA: number | null;
    valueB: number | null;
    /** `valueB - valueA`, `null` si cualquiera de los dos puntos está inactivo (fuera del recinto). */
    delta: number | null;
}

export interface GridDiffResult {
    rows: number;
    cols: number;
    points: GridDiffPoint[];
    /** Mayor `|delta|` entre todos los puntos activos — útil para escalar un mapa de diferencias sin recorrer `points` de nuevo. */
    maxAbsDelta: number;
}

function hasMatchingGridShape(a: LightingResult, b: LightingResult): boolean {
    return (
        a.grid_rows === b.grid_rows &&
        a.grid_cols === b.grid_cols &&
        a.grid_origin_x === b.grid_origin_x &&
        a.grid_origin_y === b.grid_origin_y &&
        a.grid_cell_width === b.grid_cell_width &&
        a.grid_cell_height === b.grid_cell_height &&
        a.grid_values.length === b.grid_values.length
    );
}

export function compareResultGrids(baseline: LightingResult, comparison: LightingResult): GridDiffResult | null {
    if (!hasMatchingGridShape(baseline, comparison)) {
        return null;
    }

    const { grid_cols: cols, grid_rows: rows, grid_origin_x: originX, grid_origin_y: originY, grid_cell_width: cellWidth, grid_cell_height: cellHeight } = baseline;

    if (originX === undefined || originY === undefined || cellWidth === undefined || cellHeight === undefined) {
        return null;
    }

    const points: GridDiffPoint[] = [];
    let maxAbsDelta = 0;

    for (let i = 0; i < baseline.grid_values.length; i++) {
        const valueA = baseline.grid_values[i] ?? null;
        const valueB = comparison.grid_values[i] ?? null;
        const delta = valueA !== null && valueB !== null ? valueB - valueA : null;
        if (delta !== null) {
            maxAbsDelta = Math.max(maxAbsDelta, Math.abs(delta));
        }

        const rowIndex = Math.floor(i / cols);
        const colIndex = i % cols;
        points.push({
            x: originX + (colIndex + 0.5) * cellWidth,
            y: originY + (rowIndex + 0.5) * cellHeight,
            valueA,
            valueB,
            delta,
        });
    }

    return { rows, cols, points, maxAbsDelta };
}
