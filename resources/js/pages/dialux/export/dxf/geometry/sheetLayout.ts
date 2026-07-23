import type { DxfBounds, DxfDiscipline } from '../domain/types';
import { translateBounds, unionBoundsList } from './bounds';

function widthOf(bounds: DxfBounds): number { return bounds.maxX - bounds.minX; }
function heightOf(bounds: DxfBounds): number { return bounds.maxY - bounds.minY; }

export interface DxfSheetLayoutRowInput {
    sceneId: string;
    /**
     * 1 o 2 láminas para este nivel, ya filtradas por el llamador (sección
     * 14.3: un nivel sin elementos de una especialidad simplemente no aporta
     * esa lámina — nunca un hueco reservado y vacío). El orden importa:
     * la primera va en la columna 0, la segunda (si existe) en la columna 1.
     */
    sheets: Array<{ discipline: DxfDiscipline; frame: DxfBounds }>;
}

export interface DxfSheetPlacement {
    sceneId: string;
    discipline: DxfDiscipline;
    /** Sumar a las coordenadas LOCALES de la lámina (marco en (0,0), Fase 3/4) para ubicarla en el dibujo completo. */
    placementOffset: { x: number; y: number };
    frameBoundsGlobal: DxfBounds;
}

export interface DxfSheetLayoutResult {
    placements: DxfSheetPlacement[];
    /** Unión de todos los `frameBoundsGlobal` — base de `$EXTMIN`/`$EXTMAX` (sección 14.1, pasos 7-8). */
    globalBounds: DxfBounds | null;
}

/**
 * Distribuye las láminas en filas (una por nivel, en el orden en que llegan
 * — ya ordenadas por `floorIndex`) y columnas (alumbrado primero, luego
 * tomacorrientes). Un nivel sin ninguna lámina no aporta fila: la siguiente
 * fila sube y cierra el hueco, en vez de dejar un espacio vacío reservado.
 * Ningún marco se solapa: cada fila usa la mayor altura de sus láminas más
 * la separación (sección 14.1).
 */
export function layoutDxfSheets(rows: DxfSheetLayoutRowInput[], separationM: number): DxfSheetLayoutResult {
    const placements: DxfSheetPlacement[] = [];
    let rowTopY = 0;

    for (const row of rows) {
        if (row.sheets.length === 0) continue;

        const rowHeight = Math.max(...row.sheets.map((sheet) => heightOf(sheet.frame)));
        const rowY = rowTopY - rowHeight;

        let cursorX = 0;
        for (const sheet of row.sheets) {
            const offset = { x: cursorX, y: rowY };
            placements.push({
                sceneId: row.sceneId,
                discipline: sheet.discipline,
                placementOffset: offset,
                frameBoundsGlobal: translateBounds(sheet.frame, offset.x, offset.y),
            });
            cursorX += widthOf(sheet.frame) + separationM;
        }

        rowTopY = rowY - separationM;
    }

    return {
        placements,
        globalBounds: unionBoundsList(placements.map((placement) => placement.frameBoundsGlobal)),
    };
}
