import { describe, expect, it } from 'vitest';
import type { ACURowSummary } from '@/types/presupuestos';
import type { DelphinRow } from '../types';
import { calculateAcuLocally } from '../../presupuesto/hooks/usePresupuestoAcu';
import {
    applyConsolidatedPrice,
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

it('reconcilia el total de insumos consolidados con el costo directo de la partida (metrado × costo ACU), aun con valores que no dividen parejo', () => {
    const delphinRows = [
        { id: 1, partida: '01.01', metrado: 7.333 },
    ] as DelphinRow[];
    const acus = [
        {
            id: 21,
            partida: '01.01',
            descripcion: 'Partida con residuo de redondeo',
            unidad: 'm2',
            rendimiento: 1,
            costo_mano_obra: 1.55,
            costo_materiales: 1.43,
            costo_equipos: 0,
            costo_subcontratos: 0,
            costo_subpartidas: 0,
            costo_unitario_total: 2.98,
            mano_de_obra: [
                { descripcion: 'Peón', unidad: 'hh', cantidad: 0.0667, precio_unitario: 23.17 },
            ],
            materiales: [
                { descripcion: 'Cemento', unidad: 'kg', cantidad: 0.35, precio_unitario: 4.1 },
            ],
            equipos: [],
            subcontratos: [],
            subpartidas: [],
        },
    ] as ACURowSummary[];

    const rawInsumos = flattenInsumos(acus, delphinRows);
    const sumaInsumos = rawInsumos.reduce((sum, row) => sum + row.parcial, 0);

    // Mismo criterio de redondeo que Costo Directo (metrado × costo, a 2 decimales).
    const costoDirectoPartida = Math.round(7.333 * 2.98 * 100) / 100;

    expect(sumaInsumos).toBeCloseTo(costoDirectoPartida, 2);
});

it('ancla el reparto al precio_unitario YA GUARDADO en el presupuesto, no al costo_unitario_total del ACU, cuando quedaron desincronizados', () => {
    // Escenario real reportado: el panel de ACU recalculó localmente (rendimiento/
    // horas por día) y su costo_unitario_total (2.90) ya no coincide con el
    // precio_unitario que sigue guardado en la fila del presupuesto (2.82), que
    // es el que realmente determina Costo Directo.
    const delphinRows = [
        { id: 1, partida: '01.01', metrado: 789.81, precio_unitario: 2.82 },
    ] as DelphinRow[];
    const acus = [
        {
            id: 31,
            partida: '01.01',
            descripcion: 'Partida desincronizada',
            unidad: 'hh',
            rendimiento: 1,
            costo_mano_obra: 2.90, // desactualizado respecto al presupuesto
            costo_materiales: 0,
            costo_equipos: 0,
            costo_subcontratos: 0,
            costo_subpartidas: 0,
            costo_unitario_total: 2.90,
            mano_de_obra: [
                { descripcion: 'Oficial', unidad: 'hh', cantidad: 0.0334, precio_unitario: 22.19 },
                { descripcion: 'Peón', unidad: 'hh', cantidad: 0.0334, precio_unitario: 20.08 },
            ],
            materiales: [],
            equipos: [],
            subcontratos: [],
            subpartidas: [],
        },
    ] as ACURowSummary[];

    const sumaInsumos = flattenInsumos(acus, delphinRows).reduce((sum, row) => sum + row.parcial, 0);
    const costoDirectoPartida = Math.round(789.81 * 2.82 * 100) / 100;

    expect(sumaInsumos).toBeCloseTo(costoDirectoPartida, 2);
});

describe('applyConsolidatedPrice + reflujo por localSaveAcu', () => {
    // Reproduce el flujo real: DelphinView clona los ACUs afectados con
    // applyConsolidatedPrice, los pasa por calculateAcuLocally (igual que
    // localSaveAcu) y actualiza delphinRows.precio_unitario (igual que
    // commitField) antes de que el modal vuelva a correr flattenInsumos.
    const buildScene = () => {
        const delphinRows = [
            { id: 1, partida: '01.01', metrado: 10, precio_unitario: 50.15 },
        ] as DelphinRow[];

        const acus = [
            {
                id: 100,
                partida: '01.01',
                descripcion: 'Encofrado',
                unidad: 'm2',
                rendimiento: 1,
                costo_mano_obra: 0,
                costo_materiales: 0,
                costo_equipos: 50.15,
                costo_subcontratos: 0,
                costo_subpartidas: 0,
                costo_unitario_total: 50.15,
                mano_de_obra: [],
                materiales: [],
                equipos: [
                    { descripcion: 'ANDAMIO METALICO', unidad: 'hm', cantidad: 5, precio_hora: 10.03 },
                ],
                subcontratos: [],
                subpartidas: [],
            },
        ] as ACURowSummary[];

        return { delphinRows, acus };
    };

    it('el P.REF. inicial refleja el precio_hora bruto del componente', () => {
        const { delphinRows, acus } = buildScene();
        const [andamio] = consolidateInsumos(flattenInsumos(acus, delphinRows), {});
        expect(andamio.precio).toBeCloseTo(10.03, 2);
    });

    it('tras aplicar el nuevo precio y refluir por localSaveAcu + commitField, el P.REF. muestra el precio nuevo', () => {
        const { delphinRows, acus } = buildScene();
        const [andamio] = consolidateInsumos(flattenInsumos(acus, delphinRows), {});

        const updatedAcuClones = applyConsolidatedPrice(andamio, acus, 10);
        expect(updatedAcuClones).toHaveLength(1);

        // Igual que localSaveAcu: recalcula subtotales/total del ACU clonado.
        const calculated = calculateAcuLocally(updatedAcuClones[0]);
        const updatedAcu = { ...acus[0], ...calculated } as ACURowSummary;

        // Igual que handleApplyConsolidatedAcuChanges → commitField: sincroniza
        // el precio_unitario del presupuesto con el nuevo total del ACU.
        const updatedDelphinRows = delphinRows.map((row) =>
            row.partida === updatedAcu.partida
                ? { ...row, precio_unitario: updatedAcu.costo_unitario_total }
                : row,
        );

        const [andamioActualizado] = consolidateInsumos(
            flattenInsumos([updatedAcu], updatedDelphinRows),
            {},
        );

        expect(andamioActualizado.precio).toBeCloseTo(10, 2);
    });
});
