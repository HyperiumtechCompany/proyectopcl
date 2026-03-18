import ExcelJS from 'exceljs';

interface AguaData {
    demandaDiaria?: any;
    cisterna?: any;
    tanque?: any;
    redAlimentacion?: any;
    maximademandasimultanea?: any;
    bombeoTanqueElevado?: any;
    tuberiasRD?: any;
    redesInteriores?: any;
    redderiesgo?: any;
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
    BLUE: 'FF1F4E78',
    LIGHT_BLUE: 'FFE8F0FB',
    WHITE: 'FFFFFFFF',
};

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
            if (typeof values[c] === 'number') cell.numFmt = '#,##0.00';
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
// Función principal de exportación
export async function exportAguaToExcel(dataSheet: AguaData, fileName: string = 'Calculo_Agua') {
    const workbook = new ExcelJS.Workbook();

    // HOJA 1: DEMANDA DIARIA
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

    // Fila subtotal con SUM — devuelve el número de fila escrita
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

    // Datos
    const ddData = dataSheet.demandaDiaria || {};
    const ddT1   = Array.isArray(ddData.tabla1) ? ddData.tabla1 : [];
    const ddT2   = Array.isArray(ddData.tabla2) ? ddData.tabla2 : [];
    const ddT3   = Array.isArray(ddData.tabla3) ? ddData.tabla3 : [];

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
    //------------------------------------------------------------------------------------------------------------------------------------------
   
    // HOJA 2: CISTERNA 
    const ws2 = workbook.addWorksheet('2. Cisterna');

    const CS = 13;
    ws2.columns = [
        { width: 3  }, // 1  
        { width: 14 }, // 2  
        { width: 14 }, // 3  
        { width: 14 }, // 4  
        { width: 14 }, // 5  
        { width: 14 }, // 6  
        { width: 14 }, // 7  
        { width: 14 }, // 8  
        { width: 14 }, // 9  
        { width: 3  }, // 10 
        { width: 24 }, // 11 
        { width: 14 }, // 12 
        { width: 6  }, // 13 
    ];

    const CS_BLANC  = 'FFFFFFFF';
    const CS_NEGRO  = 'FF000000';
    const CS_BLUE   = 'FF0A2A4A';
    const CS_BLUE2  = 'FF2A5A8A';
    const CS_SEC    = 'FFdce8f0';
    const CS_OK_BG  = 'FFF5F5D8';
    const CS_WARN   = 'FFFFF0F0';
    const CS_F4F8   = 'FFF4F8FC';
    const CS_F0F4FA = 'FFF0F4FA';
    const CS_FAFAF4 = 'FFFAFAF4';

    const c2BT  = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFBBBBBB' } };
    const c2BM  = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FF888888' } };
    const c2BLU = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: CS_BLUE2  } };
    const c2BBL = { style: 'thick'  as ExcelJS.BorderStyle, color: { argb: CS_BLUE2  } };

    function c2Sep(r: number, h = 8) {
        ws2.getRow(r).height = h;
        for (let c = 1; c <= CS; c++)
            ws2.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: CS_BLANC } };
    }

    function c2Fill(r: number, bg: string, h = 17) {
        ws2.getRow(r).height = h;
        for (let c = 1; c <= CS; c++)
            ws2.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: c === 1 ? CS_BLANC : bg } };
    }

    function c2Wide(r: number, text: string, opts: {
        bg?: string; h?: number; bold?: boolean; size?: number;
        color?: string; halign?: ExcelJS.Alignment['horizontal'];
        italic?: boolean; borderStyle?: 'all' | 'bottom';
    } = {}) {
        const bg = opts.bg ?? CS_BLANC;
        c2Fill(r, bg, opts.h ?? 18);
        ws2.mergeCells(r, 2, r, CS);
        const cell = ws2.getCell(r, 2);
        cell.value = text;
        cell.font  = { bold: opts.bold ?? false, size: opts.size ?? 10,
                       name: 'Arial', italic: opts.italic ?? false,
                       color: { argb: opts.color ?? CS_NEGRO } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.alignment = { horizontal: opts.halign ?? 'left', vertical: 'middle',
                           indent: 1, wrapText: true };
        if (opts.borderStyle === 'all')
            cell.border = { top: c2BT, left: c2BM, bottom: c2BT, right: c2BM };
        else if (opts.borderStyle === 'bottom')
            cell.border = { bottom: c2BBL };
    }

    // SVG → PNG 
    async function svgToPngBase64(svgStr: string, w: number, h: number): Promise<string> {
        return new Promise((resolve, reject) => {
            const img  = new Image();
            const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
            const url  = URL.createObjectURL(blob);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d')!;
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                URL.revokeObjectURL(url);
                resolve(canvas.toDataURL('image/png').split(',')[1]);
            };
            img.onerror = reject;
            img.src = url;
        });
    }

    // SVG DIAGRAMA 
    function buildCisternaSVG(d: any): string {
        const top      = parseFloat(d.nivelagua)   || 0.65;
        const altUtil  = parseFloat(d.alturaUtil)   || 1.90;
        const altTecho = parseFloat(d.alturaTecho)  || 0.20;
        const largo    = parseFloat(d.largo)        || 4.40;
        const altIng   = altUtil <= 12 ? 0.15 : altUtil <= 30 ? 0.20 : 0.30;
        const hrVal    = altUtil > 30  ? 0.15 : 0.10;
        const n1 = +(top - 0.20).toFixed(4);
        const n2 = +(n1 - altTecho).toFixed(4);
        const n3 = +(n2 - altIng).toFixed(4);
        const n4 = +(n3 - hrVal).toFixed(4);
        const n5 = +(n4 - altUtil).toFixed(4);

        const VW = 820, VH = 560;
        const tL = 50, tW = 260, svgTop = 70, svgBot = 460;
        const span = svgBot - svgTop, wT = 18, slabT = 18;
        const elevMin = n5 - 0.15, elevMax = top + 0.05;
        const e2y = (e: number) => svgTop + ((elevMax - e) / (elevMax - elevMin)) * span;
        const yTop = e2y(top), yIntTop = e2y(n1), yN2 = e2y(n2), yN3 = e2y(n3);
        const yN4 = e2y(n4), yN5 = e2y(n5), yFondo = yN5 + slabT, yNTN = e2y(0);
        const iL = tL + wT, iR = tL + tW - wT, iW = iR - iL;
        const aX = tL + tW + 30, bW = 28, lX = aX + bW + 10;
        const nBW = 138, nBX = VW - nBW - 6;
        const f2 = (v: number) => (isFinite(v) ? v : 0).toFixed(2);
        const sg = (v: number) => `${v >= 0 ? '+' : ''}${f2(v)}`;

        const bracket = (y1: number, y2: number, color: string,
                         lbl: string, sub: string, val: string) => {
            if (!isFinite(y1)||!isFinite(y2)||Math.abs(y2-y1)<5) return '';
            const my = (y1+y2)/2;
            return `
              <line x1="${aX}" y1="${y1}" x2="${aX}" y2="${y2}" stroke="${color}" stroke-width="2"/>
              <line x1="${aX}" y1="${y1}" x2="${aX+bW}" y2="${y1}" stroke="${color}" stroke-width="2"/>
              <line x1="${aX}" y1="${y2}" x2="${aX+bW}" y2="${y2}" stroke="${color}" stroke-width="2"/>
              <text x="${lX}" y="${my-7}" font-size="12" fill="#111"
                font-family="Courier New,monospace">${lbl} ${sub}</text>
              <text x="${lX}" y="${my+10}" font-size="13" font-weight="bold"
                fill="#111" font-family="Courier New,monospace">= ${val} m</text>`;
        };

        const nvBox = (y: number, lbl: string, red = false) => `
          <line x1="${iR+3}" y1="${y}" x2="${nBX-6}" y2="${y}"
            stroke="${red?'#c00':'#aaa'}" stroke-width="${red?2:1}"
            stroke-dasharray="${red?'0':'6 3'}"/>
          <line x1="${nBX-6}" y1="${y}" x2="${nBX}" y2="${y}"
            stroke="${red?'#c00':'#555'}" stroke-width="1.5"/>
          <rect x="${nBX}" y="${y-12}" width="${nBW}" height="24" rx="3"
            fill="${red?'#fff0f0':'white'}"
            stroke="${red?'#c00':'#999'}" stroke-width="${red?2:1.5}"/>
          <text x="${nBX+nBW/2}" y="${y+1}" text-anchor="middle"
            dominant-baseline="middle" font-size="11"
            fill="${red?'#c00':'#222'}" font-family="Courier New,monospace"
            font-weight="${red?'bold':'normal'}">Nivel = ${lbl} m</text>`;

        return `<svg viewBox="0 0 ${VW} ${VH}" width="${VW}" height="${VH}"
              xmlns="http://www.w3.org/2000/svg">
          <rect width="${VW}" height="${VH}" fill="white"/>
          <defs>
            <pattern id="hatch" patternUnits="userSpaceOnUse" width="8" height="8"
              patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="#999" stroke-width="1" opacity="0.5"/>
            </pattern>
          </defs>
          <line x1="${tL-50}" y1="${yNTN}" x2="${tL+tW+55}" y2="${yNTN}"
            stroke="#555" stroke-width="1.5" stroke-dasharray="10 4"/>
          <text x="${tL-48}" y="${yNTN-6}" font-size="11" fill="#555"
            font-family="Courier New,monospace">NTN</text>
          <rect x="${tL-50}" y="${yNTN}" width="46" height="${yFondo-yNTN+22}" fill="#e8e0c8" opacity="0.4"/>
          <rect x="${tL+tW+4}" y="${yNTN}" width="46" height="${yFondo-yNTN+22}" fill="#e8e0c8" opacity="0.4"/>
          <rect x="${tL}" y="${yTop}" width="${tW}" height="${yFondo-yTop}"
            fill="#c8c8c0" stroke="#666" stroke-width="2.5" rx="2"/>
          <rect x="${tL}" y="${yTop}" width="${wT}" height="${yFondo-yTop}" fill="url(#hatch)"/>
          <rect x="${iR}" y="${yTop}" width="${wT}" height="${yFondo-yTop}" fill="url(#hatch)"/>
          <rect x="${tL}" y="${yTop}" width="${tW}" height="${yIntTop-yTop}" fill="url(#hatch)"/>
          <rect x="${tL}" y="${yN5}" width="${tW}" height="${slabT}" fill="url(#hatch)"/>
          <rect x="${iL}" y="${yIntTop}" width="${iW}" height="${yN5-yIntTop}" fill="white"/>
          <rect x="${iL}" y="${yIntTop}" width="${iW}" height="${Math.max(yN4-yIntTop,0)}" fill="#f0f0ea"/>
          <rect x="${iL}" y="${yN4}" width="${iW}" height="${Math.max(yN5-yN4,0)}" fill="#c5e5f8"/>
          <rect x="${iL}" y="${yIntTop}" width="${iW}" height="${yN5-yIntTop}"
            fill="none" stroke="#888" stroke-width="2"/>
          ${(yN4-yIntTop)>35?`<text x="${iL+iW/2}" y="${(yIntTop+yN4)/2}"
            font-size="20" font-family="Courier New,monospace" font-weight="bold"
            fill="#bbb" text-anchor="middle" dominant-baseline="middle"
            transform="rotate(-18,${iL+iW/2},${(yIntTop+yN4)/2})"
            letter-spacing="3" opacity="0.6">BORDE LIBRE</text>`:''}
          <line x1="${iL+4}" y1="${yN2}" x2="${iR-4}" y2="${yN2}" stroke="#cc7744" stroke-width="2" stroke-dasharray="9 5"/>
          <line x1="${iL+4}" y1="${yN3}" x2="${iR-4}" y2="${yN3}" stroke="#4488cc" stroke-width="2" stroke-dasharray="9 5"/>
          <line x1="${iL+4}" y1="${yN4}" x2="${iR-4}" y2="${yN4}" stroke="#c03030" stroke-width="2" stroke-dasharray="9 5"/>
          <line x1="${iL+4}" y1="${yN5}" x2="${iR-4}" y2="${yN5}" stroke="#aaa"    stroke-width="2" stroke-dasharray="9 5"/>
          <rect x="${iR+1}" y="${yN2-13}" width="8" height="26" fill="#cc7744" stroke="#994422" stroke-width="1.5"/>
          <rect x="${iR-9}" y="${yN2-8}"  width="22" height="16" fill="#cc7744" stroke="#994422" stroke-width="2" rx="2"/>
          <rect x="${iR+1}" y="${yN3-13}" width="8" height="26" fill="#559944" stroke="#337722" stroke-width="1.5"/>
          <rect x="${iR-9}" y="${yN3-8}"  width="22" height="16" fill="#559944" stroke="#337722" stroke-width="2" rx="2"/>
          <rect x="${tL}" y="${yTop-22}" width="128" height="22" rx="3" fill="#1a1a1a"/>
          <text x="${tL+64}" y="${yTop-11}" text-anchor="middle" dominant-baseline="middle"
            font-size="12" fill="white" font-family="Courier New,monospace" font-weight="bold">
            Nivel = ${sg(top)} m</text>
          <rect x="${aX+10}" y="${yNTN-13}" width="108" height="24" rx="3"
            fill="white" stroke="#c00" stroke-width="2"/>
          <text x="${aX+64}" y="${yNTN-1}" text-anchor="middle" dominant-baseline="middle"
            font-size="12" fill="#c00" font-family="Courier New,monospace" font-weight="bold">
            NTN = +0.00 m</text>
          ${bracket(yIntTop,yN2,'#994422','H. techo',  '(Ht)',f2(altTecho))}
          ${bracket(yN2,    yN3,'#4488cc','H. ingreso','(Hi)',f2(altIng))}
          ${bracket(yN3,    yN4,'#c03030','H. rebose', '(Hr)',f2(hrVal))}
          ${(yN5-yN4)>18?`<text x="${lX}" y="${(yN4+yN5)/2}" dominant-baseline="middle"
            font-size="13" fill="#111" font-family="Courier New,monospace">
            Altura de agua (Ha) = <tspan font-weight="bold">${f2(altUtil)} m</tspan>
          </text>`:''}
          ${nvBox(yIntTop,sg(n1))}${nvBox(yN2,sg(n2))}${nvBox(yN3,sg(n3))}
          ${nvBox(yN4,sg(n4),true)}${nvBox(yN5,sg(n5))}
          <line x1="${tL-25}" y1="${yIntTop}" x2="${tL-25}" y2="${yN5}" stroke="#333" stroke-width="2"/>
          <line x1="${tL-33}" y1="${yIntTop}" x2="${tL-17}" y2="${yIntTop}" stroke="#333" stroke-width="2"/>
          <line x1="${tL-33}" y1="${yN5}"     x2="${tL-17}" y2="${yN5}"     stroke="#333" stroke-width="2"/>
          <text x="${tL-43}" y="${(yIntTop+yN5)/2}" text-anchor="middle"
            transform="rotate(-90,${tL-43},${(yIntTop+yN5)/2})"
            font-size="15" font-weight="bold" fill="#333"
            font-family="Courier New,monospace">H</text>
          <line x1="${iL}" y1="${yFondo+24}" x2="${iR}" y2="${yFondo+24}" stroke="#333" stroke-width="2"/>
          <line x1="${iL}" y1="${yFondo+17}" x2="${iL}" y2="${yFondo+31}" stroke="#333" stroke-width="2"/>
          <line x1="${iR}" y1="${yFondo+17}" x2="${iR}" y2="${yFondo+31}" stroke="#333" stroke-width="2"/>
          <text x="${(iL+iR)/2}" y="${yFondo+46}" text-anchor="middle"
            font-size="13" fill="#333" font-family="Courier New,monospace">
            L = ${f2(largo)} m</text>
        </svg>`;
    }

    // Leer datos 
    const csD        = dataSheet.cisterna || {};
    const csConsumo  = parseFloat(csD.consumoDiario)    || 0;
    const csLargo    = parseFloat(csD.largo)            || 4.40;
    const csAncho    = parseFloat(csD.ancho)            || 2.70;
    const csAltUtil  = parseFloat(csD.alturaUtil)       || 1.90;
    const csBL       = parseFloat(csD.bordeLibre)       || 0.50;
    const csNivAgua  = parseFloat(csD.nivelagua)        || 0.65;
    const csAltTecho = parseFloat(csD.alturaTecho)      || 0.20;
    const csVolCist  = parseFloat(csD.volumenCisterna)  ||
        Math.ceil((3/4) * csConsumo / 1000 * 10) / 10;
    const csVolCalc  = parseFloat(csD.volumenCalculado) || csLargo * csAncho * csAltUtil;
    const csAltTot   = parseFloat(csD.alturaTotal)      || csAltUtil + csBL + csAltTecho;
    const csArea     = csLargo * csAncho;
    const csAltAMin  = csArea > 0 ? csVolCist / csArea : 0;
    const csAltIng   = parseFloat(csD.altIng) ||
        (csAltUtil <= 12 ? 0.15 : csAltUtil <= 30 ? 0.20 : 0.30);
    const csHrVal    = parseFloat(csD.hrVal) || (csAltUtil > 30 ? 0.15 : 0.10);
    const csN1 = parseFloat(csD.n1) || +(csNivAgua - 0.20).toFixed(4);
    const csN2 = parseFloat(csD.n2) || +(csN1 - csAltTecho).toFixed(4);
    const csN3 = parseFloat(csD.n3) || +(csN2 - csAltIng).toFixed(4);
    const csN4 = parseFloat(csD.n4) || +(csN3 - csHrVal).toFixed(4);
    const csN5 = parseFloat(csD.n5) || +(csN4 - csAltUtil).toFixed(4);
    const csOk = csVolCalc >= csVolCist;

    let cr = 1;

    // TÍTULO "2.1. CISTERNA" 
    c2Fill(cr, CS_BLANC, 36);
    ws2.mergeCells(cr, 2, cr, CS);
    const csTit = ws2.getCell(cr, 2);
    csTit.value = '2.1. CISTERNA';
    csTit.font  = { bold: true, size: 16, name: 'Times New Roman',
                    color: { argb: CS_BLUE } };
    csTit.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
    csTit.alignment = { horizontal: 'left', vertical: 'bottom' };
    csTit.border = { bottom: c2BBL };
    cr++;
    c2Sep(cr, 14); cr++;

    // 2.1.1 barra sección 
    c2Fill(cr, CS_SEC, 26);
    ws2.mergeCells(cr, 2, cr, CS);
    const cs11 = ws2.getCell(cr, 2);
    cs11.value = '2.1.1. CALCULO DE VOLUMEN DE LA CISTERNA';
    cs11.font  = { bold: true, size: 12, name: 'Arial', color: { argb: CS_NEGRO } };
    cs11.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_SEC } };
    cs11.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    cs11.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
    cr++;
    c2Sep(cr, 8); cr++;

    // Fórmula box 
    c2Fill(cr, CS_FAFAF4, 30);
    ws2.mergeCells(cr, 2, cr, CS);
    const csForm = ws2.getCell(cr, 2);
    csForm.value = 'VOL. DE CISTERNA  =  3/4  ×  CONSUMO DIARIO TOTAL';
    csForm.font  = { bold: true, size: 13, name: 'Arial', italic: true,
                     color: { argb: CS_NEGRO } };
    csForm.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_FAFAF4 } };
    csForm.alignment = { horizontal: 'center', vertical: 'middle' };
    csForm.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
    cr++;
    c2Sep(cr, 8); cr++;

    // 4 Cards 
    ws2.getRow(cr).height = 58;
    for (let c = 1; c <= CS; c++)
        ws2.getCell(cr, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: CS_BLANC } };
    [
        { lbl: 'CONSUMO DIARIO',      val: `${csConsumo.toFixed(2)} Lt`,
          bg: 'FFF8FAFC', vc: 'FF1A4A7A' },
        { lbl: 'VOL. DE CISTERNA',    val: `${csVolCist.toFixed(2)} m³`,
          bg: 'FFEAF0FA', vc: 'FF1A4A7A' },
        { lbl: 'VOL. TOTAL MÍNIMO',   val: `${csVolCist.toFixed(2)} m³`,
          bg: 'FFEAF5EE', vc: 'FF2A6A4A' },
        { lbl: 'ALTURA DE AGUA MÍN.', val: `${csAltAMin.toFixed(2)} m`,
          bg: 'FFFAF0E8', vc: 'FF6A3A1A' },
    ].forEach((card, i) => {
        const cell = ws2.getCell(cr, i + 2);
        cell.value = {
            richText: [
                { text: card.lbl + '\n',
                  font: { size: 8, color: { argb: 'FF666666' }, name: 'Arial' } },
                { text: card.val,
                  font: { size: 14, bold: true,
                          color: { argb: card.vc }, name: 'Arial' } },
            ]
        } as ExcelJS.CellRichTextValue;
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: card.bg } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        const bc = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: card.vc } };
        cell.border = { top: bc, left: bc, bottom: bc, right: bc };
    });
    cr++;
    c2Sep(cr, 12); cr++;

    // Consumo Diario Total 
    c2Fill(cr, CS_BLANC, 22);
    ws2.mergeCells(cr, 2, cr, 4);
    const csConLbl = ws2.getCell(cr, 2);
    csConLbl.value = 'Consumo Diario Total (Lt/día):';
    csConLbl.font  = { size: 11, name: 'Arial', color: { argb: 'FF555555' } };
    csConLbl.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
    csConLbl.alignment = { horizontal: 'left', vertical: 'middle' };
    const csConVal = ws2.getCell(cr, 5);
    csConVal.value  = csConsumo;
    csConVal.numFmt = '0';
    csConVal.font   = { size: 12, name: 'Courier New', color: { argb: CS_NEGRO } };
    csConVal.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F2' } };
    csConVal.alignment = { horizontal: 'center', vertical: 'middle' };
    csConVal.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
    ws2.mergeCells(cr, 6, cr, CS);
    ws2.getCell(cr, 6).fill = { type: 'pattern', pattern: 'solid',
        fgColor: { argb: CS_BLANC } };
    cr++;
    c2Sep(cr, 8); cr++;
    cr++;

    // Texto intro dims 
    c2Wide(cr, 'Cisterna de Concreto de cuyas dimensiones serán:',
        { size: 12, h: 22 }); cr++;
    c2Sep(cr, 8); cr++;
    cr++;

    // Inputs 
    const rDimS = cr;
    [
        { lbl: 'Largo (L) =',       v: csLargo   },
        { lbl: 'Ancho (A) =',       v: csAncho   },
        { lbl: 'Altura agua (H) =', v: csAltUtil },
    ].forEach(dim => {
        ws2.getRow(cr).height = 26;
        ws2.getCell(cr, 1).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: CS_BLANC } };
        const lc = ws2.getCell(cr, 2);
        lc.value = dim.lbl;
        lc.font  = { size: 12, name: 'Times New Roman', color: { argb: CS_NEGRO } };
        lc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        lc.alignment = { horizontal: 'right', vertical: 'middle' };
        const vc = ws2.getCell(cr, 3);
        vc.value  = dim.v;
        vc.numFmt = '0.00 "m"';
        vc.font   = { size: 14, bold: true, name: 'Courier New', color: { argb: CS_NEGRO } };
        vc.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        vc.alignment = { horizontal: 'right', vertical: 'middle' };
        vc.border = { top: c2BLU, left: c2BLU, bottom: c2BLU, right: c2BLU };
        ws2.getCell(cr, 4).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: CS_BLANC } };
        // fondo callout cols 5-CS
        for (let c = 5; c <= CS; c++)
            ws2.getCell(cr, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: CS_F0F4FA } };
        cr++;
    });
    // Callout note merge cols 5-CS
    ws2.mergeCells(rDimS, 5, cr - 1, CS);
    const csNote = ws2.getCell(rDimS, 5);
    csNote.value = 'Altura asumida como mínimo para mantenimiento y limpieza de la cisterna';
    csNote.font  = { bold: true, size: 11, name: 'Arial', color: { argb: 'FF0A2A5A' } };
    csNote.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_F0F4FA } };
    csNote.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    csNote.border = { top: c2BLU, left: c2BLU, bottom: c2BLU, right: c2BLU };
    c2Sep(cr, 8); cr++;
    cr++;

    // VOLUMEN box centrado 
    const csVolBg2 = csOk ? CS_OK_BG : CS_WARN;
    c2Fill(cr, csVolBg2, 32);
    ws2.mergeCells(cr, 2, cr, CS);
    const csVolBox = ws2.getCell(cr, 2);
    csVolBox.value = `VOLUMEN DE CISTERNA = ${csVolCalc.toFixed(2)} m³` +
        (csOk ? '' : `   ⚠ CORREGIR (mín. ${csVolCist.toFixed(2)} m³)`);
    csVolBox.font  = { bold: true, size: 14, name: 'Arial',
        color: { argb: csOk ? CS_NEGRO : 'FFCC0000' } };
    csVolBox.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: csVolBg2 } };
    csVolBox.alignment = { horizontal: 'center', vertical: 'middle' };
    csVolBox.border = { top: c2BM, left: c2BM, bottom: c2BM, right: c2BM };
    cr++;
    c2Sep(cr, 18); cr++;

    // 2.1.2 barra sección 
    c2Fill(cr, CS_SEC, 26);
    ws2.mergeCells(cr, 2, cr, CS);
    const cs12 = ws2.getCell(cr, 2);
    cs12.value = '2.1.2. DIMENSIONES DE LA CISTERNA';
    cs12.font  = { bold: true, size: 12, name: 'Arial', color: { argb: CS_NEGRO } };
    cs12.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_SEC } };
    cs12.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    cs12.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
    cr++;
    c2Sep(cr, 6); cr++;

    //  Tabla 2 
    [
        { k: 'ANCHO',
          d: 'Ancho de la Cisterna' },
        { k: 'LARGO',
          d: 'Largo de la Cisterna' },
        { k: 'ALTURA DE AGUA',
          d: 'Altura de agua de la Cisterna' },
        { k: 'ALTURA DE TUB. REBOSE',
          d: 'La distancia vertical entre los ejes del tubo de rebose y el máximo nivel de agua será igual al diámetro de aquel y nunca inferior a 0,10 m' },
        { k: 'ALTURA DE TUB. DE INGRESO',
          d: 'La distancia vertical entre los ejes de tubos de rebose y entrada de agua será igual al doble del diámetro del primero y en ningún caso menor de 0,15 m' },
        { k: 'ALTURA DE NIVEL DE TECHO',
          d: 'La distancia vertical entre el techo del depósito y el eje del tubo de entrada de agua, dependerá del diámetro de este, no pudiendo ser menor de 0,20 m' },
    ].forEach(row => {
        ws2.getRow(cr).height = 34;
        ws2.getCell(cr, 1).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: CS_BLANC } };
        const kc = ws2.getCell(cr, 2);
        kc.value = row.k;
        kc.font  = { bold: true, size: 10, name: 'Arial', color: { argb: CS_NEGRO } };
        kc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_F4F8 } };
        kc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1, wrapText: true };
        kc.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
        ws2.mergeCells(cr, 3, cr, CS);
        const dc = ws2.getCell(cr, 3);
        dc.value = row.d;
        dc.font  = { size: 10, name: 'Arial', color: { argb: CS_NEGRO } };
        dc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        dc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1, wrapText: true };
        dc.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
        cr++;

    });
    c2Sep(cr, 12); cr++;
    cr++;

    c2Wide(cr, 'Cisterna cuyas dimensiones serán:', { size: 12, h: 22 }); cr++;
    c2Sep(cr, 8); cr++;

    // ZONA HÍBRIDA:
    const IMG_W = 820, IMG_H = 560;
    const csImgStart = cr;
    const csImgRows  = 34; 

    const P   = 11;
    const pBT = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFCCCCCC' } };
    const pBM = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FF90B0CC' } };

    function pSectionLabel(r: number, text: string, bg: string, textColor: string) {
        ws2.getRow(r).height = 18;
        ws2.mergeCells(r, P, r, 13);
        const cell = ws2.getCell(r, P);
        cell.value = text;
        cell.font  = { bold: true, size: 8, name: 'Arial', color: { argb: textColor } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        cell.border = { top: pBM, left: pBM, bottom: pBM, right: pBM };
    }

    function pKVRow(r: number, label: string, val: string, opts: {
        labelBg?: string; valBg?: string; valColor?: string;
        labelColor?: string; h?: number;
    } = {}) {
        ws2.getRow(r).height = opts.h ?? 16;
        const lb = opts.labelBg ?? 'FFFFFFFF';
        const vb = opts.valBg   ?? 'FFFFFFFF';
        // col 11: label
        const lc = ws2.getCell(r, P);
        lc.value = label;
        lc.font  = { size: 9, name: 'Arial',
                     color: { argb: opts.labelColor ?? 'FF555555' } };
        lc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: lb } };
        lc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        lc.border = { top: pBT, left: pBT, bottom: pBT };
        // col 12: valor
        const vc = ws2.getCell(r, 12);
        vc.value = val;
        vc.font  = { size: 10, bold: true, name: 'Courier New',
                     color: { argb: opts.valColor ?? 'FF1A4A7A' } };
        vc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: vb } };
        vc.alignment = { horizontal: 'right', vertical: 'middle' };
        vc.border = { top: pBT, bottom: pBT };
        
        const uc = ws2.getCell(r, 13);
        uc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: lb } };
        uc.border = { top: pBT, right: pBT, bottom: pBT };
    }

    function pInputRow(r: number, label: string, val: number, highlight: boolean) {
        ws2.getRow(r).height = 20;
        const bg = highlight ? 'FFFFFBE6' : 'FFFFFFFF';
        const bc = highlight
            ? { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FFD4A020' } }
            : { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFD0D0D0' } };
        // col 11: label
        const lc = ws2.getCell(r, P);
        lc.value = label;
        lc.font  = { size: 10, name: 'Arial', bold: highlight, color: { argb: 'FF222222' } };
        lc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        lc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        lc.border = { top: bc, left: bc, bottom: bc };
       
        const vc = ws2.getCell(r, 12);
        vc.value  = val;
        vc.numFmt = '0.00';
        vc.font   = { size: 12, bold: true, name: 'Courier New',
                      color: { argb: 'FF000000' } };
        vc.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        vc.alignment = { horizontal: 'right', vertical: 'middle' };
        vc.border = { top: bc, bottom: bc };
        // col 13: unidad m
        const uc = ws2.getCell(r, 13);
        uc.value = 'm';
        uc.font  = { size: 9, name: 'Arial', color: { argb: 'FF666666' } };
        uc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        uc.alignment = { horizontal: 'left', vertical: 'middle' };
        uc.border = { top: bc, right: bc, bottom: bc };
    }

    // Preparar todas las filas de la zona híbrida 
    for (let i = 0; i < csImgRows; i++) {
        const r = cr + i;
        ws2.getRow(r).height = 16.5;
        ws2.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: CS_BLANC } };

        for (let c = 2; c <= 9; c++)
            ws2.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: CS_BLANC } }

        ws2.getCell(r, 10).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: CS_BLANC } };
       
        for (let c = 11; c <= 13; c++)
            ws2.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: CS_F4F8 } };
    }

    //  Insertar imagen diagrama 
    try {
        const svgStr = buildCisternaSVG(csD);
        const pngB64 = await svgToPngBase64(svgStr, IMG_W, IMG_H);
        const imgId  = workbook.addImage({ base64: pngB64, extension: 'png' });
        ws2.addImage(imgId, {
            tl:  { nativeCol: 1, nativeRow: csImgStart - 1 },
            ext: { width: IMG_W, height: IMG_H },
            editAs: 'oneCell',
        } as any);
    } catch (e) {
        console.warn('SVG cisterna error:', e);
    }

    // Panel derecho
    let pr = csImgStart;

    // Header Predimensionamiento
    ws2.getRow(pr).height = 24;
    ws2.mergeCells(pr, P, pr, 13);
    const pHdr = ws2.getCell(pr, P);
    pHdr.value = '📐  Predimensionamiento';
    pHdr.font  = { bold: true, size: 11, name: 'Arial', color: { argb: 'FF0A2A4A' } };
    pHdr.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_F4F8 } };
    pHdr.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    pHdr.border = { bottom: pBM };
    pr++;

    // Caja Volumen OK
    const okArgb   = csOk ? 'FFE8F5E8' : 'FFFEEAEA';
    const okTxtArg = csOk ? 'FF2A6A2A' : 'FFCC0000';
    const okBordA  = csOk ? 'FF4A8A4A' : 'FFCC4444';
    const okBord2  = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: okBordA } };

    ws2.getRow(pr).height = 20;
    ws2.mergeCells(pr, P, pr, 13);
    const okTit = ws2.getCell(pr, P);
    okTit.value = csOk ? '✓  Volumen OK' : '✗  Revisar volumen';
    okTit.font  = { bold: true, size: 11, name: 'Arial', color: { argb: okTxtArg } };
    okTit.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: okArgb } };
    okTit.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    okTit.border = { top: okBord2, left: okBord2, right: okBord2 };
    pr++;

    [
        { lbl: 'Requerido:', val: `${csVolCist.toFixed(2)} m³` },
        { lbl: 'Calculado:', val: `${csVolCalc.toFixed(2)} m³` },
        { lbl: 'Área base:', val: `${csArea.toFixed(2)} m²`    },
        { lbl: 'H. total:',  val: `${csAltTot.toFixed(2)} m`   },
    ].forEach((kv, ki) => {
        ws2.getRow(pr).height = 15;
        const lc = ws2.getCell(pr, P);
        lc.value = kv.lbl;
        lc.font  = { size: 9, name: 'Arial', color: { argb: 'FF555555' } };
        lc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: okArgb } };
        lc.alignment = { horizontal: 'left', vertical: 'middle', indent: 2 };
        lc.border = { left: okBord2, ...(ki === 3 ? { bottom: okBord2 } : {}) };
        ws2.mergeCells(pr, 12, pr, 13);
        const vc = ws2.getCell(pr, 12);
        vc.value = kv.val;
        vc.font  = { size: 9, bold: true, name: 'Courier New', color: { argb: 'FF333333' } };
        vc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: okArgb } };
        vc.alignment = { horizontal: 'right', vertical: 'middle' };
        vc.border = { right: okBord2, ...(ki === 3 ? { bottom: okBord2 } : {}) };
        pr++;
    });

    // gap
    ws2.getRow(pr).height = 6;
    for (let c = P; c <= 13; c++)
        ws2.getCell(pr, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: CS_F4F8 } };
    pr++;

    // NIVELES CALCULADOS
    pSectionLabel(pr, 'NIVELES CALCULADOS', CS_F4F8, 'FF2A5A8A'); pr++;
    [
        { lbl: 'Nivel Top slab:', val: csN1, red: false },
        { lbl: 'Nivel Techo:',    val: csN2, red: false },
        { lbl: 'Nivel Ingreso:',  val: csN3, red: false },
        { lbl: 'Nivel Rebose:',   val: csN4, red: true  },
        { lbl: 'Nivel Fondo:',    val: csN5, red: false },
    ].forEach(row => {
        const bg = row.red ? 'FFFFF0F0' : 'FFFFFFFF';
        pKVRow(pr, row.lbl,
            `${row.val >= 0 ? '+' : ''}${row.val.toFixed(2)} m`,
            { labelBg: bg, valBg: bg,
              valColor:   row.red ? 'FFCC0000' : 'FF1A4A7A',
              labelColor: row.red ? 'FFCC0000' : 'FF555555' });
        pr++;
    });

    // gap
    ws2.getRow(pr).height = 6;
    for (let c = P; c <= 13; c++)
        ws2.getCell(pr, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: CS_F4F8 } };
    pr++;

    // GEOMETRÍA PRINCIPAL
    pSectionLabel(pr, '★  GEOMETRÍA PRINCIPAL', CS_F4F8, 'FF1A4A7A'); pr++;
    pInputRow(pr, 'Largo (L)',        csLargo,    true);  pr++;
    pInputRow(pr, 'Ancho (A)',        csAncho,    true);  pr++;
    pInputRow(pr, 'Altura Útil (H)', csAltUtil,  true);  pr++;
    pInputRow(pr, 'Borde Libre (bl)', csBL,       false); pr++;

    // gap
    ws2.getRow(pr).height = 6;
    for (let c = P; c <= 13; c++)
        ws2.getCell(pr, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: CS_F4F8 } };
    pr++;

    // NIVEL Y TECHO
    pSectionLabel(pr, 'NIVEL Y TECHO', CS_F4F8, 'FF1A4A7A'); pr++;
    pInputRow(pr, 'Nivel agua (m)', csNivAgua,  false); pr++;
    pInputRow(pr, 'H. Techo (Ht)',  csAltTecho, false); pr++;

    // Rellenar filas restantes del panel con fondo
    while (pr < csImgStart + csImgRows) {
        ws2.getRow(pr).height = 16.5;
        for (let c = P; c <= 13; c++)
            ws2.getCell(pr, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: CS_F4F8 } };
        pr++;
    }

    cr = csImgStart + csImgRows;
    c2Sep(cr, 16); cr++;

    // RESUMEN FINAL 
    c2Wide(cr, 'Cisterna de Concreto de cuyas dimensiones serán:',
        { size: 12, h: 22 }); cr++;
    c2Sep(cr, 8); cr++;

    [
        { lbl: 'Largo (L) =',               v: csLargo   },
        { lbl: 'Ancho (A) =',               v: csAncho   },
        { lbl: 'Altura Útil de Agua (H) =', v: csAltUtil },
        { lbl: 'Borde Libre (bl) =',        v: csBL      },
        { lbl: 'Altura total (HT) =',       v: csAltTot  },
    ].forEach((row, idx) => {
        ws2.getRow(cr).height = 22;
        ws2.getCell(cr, 1).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: CS_BLANC } };
        ws2.mergeCells(cr, 2, cr, 4);
        const sl = ws2.getCell(cr, 2);
        sl.value = row.lbl;
        sl.font  = { size: 12, name: 'Times New Roman', color: { argb: CS_NEGRO } };
        sl.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        sl.alignment = { horizontal: 'right', vertical: 'middle' };
        const sv = ws2.getCell(cr, 5);
        sv.value = `${row.v.toFixed(2)} m`;
        sv.font  = { size: 13, bold: true, name: 'Courier New', color: { argb: CS_NEGRO } };
        sv.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        sv.alignment = { horizontal: 'left', vertical: 'middle' };
        ws2.mergeCells(cr, 6, cr, CS);
        const sn = ws2.getCell(cr, 6);
        sn.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        if (idx === 1) {
            sn.value = 'Diametro de rebose según el RNE es de 4"';
            sn.font  = { size: 11, name: 'Arial', color: { argb: 'FF444444' } };
            sn.alignment = { horizontal: 'left', vertical: 'middle', indent: 2 };
        }
        cr++;
    });
    c2Sep(cr, 16); cr++;
    //------------------------------------------------------------------------------------------------------------------------------------------------

