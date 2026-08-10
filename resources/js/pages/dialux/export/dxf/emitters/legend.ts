import {
    DEFAULT_LEGEND_COLUMN_HEADER_HEIGHT_MM, DEFAULT_LEGEND_HEADER_HEIGHT_MM, DEFAULT_LEGEND_ROW_HEIGHT_MM,
    DEFAULT_LEGEND_SYMBOL_COLUMN_WIDTH_MM, DEFAULT_LEGEND_TEXT_HEIGHT_MM, LEGEND_CABLE_SWATCH_COLOR_ACI,
} from '../domain/constants';
import type { DxfBounds, DxfLegendColumnDef, DxfLegendRow } from '../domain/types';
import { modelMToPaperMm, paperMmToModelM } from '../geometry/sheetScale';
import { renderElectricalDeviceSymbol, renderJunctionBoxSymbol } from '../symbols/outletSymbols';
import { renderFixtureSymbol, renderLightSwitchSymbol } from '../symbols/lightingSymbols';
import { dxfLine, dxfPolyLines, dxfText, rectCorners, type DxfLines } from './primitives';

export interface DxfLegendRenderResult {
    columnCount: 1 | 2;
    /** true si ni siquiera repartiendo en 2 columnas caben todas las filas en `legendArea` (Riesgo 6 del plan maestro). */
    overflow: boolean;
}

/**
 * Dibuja la celda de símbolo de una fila con el MISMO renderer que la
 * entidad correspondiente en planta (Fase 5) — nunca una letra aproximada
 * (sección 9.3), y con su mismo color real (nunca el color por capa
 * genérico). Filas de cableado (sin `symbolRef`) dibujan un trazo de
 * muestra en vez de un símbolo geométrico.
 */
function renderRowSymbol(out: DxfLines, layer: string, row: DxfLegendRow, x: number, y: number, sizeM: number): void {
    if (!row.symbolRef) {
        dxfLine(out, layer, x - sizeM, y, x + sizeM, y, LEGEND_CABLE_SWATCH_COLOR_ACI);
        return;
    }
    if (row.symbolRef.kind === 'fixture') {
        renderFixtureSymbol(out, layer, { x, y, sizeM, catalogSymbol: row.symbolRef.catalogSymbol });
    } else if (row.symbolRef.kind === 'switch') {
        renderLightSwitchSymbol(out, layer, { x, y, sizeM });
    } else if (row.symbolRef.kind === 'junctionBox') {
        renderJunctionBoxSymbol(out, layer, { x, y, sizeM });
    } else {
        renderElectricalDeviceSymbol(out, layer, { x, y, sizeM, type: row.symbolRef.deviceType ?? '' });
    }
}

/**
 * Recorta `text` para que quepa en `widthMm` (mm de papel) a la altura de
 * texto `textHeightMm` dada, con "..." si no entra — AC1009 TEXT no recorta
 * solo, así que un nombre de producto largo invadiría la columna fija
 * siguiente (ninguna otra capa protege contra esto). `0.6` es una relación
 * ancho/alto conservadora para la fuente por defecto de R12 (`txt.shx`).
 */
export function truncateToWidth(text: string, widthMm: number, textHeightMm: number): string {
    const maxChars = Math.floor(widthMm / (textHeightMm * 0.85));
    if (maxChars <= 0 || text.length <= maxChars) return text;
    if (maxChars <= 3) return text.slice(0, maxChars);
    return `${text.slice(0, maxChars - 3)}...`;
}

/**
 * Tabla de leyenda genérica (sección 8.3), reutilizada tanto por la leyenda
 * de alumbrado (Fase 6) como por la de tomacorrientes (Fase 7): título,
 * columna de símbolo (misma primitiva que en planta) + columnas de datos
 * configurables por `columns` (sección 9.2/10.2 — p.ej. DESCRIPCION,
 * POTENCIA, FLUJO, MONTAJE, CANT.), filas separadas por líneas horizontales.
 * Nunca omite filas: si no caben ni en 2 columnas, las dibuja igual y
 * reporta `overflow: true` para que el llamador (Fase 8/9) pueda advertir o
 * ajustar papel/escala.
 */
