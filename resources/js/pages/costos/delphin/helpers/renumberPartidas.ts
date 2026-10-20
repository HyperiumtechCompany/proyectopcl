import type { GanttTask } from '../../cronogramas/v2/types/task';

/**
 * "Renumerar" de Delphin (como en S10 / Delphin Express): recalcula el código de TODAS las partidas
 * según su posición en el árbol — raíces 01, 02…; hijos <padre>.01, <padre>.02… Si el árbol ya usa
 * segmentos con cero a la izquierda ("01.01", típico de S10) se conserva ese relleno; si no, "1.1".
 *
 * `tasks` debe venir en el orden de la grilla (padre antes que sus hijos, hermanos en orden).
 * Devuelve solo las filas cuyo código cambia. Los ACU siguen a su partida al guardar
 * (partida_renames + PresupuestoController::reconcileOrphanAcus).
 */
export function renumberPartidas(tasks: GanttTask[]): Array<{ id: number; partida: string }> {
    const padded = tasks.some((t) => t.partida.split('.').some((seg) => /^0\d/.test(seg)));
    const pad = (n: number) => String(n).padStart(padded ? 2 : 1, '0');

    const codeById = new Map<number, string>();
    const childCount = new Map<number | null, number>();
    const updates: Array<{ id: number; partida: string }> = [];

    for (const task of tasks) {
        const parentKey = task.parent_id !== null && codeById.has(task.parent_id) ? task.parent_id : null;
        const index = (childCount.get(parentKey) ?? 0) + 1;
        childCount.set(parentKey, index);

        const code = parentKey === null ? pad(index) : `${codeById.get(parentKey)}.${pad(index)}`;
        codeById.set(task.id, code);
        if (code !== task.partida) updates.push({ id: task.id, partida: code });
    }

    return updates;
}
