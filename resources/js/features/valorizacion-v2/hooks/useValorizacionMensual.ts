import { computeValorizacionMensual } from '../sheets/valorizacion-mensual/computeValorizacionMensual';
import { useValorizacionBase } from './useValorizacionBase';

/** VAL. MENSUAL del mes de la valorización, derivada de los metrados. */
export function useValorizacionMensual() {
    const { input, presupuesto, parametros, mesValorizacion } = useValorizacionBase();

    return { presupuesto, parametros, mesValorizacion, calculado: computeValorizacionMensual(presupuesto, input.metrados, mesValorizacion, parametros) };
}
