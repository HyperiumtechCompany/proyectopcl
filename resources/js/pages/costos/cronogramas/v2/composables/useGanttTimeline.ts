import { useMemo } from 'react';
import dayjs from 'dayjs';
import type { GanttTask } from '../types/task';
import type { GanttTimeline, TimeCol, ZoomLevel } from '../types/timeline';
import { ZOOM_DAY_WIDTH, inferZoomLevel } from '../types/timeline';
import type { GanttCalendarSettings } from '../types/calendar';
import { DAY_INDEX_TO_KEY } from '../types/calendar';
import { normalizeGanttDate } from '../utils/date';

const BUFFER_MONTHS = 1;

function startOfIsoWeek(d: dayjs.Dayjs): dayjs.Dayjs {
    const dow = d.day(); // 0=Dom, 6=Sab
    const diff = dow === 0 ? -6 : 1 - dow;
    return d.add(diff, 'day').startOf('day');
}

// ─── Constructores de columnas por zoom ──────────────────────────────────────

function buildTopWeeks(
    start: dayjs.Dayjs,
    end: dayjs.Dayjs,
    dw: number,
    dtx: (s: string) => number,
): TimeCol[] {
    const cols: TimeCol[] = [];
    let week = startOfIsoWeek(start);
    while (week.isBefore(end) || week.isSame(end, 'day')) {
        const wEnd = week.add(6, 'day');
        const cStart = week.isBefore(start) ? start : week;
        const cEnd = wEnd.isAfter(end) ? end : wEnd;
        const days = cEnd.diff(cStart, 'day') + 1;
        if (days > 0) {
            cols.push({
                label: cStart.format('DD/MM'),
                x: dtx(cStart.format('YYYY-MM-DD')),
                width: days * dw,
            });
        }
        week = week.add(1, 'week');
    }
    return cols;
}

function buildTopMonths(
    start: dayjs.Dayjs,
    end: dayjs.Dayjs,
    dw: number,
    dtx: (s: string) => number,
): TimeCol[] {
    const cols: TimeCol[] = [];
    let cur = start.startOf('month');
    while (cur.isBefore(end) || cur.isSame(end, 'month')) {
        const mStart = cur.isBefore(start) ? start : cur;
        const mEnd = cur.endOf('month').isAfter(end) ? end : cur.endOf('month');
        const days = mEnd.diff(mStart, 'day') + 1;
        if (days > 0) {
            cols.push({
                label: cur.format('MMM YY').toUpperCase(),
                x: dtx(mStart.format('YYYY-MM-DD')),
                width: days * dw,
            });
        }
        cur = cur.add(1, 'month');
    }
    return cols;
}

function buildTopYears(
    start: dayjs.Dayjs,
    end: dayjs.Dayjs,
    dw: number,
    dtx: (s: string) => number,
): TimeCol[] {
    const cols: TimeCol[] = [];
    let yr = start.startOf('year');
    while (yr.isBefore(end) || yr.isSame(end, 'year')) {
        const yStart = yr.isBefore(start) ? start : yr;
        const yEnd = yr.endOf('year').isAfter(end) ? end : yr.endOf('year');
        const days = yEnd.diff(yStart, 'day') + 1;
        if (days > 0) {
            cols.push({
                label: yr.format('YYYY'),
                x: dtx(yStart.format('YYYY-MM-DD')),
                width: days * dw,
            });
        }
        yr = yr.add(1, 'year');
    }
    return cols;
}

function buildBottomDays(
    start: dayjs.Dayjs,
    end: dayjs.Dayjs,
    dw: number,
    dtx: (s: string) => number,
    useNumber: boolean,
    calendarSettings?: GanttCalendarSettings,
): TimeCol[] {
    const DOW = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    const cols: TimeCol[] = [];
    const holidaysByDate = new Map(
        (calendarSettings?.holidays ?? []).map((holiday) => [
            holiday.date,
            holiday.name,
        ]),
    );
    let day = start;
    while (day.isBefore(end) || day.isSame(end, 'day')) {
        const dow = day.day();
        const date = day.format('YYYY-MM-DD');
        const workDay = calendarSettings?.workDays[DAY_INDEX_TO_KEY[dow]];
        const isHoliday = holidaysByDate.has(date);
        const isNonWorking = calendarSettings
            ? !workDay?.enabled || isHoliday
            : dow === 0 || dow === 6;

        cols.push({
            label: useNumber ? String(day.date()) : DOW[dow],
            x: dtx(date),
            width: dw,
            isWeekend: dow === 0 || dow === 6,
            isNonWorking,
            isHoliday,
            holidayName: holidaysByDate.get(date),
            date,
        });
        day = day.add(1, 'day');
    }
    return cols;
}

function buildBottomMonths(
    start: dayjs.Dayjs,
    end: dayjs.Dayjs,
    dw: number,
    dtx: (s: string) => number,
): TimeCol[] {
    const cols: TimeCol[] = [];
    let mon = start.startOf('month');
    while (mon.isBefore(end) || mon.isSame(end, 'month')) {
        const mStart = mon.isBefore(start) ? start : mon;
        const mEnd = mon.endOf('month').isAfter(end) ? end : mon.endOf('month');
        const days = mEnd.diff(mStart, 'day') + 1;
        if (days > 0) {
            cols.push({
                label: mon.format('MMM').toUpperCase(),
                x: dtx(mStart.format('YYYY-MM-DD')),
                width: days * dw,
            });
        }
        mon = mon.add(1, 'month');
    }
    return cols;
}

