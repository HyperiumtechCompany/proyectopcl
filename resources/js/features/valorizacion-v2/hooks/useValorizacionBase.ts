import { derivarBase } from '../compute/derivarValorizacion';
import { useValorizacionStore } from '../store/ValorizacionStoreProvider';

/**
 * Base común de todas las hojas: presupuesto calculado, contrato resuelto
 * (montos automáticos o escritos), meses de la obra (plazo de la FT + cualquier
 * mes con datos) y mes de la valorización activa.
 */
export function useValorizacionBase() {
    return derivarBase(useValorizacionStore((state) => state.input));
}
