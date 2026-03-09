import ExcelJS from 'exceljs';
import { IceCreamIcon } from 'lucide-react';
import { generateKeyPairSync } from 'node:crypto';
import { globalAgent } from 'node:http';
import { fromTheme } from 'tailwind-merge';

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
       // ========== HOJA 1: UNIDADES DE DESCARGA — TABLA 1 COMPLETA ==========
const wsUD = workbook.addWorksheet('Unidades de Descarga');
wsUD.columns = [
    { width: 3  }, // Col 1 — espaciador
    { width: 25 }, // Col 2 — Aparato Sanitario
    { width: 40 }, // Col 3 — TIPO
    { width: 10 }, // Col 4 — Total
    { width: 10 }, // Col 5
    { width: 10 }, // Col 6
    { width: 10 }, // Col 7
    { width: 10 }, // Col 8
    { width: 10 }, // Col 9
    { width: 8  }, // Col 10
];

const AMAR  = 'FFFFFF99';
const VERD  = 'FFD9E8C4';
const VERDE = 'FF92D050';
const AZUL1 = 'FFE8F0FB';
const AZUL2 = 'FFDCE6F1';
const BORDH = 'FF999933';
const BORD  = 'FFA0A0A0';
const NEGRO = 'FF000000';
const ROJO  = 'FFCC0000';
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

// ── Fila 1: Barra verde solo hasta col 4 ─────────────────────────────────────
udFill(1, BLANC, 22);
for (let c = 2; c <= 4; c++) {
    const cell = wsUD.getCell(1, c);
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } };
    cell.border = { top: bM, left: c === 2 ? bM : undefined, bottom: bM, right: c === 4 ? bM : undefined };
}
wsUD.getCell(1, 2).value     = 'ANEXO 07.  CALCULO DE LAS UNIDADES DE DESCARGA';
wsUD.getCell(1, 2).font      = { bold: true, size: 11, name: 'Arial', color: { argb: NEGRO } };
wsUD.getCell(1, 2).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

// ── Fila 2: separador ────────────────────────────────────────────────────────
udFill(2, BLANC, 8);

// ── Fila 3: "ANEXO N° 06" amarillo cols 2-4 ──────────────────────────────────
udFill(3, BLANC, 20);
for (let c = 2; c <= 4; c++) {
    const cell = wsUD.getCell(3, c);
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMAR } };
    cell.border    = { top: bM, left: c === 2 ? bM : bT, bottom: bT, right: c === 4 ? bM : bT };
}
wsUD.getCell(3, 2).value     = 'ANEXO N° 06';
wsUD.getCell(3, 2).font      = { bold: true, size: 11, name: 'Arial', color: { argb: NEGRO } };
wsUD.getCell(3, 2).alignment = { horizontal: 'center', vertical: 'middle' };

// ── Fila 4: encabezados ───────────────────────────────────────────────────────
udFill(4, BLANC, 20);
['Aparato Sanitario', 'TIPO', 'Total'].forEach((txt, i) => {
    const cell     = wsUD.getCell(4, i + 2);
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMAR } };
    cell.value     = txt;
    cell.font      = { bold: true, size: 10, name: 'Arial', color: { argb: NEGRO } };
    cell.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle' };
    cell.border    = { top: bT, left: i === 0 ? bM : bT, bottom: bM, right: i === 2 ? bM : bT };
});

