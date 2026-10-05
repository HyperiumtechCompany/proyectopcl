import type { CellMap } from '../../lib/cellMap';
import { parseCalendarioRows } from '../../lib/import/parseCalendarioRows';
import { parseMetradosRows } from '../../lib/import/parseMetradosRows';
import { D } from '../../lib/money';
import type { CalendarioInput, PartidaInput } from '../../types';
import { enlazarPorCodigo } from './enlazarPorCodigo';

export interface ExcelImportResult<T> {
    sheetName: string;
    meses: string[];
    data: T;
    /** Partidas del presupuesto que recibieron valores. */
    enlazadas: number;
    warnings: string[];
}

async function readSheet(data: ArrayBuffer, pattern: RegExp): Promise<{ sheetName: string; rows: unknown[][] } | null> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames.find((name) => pattern.test(name));
    if (!sheetName) {
        return null;
    }

    return { sheetName, rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, raw: true, defval: null }) };
}

const notFound = <T>(data: T, hoja: string): ExcelImportResult<T> => ({
    sheetName: '',
    meses: [],
    data,
    enlazadas: 0,
    warnings: [`No se encontró la hoja ${hoja} en el archivo.`],
});

/** Calendario programado desde la hoja CALEN. PROG. (SheetJS bajo demanda). */
export async function readCalendarioProgramadoExcel(data: ArrayBuffer, partidas: PartidaInput[]): Promise<ExcelImportResult<CalendarioInput>> {
    const sheet = await readSheet(data, /CALEN.*PROG|PROGRAMAD/i);
    if (!sheet) {
        return notFound({ montos: {} }, '"CALEN. PROG."');
    }
    const parsed = parseCalendarioRows(sheet.rows);
    const { valores, enlazadas, warnings } = enlazarPorCodigo(parsed.montos, partidas);

    return { sheetName: sheet.sheetName, meses: parsed.meses, data: { montos: valores }, enlazadas, warnings: [...parsed.warnings, ...warnings] };
}

/** Metrados ejecutados por mes desde la hoja METRADOS; avisa si el contratado difiere del presupuesto. */
export async function readMetradosExcel(data: ArrayBuffer, partidas: PartidaInput[]): Promise<ExcelImportResult<CellMap>> {
    const sheet = await readSheet(data, /^\s*METRADOS?\s*$/i);
    if (!sheet) {
        return notFound({}, '"METRADOS"');
    }
    const parsed = parseMetradosRows(sheet.rows);
    const { valores, enlazadas, warnings } = enlazarPorCodigo(parsed.metrados, partidas);

    const distintos = partidas
        .filter((partida) => parsed.contratados[partida.codigo] !== undefined && partida.metrado !== null && !D(partida.metrado).eq(parsed.contratados[partida.codigo]))
        .map((partida) => partida.codigo);
    if (distintos.length > 0) {
        warnings.push(`${distintos.length} partidas tienen un metrado contratado distinto al del presupuesto: ${distintos.slice(0, 6).join(', ')}.`);
    }

    return { sheetName: sheet.sheetName, meses: parsed.meses, data: valores, enlazadas, warnings: [...parsed.warnings, ...warnings] };
}
