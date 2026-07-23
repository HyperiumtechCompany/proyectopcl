import { describe, expect, it } from 'vitest';
import {
    DEFAULT_LEGEND_COLUMN_HEADER_HEIGHT_MM, DEFAULT_LEGEND_HEADER_HEIGHT_MM, DEFAULT_LEGEND_ROW_HEIGHT_MM,
    DEFAULT_LEGEND_SYMBOL_COLUMN_WIDTH_MM,
} from '../domain/constants';
import type { DxfBounds, DxfLegendRow } from '../domain/types';
import { paperMmToModelM } from '../geometry/sheetScale';
import { renderFixtureSymbol } from '../symbols/lightingSymbols';
import { renderLegendTable } from './legend';

/**
 * Fase 6 del plan maestro DXF: tabla de leyenda genérica (compartida con la
 * Fase 7). Cubre la actividad "dividir en columnas o emitir advertencia si
 * excede el área" y el criterio de cierre de la Fase 5: la celda de símbolo
 * de una fila invoca el MISMO renderer que la entidad en planta.
 */

function countOccurrences(haystack: string, needle: string): number {
    return haystack.split(needle).length - 1;
}

const SCALE = 50;
const HEADER_M = paperMmToModelM(DEFAULT_LEGEND_HEADER_HEIGHT_MM, SCALE);
const COLUMN_HEADER_M = paperMmToModelM(DEFAULT_LEGEND_COLUMN_HEADER_HEIGHT_MM, SCALE);
const ROW_M = paperMmToModelM(DEFAULT_LEGEND_ROW_HEIGHT_MM, SCALE);

function fixtureRow(overrides: Partial<DxfLegendRow> = {}): DxfLegendRow {
    return {
        kind: 'fixture',
        symbolRef: { kind: 'fixture', catalogSymbol: 'circle_magenta' },
        code: 'PANEL-40W',
        description: 'PCL Iluminación PANEL-40W',
        technicalFields: ['40W', '4000lm'],
        quantity: 3,
        ...overrides,
    };
}

describe('renderLegendTable — leyenda vacía', () => {
    it('dibuja el marco y el título aunque no haya filas, sin fallar (sin encabezados de columna)', () => {
        const area: DxfBounds = { minX: 0, minY: 0, maxX: 2, maxY: 2 };
        const out: string[] = [];
        const result = renderLegendTable(out, 'LEYENDA_LUZ', area, SCALE, 'LEYENDA - ALUMBRADO', []);
        const dxf = out.join('\n');

        expect(result).toEqual({ columnCount: 1, overflow: false });
        expect(countOccurrences(dxf, '0\nLINE')).toBe(4); // marco
        expect(countOccurrences(dxf, '0\nTEXT')).toBe(1); // solo el título
        expect(dxf).toContain('LEYENDA - ALUMBRADO');
    });
});

describe('renderLegendTable — encabezados de columna', () => {
    it('con filas, agrega "SIMBOLO" y "DESCRIPCION" además del título', () => {
        const area: DxfBounds = { minX: 0, minY: 0, maxX: 2, maxY: 2 };
        const out: string[] = [];
        renderLegendTable(out, 'LEYENDA_LUZ', area, SCALE, 'LEYENDA', [fixtureRow()]);
        const dxf = out.join('\n');

        expect(dxf).toContain('SIMBOLO');
        expect(dxf).toContain('DESCRIPCION');
    });
});