// ── Datos tabla 1 ─────────────────────────────────────────────────────────────
const udDataRaw = dataSheet['ud'];
const udData = (udDataRaw && Object.keys(udDataRaw).length > 0) ? udDataRaw : {
    'inodoro_1':  { description: 'Inodoro',                 tipo: 'Con Tanque - Descarga reducida',                 total: 2 },
    'inodoro_2':  { description: 'Inodoro',                 tipo: 'Con Tanque',                                     total: 4 },
    'inodoro_3':  { description: 'Inodoro',                 tipo: 'C/ Válvula semiautomática y automática',         total: 8 },
    'inodoro_4':  { description: 'Inodoro',                 tipo: 'C/ Válvula semiaut. y autom.  descarga reducida',total: 4 },
    'lavatorio':  { description: 'Lavatorio',               tipo: 'Corriente',                                      total: 2 },
    'lavadero':   { description: 'Lavadero',                tipo: 'Cocina, ropa',                                   total: 2 },
    'lavadero_t': { description: 'Lavadero con triturador', tipo: '-',                                              total: 3 },
    'ducha':      { description: 'Ducha',                   tipo: '-',                                              total: 3 },
    'tina':       { description: 'Tina',                    tipo: '-',                                              total: 3 },
    'urinario_1': { description: 'Urinario',                tipo: 'Con Tanque',                                     total: 4 },
    'urinario_2': { description: 'Urinario',                tipo: 'C/ Válvula semiautomática y automática',         total: 8 },
    'urinario_3': { description: 'Urinario',                tipo: 'C/ Válvula semiaut. y autom.  descarga reducida',total: 4 },
    'urinario_4': { description: 'Urinario',                tipo: 'Múltiple',                                       total: 4 },
    'bebedero':   { description: 'Bebedero',                tipo: 'Simple',                                         total: 2 },
    'sumidero':   { description: 'Sumidero',                tipo: 'Simple',                                         total: 2 },
};

let row = 5;

Object.entries(udData).forEach(([key, value]: [string, any]) => {
    const v: any = typeof value === 'object' ? value : {};
    udFill(row, BLANC, 17);

    for (let c = 2; c <= 4; c++) {
        const cell = wsUD.getCell(row, c);
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLANC } };
        cell.border    = { top: bD, left: c === 2 ? bM : bD, bottom: bD, right: c === 4 ? bM : bD };
        cell.alignment = { horizontal: c <= 3 ? 'left' : 'center', vertical: 'middle' };
        cell.font      = { size: 10, name: 'Arial', color: { argb: NEGRO } };
    }

    wsUD.getCell(row, 2).value  = v.description ?? key;
    wsUD.getCell(row, 3).value  = v.tipo ?? v.notes ?? '';
    wsUD.getCell(row, 4).value  = v.total ?? v.udPerUnit ?? 0;
    wsUD.getCell(row, 4).numFmt = '0';
    row++;
});

// ── Separador entre tabla 1 y tabla 2 ────────────────────────────────────────
udFill(row, BLANC, 8); row++;
udFill(row, BLANC, 8); row++; 
        

// ══════════════════════════════════════════════════════════════════════════════
// TABLA 2 — SUMATORIA PRIMARIA
// ══════════════════════════════════════════════════════════════════════════════
const aparatos: { nombre: string; ud: number }[] = dataSheet['udConfig'] ?? [
    { nombre: 'Inodoro',   ud: 4 },
    { nombre: 'Urinario',  ud: 4 },
    { nombre: 'Lavatorio', ud: 2 },
    { nombre: 'Ducha',     ud: 4 },
    { nombre: 'Lavadero',  ud: 3 },
    { nombre: 'SUMIDERO',  ud: 2 },
];

// Cols: 2=NIVEL, 3=DESC, 4-9=aparatos, 10=U.D
const [rA, rB, rC] = [row, row + 1, row + 2];

// Fila A
udFill(rA, BLANC, 20);
for (let c = 2; c <= 10; c++) {
    const cell = wsUD.getCell(rA, c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: (c >= 4 && c <= 9) ? VERD : AMAR } };
    cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: NEGRO } };
    if (c === 2)  { cell.value = 'NIVEL';       cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = { top: bM, left: bM, bottom: undefined, right: bT }; }
    else if (c === 3)  { cell.value = 'DESCRIPCION'; cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = { top: bM, left: bT, bottom: undefined, right: bT }; }
    else if (c === 4)  { cell.value = 'SUMATORIA DE GASTOS POR ACCESORIOS - PRIMARIA'; cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }; cell.border = { top: bM, left: bM, bottom: bT, right: undefined }; }
    else if (c >= 5 && c <= 8) { cell.border = { top: bM, left: undefined, bottom: bT, right: undefined }; }
    else if (c === 9)  { cell.border = { top: bM, left: undefined, bottom: bT, right: bT }; }
    else if (c === 10) { cell.value = 'U.D'; cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = { top: bM, left: bT, bottom: undefined, right: bM }; }
}

