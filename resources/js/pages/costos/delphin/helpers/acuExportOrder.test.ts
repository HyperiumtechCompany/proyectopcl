import { describe, expect, it } from 'vitest';
import type { DelphinRow } from '../types';
import { orderAcusForExport } from './acuExportOrder';

const row = (id: number, partida: string): DelphinRow => ({ id, partida } as DelphinRow);

describe('orden de ACUs exportados', () => {
    it('respeta el orden visible del presupuesto y normaliza partidas con padding', () => {
        const acus = [
            { id: 35, partida: '03.05', descripcion: 'ACU 3.5' },
            { id: 11, partida: '01.01', descripcion: 'ACU 1.1' },
            { id: 22, partida: '02.01', descripcion: 'ACU 2.1' },
        ];
        const rows = [row(1, '1'), row(2, '1.1'), row(3, '2.1'), row(4, '3.5')];

        const result = orderAcusForExport(acus, rows);

        expect(result.map(({ acu }) => acu.id)).toEqual([11, 22, 35]);
        expect(result.map(({ item }) => item)).toEqual([1, 2, 3]);
        expect(result.map(({ partidaDisplay }) => partidaDisplay)).toEqual(['1.1', '2.1', '3.5']);
    });

    it('omite ACUs fuera de la rama filtrada', () => {
        const result = orderAcusForExport(
            [{ partida: '01.01' }, { partida: '03.05' }],
            [row(1, '1.1')],
        );

        expect(result).toHaveLength(1);
        expect(result[0].partidaDisplay).toBe('1.1');
    });
});
