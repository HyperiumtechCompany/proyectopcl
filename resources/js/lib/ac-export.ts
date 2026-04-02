import ExcelJS from 'exceljs';
import type { AcCalculationData, Sheet } from '../pages/AcCalculation/Show';
import { addProjectHeaderAndFooter } from './excel-export-utils';

const CLIMATE_CONFIGS: Record<string, { name: string; btu: number }> = {
    'F': { name: 'Frío', btu: 500 },
    'T': { name: 'Templado', btu: 550 },
    'C': { name: 'Caliente', btu: 600 },
    'MC': { name: 'Muy Caliente', btu: 650 }
};

export async function exportAcCalculationToExcel(data: AcCalculationData, fileName: string = 'Calculo_Aire_Acondicionado', proyecto?: any) {
    try {
        const workbook = new ExcelJS.Workbook();
        const climateConfig = CLIMATE_CONFIGS[data.climateType] || CLIMATE_CONFIGS['C'];

        data.sheets.forEach((sheet, sheetIndex) => {
            const worksheet = workbook.addWorksheet(sheet.name || `Hoja ${sheetIndex + 1}`);

            worksheet.columns = [
                { width: 35 },
                { width: 15 },
                { width: 10 },
                { width: 15 },
                { width: 15 },
            ];

            // Título
            worksheet.mergeCells('A1:E1');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = 'CALCULO DE AIRE ACONDICIONADO';
            titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
            titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

            // Datos Generales
            worksheet.mergeCells('A2:B2');
            const datosCell = worksheet.getCell('A2');
            datosCell.value = 'DATOS:';
            datosCell.font = { bold: true, color: { argb: 'FF000000' } };
            datosCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };

            worksheet.getCell('A3').value = 'TIPO DE CLIMA';
            worksheet.getCell('B3').value = climateConfig.name.toUpperCase();
            worksheet.getCell('C3').value = `${data.climateBTU}.00 BTU/m2`;

            worksheet.getCell('A4').value = 'AMBIENTE';
            worksheet.getCell('B4').value = sheet.name.toUpperCase();
            worksheet.getCell('C4').value = `${sheet.area} m2`;

            // Encabezados de Carga Térmica
            worksheet.mergeCells('A5:B5');
            const cargaHeader = worksheet.getCell('A5');
            cargaHeader.value = 'CARGA TÉRMICA';
            cargaHeader.font = { bold: true };
            cargaHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };

            ['C5', 'D5', 'E5'].forEach((cellRef, i) => {
                const cell = worksheet.getCell(cellRef);
                cell.value = ['BTU /UND', 'CANT.', 'TOTAL'][i];
                cell.font = { bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
            });

            // Cálculos
            const getAreaLoad = (s: Sheet) => parseFloat(((s.area || 0) * data.climateBTU).toFixed(2));
            const getThermalTotal = (s: Sheet) => s.thermalLoad.reduce((tot, item) => tot + (item.btu * item.quantity), 0);

            let currentRow = 6;

            // Fila de Área
            worksheet.getCell(`A${currentRow}`).value = `ÁREA (${climateConfig.name.toUpperCase()})`;
            worksheet.getCell(`B${currentRow}`).value = data.climateBTU;
            worksheet.getCell(`C${currentRow}`).value = sheet.area;
            worksheet.getCell(`D${currentRow}`).value = getAreaLoad(sheet);
            currentRow++;

            // Filas secundarias
            sheet.thermalLoad.forEach(item => {
                worksheet.getCell(`A${currentRow}`).value = item.description.toUpperCase();
                worksheet.getCell(`B${currentRow}`).value = item.btu;
                worksheet.getCell(`C${currentRow}`).value = item.quantity;
                worksheet.getCell(`D${currentRow}`).value = item.btu * item.quantity;
                currentRow++;
            });

            // Fila de AIRE ACONDICIONADO
            const acRow = currentRow;
            worksheet.mergeCells(`A${acRow}:B${acRow}`);
            const acCell = worksheet.getCell(`A${acRow}`);
            acCell.value = 'TIPO DE AIRE ACONDICIONADO';
            acCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            acCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };

            const mainAC = sheet.acTypes[0] || { btu: 12000, quantity: 1 };
            worksheet.getCell(`C${acRow}`).value = `${mainAC.btu} BTU`;
            worksheet.getCell(`C${acRow}`).font = { bold: true };
            worksheet.getCell(`C${acRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };

            const totalLoadBTU = getAreaLoad(sheet) + getThermalTotal(sheet);
            const unitsNeeded = (totalLoadBTU / mainAC.btu).toFixed(2);
            worksheet.getCell(`D${acRow}`).value = `${unitsNeeded} Und`;
            worksheet.getCell(`D${acRow}`).font = { bold: true };

            const finalUnits = Math.ceil(parseFloat(unitsNeeded));
            worksheet.getCell(`E${acRow}`).value = `${finalUnits} Und`;
            worksheet.getCell(`E${acRow}`).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            worksheet.getCell(`E${acRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };

            // Bordes
            const borderStyle: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FF000000' } };
            for (let row = 1; row <= acRow; row++) {
                for (let col = 1; col <= 5; col++) {
                    const cell = worksheet.getCell(row, col);
                    cell.border = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };
                }
            }
        });

        // Descarga
        if (proyecto) {
            for (const sheet of workbook.worksheets) {
                const numCols = sheet.columns?.length || sheet.columnCount || 5;
                await addProjectHeaderAndFooter(workbook, sheet, proyecto, numCols, 'CÁLCULO DE AIRE ACONDICIONADO');
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
