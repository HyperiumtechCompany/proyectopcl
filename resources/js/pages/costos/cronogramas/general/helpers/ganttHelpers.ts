import { gantt } from 'dhtmlx-gantt';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

export const LINK_LABELS: Record<string, string> = {
    '0': 'FC', '1': 'CC', '2': 'FF', '3': 'CF',
};

export const LINK_NAMES: Record<string, string> = {
    '0': 'Fin-Comienzo', '1': 'Comienzo-Comienzo',
    '2': 'Fin-Fin',      '3': 'Comienzo-Fin',
};

export const LINK_TYPE_MAP: Record<string, string> = {
    FC: '0', CC: '1', FF: '2', CF: '3',
};

// ─────────────────────────────────────────────────────────────────────────────
// MARCADORES DE INICIO / LÍMITE DEL PROYECTO
// ─────────────────────────────────────────────────────────────────────────────

const MARKER_START_ID = 'marker_project_start';
const MARKER_END_ID   = 'marker_project_end';

export function setProjectMarkers(startDate: Date | null, endDate: Date | null): void {
    try { (gantt as any).deleteMarker(MARKER_START_ID); } catch { /* ok */ }
    try { (gantt as any).deleteMarker(MARKER_END_ID);   } catch { /* ok */ }

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
// SINCRONIZAR TEXTO DE PREDECESORAS (links → campo predecessors)
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
    let targetTask: any;
    try { targetTask = gantt.getTask(taskId); } catch { return; }

    const existingLinks = gantt.getLinks().filter((l: any) => String(l.target) === String(taskId));

    // Parsear el texto en pares {source, type}
    const newPredecessors: { source: any; type: string }[] = [];

    if (rawText?.trim()) {
        for (const part of rawText.split(',')) {
            const match = part.trim().toUpperCase().match(/^(\d+)(FC|CC|FF|CF)?$/);
            if (!match) continue;

            const targetRownum = parseInt(match[1], 10);
            const type = LINK_TYPE_MAP[match[2] ?? 'FC'] ?? '0';

            let sourceTask: any = null;
            gantt.eachTask((t: any) => {
                if (gantt.getGlobalTaskIndex(t.id) + 1 === targetRownum) sourceTask = t;
            });

            if (sourceTask && String(sourceTask.id) !== String(taskId)) {
                newPredecessors.push({ source: sourceTask.id, type });
            }
        }
    }

    const existingKeys = new Set(existingLinks.map((l: any) => `${l.source}|${l.type}`));
    const newKeys      = new Set(newPredecessors.map((p) => `${p.source}|${p.type}`));

    // Sin cambios → no hacer nada
    if (existingKeys.size === newKeys.size && [...existingKeys].every((k) => newKeys.has(k))) return;

    // Eliminar links obsoletos
    for (const link of existingLinks) {
        if (!newKeys.has(`${link.source}|${link.type}`)) {
            try { gantt.deleteLink(link.id); } catch { /* ok */ }
        }
    }

    // Crear nuevos links y ajustar fechas
    const duration = Number(targetTask.duration) || 5;
    for (const pred of newPredecessors) {
        if (!existingKeys.has(`${pred.source}|${pred.type}`)) {
            gantt.addLink({ id: gantt.uid(), source: pred.source, target: taskId, type: pred.type });
        }
        const sourceTask = gantt.getTask(pred.source);
        if (sourceTask) adjustTaskDatesByLinkType(targetTask, sourceTask, pred.type, duration);
    }

    gantt.updateTask(taskId);
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
    if (!targetTask || !sourceTask) return;

    let newStart: Date;
    let newEnd: Date;

    switch (type) {
        case '0': // FC — Fin → Inicio
            newStart = new Date(sourceTask.end_date);
            newEnd   = new Date(newStart);
            newEnd.setDate(newStart.getDate() + duration);
            break;

        case '1': // CC — Inicio → Inicio
            newStart = new Date(sourceTask.start_date);
            newEnd   = new Date(newStart);
            newEnd.setDate(newStart.getDate() + duration);
            break;

        case '2': // FF — Fin → Fin
            newEnd   = new Date(sourceTask.end_date);
            newStart = new Date(newEnd);
            newStart.setDate(newEnd.getDate() - duration);
            break;

        case '3': // CF — Inicio → Fin
            newEnd   = new Date(sourceTask.start_date);
            newStart = new Date(newEnd);
            newStart.setDate(newEnd.getDate() - duration);
            break;

        default:
            return;
    }

    if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) return;

    targetTask.start_date = newStart;
    targetTask.end_date   = newEnd;
    targetTask.duration   = duration;

    gantt.updateTask(targetTask.id);
    gantt.render();
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

    // Usar API nativa si está disponible
    if (typeof gantt.isCriticalTask === 'function') {
        try {
            gantt.eachTask((task: any) => { task._critical = gantt.isCriticalTask(task); });
            return;
        } catch { /* fallback manual */ }
    }

    // Fallback: trazar hacia atrás desde las tareas con mayor end_date
    let maxEndTime = 0;
    gantt.eachTask((task: any) => {
        if (!gantt.hasChild(task.id) && task.end_date) {
            const t = new Date(task.end_date).getTime();
            if (t > maxEndTime) maxEndTime = t;
        }
    });

    if (!maxEndTime) return;

    const criticalIds = new Set<any>();

    function traceBack(taskId: any): void {
        if (criticalIds.has(taskId)) return;
        criticalIds.add(taskId);
        gantt.getLinks().forEach((link: any) => {
            if (String(link.target) === String(taskId)) traceBack(link.source);
        });
    }

    gantt.eachTask((task: any) => {
        if (!gantt.hasChild(task.id) && task.end_date) {
            if (Math.abs(new Date(task.end_date).getTime() - maxEndTime) === 0) {
                traceBack(task.id);
            }
        }
    });

    gantt.eachTask((task: any) => { task._critical = criticalIds.has(task.id); });
}

