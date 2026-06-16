import type { GanttCalendarSettings } from './calendar';

// Escalas: fila superior / fila inferior
// DAY_WEEK     → semanas / días   (zoom: muy detallado)
// DAY_MONTH    → meses   / días   (zoom: detallado)
// MONTH_YEAR   → años    / meses  (zoom: resumen)
// QUARTER_YEAR → años    / trimestres (zoom: multi-año)
export type ZoomLevel =
    | 'DAY_WEEK'
    | 'DAY_MONTH'
    | 'MONTH_YEAR'
    | 'QUARTER_YEAR';

export interface TimeCol {
    label: string;
    x: number; // left offset px desde inicio del proyecto
    width: number; // width en px
    date?: string;
    isWeekend?: boolean;
    isNonWorking?: boolean;
    isHoliday?: boolean;
    holidayName?: string;
}

export interface GanttTimeline {
    projectStart: string; // "YYYY-MM-DD"
    projectEnd: string; // "YYYY-MM-DD"
    totalDays: number;
    totalWidth: number; // px total del área del chart
    dayWidth: number; // px por día
    topCols: TimeCol[]; // fila superior del header
    bottomCols: TimeCol[]; // fila inferior del header
    calendarSettings?: GanttCalendarSettings;
    dateToX: (date: string | null) => number;
    xToDate: (x: number) => string;
}

export const ZOOM_DAY_WIDTH: Record<ZoomLevel, number> = {
    DAY_WEEK: 35,    // vista detallada: ~245px por semana
    DAY_MONTH: 20,   // vista de trabajo: ~600px por mes
    MONTH_YEAR: 3.5, // resumen: proyecto entero en pantalla
    QUARTER_YEAR: 1.2, // multi-año
};

export const MIN_DAY_WIDTH = 0.4;
export const MAX_DAY_WIDTH = 60;

/**
 * Selecciona la escala temporal más adecuada según el dayWidth continuo.
 * Permite que el header se adapte al hacer zoom con Ctrl+Scroll.
 */
export function inferZoomLevel(dayWidth: number): ZoomLevel {
    if (dayWidth >= 22) return 'DAY_WEEK';
    if (dayWidth >= 8)  return 'DAY_MONTH';
    if (dayWidth >= 1.8) return 'MONTH_YEAR';
    return 'QUARTER_YEAR';
}

export const ZOOM_LABELS: Record<ZoomLevel, string> = {
    DAY_WEEK: 'Días/Sem',
    DAY_MONTH: 'Días/Mes',
    MONTH_YEAR: 'Mes/Año',
    QUARTER_YEAR: 'Trim/Año',
};

export const CHART_HEADER_TOP_H = 24; // px fila superior
export const CHART_HEADER_BOTTOM_H = 22; // px fila inferior
export const CHART_HEADER_H = CHART_HEADER_TOP_H + CHART_HEADER_BOTTOM_H; // 46
