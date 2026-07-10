import { describe, expect, it } from 'vitest';
import type { GanttTask } from '../types/task';
import { computeCriticalPath } from './useGanttCriticalPath';

function task(overrides: Partial<GanttTask>): GanttTask {
    return {
        id: 0,
        parent_id: null,
        nivel: 1,
        item_order: 0,
        partida: '',
        descripcion: '',
        duracion_dias: 1,
        fecha_inicio: null,
        fecha_fin: null,
        avance: 0,
        predecesoras: [],
        presupuesto: 0,
        ...overrides,
    };
}

describe('computeCriticalPath', () => {
    it('continues the critical chain through the child that drives a summary predecessor', () => {
        const { criticalIds } = computeCriticalPath([
            task({
                id: 1,
                item_order: 1,
                duracion_dias: 5,
                fecha_inicio: '2026-08-13',
                fecha_fin: '2026-08-17',
            }),
            task({
                id: 2,
                item_order: 2,
                duracion_dias: 3,
                fecha_inicio: '2026-08-18',
                fecha_fin: '2026-08-20',
                predecesoras: [{ taskId: 1, tipo: 'FC', lag: 0 }],
            }),
            task({
                id: 3,
                item_order: 3,
                duracion_dias: 16,
                fecha_inicio: '2026-08-13',
                fecha_fin: '2026-08-28',
            }),
            task({
                id: 4,
                parent_id: 3,
                item_order: 4,
                duracion_dias: 8,
                fecha_inicio: '2026-08-13',
                fecha_fin: '2026-08-20',
                predecesoras: [{ taskId: 2, tipo: 'FC', lag: 0 }],
            }),
            task({
                id: 5,
                parent_id: 3,
                item_order: 5,
                duracion_dias: 5,
                fecha_inicio: '2026-08-24',
                fecha_fin: '2026-08-28',
                predecesoras: [{ taskId: 3, tipo: 'FC', lag: 0 }],
            }),
        ]);

        expect([...criticalIds].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    });

    it('resolves imported predecessor references by database id as a fallback', () => {
        const { criticalIds } = computeCriticalPath([
            task({
                id: 100,
                item_order: 1,
                duracion_dias: 2,
                fecha_inicio: '2026-07-01',
                fecha_fin: '2026-07-02',
            }),
            task({
                id: 200,
                item_order: 2,
                duracion_dias: 2,
                fecha_inicio: '2026-07-03',
                fecha_fin: '2026-07-04',
                predecesoras: [{ taskId: 100, tipo: 'FC', lag: 0 }],
            }),
        ]);

        expect(criticalIds.has(100)).toBe(true);
        expect(criticalIds.has(200)).toBe(true);
    });
});
