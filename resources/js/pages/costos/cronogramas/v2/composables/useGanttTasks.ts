import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import type { GanttTask, Predecessor, SchedulingMode } from '../types/task';
import type { GanttCalendarSettings } from '../types/calendar';
import {
    addWorkingDays,
    diffWorkingDaysInclusive,
    nextWorkingDate,
} from '../types/calendar';
import { applySchedule, computeConstrainedDates } from './useGanttScheduler';
import { diffInclusiveDays, normalizeGanttDate } from '../utils/date';

// ─── Conversión DHTMLX ↔ V2 ─────────────────────────────────────────────────
const FROM_DHTMLX: Record<string, string> = {
    '0': 'FC',
    '1': 'CC',
    '2': 'FF',
    '3': 'CF',
};
const TO_DHTMLX: Record<string, string> = {
    FC: '0',
    CC: '1',
    FF: '2',
    CF: '3',
};

function parsePreds(raw: unknown): Predecessor[] {
    if (!raw) return [];
    const links: unknown[] =
        typeof raw === 'string' ? JSON.parse(raw) : (raw as unknown[]);
    if (!Array.isArray(links)) return [];
    // V2 format already
    if (links.length && (links[0] as any).taskId !== undefined)
        return links as Predecessor[];
    // DHTMLX format — task is target, source = predecessor
    return (links as any[]).map((l) => ({
        taskId: Number(l.source ?? 0),
        tipo: (FROM_DHTMLX[String(l.type ?? '0')] ??
            'FC') as Predecessor['tipo'],
        lag: Number(l.lag ?? 0),
    }));
}

function serializePreds(preds: Predecessor[], targetId: number): object[] {
    return preds.map((p) => ({
        source: p.taskId,
        target: targetId,
        type: TO_DHTMLX[p.tipo] ?? '0',
        lag: p.lag ?? 0,
    }));
}

function normalizeTaskDates(
    task: GanttTask,
    calendarSettings?: GanttCalendarSettings,
): GanttTask {
    const fecha_inicio = normalizeGanttDate(task.fecha_inicio);
    const fecha_fin = normalizeGanttDate(task.fecha_fin);
    const durationFromDates = calendarSettings
        ? diffWorkingDaysInclusive(fecha_inicio, fecha_fin, calendarSettings)
        : diffInclusiveDays(fecha_inicio, fecha_fin);
    const storedDuration = Math.max(1, Number(task.duracion_dias) || 0);
    const duracion_dias = calendarSettings
        ? storedDuration || durationFromDates || 1
        : (durationFromDates ?? storedDuration);

    if (calendarSettings && fecha_inicio) {
        const start = nextWorkingDate(fecha_inicio, calendarSettings);

        return {
            ...task,
            fecha_inicio: start,
            fecha_fin: addWorkingDays(start, duracion_dias, calendarSettings),
            duracion_dias,
        };
    }

    return {
        ...task,
        fecha_inicio,
        fecha_fin,
        duracion_dias,
    };
}

// ─── Recalcula partida, nivel e item_order en base a parent_id ───────────────
function recomputeOrder(taskList: GanttTask[]): GanttTask[] {
    const childrenOf = new Map<number | null, GanttTask[]>();
    taskList.forEach((t) => {
        if (!childrenOf.has(t.parent_id)) childrenOf.set(t.parent_id, []);
        childrenOf.get(t.parent_id)!.push(t);
    });

    const result: GanttTask[] = [];
    let counter = 0;

    const roots = childrenOf.get(null) ?? [];
    const stack = roots
        .map((task, index) => ({
            task,
            siblingIndex: index,
            parentPartida: '',
            nivel: 1,
        }))
        .reverse();

    while (stack.length > 0) {
        const { task, siblingIndex, parentPartida, nivel } = stack.pop()!;
        const partida = parentPartida
            ? `${parentPartida}.${siblingIndex + 1}`
            : String(siblingIndex + 1);
        result.push({ ...task, partida, nivel, item_order: ++counter });

        const children = childrenOf.get(task.id) ?? [];
        for (let index = children.length - 1; index >= 0; index--) {
            stack.push({
                task: children[index],
                siblingIndex: index,
                parentPartida: partida,
                nivel: nivel + 1,
            });
        }
    }

    return result;
}