// ─────────────────────────────────────────────────────────────────────────────
// RENUMERAR CONTADORES E ÍTEMS WBS
// Debounced para no bloquear la UI en actualizaciones frecuentes
// ─────────────────────────────────────────────────────────────────────────────

let _counterUpdateTimeout: ReturnType<typeof setTimeout> | null = null;

export function updateCountersAndItems(): void {
    if (_counterUpdateTimeout) return;

    _counterUpdateTimeout = setTimeout(() => {
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
                if (gantt.hasChild(t.id)) walk(t.id, t.item);
            });
        }

        walk(0, null);
        _counterUpdateTimeout = null;
    }, 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDAR LÍMITES DEL PROYECTO (solo en modo AUTO)
// Retorna true si la tarea fue modificada
// ─────────────────────────────────────────────────────────────────────────────

export function enforceProjectBounds(taskId: any): boolean {
    if (!gantt.config.auto_scheduling) return false;

    const projectStart: Date | null = (window as any).__projectRealStartDate ?? gantt.config.start_date ?? null;
    const projectEnd:   Date | null = (window as any).__projectLimitDate     ?? gantt.config.end_date   ?? null;
    if (!projectStart || !projectEnd) return false;

    let task: any;
    try { task = gantt.getTask(taskId); } catch { return false; }
    if (gantt.hasChild(taskId)) return false; // los padres se calculan solos

    let changed = false;
    const startLimit = new Date(projectStart).getTime();
    const endLimit   = new Date(projectEnd).getTime();

    if (task.start_date && new Date(task.start_date).getTime() < startLimit) {
        task.start_date = new Date(projectStart);
        const newEnd = new Date(task.start_date);
        newEnd.setDate(newEnd.getDate() + (task.duration || 1));
        task.end_date = newEnd;
        changed = true;
    }

    if (task.end_date && new Date(task.end_date).getTime() > endLimit) {
        task.end_date = new Date(projectEnd);
        const diff = new Date(task.end_date).getTime() - new Date(task.start_date).getTime();
        const days = Math.ceil(diff / 86400000);
        if (days > 0) task.duration = days;
        changed = true;
    }

    return changed;
}

// ─────────────────────────────────────────────────────────────────────────────
// RECALCULAR DURACIÓN REAL DE CADA TAREA HOJA (trabajo neto)
// Llamado después de auto-scheduling para mantener duración consistente
// ─────────────────────────────────────────────────────────────────────────────

export function applyAutoScheduling(): void {
    try {
        if (gantt.getTaskByTime().length === 0) return;

        gantt.batchUpdate(() => {
            gantt.eachTask((task: any) => {
                if (gantt.hasChild(task.id) || !task.start_date || !task.end_date) return;
                try {
                    const d = gantt.calculateDuration({ start_date: task.start_date, end_date: task.end_date, task });
                    if (d > 0 && d !== task.duration) {
                        task.duration = d;
                        gantt.updateTask(task.id);
                    }
                } catch { /* ignorar tarea inválida */ }
            });
        });

        gantt.render();
    } catch (e) {
        console.warn('[applyAutoScheduling]', e);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MODO AUTO vs MANUAL
// ─────────────────────────────────────────────────────────────────────────────

export function toggleGanttMode(isAuto: boolean): void {
    gantt.config.auto_scheduling        = isAuto;
    gantt.config.auto_scheduling_strict = isAuto;

    const projectStart: Date | null = (window as any).__projectRealStartDate ?? null;
    const limitDate:    Date | null = (window as any).__projectLimitDate     ?? null;

    if (isAuto) {
        gantt.config.limit_view = true;
        (gantt.config as any).limit_task_move = true;

        if (limitDate) {
            const viewEnd = new Date(limitDate);
            viewEnd.setDate(viewEnd.getDate() + 1);
            gantt.config.end_date = viewEnd;
        }

        gantt.batchUpdate(() => {
            gantt.eachTask((task: any) => {
                if (!gantt.hasChild(task.id) && enforceProjectBounds(task.id)) {
                    gantt.updateTask(task.id);
                }
            });
        });

    } else {
        gantt.config.limit_view = false;
        (gantt.config as any).limit_task_move = false;

        if (limitDate) {
            // Extender la vista hasta fin del mes del límite
            const viewEnd = new Date(limitDate.getFullYear(), limitDate.getMonth() + 1, 0);
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