import ExcelJS from 'exceljs';
import { addProjectHeaderAndFooter } from './excel-export-utils';

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

export async function exportDesagueToExcel(dataSheet: Record<string, any>, fileName: string = 'Calculo_Desague', proyecto?: any) {
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
            { width: 3  }, // 1 spacer
            { width: 20 }, // 2 TRAMO
            { width: 10 }, // 3 LONGITUD
            { width: 7  }, // 4 UD
            { width: 10 }, // 5 DIAMETRO
            { width: 10 }, // 6 PENDIENTE
            { width: 14 }, // 7 CR1 N°
            { width: 12 }, // 8 CR1 CT
            { width: 12 }, // 9 CR1 CF
            { width: 8  }, // 10 CR1 H
            { width: 28 }, // 11 CR1 DIMENSIONES
            { width: 14 }, // 12 CR2 N°
            { width: 12 }, // 13 CR2 CT
            { width: 12 }, // 14 CR2 CF
            { width: 8  }, // 15 CR2 H
            { width: 28 }, // 16 CR2 DIMENSIONES
        ];

        const CC  = 16; // total columnas
        const CC2 = 2;  // columna inicio (B)
        const cbT = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFA0A0A0' } };
        const cbM = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FF999933' } };
        const COL_BLANC = 'FFFFFFFF';
        const COL_VERDE = 'FF92D050';
        const COL_AMAR  = 'FFFFFF99'; // amarillo encabezados
        const COL_CR1   = 'FFD4EDDA'; // verde claro CR1
        const COL_CR2   = 'FFD0E8FF'; // azul claro CR2
        const COL_DAT   = 'FFFFFFFF';
        const COL_ALT   = 'FFE8F0FB';
        const COL_TOT   = 'FFFFCC00';
        const COL_NEGRO = 'FF000000';
        const COL_HDR: Record<string, string> = {
            inicial: 'FF1B5E20', primaria: 'FF0D47A1', secundaria: 'FF4A148C',
        };

        function colFillRow(r: number, bg: string, h = 17) {
            // col 1 siempre blanco (spacer)
            wsCol.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COL_BLANC } };
            for (let c = CC2; c <= CC; c++)
                wsCol.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            wsCol.getRow(r).height = h;
        }

        function colCell(r: number, c: number, val: any, opts: {
            bold?: boolean; size?: number; bg?: string;
            halign?: ExcelJS.Alignment['horizontal']; numFmt?: string; wrapText?: boolean;
            bord?: 'T' | 'M';
        } = {}) {
            const cell = wsCol.getCell(r, c);
            cell.value = val ?? null;
            cell.font  = { bold: opts.bold ?? false, size: opts.size ?? 9, name: 'Arial', color: { argb: COL_NEGRO } };
            if (opts.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.bg } };
            cell.alignment = { horizontal: opts.halign ?? 'center', vertical: 'middle', wrapText: opts.wrapText ?? false };
            const b = opts.bord === 'M' ? cbM : cbT;
            cell.border = {
                top: b, bottom: b,
                left:  c === CC2 ? cbM : cbT,
                right: c === CC  ? cbM : cbT,
            };
            if (opts.numFmt) cell.numFmt = opts.numFmt;
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

        // ── Título general ────────────────────────────────────────────────────
        colFillRow(cr, COL_VERDE, 24);
        wsCol.mergeCells(cr, CC2, cr, CC);
        const colTitulo = wsCol.getCell(cr, CC2);
        colTitulo.value = 'ANEXO 08. DISEÑO DE COLECTORES';
        colTitulo.font  = { bold: true, size: 12, name: 'Arial', color: { argb: COL_NEGRO } };
        colTitulo.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: COL_VERDE } };
        colTitulo.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        colTitulo.border = { top: cbM, left: cbM, bottom: cbM, right: cbM };
        cr++;

        colGrades.forEach(({ key, label }) => {
            const colRows: any[] = Array.isArray(colectorRaw[key]) ? colectorRaw[key] : [];

            // Separador entre tablas
            colFillRow(cr, COL_BLANC, 8); cr++;

            // ── Encabezado del grado ──────────────────────────────────────────
            colFillRow(cr, COL_HDR[key], 22);
            wsCol.mergeCells(cr, CC2, cr, CC);
            const grHdr = wsCol.getCell(cr, CC2);
            grHdr.value = `ANEXO 08. COLECTORES — ${label}`;
            grHdr.font  = { bold: true, size: 11, name: 'Arial', color: { argb: 'FFFFFFFF' } };
            grHdr.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: COL_HDR[key] } };
            grHdr.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            grHdr.border = { top: cbM, left: cbM, bottom: cbM, right: cbM };
            cr++;

            // ── Cabecera fila A: grupos ───────────────────────────────────────
            colFillRow(cr, COL_AMAR, 18);
            // cols B-F: encabezados generales en amarillo
            ['TRAMO', 'LONGITUD (m)', 'UD', 'DIAMETRO', 'PENDIENTE'].forEach((txt, i) => {
                colCell(cr, CC2 + i, txt, { bold: true, size: 9, bg: COL_AMAR, bord: 'M' });
            });
            // CR1: cols 7-11
            wsCol.mergeCells(cr, 7, cr, 11);
            colCell(cr, 7, `CAJA REGISTRO (${label})`, { bold: true, size: 9, bg: COL_CR1, bord: 'M' });
            // CR2: cols 12-16
            wsCol.mergeCells(cr, 12, cr, 16);
            colCell(cr, 12, `CAJA REGISTRO (${label})`, { bold: true, size: 9, bg: COL_CR2, bord: 'M' });
            cr++;

            // ── Cabecera fila B: sub-columnas ─────────────────────────────────
            colFillRow(cr, COL_AMAR, 16);
            // cols B-F vacías (continuación del rowspan simulado)
            for (let c = CC2; c <= 6; c++) colCell(cr, c, '', { bg: COL_AMAR });
            // CR1 sub-cols
            ['N°', 'CT (m)', 'CF/CLL (m)', 'H (m)', 'DIMENSIONES'].forEach((txt, i) => {
                colCell(cr, 7  + i, txt, { bold: true, size: 9, bg: COL_CR1 });
            });
            // CR2 sub-cols
            ['N°', 'CT (m)', 'CF/CLL (m)', 'H (m)', 'DIMENSIONES'].forEach((txt, i) => {
                colCell(cr, 12 + i, txt, { bold: true, size: 9, bg: COL_CR2 });
            });
            cr++;

            // ── Filas de datos ────────────────────────────────────────────────
            const dataStart = cr;
            if (colRows.length === 0) {
                colFillRow(cr, COL_DAT, 17);
                for (let c = CC2; c <= CC; c++) colCell(cr, c, '', { bg: COL_DAT });
                cr++;
            } else {
                colRows.forEach((r: any, idx: number) => {
                    const isStatic = r.isStatic ?? false;
                    const bg = isStatic ? 'FFFFF3CD' : (idx % 2 === 0 ? COL_DAT : COL_ALT);
                    colFillRow(cr, bg, 17);
                    const cr1Num = `${r.cr1_num ?? ''} ${r.cr1_nval ?? ''}`.trim();
                    const cr2Num = `${r.cr2_num ?? ''} ${r.cr2_nval ?? ''}`.trim();
                    colCell(cr, 2,  r.tramo     ?? '', { bg, halign: 'left' });
                    colCell(cr, 3,  r.longitud  ?? 0,  { bg, numFmt: '0.00' });
                    colCell(cr, 4,  r.ud        ?? 0,  { bg, numFmt: '0' });
                    colCell(cr, 5,  r.diametro  ?? '', { bg });
                    colCell(cr, 6,  r.pendiente ?? '', { bg });
                    colCell(cr, 7,  cr1Num,               { bg });
                    colCell(cr, 8,  fmtCF(r.cr1_ct ?? 0), { bg });
                    colCell(cr, 9,  fmtCF(r.cr1_cf ?? 0), { bg });
                    colCell(cr, 10, r.cr1_h  ?? 0,        { bg, numFmt: '0.00' });
                    colCell(cr, 11, r.cr1_dim ?? '',       { bg, halign: 'left', wrapText: true });
                    colCell(cr, 12, cr2Num,               { bg });
                    colCell(cr, 13, fmtCF(r.cr2_ct ?? 0), { bg });
                    colCell(cr, 14, fmtCF(r.cr2_cf ?? 0), { bg });
                    colCell(cr, 15, r.cr2_h  ?? 0,        { bg, numFmt: '0.00' });
                    colCell(cr, 16, r.cr2_dim ?? '',       { bg, halign: 'left', wrapText: true });
                    cr++;
                });
            }

            // ── Fila TOTAL ────────────────────────────────────────────────────
            colFillRow(cr, COL_TOT, 20);
            wsCol.mergeCells(cr, CC2, cr, 3);
            colCell(cr, CC2, `TOTAL ${label}`, { bold: true, size: 10, bg: COL_TOT, halign: 'right', bord: 'M' });
            colCell(cr, 4, colRows.length > 0
                ? { formula: `SUM(D${dataStart}:D${cr - 1})` } : 0,
                { bold: true, bg: COL_TOT, numFmt: '0', bord: 'M' });
            for (let c = 5; c <= CC; c++) colCell(cr, c, null, { bg: COL_TOT, bord: 'M' });
            cr++;
        });


                // ========== HOJA 3: CAJAS DE REGISTRO ==========
        const wsCajas = workbook.addWorksheet('Cajas de Registro');
        wsCajas.columns = [
            { width: 3  }, // 1 spacer
            { width: 22 }, // 2 N° / label
            { width: 10 }, // 3 TRAMO value
            { width: 10 }, // 4 CT
            { width: 10 }, // 5 CF
            { width: 8  }, // 6 H
            { width: 30 }, // 7 DIMENSIONES
        ];

        const CJ = 7;
        const cjT = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFA0A0A0' } };
        const cjM = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FF999933' } };
        const CJ_BLANC = 'FFFFFFFF';
        const CJ_VERDE = 'FF92D050';
        const CJ_AMAR  = 'FFFFFF99';
        const CJ_ALT   = 'FFE8F0FB';
        const CJ_STAT  = 'FFF5F5DC'; // beige filas estáticas
        const CJ_TOT   = 'FFFFCC00';
        const CJ_NEGRO = 'FF000000';
        const CJ_HDR: Record<string, string> = {
            inicial: 'FF1B5E20', primaria: 'FF0D47A1', secundaria: 'FF4A148C',
        };

        // Filas estáticas fijas (igual que getStaticRows del frontend)
        function getCajasStaticRows() {
            return [
                { tramocajalabel: 'B.z',                  tramocajavalue: '18',  ctcaja:  0.00, cfcaja: -1.40, hcaja: 1.40, dimensionescaja: 'D=1.20m',                      isStatic: true },
                { tramocajalabel: 'CAJA DE REGISTRO FINAL', tramocajavalue: '',  ctcaja: -0.35, cfcaja: -1.50, hcaja: 1.15, dimensionescaja: '0.60m x 0.60m (24" x 24")',     isStatic: true },
                { tramocajalabel: 'CONC.',                 tramocajavalue: '',   ctcaja: -0.10, cfcaja: -0.30, hcaja: 0.20, dimensionescaja: '0.50m x 0.80m x 0.50m',         isStatic: true },
            ];
        }

        // Transformar colector → cajas (igual que transformColectorData del frontend)
        function transformColectorToCajas(gradeRows: any[]): any[] {
            return gradeRows
                .filter((r: any) => !r.isStatic)
                .map((item: any, idx: number) => ({
                    tramocajalabel:   item.cr1_num  ?? 'C.R.',
                    tramocajavalue:   item.cr1_nval !== undefined ? String(item.cr1_nval) : String(idx + 1),
                    ctcaja:           parseFloat(item.cr1_ct)  || 0,
                    cfcaja:           parseFloat(item.cr1_cf)  || 0,
                    hcaja:            parseFloat(item.cr1_h)   || 0,
                    dimensionescaja:  item.cr1_dim ?? '',
                    isStatic:         false,
                }));
        }

        // Resumen de tipos (igual que generateResumenData del frontend)
        function buildResumen(allRows: any[]): { desc: string; tipo: string; cantidad: number }[] {
            const summary = [
                { desc: 'CAJA DE REGISTRO', tipo: '0.25m x 0.50m (10" x 20")', cantidad: 0 },
                { desc: 'CAJA DE REGISTRO', tipo: '0.30m x 0.60m (12" x 24")', cantidad: 0 },
                { desc: 'CAJA DE REGISTRO', tipo: '0.45m x 0.60m (18" x 24")', cantidad: 0 },
                { desc: 'CAJA DE REGISTRO', tipo: '0.60m x 0.60m (24" x 24")', cantidad: 0 },
                { desc: 'BUZON',            tipo: 'D=1.20m',                    cantidad: 0 },
                { desc: 'FINAL',            tipo: '0.60m x 0.60m (24" x 24")', cantidad: 0 },
                { desc: 'CONC.',            tipo: '0.50m x 0.80m x 0.50m',     cantidad: 0 },
            ];
            const validDims = summary.slice(0, 4).map(s => s.tipo);
            allRows.forEach((row: any) => {
                const dim   = (row.dimensionescaja || '').trim();
                const label = (row.tramocajalabel  || '').trim();
                if (!dim) return;
                if (dim === 'D=1.20m') {
                    const r = summary.find(s => s.desc === 'BUZON'); if (r) r.cantidad++;
                } else if (dim === '0.50m x 0.80m x 0.50m') {
                    const r = summary.find(s => s.desc === 'CONC.'); if (r) r.cantidad++;
                } else if (dim === '0.60m x 0.60m (24" x 24")' && (label.includes('FINAL'))) {
                    const r = summary.find(s => s.desc === 'FINAL'); if (r) r.cantidad++;
                } else if (validDims.includes(dim)) {
                    const r = summary.find(s => s.desc === 'CAJA DE REGISTRO' && s.tipo === dim);
                    if (r) r.cantidad++;
                }
            });
            return summary;
        }

        function cjFill(r: number, argb: string, h = 17) {
            wsCajas.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CJ_BLANC } };
            for (let c = 2; c <= CJ; c++)
                wsCajas.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
            wsCajas.getRow(r).height = h;
        }

        function cjCell(r: number, c: number, val: any, opts: {
            bold?: boolean; size?: number; bg?: string;
            halign?: ExcelJS.Alignment['horizontal']; numFmt?: string; border?: 'T' | 'M';
        } = {}) {
            const cell = wsCajas.getCell(r, c);
            cell.value = val ?? null;
            cell.font  = { bold: opts.bold ?? false, size: opts.size ?? 9, name: 'Arial', color: { argb: CJ_NEGRO } };
            if (opts.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.bg } };
            cell.alignment = { horizontal: opts.halign ?? 'center', vertical: 'middle', wrapText: c === CJ };
            const b = opts.border === 'M' ? cjM : cjT;
            cell.border = {
                top: b, bottom: b,
                left:  c === 2 ? (opts.border === 'M' ? cjM : cjT) : cjT,
                right: c === CJ ? (opts.border === 'M' ? cjM : cjT) : cjT,
            };
            if (opts.numFmt) cell.numFmt = opts.numFmt;
        }

        const cajasRaw: Record<string, any[]> = dataSheet['colector'] || {};
        // Si ya existe dataSheet.cajas usamos eso (tiene CT/CF editados por usuario)
        const cajasEdited: Record<string, any[]> = dataSheet['cajas'] || {};

        const cajGrades = [
            { key: 'inicial',    label: 'INICIAL'    },
            { key: 'primaria',   label: 'PRIMARIA'   },
            { key: 'secundaria', label: 'SECUNDARIA' },
        ].filter(g => gradesActive[g.key]);

        let cjr = 1;

        // Título general
        cjFill(cjr, CJ_VERDE, 24);
        wsCajas.mergeCells(cjr, 2, cjr, CJ);
        const cajTitulo = wsCajas.getCell(cjr, 2);
        cajTitulo.value = 'ANEXO 09. CAJAS DE REGISTRO';
        cajTitulo.font  = { bold: true, size: 12, name: 'Arial', color: { argb: CJ_NEGRO } };
        cajTitulo.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CJ_VERDE } };
        cajTitulo.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        cajTitulo.border = { top: cjM, left: cjM, bottom: cjM, right: cjM };
        cjr++;

        cajGrades.forEach(({ key, label }) => {
            // Datos dinámicos: preferir cajas editadas, sino derivar del colector
            const editedRows: any[] = Array.isArray(cajasEdited[key]) ? cajasEdited[key] : [];
            const colectorRows: any[] = Array.isArray(cajasRaw[key]) ? cajasRaw[key] : [];
            const dynamicRows = editedRows.length > 0
                ? editedRows.filter((r: any) => !r.isStatic)
                : transformColectorToCajas(colectorRows);
            const staticRows  = getCajasStaticRows();
            const allRows     = [...dynamicRows, ...staticRows];

            // Separador
            cjFill(cjr, CJ_BLANC, 6); cjr++;

            // Encabezado grado
            cjFill(cjr, CJ_HDR[key], 22);
            wsCajas.mergeCells(cjr, 2, cjr, CJ);
            const grHdr = wsCajas.getCell(cjr, 2);
            grHdr.value = `ANEXO 09. CAJAS DE REGISTRO — ${label}`;
            grHdr.font  = { bold: true, size: 11, name: 'Arial', color: { argb: 'FFFFFFFF' } };
            grHdr.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CJ_HDR[key] } };
            grHdr.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            grHdr.border = { top: cjM, left: cjM, bottom: cjM, right: cjM };
            cjr++;

            // Cabecera columnas
            cjFill(cjr, CJ_AMAR, 18);
            ['N°', 'TRAMO', 'CT (m)', 'CF (m)', 'H (m)', 'DIMENSIONES'].forEach((txt, i) => {
                cjCell(cjr, i + 2, txt, { bold: true, size: 9, bg: CJ_AMAR, border: 'M' });
            });
            cjr++;

            // Filas de datos
            allRows.forEach((row: any, idx: number) => {
                const isStatic = row.isStatic ?? false;
                const bg = isStatic ? CJ_STAT : (idx % 2 === 0 ? CJ_BLANC : CJ_ALT);
                cjFill(cjr, bg, 17);
                cjCell(cjr, 2, row.tramocajalabel  ?? '',   { bg, halign: 'left'   });
                cjCell(cjr, 3, row.tramocajavalue  ?? '',   { bg });
                cjCell(cjr, 4, row.ctcaja          ?? 0,    { bg, numFmt: '0.00'   });
                cjCell(cjr, 5, row.cfcaja          ?? 0,    { bg, numFmt: '0.00'   });
                cjCell(cjr, 6, row.hcaja           ?? 0,    { bg, numFmt: '0.00'   });
                cjCell(cjr, 7, row.dimensionescaja ?? '',   { bg, halign: 'left'   });
                cjr++;
            });

            // ── Resumen de tipos ──────────────────────────────────────────────
            // Separador antes del resumen
            cjFill(cjr, CJ_BLANC, 6); cjr++;

            const resumen = buildResumen(allRows);
            const totalCajas = resumen.reduce((s, r) => s + r.cantidad, 0);

            // Título resumen
            cjFill(cjr, 'FFF2F2F2', 16);
            wsCajas.mergeCells(cjr, 2, cjr, CJ);
            const resHdr = wsCajas.getCell(cjr, 2);
            resHdr.value = 'RESUMEN — TIPOS DE CAJAS DE REGISTRO';
            resHdr.font  = { bold: true, size: 9, name: 'Arial', color: { argb: CJ_NEGRO } };
            resHdr.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
            resHdr.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            resHdr.border = { top: cjM, left: cjM, bottom: cjM, right: cjM };
            cjr++;

            // Cabecera resumen (cols 2-4: TIPO | DIMENSIONES | N°)
            cjFill(cjr, CJ_AMAR, 16);
            ['TIPO DE CAJA', 'DIMENSIONES', 'N°'].forEach((txt, i) => {
                // TIPO ocupa cols 2-4, DIMENSIONES ocupa cols 5-6, N° ocupa col 7
                const colMap = [2, 5, 7];
                cjCell(cjr, colMap[i], txt, { bold: true, size: 9, bg: CJ_AMAR, border: 'M',
                    halign: i < 2 ? 'left' : 'center' });
            });
            // Merge TIPO cols 2-4 y DIMENSIONES cols 5-6
            wsCajas.mergeCells(cjr, 2, cjr, 4);
            wsCajas.mergeCells(cjr, 5, cjr, 6);
            cjr++;

            resumen.forEach((item, idx) => {
                const bg = idx % 2 === 0 ? CJ_BLANC : CJ_ALT;
                cjFill(cjr, bg, 17);
                wsCajas.mergeCells(cjr, 2, cjr, 4);
                wsCajas.mergeCells(cjr, 5, cjr, 6);
                cjCell(cjr, 2, item.desc,      { bg, halign: 'left' });
                cjCell(cjr, 5, item.tipo,      { bg, halign: 'left' });
                cjCell(cjr, 7, item.cantidad,  { bg, numFmt: '0' });
                cjr++;
            });

            // Fila TOTAL resumen
            cjFill(cjr, CJ_TOT, 18);
            wsCajas.mergeCells(cjr, 2, cjr, 6);
            cjCell(cjr, 2, 'TOTAL', { bold: true, bg: CJ_TOT, halign: 'right', border: 'M' });
            cjCell(cjr, 7, totalCajas, { bold: true, bg: CJ_TOT, numFmt: '0', border: 'M' });
            cjr++;

            // Separador final del grado
            cjFill(cjr, CJ_BLANC, 8); cjr++;
        });

        

        // ========== HOJA 4: UNIDADES DE VENTILACIÓN ==========
        const wsUV = workbook.addWorksheet('Ventilación');
        wsUV.columns = [
            {width: 3 }, // 1 spacer
            {width: 28}, // 2 NIVEL
            {width: 32}, // 3 DESCRIPCION
            {width: 10}, // 4 INODORO
            {width: 10}, // 5 URINARIO
            {width: 10}, // 6 LAVATORIO
            {width: 10}, // 7 DUCHA
            {width: 10}, // 8 LAVADERO
            {width: 10}, // 9 SUMIDERO
            {width: 10}, // 10 TOTAL UD
            {width: 10}, // 11 Ø VENT.
        ];

        const UV  = 11;
        const uvT = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFA0A0A0' } };
        const uvM = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FF999933' } };
        const UV_BLANC = 'FFFFFFFF';
        const UV_VERDE = 'FF92D050';
        const UV_AMAR  = 'FFFFFF99';
        const UV_ALT   = 'FFE8F0FB';
        const UV_MOD   = 'FFEEF2FF'; // fondo módulo (lila muy suave)
        const UV_TOT   = 'FFFFCC00';
        const UV_NEGRO = 'FF000000';
        const UV_ROJO  = 'FFCC0000';
        const UV_HDR: Record<string, string> = {
            inicial: 'FF1B5E20', primaria: 'FF0D47A1', secundaria: 'FF4A148C',
        };
        const ACC_KEYS   = ['inodoro','urinario','lavatorio','ducha','lavadero','sumidero'];
        const ACC_LABELS = ['INODORO','URINARIO','LAVATORIO','DUCHA','LAVADERO','SUMIDERO'];
        const DEFAULT_MULTS_UV: Record<string,number> = {
            inodoro:4, urinario:4, lavatorio:2, ducha:4, lavadero:3, sumidero:2
        };

        function uvFill(r: number, argb: string, h = 17) {
            wsUV.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: UV_BLANC } };
            for (let c = 2; c <= UV; c++)
                wsUV.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
            wsUV.getRow(r).height = h;
        }

        function uvCell(r: number, c: number, val: any, opts: {
            bold?: boolean; size?: number; bg?: string; color?: string;
            halign?: ExcelJS.Alignment['horizontal']; numFmt?: string; border?: 'T'|'M';
        } = {}) {
            const cell = wsUV.getCell(r, c);
            cell.value = val ?? null;
            cell.font  = { bold: opts.bold ?? false, size: opts.size ?? 9, name: 'Arial',
                           color: { argb: opts.color ?? UV_NEGRO } };
            if (opts.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.bg } };
            cell.alignment = { horizontal: opts.halign ?? 'center', vertical: 'middle', wrapText: false };
            const b = opts.border === 'M' ? uvM : uvT;
            cell.border = { top: b, bottom: b, left: c === 2 ? b : uvT, right: c === UV ? b : uvT };
            if (opts.numFmt) cell.numFmt = opts.numFmt;
        }

        // Aplanar arbol de nodos UV para exportar
        function flattenUvRows(rows: any[], depth = 0): { row: any; depth: number}[] {
            const out: { row: any; depth: number }[] = [];
            (rows || []).forEach((r: any) => {
                out.push({ row: r, depth });
                if (r._childrean?.length) out.push(...flattenUvRows(r._children, depth + 1));
            });
            return out; 
        }

        const uvRaw     = dataSheet['uv'] || {};
        const dimRows:  any[] = Array.isArray(uvRaw.dimensionRows) ? uvRaw.dimensionRows : [];
        const uvGrades: Record<string, any[]> = uvRaw.gradeData || {};

        const uvActiveGrades = [
            { key: 'inicial',    label: 'INICIAL'    },
            { key: 'primaria',   label: 'PRIMARIA'   },
            { key: 'secundaria', label: 'SECUNDARIA' },
        ].filter(g => gradesActive[g.key]);

        let uvr = 1;

        // ── Título general
        uvFill(uvr, UV_VERDE, 24);
        wsUV.mergeCells(uvr, 2, uvr, UV);
        const uvTit = wsUV.getCell(uvr, 2);
        uvTit.value = 'ANEXO 10. CÁLCULO DE LAS VENTILACIONES';
        uvTit.font = {bold: true, size: 12, name: 'Arial', color: { argb: UV_NEGRO }};
        uvTit.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: UV_VERDE }};
        uvTit.alignment = {horizontal: 'left', vertical: 'middle', indent: 1};
        uvTit.border = {top: uvM, left: uvM, bottom: uvM, right: uvM };
        uvr++;

        // Separador
        uvFill(uvr, UV_BLANC, 6); uvr++;

        // Tabla de dimensiones
        //Encabezado tabla dimensiones
        uvFill(uvr, UV_AMAR, 18);
        wsUV.mergeCells(uvr, 2, uvr, UV);
        const dimTit = wsUV.getCell(uvr, 2);
        dimTit.value = 'DIMENSIONES DE LOS TUBOS DE VENTILACIÓN';
        dimTit.font  = { bold: true, size: 10, name: 'Arial', color: { argb: UV_NEGRO } };
        dimTit.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: UV_AMAR } };
        dimTit.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        dimTit.border = { top: uvM, left: uvM, bottom: uvM, right: uvM };
        uvr++;

        // Cabecera columnas dimensionales
        uvFill(uvr, UV_AMAR, 16);
        ['DIÁMETRO DESAGÜE', 'TIPO', '2"', '3"', '4"'].forEach((txt, i) => {
            uvCell(uvr, i + 2, txt, { bold: true, size: 9, bg: UV_AMAR, border: 'M',
                halign: i < 2 ? 'left' : 'center' });
        });
        // Rellenar cols 7-11 vacías con fondo amarillo
        for (let c = 7; c <= UV; c++) uvCell(uvr, c, null, { bg: UV_AMAR, border: 'M' });
        uvr++;

        if (dimRows.length === 0) {
            uvFill(uvr, UV_BLANC, 17);
            for (let c = 2; c <= UV; c++) uvCell(uvr, c, '', { bg: UV_BLANC });
            uvr++;
        } else {
            dimRows.forEach((dr: any, idx: number) => {
                const bg = idx % 2 === 0 ? UV_BLANC : UV_ALT;
                uvFill(uvr, bg, 17);
                uvCell(uvr, 2, dr.diametro ?? '', { bg, halign: 'left' });
                uvCell(uvr, 3, dr.tipo     ?? '', { bg, halign: 'left' });
                uvCell(uvr, 4, dr.size2    ?? '', { bg });
                uvCell(uvr, 5, dr.size3    ?? '', { bg });
                uvCell(uvr, 6, dr.size4    ?? '', { bg });
                for (let c = 7; c <= UV; c++) uvCell(uvr, c, null, { bg });
                uvr++;
            });
        }

        // Tablas por grado
        uvActiveGrades.forEach(({ key, label }) => {
            const gradeRows: any[] = Array.isArray(uvGrades[key]) ? uvGrades[key] : [];
            const flat = flattenUvRows(gradeRows);

            // Separador entre grados
            uvFill(uvr, UV_BLANC, 6); uvr++;

            // Encabezado grado
            uvFill(uvr, UV_HDR[key], 22);
            wsUV.mergeCells(uvr, 2, uvr, UV);
            const grH = wsUV.getCell(uvr, 2);
            grH.value = `APARATOS VENTILADOS — ${label}`;
            grH.font  = { bold: true, size: 11, name: 'Arial', color: { argb: 'FFFFFFFF' } };
            grH.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: UV_HDR[key] } };
            grH.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            grH.border = { top: uvM, left: uvM, bottom: uvM, right: uvM };
            uvr++;

            // Cabecera columnas
            uvFill(uvr, UV_AMAR, 18);
            ['NIVEL', 'DESCRIPCIÓN', ...ACC_LABELS, 'TOTAL UD', 'Ø VENT.'].forEach((txt, i) => {
                uvCell(uvr, i + 2, txt, { bold: true, size: 9, bg: UV_AMAR, border: 'M',
                    halign: i < 2 ? 'left' : 'center' });
            });
            uvr++;

            const dataStart = uvr;
            if (flat.length === 0) {
                uvFill(uvr, UV_BLANC, 17);
                for (let c = 2; c <= UV; c++) uvCell(uvr, c, '', { bg: UV_BLANC });
                uvr++;
            } else {
                flat.forEach(({ row, depth }: { row: any; depth: number }, idx: number) => {
                    const isMod = row.tipo === 'module';
                    const bg = isMod ? UV_MOD : (idx % 2 === 0 ? UV_BLANC : UV_ALT);
                    uvFill(uvr, bg, isMod ? 18 : 17);

                    // Columna 2 NIVEL con indentificado por profundidad
                    const nivelCell = wsUV.getCell(uvr, 2);
                    nivelCell.value = row.nivel ?? '';
                    nivelCell.font  = { bold: isMod, size: 9, name: 'Arial',
                                       color: { argb: isMod ? UV_ROJO : UV_NEGRO } };
                    nivelCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                    nivelCell.alignment = { horizontal: 'left', vertical: 'middle',
                                           indent: depth * 2 };
                    nivelCell.border = { top: uvT, bottom: uvT, left: uvM, right: uvT };

                    // Col 3 DESCRIPCIÓN
                    uvCell(uvr, 3, row.descripcion ?? '', { bg, halign: 'left' });

                    // Cols 4-9 accesorios — solo en no-módulo
                    ACC_KEYS.forEach((key, i) => {
                        const val = isMod ? null : (parseFloat(row[`acc_${key}`]) || null);
                        uvCell(uvr, 4 + i, val, { bg, numFmt: val !== null ? '0' : undefined });
                    });


                    // Col 10 Total UD
                    const totalUD = parseFloat(row.totalUD) || null;
                    uvCell(uvr, 10, totalUD, { bg, bold: true,
                        color: totalUD ? 'FF1D4ED8' : UV_NEGRO,
                        numFmt: totalUD !== null ? '0.00' : undefined });

                    // Col 11 Ø Ventilación
                    uvCell(uvr, 11, row.diametroVentilacion ?? '', { bg,
                        color: 'FF0F766E', bold: !!row.diametroVentilacion });

                    uvr++;
                });
            }

             // Fila TOTAL del grado
            uvFill(uvr, UV_TOT, 20);
            wsUV.mergeCells(uvr, 2, uvr, 9);
            uvCell(uvr, 2, `TOTAL UD — ${label}`, { bold: true, size: 10, bg: UV_TOT,
                halign: 'right', border: 'M' });
            // SUM de col J (totalUD) sobre todas las filas de datos
            uvCell(uvr, 10,
                flat.length > 0 ? { formula: `SUM(J${dataStart}:J${uvr - 1})` } : 0,
                { bold: true, bg: UV_TOT, numFmt: '0.00', border: 'M' });
            uvCell(uvr, 11, null, { bg: UV_TOT, border: 'M' });
            uvr++;
        });

        // Separador final
        uvFill(uvr, UV_BLANC, 6); uvr++;



         // HOJA 5: TRAMPA DE GRASA
        const wsTrampa = workbook.addWorksheet('Trampa de Grasa');
        wsTrampa.columns = [
            { width: 3  }, 
            { width: 38 }, 
            { width: 18 }, 
            { width: 12 }, 
            { width: 10 }, 
            { width: 12 }, 
        ];

        const TG  = 6;
        const tgT = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFA0A0A0' } };
        const tgM = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FF999933' } };
        const TG_BLANC = 'FFFFFFFF';
        const TG_VERDE = 'FF92D050';
        const TG_AMAR  = 'FFFFFF99';
        const TG_ALT   = 'FFE8F0FB';
        const TG_TOT   = 'FFFFCC00';
        const TG_NEGRO = 'FF000000';
        const TG_EDIT  = 'FFE8F4FF'; 

        function tgFill(r: number, argb: string, h = 17) {
            wsTrampa.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TG_BLANC } };
            for (let c = 2; c <= TG; c++)
                wsTrampa.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
            wsTrampa.getRow(r).height = h;
        }

        function tgCell(r: number, c: number, val: any, opts: {
            bold?: boolean; size?: number; bg?: string; color?: string;
            halign?: ExcelJS.Alignment['horizontal']; numFmt?: string;
            border?: 'T' | 'M'; span?: [number, number];
        } = {}) {
            const cell = wsTrampa.getCell(r, c);
            cell.value = val ?? null;
            cell.font  = { bold: opts.bold ?? false, size: opts.size ?? 9, name: 'Arial',
                           color: { argb: opts.color ?? TG_NEGRO } };
            if (opts.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.bg } };
            cell.alignment = { horizontal: opts.halign ?? 'left', vertical: 'middle', wrapText: c === 2 };
            const b = opts.border === 'M' ? tgM : tgT;
            cell.border = { top: b, bottom: b, left: c === 2 ? b : tgT, right: c === TG ? b : tgT };
            if (opts.numFmt) cell.numFmt = opts.numFmt;
        }

        function tgSectionHeader(r: number, title: string, headerBg: string) {
            tgFill(r, headerBg, 20);
            wsTrampa.mergeCells(r, 2, r, TG);
            const cell = wsTrampa.getCell(r, 2);
            cell.value = title;
            cell.font  = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
            cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBg } };
            cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            cell.border = { top: tgM, left: tgM, bottom: tgM, right: tgM };
        }

        function tgColHeader(r: number, labels: string[], bgCols?: string[]) {
            tgFill(r, TG_AMAR, 18);
            labels.forEach((txt, i) => {
                const bg = bgCols?.[i] ?? TG_AMAR;
                tgCell(r, i + 2, txt, { bold: true, size: 9, bg, border: 'M',
                    halign: i === 0 ? 'left' : 'center' });
            });
        }

        function tgSep(r: number) {
            tgFill(r, TG_BLANC, 6);
        }

        const trampaRaw     = dataSheet['trampa'] || {};
        const tgAparatos:   any[] = Array.isArray(trampaRaw.aparatos)          ? trampaRaw.aparatos          : [];
        const tgCaracts:    any[] = Array.isArray(trampaRaw.caracteristicas)    ? trampaRaw.caracteristicas   : [];
        const tgParams:     any[] = Array.isArray(trampaRaw.parametrosFinal)    ? trampaRaw.parametrosFinal   : [];
        const tgMedidas:    any[] = Array.isArray(trampaRaw.medidas)            ? trampaRaw.medidas           : [];
        const tgComentario: string = trampaRaw.comentario ?? '';

        let tr = 1;

        // ── Título general
        tgFill(tr, TG_VERDE, 24);
        wsTrampa.mergeCells(tr, 2, tr, TG);
        const tgTit = wsTrampa.getCell(tr, 2);
        tgTit.value = 'ANEXO 11. TRAMPA DE GRASA';
        tgTit.font = {bold: true, size: 12, name: 'Arial', color: { argb: TG_NEGRO }};
        tgTit.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TG_VERDE }};
        tgTit.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        tgTit.border = { top: tgM, left: tgM, bottom: tgM, right: tgM };
        tr++;

        // SESION 1: APARATOS
        tgSep(tr); tr++;
        tgSectionHeader(tr, '1. UNIDADES DE GASTOS DE APARATOS SANITARIOS', 'FFED6C02'); tr++;
        tgColHeader(tr, ['APARATO', 'CANTIDAD', 'TIPO', 'UG', 'TOTAL UG']); tr++;

        const tgAparStart = tr;
        if (tgAparatos.length === 0) {
            tgFill(tr, TG_BLANC, 17);
            for (let c = 2; c <= TG; c++) tgCell(tr, c, '', { bg: TG_BLANC });
            tr++;
        } else {
            tgAparatos.forEach((ap: any, idx: number) => {
                const bg = idx % 2 === 0 ? TG_BLANC : TG_ALT;
                tgFill(tr, bg, 17);
                tgCell(tr, 2, ap.aparato   ?? '', { bg, halign: 'left' });
                tgCell(tr, 3, ap.cantidad  ?? 0,  { bg, halign: 'center', numFmt: '0' });
                tgCell(tr, 4, ap.tipo      ?? '', { bg, halign: 'left' });
                tgCell(tr, 5, ap.ug        ?? 0,  { bg, halign: 'center', numFmt: '0' });
                tgCell(tr, 6, ap.totalUG   ?? 0,  { bg, halign: 'center', bold: true,
                    color: 'FFB45309', numFmt: '0.00' });
                tr++;
            });
        }

        // Fila TOTAL UG
        tgFill(tr, TG_TOT, 20);
        wsTrampa.mergeCells(tr, 2, tr, 5);
        tgCell(tr, 2, 'TOTAL =', { bold: true, size: 10, bg:TG_TOT, halign: 'right', border: 'M' });
        tgCell(tr, 6,
            tgAparatos.length > 0
                ? { formula: `SUM(F${tgAparStart}:F${tr - 1})` }
                : 0,
            { bold: true, bg: TG_TOT, halign: 'center', numFmt: '0.00', border: 'M' });
        tr++;
        tr++;

        // SESION 2: CARACTERÍSTICAS
        tgSep(tr); tr++;
        tgSectionHeader(tr, '2. CARACTERÍSTICAS DE LA TRAMPA DE GRASA', 'FF0F766E'); tr++;
        tgColHeader(tr, ['CARACTERÍSTICA', 'VALOR / DESCRIPCIÓN', '', '', '']); tr++;

        if (tgCaracts.length === 0) {
            tgFill(tr, TG_BLANC, 17);
            for (let c = 2; c <= TG; c++) tgCell(tr, c, '', { bg: TG_BLANC });
            tr++;
        } else {
            tgCaracts.forEach((ca: any, idx: number) => {
                const bg = idx % 2 === 0 ? TG_BLANC : TG_ALT;
                tgFill(tr, bg, 18);
                tgCell(tr, 2, ca.caracteristica ?? '', { bg, halign: 'left', bold: true });
                // Valor ocupa cols 3-6 merged
                wsTrampa.mergeCells(tr, 3, tr, TG);
                tgCell(tr, 3, ca.valor ?? '', { bg, halign: 'left' });
                // Rellenar fondo de celdas mergeadas
                for (let c = 4; c <= TG; c++) {
                    wsTrampa.getCell(tr, c).fill = { type: 'pattern', pattern: 'solid',
                        fgColor: { argb: bg } };
                }
                tr++;
            });
        }
        tr++;
        // ── SECCIÓN 3: Parámetros de diseño ───────────────────────────────────
        tgSep(tr); tr++;
        tgSectionHeader(tr, '3. CÁLCULO FINAL — PARÁMETROS DE DISEÑO', 'FF3730A3'); tr++;
        tgColHeader(tr, ['PARÁMETRO', 'VALOR', 'UNIDAD', '', '']); tr++;

        if (tgParams.length === 0) {
            tgFill(tr, TG_BLANC, 17);
            for (let c = 2; c <= TG; c++) tgCell(tr, c, '', { bg: TG_BLANC });
            tr++;
        } else {
            tgParams.forEach((p: any, idx: number) => {
                const isEditable = p.editable ?? false;
                const bg = isEditable ? TG_EDIT : (idx % 2 === 0 ? TG_BLANC : TG_ALT);
                tgFill(tr, bg, 17);
                tgCell(tr, 2, p.parametro ?? '', { bg, halign: 'left',
                    color: isEditable ? 'FF1D4ED8' : TG_NEGRO });
                const val = typeof p.calculos === 'number'
                    ? parseFloat(p.calculos.toFixed(3))
                    : parseFloat(String(p.calculos)) || p.calculos;
                tgCell(tr, 3, val ?? '', { bg, halign: 'center', bold: true,
                    color: isEditable ? 'FF1D4ED8' : TG_NEGRO,
                    numFmt: typeof val === 'number' ? '0.000' : undefined });
                tgCell(tr, 4, p.unidad ?? '', { bg, halign: 'center' });
                tgCell(tr, 5, null, { bg });
                tgCell(tr, 6, null, { bg });
                tr++;
            });
        }
        tr++;

         // ── SECCIÓN 4: Medidas finales ────────────────────────────────────────
        tgSep(tr); tr++;
        tgSectionHeader(tr, '4. MEDIDAS FINALES Y VERIFICACIÓN', 'FF15803D'); tr++;
        tgColHeader(tr, ['MEDIDA', 'VALOR', 'UNIDAD', '', '']); tr++;

        tgMedidas.forEach((m: any, idx: number) => {
            const bg = idx % 2 === 0 ? TG_BLANC : TG_ALT;
            tgFill(tr, bg, 17);
            tgCell(tr, 2, m.medida ?? '', { bg, halign: 'left', bold: true,
                color: 'FF15803D' });
            tgCell(tr, 3, m.valor  ?? 0,  { bg, halign: 'center', bold: true,
                color: 'FF15803D', numFmt: '0.00' });
            tgCell(tr, 4, m.unidad ?? '', { bg, halign: 'center' });
            tgCell(tr, 5, null, { bg });
            tgCell(tr, 6, null, { bg });
            tr++;
        });
        tr++;

        // ── Verificación de volumen ───────────────────────────────────────────
        tgSep(tr); tr++;

        const tgVolUtil = tgParams.find((p: any) =>
            String(p.parametro).includes('VOLUMEN UTIL CALCULADO (m³)'));
        const tgVolReq  = tgParams.find((p: any) =>
            String(p.parametro).includes('VOLUMEN REQUERIDO'));
        const tgVu  = parseFloat(tgVolUtil?.calculos ?? 0);
        const tgVr  = parseFloat(tgVolReq?.calculos  ?? 0);
        const tgCumple = tgVu >= tgVr;

        const verificBg = tgCumple ? 'FFD1FAE5' : 'FFFEE2E2';
        tgFill(tr, verificBg, 22);
        wsTrampa.mergeCells(tr, 2, tr, 4);
        tgCell(tr, 2,
            `V útil = ${tgVu.toFixed(3)} m³   /   V requerido = ${tgVr.toFixed(4)} m³`,
            { bg: verificBg, halign: 'left', bold: true,
              color: tgCumple ? 'FF15803D' : 'FF991B1B' });
        wsTrampa.mergeCells(tr, 5, tr, TG);
        tgCell(tr, 5, tgCumple ? '✔ CUMPLE' : '✘ NO CUMPLE',
            { bg: verificBg, halign: 'center', bold: true, size: 11,
              color: tgCumple ? 'FF15803D' : 'FF991B1B', border: 'M' });
        for (let c = 3; c <= 4; c++) {
            wsTrampa.getCell(tr, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: verificBg } };
            wsTrampa.getCell(tr, c).border = { top: tgM, bottom: tgM };
        }
        tr++;

        // ── Resumen ───────────────────────────────────────────────────────────
        tgSep(tr); tr++;

        tgFill(tr, 'FFDBEAFE', 16);
        wsTrampa.mergeCells(tr, 2, tr, TG);
        const resLbl = wsTrampa.getCell(tr, 2);
        resLbl.value = 'RESUMEN';
        resLbl.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF1E40AF' } };
        resLbl.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
        resLbl.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        resLbl.border = { top: tgM, left: tgM, bottom: tgM, right: tgM };
        tr++;

        const findParam = (keyword: string) =>
            tgParams.find((p: any) => String(p.parametro).includes(keyword));

        const tgUGTotal   = tgAparatos.reduce((s: number, a: any) => s + (Number(a.totalUG) || 0), 0);
        const tgCaudal    = parseFloat(findParam('CAUDAL DE DISEÑO')?.calculos ?? 0);
        const tgVolLts    = parseFloat(findParam('VOLUMEN UTIL CALCULADO (lts)')?.calculos ?? 0);
        const tgProfTotal = parseFloat(findParam('PROFUNDIDAD (CON BORDE LIBRE)')?.calculos ?? 0);

        const resumenRows = [
            { label: 'UG Total',          valor: tgUGTotal,   fmt: '0',     unidad: ''    },
            { label: 'Caudal diseño Q',   valor: tgCaudal,    fmt: '0.000', unidad: 'lps' },
            { label: 'V útil calculado',  valor: tgVolLts,    fmt: '0',     unidad: 'lts' },
            { label: 'Profundidad total', valor: tgProfTotal, fmt: '0.00',  unidad: 'm'   },
        ];

        resumenRows.forEach((item, idx) => {
            const bg = idx % 2 === 0 ? 'FFEFF6FF' : 'FFDBEAFE';
            tgFill(tr, bg, 17);
            wsTrampa.mergeCells(tr, 2, tr, 4);
            tgCell(tr, 2, item.label, { bg, halign: 'left', color: 'FF374151' });
            for (let c = 3; c <= 4; c++) {
                wsTrampa.getCell(tr, c).fill = { type: 'pattern', pattern: 'solid',
                    fgColor: { argb: bg } };
                wsTrampa.getCell(tr, c).border = { top: tgT, bottom: tgT };
            }
            tgCell(tr, 5, item.valor,  { bg, halign: 'center', bold: true,
                color: 'FF1D4ED8', numFmt: item.fmt });
            tgCell(tr, 6, item.unidad, { bg, halign: 'center', color: 'FF6B7280' });
            tr++;
        });

        // ── Comentario ────────────────────────────────────────────────────────
        if (tgComentario) {
            tgSep(tr); tr++;

            tgFill(tr, 'FFF8FAFC', 14);
            wsTrampa.mergeCells(tr, 2, tr, TG);
            const comLbl = wsTrampa.getCell(tr, 2);
            comLbl.value = 'COMENTARIO:';
            comLbl.font  = { bold: true, size: 9, name: 'Arial', color: { argb: TG_NEGRO } };
            comLbl.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            comLbl.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            comLbl.border = { top: tgT, left: tgM, bottom: tgT, right: tgM };
            tr++;

            const lines  = tgComentario.split('\n');
            const linesH = Math.max(30, lines.length * 15);
            tgFill(tr, TG_BLANC, linesH);
            wsTrampa.mergeCells(tr, 2, tr, TG);
            const comCell = wsTrampa.getCell(tr, 2);
            comCell.value = tgComentario;
            comCell.font  = { size: 9, name: 'Arial', color: { argb: TG_NEGRO } };
            comCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: TG_BLANC } };
            comCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
            comCell.border = { top: tgT, left: tgM, bottom: tgM, right: tgM };
            tr++;
        }

        tgSep(tr); tr++;


        // ========== GENERAR ARCHIVO ==========
        if (proyecto) {
            for (const sheet of workbook.worksheets) {
                const numCols = sheet.columns?.length || sheet.columnCount || 5;
                await addProjectHeaderAndFooter(workbook, sheet, proyecto, numCols, 'CÁLCULO DE DESAGÜE Y VENTILACIÓN');
            }
        }
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

