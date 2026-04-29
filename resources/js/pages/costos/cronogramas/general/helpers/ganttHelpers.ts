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

export function setProjectMarkers(startDate: Date | null, endDate: Date | null): void {
    try { (gantt as any).deleteMarker(MARKER_START_ID); } catch { }
    try { (gantt as any).deleteMarker(MARKER_END_ID); } catch { }

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
// CACHÉ PARA PREDECESORAS (OPTIMIZACIÓN)
// ─────────────────────────────────────────────────────────────────────────────

let _rownumIndexCache: Map<number, any> | null = null;

function getRownumIndexCached(): Map<number, any> {
    if (_rownumIndexCache) return _rownumIndexCache;
    const index = new Map<number, any>();
    gantt.eachTask((t: any) => {
        index.set(gantt.getGlobalTaskIndex(t.id) + 1, t);
    });
    _rownumIndexCache = index;
    return index;
}

function invalidateRownumCache(): void {
    _rownumIndexCache = null;
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
// PARSEAR TEXTO DE PREDECESORAS → LINKS (VERSIÓN OPTIMIZADA)
// ─────────────────────────────────────────────────────────────────────────────

export function parsePredecessorText(taskId: any, rawText: string): void {
    const existingLinks = gantt.getLinks().filter((l: any) => String(l.target) === String(taskId));
    const newPredecessors: { source: any; type: string }[] = [];

    if (rawText.trim()) {
        const index = getRownumIndexCached();
        const parts = rawText.split(',');

        for (const part of parts) {
            const clean = part.trim().toUpperCase();
            const match = clean.match(/^(\d+)(FC|CC|FF|CF)?$/);
            if (!match) continue;

            const targetRownum = parseInt(match[1], 10);
            const type = LINK_TYPE_MAP[match[2] ?? 'FC'] ?? '0';
            const sourceTask = index.get(targetRownum);

            if (sourceTask && String(sourceTask.id) !== String(taskId)) {
                newPredecessors.push({ source: sourceTask.id, type });
            }
        }
    }

    const existingKeys = new Set(existingLinks.map(l => `${l.source}|${l.type}`));
    const newKeys = new Set(newPredecessors.map(p => `${p.source}|${p.type}`));

    const hasChanges = existingKeys.size !== newKeys.size ||
        [...existingKeys].some(k => !newKeys.has(k));

    if (!hasChanges) return;

    for (const link of existingLinks) {
        const key = `${link.source}|${link.type}`;
        if (!newKeys.has(key)) {
            try { gantt.deleteLink(link.id); } catch { }
        }
    }

    for (const pred of newPredecessors) {
        const key = `${pred.source}|${pred.type}`;
        if (!existingKeys.has(key)) {
            gantt.addLink({
                id: gantt.uid(),
                source: pred.source,
                target: taskId,
                type: pred.type,
            });
        }
    }
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
        case '0':
            newStart = new Date(sourceTask.end_date);
            break;
        case '1':
            newStart = new Date(sourceTask.start_date);
            break;
        case '2': {
            const targetEnd = new Date(sourceTask.end_date);
            newStart = gantt.calculateEndDate({ start_date: targetEnd, duration: -duration, task: targetTask });
            targetTask.start_date = newStart;
            targetTask.end_date = targetEnd;
            gantt.updateTask(targetTask.id);
            return;
        }
        case '3': {
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

    let maxEnd: Date | null = null;
    gantt.eachTask((task: any) => {
        if (!gantt.hasChild(task.id) && task.end_date) {
            const d = new Date(task.end_date);
            if (!maxEnd || d > maxEnd) maxEnd = d;
        }
    });

    if (!maxEnd) return;

    const criticalIds = new Set<any>();
    // ✅ ARREGLO: usar una variable auxiliar o el operador !
    const maxEndTime = (maxEnd as Date).getTime();

    function traceBack(taskId: any): void {
        if (criticalIds.has(taskId)) return;
        criticalIds.add(taskId);
        gantt.getLinks().forEach((link: any) => {
            if (link.target == taskId) traceBack(link.source);
        });
    }

    gantt.eachTask((task: any) => {
        if (!gantt.hasChild(task.id) && task.end_date) {
            const diff = Math.abs(new Date(task.end_date).getTime() - maxEndTime);
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
            if (gantt.hasChild(t.id)) walk(t.id, t.item);
        });
    }

    gantt.batchUpdate(() => {
        walk(0, null);
    });

    invalidateRownumCache();
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
// ─────────────────────────────────────────────────────────────────────────────

export function toggleGanttMode(isAuto: boolean): void {
    gantt.config.auto_scheduling = isAuto;
    gantt.config.auto_scheduling_strict = isAuto;

    const projectStart = (window as any).__projectRealStartDate as Date | null;
    const limitDate = (window as any).__projectLimitDate as Date | null;

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

        if (typeof (gantt as any).autoSchedule === 'function') {
            (gantt as any).autoSchedule();
        }

    } else {
        gantt.config.limit_view = false;
        (gantt.config as any).limit_task_move = false;

        if (limitDate) {
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