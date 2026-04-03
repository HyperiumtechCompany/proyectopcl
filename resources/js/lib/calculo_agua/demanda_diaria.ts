import type ExcelJS from 'exceljs';

interface DemandaDiariaData {
    tabla1?: any[];
    tabla2?: any[];
    tabla3?: any[];
}

export async function exportDemandaDiariaToExcel(
    workbook: ExcelJS.Workbook, // <-- Pon esto primero
    data: DemandaDiariaData     // <-- Los datos van después
) {
    const ws1 = workbook.addWorksheet('1. Demanda Diaria');

    const DD = 6;
    ws1.columns = [
        { width: 3  }, 
        { width: 38 }, 
        { width: 20 }, 
        { width: 18 }, 
        { width: 28 }, 
        { width: 16 }, 
    ];

    const DD_BLANC = 'FFFFFFFF';
    const DD_AMAR  = 'FFFFFF99';
    const DD_ALT   = 'FFE8F0FB';
    const DD_TOT   = 'FFFFCC00';
    const DD_NEGRO = 'FF000000';
    const DD_TITLE = 'FF1F4E78';

    const ddBT = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFA0A0A0' } };
    const ddBM = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FF999933' } };

    function ddFill(r: number, argb: string, h = 17) {
        ws1.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DD_BLANC } };
        for (let c = 2; c <= DD; c++)
            ws1.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
        ws1.getRow(r).height = h;
    }

    function ddCell(r: number, c: number, val: any, opts: {
        bold?: boolean; size?: number; bg?: string; color?: string;
        halign?: ExcelJS.Alignment['horizontal']; numFmt?: string; border?: 'T' | 'M';
    } = {}) {
        const cell = ws1.getCell(r, c);
        cell.value = val ?? null;
        cell.font  = { bold: opts.bold ?? false, size: opts.size ?? 9, name: 'Arial',
                       color: { argb: opts.color ?? DD_NEGRO } };
        if (opts.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.bg } };
        cell.alignment = { horizontal: opts.halign ?? 'left', vertical: 'middle', wrapText: c === 2 };
        const b = opts.border === 'M' ? ddBM : ddBT;
        cell.border = { top: b, bottom: b, left: c === 2 ? b : ddBT, right: c === DD ? b : ddBT };
        if (opts.numFmt) cell.numFmt = opts.numFmt;
    }

    function ddSep(r: number) {
        ws1.getRow(r).height = 6;
        for (let c = 1; c <= DD; c++)
            ws1.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DD_BLANC } };
    }

    function ddSectionHeader(r: number, title: string, bg: string) {
        ddFill(r, bg, 20);
        ws1.mergeCells(r, 2, r, DD);
        const cell = ws1.getCell(r, 2);
        cell.value = title;
        cell.font  = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        cell.border = { top: ddBM, left: ddBM, bottom: ddBM, right: ddBM };
    }

    function ddColHeaders(r: number) {
        ddFill(r, DD_AMAR, 18);
        ['AMBIENTE', 'USO', 'CANTIDAD', 'DOTACIÓN', 'CAUDAL (Lt/día)'].forEach((txt, i) => {
            ddCell(r, i + 2, txt, { bold: true, bg: DD_AMAR,
                halign: i === 0 ? 'left' : 'center', border: 'M' });
        });
    }

    function ddFmtCantidad(cantidad: number, dotacion: string): string {
        const s = String(dotacion ?? '');
        const v = (isFinite(cantidad) ? cantidad : 0).toFixed(2);
        if (s.includes('m2'))  return `${v} m2`;
        if (s.includes('per')) return `${v} per`;
        return v;
    }

    function ddDataRows(rows: any[], startR: number): number {
        let r = startR;
        if (rows.length === 0) {
            ddFill(r, DD_BLANC, 17);
            for (let c = 2; c <= DD; c++) ddCell(r, c, '', { bg: DD_BLANC });
            r++;
        } else {
            rows.forEach((row: any, idx: number) => {
                const bg = idx % 2 === 0 ? DD_BLANC : DD_ALT;
                ddFill(r, bg, 17);
                ddCell(r, 2, row.ambiente ?? '', { bg, halign: 'left' });
                ddCell(r, 3, row.uso      ?? '', { bg, halign: 'center' });
                ddCell(r, 4, ddFmtCantidad(parseFloat(row.cantidad) || 0, row.dotacion),
                    { bg, halign: 'center' });
                ddCell(r, 5, row.dotacion ?? '', { bg, halign: 'center' });
                ddCell(r, 6, parseFloat(row.caudal) || 0,
                    { bg, halign: 'center', numFmt: '#,##0.00', color: DD_TITLE });
                r++;
            });
        }
        return r;
    }

    function ddSubtotalRow(r: number, label: string, dataStart: number, bg = DD_TOT): number {
        ddFill(r, bg, 20);
        ws1.mergeCells(r, 2, r, 5);
        ddCell(r, 2, label, { bold: true, size: 9, bg, halign: 'right',
            color: bg === DD_TOT ? DD_TITLE : 'FF2E7D32', border: 'M' });
        for (let c = 3; c <= 5; c++) {
            ws1.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            ws1.getCell(r, c).border = { top: ddBM, bottom: ddBM };
        }
        ddCell(r, 6, { formula: `SUM(F${dataStart}:F${r - 1})` },
            { bold: true, bg, halign: 'center', numFmt: '#,##0.00', border: 'M',
              color: bg === DD_TOT ? DD_TITLE : 'FF2E7D32' });
        return r;
    }

    const ddT1 = Array.isArray(data.tabla1) ? data.tabla1 : [];
    const ddT2 = Array.isArray(data.tabla2) ? data.tabla2 : [];
    const ddT3 = Array.isArray(data.tabla3) ? data.tabla3 : [];

    let dr = 1;

    // Título
    ddFill(dr, DD_TITLE, 26);
    ws1.mergeCells(dr, 2, dr, DD);
    const ddTit = ws1.getCell(dr, 2);
    ddTit.value = '1. CÁLCULO DE LA DEMANDA DIARIA';
    ddTit.font  = { bold: true, size: 13, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    ddTit.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: DD_TITLE } };
    ddTit.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    ddTit.border = { top: ddBM, left: ddBM, bottom: ddBM, right: ddBM };
    dr++;

    // SECCIÓN 1: PERSONAL Y ALUMNADO 
    ddSep(dr); dr++;
    ddSectionHeader(dr, '1. PERSONAL Y ALUMNADO', 'FF1565C0'); dr++;
    ddColHeaders(dr); dr++;
    const dd1Start = dr;
    dr = ddDataRows(ddT1, dr);
    const dd1TotalRow = dr;
    ddSubtotalRow(dr, 'SUBTOTAL PERSONAL Y ALUMNADO =', dd1Start); dr++;

    // SECCIÓN 2: MÓDULOS DE ARQUITECTURA 
    ddSep(dr); dr++;
    ddSep(dr); dr++;
    ddSectionHeader(dr, '2. MÓDULOS DE ARQUITECTURA (PISOS)', 'FF2E7D32'); dr++;

    const pisoSubtotalRows: number[] = [];

    if (ddT2.length === 0) {
        ddColHeaders(dr); dr++;
        ddFill(dr, DD_BLANC, 17);
        for (let c = 2; c <= DD; c++) ddCell(dr, c, '', { bg: DD_BLANC });
        dr++;
    } else {
        ddT2.forEach((piso: any, pi: number) => {
            // Sub-encabezado del piso
            ddFill(dr, 'FFE8F5E9', 18);
            ws1.mergeCells(dr, 2, dr, DD);
            const pisoCell = ws1.getCell(dr, 2);
            pisoCell.value = `NIVEL / PISO ${pi + 1}`;
            pisoCell.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF1B5E20' } };
            pisoCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
            pisoCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 2 };
            pisoCell.border = { top: ddBT, left: ddBM, bottom: ddBT, right: ddBM };
            dr++;

            ddColHeaders(dr); dr++;

            const pisoDataStart = dr;
            const modulos = Array.isArray(piso.modulos) ? piso.modulos : [];
            dr = ddDataRows(modulos, dr);

            // Subtotal piso — fondo verde suave
            pisoSubtotalRows.push(dr);
            ddSubtotalRow(dr, `SUBTOTAL PISO ${pi + 1} =`, pisoDataStart, 'FFE8F5E9'); dr++;

            if (pi < ddT2.length - 1) { ddSep(dr); dr++; }
        });
    }

    // Total sección 2 — suma de subtotales de pisos
    ddSep(dr); dr++;
    const dd2TotalRow = dr;
    ddFill(dr, DD_TOT, 20);
    ws1.mergeCells(dr, 2, dr, 5);
    ddCell(dr, 2, 'SUBTOTAL MÓDULOS DE ARQUITECTURA =',
        { bold: true, bg: DD_TOT, halign: 'right', color: DD_TITLE, border: 'M' });
    for (let c = 3; c <= 5; c++) {
        ws1.getCell(dr, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DD_TOT } };
        ws1.getCell(dr, c).border = { top: ddBM, bottom: ddBM };
    }
    ddCell(dr, 6,
        pisoSubtotalRows.length > 0
            ? { formula: pisoSubtotalRows.map(r => `F${r}`).join('+') }
            : 0,
        { bold: true, bg: DD_TOT, halign: 'center', numFmt: '#,##0.00', border: 'M', color: DD_TITLE });
    dr++;

    // SECCIÓN 3: PLANTAS Y JARDINES 
    ddSep(dr); dr++;
    ddSep(dr); dr++;
    ddSectionHeader(dr, '3. PLANTAS GENERALES Y JARDINES', 'FF4527A0'); dr++;
    ddColHeaders(dr); dr++;
    const dd3Start = dr;
    dr = ddDataRows(ddT3, dr);
    const dd3TotalRow = dr;
    ddSubtotalRow(dr, 'SUBTOTAL PLANTAS Y JARDINES =', dd3Start); dr++;

    // TOTAL GENERAL
    ddSep(dr); dr++;
    ddSep(dr); dr++;
    ddFill(dr, DD_TITLE, 28);
    ws1.mergeCells(dr, 2, dr, 5);
    const ddGrand = ws1.getCell(dr, 2);
    ddGrand.value = 'VOLUMEN DE DEMANDA DIARIA TOTAL =';
    ddGrand.font  = { bold: true, size: 11, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    ddGrand.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: DD_TITLE } };
    ddGrand.alignment = { horizontal: 'right', vertical: 'middle' };
    ddGrand.border = { top: ddBM, left: ddBM, bottom: ddBM, right: ddBM };
    for (let c = 3; c <= 5; c++) {
        ws1.getCell(dr, c).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: DD_TITLE } };
        ws1.getCell(dr, c).border = { top: ddBM, bottom: ddBM };
    }
    ddCell(dr, 6,
        { formula: `F${dd1TotalRow}+F${dd2TotalRow}+F${dd3TotalRow}` },
        { bold: true, size: 12, bg: DD_TOT, halign: 'center',
          numFmt: '#,##0.00', border: 'M', color: DD_TITLE });
    dr++;
    ddSep(dr); dr++;

    // Generar el archivo
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Calculo_Demanda_Diaria.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}