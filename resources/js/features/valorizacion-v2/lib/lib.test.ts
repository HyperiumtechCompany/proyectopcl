import { describe, expect, it } from 'vitest';
import { evaluarAvance } from './avance';
import { calcBudgetTotals, calcPartidaTotal, calcPctAvance } from './budget';
import { addDays, calcFechaFin, calcPlazo, formatDate, formatMonthShort, formatMonthYear, isIsoDate, todayInObra, weekday } from './dates';
import { D, parseDecimal, roundInt, roundMoney, roundPct, safeDiv, sum } from './money';
import { avanceDelPlazo } from './periodos';
import { montoEnLetras, numeroALetras, plazoEnLetras } from './spanishWords';

describe('money', () => {
    it('redondea como ROUND() de Excel (empate se aleja de cero)', () => {
        expect(roundMoney('123.455').toFixed(2)).toBe('123.46');
        expect(roundMoney('123.456').toFixed(2)).toBe('123.46');
        expect(roundMoney('-2.345').toFixed(2)).toBe('-2.35');
        expect(roundPct('0.31845').toFixed(4)).toBe('0.3185');
        expect(roundInt('8967.94').toFixed(0)).toBe('8968');
    });

    it('evita errores de coma flotante', () => {
        expect(sum(['0.1', '0.2']).toString()).toBe('0.3');
    });

    it('D() trata vacío como 0 pero rechaza texto corrupto', () => {
        expect(D(null).toString()).toBe('0');
        expect(D('').toString()).toBe('0');
        expect(() => D('abc')).toThrow();
        expect(parseDecimal('1,234.50')?.toString()).toBe('1234.5');
        expect(parseDecimal('abc')).toBeNull();
    });

    it('safeDiv con divisor cero devuelve 0', () => {
        expect(safeDiv(10, 0).toString()).toBe('0');
    });
});

describe('budget — pie presupuestal real de la Val. N°02', () => {
    const rates = { gastosGenerales: '0.10', utilidad: '0.07', igv: '0.18' };

    it('cuadra con PRESUPUESTO!G156:G161', () => {
        const t = calcBudgetTotals('462717.27', rates);
        expect(t.costoDirecto.toFixed(2)).toBe('462717.27');
        expect(t.gastosGenerales.toFixed(2)).toBe('46271.73');
        expect(t.utilidad.toFixed(2)).toBe('32390.21');
        expect(t.subTotal.toFixed(2)).toBe('541379.21');
        expect(t.igv.toFixed(2)).toBe('97448.26');
        expect(t.total.toFixed(2)).toBe('638827.47');
        expect(t.pesoCD.toFixed(4)).toBe('1.0000');
    });

    it('cuadra con el bloque ACTUAL de VAL. MENSUAL (35.10 %)', () => {
        const t = calcBudgetTotals('162392.11', rates, '462717.27');
        expect(t.gastosGenerales.toFixed(2)).toBe('16239.21');
        expect(t.utilidad.toFixed(2)).toBe('11367.45');
        expect(t.subTotal.toFixed(2)).toBe('189998.77');
        expect(t.igv.toFixed(2)).toBe('34199.78');
        expect(t.total.toFixed(2)).toBe('224198.55');
        expect(t.pesoCD.toFixed(4)).toBe('0.3510');
    });

    it('total de partida y % de avance', () => {
        expect(calcPartidaTotal('1932.21', '4.32').toFixed(2)).toBe('8347.15');
        expect(calcPartidaTotal('910.14', '119.99').toFixed(2)).toBe('109207.70');
        expect(calcPctAvance('878.33', '1700').toFixed(4)).toBe('0.5167');
        expect(calcPctAvance(1, 0).toString()).toBe('0');
    });
});

describe('dates — solo-día, sin corrimiento por zona horaria', () => {
    it('formatea sin depender de la zona del navegador', () => {
        expect(formatDate('2026-07-15')).toBe('15/07/2026');
        expect(formatMonthYear('2026-07-01')).toBe('Julio 2026');
        expect(formatMonthShort('2026-06-20')).toBe('Jun-26');
    });

    it('FT!E51: término = inicio + plazo − 1', () => {
        expect(calcFechaFin('2026-06-20', 60)).toBe('2026-08-18');
        expect(calcPlazo('2026-06-20', '2026-08-18')).toBe(60);
        expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    });

    it('valida fechas y días de la semana', () => {
        expect(isIsoDate('2026-02-30')).toBe(false);
        expect(isIsoDate('2026-02-28')).toBe(true);
        expect(weekday('2026-07-05')).toBe(0); // domingo (RH-EM, jul-2026)
    });

    it('hoy en obra usa America/Lima', () => {
        // 2026-07-16 03:00 UTC = 2026-07-15 22:00 en Lima.
        expect(todayInObra(new Date(Date.UTC(2026, 6, 16, 3)))).toBe('2026-07-15');
    });
});

describe('avance — CONTROL GENERAL columna P', () => {
    it('evalúa la situación de la obra', () => {
        const adelantada = evaluarAvance('0.5650', '0.9782');
        expect(adelantada.situacion).toBe('ADELANTADA');
        expect(adelantada.diferencia.toFixed(4)).toBe('0.4132');
        expect(evaluarAvance('0.60', '0.40').situacion).toBe('ATRASADA');
        expect(evaluarAvance('1', '1').situacion).toBe('CULMINADA');
    });
});

describe('números a letras', () => {
    it.each([
        [0, 'CERO'],
        [60, 'SESENTA'],
        [90, 'NOVENTA'],
        [100, 'CIEN'],
        [101, 'CIENTO UNO'],
        [21000, 'VEINTIÚN MIL'],
        [31000, 'TREINTA Y UN MIL'],
        [63882, 'SESENTA Y TRES MIL OCHOCIENTOS OCHENTA Y DOS'],
        [224198, 'DOSCIENTOS VEINTICUATRO MIL CIENTO NOVENTA Y OCHO'],
        [1000000, 'UN MILLÓN'],
        [21500000, 'VEINTIÚN MILLONES QUINIENTOS MIL'],
    ])('%i → %s', (n, words) => {
        expect(numeroALetras(n)).toBe(words);
    });

    it('textos del expediente', () => {
        expect(plazoEnLetras(60)).toBe('SESENTA (60) DÍAS CALENDARIOS');
        expect(montoEnLetras('63882.75')).toBe('SESENTA Y TRES MIL OCHOCIENTOS OCHENTA Y DOS CON 75/100 SOLES');
    });
});

describe('avanceDelPlazo', () => {
    it('días transcurridos al cierre del mes valorizado, sin pasar el término', () => {
        expect(avanceDelPlazo('2026-06-20', '2026-08-18', '2026-07')).toEqual({ transcurridos: 42, restantes: 18, plazo: 60, pct: '0.7000' });
        expect(avanceDelPlazo('2026-06-20', '2026-08-18', '2026-08').transcurridos).toBe(60);
        expect(avanceDelPlazo('2026-06-20', '2026-08-18', '2026-05').transcurridos).toBe(0);
    });
});
