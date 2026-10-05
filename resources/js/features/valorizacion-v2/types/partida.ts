import type { MoneyString } from '../lib/money';

/**
 * Fila del presupuesto (lista plana en preorden = orden de ítem).
 *
 * - `id` es la IDENTIDAD estable: calendarios, metrados y valorizaciones se
 *   enlazan por id, nunca por código.
 * - La jerarquía la da `parentId` + el orden del array (orden entre hermanos).
 * - `codigo` ("01.02.03") se RENUMERA automáticamente según la posición
 *   (lib/presupuestoOps.normalizePartidas), así mover ramas no rompe vínculos.
 * - Regla de hoja: un nodo sin hijos es PARTIDA (unidad/metrado/P.U.); un nodo
 *   con hijos es TÍTULO y nunca guarda esos datos.
 */
export interface PartidaInput {
    id: string;
    parentId: string | null;
    codigo: string;
    descripcion: string;
    unidad: string | null;
    metrado: MoneyString | null;
    precioUnitario: MoneyString | null;
}

/** Fila tal como viene del expediente (antes de asignar id/parentId). */
export type PartidaRow = Omit<PartidaInput, 'id' | 'parentId'>;

/** De dónde salió el presupuesto cargado. */
export type FuentePresupuesto = 'ejemplo-parcial' | 'excel' | 'manual' | 'presupuesto-proyecto';

export interface PresupuestoInput {
    fuente: FuentePresupuesto;
    partidas: PartidaInput[];
}
