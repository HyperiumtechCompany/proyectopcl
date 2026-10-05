import { computeCalendario } from '../sheets/calendario/computeCalendario';
import type { TipoCalendario } from '../types';
import { useValorizacionBase } from './useValorizacionBase';

/** Calendario calculado. El ejecutado se deriva de los metrados (monto = ROUND(metrado × P.U., 2)). */
export function useCalendario(tipo: TipoCalendario) {
    const { presupuesto, parametros, calendarios, periodos, mesValorizacion } = useValorizacionBase();

    return {
        presupuesto,
        parametros,
        mesValorizacion,
        calculado: computeCalendario(tipo, presupuesto, calendarios[tipo], periodos, parametros),
    };
}
