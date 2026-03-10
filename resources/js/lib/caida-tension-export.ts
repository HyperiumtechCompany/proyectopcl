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
            { width: 10 }, // TABLERO
            { width: 40 }, // DESCRIPCIÓN
            { width: 10 }, // PUNTOS
            { width: 18 }, // CARGA INSTALADA
            { width: 18 }, // POTENCIA INSTALADA
            { width: 18 }, // FACTOR DEMANDA
            { width: 18 }, // DEMANDA
            { width: 18 }, // MÁXIMA DEMANDA
            { width: 15 }, // CORRIENTE
            { width: 18 }, // CORRIENTE DISEÑO
            { width: 18 }, // LONGITUD
            { width: 15 }, // SECCIÓN
            { width: 18 }, // CAÍDA V
            { width: 18 }, // CAÍDA %
            { width: 15 }, // INTERRUPTOR
            { width: 18 }, // TIPO CONDUCTOR
            { width: 15 }, // DUCTO
            ];

            wsTD.views = [{ state: 'frozen', ySplit: 4 }];


            // TITULO PRINCIPAL
            wsTD.mergeCells('A1:Q1');

            const title = wsTD.getCell('A1');
            title.value = 'CÁLCULO DE LA POTENCIA INSTALADA MÁXIMA DEMANDA';
            title.font = { bold: true, size: 14 };
            title.alignment = { horizontal: 'center', vertical: 'middle' };
            title.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD966FF' }
            };

            wsTD.getRow(1).height = 25;


            // ENCABEZADOS
            const headers = [
            'TABLERO',
            'DESCRIPCIÓN DEL LOCAL',
            'PUNTOS',
            'CARGA INSTALADA (W)',
            'POTENCIA INSTALADA (W)',
            'FACTOR DE DEMANDA',
            'DEMANDA (W)',
            'MÁXIMA DEMANDA',
            'CORRIENTE (A)',
            'CORRIENTE DE DISEÑO (A)',
            'LONGITUD DE CONDUCTOR (m)',
            'SECCIÓN (mm2)',
            'CAÍDA DE TENSIÓN (V)',
            'CAÍDA DE TENSIÓN (%)',
            'INTERRUPTOR (A)',
            'TIPO DE CONDUCTOR',
            'DUCTO (mm2)'
            ];

            headers.forEach((header, idx) => {
            const cell = wsTD.getCell(3, idx + 1);

            cell.value = header;

            cell.font = { bold: true };

            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: {argb: 'B2FFFF'}};

            cell.alignment = {
                horizontal: 'center',
                vertical: 'middle',
                wrapText: true
            };

            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            });


            // DATOS
            let rowTD = 4;

            const flattenTD = (nodes: any[], level = 0) => {

            nodes.forEach(node => {

                wsTD.getCell(rowTD, 1).value = node.code || '';

                wsTD.getCell(rowTD, 2).value =
                (node.label || '').padStart(level * 2 + (node.label || '').length, ' ');

                wsTD.getCell(rowTD, 3).value = node.puntos || '';
                wsTD.getCell(rowTD, 4).value = node.cargaInstalada || '';
                wsTD.getCell(rowTD, 5).value = node.potenciaInstalada || '';
                wsTD.getCell(rowTD, 6).value = node.factorDemanda || '';
                wsTD.getCell(rowTD, 7).value = node.demanda || '';
                wsTD.getCell(rowTD, 8).value = node.maxDemanda || '';
                wsTD.getCell(rowTD, 9).value = node.corriente || '';
                wsTD.getCell(rowTD, 10).value = node.corrienteDiseno || '';
                wsTD.getCell(rowTD, 11).value = node.longitud || '';
                wsTD.getCell(rowTD, 12).value = node.seccion || '';
                wsTD.getCell(rowTD, 13).value = node.caidaV || '';
                wsTD.getCell(rowTD, 14).value = node.caidaPorcentaje || '';
                wsTD.getCell(rowTD, 15).value = node.interruptor || '';
                wsTD.getCell(rowTD, 16).value = node.tipoConductor || '';
                wsTD.getCell(rowTD, 17).value = node.ducto || '';


                for (let col = 1; col <= 17; col++) {

                const cell = wsTD.getCell(rowTD, col);

                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };

                cell.alignment = {
                    horizontal: col === 2 ? 'left' : 'center',
                    vertical: 'middle'
                };

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
        
        //  CONFIGURACIÓN DE COLUMNAS
        wsTG.columns = [
            { width: 12 }, { width: 15 }, { width: 10 }, { width: 12 }, { width: 18 }, 
            { width: 15 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 10 }, 
            { width: 12 }, { width: 12 }, { width: 12 }, { width: 15 }, { width: 12 }
        ];

        //  TÍTULO PRINCIPAL (Fila 1 - Color Rosa)
        wsTG.mergeCells('A1:O1');
        const tgMainTitle = wsTG.getCell('A1');
        tgMainTitle.value = 'CALCULO DE LA POTENCIA INSTALADA Y MAXIMA DEMANDA';
        tgMainTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF99CC' } }; // Rosa
        tgMainTitle.font = { bold: true, size: 10 };
        tgMainTitle.alignment = { horizontal: 'center', vertical: 'middle' };
        tgMainTitle.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

        //  ENCABEZADOS TÉCNICOS (Fila 2 y 3)

        wsTD.views = [{ state: 'frozen', ySplit: 3}];

        const tgHeaders = [
            'ALIMENTADOR', 'TABLERO', 'SISTEMA', 'POTENCIA INSTALADA (W)', 
            'FACTOR DE SIMULTANEIDAD F.S', 'MAXIMA DEMANDA (W)', 'CORRIENTE (A)', 
            'CORRIENTE DISEÑO Id (A)', 'LONGITUD DE CONDUCTOR(M)', 'SECCIÓN (mm2)', 
            'CAIDA DE TENSIÓN (V)', 'CAIDA DE TENSIÓN (%) <2.5%', 'INTERRUPTOR (A)', 
            'TIPO DE CONDUCTOR', 'DUCTO (mm2)'
        ];

        tgHeaders.forEach((h, i) => {
            const cell = wsTG.getCell(2, i + 1);
            cell.value = h;
            cell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'B2FFFF'}};
            cell.font = { bold: true, size: 8 };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            // Unir verticalmente si no hay sub-encabezados (opcional)
            wsTG.mergeCells(2, i + 1, 3, i + 1); 
        });

        //  FILA DE TOTAL "TG" (Fila 4 - Color Rosa)
        const tgData = tgState.flattenedData || [];
        const totalW = tgData.reduce((acc: number, r: any) => acc + (r.potenciaWatts || 0), 0);
        const maxDemanda = totalW * 0.8; // Ejemplo de factor de la imagen

        wsTG.getCell('A4').value = ' '; // Espacio
        wsTG.getCell('B4').value = 'TG';
        wsTG.getCell('C4').value = '1 Φ';
        wsTG.getCell('D4').value = totalW;
        wsTG.getCell('F4').value = maxDemanda;

        ['A4','B4','C4','D4','E4','F4','G4','H4','I4','J4','K4','L4','M4','N4','O4'].forEach(ref => {
            const cell = wsTG.getCell(ref);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF99CC' } };
            cell.font = { bold: true, color: { argb: 'FF800080' } }; // Texto morado/oscuro
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { horizontal: 'center' };
        });

        //  LISTADO DE ALIMENTADORES (C-1, C-2...)
        let currentTgRow = 5;
        tgData.forEach((row: any, index: number) => {
            const r = currentTgRow;
            wsTG.getCell(`A${r}`).value = `C-${index + 1}`;
            wsTG.getCell(`B${r}`).value = row.descripcion || 'TD-01';
            wsTG.getCell(`C${r}`).value = '1 Φ';
            wsTG.getCell(`D${r}`).value = row.potenciaWatts || 0;
            wsTG.getCell(`E${r}`).value = row.factorDemanda || 0.80;
            wsTG.getCell(`F${r}`).value = (row.potenciaWatts || 0) * (row.factorDemanda || 0.80);
            wsTG.getCell(`G${r}`).value = row.corrienteAmperes || 0;
            wsTG.getCell(`H${r}`).value = (row.corrienteAmperes || 0) * 1.25; // Id
            
            // Aplicar bordes y formato a toda la fila
            for (let col = 1; col <= 15; col++) {
                const cell = wsTG.getCell(r, col);
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cell.alignment = { horizontal: 'center' };
                cell.font = { size: 9 };
                if (col === 4 || col === 6 || col >= 11) cell.numFmt = '0.00';
            }
            currentTgRow++;
        });

        //  SEGUNDA TABLA: CAIDA DE TENSIÓN (Fila separada)
        const separation = currentTgRow + 2;
        wsTG.mergeCells(`A${separation}:O${separation}`);
        const sectionTitle2 = wsTG.getCell(`A${separation}`);
        sectionTitle2.value = 'CALCULO DE CAIDA DE TENSION Y SECCION DEL ALIMENTADOR';
        sectionTitle2.font = { bold: true };
        sectionTitle2.alignment = { horizontal: 'left' };

        // Replicar encabezados para la segunda tabla abajo
        const headerRow2 = separation + 2;
        tgHeaders.forEach((h, i) => {
            const cell = wsTG.getCell(headerRow2, i + 1);
            cell.value = h;
            cell.fill = {type: 'pattern', pattern: 'solid', fgColor: {argb: 'B2FFFF'}};            
            cell.font = { bold: true, size: 8 };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        });

        // Fila de resultado final (Rosa)
        const finalRow = headerRow2 + 1;
        wsTG.getCell(`B${finalRow}`).value = 'TG';
        wsTG.getCell(`F${finalRow}`).value = maxDemanda;
        // Aplicar el estilo rosa a esta fila de resultados
        for (let col = 1; col <= 15; col++) {
            const cell = wsTG.getCell(finalRow, col);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF99CC' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        }
        
        // ========== HOJA 3: SELECCIÓN DE GRUPO ==========

        const wsSelection = workbook.addWorksheet('Selección de Grupo');
        
        // Ajuste de anchos y celdas combinadas (sección resumida para brevedad)
        wsSelection.columns = [{ width: 45 }, { width: 22 }, { width: 18 }, { width: 22 }, { width: 20 }];
        wsSelection.mergeCells('A4:E5');
        const mainHeader = wsSelection.getCell('A4');
        mainHeader.value = 'SELECCIÓN DE GRUPO ELECTRÓGENO CONTAMANA';
        mainHeader.font = { bold: true, size: 14 };
        mainHeader.alignment = { horizontal: 'center', vertical: 'middle' };
        mainHeader.border = { top: { style: 'thick' }, left: { style: 'thick' }, bottom: { style: 'thick' }, right: { style: 'thick' } };

        // Encabezados y datos
        
        const subHeaders = ['DESCRIPCION', 'CANTIDAD / POTENCIA', 'Potencia Instalada (kW)', 'F.D. (Factor de Demanda)', 'Maxima Demanda (kW)'];
        subHeaders.forEach((txt, i) => {
            const cell = wsSelection.getCell(6, i + 1);
            cell.value = txt;
            cell.font = { bold: true, size: 9 };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        //  DATOS DE POTENCIA (Uso de 'as any' para evitar TS errors)
        const data = selectionData as any;
        const potInst = (data.cantidadPotenciaWatts || 0) / 1000;
        const fDem = data.factorDemanda || 1;
        
        // Llenado de datos (A7:E7) y (A8:E8) con estilo
        const row7 = ['TG', `${(data.cantidadPotenciaWatts || 0).toLocaleString()} Watts`, potInst, fDem.toFixed(2), (potInst * fDem).toFixed(2)];
        row7.forEach((val, i) => {
            const cell = wsSelection.getCell(7, i + 1);
            cell.value = val;
            cell.alignment = { horizontal: 'center' };
            cell.border = { left: { style: 'thin' }, right: { style: 'thin' } };
        });

        // Fila 8 - Potencia Total (Borde doble)
        wsSelection.getCell('A8').value = 'POTENCIA TOTAL';
        wsSelection.getCell('C8').value = potInst;
        wsSelection.getCell('E8').value = (potInst * fDem).toFixed(2);
        ['A8', 'B8', 'C8', 'D8', 'E8'].forEach(ref => {
            wsSelection.getCell(ref).font = { bold: true };
            wsSelection.getCell(ref).border = { top: { style: 'thin' }, bottom: { style: 'double' }, left: { style: 'thin' }, right: { style: 'thin' } };
        });

        // SEGUNDA TABLA: RESULTADOS
        wsSelection.mergeCells('A12:E12');
        wsSelection.getCell('A12').value = 'SELECCIÓN DE GRUPO ELECTRÓGENO';
        wsSelection.getCell('A12').font = { bold: true };
        
        // Función para renderizar filas de resultados
        const drawResultRow = (row: number, label: string, value: any, factorTxt?: string) => {
            if (factorTxt) {
                wsSelection.mergeCells(`A${row}:C${row}`);
                wsSelection.getCell(`D${row}`).value = factorTxt;
                wsSelection.getCell(`D${row}`).alignment = { horizontal: 'right' };
            } else { wsSelection.mergeCells(`A${row}:D${row}`); }
            wsSelection.getCell(`A${row}`).value = label;
            wsSelection.getCell(`E${row}`).value = value;
            for (let col = 1; col <= 5; col++) {
                const c = wsSelection.getCell(row, col);
                c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                if (col === 5) c.font = { bold: true };
            }
        };

        drawResultRow(13, 'POTENCIA TOTAL', (potInst * fDem).toFixed(2));
        drawResultRow(14, 'GRUPO ELECTRÓGENO a 155.28 m.s.n.m', (data.resultadoCarga1 || 7.56), 'Factor de Carga: 0.95%');
        drawResultRow(15, 'EL GRUPO ELECTRÓGENO FUNCIONARÁ AL 0.8% DE SU MÁXIMA CAPACIDAD', (data.resultadoCarga2 || 9.45), 'Factor de Carga: 0.80%');

        //RESULTADO FINAL (Borde verde)
        wsSelection.mergeCells('A16:D16');
        wsSelection.getCell('A16').value = 'GRUPO ELECTRÓGENO CON POTENCIA STAND BY EN KW a 155.28 m.s.n.m será:';
        const finalCell = wsSelection.getCell('E16');
        finalCell.value = data.potenciaEstabilizadaStandby || 9.45;
        finalCell.font = { bold: true, color: { argb: 'FF006100' } };
        finalCell.border = { top: { style: 'medium' }, left: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' } };
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
