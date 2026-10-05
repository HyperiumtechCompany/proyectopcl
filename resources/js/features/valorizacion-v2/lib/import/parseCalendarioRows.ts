import { CODIGO, cellDate, findItemHeader, key, numberString, text } from './cells';
import type { Cell } from './cells';

/**
 * Lee una hoja tipo CALEN. PROG. / CALEN. VALO.: por cada columna "COSTO (S/)"
 * busca la fecha del mes en las filas de cabecera y devuelve los montos por
 * CÓDIGO de partida y mes. El enlace código → id lo hace quien importa, contra
 * el presupuesto cargado.
 */
export interface ParsedCalendario {
    meses: string[];
    /** codigo → { "2026-07": "1600" } (montos ≠ 0, sin redondear). */
    montos: Record<string, Record<string, string>>;
    warnings: string[];
}

export function parseCalendarioRows(rows: Cell[][]): ParsedCalendario {
    const result: ParsedCalendario = { meses: [], montos: {}, warnings: [] };
    const header = findItemHeader(rows);
    if (!header) {
        result.warnings.push('No se encontró la cabecera ITEM / DESCRIPCIÓN en la hoja.');

        return result;
    }

    // Fila con "COSTO (S/)" (normalmente 1–2 filas bajo ITEM).
    let subRow = -1;
    for (let r = header.row; r < Math.min(rows.length, header.row + 4) && subRow === -1; r++) {
        if ((rows[r] ?? []).some((cell) => key(cell).startsWith('COSTO'))) {
            subRow = r;
        }
    }
    if (subRow === -1) {
        result.warnings.push('No se encontraron columnas "COSTO (S/)" por mes.');

        return result;
    }

    // Columna de costo → mes, buscando una fecha en esa columna o la anterior (la de %).
    const columnas: Array<{ col: number; mes: string }> = [];
    (rows[subRow] ?? []).forEach((cell, col) => {
        if (!key(cell).startsWith('COSTO')) {
            return;
        }
        for (let r = subRow - 1; r >= header.row; r--) {
            const fecha = cellDate(rows[r]?.[col]) ?? cellDate(rows[r]?.[col - 1]);
            if (fecha) {
                columnas.push({ col, mes: fecha.slice(0, 7) });

                return;
            }
        }
        result.warnings.push(`La columna ${col + 1} ("COSTO") no tiene fecha de mes en la cabecera; se omitió.`);
    });
    result.meses = [...new Set(columnas.map((columna) => columna.mes))].sort();

    for (let r = subRow + 1; r < rows.length; r++) {
        const row = rows[r] ?? [];
        if (key(row[header.item]).startsWith('COSTO DIRECTO')) {
            break;
        }
        const codigo = text(row[header.item]);
        if (!CODIGO.test(codigo)) {
            continue;
        }
        for (const { col, mes } of columnas) {
            const monto = numberString(row[col]);
            if (monto !== null && Number(monto) !== 0) {
                (result.montos[codigo] ??= {})[mes] = monto;
            }
        }
    }

    if (Object.keys(result.montos).length === 0) {
        result.warnings.push('La hoja no tiene montos por mes.');
    }

    return result;
}
