import ExcelJS from 'exceljs';

interface DesagueData {
    ud?: any;
    colector?: any;
    cajas?: any;
    uv?: any;
    trampa?: any;
    sumatoria?: any; // Para segunda tabla
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

        // ========== HOJA 1: UNIDADES DE DESCARGA (MODIFICADA) ==========
        const wsUD = workbook.addWorksheet('Unidades de Descarga');
        wsUD.columns = [
            { width: 25 }, // Aparato Sanitario / NIVEL
            { width: 30 }, // TIPO / DESCRIPCIÓN
            { width: 10 }, // Total / Inodoro
            { width: 10 }, // Urinario
            { width: 10 }, // Lavatorio
            { width: 10 }, // Ducha
            { width: 10 }, // Lavadero
            { width: 10 }, // SUMIDERO
        ];

        // ---- Título de la primera tabla (solo columnas A-C) ----
        wsUD.mergeCells(1, 1, 1, 3);
        const title1 = wsUD.getCell(1, 1);
        title1.value = 'CÁLCULO DE UNIDADES DE DESCARGA';
        title1.font = { bold: true, size: 16, color: { argb: COLORS.TITLE_TEXT } };
        title1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.GREEN } };
        title1.alignment = { horizontal: 'center', vertical: 'middle' };
        title1.border = {
            top: { style: 'thin', color: { argb: COLORS.BORDER } },
            left: { style: 'thin', color: { argb: COLORS.BORDER } },
            bottom: { style: 'thin', color: { argb: COLORS.BORDER } },
            right: { style: 'thin', color: { argb: COLORS.BORDER } }
        };
        wsUD.getRow(1).height = 30;

        // ---- Primera tabla: Aparato Sanitario, TIPO, Total (encabezados amarillos) ----
        const headers1 = ['Aparato Sanitario', 'TIPO', 'Total'];
        paintHeaders(wsUD, headers1, 3, COLORS.YELLOW);

        // Datos de la primera tabla (desde dataSheet['ud'])
        const udData = dataSheet['ud'] || {};
        let row = 4;
        let lastRowFirstTable = row;

        if (Object.keys(udData).length > 0) {
            Object.entries(udData).forEach(([key, value]: [string, any]) => {
                const rowObj = wsUD.getRow(row);
                rowObj.getCell(1).value = value.description || key; // Aparato Sanitario
                rowObj.getCell(2).value = value.tipo || '';         // TIPO
                rowObj.getCell(3).value = value.total || 0;         // Total
                applyRowStyle(rowObj, 3, [3]); // Solo columna 3 como entero
                row++;
            });
            lastRowFirstTable = row - 1;
        } else {
            wsUD.getCell('A4').value = 'No hay datos';
            lastRowFirstTable = 4;
            row = 5;
        }

        // Espacio entre tablas (una fila en blanco)
        row++;

        // ---- Segunda tabla: SUMATORIA DE GASTOS POR ACCESORIOS - PRIMARIA ----
        const title2Row = row;
        wsUD.mergeCells(title2Row, 1, title2Row, 8);
        const title2Cell = wsUD.getCell(title2Row, 1);
        title2Cell.value = 'SUMATORIA DE GASTOS POR ACCESORIOS - PRIMARIA';
        title2Cell.font = { bold: true, size: 14, color: { argb: COLORS.TITLE_TEXT } };
        title2Cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.TITLE_BG } }; // Gris oscuro
        title2Cell.alignment = { horizontal: 'center', vertical: 'middle' };
        title2Cell.border = {
            top: { style: 'thin', color: { argb: COLORS.BORDER } },
            left: { style: 'thin', color: { argb: COLORS.BORDER } },
            bottom: { style: 'thin', color: { argb: COLORS.BORDER } },
            right: { style: 'thin', color: { argb: COLORS.BORDER } }
        };
        wsUD.getRow(title2Row).height = 25;

        // Encabezados de la segunda tabla (amarillos)
        const headers2 = [
            'NIVEL',
            'DESCRIPCIÓN',
            'Inodoro 4 U.D.',
            'Urinario 4 U.D.',
            'Lavatorio 2 U.D.',
            'Ducha 4 U.D.',
            'Lavadero 3 U.D.',
            'SUMIDERO 2 U.D.'
        ];
        const headerRow2 = title2Row + 1;
        paintHeaders(wsUD, headers2, headerRow2, COLORS.YELLOW);

        // Datos de la segunda tabla (según la imagen)
        const sumatoriaData = dataSheet['sumatoria'] || [
            { nivel: 'MODULO I', descripcion: 'DUCHA + VESTIDOR MUJERES', inodoro: 0, urinario: 0, lavatorio: 0, ducha: 0, lavadero: 0, sumidero: 0 },
            { nivel: 'PRIMER NIVEL', descripcion: 'COLECTOR-PRIMARIA', inodoro: 0, urinario: 0, lavatorio: 0, ducha: 0, lavadero: 0, sumidero: 0 },
            { nivel: 'COLEGIO - PRIMARIA', descripcion: '', inodoro: 0, urinario: 0, lavatorio: 0, ducha: 0, lavadero: 0, sumidero: 0 },
        ];

        let row2 = headerRow2 + 1;
        sumatoriaData.forEach((item: any) => {
            const rowObj = wsUD.getRow(row2);
            rowObj.getCell(1).value = item.nivel || '';
            rowObj.getCell(2).value = item.descripcion || '';
            rowObj.getCell(3).value = item.inodoro ?? 0;
            rowObj.getCell(4).value = item.urinario ?? 0;
            rowObj.getCell(5).value = item.lavatorio ?? 0;
            rowObj.getCell(6).value = item.ducha ?? 0;
            rowObj.getCell(7).value = item.lavadero ?? 0;
            rowObj.getCell(8).value = item.sumidero ?? 0;

            applyRowStyle(rowObj, 8, [3,4,5,6,7,8]); // columnas numéricas como enteros
            row2++;
        });

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