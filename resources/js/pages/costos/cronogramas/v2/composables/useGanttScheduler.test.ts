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

    it('resolves the predecessor by refId even when item_order shifted', () => {
        // La predecesora se creó apuntando a la fila 1 (item_order 1, id 10).
        // Luego se agregó una partida arriba y ahora esa fila es item_order 2.
        // El vínculo legado (taskId: 1) resolvería a la fila equivocada; refId no.
        const result = applySchedule(
            [
                task({
                    id: 99,
                    item_order: 1,
                    duracion_dias: 1,
                    fecha_inicio: '2026-06-01',
                    fecha_fin: '2026-06-01',
                }),
                task({
                    id: 10,
                    item_order: 2,
                    duracion_dias: 3,
                    fecha_inicio: '2026-06-10',
                    fecha_fin: '2026-06-12',
                }),
                task({
                    id: 20,
                    item_order: 3,
                    duracion_dias: 2,
                    fecha_inicio: '2026-06-11',
                    fecha_fin: '2026-06-12',
                    // taskId apunta al Nº viejo (1 = ahora la fila id 99), refId al real
                    predecesoras: [
                        { taskId: 1, refId: 10, tipo: 'FC', lag: 0 },
                    ],
                }),
            ],
            10,
            undefined,
            'automatic',
        );

        // Debe alinearse al fin de la fila id 10 (12 jun) + 1 → 15 jun, no a la id 99
        expect(result.find((item) => item.id === 20)).toMatchObject({
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
