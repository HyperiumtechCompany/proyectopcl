import { describe, expect, it } from 'vitest';
import type { GanttTask } from '../../cronogramas/v2/types/task';
import { renumberPartidas } from './renumberPartidas';

function task(id: number, parent_id: number | null, partida: string, descripcion = ''): GanttTask {
    return {
        id, parent_id, partida, descripcion, nivel: 1, item_order: 0, duracion_dias: 1,
        fecha_inicio: null, fecha_fin: null, avance: 0, predecesoras: [], presupuesto: 0,
    };
}

describe('renumberPartidas', () => {
    it('renumbers a new parent created above an imported S10 branch (Modulo II > ESTRUCTURAS)', () => {
        const tasks = [
            task(-1, null, '02', 'Modulo II'),
            task(10, -1, '02.01', 'ESTRUCTURAS'),
            task(11, 10, '02.01.01', 'OBRAS PROVISIONALES'),
            task(12, 11, '02.01.01.01', 'OFICINA'),
            task(13, 11, '02.01.01.02', 'ALMACÉN'),
            task(14, 10, '02.01.02', 'CONCRETO'),
        ];

        const codes = new Map(renumberPartidas(tasks).map((u) => [u.id, u.partida]));
        expect(Object.fromEntries(codes)).toEqual({
            [-1]: '01', 10: '01.01', 11: '01.01.01', 12: '01.01.01.01', 13: '01.01.01.02', 14: '01.01.02',
        });
    });

    it('closes gaps and duplicates between siblings, and returns only the rows that change', () => {
        const tasks = [
            task(1, null, '01', 'Modulo I'),
            task(2, null, '01', 'Modulo II'),
            task(3, 2, '01.05', 'A'),
            task(4, 2, '01.07', 'B'),
        ];
        expect(renumberPartidas(tasks)).toEqual([
            { id: 2, partida: '02' },
            { id: 3, partida: '02.01' },
            { id: 4, partida: '02.02' },
        ]);
    });

    it('keeps the unpadded style when the tree does not use leading zeros', () => {
        const tasks = [task(1, null, '4', 'SANITARIAS'), task(2, 1, '4.1', 'APARATOS'), task(3, null, '2', 'ELÉCTRICAS')];
        expect(renumberPartidas(tasks)).toEqual([
            { id: 1, partida: '1' },
            { id: 2, partida: '1.1' },
        ]);
    });
});