// HOJA 3: TANQUE ELEVADO
{
    const ws3 = workbook.addWorksheet('3. Tanque Elevado');
    const TS = 13; 
    ws3.columns = [
        { width: 3  }, 
        { width: 14 }, 
        { width: 14 }, 
        { width: 14 }, 
        { width: 14 }, 
        { width: 14 }, 
        { width: 14 }, 
        { width: 14 }, 
        { width: 14 }, 
        { width: 3  }, 
        { width: 24 }, 
        { width: 14 }, 
        { width: 6  }, 
    ]; 
    function c2Fill(r: number, bg: string, h = 17) {
        ws3.getRow(r).height = h;
        for (let c = 1; c <= TS; c++) {
            ws3.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c === 1 ? CS_BLANC : bg } };
        }
    }

    function c2Sep(r: number, h = 8) {
        ws3.getRow(r).height = h;
        for (let c = 1; c <= TS; c++) {
            ws3.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        }
    }

    function c2Wide(r: number, text: string, opts: {
        bg?: string; h?: number; bold?: boolean; size?: number;
        color?: string; halign?: ExcelJS.Alignment['horizontal'];
        italic?: boolean; borderStyle?: 'all' | 'bottom';
    } = {}) {
        const bg = opts.bg ?? CS_BLANC;
        c2Fill(r, bg, opts.h ?? 18);
        ws3.mergeCells(r, 2, r, TS);
        const cell = ws3.getCell(r, 2);
        cell.value = text;
        cell.font  = { bold: opts.bold ?? false, size: opts.size ?? 10, name: 'Arial', italic: opts.italic ?? false, color: { argb: opts.color ?? CS_NEGRO } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.alignment = { horizontal: opts.halign ?? 'left', vertical: 'middle', indent: 1, wrapText: true };
        if (opts.borderStyle === 'all')
            cell.border = { top: c2BT, left: c2BM, bottom: c2BT, right: c2BM };
        else if (opts.borderStyle === 'bottom')
            cell.border = { bottom: c2BBL };
    }

    // Funciones para panel derecho
    const P = 11;
    const pBT = { style: 'thin' as ExcelJS.BorderStyle, color: { argb: 'FFCCCCCC' } };
    const pBM = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FF90B0CC' } };

    function pSectionLabel(r: number, text: string, bg: string, textColor: string) {
        ws3.getRow(r).height = 18;
        ws3.mergeCells(r, P, r, 13);
        const cell = ws3.getCell(r, P);
        cell.value = text;
        cell.font = { bold: true, size: 8, name: 'Arial', color: { argb: textColor } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        cell.border = { top: pBM, left: pBM, bottom: pBM, right: pBM };
    }

    function pInputRow(r: number, label: string, val: number, highlight: boolean, unit: string = 'm') {
        ws3.getRow(r).height = 20;
        const bg = highlight ? 'FFFFFBE6' : 'FFFFFFFF';
        const bc = highlight
            ? { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FFD4A020' } }
            : { style: 'thin' as ExcelJS.BorderStyle, color: { argb: 'FFD0D0D0' } };
        const lc = ws3.getCell(r, P);
        lc.value = label;
        lc.font = { size: 10, name: 'Arial', bold: highlight, color: { argb: 'FF222222' } };
        lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        lc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        lc.border = { top: bc, left: bc, bottom: bc };
        const vc = ws3.getCell(r, 12);
        vc.value = val;
        vc.numFmt = '0.00';
        vc.font = { size: 12, bold: true, name: 'Courier New', color: { argb: 'FF000000' } };
        vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        vc.alignment = { horizontal: 'right', vertical: 'middle' };
        vc.border = { top: bc, bottom: bc };
        const uc = ws3.getCell(r, 13);
        uc.value = unit;
        uc.font = { size: 9, name: 'Arial', color: { argb: 'FF666666' } };
        uc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        uc.alignment = { horizontal: 'left', vertical: 'middle' };
        uc.border = { top: bc, right: bc, bottom: bc };
    }

    // ---------- Datos del tanque (desde dataSheet) ----------
    const tqD = dataSheet.tanque || {};
    const tqConsumo = parseFloat(tqD.consumoDiario) || 0;
    const tqLargo = parseFloat(tqD.largo) || 4.40;
    const tqAncho = parseFloat(tqD.ancho) || 2.70;
    const tqAlturaAgua = parseFloat(tqD.alturaAgua ?? tqD.alturaUtil) || 1.15;
    const tqAlturaLimpieza = parseFloat(tqD.alturaLimpieza) || 0.10;
    const tqBordeLibre = parseFloat(tqD.bordeLibre) || 0.45;
    const tqAlturaTotal = parseFloat(tqD.alturaTotal) || 1.70;
    const tqHtecho = parseFloat(tqD.htecho) || 0.20;
    const tqHingreso = parseFloat(tqD.hingreso) || 0.15;
    const tqHrebose = parseFloat(tqD.hrebose) || 0.10;
    const tqAlturaLibre = parseFloat(tqD.alturalibre) || 0.10;
    const tqNivelFondo = parseFloat(tqD.nivelFondoTanque) || 14.70;
    const tqPorcentajeReserva = parseFloat(tqD.porcentajeReserva) || 25;

    // ---------- Cálculos (igual que en frontend) ----------
    const ceil1 = (v: number) => Math.ceil(v * 10) / 10;
    const volumenTE = ceil1(((1 / 3) * tqConsumo) / 1000);
    const hReservaFactor = 1 + tqPorcentajeReserva / 100;
    const volumenTotal = Math.round((volumenTE * hReservaFactor + Number.EPSILON) * 100) / 100;
    const area = tqLargo * tqAncho;
    const alturaAguaMin = volumenTotal / area;
    const volumenCalc = tqLargo * tqAncho * tqAlturaAgua;
    const ok = volumenCalc >= volumenTE;

    // Niveles calculados (para el diagrama)
    const fondo = tqNivelFondo;
    const interior_top = fondo + tqAlturaTotal;
    const roof_top = interior_top + tqHtecho;
    const ingreso = interior_top - tqHingreso;
    const rebose = ingreso - tqHrebose;
    const agua_bot = rebose - tqAlturaAgua;
    const salida = fondo + tqAlturaLibre;

    const sign = (v: number) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2));

    // ---------- Construcción de la hoja ----------
    let tr = 1;

    // Título principal: "3. TANQUE ELEVADO"
    c2Fill(tr, CS_BLANC, 36);
    ws3.mergeCells(tr, 2, tr, TS);
    const titulo3 = ws3.getCell(tr, 2);
    titulo3.value = '3. TANQUE ELEVADO';
    titulo3.font = { bold: true, size: 16, name: 'Times New Roman', color: { argb: CS_BLUE } };
    titulo3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
    titulo3.alignment = { horizontal: 'left', vertical: 'bottom' };
    titulo3.border = { bottom: c2BBL };
    tr++;
    c2Sep(tr, 14); tr++;

    // Sección 3.1.1: CÁLCULO DE VOLUMEN DEL TANQUE ELEVADO
    c2Fill(tr, CS_SEC, 26);
    ws3.mergeCells(tr, 2, tr, TS);
    const sec311 = ws3.getCell(tr, 2);
    sec311.value = '3.1.1. CÁLCULO DE VOLUMEN DEL TANQUE ELEVADO';
    sec311.font = { bold: true, size: 12, name: 'Arial', color: { argb: CS_NEGRO } };
    sec311.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_SEC } };
    sec311.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    sec311.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
    tr++;
    c2Sep(tr, 8); tr++;

    // Fórmula
    c2Fill(tr, CS_FAFAF4, 30);
    ws3.mergeCells(tr, 2, tr, TS);
    const formula = ws3.getCell(tr, 2);
    formula.value = 'VOL. DE TANQUE ELEVADO = 1/3 × CONSUMO DIARIO TOTAL';
    formula.font = { bold: true, size: 13, name: 'Arial', italic: true, color: { argb: CS_NEGRO } };
    formula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_FAFAF4 } };
    formula.alignment = { horizontal: 'center', vertical: 'middle' };
    formula.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
    tr++;
    c2Sep(tr, 8); tr++;

    // Tarjetas de resumen (4)
    ws3.getRow(tr).height = 58;
    for (let c = 1; c <= TS; c++) ws3.getCell(tr, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
    [
        { lbl: 'CONSUMO DIARIO', val: `${tqConsumo.toFixed(2)} Lt`, bg: 'FFF8FAFC', vc: 'FF1A4A7A' },
        { lbl: 'VOL. DE T.E.', val: `${volumenTE.toFixed(2)} m³`, bg: 'FFEAF0FA', vc: 'FF1A4A7A' },
        { lbl: 'VOL. TOTAL + RESERVA', val: `${volumenTotal.toFixed(2)} m³`, bg: 'FFEAF5EE', vc: 'FF2A6A4A' },
        { lbl: 'ALTURA DE AGUA MÍN.', val: `${alturaAguaMin.toFixed(2)} m`, bg: 'FFFAF0E8', vc: 'FF6A3A1A' },
    ].forEach((card, i) => {
        const cell = ws3.getCell(tr, i + 2);
        cell.value = {
            richText: [
                { text: card.lbl + '\n', font: { size: 8, color: { argb: 'FF666666' }, name: 'Arial' } },
                { text: card.val, font: { size: 14, bold: true, color: { argb: card.vc }, name: 'Arial' } },
            ]
        } as ExcelJS.CellRichTextValue;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: card.bg } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        const bc = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: card.vc } };
        cell.border = { top: bc, left: bc, bottom: bc, right: bc };
    });
    tr++;
    c2Sep(tr, 12); tr++;

    // Consumo Diario Total (solo lectura)
    c2Fill(tr, CS_BLANC, 22);
    ws3.mergeCells(tr, 2, tr, 4);
    const conLbl = ws3.getCell(tr, 2);
    conLbl.value = 'Consumo Diario Total (Lt/día):';
    conLbl.font = { size: 11, name: 'Arial', color: { argb: 'FF555555' } };
    conLbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
    conLbl.alignment = { horizontal: 'left', vertical: 'middle' };
    const conVal = ws3.getCell(tr, 5);
    conVal.value = tqConsumo;
    conVal.numFmt = '0';
    conVal.font = { size: 12, name: 'Courier New', color: { argb: CS_NEGRO } };
    conVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F2' } };
    conVal.alignment = { horizontal: 'center', vertical: 'middle' };
    conVal.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
    ws3.mergeCells(tr, 6, tr, TS);
    ws3.getCell(tr, 6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
    tr++;
    c2Sep(tr, 8); tr++; tr++;

    // Texto intro dimensiones
    c2Wide(tr, 'Tanque Elevado de cuyas dimensiones serán:', { size: 12, h: 22 }); tr++;
    c2Sep(tr, 8); tr++; tr++;

    // Inputs Largo, Ancho, Altura agua (con callout)
    const rDimStart = tr;
    [
        { lbl: 'Largo (L) =', v: tqLargo },
        { lbl: 'Ancho (A) =', v: tqAncho },
        { lbl: 'Altura agua (H) =', v: tqAlturaAgua },
    ].forEach(dim => {
        ws3.getRow(tr).height = 26;
        ws3.getCell(tr, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        const lc = ws3.getCell(tr, 2);
        lc.value = dim.lbl;
        lc.font = { size: 12, name: 'Times New Roman', color: { argb: CS_NEGRO } };
        lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        lc.alignment = { horizontal: 'right', vertical: 'middle' };
        const vc = ws3.getCell(tr, 3);
        vc.value = dim.v;
        vc.numFmt = '0.00 "m"';
        vc.font = { size: 14, bold: true, name: 'Courier New', color: { argb: CS_NEGRO } };
        vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        vc.alignment = { horizontal: 'right', vertical: 'middle' };
        vc.border = { top: c2BLU, left: c2BLU, bottom: c2BLU, right: c2BLU };
        ws3.getCell(tr, 4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        for (let c = 5; c <= TS; c++) ws3.getCell(tr, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_F0F4FA } };
        tr++;
    });
    ws3.mergeCells(rDimStart, 5, tr - 1, TS);
    const noteCell = ws3.getCell(rDimStart, 5);
    noteCell.value = 'Altura asumida como mínimo para mantenimiento y limpieza de tanque elevado';
    noteCell.font = { bold: true, size: 11, name: 'Arial', color: { argb: 'FF0A2A5A' } };
    noteCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_F0F4FA } };
    noteCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    noteCell.border = { top: c2BLU, left: c2BLU, bottom: c2BLU, right: c2BLU };
    c2Sep(tr, 8); tr++; tr++;

    // Caja de volumen calculado
    const volBg = ok ? CS_OK_BG : CS_WARN;
    c2Fill(tr, volBg, 32);
    ws3.mergeCells(tr, 2, tr, TS);
    const volBox = ws3.getCell(tr, 2);
    volBox.value = `VOLUMEN DE TANQUE ELEVADO = ${volumenCalc.toFixed(2)} m³` +
        (ok ? '' : `   ⚠ CORREGIR DIMENSIONES (mín. ${volumenTE.toFixed(2)} m³)`);
    volBox.font = { bold: true, size: 14, name: 'Arial', color: { argb: ok ? CS_NEGRO : 'FFCC0000' } };
    volBox.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: volBg } };
    volBox.alignment = { horizontal: 'center', vertical: 'middle' };
    volBox.border = { top: c2BM, left: c2BM, bottom: c2BM, right: c2BM };
    tr++;
    c2Sep(tr, 18); tr++;

    // Sección 3.1.2: DIMENSIONES DEL TANQUE ELEVADO
    c2Fill(tr, CS_SEC, 26);
    ws3.mergeCells(tr, 2, tr, TS);
    const sec312 = ws3.getCell(tr, 2);
    sec312.value = '3.1.2. DIMENSIONES DEL TANQUE ELEVADO';
    sec312.font = { bold: true, size: 12, name: 'Arial', color: { argb: CS_NEGRO } };
    sec312.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_SEC } };
    sec312.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    sec312.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
    tr++;
    c2Sep(tr, 6); tr++;

    // Tabla de descripciones (6 filas)
    [
        { k: 'ANCHO', d: 'Ancho del Tanque Elevado' },
        { k: 'LARGO', d: 'Largo del Tanque Elevado' },
        { k: 'ALTURA DE AGUA', d: 'Altura de agua del Tanque Elevado' },
        { k: 'ALTURA DE TUB. REBOSE', d: 'La distancia vertical entre los ejes del tubo de rebose y el máximo nivel de agua será igual al diámetro de aquel y nunca inferior a 0,10 m' },
        { k: 'ALTURA DE TUB. DE INGRESO', d: 'La distancia vertical entre los ejes de tubos de rebose y entrada de agua será igual al doble del diámetro del primero y en ningún caso menor de 0,15 m' },
        { k: 'ALTURA DE NIVEL DE TECHO', d: 'La distancia vertical entre el techo del depósito y el eje del tubo de entrada de agua, dependerá del diámetro de este, no pudiendo ser menor de 0,20 m' },
    ].forEach(row => {
        ws3.getRow(tr).height = 34;
        ws3.getCell(tr, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        const kc = ws3.getCell(tr, 2);
        kc.value = row.k;
        kc.font = { bold: true, size: 10, name: 'Arial', color: { argb: CS_NEGRO } };
        kc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_F4F8 } };
        kc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1, wrapText: true };
        kc.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
        ws3.mergeCells(tr, 3, tr, TS);
        const dc = ws3.getCell(tr, 3);
        dc.value = row.d;
        dc.font = { size: 10, name: 'Arial', color: { argb: CS_NEGRO } };
        dc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        dc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1, wrapText: true };
        dc.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
        tr++;
    });
    c2Sep(tr, 12); tr++; tr++;

    c2Wide(tr, 'Tanque elevado cuyas dimensiones serán:', { size: 12, h: 22 }); tr++;
    c2Sep(tr, 8); tr++;

    // --- ZONA HÍBRIDA (SVG + panel derecho) ---
    const IMG_W_TANQUE = 820, IMG_H_TANQUE = 520;
    const tqImgStart = tr;
    const tqImgRows = 34; 

    // Preparamos filas para la zona
    for (let i = 0; i < tqImgRows; i++) {
        const r = tr + i;
        ws3.getRow(r).height = 16.5;
        ws3.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        for (let c = 2; c <= 9; c++) ws3.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        ws3.getCell(r, 10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        for (let c = 11; c <= 13; c++) ws3.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_F4F8 } };
    }

    // Insertar imagen SVG
    try {
        // Función para generar el SVG
        function buildTanqueSVG(d: any): string {
            const dim = { 
                largo: parseFloat(d.largo) || 4.40,
                ancho: parseFloat(d.ancho) || 2.70,
                alturaAgua: parseFloat(d.alturaAgua ?? d.alturaUtil) || 1.15,
                alturaLimpieza: parseFloat(d.alturaLimpieza) || 0.10,
                bordeLibre: parseFloat(d.bordeLibre) || 0.45,
                alturaTotal: parseFloat(d.alturaTotal) || 1.70,
                htecho: parseFloat(d.htecho) || 0.20,
                hingreso: parseFloat(d.hingreso) || 0.15,
                hrebose: parseFloat(d.hrebose) || 0.10,
                alturalibre: parseFloat(d.alturalibre) || 0.10,
                nivelFondoTanque: parseFloat(d.nivelFondoTanque) || 14.70,
                porcentajeReserva: parseFloat(d.porcentajeReserva) || 25,
            };
            const parseNum = (v: any, fb = 0) => {
                if (v === '' || v === null || v === undefined) return fb;
                const n = Number(String(v).replace(',', '.'));
                return Number.isFinite(n) ? n : fb;
            };
            const fmt = (v: number, d = 2) => Number.isFinite(v) ? v.toFixed(d) : '0.00';
            const sign = (v: number) => (v >= 0 ? `+${fmt(v)}` : fmt(v));

            const fondo = parseNum(dim.nivelFondoTanque);
            const interior_top = fondo + parseNum(dim.alturaTotal);
            const roof_top = interior_top + parseNum(dim.htecho);
            const ingreso = interior_top - parseNum(dim.hingreso);
            const rebose = ingreso - parseNum(dim.hrebose);
            const agua_bot = rebose - parseNum(dim.alturaAgua);
            const salida = fondo + parseNum(dim.alturalibre);

            const VW = 820, VH = 520;
            const tL = 46, tW = 270;
            const yTop = 72, yBot = 440;
            const span = yBot - yTop;
            const wT = 18, rT = 14;

            const e2y = (e: number) => yTop + ((roof_top - e) / (roof_top - fondo)) * span;

            const yRoof = yTop;
            const yIntTop = e2y(interior_top);
            const yIng = e2y(ingreso);
            const yReb = e2y(rebose);
            const yAguaBot = e2y(agua_bot);
            const ySal = e2y(salida);
            const yFondo = yBot;

            const iL = tL + wT, iR = tL + tW - wT, iW = iR - iL;

            const aX = tL + tW + 30;
            const bW = 32;
            const lX = aX + bW + 12;
            const nBW = 130;
            const nBX = VW - nBW - 6;

            const bracket = (y1: number, y2: number, color: string, lbl: string, sub: string, val: string) => {
                if (!isFinite(y1) || !isFinite(y2) || Math.abs(y2 - y1) < 5) return '';
                const my = (y1 + y2) / 2;
                return `
                    <line x1="${aX}" y1="${y1}" x2="${aX}" y2="${y2}" stroke="${color}" stroke-width="2"/>
                    <line x1="${aX}" y1="${y1}" x2="${aX + bW}" y2="${y1}" stroke="${color}" stroke-width="2"/>
                    <line x1="${aX}" y1="${y2}" x2="${aX + bW}" y2="${y2}" stroke="${color}" stroke-width="2"/>
                    <text x="${lX}" y="${my - 7}" font-size="12" fill="#111" font-family="'Courier New',monospace">${lbl} ${sub}</text>
                    <text x="${lX}" y="${my + 9}" font-size="13" font-weight="bold" fill="#111" font-family="'Courier New',monospace">= ${val} m</text>
                `;
            };

            const nvBox = (y: number, label: string, red = false) => `
                <line x1="${iR + 2}" y1="${y}" x2="${nBX - 8}" y2="${y}"
                    stroke="${red ? '#c00' : '#999'}" stroke-width="${red ? 1.5 : 0.8}" stroke-dasharray="${red ? '0' : '5 3'}"/>
                <line x1="${nBX - 8}" y1="${y}" x2="${nBX}" y2="${y}" stroke="${red ? '#c00' : '#555'}" stroke-width="1.5"/>
                <rect x="${nBX}" y="${y - 11}" width="${nBW}" height="22" rx="2"
                    fill="${red ? '#fff0f0' : 'white'}" stroke="${red ? '#c00' : '#999'}" stroke-width="1.5"/>
                <text x="${nBX + nBW / 2}" y="${y + 1}" text-anchor="middle" dominant-baseline="middle"
                    font-size="11" fill="${red ? '#c00' : '#222'}" font-family="'Courier New',monospace" font-weight="${red ? 'bold' : 'normal'}">
                    Nivel = ${label} m
                </text>
            `;

            return `<svg viewBox="0 0 ${VW} ${VH}" width="${VW}" height="${VH}" xmlns="http://www.w3.org/2000/svg">
                <rect width="${VW}" height="${VH}" fill="white"/>
                <defs>
                    <pattern id="hatch" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
                        <line x1="0" y1="0" x2="0" y2="7" stroke="#999" stroke-width="1" opacity="0.5"/>
                    </pattern>
                </defs>
                <text x="${tL}" y="${yTop - 13}" font-size="13" fill="#111" font-family="'Courier New',monospace" font-weight="bold">
                    Nivel = ${sign(roof_top)} m
                </text>
                <rect x="${tL}" y="${yRoof}" width="${tW}" height="${yFondo - yRoof + rT}" fill="#c8c8c0" stroke="#666" stroke-width="2" rx="3"/>
                <rect x="${tL}" y="${yFondo}" width="${tW}" height="${rT}" fill="#b8b8b0" stroke="#666" stroke-width="2"/>
                <rect x="${tL}" y="${yRoof}" width="${wT}" height="${yFondo - yRoof}" fill="url(#hatch)"/>
                <rect x="${iR}" y="${yRoof}" width="${wT}" height="${yFondo - yRoof}" fill="url(#hatch)"/>
                <rect x="${tL}" y="${yRoof}" width="${tW}" height="${yIntTop - yRoof}" fill="url(#hatch)"/>
                <rect x="${tL}" y="${yFondo}" width="${tW}" height="${rT}" fill="url(#hatch)"/>
                <rect x="${iL}" y="${yIntTop}" width="${iW}" height="${yFondo - yIntTop}" fill="white"/>
                <rect x="${iL}" y="${yIntTop}" width="${iW}" height="${Math.max(yReb - yIntTop, 0)}" fill="#f0f0ea"/>
                <rect x="${iL}" y="${yReb}" width="${iW}" height="${Math.max(yAguaBot - yReb, 0)}" fill="#c5e5f8"/>
                ${(ySal - yAguaBot) > 0 ? `<rect x="${iL}" y="${yAguaBot}" width="${iW}" height="${Math.max(ySal - yAguaBot, 0)}" fill="#f0edcc" opacity="0.7"/>` : ''}
                <rect x="${iL}" y="${yIntTop}" width="${iW}" height="${yFondo - yIntTop}" fill="none" stroke="#888" stroke-width="1.5"/>
                ${(yReb - yIntTop) > 28 ? `<text x="${iL + iW / 2}" y="${(yIntTop + yReb) / 2}" font-size="20" font-family="'Courier New',monospace" font-weight="bold" fill="#bbb" text-anchor="middle" dominant-baseline="middle" transform="rotate(-20,${iL + iW / 2},${(yIntTop + yReb) / 2})" letter-spacing="3" opacity="0.7">BORDE LIBRE</text>` : ''}
                <line x1="${iL + 4}" y1="${yIng}" x2="${iR - 4}" y2="${yIng}" stroke="#cc7744" stroke-width="1.5" stroke-dasharray="8 5"/>
                <line x1="${iL + 4}" y1="${yReb}" x2="${iR - 4}" y2="${yReb}" stroke="#559944" stroke-width="1.5" stroke-dasharray="8 5"/>
                <line x1="${iL + 4}" y1="${yAguaBot}" x2="${iR - 4}" y2="${yAguaBot}" stroke="#4488bb" stroke-width="1.5" stroke-dasharray="8 5"/>
                <line x1="${iL + 4}" y1="${ySal}" x2="${iR - 4}" y2="${ySal}" stroke="#999999" stroke-width="1.5" stroke-dasharray="8 5"/>
                <rect x="${iR + 1}" y="${yIng - 12}" width="7" height="24" fill="#cc7744" stroke="#994422" stroke-width="1"/>
                <rect x="${iR - 8}" y="${yIng - 8}" width="20" height="16" fill="#cc7744" stroke="#994422" stroke-width="1.5" rx="2"/>
                <rect x="${iR + 1}" y="${yReb - 12}" width="7" height="24" fill="#559944" stroke="#337722" stroke-width="1"/>
                <rect x="${iR - 8}" y="${yReb - 8}" width="20" height="16" fill="#559944" stroke="#337722" stroke-width="1.5" rx="2"/>
                <rect x="${iR + 1}" y="${ySal - 10}" width="7" height="20" fill="#aab0b8" stroke="#7a8088" stroke-width="1"/>
                <rect x="${iR - 8}" y="${ySal - 7}" width="20" height="14" fill="#aab0b8" stroke="#7a8088" stroke-width="1.5" rx="2"/>
                ${bracket(yIntTop, yIng, '#994422', 'H. techo', '(Ht)', fmt(dim.htecho))}
                ${bracket(yIng, yReb, '#337722', 'H. ingreso', '(Hi)', fmt(dim.hingreso))}
                ${bracket(ySal, yFondo, '#7a8088', 'Altura Libre', '(HL)', fmt(dim.alturalibre))}
                ${(yAguaBot - yReb) > 20 ? `<text x="${lX}" y="${(yReb + yAguaBot) / 2}" dominant-baseline="middle" font-size="13" fill="#111" font-family="'Courier New',monospace">Altura de agua (Ha) = <tspan font-weight="bold">${fmt(dim.alturaAgua)} m</tspan></text>` : ''}
                ${nvBox(yIntTop, sign(interior_top))}
                ${nvBox(yIng, sign(ingreso))}
                ${nvBox(yReb, sign(rebose))}
                ${nvBox(ySal, sign(salida), true)}
                ${nvBox(yFondo, sign(fondo))}
                <line x1="${iL}" y1="${yFondo + 32}" x2="${iR}" y2="${yFondo + 32}" stroke="#333" stroke-width="1.5"/>
                <line x1="${iL}" y1="${yFondo + 26}" x2="${iL}" y2="${yFondo + 38}" stroke="#333" stroke-width="1.5"/>
                <line x1="${iR}" y1="${yFondo + 26}" x2="${iR}" y2="${yFondo + 38}" stroke="#333" stroke-width="1.5"/>
                <text x="${(iL + iR) / 2}" y="${yFondo + 50}" text-anchor="middle" font-size="12" fill="#333" font-family="'Courier New',monospace">L = ${fmt(dim.largo)} m</text>
                <line x1="${tL - 22}" y1="${yIntTop}" x2="${tL - 22}" y2="${yFondo}" stroke="#333" stroke-width="1.5"/>
                <line x1="${tL - 30}" y1="${yIntTop}" x2="${tL - 14}" y2="${yIntTop}" stroke="#333" stroke-width="1.5"/>
                <line x1="${tL - 30}" y1="${yFondo}" x2="${tL - 14}" y2="${yFondo}" stroke="#333" stroke-width="1.5"/>
                <text x="${tL - 38}" y="${(yIntTop + yFondo) / 2}" text-anchor="middle" transform="rotate(-90,${tL - 38},${(yIntTop + yFondo) / 2})" font-size="12" fill="#333" font-family="'Courier New',monospace">HT = ${fmt(dim.alturaTotal)} m</text>
            </svg>`;
        }

        const svgStr = buildTanqueSVG(tqD);
        const pngB64 = await svgToPngBase64(svgStr, IMG_W_TANQUE, IMG_H_TANQUE);
        const imgId = workbook.addImage({ base64: pngB64, extension: 'png' });
        ws3.addImage(imgId, {
            tl: { nativeCol: 1, nativeRow: tqImgStart - 1 },
            ext: { width: IMG_W_TANQUE, height: IMG_H_TANQUE },
            editAs: 'oneCell',
        } as any);
    } catch (e) {
        console.warn('SVG tanque error:', e);
    }

    // --- Panel derecho ---
    let pr = tqImgStart;

    pSectionLabel(pr, '📐  Predimensionamiento', CS_F4F8, 'FF0A2A4A'); pr++;

    const okArgb = ok ? 'FFE8F5E8' : 'FFFEEAEA';
    const okTxtArg = ok ? 'FF2A6A2A' : 'FFCC0000';
    const okBordA = ok ? 'FF4A8A4A' : 'FFCC4444';
    const okBord2 = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: okBordA } };

    ws3.getRow(pr).height = 20;
    ws3.mergeCells(pr, P, pr, 13);
    const okTit = ws3.getCell(pr, P);
    okTit.value = ok ? '✓  Volumen OK' : '✗  Revisar volumen';
    okTit.font = { bold: true, size: 11, name: 'Arial', color: { argb: okTxtArg } };
    okTit.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: okArgb } };
    okTit.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    okTit.border = { top: okBord2, left: okBord2, right: okBord2 };
    pr++;

    // Valores (requerido, reserva, calculado, área base)
    [
        { lbl: 'Requerido:', val: `${volumenTE.toFixed(2)} m³` },
        { lbl: `Reserva (${tqPorcentajeReserva}%):`, val: `${(volumenTotal - volumenTE).toFixed(2)} m³` },
        { lbl: 'Calculado:', val: `${volumenCalc.toFixed(2)} m³` },
        { lbl: 'Área base:', val: `${area.toFixed(2)} m²` },
    ].forEach((kv, ki) => {
        ws3.getRow(pr).height = 15;
        const lc = ws3.getCell(pr, P);
        lc.value = kv.lbl;
        lc.font = { size: 9, name: 'Arial', color: { argb: 'FF555555' } };
        lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: okArgb } };
        lc.alignment = { horizontal: 'left', vertical: 'middle', indent: 2 };
        lc.border = { left: okBord2, ...(ki === 3 ? { bottom: okBord2 } : {}) };
        ws3.mergeCells(pr, 12, pr, 13);
        const vc = ws3.getCell(pr, 12);
        vc.value = kv.val;
        vc.font = { size: 9, bold: true, name: 'Courier New', color: { argb: 'FF333333' } };
        vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: okArgb } };
        vc.alignment = { horizontal: 'right', vertical: 'middle' };
        vc.border = { right: okBord2, ...(ki === 3 ? { bottom: okBord2 } : {}) };
        pr++;
    });

    // gap
    ws3.getRow(pr).height = 6;
    for (let c = P; c <= 13; c++) ws3.getCell(pr, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_F4F8 } };
    pr++;

    // % Reserva (input como número)
    pInputRow(pr, '% Reserva', tqPorcentajeReserva, false, '%'); pr++;

    // Geometría principal
    pSectionLabel(pr, '★  GEOMETRÍA PRINCIPAL', CS_F4F8, 'FF1A4A7A'); pr++;
    pInputRow(pr, 'Largo (L)', tqLargo, true); pr++;
    pInputRow(pr, 'Ancho (A)', tqAncho, true); pr++;
    pInputRow(pr, 'Altura Agua (H)', tqAlturaAgua, true); pr++;
    pInputRow(pr, 'Alt. Limpieza', tqAlturaLimpieza, false); pr++;
    pInputRow(pr, 'Borde Libre (bl)', tqBordeLibre, false); pr++;
    pInputRow(pr, 'Altura Total (HT)', tqAlturaTotal, false); pr++;

    // gap
    ws3.getRow(pr).height = 6;
    for (let c = P; c <= 13; c++) ws3.getCell(pr, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_F4F8 } };
    pr++;

    // Niveles y tuberías
    pSectionLabel(pr, 'NIVEL Y TUBERÍAS', CS_F4F8, 'FF1A4A7A'); pr++;
    pInputRow(pr, 'Nivel Fondo (m)', tqNivelFondo, false); pr++;
    pInputRow(pr, 'H. Techo (Ht)', tqHtecho, false); pr++;
    pInputRow(pr, 'H. Ingreso (Hi)', tqHingreso, false); pr++;
    pInputRow(pr, 'H. Rebose (Hr)', tqHrebose, false); pr++;
    pInputRow(pr, 'Altura Libre (HL)', tqAlturaLibre, false); pr++;

    // Rellenar filas restantes del panel con fondo
    while (pr < tqImgStart + tqImgRows) {
        ws3.getRow(pr).height = 16.5;
        for (let c = P; c <= 13; c++) ws3.getCell(pr, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_F4F8 } };
        pr++;
    }

    tr = tqImgStart + tqImgRows;
    c2Sep(tr, 16); tr++;

    // --- RESUMEN FINAL ---
    c2Wide(tr, 'Tanque Elevado de Concreto de cuyas dimensiones serán:', { size: 12, h: 22 }); tr++;
    c2Sep(tr, 8); tr++;

    [
        { lbl: 'Largo (L) =', v: tqLargo },
        { lbl: 'Ancho (A) =', v: tqAncho },
        { lbl: 'Altura del Agua (H) =', v: tqAlturaAgua },
        { lbl: 'Altura de Limpieza (hl) =', v: tqAlturaLimpieza },
        { lbl: 'Borde Libre (bl) =', v: tqBordeLibre },
        { lbl: 'Altura total (HT) =', v: tqAlturaTotal },
    ].forEach((row, idx) => {
        ws3.getRow(tr).height = 22;
        ws3.getCell(tr, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        ws3.mergeCells(tr, 2, tr, 4);
        const sl = ws3.getCell(tr, 2);
        sl.value = row.lbl;
        sl.font = { size: 12, name: 'Times New Roman', color: { argb: CS_NEGRO } };
        sl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        sl.alignment = { horizontal: 'right', vertical: 'middle' };
        const sv = ws3.getCell(tr, 5);
        sv.value = `${row.v.toFixed(2)} m`;
        sv.font = { size: 13, bold: true, name: 'Courier New', color: { argb: CS_NEGRO } };
        sv.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        sv.alignment = { horizontal: 'left', vertical: 'middle' };
        ws3.mergeCells(tr, 6, tr, TS);
        const sn = ws3.getCell(tr, 6);
        sn.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        if (idx === 1) { // Colocar la nota en la fila de Ancho (segunda fila)
            sn.value = 'Diámetro de rebose según el RNE es de 4"';
            sn.font = { size: 11, name: 'Arial', color: { argb: 'FF444444' } };
            sn.alignment = { horizontal: 'left', vertical: 'middle', indent: 2 };
        }
        tr++;
    });
    c2Sep(tr, 16); tr++;
}
//----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

