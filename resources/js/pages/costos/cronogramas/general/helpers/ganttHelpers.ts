import { gantt } from 'dhtmlx-gantt';

// ─────────────────────────────────────────────────────────────────────────────
// FORMATO UNIFICADO DE PREDECESORAS
//
// ⚠️ DECISIÓN ARQUITECTURAL IMPORTANTE:
// Todo el sistema usa NÚMERO DE FILA GLOBAL (1, 2, 3…) como identificador
// en el texto de predecesoras. Ejemplo: "3FC, 5CC"
// ─────────────────────────────────────────────────────────────────────────────

/** Etiquetas cortas por tipo de link (usadas en toda la app) */
export const LINK_LABELS: Record<string, string> = {
    '0': 'FC',
    '1': 'CC',
    '2': 'FF',
    '3': 'CF',
};

/** Mapa de texto legible → código interno de tipo de link */
export const LINK_TYPE_MAP: Record<string, string> = {
    FC: '0',
    CC: '1',
    FF: '2',
    CF: '3',
};

// ─────────────────────────────────────────────────────────────────────────────
// SINCRONIZAR TEXTO DE PREDECESORAS
// Lee los links reales del gantt que apuntan a `taskId` y actualiza
// task.predecessors con el formato "3FC, 5CC" (número de fila + tipo).
// ─────────────────────────────────────────────────────────────────────────────
export function updatePredecessorsText(taskId: any): void {
    let task: any;
    try { task = gantt.getTask(taskId); } catch { return; }

    // Construir texto con NÚMERO DE FILA (no WBS) para consistencia con el parser
    task.predecessors = gantt
        .getLinks()
        .filter((l: any) => String(l.target) === String(taskId))
        .map((l: any) => {
            try {
                // Número de fila global del origen (1-based)
                const rownum = gantt.getGlobalTaskIndex(l.source) + 1;
                return `${rownum}${LINK_LABELS[l.type] ?? 'FC'}`;
            } catch { return null; }
        })
        .filter(Boolean)
        .join(', ');

    gantt.updateTask(taskId);
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSEAR TEXTO DE PREDECESORAS → LINKS EN EL GANTT
// Convierte texto como "3FC, 5CC" en links reales del gantt.
// También ajusta las fechas de la tarea destino según el tipo de relación,
// respetando los días no laborables via calculateEndDate/calculateDuration.
// ─────────────────────────────────────────────────────────────────────────────
export function parsePredecessorText(taskId: any, rawText: string): void {
    // 1. Eliminar links existentes hacia esta tarea
    gantt
        .getLinks()
        .filter((l: any) => String(l.target) === String(taskId))
        .forEach((l: any) => {
            try { gantt.deleteLink(l.id); } catch { /* ignorar si ya no existe */ }
        });

    if (!rawText.trim()) return;

    let targetTask: any;
    try { targetTask = gantt.getTask(taskId); } catch { return; }

    const duration = Number(targetTask.duration) || 1;

    // 2. Parsear cada parte ("3FC", "5", "2CC", etc.)
    rawText.split(',').forEach((part) => {
        const clean = part.trim().toUpperCase();

        // Formato esperado: número de fila + tipo opcional (FC por defecto)
        const match = clean.match(/^(\d+)(FC|CC|FF|CF)?$/);
        if (!match) return;

        const targetRownum = parseInt(match[1], 10);
        const type = LINK_TYPE_MAP[match[2] ?? 'FC'] ?? '0';

        // Buscar la tarea origen por su número de fila global
        let sourceTask: any = null;
        gantt.eachTask((t: any) => {
            if (gantt.getGlobalTaskIndex(t.id) + 1 === targetRownum) {
                sourceTask = t;
            }
        });

        if (!sourceTask || String(sourceTask.id) === String(taskId)) return;

        // 3. Ajustar fechas de la tarea destino según el tipo de relación
        //    usando calculateEndDate para respetar días no laborables
        adjustTaskDatesByLinkType(targetTask, sourceTask, type, duration);
        gantt.updateTask(taskId);

        // 4. Crear el link en el gantt
        gantt.addLink({
            id: gantt.uid(),
            source: sourceTask.id,
            target: taskId,
            type,
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// AJUSTAR FECHAS SEGÚN TIPO DE RELACIÓN
// Centraliza la lógica de cálculo de fechas para los 4 tipos de link.
// Usa calculateEndDate() del gantt para respetar días no laborables.
// ─────────────────────────────────────────────────────────────────────────────
export function adjustTaskDatesByLinkType(
    targetTask: any,
    sourceTask: any,
    type: string,
    duration: number
): void {
    switch (type) {
        case '0': { // FC — Fin → Comienzo: la tarea empieza cuando termina la anterior
            const newStart = gantt.date.add(new Date(sourceTask.end_date), 1, 'day');
            targetTask.start_date = newStart;
            targetTask.end_date = gantt.calculateEndDate({
                start_date: newStart,
                duration,
                task: targetTask,
            });
            break;
        }
        case '1': { // CC — Comienzo → Comienzo: ambas empiezan al mismo tiempo
            const newStart = new Date(sourceTask.start_date);
            targetTask.start_date = newStart;
            targetTask.end_date = gantt.calculateEndDate({
                start_date: newStart,
                duration,
                task: targetTask,
            });
            break;
        }
        case '2': { // FF — Fin → Fin: ambas terminan al mismo tiempo
            const newEnd = new Date(sourceTask.end_date);
            targetTask.end_date = newEnd;
            // Calcular inicio hacia atrás desde el fin
            targetTask.start_date = gantt.calculateEndDate({
                start_date: newEnd,
                duration: -duration,
                task: targetTask,
            });
            break;
        }
        case '3': { // CF — Comienzo → Fin: la tarea termina cuando empieza la anterior
            const newEnd = new Date(sourceTask.start_date);
            targetTask.end_date = newEnd;
            targetTask.start_date = gantt.calculateEndDate({
                start_date: newEnd,
                duration: -duration,
                task: targetTask,
            });
            break;
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// RUTA CRÍTICA
//
// Marca cada tarea con _critical = true/false.
// Usa el plugin oficial si está disponible; si no, hace trazado manual
// hacia atrás desde la(s) tarea(s) con fecha de fin más tardía.
// ─────────────────────────────────────────────────────────────────────────────
export function markCriticalTasks(): void {
    // Sin links → ninguna tarea es crítica
    if (gantt.getLinks().length === 0) {
        gantt.eachTask((task: any) => { task._critical = false; });
        return;
    }

    // Intentar usar el plugin oficial primero
    try {
        if (typeof gantt.isCriticalTask === 'function') {
            gantt.eachTask((task: any) => {
                task._critical = gantt.isCriticalTask(task);
            });
            return;
        }
    } catch (_) { /* plugin no disponible, usar fallback */ }

    // ── Fallback: trazado manual hacia atrás ─────────────────────────────────
    let maxEnd: Date | null = null;

    // Encontrar la fecha de fin más tardía entre tareas hoja
    gantt.eachTask((task: any) => {
        if (!gantt.hasChild(task.id) && task.end_date) {
            const d = new Date(task.end_date);
            if (!maxEnd || d > maxEnd) maxEnd = d;
        }
    });

    if (!maxEnd) return;

    const criticalIds = new Set<any>();

    // Trazar hacia atrás desde cada tarea que termine en la fecha máxima
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
//
// Recorre el árbol y asigna:
//   - task.counter: número secuencial global (1, 2, 3…)
//   - task.item: código WBS jerárquico ("01", "01.02", "01.02.01"…)
//               respetando originalItem si fue importado del presupuesto
// ─────────────────────────────────────────────────────────────────────────────
export function updateCountersAndItems(): void {
    let counter = 1; // se resetea correctamente en cada invocación

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
// Recorre la tarea y todos sus descendientes para encontrar
// la fecha de inicio más temprana y la de fin más tardía.
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
// VALIDAR LÍMITES DE PROYECTO
// Verifica que una tarea no esté fuera del rango [projectStart, projectEnd].
// Si lo está, la corrige y devuelve true para indicar que hubo cambio.
// ─────────────────────────────────────────────────────────────────────────────
export function enforceProjectBounds(taskId: any): boolean {
    const projectStart = gantt.config.start_date;
    const projectEnd   = gantt.config.end_date;

    // Si no hay límites configurados o es tarea padre, no hacer nada
    if (!projectStart || !projectEnd) return false;

    let task: any;
    try { task = gantt.getTask(taskId); } catch { return false; }
    if (gantt.hasChild(taskId)) return false;

    let changed = false;

    // Inicio antes del comienzo del proyecto → mover al inicio
    if (task.start_date && new Date(task.start_date) < new Date(projectStart)) {
        task.start_date = new Date(projectStart);
        task.end_date = gantt.calculateEndDate({
            start_date: task.start_date,
            duration: task.duration || 1,
            task,
        });
        changed = true;
    }

    // Fin después del final del proyecto → recortar al límite
    if (task.end_date && new Date(task.end_date) > new Date(projectEnd)) {
        task.end_date = new Date(projectEnd);
        const newDuration = gantt.calculateDuration({
            start_date: task.start_date,
            end_date: task.end_date,
            task,
        });
        if (newDuration > 0) task.duration = newDuration;
        changed = true;
    }

    return changed;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-SCHEDULING SEGURO
//
// Llama a gantt.autoSchedule() solo si hay tareas y el gantt está listo.
// Antes de llamarlo, ajusta tareas raíz sin link que estén antes del
// inicio del proyecto para que no queden en fechas pasadas.
// ─────────────────────────────────────────────────────────────────────────────
export function applyAutoScheduling(): void {
    try {
        const tasks = gantt.getTaskByTime();
        if (tasks.length === 0) return;

        const state        = gantt.getState();
        const projectStart = state.min_date ? new Date(state.min_date) : null;

        if (projectStart) {
            gantt.batchUpdate(() => {
                gantt.eachTask((task: any) => {
                    // Solo tareas raíz sin predecesoras
                    const hasIncomingLink = gantt
                        .getLinks()
                        .some((l: any) => String(l.target) === String(task.id));

                    if (!task.parent && !hasIncomingLink && task.start_date < projectStart) {
                        task.start_date = new Date(projectStart);
                        task.end_date = gantt.calculateEndDate({
                            start_date: task.start_date,
                            duration: task.duration || 1,
                            task,
                        });
                        gantt.updateTask(task.id);
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