import { describe, expect, it } from 'vitest';
import { sortInsumos, sumInsumoTotals } from './InsumosConsolidadosModal';

const rows = [
    { descripcion: 'Zinc', codigo: '10', cantidad: 2, parcial: 40, usos: 1 },
    { descripcion: 'Árido', codigo: '2', cantidad: 8, parcial: 20, usos: 3 },
    { descripcion: 'Cemento', codigo: '1', cantidad: 4, parcial: 60, usos: 2 },
];

describe('sortInsumos', () => {
    it('ordena texto alfabeticamente sin distinguir tildes y usa orden natural para codigos', () => {
        expect(
            sortInsumos(rows, { key: 'descripcion', direction: 'asc' }).map(
                (row) => row.descripcion,
            ),
        ).toEqual(['Árido', 'Cemento', 'Zinc']);
        expect(
            sortInsumos(rows, { key: 'codigo', direction: 'asc' }).map(
                (row) => row.codigo,
            ),
        ).toEqual(['1', '2', '10']);
    });

    it.each(['cantidad', 'parcial', 'usos'] as const)(
        'ordena %s en ambas direcciones',
        (key) => {
            const ascending = sortInsumos(rows, { key, direction: 'asc' }).map(
                (row) => row[key],
            );
            const descending = sortInsumos(rows, {
                key,
                direction: 'desc',
            }).map((row) => row[key]);

            expect(ascending).toEqual(
                [...ascending].sort((first, second) => first - second),
            );
            expect(descending).toEqual([...ascending].reverse());
        },
    );
});

it('suma los subtotales de todas las categorias', () => {
    expect(sumInsumoTotals([{ total: 120.5 }, { total: 80 }, { total: 49.5 }, { total: 50 }, { total: 200 }])).toBe(500);
});
