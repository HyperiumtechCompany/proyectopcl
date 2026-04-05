import type { ColumnDef, ColumnType } from '@/types/presupuestos';

export function getExcelColumnName(colIndex: number): string {
    let result = '';
    let temp = colIndex;
    while (temp >= 0) {
        result = String.fromCharCode((temp % 26) + 65) + result;
        temp = Math.floor(temp / 26) - 1;
    }
    return result;
}

export function recalculateWBS(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    const counts: number[] = [];
    return rows.map((row) => {
        const level = getWbsLevel(String(row['partida'] || '1'));

        if (counts.length < level) {
            while (counts.length < level) counts.push(0);
        } else if (counts.length > level) {
            counts.length = level;
        }

        counts[level - 1]++;

        const newPartida = counts.map((c) => String(c).padStart(2, '0')).join('.');
        return { ...row, partida: newPartida };
    });
}

export function recalculateTreeAndSums(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    const counts: number[] = [];
    const results = [...rows];
    // first pass: WBS
    for (let i = 0; i < results.length; i++) {
        const row = { ...results[i] };
        const level = getWbsLevel(String(row['partida'] || '1'));
        if (counts.length < level) {
            while (counts.length < level) counts.push(0);
        } else if (counts.length > level) {
            counts.length = level;
        }
        counts[level - 1]++;
        row.partida = counts.map((c) => String(c).padStart(2, '0')).join('.');
        results[i] = row;
    }

    // second pass: Sums
    const stack: { index: number; level: number; parcial: number }[] = [];
    for (let r = results.length - 1; r >= 0; r--) {
        const row = results[r];
        const isPartida = !isTitle(row);
        const level = getWbsLevel(String(row['partida'] || '1'));
        if (isPartida) {
            const metrado = Number(row['metrado']) || 0;
            const precio = Number(row['precio_unitario']) || 0;
            const parcial = metrado * precio;
            results[r].parcial = parcial;
            while (stack.length > 0 && stack[stack.length - 1].level > level) { stack.pop(); }
            stack.push({ index: r, level, parcial });
        } else {
            let sum = 0;
            while (stack.length > 0 && stack[stack.length - 1].level > level) {
                const child = stack.pop()!;
                if (child.level === level + 1) sum += child.parcial;
            }
            results[r].parcial = sum;
            stack.push({ index: r, level, parcial: sum });
        }
    }
    return results;
}

export function getWbsLevel(partida: string): number {
    if (!partida) return 1;
    return String(partida).split('.').filter(Boolean).length;
}

export function isTitle(row: Record<string, unknown>): boolean {
    // Es un título si no tiene unidad o la unidad está vacía
    const unidad = row['unidad'];
    return !unidad || String(unidad).trim() === '';
}

/**
 * Calcula el siguiente código correlativo.
 * targetLevel: 1 para Título, 2 para Subtítulo, 3 para Partida
 */
export function generateNextWbsCode(
    rows: Record<string, unknown>[],
    insertIndex: number, // Índice de la fila seleccionada (base 0)
    targetLevel: number,
): string {
    if (rows.length === 0) {
        return targetLevel === 1 ? '01' : targetLevel === 2 ? '01.01' : '01.01.01';
    }

    // Buscar hacia atrás desde el insertIndex para encontrar el nodo "padre" o "hermano"
    let prevCode = '';
    for (let i = insertIndex; i >= 0; i--) {
        const code = String(rows[i]?.['partida'] || '');
        if (code) {
            const level = getWbsLevel(code);
            if (level <= targetLevel) {
                prevCode = code;
                break;
            }
        }
    }

    if (!prevCode) {
        // No hay hermanos ni padres arriba, iniciar desde 1
        const parts = Array(targetLevel).fill('01');
        return parts.join('.');
    }

    const prevLevel = getWbsLevel(prevCode);

    // Si queremos añadir un Nivel 1
    if (targetLevel === 1) {
        if (prevLevel === 1) {
            // "01" -> "02"
            return String(parseInt(prevCode, 10) + 1).padStart(2, '0');
        } else {
            // El previo es "01.02", queremos un Nivel 1. Su padre Nivel 1 era "01", el nuevo es "02"
            const parts = prevCode.split('.');
            return String(parseInt(parts[0], 10) + 1).padStart(2, '0');
        }
    }

    // Si queremos añadir un Subtitular o Partida (Nivel > 1)
    if (targetLevel > 1) {
        const parts = prevCode.split('.'); // ej: ['01', '01']

        if (prevLevel === targetLevel) {
            // Hermano: "01.01" -> "01.02"
            parts[targetLevel - 1] = String(parseInt(parts[targetLevel - 1], 10) + 1).padStart(2, '0');
            return parts.slice(0, targetLevel).join('.');
        } else if (prevLevel < targetLevel) {
            // Hijo: "01" -> "01.01", "01.01" -> "01.01.01"
            const newParts = [...parts];
            // Rellenar hasta el nivel objetivo
            while (newParts.length < targetLevel) {
                newParts.push('01');
            }
            return newParts.join('.');
        } else {
            // Hermano del ancestro: "01.01.01" -> (targetLevel 2) "01.02"
            const newParts = parts.slice(0, targetLevel);
            newParts[targetLevel - 1] = String(parseInt(newParts[targetLevel - 1], 10) + 1).padStart(2, '0');
            return newParts.join('.');
        }
    }

    return '01';
}