export function recomputeHierarchy(
    taskList: GanttTask[],
    calendarSettings?: GanttCalendarSettings,
): GanttTask[] {
    const ordered = recomputeOrder(
        taskList.map((task) => normalizeTaskDates(task, calendarSettings)),
    );
    const taskById = new Map(ordered.map((t) => [t.id, { ...t }]));
    const childrenOf = new Map<number, GanttTask[]>();

    ordered.forEach((task) => {
        if (task.parent_id === null) return;
        if (!childrenOf.has(task.parent_id)) childrenOf.set(task.parent_id, []);
        childrenOf.get(task.parent_id)!.push(task);
    });

    for (let index = ordered.length - 1; index >= 0; index--) {
        const task = taskById.get(ordered[index].id)!;
        const children = childrenOf.get(task.id) ?? [];

        if (children.length === 0) {
            continue;
        }

        let sumDuration = 0;
        let fecha_inicio: string | null = null;
        let fecha_fin: string | null = null;

        for (const childRef of children) {
            const child = taskById.get(childRef.id) ?? childRef;
            sumDuration += Math.max(0, Number(child.duracion_dias) || 0);

            if (
                child.fecha_inicio &&
                (!fecha_inicio ||
                    dayjs(child.fecha_inicio).isBefore(fecha_inicio))
            ) {
                fecha_inicio = child.fecha_inicio;
            }

            if (
                child.fecha_fin &&
                (!fecha_fin || dayjs(child.fecha_fin).isAfter(fecha_fin))
            ) {
                fecha_fin = child.fecha_fin;
            }
        }

        // Delphin/S10 + MS Project: summary task duration = calendar-day span
        // from earliest child start to latest child end (NOT sum of children).
        // Calendar days match what MS Project displays for summary/group rows.
        // Fallback to sum only when no children have dates yet.
        let duracion_dias: number;
        if (fecha_inicio && fecha_fin) {
            const span = diffInclusiveDays(fecha_inicio, fecha_fin) ?? sumDuration;
            duracion_dias = Math.max(1, span);
        } else {
            duracion_dias = sumDuration;
        }

        const rolled =
            fecha_inicio && fecha_fin
                ? { ...task, fecha_inicio, fecha_fin, duracion_dias }
                : { ...task, duracion_dias };
        taskById.set(task.id, rolled);
    }

    return ordered.map((task) => taskById.get(task.id) ?? task);
}

function buildChildrenByParent(
    taskList: GanttTask[],
): Map<number | null, GanttTask[]> {
    const childrenByParent = new Map<number | null, GanttTask[]>();

    for (const task of taskList) {
        const siblings = childrenByParent.get(task.parent_id);
        if (siblings) {
            siblings.push(task);
        } else {
            childrenByParent.set(task.parent_id, [task]);
        }
    }

    return childrenByParent;
}

export function getVisibleTasks(
    taskList: GanttTask[],
    expandedIds: Set<number>,
    childrenByParent = buildChildrenByParent(taskList),
): GanttTask[] {
    const visible: GanttTask[] = [];
    const stack = [...(childrenByParent.get(null) ?? [])].reverse();

    while (stack.length > 0) {
        const task = stack.pop()!;
        visible.push(task);

        const children = childrenByParent.get(task.id);
        if (!children?.length || !expandedIds.has(task.id)) {
            continue;
        }

        for (let index = children.length - 1; index >= 0; index--) {
            stack.push(children[index]);
        }
    }

    return visible;
}

// ─── IDs temporales para filas nuevas ────────────────────────────────────────
let _tmpId = -1;
function nextTmpId() {
    return _tmpId--;
}