// Fila B
udFill(rB, AMAR, 16);
for (let c = 2; c <= 10; c++) {
    const cell = wsUD.getCell(rB, c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMAR } };
    cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: NEGRO } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    if (c === 2)       cell.border = { top: undefined, left: bM, bottom: undefined, right: bT };
    else if (c === 3)  cell.border = { top: undefined, left: bT, bottom: undefined, right: bT };
    else if (c === 10) cell.border = { top: undefined, left: bT, bottom: undefined, right: bM };
    else if (c === 4)  { cell.value = aparatos[0].nombre; cell.border = { top: bT, left: bM, bottom: bT, right: bT }; }
    else if (c === 9)  { cell.value = aparatos[5].nombre; cell.border = { top: bT, left: bT, bottom: bT, right: bT }; }
    else               { cell.value = aparatos[c-4].nombre; cell.border = { top: bT, left: bT, bottom: bT, right: bT }; }
}

// Fila C
udFill(rC, AMAR, 16);
for (let c = 2; c <= 10; c++) {
    const cell = wsUD.getCell(rC, c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMAR } };
    cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: NEGRO } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    if (c === 2)       cell.border = { top: undefined, left: bM, bottom: bM, right: bT };
    else if (c === 3)  cell.border = { top: undefined, left: bT, bottom: bM, right: bT };
    else if (c === 10) cell.border = { top: undefined, left: bT, bottom: bM, right: bM };
    else if (c === 4)  { cell.value = `${aparatos[0].ud} U.D.`; cell.border = { top: bT, left: bM, bottom: bM, right: bT }; }
    else if (c === 9)  { cell.value = `${aparatos[5].ud} U.D.`; cell.border = { top: bT, left: bT, bottom: bM, right: bT }; }
    else               { cell.value = `${aparatos[c-4].ud} U.D.`; cell.border = { top: bT, left: bT, bottom: bM, right: bT }; }
}
row += 3;

const sumatoriaData: any[] = dataSheet['sumatoria'] ?? [
    { nivel: 'MODULO I', isModulo: true },
    { nivel: 'PRIMER NIVEL',  descripcion: 'DUCHA+VESTIDOR MUJERES',   lavatorio: 2, sumidero: 1, ud: 10 },
    { nivel: 'PRIMER NIVEL',  descripcion: 'DUCHA+VESTIDOR VARONES',   lavatorio: 2, sumidero: 1, ud: 10 },
    { nivel: 'PRIMER NIVEL',  descripcion: 'DUCHA+VESTIDOR DISCAP.',   lavatorio: 1, sumidero: 2, ud: 8  },
    { nivel: 'PRIMER NIVEL',  descripcion: 'DEPOSITO MAT. DEPORT.',    ud: 0 },
    { nivel: 'PRIMER NIVEL',  descripcion: 'DEPOSITO DE SUM.',         ud: 0 },
    { nivel: 'PRIMER NIVEL',  descripcion: 'MAESTRANZA+ALM. GRAL.',    ud: 0 },
    { nivel: 'PRIMER NIVEL',  descripcion: 'CTO. TABLEROS',            ud: 0 },
    { nivel: 'PRIMER NIVEL',  descripcion: 'CTO. ELECTRICO',           ud: 0 },
    { nivel: 'MODULO II', isModulo: true },
    { nivel: 'PRIMER NIVEL',  descripcion: 'SUM/COMEDOR',              ud: 0 },
    { nivel: 'SEGUNDO NIVEL', descripcion: 'MODULO DE CONECTIVIDAD',   ud: 0 },
    { nivel: 'SEGUNDO NIVEL', descripcion: 'AIP',                      ud: 0 },
    { nivel: 'MODULO III', isModulo: true },
    { nivel: 'PRIMER NIVEL',  descripcion: 'BIBLIOTECA',               ud: 0 },
    { nivel: 'PRIMER NIVEL',  descripcion: 'ALMACEN DE LIBROS',        ud: 0 },
    { nivel: 'SEGUNDO NIVEL', descripcion: 'TALLER CREATIVO/ARTE',     lavatorio: 2, sumidero: 1, ud: 8 },
    { nivel: 'SEGUNDO NIVEL', descripcion: 'AREA GUARDADO/EXP. TRAB.', ud: 0 },
    { nivel: 'MODULO V', isModulo: true },
    { nivel: 'PRIMER NIVEL',  descripcion: 'AULA PRIMARIA',            ud: 0 },
    { nivel: 'TERCER NIVEL', descripcion: '', },
    { nivel: 'TERCER NIVEL', descripcion: '', },
    { nivel: 'TERCER NIVEL', descripcion: '', },
    { nivel: 'TERCER NIVEL', descripcion: '', },
    { nivel: 'TERCER NIVEL', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: 'MODULO VI', isModulo: true},
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: 'MODULO VII', isModulo: true},
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: 'MODULO VIII', isModulo: true},
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: 'SEGUNDO NIVEL', descripcion: '', },
    { nivel: 'SEGUNDO NIVEL', descripcion: '', },
    { nivel: 'SEGUNDO NIVEL', descripcion: '', },
    { nivel: 'SEGUNDO NIVEL', descripcion: '', },
    { nivel: 'SEGUNDO NIVEL', descripcion: '', },
    { nivel: 'MODULO IX', isModulo: true},
    { nivel: 'PRIMER NIVEL', descripcion: '', },
    { nivel: 'PRIMER NIVE', descripcion: '', },
    { nivel: 'PRIMER NIVEL', descripcion: '', },
    { nivel: 'PRIMER NIVEL', descripcion: '', },
    { nivel: 'SEGUNDO NIVEL', descripcion: '', },
    { nivel: 'SEGUNDO NIVEL', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: 'TERCER NIVEL', descripcion: '', },
    { nivel: 'MODEL X', isModulo: true},
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: 'SEGUNDO NIVEL', descripcion: '', },
    { nivel: 'SEGUNDO NIVEL', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: 'PRIMER NIVEL', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },
    { nivel: '', descripcion: '', },







];

