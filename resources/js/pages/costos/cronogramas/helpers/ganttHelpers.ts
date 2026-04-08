import { gantt } from 'dhtmlx-gantt';

// ─────────────────────────────────────────────────────────────────────────────
// RUTA CRÍTICA MANUAL
// ─────────────────────────────────────────────────────────────────────────────
export function markCriticalTasks() {
    if (gantt.getLinks().length === 0) {
        gantt.eachTask((task: any) => { task._critical = false; });
        return;
    }

    try {
        if (typeof gantt.isCriticalTask === 'function') {
            gantt.eachTask((task: any) => {
                task._critical = gantt.isCriticalTask(task);
            });
            return;
        }
    } catch (_) { }

    let maxEnd: Date | null = null;
    gantt.eachTask((task: any) => {
        if (!gantt.hasChild(task.id) && task.end_date) {
            const d = new Date(task.end_date);
            if (!maxEnd || d > maxEnd) maxEnd = d;
        }
    });

    if (!maxEnd) return;

    const criticalIds = new Set<any>();

    function traceBack(taskId: any) {
        if (criticalIds.has(taskId)) return;
        criticalIds.add(taskId);
        gantt.getLinks().forEach((link: any) => {
            if (link.target == taskId) {
                traceBack(link.source);
            }
        });
    }

    gantt.eachTask((task: any) => {
        if (!gantt.hasChild(task.id) && task.end_date) {
            const d = new Date(task.end_date);
            const diff = Math.abs(d.getTime() - (maxEnd as Date).getTime());
            if (diff === 0) {
                traceBack(task.id);
            }
        }
    });

    gantt.eachTask((task: any) => {
        task._critical = criticalIds.has(task.id);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// RENUMERAR CONTADORES E ÍTEMS JERÁRQUICOS
// ─────────────────────────────────────────────────────────────────────────────
export function updateCountersAndItems() {
    let counter = 1;
    function walk(parentId: any, parentItem: string | null) {
        let ci = 1;
        gantt.getChildren(parentId).forEach((id: any) => {
            const t: any = gantt.getTask(id);
            t.counter = counter++;
            t.item = parentItem
                ? `${parentItem}.${String(ci).padStart(2, '0')}`
                : String(ci).padStart(2, '0');
            ci++;
            gantt.updateTask(t.id);
            if (gantt.hasChild(t.id)) walk(t.id, t.item);
        });
    }
    walk(0, null);
    gantt.render();
}

// ─────────────────────────────────────────────────────────────────────────────
// RANGO DE FECHAS DE UNA TAREA Y TODOS SUS HIJOS
// ─────────────────────────────────────────────────────────────────────────────
export function getSubtreeDates(taskId: any) {
    let task: any;
    try { task = gantt.getTask(taskId); } catch { return null; }
    if (!task?.start_date || !task?.end_date) return null;

    let earliest = new Date(task.start_date);
    let latest = new Date(task.end_date);
    const seen = new Set<any>();

    function walk(id: any) {
        if (seen.has(id)) return;
        seen.add(id);
        (gantt.getChildren(id) || []).forEach((cid: any) => {
            let c: any; try { c = gantt.getTask(cid); } catch { return; }
            if (!c?.start_date || !c?.end_date) return;
            if (new Date(c.start_date) < earliest) earliest = new Date(c.start_date);
            if (new Date(c.end_date) > latest) latest = new Date(c.end_date);
            if (gantt.hasChild(cid)) walk(cid);
        });
    }
    if (gantt.hasChild(taskId)) walk(taskId);
    return { start_date: earliest, end_date: latest };
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-SCHEDULING SEGURO
// ─────────────────────────────────────────────────────────────────────────────
export function applyAutoScheduling() {
    try {
        if (gantt.getTaskByTime().length > 0) {
            const projectStart = gantt.getState().min_date;
            gantt.batchUpdate(() => {
                gantt.eachTask((task: any) => {
                    if (!task.parent) {
                        const linked = gantt.getLinks().some((l: any) => l.target === task.id);
                        if (!linked && task.start_date < projectStart) {
                            task.start_date = projectStart;
                            gantt.updateTask(task.id);
                        }
                    }
                });
            });
        }
        if (typeof (gantt as any).autoSchedule === 'function') {
            gantt.autoSchedule();
        }
    } catch (e) { console.warn('autoSchedule:', e); }
}