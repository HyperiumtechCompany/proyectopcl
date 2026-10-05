import { parseDecimal } from '../money';

/** Utilitarios para leer celdas de hojas de cálculo (venga de SheetJS, CSV o un pegado). */

export type Cell = unknown;

const NBSP = new RegExp(String.fromCharCode(160), 'g');

/** Texto limpio: sin espacios duros ni dobles. */
export const text = (cell: Cell): string =>
    cell === null || cell === undefined ? '' : String(cell).replace(NBSP, ' ').replace(/\s+/g, ' ').trim();

/** Texto para comparar cabeceras: mayúsculas y sin tildes. */
export const key = (cell: Cell): string =>
    text(cell)
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toUpperCase();

export const CODIGO = /^\d+(\.\d+)*$/;

/** Número exacto como string ("1,932.21" → "1932.21"); vacío o inválido → null. */
export function numberString(cell: Cell): string | null {
    if (cell === null || cell === undefined || cell === '') {
        return null;
    }
    const parsed = parseDecimal(typeof cell === 'number' ? String(cell) : text(cell));

    return parsed === null ? null : parsed.toString();
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/** Fecha de celda → "YYYY-MM-DD": número de serie de Excel, Date o texto ISO. */
export function cellDate(cell: Cell): string | null {
    if (typeof cell === 'number' && cell > 20000 && cell < 80000) {
        return new Date(EXCEL_EPOCH + Math.round(cell) * 86_400_000).toISOString().slice(0, 10);
    }
    if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
        return `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, '0')}-${String(cell.getDate()).padStart(2, '0')}`;
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text(cell));

    return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

/** Fila de cabecera (la que contiene ITEM y DESCRIPCIÓN) y sus columnas. */
export function findItemHeader(rows: Cell[][]): { row: number; item: number; descripcion: number } | null {
    for (let r = 0; r < Math.min(rows.length, 60); r++) {
        const cells = rows[r] ?? [];
        const item = cells.findIndex((cell) => key(cell) === 'ITEM');
        const descripcion = cells.findIndex((cell) => key(cell).startsWith('DESCRIP'));
        if (item !== -1 && descripcion !== -1) {
            return { row: r, item, descripcion };
        }
    }

    return null;
}
