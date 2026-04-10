import { gantt } from 'dhtmlx-gantt';

// ─────────────────────────────────────────────────────────────────────────────
// RUTA CRÍTICA
// Usa isCriticalTask() del plugin si está disponible; fallback manual por
// trazado hacia atrás desde la(s) tarea(s) con fecha de fin más tardía.
// ─────────────────────────────────────────────────────────────────────────────
export function markCriticalTasks(): void {
    // Sin links → ninguna tarea es crítica
    if (gantt.getLinks().length === 0) {
        gantt.eachTask((task: any) => { task._critical = false; });
        return;
    }

    // Usar el plugin oficial si está disponible
    try {
        if (typeof gantt.isCriticalTask === 'function') {
            gantt.eachTask((task: any) => {
                task._critical = gantt.isCriticalTask(task);
            });
            return;
        }
    } catch (_) { /* plugin no disponible */ }

    // ── Fallback: trazado manual hacia atrás ─────────────────────────────────
    let maxEnd: Date | null = null;

    gantt.eachTask((task: any) => {
        if (!gantt.hasChild(task.id) && task.end_date) {
            const d = new Date(task.end_date);
            if (!maxEnd || d > maxEnd) maxEnd = d;
        }
    });

    if (!maxEnd) return;

    const criticalIds = new Set<any>();

    function traceBack(taskId: any): void {
        if (criticalIds.has(taskId)) return;
        criticalIds.add(taskId);
        gantt.getLinks().forEach((link: any) => {
            if (link.target == taskId) traceBack(link.source);
        });
    }

    gantt.eachTask((task: any) => {
        if (!gantt.hasChild(task.id) && task.end_date) {
            const diff = Math.abs(
                new Date(task.end_date).getTime() - (maxEnd as Date).getTime()
            );
            if (diff === 0) traceBack(task.id);
        }
    });

    gantt.eachTask((task: any) => {
        task._critical = criticalIds.has(task.id);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// RENUMERAR CONTADORES E ÍTEMS WBS
// FIX: el contador `counter` se reinicia en cada llamada (era acumulativo).
// Se respeta originalItem importado desde presupuesto; si no existe, se
// genera código jerárquico automático (01, 01.01, 01.01.01, …).
// ─────────────────────────────────────────────────────────────────────────────
export function updateCountersAndItems(): void {
    let counter = 1; // resetea correctamente en cada invocación

    function walk(parentId: any, parentItem: string | null): void {
        let childIndex = 1;
        gantt.getChildren(parentId).forEach((id: any) => {
            const t: any = gantt.getTask(id);
            t.counter = counter++;

            if (t.originalItem) {
                // Mantener código original importado del presupuesto
                t.item = t.originalItem;
            } else {
                t.item = parentItem
                    ? `${parentItem}.${String(childIndex).padStart(2, '0')}`
                    : String(childIndex).padStart(2, '0');
            }

            childIndex++;
            gantt.updateTask(t.id);

            if (gantt.hasChild(t.id)) walk(t.id, t.item);
        });
    }

    walk(0, null);
    gantt.render();
}

// ─────────────────────────────────────────────────────────────────────────────
// RANGO DE FECHAS DE UNA TAREA Y SU SUBÁRBOL
// Retorna null si la tarea no existe o no tiene fechas válidas.
// ─────────────────────────────────────────────────────────────────────────────
export function getSubtreeDates(
    taskId: any
): { start_date: Date; end_date: Date } | null {
    let task: any;
    try { task = gantt.getTask(taskId); } catch { return null; }
    if (!task?.start_date || !task?.end_date) return null;

    let earliest = new Date(task.start_date);
    let latest   = new Date(task.end_date);
    const seen   = new Set<any>();

    function walk(id: any): void {
        if (seen.has(id)) return;
        seen.add(id);

        (gantt.getChildren(id) || []).forEach((cid: any) => {
            let c: any;
            try { c = gantt.getTask(cid); } catch { return; }
            if (!c?.start_date || !c?.end_date) return;

            const s = new Date(c.start_date);
            const e = new Date(c.end_date);
            if (s < earliest) earliest = s;
            if (e > latest)   latest   = e;

            if (gantt.hasChild(cid)) walk(cid);
        });
    }

    if (gantt.hasChild(taskId)) walk(taskId);
    return { start_date: earliest, end_date: latest };
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-SCHEDULING SEGURO
// FIX: comprueba que gantt tenga tareas y que min_date no sea null antes de
// usarlo; evita crash cuando el gantt está vacío.
// ─────────────────────────────────────────────────────────────────────────────
export function applyAutoScheduling(): void {
    try {
        const tasks = gantt.getTaskByTime();
        if (tasks.length === 0) return;

        const state       = gantt.getState();
        const projectStart: Date | null = state.min_date ? new Date(state.min_date) : null;

        if (projectStart) {
            gantt.batchUpdate(() => {
                gantt.eachTask((task: any) => {
                    if (!task.parent) {
                        const hasIncomingLink = gantt
                            .getLinks()
                            .some((l: any) => String(l.target) === String(task.id));

                        if (!hasIncomingLink && task.start_date < projectStart) {
                            task.start_date = new Date(projectStart);
                            gantt.updateTask(task.id);
                        }
                    }
                });
            });
        }

        if (typeof (gantt as any).autoSchedule === 'function') {
            (gantt as any).autoSchedule();
        }
    } catch (e) {
        console.warn('[applyAutoScheduling]', e);
    }
}