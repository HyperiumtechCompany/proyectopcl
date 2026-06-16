import { useMemo } from 'react';
import dayjs from 'dayjs';
import type { GanttTask } from '../types/task';

export interface CriticalPathResult {
    criticalIds: Set<number>;
    floatByTask: Map<number, number>;
}

function computeCriticalPath(tasks: GanttTask[]): CriticalPathResult {
    const valid = tasks.filter(t => t.fecha_inicio && t.fecha_fin && t.duracion_dias > 0);
    if (!valid.length) return { criticalIds: new Set(), floatByTask: new Map() };

    // taskMap indexado por id de BD
    const taskMap = new Map(valid.map(t => [t.id, t]));

    // pred.taskId es item_order (Nº de fila) — necesitamos traducirlo a id de BD
    const itemOrderToId = new Map(valid.map(t => [t.item_order, t.id]));

    const epochStr = valid.reduce(
        (min, t) => (t.fecha_inicio! < min ? t.fecha_inicio! : min),
        valid[0].fecha_inicio!,
    );
    const toDay = (d: string) => dayjs(d).diff(dayjs(epochStr), 'day');

    const ES = new Map<number, number>();
    const EF = new Map<number, number>();
    for (const t of valid) {
        ES.set(t.id, toDay(t.fecha_inicio!));
        EF.set(t.id, toDay(t.fecha_fin!));
    }
    const projectEnd = Math.max(...EF.values());

    // successorsOf keyed by id de BD (no item_order)
    const successorsOf = new Map<number, Array<{ taskId: number; tipo: string; lag: number }>>();
    for (const t of valid) {
        for (const pred of t.predecesoras) {
            const predId = itemOrderToId.get(pred.taskId);
            if (predId === undefined || !taskMap.has(predId)) continue;
            if (!successorsOf.has(predId)) successorsOf.set(predId, []);
            successorsOf.get(predId)!.push({ taskId: t.id, tipo: pred.tipo, lag: pred.lag });
        }
    }

    // ── Orden topológico (Kahn) ──────────────────────────────────────────────
    const inDeg = new Map(valid.map(t => [
        t.id,
        t.predecesoras.filter(p => {
            const predId = itemOrderToId.get(p.taskId);
            return predId !== undefined && taskMap.has(predId);
        }).length,
    ]));

    const q: number[] = [];
    for (const [id, d] of inDeg) { if (d === 0) q.push(id); }
    const topo: number[] = [];
    while (q.length) {
        const id = q.shift()!;
        topo.push(id);
        for (const { taskId } of (successorsOf.get(id) ?? [])) {
            const nd = (inDeg.get(taskId) ?? 1) - 1;
            inDeg.set(taskId, nd);
            if (nd === 0) q.push(taskId);
        }
    }
    if (topo.length < valid.length) {
        const inTopo = new Set(topo);
        for (const t of valid) { if (!inTopo.has(t.id)) topo.push(t.id); }
    }

    // ── Backward pass: Late Finish ────────────────────────────────────────────
    // FC:  LF[pred] ≤ LS[succ] - lag        = LF[succ] - d[succ] - lag
    // CC:  LF[pred] ≤ LS[succ] - lag + d[pred] = LF[succ] - d[succ] - lag + d[pred]
    // FF:  LF[pred] ≤ LF[succ] - lag
    // CF:  LF[pred] ≤ LF[succ] - lag + d[pred] - 1  (succ termina cuando pred comienza)
    const LF = new Map(valid.map(t => [t.id, projectEnd]));

    for (const id of [...topo].reverse()) {
        const t = taskMap.get(id)!;
        const d = t.duracion_dias;
        let lf = LF.get(id)!;

        for (const { taskId, tipo, lag } of (successorsOf.get(id) ?? [])) {
            const succLF = LF.get(taskId);
            if (succLF === undefined) continue;
            const succD = taskMap.get(taskId)!.duracion_dias;

            if      (tipo === 'FC') lf = Math.min(lf, succLF - succD - lag);
            else if (tipo === 'CC') lf = Math.min(lf, succLF - succD - lag + d);
            else if (tipo === 'FF') lf = Math.min(lf, succLF - lag);
            else if (tipo === 'CF') lf = Math.min(lf, succLF - lag + d - 1);
        }
        LF.set(id, lf);
    }

    // ── Float y ruta crítica ──────────────────────────────────────────────────
    const floatByTask = new Map<number, number>();
    const criticalIds = new Set<number>();

    for (const t of valid) {
        const tf = LF.get(t.id)! - EF.get(t.id)!;
        floatByTask.set(t.id, tf);
        if (tf <= 0) criticalIds.add(t.id);
    }

    return { criticalIds, floatByTask };
}

export function useGanttCriticalPath(tasks: GanttTask[]): CriticalPathResult {
    return useMemo(() => computeCriticalPath(tasks), [tasks]);
}