const t2Start = row;
sumatoriaData.forEach((item: any, idx: number) => {
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
        [item.inodoro, item.urinario, item.lavatorio, item.ducha, item.lavadero, item.sumidero]
            .forEach((v, i) => {
                const cell = wsUD.getCell(row, 4 + i);
                cell.value = (v !== null && v !== undefined && v !== '') ? v : null;
                if (typeof v === 'number') cell.numFmt = '0';
            });
        const ud = item.ud ?? null;
        wsUD.getCell(row, 10).value = ud;
        if (typeof ud === 'number') wsUD.getCell(row, 10).numFmt = '0';
    }
    row++;
});

// Total tabla 2 — SUM automático en todas las cols numéricas
const rowTotalT2 = row;
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
        const col = ['D','E','F','G','H','I','J'][c - 4];
        cell.value  = { formula: `SUM(${col}${t2Start}:${col}${row - 1})` };
        cell.numFmt = '0';
    }
}
row++;

// ── Separador entre tabla 2 y tabla 3 ────────────────────────────────────────
for (let i = 0; i < 5; i++) { udFill(row, BLANC, 8); row++; }

// ══════════════════════════════════════════════════════════════════════════════
// TABLA 3 — SUMATORIA INICIAL
// ══════════════════════════════════════════════════════════════════════════════
const aparatosT3: { nombre: string; ud: number }[] = dataSheet['udConfigInicial'] ?? [
    { nombre: 'Inodoro',   ud: 4 },
    { nombre: 'Urinario',  ud: 4 },
    { nombre: 'Lavatorio', ud: 2 },
    { nombre: 'Ducha',     ud: 4 },
    { nombre: 'Lavadero',  ud: 3 },
    { nombre: 'SUMIDERO',  ud: 2 },
];

const [rA3, rB3, rC3] = [row, row + 1, row + 2];

// Fila A
udFill(rA3, BLANC, 20);
for (let c = 2; c <= 10; c++) {
    const cell = wsUD.getCell(rA3, c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: (c >= 4 && c <= 9) ? VERD : AMAR } };
    cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: NEGRO } };
    if (c === 2)  { cell.value = 'NIVEL';       cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = { top: bM, left: bM, bottom: undefined, right: bT }; }
    else if (c === 3)  { cell.value = 'DESCRIPCION'; cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = { top: bM, left: bT, bottom: undefined, right: bT }; }
    else if (c === 4)  { cell.value = 'SUMATORIA DE GASTOS POR ACCESORIOS - INICIAL'; cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }; cell.border = { top: bM, left: bM, bottom: bT, right: undefined }; }
    else if (c >= 5 && c <= 8) { cell.border = { top: bM, left: undefined, bottom: bT, right: undefined }; }
    else if (c === 9)  { cell.border = { top: bM, left: undefined, bottom: bT, right: bT }; }
    else if (c === 10) { cell.value = 'U.D'; cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = { top: bM, left: bT, bottom: undefined, right: bM }; }
}

