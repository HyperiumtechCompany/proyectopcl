import type { ItemValorizado } from '../types';

/** Equivalente a F28 del Excel: suma de la columna Parcial de partidas hoja. */
export function calcularCostoDirectoParcial(items: ItemValorizado[]): number {
    return items
        .filter((item) => item.is_leaf)
        .reduce((total, item) => total + (Number(item.parcial) || 0), 0);
}
