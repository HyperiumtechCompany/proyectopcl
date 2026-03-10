import ExcelJS from 'exceljs';

interface DesagueData {
    ud?: any;
    colector?: any;
    cajas?: any;
    uv?: any;
    trampa?: any;
    sumatoria?: any;
}

const COLORS = {
    TITLE_BG: 'FF4F4F4F',
    TITLE_TEXT: 'FFFFFFFF',
    HEADER_BG: 'FF6D6D6D',
    HEADER_TEXT: 'FFFFFFFF',
    TOTAL_BG: 'FFD9D9D9',
    TOTAL_TEXT: 'FF000000',
    BORDER: 'FFA0A0A0',
    YELLOW: 'FFFFC000',
    GREEN: 'FF8BC34A',
};

// Funciones auxiliares
function paintTitle(ws: ExcelJS.Worksheet, cols: number, text: string, bgColor?: string) {
    ws.mergeCells(1, 1, 1, cols);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = text;
    titleCell.font = { bold: true, size: 16, color: { argb: COLORS.TITLE_TEXT } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor || COLORS.TITLE_BG } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.border = {
        top: { style: 'thin', color: { argb: COLORS.BORDER } },
        left: { style: 'thin', color: { argb: COLORS.BORDER } },
        bottom: { style: 'thin', color: { argb: COLORS.BORDER } },
        right: { style: 'thin', color: { argb: COLORS.BORDER } }
    };
    ws.getRow(1).height = 30;
}

function paintHeaders(ws: ExcelJS.Worksheet, headers: string[], startRow: number = 3, bgColor?: string) {
    const headerRow = ws.getRow(startRow);
    headers.forEach((header, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = header;
        cell.font = { bold: true, color: { argb: bgColor ? 'FF000000' : COLORS.HEADER_TEXT }, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor || COLORS.HEADER_BG } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'thin', color: { argb: COLORS.BORDER } },
            left: { style: 'thin', color: { argb: COLORS.BORDER } },
            bottom: { style: 'thin', color: { argb: COLORS.BORDER } },
            right: { style: 'thin', color: { argb: COLORS.BORDER } }
        };
    });
}

function paintTotal(ws: ExcelJS.Worksheet, row: number, cols: number, labelCol: number, label: string, values: Record<number, any> = {}) {
    const totalRow = ws.getRow(row);
    for (let c = 1; c <= cols; c++) {
        const cell = totalRow.getCell(c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TOTAL_BG } };
        cell.font = { bold: true, color: { argb: COLORS.TOTAL_TEXT } };
        cell.border = {
            top: { style: 'thin', color: { argb: COLORS.BORDER } },
            left: { style: 'thin', color: { argb: COLORS.BORDER } },
            bottom: { style: 'thin', color: { argb: COLORS.BORDER } },
            right: { style: 'thin', color: { argb: COLORS.BORDER } }
        };
        cell.alignment = { horizontal: c === labelCol ? 'left' : 'center', vertical: 'middle' };
        if (c === labelCol) {
            cell.value = label;
        } else if (values[c] !== undefined) {
            cell.value = values[c];
            if (typeof values[c] === 'number') cell.numFmt = '0';
        }
    }
    totalRow.height = 22;
}

function applyRowStyle(row: ExcelJS.Row, colCount: number, integerCols: number[] = []) {
    for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.border = {
            top: { style: 'thin', color: { argb: COLORS.BORDER } },
            left: { style: 'thin', color: { argb: COLORS.BORDER } },
            bottom: { style: 'thin', color: { argb: COLORS.BORDER } },
            right: { style: 'thin', color: { argb: COLORS.BORDER } }
        };
        cell.alignment = {
            horizontal: c === 1 ? 'left' : 'center',
            vertical: 'middle'
        };
        if (integerCols.includes(c) && typeof cell.value === 'number') {
            cell.numFmt = '0';
        }
    }
}

