import { computeMetrados } from '../sheets/metrados/computeMetrados';
import { useValorizacionBase } from './useValorizacionBase';

/** Hoja METRADOS calculada (acumulado y saldo por metrar). */
export function useMetrados() {
    const { input, presupuesto, periodos, mesValorizacion } = useValorizacionBase();

    return { presupuesto, periodos, mesValorizacion, calculado: computeMetrados(presupuesto, input.metrados, periodos) };
}
