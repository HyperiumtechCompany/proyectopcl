import { resolvePredecessorTaskId } from '../types/task';
import type { GanttTask } from '../types/task';

/** ids de una tarea y todos sus descendientes (tasks va ordenado por nivel,
 *  misma convención que useGanttTasks.deleteTask). */
export function subtreeIds(id: number, tasks: GanttTask[]): Set<number> {
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1) return new Set([id]);
    const ids = new Set<number>([id]);
    for (
        let i = idx + 1;
        i < tasks.length && tasks[i].nivel > tasks[idx].nivel;
        i++
    ) {
        ids.add(tasks[i].id);
    }
    return ids;
}

/** true cuando alguna tarea FUERA del subárbol a borrar lo tiene como
 *  predecesora — borrarlo rompería ese vínculo en silencio. Resuelve por refId
 *  estable (respaldo a item_order para vínculos legado). */
export function isUsedAsPredecessorElsewhere(
    id: number,
    tasks: GanttTask[],
): boolean {
    const toDelete = subtreeIds(id, tasks);
    const idByItemOrder = new Map(tasks.map((t) => [t.item_order, t.id]));
    const allIds = new Set(tasks.map((t) => t.id));

    return tasks.some((t) => {
        if (toDelete.has(t.id)) return false;
        return (t.predecesoras ?? []).some((p) => {
            const target = resolvePredecessorTaskId(
                p,
                (tid) => allIds.has(tid),
                idByItemOrder,
            );
            return target != null && toDelete.has(target);
        });
    });
}
