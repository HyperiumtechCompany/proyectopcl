import type {
    DxfPaperFormat,
    DxfPaperOrientation,
    DxfPaperSize,
    DxfSheetReservedZonesMm,
} from './types';

/** Tamaños ISO 216 en orientación vertical (mm). */
const ISO_PAPER_SIZES_PORTRAIT_MM: Record<DxfPaperFormat, DxfPaperSize> = {
    A0: { widthMm: 841, heightMm: 1189 },
    A1: { widthMm: 594, heightMm: 841 },
    A2: { widthMm: 420, heightMm: 594 },
    A3: { widthMm: 297, heightMm: 420 },
    A4: { widthMm: 210, heightMm: 297 },
};

/** Catálogo de formatos ISO (sección 15: "Formato: A0, A1, A2, A3 o A4"). */
export function resolvePaperSizeMm(format: DxfPaperFormat, orientation: DxfPaperOrientation): DxfPaperSize {
    const portrait = ISO_PAPER_SIZES_PORTRAIT_MM[format];
    return orientation === 'landscape'
        ? { widthMm: portrait.heightMm, heightMm: portrait.widthMm }
        : { ...portrait };
}

/** Escalas de impresión normalizadas permitidas inicialmente (sección 7.1), ascendente. */
export const ALLOWED_SCALE_DENOMINATORS: readonly number[] = [25, 50, 75, 100, 125, 150, 200];

export const DEFAULT_PAPER_FORMAT: DxfPaperFormat = 'A1';
export const DEFAULT_PAPER_ORIENTATION: DxfPaperOrientation = 'landscape';

/**
 * Valores iniciales de reserva (mm de papel). Son configurables — no forman
 * parte de ningún requisito numérico del plan maestro — y quedarán expuestos
 * como opciones de usuario en la Fase 9; hasta entonces son el default.
 */
export const DEFAULT_RESERVED_ZONES_MM: DxfSheetReservedZonesMm = {
    marginMm: 10,
    legendColumnWidthMm: 190,
    titleBlockHeightMm: 90,
};

/** Capas de marco/cajetín/metadatos (sección 11), agregadas en la Fase 4. */
export const SHEET_LAYER_DEFS: ReadonlyArray<{ name: string; color: number }> = [
    { name: 'MARCO', color: 7 },
    { name: 'CAJETIN', color: 7 },
    { name: 'TEXTO_LAMINA', color: 7 },
];

/** Altura de texto del cajetín, en mm de papel (se convierte a metros según la escala de cada lámina). */
export const DEFAULT_TITLE_BLOCK_TEXT_HEIGHT_MM = 2.2;

/** Etiquetas legibles por disciplina, usadas en el cajetín y en los nombres de lámina. */
export const DISCIPLINE_LABELS: Record<'lighting' | 'outlets', string> = {
    lighting: 'ALUMBRADO',
    outlets: 'TOMACORRIENTES',
};

/** Geometría de la tabla de leyenda (sección 8.3/9/10), en mm de papel. */
export const DEFAULT_LEGEND_HEADER_HEIGHT_MM = 8;
/** Fila de encabezados de columna ("SIMBOLO" / "DESCRIPCION"), debajo del título. */
export const DEFAULT_LEGEND_COLUMN_HEADER_HEIGHT_MM = 5;
export const DEFAULT_LEGEND_ROW_HEIGHT_MM = 7;
export const DEFAULT_LEGEND_TEXT_HEIGHT_MM = 2.0;
export const DEFAULT_LEGEND_SYMBOL_COLUMN_WIDTH_MM = 14;

/** Color ACI por defecto del trazo de muestra de una fila de cableado (sin símbolo geométrico propio). */
export const LEGEND_CABLE_SWATCH_COLOR_ACI = 1;

/**
 * Capas del documento multilámina (Fase 8, sección 11) — más finas que las
 * del exportador de un solo plano (`buildDialuxDxfExport.ts`) para que cada
 * disciplina pueda ocultarse por separado en el visor CAD (criterio de
 * aceptación, sección 21).
 */
export const MULTISHEET_LAYER_DEFS: ReadonlyArray<{ name: string; color: number }> = [
    { name: '0', color: 7 },
    { name: 'DXF_BASE', color: 8 },
    { name: 'RECINTOS', color: 4 },
    { name: 'PAREDES', color: 7 },
    { name: 'VENTANAS', color: 5 },
    { name: 'PUERTAS', color: 3 },
    { name: 'CANOPIES', color: 9 },
    { name: 'LUMINARIAS', color: 2 },
    { name: 'INTERRUPTORES', color: 6 },
    { name: 'TOMACORRIENTES', color: 1 },
    { name: 'TABLEROS', color: 30 },
    { name: 'CABLEADO_LUZ', color: 1 },
    { name: 'CABLEADO_TOMAS', color: 1 },
    { name: 'CAJAS_PASE', color: 30 },
    { name: 'TEXTO_RECINTOS', color: 4 },
    { name: 'TEXTO_LUZ', color: 2 },
    { name: 'TEXTO_TOMAS', color: 30 },
    { name: 'MARCO', color: 7 },
    { name: 'CAJETIN', color: 7 },
    { name: 'LEYENDA_LUZ', color: 7 },
    { name: 'LEYENDA_TOMAS', color: 7 },
    { name: 'TEXTO_LAMINA', color: 7 },
    { name: 'REVISION_DXF', color: 1 },
];

/** Separación por defecto entre láminas en Model Space (metros). */
export const DEFAULT_SHEET_SEPARATION_M = 5;

/** Margen alrededor de la unión de todos los marcos, para `$EXTMIN`/`$EXTMAX` (Fase 8, sección 14.1). */
export const DEFAULT_HEADER_PADDING_M = 2;