// Fila B
udFill(rB3, AMAR, 16);
for (let c = 2; c <= 10; c++) {
    const cell = wsUD.getCell(rB3, c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMAR } };
    cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: NEGRO } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    if (c === 2)       cell.border = { top: undefined, left: bM, bottom: undefined, right: bT };
    else if (c === 3)  cell.border = { top: undefined, left: bT, bottom: undefined, right: bT };
    else if (c === 10) cell.border = { top: undefined, left: bT, bottom: undefined, right: bM };
    else if (c === 4)  { cell.value = aparatosT3[0].nombre; cell.border = { top: bT, left: bM, bottom: bT, right: bT }; }
    else if (c === 9)  { cell.value = aparatosT3[5].nombre; cell.border = { top: bT, left: bT, bottom: bT, right: bT }; }
    else               { cell.value = aparatosT3[c-4].nombre; cell.border = { top: bT, left: bT, bottom: bT, right: bT }; }
}

// Fila C
udFill(rC3, AMAR, 16);
for (let c = 2; c <= 10; c++) {
    const cell = wsUD.getCell(rC3, c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMAR } };
    cell.font = { bold: true, size: 9, name: 'Arial', color: { argb: NEGRO } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    if (c === 2)       cell.border = { top: undefined, left: bM, bottom: bM, right: bT };
    else if (c === 3)  cell.border = { top: undefined, left: bT, bottom: bM, right: bT };
    else if (c === 10) cell.border = { top: undefined, left: bT, bottom: bM, right: bM };
    else if (c === 4)  { cell.value = `${aparatosT3[0].ud} U.D.`; cell.border = { top: bT, left: bM, bottom: bM, right: bT }; }
    else if (c === 9)  { cell.value = `${aparatosT3[5].ud} U.D.`; cell.border = { top: bT, left: bT, bottom: bM, right: bT }; }
    else               { cell.value = `${aparatosT3[c-4].ud} U.D.`; cell.border = { top: bT, left: bT, bottom: bM, right: bT }; }
}
row += 3;

const sumatoriaInicial: any[] = dataSheet['sumatoriaInicial'] ?? [
    { nivel: 'MODULO IX', isModulo: true },
    { nivel: 'PRIMER NIVEL', descripcion: 'AULA INICIAL 01',                                                    ud: 0  },
    { nivel: 'PRIMER NIVEL', descripcion: 'DEPOSITO AULA 01',                                                   ud: 0  },
    { nivel: 'PRIMER NIVEL', descripcion: 'ALMACEN GENERAL',                                                    ud: 0  },
    { nivel: 'PRIMER NIVEL', descripcion: 'SS.HH. NIÑOS',    inodoro: 2, urinario: 2, lavatorio: 2, sumidero: 2, ud: 24 },
    { nivel: 'PRIMER NIVEL', descripcion: 'SS.HH. NIÑAS',    inodoro: 2,              lavatorio: 2, sumidero: 2, ud: 16 },
    { nivel: 'PRIMER NIVEL', descripcion: 'SS.HH. DISCAPACITADOS', inodoro: 1, urinario: 1, lavatorio: 1, sumidero: 1, ud: 12 },
    { nivel: 'PRIMER NIVEL', descripcion: 'AULA INICIAL 02',                                                    ud: 0  },
    { nivel: 'PRIMER NIVEL', descripcion: 'AULA INICIAL 03',                                                    ud: 0  },
    { nivel: 'PRIMER NIVEL', descripcion: 'DEPOSITO AULA 02',                                                   ud: 0  },
    { nivel: 'PRIMER NIVEL', descripcion: 'DEPOSITO AULA 03',                                                   ud: 0  },
    { nivel: 'MODULO X', isModulo: true },
    { nivel: 'PRIMER NIVEL', descripcion: 'CUARTO DE LIMPIEZA',                             sumidero: 4,        ud: 8  },
    { nivel: 'PRIMER NIVEL', descripcion: 'DEP. COMBUSTIBLE',                                                   ud: 0  },
    { nivel: 'PRIMER NIVEL', descripcion: 'DESPENSA',                                                           ud: 0  },
    { nivel: 'PRIMER NIVEL', descripcion: 'DEP. SUM.',                                                          ud: 0  },
    { nivel: 'PRIMER NIVEL', descripcion: 'RECEP. E INSP. ALIMENTOS',       lavadero: 1, sumidero: 1,           ud: 5  },
    { nivel: 'PRIMER NIVEL', descripcion: 'COCINA',                          lavadero: 2, sumidero: 1,          ud: 8  },
    { nivel: 'PRIMER NIVEL', descripcion: 'SUM/COMEDOR/PSICOM.',                                                 ud: 0  },
    { nivel: 'PRIMER NIVEL', descripcion: 'SS.HH DOCENTES MIXTO', inodoro: 1, urinario: 1, lavatorio: 1, sumidero: 1, ud: 12 },
    { nivel: 'PRIMER NIVEL', descripcion: 'SS.HH DISCAPACITADOS',  inodoro: 1, urinario: 1, lavatorio: 1, sumidero: 1, ud: 12 },
    { nivel: 'MODULO XI', isModulo: true },
];

