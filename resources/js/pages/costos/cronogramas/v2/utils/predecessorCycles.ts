import { resolvePredecessorTaskId } from '../types/task';
import type { GanttTask } from '../types/task';

export interface CircularPredecessorIssue {
    taskId: number;
    taskDescripcion: string;
    taskPartida: string;
    ancestorId: number;
    ancestorDescripcion: string;
    ancestorPartida: string;
}

/**
 * Detecta subfilas cuya predecesora es su propio padre/abuelo (o cualquier
 * ancestro más arriba en la jerarquía).
 *
 * Delphin tolera este patrón en su propio motor — las filas grupo nunca se
 * reposicionan por predecesoras, así que internamente no genera un ciclo. Pero
 * al exportar a MS Project, la fila padre SÍ es una tarea real cuyas fechas
 * son un rollup de sus hijos: si un hijo también la referencia como
 * predecesora, MS Project detecta una referencia circular real y bloquea el
 * cálculo de TODO el archivo — efecto visible: los resúmenes/grupos colapsan
 * a "1 día" porque su rollup ya no se puede calcular.
 *
 * Esta misma función la usan tanto el exportador (exportDelphinMSP.ts, para
 * decidir qué vínculo omitir) como la UI de Delphin (para avisar al usuario
 * ANTES de exportar) — así el aviso es el mismo en ambos lados ("efecto
 * espejo"), y corrigiendo el vínculo en el cronograma también se limpia el
 * export, sin que el export tenga que cambiar nada por su cuenta.
 */
export function findCircularPredecessors(
    tasks: GanttTask[],
): CircularPredecessorIssue[] {
    const rowById = new Map(tasks.map((t) => [t.id, t]));
    const idByItemOrder = new Map(tasks.map((t) => [Number(t.item_order), t.id]));

    function isAncestor(candidateId: number, task: GanttTask): boolean {
        let current: GanttTask | undefined = task;
        const guard = new Set<number>();
        while (current?.parent_id != null && !guard.has(current.parent_id)) {
            if (current.parent_id === candidateId) return true;
            guard.add(current.parent_id);
            current = rowById.get(current.parent_id);
        }
        return false;
    }

    const issues: CircularPredecessorIssue[] = [];

    for (const task of tasks) {
        for (const pred of task.predecesoras ?? []) {
            const predId = resolvePredecessorTaskId(
                pred,
                (id) => rowById.has(id),
                idByItemOrder,
            );
            if (predId == null) continue;

            if (isAncestor(predId, task)) {
                const ancestor = rowById.get(predId);
                issues.push({
                    taskId: task.id,
                    taskDescripcion: task.descripcion,
                    taskPartida: task.partida,
                    ancestorId: predId,
                    ancestorDescripcion: ancestor?.descripcion ?? '',
                    ancestorPartida: ancestor?.partida ?? '',
                });
            }
        }
    }

    return issues;
}
