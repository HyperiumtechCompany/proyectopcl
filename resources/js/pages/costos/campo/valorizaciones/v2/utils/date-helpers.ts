import { format, parseISO, differenceInDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';

const TZ = 'America/Lima';

/**
 * Convierte una fecha a la zona horaria de Lima
 */
export const toLima = (date: Date | string): Date => {
    const parsed = typeof date === 'string' ? parseISO(date) : date;
    return toZonedTime(parsed, TZ);
};

/**
 * Formatea una fecha en formato dd/MM/yyyy en Lima
 */
export const formatLima = (date: Date | string | null | undefined, fmt = 'dd/MM/yyyy'): string => {
    if (!date) return '';
    return format(toLima(date), fmt, { locale: es });
};

/**
 * Formatea una fecha como "Mes Año" (Ej: "Julio 2026")
 */
export const formatMesAnio = (date: Date | string | null | undefined): string => {
    if (!date) return '';
    const formatted = format(toLima(date), 'MMMM yyyy', { locale: es });
    // Capitalize first letter
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

/**
 * Calcular plazo real en días calendario: fecha_fin - fecha_inicio + 1
 */
export const calcPlazo = (inicio: Date | string, fin: Date | string): number => {
    return differenceInDays(toLima(fin), toLima(inicio)) + 1;
};

/**
 * Calcular fecha fin en base a inicio y plazo: inicio + plazo - 1
 */
export const calcFechaFin = (inicio: Date | string, plazo: number): Date => {
    return addDays(toLima(inicio), plazo - 1);
};