const t3Start = row;
sumatoriaInicial.forEach((item: any, idx: number) => {
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
        [item.inodoro, item.urinario, item.lavatorio, item.ducha, item.lavadero, item.sumidero]
            .forEach((v, i) => {
                const cell = wsUD.getCell(row, 4 + i);
                cell.value = (v !== null && v !== undefined && v !== '') ? v : null;
                if (typeof v === 'number') cell.numFmt = '0';
            });
        const ud = item.ud ?? null;
        wsUD.getCell(row, 10).value = ud;
        if (typeof ud === 'number') wsUD.getCell(row, 10).numFmt = '0';
    }
    row++;
});

// Total tabla 3 — SUM automático
const rowTotalT3 = row;
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
        const col = ['D','E','F','G','H','I','J'][c - 4];
        cell.value  = { formula: `SUM(${col}${t3Start}:${col}${row - 1})` };
        cell.numFmt = '0';
    }
}
row++;

// ── Separador antes de resúmenes finales ──────────────────────────────────────
for (let i = 0; i < 5; i++) { udFill(row, BLANC, 8); row++; }

// ── Resumen PRIMARIA ──────────────────────────────────────────────────────────
udFill(row, 'FFFFCC00', 24);

// Merge cols 2-8 solo para el label (no se lee de vuelta = sin riesgo null)
wsUD.mergeCells(row, 2, row, 8);
const cellPrimLabel = wsUD.getCell(row, 2);
cellPrimLabel.value     = 'UNIDADES DE DESCARGA TOTAL - PRIMARIA =';
cellPrimLabel.font      = { bold: true, size: 10, name: 'Arial', color: { argb: NEGRO } };
cellPrimLabel.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC00' } };
cellPrimLabel.alignment = { horizontal: 'center', vertical: 'middle' };
cellPrimLabel.border    = { top: bM, left: bM, bottom: bM, right: bM };

// Col 9: separador visual
wsUD.getCell(row, 9).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC00' } };
wsUD.getCell(row, 9).border = { top: bM, bottom: bM };

// Col 10: valor con borde cerrado
const cellPrimVal = wsUD.getCell(row, 10);
cellPrimVal.value  = { formula: `SUM(J${t2Start}:J${rowTotalT2 - 1})` };
cellPrimVal.numFmt = '0';
cellPrimVal.font   = { bold: true, size: 11, name: 'Arial', color: { argb: NEGRO } };
cellPrimVal.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC00' } };
cellPrimVal.alignment = { horizontal: 'center', vertical: 'middle' };
cellPrimVal.border = { top: bM, left: bM, bottom: bM, right: bM };
wsUD.getRow(row).height = 24;
row++;

// ── Separador ─────────────────────────────────────────────────────────────────
for (let i = 0; i < 3; i++) { udFill(row, BLANC, 8); row++; }

// ── Resumen INICIAL ───────────────────────────────────────────────────────────
udFill(row, 'FFFFCC00', 24);

