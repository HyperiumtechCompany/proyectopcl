import { describe, expect, it } from 'vitest';
import type { GanttTask } from '../types/task';
import { findCircularPredecessors } from './predecessorCycles';

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

describe('findCircularPredecessors', () => {
    it('flags a child that lists its own parent group as predecessor', () => {
        const tasks: GanttTask[] = [
            task({ id: 10, item_order: 1, descripcion: 'SEGURIDAD Y SALUD' }),
            task({
                id: 11,
                parent_id: 10,
                item_order: 2,
                descripcion: 'CAPACITACION',
                predecesoras: [{ taskId: 1, tipo: 'CC', lag: 0 }],
            }),
        ];

        const issues = findCircularPredecessors(tasks);

        expect(issues).toHaveLength(1);
        expect(issues[0].taskId).toBe(11);
        expect(issues[0].ancestorId).toBe(10);
    });

    it('flags a child that lists a grandparent group as predecessor', () => {
        const tasks: GanttTask[] = [
            task({ id: 1, item_order: 1, descripcion: 'GRUPO RAIZ' }),
            task({ id: 2, parent_id: 1, item_order: 2, descripcion: 'SUBGRUPO' }),
            task({
                id: 3,
                parent_id: 2,
                item_order: 3,
                descripcion: 'HOJA',
                predecesoras: [{ taskId: 1, tipo: 'CC', lag: 0 }],
            }),
        ];

        const issues = findCircularPredecessors(tasks);

        expect(issues).toHaveLength(1);
        expect(issues[0].ancestorId).toBe(1);
    });

    it('does not flag a predecessor link to a summary that is not an ancestor', () => {
        const tasks: GanttTask[] = [
            task({ id: 20, item_order: 1, descripcion: 'DEMOLICIONES' }),
            task({ id: 21, parent_id: 20, item_order: 2, descripcion: 'Hijo demoliciones' }),
            task({
                id: 22,
                item_order: 3,
                descripcion: 'CORTE EN TERRENO NORMAL',
                predecesoras: [{ taskId: 1, tipo: 'FC', lag: 0 }],
            }),
        ];

        expect(findCircularPredecessors(tasks)).toHaveLength(0);
    });

    it('does not flag a normal sibling predecessor', () => {
        const tasks: GanttTask[] = [
            task({ id: 1, item_order: 1, descripcion: 'Tarea A' }),
            task({
                id: 2,
                item_order: 2,
                descripcion: 'Tarea B',
                predecesoras: [{ taskId: 1, tipo: 'FC', lag: 0 }],
            }),
        ];

        expect(findCircularPredecessors(tasks)).toHaveLength(0);
    });
});
