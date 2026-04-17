	// helpers/exportHelpers.ts
import { gantt } from 'dhtmlx-gantt';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN DE PDF (EXPEDIENTE TÉCNICO)
// ─────────────────────────────────────────────────────────────────────────────
export const exportToPDF = async (projectName: string): Promise<void> => {
    const script = document.createElement('script');
    script.src = 'https://export.dhtmlx.com/gantt/api.js';
    script.onload = () => {
        (gantt as any).exportToPDF({
            name: `EXPEDIENTE_TECNICO_${projectName.replace(/\s+/g, '_')}.pdf`,
            header: `
                <div style="padding:20px; font-family: 'Arial', sans-serif; border-bottom: 2px solid #1e3a5f;">
                    <table style="width:100%">
                        <tr>
                            <td style="width:70%">
                                <h1 style="margin:0; color:#1e3a5f; font-size:20px; text-transform:uppercase;">Cronograma de Ejecución Físico Valorizado</h1>
                                <h2 style="margin:5px 0; color:#475569; font-size:14px;">PROYECTO: ${projectName}</h2>
                            </td>
                            <td style="text-align:right; color:#64748b; font-size:11px;">
                                <strong>Fecha de Reporte:</strong> ${new Date().toLocaleDateString('es-PE')}<br>
                                <strong>Sistema:</strong> Gestión de Costos e Ingeniería PCL
                            </td>
                        </tr>
                    </table>
                </div>`,
            footer: `
                <div style="text-align:center; font-size:10px; color:#94a3b8; padding:10px; border-top: 1px solid #e2e8f0;">
                    Página {page} de {totalPages} — Control de Proyectos y Obras de Ingeniería
                </div>`,
            locale: "es",
            skin: "material",
            landscape: true,
            fit_width: true,
            raw: true
        });
    };
    document.head.appendChild(script);
};

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL PROFESIONAL: CRONOGRAMA VALORIZADO + GANTT VISUAL + RESUMEN EJECUTIVO
// ─────────────────────────────────────────────────────────────────────────────
export const exportToExcel = async (projectName: string): Promise<void> => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Cronograma Valorizado');

    // --- CONFIGURACIÓN DE ESTILOS ---
    const borderStyle: Partial<ExcelJS.Borders> = {
        top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
    };
    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    const parentFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    const textWhite = { color: { argb: 'FFFFFFFF' }, bold: true };

    // --- 1. ENCABEZADO TIPO S10 / EXPEDIENTE ---
    sheet.mergeCells('A1:L1');
    const mainTitle = sheet.getCell('A1');
    mainTitle.value = 'CRONOGRAMA DE EJECUCIÓN DE OBRA VALORIZADO';
    mainTitle.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    mainTitle.fill = headerFill;
    mainTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 40;

    sheet.mergeCells('A2:L2');
    const subTitle = sheet.getCell('A2');
    subTitle.value = `PROYECTO: ${projectName.toUpperCase()}`;
    subTitle.font = { bold: true, size: 12 };
    subTitle.alignment = { vertical: 'middle' };
    sheet.getRow(2).height = 25;

    // --- 2. DEFINICIÓN DE COLUMNAS ---
    const columnsBase = [
        { header: 'ÍTEM', key: 'item', width: 12 },
        { header: 'DESCRIPCIÓN DE PARTIDA', key: 'text', width: 55 },
        { header: 'UNIDAD', key: 'unidad', width: 10 },
        { header: 'METRADO', key: 'metrado', width: 14 },
        { header: 'PRECIO S/.', key: 'precio', width: 15 },
        { header: 'PARCIAL S/.', key: 'cost', width: 18 },
        { header: 'INICIO', key: 'start', width: 13 },
        { header: 'TÉRMINO', key: 'end', width: 13 },
        { header: 'DÍAS', key: 'dur', width: 8 },
        { header: '% AVANCE', key: 'prog', width: 12 }
    ];

    const headerRow = sheet.getRow(4);
    headerRow.height = 30;
    columnsBase.forEach((col, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = col.header;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
        cell.font = textWhite;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = borderStyle;
        sheet.getColumn(idx + 1).width = col.width;
    });

    // --- 3. CÁLCULO DINÁMICO DE FECHAS Y MESES ---
    let minDate: Date | null = null;
    let maxDate: Date | null = null;
    const tasks: any[] = [];

    gantt.eachTask((t: any) => {
        tasks.push(t);
        if (!minDate || t.start_date < minDate) minDate = new Date(t.start_date);
        if (!maxDate || t.end_date > maxDate) maxDate = new Date(t.end_date);
    });

    if (!minDate || !maxDate) {
        minDate = new Date();
        maxDate = new Date();
    }

    const startYear = minDate.getFullYear();
    const startMonth = minDate.getMonth();
    const endYear = maxDate.getFullYear();
    const endMonth = maxDate.getMonth();
    const totalMonthsCount = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;

    const timeStartCol = 11; // Columna K
    for (let i = 0; i < totalMonthsCount; i++) {
        const colIdx = timeStartCol + i;
        const currentMonthDate = new Date(startYear, startMonth + i, 1);
        const monthLabel = currentMonthDate.toLocaleString('es-PE', { month: 'short', year: '2-digit' }).toUpperCase();
        
        const cell = headerRow.getCell(colIdx);
        cell.value = `MES ${i + 1}\n(${monthLabel})`;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
        cell.font = textWhite;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = borderStyle;
        sheet.getColumn(colIdx).width = 10;
    }

    // --- 4. RENDERIZADO DE DATOS Y GANTT EN CELDAS ---
    let rowIndex = 5;
    tasks.forEach((task) => {
        const row = sheet.getRow(rowIndex);
        const isParent = gantt.hasChild(task.id);
        const cost = parseFloat(task.cost) || 0;
        const metrado = parseFloat(task.metrado) || 1;
        const progress = (task.progress || 0) * 100;

        row.getCell(1).value = task.item || '';
        row.getCell(2).value = isParent ? task.text.toUpperCase() : task.text;
        row.getCell(3).value = task.unidad || 'GLB';
        row.getCell(4).value = metrado;
        row.getCell(5).value = cost / metrado;
        row.getCell(6).value = cost;
        row.getCell(7).value = task.start_date.toLocaleDateString('es-PE');
        row.getCell(8).value = task.end_date.toLocaleDateString('es-PE');
        row.getCell(9).value = task.duration;
        row.getCell(10).value = progress / 100;

        // Formatos numéricos
        row.getCell(4).numFmt = '#,##0.00';
        row.getCell(5).numFmt = '#,##0.00';
        row.getCell(6).numFmt = '"S/." #,##0.00';
        row.getCell(10).numFmt = '0%';

        // Estilos de fila
        row.eachCell({ includeEmpty: false }, (cell, colNum) => {
            cell.border = borderStyle;
            if (isParent) {
                cell.font = { bold: true };
                cell.fill = parentFill;
            }
        });

        // --- LÓGICA DE DIBUJO DE BARRA GANTT ---
        const tStart = new Date(task.start_date);
        const tEnd = new Date(task.end_date);
        
        for (let i = 0; i < totalMonthsCount; i++) {
            const mStart = new Date(startYear, startMonth + i, 1);
            const mEnd = new Date(startYear, startMonth + i + 1, 0);
            const colIdx = timeStartCol + i;

            // Si la tarea ocurre dentro de este mes
            if (tStart <= mEnd && tEnd >= mStart) {
                const barCell = row.getCell(colIdx);
                barCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: isParent ? 'FF94A3B8' : 'FF3B82F6' }
                };
                barCell.border = borderStyle;
            }
        }
        rowIndex++;
    });

    // --- 5. INMOVILIZAR PANELES ---
    sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 4 }];

    // --- 6. HOJA DE RESUMEN EJECUTIVO (KPIs) ---
    const summarySheet = workbook.addWorksheet('Resumen de Ingeniería');
    summarySheet.getColumn('A').width = 40;
    summarySheet.getColumn('B').width = 30;

    const totalProjectDuration = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));

    const summaryData = [
        ['RESUMEN EJECUTIVO DEL PROYECTO', ''],
        ['', ''],
        ['COSTO TOTAL DE OBRA', { formula: `SUM('Cronograma Valorizado'!F5:F${rowIndex - 1})` }],
        ['PLAZO DE EJECUCIÓN TOTAL', `${totalProjectDuration} DÍAS CALENDARIO`],
        ['FECHA DE INICIO PREVISTA', minDate.toLocaleDateString('es-PE')],
        ['FECHA DE TÉRMINO PREVISTA', maxDate.toLocaleDateString('es-PE')],
        ['TOTAL DE PARTIDAS CONTROLADAS', tasks.length],
        ['ESTADO', 'GENERADO EXITOSAMENTE']
    ];

    summaryData.forEach((val, i) => {
        const r = summarySheet.addRow(val);
        r.getCell(1).border = borderStyle;
        r.getCell(2).border = borderStyle;
        if (i === 0) {
            r.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };
        } else {
            r.getCell(1).font = { bold: true };
        }
    });
    summarySheet.getCell('B3').numFmt = '"S/." #,##0.00';

    // --- 7. GENERACIÓN DEL ARCHIVO ---
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `PCL_CRONOGRAMA_${projectName.replace(/\s+/g, '_')}.xlsx`;
    saveAs(new Blob([buffer]), filename);
};