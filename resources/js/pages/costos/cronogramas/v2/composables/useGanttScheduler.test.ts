import { describe, expect, it } from 'vitest';
import type { GanttTask } from '../types/task';
import { applySchedule } from './useGanttScheduler';

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

describe('applySchedule scheduling modes', () => {
    it('updates linked successors in automatic mode', () => {
        const result = applySchedule(
            [
                task({
                    id: 1,
                    item_order: 1,
                    duracion_dias: 3,
                    fecha_inicio: '2026-06-10',
                    fecha_fin: '2026-06-12',
                }),
                task({
                    id: 2,
                    item_order: 2,
                    duracion_dias: 2,
                    fecha_inicio: '2026-06-11',
                    fecha_fin: '2026-06-12',
                    predecesoras: [{ taskId: 1, tipo: 'FC', lag: 0 }],
                }),
            ],
            1,
            undefined,
            'automatic',
        );

        expect(result.find((item) => item.id === 2)).toMatchObject({
            fecha_inicio: '2026-06-15',
            fecha_fin: '2026-06-16',
        });
    });

    it('keeps linked successors unchanged in manual mode', () => {
        const result = applySchedule(
            [
                task({
                    id: 1,
                    item_order: 1,
                    duracion_dias: 3,
                    fecha_inicio: '2026-06-10',
                    fecha_fin: '2026-06-12',
                }),
                task({
                    id: 2,
                    item_order: 2,
                    duracion_dias: 2,
                    fecha_inicio: '2026-06-11',
                    fecha_fin: '2026-06-12',
                    predecesoras: [{ taskId: 1, tipo: 'FC', lag: 0 }],
                }),
            ],
            1,
            undefined,
            'manual',
        );

        expect(result.find((item) => item.id === 2)).toMatchObject({
            fecha_inicio: '2026-06-11',
            fecha_fin: '2026-06-12',
        });
    });
});
