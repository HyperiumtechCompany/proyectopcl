import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { periodosDeObra } from '../../lib/periodos';
import { computeCalendario } from '../../sheets/calendario/computeCalendario';
import { computeControlGeneral } from '../../sheets/control/computeControl';
import { computeFichaTecnica } from '../../sheets/ficha-tecnica/computeFichaTecnica';
import { calendarioEjecutadoDesdeMetrados } from '../../sheets/metrados/computeMetrados';
import {
    computePagosAcumulados,
    computeRetencionFielCumplimiento,
} from '../../sheets/pagos/computePagos';
import { computePresupuesto } from '../../sheets/presupuesto/computePresupuesto';
import { createValorizacionStore } from '../../store/valorizacionStore';
import { crearInputVacio } from '../schema';
import { readValorizacionExcel } from './readValorizacionExcel';

const archivo = resolve(
    process.cwd(),
    'planes/costos/campo/valorizaciones/VALORIZACIÓN N°02 - JUL 2026 (1).xlsx',
);
const nuevo = () =>
    crearInputVacio({
        nombre: 'Proyecto nuevo',
        fecha_inicio: '2026-10-01',
        fecha_fin: '2026-10-31',
    });
const excel = (hojas: Record<string, unknown[][]>): ArrayBuffer => {
    const book = XLSX.utils.book_new();
    for (const [name, rows] of Object.entries(hojas))
        XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);

    return XLSX.write(book, { type: 'array', bookType: 'xlsx' });
};
const leerReal = async () => {
    const buffer = readFileSync(archivo);

    return readValorizacionExcel(
        buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength,
        ),
        nuevo(),
    );
};
const presupuestoSimple = [
    ['ITEM', 'DESCRIPCION', 'UND', 'METRADO', 'P.UND', 'TOTAL'],
    ['01', 'Partida', 'm', 10, 20, 200],
];

