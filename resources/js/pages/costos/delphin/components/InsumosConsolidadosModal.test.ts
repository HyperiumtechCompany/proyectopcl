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

it('conserva 6 decimales en el parcial de un uso en vez de truncar a 2dp', () => {
    // Antes se truncaba cada uso a 2dp antes de sumar, perdiendo precision frente
    // a Costo Directo (que ya conserva 6dp desde la correccion del ACU). Caso real
    // documentado en la migracion 2026_07_02_000100: 1.48 en vez de 1.479333.
    const { parcial } = calculateInsumoUsage(1, 1, 1.479333);
    expect(parcial).toBeCloseTo(1.479333, 6);
    expect(parcial).not.toBe(1.48);
});

it('Costo Directo == Insumos Consolidados a escala, sin arrastrar redondeo por fila', () => {
    // Reproduce el reporte: con 1 partida/1 ACU la diferencia no se nota; al
    // escalar a cientos de partidas y miles de usos de insumo, redondear cada
    // fila a 2dp antes de sumar hace que Costo Directo e Insumos Consolidados
    // diverjan por unos centimos. Genera un dataset grande con precios "no
    // redondos" (deterministico, sin Math.random) y verifica que ambos caminos
    // de calculo cuadren exactamente al centimo.
    const N_PARTIDAS = 400;
    const ITEMS_POR_CATEGORIA = 4; // ~1200 items por categoria => ~4800 usos totales

    let seed = 7;
    const next = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };
    const nasty = (min: number, max: number) =>
        Math.round((min + next() * (max - min)) * 1e6) / 1e6;

    const round10 = (n: number) => new Decimal(n).toDecimalPlaces(10).toNumber();

    const delphinRows: DelphinRow[] = [];
    const acuRows: ACURowSummary[] = [];
    let costoDirectoTotal = new Decimal(0);

    for (let i = 0; i < N_PARTIDAS; i++) {
        const partida = String(i + 1);
        const metrado = nasty(1, 500);

        // Rangos realistas de un ACU de construccion: cantidad de insumo por
        // unidad de metrado (ej. kg de cemento por m2) y precio unitario en
        // soles — no magnitudes arbitrarias. Con esto costo_unitario_total
        // queda en el orden de cientos/pocos miles por unidad, como un ACU real.
        const buildItems = (withFactor: boolean) =>
            Array.from({ length: ITEMS_POR_CATEGORIA }, (_, j) => ({
                descripcion: `Insumo ${i}-${j}`,
                cod_insumo: `C${i}-${j}`,
                unidad: 'und',
                cantidad: nasty(0.01, 3),
                precio_unitario: nasty(0.5, 120),
                factor_desperdicio: withFactor ? nasty(1, 1.15) : 1,
            }));

        const manoDeObra = buildItems(false);
        const materiales = buildItems(true);
        const equipos = buildItems(false);

        const sumCategoria = (items: ReturnType<typeof buildItems>) =>
            items.reduce(
                (s, it) =>
                    s + round10(it.cantidad * it.precio_unitario * Math.max(1, it.factor_desperdicio)),
                0,
            );

        const costoManoObra = round10(sumCategoria(manoDeObra));
        const costoMateriales = round10(sumCategoria(materiales));
        const costoEquipos = round10(sumCategoria(equipos));
        const costoUnitarioTotal = round10(costoManoObra + costoMateriales + costoEquipos);

        delphinRows.push({
            id: i + 1,
            parent_id: null,
            partida,
            descripcion: `Partida ${i}`,
            metrado,
            parcial: 0,
        } as unknown as DelphinRow);

        acuRows.push({
            id: i + 1,
            partida,
            descripcion: `ACU ${i}`,
            unidad: 'und',
            rendimiento: 1,
            costo_mano_obra: costoManoObra,
            costo_materiales: costoMateriales,
            costo_equipos: costoEquipos,
            costo_subcontratos: 0,
            costo_subpartidas: 0,
            costo_unitario_total: costoUnitarioTotal,
            mano_de_obra: manoDeObra,
            materiales,
            equipos,
            subcontratos: [],
            subpartidas: [],
        } as unknown as ACURowSummary);

        // Costo Directo: mismo criterio que round2() (10dp) en useDelphinData.ts.
        costoDirectoTotal = costoDirectoTotal.plus(round10(metrado * costoUnitarioTotal));
    }

    const costoDirecto = costoDirectoTotal.toDecimalPlaces(10).toNumber();

    const consolidated = consolidateInsumos(flattenInsumos(acuRows, delphinRows), {});
    const insumosConsolidados = sumInsumoTotals(
        consolidated.map((row) => ({ total: row.parcial })),
    );

    // Igualdad exacta al centimo — ni un centavo mas ni uno menos.
    expect(Math.round(insumosConsolidados * 100)).toBe(
        Math.round(costoDirecto * 100),
    );
    // La diferencia interna (antes de redondear a 2dp para mostrar) debe quedar
    // muy por debajo de un centimo — ruido de precision de 6dp, no arrastre de
    // redondeo por fila (que con el bug original alcanzaba 0.03 a esta escala).
    expect(Math.abs(insumosConsolidados - costoDirecto)).toBeLessThan(0.005);
});