export function formatCellValue(
    value: unknown,
    type: ColumnType,
): { v: unknown; m: string; ct: { fa: string; t: string } } {
    if (value === null || value === undefined || value === '') {
        return { v: '', m: '', ct: { fa: 'General', t: 'g' } };
    }

    if (type === 'json') {
        const text = typeof value === 'string' ? value : JSON.stringify(value);
        return { v: text, m: text, ct: { fa: 'General', t: 'g' } };
    }

    if (type === 'number') {
        const n = Number(value);
        if (Number.isFinite(n)) {
            return { v: n, m: String(n), ct: { fa: '#,##0.0000', t: 'n' } };
        }
        return { v: value, m: String(value), ct: { fa: 'General', t: 'g' } };
    }

    return { v: value, m: String(value), ct: { fa: 'General', t: 'g' } };
}

export function rowsToLuckysheetData(
    rows: Record<string, unknown>[],
    columns: ColumnDef[],
    sheetName: string,
): any[] {
    const headerCells = columns.map((col, ci) => ({
        r: 0,
        c: ci,
        v: {
            v: col.label,
            m: col.label,
            ct: { fa: 'General', t: 'g' },
            bg: col.readonly ? '#e5e7eb' : '#dbeafe',
            bl: 1,
            fs: 10,
        },
    }));

    const results = recalculateTreeAndSums(rows);

    const dataCells: any[] = [];
    results.forEach((row, ri) => {
        const rowIsTitle = isTitle(row);
        const wbsLevel = getWbsLevel(String(row['partida'] || '1'));

        columns.forEach((col, ci) => {
            let value = row[col.key];

            if (value === null || value === undefined || value === '') {
                if (col.key === 'parcial') {
                    value = 0;
                } else {
                    return;
                }
            }

            const parsed = formatCellValue(value, col.type) as Record<string, any>;

            // Aplicar negrita si es un título (Nivel Padre)
            if (rowIsTitle) {
                parsed.bl = 1; // Bold
            }

            // Indentar la descripción jerárquicamente
            if (col.key === 'descripcion' && wbsLevel > 1) {
                const spaces = '\u00A0\u00A0\u00A0\u00A0'.repeat(wbsLevel - 1); // 4 espacios por nivel
                parsed.m = spaces + parsed.m;
            }

            dataCells.push({ r: ri + 1, c: ci, v: parsed });
        });
    });

    const columnlen: Record<number, number> = {};
    columns.forEach((col, ci) => {
        columnlen[ci] = col.width;
    });

    return [
        {
            name: sheetName,
            status: 1,
            order: 0,
            row: Math.max(rows.length + 12, 30),
            column: Math.max(columns.length, 6),
            celldata: [...headerCells, ...dataCells],
            config: {
                columnlen,
                rowlen: { 0: 28 },
            },
            frozen: { type: 'row', range: { row_focus: 0 } },
        },
    ];
}

export function parseCellForRow(value: unknown, column: ColumnDef): unknown {
    if (value === null || value === undefined || value === '') return null;

    if (column.type === 'number') {
        const n = Number(value);
        return Number.isFinite(n) ? n : value;
    }

    if (column.type === 'json') {
        if (Array.isArray(value)) return value;
        if (typeof value === 'object') return value;
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        if (!trimmed) return null;
        try {
            return JSON.parse(trimmed);
        } catch {
            return null;
        }
    }

    return String(value);
}

export function luckysheetDataToRows(
    sheets: any[],
    columns: ColumnDef[],
): Record<string, unknown>[] {
    if (!Array.isArray(sheets) || sheets.length === 0) return [];
    const data = sheets[0]?.data || [];
    const editableColumns = columns.filter((c) => !c.readonly);
    const result: Record<string, unknown>[] = [];

    for (let r = 1; r < data.length; r++) {
        const row: Record<string, unknown> = {};
        let hasAnyEditableValue = false;

        columns.forEach((column, ci) => {
            const raw = data[r]?.[ci]?.v;
            const parsed = parseCellForRow(raw, column);
            if (!column.readonly) {
                row[column.key] = parsed;
                if (parsed !== null && parsed !== '') {
                    hasAnyEditableValue = true;
                }
            }
        });

        if (hasAnyEditableValue && editableColumns.length > 0) {
            result.push(row);
        }
    }

    return result;
}
