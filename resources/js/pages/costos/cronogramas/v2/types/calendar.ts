import dayjs from 'dayjs';
import type { GanttTask } from './task';
import { normalizeGanttDate } from '../utils/date';

export type WeekdayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export interface WorkDayConfig {
    enabled: boolean;
    start: string;
    end: string;
}

export interface GanttHoliday {
    id: string;
    date: string;
    name: string;
}

export interface GanttCalendarSettings {
    projectStart: string;
    projectEnd: string;
    workDays: Record<WeekdayKey, WorkDayConfig>;
    holidays: GanttHoliday[];
}

export const WEEKDAYS: Array<{
    key: WeekdayKey;
    label: string;
    short: string;
}> = [
    { key: 'mon', label: 'Lunes', short: 'Lun' },
    { key: 'tue', label: 'Martes', short: 'Mar' },
    { key: 'wed', label: 'Miercoles', short: 'Mie' },
    { key: 'thu', label: 'Jueves', short: 'Jue' },
    { key: 'fri', label: 'Viernes', short: 'Vie' },
    { key: 'sat', label: 'Sabado', short: 'Sab' },
    { key: 'sun', label: 'Domingo', short: 'Dom' },
];

export const DAY_INDEX_TO_KEY: WeekdayKey[] = [
    'sun',
    'mon',
    'tue',
    'wed',
    'thu',
    'fri',
    'sat',
];

export const DEFAULT_WORK_DAYS: Record<WeekdayKey, WorkDayConfig> = {
    mon: { enabled: true, start: '08:00', end: '17:00' },
    tue: { enabled: true, start: '08:00', end: '17:00' },
    wed: { enabled: true, start: '08:00', end: '17:00' },
    thu: { enabled: true, start: '08:00', end: '17:00' },
    fri: { enabled: true, start: '08:00', end: '17:00' },
    sat: { enabled: false, start: '08:00', end: '13:00' },
    sun: { enabled: false, start: '08:00', end: '13:00' },
};

export function createCalendarId(): string {
    return (
        globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
    );
}

export function inferDefaultProjectRange(
    tasks: GanttTask[],
): Pick<GanttCalendarSettings, 'projectStart' | 'projectEnd'> {
    const dates = tasks
        .flatMap((task) => [task.fecha_inicio, task.fecha_fin])
        .map((date) => normalizeGanttDate(date))
        .filter((date): date is string => Boolean(date));

    if (!dates.length) {
        return {
            projectStart: dayjs().startOf('month').format('YYYY-MM-DD'),
            projectEnd: dayjs()
                .add(3, 'month')
                .endOf('month')
                .format('YYYY-MM-DD'),
        };
    }

    return {
        projectStart: dates.reduce(
            (min, date) => (date < min ? date : min),
            dates[0],
        ),
        projectEnd: dates.reduce(
            (max, date) => (date > max ? date : max),
            dates[0],
        ),
    };
}

export function createDefaultCalendarSettings(
    tasks: GanttTask[] = [],
): GanttCalendarSettings {
    return {
        ...inferDefaultProjectRange(tasks),
        workDays: DEFAULT_WORK_DAYS,
        holidays: [],
    };
}

export function normalizeCalendarSettings(
    raw: Partial<GanttCalendarSettings> | null | undefined,
    fallback: GanttCalendarSettings,
): GanttCalendarSettings {
    const projectStart =
        normalizeGanttDate(raw?.projectStart) ?? fallback.projectStart;
    const projectEnd =
        normalizeGanttDate(raw?.projectEnd) ?? fallback.projectEnd;
    const startIsAfterEnd = dayjs(projectStart).isAfter(projectEnd, 'day');

    const workDays = WEEKDAYS.reduce(
        (days, day) => ({
            ...days,
            [day.key]: {
                ...fallback.workDays[day.key],
                ...(raw?.workDays?.[day.key] ?? {}),
            },
        }),
        {} as Record<WeekdayKey, WorkDayConfig>,
    );

    return {
        projectStart: startIsAfterEnd ? projectEnd : projectStart,
        projectEnd: startIsAfterEnd ? projectStart : projectEnd,
        workDays,
        holidays: (raw?.holidays ?? [])
            .map((holiday) => ({
                id: holiday.id || createCalendarId(),
                date: normalizeGanttDate(holiday.date) ?? '',
                name: holiday.name?.trim() || 'Feriado',
            }))
            .filter((holiday) => Boolean(holiday.date)),
    };
}

