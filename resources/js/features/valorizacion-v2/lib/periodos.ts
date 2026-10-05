import { calcPlazo, firstDayOfMonth, formatDayMonth, formatMonthShort, lastDayOfMonth, monthKey, nextMonthKey } from './dates';
import type { IsoDate } from './dates';

/** Mes de la obra con su tramo efectivo (el primero y el último pueden ser parciales). */
export interface Periodo {
    key: string;
    /** Primer día calendario del mes. */
    mes: IsoDate;
    inicio: IsoDate;
    fin: IsoDate;
    /** "Jun-26" */
    label: string;
    /** "20/06 – 30/06" */
    rango: string;
}

const build = (key: string, inicio: IsoDate, fin: IsoDate): Periodo => ({
    key,
    mes: firstDayOfMonth(key),
    inicio,
    fin,
    label: formatMonthShort(firstDayOfMonth(key)),
    rango: `${formatDayMonth(inicio)} – ${formatDayMonth(fin)}`,
});

/**
 * Meses de la obra entre el inicio y el término (inclusive), recortando el
 * primero y el último a esas fechas, como las cabeceras de CALEN. PROG.
 * (20-Jun → 30-Jun, 1-Jul → 31-Jul, …). `extraKeys` agrega meses con datos
 * fuera del plazo (p. ej. ejecución tardía) para no esconderlos.
 */
export function periodosDeObra(inicio: IsoDate, fin: IsoDate, extraKeys: Iterable<string> = []): Periodo[] {
    const result = new Map<string, Periodo>();
    const last = monthKey(fin);
    for (let key = monthKey(inicio); key <= last; key = nextMonthKey(key)) {
        const desde = key === monthKey(inicio) ? inicio : firstDayOfMonth(key);
        const hasta = key === last ? fin : lastDayOfMonth(key);
        result.set(key, build(key, desde, hasta));
    }
    for (const key of extraKeys) {
        if (!result.has(key) && /^\d{4}-\d{2}$/.test(key)) {
            result.set(key, build(key, firstDayOfMonth(key), lastDayOfMonth(key)));
        }
    }

    return [...result.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export interface AvanceTiempo {
    /** Días calendario desde el inicio hasta el cierre del mes valorizado (sin pasar el término). */
    transcurridos: number;
    restantes: number;
    plazo: number;
    /** transcurridos / plazo (fracción, 4 decimales). */
    pct: string;
}

/** Avance del plazo al cierre del mes de la valorización. */
export function avanceDelPlazo(inicio: IsoDate, terminoVigente: IsoDate, mesValorizacion: string): AvanceTiempo {
    const plazo = Math.max(1, calcPlazo(inicio, terminoVigente));
    const finMes = lastDayOfMonth(mesValorizacion);
    const cierre = finMes < terminoVigente ? finMes : terminoVigente;
    const transcurridos = cierre < inicio ? 0 : Math.min(plazo, calcPlazo(inicio, cierre));

    return { transcurridos, restantes: plazo - transcurridos, plazo, pct: (Math.round((transcurridos / plazo) * 10000) / 10000).toFixed(4) };
}
