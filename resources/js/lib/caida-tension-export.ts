import ExcelJS from 'exceljs';

// ── Interfaces actualizadas según estructura real de datos ──────────────────

export interface TDNodeData {
    ducto: string;
    puntos: number | string;
    seccion: number;
    tablero: string;
    voltage: string;
    corrienteA: number;
    descripcion: string;
    interruptor: string;
    caidaTension: number;
    factorDemanda: number;
    maximaDemanda: number;
    tipoConductor: string;
    cargaInstalada: number | string;
    corrienteDiseno: number;
    longitudFormula: string | null;
    longitudConductor: number | string;
    potenciaInstalada: number | string;
    caidaTensionPorcentaje: number;
}

export interface TDNode {
    id: string;
    data: TDNodeData;
    type: 'group' | 'subgroup' | 'splitrow';
    isSplit: boolean;
    voltage: string;
    children: TDNode[];
    parentId: string | null;
    splitData: any[];
}

// flattenedData (Hoja Tablero General - tabla de alimentadores)
export interface FlattenedRow {
    id: string;
    alimentador: string;
    tablero: string;
    sistema: string;
    potenciaInstalada: number;
    factorSimultaniedad: number;
    maximaDemanda: number;
    corrienteA: number;
    corrienteDiseno: number;
    longitudConductor: number;
    longitudFormula: string;
    seccion: number;
    caidaTension: number;
    caidaTensionPorcentaje: number;
    interruptor: string;
    tipoConductor: string;
    ducto: string;
    isMainRow: boolean;
    isStaticTG: boolean;
}

// tgData (Hoja Tablero General - tabla caída de tensión)
export interface TGMainRow {
    id: string;
    ducto: string;
    seccion: number;
    sistema: string;
    tablero: string;
    corrienteA: number;
    alimentador: string | null;
    interruptor: string;
    caidaTension: number;
    tipoConductor: string;
    corrienteDiseno: number;
    longitudFormula: string;
    maximademandaTG: number;
    longitudConductor: number;
    caidaTensionPorcentaje: number;
}

export interface CaidaTensionState {
    flattenedData: FlattenedRow[];
    atsData: any[];
    tgData: TGMainRow[];
}

export interface SelectionData {
    cantidadPotenciaWatts: number;
    factorDemanda: number;
    factorCarga1: number;
    factorCarga2: number;
    potenciaEstabilizadaStandby: number;
}

// ── Helpers de estilo ───────────────────────────────────────────────────────

function setBorder(cell: ExcelJS.Cell) {
    cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' },
    };
}

function applyHeaderStyle(cell: ExcelJS.Cell, argb = 'FFB2FFFF') {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
    cell.font = { bold: true, size: 9, name: 'Arial' };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    setBorder(cell);
}

function applyDataCell(
    cell: ExcelJS.Cell,
    value: any,
    horizontal: 'center' | 'left' | 'right' = 'center',
    numFmt?: string
) {
    cell.value = value ?? '';
    cell.alignment = { horizontal, vertical: 'middle' };
    cell.font = { size: 9, name: 'Arial' };
    setBorder(cell);
    if (numFmt) cell.numFmt = numFmt;
}

// ── Función principal ───────────────────────────────────────────────────────

