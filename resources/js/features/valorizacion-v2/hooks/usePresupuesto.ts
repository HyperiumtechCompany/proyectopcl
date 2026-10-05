import { useValorizacionBase } from './useValorizacionBase';

/** Presupuesto calculado (árbol + totales) y su diferencia contra el contrato principal. */
export function usePresupuesto() {
    const { presupuesto, parametros, input } = useValorizacionBase();

    return { parametros, fuente: input.presupuesto.fuente, calculado: presupuesto };
}