// HOJA 4: RED DE ALIMENTACIÓN 
{ const ws4 = workbook.addWorksheet('4. Red Alimentación');
    const TS = 13; 

    ws4.columns = [
        { width: 3 },  
        { width: 18 }, 
        { width: 16 }, 
        { width: 16 }, 
        { width: 16 },
        { width: 14 }, 
        { width: 14 }, 
        { width: 14 }, 
        { width: 14 }, 
        { width: 14 }, 
        { width: 14 }, 
        { width: 14 }, 
        { width: 3 },  
    ];

    // ---------- PALETA DE COLORES ----------
    const CS_BLANC = 'FFFFFFFF';
    const CS_SEC = 'FFE2E3E3';          // Gris para encabezados de sección
    const CS_F4F8 = 'EFF6FF';           // Azul muy suave (bg cards)
    const CS_BLUE = 'FF2563EB';         // Azul principal (texto)
    const CS_BLUE_DARK = 'FF1E40AF';    // Azul oscuro (bordes)
    const CS_NEGRO = 'FF1F2937';        // Texto principal
    const CS_AMARILLO = 'FFFFF9C4';     // Amarillo para inputs editables 
    const CS_BORD_AMARILLO = 'FFFCD34D';// Borde dorado
    const CS_RED_BG = 'FFFEE2E2';       // Rojo suave
    const CS_RED_TXT = 'FFDC2626';      // Rojo texto
    const CS_GREEN_BG = 'FFECFDF5';     // Verde suave
    const CS_GREEN_TXT = 'FF059669';    // Verde texto
    const CS_YELLOW_HEADER = 'FFFFC000';// Amarillo exacto para encabezados de tabla

    // ---------- ESTILOS DE BORDE ----------
    const c2BT = { style: 'thin' as ExcelJS.BorderStyle, color: { argb: 'FFD1D5DB' } };
    const c2BM = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: CS_BLUE_DARK } };
    const c2BBL = { style: 'thick' as ExcelJS.BorderStyle, color: { argb: 'FF000000' } };
    const c2BGold = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FFD97706' } };

    // ---------- FUNCIONES AUXILIARES ----------
    function c2Fill(r: number, bg: string, h: number = 20): void {
        const row = ws4.getRow(r);
        row.height = h;
        
        for (let c = 1; c <= TS; c++) {
            const cell = ws4.getCell(r, c);
            cell.fill = { 
                type: 'pattern', 
                pattern: 'solid', 
                fgColor: { argb: c === 1 ? CS_BLANC : bg } 
            };
            
            cell.border = { 
                top: { style: undefined }, 
                left: { style: undefined }, 
                bottom: { style: undefined }, 
                right: { style: undefined } 
            };
        }
    }

    function c2Sep(r: number, h: number = 6): void {
        const row = ws4.getRow(r);
        row.height = h;
        
        for (let c = 1; c <= TS; c++) {
            const cell = ws4.getCell(r, c);
            cell.fill = { 
                type: 'pattern', 
                pattern: 'solid', 
                fgColor: { argb: CS_BLANC } 
            };
            
            cell.border = { 
                top: { style: undefined }, 
                left: { style: undefined }, 
                bottom: { style: undefined }, 
                right: { style: undefined } 
            };
        }
    }

    function c2Wide(r: number, text: string, opts: {
        bg?: string; h?: number; bold?: boolean; size?: number;
        color?: string; halign?: ExcelJS.Alignment['horizontal'];
        borderStyle?: 'all' | 'bottom' | 'topBottom';
    } = {}) {
        const bg = opts.bg ?? CS_BLANC;
        c2Fill(r, bg, opts.h ?? 24);
        ws4.mergeCells(r, 2, r, TS - 1); 
        const cell = ws4.getCell(r, 2);
        cell.value = text;
        cell.font = { 
            bold: opts.bold ?? false, 
            size: opts.size ?? 12, 
            name: 'Arial', 
            color: { argb: opts.color ?? CS_NEGRO } 
        };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.alignment = { horizontal: opts.halign ?? 'left', vertical: 'middle', indent: 1 };
        
        if (opts.borderStyle === 'all') {
            cell.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
        } else if (opts.borderStyle === 'bottom') {
            cell.border = { bottom: c2BBL };
        } else if (opts.borderStyle === 'topBottom') {
            cell.border = { top: c2BT, bottom: c2BT };
        }
    }

    function setInputGroup(r: number, colLabel: number, label: string, colVal: number, val: any, fmt: string, isHighlight: boolean = false) {
        const lCell = ws4.getCell(r, colLabel);
        lCell.value = label;
        lCell.font = { size: 11, name: 'Arial', bold: true, color: {argb: CS_NEGRO} };
        lCell.alignment = { horizontal: 'right', vertical: 'middle' };
        lCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };

        const vCell = ws4.getCell(r, colVal);
        vCell.value = val;
        vCell.numFmt = fmt;
        vCell.font = { size: 11, name: 'Courier New', bold: true, color: {argb: 'FF000000'} };
        vCell.alignment = { horizontal: 'center', vertical: 'middle' };
        
        if (isHighlight) {
            vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_AMARILLO } };
            vCell.border = { top: c2BGold, left: c2BGold, bottom: c2BGold, right: c2BGold };
        } else {
            vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
            vCell.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
        }
    }

    // ---------- DATOS Y CONFIGURACIÓN ----------
    const config = {
        diametros: {
            '1/2 pulg': { mm: 15, area: 0.50, pulg: '1/2' },
            '3/4 pulg': { mm: 20, area: 0.74, pulg: '3/4' },
            '1 pulg': { mm: 25, area: 1, pulg: '1' },
            '1 1/4 pulg': { mm: 32, area: 1.25, pulg: '1 1/4' },
            '1 1/2 pulg': { mm: 40, area: 1.5, pulg: '1 1/2' },
            '2 pulg': { mm: 50, area: 2, pulg: '2' },
            '2 1/2 pulg': { mm: 50, area: 2.5, pulg: '2' },
            '3 pulg': { mm: 50, area: 3, pulg: '2' },
            '4 pulg': { mm: 50, area: 4, pulg: '2' },
            '6 pulg': { mm: 50, area: 6, pulg: '2' },
        },
        accesoriosDisponibles: [
            { label: 'Codo de 45°', key: 'codo45' },
            { label: 'Codo de 90°', key: 'codo90' },
            { label: 'Tee', key: 'tee' },
            { label: 'Válvula Compuerta', key: 'valCompuerta' },
            { label: 'Válvula Check', key: 'valCheck' },
            { label: 'Canastilla', key: 'canastilla' },
            { label: 'Reducción 1', key: 'reduccion1' },
            { label: 'Reducción 2', key: 'reduccion2' }
        ]
    };

    const datosReales: Record<number, [number, number][]> = {
        15: [[0.4, 0.1], [0.5, 0.15], [0.6, 0.2], [0.7, 0.27], [0.8, 0.35], [0.9, 0.44], [1, 0.5], [1.1, 0.58], [1.2, 0.7], [1.3, 0.82], [1.4, 0.95], [1.5, 1.1], [1.7, 1.4], [2, 2], [2.5, 3], [3, 4.5], [3.5, 6.2], [4, 8]],
        20: [[0.6, 0.1], [0.7, 0.12], [0.8, 0.15], [0.9, 0.19], [1, 0.25], [1.2, 0.35], [1.4, 0.42], [1.5, 0.5], [1.7, 0.65], [2, 0.8], [2.5, 1.25], [3, 1.8], [3.5, 2.4], [4, 3.2], [4.5, 4.1], [5, 5], [6, 7.2], [7, 9.8], [8, 12.5], [9, 15.8], [10, 19.5]],
        25: [[0.8, 0.1], [0.9, 0.12], [1, 0.15], [1.2, 0.22], [1.4, 0.26], [1.5, 0.3], [1.7, 0.38], [2, 0.5], [2.5, 0.78], [3, 1.1], [3.5, 1.5], [4, 2], [4.5, 2.55], [5, 3.1], [5.5, 3.75], [6, 4.5], [7, 6.2], [8, 8], [9, 10.2], [10, 12.5], [12, 18], [15, 28], [18, 40], [20, 50]],
        32: [[1, 0.1], [1.2, 0.14], [1.4, 0.17], [1.5, 0.2], [1.7, 0.25], [2, 0.3], [2.2, 0.38], [2.5, 0.48], [3, 0.65], [3.5, 0.85], [4, 1.15], [4.5, 1.45], [5, 1.8], [5.5, 2.2], [6, 2.6], [7, 3.6], [8, 4.6], [9, 5.8], [10, 7.2], [12, 10.5], [15, 16], [18, 22], [20, 28], [25, 44], [30, 63], [35, 86], [40, 112]],
        40: [[1.5, 0.08], [2, 0.1], [2.2, 0.12], [2.5, 0.15], [3, 0.2], [3.5, 0.27], [4, 0.35], [4.5, 0.44], [5, 0.55], [5.5, 0.67], [6, 0.8], [7, 1.1], [8, 1.4], [9, 1.75], [10, 2.2], [12, 3.2], [15, 5], [18, 7.2], [20, 8.9], [25, 14], [30, 20], [35, 27], [40, 35]],
        50: [[2, 0.06], [2.5, 0.08], [3, 0.1], [3.5, 0.12], [4, 0.15], [4.5, 0.19], [5, 0.25], [5.5, 0.29], [6, 0.35], [7, 0.48], [8, 0.6], [9, 0.75], [10, 0.95], [12, 1.35], [15, 2.1], [18, 3], [20, 3.8], [25, 6], [30, 8.5], [35, 11.5], [40, 15], [45, 19], [50, 23]]
    };

    const asignarColor = (d: number): string => {
        const colores: Record<number, string> = { 15: '#e74c3c', 20: '#F44336', 25: '#9C27B0', 32: '#FF9800', 40: '#2196F3', 50: '#4CAF50' };
        return colores[d] || '#333';
    };

    const interpolarLog = (x: number, pts: [number, number][]): number | null => {
        if (!pts || !pts.length || x <= 0) return null;
        if (x <= pts[0][0]) return pts[0][1];
        if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
        for (let i = 0; i < pts.length - 1; i++) {
            const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
            if (x >= x1 && x <= x2) {
                return Math.exp(Math.log(y1) + (Math.log(y2) - Math.log(y1)) * (Math.log(x) - Math.log(x1)) / (Math.log(x2) - Math.log(x1)));
            }
        }
        return null;
    };

    const generarCurva = (d: number): [number, number][] => {
        const pts = datosReales[d];
        const curva: [number, number][] = [];
        if (!pts) return curva;
        for (let i = 0; i <= 200; i++) {
            const x = 0.4 * Math.pow(50 / 0.4, i / 200);
            const y = interpolarLog(x, pts);
            if (y !== null) curva.push([x, y]);
        }
        return curva;
    };

    const dCurvas: Record<number, [number, number][]> = {};
    Object.keys(datosReales).forEach(d => {
        dCurvas[parseInt(d)] = generarCurva(parseInt(d));
    });

    // OBTENCIÓN DE DATOS DESDE dataSheet 
    const redD = dataSheet.redAlimentacion || {};
    const volCisterna = parseFloat(redD.volCisterna) || 2000;
    const volRequerido = parseFloat(redD.volRequerido) || 0;
    const consumoDiario = parseFloat(redD.consumoDiario) || 0;
    const tiempoLlenado = parseFloat(redD.tiempoLlenado) || 10;
    const nivelTerreno = parseFloat(redD.nivelTerreno) || 0;
    const presionConn = parseFloat(redD.presionConn) || 10.00;
    const presionSalida = parseFloat(redD.presionSalida) || 2.00;
    const nivIngCist = parseFloat(redD.nivIngCist) || 0;
    const diamConn = redD.diamConn || '1 pulg';
    const micro = redD.micro || 'SI';
    const lTuberia = parseFloat(redD.lTuberia) || 5.40;
    const hfMed = parseFloat(redD.hfMed) || 1.10;
    const accs = redD.accs || [
        { tipo: 'codo45', cantidad: 0, leq: 0.477 }, { tipo: 'codo90', cantidad: 3, leq: 1.023 },
        { tipo: 'tee', cantidad: 1, leq: 2.045 }, { tipo: 'valCompuerta', cantidad: 2, leq: 0.216 },
        { tipo: 'valCheck', cantidad: 0, leq: 2.114 }, { tipo: 'reduccion2', cantidad: 1, leq: 1.045 }
    ];
    const diaSel = redD.diaSel || '1 pulg';
    const diaLTub = parseFloat(redD.diaLTub) || 15.88;
    const diaAccs = redD.diaAccs || [
        { tipo: 'codo45', cantidad: 0, leq: 0.477 }, { tipo: 'codo90', cantidad: 7, leq: 1.023 },
        { tipo: 'tee', cantidad: 2, leq: 2.045 }, { tipo: 'valCompuerta', cantidad: 2, leq: 0.216 },
        { tipo: 'valCheck', cantidad: 0, leq: 2.114 }, { tipo: 'reduccion2', cantidad: 0, leq: 1.045 }
    ];

    // FUNCIONES DE CÁLCULO 
    const calcV = (q: number, diam: string): number => {
        const area = config.diametros[diam as keyof typeof config.diametros]?.area;
        if (!area || q <= 0) return 0;
        const diamM = area * 2.54 / 100;
        const seccion = Math.PI * Math.pow(diamM, 2) / 4;
        return parseFloat(((q / 1000) / seccion).toFixed(3));
    };

    const calcS = (q: number, diam: string): number => {
        const area = config.diametros[diam as keyof typeof config.diametros]?.area;
        if (!area || q <= 0) return 0;
        const diamM = area * 2.54 / 100;
        const base = (q / 1000) / 0.2785 / 140 / Math.pow(diamM, 2.63);
        return Math.pow(base, 1.85);
    };

    // --- CÁLCULOS PRINCIPALES ---
    const qLlenado = tiempoLlenado > 0 ? volCisterna / (tiempoLlenado * 3600) : 0;
    const qLlenadoM3h = parseFloat((qLlenado * 3.6).toFixed(2));
    const nivTubConn = parseFloat((nivelTerreno - 0.70).toFixed(2));
    const altEstatica = parseFloat((nivIngCist - nivTubConn).toFixed(2));
    const cargaDispTot = parseFloat((presionConn - presionSalida - altEstatica).toFixed(2));

    const vel = calcV(qLlenado, diamConn);
    const leqT = Math.round(accs.reduce((s: number, a: any) => s + a.cantidad * a.leq, 0) * 1000) / 1000;
    const lTot = parseFloat((leqT + lTuberia).toFixed(2));
    const sH = calcS(qLlenado, diamConn);
    const hf = parseFloat((lTot * sH).toFixed(2));
    const hfMedV = micro === 'SI' ? parseFloat(hfMed.toFixed(2)) : 0;
    const cDisp = parseFloat((cargaDispTot - hfMed - hf).toFixed(2));

    const dVel = calcV(qLlenado, diaSel);
    const dLeqT = Math.round(diaAccs.reduce((s: number, a: any) => s + a.cantidad * a.leq, 0) * 1000) / 1000;
    const dLTot = parseFloat((dLeqT + diaLTub).toFixed(2));
    const dS = calcS(qLlenado, diaSel);
    const dHf = parseFloat((dLTot * dS).toFixed(2));
    const dCDisp = parseFloat((cDisp - dHf).toFixed(2));

    // FUNCIÓN GENERADORA DE TABLAS DE ACCESORIOS 
    const renderTablaAccesorios = (
        title: string, 
        qVal: number, diamVal: string, vVal: number, 
        lPipe: number, lTotVal: number, sVal: number, hfVal: number, 
        items: any[], startRow: number
    ) => {
        let r = startRow;
        
        // Título Sección
        c2Wide(r, title, { bg: CS_SEC, bold: true, h: 24, borderStyle: 'all' });
        r++;
        c2Sep(r, 4); // espacio mínimo
        r++;

        // Inputs de configuración 
        if (title.includes('RED PÚBLICA')) {
            ws4.getRow(r).height = 22;
            setInputGroup(r, 2, 'Diámetro Conexión:', 3, diamVal, '@', false);
            setInputGroup(r, 4, 'Micromedidor:', 5, micro, '@', false);
            setInputGroup(r, 6, 'Longitud Tubería (m):', 7, lPipe, '0.00', true);
            setInputGroup(r, 8, 'Hf medidor (m):', 9, hfMed, '0.00', true);
            r++;
            c2Sep(r, 4); r++;
        } else {
            // Inputs Tramo 2
            ws4.getRow(r).height = 22;
            setInputGroup(r, 2, 'Longitud (m):', 3, lPipe, '0.00', true);
            setInputGroup(r, 4, 'Tuberías:', 5, diamVal, '@', false);
            r++;
            c2Sep(r, 4); r++;
        }

        // Encabezados Tabla 
        const headRow = r;
        ws4.getRow(headRow).height = 26;
        const headsMain = [
            { t: 'q (L/s)', c: 2, w: 1 }, { t: 'Diámetro', c: 3, w: 1 }, { t: 'V (m/s)', c: 4, w: 1 },
            { t: 'L accesorios', c: 5, w: 4 }, // Merge 5-8
            { t: 'L tubería', c: 9, w: 1 }, { t: 'L total', c: 10, w: 1 }, { t: 'S (m/m)', c: 11, w: 1 }, { t: 'hf (m)', c: 12, w: 1 }
        ];

        headsMain.forEach(h => {
            if (h.w > 1) ws4.mergeCells(headRow, h.c, headRow, h.c + h.w - 1);
            const cell = ws4.getCell(headRow, h.c);
            cell.value = h.t;
            cell.font = { bold: true, size: 10, color: { argb: 'FF000000' }, name: 'Arial' }; // texto negro
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_YELLOW_HEADER } }; // fondo amarillo exacto
            cell.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        });

        r++;
        // Sub-encabezados
        ws4.getRow(r).height = 20;
        const subs = ['Accesorio', '#', 'Leq', 'Leq.T'];
        subs.forEach((sub, idx) => {
            const cell = ws4.getCell(r, 5 + idx);
            cell.value = sub;
            cell.font = { bold: true, size: 9, name: 'Arial' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D5DB' } };
            cell.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        // Rellenar blancos
        [2,3,4,9,10,11,12].forEach(c => {
            const cell = ws4.getCell(r, c);
            cell.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_BLANC } };
        });

        r++;
        // Datos
        const dataStart = r;
        const count = items.length || 1;

        items.forEach((acc: any, idx: number) => {
            const currR = dataStart + idx;
            ws4.getRow(currR).height = 20;
            const label = config.accesoriosDisponibles.find(a => a.key === acc.tipo)?.label || acc.tipo;

            // Columnas Fijas 
            if (idx === 0) {
                const fixed = [
                    { c: 2, v: qVal, f: '0.000', b: true, col: CS_BLUE },
                    { c: 3, v: diamVal, b: true },
                    { c: 4, v: vVal, f: '0.00', b: true, col: CS_GREEN_TXT },
                    { c: 9, v: lPipe, f: '0.00', b: true },
                    { c: 10, v: lTotVal, f: '0.00', b: true, col: 'FF7C3AED' },
                    { c: 11, v: sVal, f: '0.000000', s: 9, col: 'FF6B7280' },
                    { c: 12, v: hfVal, f: '0.00', b: true, col: CS_RED_TXT }
                ];
                fixed.forEach(fc => {
                    const cell = ws4.getCell(currR, fc.c);
                    cell.value = fc.v; if(fc.f) cell.numFmt = fc.f;
                    cell.font = { bold: !!fc.b, size: fc.s || 11, color: { argb: fc.col || 'FF000000' } };
                    cell.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                });
            }

            // Columnas Accesorios
            const cAcc = ws4.getCell(currR, 5);
            cAcc.value = label; cAcc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
            ws4.getCell(currR, 6).value = acc.cantidad;
            const cLeq = ws4.getCell(currR, 7); cLeq.value = acc.leq; cLeq.numFmt = '0.000';
            const cLeqT = ws4.getCell(currR, 8); cLeqT.value = acc.cantidad * acc.leq; cLeqT.numFmt = '0.000'; cLeqT.font = {bold:true};

            // Estilos fila
            for(let c=2; c<=12; c++) {
                const cell = ws4.getCell(currR, c);
                if(!cell.border || !cell.border.top) cell.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
                if(!cell.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx%2===0 ? 'FFF9FAFB' : 'FFFFFFFF' } };
                if(c>=5 && c<=8) cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
        });

        // MERGES VERTICALES
        if (count > 1) {
            const endR = dataStart + count - 1;
            [2,3,4,9,10,11,12].forEach(c => {
                ws4.mergeCells(dataStart, c, endR, c);
                const mCell = ws4.getCell(dataStart, c);
                mCell.alignment = { ...mCell.alignment, vertical: 'middle' };
            });
        }

        // Fila Total
        const totR = dataStart + count;
        ws4.getRow(totR).height = 20;
        ws4.mergeCells(totR, 5, totR, 7);
        const cellTot = ws4.getCell(totR, 5);
        cellTot.value = 'L. EQ TOTAL:'; cellTot.font = {bold:true}; cellTot.alignment = {horizontal:'right'};
        const valTot = ws4.getCell(totR, 8);
        const totalVal = items.reduce((s:number, a:any) => s+(a.cantidad*a.leq),0);
        valTot.value = totalVal; valTot.numFmt='0.000'; valTot.font={bold:true, color:{argb:CS_BLUE}};
        for(let c=2; c<=12; c++) {
            const cell = ws4.getCell(totR, c);
            cell.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_F4F8 } };
            if(c<5 || c>8) cell.value = null;
        }
        
        return totR + 1;
    };

    // =========================================================================
    // CONSTRUCCIÓN DE LA HOJA
    // =========================================================================
    let tr = 1;

    // 1. TÍTULO PRINCIPAL
    c2Fill(tr, CS_BLANC, 32);
    ws4.mergeCells(tr, 2, tr, TS - 1);
    const titulo = ws4.getCell(tr, 2);
    titulo.value = '3. CALCULO DE LA RED DE ALIMENTACION';
    titulo.font = { bold: true, size: 16, name: 'Times New Roman', color: { argb: CS_BLUE } };
    titulo.alignment = { horizontal: 'left', vertical: 'bottom', indent: 1 };
    titulo.border = { bottom: c2BBL };
    tr++;
    c2Sep(tr, 8); tr++; 
    tr++;


    // =========================================================================
    // 3.1 CAUDAL DE ENTRADA
    // =========================================================================
    c2Wide(tr, '3.1. CAUDAL DE ENTRADA', { bg: CS_SEC, bold: true, h: 24, borderStyle: 'all' });
    tr++;
    c2Sep(tr, 4); tr++;
    tr++;

    // Grid de 4 columnas
    const rowIn1 = tr;
    ws4.getRow(rowIn1).height = 24;
    setInputGroup(rowIn1, 2, 'Consumo Diario:', 3, consumoDiario, '0.00', false);
    setInputGroup(rowIn1, 4, 'Vol. Cisterna (Real):', 5, volCisterna, '0.00', true);
    setInputGroup(rowIn1, 6, 'Tiempo de Llenado:', 7, tiempoLlenado, '0.0', true);
    setInputGroup(rowIn1, 8, 'Q llenado:', 9, qLlenado, '0.000', false);
    ws4.getCell(rowIn1, 10).value = 'L/s';
    ws4.getCell(rowIn1, 10).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    tr++;
    c2Sep(tr, 6); tr++;
    tr++;

    // =========================================================================
    // 3.2 CARGA DISPONIBLE
    // =========================================================================
    c2Wide(tr, '3.2. CARGA DISPONIBLE', { bg: CS_SEC, bold: true, h: 24, borderStyle: 'all' });
    tr++;
    c2Sep(tr, 4); tr++;
    tr++;

    // Subtítulo Factibilidad
    c2Wide(tr, 'Datos de la FACTIBILIDAD DE SERVICIO', { bg: CS_F4F8, bold: true, h: 22, halign: 'center' });
    tr++;
    c2Sep(tr, 4); tr++;
    tr++;

    // Grid 3 columnas de datos
    const factData = [
        { l: 'Nivel del terreno cnx.', v: nivelTerreno, h: true },
        { l: 'Nivel de la tubería de cnx.', v: nivTubConn, h: false },
        { l: 'Nivel de tubería ingreso a cist.', v: nivIngCist, h: false },
        { l: 'Presión en CONEXIÓN PÚBLICA', v: presionConn, h: true },
        { l: 'Presión de salida en tub.', v: presionSalida, h: true },
        { l: 'Altura estática est.', v: altEstatica, h: false }
    ];

    for (let i = 0; i < factData.length; i += 3) {
        const r = tr + (i/3);
        ws4.getRow(r).height = 22;
        for (let j = 0; j < 3; j++) {
            const item = factData[i+j];
            if (!item) break;
            const cL = 2 + (j*3);
            const cV = cL + 1;
            const cU = cV + 1;
            
            ws4.getCell(r, cL).value = item.l;
            ws4.getCell(r, cL).font = { size: 11, name: 'Arial' };
            ws4.getCell(r, cL).alignment = { horizontal: 'right', vertical: 'middle' };
            
            ws4.getCell(r, cV).value = item.v;
            ws4.getCell(r, cV).numFmt = '0.00';
            ws4.getCell(r, cV).font = { size: 11, name: 'Courier New', bold: true };
            ws4.getCell(r, cV).alignment = { horizontal: 'center', vertical: 'middle' };
            
            if (item.h) {
                ws4.getCell(r, cV).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CS_AMARILLO } };
                ws4.getCell(r, cV).border = { top: c2BGold, left: c2BGold, bottom: c2BGold, right: c2BGold };
            } else {
                ws4.getCell(r, cV).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
                ws4.getCell(r, cV).border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
            }
            
            ws4.getCell(r, cU).value = 'm';
            ws4.getCell(r, cU).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        }
    }
    tr += 2;
    c2Sep(tr, 4); tr++;
    tr++;
    tr++;

    // Caja Resultado Hd1
    c2Fill(tr, CS_F4F8, 28);
    ws4.mergeCells(tr, 2, tr, TS - 1);
    const boxHd1 = ws4.getCell(tr, 2);
    boxHd1.value = `Carga Disponible (Hd 1) = ${cargaDispTot} m`;
    boxHd1.font = { bold: true, size: 14, color: { argb: CS_BLUE } };
    boxHd1.alignment = { horizontal: 'center', vertical: 'middle' };
    boxHd1.border = { top: c2BM, left: c2BM, bottom: c2BM, right: c2BM };
    tr++;
    c2Sep(tr, 8); tr++;
    tr++;

    // =========================================================================
    // 3.3 PÉRDIDA DE CARGA: TRAMO RED PÚBLICA - MEDIDOR
    // =========================================================================
    tr = renderTablaAccesorios(
        '3.3. PÉRDIDA DE CARGA: TRAMO RED PÚBLICA - MEDIDOR',
        qLlenado, diamConn, vel, lTuberia, lTot, sH, hf, accs, tr
    );
    c2Sep(tr, 4); tr++;
    tr++;

    // GRÁFICO SVG (
    const grafStart = tr;
    const grafRows = 18; // altura en filas
    c2Fill(grafStart, CS_BLANC, grafRows * 16);
    ws4.mergeCells(grafStart, 2, grafStart + grafRows - 1, TS - 1); // área del gráfico

    try {
        const width = 720, height = 380;
        const margin = { top: 25, right: 25, bottom: 40, left: 55 };
        const iw = width - margin.left - margin.right;
        const ih = height - margin.top - margin.bottom;
        const xMin = 0.4, xMax = 50, yMin = 0.05, yMax = 12;
        const xS = (x: number) => margin.left + Math.log(x/xMin)/Math.log(xMax/xMin)*iw;
        const yS = (y: number) => margin.top + ih - Math.log(y/yMin)/Math.log(yMax/yMin)*ih;

        let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="font-family:Arial;">
        <rect width="100%" height="100%" fill="white"/>
        <text x="${width/2}" y="18" font-size="14" font-weight="bold" text-anchor="middle">Curva de Pérdida de Presión</text>
        <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top+ih}" stroke="#333" stroke-width="2"/>
        <line x1="${margin.left}" y1="${margin.top+ih}" x2="${margin.left+iw}" y2="${margin.top+ih}" stroke="#333" stroke-width="2"/>
        <text x="${margin.left+iw/2}" y="${margin.top+ih+30}" font-size="11" text-anchor="middle">Caudal - m³/h</text>
        <text x="${margin.left-35}" y="${margin.top+ih/2}" font-size="11" text-anchor="middle" transform="rotate(-90 ${margin.left-35} ${margin.top+ih/2})">Pérdida de Presión (m.c.a.)</text>`;

        Object.entries(dCurvas).forEach(([dStr, pts]) => {
            const d = parseInt(dStr);
            const color = asignarColor(d);
            const path = pts.map(p => `${xS(p[0])},${yS(p[1])}`).join(' ');
            svg += `<polyline points="${path}" stroke="${color}" stroke-width="2" fill="none"/>`;
            const last = pts[pts.length-1];
            svg += `<text x="${xS(last[0])+5}" y="${yS(last[1])}" font-size="9" fill="${color}" font-weight="bold">Ø ${d}</text>`;
        });

        const dMm = config.diametros[diamConn as keyof typeof config.diametros]?.mm || 25;
        const perd = interpolarLog(qLlenadoM3h, datosReales[dMm]);
        if(perd && qLlenadoM3h > 0) {
            const xp = xS(qLlenadoM3h), yp = yS(perd);
            svg += `<circle cx="${xp}" cy="${yp}" r="5" fill="#9C27B0" stroke="white" stroke-width="2"/>
            <line x1="${margin.left}" y1="${yp}" x2="${xp}" y2="${yp}" stroke="#9C27B0" stroke-dasharray="4,3"/>
            <line x1="${xp}" y1="${margin.top+ih}" x2="${xp}" y2="${yp}" stroke="#9C27B0" stroke-dasharray="4,3"/>`;
        }
        svg += `</svg>`;

        const pngB64 = await svgToPngBase64(svg, width, height);
        const imgId = workbook.addImage({ base64: pngB64, extension: 'png' });
        ws4.addImage(imgId, {
            tl: { nativeCol: 1, nativeRow: grafStart - 1 },
            ext: { width: width, height: height }
        } as any);
    } catch(e) {
        console.warn("Error gráfico", e);
        ws4.getCell(grafStart, 2).value = "[Gráfico de Curva No Generado]";
    }

    tr += grafRows;
    c2Sep(tr, 4); tr++;

    // Tarjetas Resultados Tramo 1
    const rowCards1 = tr;
    ws4.getRow(rowCards1).height = 28;
    const cards1 = [
        { t: `Carga Disponible: ${cargaDispTot} m`, c: CS_BLUE, bg: 'FFE0F2FE' },
        { t: `Pérdida Medidor: ${hfMedV} m`, c: CS_RED_TXT, bg: 'FFFEE2E2' },
        { t: `Pérdida Red: ${hf} m`, c: CS_GREEN_TXT, bg: CS_GREEN_BG }
    ];
    cards1.forEach((card, i) => {
        const cStart = 2 + (i*3);
        ws4.mergeCells(rowCards1, cStart, rowCards1, cStart+2);
        const cell = ws4.getCell(rowCards1, cStart);
        cell.value = card.t;
        cell.font = { bold: true, size: 11, color: {argb: card.c} };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: {argb: card.bg} };
        cell.border = { top: c2BM, left: c2BM, bottom: c2BM, right: c2BM };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    tr++;
    tr++;
    
    // Fila extra Hd2
    ws4.getRow(tr).height = 22;
    ws4.mergeCells(tr, 2, tr, 6);
    const cellHd2 = ws4.getCell(tr, 2);
    cellHd2.value = `Diámetro: ${diamConn}  |  Carga Disponible (Hd 2): ${cDisp} m`;
    cellHd2.font = { bold: true, color: {argb: CS_BLUE} };
    cellHd2.fill = { type: 'pattern', pattern: 'solid', fgColor: {argb: CS_F4F8} };
    cellHd2.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
    cellHd2.alignment = { horizontal: 'left', indent: 1 };
    tr++;
    c2Sep(tr, 8); tr++;
    tr++;

    // =========================================================================
    // 3.4 PÉRDIDA DE CARGA: MEDIDOR - CISTERNA
    // =========================================================================
    tr = renderTablaAccesorios(
        '3.4. PÉRDIDA DE CARGA: MEDIDOR - CISTERNA',
        qLlenado, diaSel, dVel, diaLTub, dLTot, dS, dHf, diaAccs, tr
    );
    c2Sep(tr, 4); tr++;
    tr++;
    tr++;


    // Tarjetas Resultados Tramo 2
    const rowCards2 = tr;
    ws4.getRow(rowCards2).height = 28;
    const cards2 = [
        { t: `Hd 2: ${cDisp} m`, c: CS_BLUE, bg: 'FFE0F2FE' },
        { t: `Pérdida: ${dHf} m`, c: CS_RED_TXT, bg: 'FFFEE2E2' },
        { t: `Hd 3: ${dCDisp} m`, c: CS_GREEN_TXT, bg: CS_GREEN_BG }
    ];
    cards2.forEach((card, i) => {
        const cStart = 2 + (i*3);
        ws4.mergeCells(rowCards2, cStart, rowCards2, cStart+2);
        const cell = ws4.getCell(rowCards2, cStart);
        cell.value = card.t;
        cell.font = { bold: true, size: 11, color: {argb: card.c} };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: {argb: card.bg} };
        cell.border = { top: c2BM, left: c2BM, bottom: c2BM, right: c2BM };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    tr++;
    tr++;
    c2Sep(tr, 8); tr++;
    tr++;

    // =========================================================================
    // 3.5 RESULTADOS FINALES
    // =========================================================================
    c2Wide(tr, '3.5. RESULTADOS', { bg: CS_SEC, bold: true, h: 24, borderStyle: 'all' });
    tr++;
    c2Sep(tr, 4); tr++;
    tr++;

    const rowFin = tr;
    ws4.getRow(rowFin).height = 28;
    const fins = [
        { t: `Q llenado: ${qLlenado} L/s` },
        { t: `Ø Red-Med: ${diamConn}` },
        { t: `Ø Med-Cist: ${diaSel}` }
    ];
    fins.forEach((f, i) => {
        const cStart = 2 + (i*3);
        ws4.mergeCells(rowFin, cStart, rowFin, cStart+2);
        const cell = ws4.getCell(rowFin, cStart);
        cell.value = f.t;
        cell.font = { bold: true, size: 12 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: {argb: CS_F4F8} };
        cell.border = { top: c2BT, left: c2BT, bottom: c2BT, right: c2BT };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    tr++;
    c2Sep(tr, 12); tr++; 
}
//-------------------------------------------------------------------------------------------------------------------------------------------------------------------------


    // =========================================================================
    // HOJA 5: MÁXIMA DEMANDA SIMULTÁNEA
    // =========================================================================
    const ws5 = workbook.addWorksheet('5. Max. Demanda');
    ws5.columns = [
        { width: 5 },
        { width: 30 }, // Aparato
        { width: 10 }, // Cantidad
        { width: 10 }, // UH
        { width: 15 }, // Gasto (lps)
        { width: 15 }, // Total (lps)
    ];
    paintTitle(ws5, 6, 'MEMORIA DE CÁLCULO: MÁXIMA DEMANDA SIMULTÁNEA', COLORS.BLUE);
    paintHeaders(ws5, ['Ítem', 'Aparato', 'Cantidad', 'U.H.', 'Gasto unit. (lps)', 'Gasto total (lps)'], 3, COLORS.LIGHT_BLUE);
    // Fin Hoja 5

    // =========================================================================
    // HOJA 6: BOMBEO TANQUE ELEVADO
    // =========================================================================
    const ws6 = workbook.addWorksheet('6. Bombeo');
    ws6.columns = [
        { width: 5 },
        { width: 35 }, // Descripción
        { width: 20 }, // Valor
        { width: 15 }, // Unidad
    ];
    paintTitle(ws6, 4, 'MEMORIA DE CÁLCULO: EQUIPO DE BOMBEO', COLORS.BLUE);
    paintHeaders(ws6, ['Ítem', 'Parámetro', 'Valor', 'Unidad'], 3, COLORS.LIGHT_BLUE);
    // Fin Hoja 6

    // =========================================================================
    // HOJA 7: TUBERÍAS DE RED DE DISTRIBUCIÓN (RD)
    // =========================================================================
    const ws7 = workbook.addWorksheet('7. Tuberías RD');
    ws7.columns = [
        { width: 5 },
        { width: 20 }, // Tramo
        { width: 15 }, // Longitud
        { width: 15 }, // Diámetro
        { width: 15 }, // Caudal
        { width: 15 }, // Velocidad
        { width: 15 }, // Pérdida
    ];
    paintTitle(ws7, 7, 'MEMORIA DE CÁLCULO: TUBERÍAS DE RED DE DISTRIBUCIÓN', COLORS.BLUE);
    paintHeaders(ws7, ['Ítem', 'Tramo', 'Longitud (m)', 'Diámetro (mm)', 'Caudal (lps)', 'Velocidad (m/s)', 'Pérdida (m)'], 3, COLORS.LIGHT_BLUE);
    // Fin Hoja 7

    // =========================================================================
    // HOJA 8: REDES INTERIORES
    // =========================================================================
    const ws8 = workbook.addWorksheet('8. Redes Interiores');
    ws8.columns = [
        { width: 5 },
        { width: 20 }, // Sector
        { width: 15 }, // Tramo
        { width: 15 }, // Diámetro
        { width: 15 }, // Caudal
        { width: 15 }, // Velocidad
    ];
    paintTitle(ws8, 6, 'MEMORIA DE CÁLCULO: REDES INTERIORES', COLORS.BLUE);
    paintHeaders(ws8, ['Ítem', 'Sector', 'Tramo', 'Diámetro (mm)', 'Caudal (lps)', 'Velocidad (m/s)'], 3, COLORS.LIGHT_BLUE);
    // Fin Hoja 8

    // =========================================================================
    // HOJA 9: RED DE RIESGO (CONTRA INCENDIO)
    // =========================================================================
    const ws9 = workbook.addWorksheet('9. Red de Riesgo');
    ws9.columns = [
        { width: 5 },
        { width: 30 }, // Elemento
        { width: 15 }, // Caudal
        { width: 15 }, // Presión
        { width: 20 }, // Diámetro
    ];
    paintTitle(ws9, 5, 'MEMORIA DE CÁLCULO: RED DE RIESGO', COLORS.BLUE);
    paintHeaders(ws9, ['Ítem', 'Elemento', 'Caudal (lps)', 'Presión (mca)', 'Diámetro (mm)'], 3, COLORS.LIGHT_BLUE);
    // Fin Hoja 9

    // =========================================================================
    // GENERAR ARCHIVO
    // =========================================================================
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
}