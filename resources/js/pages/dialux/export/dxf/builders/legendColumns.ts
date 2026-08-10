import type { DxfLegendColumnDef } from '../domain/types';

/**
 * Definiciones de columnas de datos de las tablas de leyenda (sección
 * 9.2/10.2 del plan maestro), extraídas de `buildDxfMultiSheetDocument.ts`
 * por presupuesto de tamaño de archivo (`__architecture__/fileSizeBudget.test.ts`).
 */

/** Columna común a ambas leyendas: código + descripción de la fila. */
export const LEGEND_DESCRIPTION_COLUMN: DxfLegendColumnDef = {
    header: 'DESCRIPCION',
    widthMm: 'flex',
    extract: (row) => `${row.code}  ${row.description}`,
};

/**
 * Columnas de la leyenda de alumbrado (sección 9.2). `technicalFields` es
 * heterogéneo entre tipos de fila (`buildLightingLegendRows.ts`): luminaria
 * trae `[potencia, flujo, montaje]` en posiciones fijas; emergencia e
 * interruptor traen 1 solo campo, que es el montaje; cableado no aplica a
 * estas 3 columnas (su info de tubo se queda en DESCRIPCION).
 */
export const LIGHTING_LEGEND_COLUMNS: DxfLegendColumnDef[] = [
    LEGEND_DESCRIPTION_COLUMN,
    { header: 'POTENCIA', widthMm: 18, extract: (row) => (row.kind === 'fixture' ? row.technicalFields[0] : '') },
    { header: 'FLUJO', widthMm: 20, extract: (row) => (row.kind === 'fixture' ? row.technicalFields[1] : '') },
    {
        header: 'MONTAJE',
        widthMm: 28,
        extract: (row) => {
            if (row.kind === 'fixture') return row.technicalFields[2] ?? '';
            if (row.kind === 'emergency' || row.kind === 'switch') return row.technicalFields[0] ?? '';
            return '';
        },
    },
    { header: 'CANT.', widthMm: 14, extract: (row) => String(row.quantity) },
];

/**
 * Columnas de la leyenda de tomacorrientes (sección 10.2). A diferencia de
 * alumbrado, `technicalFields[0]/[1]` son uniformes en TODAS las filas
 * (dispositivo, caja de pase, cableado — ver `buildOutletLegendRows.ts`):
 * `[0]` es caja/canalización, `[1]` (ausente en caja de pase/cableado) es
 * la altura de montaje.
 */
export const OUTLET_LEGEND_COLUMNS: DxfLegendColumnDef[] = [
    LEGEND_DESCRIPTION_COLUMN,
    { header: 'CAJA/CANALIZ.', widthMm: 34, extract: (row) => row.technicalFields[0] ?? '-' },
    { header: 'ALTURA', widthMm: 20, extract: (row) => row.technicalFields[1] ?? '' },
    { header: 'CANT.', widthMm: 14, extract: (row) => String(row.quantity) },
];
