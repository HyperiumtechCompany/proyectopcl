import { DEFAULT_TITLE_BLOCK_TEXT_HEIGHT_MM } from '../domain/constants';
import type { DxfSheetGeometry, DxfSheetMetadata } from '../domain/types';
import { paperMmToModelM } from '../geometry/sheetScale';
import { dxfPolyLines, dxfText, rectCorners, type DxfLines } from './primitives';

interface TitleBlockRow {
    label: string;
    value: string;
}

/** Las 11 filas mínimas del cajetín (sección 8.4), en orden fijo. */
function buildRows(metadata: DxfSheetMetadata): TitleBlockRow[] {
    return [
        { label: 'PROYECTO', value: metadata.projectName },
        { label: 'LAMINA', value: `${metadata.levelName} - ${metadata.disciplineLabel}` },
        { label: 'NIVEL', value: metadata.levelName },
        { label: 'ESPECIALIDAD', value: metadata.disciplineLabel },
        { label: 'ESCALA', value: `1:${metadata.scaleDenominator}` },
        { label: 'UNIDADES', value: metadata.units },
        { label: 'FECHA', value: metadata.exportedAtLabel },
        { label: 'DIBUJADO POR', value: metadata.drawnBy ?? '-' },
        { label: 'REVISADO POR', value: metadata.reviewedBy ?? '-' },
        { label: 'REVISION', value: metadata.revision ?? '-' },
        { label: 'N. LAMINA', value: metadata.sheetNumber },
    ];
}

/**
 * Dibuja el cajetín (sección 8.4): rectángulo en la capa `CAJETIN` + una fila
 * de texto por campo en `TEXTO_LAMINA`. Las 11 filas se renderizan siempre en
 * el mismo orden — los campos ausentes (autor/revisor) muestran "-" en vez de
 * omitirse, para que la lámina nunca quede con una fila faltante a mitad del
 * cajetín (criterio de cierre: título, nivel, especialidad, escala y número
 * siempre legibles).
 */
export function renderTitleBlock(out: DxfLines, geometry: DxfSheetGeometry, metadata: DxfSheetMetadata): void {
    const area = geometry.titleBlockArea;
    dxfPolyLines(out, 'CAJETIN', rectCorners(area), true);

    const rows = buildRows(metadata);
    const textHeight = paperMmToModelM(DEFAULT_TITLE_BLOCK_TEXT_HEIGHT_MM, geometry.scaleDenominator);
    const paddingX = paperMmToModelM(2, geometry.scaleDenominator);
    const areaHeight = area.maxY - area.minY;
    const rowHeight = areaHeight / rows.length;

    rows.forEach((row, index) => {
        const rowTopY = area.maxY - index * rowHeight;
        const textY = rowTopY - rowHeight * 0.7;
        dxfText(out, 'TEXTO_LAMINA', area.minX + paddingX, textY, textHeight, `${row.label}: ${row.value}`);
    });
}
