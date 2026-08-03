import {
    DEFAULT_LEGEND_COLUMN_HEADER_HEIGHT_MM, DEFAULT_LEGEND_HEADER_HEIGHT_MM, DEFAULT_LEGEND_ROW_HEIGHT_MM,
    DEFAULT_LEGEND_SYMBOL_COLUMN_WIDTH_MM, DEFAULT_LEGEND_TEXT_HEIGHT_MM, LEGEND_CABLE_SWATCH_COLOR_ACI,
} from '../domain/constants';
import type { DxfBounds, DxfLegendRow } from '../domain/types';
import { paperMmToModelM } from '../geometry/sheetScale';
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
 * Tabla de leyenda genérica (sección 8.3), reutilizada tanto por la leyenda
 * de alumbrado (Fase 6) como por la de tomacorrientes (Fase 7): título,
 * encabezados de columna ("SIMBOLO"/"DESCRIPCION"), filas separadas por
 * líneas horizontales y una columna de símbolo delimitada — mismo espíritu
 * de tabla que una leyenda de plano eléctrico real, con color en cada
 * símbolo en vez de un contorno genérico. Nunca omite filas: si no caben ni
 * en 2 columnas, las dibuja igual y reporta `overflow: true` para que el
 * llamador (Fase 8/9) pueda advertir o ajustar papel/escala.
 */
export function renderLegendTable(
    out: DxfLines,
    layer: string,
    legendArea: DxfBounds,
    scaleDenominator: number,
    title: string,
    rows: DxfLegendRow[],
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

    // Encabezados de columna, debajo del título.
    const columnHeaderY = legendArea.maxY - headerHeight;
    dxfLine(out, layer, legendArea.minX, columnHeaderY, legendArea.maxX, columnHeaderY);
    dxfText(out, layer, legendArea.minX + textHeight * 0.5, columnHeaderY - columnHeaderHeight * 0.7, textHeight * 0.9, 'SIMBOLO');
    dxfText(out, layer, legendArea.minX + symbolColumnWidth + textHeight * 0.5, columnHeaderY - columnHeaderHeight * 0.7, textHeight * 0.9, 'DESCRIPCION');

    const rowsTopY = columnHeaderY - columnHeaderHeight;
    const availableHeight = areaHeight - headerHeight - columnHeaderHeight;
    const rowsPerColumnFor = (columnCount: 1 | 2) => Math.ceil(rows.length / columnCount);
    const fitsWithColumns = (columnCount: 1 | 2) => rowsPerColumnFor(columnCount) * rowHeight <= availableHeight;

    let columnCount: 1 | 2 = 1;
    let overflow = false;
    if (!fitsWithColumns(1)) {
        columnCount = 2;
        if (!fitsWithColumns(2)) overflow = true;
    }

    const columnWidth = areaWidth / columnCount;
    const rowsPerColumn = rowsPerColumnFor(columnCount);
    const symbolSize = Math.min(symbolColumnWidth, rowHeight) * 0.35;

    for (let column = 0; column < columnCount; column++) {
        const columnX = legendArea.minX + column * columnWidth;
        // Separador vertical entre la columna de símbolo y la de texto.
        dxfLine(out, layer, columnX + symbolColumnWidth, rowsTopY, columnX + symbolColumnWidth, Math.max(rowsTopY - rowsPerColumn * rowHeight, legendArea.minY));
    }

    rows.forEach((row, index) => {
        const column = Math.floor(index / rowsPerColumn);
        const rowInColumn = index % rowsPerColumn;
        const columnX = legendArea.minX + column * columnWidth;
        const rowTopY = rowsTopY - rowInColumn * rowHeight;
        const symbolCenterY = rowTopY - rowHeight / 2;

        renderRowSymbol(out, layer, row, columnX + symbolColumnWidth / 2, symbolCenterY, symbolSize);

        const textX = columnX + symbolColumnWidth + textHeight * 0.5;
        const textY = rowTopY - rowHeight * 0.65;
        const extra = row.technicalFields.length > 0 ? ` · ${row.technicalFields.join(' · ')}` : '';
        dxfText(out, layer, textX, textY, textHeight, `${row.code}  ${row.description}${extra}  x${row.quantity}`);

        // Separador horizontal debajo de la fila (lectura tipo tabla, como la referencia).
        dxfLine(out, layer, columnX, rowTopY - rowHeight, columnX + columnWidth, rowTopY - rowHeight);
    });

    return { columnCount, overflow };
}