wsUD.mergeCells(row, 2, row, 8);
const cellInicLabel = wsUD.getCell(row, 2);
cellInicLabel.value     = 'UNIDADES DE DESCARGA TOTAL - INICIAL =';
cellInicLabel.font      = { bold: true, size: 10, name: 'Arial', color: { argb: NEGRO } };
cellInicLabel.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC00' } };
cellInicLabel.alignment = { horizontal: 'center', vertical: 'middle' };
cellInicLabel.border    = { top: bM, left: bM, bottom: bM, right: bM };

wsUD.getCell(row, 9).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC00' } };
wsUD.getCell(row, 9).border = { top: bM, bottom: bM };

const cellInicVal = wsUD.getCell(row, 10);
cellInicVal.value  = { formula: `SUM(J${t3Start}:J${rowTotalT3 - 1})` };
cellInicVal.numFmt = '0';
cellInicVal.font   = { bold: true, size: 11, name: 'Arial', color: { argb: NEGRO } };
cellInicVal.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC00' } };
cellInicVal.alignment = { horizontal: 'center', vertical: 'middle' };
cellInicVal.border = { top: bM, left: bM, bottom: bM, right: bM };
wsUD.getRow(row).height = 24;
row++;

// ── Filas finales vacías ──────────────────────────────────────────────────────
for (let i = 0; i < 4; i++) { udFill(row, BLANC, 10); row++; }

        


        // ========== HOJA 2: COLECTOR ==========
        const wsColector = workbook.addWorksheet('Colector');
        wsColector.columns = [ { width: 30 }, { width: 20 }, { width: 15 }, { width: 40 } ];
        paintTitle(wsColector, 4, 'DISEÑO DEL COLECTOR');
        paintHeaders(wsColector, ['PARÁMETRO', 'VALOR', 'UNIDAD', 'DESCRIPCIÓN']);
        const colectorData = dataSheet['colector'] || {};
        let rowColector = 4;
        Object.entries(colectorData).forEach(([key, value]: [string, any]) => {
            if (!value) return;
            const row = wsColector.getRow(rowColector);
            row.getCell(1).value = key;
            const valor = value.valor ?? '';
            row.getCell(2).value = valor;
            row.getCell(3).value = value.unidad ?? '';
            row.getCell(4).value = value.descripcion ?? '';
            applyRowStyle(row, 4, [2]);
            if (typeof valor === 'number') row.getCell(2).numFmt = '0';
            rowColector++;
        });

        // ========== HOJA 3: CAJAS DE REGISTRO ==========
        const wsCajas = workbook.addWorksheet('Cajas de Registro');
        wsCajas.columns = [ { width: 10 }, { width: 18 }, { width: 15 }, { width: 15 }, { width: 30 } ];
        paintTitle(wsCajas, 5, 'CAJAS DE REGISTRO');
        paintHeaders(wsCajas, ['N°', 'PROFUNDIDAD (m)', 'DIÁMETRO (mm)', 'PENDIENTE (%)', 'MATERIALES']);
        const cajasData = dataSheet['cajas'] || [];
        let rowCajas = 4;
        (Array.isArray(cajasData) ? cajasData : []).forEach((caja: any, idx: number) => {
            const row = wsCajas.getRow(rowCajas);
            row.getCell(1).value = idx + 1;
            row.getCell(2).value = caja.profundidad || '';
            row.getCell(3).value = caja.diametro || '';
            row.getCell(4).value = caja.pendiente || '';
            row.getCell(5).value = caja.materiales || '';
            applyRowStyle(row, 5, [2, 3, 4]);
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
            const row = wsUV.getRow(rowUV);
            row.getCell(1).value = key;
            row.getCell(2).value = value.diametro || '';
            row.getCell(3).value = value.cantidad || 0;
            row.getCell(4).value = value.ubicacion || '';
            applyRowStyle(row, 4, [2, 3]);
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
            const row = wsTrampa.getRow(rowTrampa);
            row.getCell(1).value = key;
            let valor: any;
            let unidad = '';
            if (typeof value === 'object') {
                valor = value.valor ?? '';
                unidad = value.unidad ?? '';
            } else {
                valor = value;
            }
            row.getCell(2).value = valor;
            row.getCell(3).value = unidad;
            applyRowStyle(row, 3, [2]);
            if (typeof valor === 'number') row.getCell(2).numFmt = '0';
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