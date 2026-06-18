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
import type { ParsePresupuestoResult } from '../helpers/parsePresupuestoExcel';

interface Options {
    initialTasks: GanttTask[];
    initialRows: any[];
    schedulingMode: SchedulingMode;
    calendarSettings: CalendarSettings;
}

function normalizeForMatch(s: string): string {
    return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// When cronograma is empty but presupuesto has data, synthesize GanttTask skeletons
// so the budget tree is still visible. CPM fields (dates, duration) default to empty.
function synthesizeTasksFromRows(rows: any[]): GanttTask[] {
    const partidaToId = new Map<string, number>(
        rows.map((r: any) => [String(r.partida ?? ''), Number(r.id)]),
    );
    return rows.map((row: any) => {
        const partida = String(row.partida ?? '');
        const nivelFromPartida = partida !== '' ? partida.split('.').length : 1;
        const nivel = Number(row.nivel ?? 0) || nivelFromPartida;
        let parentId: number | null = row.parent_id ?? null;
        if (!parentId && partida.includes('.')) {
            const parts = partida.split('.');
            parts.pop();
            parentId = partidaToId.get(parts.join('.')) ?? null;
        }
        return {
            id:            Number(row.id),
            parent_id:     parentId,
            nivel,
            item_order:    Number(row.item_order ?? 0),
            partida,
            descripcion:   String(row.descripcion ?? ''),
            duracion_dias: 0,
            fecha_inicio:  null,
            fecha_fin:     null,
            avance:        0,
            predecesoras:  [],
            presupuesto:   Number(row.parcial ?? 0),
        } as GanttTask;
    });
}

export function useDelphinData({ initialTasks, initialRows, schedulingMode, calendarSettings }: Options) {
    // If cronograma is empty but presupuesto has rows, build synthetic tasks so
    // the budget panel is visible. CPM data will be blank until the user fills it.
    const effectiveTasks: GanttTask[] =
        initialTasks.length > 0 || initialRows.length === 0
            ? initialTasks
            : synthesizeTasksFromRows(initialRows);

    // ── Budget state keyed by gantt task ID ────────────────────────────────────
    const [budgetMap, setBudgetMap] = useState<Map<number, BudgetFields>>(() => {
        const map = new Map<number, BudgetFields>();
        for (const task of effectiveTasks) {
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
    const ganttState = useGanttTasks(effectiveTasks, schedulingMode, calendarSettings);

    // ── Pending budget from Excel import (partida or desc → BudgetFields) ─────
    const pendingBudgetRef = useRef<Map<string, BudgetFields> | null>(null);

    // Stable refs so callbacks always read the latest tasks/budget without
    // needing them as useCallback deps (avoids stale-closure bugs).
    const latestTasksRef  = useRef(ganttState.tasks);
    const latestBudgetRef = useRef(budgetMap);
    latestTasksRef.current  = ganttState.tasks;
    latestBudgetRef.current = budgetMap;

    // ── Sync budget entries when tasks are added/removed ──────────────────────
    const prevTaskIdsRef = useRef(new Set(initialTasks.map((t) => t.id)));

    useEffect(() => {
        const currentIds = new Set(ganttState.tasks.map((t) => t.id));

        // ── Excel import: apply pending budget keyed by partida ───────────────
        if (pendingBudgetRef.current) {
            const pending = pendingBudgetRef.current;
            pendingBudgetRef.current = null;
            const next = new Map<number, BudgetFields>();
            ganttState.tasks.forEach((t) => {
                next.set(
                    t.id,
                    pending.get(t.partida) ??
                    pending.get(normalizeForMatch(t.descripcion)) ??
                    defaultBudget(),
                );
            });
            setBudgetMap(next);
            setBudgetDirty(true);
            prevTaskIdsRef.current = currentIds;
            return;
        }

        // ── Normal sync: only fill in newly added rows with defaults ──────────
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

    // ── Merged rows for display (with hierarchical parcial sums) ─────────────
    const delphinRows = useMemo<DelphinRow[]>(() => {
        const raw = ganttState.tasks.map((task) => ({
            ...task,
            ...(budgetMap.get(task.id) ?? defaultBudget()),
        }));

        // Bottom-up aggregation: group nodes = sum of children; leaves keep their own parcial
        const gids = ganttState.groupIds;
        const parcialMap = new Map<number, number>();
        for (const row of raw) {
            parcialMap.set(row.id, gids.has(row.id) ? 0 : (row.parcial ?? 0));
        }
        for (let i = raw.length - 1; i >= 0; i--) {
            const row = raw[i];
            if (row.parent_id != null) {
                const pid = Number(row.parent_id);
                if (parcialMap.has(pid)) {
                    parcialMap.set(pid, (parcialMap.get(pid) ?? 0) + (parcialMap.get(row.id) ?? 0));
                }
            }
        }

        return raw.map((row) => {
            const computed = Math.round((parcialMap.get(row.id) ?? row.parcial) * 100) / 100;
            return computed === row.parcial ? row : { ...row, parcial: computed };
        });
    }, [ganttState.tasks, budgetMap, ganttState.groupIds]);

    // Visible subset re-uses the already-computed hierarchical parcials from delphinRows
    const visibleDelphinRows = useMemo<DelphinRow[]>(() => {
        const parcialById = new Map(delphinRows.map((r) => [r.id, r.parcial]));
        return ganttState.visibleTasks.map((task) => ({
            ...task,
            ...(budgetMap.get(task.id) ?? defaultBudget()),
            parcial: parcialById.get(task.id) ?? 0,
        }));
    }, [ganttState.visibleTasks, budgetMap, delphinRows]);

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
                        item_order:      task.item_order,
                        // presupuesto_general uses partida notation for hierarchy,
                        // not parent_id/nivel — omit to avoid column-not-found 500
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

    // ── Bulk import from Excel (Presupuesto General) ──────────────────────────
    const importDelphinRows = useCallback(
        ({ rows }: ParsePresupuestoResult) => {
            const existingTasks = latestTasksRef.current;
            // CPM data exists when any task has a start date, positive duration, or predecessors
            const hasCpmData =
                existingTasks.length > 0 &&
                existingTasks.some(
                    (t) => !!t.fecha_inicio || (t.duracion_dias ?? 0) > 0 || (t.predecesoras?.length ?? 0) > 0,
                );

            if (!hasCpmData) {
                // No CPM data to preserve — full replace (original behavior)
                const budgetByPartida = new Map<string, BudgetFields>();
                const tasks: GanttTask[] = rows.map(({ unidad, metrado, precio_unitario, parcial, ...task }) => {
                    budgetByPartida.set(task.partida, { unidad, metrado, precio_unitario, parcial });
                    return task as GanttTask;
                });
                pendingBudgetRef.current = budgetByPartida;
                ganttState.importTasks(tasks);
                return;
            }

            // CPM data exists — only update budget columns for matched rows;
            // do NOT touch the gantt task tree so dates/predecessors are preserved.
            const byPartida = new Map(existingTasks.map((t) => [t.partida, t.id]));
            const byDesc    = new Map(existingTasks.map((t) => [normalizeForMatch(t.descripcion), t.id]));

            setBudgetMap((prev) => {
                const next = new Map(prev);
                for (const row of rows) {
                    const existingId =
                        byPartida.get(row.partida) ??
                        byDesc.get(normalizeForMatch(row.descripcion));
                    if (existingId !== undefined) {
                        next.set(existingId, {
                            unidad:          row.unidad,
                            metrado:         row.metrado,
                            precio_unitario: row.precio_unitario,
                            parcial:         row.parcial,
                        });
                    }
                }
                return next;
            });
            setBudgetDirty(true);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [ganttState.importTasks],
    );

    // ── Import Cronograma (MS Project XML) with budget preservation ───────────
    // When budget data already exists, the incoming tasks are matched by partida
    // (exact) then by normalized description (fallback) so that budget fields
    // survive the import instead of being wiped out.
    const importCronogramaTasks = useCallback(
        (newTasks: GanttTask[]) => {
            const existingTasks = latestTasksRef.current;
            const currentBudget = latestBudgetRef.current;
            const hasBudget = existingTasks.some((t) => {
                const b = currentBudget.get(t.id);
                return b && (b.metrado > 0 || b.precio_unitario > 0 || !!b.unidad);
            });

            if (!hasBudget) {
                ganttState.importTasks(newTasks);
                return;
            }

            // Build pending budget keyed by BOTH partida and normalized description.
            // After importTasks → recomputeHierarchy regenerates partida codes; the
            // useEffect will try partida first, then description as fallback.
            const pending = new Map<string, BudgetFields>();
            for (const t of existingTasks) {
                const b = currentBudget.get(t.id);
                if (!b) continue;
                if (t.partida) pending.set(t.partida, b);
                const desc = normalizeForMatch(t.descripcion);
                if (desc && !pending.has(desc)) pending.set(desc, b);
            }

            pendingBudgetRef.current = pending;
            ganttState.importTasks(newTasks);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [ganttState.importTasks],
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
        addTaskAfter:  ganttState.addTaskAfter,
        addChildTask:  ganttState.addChildTask,
        deleteTask:    ganttState.deleteTask,
        indentTask:    ganttState.indentTask,
        outdentTask:   ganttState.outdentTask,
        moveTaskUp:    ganttState.moveTaskUp,
        moveTaskDown:  ganttState.moveTaskDown,
        duplicateTask: ganttState.duplicateTask,
        saveTasks:            ganttState.saveTasks,
        applyBarMove:         ganttState.applyBarMove,
        importTasks:          ganttState.importTasks,
        importDelphinRows,
        importCronogramaTasks,
    };
}