export function getReservedTemporaryId(
    taskList: GanttTask[],
    currentId = -1,
): number {
    const minTemporaryId = taskList.reduce(
        (min, task) => (task.id < min ? task.id : min),
        0,
    );

    return Math.min(currentId, minTemporaryId - 1);
}

function reserveTemporaryIds(taskList: GanttTask[]): void {
    _tmpId = getReservedTemporaryId(taskList, _tmpId);
}

// ─────────────────────────────────────────────────────────────────────────────
export function useGanttTasks(
    initialTasks: GanttTask[] = [],
    schedulingMode: SchedulingMode = 'automatic',
    calendarSettings?: GanttCalendarSettings,
) {
    const [tasks, setTasks] = useState<GanttTask[]>(() => {
        const initial = recomputeHierarchy(
            initialTasks.map((t) => ({
                ...t,
                predecesoras: parsePreds(t.predecesoras as any),
            })),
            calendarSettings,
        );
        reserveTemporaryIds(initial);

        return initial;
    });
    const [expandedIds, setExpandedIds] = useState<Set<number>>(() => {
        // Expandir primer nivel por defecto
        const firstLevelGroups = new Set<number>();
        const parentIds = new Set(
            initialTasks.map((t) => t.parent_id).filter(Boolean),
        );
        initialTasks.forEach((t) => {
            if (parentIds.has(t.id) && t.parent_id === null)
                firstLevelGroups.add(t.id);
        });
        return firstLevelGroups;
    });
    const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const didMountRef = useRef(false);

    useEffect(() => {
        if (!didMountRef.current) {
            didMountRef.current = true;
            return;
        }

        setTasks((prev) => {
            const next = recomputeHierarchy(prev, calendarSettings);
            setDirtyIds(new Set(next.map((task) => task.id)));
            return next;
        });
    }, [calendarSettings]);

    // ── Maps derivados ───────────────────────────────────────────────────────
    const taskById = useMemo(
        () => new Map(tasks.map((t) => [t.id, t])),
        [tasks],
    );

    const childrenByParent = useMemo(
        () => buildChildrenByParent(tasks),
        [tasks],
    );

    const groupIds = useMemo(() => {
        const ids = new Set<number>();
        childrenByParent.forEach((children, parentId) => {
            if (parentId !== null && children.length > 0) ids.add(parentId);
        });
        return ids;
    }, [childrenByParent]);

    // ── Tareas visibles (respeta collapse) ──────────────────────────────────
    const visibleTasks = useMemo((): GanttTask[] => {
        return getVisibleTasks(tasks, expandedIds, childrenByParent);
    }, [tasks, expandedIds, childrenByParent]);

    // ── Carga desde API ──────────────────────────────────────────────────────
    const loadTasks = useCallback(
        async (project: string) => {
            setIsLoading(true);
            try {
                const res = await axios.get<{ tasks: GanttTask[] }>(
                    `/cronograma/v2/${project}/tasks`,
                );
                const loaded = res.data.tasks.map((t) => ({
                    ...t,
                    predecesoras: parsePreds(t.predecesoras as any),
                }));
                setTasks(recomputeHierarchy(loaded, calendarSettings));
                const parentIds = new Set(
                    loaded.map((t) => t.parent_id).filter(Boolean),
                );
                setExpandedIds(
                    new Set(
                        loaded
                            .filter(
                                (t) =>
                                    parentIds.has(t.id) && t.parent_id === null,
                            )
                            .map((t) => t.id),
                    ),
                );
            } finally {
                setIsLoading(false);
            }
        },
        [calendarSettings],
    );

    // ── Expand / Collapse ────────────────────────────────────────────────────
    const toggleExpand = useCallback((id: number) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    const expandAll = useCallback(() => {
        setExpandedIds(
            new Set(tasks.filter((t) => groupIds.has(t.id)).map((t) => t.id)),
        );
    }, [tasks, groupIds]);

    const collapseAll = useCallback(() => setExpandedIds(new Set()), []);

    // ── Actualizar campo ─────────────────────────────────────────────────────
    const updateField = useCallback(
        <K extends keyof GanttTask>(
            id: number,
            field: K,
            value: GanttTask[K],
        ) => {
            setTasks((prev) => {
                const updated = prev.map((t) => {
                    if (t.id !== id) return t;
                    const normalizedValue =
                        field === 'fecha_inicio' || field === 'fecha_fin'
                            ? normalizeGanttDate(value as string | null)
                            : value;
                    const u: GanttTask = { ...t, [field]: normalizedValue };

                    // Linkeo automático duración ↔ inicio ↔ fin
                    if (field === 'duracion_dias') {
                        const dur = Number(value);
                        if (dur >= 1 && u.fecha_inicio) {
                            const start = nextWorkingDate(
                                u.fecha_inicio,
                                calendarSettings,
                            );
                            u.fecha_inicio = start;
                            u.fecha_fin = addWorkingDays(
                                start,
                                dur,
                                calendarSettings,
                            );
                        }
                    } else if (field === 'fecha_inicio') {
                        const ini = normalizedValue as string | null;
                        if (ini && u.duracion_dias >= 1) {
                            const start = nextWorkingDate(
                                ini,
                                calendarSettings,
                            );
                            u.fecha_inicio = start;
                            u.fecha_fin = addWorkingDays(
                                start,
                                u.duracion_dias,
                                calendarSettings,
                            );
                        }
                    } else if (field === 'fecha_fin') {
                        const fin = normalizedValue as string | null;
                        if (fin && u.fecha_inicio) {
                            const dur =
                                diffWorkingDaysInclusive(
                                    u.fecha_inicio,
                                    fin,
                                    calendarSettings,
                                ) ?? diffInclusiveDays(u.fecha_inicio, fin);
                            if (dur !== null) u.duracion_dias = dur;
                        }
                    }

                    return u;
                });

                // IDs de tareas que tienen hijos (corchetes); no se reposicionan
                const localGroupIds = new Set<number>();
                updated.forEach((t) => {
                    if (t.parent_id !== null) localGroupIds.add(t.parent_id);
                });

                if (
                    schedulingMode === 'automatic' &&
                    field === 'predecesoras' &&
                    !localGroupIds.has(id)
                ) {
                    // Alinear inmediatamente la tarea a sus nuevas predecesoras,
                    // luego cascada a los sucesores de esta tarea.
                    const task = updated.find((t) => t.id === id);
                    if (task) {
                        const taskMap = new Map(updated.map((t) => [t.id, t]));
                        // pred.taskId es item_order (Nº), no id de BD
                        const itemOrderToId = new Map(
                            updated.map((t) => [t.item_order, t.id]),
                        );
                        const constrained = computeConstrainedDates(
                            task,
                            taskMap,
                            itemOrderToId,
                            calendarSettings,
                        );
                        if (constrained) {
                            const aligned = updated.map((t) =>
                                t.id === id ? { ...t, ...constrained } : t,
                            );
                            return recomputeHierarchy(
                                applySchedule(
                                    aligned,
                                    id,
                                    localGroupIds,
                                    schedulingMode,
                                    calendarSettings,
                                ),
                                calendarSettings,
                            );
                        }
                    }
                }

                return recomputeHierarchy(
                    applySchedule(
                        updated,
                        id,
                        localGroupIds,
                        schedulingMode,
                        calendarSettings,
                    ),
                    calendarSettings,
                );
            });
            setDirtyIds((prev) => new Set([...prev, id]));
        },
        [calendarSettings, schedulingMode],
    );

    // ── Agregar fila después de afterId (sibling) ────────────────────────────
    const addTaskAfter = useCallback(
        (afterId: number | null): number => {
            const newId = nextTmpId();
            setTasks((prev) => {
                const afterIdx =
                    afterId !== null
                        ? prev.findIndex((t) => t.id === afterId)
                        : prev.length - 1;
                const afterTask = afterId !== null ? prev[afterIdx] : null;

                let insertIdx = afterIdx + 1;
                if (afterTask) {
                    while (
                        insertIdx < prev.length &&
                        prev[insertIdx].nivel > afterTask.nivel
                    )
                        insertIdx++;
                }

                const newTask: GanttTask = {
                    id: newId,
                    parent_id: afterTask?.parent_id ?? null,
                    nivel: afterTask?.nivel ?? 1,
                    item_order: 0,
                    partida: '',
                    descripcion: 'fila nueva',
                    duracion_dias: 1,
                    fecha_inicio: null,
                    fecha_fin: null,
                    avance: 0,
                    predecesoras: [],
                    presupuesto: 0,
                };

                return recomputeHierarchy(
                    [
                        ...prev.slice(0, insertIdx),
                        newTask,
                        ...prev.slice(insertIdx),
                    ],
                    calendarSettings,
                );
            });
            return newId;
        },
        [calendarSettings],
    );

    // ── Agregar hijo (último hijo del padre seleccionado) ────────────────────
    const addChildTask = useCallback(
        (parentId: number): number => {
            const newId = nextTmpId();
            setTasks((prev) => {
                const parentIdx = prev.findIndex((t) => t.id === parentId);
                if (parentIdx === -1) return prev;
                const parent = prev[parentIdx];

                // Insertar al final de los descendientes del padre
                let insertIdx = parentIdx + 1;
                while (
                    insertIdx < prev.length &&
                    prev[insertIdx].nivel > parent.nivel
                )
                    insertIdx++;

                const newTask: GanttTask = {
                    id: newId,
                    parent_id: parentId,
                    nivel: parent.nivel + 1,
                    item_order: 0,
                    partida: '',
                    descripcion: 'fila nueva',
                    duracion_dias: 1,
                    fecha_inicio: null,
                    fecha_fin: null,
                    avance: 0,
                    predecesoras: [],
                    presupuesto: 0,
                };

                setExpandedIds((p) => new Set([...p, parentId]));
                return recomputeHierarchy(
                    [
                        ...prev.slice(0, insertIdx),
                        newTask,
                        ...prev.slice(insertIdx),
                    ],
                    calendarSettings,
                );
            });
            return newId;
        },
        [calendarSettings],
    );

    // ── Eliminar fila + descendientes ────────────────────────────────────────
    const deleteTask = useCallback(
        (id: number) => {
            setTasks((prev) => {
                const idx = prev.findIndex((t) => t.id === id);
                if (idx === -1) return prev;
                let end = idx + 1;
                while (end < prev.length && prev[end].nivel > prev[idx].nivel)
                    end++;
                return recomputeHierarchy(
                    [...prev.slice(0, idx), ...prev.slice(end)],
                    calendarSettings,
                );
            });
            setDirtyIds((prev) => {
                const s = new Set(prev);
                s.delete(id);
                return s;
            });
        },
        [calendarSettings],
    );

    // ── Indentar (convertir en hijo del hermano anterior) ────────────────────
    const indentTask = useCallback(
        (id: number) => {
            setTasks((prev) => {
                const idx = prev.findIndex((t) => t.id === id);
                if (idx <= 0) return prev;
                const task = prev[idx];
                // Buscar hermano anterior al mismo nivel
                let sibIdx = idx - 1;
                while (sibIdx >= 0 && prev[sibIdx].nivel > task.nivel) sibIdx--;
                if (sibIdx < 0 || prev[sibIdx].nivel !== task.nivel)
                    return prev;
                const sib = prev[sibIdx];
                setExpandedIds((p) => new Set([...p, sib.id]));
                return recomputeHierarchy(
                    prev.map((t) =>
                        t.id === id ? { ...t, parent_id: sib.id } : t,
                    ),
                    calendarSettings,
                );
            });
            setDirtyIds((prev) => new Set([...prev, id]));
        },
        [calendarSettings],
    );

    // ── Outdentar (subir un nivel) ────────────────────────────────────────────
    const outdentTask = useCallback(
        (id: number) => {
            setTasks((prev) => {
                const task = prev.find((t) => t.id === id);
                if (!task || task.parent_id === null) return prev;
                const parent = prev.find((t) => t.id === task.parent_id)!;
                return recomputeHierarchy(
                    prev.map((t) =>
                        t.id === id ? { ...t, parent_id: parent.parent_id } : t,
                    ),
                    calendarSettings,
                );
            });
            setDirtyIds((prev) => new Set([...prev, id]));
        },
        [calendarSettings],
    );

    // ── Referencia al estado actual de tareas (para pre-generar IDs en duplicar) ─
    const tasksRef = useRef(tasks);
    useEffect(() => { tasksRef.current = tasks; }, [tasks]);

    // ── Mover fila hacia arriba (intercambiar con hermano anterior) ───────────
    const moveTaskUp = useCallback(
        (id: number) => {
            setTasks((prev) => {
                const idx = prev.findIndex((t) => t.id === id);
                if (idx <= 0) return prev;
                const task = prev[idx];

                // Fin del bloque actual (tarea + descendientes)
                let blockEnd = idx + 1;
                while (blockEnd < prev.length && prev[blockEnd].nivel > task.nivel) blockEnd++;

                // Inicio del hermano anterior: retroceder sobre descendientes
                let prevSibIdx = idx - 1;
                while (prevSibIdx >= 0 && prev[prevSibIdx].nivel > task.nivel) prevSibIdx--;
                if (prevSibIdx < 0 || prev[prevSibIdx].nivel !== task.nivel) return prev;

                const currBlock    = prev.slice(idx, blockEnd);
                const prevSibBlock = prev.slice(prevSibIdx, idx);

                return recomputeHierarchy([
                    ...prev.slice(0, prevSibIdx),
                    ...currBlock,
                    ...prevSibBlock,
                    ...prev.slice(blockEnd),
                ], calendarSettings);
            });
            setDirtyIds((prev) => new Set([...prev, id]));
        },
        [calendarSettings],
    );

    // ── Mover fila hacia abajo (intercambiar con hermano siguiente) ───────────
    const moveTaskDown = useCallback(
        (id: number) => {
            setTasks((prev) => {
                const idx = prev.findIndex((t) => t.id === id);
                if (idx === -1) return prev;
                const task = prev[idx];

                // Fin del bloque actual
                let blockEnd = idx + 1;
                while (blockEnd < prev.length && prev[blockEnd].nivel > task.nivel) blockEnd++;

                // El siguiente hermano empieza en blockEnd
                if (blockEnd >= prev.length || prev[blockEnd].nivel !== task.nivel) return prev;

                // Fin del bloque del hermano siguiente
                let nextSibEnd = blockEnd + 1;
                while (nextSibEnd < prev.length && prev[nextSibEnd].nivel > task.nivel) nextSibEnd++;

                const currBlock    = prev.slice(idx, blockEnd);
                const nextSibBlock = prev.slice(blockEnd, nextSibEnd);

                return recomputeHierarchy([
                    ...prev.slice(0, idx),
                    ...nextSibBlock,
                    ...currBlock,
                    ...prev.slice(nextSibEnd),
                ], calendarSettings);
            });
            setDirtyIds((prev) => new Set([...prev, id]));
        },
        [calendarSettings],
    );

    // ── Duplicar fila (+ descendientes) e insertar inmediatamente después ─────
    const duplicateTask = useCallback(
        (id: number): number => {
            // Pre-generar IDs fuera de setTasks para evitar efectos secundarios
            const currentTasks = tasksRef.current;
            const srcIdx = currentTasks.findIndex((t) => t.id === id);
            if (srcIdx === -1) return id;
            const srcTask = currentTasks[srcIdx];
            let srcEnd = srcIdx + 1;
            while (srcEnd < currentTasks.length && currentTasks[srcEnd].nivel > srcTask.nivel) srcEnd++;
            const blockSize = srcEnd - srcIdx;

            const newIds = Array.from({ length: blockSize }, () => nextTmpId());
            const newRootId = newIds[0];

            setTasks((prev) => {
                const idx = prev.findIndex((t) => t.id === id);
                if (idx === -1) return prev;
                const task = prev[idx];
                let end = idx + 1;
                while (end < prev.length && prev[end].nivel > task.nivel) end++;
                const block = prev.slice(idx, end);

                const idMap = new Map<number, number>();
                block.forEach((t, i) => { idMap.set(t.id, newIds[i] ?? nextTmpId()); });

                const duplicated = block.map((t) => ({
                    ...t,
                    id: idMap.get(t.id)!,
                    parent_id: t.parent_id !== null ? (idMap.get(t.parent_id) ?? t.parent_id) : null,
                    predecesoras: [],
                }));

                return recomputeHierarchy([
                    ...prev.slice(0, end),
                    ...duplicated,
                    ...prev.slice(end),
                ], calendarSettings);
            });

            setDirtyIds((prev) => new Set([...prev, newRootId]));
            return newRootId;
        },
        [calendarSettings],
    );

    // ── Mover / redimensionar barra con cascade ─────────────────────────────
    const applyBarMove = useCallback(
        (id: number, newStart: string, newDuration: number) => {
            setTasks((prev) => {
                const start = nextWorkingDate(newStart, calendarSettings);
                const fim = addWorkingDays(
                    start,
                    newDuration,
                    calendarSettings,
                );
                const updated = prev.map((t) =>
                    t.id === id
                        ? {
                              ...t,
                              fecha_inicio: start,
                              fecha_fin: fim,
                              duracion_dias: newDuration,
                          }
                        : t,
                );
                const localGroupIds = new Set<number>();
                updated.forEach((t) => {
                    if (t.parent_id !== null) localGroupIds.add(t.parent_id);
                });
                return recomputeHierarchy(
                    applySchedule(
                        updated,
                        id,
                        localGroupIds,
                        schedulingMode,
                        calendarSettings,
                    ),
                    calendarSettings,
                );
            });
            setDirtyIds((prev) => new Set([...prev, id]));
        },
        [calendarSettings, schedulingMode],
    );

    // ── Guardar en API ───────────────────────────────────────────────────────
    const saveTasks = useCallback(
        async (project: string): Promise<boolean> => {
            setIsSaving(true);
            try {
                const payload = tasks.map((t) => ({
                    ...t,
                    id: t.id > 0 ? t.id : null,
                    predecesoras: serializePreds(
                        t.predecesoras,
                        t.id > 0 ? t.id : 0,
                    ),
                }));
                await axios.post(`/cronograma/v2/${project}/save`, {
                    tasks: payload,
                });
                setDirtyIds(new Set());
                return true;
            } catch {
                return false;
            } finally {
                setIsSaving(false);
            }
        },
        [tasks],
    );

    // ── Importar tareas desde fuente externa (solo frontend) ─────────────────
    const importTasks = useCallback(
        (newTasks: GanttTask[]) => {
            const recomputed = recomputeHierarchy(
                newTasks.map((t) => ({
                    ...t,
                    predecesoras: Array.isArray(t.predecesoras)
                        ? t.predecesoras
                        : [],
                })),
                calendarSettings,
            );
            reserveTemporaryIds(recomputed);
            setTasks(recomputed);
            // Expandir todos los grupos por defecto
            const groupSet = new Set<number>();
            recomputed.forEach((t) => {
                if (t.parent_id !== null) groupSet.add(t.parent_id);
            });
            setExpandedIds(groupSet);
            setDirtyIds(new Set(recomputed.map((t) => t.id)));
        },
        [calendarSettings],
    );

    return {
        tasks,
        visibleTasks,
        taskById,
        groupIds,
        expandedIds,
        isLoading,
        isSaving,
        isDirty: dirtyIds.size > 0,
        loadTasks,
        updateField,
        toggleExpand,
        expandAll,
        collapseAll,
        addTaskAfter,
        addChildTask,
        deleteTask,
        indentTask,
        outdentTask,
        moveTaskUp,
        moveTaskDown,
        duplicateTask,
        saveTasks,
        applyBarMove,
        importTasks,
    };
}
