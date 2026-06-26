import { describe, expect, it } from 'vitest';
import type { DelphinRow } from '../types';
import { resolveParentsWithSyntheticFill } from './useDelphinData';

function row(partida: string, id: number): DelphinRow {
    return {
        id,
        parent_id: null,
        nivel: partida.split('.').length,
        item_order: 0,
        partida,
        descripcion: `Partida ${partida}`,
        duracion_dias: 0,
        fecha_inicio: null,
        fecha_fin: null,
        avance: 0,
        predecesoras: [],
        presupuesto: 10,
        unidad: 'und',
        metrado: 1,
        precio_unitario: 10,
        parcial: 10,
    };
}

describe('resolveParentsWithSyntheticFill', () => {
    it('fills missing sibling partida codes with zero values', () => {
        const { augmentedRows, createdPartidas } =
            resolveParentsWithSyntheticFill(
                [row('1.1.3.4.2.3', -1), row('1.1.3.4.2.5', -2)],
                new Map(),
                -3,
            );

        const inserted = augmentedRows.find(
            (item) => item.partida === '1.1.3.4.2.4',
        );

        expect(inserted).toMatchObject({
            descripcion: '1.1.3.4.2.4',
            unidad: '',
            metrado: 0,
            precio_unitario: 0,
            parcial: 0,
            presupuesto: 0,
        });
        expect(inserted?.parent_id).toBe(
            augmentedRows.find((item) => item.partida === '1.1.3.4.2')?.id,
        );
        expect(createdPartidas).toContain('1.1.3.4.2.4');
    });
});
