import ExcelJS from 'exceljs';
import { addProjectHeaderAndFooter } from './excel-export-utils';

interface AguaData {
    tables: {};
    demandaDiaria?: any;
    cisterna?: any;
    tanque?: any;
    redAlimentacion?: any;
    maximademandasimultanea?: any;
    bombeoTanqueElevado?: any;
    tuberiasRD?: any;
    redesInteriores?: any;
    redderiego?: any;
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
export async function exportAguaToExcel(dataSheet: AguaData, fileName: string = 'Calculo_Agua', proyecto?: any) {
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
    const ws4 = workbook.addWorksheet('4. Red Alimentación');

    const RA = 13; 
    ws4.columns = [
        { width: 3  }, 
        { width: 30 }, 
        { width: 12 },
        { width: 8  },
        { width: 12 },
        { width: 10 }, 
        { width: 10 }, 
        { width: 13 }, 
        { width: 10 }, 
        { width: 12 }, 
        { width: 14 }, 
        { width: 8  }, 
        { width: 5  }, 
    ];

    const RA_BLANC  = 'FFFFFFFF';
    const RA_NEGRO  = 'FF000000';
    const RA_TITLE  = 'FF4F4F4F'; 
    const RA_HEADER = 'FF6D6D6D'; 
    const RA_YELLOW = 'FFFFC000'; 
    const RA_LYELL  = 'FFFFF2CC'; 
    const RA_LGRAY  = 'FFD9D9D9'; 
    const RA_BLUE   = 'FF1F4E78'; 
    const RA_BLUE2  = 'FF2E75B6';
    const RA_LBLUE  = 'FFD6E4F0';
    const RA_GREEN  = 'FFF0F7EE'; 

    const raBT = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFA0A0A0' } };
    const raBM = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FF666666' } };

    function raFill(r: number, bg: string, h = 17) {
        ws4.getRow(r).height = h;
        ws4.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RA_BLANC } };
        for (let c = 2; c <= RA; c++)
            ws4.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
    }

    function raCell(r: number, c: number, val: any, opts: {
        bold?: boolean; size?: number; bg?: string; color?: string;
        halign?: ExcelJS.Alignment['horizontal']; numFmt?: string;
        border?: boolean; wrap?: boolean; italic?: boolean;
    } = {}) {
        const cell = ws4.getCell(r, c);
        cell.value = val ?? null;
        cell.font  = { bold: opts.bold ?? false, size: opts.size ?? 9,
                       name: 'Arial', italic: opts.italic ?? false,
                       color: { argb: opts.color ?? RA_NEGRO } };
        if (opts.bg) cell.fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: opts.bg } };
        cell.alignment = { horizontal: opts.halign ?? 'left', vertical: 'middle',
                           wrapText: opts.wrap ?? false };
        if (opts.border)
            cell.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
        if (opts.numFmt) cell.numFmt = opts.numFmt;
    }

    function raSep(r: number, h = 6) {
        ws4.getRow(r).height = h;
        for (let c = 1; c <= RA; c++)
            ws4.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: RA_BLANC } };
    }

    // Barra título principal 
    function raTitleBar(r: number, text: string) {
        raFill(r, RA_TITLE, 26);
        ws4.mergeCells(r, 2, r, RA);
        const cell = ws4.getCell(r, 2);
        cell.value = text;
        cell.font  = { bold: true, size: 11, name: 'Arial',
                       color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RA_TITLE } };
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        cell.border = { top: raBM, left: raBM, bottom: raBM, right: raBM };
    }

    // Barra sub-sección 
    function raSubBar(r: number, text: string) {
        raFill(r, RA_HEADER, 24);
        ws4.mergeCells(r, 2, r, RA);
        const cell = ws4.getCell(r, 2);
        cell.value = text;
        cell.font  = { bold: true, size: 10, name: 'Arial',
                       color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RA_HEADER } };
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        cell.border = { top: raBT, left: raBM, bottom: raBT, right: raBM };
    }

    function raLV(r: number, label: string, val: any, unit: string, opts: {
        valBg?: string; labelBg?: string; bold?: boolean;
        numFmt?: string; h?: number;
    } = {}) {
        ws4.getRow(r).height = opts.h ?? 20;
        ws4.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RA_BLANC } };
        const lb = opts.labelBg ?? RA_BLANC;
        const vb = opts.valBg   ?? RA_YELLOW;
        
        const lc = ws4.getCell(r, 2);
        lc.value = label;
        lc.font  = { size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
        lc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: lb } };
        lc.alignment = { horizontal: 'right', vertical: 'middle' };
        lc.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
        // valor
        const vc = ws4.getCell(r, 3);
        vc.value = val;
        vc.font  = { bold: opts.bold ?? true, size: 9, name: 'Arial',
                     color: { argb: RA_NEGRO } };
        vc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: vb } };
        vc.alignment = { horizontal: 'center', vertical: 'middle' };
        vc.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
        if (opts.numFmt) vc.numFmt = opts.numFmt;
        // unidad
        const uc = ws4.getCell(r, 4);
        uc.value = unit;
        uc.font  = { size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
        uc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: lb } };
        uc.alignment = { horizontal: 'left', vertical: 'middle' };
        uc.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
        
        for (let c = 5; c <= RA; c++) {
            ws4.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: RA_BLANC } };
        }
    }

    // Fila dos pares label-valor lado a lado
    function raLV2(r: number,
        l1: string, v1: any, u1: string,
        l2: string, v2: any, u2: string,
        opts: { vb1?: string; vb2?: string; h?: number; nf1?: string; nf2?: string } = {}
    ) {
        ws4.getRow(r).height = opts.h ?? 20;
        ws4.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RA_BLANC } };
        
        const cells1 = [
            { c: 2, val: l1,  bg: RA_BLANC, halign: 'right' as const, bold: false },
            { c: 3, val: v1,  bg: opts.vb1 ?? RA_YELLOW, halign: 'center' as const, bold: true },
            { c: 4, val: u1,  bg: RA_BLANC, halign: 'left' as const, bold: false },
        ];
        cells1.forEach(({ c, val, bg, halign, bold }) => {
            const cell = ws4.getCell(r, c);
            cell.value = val;
            cell.font  = { bold, size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
            cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            cell.alignment = { horizontal: halign, vertical: 'middle' };
            cell.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
            if (c === 3 && opts.nf1) cell.numFmt = opts.nf1;
        });
       
        ws4.getCell(r, 5).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RA_BLANC } };
        
        if (l2) {
            const cells2 = [
                { c: 6,  val: l2,  bg: RA_BLANC, halign: 'right' as const, bold: false },
                { c: 7,  val: v2,  bg: opts.vb2 ?? RA_YELLOW, halign: 'center' as const, bold: true },
                { c: 8,  val: u2,  bg: RA_BLANC, halign: 'left' as const, bold: false },
            ];
            cells2.forEach(({ c, val, bg, halign, bold }) => {
                const cell = ws4.getCell(r, c);
                cell.value = val;
                cell.font  = { bold, size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
                cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
                cell.alignment = { horizontal: halign, vertical: 'middle' };
                cell.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
                if (c === 7 && opts.nf2) cell.numFmt = opts.nf2;
            });
        }
        for (let c = (l2 ? 9 : 5); c <= RA; c++) {
            ws4.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: RA_BLANC } };
        }
    }

    // Resultado resaltado (fila tipo "Carga Disponible = X m")
    function raResult(r: number, label: string, val: any, unit: string,
                      bg = RA_LYELL) {
        raFill(r, bg, 20);
        ws4.mergeCells(r, 2, r, 8);
        const lc = ws4.getCell(r, 2);
        lc.value = label;
        lc.font  = { bold: true, size: 10, name: 'Arial', color: { argb: RA_NEGRO } };
        lc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        lc.alignment = { horizontal: 'center', vertical: 'middle' };
        lc.border = { top: raBM, left: raBM, bottom: raBM, right: raBM };
        for (let c = 3; c <= 8; c++) {
            ws4.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
            ws4.getCell(r, c).border = { top: raBM, bottom: raBM };
        }
        // valor
        const vc = ws4.getCell(r, 9);
        vc.value = `${val} ${unit}`;
        vc.font  = { bold: true, size: 11, name: 'Arial', color: { argb: RA_NEGRO } };
        vc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_YELLOW } };
        vc.alignment = { horizontal: 'center', vertical: 'middle' };
        vc.border = { top: raBM, left: raBM, bottom: raBM, right: raBM };
        for (let c = 10; c <= RA; c++) {
            ws4.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: RA_BLANC } };
        }
    }

    // SVG curva de pérdida 
    async function buildCurvasPNG(qM3h: number, diamMm: number): Promise<string> {
        const datosReales: Record<number, number[][]> = {
            15: [[0.4,0.1],[0.5,0.15],[0.6,0.2],[0.7,0.27],[0.8,0.35],[0.9,0.44],[1,0.5],[1.1,0.58],[1.2,0.7],[1.3,0.82],[1.4,0.95],[1.5,1.1],[1.7,1.4],[2,2],[2.5,3],[3,4.5],[3.5,6.2],[4,8]],
            20: [[0.6,0.1],[0.7,0.12],[0.8,0.15],[0.9,0.19],[1,0.25],[1.2,0.35],[1.4,0.42],[1.5,0.5],[1.7,0.65],[2,0.8],[2.5,1.25],[3,1.8],[3.5,2.4],[4,3.2],[4.5,4.1],[5,5],[6,7.2],[7,9.8],[8,12.5],[9,15.8],[10,19.5]],
            25: [[0.8,0.1],[0.9,0.12],[1,0.15],[1.2,0.22],[1.4,0.26],[1.5,0.3],[1.7,0.38],[2,0.5],[2.5,0.78],[3,1.1],[3.5,1.5],[4,2],[4.5,2.55],[5,3.1],[5.5,3.75],[6,4.5],[7,6.2],[8,8],[9,10.2],[10,12.5],[12,18],[15,28],[18,40],[20,50]],
            32: [[1,0.1],[1.2,0.14],[1.4,0.17],[1.5,0.2],[1.7,0.25],[2,0.3],[2.2,0.38],[2.5,0.48],[3,0.65],[3.5,0.85],[4,1.15],[4.5,1.45],[5,1.8],[5.5,2.2],[6,2.6],[7,3.6],[8,4.6],[9,5.8],[10,7.2],[12,10.5],[15,16],[18,22],[20,28],[25,44],[30,63],[35,86],[40,112]],
            40: [[1.5,0.08],[2,0.1],[2.2,0.12],[2.5,0.15],[3,0.2],[3.5,0.27],[4,0.35],[4.5,0.44],[5,0.55],[5.5,0.67],[6,0.8],[7,1.1],[8,1.4],[9,1.75],[10,2.2],[12,3.2],[15,5],[18,7.2],[20,8.9],[25,14],[30,20],[35,27],[40,35]],
            50: [[2,0.06],[2.5,0.08],[3,0.1],[3.5,0.12],[4,0.15],[4.5,0.19],[5,0.25],[5.5,0.29],[6,0.35],[7,0.48],[8,0.6],[9,0.75],[10,0.95],[12,1.35],[15,2.1],[18,3],[20,3.8],[25,6],[30,8.5],[35,11.5],[40,15],[45,19],[50,23]]
        };
        const colors: Record<number, string> = {
            15: '#e74c3c', 20: '#F44336', 25: '#9C27B0',
            32: '#FF9800', 40: '#2196F3', 50: '#4CAF50'
        };
        const labels: Record<number, string> = {
            15:'Ø 15 mm',20:'Ø 20 mm',25:'Ø 25 mm',
            32:'Ø 32 mm',40:'Ø 40 mm',50:'Ø 50 mm'
        };

        const interpLog = (x: number, pts: number[][]): number | null => {
            if (!pts.length || x <= 0) return null;
            if (x <= pts[0][0]) return pts[0][1];
            if (x >= pts[pts.length-1][0]) return pts[pts.length-1][1];
            for (let i = 0; i < pts.length-1; i++) {
                const [x1,y1] = pts[i], [x2,y2] = pts[i+1];
                if (x >= x1 && x <= x2)
                    return Math.exp(Math.log(y1) +
                        (Math.log(y2)-Math.log(y1)) *
                        (Math.log(x)-Math.log(x1)) /
                        (Math.log(x2)-Math.log(x1)));
            }
            return null;
        };

        // SVG dimensions
        const W = 700, H = 460;
        const ML = 70, MR = 20, MT = 40, MB = 60;
        const PW = W - ML - MR, PH = H - MT - MB;

        // log scale mappers
        const xMin = 0.4, xMax = 50, yMin = 0.05, yMax = 20;
        const xToP = (x: number) => ML + (Math.log(x) - Math.log(xMin)) /
            (Math.log(xMax) - Math.log(xMin)) * PW;
        const yToP = (y: number) => MT + PH - (Math.log(y) - Math.log(yMin)) /
            (Math.log(yMax) - Math.log(yMin)) * PH;

        // X axis ticks
        const xTicks = [0.4,0.5,0.6,0.8,1,2,3,4,5,6,8,10,20,30,40,50];
        const yTicks = [0.05,0.1,0.2,0.5,1,2,5,10,20];

        // Draw each curve
        const curveLines = Object.entries(datosReales).map(([d, pts]) => {
            const color = colors[parseInt(d)] || '#333';
            const pathPts: string[] = [];
            for (let i = 0; i <= 150; i++) {
                const x = xMin * Math.pow(xMax/xMin, i/150);
                const y = interpLog(x, pts);
                if (y !== null && y >= yMin && y <= yMax)
                    pathPts.push(`${i===0?'M':'L'}${xToP(x).toFixed(1)},${yToP(y).toFixed(1)}`);
            }
            return pathPts.length > 1
                ? `<path d="${pathPts.join(' ')}" fill="none" stroke="${color}"
                    stroke-width="2" opacity="0.9"/>
                   <text x="${xToP(xMax) + 4}" y="${yToP(interpLog(xMax, pts) || yMax).toFixed(1)}"
                    font-size="9" fill="${color}" font-family="Arial">${labels[parseInt(d)]}</text>`
                : '';
        }).join('\n');

        // Punto operación
        const perd = interpLog(qM3h, datosReales[diamMm] || datosReales[25]);
        const pointSVG = perd && qM3h > 0 && perd >= yMin && perd <= yMax ? `
            <line x1="${xToP(qM3h).toFixed(1)}" y1="${MT}" x2="${xToP(qM3h).toFixed(1)}"
                y2="${yToP(perd).toFixed(1)}" stroke="#9C27B0" stroke-width="1.5"
                stroke-dasharray="4 3"/>
            <line x1="${ML}" y1="${yToP(perd).toFixed(1)}" x2="${xToP(qM3h).toFixed(1)}"
                y2="${yToP(perd).toFixed(1)}" stroke="#9C27B0" stroke-width="1.5"
                stroke-dasharray="4 3"/>
            <circle cx="${xToP(qM3h).toFixed(1)}" cy="${yToP(perd).toFixed(1)}"
                r="6" fill="#9C27B0" opacity="0.85"/>
            <text x="${(xToP(qM3h)+8).toFixed(1)}" y="${(yToP(perd)-6).toFixed(1)}"
                font-size="9" fill="#9C27B0" font-weight="bold" font-family="Arial">
                Q=${qM3h.toFixed(2)} m³/h</text>
            <text x="${(xToP(qM3h)+8).toFixed(1)}" y="${(yToP(perd)+8).toFixed(1)}"
                font-size="9" fill="#9C27B0" font-weight="bold" font-family="Arial">
                hf=${perd.toFixed(3)} m/m</text>` : '';

        const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${W}" height="${H}" fill="white"/>
          <!-- Título -->
          <text x="${W/2}" y="24" text-anchor="middle" font-size="13" font-weight="bold"
            fill="#111" font-family="Arial">Curva de Pérdida de Presión</text>
          <!-- Grid -->
          <rect x="${ML}" y="${MT}" width="${PW}" height="${PH}"
            fill="white" stroke="#000" stroke-width="2"/>
          ${xTicks.map(x => `
            <line x1="${xToP(x).toFixed(1)}" y1="${MT}" x2="${xToP(x).toFixed(1)}"
              y2="${MT+PH}" stroke="#ddd" stroke-width="0.8"/>
            <text x="${xToP(x).toFixed(1)}" y="${MT+PH+14}" text-anchor="middle"
              font-size="9" fill="#333" font-family="Arial">${x}</text>`).join('')}
          ${yTicks.map(y => `
            <line x1="${ML}" y1="${yToP(y).toFixed(1)}" x2="${ML+PW}"
              y2="${yToP(y).toFixed(1)}" stroke="#ddd" stroke-width="0.8"/>
            <text x="${ML-6}" y="${(yToP(y)+3).toFixed(1)}" text-anchor="end"
              font-size="9" fill="#333" font-family="Arial">${y}</text>`).join('')}
          <!-- Curvas -->
          ${curveLines}
          <!-- Punto -->
          ${pointSVG}
          <!-- Ejes labels -->
          <text x="${ML+PW/2}" y="${H-8}" text-anchor="middle" font-size="11"
            fill="#333" font-family="Arial">Caudal - m³/h</text>
          <text x="14" y="${MT+PH/2}" text-anchor="middle" font-size="10"
            fill="#333" font-family="Arial"
            transform="rotate(-90 14 ${MT+PH/2})">Pérdida de Presión (m.c.a.)</text>
        </svg>`;

        return new Promise<string>((resolve, reject) => {
            const img  = new Image();
            const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
            const url  = URL.createObjectURL(blob);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = W * 2; canvas.height = H * 2;
                const ctx = canvas.getContext('2d')!;
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.scale(2, 2);
                ctx.drawImage(img, 0, 0, W, H);
                URL.revokeObjectURL(url);
                resolve(canvas.toDataURL('image/png').split(',')[1]);
            };
            img.onerror = reject;
            img.src = url;
        });
    }

    // Funciones de cálculo
    const raDiamData: Record<string, { mm: number; area: number }> = {
        '1/2 pulg':   { mm: 15, area: 0.50 },
        '3/4 pulg':   { mm: 20, area: 0.74 },
        '1 pulg':     { mm: 25, area: 1 },
        '1 1/4 pulg': { mm: 32, area: 1.25 },
        '1 1/2 pulg': { mm: 40, area: 1.5 },
        '2 pulg':     { mm: 50, area: 2 },
        '2 1/2 pulg': { mm: 50, area: 2.5 },
        '3 pulg':     { mm: 50, area: 3 },
    };

    const raCalcV = (q: number, d: string) => {
        const area = raDiamData[d]?.area;
        if (!area || q <= 0) return 0;
        return +((q/1000) / (Math.PI * Math.pow(area * 2.54/100, 2) / 4)).toFixed(3);
    };

    const raCalcS = (q: number, d: string) => {
        const area = raDiamData[d]?.area;
        if (!area || q <= 0) return 0;
        return +(Math.pow((q/1000 / 0.2785 / 140) /
            Math.pow(area * 2.54/100, 2.63), 1.85)).toFixed(6);
    };

    // Leer datos 
    const raD          = dataSheet.redAlimentacion || {};
    const raVolCist    = parseFloat(raD.volCisterna)   || 2000;
    const raTiempoL    = parseFloat(raD.tiempoLlenado) || 10;
    const raConsumoDia = parseFloat(raD.consumoDiario) || 0;
    const raNivTerr    = parseFloat(raD.nivelTerreno)  || 0;
    const raPresConn   = parseFloat(raD.presionConn)   || 10;
    const raPresSal    = parseFloat(raD.presionSalida) || 2;
    const raNivIngCist = parseFloat(raD.nivIngCist)    || 0;
    const raDiamConn   = raD.diamConn  || '1 pulg';
    const raMicro      = raD.micro     || 'SI';
    const raLTuberia   = parseFloat(raD.lTuberia)  || 5.40;
    const raHfMed      = parseFloat(raD.hfMed)     || 1.10;
    const raAccs: any[] = Array.isArray(raD.accs) ? raD.accs : [
        { tipo:'codo45',      cantidad:0, leq:0.477 },
        { tipo:'codo90',      cantidad:3, leq:1.023 },
        { tipo:'tee',         cantidad:1, leq:2.045 },
        { tipo:'valCompuerta',cantidad:2, leq:0.216 },
        { tipo:'valCheck',    cantidad:0, leq:2.114 },
        { tipo:'reduccion2',  cantidad:1, leq:1.045 },
    ];
    const raDiaSel  = raD.diaSel  || '1 pulg';
    const raDiaLTub = parseFloat(raD.diaLTub) || 15.88;
    const raDiaAccs: any[] = Array.isArray(raD.diaAccs) ? raD.diaAccs : [
        { tipo:'codo45',      cantidad:0, leq:0.477 },
        { tipo:'codo90',      cantidad:7, leq:1.023 },
        { tipo:'tee',         cantidad:2, leq:2.045 },
        { tipo:'valCompuerta',cantidad:2, leq:0.216 },
        { tipo:'valCheck',    cantidad:0, leq:2.114 },
        { tipo:'reduccion2',  cantidad:0, leq:1.045 },
    ];

    // Cálculos derivados
    const raQllen      = raTiempoL > 0 ? parseFloat((raVolCist / (raTiempoL * 3600)).toFixed(3)) : 0;
    const raQM3h       = parseFloat((raQllen * 3.6).toFixed(2));
    const raNivTubConn = parseFloat((raNivTerr - 0.70).toFixed(2));
    const raAltEst     = parseFloat((raNivIngCist - raNivTubConn).toFixed(2));
    const raCargaDisp  = parseFloat((raPresConn - raPresSal - raAltEst).toFixed(2));
    const raVel        = raCalcV(raQllen, raDiamConn);
    const raLeqT       = Math.round(raAccs.reduce((s: number, a: any) =>
        s + (a.cantidad||0) * (a.leq||0), 0) * 1000) / 1000;
    const raLTot       = parseFloat((raLeqT + raLTuberia).toFixed(2));
    const raSH         = raCalcS(raQllen, raDiamConn);
    const raHf         = parseFloat((raLTot * raSH).toFixed(2));
    const raHfMedV     = raMicro === 'SI' ? parseFloat(raHfMed.toFixed(2)) : 0;
    const raCDisp      = parseFloat((raCargaDisp - raHfMedV - raHf).toFixed(2));
    const raDVel       = raCalcV(raQllen, raDiaSel);
    const raDLeqT      = Math.round(raDiaAccs.reduce((s: number, a: any) =>
        s + (a.cantidad||0) * (a.leq||0), 0) * 1000) / 1000;
    const raDLTot      = parseFloat((raDLeqT + raDiaLTub).toFixed(2));
    const raDS         = raCalcS(raQllen, raDiaSel);
    const raDHf        = parseFloat((raDLTot * raDS).toFixed(2));
    const raDCDisp     = parseFloat((raCDisp - raDHf).toFixed(2));

    const raAccLabels: Record<string, string> = {
        codo45:'Codo de 45°', codo90:'Codo de 90°', tee:'Tee',
        valCompuerta:'Válvula Compuerta', valCheck:'Válvula Check',
        canastilla:'Canastilla', reduccion1:'Reducción 1', reduccion2:'Reducción 2',
    };

    let rr = 1;

    // ENCABEZADO PRINCIPAL
    raTitleBar(rr, '4. CALCULO DE LA RED DE ALIMENTACIÓN'); rr++;
    raSep(rr, 18); rr++;

    // 3.1. CAUDAL DE ENTRADA
    raSubBar(rr, '4.1. CAUDAL DE ENTRADA'); rr++;
    raSep(rr, 8); rr++;
    raSep(rr, 10); rr++;

    // Fila: Vol Cisterna + Tiempo Llenado
    raLV2(rr,
        'Volumen de la Cisterna =', `${raVolCist.toFixed(3)} L`, '',
        'Tiempo de Llenado=', `${raTiempoL} hrs`, '',
        { vb1: RA_LYELL, vb2: RA_YELLOW }
    ); rr++;
    raSep(rr, 8); rr++;

    // Q llenado 
    raFill(rr, RA_BLANC, 22);
    ws4.mergeCells(rr, 2, rr, 6);
    const raQLbl = ws4.getCell(rr, 2);
    raQLbl.value = `Q llenado = ${raQllen.toFixed(3)} L/s`;
    raQLbl.font  = { bold: true, size: 10, name: 'Arial', color: { argb: RA_NEGRO } };
    raQLbl.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_YELLOW } };
    raQLbl.alignment = { horizontal: 'center', vertical: 'middle' };
    raQLbl.border = { top: raBM, left: raBM, bottom: raBM, right: raBM };
    for (let c = 3; c <= 6; c++) {
        ws4.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RA_YELLOW } };
        ws4.getCell(rr, c).border = { top: raBM, bottom: raBM };
    }
    for (let c = 7; c <= RA; c++)
        ws4.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RA_BLANC } };
    rr++;
    raSep(rr, 18); rr++;

    // 3.2. CARGA DISPONIBLE
    raSubBar(rr, '4.2. CARGA DISPONIBLE'); rr++;
    raSep(rr, 8); rr++;
    raSep(rr, 8); rr++;

    // Label centrado "Datos de la FACTIBILIDAD DE SERVICIO"
    raFill(rr, 'FFE8F4FD', 18);
    ws4.mergeCells(rr, 2, rr, RA);
    const raFactLbl = ws4.getCell(rr, 2);
    raFactLbl.value = 'Datos de la FACTIBILIDAD DE SERVICIO';
    raFactLbl.font  = { bold: false, size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
    raFactLbl.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4FD' } };
    raFactLbl.alignment = { horizontal: 'center', vertical: 'middle' };
    rr++;
    raSep(rr, 8); rr++;

    raLV(rr, 'Nivel del terreno donde la cnx. =', `+${raNivTerr.toFixed(2)} m`, '',
        { valBg: RA_LYELL }); rr++;
    raLV(rr, 'Nivel de la tubería de cnx. =', `${raNivTubConn.toFixed(2)} m`, '',
        { valBg: RA_LYELL }); rr++;
    raLV(rr, 'Nivel de tubería de ingreso a cist. =', `+${raNivIngCist.toFixed(2)} m`, '',
        { valBg: RA_LYELL }); rr++;
    raSep(rr, 8); rr++;
    raLV(rr, 'Presión en la CONEXIÓN PÚBLICA =', `+${raPresConn.toFixed(2)} m`, '',
        { valBg: RA_YELLOW }); rr++;
    raLV(rr, 'Presión de salida en tub. de ingreso =', `+${raPresSal.toFixed(2)} m`, '',
        { valBg: RA_YELLOW }); rr++;
    raLV(rr, 'Altura estática entre tub red publica y la cist =',
        `+${raAltEst.toFixed(2)} m`, '', { valBg: RA_LYELL }); rr++;
    raSep(rr, 10); rr++;

    raResult(rr, `Carga Disponible (Hd1) = ${raCargaDisp.toFixed(2)} m`, '', '', RA_YELLOW); rr++;
    raSep(rr, 18); rr++;

    // 3.3. PÉRDIDA DE CARGA: TRAMO RED PÚBLICA - MEDIDOR
    raSubBar(rr, '4.3. PERDIDA DE CARGA: TRAMO RED PUBLICA - MEDIDOR'); rr++;
    raSep(rr, 8); rr++;
    raSep(rr, 10); rr++;

    // Inputs: Diámetro + Micromedidor
    raLV2(rr,
        'Diámetro de la Conexión Domiciliaria =', raDiamConn, 'pulg.',
        'Presenta MICROMEDICION =', raMicro, '',
        { vb1: RA_YELLOW, vb2: RA_YELLOW }
    ); rr++;
    raSep(rr, 10); rr++;

    // Tabla accesorios 3.3 
    const raTblH = { style: 'thin' as ExcelJS.BorderStyle, color: { argb: 'FFFFFFFF' } };

    // Fila 1 headers
    ws4.getRow(rr).height = 18;
    raFill(rr, RA_BLUE, 18);
    const raTH: Array<{ c: number; span: number; text: string }> = [
        { c: 2, span: 1, text: 'Q\n(L/s)' },
        { c: 3, span: 1, text: 'diámetro' },
        { c: 4, span: 1, text: 'V\n(m/s)' },
        { c: 5, span: 4, text: 'L accesorios' },
        { c: 9, span: 1, text: 'L tubería' },
        { c:10, span: 1, text: 'L total' },
        { c:11, span: 1, text: 'S\n(m/m)' },
        { c:12, span: 1, text: 'hf\n(m)' },
    ];
    raTH.forEach(({ c, span, text }) => {
        if (span > 1) ws4.mergeCells(rr, c, rr, c + span - 1);
        const cell = ws4.getCell(rr, c);
        cell.value = text;
        cell.font  = { bold: true, size: 8, name: 'Arial',
                       color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_BLUE } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: raTblH, left: raTblH, bottom: raTblH, right: raTblH };
    });
    rr++;

    // Fila 2 sub-headers L accesorios
    ws4.getRow(rr).height = 16;
    raFill(rr, RA_BLUE2, 16);
    for (let c = 2; c <= RA; c++) {
        ws4.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: c >= 5 && c <= 8 ? RA_BLUE2 : RA_BLUE } };
    }
    const raTH2: Array<{ c: number; text: string }> = [
        { c: 5, text: 'accesorios' }, { c: 6, text: '#' },
        { c: 7, text: 'Leq.' },      { c: 8, text: 'Leq. T' },
    ];
    raTH2.forEach(({ c, text }) => {
        const cell = ws4.getCell(rr, c);
        cell.value = text;
        cell.font  = { bold: true, size: 8, name: 'Arial',
                       color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_BLUE2 } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: raTblH, left: raTblH, bottom: raTblH, right: raTblH };
    });
    rr++;

    // Filas de datos accesorios 3.3
    const raAccStart = rr;
    raAccs.forEach((acc: any, idx: number) => {
        ws4.getRow(rr).height = 20;
        const bg = idx % 2 === 0 ? RA_BLANC : RA_LBLUE;
        raFill(rr, bg, 17);

        // Celdas rowspan 
        if (idx === 0) {
            ws4.mergeCells(rr, 2, rr + raAccs.length - 1, 2);
            const c2 = ws4.getCell(rr, 2);
            c2.value = `${raQllen.toFixed(3)} L/s`;
            c2.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF2563EB' } };
            c2.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_BLANC } };
            c2.alignment = { horizontal: 'center', vertical: 'middle' };
            c2.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };

            ws4.mergeCells(rr, 3, rr + raAccs.length - 1, 3);
            const c3 = ws4.getCell(rr, 3);
            c3.value = raDiamConn;
            c3.font  = { bold: true, size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
            c3.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_BLANC } };
            c3.alignment = { horizontal: 'center', vertical: 'middle' };
            c3.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };

            ws4.mergeCells(rr, 4, rr + raAccs.length - 1, 4);
            const c4 = ws4.getCell(rr, 4);
            c4.value = raVel;
            c4.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF16A34A' } };
            c4.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_BLANC } };
            c4.alignment = { horizontal: 'center', vertical: 'middle' };
            c4.numFmt = '0.000 "m/s"';
            c4.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };

            ws4.mergeCells(rr, 9, rr + raAccs.length - 1, 9);
            const c9 = ws4.getCell(rr, 9);
            c9.value = raLTuberia;
            c9.font  = { bold: true, size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
            c9.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_YELLOW } };
            c9.alignment = { horizontal: 'center', vertical: 'middle' };
            c9.numFmt = '0.00 "m"';
            c9.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };

            ws4.mergeCells(rr, 10, rr + raAccs.length - 1, 10);
            const c10 = ws4.getCell(rr, 10);
            c10.value = raLTot;
            c10.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF7C3AED' } };
            c10.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_YELLOW } };
            c10.alignment = { horizontal: 'center', vertical: 'middle' };
            c10.numFmt = '0.00 "m"';
            c10.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };

            ws4.mergeCells(rr, 11, rr + raAccs.length - 1, 11);
            const c11 = ws4.getCell(rr, 11);
            c11.value = raSH;
            c11.font  = { size: 8, name: 'Courier New', color: { argb: RA_NEGRO } };
            c11.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_BLANC } };
            c11.alignment = { horizontal: 'center', vertical: 'middle' };
            c11.numFmt = '0.000000';
            c11.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };

            ws4.mergeCells(rr, 12, rr + raAccs.length - 1, 12);
            const c12 = ws4.getCell(rr, 12);
            c12.value = raHf;
            c12.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFDC2626' } };
            c12.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_YELLOW } };
            c12.alignment = { horizontal: 'center', vertical: 'middle' };
            c12.numFmt = '0.00 "m"';
            c12.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
        }

        // Celda accesorio
        const c5 = ws4.getCell(rr, 5);
        c5.value = raAccLabels[acc.tipo] || acc.tipo;
        c5.font  = { size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
        c5.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        c5.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        c5.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };

        // Cantidad
        const c6 = ws4.getCell(rr, 6);
        const cantVal = parseFloat(acc.cantidad) || 0;
        c6.value = cantVal;
        c6.font  = { bold: true, size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
        c6.fill  = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: cantVal > 0 ? RA_YELLOW : bg } };
        c6.alignment = { horizontal: 'center', vertical: 'middle' };
        c6.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
        c6.numFmt = '0';

        // Leq
        const c7 = ws4.getCell(rr, 7);
        c7.value = parseFloat(acc.leq) || 0;
        c7.font  = { size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
        c7.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        c7.alignment = { horizontal: 'center', vertical: 'middle' };
        c7.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
        c7.numFmt = '0.000';

        // Leq.T
        const leqT33 = parseFloat(((parseFloat(acc.cantidad)||0) * (parseFloat(acc.leq)||0)).toFixed(3));
        const c8 = ws4.getCell(rr, 8);
        c8.value = leqT33;
        c8.font  = { bold: true, size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
        c8.fill  = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: leqT33 > 0 ? RA_LYELL : bg } };
        c8.alignment = { horizontal: 'center', vertical: 'middle' };
        c8.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
        c8.numFmt = '0.000';

        rr++;
    });

    // Fila LONGITUD TOTAL EQUIVALENTE
    ws4.getRow(rr).height = 20;
    raFill(rr, RA_LGRAY, 20);
    ws4.mergeCells(rr, 2, rr, 7);
    const raLeqLbl = ws4.getCell(rr, 2);
    raLeqLbl.value = 'LONGITUD TOTAL EQUIVALENTE:';
    raLeqLbl.font  = { bold: true, size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
    raLeqLbl.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_LGRAY } };
    raLeqLbl.alignment = { horizontal: 'right', vertical: 'middle' };
    raLeqLbl.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
    for (let c = 3; c <= 7; c++) {
        ws4.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RA_LGRAY } };
        ws4.getCell(rr, c).border = { top: raBT, bottom: raBT };
    }
    const raLeqVal = ws4.getCell(rr, 8);
    raLeqVal.value = `${raLeqT.toFixed(3)} m`;
    raLeqVal.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF2563EB' } };
    raLeqVal.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_LGRAY } };
    raLeqVal.alignment = { horizontal: 'center', vertical: 'middle' };
    raLeqVal.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
    for (let c = 9; c <= RA; c++) {
        ws4.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RA_BLANC } };
    }
    rr++;
    raSep(rr, 12); rr++;

    //  GRÁFICO — Curva de Pérdida 
    const raChartH = 320;
    const raChartRows = Math.ceil(raChartH / 17);
    const raChartStart = rr;
    for (let i = 0; i < raChartRows; i++) {
        ws4.getRow(rr).height = 17;
        for (let c = 1; c <= RA; c++)
            ws4.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: RA_BLANC } };
        rr++;
    }
    try {
        const chartPng = await buildCurvasPNG(raQM3h,
            raDiamData[raDiamConn]?.mm || 25);
        const raImgId = workbook.addImage({ base64: chartPng, extension: 'png' });
        ws4.addImage(raImgId, {
            tl:  { nativeCol: 1, nativeRow: raChartStart - 1 },
            ext: { width: 700, height: raChartH },
            editAs: 'oneCell',
        } as any);
    } catch (e) {
        console.warn('Chart error:', e);
    }
    raSep(rr, 14); rr++;

    // Resultados 3.3 
    raLV2(rr,
        'Carga Disponible =', `+${raCargaDisp.toFixed(2)} m`, '',
        'Pérdida de Carga en medidor =', `+${raHfMedV.toFixed(2)} m`, '',
        { vb1: RA_LYELL, vb2: RA_YELLOW }
    ); rr++;
    raLV(rr, 'Pérdida de carga entre la Red Publica y Medidor =',
        `+${raHf.toFixed(2)} m`, '', { valBg: RA_YELLOW }); rr++;
    raSep(rr, 8); rr++;

    // Hd y Long tubería
    raLV2(rr,
        'Hd =', `${raCargaDisp.toFixed(2)} m`, '',
        'Long. tubería =', `${raLTuberia.toFixed(2)} m`, '',
        { vb1: RA_BLANC, vb2: RA_YELLOW }
    ); rr++;
    raSep(rr, 18); rr++;

    // 3.4. PÉRDIDA DE CARGA: MEDIDOR - CISTERNA
    raSubBar(rr, '4.4. PERDIDA DE CARGA: MEDIDOR - CISTERNA'); rr++;
    raSep(rr, 8); rr++;
    raSep(rr, 10); rr++;

    // Tabla accesorios 3.4 
    ws4.getRow(rr).height = 18;
    raFill(rr, RA_BLUE, 18);
    raTH.forEach(({ c, span, text }) => {
        if (span > 1) ws4.mergeCells(rr, c, rr, c + span - 1);
        const cell = ws4.getCell(rr, c);
        cell.value = text;
        cell.font  = { bold: true, size: 8, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_BLUE } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: raTblH, left: raTblH, bottom: raTblH, right: raTblH };
    });
    rr++;

    ws4.getRow(rr).height = 16;
    raFill(rr, RA_BLUE2, 16);
    raTH2.forEach(({ c, text }) => {
        const cell = ws4.getCell(rr, c);
        cell.value = text;
        cell.font  = { bold: true, size: 8, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_BLUE2 } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: raTblH, left: raTblH, bottom: raTblH, right: raTblH };
    });
    for (let c = 2; c <= RA; c++) {
        if (c < 5 || c > 8)
            ws4.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: RA_BLUE } };
    }
    rr++;

    raDiaAccs.forEach((acc: any, idx: number) => {
        ws4.getRow(rr).height = 20;
        const bg = idx % 2 === 0 ? RA_BLANC : RA_LBLUE;
        raFill(rr, bg, 17);

        if (idx === 0) {
          
            [
                { c: 2, val: `${raQllen.toFixed(3)} L/s`, col: 'FF2563EB', bg2: RA_BLANC, fmt: '' },
                { c: 3, val: raDiaSel, col: RA_NEGRO, bg2: RA_BLANC, fmt: '' },
                { c: 4, val: raDVel, col: 'FF16A34A', bg2: RA_BLANC, fmt: '0.000 "m/s"' },
                { c: 9, val: raDiaLTub, col: RA_NEGRO, bg2: RA_YELLOW, fmt: '0.00 "m"' },
                { c:10, val: raDLTot, col: 'FF7C3AED', bg2: RA_YELLOW, fmt: '0.00 "m"' },
                { c:11, val: raDS, col: RA_NEGRO, bg2: RA_BLANC, fmt: '0.000000' },
                { c:12, val: raDHf, col: 'FFDC2626', bg2: RA_YELLOW, fmt: '0.00 "m"' },
            ].forEach(({ c, val, col, bg2, fmt }) => {
                ws4.mergeCells(rr, c, rr + raDiaAccs.length - 1, c);
                const cell = ws4.getCell(rr, c);
                cell.value = val;
                cell.font  = { bold: true, size: 9, name: c === 11 ? 'Courier New' : 'Arial',
                               color: { argb: col } };
                cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg2 } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
                if (fmt) cell.numFmt = fmt;
            });
        }

        const c5 = ws4.getCell(rr, 5);
        c5.value = raAccLabels[acc.tipo] || acc.tipo;
        c5.font  = { size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
        c5.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        c5.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        c5.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };

        const cant2 = parseFloat(acc.cantidad) || 0;
        const c6 = ws4.getCell(rr, 6);
        c6.value = cant2;
        c6.font  = { bold: true, size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
        c6.fill  = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: cant2 > 0 ? RA_YELLOW : bg } };
        c6.alignment = { horizontal: 'center', vertical: 'middle' };
        c6.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
        c6.numFmt = '0';

        const c7 = ws4.getCell(rr, 7);
        c7.value = parseFloat(acc.leq) || 0;
        c7.font  = { size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
        c7.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        c7.alignment = { horizontal: 'center', vertical: 'middle' };
        c7.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
        c7.numFmt = '0.000';

        const leqT34 = parseFloat(((cant2) * (parseFloat(acc.leq)||0)).toFixed(3));
        const c8 = ws4.getCell(rr, 8);
        c8.value = leqT34;
        c8.font  = { bold: true, size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
        c8.fill  = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: leqT34 > 0 ? RA_LYELL : bg } };
        c8.alignment = { horizontal: 'center', vertical: 'middle' };
        c8.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
        c8.numFmt = '0.000';

        rr++;
    });

    // LONGITUD TOTAL EQUIVALENTE 3.4
    ws4.getRow(rr).height = 20;
    raFill(rr, RA_LGRAY, 20);
    ws4.mergeCells(rr, 2, rr, 7);
    const raLeqLbl2 = ws4.getCell(rr, 2);
    raLeqLbl2.value = 'LONGITUD TOTAL EQUIVALENTE:';
    raLeqLbl2.font  = { bold: true, size: 9, name: 'Arial', color: { argb: RA_NEGRO } };
    raLeqLbl2.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_LGRAY } };
    raLeqLbl2.alignment = { horizontal: 'right', vertical: 'middle' };
    raLeqLbl2.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
    for (let c = 3; c <= 7; c++) {
        ws4.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RA_LGRAY } };
        ws4.getCell(rr, c).border = { top: raBT, bottom: raBT };
    }
    const raLeqVal2 = ws4.getCell(rr, 8);
    raLeqVal2.value = `${raDLeqT.toFixed(3)} m`;
    raLeqVal2.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF2563EB' } };
    raLeqVal2.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RA_LGRAY } };
    raLeqVal2.alignment = { horizontal: 'center', vertical: 'middle' };
    raLeqVal2.border = { top: raBT, left: raBT, bottom: raBT, right: raBT };
    for (let c = 9; c <= RA; c++)
        ws4.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RA_BLANC } };
    rr++;
    raSep(rr, 10); rr++;

    // Resultados 3.4
    raLV2(rr,
        'Carga Disponible (Hd 2) =', `+${raCDisp.toFixed(2)} m`, '',
        'Perdida de carga entre el Medidor - Cisterna =', `+${raDHf.toFixed(2)} m`, '',
        { vb1: RA_LYELL, vb2: RA_YELLOW }
    ); rr++;
    raSep(rr, 8); rr++;
    raResult(rr, `Carga Disponible (Hd3) = ${raDCDisp.toFixed(2)}`, '', '', RA_YELLOW); rr++;
    raSep(rr, 18); rr++;

    // 3.5. RESULTADOS
    raSubBar(rr, '4.5. RESULTADOS'); rr++;
    raSep(rr, 8); rr++;
    raSep(rr, 10); rr++;

    raLV(rr, 'Q llenado =', `${raQllen.toFixed(3)} L/s`, '',
        { valBg: RA_YELLOW }); rr++;
    raSep(rr, 8); rr++;
    raLV(rr, 'Diámetro (Tramo Red Publica - Medidor) =',
        `${raDiamConn}`, 'pulg.', { valBg: RA_YELLOW }); rr++;
    raSep(rr, 8); rr++;
    raLV(rr, 'Diámetro (Medidor - Cisterna) =',
        `${raDiaSel}`, 'pulg.', { valBg: RA_YELLOW }); rr++;
    raSep(rr, 18); rr++;
    //--------------------------------------------------------------------------------------------------------------------------------------------------------------------

// HOJA 5: MÁXIMA DEMANDA SIMULTÁNEA
const ws5 = workbook.addWorksheet('5. Max. Demanda');

// Constantes de color 
const MD_BLANC  = 'FFFFFFFF';
const MD_NEGRO  = 'FF000000';
const MD_TITLE  = 'FF4F4F4F';   
const MD_HEADER = 'FF6D6D6D';   
const MD_YELLOW = 'FFFFC000';  
const MD_LYELL  = 'FFFFF2CC';  
const MD_LGRAY  = 'FFD9D9D9';   
const MD_BLUE   = 'FF1F4E78';
const MD_BLUE2  = 'FF2E75B6';
const MD_LBLUE  = 'FFD6E4F0';
const MD_DGREEN = 'FF375623';
const MD_TEAL   = 'FFE2F0ED';

// Colores por categoría de accesorio 
const MD_CAT: Record<string, { hdr: string; sub: string; bg: string; bgAlt: string }> = {
    inodoro:   { hdr: 'FF1F4E78', sub: 'FF2E75B6', bg: 'FFD6E4F0', bgAlt: 'FFE8F1F9' },
    urinario:  { hdr: 'FF375623', sub: 'FF548235', bg: 'FFE2EFDA', bgAlt: 'FFEEF5E8' },
    lavatorio: { hdr: 'FF833C00', sub: 'FFC55A11', bg: 'FFFCE4D6', bgAlt: 'FFFEF0E8' },
    lavadero:  { hdr: 'FF833C00', sub: 'FFC55A11', bg: 'FFFCE4D6', bgAlt: 'FFFEF0E8' },
    ducha:     { hdr: 'FF1F3864', sub: 'FF2F5496', bg: 'FFDAE3F3', bgAlt: 'FFEAEFF9' },
    tina:      { hdr: 'FF1F3864', sub: 'FF2F5496', bg: 'FFDAE3F3', bgAlt: 'FFEAEFF9' },
    default:   { hdr: 'FF404040', sub: 'FF606060', bg: 'FFF2F2F2', bgAlt: 'FFF8F8F8' },
};

// Bordes
const mdBT = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFA0A0A0' } };
const mdBM = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FF666666' } };
const mdBW = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFFFFFFF' } };

// Leer datos 
const mdD            = dataSheet.maximademandasimultanea || {};
const mdGrades       = mdD.grades || { inicial: true, primaria: false, secundaria: false };
const mdTables       = mdD.tables || {};
const mdAnexo02: any[] = Array.isArray(mdD.anexo02) ? mdD.anexo02 : [
    { id:1,  aparatoSanitario:'Inodoro',   tipo:'Con Tanque - Descarga reducida',         total:2.5, afmax:2.5,  acmax:null },
    { id:2,  aparatoSanitario:'Inodoro',   tipo:'Con Tanque',                             total:5,   afmax:5,    acmax:null },
    { id:3,  aparatoSanitario:'Inodoro',   tipo:'C/ Válvula semiautomática y automática', total:8,   afmax:8,    acmax:null },
    { id:4,  aparatoSanitario:'Inodoro',   tipo:'C/ Válv. semiaut. descarga reducida',    total:4,   afmax:4,    acmax:null },
    { id:5,  aparatoSanitario:'Lavatorio', tipo:'Corriente',                              total:2,   afmax:1.5,  acmax:1.5 },
    { id:6,  aparatoSanitario:'Lavatorio', tipo:'Múltiple',                               total:2,   afmax:1.5,  acmax:1.5 },
    { id:7,  aparatoSanitario:'Lavadero',  tipo:'Hotel restaurante',                      total:4,   afmax:3,    acmax:3   },
    { id:8,  aparatoSanitario:'Lavadero',  tipo:'-',                                      total:3,   afmax:2,    acmax:2   },
    { id:9,  aparatoSanitario:'Ducha',     tipo:'-',                                      total:4,   afmax:3,    acmax:3   },
    { id:10, aparatoSanitario:'Tina',      tipo:'-',                                      total:6,   afmax:3,    acmax:3   },
    { id:11, aparatoSanitario:'Urinario',  tipo:'Con Tanque',                             total:3,   afmax:3,    acmax:null },
    { id:12, aparatoSanitario:'Urinario',  tipo:'C/ Válvula semiautomática y automática', total:5,   afmax:5,    acmax:null },
    { id:13, aparatoSanitario:'Urinario',  tipo:'C/ Válv. semiaut. descarga reducida',    total:2.5, afmax:2.5,  acmax:null },
    { id:14, aparatoSanitario:'Urinario',  tipo:'Múltiple',                               total:3,   afmax:3,    acmax:null },
    { id:15, aparatoSanitario:'Bebedero',  tipo:'Simple',                                 total:1,   afmax:1,    acmax:null },
    { id:16, aparatoSanitario:'Bebedero',  tipo:'Múltiple (UG por cada salida)',          total:1,   afmax:1,    acmax:null },
];
const mdExteriores = mdD.exterioresData || {
    inicial:    { nombre:'AREA VERDE - INICIAL',    areaRiego:491.6, salidasRiego:6, caudalPorSalida:0.23, uh:5, uhTotal:30 },
    primaria:   { nombre:'AREA VERDE - PRIMARIA',   areaRiego:41.46, salidasRiego:2, caudalPorSalida:0.23, uh:5, uhTotal:10 },
    secundaria: { nombre:'AREA VERDE - SECUNDARIA', areaRiego:200.0, salidasRiego:4, caudalPorSalida:0.23, uh:5, uhTotal:20 },
};
const mdTotals         = mdD.totals || {};
const mdSelectedGrades = Object.keys(mdGrades).filter(g => mdGrades[g]);

// Categorías extraídas del Anexo02 
const mdCategoryMap: Record<string, string> = {
    inodoro:'inodoro', urinario:'urinario', lavatorio:'lavatorio',
    lavadero:'lavadero', lavadero_con_triturador:'lavatorio',
    bebedero:'lavatorio', ducha:'ducha', tina:'ducha',
};
const mdNorm = (t: string) =>
    t.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/_$/,'');

const mdCats: { key: string; label: string; count: number }[] = [];
const _mdSeen: Record<string, boolean> = {};
mdAnexo02.forEach((row: any) => {
    const nk = mdNorm(row.aparatoSanitario);
    const ck = mdCategoryMap[nk] || nk;
    if (!_mdSeen[ck]) {
        _mdSeen[ck] = true;
        mdCats.push({ key: ck, label: ck.charAt(0).toUpperCase() + ck.slice(1).replace(/_/g,' '), count: 0 });
    }
    mdCats.find(c => c.key === ck)!.count++;
});

// Columnas: 1
const MD_DESC_COL  = 2;                          
const MD_ACC_START = 3;                          
const MD_ACC_COLS  = mdCats.length * 2;
const MD_TOTAL_COL = MD_ACC_START + MD_ACC_COLS; 
const MD_LAST      = MD_TOTAL_COL;             

// Anchos de columnas 
const mdColDefs: Partial<ExcelJS.Column>[] = [
    { width: 3  },  
    { width: 35 },  
];
mdCats.forEach(() => {
    mdColDefs.push({ width: 8 }); 
    mdColDefs.push({ width: 7 });   
});
mdColDefs.push({ width: 10 });      
ws5.columns = mdColDefs;

// Helpers 
const gc5 = (r: number, c: number) => ws5.getCell(r, c);

function md5Fill(r: number, bg: string, h = 17) {
    ws5.getRow(r).height = h;
    gc5(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MD_BLANC } };
    for (let c = 2; c <= MD_LAST; c++)
        gc5(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
}
function md5Sep(r: number, h = 10) {
    ws5.getRow(r).height = h;
    for (let c = 1; c <= MD_LAST; c++)
        gc5(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MD_BLANC } };
}
function md5TitleBar(r: number, text: string) {
    md5Fill(r, MD_TITLE, 26);
    ws5.mergeCells(r, 2, r, MD_LAST);
    const cell = gc5(r, 2);
    cell.value = text;
    cell.font  = { bold: true, size: 12, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: MD_TITLE } };
    cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    cell.border = { top: mdBM, left: mdBM, bottom: mdBM, right: mdBM };
}
function md5SubBar(r: number, text: string, bg = MD_HEADER) {
    md5Fill(r, bg, 24);
    ws5.mergeCells(r, 2, r, MD_LAST);
    const cell = gc5(r, 2);
    cell.value = text;
    cell.font  = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    cell.border = { top: mdBT, left: mdBM, bottom: mdBT, right: mdBM };
}

// Calcular UD de un item 
const mdCalcUD = (item: any): number => {
    if (!item?.accessories) return parseFloat(item?.udTotal) || 0;
    return mdCats.reduce((sum, cat) => {
        const c = parseFloat(item.accessories?.[cat.key]?.cantidad) || 0;
        const u = parseFloat(item.accessories?.[cat.key]?.uh) || 0;
        return sum + c * u;
    }, 0);
};

// Interpolación curva Hunter 
const mdUHData: [number, number][] = [
    [0,0],[1,0.12],[2,0.18],[3,0.27],[4,0.36],[5,0.42],[6,0.48],[7,0.54],[8,0.60],
    [10,0.72],[12,0.84],[14,0.96],[16,1.02],[18,1.08],[20,1.14],[25,1.26],[30,1.32],
    [35,1.38],[40,1.44],[45,1.50],[50,1.56],[60,1.68],[70,1.74],[80,1.80],[90,1.86],
    [100,1.92],[120,2.04],[140,2.16],[160,2.22],[180,2.28],[200,2.34],
    [225,2.46],[250,2.52],[275,2.58],[300,2.64],[350,2.76],[400,2.88],
    [450,2.94],[500,3.00],[600,3.18],[700,3.30],[800,3.42],[900,3.54],[1000,3.66],
];
const mdGetFlow = (uh: number): number => {
    const u = parseFloat(String(uh));
    if (!isFinite(u) || u <= 0) return 0;
    const exact = mdUHData.find(([x]) => Math.abs(x - u) < 0.001);
    if (exact) return exact[1];
    let lo: [number,number] | null = null, hi: [number,number] | null = null;
    for (const pt of mdUHData) {
        if (pt[0] < u) lo = pt;
        else if (pt[0] > u) { hi = pt; break; }
    }
    if (lo && hi) return lo[1] + (u - lo[0]) * (hi[1] - lo[1]) / (hi[0] - lo[0]);
    if (hi) return hi[1];
    if (lo) return lo[1];
    return 0;
};

// Totales por grado
const mdGradeTotals: Record<string, number> = {};
mdSelectedGrades.forEach(grade => {
    const mods = mdTables[grade]?.modules || [];
    mdGradeTotals[grade] = mods.reduce((s: number, mod: any) => {
        const dUD = (mod.details || []).reduce((ds: number, d: any) => ds + mdCalcUD(d), 0);
        const cUD = (mod.children || []).reduce((cs: number, c: any) => {
            const gcUD = (c.details || []).reduce((gs: number, gc: any) => gs + mdCalcUD(gc), 0);
            return cs + mdCalcUD(c) + gcUD;
        }, 0);
        return s + dUD + cUD;
    }, 0);
});

const mdOverallUD  = Object.values(mdGradeTotals).reduce((a, b) => a + b, 0);
const mdExtUD      = mdSelectedGrades.reduce((s, g) => s + (parseFloat(mdExteriores[g]?.uhTotal) || 0), 0);
const mdQmdsIntF   = parseFloat(mdTotals.sistemasInterior?.qmds)  || mdGetFlow(mdOverallUD);
const mdQmdsRiegoF = parseFloat(mdTotals.sistemaRiego?.qmdsRiego) || mdGetFlow(mdExtUD);
const mdQmdsTotalF = parseFloat(mdTotals.qmdsTotal) || mdQmdsIntF + mdQmdsRiegoF;

// Colores de grado
const mdGradeColors: Record<string, { bar: string; mod: string; modText: string; child: string; childText: string }> = {
    inicial:    { bar:'FF1B5E20', mod:'FFE8F5E9', modText:'FF1B5E20', child:'FFC8E6C9', childText:'FF1B5E20' },
    primaria:   { bar:'FF0D47A1', mod:'FFE3F2FD', modText:'FF0D47A1', child:'FFBBDEFB', childText:'FF0D47A1' },
    secundaria: { bar:'FF4A148C', mod:'FFF3E5F5', modText:'FF4A148C', child:'FFE1BEE7', childText:'FF4A148C' },
};
const mdGradeNames: Record<string, string> = {
    inicial:'INICIAL', primaria:'PRIMARIA', secundaria:'SECUNDARIA',
};

// ESCRITURA 
let mr = 1;

// Título principal 
md5TitleBar(mr, '5. CALCULO DE LA MÁXIMA DEMANDA SIMULTÁNEA'); mr++;
md5Sep(mr, 14); mr++;

// ANEXO-02 — APARATOS SANITARIOS
ws5.getRow(mr).height = 25;
for (let c = 2; c <= 6; c++) {
    gc5(mr, c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:'FFD4740A'} };
    gc5(mr, c).border = { top:mdBW, bottom:mdBW,
        left: c===2 ? mdBW : mdBT, right: c===6 ? mdBW : mdBT };
}
ws5.mergeCells(mr, 2, mr, 6);
const cellTitAnx     = gc5(mr, 2);
cellTitAnx.value     = 'ANEXO N° 02';
cellTitAnx.font      = { bold:true, size:10, name:'Arial', color:{argb:'FFFFFFFF'} };
cellTitAnx.alignment = { horizontal:'center', vertical:'middle' };
mr++;
md5Sep(mr, 8); mr++;

const mdAnxCols   = ['Aparato Sanitario', 'Tipo', 'Total', 'AF', 'AC'];
const mdAnxWidths = [22, 55, 10, 10, 10];
ws5.getRow(mr).height = 20;
mdAnxCols.forEach((h, i) => {
    ws5.getColumn(2 + i).width = mdAnxWidths[i];
    const cell = gc5(mr, 2 + i);
    cell.value     = h;
    cell.font      = { bold:true, size:9, name:'Arial', color:{argb:'FFFFFFFF'} };
    cell.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_HEADER} };
    cell.alignment = { horizontal: i<2 ? 'left' : 'center', vertical:'middle' };
    cell.border    = { top:mdBW, left:mdBW, bottom:mdBW, right:mdBW };
});
mr++;

mdAnexo02.forEach((row: any, idx: number) => {
    const bg = idx % 2 === 0 ? MD_BLANC : MD_LYELL;
    ws5.getRow(mr).height = 16;
    [row.aparatoSanitario||'', row.tipo||'',
     parseFloat(row.total)||0,
     row.afmax != null ? parseFloat(row.afmax) : '',
     row.acmax != null ? parseFloat(row.acmax) : '-',
    ].forEach((v, i) => {
        const cell = gc5(mr, 2 + i);
        cell.value     = v;
        cell.font      = { size:9, name:'Arial', bold:i===2, color:{argb: i===2?'FF1F4E78':MD_NEGRO} };
        cell.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:bg} };
        cell.alignment = { horizontal: i<2?'left':'center', vertical:'middle', indent: i===0?1:0 };
        cell.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBT };
        if (i===2 && typeof v==='number') cell.numFmt = '0.0';
    });
    mr++;
});

const mdTotalUD02 = mdAnexo02.reduce((s: number, r: any) => s + (parseFloat(r.total)||0), 0);
ws5.getRow(mr).height = 20;
ws5.mergeCells(mr, 2, mr, 3);
gc5(mr, 2).value     = 'TOTAL UD';
gc5(mr, 2).font      = { bold:true, size:9, name:'Arial' };
gc5(mr, 2).alignment = { horizontal:'right', vertical:'middle' };
for (let c = 2; c <= 3; c++) {
    gc5(mr, c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };
    gc5(mr, c).border = { top:mdBT, bottom:mdBM, left: c===2?mdBM:mdBT, right:mdBT };
}
const mdAx02TotV     = gc5(mr, 4);
mdAx02TotV.value     = mdTotalUD02;
mdAx02TotV.font      = { bold:true, size:10, name:'Arial', color:{argb:'FF1F4E78'} };
mdAx02TotV.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_YELLOW} };
mdAx02TotV.alignment = { horizontal:'center', vertical:'middle' };
mdAx02TotV.border    = { top:mdBT, left:mdBT, bottom:mdBM, right:mdBT };
mdAx02TotV.numFmt    = '0.0';
for (let c = 5; c <= 6; c++) {
    gc5(mr, c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };
    gc5(mr, c).border = { top:mdBT, bottom:mdBM, left:mdBT, right: c===6?mdBM:mdBT };
}
mr++;
md5Sep(mr, 18); mr++;

// TABLAS POR GRADO 
if (mdSelectedGrades.length === 0) {
    md5Fill(mr, MD_LYELL, 30);
    ws5.mergeCells(mr, 2, mr, MD_LAST);
    const noGrade     = gc5(mr, 2);
    noGrade.value     = 'No hay grados educativos seleccionados.';
    noGrade.font      = { bold:true, size:10, name:'Arial', color:{argb:'FF996600'} };
    noGrade.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LYELL} };
    noGrade.alignment = { horizontal:'center', vertical:'middle' };
    mr++;
}

function md5DrawGrade(grade: string) {
    const colors    = mdGradeColors[grade] || mdGradeColors.inicial;
    const modules   = mdTables[grade]?.modules || [];
    const gradeName = mdGradeNames[grade] || grade.toUpperCase();

    // Barra de grado
    md5SubBar(mr, `CÁLCULOS PARA NIVEL ${gradeName}`, colors.bar); mr++;
    md5Sep(mr, 8); mr++;

    //  Fila 0: Título "SUMATORIA DE GASTOS POR ACCESORIOS - NIVEL X" 
    ws5.getRow(mr).height = 18;
    // Descripción vacía (col 2)
    gc5(mr, 2).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };
    gc5(mr, 2).border = { top:mdBT, left:mdBM, bottom:mdBT, right:mdBT };
    // Título sobre todas las columnas de accesorios
    const accEnd = MD_ACC_START + MD_ACC_COLS - 1;
    ws5.mergeCells(mr, MD_ACC_START, mr, accEnd);
    const titAcc     = gc5(mr, MD_ACC_START);
    titAcc.value     = `SUMATORIA DE GASTOS POR ACCESORIOS - ${gradeName}`;
    titAcc.font      = { bold:true, size:9, name:'Arial', color:{argb:MD_NEGRO} };
    titAcc.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };
    titAcc.alignment = { horizontal:'center', vertical:'middle' };
    titAcc.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBT };
    for (let c = MD_ACC_START+1; c <= accEnd; c++) {
        gc5(mr,c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };
    }
    // Col U.H.
    gc5(mr, MD_TOTAL_COL).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };
    gc5(mr, MD_TOTAL_COL).border = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBM };
    mr++;

    // Fila 1: DESCRIPCION 
    ws5.getRow(mr).height = 20;
    // DESCRIPCION 
    ws5.mergeCells(mr, 2, mr+1, 2);
    const hDesc     = gc5(mr, 2);
    hDesc.value     = 'DESCRIPCION';
    hDesc.font      = { bold:true, size:9, name:'Arial', color:{argb:MD_NEGRO} };
    hDesc.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };
    hDesc.alignment = { horizontal:'center', vertical:'middle' };
    hDesc.border    = { top:mdBM, left:mdBM, bottom:mdBM, right:mdBT };

    // Cabecera de cada categoría 
    mdCats.forEach((cat, ci) => {
        const cStart  = MD_ACC_START + ci * 2;
        const catC    = MD_CAT[cat.key] || MD_CAT.default;
        ws5.mergeCells(mr, cStart, mr, cStart+1);
        const hCat    = gc5(mr, cStart);
        hCat.value    = cat.label;
        hCat.font     = { bold:true, size:8, name:'Arial', color:{argb:'FFFFFFFF'} };
        hCat.fill     = { type:'pattern', pattern:'solid', fgColor:{argb:catC.hdr} };
        hCat.alignment= { horizontal:'center', vertical:'middle', wrapText:true };
        hCat.border   = { top:mdBW, left:mdBW, bottom:mdBW, right:mdBW };
        gc5(mr, cStart+1).fill = { type:'pattern', pattern:'solid', fgColor:{argb:catC.hdr} };
        gc5(mr, cStart+1).border = { top:mdBW, bottom:mdBW };
    });

    // U.H. 
    ws5.mergeCells(mr, MD_TOTAL_COL, mr+1, MD_TOTAL_COL);
    const hUH     = gc5(mr, MD_TOTAL_COL);
    hUH.value     = 'U.H.';
    hUH.font      = { bold:true, size:9, name:'Arial', color:{argb:MD_NEGRO} };
    hUH.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };
    hUH.alignment = { horizontal:'center', vertical:'middle' };
    hUH.border    = { top:mdBW, left:mdBW, bottom:mdBW, right:mdBM };
    mr++;

    // Fila 2: 
    ws5.getRow(mr).height = 16;
    // col descripcion ya mergeada
    gc5(mr, 2).fill = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };

    mdCats.forEach((cat, ci) => {
        const cStart = MD_ACC_START + ci * 2;
        const catC   = MD_CAT[cat.key] || MD_CAT.default;
        ['#', 'UH'].forEach((lbl, li) => {
            const cell    = gc5(mr, cStart + li);
            cell.value    = lbl;
            cell.font     = { bold:true, size:8, name:'Arial', color:{argb:'FFFFFFFF'} };
            cell.fill     = { type:'pattern', pattern:'solid', fgColor:{argb:catC.sub} };
            cell.alignment= { horizontal:'center', vertical:'middle' };
            cell.border   = { top:mdBW, left:mdBW, bottom:mdBW, right:mdBW };
        });
    });
    // col U.H. ya mergeada
    gc5(mr, MD_TOTAL_COL).fill = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };
    mr++;

    // Filas de datos 
    if (modules.length === 0) {
        md5Fill(mr, MD_LYELL, 18);
        ws5.mergeCells(mr, 2, mr, MD_LAST);
        const empty     = gc5(mr, 2);
        empty.value     = 'Sin módulos para este grado.';
        empty.font      = { italic:true, size:9, name:'Arial', color:{argb:'FF888888'} };
        empty.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LYELL} };
        empty.alignment = { horizontal:'center', vertical:'middle' };
        mr++;
    }

    modules.forEach((mod: any) => {
        // Calcular total UD del módulo
        const modUD = mdCalcUD(mod) ||
            (mod.details||[]).reduce((s: number, d: any) => s + mdCalcUD(d), 0) +
            (mod.children||[]).reduce((s: number, c: any) =>
                s + mdCalcUD(c) +
                (c.details||[]).reduce((gs: number, gc: any) => gs + mdCalcUD(gc), 0), 0);

        // Fila módulo — nombre fusionado en color del grado 
        ws5.getRow(mr).height = 20;
        // Descripción (col 2) con nombre del módulo
        const modCell     = gc5(mr, 2);
        modCell.value     = mod.name || 'MÓDULO';
        modCell.font      = { bold:true, size:9, name:'Arial', color:{argb:colors.modText} };
        modCell.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:colors.mod} };
        modCell.alignment = { horizontal:'left', vertical:'middle', indent:1 };
        modCell.border    = { top:mdBM, left:mdBM, bottom:mdBM, right:mdBT };

        // Celdas de accesorios: color claro de cada categoría, vacías
        mdCats.forEach((cat, ci) => {
            const cStart = MD_ACC_START + ci * 2;
            const catC   = MD_CAT[cat.key] || MD_CAT.default;
            for (let lc = cStart; lc <= cStart+1; lc++) {
                gc5(mr, lc).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:catC.bg} };
                gc5(mr, lc).border = { top:mdBM, left:mdBT, bottom:mdBM, right:mdBT };
            }
        });
        // Col U.H. módulo
        const modTot     = gc5(mr, MD_TOTAL_COL);
        modTot.value     = parseFloat(modUD.toFixed(0));
        modTot.font      = { bold:true, size:9, name:'Arial', color:{argb:colors.modText} };
        modTot.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_YELLOW} };
        modTot.alignment = { horizontal:'center', vertical:'middle' };
        modTot.border    = { top:mdBM, left:mdBT, bottom:mdBM, right:mdBM };
        modTot.numFmt    = '0';
        mr++;

        // Filas detail del módulo 
        (mod.details||[]).forEach((det: any, di: number) => {
            ws5.getRow(mr).height = 16;
            const detUD = mdCalcUD(det);
            // Descripcion — alternar blanco/azul 
            const detBg = di % 2 === 0 ? MD_BLANC : MD_LBLUE;
            const dDesc = gc5(mr, 2);
            dDesc.value     = det.descripcion || '';
            dDesc.font      = { size:9, name:'Arial', color:{argb:MD_NEGRO} };
            dDesc.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:detBg} };
            dDesc.alignment = { horizontal:'left', vertical:'middle', indent:2 };
            dDesc.border    = { top:mdBT, left:mdBM, bottom:mdBT, right:mdBT };

            mdCats.forEach((cat, ci) => {
                const cStart = MD_ACC_START + ci * 2;
                const catC   = MD_CAT[cat.key] || MD_CAT.default;
                const cant   = parseFloat(det.accessories?.[cat.key]?.cantidad) || 0;
                const uh     = parseFloat(det.accessories?.[cat.key]?.uh) || 0;
                // Cantidad
                const cCant     = gc5(mr, cStart);
                cCant.value     = cant > 0 ? cant : null;
                cCant.font      = { bold:cant>0, size:9, name:'Arial', color:{argb:MD_NEGRO} };
                cCant.fill      = { type:'pattern', pattern:'solid',
                    fgColor:{argb: cant>0 ? MD_YELLOW : catC.bg} };
                cCant.alignment = { horizontal:'center', vertical:'middle' };
                cCant.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBT };
                if (cant>0) cCant.numFmt = '0';
                // UH
                const cUH     = gc5(mr, cStart+1);
                cUH.value     = uh > 0 ? uh : null;
                cUH.font      = { size:9, name:'Arial', color:{argb:MD_NEGRO} };
                cUH.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:catC.bg} };
                cUH.alignment = { horizontal:'center', vertical:'middle' };
                cUH.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBT };
                if (uh>0) cUH.numFmt = '0';
            });
            // Total U.H.
            const dTot     = gc5(mr, MD_TOTAL_COL);
            dTot.value     = detUD > 0 ? parseFloat(detUD.toFixed(0)) : null;
            dTot.font      = { bold:detUD>0, size:9, name:'Arial', color:{argb:'FF1F4E78'} };
            dTot.fill      = { type:'pattern', pattern:'solid', fgColor:{argb: detUD>0?MD_LYELL:detBg} };
            dTot.alignment = { horizontal:'center', vertical:'middle' };
            dTot.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBM };
            if (detUD>0) dTot.numFmt = '0';
            mr++;
        });

        // Children
        (mod.children||[]).forEach((child: any) => {
            const childUD = mdCalcUD(child);

            // Fila child — nombre del sub-nivel 
            ws5.getRow(mr).height = 18;
            const chDesc     = gc5(mr, 2);
            const chLabel    = child.descripcion || child.nivel || '↳ Sub-Nivel';
            chDesc.value     = chLabel;
            chDesc.font      = { bold:true, size:9, name:'Arial', color:{argb:colors.childText} };
            chDesc.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:colors.child} };
            chDesc.alignment = { horizontal:'left', vertical:'middle', indent:2 };
            chDesc.border    = { top:mdBT, left:mdBM, bottom:mdBT, right:mdBT };

            mdCats.forEach((cat, ci) => {
                const cStart = MD_ACC_START + ci * 2;
                const catC   = MD_CAT[cat.key] || MD_CAT.default;
                const cant   = parseFloat(child.accessories?.[cat.key]?.cantidad) || 0;
                const uh     = parseFloat(child.accessories?.[cat.key]?.uh) || 0;
                const cCant     = gc5(mr, cStart);
                cCant.value     = cant > 0 ? cant : null;
                cCant.font      = { bold:cant>0, size:9, name:'Arial', color:{argb:MD_NEGRO} };
                cCant.fill      = { type:'pattern', pattern:'solid',
                    fgColor:{argb: cant>0 ? MD_YELLOW : catC.bgAlt} };
                cCant.alignment = { horizontal:'center', vertical:'middle' };
                cCant.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBT };
                if (cant>0) cCant.numFmt = '0';
                const cUH     = gc5(mr, cStart+1);
                cUH.value     = uh > 0 ? uh : null;
                cUH.font      = { size:9, name:'Arial', color:{argb:MD_NEGRO} };
                cUH.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:catC.bgAlt} };
                cUH.alignment = { horizontal:'center', vertical:'middle' };
                cUH.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBT };
                if (uh>0) cUH.numFmt = '0';
            });
            const chTot     = gc5(mr, MD_TOTAL_COL);
            chTot.value     = childUD > 0 ? parseFloat(childUD.toFixed(0)) : null;
            chTot.font      = { bold:childUD>0, size:9, name:'Arial', color:{argb:'FF1F4E78'} };
            chTot.fill      = { type:'pattern', pattern:'solid',
                fgColor:{argb: childUD>0?MD_LYELL:colors.child} };
            chTot.alignment = { horizontal:'center', vertical:'middle' };
            chTot.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBM };
            if (childUD>0) chTot.numFmt = '0';
            mr++;

            // Grandchildren
            (child.details||[]).forEach((gch: any, gi: number) => {
                const gcBg = gi % 2 === 0 ? MD_BLANC : MD_LYELL;
                const gcUD = mdCalcUD(gch);
                ws5.getRow(mr).height = 16;
                const gcDesc     = gc5(mr, 2);
                gcDesc.value     = gch.descripcion || '';
                gcDesc.font      = { size:9, name:'Arial', color:{argb:MD_NEGRO} };
                gcDesc.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:gcBg} };
                gcDesc.alignment = { horizontal:'left', vertical:'middle', indent:3 };
                gcDesc.border    = { top:mdBT, left:mdBM, bottom:mdBT, right:mdBT };

                mdCats.forEach((cat, ci) => {
                    const cStart = MD_ACC_START + ci * 2;
                    const catC   = MD_CAT[cat.key] || MD_CAT.default;
                    const cant   = parseFloat(gch.accessories?.[cat.key]?.cantidad) || 0;
                    const uh     = parseFloat(gch.accessories?.[cat.key]?.uh) || 0;
                    const cCant     = gc5(mr, cStart);
                    cCant.value     = cant > 0 ? cant : null;
                    cCant.font      = { bold:cant>0, size:9, name:'Arial', color:{argb:MD_NEGRO} };
                    cCant.fill      = { type:'pattern', pattern:'solid',
                        fgColor:{argb: cant>0 ? MD_YELLOW : catC.bg} };
                    cCant.alignment = { horizontal:'center', vertical:'middle' };
                    cCant.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBT };
                    if (cant>0) cCant.numFmt = '0';
                    const cUH     = gc5(mr, cStart+1);
                    cUH.value     = uh > 0 ? uh : null;
                    cUH.font      = { size:9, name:'Arial', color:{argb:MD_NEGRO} };
                    cUH.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:catC.bg} };
                    cUH.alignment = { horizontal:'center', vertical:'middle' };
                    cUH.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBT };
                    if (uh>0) cUH.numFmt = '0';
                });
                const gcTot     = gc5(mr, MD_TOTAL_COL);
                gcTot.value     = gcUD > 0 ? parseFloat(gcUD.toFixed(0)) : null;
                gcTot.font      = { bold:gcUD>0, size:9, name:'Arial', color:{argb:'FF1F4E78'} };
                gcTot.fill      = { type:'pattern', pattern:'solid',
                    fgColor:{argb: gcUD>0?MD_LYELL:gcBg} };
                gcTot.alignment = { horizontal:'center', vertical:'middle' };
                gcTot.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBM };
                if (gcUD>0) gcTot.numFmt = '0';
                mr++;
            });
        });
    });

    // Fila TOTAL U.D. NIVEL 
    const gradeTotal = mdGradeTotals[grade] || 0;
    ws5.getRow(mr).height = 22;
    ws5.mergeCells(mr, 2, mr, MD_TOTAL_COL - 1);
    const grTotLbl     = gc5(mr, 2);
    grTotLbl.value     = `TOTAL U.D. NIVEL ${gradeName}`;
    grTotLbl.font      = { bold:true, size:10, name:'Arial', color:{argb:MD_NEGRO} };
    grTotLbl.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };
    grTotLbl.alignment = { horizontal:'right', vertical:'middle' };
    grTotLbl.border    = { top:mdBM, left:mdBM, bottom:mdBM, right:mdBT };
    for (let c = 3; c <= MD_TOTAL_COL - 1; c++) {
        gc5(mr, c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };
        gc5(mr, c).border = { top:mdBM, bottom:mdBM };
    }
    const grTotVal     = gc5(mr, MD_TOTAL_COL);
    grTotVal.value     = parseFloat(gradeTotal.toFixed(0));
    grTotVal.font      = { bold:true, size:12, name:'Arial', color:{argb:colors.modText} };
    grTotVal.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_YELLOW} };
    grTotVal.alignment = { horizontal:'center', vertical:'middle' };
    grTotVal.border    = { top:mdBM, left:mdBT, bottom:mdBM, right:mdBM };
    grTotVal.numFmt    = '0';
    mr++;
    md5Sep(mr, 18); mr++;
}

mdSelectedGrades.forEach(grade => md5DrawGrade(grade));

// TABLA EXTERIORES — ÁREAS VERDES
ws5.getRow(mr).height = 25;
for (let c = 2; c <= 7; c++) {
    gc5(mr, c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:'FF00695C'} };
    gc5(mr, c).border = { top:mdBM, bottom:mdBM,
        left: c===2?mdBM:mdBT, right: c===7?mdBM:mdBT };
}
ws5.mergeCells(mr, 2, mr, 7);
const cellTit     = gc5(mr, 2);
cellTit.value     = 'CÁLCULOS PARA ZONAS EXTERIORES (ÁREAS VERDES)';
cellTit.font      = { bold:true, size:10, name:'Arial', color:{argb:'FFFFFFFF'} };
cellTit.alignment = { horizontal:'left', vertical:'middle', indent:1 };
mr++;
md5Sep(mr, 8); mr++;

const mdExtHdrs   = ['Exterior / Zona','Área de Riego (m²)','Salidas de Riego','Caudal por Punto (L/s)','U.H. Unitario','U.H. Total'];
const mdExtWidths = [30, 18, 16, 20, 14, 14];
ws5.getRow(mr).height = 20;
mdExtHdrs.forEach((h, i) => {
    ws5.getColumn(2 + i).width = mdExtWidths[i];
    const cell     = gc5(mr, 2 + i);
    cell.value     = h;
    cell.font      = { bold:true, size:8, name:'Arial', color:{argb:'FFFFFFFF'} };
    cell.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_HEADER} };
    cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
    cell.border    = { top:mdBW, left:mdBW, bottom:mdBW, right:mdBW };
});
mr++;

mdSelectedGrades.forEach((grade, idx) => {
    const ext = mdExteriores[grade];
    if (!ext) return;
    const bg = idx % 2 === 0 ? MD_BLANC : MD_TEAL;
    ws5.getRow(mr).height = 18;
    [ext.nombre||'', parseFloat(ext.areaRiego)||0, parseFloat(ext.salidasRiego)||0,
     parseFloat(ext.caudalPorSalida)||0, parseFloat(ext.uh)||0, parseFloat(ext.uhTotal)||0,
    ].forEach((v, i) => {
        const cell     = gc5(mr, 2 + i);
        cell.value     = v;
        cell.font      = { bold:i===5, size:9, name:'Arial',
            color:{argb: i===5?'FF004D40':MD_NEGRO} };
        cell.fill      = { type:'pattern', pattern:'solid',
            fgColor:{argb: i===5?'FFB2DFDB':bg} };
        cell.alignment = { horizontal: i===0?'left':'center', vertical:'middle',
            indent: i===0?1:0 };
        cell.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBT };
        if (typeof v==='number') cell.numFmt = '0.00';
    });
    mr++;
});

ws5.getRow(mr).height = 22;
ws5.mergeCells(mr, 2, mr, 6);
const mdExtTotLbl     = gc5(mr, 2);
mdExtTotLbl.value     = 'TOTAL U.H. EXTERIORES';
mdExtTotLbl.font      = { bold:true, size:10, name:'Arial' };
mdExtTotLbl.alignment = { horizontal:'right', vertical:'middle' };
for (let c = 2; c <= 6; c++) {
    gc5(mr, c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LGRAY} };
    gc5(mr, c).border = { top:mdBM, bottom:mdBM, left: c===2?mdBM:mdBT, right:mdBT };
}
const mdExtTotVal     = gc5(mr, 7);
mdExtTotVal.value     = parseFloat(mdExtUD.toFixed(2));
mdExtTotVal.font      = { bold:true, size:12, name:'Arial', color:{argb:'00695C'} };
mdExtTotVal.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_YELLOW} };
mdExtTotVal.alignment = { horizontal:'center', vertical:'middle' };
mdExtTotVal.border    = { top:mdBM, left:mdBT, bottom:mdBM, right:mdBM };
mdExtTotVal.numFmt    = '0.00';
mr++;
md5Sep(mr, 18); mr++;

// RESUMEN GENERAL DE RESULTADOS
ws5.getRow(mr).height = 25;
for (let c = 2; c <= 6; c++) {
    gc5(mr, c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:MD_BLUE} };
    gc5(mr, c).border = { top:mdBM, bottom:mdBM,
        left: c===2?mdBM:mdBT, right: c===6?mdBM:mdBT };
}
ws5.mergeCells(mr, 2, mr, 6);
const cellResumenTit     = gc5(mr, 2);
cellResumenTit.value     = 'RESUMEN GENERAL DE RESULTADOS — Q MDS';
cellResumenTit.font      = { bold:true, size:10, name:'Arial', color:{argb:'FFFFFFFF'} };
cellResumenTit.alignment = { horizontal:'left', vertical:'middle', indent:1 };
mr++;
md5Sep(mr, 10); mr++;

if (mdSelectedGrades.length > 0) {
    ws5.getRow(mr).height = 20;
    ws5.mergeCells(mr, 2, mr, 5);
    for (let c = 2; c <= 5; c++) {
        gc5(mr, c).value     = c===2 ? 'Nivel Educativo' : null;
        gc5(mr, c).font      = { bold:true, size:9, color:{argb:'FFFFFFFF'} };
        gc5(mr, c).fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_HEADER} };
        gc5(mr, c).alignment = { horizontal:'center', vertical:'middle' };
        gc5(mr, c).border    = { top:mdBW, left:mdBW, bottom:mdBW, right:mdBW };
    }
    const cellHdrTot     = gc5(mr, 6);
    cellHdrTot.value     = 'Total U.D. Interior';
    cellHdrTot.font      = { bold:true, size:9, color:{argb:'FFFFFFFF'} };
    cellHdrTot.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_HEADER} };
    cellHdrTot.alignment = { horizontal:'center', vertical:'middle' };
    cellHdrTot.border    = { top:mdBW, left:mdBW, bottom:mdBW, right:mdBW };
    mr++;

    mdSelectedGrades.forEach((grade, idx) => {
        const bg = idx % 2 === 0 ? MD_BLANC : MD_LBLUE;
        ws5.getRow(mr).height = 18;
        ws5.mergeCells(mr, 2, mr, 5);
        const gc2     = gc5(mr, 2);
        gc2.value     = `NIVEL ${mdGradeNames[grade]}`;
        gc2.font      = { bold:true, size:9, name:'Arial', color:{argb:MD_NEGRO} };
        gc2.alignment = { horizontal:'left', vertical:'middle', indent:2 };
        for (let c = 2; c <= 5; c++) {
            gc5(mr, c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:bg} };
            gc5(mr, c).border = { top:mdBT, bottom:mdBT, left: c===2?mdBM:mdBT, right:mdBT };
        }
        const gv     = gc5(mr, 6);
        gv.value     = parseFloat((mdGradeTotals[grade]||0).toFixed(2));
        gv.font      = { bold:true, size:10, name:'Arial', color:{argb:MD_DGREEN} };
        gv.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_YELLOW} };
        gv.alignment = { horizontal:'center', vertical:'middle' };
        gv.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBM };
        gv.numFmt    = '0.00';
        mr++;
    });
    md5Sep(mr, 10); mr++;
}

// Sistema Interior
ws5.getRow(mr).height = 24;
for (let c = 2; c <= 11; c++) {
    gc5(mr, c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:'FFE8F5E9'} };
    gc5(mr, c).border = { top:mdBT, bottom:mdBT,
        left: c===2?mdBM:mdBT, right: c===11?mdBM:mdBT };
}
ws5.mergeCells(mr, 2, mr, 5);
const mdIntLbl     = gc5(mr, 2);
mdIntLbl.value     = 'SISTEMA INTERIOR';
mdIntLbl.font      = { bold:true, size:10, name:'Arial', color:{argb:'FF1B5E20'} };
mdIntLbl.alignment = { horizontal:'left', vertical:'middle', indent:2 };
ws5.mergeCells(mr, 6, mr, 8);
const mdIntUDLbl     = gc5(mr, 6);
mdIntUDLbl.value     = `Suma U.D. Interior = ${mdOverallUD.toFixed(2)}`;
mdIntUDLbl.font      = { bold:true, size:9, name:'Arial', color:{argb:MD_NEGRO} };
mdIntUDLbl.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LYELL} };
mdIntUDLbl.alignment = { horizontal:'center', vertical:'middle' };
mdIntUDLbl.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBT };
ws5.mergeCells(mr, 9, mr, 11);
const mdQIntVal     = gc5(mr, 9);
mdQIntVal.value     = `Q MDS Interior = ${mdQmdsIntF.toFixed(2)} L/s`;
mdQIntVal.font      = { bold:true, size:10, name:'Arial', color:{argb:MD_NEGRO} };
mdQIntVal.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_YELLOW} };
mdQIntVal.alignment = { horizontal:'center', vertical:'middle' };
mdQIntVal.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBM };
mr++;
md5Sep(mr, 8); mr++;

// Sistema Riego
ws5.getRow(mr).height = 24;
for (let c = 2; c <= 11; c++) {
    gc5(mr, c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:'FFE0F7FA'} };
    gc5(mr, c).border = { top:mdBT, bottom:mdBT,
        left: c===2?mdBM:mdBT, right: c===11?mdBM:mdBT };
}
ws5.mergeCells(mr, 2, mr, 5);
const mdRiegoLbl     = gc5(mr, 2);
mdRiegoLbl.value     = 'SISTEMA RIEGO (EXTERIORES)';
mdRiegoLbl.font      = { bold:true, size:10, name:'Arial', color:{argb:'FF006064'} };
mdRiegoLbl.alignment = { horizontal:'left', vertical:'middle', indent:2 };
ws5.mergeCells(mr, 6, mr, 8);
const mdRiegoUDLbl     = gc5(mr, 6);
mdRiegoUDLbl.value     = `Suma U.D. Exterior = ${mdExtUD.toFixed(2)}`;
mdRiegoUDLbl.font      = { bold:true, size:9, name:'Arial', color:{argb:MD_NEGRO} };
mdRiegoUDLbl.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_LYELL} };
mdRiegoUDLbl.alignment = { horizontal:'center', vertical:'middle' };
mdRiegoUDLbl.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBT };
ws5.mergeCells(mr, 9, mr, 11);
const mdQRiegoVal     = gc5(mr, 9);
mdQRiegoVal.value     = `Q MDS Riego = ${mdQmdsRiegoF.toFixed(2)} L/s`;
mdQRiegoVal.font      = { bold:true, size:10, name:'Arial', color:{argb:MD_NEGRO} };
mdQRiegoVal.fill      = { type:'pattern', pattern:'solid', fgColor:{argb:MD_YELLOW} };
mdQRiegoVal.alignment = { horizontal:'center', vertical:'middle' };
mdQRiegoVal.border    = { top:mdBT, left:mdBT, bottom:mdBT, right:mdBM };
mr++;
md5Sep(mr, 12); mr++;

// Gran Total
ws5.getRow(mr).height = 32;
ws5.mergeCells(mr, 2, mr, 8);
for (let c = 2; c <= 8; c++) {
    gc5(mr, c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:MD_BLUE} };
    gc5(mr, c).border = { top:mdBM, bottom:mdBM, left: c===2?mdBM:mdBT, right:mdBT };
}
const mdGrandLbl     = gc5(mr, 2);
mdGrandLbl.value     = 'CAUDAL DE LA MÁXIMA DEMANDA SIMULTÁNEA TOTAL (Q MDS)';
mdGrandLbl.font      = { bold:true, size:11, name:'Arial', color:{argb:'FFFFFFFF'} };
mdGrandLbl.alignment = { horizontal:'right', vertical:'middle' };
ws5.mergeCells(mr, 9, mr, 11);
for (let c = 9; c <= 11; c++) {
    gc5(mr, c).fill   = { type:'pattern', pattern:'solid', fgColor:{argb:MD_YELLOW} };
    gc5(mr, c).border = { top:mdBM, bottom:mdBM, left:mdBT, right: c===11?mdBM:mdBT };
}
const mdGrandVal     = gc5(mr, 9);
mdGrandVal.value     = `${mdQmdsTotalF.toFixed(2)} L/s`;
mdGrandVal.font      = { bold:true, size:16, name:'Arial', color:{argb:MD_NEGRO} };
mdGrandVal.alignment = { horizontal:'center', vertical:'middle' };
mr++;
md5Sep(mr, 16); mr++;
//----------------------------------------------------------------------------------------------------------------------------------------------------------------
    
// HOJA 6: CALCULO DEL SISTEMA DE BOMBEO AL TANQUE ELEVADO
const ws6 = workbook.addWorksheet('6. Bombeo');

const B6_BLANC  = 'FFFFFFFF';
const B6_NEGRO  = 'FF000000';
const B6_GRAY1  = 'FF4F4F4F'; 
const B6_GRAY2  = 'FF6D6D6D'; 
const B6_GRAY3  = 'FFD9D9D9';
const B6_GRAY4  = 'FFF2F2F2'; 
const B6_TABHDR = 'FF808080';
const B6_YELLOW = 'FFFFC000'; 
const B6_LYELL  = 'FFFFF2CC'; 
const B6_ROWALL = 'FFF7F7F7'; 

const b6BT = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFB0B0B0' } };
const b6BM = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FF888888' } };
const b6BW = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFFFFFFF' } };
const b6BD = { style: 'dotted' as ExcelJS.BorderStyle, color: { argb: 'FFCCCCCC' } };

const b6D = dataSheet.bombeoTanqueElevado || {};

const b6VolTE         = parseFloat(b6D.volumenTE)                || 13682;
const b6TiempoLlenado = parseFloat(b6D.tiempoLlenadobomb)        || 2;
const b6QMDS          = parseFloat(b6D.QMDS)                     || 0;
const b6LongSuc       = parseFloat(b6D.longitudTuberiaSuccion)   || 4.25;
const b6LongImp       = parseFloat(b6D.longitudTuberiaImpulsion) || 16.95;
const b6NivFondoTanq  = parseFloat(b6D.nivelFondoTanque)         || 13.85;
const b6NivAguaTanq   = parseFloat(b6D.nivelAguaTanque)          || 15.75;
const b6NivFondoCist  = parseFloat(b6D.nivelFondoCisterna)       || -1.95;
const b6PresionSalida = parseFloat(b6D.presionSalida)            || 2.00;
const b6Eficiencia    = parseFloat(b6D.eficiencia)               || 0.6;
const b6PotManual     = b6D.potenciaManual != null
    ? parseFloat(b6D.potenciaManual) : null;

const b6AccSuc: any[] = Array.isArray(b6D.accesoriosSuccion) ? b6D.accesoriosSuccion : [
    { tipo: 'codo45',       cantidad: 0, leq: 0.477 },
    { tipo: 'codo90',       cantidad: 0, leq: 1.203 },
    { tipo: 'codo90',       cantidad: 1, leq: 2.577 },
    { tipo: 'valCompuerta', cantidad: 1, leq: 0.544 },
    { tipo: 'canastilla',   cantidad: 1, leq: 1.52  },
    { tipo: 'reduc2',       cantidad: 0, leq: 2.634 },
];
const b6AccImp: any[] = Array.isArray(b6D.accesoriosImpulsion) ? b6D.accesoriosImpulsion : [
    { tipo: 'codo45',       cantidad: 0, leq: 0.954 },
    { tipo: 'codo90',       cantidad: 2, leq: 2.045 },
    { tipo: 'tee',          cantidad: 2, leq: 4.091 },
    { tipo: 'valCompuerta', cantidad: 2, leq: 0.432 },
    { tipo: 'valCheck',     cantidad: 0, leq: 5.682 },
    { tipo: 'reduc2',       cantidad: 0, leq: 2.091 },
];

const b6AccLabels: Record<string, string> = {
    codo45:       'Codo de 45°',
    codo90:       'Codo 90°',
    tee:          'Tee',
    valCompuerta: 'Val. Compuerta',
    valCheck:     'Val. Chec.',
    canastilla:   'Canastilla',
    reduccion1:   'Reducción 1(D≠d)',
    reduc2:       'Reducción 2(D≠d)',
    reduccion2:   'Reducción 2(D≠d)',
};

const b6DiamSucTabla: Record<string, string> = {
    '0.00':'1 pulg','0.50':'1 1/4 pulg','1.00':'1 1/2 pulg',
    '1.60':'2 pulg','3.00':'2 1/2 pulg','5.00':'3 pulg',
    '8.00':'4 pulg','15.0':'6 pulg','25.0':'8 pulg',
};
const b6DiamImpTabla: Record<string, string> = {
    '0.00':'3/4 pulg','0.50':'1 pulg','1.00':'1 1/4 pulg',
    '1.60':'1 1/2 pulg','3.00':'2 pulg','5.00':'2 1/2 pulg',
    '8.00':'3 pulg','15.0':'4 pulg','25.0':'6 pulg',
};
const b6DiamMM: Record<string, number> = {
    '1/2 pulg':0.5,'3/4 pulg':0.75,'1 pulg':1,'1 1/4 pulg':1.25,
    '1 1/2 pulg':1.5,'2 pulg':2,'2 1/2 pulg':2.5,'3 pulg':3,
    '4 pulg':4,'6 pulg':6,'8 pulg':8,
};

function b6GetDiam(q: number, tabla: Record<string,string>): string {
    let best = ''; let minDif = Infinity;
    for (const k in tabla) {
        const d = Math.abs(parseFloat(k) - q);
        if (d < minDif) { minDif = d; best = k; }
    }
    return tabla[best] || Object.values(tabla)[0];
}
function b6Vel(q: number, diam: string): number {
    const mm = b6DiamMM[diam]; if (!mm) return 0;
    const dm = mm * 2.54 / 100;
    return parseFloat(((q/1000) / (Math.PI * dm * dm / 4)).toFixed(2));
}
function b6Pend(q: number, diam: string): number {
    const mm = b6DiamMM[diam]; if (!mm) return 0;
    const dm = mm * 2.54 / 100;
    const den = 0.2785 * 140 * Math.pow(dm, 2.63);
    if (den === 0) return 0;
    return parseFloat(Math.pow((q/1000) / den, 1.85).toFixed(4));
}
function b6CeilHalf(v: number): number { return Math.ceil(v * 2) / 2; }

// Cálculos 
const b6QLlen   = (b6TiempoLlenado > 0 && b6VolTE > 0)
    ? parseFloat((b6VolTE / (b6TiempoLlenado * 3600)).toFixed(2)) : 0;
const b6Qimp    = parseFloat(Math.max(b6QLlen, b6QMDS).toFixed(2));

const b6DiamSuc = b6GetDiam(b6Qimp, b6DiamSucTabla);
const b6VelSuc  = b6Vel(b6Qimp, b6DiamSuc);
const b6LeqSuc  = parseFloat(b6AccSuc.reduce((s,a) => s + a.cantidad * a.leq, 0).toFixed(3));
const b6LTotSuc = parseFloat((b6LeqSuc + b6LongSuc).toFixed(2));
const b6SSuc    = b6Pend(b6Qimp, b6DiamSuc);
const b6HfSuc   = parseFloat((b6LTotSuc * b6SSuc).toFixed(2));

const b6DiamImp = b6GetDiam(b6Qimp, b6DiamImpTabla);
const b6VelImp  = b6Vel(b6Qimp, b6DiamImp);
const b6LeqImp  = parseFloat(b6AccImp.reduce((s,a) => s + a.cantidad * a.leq, 0).toFixed(3));
const b6LTotImp = parseFloat((b6LeqImp + b6LongImp).toFixed(2));
const b6SImp    = b6Pend(b6Qimp, b6DiamImp);
const b6HfImp   = parseFloat((b6LTotImp * b6SImp).toFixed(2));

const b6HDT    = parseFloat(
    Math.max(b6HfImp + b6HfSuc + b6PresionSalida + (b6NivAguaTanq - b6NivFondoCist), 0).toFixed(2)
);
const b6HDTInt = Math.ceil(b6HDT);
const b6Pot    = b6Eficiencia > 0 ? (b6Qimp * b6HDT) / (75 * b6Eficiencia) : 0;
const b6PotRed = b6CeilHalf(b6Pot);
const b6PotFin: number = (b6PotManual !== null && !isNaN(b6PotManual as number))
    ? (b6PotManual as number) : b6PotRed;

ws6.columns = [
    { width: 2  },  
    { width: 12 }, 
    { width: 16 }, 
    { width: 10 },  
    { width: 24 }, 
    { width: 9  },  
    { width: 10 },  
    { width: 10 }, 
    { width: 12 }, 
    { width: 12 }, 
    { width: 12 }, 
    { width: 12 },  
];

const _C1 = 2;
const _CN = 12;

const _gc = (r: number, c: number) => ws6.getCell(r, c);

function _fill(r: number, bg: string, h = 18) {
    ws6.getRow(r).height = h;
    _gc(r, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_BLANC } };
    for (let c = _C1; c <= _CN; c++)
        _gc(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
}

function _sep(r: number, h = 10) {
    ws6.getRow(r).height = h;
    for (let c = 1; c <= _CN; c++)
        _gc(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_BLANC } };
}

// Barra de título 
function _titleBar(r: number, text: string) {
    _fill(r, B6_GRAY1, 26);
    ws6.mergeCells(r, _C1, r, _CN);
    const cell = _gc(r, _C1);
    cell.value = text;
    cell.font  = { bold: true, size: 11, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY1 } };
    cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    cell.border = { top: b6BM, left: b6BM, bottom: b6BM, right: b6BM };
}

// Barra de sub-sección 
function _secBar(r: number, text: string) {
    _fill(r, B6_GRAY2, 22);
    ws6.mergeCells(r, _C1, r, _CN);
    const cell = _gc(r, _C1);
    cell.value = text;
    cell.font  = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY2 } };
    cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    cell.border = { top: b6BT, left: b6BM, bottom: b6BT, right: b6BM };
}

function _paramRow(r: number, label: string, val: string,
    bgRow = B6_BLANC, bgVal = B6_BLANC, bold = false, h = 20) {
    _fill(r, bgRow, h);
    ws6.mergeCells(r, _C1, r, 8);
    const lc = _gc(r, _C1);
    lc.value = label;
    lc.font  = { bold, size: 10, name: 'Arial', color: { argb: B6_GRAY1 } };
    lc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgRow } };
    lc.alignment = { horizontal: 'left', vertical: 'middle', indent: 3 };
    lc.border = { top: b6BT, left: b6BM, bottom: b6BT, right: b6BD };
    for (let c = _C1 + 1; c <= 8; c++) {
        _gc(r, c).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgRow } };
        _gc(r, c).border = { top: b6BT, bottom: b6BT };
    }
    ws6.mergeCells(r, 9, r, _CN);
    const vc = _gc(r, 9);
    vc.value = val;
    vc.font  = { bold, size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
    vc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgVal } };
    vc.alignment = { horizontal: 'right', vertical: 'middle', indent: 2 };
    vc.border = { top: b6BT, left: b6BD, bottom: b6BT, right: b6BM };
    for (let c = 10; c <= _CN; c++) {
        _gc(r, c).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgVal } };
        _gc(r, c).border = { top: b6BT, bottom: b6BT,
            right: c === _CN ? b6BM : b6BT };
    }
}

// Tabla de pérdida de carga 
function _buildAccTable(
    startRow: number, accesorios: any[],
    qImpul: number, diam: string, vel: number,
    lTub: number, lTot: number, leqTot: number,
    S: number, hf: number,
): number {
    let r = startRow;
    const N = accesorios.length;

    ws6.getRow(r).height = 22;
    _fill(r, B6_TABHDR, 22);

    const h1: { label: string; c: number; span: number; rs: boolean }[] = [
        { label: 'Q\n(L/s)',       c: 2,  span: 1, rs: true  },
        { label: 'diámetro',       c: 3,  span: 1, rs: true  },
        { label: 'V\n(m/s)',       c: 4,  span: 1, rs: true  },
        { label: 'L accesorios',   c: 5,  span: 4, rs: false },
        { label: 'L tubería\n(m)', c: 9,  span: 1, rs: true  },
        { label: 'L total\n(m)',   c: 10, span: 1, rs: true  },
        { label: 'S\n(m/m)',       c: 11, span: 1, rs: true  },
        { label: 'hf\n(m)',        c: 12, span: 1, rs: true  },
    ];
    h1.forEach(h => {
        if (h.rs) ws6.mergeCells(r, h.c, r + 1, h.c);
        else      ws6.mergeCells(r, h.c, r, h.c + h.span - 1);
        const cell = _gc(r, h.c);
        cell.value = h.label;
        cell.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_TABHDR } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: b6BW, left: b6BW, bottom: b6BW, right: b6BW };
        for (let ci = h.c + 1; ci < h.c + h.span; ci++)
            _gc(r, ci).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_TABHDR } };
    });
    r++;

    ws6.getRow(r).height = 18;
    _fill(r, B6_TABHDR, 18);
    ['accesorios', '#', 'Leq', 'Leq. T'].forEach((h, i) => {
        const cell = _gc(r, 5 + i);
        cell.value = h;
        cell.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_TABHDR } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: b6BW, left: b6BW, bottom: b6BW, right: b6BW };
    });
    [2, 3, 4, 9, 10, 11, 12].forEach(c =>
        _gc(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_TABHDR } });
    r++;

    // Filas de accesorios
    accesorios.forEach((acc: any, idx: number) => {
        const bg   = idx % 2 === 0 ? B6_BLANC : B6_ROWALL;
        const leqT = parseFloat((acc.cantidad * acc.leq).toFixed(3));
        const lbl  = b6AccLabels[acc.tipo] || acc.tipo || '-';
        ws6.getRow(r).height = 20;
        _fill(r, bg, 20);

        if (idx === 0) {
            ws6.mergeCells(r, 2, r + N - 1, 2);
            const c2 = _gc(r, 2);
            c2.value = parseFloat(qImpul.toFixed(2));
            c2.numFmt = '0.00 "L/s"';
            c2.font  = { bold: true, size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
            c2.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_BLANC } };
            c2.alignment = { horizontal: 'center', vertical: 'middle' };
            c2.border = { top: b6BT, left: b6BM, bottom: b6BT, right: b6BT };
        }

        if (idx === 0) {
            ws6.mergeCells(r, 3, r + N - 1, 3);
            const c3 = _gc(r, 3);
            c3.value = diam;
            c3.font  = { size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
            c3.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_BLANC } };
            c3.alignment = { horizontal: 'center', vertical: 'middle' };
            c3.border = { top: b6BT, left: b6BT, bottom: b6BT, right: b6BT };
        }

        if (idx === 0) {
            ws6.mergeCells(r, 4, r + N - 1, 4);
            const c4 = _gc(r, 4);
            c4.value = vel;
            c4.numFmt = '0.00';
            c4.font  = { size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
            c4.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_BLANC } };
            c4.alignment = { horizontal: 'center', vertical: 'middle' };
            c4.border = { top: b6BT, left: b6BT, bottom: b6BT, right: b6BT };
        }
        // Accesorio nombre
        const c5 = _gc(r, 5);
        c5.value = lbl;
        c5.font  = { size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
        c5.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        c5.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        c5.border = { top: b6BT, left: b6BT, bottom: b6BT, right: b6BT };
        // Cantidad
        const c6 = _gc(r, 6);
        c6.value = acc.cantidad > 0 ? acc.cantidad : null;
        c6.numFmt = '0';
        c6.font  = { bold: acc.cantidad > 0, size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
        c6.fill  = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: acc.cantidad > 0 ? B6_YELLOW : bg } };
        c6.alignment = { horizontal: 'center', vertical: 'middle' };
        c6.border = { top: b6BT, left: b6BT, bottom: b6BT, right: b6BT };

        const c7 = _gc(r, 7);
        c7.value = parseFloat(acc.leq.toFixed(3));
        c7.numFmt = '0.000';
        c7.font  = { size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
        c7.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        c7.alignment = { horizontal: 'center', vertical: 'middle' };
        c7.border = { top: b6BT, left: b6BT, bottom: b6BT, right: b6BT };

        const c8 = _gc(r, 8);
        c8.value = leqT > 0 ? leqT : null;
        c8.numFmt = '0.000';
        c8.font  = { bold: leqT > 0, size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
        c8.fill  = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: leqT > 0 ? B6_LYELL : bg } };
        c8.alignment = { horizontal: 'center', vertical: 'middle' };
        c8.border = { top: b6BT, left: b6BT, bottom: b6BT, right: b6BT };

        if (idx === 0) {
            ws6.mergeCells(r, 9, r + N - 1, 9);
            const c9 = _gc(r, 9);
            c9.value = lTub;
            c9.numFmt = '0.00 "m"';
            c9.font  = { bold: true, size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
            c9.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_YELLOW } };
            c9.alignment = { horizontal: 'center', vertical: 'middle' };
            c9.border = { top: b6BT, left: b6BT, bottom: b6BT, right: b6BT };
        }

        if (idx === 0) {
            ws6.mergeCells(r, 10, r + N - 1, 10);
            const c10 = _gc(r, 10);
            c10.value = lTot;
            c10.numFmt = '0.00 "m"';
            c10.font  = { bold: true, size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
            c10.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY3 } };
            c10.alignment = { horizontal: 'center', vertical: 'middle' };
            c10.border = { top: b6BT, left: b6BT, bottom: b6BT, right: b6BT };
        }

        if (idx === 0) {
            ws6.mergeCells(r, 11, r + N - 1, 11);
            const c11 = _gc(r, 11);
            c11.value = S;
            c11.numFmt = '0.0000';
            c11.font  = { size: 9, name: 'Arial', color: { argb: B6_GRAY2 } };
            c11.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_BLANC } };
            c11.alignment = { horizontal: 'center', vertical: 'middle' };
            c11.border = { top: b6BT, left: b6BT, bottom: b6BT, right: b6BT };
        }

        if (idx === 0) {
            ws6.mergeCells(r, 12, r + N - 1, 12);
            const c12 = _gc(r, 12);
            c12.value = hf;
            c12.numFmt = '0.0000';
            c12.font  = { bold: true, size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
            c12.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_BLANC } };
            c12.alignment = { horizontal: 'center', vertical: 'middle' };
            c12.border = { top: b6BT, left: b6BT, bottom: b6BT, right: b6BM };
        }
        r++;
    });

    // LONGITUD TOTAL EQUIVALENTES
    ws6.getRow(r).height = 20;
    _fill(r, B6_GRAY3, 20);
    ws6.mergeCells(r, _C1, r, 8);
    const leqL = _gc(r, _C1);
    leqL.value = 'LONGITUD TOTAL EQUIVALENTES';
    leqL.font  = { bold: true, size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
    leqL.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY3 } };
    leqL.alignment = { horizontal: 'right', vertical: 'middle' };
    leqL.border = { top: b6BT, left: b6BM, bottom: b6BM, right: b6BT };
    for (let c = _C1 + 1; c <= 8; c++) {
        _gc(r, c).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY3 } };
        _gc(r, c).border = { top: b6BT, bottom: b6BM };
    }
    const leqV = _gc(r, 9);
    leqV.value = parseFloat(leqTot.toFixed(2));
    leqV.numFmt = '0.00 "m"';
    leqV.font  = { bold: true, size: 11, name: 'Arial', color: { argb: B6_NEGRO } };
    leqV.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_YELLOW } };
    leqV.alignment = { horizontal: 'center', vertical: 'middle' };
    leqV.border = { top: b6BT, left: b6BM, bottom: b6BM, right: b6BT };
    for (let c = 10; c <= _CN; c++) {
        _gc(r, c).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY3 } };
        _gc(r, c).border = { top: b6BT, bottom: b6BM,
            right: c === _CN ? b6BM : b6BT };
    }
    r++;
    return r;
}

let br = 1;

// Título principal
_titleBar(br, '6. CALCULO DEL SISTEMA DE BOMBEO AL TANQUE ELEVADO'); br++;
_sep(br, 10); br++;

// 6.1 CAUDAL DE IMPULSIÓN
_secBar(br, '6.1. CAUDAL DE IMPULSION'); br++;

_fill(br, B6_GRAY4, 34);
ws6.mergeCells(br, _C1, br, _CN);
const notaImp = _gc(br, _C1);
notaImp.value =
    'En el inciso d) del ITEM 2.5. ELEVACION, el caudal de bombeo debe ser equivalente a la máxima ' +
    'demanda simultánea y en ningún caso inferior a la necesaria para llenar el tanque elevado en dos horas.';
notaImp.font  = { italic: true, size: 9, name: 'Arial', color: { argb: B6_GRAY2 } };
notaImp.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY4 } };
notaImp.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 2 };
notaImp.border = { top: b6BT, left: b6BM, bottom: b6BT, right: b6BM };
br++;
_sep(br, 10); br++;

_paramRow(br, 'Volumen del Tanque Elevado  =',  `${b6VolTE.toFixed(2)} L`,   B6_BLANC, B6_BLANC); br++;
_paramRow(br, 'Tiempo de llenado del Tanque Elevado  =', `${b6TiempoLlenado} hrs`,
    B6_BLANC, B6_YELLOW, true); br++;
_sep(br, 8); br++;
_paramRow(br, 'Q llenado  =',  `${b6QLlen.toFixed(2)} L/s`, B6_BLANC, B6_BLANC); br++;
_paramRow(br, 'Q MDS  =',      `${b6QMDS.toFixed(2)} L/s`,  B6_BLANC, B6_BLANC); br++;
_sep(br, 6); br++;

_fill(br, B6_YELLOW, 26);
ws6.mergeCells(br, _C1, br, 8);
const qImpLbl = _gc(br, _C1);
qImpLbl.value = 'Q impul  =';
qImpLbl.font  = { bold: true, size: 11, name: 'Arial', color: { argb: B6_NEGRO } };
qImpLbl.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_YELLOW } };
qImpLbl.alignment = { horizontal: 'right', vertical: 'middle' };
qImpLbl.border = { top: b6BM, left: b6BM, bottom: b6BM, right: b6BT };
for (let c = _C1 + 1; c <= 8; c++) {
    _gc(br, c).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_YELLOW } };
    _gc(br, c).border = { top: b6BM, bottom: b6BM };
}
ws6.mergeCells(br, 9, br, _CN);
const qImpVal = _gc(br, 9);
qImpVal.value = `${b6Qimp.toFixed(2)} L/s`;
qImpVal.font  = { bold: true, size: 13, name: 'Arial', color: { argb: B6_NEGRO } };
qImpVal.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_YELLOW } };
qImpVal.alignment = { horizontal: 'center', vertical: 'middle' };
qImpVal.border = { top: b6BM, left: b6BT, bottom: b6BM, right: b6BM };
for (let c = 10; c <= _CN; c++) {
    _gc(br, c).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_YELLOW } };
    _gc(br, c).border = { top: b6BM, bottom: b6BM, right: c === _CN ? b6BM : b6BT };
}
br++;
_sep(br, 14); br++;

// 6.2 PÉRDIDA DE CARGA
_secBar(br, '6.2. PERDIDA DE CARGA'); br++;
_sep(br, 8); br++;

// Diámetro tubería Succión
_fill(br, B6_GRAY4, 20);
ws6.mergeCells(br, _C1, br, 6);
const dSucLbl = _gc(br, _C1);
dSucLbl.value = 'Diametro tub. Succión';
dSucLbl.font  = { size: 10, name: 'Arial', color: { argb: B6_GRAY1 } };
dSucLbl.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY4 } };
dSucLbl.alignment = { horizontal: 'left', vertical: 'middle', indent: 2 };
dSucLbl.border = { top: b6BT, left: b6BM, bottom: b6BT, right: b6BD };
for (let c = _C1 + 1; c <= 6; c++) {
    _gc(br, c).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY4 } };
    _gc(br, c).border = { top: b6BT, bottom: b6BT };
}
_gc(br, 7).value = 'Ø =';
_gc(br, 7).font  = { bold: true, size: 10, name: 'Arial', color: { argb: B6_GRAY1 } };
_gc(br, 7).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY4 } };
_gc(br, 7).alignment = { horizontal: 'right', vertical: 'middle' };
_gc(br, 7).border = { top: b6BT, bottom: b6BT };
ws6.mergeCells(br, 8, br, _CN);
const dSucVal = _gc(br, 8);
dSucVal.value = b6DiamSuc;
dSucVal.font  = { bold: true, size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
dSucVal.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY4 } };
dSucVal.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
dSucVal.border = { top: b6BT, left: b6BD, bottom: b6BT, right: b6BM };
br++;
_sep(br, 4); br++;

br = _buildAccTable(br, b6AccSuc,
    b6Qimp, b6DiamSuc, b6VelSuc,
    b6LongSuc, b6LTotSuc, b6LeqSuc, b6SSuc, b6HfSuc);
_sep(br, 12); br++;

// Diámetro tubería Impulsión
_fill(br, B6_GRAY4, 20);
ws6.mergeCells(br, _C1, br, 6);
const dImpLbl = _gc(br, _C1);
dImpLbl.value = 'Diametro tub. Impulsión';
dImpLbl.font  = { size: 10, name: 'Arial', color: { argb: B6_GRAY1 } };
dImpLbl.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY4 } };
dImpLbl.alignment = { horizontal: 'left', vertical: 'middle', indent: 2 };
dImpLbl.border = { top: b6BT, left: b6BM, bottom: b6BT, right: b6BD };
for (let c = _C1 + 1; c <= 6; c++) {
    _gc(br, c).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY4 } };
    _gc(br, c).border = { top: b6BT, bottom: b6BT };
}
_gc(br, 7).value = 'Ø =';
_gc(br, 7).font  = { bold: true, size: 10, name: 'Arial', color: { argb: B6_GRAY1 } };
_gc(br, 7).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY4 } };
_gc(br, 7).alignment = { horizontal: 'right', vertical: 'middle' };
_gc(br, 7).border = { top: b6BT, bottom: b6BT };
ws6.mergeCells(br, 8, br, _CN);
const dImpVal = _gc(br, 8);
dImpVal.value = b6DiamImp;
dImpVal.font  = { bold: true, size: 10, name: 'Arial', color: { argb: B6_NEGRO } };
dImpVal.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY4 } };
dImpVal.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
dImpVal.border = { top: b6BT, left: b6BD, bottom: b6BT, right: b6BM };
br++;
_sep(br, 4); br++;

br = _buildAccTable(br, b6AccImp,
    b6Qimp, b6DiamImp, b6VelImp,
    b6LongImp, b6LTotImp, b6LeqImp, b6SImp, b6HfImp);
_sep(br, 16); br++;

// 6.3 ALTURA DINÁMICA TOTAL — HDT
_secBar(br, '6.3. ALTURA DINAMICA TOTAL - HDT'); br++;
_sep(br, 8); br++;

[
    { label: 'Nivel de Fondo del Tanque Elevado  =',  val: `+${b6NivFondoTanq.toFixed(2)} m` },
    { label: 'Nivel de Agua del Tanque Elevado  =',   val: `+${b6NivAguaTanq.toFixed(2)} m`  },
    { label: 'Nivel de Fondo de Cisterna  =',          val: `${b6NivFondoCist.toFixed(2)} m`  },
    { label: 'Presion de Salida  =',                   val: `${b6PresionSalida.toFixed(2)} m` },
    { label: 'Perdida de carga Tub. Succion  =',       val: `${b6HfSuc.toFixed(2)} m`         },
    { label: 'Perdida de carga Tub. Impulsion  =',     val: `${b6HfImp.toFixed(2)} m`         },
].forEach((p, i) => {
    _paramRow(br, p.label, p.val, i % 2 === 0 ? B6_BLANC : B6_ROWALL);
    br++;
});
_sep(br, 10); br++;

_fill(br, B6_YELLOW, 28);
ws6.mergeCells(br, _C1, br, _CN);
const hdtCell = _gc(br, _C1);
hdtCell.value = `HDT  =  ${b6HDTInt.toFixed(2)}`;
hdtCell.font  = { bold: true, size: 14, name: 'Arial', color: { argb: B6_NEGRO } };
hdtCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_YELLOW } };
hdtCell.alignment = { horizontal: 'center', vertical: 'middle' };
hdtCell.border = { top: b6BM, left: b6BM, bottom: b6BM, right: b6BM };
br++;
_sep(br, 16); br++;

// 6.4 CÁLCULO DEL SISTEMA DE BOMBEO
_secBar(br, '6.4. CALCULO DEL SISTEMA DE BOMBEO'); br++;
_sep(br, 8); br++;

_paramRow(br, 'Caudal de Impulsion  =',  `${b6Qimp.toFixed(2)} L/s`,  B6_BLANC, B6_YELLOW, true); br++;
_paramRow(br, 'Altura Dinamica Total  =', `${b6HDTInt.toFixed(2)} m`,  B6_BLANC, B6_YELLOW, true); br++;
_paramRow(br, 'Eficiencia  =',            `${(b6Eficiencia*100).toFixed(0)} %`,
    B6_BLANC, B6_YELLOW, true); br++;
_sep(br, 10); br++;

// Fórmula potencia 
_fill(br, B6_GRAY4, 20);
ws6.mergeCells(br, _C1, br, _CN);
const fn1 = _gc(br, _C1);
fn1.value = `POTENCIA  :        ${b6Qimp.toFixed(2)} L/s  ×  ${b6HDTInt.toFixed(2)} m`;
fn1.font  = { italic: true, size: 10, name: 'Arial', color: { argb: B6_GRAY2 } };
fn1.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY4 } };
fn1.alignment = { horizontal: 'center', vertical: 'middle' };
fn1.border = { top: b6BT, left: b6BM, bottom: b6BD, right: b6BM };
br++;

_fill(br, B6_GRAY4, 20);
ws6.mergeCells(br, _C1, br, _CN);
const fn2 = _gc(br, _C1);
fn2.value = `75  ×  ${b6Eficiencia}`;
fn2.font  = { italic: true, size: 10, name: 'Arial', color: { argb: B6_GRAY2 } };
fn2.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY4 } };
fn2.alignment = { horizontal: 'center', vertical: 'middle' };
fn2.border = { top: b6BD, left: b6BM, bottom: b6BT, right: b6BM };
br++;
_sep(br, 8); br++;

// POTENCIA 
_fill(br, B6_YELLOW, 28);
ws6.mergeCells(br, _C1, br, 7);
const potLbl = _gc(br, _C1);
potLbl.value = `POTENCIA (POT)  =  ${b6Pot.toFixed(2)}   →`;
potLbl.font  = { bold: true, size: 11, name: 'Arial', color: { argb: B6_NEGRO } };
potLbl.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_YELLOW } };
potLbl.alignment = { horizontal: 'right', vertical: 'middle' };
potLbl.border = { top: b6BM, left: b6BM, bottom: b6BM, right: b6BT };
for (let c = _C1 + 1; c <= 7; c++) {
    _gc(br, c).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_YELLOW } };
    _gc(br, c).border = { top: b6BM, bottom: b6BM };
}
ws6.mergeCells(br, 8, br, _CN);
const potVal = _gc(br, 8);
potVal.value = `${b6PotFin}  HP`;
potVal.font  = { bold: true, size: 14, name: 'Arial', color: { argb: B6_NEGRO } };
potVal.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_YELLOW } };
potVal.alignment = { horizontal: 'center', vertical: 'middle' };
potVal.border = { top: b6BM, left: b6BT, bottom: b6BM, right: b6BM };
for (let c = 9; c <= _CN; c++) {
    _gc(br, c).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_YELLOW } };
    _gc(br, c).border = { top: b6BM, bottom: b6BM, right: c === _CN ? b6BM : b6BT };
}
br++;
_sep(br, 12); br++;

// Nota final
_fill(br, B6_GRAY4, 40);
ws6.getRow(br).height = 40;
ws6.mergeCells(br, _C1, br, _CN);
const notaFin = _gc(br, _C1);
notaFin.value =
    `De acuerdo a la existencia en el mercado con los diámetros más similares a la de succión ` +
    `(${b6DiamSuc}) e impulsión (${b6DiamImp}) requeridos, se asume la potencia de la bomba es de  ${b6PotFin} HP.`;
notaFin.font  = { size: 10, name: 'Arial', color: { argb: B6_GRAY1 } };
notaFin.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: B6_GRAY4 } };
notaFin.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 2 };
notaFin.border = {
    top:    b6BT,
    left:   { style: 'medium', color: { argb: 'FF888888' } },
    bottom: b6BT,
    right:  b6BM,
};
br++;
_sep(br, 14); br++;
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

    // HOJA 7: TUBERÍAS DE RED DE DISTRIBUCIÓN (RD)
    const ws7 = workbook.addWorksheet('7. Tuberías RD');

    ws7.columns = [
        { width: 3  }, // 1  spacer
        { width: 9  }, // 2  segmento
        { width: 7  }, // 3  punto
        { width: 9  }, // 4  cota
        { width: 7  }, // 5  UH parcial
        { width: 7  }, // 6  UH total
        { width: 8  }, // 7  caudal
        { width: 9  }, // 8  longitud
        { width: 11 }, // 9  diámetro
        { width: 5  }, // 10 N° codo90
        { width: 8  }, // 11 codo90 leq
        { width: 5  }, // 12 N° tee
        { width: 8  }, // 13 tee leq
        { width: 5  }, // 14 N° val compuerta
        { width: 8  }, // 15 val compuerta leq
        { width: 5  }, // 16 N° reduccion
        { width: 8  }, // 17 reduccion leq
        { width: 9  }, // 18 longitud total
        { width: 8  }, // 19 coef rug
        { width: 9  }, // 20 S (m/m)
        { width: 8  }, // 21 Hf (m)
        { width: 9  }, // 22 H.Piez
        { width: 9  }, // 23 velocidad
        { width: 9  }, // 24 presión
        { width: 9  }, // 25 verif 1
        { width: 8  }, // 26 verif 2
    ];

    const RD_LAST = 26; 

    // Paleta estilo 
    const RD_BLANC  = 'FFFFFFFF';
    const RD_NEGRO  = 'FF000000';
    const RD_TITLE  = 'FF4F4F4F'; 
    const RD_HDR1   = 'FF595959';
    const RD_HDR2   = 'FF737373'; 
    const RD_YELLOW = 'FFFFC000'; 
    const RD_LYELL  = 'FFFFF2CC'; 
    const RD_LGRAY  = 'FFD9D9D9'; 
    const RD_LBLUE  = 'FFD6E4F0'; 
    const RD_GREEN  = 'FF70AD47';
    const RD_RED    = 'FFFF0000'; 
    const RD_ORANG  = 'FFFCE4D6';
    const RD_SECTB  = 'FF203864';

    const rdBT = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFA0A0A0' } };
    const rdBM = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FF444444' } };
    const rdBW = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFFFFFFF' } };

    // Helpers 
    function rdFill(r: number, bg: string, h = 17) {
        ws7.getRow(r).height = h;
        ws7.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RD_BLANC } };
        for (let c = 2; c <= RD_LAST; c++)
            ws7.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
    }

    function rdSep(r: number, h = 10) {
        ws7.getRow(r).height = h;
        for (let c = 1; c <= RD_LAST; c++)
            ws7.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: RD_BLANC } };
    }

    function rdC(r: number, c: number, val: any, opts: {
        bold?: boolean; size?: number; bg?: string; color?: string;
        halign?: ExcelJS.Alignment['horizontal']; numFmt?: string;
        wrap?: boolean; border?: 'T' | 'M' | 'W' | false;
        italic?: boolean;
    } = {}) {
        const cell = ws7.getCell(r, c);
        cell.value = val ?? null;
        cell.font  = { bold: opts.bold ?? false, size: opts.size ?? 8,
                       name: 'Arial', italic: opts.italic ?? false,
                       color: { argb: opts.color ?? RD_NEGRO } };
        if (opts.bg) cell.fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: opts.bg } };
        cell.alignment = { horizontal: opts.halign ?? 'center', vertical: 'middle',
                           wrapText: opts.wrap ?? false };
        if (opts.border !== false) {
            const b = opts.border === 'M' ? rdBM
                    : opts.border === 'W' ? rdBW
                    : rdBT;
            cell.border = { top: b, left: b, bottom: b, right: b };
        }
        if (opts.numFmt) cell.numFmt = opts.numFmt;
    }

    // Barra de título de módulo 
    function rdModuleTitle(r: number, text: string) {
        rdFill(r, RD_TITLE, 22);
        ws7.mergeCells(r, 2, r, RD_LAST);
        const cell = ws7.getCell(r, 2);
        cell.value = text;
        cell.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RD_TITLE } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: rdBM, left: rdBM, bottom: rdBM, right: rdBM };
    }

    // Barra sección grado 
    function rdGradeBar(r: number, text: string) {
        rdFill(r, RD_SECTB, 24);
        ws7.mergeCells(r, 2, r, RD_LAST);
        const cell = ws7.getCell(r, 2);
        cell.value = text;
        cell.font  = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RD_SECTB } };
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        cell.border = { top: rdBM, left: rdBM, bottom: rdBM, right: rdBM };
    }

    // Barra título principal
    function rdMainTitle(r: number, text: string) {
        rdFill(r, 'FF1F3864', 28);
        ws7.mergeCells(r, 2, r, RD_LAST);
        const cell = ws7.getCell(r, 2);
        cell.value = text;
        cell.font  = { bold: true, size: 12, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        cell.border = { top: rdBM, left: rdBM, bottom: rdBM, right: rdBM };
    }

    // -----> Encabezados de tabla 
    // Devuelve la fila después de los headers
    function rdDrawHeaders(r: number, accLabels: {
        codo90: string; tee: string; val_compuerta: string; reduccion2: string;
    }): number {
        // Fila 1 
        rdFill(r, RD_HDR1, 28);
        const h1: Array<{ c: number; cEnd?: number; text: string }> = [
            { c: 2,  text: 'Segmento' },
            { c: 3,  text: 'Punto' },
            { c: 4,  text: 'Cota' },
            { c: 5,  cEnd: 6,  text: 'U.H.' },
            { c: 7,  text: 'Caudal\n(l/s)' },
            { c: 8,  text: 'Longitud\n(m)' },
            { c: 9,  text: 'Diámetro\nplg' },
            { c: 10, cEnd: 17, text: 'Longitud Equivalente (m)' },
            { c: 18, text: 'Long.\nTotal(m)' },
            { c: 19, text: 'Coef.\nRug.H-W' },
            { c: 20, text: 'S\n(m/m)' },
            { c: 21, text: 'Hf\n(m)' },
            { c: 22, text: 'H. Piez.\n(m)' },
            { c: 23, text: 'Velocidad\n(m/s)' },
            { c: 24, text: 'Presión\n(mca)' },
            { c: 25, cEnd: 26, text: 'VERIFICACIONES' },
        ];
        h1.forEach(({ c, cEnd, text }) => {
            if (cEnd) ws7.mergeCells(r, c, r, cEnd);
            const cell = ws7.getCell(r, c);
            cell.value = text;
            cell.font  = { bold: true, size: 8, name: 'Arial', color: { argb: 'FFFFFFFF' } };
            cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RD_HDR1 } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { top: rdBW, left: rdBW, bottom: rdBW, right: rdBW };
            if (cEnd) {
                for (let cc = c + 1; cc <= cEnd; cc++) {
                    ws7.getCell(r, cc).fill = { type: 'pattern', pattern: 'solid',
                        fgColor: { argb: RD_HDR1 } };
                }
            }
        });
        r++;

        // Fila 2 
        rdFill(r, RD_HDR2, 24);
        const h2: Array<{ c: number; text: string }> = [
            { c: 2,  text: 'Seg.' },
            { c: 3,  text: 'Pto.' },
            { c: 4,  text: 'Cota\n(m)' },
            { c: 5,  text: 'Parcial' },
            { c: 6,  text: 'Total' },
            { c: 7,  text: 'Q' },
            { c: 8,  text: 'L' },
            { c: 9,  text: 'Ø plg' },
            { c: 10, text: 'N°' },
            { c: 11, text: accLabels.codo90 || 'Codo 90°' },
            { c: 12, text: 'N°' },
            { c: 13, text: accLabels.tee || 'Tee' },
            { c: 14, text: 'N°' },
            { c: 15, text: accLabels.val_compuerta || 'Val. Comp.' },
            { c: 16, text: 'N°' },
            { c: 17, text: accLabels.reduccion2 || 'Reduc. 2' },
            { c: 18, text: 'L. Tot.' },
            { c: 19, text: 'C' },
            { c: 20, text: 'S' },
            { c: 21, text: 'Hf' },
            { c: 22, text: 'Hpz.' },
            { c: 23, text: 'V' },
            { c: 24, text: 'P' },
            { c: 25, text: '0.60<V\n<Adm?' },
            { c: 26, text: 'P>2\nmca?' },
        ];
        h2.forEach(({ c, text }) => {
            const cell = ws7.getCell(r, c);
            cell.value = text;
            cell.font  = { bold: true, size: 7, name: 'Arial', color: { argb: 'FFFFFFFF' } };
            cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RD_HDR2 } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { top: rdBW, left: rdBW, bottom: rdBW, right: rdBW };
        });
        r++;
        return r;
    }

    // Fila de datos 
    function rdDataRow(r: number, row: any, idx: number): void {
        const isStatic = row.isStatic;
        const bg = isStatic ? RD_ORANG : (idx % 2 === 0 ? RD_BLANC : RD_LBLUE);
        rdFill(r, bg, 16);

        const n = (v: any, d = 3) => {
            const f = parseFloat(v);
            return isFinite(f) ? f : null;
        };

        // Verificación coloreada
        const verif = (val: string): { text: string; bg: string; color: string } => {
            if (!val || val === '') return { text: '-', bg: bg, color: RD_NEGRO };
            const v = String(val).toLowerCase();
            if (v === 'cumple' || v === 'ok' || v === 'si' || v === 'sí')
                return { text: 'cumple', bg: 'FFE2EFDA', color: 'FF375623' };
            if (v === 'no cumple' || v === 'no')
                return { text: 'no cumple', bg: 'FFFFC7CE', color: 'FF9C0006' };
            return { text: val, bg: bg, color: RD_NEGRO };
        };

        const cols: Array<{ c: number; val: any; bg2?: string; color?: string;
            bold?: boolean; numFmt?: string; isVerif?: boolean }> = [
            { c: 2,  val: row.segmento    || '' },
            { c: 3,  val: row.punto        || '' },
            { c: 4,  val: n(row.cota),       bg2: isStatic ? RD_LGRAY : RD_LYELL, numFmt: '0.000' },
            { c: 5,  val: isStatic ? '' : (row.uh_parcial !== '' && row.uh_parcial != null ? n(row.uh_parcial) : '') },
            { c: 6,  val: isStatic ? '' : n(row.uh_total),   bg2: RD_LYELL, numFmt: '0.000' },
            { c: 7,  val: isStatic ? '' : n(row.caudal),     bg2: RD_YELLOW, bold: true, numFmt: '0.000' },
            { c: 8,  val: isStatic ? '' : n(row.longitud),   numFmt: '0.00' },
            { c: 9,  val: isStatic ? '' : (row.diametro || '') },
            { c: 10, val: isStatic ? '' : (n(row.n1) ?? '') },
            { c: 11, val: isStatic ? '' : n(row.codo90),     numFmt: '0.000' },
            { c: 12, val: isStatic ? '' : (n(row.n2) ?? '') },
            { c: 13, val: isStatic ? '' : n(row.tee),        numFmt: '0.000' },
            { c: 14, val: isStatic ? '' : (n(row.n3) ?? '') },
            { c: 15, val: isStatic ? '' : n(row.val_compuerta), numFmt: '0.000' },
            { c: 16, val: isStatic ? '' : (n(row.n4) ?? '') },
            { c: 17, val: isStatic ? '' : n(row.reduccion2), numFmt: '0.000' },
            { c: 18, val: isStatic ? '' : n(row.longitudtotal), bg2: RD_LYELL, numFmt: '0.00' },
            { c: 19, val: isStatic ? (n(row.coefrug) ?? '') : n(row.coefrug), numFmt: '0' },
            { c: 20, val: isStatic ? '' : n(row.s),          numFmt: '0.00000' },
            { c: 21, val: isStatic ? '' : n(row.hf),         numFmt: '0.00' },
            { c: 22, val: n(row.hpiez),                       bg2: RD_YELLOW, bold: true, numFmt: '0.000' },
            { c: 23, val: isStatic ? '' : n(row.velocidad),  numFmt: '0.00' },
            { c: 24, val: isStatic ? '' : n(row.presion),    bg2: isStatic ? bg : RD_LYELL, numFmt: '0.000' },
        ];

        cols.forEach(({ c, val, bg2, color, bold, numFmt }) => {
            const cell = ws7.getCell(r, c);
            cell.value = val ?? null;
            cell.font  = { bold: bold ?? false, size: 8, name: 'Arial',
                           color: { argb: color ?? RD_NEGRO } };
            cell.fill  = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg2 ?? bg } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: rdBT, left: rdBT, bottom: rdBT, right: rdBT };
            if (numFmt && val !== null && val !== '' && !isNaN(parseFloat(val))) {
                cell.numFmt = numFmt;
            }
        });

        // Verificaciones
        const v1 = verif(row.verificacion1);
        const v2 = verif(row.verificacion2);
        [{ c: 25, v: v1 }, { c: 26, v: v2 }].forEach(({ c, v }) => {
            const cell = ws7.getCell(r, c);
            cell.value = isStatic ? '' : v.text;
            cell.font  = { bold: true, size: 7, name: 'Arial', color: { argb: v.color } };
            cell.fill  = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: isStatic ? bg : v.bg } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: rdBT, left: rdBT, bottom: rdBT, right: rdBT };
        });
    }

    // Leer datos 
    const rdD      = dataSheet.tuberiasRD || {};
    const rdConfig = rdD.config || { npisoterminado: 0.65, altasumfondotanqueelevado: 13.85 };
    const rdGrades = rdD.grades || { inicial: true, primaria: false, secundaria: false };
    const rdTables = rdD.tables || rdD.tablas || {};
    const rdAccCfg = rdD.accesoriosConfig || {
        inicial:    { codo90:'codo90', tee:'tee', val_compuerta:'valCompuerta', reduccion2:'reduccion2' },
        primaria:   { codo90:'codo90', tee:'tee', val_compuerta:'valCompuerta', reduccion2:'reduccion2' },
        secundaria: { codo90:'codo90', tee:'tee', val_compuerta:'valCompuerta', reduccion2:'reduccion2' },
    };

    const rdNivel = parseFloat(
        (parseFloat(rdConfig.npisoterminado || 0.65) +
         parseFloat(rdConfig.altasumfondotanqueelevado || 13.85)).toFixed(3)
    );

    const rdAccNames: Record<string, string> = {
        codo90:'Codo 90°', codo45:'Codo 45°', tee:'Tee',
        valCompuerta:'Val. Comp.', valCheck:'Val. Check',
        canastilla:'Canastilla', reduccion1:'Reduc. 1', reduccion2:'Reduc. 2',
    };

    const rdGradeNames: Record<string, string> = {
        inicial:'INICIAL', primaria:'PRIMARIA', secundaria:'SECUNDARIA',
    };

    const rdSelectedGrades = Object.keys(rdGrades).filter(g => rdGrades[g]);

    let rr7 = 1;

    // TÍTULO PRINCIPAL
    rdMainTitle(rr7, '7. CÁLCULO DE LA RED DE DISTRIBUCIÓN (TUBERÍAS RD)'); rr7++;
    rdSep(rr7, 14); rr7++;

    // CONFIGURACIÓN
    // Barra config
    rdFill(rr7, RD_HDR1, 22);
    ws7.mergeCells(rr7, 2, rr7, RD_LAST);
    const rdCfgHdr = ws7.getCell(rr7, 2);
    rdCfgHdr.value = 'CONFIGURACIÓN DEL SISTEMA';
    rdCfgHdr.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    rdCfgHdr.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RD_HDR1 } };
    rdCfgHdr.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    rdCfgHdr.border = { top: rdBM, left: rdBM, bottom: rdBM, right: rdBM };
    rr7++;
    rdSep(rr7, 6); rr7++;

    // Filas de configuracion 
    const rdCfgRows = [
        { label: 'Nivel de Piso Terminado',
          val: parseFloat(rdConfig.npisoterminado || 0.65), unit: 'm' },
        { label: 'Altura Asumida Fondo Tanque Elevado',
          val: parseFloat(rdConfig.altasumfondotanqueelevado || 13.85), unit: 'm' },
        { label: 'Nivel Asumido Fondo Tanque Elevado (calculado)',
          val: rdNivel, unit: 'm', computed: true },
    ];
    rdCfgRows.forEach((cfg, idx) => {
        const bg = idx % 2 === 0 ? RD_BLANC : 'FFF8F8F8';
        rdFill(rr7, bg, 19);
        // Label cols 2-6
        ws7.mergeCells(rr7, 2, rr7, 10);
        const lc = ws7.getCell(rr7, 2);
        lc.value = cfg.label;
        lc.font  = { size: 9, name: 'Arial', color: { argb: RD_NEGRO } };
        lc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        lc.alignment = { horizontal: 'right', vertical: 'middle' };
        lc.border = { top: rdBT, left: rdBT, bottom: rdBT, right: rdBT };
        for (let c = 3; c <= 10; c++) {
            ws7.getCell(rr7, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
            ws7.getCell(rr7, c).border = { top: rdBT, bottom: rdBT };
        }
        // Valor col 11
        const vc = ws7.getCell(rr7, 11);
        vc.value  = cfg.val;
        vc.numFmt = '0.000';
        vc.font   = { bold: true, size: 10, name: 'Arial', color: { argb: RD_NEGRO } };
        vc.fill   = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: cfg.computed ? RD_BLANC : RD_YELLOW } };
        vc.alignment = { horizontal: 'center', vertical: 'middle' };
        vc.border = { top: rdBT, left: rdBT, bottom: rdBT, right: rdBT };
        // Unidad col 12
        const uc = ws7.getCell(rr7, 12);
        uc.value = cfg.unit;
        uc.font  = { size: 8, name: 'Arial', color: { argb: RD_NEGRO } };
        uc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        uc.alignment = { horizontal: 'left', vertical: 'middle' };
        uc.border = { top: rdBT, left: rdBT, bottom: rdBT, right: rdBT };
        // Rest blank
        for (let c = 13; c <= RD_LAST; c++) {
            ws7.getCell(rr7, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
            ws7.getCell(rr7, c).border = { top: rdBT, bottom: rdBT,
                right: c === RD_LAST ? rdBM : rdBT };
        }
        rr7++;
    });
    rdSep(rr7, 16); rr7++;

    // TABLAS POR GRADO
    if (rdSelectedGrades.length === 0) {
        rdFill(rr7, RD_LYELL, 24);
        ws7.mergeCells(rr7, 2, rr7, RD_LAST);
        const noData = ws7.getCell(rr7, 2);
        noData.value = 'No hay grados seleccionados para exportar.';
        noData.font  = { italic: true, size: 9, name: 'Arial', color: { argb: 'FF996600' } };
        noData.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RD_LYELL } };
        noData.alignment = { horizontal: 'center', vertical: 'middle' };
        rr7++;
    }

    rdSelectedGrades.forEach(grade => {
        // Normalizar módulos del grado
        let rdModules: any[] = [];
        const gradeData = rdTables[grade];
        if (gradeData) {
            if (Array.isArray(gradeData)) {
                // formato tablas: [{ nombre, datos }]
                rdModules = gradeData;
            } else if (gradeData.modules) {
                // formato tables: { modules: [{ id, nombre, datos }] }
                rdModules = gradeData.modules;
            }
        }

        // Barra de grado
        rdGradeBar(rr7, `NIVEL ${rdGradeNames[grade]} — RED DE DISTRIBUCIÓN`); rr7++;
        rdSep(rr7, 10); rr7++;

        if (rdModules.length === 0) {
            rdFill(rr7, RD_LYELL, 20);
            ws7.mergeCells(rr7, 2, rr7, RD_LAST);
            const noMod = ws7.getCell(rr7, 2);
            noMod.value = `Sin módulos para el nivel ${rdGradeNames[grade]}.`;
            noMod.font  = { italic: true, size: 9, name: 'Arial', color: { argb: 'FF888888' } };
            noMod.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RD_LYELL } };
            noMod.alignment = { horizontal: 'center', vertical: 'middle' };
            rr7++;
            rdSep(rr7, 16); rr7++;
            return;
        }

        // Accesorios para este grado
        const gradeAcc = rdAccCfg[grade] || rdAccCfg.inicial;
        const accLabels = {
            codo90:        rdAccNames[gradeAcc.codo90]        || 'Codo 90°',
            tee:           rdAccNames[gradeAcc.tee]           || 'Tee',
            val_compuerta: rdAccNames[gradeAcc.val_compuerta] || 'Val. Comp.',
            reduccion2:    rdAccNames[gradeAcc.reduccion2]    || 'Reduc. 2',
        };

        rdModules.forEach((modulo: any, modIdx: number) => {
            const rows: any[] = Array.isArray(modulo.data) ? modulo.data : [];
            const modName = modulo.nombre ||
                `CALCULO DE LA RED DE DISTRIBUCION ${modIdx + 1} - ${grade.toUpperCase()}`;

            // Título módulo
            rdModuleTitle(rr7, modName); rr7++;

            // Encabezados
            rr7 = rdDrawHeaders(rr7, accLabels);

            // Filas de datos
            if (rows.length === 0) {
                rdFill(rr7, RD_BLANC, 16);
                ws7.mergeCells(rr7, 2, rr7, RD_LAST);
                const emptyR = ws7.getCell(rr7, 2);
                emptyR.value = 'Sin datos.';
                emptyR.font  = { italic: true, size: 8, name: 'Arial',
                                 color: { argb: 'FF888888' } };
                emptyR.fill  = { type: 'pattern', pattern: 'solid',
                    fgColor: { argb: RD_BLANC } };
                emptyR.alignment = { horizontal: 'center', vertical: 'middle' };
                rr7++;
            } else {
                let dataIdx = 0;
                rows.forEach((row: any) => {
                    rdDataRow(rr7, row, row.isStatic ? -1 : dataIdx);
                    if (!row.isStatic) dataIdx++;
                    rr7++;
                });
            }

            // Separador entre módulos
            rdSep(rr7, 14); rr7++;
        });

        rdSep(rr7, 18); rr7++;
    });

    // RESUMEN FINAL
    rdFill(rr7, RD_HDR1, 22);
    ws7.mergeCells(rr7, 2, rr7, RD_LAST);
    const rdResHdr = ws7.getCell(rr7, 2);
    rdResHdr.value = 'RESUMEN — RED DE DISTRIBUCIÓN';
    rdResHdr.font  = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    rdResHdr.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RD_HDR1 } };
    rdResHdr.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    rdResHdr.border = { top: rdBM, left: rdBM, bottom: rdBM, right: rdBM };
    rr7++;
    rdSep(rr7, 8); rr7++;

    // Una fila de resumen por grado
    rdSelectedGrades.forEach((grade, idx) => {
        const gradeData = rdTables[grade];
        let rdMods: any[] = [];
        if (gradeData) {
            if (Array.isArray(gradeData)) rdMods = gradeData;
            else if (gradeData.modules) rdMods = gradeData.modules;
        }
        const totalCircuitos = rdMods.length;
        const bg = idx % 2 === 0 ? RD_BLANC : RD_LBLUE;
        rdFill(rr7, bg, 19);

        ws7.mergeCells(rr7, 2, rr7, 10);
        const gc = ws7.getCell(rr7, 2);
        gc.value = `NIVEL ${rdGradeNames[grade]}`;
        gc.font  = { bold: true, size: 9, name: 'Arial', color: { argb: RD_NEGRO } };
        gc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        gc.alignment = { horizontal: 'left', vertical: 'middle', indent: 2 };
        gc.border = { top: rdBT, left: rdBM, bottom: rdBT, right: rdBT };
        for (let c = 3; c <= 10; c++) {
            ws7.getCell(rr7, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
            ws7.getCell(rr7, c).border = { top: rdBT, bottom: rdBT };
        }

        ws7.mergeCells(rr7, 11, rr7, 15);
        const gv = ws7.getCell(rr7, 11);
        gv.value = `${totalCircuitos} circuito${totalCircuitos !== 1 ? 's' : ''} / módulo${totalCircuitos !== 1 ? 's' : ''}`;
        gv.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF1F4E78' } };
        gv.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RD_YELLOW } };
        gv.alignment = { horizontal: 'center', vertical: 'middle' };
        gv.border = { top: rdBT, left: rdBT, bottom: rdBT, right: rdBT };
        for (let c = 12; c <= 15; c++) {
            ws7.getCell(rr7, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: RD_YELLOW } };
            ws7.getCell(rr7, c).border = { top: rdBT, bottom: rdBT };
        }
        // config valores
        ws7.mergeCells(rr7, 16, rr7, 20);
        const gn = ws7.getCell(rr7, 16);
        gn.value = `Nivel tanque: ${rdNivel.toFixed(3)} m`;
        gn.font  = { size: 8, name: 'Arial', color: { argb: RD_NEGRO } };
        gn.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        gn.alignment = { horizontal: 'center', vertical: 'middle' };
        gn.border = { top: rdBT, left: rdBT, bottom: rdBT, right: rdBT };
        for (let c = 17; c <= 20; c++) {
            ws7.getCell(rr7, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
            ws7.getCell(rr7, c).border = { top: rdBT, bottom: rdBT };
        }
        for (let c = 21; c <= RD_LAST; c++) {
            ws7.getCell(rr7, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
            ws7.getCell(rr7, c).border = { top: rdBT, bottom: rdBT,
                right: c === RD_LAST ? rdBM : rdBT };
        }
        rr7++;
    });

    rdSep(rr7, 16); rr7++;
    //------------------------------------------------------------------------------------------------------------------------------------------------------------------------

   
// HOJA 8: REDES INTERIORES 
{
    const ws8 = workbook.addWorksheet('8. Redes Interiores');

    ws8.columns = [
        { width: 3  }, // 1  spacer
        { width: 9  }, // 2  segmento
        { width: 7  }, // 3  punto
        { width: 9  }, // 4  cota
        { width: 7  }, // 5  UH parcial
        { width: 7  }, // 6  UH total
        { width: 8  }, // 7  caudal
        { width: 9  }, // 8  longitud
        { width: 11 }, // 9  diámetro
        { width: 5  }, // 10 N° codo90
        { width: 8  }, // 11 codo90 leq
        { width: 5  }, // 12 N° tee
        { width: 8  }, // 13 tee leq
        { width: 5  }, // 14 N° val compuerta
        { width: 8  }, // 15 val compuerta leq
        { width: 5  }, // 16 N° reduccion
        { width: 8  }, // 17 reduccion leq
        { width: 9  }, // 18 longitud total
        { width: 8  }, // 19 coef rug
        { width: 9  }, // 20 S (m/m)
        { width: 8  }, // 21 Hf (m)
        { width: 9  }, // 22 H.Piez
        { width: 9  }, // 23 velocidad
        { width: 9  }, // 24 presión
        { width: 9  }, // 25 verif 1
        { width: 8  }, // 26 verif 2
    ];

    const RI_LAST = 26;

    // Paleta estilo 
    const RI_BLANC  = 'FFFFFFFF';
    const RI_NEGRO  = 'FF000000';
    const RI_TITLE  = 'FF4F4F4F'; 
    const RI_HDR1   = 'FF595959'; 
    const RI_HDR2   = 'FF737373';
    const RI_YELLOW = 'FFFFC000'; 
    const RI_LYELL  = 'FFFFF2CC';
    const RI_LGRAY  = 'FFD9D9D9'; 
    const RI_LBLUE  = 'FFD6E4F0';
    const RI_GREEN  = 'FF70AD47'; 
    const RI_RED    = 'FFFF0000'; 
    const RI_ORANG  = 'FFFCE4D6';
    const RI_SECTB  = 'FF203864'; 

    const riBT = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFA0A0A0' } };
    const riBM = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FF444444' } };
    const riBW = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFFFFFFF' } };

    // Helpers 
    function riFill(r: number, bg: string, h = 17) {
        ws8.getRow(r).height = h;
        ws8.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RI_BLANC } };
        for (let c = 2; c <= RI_LAST; c++)
            ws8.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
    }

    function riSep(r: number, h = 10) {
        ws8.getRow(r).height = h;
        for (let c = 1; c <= RI_LAST; c++)
            ws8.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: RI_BLANC } };
    }

    function riC(r: number, c: number, val: any, opts: {
        bold?: boolean; size?: number; bg?: string; color?: string;
        halign?: ExcelJS.Alignment['horizontal']; numFmt?: string;
        wrap?: boolean; border?: 'T' | 'M' | 'W' | false;
        italic?: boolean;
    } = {}) {
        const cell = ws8.getCell(r, c);
        cell.value = val ?? null;
        cell.font  = { bold: opts.bold ?? false, size: opts.size ?? 8,
                       name: 'Arial', italic: opts.italic ?? false,
                       color: { argb: opts.color ?? RI_NEGRO } };
        if (opts.bg) cell.fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: opts.bg } };
        cell.alignment = { horizontal: opts.halign ?? 'center', vertical: 'middle',
                           wrapText: opts.wrap ?? false };
        if (opts.border !== false) {
            const b = opts.border === 'M' ? riBM
                    : opts.border === 'W' ? riBW
                    : riBT;
            cell.border = { top: b, left: b, bottom: b, right: b };
        }
        if (opts.numFmt) cell.numFmt = opts.numFmt;
    }

    // Barra de título de módulo 
    function riModuleTitle(r: number, text: string) {
        riFill(r, RI_TITLE, 22);
        ws8.mergeCells(r, 2, r, RI_LAST);
        const cell = ws8.getCell(r, 2);
        cell.value = text;
        cell.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RI_TITLE } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: riBM, left: riBM, bottom: riBM, right: riBM };
    }

    // Barra sección grado 
    function riGradeBar(r: number, text: string) {
        riFill(r, RI_SECTB, 24);
        ws8.mergeCells(r, 2, r, RI_LAST);
        const cell = ws8.getCell(r, 2);
        cell.value = text;
        cell.font  = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RI_SECTB } };
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        cell.border = { top: riBM, left: riBM, bottom: riBM, right: riBM };
    }

    // Barra título principal
    function riMainTitle(r: number, text: string) {
        riFill(r, 'FF1F3864', 28);
        ws8.mergeCells(r, 2, r, RI_LAST);
        const cell = ws8.getCell(r, 2);
        cell.value = text;
        cell.font  = { bold: true, size: 12, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
        cell.border = { top: riBM, left: riBM, bottom: riBM, right: riBM };
    }

    // Encabezados de tabla 
    // Devuelve la fila después de los headers
    function riDrawHeaders(r: number, accLabels: {
        codo90: string; tee: string; val_compuerta: string; reduccion2: string;
    }): number {
        // Fila 1 
        riFill(r, RI_HDR1, 28);
        const h1: Array<{ c: number; cEnd?: number; text: string }> = [
            { c: 2,  text: 'Segmento' },
            { c: 3,  text: 'Punto' },
            { c: 4,  text: 'Cota' },
            { c: 5,  cEnd: 6,  text: 'U.H.' },
            { c: 7,  text: 'Caudal\n(l/s)' },
            { c: 8,  text: 'Longitud\n(m)' },
            { c: 9,  text: 'Diámetro\nplg' },
            { c: 10, cEnd: 17, text: 'Longitud Equivalente (m)' },
            { c: 18, text: 'Long.\nTotal(m)' },
            { c: 19, text: 'Coef.\nRug.H-W' },
            { c: 20, text: 'S\n(m/m)' },
            { c: 21, text: 'Hf\n(m)' },
            { c: 22, text: 'H. Piez.\n(m)' },
            { c: 23, text: 'Velocidad\n(m/s)' },
            { c: 24, text: 'Presión\n(mca)' },
            { c: 25, cEnd: 26, text: 'VERIFICACIONES' },
        ];
        h1.forEach(({ c, cEnd, text }) => {
            if (cEnd) ws8.mergeCells(r, c, r, cEnd);
            const cell = ws8.getCell(r, c);
            cell.value = text;
            cell.font  = { bold: true, size: 8, name: 'Arial', color: { argb: 'FFFFFFFF' } };
            cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RI_HDR1 } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { top: riBW, left: riBW, bottom: riBW, right: riBW };
            if (cEnd) {
                for (let cc = c + 1; cc <= cEnd; cc++) {
                    ws8.getCell(r, cc).fill = { type: 'pattern', pattern: 'solid',
                        fgColor: { argb: RI_HDR1 } };
                }
            }
        });
        r++;

        // Fila 2 
        riFill(r, RI_HDR2, 24);
        const h2: Array<{ c: number; text: string }> = [
            { c: 2,  text: 'Seg.' },
            { c: 3,  text: 'Pto.' },
            { c: 4,  text: 'Cota\n(m)' },
            { c: 5,  text: 'Parcial' },
            { c: 6,  text: 'Total' },
            { c: 7,  text: 'Q' },
            { c: 8,  text: 'L' },
            { c: 9,  text: 'Ø plg' },
            { c: 10, text: 'N°' },
            { c: 11, text: accLabels.codo90 || 'Codo 90°' },
            { c: 12, text: 'N°' },
            { c: 13, text: accLabels.tee || 'Tee' },
            { c: 14, text: 'N°' },
            { c: 15, text: accLabels.val_compuerta || 'Val. Comp.' },
            { c: 16, text: 'N°' },
            { c: 17, text: accLabels.reduccion2 || 'Reduc. 2' },
            { c: 18, text: 'L. Tot.' },
            { c: 19, text: 'C' },
            { c: 20, text: 'S' },
            { c: 21, text: 'Hf' },
            { c: 22, text: 'Hpz.' },
            { c: 23, text: 'V' },
            { c: 24, text: 'P' },
            { c: 25, text: '0.60<V\n<Adm?' },
            { c: 26, text: 'P>2\nmca?' },
        ];
        h2.forEach(({ c, text }) => {
            const cell = ws8.getCell(r, c);
            cell.value = text;
            cell.font  = { bold: true, size: 7, name: 'Arial', color: { argb: 'FFFFFFFF' } };
            cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RI_HDR2 } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { top: riBW, left: riBW, bottom: riBW, right: riBW };
        });
        r++;
        return r;
    }

    // Fila de datos 
    function riDataRow(r: number, row: any, idx: number): void {
        const isStatic = row.isStatic;
        const bg = isStatic ? RI_ORANG : (idx % 2 === 0 ? RI_BLANC : RI_LBLUE);
        riFill(r, bg, 16);

        const n = (v: any, d = 3) => {
            const f = parseFloat(v);
            return isFinite(f) ? f : null;
        };

        // Verificación coloreada
        const verif = (val: string): { text: string; bg: string; color: string } => {
            if (!val || val === '') return { text: '-', bg: bg, color: RI_NEGRO };
            const v = String(val).toLowerCase();
            if (v === 'cumple' || v === 'ok' || v === 'si' || v === 'sí')
                return { text: 'cumple', bg: 'FFE2EFDA', color: 'FF375623' };
            if (v === 'no cumple' || v === 'no')
                return { text: 'no cumple', bg: 'FFFFC7CE', color: 'FF9C0006' };
            return { text: val, bg: bg, color: RI_NEGRO };
        };

        const cols: Array<{ c: number; val: any; bg2?: string; color?: string;
            bold?: boolean; numFmt?: string; isVerif?: boolean }> = [
            { c: 2,  val: row.segmento    || '' },
            { c: 3,  val: row.punto        || '' },
            { c: 4,  val: n(row.cota),       bg2: isStatic ? RI_LGRAY : RI_LYELL, numFmt: '0.000' },
            { c: 5,  val: isStatic ? '' : (row.uh_parcial !== '' && row.uh_parcial != null ? n(row.uh_parcial) : '') },
            { c: 6,  val: isStatic ? '' : n(row.uh_total),   bg2: RI_LYELL, numFmt: '0.000' },
            { c: 7,  val: isStatic ? '' : n(row.caudal),     bg2: RI_YELLOW, bold: true, numFmt: '0.000' },
            { c: 8,  val: isStatic ? '' : n(row.longitud),   numFmt: '0.00' },
            { c: 9,  val: isStatic ? '' : (row.diametro || '') },
            { c: 10, val: isStatic ? '' : (n(row.n1) ?? '') },
            { c: 11, val: isStatic ? '' : n(row.codo90),     numFmt: '0.000' },
            { c: 12, val: isStatic ? '' : (n(row.n2) ?? '') },
            { c: 13, val: isStatic ? '' : n(row.tee),        numFmt: '0.000' },
            { c: 14, val: isStatic ? '' : (n(row.n3) ?? '') },
            { c: 15, val: isStatic ? '' : n(row.val_compuerta), numFmt: '0.000' },
            { c: 16, val: isStatic ? '' : (n(row.n4) ?? '') },
            { c: 17, val: isStatic ? '' : n(row.reduccion2), numFmt: '0.000' },
            { c: 18, val: isStatic ? '' : n(row.longitudtotal), bg2: RI_LYELL, numFmt: '0.00' },
            { c: 19, val: isStatic ? (n(row.coefrug) ?? '') : n(row.coefrug), numFmt: '0' },
            { c: 20, val: isStatic ? '' : n(row.s),          numFmt: '0.00000' },
            { c: 21, val: isStatic ? '' : n(row.hf),         numFmt: '0.00' },
            { c: 22, val: n(row.hpiez),                       bg2: RI_YELLOW, bold: true, numFmt: '0.000' },
            { c: 23, val: isStatic ? '' : n(row.velocidad),  numFmt: '0.00' },
            { c: 24, val: isStatic ? '' : n(row.presion),    bg2: isStatic ? bg : RI_LYELL, numFmt: '0.000' },
        ];

        cols.forEach(({ c, val, bg2, color, bold, numFmt }) => {
            const cell = ws8.getCell(r, c);
            cell.value = val ?? null;
            cell.font  = { bold: bold ?? false, size: 8, name: 'Arial',
                           color: { argb: color ?? RI_NEGRO } };
            cell.fill  = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg2 ?? bg } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: riBT, left: riBT, bottom: riBT, right: riBT };
            if (numFmt && val !== null && val !== '' && !isNaN(parseFloat(val))) {
                cell.numFmt = numFmt;
            }
        });

        // Verificaciones
        const v1 = verif(row.verificacion1);
        const v2 = verif(row.verificacion2);
        [{ c: 25, v: v1 }, { c: 26, v: v2 }].forEach(({ c, v }) => {
            const cell = ws8.getCell(r, c);
            cell.value = isStatic ? '' : v.text;
            cell.font  = { bold: true, size: 7, name: 'Arial', color: { argb: v.color } };
            cell.fill  = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: isStatic ? bg : v.bg } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: riBT, left: riBT, bottom: riBT, right: riBT };
        });
    }

    // Leer datos 
    const riD      = dataSheet.redesInteriores || {};
    const riConfig = riD.config || { npisoterminado: 0.65, altasumfondotanqueelevado: 13.85 };
    const riGrades = riD.grades || { inicial: true, primaria: false, secundaria: false };
    const riTables = riD.tables || {};
    const riAccCfg = riD.accesoriosConfig || {
        inicial:    { codo90:'codo90', tee:'tee', val_compuerta:'valCompuerta', reduccion2:'reduccion2' },
        primaria:   { codo90:'codo90', tee:'tee', val_compuerta:'valCompuerta', reduccion2:'reduccion2' },
        secundaria: { codo90:'codo90', tee:'tee', val_compuerta:'valCompuerta', reduccion2:'reduccion2' },
    };

    const riNivel = parseFloat(
        (parseFloat(riConfig.npisoterminado || 0.65) +
         parseFloat(riConfig.altasumfondotanqueelevado || 13.85)).toFixed(3)
    );

    const riAccNames: Record<string, string> = {
        codo90:'Codo 90°', codo45:'Codo 45°', tee:'Tee',
        valCompuerta:'Val. Comp.', valCheck:'Val. Check',
        canastilla:'Canastilla', reduccion1:'Reduc. 1', reduccion2:'Reduc. 2',
    };

    const riGradeNames: Record<string, string> = {
        inicial:'INICIAL', primaria:'PRIMARIA', secundaria:'SECUNDARIA',
    };

    const riSelectedGrades = Object.keys(riGrades).filter(g => riGrades[g]);

    let rr = 1; 

    // TÍTULO PRINCIPAL
    riMainTitle(rr, '8. CÁLCULO DE REDES INTERIORES'); rr++;
    riSep(rr, 14); rr++;

    // CONFIGURACIÓN
    riFill(rr, RI_HDR1, 22);
    ws8.mergeCells(rr, 2, rr, RI_LAST);
    const riCfgHdr = ws8.getCell(rr, 2);
    riCfgHdr.value = 'CONFIGURACIÓN DEL SISTEMA';
    riCfgHdr.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    riCfgHdr.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RI_HDR1 } };
    riCfgHdr.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    riCfgHdr.border = { top: riBM, left: riBM, bottom: riBM, right: riBM };
    rr++;
    riSep(rr, 6); rr++;

    // Filas de configuracion 
    const riCfgRows = [
        { label: 'Nivel de Piso Terminado',
          val: parseFloat(riConfig.npisoterminado || 0.65), unit: 'm' },
        { label: 'Altura Asumida Fondo Tanque Elevado',
          val: parseFloat(riConfig.altasumfondotanqueelevado || 13.85), unit: 'm' },
        { label: 'Nivel Asumido Fondo Tanque Elevado (calculado)',
          val: riNivel, unit: 'm', computed: true },
    ];
    riCfgRows.forEach((cfg, idx) => {
        const bg = idx % 2 === 0 ? RI_BLANC : 'FFF8F8F8';
        riFill(rr, bg, 19);
        // Label cols 2-10
        ws8.mergeCells(rr, 2, rr, 10);
        const lc = ws8.getCell(rr, 2);
        lc.value = cfg.label;
        lc.font  = { size: 9, name: 'Arial', color: { argb: RI_NEGRO } };
        lc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        lc.alignment = { horizontal: 'right', vertical: 'middle' };
        lc.border = { top: riBT, left: riBT, bottom: riBT, right: riBT };
        for (let c = 3; c <= 10; c++) {
            ws8.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
            ws8.getCell(rr, c).border = { top: riBT, bottom: riBT };
        }
        // Valor col 11
        const vc = ws8.getCell(rr, 11);
        vc.value  = cfg.val;
        vc.numFmt = '0.000';
        vc.font   = { bold: true, size: 10, name: 'Arial', color: { argb: RI_NEGRO } };
        vc.fill   = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: cfg.computed ? RI_BLANC : RI_YELLOW } };
        vc.alignment = { horizontal: 'center', vertical: 'middle' };
        vc.border = { top: riBT, left: riBT, bottom: riBT, right: riBT };
        // Unidad col 12
        const uc = ws8.getCell(rr, 12);
        uc.value = cfg.unit;
        uc.font  = { size: 8, name: 'Arial', color: { argb: RI_NEGRO } };
        uc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        uc.alignment = { horizontal: 'left', vertical: 'middle' };
        uc.border = { top: riBT, left: riBT, bottom: riBT, right: riBT };
        // Rest blank
        for (let c = 13; c <= RI_LAST; c++) {
            ws8.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
            ws8.getCell(rr, c).border = { top: riBT, bottom: riBT,
                right: c === RI_LAST ? riBM : riBT };
        }
        rr++;
    });
    riSep(rr, 16); rr++;

    // TABLAS POR GRADO
    if (riSelectedGrades.length === 0) {
        riFill(rr, RI_LYELL, 24);
        ws8.mergeCells(rr, 2, rr, RI_LAST);
        const noData = ws8.getCell(rr, 2);
        noData.value = 'No hay grados seleccionados para exportar.';
        noData.font  = { italic: true, size: 9, name: 'Arial', color: { argb: 'FF996600' } };
        noData.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RI_LYELL } };
        noData.alignment = { horizontal: 'center', vertical: 'middle' };
        rr++;
    }

    riSelectedGrades.forEach(grade => {
        // Normalizar módulos del grado
        let riModules: any[] = [];
        const gradeData = riTables[grade];
        if (gradeData) {
            if (Array.isArray(gradeData)) {
                // formato tablas: [{ nombre, datos }]
                riModules = gradeData;
            } else if (gradeData.modules) {
                // formato tables: { modules: [{ id, nombre, datos}] }
                riModules = gradeData.modules;
            }
        }

        // Barra de grado
        riGradeBar(rr, `NIVEL ${riGradeNames[grade]} — REDES INTERIORES`); rr++;
        riSep(rr, 10); rr++;

        if (riModules.length === 0) {
            riFill(rr, RI_LYELL, 20);
            ws8.mergeCells(rr, 2, rr, RI_LAST);
            const noMod = ws8.getCell(rr, 2);
            noMod.value = `Sin módulos para el nivel ${riGradeNames[grade]}.`;
            noMod.font  = { italic: true, size: 9, name: 'Arial', color: { argb: 'FF888888' } };
            noMod.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RI_LYELL } };
            noMod.alignment = { horizontal: 'center', vertical: 'middle' };
            rr++;
            riSep(rr, 16); rr++;
            return;
        }

        // Accesorios para este grado
        const gradeAcc = riAccCfg[grade] || riAccCfg.inicial;
        const accLabels = {
            codo90:        riAccNames[gradeAcc.codo90]        || 'Codo 90°',
            tee:           riAccNames[gradeAcc.tee]           || 'Tee',
            val_compuerta: riAccNames[gradeAcc.val_compuerta] || 'Val. Comp.',
            reduccion2:    riAccNames[gradeAcc.reduccion2]    || 'Reduc. 2',
        };

        riModules.forEach((modulo: any, modIdx: number) => {
            const rows: any[] = Array.isArray(modulo.data) ? modulo.data : [];
            const modName = modulo.nombre ||
                `CÁLCULO DE REDES INTERIORES ${modIdx + 1} - ${grade.toUpperCase()}`;

            // Título módulo
            riModuleTitle(rr, modName); rr++;

            // Encabezados
            rr = riDrawHeaders(rr, accLabels);

            // Filas de datos
            if (rows.length === 0) {
                riFill(rr, RI_BLANC, 16);
                ws8.mergeCells(rr, 2, rr, RI_LAST);
                const emptyR = ws8.getCell(rr, 2);
                emptyR.value = 'Sin datos.';
                emptyR.font  = { italic: true, size: 8, name: 'Arial',
                                 color: { argb: 'FF888888' } };
                emptyR.fill  = { type: 'pattern', pattern: 'solid',
                    fgColor: { argb: RI_BLANC } };
                emptyR.alignment = { horizontal: 'center', vertical: 'middle' };
                rr++;
            } else {
                let dataIdx = 0;
                rows.forEach((row: any) => {
                    riDataRow(rr, row, row.isStatic ? -1 : dataIdx);
                    if (!row.isStatic) dataIdx++;
                    rr++;
                });
            }

            // Separador entre módulos
            riSep(rr, 14); rr++;
        });

        riSep(rr, 18); rr++;
    });

    // RESUMEN FINAL
    riFill(rr, RI_HDR1, 22);
    ws8.mergeCells(rr, 2, rr, RI_LAST);
    const riResHdr = ws8.getCell(rr, 2);
    riResHdr.value = 'RESUMEN — REDES INTERIORES';
    riResHdr.font  = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    riResHdr.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RI_HDR1 } };
    riResHdr.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    riResHdr.border = { top: riBM, left: riBM, bottom: riBM, right: riBM };
    rr++;
    riSep(rr, 8); rr++;

    // Una fila de resumen por grado
    riSelectedGrades.forEach((grade, idx) => {
        const gradeData = riTables[grade];
        let riMods: any[] = [];
        if (gradeData) {
            if (Array.isArray(gradeData)) riMods = gradeData;
            else if (gradeData.modules) riMods = gradeData.modules;
        }
        const totalCircuitos = riMods.length;
        const bg = idx % 2 === 0 ? RI_BLANC : RI_LBLUE;
        riFill(rr, bg, 19);

        ws8.mergeCells(rr, 2, rr, 10);
        const gc = ws8.getCell(rr, 2);
        gc.value = `NIVEL ${riGradeNames[grade]}`;
        gc.font  = { bold: true, size: 9, name: 'Arial', color: { argb: RI_NEGRO } };
        gc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        gc.alignment = { horizontal: 'left', vertical: 'middle', indent: 2 };
        gc.border = { top: riBT, left: riBM, bottom: riBT, right: riBT };
        for (let c = 3; c <= 10; c++) {
            ws8.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
            ws8.getCell(rr, c).border = { top: riBT, bottom: riBT };
        }

        ws8.mergeCells(rr, 11, rr, 15);
        const gv = ws8.getCell(rr, 11);
        gv.value = `${totalCircuitos} circuito${totalCircuitos !== 1 ? 's' : ''} / módulo${totalCircuitos !== 1 ? 's' : ''}`;
        gv.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF1F4E78' } };
        gv.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RI_YELLOW } };
        gv.alignment = { horizontal: 'center', vertical: 'middle' };
        gv.border = { top: riBT, left: riBT, bottom: riBT, right: riBT };
        for (let c = 12; c <= 15; c++) {
            ws8.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: RI_YELLOW } };
            ws8.getCell(rr, c).border = { top: riBT, bottom: riBT };
        }
        // config valores
        ws8.mergeCells(rr, 16, rr, 20);
        const gn = ws8.getCell(rr, 16);
        gn.value = `Nivel tanque: ${riNivel.toFixed(3)} m`;
        gn.font  = { size: 8, name: 'Arial', color: { argb: RI_NEGRO } };
        gn.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        gn.alignment = { horizontal: 'center', vertical: 'middle' };
        gn.border = { top: riBT, left: riBT, bottom: riBT, right: riBT };
        for (let c = 17; c <= 20; c++) {
            ws8.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
            ws8.getCell(rr, c).border = { top: riBT, bottom: riBT };
        }
        for (let c = 21; c <= RI_LAST; c++) {
            ws8.getCell(rr, c).fill = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: bg } };
            ws8.getCell(rr, c).border = { top: riBT, bottom: riBT,
                right: c === RI_LAST ? riBM : riBT };
        }
        rr++;
    });

    riSep(rr, 16); rr++;
}
//-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------


// HOJA 9: RED DE RIEGO
const ws9 = workbook.addWorksheet('9. Red de Riego');

ws9.columns = [
    { width: 3  }, // 1  spacer
    { width: 9  }, // 2  segmento
    { width: 7  }, // 3  punto
    { width: 9  }, // 4  cota
    { width: 7  }, // 5  UH parcial
    { width: 7  }, // 6  UH total
    { width: 8  }, // 7  caudal
    { width: 9  }, // 8  longitud
    { width: 11 }, // 9  diámetro
    { width: 5  }, // 10 N° codo90
    { width: 8  }, // 11 codo90 leq
    { width: 5  }, // 12 N° tee
    { width: 8  }, // 13 tee leq
    { width: 5  }, // 14 N° val compuerta
    { width: 8  }, // 15 val compuerta leq
    { width: 5  }, // 16 N° reduccion
    { width: 8  }, // 17 reduccion leq
    { width: 9  }, // 18 longitud total
    { width: 8  }, // 19 coef rug
    { width: 9  }, // 20 S (m/m)
    { width: 8  }, // 21 Hf (m)
    { width: 9  }, // 22 H.Piez
    { width: 9  }, // 23 velocidad
    { width: 9  }, // 24 presión
    { width: 9  }, // 25 verif 1
    { width: 8  }, // 26 verif 2
];

const RR_LAST = 26;

const RR_BLANC  = 'FFFFFFFF';
const RR_NEGRO  = 'FF000000';
const RR_TITLE  = 'FF4F4F4F'; 
const RR_HDR1   = 'FF595959'; 
const RR_HDR2   = 'FF737373'; 
const RR_YELLOW = 'FFFFC000'; 
const RR_LYELL  = 'FFFFF2CC'; 
const RR_LGRAY  = 'FFD9D9D9'; 
const RR_LBLUE  = 'FFD6E4F0'; 
const RR_GREEN  = 'FF70AD47'; 
const RR_RED    = 'FFFF0000'; 
const RR_ORANG  = 'FFFCE4D6'; 
const RR_SECTB  = 'FF203864';

const rrBT = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFA0A0A0' } };
const rrBM = { style: 'medium' as ExcelJS.BorderStyle, color: { argb: 'FF444444' } };
const rrBW = { style: 'thin'   as ExcelJS.BorderStyle, color: { argb: 'FFFFFFFF' } };

// Helpers 
function rrFill(r: number, bg: string, h = 17) {
    ws9.getRow(r).height = h;
    ws9.getCell(r, 1).fill = { type: 'pattern', pattern: 'solid',
        fgColor: { argb: RR_BLANC } };
    for (let c = 2; c <= RR_LAST; c++)
        ws9.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: bg } };
}

function rrSep(r: number, h = 10) {
    ws9.getRow(r).height = h;
    for (let c = 1; c <= RR_LAST; c++)
        ws9.getCell(r, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RR_BLANC } };
}

function rrC(r: number, c: number, val: any, opts: {
    bold?: boolean; size?: number; bg?: string; color?: string;
    halign?: ExcelJS.Alignment['horizontal']; numFmt?: string;
    wrap?: boolean; border?: 'T' | 'M' | 'W' | false;
    italic?: boolean;
} = {}) {
    const cell = ws9.getCell(r, c);
    cell.value = val ?? null;
    cell.font  = { bold: opts.bold ?? false, size: opts.size ?? 8,
                   name: 'Arial', italic: opts.italic ?? false,
                   color: { argb: opts.color ?? RR_NEGRO } };
    if (opts.bg) cell.fill = { type: 'pattern', pattern: 'solid',
        fgColor: { argb: opts.bg } };
    cell.alignment = { horizontal: opts.halign ?? 'center', vertical: 'middle',
                       wrapText: opts.wrap ?? false };
    if (opts.border !== false) {
        const b = opts.border === 'M' ? rrBM
                : opts.border === 'W' ? rrBW
                : rrBT;
        cell.border = { top: b, left: b, bottom: b, right: b };
    }
    if (opts.numFmt) cell.numFmt = opts.numFmt;
}

// Barra de título de módulo 
function rrModuleTitle(r: number, text: string) {
    rrFill(r, RR_TITLE, 22);
    ws9.mergeCells(r, 2, r, RR_LAST);
    const cell = ws9.getCell(r, 2);
    cell.value = text;
    cell.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RR_TITLE } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { top: rrBM, left: rrBM, bottom: rrBM, right: rrBM };
}

// Barra sección grado 
function rrGradeBar(r: number, text: string) {
    rrFill(r, RR_SECTB, 24);
    ws9.mergeCells(r, 2, r, RR_LAST);
    const cell = ws9.getCell(r, 2);
    cell.value = text;
    cell.font  = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RR_SECTB } };
    cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    cell.border = { top: rrBM, left: rrBM, bottom: rrBM, right: rrBM };
}

// Barra título principal
function rrMainTitle(r: number, text: string) {
    rrFill(r, 'FF1F3864', 28);
    ws9.mergeCells(r, 2, r, RR_LAST);
    const cell = ws9.getCell(r, 2);
    cell.value = text;
    cell.font  = { bold: true, size: 12, name: 'Arial', color: { argb: 'FFFFFFFF' } };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
    cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    cell.border = { top: rrBM, left: rrBM, bottom: rrBM, right: rrBM };
}

// Encabezados de tabla 
function rrDrawHeaders(r: number, accLabels: {
    codo90: string; tee: string; val_compuerta: string; reduccion2: string;
}): number {
    // Fila 1
    rrFill(r, RR_HDR1, 28);
    const h1: Array<{ c: number; cEnd?: number; text: string }> = [
        { c: 2,  text: 'Segmento' },
        { c: 3,  text: 'Punto' },
        { c: 4,  text: 'Cota' },
        { c: 5,  cEnd: 6,  text: 'U.H.' },
        { c: 7,  text: 'Caudal\n(l/s)' },
        { c: 8,  text: 'Longitud\n(m)' },
        { c: 9,  text: 'Diámetro\nplg' },
        { c: 10, cEnd: 17, text: 'Longitud Equivalente (m)' },
        { c: 18, text: 'Long.\nTotal(m)' },
        { c: 19, text: 'Coef.\nRug.H-W' },
        { c: 20, text: 'S\n(m/m)' },
        { c: 21, text: 'Hf\n(m)' },
        { c: 22, text: 'H. Piez.\n(m)' },
        { c: 23, text: 'Velocidad\n(m/s)' },
        { c: 24, text: 'Presión\n(mca)' },
        { c: 25, cEnd: 26, text: 'VERIFICACIONES' },
    ];
    h1.forEach(({ c, cEnd, text }) => {
        if (cEnd) ws9.mergeCells(r, c, r, cEnd);
        const cell = ws9.getCell(r, c);
        cell.value = text;
        cell.font  = { bold: true, size: 8, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RR_HDR1 } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: rrBW, left: rrBW, bottom: rrBW, right: rrBW };
        if (cEnd) {
            for (let cc = c + 1; cc <= cEnd; cc++) {
                ws9.getCell(r, cc).fill = { type: 'pattern', pattern: 'solid',
                    fgColor: { argb: RR_HDR1 } };
            }
        }
    });
    r++;

    // Fila 2
    rrFill(r, RR_HDR2, 24);
    const h2: Array<{ c: number; text: string }> = [
        { c: 2,  text: 'Seg.' },
        { c: 3,  text: 'Pto.' },
        { c: 4,  text: 'Cota\n(m)' },
        { c: 5,  text: 'Parcial' },
        { c: 6,  text: 'Total' },
        { c: 7,  text: 'Q' },
        { c: 8,  text: 'L' },
        { c: 9,  text: 'Ø plg' },
        { c: 10, text: 'N°' },
        { c: 11, text: accLabels.codo90 || 'Codo 90°' },
        { c: 12, text: 'N°' },
        { c: 13, text: accLabels.tee || 'Tee' },
        { c: 14, text: 'N°' },
        { c: 15, text: accLabels.val_compuerta || 'Val. Comp.' },
        { c: 16, text: 'N°' },
        { c: 17, text: accLabels.reduccion2 || 'Reduc. 2' },
        { c: 18, text: 'L. Tot.' },
        { c: 19, text: 'C' },
        { c: 20, text: 'S' },
        { c: 21, text: 'Hf' },
        { c: 22, text: 'Hpz.' },
        { c: 23, text: 'V' },
        { c: 24, text: 'P' },
        { c: 25, text: '0.60<V\n<Adm?' },
        { c: 26, text: 'P>2\nmca?' },
    ];
    h2.forEach(({ c, text }) => {
        const cell = ws9.getCell(r, c);
        cell.value = text;
        cell.font  = { bold: true, size: 7, name: 'Arial', color: { argb: 'FFFFFFFF' } };
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RR_HDR2 } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: rrBW, left: rrBW, bottom: rrBW, right: rrBW };
    });
    r++;
    return r;
}

// Fila de datos 
function rrDataRow(r: number, row: any, idx: number): void {
    const isStatic = row.isStatic;
    const bg = isStatic ? RR_ORANG : (idx % 2 === 0 ? RR_BLANC : RR_LBLUE);
    rrFill(r, bg, 16);

    const n = (v: any, d = 3) => {
        const f = parseFloat(v);
        return isFinite(f) ? f : null;
    };

    const verif = (val: string): { text: string; bg: string; color: string } => {
        if (!val || val === '') return { text: '-', bg: bg, color: RR_NEGRO };
        const v = String(val).toLowerCase();
        if (v === 'cumple' || v === 'ok' || v === 'si' || v === 'sí')
            return { text: 'cumple', bg: 'FFE2EFDA', color: 'FF375623' };
        if (v === 'no cumple' || v === 'no')
            return { text: 'no cumple', bg: 'FFFFC7CE', color: 'FF9C0006' };
        return { text: val, bg: bg, color: RR_NEGRO };
    };

    const cols: Array<{ c: number; val: any; bg2?: string; color?: string;
        bold?: boolean; numFmt?: string }> = [
        { c: 2,  val: row.segmento    || '' },
        { c: 3,  val: row.punto        || '' },
        { c: 4,  val: n(row.cota),       bg2: isStatic ? RR_LGRAY : RR_LYELL, numFmt: '0.000' },
        { c: 5,  val: isStatic ? '' : (row.uh_parcial !== '' && row.uh_parcial != null ? n(row.uh_parcial) : '') },
        { c: 6,  val: isStatic ? '' : n(row.uh_total),   bg2: RR_LYELL, numFmt: '0.000' },
        { c: 7,  val: isStatic ? '' : n(row.caudal),     bg2: RR_YELLOW, bold: true, numFmt: '0.000' },
        { c: 8,  val: isStatic ? '' : n(row.longitud),   numFmt: '0.00' },
        { c: 9,  val: isStatic ? '' : (row.diametro || '') },
        { c: 10, val: isStatic ? '' : (n(row.n1) ?? '') },
        { c: 11, val: isStatic ? '' : n(row.codo90),     numFmt: '0.000' },
        { c: 12, val: isStatic ? '' : (n(row.n2) ?? '') },
        { c: 13, val: isStatic ? '' : n(row.tee),        numFmt: '0.000' },
        { c: 14, val: isStatic ? '' : (n(row.n3) ?? '') },
        { c: 15, val: isStatic ? '' : n(row.val_compuerta), numFmt: '0.000' },
        { c: 16, val: isStatic ? '' : (n(row.n4) ?? '') },
        { c: 17, val: isStatic ? '' : n(row.reduccion2), numFmt: '0.000' },
        { c: 18, val: isStatic ? '' : n(row.longitudtotal), bg2: RR_LYELL, numFmt: '0.00' },
        { c: 19, val: isStatic ? (n(row.coefrug) ?? '') : n(row.coefrug), numFmt: '0' },
        { c: 20, val: isStatic ? '' : n(row.s),          numFmt: '0.00000' },
        { c: 21, val: isStatic ? '' : n(row.hf),         numFmt: '0.00' },
        { c: 22, val: n(row.hpiez),                       bg2: RR_YELLOW, bold: true, numFmt: '0.000' },
        { c: 23, val: isStatic ? '' : n(row.velocidad),  numFmt: '0.00' },
        { c: 24, val: isStatic ? '' : n(row.presion),    bg2: isStatic ? bg : RR_LYELL, numFmt: '0.000' },
    ];

    cols.forEach(({ c, val, bg2, color, bold, numFmt }) => {
        const cell = ws9.getCell(r, c);
        cell.value = val ?? null;
        cell.font  = { bold: bold ?? false, size: 8, name: 'Arial',
                       color: { argb: color ?? RR_NEGRO } };
        cell.fill  = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: bg2 ?? bg } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: rrBT, left: rrBT, bottom: rrBT, right: rrBT };
        if (numFmt && val !== null && val !== '' && !isNaN(parseFloat(val))) {
            cell.numFmt = numFmt;
        }
    });

    // Verificaciones
    const v1 = verif(row.verificacion1);
    const v2 = verif(row.verificacion2);
    [{ c: 25, v: v1 }, { c: 26, v: v2 }].forEach(({ c, v }) => {
        const cell = ws9.getCell(r, c);
        cell.value = isStatic ? '' : v.text;
        cell.font  = { bold: true, size: 7, name: 'Arial', color: { argb: v.color } };
        cell.fill  = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: isStatic ? bg : v.bg } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: rrBT, left: rrBT, bottom: rrBT, right: rrBT };
    });
}

// Leer datos 
const rrData      = dataSheet.redRiego || {};
const rrConfig    = rrData.config || { npisoterminado: 0.65, altasumfondotanqueelevado: 13.85 };
const rrGrades    = rrData.grades || { inicial: true, primaria: false, secundaria: false };
const rrTables    = rrData.tables || {};
const rrAccCfg    = rrData.accesoriosConfig || {
    inicial:    { codo90:'codo90', tee:'tee', val_compuerta:'valCompuerta', reduccion2:'reduccion2' },
    primaria:   { codo90:'codo90', tee:'tee', val_compuerta:'valCompuerta', reduccion2:'reduccion2' },
    secundaria: { codo90:'codo90', tee:'tee', val_compuerta:'valCompuerta', reduccion2:'reduccion2' },
};

const rrNivel = parseFloat(
    (parseFloat(rrConfig.npisoterminado || 0.65) +
     parseFloat(rrConfig.altasumfondotanqueelevado || 13.85)).toFixed(3)
);

const rrAccNames: Record<string, string> = {
    codo90:'Codo 90°', codo45:'Codo 45°', tee:'Tee',
    valCompuerta:'Val. Comp.', valCheck:'Val. Check',
    canastilla:'Canastilla', reduccion1:'Reduc. 1', reduccion2:'Reduc. 2',
};

const rrGradeNames: Record<string, string> = {
    inicial:'INICIAL', primaria:'PRIMARIA', secundaria:'SECUNDARIA',
};

const rrSelectedGrades = Object.keys(rrGrades).filter(g => rrGrades[g]);

 rr7 = 1; 

// TÍTULO PRINCIPAL
rrMainTitle(rr7, '9. CÁLCULO DE LA RED DE RIEGO'); rr7++;
rrSep(rr7, 14); rr7++;

// CONFIGURACIÓN
rrFill(rr7, RR_HDR1, 22);
ws9.mergeCells(rr7, 2, rr7, RR_LAST);
const rrCfgHdr = ws9.getCell(rr7, 2);
rrCfgHdr.value = 'CONFIGURACIÓN DEL SISTEMA';
rrCfgHdr.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FFFFFFFF' } };
rrCfgHdr.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RR_HDR1 } };
rrCfgHdr.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
rrCfgHdr.border = { top: rrBM, left: rrBM, bottom: rrBM, right: rrBM };
rr7++;
rrSep(rr7, 6); rr7++;

const rrCfgRows = [
    { label: 'Nivel de Piso Terminado',
      val: parseFloat(rrConfig.npisoterminado || 0.65), unit: 'm' },
    { label: 'Altura Asumida Fondo Tanque Elevado',
      val: parseFloat(rrConfig.altasumfondotanqueelevado || 13.85), unit: 'm' },
    { label: 'Nivel Asumido Fondo Tanque Elevado (calculado)',
      val: rrNivel, unit: 'm', computed: true },
];
rrCfgRows.forEach((cfg, idx) => {
    const bg = idx % 2 === 0 ? RR_BLANC : 'FFF8F8F8';
    rrFill(rr7, bg, 19);
    ws9.mergeCells(rr7, 2, rr7, 10);
    const lc = ws9.getCell(rr7, 2);
    lc.value = cfg.label;
    lc.font  = { size: 9, name: 'Arial', color: { argb: RR_NEGRO } };
    lc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    lc.alignment = { horizontal: 'right', vertical: 'middle' };
    lc.border = { top: rrBT, left: rrBT, bottom: rrBT, right: rrBT };
    for (let c = 3; c <= 10; c++) {
        ws9.getCell(rr7, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: bg } };
        ws9.getCell(rr7, c).border = { top: rrBT, bottom: rrBT };
    }
    const vc = ws9.getCell(rr7, 11);
    vc.value  = cfg.val;
    vc.numFmt = '0.000';
    vc.font   = { bold: true, size: 10, name: 'Arial', color: { argb: RR_NEGRO } };
    vc.fill   = { type: 'pattern', pattern: 'solid',
        fgColor: { argb: cfg.computed ? RR_BLANC : RR_YELLOW } };
    vc.alignment = { horizontal: 'center', vertical: 'middle' };
    vc.border = { top: rrBT, left: rrBT, bottom: rrBT, right: rrBT };
    const uc = ws9.getCell(rr7, 12);
    uc.value = cfg.unit;
    uc.font  = { size: 8, name: 'Arial', color: { argb: RR_NEGRO } };
    uc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    uc.alignment = { horizontal: 'left', vertical: 'middle' };
    uc.border = { top: rrBT, left: rrBT, bottom: rrBT, right: rrBT };
    for (let c = 13; c <= RR_LAST; c++) {
        ws9.getCell(rr7, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: bg } };
        ws9.getCell(rr7, c).border = { top: rrBT, bottom: rrBT,
            right: c === RR_LAST ? rrBM : rrBT };
    }
    rr7++;
});
rrSep(rr7, 16); rr7++;

// TABLAS POR GRADO
if (rrSelectedGrades.length === 0) {
    rrFill(rr7, RR_LYELL, 24);
    ws9.mergeCells(rr7, 2, rr7, RR_LAST);
    const noData = ws9.getCell(rr7, 2);
    noData.value = 'No hay grados seleccionados para exportar.';
    noData.font  = { italic: true, size: 9, name: 'Arial', color: { argb: 'FF996600' } };
    noData.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RR_LYELL } };
    noData.alignment = { horizontal: 'center', vertical: 'middle' };
    rr7++;
}

rrSelectedGrades.forEach(grade => {
    let rrModules: any[] = [];
    const gradeData = rrTables[grade];
    if (gradeData) {
        if (Array.isArray(gradeData)) {
            rrModules = gradeData;
        } else if (gradeData.modules) {
            rrModules = gradeData.modules;
        }
    }

    // Barra de grado
    rrGradeBar(rr7, `NIVEL ${rrGradeNames[grade]} — RED DE RIEGO`); rr7++;
    rrSep(rr7, 10); rr7++;

    if (rrModules.length === 0) {
        rrFill(rr7, RR_LYELL, 20);
        ws9.mergeCells(rr7, 2, rr7, RR_LAST);
        const noMod = ws9.getCell(rr7, 2);
        noMod.value = `Sin módulos para el nivel ${rrGradeNames[grade]}.`;
        noMod.font  = { italic: true, size: 9, name: 'Arial', color: { argb: 'FF888888' } };
        noMod.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RR_LYELL } };
        noMod.alignment = { horizontal: 'center', vertical: 'middle' };
        rr7++;
        rrSep(rr7, 16); rr7++;
        return;
    }

    const gradeAcc = rrAccCfg[grade] || rrAccCfg.inicial;
    const accLabels = {
        codo90:        rrAccNames[gradeAcc.codo90]        || 'Codo 90°',
        tee:           rrAccNames[gradeAcc.tee]           || 'Tee',
        val_compuerta: rrAccNames[gradeAcc.val_compuerta] || 'Val. Comp.',
        reduccion2:    rrAccNames[gradeAcc.reduccion2]    || 'Reduc. 2',
    };

    rrModules.forEach((modulo: any, modIdx: number) => {
        const rows: any[] = Array.isArray(modulo.data) ? modulo.data : [];
        const modName = modulo.nombre ||
            `CÁLCULO DE RED DE RIEGO ${modIdx + 1} - ${grade.toUpperCase()}`;

        // Título módulo
        rrModuleTitle(rr7, modName); rr7++;

        // Encabezados
        rr7 = rrDrawHeaders(rr7, accLabels);

        // Filas de datos
        if (rows.length === 0) {
            rrFill(rr7, RR_BLANC, 16);
            ws9.mergeCells(rr7, 2, rr7, RR_LAST);
            const emptyR = ws9.getCell(rr7, 2);
            emptyR.value = 'Sin datos.';
            emptyR.font  = { italic: true, size: 8, name: 'Arial',
                             color: { argb: 'FF888888' } };
            emptyR.fill  = { type: 'pattern', pattern: 'solid',
                fgColor: { argb: RR_BLANC } };
            emptyR.alignment = { horizontal: 'center', vertical: 'middle' };
            rr7++;
        } else {
            let dataIdx = 0;
            rows.forEach((row: any) => {
                rrDataRow(rr7, row, row.isStatic ? -1 : dataIdx);
                if (!row.isStatic) dataIdx++;
                rr7++;
            });
        }

        // Separador entre módulos
        rrSep(rr7, 14); rr7++;
    });

    rrSep(rr7, 18); rr7++;
});

// RESUMEN FINAL 
rrFill(rr7, RR_HDR1, 22);
ws9.mergeCells(rr7, 2, rr7, RR_LAST);
const rrResHdr = ws9.getCell(rr7, 2);
rrResHdr.value = 'RESUMEN — RED DE RIEGO';
rrResHdr.font  = { bold: true, size: 10, name: 'Arial', color: { argb: 'FFFFFFFF' } };
rrResHdr.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RR_HDR1 } };
rrResHdr.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
rrResHdr.border = { top: rrBM, left: rrBM, bottom: rrBM, right: rrBM };
rr7++;
rrSep(rr7, 8); rr7++;

rrSelectedGrades.forEach((grade, idx) => {
    const gradeData = rrTables[grade];
    let rrMods: any[] = [];
    if (gradeData) {
        if (Array.isArray(gradeData)) rrMods = gradeData;
        else if (gradeData.modules) rrMods = gradeData.modules;
    }
    const totalCircuitos = rrMods.length;
    const bg = idx % 2 === 0 ? RR_BLANC : RR_LBLUE;
    rrFill(rr7, bg, 19);

    ws9.mergeCells(rr7, 2, rr7, 10);
    const gc = ws9.getCell(rr7, 2);
    gc.value = `NIVEL ${rrGradeNames[grade]}`;
    gc.font  = { bold: true, size: 9, name: 'Arial', color: { argb: RR_NEGRO } };
    gc.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    gc.alignment = { horizontal: 'left', vertical: 'middle', indent: 2 };
    gc.border = { top: rrBT, left: rrBM, bottom: rrBT, right: rrBT };
    for (let c = 3; c <= 10; c++) {
        ws9.getCell(rr7, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: bg } };
        ws9.getCell(rr7, c).border = { top: rrBT, bottom: rrBT };
    }

    ws9.mergeCells(rr7, 11, rr7, 15);
    const gv = ws9.getCell(rr7, 11);
    gv.value = `${totalCircuitos} circuito${totalCircuitos !== 1 ? 's' : ''} / módulo${totalCircuitos !== 1 ? 's' : ''}`;
    gv.font  = { bold: true, size: 9, name: 'Arial', color: { argb: 'FF1F4E78' } };
    gv.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: RR_YELLOW } };
    gv.alignment = { horizontal: 'center', vertical: 'middle' };
    gv.border = { top: rrBT, left: rrBT, bottom: rrBT, right: rrBT };
    for (let c = 12; c <= 15; c++) {
        ws9.getCell(rr7, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: RR_YELLOW } };
        ws9.getCell(rr7, c).border = { top: rrBT, bottom: rrBT };
    }

    ws9.mergeCells(rr7, 16, rr7, 20);
    const gn = ws9.getCell(rr7, 16);
    gn.value = `Nivel tanque: ${rrNivel.toFixed(3)} m`;
    gn.font  = { size: 8, name: 'Arial', color: { argb: RR_NEGRO } };
    gn.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    gn.alignment = { horizontal: 'center', vertical: 'middle' };
    gn.border = { top: rrBT, left: rrBT, bottom: rrBT, right: rrBT };
    for (let c = 17; c <= 20; c++) {
        ws9.getCell(rr7, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: bg } };
        ws9.getCell(rr7, c).border = { top: rrBT, bottom: rrBT };
    }
    for (let c = 21; c <= RR_LAST; c++) {
        ws9.getCell(rr7, c).fill = { type: 'pattern', pattern: 'solid',
            fgColor: { argb: bg } };
        ws9.getCell(rr7, c).border = { top: rrBT, bottom: rrBT,
            right: c === RR_LAST ? rrBM : rrBT };
    }
    rr7++;
});

rrSep(rr7, 16); rr7++;
 
    // GENERAR ARCHIVO
    // =========================================================================
    // Exportación y descargas
    // Add headers/footers BEFORE write buffer
    if (proyecto) {
        for (const sheet of workbook.worksheets) {
            const numCols = sheet.columns?.length || sheet.columnCount || 5;
            await addProjectHeaderAndFooter(workbook, sheet, proyecto, numCols, 'MEMORIA DE CÁLCULO DE AGUA');
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
}