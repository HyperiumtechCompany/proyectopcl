import Decimal from 'decimal.js';
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

it('redondea la cantidad calculada del insumo a cuatro decimales', () => {
    expect(calculateInsumoUsage(7.333, 0.0667, 23.17)).toEqual({
        cantidad: 0.4891,
        parcial: 11.33,
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

it('calcula cada insumo de forma directa e independiente (cantidad × precio), sin anclarlo a un total externo aunque el ACU esté desincronizado del presupuesto', () => {
    // Antes, el reparto proporcional anclaba el monto total de la partida al
    // precio_unitario guardado en el presupuesto (2.82) en vez del costo_unitario_total
    // del ACU (2.90), y luego REPARTÍA ese monto fijo entre Oficial y Peón según su peso
    // — distorsionando el monto individual de cada uno para forzar la reconciliación.
    // Ahora cada insumo se calcula de forma independiente: cantidad física (metrado ×
    // cantidad ACU, redondeada a 4 decimales) × precio, redondeado a 2 decimales. El
    // desfase entre el ACU y el presupuesto ya no contamina el monto de los insumos.
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

    const rawInsumos = flattenInsumos(acus, delphinRows);
    const oficial = rawInsumos.find((row) => row.descripcion === 'Oficial');
    const peon = rawInsumos.find((row) => row.descripcion === 'Peón');

    expect(oficial).toMatchObject(calculateInsumoUsage(789.81, 0.0334, 22.19));
    expect(peon).toMatchObject(calculateInsumoUsage(789.81, 0.0334, 20.08));

    // Invariante clave: cantidad × precio (redondeado a 2 decimales) es EXACTAMENTE
    // el monto — ninguna redistribución entre insumos de la misma partida.
    for (const row of [oficial!, peon!]) {
        const cantidadPorPrecio = new Decimal(row.cantidad).times(row.precio).toDecimalPlaces(2).toNumber();
        expect(row.parcial).toBe(cantidadPorPrecio);
    }
});

it('el monto de un insumo es exactamente cantidad × precio (caso reportado: Oficial hh a 22.19)', () => {
    // Bug reportado: 51.2129 (cantidad) × 22.19 (precio) = 1,136.414251 → 1,136.41,
    // pero el reparto proporcional anterior mostraba 1,136.36 para ese insumo — una
    // diferencia de 0.05 causada por redistribuir el monto de la partida entre insumos
    // en vez de calcular cada uno de forma directa.
    const delphinRows = [
        { id: 1, partida: '01.01', metrado: 51.2129 },
    ] as DelphinRow[];
    const acus = [
        {
            id: 51,
            partida: '01.01',
            descripcion: 'Partida de referencia',
            unidad: 'hh',
            rendimiento: 1,
            costo_mano_obra: 1136.41,
            costo_materiales: 0,
            costo_equipos: 0,
            costo_subcontratos: 0,
            costo_subpartidas: 0,
            costo_unitario_total: 1136.41,
            mano_de_obra: [
                { descripcion: 'Oficial', unidad: 'hh', cantidad: 1, precio_unitario: 22.19 },
            ],
            materiales: [],
            equipos: [],
            subcontratos: [],
            subpartidas: [],
        },
    ] as ACURowSummary[];

    const [oficial] = flattenInsumos(acus, delphinRows);

    expect(oficial.cantidad).toBe(51.2129);
    expect(oficial.precio).toBe(22.19);
    expect(oficial.parcial).toBe(1136.41);
});

it('el precio de referencia consolidado siempre coincide con el precio real del insumo en el ACU, aunque el reparto proporcional distorsione el Monto', () => {
    // Bug reportado: en el ACU, Capataz cuesta 27.54 y Electricista 23.46, pero al
    // abrir Insumos Consolidados el precio mostrado para Capataz salía en 27.59 —
    // el reparto proporcional (que ajusta "Monto" para reconciliar con Costo
    // Directo) se filtraba también al precio de referencia. El precio mostrado
    // debe ser siempre el real (cantidad × precio_unitario crudo), sin importar
    // cómo se reparta el monto total de la partida.
    const delphinRows = [
        { id: 1, partida: '01.01', metrado: 20, precio_unitario: 3.45 },
    ] as DelphinRow[];
    const acus = [
        {
            id: 41,
            partida: '01.01',
            descripcion: 'Cuadrilla',
            unidad: 'hh',
            rendimiento: 1,
            costo_mano_obra: 3.42,
            costo_materiales: 0,
            costo_equipos: 0,
            costo_subcontratos: 0,
            costo_subpartidas: 0,
            costo_unitario_total: 3.42,
            mano_de_obra: [
                { descripcion: 'Capataz', unidad: 'hh', cantidad: 0.067, precio_unitario: 27.54 },
                { descripcion: 'Electricista', unidad: 'hh', cantidad: 0.067, precio_unitario: 23.46 },
            ],
            materiales: [],
            equipos: [],
            subcontratos: [],
            subpartidas: [],
        },
    ] as ACURowSummary[];

    const consolidated = consolidateInsumos(flattenInsumos(acus, delphinRows), {});
    const capataz = consolidated.find((row) => row.descripcion === 'Capataz');
    const electricista = consolidated.find((row) => row.descripcion === 'Electricista');

    expect(capataz?.precio).toBeCloseTo(27.54, 6);
    expect(electricista?.precio).toBeCloseTo(23.46, 6);
});
