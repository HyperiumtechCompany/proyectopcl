import { useMemo } from 'react';
import dayjs from 'dayjs';
import type { GanttTask } from '../types/task';

export interface CriticalPathResult {
    criticalIds: Set<number>;
    floatByTask: Map<number, number>;
}

type CriticalEdge = {
    fromId: number;
    toId: number;
    tipo: string;
    lag: number;
    synthetic?: boolean;
};

function relationUsesFinish(tipo: string): boolean {
    return tipo === 'FC' || tipo === 'FF';
}

export function computeCriticalPath(tasks: GanttTask[]): CriticalPathResult {
    const valid = tasks.filter(
        (t) => t.fecha_inicio && t.fecha_fin && t.duracion_dias > 0,
    );
    if (!valid.length) return { criticalIds: new Set(), floatByTask: new Map() };

    const taskMap = new Map(valid.map((t) => [t.id, t]));
    const itemOrderToId = new Map(valid.map((t) => [t.item_order, t.id]));
    const resolveTaskId = (taskRef: number): number | null => {
        const byOrder = itemOrderToId.get(taskRef);
        if (byOrder !== undefined) return byOrder;
        return taskMap.has(taskRef) ? taskRef : null;
    };

    const groupIds = new Set<number>();
    const childrenByParent = new Map<number, GanttTask[]>();
    for (const t of valid) {
        if (t.parent_id === null) continue;
        groupIds.add(t.parent_id);
        const children = childrenByParent.get(t.parent_id) ?? [];
        children.push(t);
        childrenByParent.set(t.parent_id, children);
    }

    const isSameOrDescendant = (taskId: number, ancestorId: number): boolean => {
        let current = taskMap.get(taskId);
        while (current) {
            if (current.id === ancestorId) return true;
            if (current.parent_id === null) return false;
            current = taskMap.get(current.parent_id);
        }
        return false;
    };

    const collectDescendants = (
        task: GanttTask,
        excludeAncestorId?: number,
    ): GanttTask[] => {
        const descendants: GanttTask[] = [];
        for (const child of childrenByParent.get(task.id) ?? []) {
            if (
                excludeAncestorId !== undefined &&
                isSameOrDescendant(child.id, excludeAncestorId)
            ) {
                continue;
            }
            descendants.push(child);
            descendants.push(...collectDescendants(child, excludeAncestorId));
        }
        return descendants;
    };

    const collectEndpointDrivers = (
        task: GanttTask,
        endpoint: 'start' | 'finish',
        expectedDate: string,
        excludeAncestorId?: number,
    ): number[] => {
        const descendants = collectDescendants(task, excludeAncestorId);
        if (!descendants.length) return [];

        const drivers: number[] = [];
        for (const child of descendants) {
            const childDate =
                endpoint === 'finish' ? child.fecha_fin : child.fecha_inicio;
            if (childDate !== expectedDate) continue;

            drivers.push(child.id);
        }

        if (drivers.length) return drivers;

        const fallbackDate = descendants
            .map((child) =>
                endpoint === 'finish' ? child.fecha_fin : child.fecha_inicio,
            )
            .filter((date): date is string => Boolean(date))
            .sort((a, b) =>
                endpoint === 'finish' ? b.localeCompare(a) : a.localeCompare(b),
            )[0];

        if (!fallbackDate) return [];

        return descendants
            .filter((child) =>
                endpoint === 'finish'
                    ? child.fecha_fin === fallbackDate
                    : child.fecha_inicio === fallbackDate,
            )
            .map((child) => child.id);
    };

    const epochStr = valid.reduce(
        (min, t) => (t.fecha_inicio! < min ? t.fecha_inicio! : min),
        valid[0].fecha_inicio!,
    );
    const toDay = (d: string) => dayjs(d).diff(dayjs(epochStr), 'day');

    const EF = new Map<number, number>();
    for (const t of valid) {
        EF.set(t.id, toDay(t.fecha_fin!));
    }
    const projectEnd = Math.max(...EF.values());

    const successorsOf = new Map<number, CriticalEdge[]>();
    const incomingByTask = new Map<number, CriticalEdge[]>();
    const addEdge = (edge: CriticalEdge) => {
        if (edge.fromId === edge.toId) return;
        successorsOf.set(edge.fromId, [
            ...(successorsOf.get(edge.fromId) ?? []),
            edge,
        ]);
        incomingByTask.set(edge.toId, [
            ...(incomingByTask.get(edge.toId) ?? []),
            edge,
        ]);
    };

    for (const t of valid) {
        for (const pred of t.predecesoras) {
            const predId = resolveTaskId(pred.taskId);
            if (predId === null || !taskMap.has(predId)) continue;

            const edge = {
                fromId: predId,
                toId: t.id,
                tipo: pred.tipo,
                lag: pred.lag,
            };
            addEdge(edge);

            const predTask = taskMap.get(predId)!;
            if (!groupIds.has(predId)) continue;

            const endpoint = relationUsesFinish(pred.tipo) ? 'finish' : 'start';
            const expectedDate =
                endpoint === 'finish'
                    ? predTask.fecha_fin!
                    : predTask.fecha_inicio!;

            for (const driverId of collectEndpointDrivers(
                predTask,
                endpoint,
                expectedDate,
                isSameOrDescendant(t.id, predId) ? t.id : undefined,
            )) {
                addEdge({ ...edge, fromId: driverId, synthetic: true });
            }
        }
    }

    const inDeg = new Map(
        valid.map((t) => [t.id, incomingByTask.get(t.id)?.length ?? 0]),
    );

    const q: number[] = [];
    for (const [id, d] of inDeg) {
        if (d === 0) q.push(id);
    }

    const topo: number[] = [];
    while (q.length) {
        const id = q.shift()!;
        topo.push(id);
        for (const { toId } of successorsOf.get(id) ?? []) {
            const nd = (inDeg.get(toId) ?? 1) - 1;
            inDeg.set(toId, nd);
            if (nd === 0) q.push(toId);
        }
    }

    if (topo.length < valid.length) {
        const inTopo = new Set(topo);
        for (const t of valid) {
            if (!inTopo.has(t.id)) topo.push(t.id);
        }
    }

    const LF = new Map(valid.map((t) => [t.id, projectEnd]));

    for (const id of [...topo].reverse()) {
        const t = taskMap.get(id)!;
        const d = t.duracion_dias;
        let lf = LF.get(id)!;

        for (const { toId, tipo, lag } of successorsOf.get(id) ?? []) {
            const succLF = LF.get(toId);
            if (succLF === undefined) continue;
            const succD = taskMap.get(toId)!.duracion_dias;

            if (tipo === 'FC') lf = Math.min(lf, succLF - succD - lag);
            else if (tipo === 'CC') lf = Math.min(lf, succLF - succD - lag + d);
            else if (tipo === 'FF') lf = Math.min(lf, succLF - lag);
            else if (tipo === 'CF') lf = Math.min(lf, succLF - lag + d - 1);
        }
        LF.set(id, lf);
    }

    const floatByTask = new Map<number, number>();
    const criticalIds = new Set<number>();

    for (const t of valid) {
        const tf = LF.get(t.id)! - EF.get(t.id)!;
        floatByTask.set(t.id, tf);
        if (tf <= 0) criticalIds.add(t.id);
    }

    let changed = true;
    while (changed) {
        changed = false;
        for (const edges of incomingByTask.values()) {
            for (const edge of edges) {
                if (!criticalIds.has(edge.toId)) continue;
                if (!edge.synthetic && !criticalIds.has(edge.fromId)) continue;
                if (criticalIds.has(edge.fromId)) continue;

                criticalIds.add(edge.fromId);
                changed = true;
            }
        }
    }

    return { criticalIds, floatByTask };
}

export function useGanttCriticalPath(tasks: GanttTask[]): CriticalPathResult {
    return useMemo(() => computeCriticalPath(tasks), [tasks]);
}
