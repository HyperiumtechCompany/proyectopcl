import dayjs from 'dayjs';
import {
    addWorkingDays,
    nextWorkingDate,
    subtractWorkingDays,
    type GanttCalendarSettings,
} from '../types/calendar';
import type { GanttTask, SchedulingMode } from '../types/task';

/**
 * Calcula las fechas restringidas para una tarea basándose en sus predecesoras.
 * Preserva duracion_dias; solo ajusta inicio y fin.
 * Retorna null si no hay predecesoras con fechas disponibles.
 *
 * IMPORTANTE: pred.taskId contiene el item_order (N° de fila) que el usuario escribe,
 * no el id de BD. Se usa itemOrderToId para traducir item_order → id.
 *
 * Tipos de vínculo:
 *   FC (Fin→Comienzo):      sucesor comienza el día siguiente al fin de la predecesora
 *   CC (Comienzo→Comienzo): sucesor comienza el mismo día que la predecesora
 *   FF (Fin→Fin):           sucesor termina el mismo día que la predecesora
 *   CF (Comienzo→Fin):      sucesor termina el mismo día que comienza la predecesora
 */
export function computeConstrainedDates(
    task: GanttTask,
    taskMap: Map<number, GanttTask>,
    itemOrderToId: Map<number, number>,
    calendarSettings?: GanttCalendarSettings,
): { fecha_inicio: string; fecha_fin: string } | null {
    if (!task.predecesoras.length) return null;

    let latestStart: dayjs.Dayjs | null = null;
    let latestEnd: dayjs.Dayjs | null = null;

    for (const pred of task.predecesoras) {
        // pred.taskId es el item_order (Nº) — traducir a id real
        const predId = itemOrderToId.get(pred.taskId);
        if (predId === undefined) continue;
        const predTask = taskMap.get(predId);
        if (!predTask?.fecha_inicio || !predTask?.fecha_fin) continue;

        if (pred.tipo === 'FC') {
            // Sucesor empieza el día siguiente al fin + lag
            const c = dayjs(
                nextWorkingDate(
                    dayjs(predTask.fecha_fin)
                        .add(pred.lag + 1, 'day')
                        .format('YYYY-MM-DD'),
                    calendarSettings,
                ),
            );
            if (!latestStart || c.isAfter(latestStart)) latestStart = c;
        } else if (pred.tipo === 'CC') {
            // Sucesor empieza el mismo día que la predecesora + lag
            const c = dayjs(
                nextWorkingDate(
                    dayjs(predTask.fecha_inicio)
                        .add(pred.lag, 'day')
                        .format('YYYY-MM-DD'),
                    calendarSettings,
                ),
            );
            if (!latestStart || c.isAfter(latestStart)) latestStart = c;
        } else if (pred.tipo === 'FF') {
            // Sucesor termina el mismo día que la predecesora + lag
            const c = dayjs(
                nextWorkingDate(
                    dayjs(predTask.fecha_fin)
                        .add(pred.lag, 'day')
                        .format('YYYY-MM-DD'),
                    calendarSettings,
                ),
            );
            if (!latestEnd || c.isAfter(latestEnd)) latestEnd = c;
        } else if (pred.tipo === 'CF') {
            // Sucesor termina el mismo día que comienza la predecesora + lag
            const c = dayjs(
                nextWorkingDate(
                    dayjs(predTask.fecha_inicio)
                        .add(pred.lag, 'day')
                        .format('YYYY-MM-DD'),
                    calendarSettings,
                ),
            );
            if (!latestEnd || c.isAfter(latestEnd)) latestEnd = c;
        }
    }

    if (!latestStart && !latestEnd) return null;

    const dur = Math.max(1, task.duracion_dias);

    let finalStart: dayjs.Dayjs;

    if (latestStart && latestEnd) {
        // Ambas restricciones: usar la que impone el inicio más tardío
        const startFromEnd = dayjs(
            subtractWorkingDays(
                latestEnd.format('YYYY-MM-DD'),
                dur,
                calendarSettings,
            ),
        );
        finalStart = latestStart.isAfter(startFromEnd)
            ? latestStart
            : startFromEnd;
    } else if (latestStart) {
        finalStart = latestStart;
    } else {
        finalStart = dayjs(
            subtractWorkingDays(
                latestEnd!.format('YYYY-MM-DD'),
                dur,
                calendarSettings,
            ),
        );
    }

    const fecha_inicio = nextWorkingDate(
        finalStart.format('YYYY-MM-DD'),
        calendarSettings,
    );

    return {
        fecha_inicio,
        fecha_fin: addWorkingDays(fecha_inicio, dur, calendarSettings),
    };
}

/**
 * Propaga restricciones de predecesoras en cascada desde changedId (BFS).
 * Aplica posicionamiento exacto para todos los tipos FC/CC/FF/CF.
 * Las tareas grupo (groupIds) se excluyen — sus fechas son rollup de sus hijos.
 *
 * Nota: pred.taskId es el item_order (Nº) del usuario; se construye itemOrderToId
 * internamente para todas las traducciones.
 */
export function applySchedule(
    tasks: GanttTask[],
    changedId: number,
    groupIds?: Set<number>,
    mode: SchedulingMode = 'automatic',
    calendarSettings?: GanttCalendarSettings,
): GanttTask[] {
    if (mode === 'manual') {
        return tasks;
    }

    const taskMap = new Map(tasks.map((t) => [t.id, { ...t }]));

    // Traducción item_order → id (el usuario escribe Nº de fila, no id de BD)
    const itemOrderToId = new Map(tasks.map((t) => [t.item_order, t.id]));

    // successorsOf[predId] = lista de IDs (id de BD) que dependen de esa tarea
    const successorsOf = new Map<number, number[]>();
    for (const task of tasks) {
        for (const pred of task.predecesoras) {
            const predId = itemOrderToId.get(pred.taskId);
            if (predId === undefined) continue;
            if (!successorsOf.has(predId)) successorsOf.set(predId, []);
            successorsOf.get(predId)!.push(task.id);
        }
    }

    const queue: number[] = [changedId];
    const visited = new Set<number>();

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        for (const succId of successorsOf.get(currentId) ?? []) {
            // Las tareas grupo no se reposicionan por predecesoras (rollup de hijos)
            if (groupIds?.has(succId)) continue;

            const succ = taskMap.get(succId);
            if (!succ) continue;

            const constrained = computeConstrainedDates(
                succ,
                taskMap,
                itemOrderToId,
                calendarSettings,
            );
            if (!constrained) continue;

            if (
                constrained.fecha_inicio !== succ.fecha_inicio ||
                constrained.fecha_fin !== succ.fecha_fin
            ) {
                taskMap.set(succId, { ...succ, ...constrained });
                if (!visited.has(succId)) queue.push(succId);
            }
        }
    }

    return tasks.map((t) => taskMap.get(t.id) ?? t);
}