function buildBottomQuarters(
    start: dayjs.Dayjs,
    end: dayjs.Dayjs,
    dw: number,
    dtx: (s: string) => number,
): TimeCol[] {
    const Q_START_MONTH = [1, 4, 7, 10]; // mes (1-based) de inicio de cada trimestre
    const Q_LABELS = ['T1', 'T2', 'T3', 'T4'];
    const cols: TimeCol[] = [];

    let yr = start.year();
    let q = Math.floor(start.month() / 3); // 0-3

    while (true) {
        const qStart = dayjs(
            `${yr}-${String(Q_START_MONTH[q]).padStart(2, '0')}-01`,
        );
        if (qStart.isAfter(end)) break;
        const qEnd = qStart.add(3, 'month').subtract(1, 'day');
        const cStart = qStart.isBefore(start) ? start : qStart;
        const cEnd = qEnd.isAfter(end) ? end : qEnd;
        const days = cEnd.diff(cStart, 'day') + 1;
        if (days > 0) {
            cols.push({
                label: Q_LABELS[q],
                x: dtx(cStart.format('YYYY-MM-DD')),
                width: days * dw,
            });
        }
        q++;
        if (q > 3) {
            q = 0;
            yr++;
        }
    }
    return cols;
}

// ─────────────────────────────────────────────────────────────────────────────
export function buildTimeline(
    startStr: string,
    endStr: string,
    dayWidth: number,
    zoom: ZoomLevel,
    calendarSettings?: GanttCalendarSettings,
): GanttTimeline {
    const start = dayjs(startStr);
    const end = dayjs(endStr);
    const totalDays = Math.max(1, end.diff(start, 'day') + 1);
    const totalWidth = totalDays * dayWidth;

    const dateToX = (date: string | null): number => {
        const normalized = normalizeGanttDate(date);
        if (!normalized) return 0;
        return Math.max(0, dayjs(normalized).diff(start, 'day') * dayWidth);
    };
    const xToDate = (x: number): string =>
        start.add(Math.round(x / dayWidth), 'day').format('YYYY-MM-DD');

    const dtx = (s: string) => dateToX(s);

    let topCols: TimeCol[];
    let bottomCols: TimeCol[];

    switch (zoom) {
        case 'DAY_WEEK':
            topCols = buildTopWeeks(start, end, dayWidth, dtx);
            bottomCols = buildBottomDays(
                start,
                end,
                dayWidth,
                dtx,
                true,
                calendarSettings,
            );
            break;
        case 'DAY_MONTH':
            topCols = buildTopMonths(start, end, dayWidth, dtx);
            bottomCols = buildBottomDays(
                start,
                end,
                dayWidth,
                dtx,
                false,
                calendarSettings,
            );
            break;
        case 'MONTH_YEAR':
            topCols = buildTopYears(start, end, dayWidth, dtx);
            bottomCols = buildBottomMonths(start, end, dayWidth, dtx);
            break;
        case 'QUARTER_YEAR':
            topCols = buildTopYears(start, end, dayWidth, dtx);
            bottomCols = buildBottomQuarters(start, end, dayWidth, dtx);
            break;
    }

    return {
        projectStart: startStr,
        projectEnd: endStr,
        totalDays,
        totalWidth,
        dayWidth,
        topCols,
        bottomCols,
        calendarSettings,
        dateToX,
        xToDate,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
export function useGanttTimeline(
    tasks: GanttTask[],
    zoom: ZoomLevel,
    calendarSettings?: GanttCalendarSettings,
    dayWidthOverride?: number | null,
): GanttTimeline {
    return useMemo(() => {
        // Si hay override continuo, usarlo y derivar el zoom para el header
        const dayWidth = dayWidthOverride ?? ZOOM_DAY_WIDTH[zoom];
        const effectiveZoom = dayWidthOverride != null ? inferZoomLevel(dayWidth) : zoom;

        const dates = tasks
            .flatMap((t) => [t.fecha_inicio, t.fecha_fin])
            .map((date) => normalizeGanttDate(date))
            .filter((d): d is string => !!d);

        const configuredStart = normalizeGanttDate(
            calendarSettings?.projectStart,
        );
        const configuredEnd = normalizeGanttDate(calendarSettings?.projectEnd);

        if (configuredStart) {
            dates.push(configuredStart);
        }

        if (configuredEnd) {
            dates.push(configuredEnd);
        }

        if (dates.length === 0) {
            const start = dayjs().startOf('month').format('YYYY-MM-DD');
            const end = dayjs()
                .add(3, 'month')
                .endOf('month')
                .format('YYYY-MM-DD');
            return buildTimeline(start, end, dayWidth, effectiveZoom, calendarSettings);
        }

        const minDate = dates.reduce((a, b) => (a < b ? a : b));
        const maxDate = dates.reduce((a, b) => (a > b ? a : b));
        // Siempre se agrega el margen de BUFFER_MONTHS, tenga o no el proyecto
        // fecha de inicio/fin configurada explícitamente. Antes, con una fecha
        // configurada, el margen se omitía y la primera barra quedaba pegada al
        // borde izquierdo del Gantt — no se distinguía bien el día exacto de
        // inicio. El margen es solo visual (espacio antes/después en el
        // diagrama); no cambia projectStart/projectEnd ni ningún cálculo real
        // de fechas o duraciones.
        const start = dayjs(minDate)
            .subtract(BUFFER_MONTHS, 'month')
            .startOf('month')
            .format('YYYY-MM-DD');
        const end = dayjs(maxDate)
            .add(BUFFER_MONTHS, 'month')
            .endOf('month')
            .format('YYYY-MM-DD');

        return buildTimeline(start, end, dayWidth, effectiveZoom, calendarSettings);
    }, [tasks, zoom, calendarSettings, dayWidthOverride]);
}
