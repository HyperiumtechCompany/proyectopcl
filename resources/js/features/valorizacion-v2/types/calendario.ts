import type { MoneyString } from '../lib/money';

/** "2026-07" — clave de mes. */
export type MesKey = string;

export type TipoCalendario = 'programado' | 'ejecutado';

/**
 * Montos por partida y mes (CALEN. PROG.). El dato de entrada es el COSTO del
 * mes; el % se calcula. Los montos se guardan sin redondear (el Excel guarda
 * 311.6666… y solo redondea al sumar el CD). Clave = `id` estable de partida.
 *
 * El calendario EJECUTADO no se ingresa: se deriva de los metrados ejecutados
 * (monto = ROUND(metrado × P.U., 2)), igual que en el Excel, verificado en las
 * 103 partidas de la Val. N°02.
 */
export interface CalendarioInput {
    montos: Record<string, Record<MesKey, MoneyString>>;
}

export interface CalendariosInput {
    programado: CalendarioInput;
}

/**
 * Metrado ejecutado por partida y mes (hoja METRADOS). Es el ÚNICO dato de
 * avance que se ingresa: de él salen el calendario ejecutado, el acumulado y
 * saldo de metrados y toda la VAL. MENSUAL (anterior / actual / acumulado / saldo).
 */
export interface MetradosInput {
    ejecutado: Record<string, Record<MesKey, string>>;
}

/**
 * Datos manuales de control (CONTROL FINANCIERO): qué valorizaciones ya fueron
 * devengadas (pagadas). El resto del control se calcula.
 */
export interface ControlInput {
    devengados: Record<MesKey, boolean>;
}
