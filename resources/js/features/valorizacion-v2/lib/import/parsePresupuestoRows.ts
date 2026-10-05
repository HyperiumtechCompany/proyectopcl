import type { PartidaInput, PartidaRow } from '../../types/partida';
import { calcPartidaTotal } from '../budget';
import { parseDecimal } from '../money';
import type { RatioString } from '../money';
import { fromCodigos } from '../presupuestoOps';
import { CODIGO, key, numberString, text } from './cells';
import type { Cell } from './cells';

/**
 * Convierte las filas de una hoja tipo PRESUPUESTO (matriz de celdas, venga de
 * SheetJS, CSV o un pegado) en partidas planas. No depende de ninguna librería
 * de Excel: el lector (data/importers) solo entrega `unknown[][]`.
 *
 * Detecta sola la cabecera (ITEM · DESCRIPCIÓN · UND · METRADO · P.UND · TOTAL),
 * lee hasta "COSTO DIRECTO" y del pie saca %GG, %UTILIDAD e %IGV.
 */

export interface ParsedPresupuesto {
    partidas: PartidaInput[];
    parametros: { gastosGenerales: RatioString | null; utilidad: RatioString | null; igv: RatioString | null };
    /** Totales que trae el propio Excel, para verificar el cálculo. */
    excel: { costoDirecto: string | null; total: string | null };
    warnings: string[];
}

interface Columns {
    headerRow: number;
    item: number;
    descripcion: number;
    unidad: number;
    metrado: number;
    precio: number;
    total: number;
}

function findColumns(rows: Cell[][]): Columns | null {
    for (let r = 0; r < Math.min(rows.length, 60); r++) {
        const row = rows[r] ?? [];
        const item = row.findIndex((cell) => key(cell) === 'ITEM');
        const descripcion = row.findIndex((cell) => key(cell).startsWith('DESCRIP'));
        if (item === -1 || descripcion === -1) {
            continue;
        }

        // UND/METRADO/P.UND/TOTAL suelen estar en la fila siguiente (cabecera de 2 filas).
        const find = (pattern: RegExp): number => {
            for (const candidate of [rows[r], rows[r + 1], rows[r + 2]]) {
                const index = (candidate ?? []).findIndex((cell) => pattern.test(key(cell)));
                if (index !== -1) {
                    return index;
                }
            }

            return -1;
        };
        const columns = {
            headerRow: r,
            item,
            descripcion,
            unidad: find(/^(UND|UNID|UNIDAD)\.?$/),
            metrado: find(/^METRADO/),
            precio: find(/^(P\.?\s?UND|P\.?\s?U\.?|PRECIO|P\.?\s?UNIT)/),
            total: find(/^(TOTAL|PARCIAL)/),
        };
        if (columns.unidad !== -1 && columns.metrado !== -1 && columns.precio !== -1) {
            return columns;
        }
    }

    return null;
}

/** Primera fracción (0 < x < 1) entre la etiqueta y la columna total: la tasa del pie. */
function rateIn(row: Cell[], from: number, to: number): RatioString | null {
    for (let c = from; c < to; c++) {
        const value = parseDecimal(typeof row[c] === 'number' ? String(row[c]) : text(row[c]));
        if (value && value.gt(0) && value.lt(1)) {
            return value.toString();
        }
    }

    return null;
}

export function parsePresupuestoRows(rows: Cell[][]): ParsedPresupuesto {
    const warnings: string[] = [];
    const result: ParsedPresupuesto = {
        partidas: [],
        parametros: { gastosGenerales: null, utilidad: null, igv: null },
        excel: { costoDirecto: null, total: null },
        warnings,
    };

    const cols = findColumns(rows);
    if (!cols) {
        warnings.push('No se encontró la cabecera ITEM / DESCRIPCIÓN / UND / METRADO / P.UND en la hoja.');

        return result;
    }

    let inFooter = false;
    const seen = new Set<string>();
    const rowsLeidas: PartidaRow[] = [];

    for (let r = cols.headerRow + 1; r < rows.length; r++) {
        const row = rows[r] ?? [];
        const label = key(row[cols.item]) || key(row[cols.descripcion]);

        if (label.startsWith('COSTO DIRECTO')) {
            inFooter = true;
            result.excel.costoDirecto = numberString(row[cols.total]);
            continue;
        }
        if (inFooter) {
            if (label.startsWith('GASTOS GENERALES')) {
                result.parametros.gastosGenerales = rateIn(row, cols.item + 1, cols.total);
            } else if (label.startsWith('UTILIDAD')) {
                result.parametros.utilidad = rateIn(row, cols.item + 1, cols.total);
            } else if (label.startsWith('IGV')) {
                result.parametros.igv = rateIn(row, cols.item + 1, cols.total);
            } else if (label.startsWith('MONTO') || label.startsWith('TOTAL')) {
                result.excel.total = numberString(row[cols.total]);
            }
            continue;
        }

        const codigo = text(row[cols.item]);
        if (codigo === '') {
            continue;
        }
        if (!CODIGO.test(codigo)) {
            // Subtítulos de cabecera repetida, notas, etc.
            if (text(row[cols.descripcion]) !== '') {
                warnings.push(`Fila ${r + 1}: "${codigo}" no es un código de ítem válido; se omitió.`);
            }
            continue;
        }
        if (seen.has(codigo)) {
            warnings.push(`Fila ${r + 1}: código ${codigo} repetido; se omitió.`);
            continue;
        }
        seen.add(codigo);

        const unidad = text(row[cols.unidad]) || null;
        const metrado = numberString(row[cols.metrado]);
        const precioUnitario = numberString(row[cols.precio]);
        rowsLeidas.push({ codigo, descripcion: text(row[cols.descripcion]), unidad, metrado, precioUnitario });

        const esPartida = unidad !== null || metrado !== null || precioUnitario !== null;
        if (esPartida && unidad === null) {
            warnings.push(`${codigo}: partida sin unidad de medida.`);
        }
        if (esPartida && (metrado === null || precioUnitario === null)) {
            warnings.push(`${codigo}: falta ${metrado === null ? 'metrado' : 'precio unitario'}.`);
        }
        const totalExcel = numberString(row[cols.total]);
        if (esPartida && totalExcel !== null && metrado !== null && precioUnitario !== null) {
            const calculado = calcPartidaTotal(metrado, precioUnitario);
            if (!calculado.eq(totalExcel)) {
                warnings.push(`${codigo}: total del Excel ${totalExcel} ≠ metrado × P.U. = ${calculado.toFixed(2)}.`);
            }
        }
    }

    const { partidas, renumerados } = fromCodigos(rowsLeidas);
    result.partidas = partidas;
    if (renumerados.length > 0) {
        const muestra = renumerados.slice(0, 5).map((r) => `${r.antes} → ${r.despues}`).join(', ');
        warnings.push(`Se renumeraron ${renumerados.length} códigos por huecos en la numeración: ${muestra}${renumerados.length > 5 ? '…' : ''}.`);
    }
    if (result.partidas.length === 0) {
        warnings.push('La hoja no contiene partidas con código de ítem.');
    }
    if (!result.parametros.gastosGenerales || !result.parametros.utilidad || !result.parametros.igv) {
        warnings.push('No se encontraron todas las tasas del pie (GG / Utilidad / IGV); se conservan las actuales.');
    }

    return result;
}
