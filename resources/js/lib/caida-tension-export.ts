import ExcelJS from 'exceljs';

export interface TGRow {
    id: string;
    numero: number;
    descripcion: string;
    potenciaWatts: number;
    factorPotencia: number;
    tipoCarga: string;
    porcentajeUtilizacion: number;
    factorDemanda: number;
    potenciaAparentekVA: number;
    corrienteAmperes: number;
}

export interface ATSRow {
    id: string;
    tablero: string;
    voltaje: number;
    fases: number;
    neutro: boolean;
}

export interface TGTableRow {
    id: string;
    consumidores: string;
    potenciaWatts: number;
    potenciaAparentekVA: number;
}

export interface CaidaTensionState {
    flattenedData: TGRow[];
    atsData: ATSRow[];
    tgData: TGTableRow[];
}

export interface SelectionData {
    cantidadPotenciaWatts: number;
    factorDemanda: number;
    factorCarga1: number;
    factorCarga2: number;
    potenciaEstabilizadaStandby: number;
}

export async function exportCaidaTensionToExcel(
    tdTree: any[],
    tgState: CaidaTensionState,
    selectionData: SelectionData,
    fileName: string = 'Caida_Tension'
) {
    try {
        const workbook = new ExcelJS.Workbook();

        // ========== HOJA 1: TABLEROS DE DISTRIBUCIÓN ==========
        const wsTD = workbook.addWorksheet('Tableros de Distribución');
        wsTD.columns = [
            { width: 20 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 20 },
        ];

        // Título
        wsTD.mergeCells('A1:F1');
        const titleTD = wsTD.getCell('A1');
        titleTD.value = 'TABLEROS DE DISTRIBUCIÓN';
        titleTD.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        titleTD.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
        titleTD.alignment = { horizontal: 'center', vertical: 'middle' };
        wsTD.getRow(1).height = 25;

        // Encabezados
        const headersTD = ['CÓDIGO', 'NOMBRE', 'VOLTAJE', 'FASES', 'NEUTRO', 'DESCRIPCIÓN'];
        headersTD.forEach((header, idx) => {
            const cell = wsTD.getCell(3, idx + 1);
            cell.value = header;
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        // Datos TD (árbol)
        let rowTD = 4;
        const flattenTD = (nodes: any[], level = 0) => {
            nodes.forEach(node => {
                wsTD.getCell(`A${rowTD}`).value = node.code || '';
                wsTD.getCell(`B${rowTD}`).value = (node.label || '').padStart(level * 2 + (node.label || '').length, '  ');
                wsTD.getCell(`C${rowTD}`).value = node.voltaje || '';
                wsTD.getCell(`D${rowTD}`).value = node.fases || '';
                wsTD.getCell(`E${rowTD}`).value = node.tieneNeutro ? 'Sí' : 'No';
                wsTD.getCell(`F${rowTD}`).value = node.descripcion || '';
                
                for (let col = 1; col <= 6; col++) {
                    const cell = wsTD.getCell(rowTD, col);
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    cell.alignment = { horizontal: col === 2 ? 'left' : 'center', vertical: 'middle' };
                }
                rowTD++;
                
                if (node.children && node.children.length > 0) {
                    flattenTD(node.children, level + 1);
                }
            });
        };

        if (tdTree && tdTree.length > 0) {
            flattenTD(tdTree);
        }

        // ========== HOJA 2: TABLERO GENERAL ==========
        const wsTG = workbook.addWorksheet('Tablero General');
        wsTG.columns = [
            { width: 5 },
            { width: 30 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 12 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
        ];

        wsTG.mergeCells('A1:I1');
        const titleTG = wsTG.getCell('A1');
        titleTG.value = 'CÁLCULO DE CAÍDA DE TENSIÓN - TABLERO GENERAL';
        titleTG.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        titleTG.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
        titleTG.alignment = { horizontal: 'center', vertical: 'middle' };
        wsTG.getRow(1).height = 25;

        const headersTG = [
            'N°',
            'DESCRIPCIÓN',
            'POTENCIA (W)',
            'F.P.',
            'TIPO CARGA',
            'UTIL.',
            'F. DEMANDA',
            'POTENCIA (kVA)',
            'CORRIENTE (A)'
        ];
        headersTG.forEach((header, idx) => {
            const cell = wsTG.getCell(3, idx + 1);
            cell.value = header;
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        // Datos TG
        const tgRows = tgState.flattenedData || [];
        let rowTG = 4;
        let totalPotencia = 0;
        let totalAparentekVA = 0;
        let totalCorriente = 0;

        tgRows.forEach((row: TGRow) => {
            const n = rowTG - 3;
            wsTG.getCell(`A${rowTG}`).value = n;
            wsTG.getCell(`B${rowTG}`).value = row.descripcion || '';
            wsTG.getCell(`C${rowTG}`).value = row.potenciaWatts || 0;
            wsTG.getCell(`D${rowTG}`).value = row.factorPotencia || 0.9;
            wsTG.getCell(`E${rowTG}`).value = row.tipoCarga || '';
            wsTG.getCell(`F${rowTG}`).value = row.porcentajeUtilizacion ? `${row.porcentajeUtilizacion}%` : '';
            wsTG.getCell(`G${rowTG}`).value = row.factorDemanda || 1;
            wsTG.getCell(`H${rowTG}`).value = row.potenciaAparentekVA || 0;
            wsTG.getCell(`I${rowTG}`).value = row.corrienteAmperes || 0;

            totalPotencia += row.potenciaWatts || 0;
            totalAparentekVA += row.potenciaAparentekVA || 0;
            totalCorriente += row.corrienteAmperes || 0;

            for (let col = 1; col <= 9; col++) {
                const cell = wsTG.getCell(rowTG, col);
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cell.alignment = {
                    horizontal: col === 2 ? 'left' : 'center',
                    vertical: 'middle'
                };
                cell.numFmt = col >= 3 ? '0.00' : '';
            }
            rowTG++;
        });

        // Totales
        wsTG.mergeCells(`A${rowTG}:B${rowTG}`);
        const totalCell = wsTG.getCell(`A${rowTG}`);
        totalCell.value = 'TOTAL';
        totalCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
        totalCell.alignment = { horizontal: 'right', vertical: 'middle' };

        const totalPotenciaCell = wsTG.getCell(`C${rowTG}`);
        totalPotenciaCell.value = totalPotencia;
        totalPotenciaCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        totalPotenciaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };

        const totalAparenteCell = wsTG.getCell(`H${rowTG}`);
        totalAparenteCell.value = totalAparentekVA;
        totalAparenteCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        totalAparenteCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };

        const totalCorrienteCell = wsTG.getCell(`I${rowTG}`);
        totalCorrienteCell.value = totalCorriente;
        totalCorrienteCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        totalCorrienteCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };

        // ========== HOJA 3: SELECCIÓN DE GRUPO ==========
        const wsSelection = workbook.addWorksheet('Selección de Grupo');
        wsSelection.columns = [
            { width: 35 },
            { width: 20 },
            { width: 15 },
        ];

        wsSelection.mergeCells('A1:C1');
        const titleSelection = wsSelection.getCell('A1');
        titleSelection.value = 'SELECCIÓN DE GRUPO ELECTRÓGENO';
        titleSelection.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        titleSelection.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
        titleSelection.alignment = { horizontal: 'center', vertical: 'middle' };
        wsSelection.getRow(1).height = 25;

        const selectionParams = [
            { label: 'Cantidad de Potencia (Watts)', value: selectionData.cantidadPotenciaWatts, unit: 'W' },
            { label: 'Factor de Demanda', value: selectionData.factorDemanda, unit: '' },
            { label: 'Factor de Carga 1', value: selectionData.factorCarga1, unit: '' },
            { label: 'Factor de Carga 2', value: selectionData.factorCarga2, unit: '' },
            { label: 'Potencia Estabilizada (Standby)', value: selectionData.potenciaEstabilizadaStandby, unit: 'kVA' },
        ];

        let rowSelection = 3;
        selectionParams.forEach(param => {
            wsSelection.getCell(`A${rowSelection}`).value = param.label;
            wsSelection.getCell(`A${rowSelection}`).font = { bold: true };
            wsSelection.getCell(`A${rowSelection}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
            
            wsSelection.getCell(`B${rowSelection}`).value = param.value;
            wsSelection.getCell(`C${rowSelection}`).value = param.unit;
            
            for (let col = 1; col <= 3; col++) {
                const cell = wsSelection.getCell(rowSelection, col);
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cell.alignment = { horizontal: 'left', vertical: 'middle' };
            }
            rowSelection++;
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
