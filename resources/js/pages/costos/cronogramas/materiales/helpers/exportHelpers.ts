import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { MaterialItem, Periodo, ViewMode } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN DE ESTILOS PROFESIONALES (TIPADO CORRECTAMENTE)
// ─────────────────────────────────────────────────────────────────────────────

// Helper para crear estilos con tipos correctos
const createStyle = (props: Partial<ExcelJS.Style>): Partial<ExcelJS.Style> => props;

export const ESTILOS = {
    title: createStyle({
        font: { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF1E293B' } },
        alignment: { horizontal: 'left', vertical: 'middle' }
    }),
    subtitle: createStyle({
        font: { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } },
        alignment: { horizontal: 'left', vertical: 'middle' }
    }),
    header: createStyle({
        font: { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        border: {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        }
    }),
    headerLeft: createStyle({
        font: { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } },
        alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
        border: {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        }
    }),
    bodyLeft: createStyle({
        font: { name: 'Segoe UI', size: 10 },
        alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
        border: {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        }
    }),
    bodyCenter: createStyle({
        font: { name: 'Segoe UI', size: 10 },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        }
    }),
    number: createStyle({
        font: { name: 'Segoe UI', size: 10 },
        alignment: { horizontal: 'right', vertical: 'middle' },
        numFmt: '#,##0.00',
        border: {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        }
    }),
    numberDecimal: createStyle({
        font: { name: 'Segoe UI', size: 10 },
        alignment: { horizontal: 'right', vertical: 'middle' },
        numFmt: '#,##0.000',
        border: {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        }
    }),
    total: createStyle({
        font: { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF059669' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } },
        alignment: { horizontal: 'right', vertical: 'middle' },
        numFmt: '#,##0.00',
        border: {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        }
    }),
    totalCantidad: createStyle({
        font: { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF059669' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } },
        alignment: { horizontal: 'right', vertical: 'middle' },
        numFmt: '#,##0.000',
        border: {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        }
    }),
    pico: createStyle({
        font: { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFD97706' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } },
        alignment: { horizontal: 'right', vertical: 'middle' },
        numFmt: '#,##0.00',
        border: {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        }
    }),
    picoCantidad: createStyle({
        font: { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFD97706' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } },
        alignment: { horizontal: 'right', vertical: 'middle' },
        numFmt: '#,##0.000',
        border: {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        }
    }),
    sectionHeader: createStyle({
        font: { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FF1E293B' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } },
        alignment: { horizontal: 'left', vertical: 'middle' },
        border: {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        }
    })
};

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL DE EXPORTACIÓN A EXCEL (SOLO XLSX)
// ─────────────────────────────────────────────────────────────────────────────
export const exportarMaterialesExcel = async (
    materiales: MaterialItem[],
    periodos: Periodo[],
    projectName: string,
    viewMode: ViewMode
): Promise<void> => {
    if (!materiales.length || !periodos.length) {
        console.warn('No hay datos para exportar');
        return;
    }

    // Crear workbook y worksheet
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PCL';
    workbook.lastModifiedBy = 'PCL';
    workbook.created = new Date();
    workbook.modified = new Date();
    
    const worksheet = workbook.addWorksheet('Cronograma Materiales', {
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SECCIÓN 1: ENCABEZADO DEL REPORTE
    // ─────────────────────────────────────────────────────────────────────────
    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = 'CRONOGRAMA DE MATERIALES';
    worksheet.getCell('A1').style = ESTILOS.title;

    worksheet.mergeCells('A2:F2');
    worksheet.getCell('A2').value = projectName;
    worksheet.getCell('A2').style = ESTILOS.subtitle;

    worksheet.mergeCells('A3:F3');
    worksheet.getCell('A3').value = `Generado: ${new Date().toLocaleString('es-PE')}`;
    worksheet.getCell('A3').style = ESTILOS.subtitle;

    worksheet.mergeCells('A4:F4');
    worksheet.getCell('A4').value = viewMode === 'cantidad' ? 'MODO: CANTIDADES (unidades)' : 'MODO: MONTO (Soles)';
    worksheet.getCell('A4').style = ESTILOS.subtitle;

    // Espacio
    worksheet.getRow(5).height = 10;

    // ─────────────────────────────────────────────────────────────────────────
    // SECCIÓN 2: TABLA PRINCIPAL
    // ─────────────────────────────────────────────────────────────────────────

    // Calcular totales mensuales
    const totalesMensuales: Record<string, number> = {};
    periodos.forEach(p => {
        totalesMensuales[p.key] = materiales.reduce((sum, mat) => {
            const dist = mat.distribucion[p.key];
            if (!dist) return sum;
            return sum + (viewMode === 'cantidad' ? dist.cantidad : dist.monto);
        }, 0);
    });

    // Total general
    const totalGeneral = materiales.reduce((sum, mat) => sum + mat.costo_total, 0);
    const totalCantidadGeneral = materiales.reduce((sum, mat) => sum + mat.cantidad_total, 0);

    // Identificar mes pico
    let mesPicoKey = '';
    let maxMonto = 0;
    periodos.forEach(p => {
        const monto = totalesMensuales[p.key] || 0;
        if (monto > maxMonto) {
            maxMonto = monto;
            mesPicoKey = p.key;
        }
    });

    // ── ENCABEZADOS DE COLUMNA ──
    const headers = [
        'ITEM',
        'DESCRIPCIÓN DEL INSUMO',
        'UND',
        'TIPO',
        'PRECIO UNIT.',
        viewMode === 'cantidad' ? 'CANTIDAD TOTAL' : 'COSTO TOTAL (S/.)',
        ...periodos.map(p => p.labelCal || p.label)
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.height = 35;
    headerRow.eachCell((cell, colNumber) => {
        if (colNumber === 2) {
            cell.style = ESTILOS.headerLeft;
        } else {
            cell.style = ESTILOS.header;
        }
    });

    // ── DATOS DE MATERIALES ──
    materiales.forEach((material, idx) => {
        const valoresPorMes = periodos.map(p => {
            const dist = material.distribucion[p.key];
            if (!dist) return 0;
            return viewMode === 'cantidad' ? dist.cantidad : dist.monto;
        });

        const row = worksheet.addRow([
            idx + 1,
            material.descripcion,
            material.unidad,
            material.tipo?.replace(/_/g, ' ') || 'materiales',
            material.precio,
            viewMode === 'cantidad' ? material.cantidad_total : material.costo_total,
            ...valoresPorMes
        ]);

        row.height = 22;
        row.eachCell((cell, colNum) => {
            if (colNum === 2) {
                cell.style = ESTILOS.bodyLeft;
            } else if (colNum === 3 || colNum === 4) {
                cell.style = ESTILOS.bodyCenter;
            } else if (colNum === 5) {
                cell.style = viewMode === 'cantidad' ? ESTILOS.numberDecimal : ESTILOS.number;
            } else if (colNum === 6) {
                cell.style = viewMode === 'cantidad' ? ESTILOS.numberDecimal : ESTILOS.number;
            } else if (colNum >= 7) {
                const valor = cell.value as number;
                const esPico = periodos[colNum - 7]?.key === mesPicoKey && valor > 0;
                if (esPico) {
                    cell.style = viewMode === 'cantidad' ? ESTILOS.picoCantidad : ESTILOS.pico;
                } else {
                    cell.style = viewMode === 'cantidad' ? ESTILOS.numberDecimal : ESTILOS.number;
                }
            } else {
                cell.style = ESTILOS.bodyCenter;
            }
        });
    });

    // ── FILA DE TOTALES ──
    const totalRow = worksheet.addRow([
        '',
        'TOTALES GENERALES',
        '',
        '',
        '',
        viewMode === 'cantidad' ? totalCantidadGeneral : totalGeneral,
        ...periodos.map(p => totalesMensuales[p.key] || 0)
    ]);
    totalRow.height = 24;
    totalRow.eachCell((cell, colNum) => {
        if (colNum === 2) {
            cell.style = {
                ...ESTILOS.total,
                alignment: { horizontal: 'right', vertical: 'middle' },
                font: { ...(ESTILOS.total.font as ExcelJS.Font), bold: true }
            };
        } else if (colNum === 6) {
            cell.style = viewMode === 'cantidad' ? ESTILOS.totalCantidad : ESTILOS.total;
        } else if (colNum >= 7) {
            const valor = cell.value as number;
            const esPico = periodos[colNum - 7]?.key === mesPicoKey && valor > 0;
            if (esPico) {
                const picoStyle = viewMode === 'cantidad' ? ESTILOS.picoCantidad : ESTILOS.pico;
                cell.style = {
                    ...picoStyle,
                    font: { ...(picoStyle.font as ExcelJS.Font), bold: true }
                };
            } else {
                cell.style = viewMode === 'cantidad' ? ESTILOS.totalCantidad : ESTILOS.total;
            }
        } else {
            cell.style = ESTILOS.bodyCenter;
        }
    });

    // ── FILA DE PORCENTAJES ──
    const totalMensualGeneral = Object.values(totalesMensuales).reduce((a, b) => a + b, 0);
    const porcentajes = periodos.map(p => {
        const monto = totalesMensuales[p.key] || 0;
        return totalMensualGeneral > 0 ? (monto / totalMensualGeneral) * 100 : 0;
    });

    const pctRow = worksheet.addRow([
        '',
        '% DISTRIBUCIÓN MENSUAL',
        '',
        '',
        '',
        '100%',
        ...porcentajes
    ]);
    pctRow.height = 20;
    pctRow.eachCell((cell, colNum) => {
        if (colNum === 2) {
            cell.style = {
                ...ESTILOS.sectionHeader,
                alignment: { horizontal: 'right', vertical: 'middle' }
            };
        } else if (colNum === 6) {
            cell.style = ESTILOS.sectionHeader;
        } else if (colNum >= 7) {
            cell.style = { ...ESTILOS.sectionHeader, numFmt: '0.00"%"' };
        } else {
            cell.style = ESTILOS.bodyCenter;
        }
    });

    // Espacio
    worksheet.addRow([]);
    worksheet.addRow([]);

    // ─────────────────────────────────────────────────────────────────────────
    // SECCIÓN 3: RESUMEN EJECUTIVO
    // ─────────────────────────────────────────────────────────────────────────
    const summaryStartRow = worksheet.rowCount + 1;
    
    worksheet.mergeCells(`A${summaryStartRow}:F${summaryStartRow}`);
    worksheet.getCell(`A${summaryStartRow}`).value = '📊 RESUMEN EJECUTIVO DEL PROYECTO';
    worksheet.getCell(`A${summaryStartRow}`).style = {
        ...ESTILOS.title,
        font: { ...(ESTILOS.title.font as ExcelJS.Font), size: 12 }
    };

    const resumenData: Array<[string, string | number]> = [
        ['Total de insumos / materiales:', materiales.length],
        ['Total de partidas en Gantt:', 'N/A'],
        ['Duración del proyecto:', `${periodos.length} meses`],
        ['Mes de mayor consumo:', periodos.find(p => p.key === mesPicoKey)?.labelCal || '-'],
        ['Monto del mes pico:', `S/. ${maxMonto.toFixed(2)}`],
        ['Presupuesto total de materiales:', `S/. ${totalGeneral.toFixed(2)}`],
    ];

    let resumenRow = summaryStartRow + 1;
    resumenData.forEach(([label, value]) => {
        const labelCell = worksheet.getCell(`A${resumenRow}`);
        const valueCell = worksheet.getCell(`B${resumenRow}`);
        labelCell.value = label;
        valueCell.value = value;
        labelCell.style = {
            ...ESTILOS.bodyLeft,
            font: { ...(ESTILOS.bodyLeft.font as ExcelJS.Font), bold: true }
        };
        valueCell.style = ESTILOS.bodyLeft;
        resumenRow++;
    });

    // ─────────────────────────────────────────────────────────────────────────
    // AJUSTAR ANCHOS DE COLUMNAS
    // ─────────────────────────────────────────────────────────────────────────
    worksheet.getColumn(1).width = 6;   // ITEM
    worksheet.getColumn(2).width = 50;  // DESCRIPCIÓN
    worksheet.getColumn(3).width = 8;   // UND
    worksheet.getColumn(4).width = 18;  // TIPO
    worksheet.getColumn(5).width = 14;  // PRECIO
    worksheet.getColumn(6).width = 16;  // TOTAL
    
    for (let i = 0; i < periodos.length; i++) {
        worksheet.getColumn(7 + i).width = 14;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONGELAR PANEL (primeras 6 columnas + fila de encabezados)
    // ─────────────────────────────────────────────────────────────────────────
    worksheet.views = [{ state: 'frozen', xSplit: 6, ySplit: 6 }];

    // ─────────────────────────────────────────────────────────────────────────
    // GENERAR Y DESCARGAR ARCHIVO
    // ─────────────────────────────────────────────────────────────────────────
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    const filename = `Cronograma_Materiales_${projectName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;
    saveAs(blob, filename);
};
