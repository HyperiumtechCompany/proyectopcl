import dayjs from 'dayjs';

const MAX_REASONABLE_FUTURE_YEARS = 50;

function normalizeYear(year: number): number {
    const maxYear = dayjs().year() + MAX_REASONABLE_FUTURE_YEARS;
    let normalized = year;

    while (normalized > maxYear) {
        normalized -= 100;
    }

    if (normalized >= 0 && normalized < 100) {
        return 2000 + normalized;
    }

    return normalized;
}

function toIsoDate(year: number, month: number, day: number): string | null {
    const normalizedYear = normalizeYear(year);
    const date = dayjs(
        `${String(normalizedYear).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    );

    if (
        !date.isValid() ||
        date.year() !== normalizedYear ||
        date.month() + 1 !== month ||
        date.date() !== day
    ) {
        return null;
    }

    return date.format('YYYY-MM-DD');
}

export function normalizeGanttDate(
    value: string | null | undefined,
): string | null {
    if (!value) return null;

    const trimmed = String(value).trim();
    const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
        return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    }

    const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (slash) {
        return toIsoDate(Number(slash[3]), Number(slash[2]), Number(slash[1]));
    }

    return null;
}

export function diffInclusiveDays(
    startValue: string | null | undefined,
    endValue: string | null | undefined,
): number | null {
    const start = normalizeGanttDate(startValue);
    const end = normalizeGanttDate(endValue);

    if (!start || !end) return null;

    const days = dayjs(end).diff(dayjs(start), 'day') + 1;

    return days >= 1 ? days : null;
}
