import type ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { derivarValorizacion } from '../../compute/derivarValorizacion';
import { valorizacion02Jul2026 as fixture } from '../../data/fixtures/valorizacion02Jul2026';
import { construirLibro, graficosSvg } from './exportarLibro';

// PNG 1×1 transparente: en Node no se rasterizan los gráficos.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const wb = construirLibro(fixture, { curvaS: PNG, fisico: PNG, financiero: PNG });

/** Todos los valores numéricos de una hoja, redondeados a 2 decimales. */
const numeros = (ws: ExcelJS.Worksheet) => {
    const valores: number[] = [];
    ws.eachRow((row) => row.eachCell((cell) => typeof cell.value === 'number' && valores.push(Math.round(cell.value * 100) / 100)));

    return valores;
};
const textos = (ws: ExcelJS.Worksheet) => {
    const valores: string[] = [];
    ws.eachRow((row) => row.eachCell((cell) => typeof cell.value === 'string' && valores.push(cell.value)));

    return valores;
};

describe('libro Excel completo (formato del expediente)', () => {
    it('17 pestañas con los nombres del expediente del cliente, en orden', () => {
        expect(wb.worksheets.map((ws) => ws.name)).toEqual([
            'FT',
            'PRESUPUESTO',
            'CALEN. PROG.',
            'METRADOS',
            'CALEN. VALO.',
            'VAL. MENSUAL',
            'PROG VS. EJEC',
            'CONTROL GEN. AVAN. OBRA.',
            'CURVA S',
            'CONTROL AVAN. FISICO',
            'CONTROL FINANCIERO',
            'RESUMEN VAL.',
            'R.F.C',
            'R PAGO MENSUAL',
            'PAGOS ACUMULADOS',
            'CONTROL DE PAGOS',
            'RH-EM',
        ]);
    });

    it('las cifras salen como números y cuadran con el Excel', () => {
        const hoja = (nombre: string) => wb.getWorksheet(nombre)!;
        expect(numeros(hoja('PRESUPUESTO'))).toContain(638827.47);
        expect(numeros(hoja('VAL. MENSUAL'))).toEqual(expect.arrayContaining([224198.55, 624846.84, 400648.29]));
        expect(numeros(hoja('R PAGO MENSUAL'))).toEqual(expect.arrayContaining([224198.55, 215230.55, 8968]));
        expect(numeros(hoja('R.F.C'))).toContain(63882.75);
        expect(numeros(hoja('CONTROL DE PAGOS'))).toContain(535970.09);
    });

    it('encabezado del expediente y título formal en cada hoja', () => {
        const vm = wb.getWorksheet('VAL. MENSUAL')!;
        expect(vm.getCell(1, 2).value).toBe('VALORIZACIÓN N°02 DEL MES DE JULIO DE 2026');
        expect(textos(vm)).toEqual(expect.arrayContaining(['Obra:', 'Entidad:', 'Ejecutor:', 'Residente:', 'MONTO VALORIZADO MENSUAL']));
        expect(textos(wb.getWorksheet('R PAGO MENSUAL')!).some((t) => t.includes('Doscientos Veinticuatro Mil Ciento Noventa y Ocho con 55/100 soles'))).toBe(true);
    });

    it('gráficos insertados (Curva S, avance físico, control financiero)', () => {
        expect(wb.getWorksheet('CURVA S')!.getImages()).toHaveLength(1);
        expect(wb.getWorksheet('CONTROL AVAN. FISICO')!.getImages()).toHaveLength(1);
        expect(wb.getWorksheet('CONTROL FINANCIERO')!.getImages()).toHaveLength(1);
    });

    it('el SVG de la Curva S rotula el avance de cada valorización', () => {
        const svg = graficosSvg(derivarValorizacion(fixture));
        expect(svg.curvaS).toContain('97.82%');
        expect(svg.curvaS).toContain('56.50%');
        expect(svg.fisico).toContain('VAL. Nº01; 62.72%');
    });

    it('se puede escribir el .xlsx', async () => {
        const buffer = await wb.xlsx.writeBuffer();
        expect(buffer.byteLength).toBeGreaterThan(20000);
    });
});