describe('renderLegendTable — reparto en columnas', () => {
    it('todas las filas caben en 1 columna cuando el área es amplia', () => {
        const area: DxfBounds = { minX: 0, minY: 0, maxX: 2, maxY: 2 };
        const out: string[] = [];
        const result = renderLegendTable(out, 'LEYENDA_LUZ', area, SCALE, 'LEYENDA', [fixtureRow(), fixtureRow({ code: 'B' })]);
        expect(result).toEqual({ columnCount: 1, overflow: false });
    });

    it('se reparte en 2 columnas cuando 1 columna no alcanza pero 2 sí', () => {
        // 6 filas: 1 columna necesitaría 6 filas de alto, 2 columnas necesitan 3 —
        // el área alcanza justo para 3 filas por columna (más título + encabezados) pero no para 6.
        const area: DxfBounds = { minX: 0, minY: 0, maxX: 2, maxY: HEADER_M + COLUMN_HEADER_M + ROW_M * 3 + 1e-6 };
        const rows = Array.from({ length: 6 }, (_, i) => fixtureRow({ code: `P${i}` }));

        const out: string[] = [];
        const result = renderLegendTable(out, 'LEYENDA_LUZ', area, SCALE, 'LEYENDA', rows);

        expect(result.columnCount).toBe(2);
        expect(result.overflow).toBe(false);
        // Todas las filas se dibujan igual, sin recortar ninguna (título + 2 encabezados + 1 por fila).
        expect(countOccurrences(out.join('\n'), '0\nTEXT')).toBe(3 + rows.length);
    });

    it('ni con 2 columnas caben: reporta overflow=true pero sigue dibujando TODAS las filas', () => {
        const area: DxfBounds = { minX: 0, minY: 0, maxX: 2, maxY: HEADER_M + ROW_M * 1.5 };
        const rows = Array.from({ length: 10 }, (_, i) => fixtureRow({ code: `P${i}` }));

        const out: string[] = [];
        const result = renderLegendTable(out, 'LEYENDA_LUZ', area, SCALE, 'LEYENDA', rows);

        expect(result.columnCount).toBe(2);
        expect(result.overflow).toBe(true);
        expect(countOccurrences(out.join('\n'), '0\nTEXT')).toBe(3 + rows.length);
    });
});

describe('renderLegendTable — mismo renderer que en planta (criterio de cierre Fase 5)', () => {
    it('la celda de símbolo de una fila "fixture" dibuja exactamente lo mismo que renderFixtureSymbol en el punto calculado', () => {
        const area: DxfBounds = { minX: 0, minY: 0, maxX: 2, maxY: 2 };
        const row = fixtureRow({ symbolRef: { kind: 'fixture', catalogSymbol: 'circle_magenta' } });

        const outLegend: string[] = [];
        renderLegendTable(outLegend, 'LEYENDA_LUZ', area, SCALE, 'LEYENDA', [row]);

        // Replica el cálculo de la primera fila / primera columna de legend.ts.
        const symbolColumnWidthM = paperMmToModelM(DEFAULT_LEGEND_SYMBOL_COLUMN_WIDTH_MM, SCALE);
        const rowsTopY = area.maxY - HEADER_M - COLUMN_HEADER_M;
        const symbolCenterY = rowsTopY - ROW_M / 2;
        const symbolX = area.minX + symbolColumnWidthM / 2;
        const symbolSize = Math.min(symbolColumnWidthM, ROW_M) * 0.35;

        const outStandalone: string[] = [];
        renderFixtureSymbol(outStandalone, 'LEYENDA_LUZ', {
            x: symbolX, y: symbolCenterY, sizeM: symbolSize, catalogSymbol: 'circle_magenta',
        });

        // El bloque de 6 líneas del CIRCLE (0/8/10/20/30/40) debe ser idéntico en ambas salidas.
        function circleBlock(lines: string[]): string[] {
            const start = lines.indexOf('0\nCIRCLE');
            expect(start).toBeGreaterThanOrEqual(0);
            return lines.slice(start, start + 6);
        }
        expect(circleBlock(outLegend)).toEqual(circleBlock(outStandalone));
    });
});

describe('renderLegendTable — filas de cableado muestran un trazo de color, no un símbolo vacío', () => {
    it('una fila sin symbolRef dibuja una LINE con color ACI en vez de nada', () => {
        const area: DxfBounds = { minX: 0, minY: 0, maxX: 2, maxY: 2 };
        const cableRow: DxfLegendRow = {
            kind: 'cable', symbolRef: null, code: 'C',
            description: 'Cu LSOH · 4 mm² (AWG 12)', technicalFields: ['Tubo 20mm'], quantity: 2,
        };
        const out: string[] = [];
        renderLegendTable(out, 'LEYENDA_LUZ', area, SCALE, 'LEYENDA', [cableRow]);
        const dxf = out.join('\n');

        expect(dxf).toContain('62\n1'); // color ACI 1 (rojo) del trazo de muestra
    });
});
