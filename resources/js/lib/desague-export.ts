import ExcelJS from 'exceljs';

interface DesagueData {
    ud?: any;
    colector?: any;
    cajas?: any;
    uv?: any;
    trampa?: any;
}

export async function exportDesagueToExcel(dataSheet: Record<string, any>, fileName: string = 'Calculo_Desague') {
    try {
        const workbook = new ExcelJS.Workbook();

        // ========== HOJA 1: UNIDADES DE DESCARGA ==========
        const wsUD = workbook.addWorksheet('Unidades de Descarga');
        wsUD.columns = [
            { width: 30 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
        ];

        // Título
        wsUD.mergeCells('A1:E1');
        const titleUD = wsUD.getCell('A1');
        titleUD.value = 'UNIDADES DE DESCARGA';
        titleUD.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        titleUD.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
        titleUD.alignment = { horizontal: 'center', vertical: 'middle' };
        wsUD.getRow(1).height = 25;

        // Encabezados
        const headersUD = ['DESCRIPCIÓN', 'UD POR UNIDAD', 'CANTIDAD', 'TOTAL UD', 'NOTAS'];
        headersUD.forEach((header, idx) => {
            const cell = wsUD.getCell(3, idx + 1);
            cell.value = header;
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        // Datos UD
        const udData = dataSheet['ud'] || {};
        let rowUD = 4;

        if (udData && Object.keys(udData).length > 0) {
            Object.entries(udData).forEach(([key, value]: [string, any]) => {
                wsUD.getCell(`A${rowUD}`).value = value.description || key;
                wsUD.getCell(`B${rowUD}`).value = value.udPerUnit || 0;
                wsUD.getCell(`C${rowUD}`).value = value.quantity || 0;
                wsUD.getCell(`D${rowUD}`).value = (value.udPerUnit || 0) * (value.quantity || 0);
                wsUD.getCell(`E${rowUD}`).value = value.notes || '';
                
                // Estilos
                for (let col = 1; col <= 5; col++) {
                    const cell = wsUD.getCell(rowUD, col);
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    cell.alignment = { horizontal: col === 1 ? 'left' : 'center', vertical: 'middle' };
                }
                rowUD++;
            });
        }

        // Total UD
        wsUD.mergeCells(`A${rowUD}:C${rowUD}`);
        const totalUDCell = wsUD.getCell(`A${rowUD}`);
        totalUDCell.value = 'TOTAL UNIDADES DE DESCARGA';
        totalUDCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        totalUDCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };

        const totalUDFormula = wsUD.getCell(`D${rowUD}`);
        totalUDFormula.value = { formula: `SUM(D4:D${rowUD - 1})` };
        totalUDFormula.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        totalUDFormula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };

        // ========== HOJA 2: COLECTOR ==========
        const wsColector = workbook.addWorksheet('Colector');
        wsColector.columns = [
            { width: 30 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
        ];

        wsColector.mergeCells('A1:D1');
        const titleColector = wsColector.getCell('A1');
        titleColector.value = 'DISEÑO DEL COLECTOR';
        titleColector.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        titleColector.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
        titleColector.alignment = { horizontal: 'center', vertical: 'middle' };
        wsColector.getRow(1).height = 25;

        const headersColector = ['PARÁMETRO', 'VALOR', 'UNIDAD', 'DESCRIPCIÓN'];
        headersColector.forEach((header, idx) => {
            const cell = wsColector.getCell(3, idx + 1);
            cell.value = header;
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        const colectorData = dataSheet['colector'] || {};
        let rowColector = 4;

        Object.entries(colectorData).forEach(([key, value]: [string, any]) => {
            wsColector.getCell(`A${rowColector}`).value = key;
            wsColector.getCell(`B${rowColector}`).value = value.valor || '';
            wsColector.getCell(`C${rowColector}`).value = value.unidad || '';
            wsColector.getCell(`D${rowColector}`).value = value.descripcion || '';
            rowColector++;
        });

        // ========== HOJA 3: CAJAS DE REGISTRO ==========
        const wsCajas = workbook.addWorksheet('Cajas de Registro');
        wsCajas.columns = [
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 20 },
        ];

        wsCajas.mergeCells('A1:E1');
        const titleCajas = wsCajas.getCell('A1');
        titleCajas.value = 'CAJAS DE REGISTRO';
        titleCajas.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        titleCajas.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
        titleCajas.alignment = { horizontal: 'center', vertical: 'middle' };
        wsCajas.getRow(1).height = 25;

        const headersCajas = ['N°', 'PROFUNDIDAD', 'DIÁMETRO', 'PENDIENTE', 'MATERIALES'];
        headersCajas.forEach((header, idx) => {
            const cell = wsCajas.getCell(3, idx + 1);
            cell.value = header;
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } };
            cell.alignment = { horizontal: 'center' };
        });

        const cajasData = dataSheet['cajas'] || [];
        let rowCajas = 4;

        (Array.isArray(cajasData) ? cajasData : []).forEach((caja: any, idx: number) => {
            wsCajas.getCell(`A${rowCajas}`).value = idx + 1;
            wsCajas.getCell(`B${rowCajas}`).value = caja.profundidad || '';
            wsCajas.getCell(`C${rowCajas}`).value = caja.diametro || '';
            wsCajas.getCell(`D${rowCajas}`).value = caja.pendiente || '';
            wsCajas.getCell(`E${rowCajas}`).value = caja.materiales || '';
            rowCajas++;
        });

        // ========== HOJA 4: UNIDADES DE VENTILACIÓN ==========
        const wsUV = workbook.addWorksheet('Ventilación');
        wsUV.columns = [
            { width: 30 },
            { width: 15 },
            { width: 15 },
            { width: 20 },
        ];

        wsUV.mergeCells('A1:D1');
        const titleUV = wsUV.getCell('A1');
        titleUV.value = 'UNIDADES DE VENTILACIÓN';
        titleUV.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        titleUV.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
        titleUV.alignment = { horizontal: 'center', vertical: 'middle' };
        wsUV.getRow(1).height = 25;

        const headersUV = ['DESCRIPCIÓN', 'DIÁMETRO', 'CANTIDAD', 'UBICACIÓN'];
        headersUV.forEach((header, idx) => {
            const cell = wsUV.getCell(3, idx + 1);
            cell.value = header;
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } };
            cell.alignment = { horizontal: 'center' };
        });

        const uvData = dataSheet['uv'] || {};
        let rowUV = 4;

        Object.entries(uvData).forEach(([key, value]: [string, any]) => {
            wsUV.getCell(`A${rowUV}`).value = key;
            wsUV.getCell(`B${rowUV}`).value = value.diametro || '';
            wsUV.getCell(`C${rowUV}`).value = value.cantidad || 0;
            wsUV.getCell(`D${rowUV}`).value = value.ubicacion || '';
            rowUV++;
        });

        // ========== HOJA 5: TRAMPA DE GRASA ==========
        const wsTrampa = workbook.addWorksheet('Trampa de Grasa');
        wsTrampa.columns = [
            { width: 30 },
            { width: 20 },
            { width: 15 },
        ];

        wsTrampa.mergeCells('A1:C1');
        const titleTrampa = wsTrampa.getCell('A1');
        titleTrampa.value = 'TRAMPA DE GRASA';
        titleTrampa.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        titleTrampa.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
        titleTrampa.alignment = { horizontal: 'center', vertical: 'middle' };
        wsTrampa.getRow(1).height = 25;

        const headersTrampa = ['PARÁMETRO', 'VALOR', 'UNIDAD'];
        headersTrampa.forEach((header, idx) => {
            const cell = wsTrampa.getCell(3, idx + 1);
            cell.value = header;
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } };
            cell.alignment = { horizontal: 'center' };
        });

        const trampaData = dataSheet['trampa'] || {};
        let rowTrampa = 4;

        Object.entries(trampaData).forEach(([key, value]: [string, any]) => {
            wsTrampa.getCell(`A${rowTrampa}`).value = key;
            wsTrampa.getCell(`B${rowTrampa}`).value = value.valor || '';
            wsTrampa.getCell(`C${rowTrampa}`).value = value.unidad || '';
            rowTrampa++;
        });

        // Descarga
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
