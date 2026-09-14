import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { addInstitutionalHeader, type ProjectLetterhead } from '@/lib/excel-export-utils';
import type { GgPayload, GgRow } from '../gg/types';
import type { MatPayload, MatRow } from '../mat/types';
import type { MoPayload, MoRow } from '../mo/types';
import type { ResumenPayload } from '../resumen/types';

// Exporta las 4 hojas del editor de Mantenimiento (RESUMEN/MO/MAT/GG) a un solo libro Excel.
//
// Regla de oro de esta exportación: CERO cálculos propios. Cada celda numérica sale de leer
// directamente el mismo string que ya viene del backend (MoCalculator/MatCalculator/GgCalculator/
// ResumenCalculator) y que el usuario ya ve en pantalla — nunca de una SUMA en Excel ni de una
// operación hecha aquí. Así el Excel y la pantalla son, por construcción, el mismo número: no hay
// forma de que un redondeo de Excel se desvíe del redondeo del backend (DecimalMath).
//
// El formato de cada celda (money/rate/qty) replica la misma convención que ya usan las hojas en
// pantalla: Cantidad = número plano; P.U./Costo U. = número plano a 3 decimales (igual que
// MoNumberCell con decimals=3); Parcial/P.T./Subtotal/Total/Saldo/Presupuesto/Gasto = con "S/ " y
// 2 decimales (igual que money()). Es solo apariencia — el valor numérico subyacente es siempre
// el mismo, así que esto nunca afecta si el monto cuadra o no.

const MONEY_FMT = '"S/ "#,##0.00';
const RATE_FMT = '#,##0.000';
const QTY_FMT = '#,##0.00';
const PCT_FMT = '0.00"%"';

interface ExportParams {
    project: ProjectLetterhead;
    document: { nombre: string; moneda: string; revision: number };
    mo: MoPayload;
    mat: MatPayload;
    gg: GgPayload;
    resumen: ResumenPayload;
}

// Convierte el string decimal del payload a number para escribir en la celda. null/undefined/''
// quedan en blanco (no en "0.00") para no inventar un valor que el backend no mandó.
function n(value: string | null | undefined): number | null {
    if (value == null || value.trim() === '') return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
}

type CellKind = 'text' | 'center' | 'qty' | 'rate' | 'money' | 'pct';
interface Cell {
    value: string | number | null;
    kind?: CellKind;
}

function borderThin(color = 'FFD1D5DB'): Partial<ExcelJS.Borders> {
    const b: ExcelJS.Border = { style: 'thin', color: { argb: color } };
    return { top: b, left: b, bottom: b, right: b };
}

function pushRow(ws: ExcelJS.Worksheet, cells: Cell[]): ExcelJS.Row {
    const row = ws.addRow(cells.map((c) => c.value));
    row.eachCell((cell, col) => {
        const kind = cells[col - 1]?.kind ?? 'text';
        if (kind === 'money') cell.numFmt = MONEY_FMT;
        else if (kind === 'rate') cell.numFmt = RATE_FMT;
        else if (kind === 'qty') cell.numFmt = QTY_FMT;
        else if (kind === 'pct') cell.numFmt = PCT_FMT;
        cell.alignment =
            kind === 'text'
                ? { horizontal: 'left', vertical: 'middle', wrapText: true }
                : kind === 'center'
                  ? { horizontal: 'center', vertical: 'middle' }
                  : { horizontal: 'right', vertical: 'middle' };
        cell.border = borderThin();
        cell.font = { name: 'Calibri', size: 10 };
    });
    return row;
}

function styleHeaderRow(row: ExcelJS.Row, bg = 'FF1F2937'): void {
    row.eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = borderThin();
    });
    row.height = 26;
}