export async function exportDesagueToExcel(dataSheet: Record<string, any>, fileName: string = 'Calculo_Desague') {
    try {
        const workbook = new ExcelJS.Workbook();

        // ========== HOJA 1: UNIDADES DE DESCARGA ==========
        const wsUD = workbook.addWorksheet('Unidades de Descarga');
        wsUD.columns = [
            { width: 3  }, { width: 25 }, { width: 40 }, { width: 10 },
            { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 },
            { width: 10 }, { width: 8  },
        ];

        const AMAR  = 'FFFFFF99'; const VERD  = 'FFD9E8C4'; const VERDE = 'FF92D050';
        const AZUL1 = 'FFE8F0FB'; const AZUL2 = 'FFDCE6F1'; const BORDH = 'FF999933';
        const BORD  = 'FFA0A0A0'; const NEGRO = 'FF000000'; const ROJO  = 'FFCC0000';
        const BLANC = 'FFFFFFFF';
        const bT = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: BORDH } };
        const bM = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: BORDH } };
        const bD = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: BORD  } };

        function udFill(r: number, argb: string, h = 17) {
            wsUD.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLANC } };
            for (let c = 2; c <= 10; c++)
                wsUD.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
            wsUD.getRow(r).height = h;
        }

        // ── Leer datos del frontend ───────────────────────────────────────────
        // FIX: los datos de UD están en dataSheet.ud (no en dataSheet directamente)
        const udData = dataSheet.ud ?? dataSheet;
        const anexoRows: any[]                      = Array.isArray(udData.anexo)  ? udData.anexo  : [];
        const gradesActive: Record<string, boolean> = udData.grades || {};
        const tablesData: Record<string, any>       = udData.tables || {};

        // Columnas fijas en orden (igual que frontend PREFERRED_ORDER)
        const COLS_KEYS   = ['inodoro', 'urinario', 'lavatorio', 'ducha', 'lavadero', 'sumidero'];
        const COLS_LABELS = ['Inodoro', 'Urinario', 'Lavatorio', 'Ducha', 'Lavadero', 'SUMIDERO'];
        const DEFAULT_MULTS: Record<string, number> = {
            inodoro: 4, urinario: 4, lavatorio: 2, ducha: 4, lavadero: 3, sumidero: 2
        };

        // Aplanar árbol de módulos a filas planas para excel
        function flattenGrade(gradeData: any): any[] {
            const mults: Record<string, number> = { ...DEFAULT_MULTS, ...(gradeData.multipliers || {}) };
            const rows: any[] = [];
            (gradeData.modules || []).forEach((mod: any) => {
                rows.push({ isModulo: true, nivel: mod.name ?? '' });
                const pushDetail = (d: any, nivelLabel: string) => {
                    const row: any = { nivel: nivelLabel, descripcion: d.desc ?? '' };
                    let ud = 0;
                    COLS_KEYS.forEach(col => {
                        const q = parseFloat(String(d.qty?.[col] ?? '')) || 0;
                        if (q > 0) { row[col] = q; ud += q * (mults[col] ?? 0); }
                    });
                    row.ud = ud > 0 ? ud : null;
                    rows.push(row);
                };
                (mod.details  || []).forEach((d: any)  => pushDetail(d, d.nivel ?? ''));
                (mod.children || []).forEach((ch: any) => {
                    rows.push({ nivel: ch.nivel ?? '', descripcion: ch.desc ?? '' });
                    (ch.details || []).forEach((gd: any) => pushDetail(gd, ''));
                });
            });
            return rows;
        }

        // Niveles activos en orden
        const GRADE_ORDER: { key: string; label: string }[] = [
            { key: 'inicial',    label: 'INICIAL'    },
            { key: 'primaria',   label: 'PRIMARIA'   },
            { key: 'secundaria', label: 'SECUNDARIA' },
        ].filter(g => gradesActive[g.key]);

        // ══════════════════════════════════════════════════════════════════════
        // TABLA ANEXO-06 — siempre se exporta
        // ══════════════════════════════════════════════════════════════════════
        udFill(1, BLANC, 22);
        for (let c = 2; c <= 4; c++) {
            wsUD.getCell(1, c).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } };
            wsUD.getCell(1, c).border = { top: bM, left: c === 2 ? bM : undefined, bottom: bM, right: c === 4 ? bM : undefined };
        }
        wsUD.getCell(1, 2).value     = 'ANEXO 07.  CALCULO DE LAS UNIDADES DE DESCARGA';
        wsUD.getCell(1, 2).font      = { bold: true, size: 11, name: 'Arial', color: { argb: NEGRO } };
        wsUD.getCell(1, 2).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

        udFill(2, BLANC, 8);

        udFill(3, BLANC, 20);
        for (let c = 2; c <= 4; c++) {
            wsUD.getCell(3, c).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMAR } };
            wsUD.getCell(3, c).border = { top: bM, left: c === 2 ? bM : bT, bottom: bT, right: c === 4 ? bM : bT };
        }
        wsUD.getCell(3, 2).value     = 'ANEXO N° 06';
        wsUD.getCell(3, 2).font      = { bold: true, size: 11, name: 'Arial', color: { argb: NEGRO } };
        wsUD.getCell(3, 2).alignment = { horizontal: 'center', vertical: 'middle' };

        udFill(4, BLANC, 20);
        ['Aparato Sanitario', 'TIPO', 'Total'].forEach((txt, i) => {
            const cell     = wsUD.getCell(4, i + 2);
            cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMAR } };
            cell.value     = txt;
            cell.font      = { bold: true, size: 10, name: 'Arial', color: { argb: NEGRO } };
            cell.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle' };
            cell.border    = { top: bT, left: i === 0 ? bM : bT, bottom: bM, right: i === 2 ? bM : bT };
        });

        let row = 5;
        (anexoRows.length > 0 ? anexoRows : [
            { aparato: 'Inodoro',                 tipo: 'Con Tanque - Descarga reducida',                ud: 2 },
            { aparato: 'Inodoro',                 tipo: 'Con Tanque',                                    ud: 4 },
            { aparato: 'Inodoro',                 tipo: 'C/ Válvula semiautomática y automática',         ud: 8 },
            { aparato: 'Inodoro',                 tipo: 'C/ Válvula semiaut. desc. reducida',             ud: 4 },
            { aparato: 'Lavatorio',               tipo: 'Corriente',                                      ud: 2 },
            { aparato: 'Lavadero',                tipo: 'Cocina, ropa',                                   ud: 2 },
            { aparato: 'Lavadero con triturador', tipo: '-',                                              ud: 3 },
            { aparato: 'Ducha',                   tipo: '-',                                              ud: 3 },
            { aparato: 'Tina',                    tipo: '-',                                              ud: 3 },
            { aparato: 'Urinario',                tipo: 'Con Tanque',                                     ud: 4 },
            { aparato: 'Urinario',                tipo: 'C/ Válvula semiautomática y automática',         ud: 8 },
            { aparato: 'Urinario',                tipo: 'C/ Válvula semiaut. desc. reducida',             ud: 4 },
            { aparato: 'Urinario',                tipo: 'Múltiple',                                       ud: 4 },
            { aparato: 'Bebedero',                tipo: 'Simple',                                         ud: 2 },
            { aparato: 'Sumidero',                tipo: 'Simple',                                         ud: 2 },
        ]).forEach((v: any) => {
            udFill(row, BLANC, 17);
            for (let c = 2; c <= 4; c++) {
                const cell = wsUD.getCell(row, c);
                cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLANC } };
                cell.border    = { top: bD, left: c === 2 ? bM : bD, bottom: bD, right: c === 4 ? bM : bD };
                cell.alignment = { horizontal: c <= 3 ? 'left' : 'center', vertical: 'middle' };
                cell.font      = { size: 10, name: 'Arial', color: { argb: NEGRO } };
            }
            wsUD.getCell(row, 2).value  = v.aparato ?? v.description ?? '';
            wsUD.getCell(row, 3).value  = v.tipo    ?? v.notes ?? '';
            wsUD.getCell(row, 4).value  = v.ud      ?? v.total ?? 0;
            wsUD.getCell(row, 4).numFmt = '0';
            row++;
        });

        // ── Fila TOTAL Anexo-06 ───────────────────────────────────────────────
        udFill(row, 'FFFFCC00', 22);
        for (let c = 2; c <= 4; c++) {
            const cell = wsUD.getCell(row, c);
            cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC00' } };
            cell.font      = { bold: true, size: 10, name: 'Arial', color: { argb: NEGRO } };
            cell.border    = { top: bM, left: c === 2 ? bM : bT, bottom: bM, right: c === 4 ? bM : bT };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        wsUD.getCell(row, 2).value     = 'TOTAL ANEXO N° 06 =';
        wsUD.getCell(row, 2).alignment = { horizontal: 'right', vertical: 'middle' };
        wsUD.getCell(row, 3).value     = '';
        const anexoStartRow = 5;
        wsUD.getCell(row, 4).value  = { formula: `SUM(D${anexoStartRow}:D${row - 1})` };
        wsUD.getCell(row, 4).numFmt = '0';
        row++;

        udFill(row, BLANC, 8); row++;
        udFill(row, BLANC, 8); row++;

        // ══════════════════════════════════════════════════════════════════════
        // TABLAS POR NIVEL ACTIVO
        // ══════════════════════════════════════════════════════════════════════
        const resumenRefs: { label: string; tStart: number; rowTotal: number }[] = [];

        GRADE_ORDER.forEach(({ key, label }) => {
            const gradeData = tablesData[key] || { modules: [], multipliers: {} };
            const mults: Record<string, number> = { ...DEFAULT_MULTS, ...(gradeData.multipliers || {}) };
            const filas = flattenGrade(gradeData);

            const aparatosHdr = COLS_KEYS.map((k, i) => ({ nombre: COLS_LABELS[i], ud: mults[k] ?? DEFAULT_MULTS[k] }));

            // ── 3 filas encabezado ────────────────────────────────────────────
            const [rA, rB, rC] = [row, row + 1, row + 2];

            udFill(rA, BLANC, 20);
            for (let c = 2; c <= 10; c++) {
                const cell = wsUD.getCell(rA, c);
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: (c >= 4 && c <= 9) ? VERD : AMAR } };
                cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: NEGRO } };
                if      (c === 2)  { cell.value = 'NIVEL';       cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = { top: bM, left: bM, bottom: undefined, right: bT }; }
                else if (c === 3)  { cell.value = 'DESCRIPCION'; cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = { top: bM, left: bT, bottom: undefined, right: bT }; }
                else if (c === 4)  { cell.value = `SUMATORIA DE GASTOS POR ACCESORIOS - ${label}`; cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }; cell.border = { top: bM, left: bM, bottom: bT, right: undefined }; }
                else if (c >= 5 && c <= 8) { cell.border = { top: bM, left: undefined, bottom: bT, right: undefined }; }
                else if (c === 9)  { cell.border = { top: bM, left: undefined, bottom: bT, right: bT }; }
                else if (c === 10) { cell.value = 'U.D'; cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = { top: bM, left: bT, bottom: undefined, right: bM }; }
            }

            udFill(rB, AMAR, 16);
            for (let c = 2; c <= 10; c++) {
                const cell = wsUD.getCell(rB, c);
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMAR } };
                cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: NEGRO } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                if      (c === 2)  cell.border = { top: undefined, left: bM, bottom: undefined, right: bT };
                else if (c === 3)  cell.border = { top: undefined, left: bT, bottom: undefined, right: bT };
                else if (c === 10) cell.border = { top: undefined, left: bT, bottom: undefined, right: bM };
                else { cell.value = aparatosHdr[c - 4].nombre; cell.border = { top: bT, left: c === 4 ? bM : bT, bottom: bT, right: bT }; }
            }

            udFill(rC, AMAR, 16);
            for (let c = 2; c <= 10; c++) {
                const cell = wsUD.getCell(rC, c);
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMAR } };
                cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: NEGRO } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                if      (c === 2)  cell.border = { top: undefined, left: bM, bottom: bM, right: bT };
                else if (c === 3)  cell.border = { top: undefined, left: bT, bottom: bM, right: bT };
                else if (c === 10) cell.border = { top: undefined, left: bT, bottom: bM, right: bM };
                else { cell.value = `${aparatosHdr[c - 4].ud} U.D.`; cell.border = { top: bT, left: c === 4 ? bM : bT, bottom: bM, right: bT }; }
            }
            row += 3;

            // ── Filas de datos ────────────────────────────────────────────────
            const tStart = row;
            filas.forEach((item: any, idx: number) => {
                const isModulo = item.isModulo ?? false;
                const bg = isModulo ? BLANC : (idx % 2 === 0 ? AZUL1 : AZUL2);
                udFill(row, bg, 17);
                for (let c = 2; c <= 10; c++) {
                    const cell = wsUD.getCell(row, c);
                    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                    cell.font      = { bold: isModulo, size: 10, name: 'Arial', color: { argb: isModulo ? ROJO : NEGRO } };
                    cell.alignment = { horizontal: c <= 3 ? 'left' : 'center', vertical: 'middle' };
                    cell.border    = { top: bD, left: c === 2 ? bM : bD, bottom: bD, right: c === 10 ? bM : bD };
                }
                wsUD.getCell(row, 2).value = item.nivel       ?? '';
                wsUD.getCell(row, 3).value = item.descripcion ?? '';
                if (!isModulo) {
                    COLS_KEYS.forEach((col, i) => {
                        const cell = wsUD.getCell(row, 4 + i);
                        const v = item[col];
                        cell.value = (v !== null && v !== undefined && v !== '') ? v : null;
                        if (typeof v === 'number') cell.numFmt = '0';
                    });
                    const ud = item.ud ?? null;
                    wsUD.getCell(row, 10).value = ud;
                    if (typeof ud === 'number') wsUD.getCell(row, 10).numFmt = '0';
                }
                row++;
            });

            // ── Fila TOTAL ────────────────────────────────────────────────────
            const rowTotal = row;
            udFill(row, 'FFFFCC00', 22);
            for (let c = 2; c <= 10; c++) {
                const cell = wsUD.getCell(row, c);
                cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC00' } };
                cell.font      = { bold: true, size: 10, name: 'Arial', color: { argb: NEGRO } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border    = { top: bM, left: c === 2 ? bM : bT, bottom: bM, right: c === 10 ? bM : bT };
                if (c === 2) cell.value = 'TOTAL';
                if (c === 3) cell.value = 'TOTAL';
                if (c >= 4) {
                    const col = ['D', 'E', 'F', 'G', 'H', 'I', 'J'][c - 4];
                    cell.value  = { formula: `SUM(${col}${tStart}:${col}${row - 1})` };
                    cell.numFmt = '0';
                }
            }
            row++;

            resumenRefs.push({ label, tStart, rowTotal });
            for (let i = 0; i < 5; i++) { udFill(row, BLANC, 8); row++; }
        });

        // ══════════════════════════════════════════════════════════════════════
        // RESÚMENES FINALES — uno por nivel activo
        // ══════════════════════════════════════════════════════════════════════
        resumenRefs.forEach(({ label, tStart, rowTotal }) => {
            udFill(row, 'FFFFCC00', 24);
            wsUD.mergeCells(row, 2, row, 8);
            const labelCell = wsUD.getCell(row, 2);
            labelCell.value     = `UNIDADES DE DESCARGA TOTAL - ${label} =`;
            labelCell.font      = { bold: true, size: 10, name: 'Arial', color: { argb: NEGRO } };
            labelCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC00' } };
            labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
            labelCell.border    = { top: bM, left: bM, bottom: bM, right: bM };

            wsUD.getCell(row, 9).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC00' } };
            wsUD.getCell(row, 9).border = { top: bM, bottom: bM };

            const valCell = wsUD.getCell(row, 10);
            valCell.value     = { formula: `SUM(J${tStart}:J${rowTotal - 1})` };
            valCell.numFmt    = '0';
            valCell.font      = { bold: true, size: 11, name: 'Arial', color: { argb: NEGRO } };
            valCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC00' } };
            valCell.alignment = { horizontal: 'center', vertical: 'middle' };
            valCell.border    = { top: bM, left: bM, bottom: bM, right: bM };
            wsUD.getRow(row).height = 24;
            row++;

            for (let i = 0; i < 2; i++) { udFill(row, BLANC, 8); row++; }
        });

        for (let i = 0; i < 4; i++) { udFill(row, BLANC, 10); row++; }

         // ========== HOJA 2: COLECTOR ==========
        const wsCol = workbook.addWorksheet('Colector');
        wsCol.columns = [
            { width: 20 }, { width: 10 }, { width: 7  }, { width: 10 }, { width: 10 },
            { width: 12 }, { width: 12 }, { width: 12 }, { width: 8  }, { width: 28 },
            { width: 12 }, { width: 12 }, { width: 12 }, { width: 8  }, { width: 28 },
        ];

        const CC = 15;
        const cbT = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFA0A0A0' } };
        const cbM = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FF999933' } };
        const COL_BG_G   = 'FFF2F2F2';
        const COL_BG_V   = 'FF92D050';
        const COL_BG_CR1 = 'FFD4EDDA';
        const COL_BG_CR2 = 'FFD0E8FF';
        const COL_BG_DAT = 'FFFFFFFF';
        const COL_BG_ALT = 'FFE8F0FB';
        const COL_BG_TOT = 'FFFFCC00';
        const COL_BG_HDR: Record<string, string> = {
            inicial: 'FF1B5E20', primaria: 'FF0D47A1', secundaria: 'FF4A148C',
        };

        function colCell(r: number, c: number, val: any, opts: {
            bold?: boolean; size?: number; bg?: string; color?: string;
            halign?: ExcelJS.Alignment['horizontal']; numFmt?: string; wrapText?: boolean;
        } = {}) {
            const cell = wsCol.getCell(r, c);
            cell.value = val ?? null;
            cell.font  = { bold: opts.bold ?? false, size: opts.size ?? 9, name: 'Arial', color: { argb: opts.color ?? 'FF000000' } };
            if (opts.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.bg } };
            cell.alignment = { horizontal: opts.halign ?? 'center', vertical: 'middle', wrapText: opts.wrapText ?? false };
            cell.border = { top: cbT, left: cbT, bottom: cbT, right: cbT };
            if (opts.numFmt) cell.numFmt = opts.numFmt;
        }

        function colFillRow(r: number, bg: string, h = 17) {
            for (let c = 1; c <= CC; c++)
                wsCol.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            wsCol.getRow(r).height = h;
        }

        function fmtCF(val: number): string {
            if (val === 0) return '+0.00 m';
            return val > 0 ? `+${val.toFixed(2)} m` : `- ${Math.abs(val).toFixed(2)} m`;
        }

        const colectorRaw: Record<string, any[]> = dataSheet['colector'] || {};
        const colGrades = [
            { key: 'inicial',    label: 'INICIAL'    },
            { key: 'primaria',   label: 'PRIMARIA'   },
            { key: 'secundaria', label: 'SECUNDARIA' },
        ].filter(g => gradesActive[g.key]);

        let cr = 1;

        // Título general
        colFillRow(cr, COL_BG_V, 24);
        wsCol.mergeCells(cr, 1, cr, CC);
        const colTitulo = wsCol.getCell(cr, 1);
        colTitulo.value = 'ANEXO 08. DISEÑO DE COLECTORES';
        colTitulo.font  = { bold: true, size: 12, name: 'Arial', color: { argb: 'FF000000' } };
        colTitulo.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: COL_BG_V } };
        colTitulo.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        colTitulo.border = { top: cbM, left: cbM, bottom: cbM, right: cbM };
        wsCol.getRow(cr).height = 24;
        cr++;

        colGrades.forEach(({ key, label }) => {
            const colRows: any[] = Array.isArray(colectorRaw[key]) ? colectorRaw[key] : [];

            // Separador
            colFillRow(cr, 'FFFFFFFF', 6); cr++;

            // Encabezado del grado
            colFillRow(cr, COL_BG_HDR[key], 22);
            wsCol.mergeCells(cr, 1, cr, CC);
            const grHdr = wsCol.getCell(cr, 1);
            grHdr.value = `ANEXO 08. COLECTORES — ${label}`;
            grHdr.font  = { bold: true, size: 11, name: 'Arial', color: { argb: 'FFFFFFFF' } };
            grHdr.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: COL_BG_HDR[key] } };
            grHdr.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            grHdr.border = { top: cbM, left: cbM, bottom: cbM, right: cbM };
            cr++;

            // Cabecera fila A
            colFillRow(cr, COL_BG_G, 18);
            ['TRAMO', 'LONGITUD (m)', 'UD', 'DIAMETRO', 'PENDIENTE'].forEach((txt, i) => {
                colCell(cr, i + 1, txt, { bold: true, size: 9, bg: COL_BG_G });
            });
            wsCol.mergeCells(cr, 6, cr, 10);
            colCell(cr, 6,  `CAJA REGISTRO (${label})`, { bold: true, size: 9, bg: COL_BG_CR1 });
            wsCol.mergeCells(cr, 11, cr, 15);
            colCell(cr, 11, `CAJA REGISTRO (${label})`, { bold: true, size: 9, bg: COL_BG_CR2 });
            cr++;

            // Cabecera fila B
            colFillRow(cr, COL_BG_G, 16);
            for (let c = 1; c <= 5; c++) colCell(cr, c, '', { bg: COL_BG_G });
            ['N°', 'CT (m)', 'CF/CLL (m)', 'H (m)', 'DIMENSIONES'].forEach((txt, i) => {
                colCell(cr, 6  + i, txt, { bold: true, size: 9, bg: COL_BG_CR1 });
            });
            ['N°', 'CT (m)', 'CF/CLL (m)', 'H (m)', 'DIMENSIONES'].forEach((txt, i) => {
                colCell(cr, 11 + i, txt, { bold: true, size: 9, bg: COL_BG_CR2 });
            });
            cr++;

            // Filas de datos
            const dataStart = cr;
            if (colRows.length === 0) {
                colFillRow(cr, COL_BG_DAT, 17);
                for (let c = 1; c <= CC; c++) colCell(cr, c, '', { bg: COL_BG_DAT });
                cr++;
            } else {
                colRows.forEach((r: any, idx: number) => {
                    const isStatic = r.isStatic ?? false;
                    const bg = isStatic ? 'FFFFF3CD' : (idx % 2 === 0 ? COL_BG_DAT : COL_BG_ALT);
                    colFillRow(cr, bg, 17);
                    const cr1Num = `${r.cr1_num ?? ''} ${r.cr1_nval ?? ''}`.trim();
                    const cr2Num = `${r.cr2_num ?? ''} ${r.cr2_nval ?? ''}`.trim();
                    colCell(cr, 1,  r.tramo     ?? '', { bg, halign: 'left' });
                    colCell(cr, 2,  r.longitud  ?? 0,  { bg, numFmt: '0.00' });
                    colCell(cr, 3,  r.ud        ?? 0,  { bg, numFmt: '0' });
                    colCell(cr, 4,  r.diametro  ?? '', { bg });
                    colCell(cr, 5,  r.pendiente ?? '', { bg });
                    colCell(cr, 6,  cr1Num,             { bg });
                    colCell(cr, 7,  fmtCF(r.cr1_ct ?? 0), { bg });
                    colCell(cr, 8,  fmtCF(r.cr1_cf ?? 0), { bg });
                    colCell(cr, 9,  r.cr1_h  ?? 0,     { bg, numFmt: '0.00' });
                    colCell(cr, 10, r.cr1_dim ?? '',    { bg, halign: 'left', wrapText: true });
                    colCell(cr, 11, cr2Num,             { bg });
                    colCell(cr, 12, fmtCF(r.cr2_ct ?? 0), { bg });
                    colCell(cr, 13, fmtCF(r.cr2_cf ?? 0), { bg });
                    colCell(cr, 14, r.cr2_h  ?? 0,     { bg, numFmt: '0.00' });
                    colCell(cr, 15, r.cr2_dim ?? '',    { bg, halign: 'left', wrapText: true });
                    cr++;
                });
            }

            // Fila TOTAL
            colFillRow(cr, COL_BG_TOT, 20);
            wsCol.mergeCells(cr, 1, cr, 2);
            colCell(cr, 1, `TOTAL ${label}`, { bold: true, size: 10, bg: COL_BG_TOT, halign: 'right' });
            colCell(cr, 3, colRows.length > 0
                ? { formula: `SUM(C${dataStart}:C${cr - 1})` } : 0,
                { bold: true, bg: COL_BG_TOT, numFmt: '0' });
            for (let c = 4; c <= CC; c++) colCell(cr, c, null, { bg: COL_BG_TOT });
            cr++;
        });
        // ========== HOJA 3: CAJAS DE REGISTRO ==========
        const wsCajas = workbook.addWorksheet('Cajas de Registro');
        wsCajas.columns = [ { width: 10 }, { width: 18 }, { width: 15 }, { width: 15 }, { width: 30 } ];
        paintTitle(wsCajas, 5, 'CAJAS DE REGISTRO');
        paintHeaders(wsCajas, ['N°', 'PROFUNDIDAD (m)', 'DIÁMETRO (mm)', 'PENDIENTE (%)', 'MATERIALES']);
        const cajasData = dataSheet['cajas'] || [];
        let rowCajas = 4;
        (Array.isArray(cajasData) ? cajasData : []).forEach((caja: any, idx: number) => {
            const r = wsCajas.getRow(rowCajas);
            r.getCell(1).value = idx + 1;
            r.getCell(2).value = caja.profundidad || '';
            r.getCell(3).value = caja.diametro    || '';
            r.getCell(4).value = caja.pendiente   || '';
            r.getCell(5).value = caja.materiales  || '';
            applyRowStyle(r, 5, [2, 3, 4]);
            rowCajas++;
        });

        // ========== HOJA 4: UNIDADES DE VENTILACIÓN ==========
        const wsUV = workbook.addWorksheet('Ventilación');
        wsUV.columns = [ { width: 30 }, { width: 18 }, { width: 15 }, { width: 25 } ];
        paintTitle(wsUV, 4, 'UNIDADES DE VENTILACIÓN');
        paintHeaders(wsUV, ['DESCRIPCIÓN', 'DIÁMETRO (mm)', 'CANTIDAD', 'UBICACIÓN']);
        const uvData = dataSheet['uv'] || {};
        let rowUV = 4;
        Object.entries(uvData).forEach(([key, value]: [string, any]) => {
            if (!value) return;
            const r = wsUV.getRow(rowUV);
            r.getCell(1).value = key;
            r.getCell(2).value = value.diametro  || '';
            r.getCell(3).value = value.cantidad  || 0;
            r.getCell(4).value = value.ubicacion || '';
            applyRowStyle(r, 4, [2, 3]);
            rowUV++;
        });

        // ========== HOJA 5: TRAMPA DE GRASA ==========
        const wsTrampa = workbook.addWorksheet('Trampa de Grasa');
        wsTrampa.columns = [ { width: 30 }, { width: 20 }, { width: 15 } ];
        paintTitle(wsTrampa, 3, 'TRAMPA DE GRASA');
        paintHeaders(wsTrampa, ['PARÁMETRO', 'VALOR', 'UNIDAD']);
        const trampaData = dataSheet['trampa'] || {};
        let rowTrampa = 4;
        Object.entries(trampaData).forEach(([key, value]: [string, any]) => {
            if (value === null || value === undefined) return;
            const r = wsTrampa.getRow(rowTrampa);
            r.getCell(1).value = key;
            let valor: any;
            let unidad = '';
            if (typeof value === 'object') {
                valor = value.valor ?? '';
                unidad = value.unidad ?? '';
            } else {
                valor = value;
            }
            r.getCell(2).value = valor;
            r.getCell(3).value = unidad;
            applyRowStyle(r, 3, [2]);
            if (typeof valor === 'number') r.getCell(2).numFmt = '0';
            rowTrampa++;
        });

        // ========== GENERAR ARCHIVO ==========
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

    } catch (error: any) {
        console.error('Error al exportar Excel:', error);
        alert('Error al exportar Excel: ' + error.message);
    }
}