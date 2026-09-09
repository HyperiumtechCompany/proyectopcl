import axios from 'axios';
import Decimal from 'decimal.js';
import ExcelJS from 'exceljs';

type Row = Record<string, unknown>;

interface ProjectExportData {
    id: number;
    nombre: string;
    codigo_cui?: string;
    codigo_local?: string;
    codigos_modulares?: string[];
    unidad_ejecutora?: string;
    logo_izquierdo_url?: string;
    logo_derecho_url?: string;
}

interface HeaderImages { left?: number; right?: number }

const BLUE = '1F4E79';
const LIGHT_BLUE = 'D9EAF7';
const numberFormat = '#,##0.0000';

const number = (value: unknown): number => {
    try {
        return new Decimal(String(value ?? 0)).toDecimalPlaces(4).toNumber();
    } catch {
        return 0;
    }
};

function addHeader(sheet: ExcelJS.Worksheet, project: ProjectExportData, title: string, columns: number, images: HeaderImages = {}): number {
    const last = sheet.getColumn(columns).letter;
    sheet.mergeCells(`A1:${last}1`);
    sheet.getCell('A1').value = `"${project.nombre.toLocaleUpperCase('es-PE')}"`;
    sheet.getCell('A1').font = { bold: true, italic: true, size: 11 };
    sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 42;
    if (images.left !== undefined) sheet.addImage(images.left, { tl: { col: 0, row: 0 }, ext: { width: 105, height: 55 } });
    if (images.right !== undefined) sheet.addImage(images.right, { tl: { col: Math.max(1, columns - 1), row: 0 }, ext: { width: 105, height: 55 } });

    sheet.mergeCells(`A3:${last}3`);
    sheet.getCell('A3').value = `CUI: ${project.codigo_cui || '-'}; CÓDIGO MODULAR: ${project.codigos_modulares?.join('-') || '-'}; CÓDIGO LOCAL: ${project.codigo_local || '-'}`;
    sheet.mergeCells(`A4:${last}4`);
    sheet.getCell('A4').value = `UNIDAD EJECUTORA: ${project.unidad_ejecutora || '-'}`;
    sheet.mergeCells(`A6:${last}6`);
    sheet.getCell('A6').value = title;
    sheet.getCell('A6').font = { bold: true, size: 14 };
    for (const address of ['A3', 'A4', 'A6']) sheet.getCell(address).alignment = { horizontal: 'center' };
    return 8;
}

async function loadHeaderImages(workbook: ExcelJS.Workbook, project: ProjectExportData): Promise<HeaderImages> {
    const load = async (url?: string): Promise<number | undefined> => {
        if (!url) return undefined;
        try {
            const response = await fetch(url);
            if (!response.ok) return undefined;
            const buffer = await response.arrayBuffer();
            const extension = /\.jpe?g(?:\?|$)/i.test(url) ? 'jpeg' : 'png';
            return workbook.addImage({ buffer, extension });
        } catch {
            return undefined;
        }
    };
    const [left, right] = await Promise.all([load(project.logo_izquierdo_url), load(project.logo_derecho_url)]);
    return { left, right };
}