function boldRow(row: ExcelJS.Row, bg = 'FFE5E7EB'): void {
    row.eachCell((cell) => {
        cell.font = { ...(cell.font as Partial<ExcelJS.Font>), bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    });
}

// ───────────────────────────── MO ─────────────────────────────

function buildMoSheet(wb: ExcelJS.Workbook, mo: MoPayload): void {
    const ws = wb.addWorksheet('MO', { views: [{ state: 'frozen', ySplit: 1 }] });
    const seriesLabels = mo.series.map((s) => s.etiqueta ?? `P.M.O ${s.indice}`);

    const headerRow = ws.addRow([
        'Ítem', 'Descripción', 'Und',
        'ET Cant.', 'ET P.U.', 'ET Parcial',
        'Cot. Cant.', 'Cot. P.U.', 'Cot. Parcial',
        'Presupuesto',
        ...seriesLabels,
        'Final', 'Saldo',
    ]);
    styleHeaderRow(headerRow);

    ws.columns = [
        { width: 14 }, { width: 42 }, { width: 8 },
        { width: 11 }, { width: 11 }, { width: 13 },
        { width: 11 }, { width: 11 }, { width: 13 },
        { width: 14 },
        ...seriesLabels.map(() => ({ width: 13 })),
        { width: 13 }, { width: 13 },
    ];

    mo.rows.forEach((row: MoRow) => {
        const isIe = row.tipo === 'ie';
        const excelRow = pushRow(ws, [
            { value: isIe ? '' : (row.item ?? ''), kind: 'center' },
            { value: isIe ? row.descripcion : row.descripcion, kind: 'text' },
            { value: row.unidad ?? '', kind: 'center' },
            { value: n(row.et.cantidad), kind: 'qty' },
            { value: n(row.et.precio), kind: 'rate' },
            { value: n(row.et.parcial), kind: 'money' },
            { value: n(row.cot.cantidad), kind: 'qty' },
            { value: n(row.cot.precio), kind: 'rate' },
            { value: n(row.cot.parcial), kind: 'money' },
            { value: n(row.presupuesto), kind: 'money' },
            ...mo.series.map((s): Cell => ({ value: n(row.parciales[s.id] ?? null), kind: 'money' })),
            { value: n(row.final), kind: 'money' },
            { value: n(row.saldo), kind: 'money' },
        ]);
        if (isIe) boldRow(excelRow, 'FF1F2937');
        else if (row.tipo === 'bloque') boldRow(excelRow, 'FFFDEBD3');
    });

    const totalRow = pushRow(ws, [
        { value: '', kind: 'center' }, { value: 'TOTAL', kind: 'text' }, { value: '', kind: 'center' },
        { value: null, kind: 'qty' }, { value: null, kind: 'rate' }, { value: n(mo.totales.general.et_parcial), kind: 'money' },
        { value: null, kind: 'qty' }, { value: null, kind: 'rate' }, { value: n(mo.totales.general.cot_parcial), kind: 'money' },
        { value: n(mo.totales.general.presupuesto), kind: 'money' },
        ...mo.series.map((s): Cell => ({ value: n(mo.totales.por_serie[s.id] ?? null), kind: 'money' })),
        { value: n(mo.totales.general.final), kind: 'money' },
        { value: n(mo.totales.general.saldo), kind: 'money' },
    ]);
    boldRow(totalRow, 'FFD1D5DB');
}

// ───────────────────────────── MAT ─────────────────────────────

function buildMatSheet(wb: ExcelJS.Workbook, mat: MatPayload): void {
    const ws = wb.addWorksheet('MAT', { views: [{ state: 'frozen', ySplit: 1 }] });
    const cotSlots = [1, 2, 3];
    const compraLabels = mat.compras.map((c) => c.etiqueta ?? `Compra ${c.indice}`);

    const headerRow = ws.addRow([
        'Ítem', 'Descripción', 'Und', 'Met.',
        'ET Cant.', 'ET P.U.', 'ET P.T.',
        ...cotSlots.flatMap((s) => [`Cot.${s} Prov.`, `Cot.${s} Cant.`, `Cot.${s} P.U.`, `Cot.${s} P.T.`]),
        'P.U. mín', 'P.T. ref',
        ...compraLabels.flatMap((label) => [`${label} Cant.`, `${label} P.U.`, `${label} Subtotal`]),
        'Total comprado', 'Saldo',
    ]);
    styleHeaderRow(headerRow);

    ws.columns = [
        { width: 14 }, { width: 38 }, { width: 8 }, { width: 10 },
        { width: 10 }, { width: 11 }, { width: 13 },
        ...cotSlots.flatMap(() => [{ width: 14 }, { width: 10 }, { width: 11 }, { width: 13 }]),
        { width: 11 }, { width: 13 },
        ...compraLabels.flatMap(() => [{ width: 10 }, { width: 11 }, { width: 13 }]),
        { width: 15 }, { width: 13 },
    ];

    const blankCotCells = (): Cell[] => [{ value: null, kind: 'center' }, { value: null, kind: 'qty' }, { value: null, kind: 'rate' }, { value: null, kind: 'money' }];
    const blankCompraCells = (): Cell[] => [{ value: null, kind: 'qty' }, { value: null, kind: 'rate' }, { value: null, kind: 'money' }];

    mat.rows.forEach((row: MatRow) => {
        if (!row.es_material) {
            // Fila de institución/bloque/partida: solo estructura + P.T. del expediente técnico
            // (mismo dato que se ve en pantalla en su fila de cabecera), sin columnas de material.
            const excelRow = pushRow(ws, [
                { value: row.item ?? '', kind: 'center' },
                { value: row.descripcion, kind: 'text' },
                { value: row.unidad ?? '', kind: 'center' },
                { value: n(row.metrado ?? null), kind: 'qty' },
                { value: null, kind: 'qty' }, { value: null, kind: 'rate' }, { value: n(row.pt_et ?? null), kind: 'money' },
                ...cotSlots.flatMap(blankCotCells),
                { value: null, kind: 'rate' }, { value: null, kind: 'money' },
                ...compraLabels.flatMap(blankCompraCells),
                { value: n(row.total_comprado), kind: 'money' },
                { value: n(row.saldo), kind: 'money' },
            ]);
            if (row.tipo === 'ie') boldRow(excelRow, 'FF1F2937');
            else boldRow(excelRow, 'FFFDEBD3');
            return;
        }

        pushRow(ws, [
            { value: '', kind: 'center' },
            { value: `   ${row.descripcion}`, kind: 'text' },
            { value: row.unidad ?? '', kind: 'center' },
            { value: null, kind: 'qty' },
            { value: n(row.et?.cantidad ?? null), kind: 'qty' },
            { value: n(row.et?.precio ?? null), kind: 'rate' },
            { value: n(row.et?.pt ?? null), kind: 'money' },
            ...cotSlots.flatMap((slot): Cell[] => {
                const cot = row.cotizaciones?.find((c) => c.slot === slot);
                return [
                    { value: cot?.proveedor ?? '', kind: 'center' },
                    { value: n(cot?.cantidad ?? null), kind: 'qty' },
                    { value: n(cot?.precio ?? null), kind: 'rate' },
                    { value: n(cot?.pt ?? null), kind: 'money' },
                ];
            }),
            { value: n(row.pu_minimo ?? null), kind: 'rate' },
            { value: n(row.pt_referencia ?? null), kind: 'money' },
            ...mat.compras.flatMap((c): Cell[] => {
                const cell = row.compras?.[c.id];
                return [
                    { value: n(cell?.cantidad ?? null), kind: 'qty' },
                    { value: n(cell?.precio ?? null), kind: 'rate' },
                    { value: n(cell?.subtotal ?? null), kind: 'money' },
                ];
            }),
            { value: n(row.total_comprado), kind: 'money' },
            { value: n(row.saldo), kind: 'money' },
        ]);
    });

    const totalRow = pushRow(ws, [
        { value: '', kind: 'center' }, { value: 'TOTAL', kind: 'text' }, { value: '', kind: 'center' }, { value: null, kind: 'qty' },
        { value: null, kind: 'qty' }, { value: null, kind: 'rate' }, { value: n(mat.totales.general.pt_et), kind: 'money' },
        ...cotSlots.flatMap(blankCotCells),
        { value: null, kind: 'rate' }, { value: null, kind: 'money' },
        ...mat.compras.flatMap((c): Cell[] => [{ value: null, kind: 'qty' }, { value: null, kind: 'rate' }, { value: n(mat.totales.por_compra[c.id] ?? null), kind: 'money' }]),
        { value: n(mat.totales.general.total_comprado), kind: 'money' },
        { value: n(mat.totales.general.saldo), kind: 'money' },
    ]);
    boldRow(totalRow, 'FFD1D5DB');
}

// ───────────────────────────── GG ─────────────────────────────

function buildGgSheet(wb: ExcelJS.Workbook, gg: GgPayload): void {
    const ws = wb.addWorksheet('GG', { views: [{ state: 'frozen', ySplit: 1 }] });
    const pagoLabels = gg.pagos.map((p) => p.etiqueta ?? `Pago ${p.indice}`);

    const headerRow = ws.addRow([
        'Ítem', 'Descripción', 'Und', 'Cant.', 'Costo U.',
        'Gasto E.T.', 'Gasto Proyectado',
        ...pagoLabels,
        'Total pagado', 'Saldo',
    ]);
    styleHeaderRow(headerRow);

    ws.columns = [
        { width: 12 }, { width: 40 }, { width: 8 }, { width: 10 }, { width: 11 },
        { width: 13 }, { width: 15 },
        ...pagoLabels.map(() => ({ width: 13 })),
        { width: 14 }, { width: 13 },
    ];

    gg.rows.forEach((row: GgRow) => {
        const isLinea = row.tipo === 'linea';
        const excelRow = pushRow(ws, [
            { value: isLinea ? '' : row.item, kind: 'center' },
            { value: isLinea ? `   ${row.descripcion}` : row.tipo === 'rubro' ? row.rubro : row.descripcion, kind: 'text' },
            { value: isLinea ? (row.unidad ?? '') : '', kind: 'center' },
            { value: isLinea ? n(row.cantidad) : null, kind: 'qty' },
            { value: isLinea ? n(row.costo_unitario) : null, kind: 'rate' },
            { value: n(row.gasto_et), kind: 'money' },
            { value: n(row.gasto_proyectado), kind: 'money' },
            ...gg.pagos.map((p): Cell => ({ value: n(row.por_pago[p.id] ?? null), kind: 'money' })),
            { value: n(row.total_pagado), kind: 'money' },
            { value: n(row.saldo), kind: 'money' },
        ]);
        if (row.tipo === 'grupo') boldRow(excelRow, 'FF1F2937');
        else if (row.tipo === 'rubro') boldRow(excelRow, 'FFFDEBD3');
    });

    const totalRow = pushRow(ws, [
        { value: '', kind: 'center' }, { value: 'TOTAL', kind: 'text' }, { value: '', kind: 'center' },
        { value: null, kind: 'qty' }, { value: null, kind: 'rate' },
        { value: n(gg.totales.general.gasto_et), kind: 'money' },
        { value: n(gg.totales.general.gasto_proyectado), kind: 'money' },
        ...gg.pagos.map((p): Cell => ({ value: n(gg.totales.por_pago[p.id] ?? null), kind: 'money' })),
        { value: n(gg.totales.general.total_pagado), kind: 'money' },
        { value: n(gg.totales.general.saldo), kind: 'money' },
    ]);
    boldRow(totalRow, 'FFD1D5DB');
}

// ───────────────────────────── RESUMEN ─────────────────────────────

function buildResumenSheet(wb: ExcelJS.Workbook, resumen: ResumenPayload): void {
    const ws = wb.addWorksheet('RESUMEN', { views: [{ state: 'frozen', ySplit: 0 }] });
    ws.columns = [{ width: 34 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }];

    const sectionTitle = (title: string) => {
        const row = ws.addRow([title]);
        ws.mergeCells(row.number, 1, row.number, 8);
        row.getCell(1).font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
        row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
        row.height = 22;
        ws.addRow([]);
    };

    // 1. RESUMEN GENERAL
    sectionTitle('RESUMEN GENERAL');
    styleHeaderRow(ws.addRow(['Componente', 'Presupuesto Expediente', 'Presupuesto Aprobado Ideal']));
    resumen.general.rows.forEach((row) => {
        pushRow(ws, [{ value: row.label, kind: 'text' }, { value: n(row.expediente), kind: 'money' }, { value: n(row.aprobado_ideal), kind: 'money' }]);
    });
    ws.addRow([]);

    // 2. RESUMEN DESAGREGADO
    sectionTitle('RESUMEN DESAGREGADO');
    styleHeaderRow(ws.addRow(['Componente', 'Aprob. Ideal', 'Proy. Real', 'Actual', 'Deuda', 'Déficit', '% Gasto', '% Avance']));
    resumen.desagregado.rows.forEach((row) => {
        if (row.tipo === 'blank') { ws.addRow([]); return; }
        if (row.tipo === 'sub') {
            const r = ws.addRow([row.label]);
            r.getCell(1).font = { bold: true };
            return;
        }
        const r = pushRow(ws, [
            { value: row.label, kind: 'text' },
            { value: n(row.aprobado_ideal), kind: 'money' },
            { value: n(row.proyectado_real), kind: 'money' },
            { value: n(row.actual), kind: 'money' },
            { value: n(row.deuda), kind: 'money' },
            { value: n(row.deficit), kind: 'money' },
            { value: row.pct_gasto_actual == null ? null : Number(row.pct_gasto_actual), kind: 'pct' },
            { value: row.pct_avance == null ? null : Number(row.pct_avance), kind: 'pct' },
        ]);
        if (row.tipo === 'rollup') r.getCell(1).font = { bold: true };
    });
    ws.addRow([]);

    // 3. MONTO A INVERTIR
    sectionTitle('MONTO A INVERTIR');
    const armadaLabel: Record<string, string> = { armada_1: '1ER', armada_2: '2DO', liquidacion: 'LIQUIDACIÓN' };
    styleHeaderRow(ws.addRow(['Componente', ...resumen.monto_invertir.armadas.map((a) => armadaLabel[a]), 'Sub Total']));
    [...resumen.monto_invertir.componentes, ...resumen.monto_invertir.socios].forEach((row) => {
        pushRow(ws, [
            { value: row.label, kind: 'text' },
            ...resumen.monto_invertir.armadas.map((a): Cell => ({ value: n(row.armadas[a]), kind: 'money' })),
            { value: n(row.sub_total), kind: 'money' },
        ]);
    });
    ws.addRow([]);

    // 4. GASTO REAL
    sectionTitle('GASTO REAL');
    styleHeaderRow(ws.addRow(['Concepto', 'Ejecutado', 'Por Pagar', 'Total']));
    resumen.gasto_real.lineas.forEach((linea) => {
        pushRow(ws, [
            { value: linea.label, kind: 'text' },
            { value: n(linea.ejecutado), kind: 'money' },
            { value: n(linea.por_pagar), kind: 'money' },
            { value: n(linea.total), kind: 'money' },
        ]);
    });
    ws.addRow([]);
    const resumenLine = pushRow(ws, [
        { value: 'GASTO TOTAL', kind: 'text' },
        { value: n(resumen.gasto_real.gasto_total), kind: 'money' },
        { value: 'TOTAL ADJUDICADO', kind: 'text' },
        { value: n(resumen.gasto_real.total_adjudicado), kind: 'money' },
    ]);
    resumenLine.getCell(1).font = { bold: true };
    resumenLine.getCell(3).font = { bold: true };
    const utilidadRow = pushRow(ws, [{ value: 'UTILIDAD', kind: 'text' }, { value: n(resumen.gasto_real.utilidad), kind: 'money' }]);
    utilidadRow.getCell(1).font = { bold: true };
}

export async function exportMantenimientoExcel({ project, document, mo, mat, gg, resumen }: ExportParams): Promise<void> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Proyecta PCL';
    wb.created = new Date();

    // RESUMEN primero (es la pestaña con la que abre el editor).
    buildResumenSheet(wb, resumen);
    buildMoSheet(wb, mo);
    buildMatSheet(wb, mat);
    buildGgSheet(wb, gg);

    for (const ws of wb.worksheets) {
        const totalCols = ws.columnCount;
        const wasFrozenAtHeaderRow = ws.name !== 'RESUMEN';
        await addInstitutionalHeader(wb, ws, project, totalCols, `MANTENIMIENTO — ${document.nombre} — ${ws.name}`);
        // addInstitutionalHeader inserta 2 filas arriba: el encabezado de columnas (congelado al
        // crear la hoja en ySplit:1) ahora quedó en la fila 3, no en la 1 — reajustamos el freeze
        // para que siga siendo la cabecera de columnas la que queda fija al hacer scroll.
        if (wasFrozenAtHeaderRow) ws.views = [{ state: 'frozen', ySplit: 3 }];
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fecha = new Date().toISOString().slice(0, 10);
    const nombreLimpio = document.nombre
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 40);
    saveAs(blob, `Mantenimiento_${nombreLimpio || 'documento'}_${fecha}.xlsx`);
}