export async function exportCaidaTensionToExcel(
    tdTree: TDNode[],
    tgState: CaidaTensionState,
    selectionData: SelectionData,
    fileName = 'Caida_Tension'
) {
    try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Sistema Eléctrico';

        // ================================================================
        // HOJA 1: TABLEROS DE DISTRIBUCIÓN
        // Fuente: tdTree → node.data.*
        // ================================================================
        const wsTD = workbook.addWorksheet('Tableros de Distribución');

        wsTD.columns = [
            { width: 10 }, { width: 42 }, { width: 10 }, { width: 18 }, { width: 18 },
            { width: 16 }, { width: 16 }, { width: 18 }, { width: 14 }, { width: 18 },
            { width: 20 }, { width: 14 }, { width: 18 }, { width: 18 }, { width: 14 },
            { width: 18 }, { width: 14 },
        ];

        wsTD.views = [{ state: 'frozen', ySplit: 3 }];

        // Título fila 1
        wsTD.mergeCells('A1:Q1');
        const tdTitle = wsTD.getCell('A1');
        tdTitle.value = 'CÁLCULO DE LA POTENCIA INSTALADA MÁXIMA DEMANDA';
        tdTitle.font = { bold: true, size: 13, name: 'Arial' };
        tdTitle.alignment = { horizontal: 'center', vertical: 'middle' };
        tdTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD966FF' } };
        setBorder(tdTitle);
        wsTD.getRow(1).height = 26;
        wsTD.getRow(2).height = 6;

        // Encabezados fila 3
        const tdHeaders = [
            'TABLERO', 'DESCRIPCIÓN DEL LOCAL', 'PUNTOS',
            'CARGA INSTALADA (W)', 'POTENCIA INSTALADA (W)', 'FACTOR DE DEMANDA',
            'DEMANDA (W)', 'MÁXIMA DEMANDA', 'CORRIENTE (A)',
            'CORRIENTE DE DISEÑO (A)', 'LONGITUD DE CONDUCTOR (m)', 'SECCIÓN (mm²)',
            'CAÍDA DE TENSIÓN (V)', 'CAÍDA DE TENSIÓN (%)', 'INTERRUPTOR (A)',
            'TIPO DE CONDUCTOR', 'DUCTO (mm)',
        ];
        tdHeaders.forEach((h, i) => {
            const cell = wsTD.getCell(3, i + 1);
            cell.value = h;
            applyHeaderStyle(cell);
        });
        wsTD.getRow(3).height = 44;

        // Recorrer árbol — CLAVE: leer node.data.* (no node.* directamente)
        let rowTD = 4;
        const flattenTD = (nodes: TDNode[], level = 0) => {
            nodes.forEach(node => {
                const d = node.data;
                const indent = '\u00A0'.repeat(level * 4);

                const rowColor =
                    node.type === 'group'    ? 'FFFFF2CC' :  // amarillo → TG raíz
                    node.type === 'subgroup' ? 'FFD9E1F2' :  // azul     → TD
                                               'FFFFFFFF';   // blanco   → circuito

                const values: any[] = [
                    d.tablero,
                    indent + (d.descripcion || ''),
                    d.puntos,
                    d.cargaInstalada,
                    d.potenciaInstalada,
                    d.factorDemanda,
                    d.maximaDemanda,
                    d.maximaDemanda,
                    d.corrienteA,
                    d.corrienteDiseno,
                    d.longitudConductor,
                    d.seccion,
                    d.caidaTension,
                    d.caidaTensionPorcentaje,
                    d.interruptor,
                    d.tipoConductor,
                    d.ducto,
                ];

                values.forEach((val, ci) => {
                    const cell = wsTD.getCell(rowTD, ci + 1);
                    applyDataCell(cell, val, ci === 1 ? 'left' : 'center');
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowColor } };
                    if (ci === 1 && node.type !== 'splitrow') cell.font = { ...cell.font, bold: true };
                });

                rowTD++;

                // Sub-filas de splitData
                if (node.isSplit && node.splitData?.length > 0) {
                    node.splitData.forEach((split: any) => {
                        const si = '\u00A0'.repeat((level + 1) * 4);
                        const sv: any[] = [
                            '', si + (split.descripcion || ''),
                            split.puntos, split.cargaInstalada,
                            ...Array(13).fill(''),
                        ];
                        sv.forEach((val, ci) => {
                            const cell = wsTD.getCell(rowTD, ci + 1);
                            applyDataCell(cell, val, ci === 1 ? 'left' : 'center');
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
                        });
                        rowTD++;
                    });
                }

                if (node.children?.length > 0) flattenTD(node.children, level + 1);
            });
        };

        if (tdTree?.length > 0) flattenTD(tdTree);

        // ================================================================
        // HOJA 2: TABLERO GENERAL
        // Tabla 1 → flattenedData (alimentador, tablero, sistema…)
        // Tabla 2 → tgData      (tablero TG, caída de tensión)
        // ================================================================
        const wsTG = workbook.addWorksheet('Tablero General');

        wsTG.columns = [
            { width: 13 }, { width: 10 }, { width: 10 }, { width: 18 }, { width: 20 },
            { width: 18 }, { width: 13 }, { width: 16 }, { width: 18 }, { width: 12 },
            { width: 16 }, { width: 22 }, { width: 14 }, { width: 18 }, { width: 13 },
        ];

        wsTG.views = [{ state: 'frozen', ySplit: 3 }];

        const tgHeaderLabels = [
            'ALIMENTADOR', 'TABLERO', 'SISTEMA',
            'POTENCIA INSTALADA (W)', 'FACTOR DE SIMULTANEIDAD F.S',
            'MAXIMA DEMANDA (W)', 'CORRIENTE (A)', 'CORRIENTE DISEÑO Id (A)',
            'LONGITUD DE CONDUCTOR (M)', 'SECCIÓN (mm²)',
            'CAIDA DE TENSIÓN (V)', 'CAIDA DE TENSIÓN (%) <2.5%',
            'INTERRUPTOR (A)', 'TIPO DE CONDUCTOR', 'DUCTO (mm)',
        ];

        // ── TABLA 1 ────────────────────────────────────────────────────────
        wsTG.mergeCells('A1:O1');
        const tg1Title = wsTG.getCell('A1');
        tg1Title.value = 'CALCULO DE LA POTENCIA INSTALADA Y MAXIMA DEMANDA';
        tg1Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF99CC' } };
        tg1Title.font = { bold: true, size: 11, name: 'Arial' };
        tg1Title.alignment = { horizontal: 'center', vertical: 'middle' };
        setBorder(tg1Title);
        wsTG.getRow(1).height = 22;

        tgHeaderLabels.forEach((h, i) => {
            const cell = wsTG.getCell(2, i + 1);
            cell.value = h;
            applyHeaderStyle(cell);
        });
        wsTG.getRow(2).height = 44;

        // flattenedData → filas
        const flatRows: FlattenedRow[] = tgState.flattenedData || [];
        let tgRow = 3;

        flatRows.forEach(row => {
            const isHeader = row.isStaticTG;
            const rowColor = isHeader ? 'FFFF99CC' : 'FFFFFFFF';

            const values: any[] = [
                row.alimentador,
                row.tablero,
                row.sistema,
                row.potenciaInstalada,      // potenciaInstalada (no potenciaWatts)
                row.factorSimultaniedad,    // factorSimultaniedad (no factorDemanda)
                row.maximaDemanda,          // maximaDemanda
                row.corrienteA,             // corrienteA (no corrienteAmperes)
                row.corrienteDiseno,
                row.longitudConductor,
                row.seccion,
                row.caidaTension,
                row.caidaTensionPorcentaje,
                row.interruptor,
                row.tipoConductor,
                row.ducto,
            ];

            values.forEach((val, ci) => {
                const cell = wsTG.getCell(tgRow, ci + 1);
                applyDataCell(cell, val);
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowColor } };
                if (isHeader) cell.font = { bold: true, size: 9, name: 'Arial' };
                if ([3, 5, 6, 7, 10, 11].includes(ci)) cell.numFmt = '#,##0.00';
            });

            tgRow++;
        });

        // ── TABLA 2 ────────────────────────────────────────────────────────
        const sep = tgRow + 2;
        wsTG.mergeCells(`A${sep}:O${sep}`);
        const tg2Title = wsTG.getCell(`A${sep}`);
        tg2Title.value = 'CALCULO DE CAIDA DE TENSION Y SECCION DEL ALIMENTADOR';
        tg2Title.font = { bold: true, size: 11, name: 'Arial' };
        tg2Title.alignment = { horizontal: 'left', vertical: 'middle' };
        wsTG.getRow(sep).height = 20;

        const hRow2 = sep + 2;
        tgHeaderLabels.forEach((h, i) => {
            const cell = wsTG.getCell(hRow2, i + 1);
            cell.value = h;
            applyHeaderStyle(cell);
        });
        wsTG.getRow(hRow2).height = 44;

        // tgData → filas
        // CLAVE: usa maximademandaTG (no maximaDemanda)
        const tgMainRows: TGMainRow[] = tgState.tgData || [];
        let tgRow2 = hRow2 + 1;

        tgMainRows.forEach(row => {
            const values: any[] = [
                row.alimentador ?? '',
                row.tablero,
                row.sistema,
                row.maximademandaTG,        // ← maximademandaTG
                1,
                row.maximademandaTG,
                row.corrienteA,
                row.corrienteDiseno,
                row.longitudConductor,
                row.seccion,
                row.caidaTension,
                row.caidaTensionPorcentaje,
                row.interruptor,
                row.tipoConductor,
                row.ducto,
            ];

            values.forEach((val, ci) => {
                const cell = wsTG.getCell(tgRow2, ci + 1);
                applyDataCell(cell, val);
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF99CC' } };
                cell.font = { bold: true, size: 9, name: 'Arial' };
                if ([3, 5, 6, 7, 10, 11].includes(ci)) cell.numFmt = '#,##0.00';
            });

            tgRow2++;
        });

        // ================================================================
        // HOJA 3: SELECCIÓN DE GRUPO ELECTRÓGENO
        // Fuente: selectionData
        // ================================================================
        const wsS = workbook.addWorksheet('Selección de Grupo');

        wsS.columns = [
            { width: 48 }, { width: 24 }, { width: 20 }, { width: 24 }, { width: 20 },
        ];

        wsS.mergeCells('A4:E5');
        const sTitle = wsS.getCell('A4');
        sTitle.value = 'SELECCIÓN DE GRUPO ELECTRÓGENO CONTAMANA';
        sTitle.font = { bold: true, size: 14, name: 'Arial' };
        sTitle.alignment = { horizontal: 'center', vertical: 'middle' };
        sTitle.border = {
            top: { style: 'thick' }, left: { style: 'thick' },
            bottom: { style: 'thick' }, right: { style: 'thick' },
        };
        wsS.getRow(4).height = 24;
        wsS.getRow(5).height = 24;

        const sHeaders = [
            'DESCRIPCION', 'CANTIDAD / POTENCIA',
            'Potencia Instalada (kW)', 'F.D. (Factor de Demanda)', 'Maxima Demanda (kW)',
        ];
        sHeaders.forEach((h, i) => {
            const cell = wsS.getCell(6, i + 1);
            cell.value = h;
            applyHeaderStyle(cell);
        });
        wsS.getRow(6).height = 30;

        // Cálculos con datos reales de selectionData
        const potInst  = (selectionData.cantidadPotenciaWatts || 0) / 1000;
        const fDem     = selectionData.factorDemanda || 1;
        const maxDemKW = potInst * fDem;
        const fc1      = selectionData.factorCarga1 || 0.95;
        const fc2      = selectionData.factorCarga2 || 0.80;
        const standby  = selectionData.potenciaEstabilizadaStandby
            || Number((maxDemKW / fc2).toFixed(3));

        // Fila 7
        const row7 = [
            'TG',
            `${(selectionData.cantidadPotenciaWatts || 0).toLocaleString('es-PE')} Watts`,
            potInst,
            fDem,
            maxDemKW,
        ];
        row7.forEach((val, i) => {
            const cell = wsS.getCell(7, i + 1);
            applyDataCell(cell, val);
            if (i >= 2) cell.numFmt = '0.000';
        });

        // Fila 8: POTENCIA TOTAL
        ['A8', 'B8', 'C8', 'D8', 'E8'].forEach(ref => {
            const cell = wsS.getCell(ref);
            cell.font = { bold: true, name: 'Arial' };
            cell.border = {
                top: { style: 'thin' }, bottom: { style: 'double' },
                left: { style: 'thin' }, right: { style: 'thin' },
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        wsS.getCell('A8').value = 'POTENCIA TOTAL';
        wsS.getCell('C8').value = potInst;
        wsS.getCell('C8').numFmt = '0.000';
        wsS.getCell('E8').value = maxDemKW;
        wsS.getCell('E8').numFmt = '0.000';

        // Título sección 2
        wsS.mergeCells('A12:E12');
        wsS.getCell('A12').value = 'SELECCIÓN DE GRUPO ELECTRÓGENO';
        wsS.getCell('A12').font = { bold: true, size: 11, name: 'Arial' };
        wsS.getRow(12).height = 20;

        const drawResultRow = (row: number, label: string, value: number, factorTxt?: string) => {
            if (factorTxt) {
                wsS.mergeCells(`A${row}:C${row}`);
                const dCell = wsS.getCell(`D${row}`);
                dCell.value = factorTxt;
                dCell.alignment = { horizontal: 'right', vertical: 'middle' };
                setBorder(dCell);
            } else {
                wsS.mergeCells(`A${row}:D${row}`);
            }
            const labelCell = wsS.getCell(`A${row}`);
            labelCell.value = label;
            labelCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            labelCell.font = { size: 9, name: 'Arial' };
            setBorder(labelCell);

            const valCell = wsS.getCell(`E${row}`);
            valCell.value = value;
            valCell.font = { bold: true, name: 'Arial' };
            valCell.numFmt = '0.000';
            valCell.alignment = { horizontal: 'center', vertical: 'middle' };
            setBorder(valCell);
            wsS.getRow(row).height = 22;
        };

        drawResultRow(13, 'POTENCIA TOTAL (kW)', maxDemKW);
        drawResultRow(
            14,
            `GRUPO ELECTRÓGENO a 155.28 m.s.n.m`,
            Number((maxDemKW / fc1).toFixed(3)),
            `Factor de Carga: ${(fc1 * 100).toFixed(0)}%`
        );
        drawResultRow(
            15,
            `EL GRUPO ELECTRÓGENO FUNCIONARÁ AL ${(fc2 * 100).toFixed(0)}% DE SU MÁXIMA CAPACIDAD`,
            Number((maxDemKW / fc2).toFixed(3)),
            `Factor de Carga: ${(fc2 * 100).toFixed(0)}%`
        );

        // Resultado final fila 16
        wsS.mergeCells('A16:D16');
        const finalLabel = wsS.getCell('A16');
        finalLabel.value = 'GRUPO ELECTRÓGENO CON POTENCIA STAND BY EN KW a 155.28 m.s.n.m será:';
        finalLabel.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        finalLabel.font = { size: 9, name: 'Arial' };
        setBorder(finalLabel);
        wsS.getRow(16).height = 22;

        const finalCell = wsS.getCell('E16');
        finalCell.value = standby;
        finalCell.font = { bold: true, color: { argb: 'FF006100' }, name: 'Arial' };
        finalCell.numFmt = '0.000';
        finalCell.alignment = { horizontal: 'center', vertical: 'middle' };
        finalCell.border = {
            top: { style: 'medium' }, left: { style: 'medium' },
            bottom: { style: 'medium' }, right: { style: 'medium' },
        };

        // ── Descarga ────────────────────────────────────────────────────────
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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