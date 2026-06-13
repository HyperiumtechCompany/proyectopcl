import { describe, expect, it } from 'vitest';
import type { GanttTask } from '../types/task';
import {
    getReservedTemporaryId,
    getVisibleTasks,
    recomputeHierarchy,
} from './useGanttTasks';

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

describe('recomputeHierarchy', () => {
    it('rolls up span (not sum) from grandchildren to children and parents', () => {
        // Nieto A: days 10–12 (3d), Nieto B: days 15–18 (4d)
        // They run non-consecutively — span is 10→18 = 9 days inclusive, NOT 3+4=7.
        const result = recomputeHierarchy([
            task({ id: 1, descripcion: 'Padre' }),
            task({ id: 2, parent_id: 1, descripcion: 'Hijo' }),
            task({
                id: 3,
                parent_id: 2,
                descripcion: 'Nieto A',
                duracion_dias: 3,
                fecha_inicio: '2026-06-10',
                fecha_fin: '2026-06-12',
            }),
            task({
                id: 4,
                parent_id: 2,
                descripcion: 'Nieto B',
                duracion_dias: 4,
                fecha_inicio: '2026-06-15',
                fecha_fin: '2026-06-18',
            }),
        ]);

        const parent = result.find((item) => item.id === 1);
        const child = result.find((item) => item.id === 2);

        expect(child).toMatchObject({
            fecha_inicio: '2026-06-10',
            fecha_fin: '2026-06-18',
            duracion_dias: 9,
            nivel: 2,
            partida: '1.1',
        });
        expect(parent).toMatchObject({
            fecha_inicio: '2026-06-10',
            fecha_fin: '2026-06-18',
            duracion_dias: 9,
            nivel: 1,
            partida: '1',
        });
    });

    it('normalizes accidental future centuries before calculating duration', () => {
        const result = recomputeHierarchy([
            task({ id: 1, descripcion: 'Padre' }),
            task({
                id: 2,
                parent_id: 1,
                descripcion: 'Hijo A',
                fecha_inicio: '2125-02-10',
                fecha_fin: '2125-02-10',
                duracion_dias: 36526,
            }),
            task({
                id: 3,
                parent_id: 1,
                descripcion: 'Hijo B',
                fecha_inicio: '2025-02-10',
                fecha_fin: '2025-03-01',
                duracion_dias: 20,
            }),
        ]);

        expect(result.find((item) => item.id === 2)).toMatchObject({
            fecha_inicio: '2025-02-10',
            fecha_fin: '2025-02-10',
            duracion_dias: 1,
        });
        // Span: 2025-02-10 → 2025-03-01 = 20 calendar days inclusive (NOT 1+20=21)
        expect(result.find((item) => item.id === 1)).toMatchObject({
            fecha_inicio: '2025-02-10',
            fecha_fin: '2025-03-01',
            duracion_dias: 20,
        });
    });

    it('falls back to sum of durations when no children have scheduled dates', () => {
        const result = recomputeHierarchy([
            task({ id: 1, descripcion: 'Padre' }),
            task({
                id: 2,
                parent_id: 1,
                descripcion: 'Hijo hoja',
                duracion_dias: 4,
            }),
            task({ id: 3, parent_id: 1, descripcion: 'Hijo grupo' }),
            task({
                id: 4,
                parent_id: 3,
                descripcion: 'Nieto hoja',
                duracion_dias: 6,
            }),
            task({ id: 5, parent_id: 3, descripcion: 'Nieto grupo' }),
            task({
                id: 6,
                parent_id: 5,
                descripcion: 'Bisnieto A',
                duracion_dias: 2,
            }),
            task({
                id: 7,
                parent_id: 5,
                descripcion: 'Bisnieto B',
                duracion_dias: 3,
            }),
        ]);

        expect(result.find((item) => item.id === 5)?.duracion_dias).toBe(5);
        expect(result.find((item) => item.id === 3)?.duracion_dias).toBe(11);
        expect(result.find((item) => item.id === 1)?.duracion_dias).toBe(15);
    });

    it('recomputes a 10k deep imported hierarchy without overflowing the stack', () => {
        const tasks = Array.from({ length: 10_000 }, (_, index) =>
            task({
                id: index + 1,
                parent_id: index === 0 ? null : index,
                duracion_dias: 1,
                fecha_inicio: '2026-06-10',
                fecha_fin: '2026-06-10',
            }),
        );

        const result = recomputeHierarchy(tasks);

        expect(result).toHaveLength(10_000);
        expect(result[0]).toMatchObject({
            id: 1,
            partida: '1',
            nivel: 1,
            item_order: 1,
            duracion_dias: 1,
            fecha_inicio: '2026-06-10',
            fecha_fin: '2026-06-10',
        });
        expect(result[9_999]).toMatchObject({
            id: 10_000,
            nivel: 10_000,
            item_order: 10_000,
        });
    });
});

describe('getVisibleTasks', () => {
    it('walks a 10k row hierarchy iteratively for expand and collapse', () => {
        const tasks = Array.from({ length: 10_000 }, (_, index) =>
            task({
                id: index + 1,
                parent_id: index === 0 ? null : index,
                nivel: index + 1,
                item_order: index + 1,
            }),
        );
        const expandedIds = new Set(tasks.map((item) => item.id));

        expect(
            getVisibleTasks(tasks, new Set()).map((item) => item.id),
        ).toEqual([1]);
        expect(getVisibleTasks(tasks, expandedIds)).toHaveLength(10_000);
    });
});

describe('getReservedTemporaryId', () => {
    it('reserves the next negative id below imported temporary task ids', () => {
        const importedTasks = Array.from({ length: 700 }, (_, index) =>
            task({ id: -(index + 1) }),
        );

        expect(getReservedTemporaryId(importedTasks)).toBe(-701);
    });
});