describe('importar un expediente completo sin reemplazar sus cálculos', () => {
    it('lee FT, corte, presupuesto, calendario, metrados, pagos y personal del archivo real', async () => {
        const result = await leerReal();
        const { input } = result;
        expect(input.periodo).toEqual({ numero: 2, mes: '2026-07-01' });
        expect(input.presupuesto.partidas).toHaveLength(144);
        expect(input.fichaTecnica.datosGenerales.entidad).toBe(
            'MUNICIPALIDAD DISTRITAL DE PILLCO MARCA',
        );
        expect(input.fichaTecnica.datosGenerales.cui).toBe('2536252');
        expect(input.fichaTecnica.datosGenerales.ubicacion.distrito).toBe(
            'PILLCO MARCA',
        );
        expect(input.fichaTecnica.plazos.fechaInicioObra).toBe('2026-06-20');
        expect(input.fichaTecnica.plazos.plazoEjecucionDias).toBe(60);
        expect(input.fichaTecnica.contratista.plazoContractualDias).toBe(60);
        expect(input.fichaTecnica.contratista.montoContratoVigente).toBeNull();
        expect(input.fichaTecnica.supervision.plazoServicioDias).toBe(90);
        expect(input.control.devengados).toMatchObject({
            '2026-06': true,
            '2026-07': false,
        });
        expect(input.pagos.rfc).toEqual({
            porcentaje: '0.1',
            modo: 'primer-pago',
        });
        expect(input.pagos.porcentajeDetraccion).toBe('0.04');
        expect(input.personal.personas).toHaveLength(2);
        expect(input.personal.personas[0]).toMatchObject({
            vinculoFT: 'residente',
            dni: '71535828',
            cip: '230440',
        });
        expect(result.secciones.map((item) => item.hoja)).toContain('METRADOS');
        // Conserva la inconsistencia del archivo para revisión; no inventa una fecha corregida.
        expect(input.fichaTecnica.datosGenerales.fechaPresupuestoBase).toBe(
            '2027-04-08',
        );
        expect(
            result.warnings.some((warning) =>
                warning.includes('presupuesto base es posterior'),
            ),
        ).toBe(true);
    });

    it('alimenta Curva S, avance y líquido a pagar con los mismos resultados sanos del Excel', async () => {
        const { input } = await leerReal();
        const presupuesto = computePresupuesto(
            input.presupuesto,
            input.parametros,
        );
        const ficha = computeFichaTecnica(input.fichaTecnica);
        const periodos = periodosDeObra(
            input.fichaTecnica.plazos.fechaInicioObra,
            ficha.fechaTerminoVigente,
        );
        const programado = computeCalendario(
            'programado',
            presupuesto,
            input.calendarios.programado,
            periodos,
            input.parametros,
        );
        const ejecutado = computeCalendario(
            'ejecutado',
            presupuesto,
            calendarioEjecutadoDesdeMetrados(presupuesto, input.metrados),
            periodos,
            input.parametros,
        );
        const control = computeControlGeneral(programado, ejecutado, '2026-07');
        expect(presupuesto.totales.total.toFixed(2)).toBe('638827.47');
        expect(
            control.meses.map((mes) => mes.programado.mensual.toFixed(2)),
        ).toEqual(['157550.32', '203396.72', '277880.43']);
        expect(control.meses[1].programado.pctAcumulado.toFixed(4)).toBe(
            '0.5650',
        );
        expect(control.meses[1].ejecutado?.pctAcumulado.toFixed(4)).toBe(
            '0.9782',
        );
        expect(control.totalEjecutado.toFixed(2)).toBe('624846.84');
        expect(control.meses[2].ejecutado).toBeNull();
        const rfc = computeRetencionFielCumplimiento(
            control,
            input.fichaTecnica.contratista.montoContratoPrincipal!,
            input.pagos.rfc,
            '2026-07',
        );
        const pagos = computePagosAcumulados(
            presupuesto.totales,
            ejecutado,
            rfc,
            input.pagos.porMes,
            input.pagos.porcentajeDetraccion,
            '2026-07',
        );
        expect(pagos.actual.a.toFixed(2)).toBe('224198.55');
        expect(pagos.actual.k.toFixed(2)).toBe('215230.55');
    });

    it('conserva hojas ausentes y remapea las conexiones de partidas por código', async () => {
        const actual = nuevo();
        actual.presupuesto.partidas = [
            {
                id: 'manual-1',
                codigo: '01',
                parentId: null,
                descripcion: 'Anterior',
                unidad: 'm',
                metrado: '10',
                precioUnitario: '20',
            },
        ];
        actual.calendarios.programado.montos = {
            'manual-1': { '2026-10': '200' },
        };
        actual.metrados.ejecutado = { 'manual-1': { '2026-10': '2' } };
        const copia = structuredClone(actual);
        const result = await readValorizacionExcel(
            excel({ PRESUPUESTO: presupuestoSimple }),
            actual,
        );
        expect(actual).toEqual(copia);
        expect(result.input.calendarios.programado.montos).toEqual({
            'p-01': { '2026-10': '200' },
        });
        expect(result.input.metrados.ejecutado).toEqual({
            'p-01': { '2026-10': '2' },
        });
        expect(result.input.fichaTecnica).toEqual(actual.fichaTecnica);
        expect(
            result.warnings.some((warning) =>
                warning.includes('Falta CALEN. PROG.'),
            ),
        ).toBe(true);
    });

    it('enlaza calendarios con los códigos originales aunque el árbol se renumere', async () => {
        const result = await readValorizacionExcel(
            excel({
                PRESUPUESTO: [
                    presupuestoSimple[0],
                    ['01', 'Obra'],
                    ['01.03', 'Partida', 'm', 10, 20, 200],
                ],
                'CALEN. PROG.': [
                    ['ITEM', 'DESCRIPCION', '2026-10-01'],
                    [null, null, 'COSTO (S/)'],
                    ['01.03', 'Partida', 200],
                ],
            }),
            nuevo(),
        );
        expect(result.input.presupuesto.partidas[1].codigo).toBe('01.01');
        expect(result.input.calendarios.programado.montos).toEqual({
            'p-01.03': { '2026-10': '200' },
        });
    });

    it('aplica, deshace y rehace todo el expediente en un solo paso', async () => {
        const actual = nuevo();
        const store = createValorizacionStore(actual);
        const { input } = await leerReal();
        store.getState().importValorizacion(input);
        expect(store.getState().history.past).toHaveLength(1);
        expect(store.getState().input).toEqual(input);
        store.getState().undo();
        expect(store.getState().input).toEqual(actual);
        store.getState().redo();
        expect(store.getState().input).toEqual(input);
    });

    it('el importador de presupuesto independiente también conserva los avances enlazados', () => {
        const actual = nuevo();
        actual.presupuesto.partidas = [
            {
                id: 'manual',
                codigo: '01',
                parentId: null,
                descripcion: 'Partida',
                unidad: 'm',
                metrado: '10',
                precioUnitario: '20',
            },
        ];
        actual.metrados.ejecutado = { manual: { '2026-10': '2' } };
        const store = createValorizacionStore(actual);
        store
            .getState()
            .replacePresupuesto({
                fuente: 'excel',
                partidas: [{ ...actual.presupuesto.partidas[0], id: 'p-01' }],
            });
        expect(store.getState().input.metrados.ejecutado).toEqual({
            'p-01': { '2026-10': '2' },
        });
        store.getState().undo();
        expect(store.getState().input.metrados.ejecutado).toEqual(
            actual.metrados.ejecutado,
        );
    });

    it('rechaza archivos ajenos o datos mensuales que no se pueden enlazar, sin modificar el documento', async () => {
        const actual = nuevo();
        const copia = structuredClone(actual);
        await expect(
            readValorizacionExcel(excel({ Hoja1: [['Hola']] }), actual),
        ).rejects.toThrow('compatibles');
        await expect(
            readValorizacionExcel(
                excel({
                    PRESUPUESTO: presupuestoSimple,
                    'CALEN. PROG.': [
                        ['ITEM', 'DESCRIPCION', '2026-10-01'],
                        [null, null, 'COSTO (S/)'],
                        ['99', 'Otra partida', 200],
                    ],
                }),
                actual,
            ),
        ).rejects.toThrow('no pudo enlazarse');
        expect(actual).toEqual(copia);
    });

    it('importa ajustes manuales y deja los montos derivados en manos del cálculo', async () => {
        const result = await readValorizacionExcel(
            excel({
                'R PAGO MENSUAL': [
                    [
                        'RESUMEN DE PAGO DE LA VALORIZACIÓN N°02 DEL MES DE JULIO DE 2026',
                    ],
                    ['A', 'VALORIZACIÓN DEL MES SIN REAJUSTE', null, 999999],
                    ['B', 'REAJUSTE DE LA VALORIZACIÓN'],
                    [null, 'REAJUSTE DEL MES', null, 100],
                    ['D', 'DEDUCCIÓN DEL REAJUSTE QUE NO CORRESPONDE'],
                    [null, 'POR ADELANTO DIRECTO', null, 10],
                    ['E', 'AMORTIZACIÓN POR ADELANTOS'],
                    [null, 'POR ADELANTO DIRECTO', null, 20],
                    ['H', 'PENALIDADES'],
                    [null, 'POR ATRASO DE OBRA', null, 30],
                    [null, 'OTROS', null, 40],
                    ['K', 'MONTO LÍQUIDO A PAGAR AL CONTRATISTA', null, 888888],
                ],
            }),
            nuevo(),
        );
        expect(result.input.pagos.porMes['2026-07']).toEqual({
            reajusteMes: '100',
            deduccionReajusteDirecto: '10',
            amortizacionDirecto: '20',
            penalidadAtraso: '30',
            penalidadOtros: '40',
        });
        expect(result.input.presupuesto.partidas).toEqual([]);
    });

    it('admite un mes con metrados en cero sin inventar avance ejecutado', async () => {
        const result = await readValorizacionExcel(
            excel({
                PRESUPUESTO: presupuestoSimple,
                METRADOS: [
                    ['ITEM', 'DESCRIPCION', '2026-10-01'],
                    [null, null, 'METRADO'],
                    ['01', 'Partida', 0],
                ],
            }),
            nuevo(),
        );
        expect(result.input.metrados.ejecutado).toEqual({});
        expect(
            result.secciones.some((seccion) => seccion.hoja === 'METRADOS'),
        ).toBe(true);
    });
});
