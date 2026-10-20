// P5 (2026-10-19): títulos de tabla y columnas de resultado comparten un mismo color para
// distinguirlos de las celdas de captura. Un solo lugar para que MO, MAT y el export coincidan.
export const TITLE = 'bg-amber-100 text-amber-950 dark:bg-amber-950/60 dark:text-amber-100';
export const RESULT = 'bg-amber-50 text-amber-950 dark:bg-amber-950/25 dark:text-amber-100';
export const GROUP_BAR = 'bg-slate-800 text-white dark:bg-slate-950';
export const DIVIDER = 'border-l-2 border-slate-300 dark:border-slate-700';

export const TIPO_LABEL: Record<string, string> = { modulo: 'Módulo', institucion: 'Institución', piso: 'Piso' };

/** "6023.16260000" → "6,023.1626" (cantidades: hasta 4 decimales, sin ceros de cola forzados). */
export function qty(value: string | null | undefined, decimals = 4): string {
    if (value === null || value === undefined || value === '') return '';
    const n = Number(value);
    if (Number.isNaN(n)) return value;
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: decimals });
}