export function renderLegendTable(
    out: DxfLines,
    layer: string,
    legendArea: DxfBounds,
    scaleDenominator: number,
    title: string,
    rows: DxfLegendRow[],
    columns: DxfLegendColumnDef[],
): DxfLegendRenderResult {
    const areaWidth = legendArea.maxX - legendArea.minX;
    const areaHeight = legendArea.maxY - legendArea.minY;
    const headerHeight = paperMmToModelM(DEFAULT_LEGEND_HEADER_HEIGHT_MM, scaleDenominator);
    const columnHeaderHeight = paperMmToModelM(DEFAULT_LEGEND_COLUMN_HEADER_HEIGHT_MM, scaleDenominator);
    const rowHeight = paperMmToModelM(DEFAULT_LEGEND_ROW_HEIGHT_MM, scaleDenominator);
    const textHeight = paperMmToModelM(DEFAULT_LEGEND_TEXT_HEIGHT_MM, scaleDenominator);
    const symbolColumnWidth = paperMmToModelM(DEFAULT_LEGEND_SYMBOL_COLUMN_WIDTH_MM, scaleDenominator);

    dxfPolyLines(out, layer, rectCorners(legendArea), true);
    dxfText(out, layer, legendArea.minX + textHeight, legendArea.maxY - headerHeight * 0.7, textHeight * 1.1, title);

    if (rows.length === 0) {
        return { columnCount: 1, overflow: false };
    }

    const rowsTopYBase = legendArea.maxY - headerHeight - columnHeaderHeight;
    const availableHeight = areaHeight - headerHeight - columnHeaderHeight;
    const rowsPerColumnFor = (columnCount: 1 | 2) => Math.ceil(rows.length / columnCount);
    const fitsWithColumns = (columnCount: 1 | 2) => rowsPerColumnFor(columnCount) * rowHeight <= availableHeight;

    let columnCount: 1 | 2 = 1;
    let overflow = false;
    if (!fitsWithColumns(1)) {
        columnCount = 2;
        if (!fitsWithColumns(2)) overflow = true;
    }

    const overflowColumnWidth = areaWidth / columnCount;
    const rowsPerColumn = rowsPerColumnFor(columnCount);
    const symbolSize = Math.min(symbolColumnWidth, rowHeight) * 0.35;

    // Reparto de las columnas de DATOS (sección 9.2/10.2) dentro de cada
    // columna de overflow: anchos fijos en mm de papel, y la columna 'flex'
    // (normalmente DESCRIPCION) se queda con el resto.
    const dataWidthMm = modelMToPaperMm(overflowColumnWidth - symbolColumnWidth, scaleDenominator);
    const fixedWidthMm = columns.reduce((sum, col) => sum + (col.widthMm === 'flex' ? 0 : col.widthMm), 0);
    const flexWidthMm = Math.max(0, dataWidthMm - fixedWidthMm);
    const columnWidthsM = columns.map((col) =>
        paperMmToModelM(col.widthMm === 'flex' ? flexWidthMm : col.widthMm, scaleDenominator),
    );
    const columnWidthsMm = columns.map((col) => (col.widthMm === 'flex' ? flexWidthMm : col.widthMm));

    for (let column = 0; column < columnCount; column++) {
        const columnX = legendArea.minX + column * overflowColumnWidth;
        const columnBottomY = Math.max(rowsTopYBase - rowsPerColumn * rowHeight, legendArea.minY);

        // Encabezados de columna, debajo del título — repetidos en CADA
        // columna de overflow (antes solo se dibujaban una vez).
        const headerY = legendArea.maxY - headerHeight;
        dxfLine(out, layer, columnX, headerY, columnX + overflowColumnWidth, headerY);
        dxfText(out, layer, columnX + textHeight * 0.5, headerY - columnHeaderHeight * 0.7, textHeight * 0.9, 'SIMBOLO');
        let headerX = columnX + symbolColumnWidth;
        for (let c = 0; c < columns.length; c++) {
            dxfText(out, layer, headerX + textHeight * 0.5, headerY - columnHeaderHeight * 0.7, textHeight * 0.9, columns[c].header);
            headerX += columnWidthsM[c];
        }

        // Separadores verticales: símbolo|datos, y entre cada columna de datos.
        dxfLine(out, layer, columnX + symbolColumnWidth, rowsTopYBase, columnX + symbolColumnWidth, columnBottomY);
        let sepX = columnX + symbolColumnWidth;
        for (let c = 0; c < columns.length - 1; c++) {
            sepX += columnWidthsM[c];
            dxfLine(out, layer, sepX, rowsTopYBase, sepX, columnBottomY);
        }
    }

    rows.forEach((row, index) => {
        const column = Math.floor(index / rowsPerColumn);
        const rowInColumn = index % rowsPerColumn;
        const columnX = legendArea.minX + column * overflowColumnWidth;
        const rowTopY = rowsTopYBase - rowInColumn * rowHeight;
        const symbolCenterY = rowTopY - rowHeight / 2;

        renderRowSymbol(out, layer, row, columnX + symbolColumnWidth / 2, symbolCenterY, symbolSize);

        const textY = rowTopY - rowHeight * 0.65;
        let cellX = columnX + symbolColumnWidth;
        columns.forEach((col, c) => {
            const value = truncateToWidth(col.extract(row), columnWidthsMm[c], DEFAULT_LEGEND_TEXT_HEIGHT_MM);
            dxfText(out, layer, cellX + textHeight * 0.5, textY, textHeight, value);
            cellX += columnWidthsM[c];
        });

        // Separador horizontal debajo de la fila (lectura tipo tabla, como la referencia).
        dxfLine(out, layer, columnX, rowTopY - rowHeight, columnX + overflowColumnWidth, rowTopY - rowHeight);
    });

    return { columnCount, overflow };
}
