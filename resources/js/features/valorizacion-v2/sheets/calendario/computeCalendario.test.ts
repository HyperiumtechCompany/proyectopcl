import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { valorizacion02Jul2026 as fixture } from '../../data/fixtures/valorizacion02Jul2026';
import { readCalendarioProgramadoExcel, readMetradosExcel } from '../../data/importers/readCalendarioExcel';
import { periodosDeObra } from '../../lib/periodos';
import { calendarioEjecutadoDesdeMetrados } from '../metrados/computeMetrados';
import { computePresupuesto } from '../presupuesto/computePresupuesto';
import { acumuladoAl, computeCalendario } from './computeCalendario';

const presupuesto = computePresupuesto(fixture.presupuesto, fixture.parametros);
const periodos = periodosDeObra('2026-06-20', '2026-08-18');
const calendarios = { programado: fixture.calendarios.programado, ejecutado: calendarioEjecutadoDesdeMetrados(presupuesto, fixture.metrados) };
const calc = (tipo: 'programado' | 'ejecutado') => computeCalendario(tipo, presupuesto, calendarios[tipo], periodos, fixture.parametros);
const money = (value: { toFixed: (n: number) => string }) => value.toFixed(2);

describe('periodosDeObra', () => {
    it('recorta el primer y último mes al plazo de la Ficha Técnica', () => {
        expect(periodos.map((p) => [p.label, p.rango])).toEqual([
            ['Jun-26', '20/06 – 30/06'],
            ['Jul-26', '01/07 – 31/07'],
            ['Ago-26', '01/08 – 18/08'],
        ]);
    });

    it('agrega meses con datos fuera del plazo', () => {
        expect(periodosDeObra('2026-06-20', '2026-08-18', ['2026-09']).map((p) => p.key)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09']);
    });
});

describe('CALEN. PROG. — cuadra con el Excel', () => {
    const programado = calc('programado');

    it('pie mensual (J156:J163)', () => {
        const [jun, jul, ago] = programado.meses;
        expect(money(jun.totales.costoDirecto)).toBe('114117.28');
        expect(money(jun.totales.total)).toBe('157550.32');
        expect(jun.totales.pesoCD.toFixed(4)).toBe('0.2466');
        expect(money(jul.totales.costoDirecto)).toBe('147324.87');
        expect(money(jul.totales.gastosGenerales)).toBe('14732.49');
        expect(money(jul.totales.total)).toBe('203396.72');
        expect(jul.acumulado.toFixed(4)).toBe('0.5650');
        expect(money(ago.totales.total)).toBe('277880.43');
        expect(ago.acumulado.toFixed(4)).toBe('1.0000');
        expect(money(programado.totalMeses.total)).toBe('638827.47');
    });

    it('% por partida y mes (I15 = ROUND(J15/$G15, 4)) y montos sin redondear', () => {
        const fila = programado.filas.find((f) => f.node.codigo === '01.01.01.03')!;
        expect(fila.meses['2026-06'].pct?.toFixed(4)).toBe('0.1833');
        expect(fila.meses['2026-07'].pct?.toFixed(4)).toBe('0.5167');
        expect(fila.estado).toBe('completo');
    });

    it('todas las partidas programadas al 100 %', () => {
        expect(programado.issues).toEqual([]);
        expect(programado.filas.filter((f) => f.node.esHoja).every((f) => f.estado === 'completo')).toBe(true);
    });
});

describe('CALEN. VALO. — derivado de METRADOS, cuadra con el Excel', () => {
    const ejecutado = calc('ejecutado');

    it('pie mensual y acumulado al mes de la valorización', () => {
        const [jun, jul, ago] = ejecutado.meses;
        expect(money(jun.totales.costoDirecto)).toBe('290198.67');
        expect(money(jun.totales.total)).toBe('400648.29');
        expect(jun.totales.pesoCD.toFixed(4)).toBe('0.6272');
        expect(money(jul.totales.costoDirecto)).toBe('162392.11');
        expect(money(jul.totales.total)).toBe('224198.55');
        expect(jul.totales.pesoCD.toFixed(4)).toBe('0.3510');
        expect(acumuladoAl(ejecutado, '2026-07').toFixed(4)).toBe('0.9782');
        expect(ago.totales.costoDirecto.isZero()).toBe(true);
    });

    it('marca partidas con saldo por ejecutar sin reportarlas como error', () => {
        const fila = ejecutado.filas.find((f) => f.node.codigo === '01.01.01.01')!;
        expect(money(fila.suma)).toBe('3552.00');
        expect(fila.estado).toBe('parcial');
        expect(ejecutado.issues).toEqual([]);
    });
});

describe('importar desde el Excel real', () => {
    const buffer = readFileSync(resolve(process.cwd(), 'planes/costos/campo/valorizaciones/VALORIZACIÓN N°02 - JUL 2026 (1).xlsx'));
    const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    it('CALEN. PROG.: enlaza por código y reproduce el fixture', async () => {
        const result = await readCalendarioProgramadoExcel(data, fixture.presupuesto.partidas);
        expect(result.sheetName).toBe('CALEN. PROG.');
        expect(result.meses).toEqual(['2026-06', '2026-07', '2026-08']);
        expect(result.warnings).toEqual([]);
        expect(result.data).toEqual(fixture.calendarios.programado);
    });

    it('METRADOS: meses con datos, contratado igual al presupuesto y mismo fixture', async () => {
        const result = await readMetradosExcel(data, fixture.presupuesto.partidas);
        expect(result.sheetName).toBe('METRADOS');
        expect(result.meses).toEqual(['2026-06', '2026-07']);
        expect(result.warnings).toEqual([]);
        expect(result.data).toEqual(fixture.metrados.ejecutado);
    });
});
