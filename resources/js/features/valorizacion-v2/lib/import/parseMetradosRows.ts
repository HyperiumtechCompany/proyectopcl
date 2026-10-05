import { CODIGO, cellDate, findItemHeader, key, numberString, text } from './cells';
import type { Cell } from './cells';

/**
 * Lee una hoja tipo METRADOS: columnas "METRADO" con fecha de mes en la
 * cabecera = metrado ejecutado de ese mes; la columna "METRADO" sin fecha
 * (bajo "METRADO CONTRATADO") = metrado del presupuesto, para verificar.
 */
export interface ParsedMetrados {
    meses: string[];
    /** codigo → { "2026-07": "0.48" } (valores ≠ 0). */
    metrados: Record<string, Record<string, string>>;
    /** codigo → metrado contratado según la hoja. */
    contratados: Record<string, string>;
    warnings: string[];
}

export function parseMetradosRows(rows: Cell[][]): ParsedMetrados {
    const result: ParsedMetrados = { meses: [], metrados: {}, contratados: {}, warnings: [] };
    const header = findItemHeader(rows);
    if (!header) {
        result.warnings.push('No se encontró la cabecera ITEM / DESCRIPCIÓN en la hoja.');

        return result;
    }

    let subRow = -1;
    for (let r = header.row + 1; r < Math.min(rows.length, header.row + 4) && subRow === -1; r++) {
        if ((rows[r] ?? []).some((cell) => key(cell) === 'METRADO')) {
            subRow = r;
        }
    }
    if (subRow === -1) {
        result.warnings.push('No se encontraron columnas "METRADO".');

        return result;
    }

    const columnas: Array<{ col: number; mes: string }> = [];
    let contratadoCol = -1;
    (rows[subRow] ?? []).forEach((cell, col) => {
        if (key(cell) !== 'METRADO') {
            return;
        }
        let fecha: string | null = null;
        for (let r = subRow - 1; r >= header.row && !fecha; r--) {
            fecha = cellDate(rows[r]?.[col]) ?? cellDate(rows[r]?.[col - 1]);
        }
        if (fecha) {
            columnas.push({ col, mes: fecha.slice(0, 7) });
        } else if (contratadoCol === -1) {
            contratadoCol = col;
        }
    });

    const conDatos = new Set<string>();
    for (let r = subRow + 1; r < rows.length; r++) {
        const row = rows[r] ?? [];
        if (key(row[header.item]).startsWith('COSTO DIRECTO')) {
            break;
        }
        const codigo = text(row[header.item]);
        if (!CODIGO.test(codigo)) {
            continue;
        }
        const contratado = contratadoCol === -1 ? null : numberString(row[contratadoCol]);
        if (contratado !== null) {
            result.contratados[codigo] = contratado;
        }
        for (const { col, mes } of columnas) {
            const metrado = numberString(row[col]);
            if (metrado !== null && Number(metrado) !== 0) {
                (result.metrados[codigo] ??= {})[mes] = metrado;
                conDatos.add(mes);
            }
        }
    }

    result.meses = [...conDatos].sort();
    if (Object.keys(result.metrados).length === 0) {
        result.warnings.push('La hoja no tiene metrados por mes.');
    }

    return result;
}