function styleHeader(row: ExcelJS.Row): void {
    row.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BLUE}` } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
}

function finish(sheet: ExcelJS.Worksheet, widths: number[]): void {
    widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
    sheet.views = [{ state: 'frozen', ySplit: 8 }];
    sheet.pageSetup = { fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: widths.length > 8 ? 'landscape' : 'portrait' };
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber < 8) return;
        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
    });
}

function addTreeSheet(
    workbook: ExcelJS.Workbook,
    project: ProjectExportData,
    name: string,
    title: string,
    rows: Row[],
    columns: Array<[string, string]>,
    totalKey: string,
    images: HeaderImages,
): { totalCell: string } {
    const sheet = workbook.addWorksheet(name);
    let rowIndex = addHeader(sheet, project, title, columns.length, images);
    styleHeader(sheet.addRow(columns.map(([, label]) => label)));
    rowIndex++;
    const first = rowIndex;

    for (const item of rows) {
        const row = sheet.addRow(columns.map(([key]) => {
            const value = item[key];
            return ['cantidad', 'costo_unitario', 'parcial', 'cantidad_descripcion', 'cantidad_tiempo', 'participacion', 'precio', 'precio_unitario', 'meses', 'importe', 'subtotal', 'sub_total', 'sueldo_basico', 'asignacion_familiar', 'snp', 'essalud', 'cts', 'vacaciones', 'gratificacion', 'total_mensual_unitario', 'total_proyecto'].includes(key)
                ? number(value)
                : String(value ?? '');
        }));
        if (item.tipo_fila && item.tipo_fila !== 'detalle') {
            row.font = { bold: true };
            row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${LIGHT_BLUE}` } };
        }
    }

    const totalColumn = columns.findIndex(([key]) => key === totalKey) + 1;
    const totalRow = sheet.addRow([]);
    totalRow.getCell(Math.max(1, totalColumn - 1)).value = 'TOTAL';
    totalRow.getCell(totalColumn).value = { formula: `SUM(${sheet.getColumn(totalColumn).letter}${first}:${sheet.getColumn(totalColumn).letter}${totalRow.number - 1})` };
    totalRow.font = { bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${LIGHT_BLUE}` } };
    for (let column = 1; column <= columns.length; column++) {
        if (column >= 3) sheet.getColumn(column).numFmt = numberFormat;
    }
    finish(sheet, columns.map(([key]) => ['descripcion', 'concepto', 'cargo'].includes(key) ? 48 : 15));

    return { totalCell: `'${name}'!${sheet.getColumn(totalColumn).letter}${totalRow.number}` };
}

export async function exportarGastosGeneralesExcel(project: ProjectExportData): Promise<void> {
    const base = `/costos/proyectos/${project.id}/presupuesto`;
    const [snapshotResponse, fijosResponse, variablesResponse, remuneracionesResponse, supervisionResponse, controlResponse, paramsResponse] = await Promise.all([
        axios.get(`${base}/consolidado/snapshot`),
        axios.get(`${base}/gastos_fijos/data`),
        axios.get(`${base}/gastos_generales/data`),
        axios.get(`${base}/remuneraciones/data`),
        axios.get(`${base}/supervision/data`),
        axios.get(`${base}/control_concurrente/data`),
        axios.get(`${base}/params`),
    ]);

    const snapshot = snapshotResponse.data.data as Row;
    const fijos = (fijosResponse.data.rows || []) as Row[];
    const variables = (variablesResponse.data.rows || []) as Row[];
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Delphin - Costos';
    workbook.created = new Date();
    const headerImages = await loadHeaderImages(workbook, project);

    const consolidado = workbook.addWorksheet('CONSOLIDADO');
    addHeader(consolidado, project, 'CONSOLIDADO DE INVERSIÓN', 4, headerImages);
    styleHeader(consolidado.addRow(['COMPONENTE', 'DESCRIPCIÓN', 'PORCENTAJE', 'MONTO (S/.)']));
    const generales = workbook.addWorksheet('G GENERALES');
    addHeader(generales, project, 'CÁLCULO DE GASTOS GENERALES', 8, headerImages);
    const fixedSheet = addTreeSheet(workbook, project, 'GG. FIJOS', 'GASTOS GENERALES FIJOS', fijos, [
        ['item_codigo', 'ÍTEM'], ['descripcion', 'DESCRIPCIÓN'], ['unidad', 'UNIDAD'], ['cantidad', 'CANT.'],
        ['costo_unitario', 'COSTO UNITARIO'], ['parcial', 'PARCIAL'],
    ], 'parcial', headerImages);
    const variableSheet = addTreeSheet(workbook, project, 'GG. VARIABLES', 'GASTOS GENERALES VARIABLES', variables, [
        ['item_codigo', 'ÍTEM'], ['descripcion', 'DESCRIPCIÓN'], ['unidad', 'UNIDAD'], ['cantidad_descripcion', 'CANT.'],
        ['cantidad_tiempo', 'TIEMPO'], ['participacion', 'PART. %'], ['precio', 'PRECIO'], ['parcial', 'PARCIAL'],
    ], 'parcial', headerImages);

    const combinedColumns = ['ÍTEM', 'DESCRIPCIÓN', 'UNIDAD', 'CANT.', 'TIEMPO', 'PART. %', 'PRECIO', 'PARCIAL'];
    const appendCombinedSection = (title: string, sourceRows: Row[], fixed: boolean, totalCell: string) => {
        const titleRow = generales.addRow([title]);
        generales.mergeCells(`A${titleRow.number}:H${titleRow.number}`);
        titleRow.font = { bold: true, color: { argb: 'FF0000CC' } };
        styleHeader(generales.addRow(combinedColumns));
        sourceRows.forEach((item) => generales.addRow(fixed
            ? [item.item_codigo, item.descripcion, item.unidad, number(item.cantidad), '', '', number(item.costo_unitario), number(item.parcial)]
            : [item.item_codigo, item.descripcion, item.unidad, number(item.cantidad_descripcion), number(item.cantidad_tiempo), number(item.participacion), number(item.precio), number(item.parcial)]));
        const total = generales.addRow(['', '', '', '', '', '', 'TOTAL', { formula: totalCell }]);
        total.font = { bold: true };
        total.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${LIGHT_BLUE}` } };
        generales.addRow([]);
    };
    appendCombinedSection('01) GASTOS GENERALES FIJOS', fijos, true, fixedSheet.totalCell);
    appendCombinedSection('02) GASTOS GENERALES VARIABLES', variables, false, variableSheet.totalCell);
    generales.getColumn(4).numFmt = numberFormat;
    generales.getColumn(5).numFmt = numberFormat;
    generales.getColumn(6).numFmt = numberFormat;
    generales.getColumn(7).numFmt = numberFormat;
    generales.getColumn(8).numFmt = numberFormat;
    finish(generales, [14, 48, 12, 14, 14, 14, 17, 18]);

    const ggOverride = snapshot.gastos_generales_porcentaje;
    const consolidatedRows: Array<[string, string, unknown, ExcelJS.CellValue]> = [
        ['I', 'Costo directo', 100, number(snapshot.comp_i_costo_directo)],
        ['II', 'Gastos generales', number(snapshot.comp_ii_porcentaje), ggOverride == null
            ? { formula: `${fixedSheet.totalCell}+${variableSheet.totalCell}`, result: number(snapshot.comp_ii_gastos_generales) }
            : { formula: `ROUND(D9*C10/100,4)`, result: number(snapshot.comp_ii_gastos_generales) }],
        ['III', 'Utilidad', number(snapshot.comp_iii_porcentaje), { formula: 'ROUND(D9*C11/100,4)', result: number(snapshot.comp_iii_utilidad) }],
        ['IV', 'Subtotal sin IGV', 100, { formula: 'SUM(D9:D11)', result: number(snapshot.comp_iv_subtotal_sin_igv) }],
        ['V', 'IGV', number(snapshot.comp_v_porcentaje), { formula: 'ROUND(D12*C13/100,4)', result: number(snapshot.comp_v_igv) }],
        ['VI', 'Valor con IGV', 100, { formula: 'D12+D13', result: number(snapshot.comp_vi_valor_con_igv) }],
    ];
    consolidatedRows.forEach((values) => consolidado.addRow(values));
    const extras = JSON.parse(String(snapshot.componentes_extra_json || '[]')) as Array<Record<string, unknown>>;
    extras.filter((item) => item.active !== false).forEach((item) => consolidado.addRow(['', String(item.nombre || 'Componente adicional'), '', number(item.monto)]));
    const investmentRow = consolidado.addRow(['', '', 'TOTAL INVERSIÓN', number(snapshot.total_inversion_obra)]);
    investmentRow.font = { bold: true };
    investmentRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${LIGHT_BLUE}` } };
    consolidado.getColumn(3).numFmt = numberFormat;
    consolidado.getColumn(4).numFmt = numberFormat;
    finish(consolidado, [14, 48, 16, 20]);

    addTreeSheet(workbook, project, 'REMUNERACIONES', 'REMUNERACIONES', remuneracionesResponse.data.rows || [], [
        ['cargo', 'CARGO'], ['categoria', 'CATEGORÍA'], ['participacion', 'PART. %'], ['cantidad', 'CANT.'], ['meses', 'MESES'],
        ['sueldo_basico', 'SUELDO'], ['asignacion_familiar', 'ASIG. FAM.'], ['snp', 'SNP'], ['essalud', 'ESSALUD'],
        ['cts', 'CTS'], ['vacaciones', 'VACACIONES'], ['gratificacion', 'GRATIFICACIÓN'],
        ['total_mensual_unitario', 'TOTAL MENSUAL'], ['total_proyecto', 'TOTAL PROYECTO'],
    ], 'total_proyecto', headerImages);
    addTreeSheet(workbook, project, 'SUPERVISIÓN', 'PRESUPUESTO DE SUPERVISIÓN', supervisionResponse.data.rows || [], [
        ['item_codigo', 'ÍTEM'], ['concepto', 'CONCEPTO'], ['unidad', 'UNIDAD'], ['cantidad', 'CANT.'],
        ['meses', 'MESES'], ['importe', 'IMPORTE'], ['subtotal', 'SUBTOTAL'],
    ], 'subtotal', headerImages);
    addTreeSheet(workbook, project, 'CONTROL CONCURRENTE', 'CONTROL CONCURRENTE', controlResponse.data.rows || [], [
        ['item_codigo', 'ÍTEM'], ['descripcion', 'DESCRIPCIÓN'], ['unidad', 'UNIDAD'], ['cantidad_descripcion', 'CANT.'],
        ['cantidad_tiempo', 'TIEMPO'], ['participacion', 'PART. %'], ['precio_unitario', 'PRECIO'], ['sub_total', 'SUBTOTAL'],
    ], 'sub_total', headerImages);

    const paramsSheet = workbook.addWorksheet('PARÁMETROS');
    addHeader(paramsSheet, project, 'PARÁMETROS DE CÁLCULO', 3, headerImages);
    styleHeader(paramsSheet.addRow(['PARÁMETRO', 'VALOR', 'CAMPO']));
    Object.entries((paramsResponse.data.data || paramsResponse.data.params || paramsResponse.data) as Row)
        .filter(([key]) => !['id', 'created_at', 'updated_at', 'presupuesto_id', 'success'].includes(key))
        .forEach(([key, value]) => paramsSheet.addRow([key.replaceAll('_', ' ').toLocaleUpperCase('es-PE'), value as ExcelJS.CellValue, key]));
    finish(paramsSheet, [42, 20, 38]);

    const verification = workbook.addWorksheet('VERIFICACIÓN');
    addHeader(verification, project, 'VERIFICACIÓN DE CÁLCULOS', 5, headerImages);
    styleHeader(verification.addRow(['CONTROL', 'FUENTE', 'CONSOLIDADO', 'DIFERENCIA', 'ESTADO']));
    const verificationRows: Array<[string, string, number]> = [
        ['Gastos generales fijos', fixedSheet.totalCell, number(snapshot.total_gg_fijos)],
        ['Gastos generales variables', variableSheet.totalCell, number(snapshot.total_gg_variables)],
        ['Total inversión', `'CONSOLIDADO'!D${investmentRow.number}`, number(snapshot.total_inversion_obra)],
    ];
    verificationRows.forEach(([label, formula, expected]) => {
        const row = verification.addRow([label, { formula }, expected]);
        row.getCell(4).value = { formula: `ROUND(B${row.number}-C${row.number},4)` };
        row.getCell(5).value = { formula: `IF(ABS(D${row.number})<=0.0001,"OK","REVISAR")` };
    });
    verification.getColumn(2).numFmt = numberFormat;
    verification.getColumn(3).numFmt = numberFormat;
    verification.getColumn(4).numFmt = numberFormat;
    finish(verification, [34, 20, 20, 18, 14]);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gastos_generales_${project.nombre.replace(/[^a-z0-9]+/gi, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
}
