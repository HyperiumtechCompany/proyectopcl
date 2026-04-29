import { gantt } from 'dhtmlx-gantt';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

export const LINK_LABELS: Record<string, string> = {
    '0': 'FC', '1': 'CC', '2': 'FF', '3': 'CF',
};

export const LINK_NAMES: Record<string, string> = {
    '0': 'Fin-Comienzo', '1': 'Comienzo-Comienzo',
    '2': 'Fin-Fin', '3': 'Comienzo-Fin',
};

export const LINK_TYPE_MAP: Record<string, string> = {
    FC: '0', CC: '1', FF: '2', CF: '3',
};

// ─────────────────────────────────────────────────────────────────────────────
// MARCADORES — IDs controlados para evitar duplicados
// ─────────────────────────────────────────────────────────────────────────────

const MARKER_START_ID = 'marker_project_start';
const MARKER_END_ID = 'marker_project_end';

/**
 * Elimina y vuelve a crear los marcadores de inicio y límite del proyecto.
 * Centralizar aquí evita duplicados sin importar cuántas veces se llame.
 */
export function setProjectMarkers(startDate: Date | null, endDate: Date | null): void {
    // Eliminar siempre los anteriores antes de crear nuevos
    try { (gantt as any).deleteMarker(MARKER_START_ID); } catch { /* no existía */ }
    try { (gantt as any).deleteMarker(MARKER_END_ID); } catch { /* no existía */ }

    if (startDate) {
        (gantt as any).addMarker({
            id: MARKER_START_ID,
            start_date: new Date(startDate),
            css: 'pcl-marker-start',
            text: 'INICIO',
        });
    }

    if (endDate) {
        (gantt as any).addMarker({
            id: MARKER_END_ID,
            start_date: new Date(endDate),
            css: 'pcl-marker-end',
            text: 'LÍMITE',
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINCRONIZAR TEXTO DE PREDECESORAS
// ─────────────────────────────────────────────────────────────────────────────

export function updatePredecessorsText(taskId: any): void {
    let task: any;
    try { task = gantt.getTask(taskId); } catch { return; }

    task.predecessors = gantt
        .getLinks()
        .filter((l: any) => String(l.target) === String(taskId))
        .map((l: any) => {
            try {
                const rownum = gantt.getGlobalTaskIndex(l.source) + 1;
                return `${rownum}${LINK_LABELS[l.type] ?? 'FC'}`;
            } catch { return null; }
        })
        .filter(Boolean)
        .join(', ');

    gantt.updateTask(taskId);
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSEAR TEXTO DE PREDECESORAS → LINKS
// ─────────────────────────────────────────────────────────────────────────────

export function parsePredecessorText(taskId: any, rawText: string): void {
    gantt.getLinks()
        .filter((l: any) => String(l.target) === String(taskId))
        .forEach((l: any) => { try { gantt.deleteLink(l.id); } catch { } });

    if (!rawText.trim()) return;

    let targetTask: any;
    try { targetTask = gantt.getTask(taskId); } catch { return; }

    const duration = Number(targetTask.duration) || 1;

    // Construir índice rownum → task UNA sola vez
    const rownumIndex = new Map<number, any>();
    gantt.eachTask((t: any) => {
        rownumIndex.set(gantt.getGlobalTaskIndex(t.id) + 1, t);
    });

    rawText.split(',').forEach((part) => {
        const clean = part.trim().toUpperCase();
        const match = clean.match(/^(\d+)(FC|CC|FF|CF)?$/);
        if (!match) return;

        const targetRownum = parseInt(match[1], 10);
        const type = LINK_TYPE_MAP[match[2] ?? 'FC'] ?? '0';
        const sourceTask = rownumIndex.get(targetRownum);

        if (!sourceTask || String(sourceTask.id) === String(taskId)) return;

        gantt.addLink({ id: gantt.uid(), source: sourceTask.id, target: taskId, type });
        adjustTaskDatesByLinkType(targetTask, sourceTask, type, duration);
    });

    gantt.render();
}

// ─────────────────────────────────────────────────────────────────────────────
// AJUSTAR FECHAS POR TIPO DE LINK
// ─────────────────────────────────────────────────────────────────────────────

export function adjustTaskDatesByLinkType(
    targetTask: any,
    sourceTask: any,
    type: string,
    duration: number,
): void {
    let newStart: Date = new Date(targetTask.start_date);

    switch (type) {
        case '0': // FC: Fin → Inicio
            newStart = new Date(sourceTask.end_date);
            break;

        case '1': // CC: Inicio → Inicio
            newStart = new Date(sourceTask.start_date);
            break;

        case '2': { // FF: Fin → Fin
            const targetEnd = new Date(sourceTask.end_date);
            newStart = gantt.calculateEndDate({ start_date: targetEnd, duration: -duration, task: targetTask });
            targetTask.start_date = newStart;
            targetTask.end_date = targetEnd;
            gantt.updateTask(targetTask.id);
            return;
        }

        case '3': { // CF: Inicio → Fin
            const targetEndCF = new Date(sourceTask.start_date);
            newStart = gantt.calculateEndDate({ start_date: targetEndCF, duration: -duration, task: targetTask });
            const projectStart = gantt.config.start_date || sourceTask.start_date;
            if (newStart < projectStart) newStart = new Date(projectStart);
            targetTask.start_date = newStart;
            targetTask.end_date = gantt.calculateEndDate({ start_date: newStart, duration, task: targetTask });
            gantt.updateTask(targetTask.id);
            return;
        }
    }

    // FC y CC
    targetTask.start_date = newStart;
    targetTask.end_date = gantt.calculateEndDate({ start_date: newStart, duration, task: targetTask });
    gantt.updateTask(targetTask.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// RUTA CRÍTICA
// ─────────────────────────────────────────────────────────────────────────────

export function markCriticalTasks(): void {
    const links = gantt.getLinks();
    if (links.length === 0) {
        gantt.eachTask((task: any) => { task._critical = false; });
        return;
    }
    try {
        if (typeof gantt.isCriticalTask === 'function') {
            gantt.eachTask((task: any) => { task._critical = gantt.isCriticalTask(task); });
            return;
        }
    } catch { /* fallback */ }

    // Fallback: trazar hacia atrás desde la tarea con fin más tardío
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
            const diff = Math.abs(new Date(task.end_date).getTime() - (maxEnd as Date).getTime());
            if (diff === 0) traceBack(task.id);
        }
    });

    gantt.eachTask((task: any) => { task._critical = criticalIds.has(task.id); });
}

// ─────────────────────────────────────────────────────────────────────────────
// RENUMERAR CONTADORES E ÍTEMS WBS
// ─────────────────────────────────────────────────────────────────────────────

export function updateCountersAndItems(): void {
    let counter = 1;

    function walk(parentId: any, parentItem: string | null): void {
        let childIndex = 1;
        gantt.getChildren(parentId).forEach((id: any) => {
            const t: any = gantt.getTask(id);
            t.counter = counter++;
            t.item = t.originalItem
                ? t.originalItem
                : parentItem
                    ? `${parentItem}.${String(childIndex).padStart(2, '0')}`
                    : String(childIndex).padStart(2, '0');
            childIndex++;
            // Sin gantt.updateTask() aquí — lo hace el batchUpdate
            if (gantt.hasChild(t.id)) walk(t.id, t.item);
        });
    }

    gantt.batchUpdate(() => {
        walk(0, null);
    });
    // Solo UN render al final
    gantt.render();
}

// ─────────────────────────────────────────────────────────────────────────────
// RANGO DE FECHAS DE UN SUBÁRBOL
// ─────────────────────────────────────────────────────────────────────────────

export function getSubtreeDates(taskId: any): { start_date: Date; end_date: Date } | null {
    let task: any;
    try { task = gantt.getTask(taskId); } catch { return null; }
    if (!task?.start_date || !task?.end_date) return null;

    let earliest = new Date(task.start_date);
    let latest = new Date(task.end_date);
    const seen = new Set<any>();

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
            if (e > latest) latest = e;
            if (gantt.hasChild(cid)) walk(cid);
        });
    }

    if (gantt.hasChild(taskId)) walk(taskId);
    return { start_date: earliest, end_date: latest };
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDAR LÍMITES DEL PROYECTO (solo en modo AUTO)
// ─────────────────────────────────────────────────────────────────────────────

export function enforceProjectBounds(taskId: any): boolean {
    if (!gantt.config.auto_scheduling) return false;

    const projectStart = (window as any).__projectRealStartDate || gantt.config.start_date;
    const projectEnd = (window as any).__projectLimitDate || gantt.config.end_date;
    if (!projectStart || !projectEnd) return false;

    let task: any;
    try { task = gantt.getTask(taskId); } catch { return false; }
    if (gantt.hasChild(taskId)) return false;

    let changed = false;

    if (task.start_date && new Date(task.start_date) < new Date(projectStart)) {
        task.start_date = new Date(projectStart);
        task.end_date = gantt.calculateEndDate({ start_date: task.start_date, duration: task.duration || 1, task });
        changed = true;
    }

    if (task.end_date && new Date(task.end_date) > new Date(projectEnd)) {
        task.end_date = new Date(projectEnd);
        const newDuration = gantt.calculateDuration({ start_date: task.start_date, end_date: task.end_date, task });
        if (newDuration > 0) task.duration = newDuration;
        changed = true;
    }

    return changed;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-SCHEDULING
// ─────────────────────────────────────────────────────────────────────────────

export function applyAutoScheduling(): void {
    try {
        if (gantt.getTaskByTime().length === 0) return;
        if (typeof (gantt as any).autoSchedule === 'function') {
            (gantt as any).autoSchedule();
        } else {
            // Fallback: recalcular duraciones
            gantt.batchUpdate(() => {
                gantt.eachTask((task: any) => {
                    if (!gantt.hasChild(task.id) && task.start_date && task.end_date) {
                        const d = gantt.calculateDuration({ start_date: task.start_date, end_date: task.end_date, task });
                        if (d > 0 && d !== task.duration) { task.duration = d; gantt.updateTask(task.id); }
                    }
                });
            });
        }
        gantt.render();
    } catch (e) {
        console.warn('[applyAutoScheduling]', e);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODO AUTO vs MANUAL
//
// AUTO  → tareas confinadas dentro del rango [inicio, límite]. Vista exacta.
// MANUAL → tareas pueden pasar el límite. Vista extendida hasta fin del mes
//           de la fecha límite (o un mes adicional).
// ─────────────────────────────────────────────────────────────────────────────

export function toggleGanttMode(isAuto: boolean): void {
    gantt.config.auto_scheduling = isAuto;
    gantt.config.auto_scheduling_strict = isAuto;

    const projectStart = (window as any).__projectRealStartDate as Date | null;
    const limitDate = (window as any).__projectLimitDate as Date | null;

    if (isAuto) {
        // ── Modo AUTO ─────────────────────────────────────────────────────────
        gantt.config.limit_view = true;
        (gantt.config as any).limit_task_move = true;

        if (limitDate) {
            // Vista: exactamente hasta el día límite
            const viewEnd = new Date(limitDate);
            viewEnd.setDate(viewEnd.getDate() + 1);
            gantt.config.end_date = viewEnd;
        }

        // Confinar las tareas que se hayan pasado al volver a AUTO
        gantt.batchUpdate(() => {
            gantt.eachTask((task: any) => {
                if (!gantt.hasChild(task.id) && enforceProjectBounds(task.id)) {
                    gantt.updateTask(task.id);
                }
            });
        });

        if (typeof (gantt as any).autoSchedule === 'function') {
            (gantt as any).autoSchedule();
        }

    } else {
        // ── Modo MANUAL ───────────────────────────────────────────────────────
        gantt.config.limit_view = false;
        (gantt.config as any).limit_task_move = false;

        if (limitDate) {
            // Vista: hasta el último día del mes de la fecha límite
            const viewEnd = new Date(limitDate.getFullYear(), limitDate.getMonth() + 1, 0); // último día del mes
            gantt.config.end_date = viewEnd;
        }
    }

    if (projectStart) {
        const viewStart = new Date(projectStart);
        viewStart.setDate(viewStart.getDate() - 1);
        gantt.config.start_date = viewStart;
    }

    gantt.render();
}