export function isWorkingDate(
    dateValue: string | null | undefined,
    settings?: GanttCalendarSettings,
): boolean {
    const date = normalizeGanttDate(dateValue);
    if (!date) return false;

    if (!settings) {
        const day = dayjs(date).day();
        return day !== 0 && day !== 6;
    }

    if (settings.holidays.some((holiday) => holiday.date === date)) {
        return false;
    }

    return (
        settings.workDays[DAY_INDEX_TO_KEY[dayjs(date).day()]]?.enabled ?? false
    );
}

export function nextWorkingDate(
    dateValue: string,
    settings?: GanttCalendarSettings,
): string {
    let date = dayjs(dateValue);
    for (let guard = 0; guard < 3700; guard++) {
        const iso = date.format('YYYY-MM-DD');
        if (isWorkingDate(iso, settings)) {
            return iso;
        }
        date = date.add(1, 'day');
    }

    return dateValue;
}

export function addWorkingDays(
    startValue: string,
    workingDays: number,
    settings?: GanttCalendarSettings,
): string {
    const daysToAdd = Math.max(1, Math.floor(workingDays));
    let date = dayjs(nextWorkingDate(startValue, settings));
    let counted = 0;

    for (let guard = 0; guard < 3700; guard++) {
        const iso = date.format('YYYY-MM-DD');
        if (isWorkingDate(iso, settings)) {
            counted++;
            if (counted === daysToAdd) {
                return iso;
            }
        }
        date = date.add(1, 'day');
    }

    return date.format('YYYY-MM-DD');
}

export function previousWorkingDate(
    dateValue: string,
    settings?: GanttCalendarSettings,
): string {
    let date = dayjs(dateValue);
    for (let guard = 0; guard < 3700; guard++) {
        const iso = date.format('YYYY-MM-DD');
        if (isWorkingDate(iso, settings)) {
            return iso;
        }
        date = date.subtract(1, 'day');
    }

    return dateValue;
}

export function subtractWorkingDays(
    endValue: string,
    workingDays: number,
    settings?: GanttCalendarSettings,
): string {
    const daysToSubtract = Math.max(1, Math.floor(workingDays));
    let date = dayjs(previousWorkingDate(endValue, settings));
    let counted = 0;

    for (let guard = 0; guard < 3700; guard++) {
        const iso = date.format('YYYY-MM-DD');
        if (isWorkingDate(iso, settings)) {
            counted++;
            if (counted === daysToSubtract) {
                return iso;
            }
        }
        date = date.subtract(1, 'day');
    }

    return date.format('YYYY-MM-DD');
}

export function diffWorkingDaysInclusive(
    startValue: string | null | undefined,
    endValue: string | null | undefined,
    settings?: GanttCalendarSettings,
): number | null {
    const start = normalizeGanttDate(startValue);
    const end = normalizeGanttDate(endValue);

    if (!start || !end || dayjs(end).isBefore(start, 'day')) {
        return null;
    }

    let date = dayjs(start);
    const finish = dayjs(end);
    let count = 0;

    while (date.isBefore(finish, 'day') || date.isSame(finish, 'day')) {
        if (isWorkingDate(date.format('YYYY-MM-DD'), settings)) {
            count++;
        }
        date = date.add(1, 'day');
    }

    return count >= 1 ? count : null;
}

export interface WorkingDateSegment {
    start: string;
    end: string;
}

export function buildWorkingDateSegments(
    startValue: string | null | undefined,
    endValue: string | null | undefined,
    settings?: GanttCalendarSettings,
): WorkingDateSegment[] {
    const start = normalizeGanttDate(startValue);
    const end = normalizeGanttDate(endValue);

    if (!start || !end || dayjs(end).isBefore(start, 'day')) {
        return [];
    }

    const segments: WorkingDateSegment[] = [];
    let segmentStart: string | null = null;
    let previousWorkingDate: string | null = null;
    let date = dayjs(start);
    const finish = dayjs(end);

    while (date.isBefore(finish, 'day') || date.isSame(finish, 'day')) {
        const iso = date.format('YYYY-MM-DD');

        if (isWorkingDate(iso, settings)) {
            segmentStart ??= iso;
            previousWorkingDate = iso;
        } else if (segmentStart && previousWorkingDate) {
            segments.push({ start: segmentStart, end: previousWorkingDate });
            segmentStart = null;
            previousWorkingDate = null;
        }

        date = date.add(1, 'day');
    }

    if (segmentStart && previousWorkingDate) {
        segments.push({ start: segmentStart, end: previousWorkingDate });
    }

    return segments;
}
