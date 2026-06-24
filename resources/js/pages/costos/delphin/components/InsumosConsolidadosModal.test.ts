import { describe, expect, it } from 'vitest';
import type { ACURowSummary } from '@/types/presupuestos';
import type { DelphinRow } from '../types';
import {
    calculateInsumoUsage,
    calculateReferencePrice,
    consolidateInsumos,
    flattenInsumos,
    getSpecialtyAcus,
    sortInsumos,
    sumInsumoTotals,
} from './InsumosConsolidadosModal';

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
    expect(
        sumInsumoTotals([
            { total: 120.5 },
            { total: 80 },
            { total: 49.5 },
            { total: 50 },
            { total: 200 },
        ]),
    ).toBe(500);
});

it('calcula la cantidad y el monto del insumo usando el metrado del presupuesto', () => {
    expect(calculateInsumoUsage(25, 0.64, 29.1)).toEqual({
        cantidad: 16,
        parcial: 465.6,
    });
});

it('mantiene el precio real de referencia sin derivarlo de parciales redondeados', () => {
    expect(
        calculateReferencePrice([
            { cantidad: 3200.25, precio: 29.1 },
            { cantidad: 1031.8007, precio: 29.1 },
        ]),
    ).toBeCloseTo(29.1, 10);
});

it('filtra una especialidad incluyendo todos los ACU descendientes', () => {
    const delphinRows = [
        { id: 1, parent_id: null, partida: '01', descripcion: 'Arquitectura' },
        { id: 2, parent_id: 1, partida: '01.01', descripcion: 'Muros' },
        { id: 3, parent_id: 2, partida: '01.01.01', descripcion: 'Ladrillo' },
        { id: 4, parent_id: null, partida: '02', descripcion: 'Electricas' },
        { id: 5, parent_id: 4, partida: '02.01', descripcion: 'Cableado' },
    ] as DelphinRow[];
    const acus = [
        { partida: '01.01.01' },
        { partida: '02.01' },
    ] as ACURowSummary[];

    expect(
        getSpecialtyAcus(acus, delphinRows, 1).map((acu) => acu.partida),
    ).toEqual(['01.01.01']);
});

it('conserva las partidas de origen al consolidar un insumo', () => {
    const delphinRows = [
        { id: 1, partida: '01.01', metrado: 10 },
        { id: 2, partida: '01.02', metrado: 5 },
    ] as DelphinRow[];
    const acus = [
        {
            id: 11,
            partida: '01.01',
            descripcion: 'Muro de ladrillo',
            unidad: 'm2',
            rendimiento: 1,
            costo_mano_obra: 0,
            costo_materiales: 6,
            costo_equipos: 0,
            costo_subcontratos: 0,
            costo_subpartidas: 0,
            costo_unitario_total: 6,
            materiales: [
                {
                    descripcion: 'Cemento',
                    unidad: 'kg',
                    cantidad: 2,
                    precio_unitario: 3,
                },
            ],
            mano_de_obra: [],
            equipos: [],
            subcontratos: [],
            subpartidas: [],
        },
        {
            id: 12,
            partida: '01.02',
            descripcion: 'Tarrajeo',
            unidad: 'm2',
            rendimiento: 1,
            costo_mano_obra: 0,
            costo_materiales: 12,
            costo_equipos: 0,
            costo_subcontratos: 0,
            costo_subpartidas: 0,
            costo_unitario_total: 12,
            materiales: [
                {
                    descripcion: 'Cemento',
                    unidad: 'kg',
                    cantidad: 4,
                    precio_unitario: 3,
                },
            ],
            mano_de_obra: [],
            equipos: [],
            subcontratos: [],
            subpartidas: [],
        },
    ] as ACURowSummary[];

    const [cemento] = consolidateInsumos(flattenInsumos(acus, delphinRows), {});

    expect(cemento.references.map((reference) => reference.partida)).toEqual([
        '01.01',
        '01.02',
    ]);
    expect(
        cemento.references.map((reference) => reference.cantidadTotal),
    ).toEqual([20, 20]);
});
