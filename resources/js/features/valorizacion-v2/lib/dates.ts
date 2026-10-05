/**
 * Fechas SOLO-DÍA ("YYYY-MM-DD") para Valorización v2.
 *
 * Las fechas de un expediente (inicio de plazo, firma de contrato…) son días de
 * calendario, no instantes. Convertirlas a otra zona horaria las corre un día
 * según dónde esté el navegador (bug real de la v1 de este módulo: con hora de
 * Madrid, "2026-07-15" se mostraba como 14/07/2026). Por eso toda la aritmética
 * se hace en UTC puro sobre el string, y la zona America/Lima solo se usa para
 * saber qué día es "hoy" en obra.
 */

export type IsoDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;
export const OBRA_TIME_ZONE = 'America/Lima';

const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_ES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

interface DateParts {
    year: number;
    month: number; // 1-12
    day: number;
}

export function isIsoDate(value: unknown): value is IsoDate {
    if (typeof value !== 'string') {
        return false;
    }

    const match = ISO_DATE.exec(value);
    if (!match) {
        return false;
    }

    const [, y, m, d] = match.map(Number);
    const probe = new Date(Date.UTC(y, m - 1, d));

    return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

function parts(value: IsoDate): DateParts {
    if (!isIsoDate(value)) {
        throw new Error(`Fecha inválida (se esperaba YYYY-MM-DD): "${value}"`);
    }

    const [year, month, day] = value.split('-').map(Number);

    return { year, month, day };
}

function toUtcMs(value: IsoDate): number {
    const { year, month, day } = parts(value);

    return Date.UTC(year, month - 1, day);
}

function fromUtcMs(ms: number): IsoDate {
    return new Date(ms).toISOString().slice(0, 10);
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

export const addDays = (value: IsoDate, days: number): IsoDate => fromUtcMs(toUtcMs(value) + days * DAY_MS);

/** Días entre dos fechas (to − from). */
export const diffDays = (from: IsoDate, to: IsoDate): number => Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);

/** Excel FT!E51: fin = inicio + plazo − 1 (el día de inicio cuenta). */
export const calcFechaFin = (inicio: IsoDate, plazoDias: number): IsoDate => addDays(inicio, plazoDias - 1);

/** Inverso de calcFechaFin: plazo = fin − inicio + 1. */
export const calcPlazo = (inicio: IsoDate, fin: IsoDate): number => diffDays(inicio, fin) + 1;

/** "2026-07" — clave estable de mes para calendarios y valorizaciones. */
export const monthKey = (value: IsoDate): string => value.slice(0, 7);

export const daysInMonth = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** 0 = domingo … 6 = sábado. */
export const weekday = (value: IsoDate): number => new Date(toUtcMs(value)).getUTCDay();

/** 15/07/2026 */
export function formatDate(value: IsoDate | null | undefined): string {
    if (!value) {
        return '';
    }

    const { year, month, day } = parts(value);

    return `${pad2(day)}/${pad2(month)}/${year}`;
}

/** Julio 2026 */
export function formatMonthYear(value: IsoDate | null | undefined): string {
    if (!value) {
        return '';
    }

    const { year, month } = parts(value);
    const name = MONTHS_ES[month - 1];

    return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

/** Jul-26 (formato de cabecera de los calendarios del Excel) */
export function formatMonthShort(value: IsoDate | null | undefined): string {
    if (!value) {
        return '';
    }

    const { year, month } = parts(value);

    return `${MONTHS_ES_SHORT[month - 1]}-${String(year).slice(2)}`;
}

/** Fecha de hoy en obra (America/Lima), sin importar la zona del navegador. */
export function todayInObra(now: Date = new Date()): IsoDate {
    // en-CA formatea como YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', { timeZone: OBRA_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** "2026-07" → "2026-07-01" */
export const firstDayOfMonth = (key: string): IsoDate => `${key}-01`;

/** "2026-02" → "2026-02-28" */
export function lastDayOfMonth(key: string): IsoDate {
    const [year, month] = key.split('-').map(Number);

    return `${key}-${pad2(daysInMonth(year, month))}`;
}

/** "2026-12" → "2027-01" */
export function nextMonthKey(key: string): string {
    const [year, month] = key.split('-').map(Number);

    return month === 12 ? `${year + 1}-01` : `${year}-${pad2(month + 1)}`;
}

/** 20/06 */
export const formatDayMonth = (value: IsoDate): string => formatDate(value).slice(0, 5);
