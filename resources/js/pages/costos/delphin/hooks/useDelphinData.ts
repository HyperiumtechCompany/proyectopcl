import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGanttTasks } from '../../cronogramas/v2/composables/useGanttTasks';
import type { GanttCalendarSettings as CalendarSettings } from '../../cronogramas/v2/types/calendar';
import type { GanttTask, SchedulingMode } from '../../cronogramas/v2/types/task';
import {
    BUDGET_FIELD_KEYS,
    defaultBudget,
    type BudgetFields,
    type DelphinRow,
} from '../types';

interface Options {
    initialTasks: GanttTask[];
    initialRows: any[];
    schedulingMode: SchedulingMode;
    calendarSettings: CalendarSettings;
}

export function useDelphinData({ initialTasks, initialRows, schedulingMode, calendarSettings }: Options) {
    // ── Budget state keyed by gantt task ID ────────────────────────────────────
    const [budgetMap, setBudgetMap] = useState<Map<number, BudgetFields>>(() => {
        const map = new Map<number, BudgetFields>();
        for (const task of initialTasks) {
            const br = initialRows.find((r) => r.partida === task.partida);
            map.set(task.id, {
                unidad:          br?.unidad          ?? '',
                metrado:         +(br?.metrado        ?? 0),
                precio_unitario: +(br?.precio_unitario ?? 0),
                parcial:         +(br?.parcial         ?? 0),
            });
        }
        return map;
    });
    const [budgetDirty,    setBudgetDirty]    = useState(false);
    const [isSavingBudget, setIsSavingBudget] = useState(false);

    // ── Gantt state ────────────────────────────────────────────────────────────
    const ganttState = useGanttTasks(initialTasks, schedulingMode, calendarSettings);

    // ── Sync budget entries when tasks are added/removed ──────────────────────
    const prevTaskIdsRef = useRef(new Set(initialTasks.map((t) => t.id)));

    useEffect(() => {
        const currentIds = new Set(ganttState.tasks.map((t) => t.id));
        const additions: number[] = [];
        currentIds.forEach((id) => {
            if (!prevTaskIdsRef.current.has(id)) additions.push(id);
        });
        if (additions.length > 0) {
            setBudgetMap((prev) => {
                const next = new Map(prev);
                additions.forEach((id) => { if (!next.has(id)) next.set(id, defaultBudget()); });
                return next;
            });
        }
        prevTaskIdsRef.current = currentIds;
    }, [ganttState.tasks]);

    // ── Merged rows for display ────────────────────────────────────────────────
    const delphinRows = useMemo<DelphinRow[]>(
        () => ganttState.tasks.map((task) => ({ ...task, ...(budgetMap.get(task.id) ?? defaultBudget()) })),
        [ganttState.tasks, budgetMap],
    );

    const visibleDelphinRows = useMemo<DelphinRow[]>(
        () => ganttState.visibleTasks.map((task) => ({ ...task, ...(budgetMap.get(task.id) ?? defaultBudget()) })),
        [ganttState.visibleTasks, budgetMap],
    );

    // ── Update budget field ────────────────────────────────────────────────────
    const updateBudgetField = useCallback((id: number, field: string, value: any) => {
        setBudgetMap((prev) => {
            const next = new Map(prev);
            const cur  = next.get(id) ?? defaultBudget();
            const upd  = { ...cur, [field]: value };
            if (field === 'metrado' || field === 'precio_unitario') {
                upd.parcial = +(upd.metrado * upd.precio_unitario).toFixed(2);
            }
            next.set(id, upd);
            return next;
        });
        setBudgetDirty(true);
    }, []);

    // ── Unified commitField ───────────────────────────────────────────────────
    const commitField = useCallback(
        (id: number, field: string, value: any) => {
            if (BUDGET_FIELD_KEYS.has(field)) {
                updateBudgetField(id, field, value);
            } else {
                ganttState.updateField(id, field as keyof GanttTask, value);
            }
        },
        [updateBudgetField, ganttState],
    );

    // ── Save budget ───────────────────────────────────────────────────────────
    const saveBudget = useCallback(
        async (projectId: number): Promise<boolean> => {
            setIsSavingBudget(true);
            try {
                const rows = ganttState.tasks.map((task) => {
                    const b = budgetMap.get(task.id) ?? defaultBudget();
                    return {
                        id:              task.id,
                        partida:         task.partida,
                        descripcion:     task.descripcion,
                        unidad:          b.unidad,
                        metrado:         b.metrado,
                        precio_unitario: b.precio_unitario,
                        parent_id:       task.parent_id,
                        nivel:           task.nivel,
                        item_order:      task.item_order,
                    };
                });
                await axios.patch(`/costos/proyectos/${projectId}/presupuesto/general`, { rows });
                setBudgetDirty(false);
                return true;
            } catch {
                return false;
            } finally {
                setIsSavingBudget(false);
            }
        },
        [ganttState.tasks, budgetMap],
    );

    return {
        delphinRows,
        visibleDelphinRows,
        budgetDirty,
        isSavingBudget,
        saveBudget,
        commitField,
        tasks:        ganttState.tasks,
        visibleTasks: ganttState.visibleTasks,
        taskById:     ganttState.taskById,
        groupIds:     ganttState.groupIds,
        expandedIds:  ganttState.expandedIds,
        isDirty:      ganttState.isDirty,
        isSaving:     ganttState.isSaving,
        updateField:  ganttState.updateField,
        toggleExpand: ganttState.toggleExpand,
        expandAll:    ganttState.expandAll,
        collapseAll:  ganttState.collapseAll,
        addTaskAfter: ganttState.addTaskAfter,
        addChildTask: ganttState.addChildTask,
        deleteTask:   ganttState.deleteTask,
        indentTask:   ganttState.indentTask,
        outdentTask:  ganttState.outdentTask,
        saveTasks:    ganttState.saveTasks,
        applyBarMove: ganttState.applyBarMove,
        importTasks:  ganttState.importTasks,
    };
}
