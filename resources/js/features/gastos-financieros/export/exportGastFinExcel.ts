import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { addInstitutionalHeader } from '@/lib/excel-export-utils';
import { boldRow, buildGgSheet, buildResumenSheet, type Cell, n, pushRow, styleHeaderRow } from '../../mantenimiento/export/exportMantenimientoExcel';
import { ggApi } from '../../mantenimiento/gg/ggApi';
import { gastFinApi } from '../gastFinApi';
import type { GastFinProjectData } from '../GastFinView';
import type { GastFinGrupo, MatPayload, MoPayload } from '../types';

// Misma regla que exportMantenimientoExcel: CERO cálculos propios. Cada número sale del string
// que ya calculó el backend (y que se ve en pantalla); ninguna fórmula de Excel ni suma aquí.

interface Params {
    projectId: number;
    documentId: string;
    grupos: GastFinGrupo[];
    projectData?: GastFinProjectData;
}

const GROUP_BG = 'FF1F2937';
const RESULT_BG = 'FFFEF3C7'; // mismo tono ámbar de títulos/resultados que en pantalla (P5)

function buildMoSheet(wb: ExcelJS.Workbook, mo: MoPayload): void {
    const ws = wb.addWorksheet('MO', { views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }] });
    const pagoLabels = mo.pagos.map((pago) => (pago.fecha ? `${pago.nombre}\n${pago.fecha}` : pago.nombre));

    styleHeaderRow(ws.addRow(['Descripción', 'Und', 'Cantidad', 'P.U.', 'Parcial', ...pagoLabels, 'Pagado', 'Saldo']));
    ws.columns = [{ width: 36 }, { width: 7 }, { width: 13 }, { width: 11 }, { width: 14 }, ...pagoLabels.map(() => ({ width: 15 })), { width: 15 }, { width: 15 }];
    const blanks = (count: number): Cell[] => Array.from({ length: count }, () => ({ value: null, kind: 'money' as const }));

    for (const grupo of mo.grupos) {
        const t = grupo.totales;
        boldRow(pushRow(ws, [{ value: grupo.descripcion, kind: 'text' }, ...blanks(4 + mo.pagos.length + 2)]), GROUP_BG);
        ws.lastRow?.eachCell((cell) => (cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }));

        for (const row of grupo.rows) {
            pushRow(ws, [
                { value: row.descripcion, kind: 'text' },
                { value: row.unidad, kind: 'center' },
                { value: n(row.cantidad), kind: 'qty' },
                { value: n(row.precio), kind: 'rate' },
                { value: n(row.parcial), kind: 'money' },
                ...blanks(mo.pagos.length + 2),
            ]);
        }

        for (const [franja, label, total] of [['valorizacion', 'VALORIZACIONES', t.valorizado], ['adelanto', 'ADELANTOS', t.adelantos]] as const) {
            pushRow(ws, [
                { value: label, kind: 'text' },
                ...blanks(4),
                ...mo.pagos.map((pago): Cell => {
                    const celda = grupo.valores[pago.id]?.[franja];
                    return { value: n(celda?.monto ?? null), kind: 'money' };
                }),
                { value: n(total), kind: 'money' },
                { value: null, kind: 'money' },
            ]);
            // La etiqueta de cada celda (p. ej. "VAL 7") va como nota, no como valor: la celda es un monto.
            mo.pagos.forEach((pago, i) => {
                const etiqueta = grupo.valores[pago.id]?.[franja]?.etiqueta;
                if (etiqueta) ws.lastRow!.getCell(6 + i).note = etiqueta;
            });
        }

        boldRow(pushRow(ws, [
            { value: `TOTAL ${grupo.descripcion} — Aprobado ${t.aprobado}`, kind: 'text' },
            ...blanks(3),
            { value: n(t.et_parcial), kind: 'money' },
            ...blanks(mo.pagos.length),
            { value: n(t.pagado), kind: 'money' },
            { value: n(t.saldo), kind: 'money' },
        ]), RESULT_BG);
    }

    const g = mo.totales.general;
    boldRow(pushRow(ws, [
        { value: 'TOTAL GENERAL', kind: 'text' },
        ...blanks(3),
        { value: n(g.et_parcial), kind: 'money' },
        ...blanks(mo.pagos.length),
        { value: n(g.final), kind: 'money' },
        { value: n(g.saldo), kind: 'money' },
    ]), RESULT_BG);
}

function unmergeAll(ws: ExcelJS.Worksheet): string[] {
    const merges = [...((ws.model as { merges?: string[] }).merges ?? [])];
    for (const range of merges) ws.unMergeCells(range);
    return merges;
}

function shiftRange(range: string, rows: number): string {
    return range.replace(/([A-Z]+)(\d+)/g, (_match, col: string, row: string) => `${col}${Number(row) + rows}`);
}

function sheetName(base: string, used: Set<string>): string {
    const clean = base.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28) || 'MAT';
    let name = clean;
    for (let i = 2; used.has(name.toUpperCase()); i++) name = `${clean.slice(0, 25)} ${i}`;
    used.add(name.toUpperCase());
    return name;
}

function buildMatSheet(wb: ExcelJS.Workbook, name: string, grupo: GastFinGrupo, mat: MatPayload): void {
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }] });
    const compraHeaders = mat.compras.flatMap((compra) => {
        const titulo = `COMPRA ${String(compra.numero).padStart(2, '0')}${compra.fecha ? `: ${compra.fecha}` : ''}`;
        return [`${titulo}\nCantidad`, 'P.U.', 'Sub total', 'Proveedor'];
    });

    styleHeaderRow(ws.addRow([
        `INSUMOS ${grupo.descripcion}`, 'Und',
        'E.T. Cantidad', 'E.T. P.U.', 'E.T. Parcial',
        'Cotizado Cantidad', 'Cotizado P.U.', 'Cotizado Parcial',
        ...compraHeaders,
        'Total comprado', 'Saldo',
    ]));
    ws.columns = [
        { width: 44 }, { width: 7 },
        { width: 13 }, { width: 11 }, { width: 14 },
        { width: 13 }, { width: 11 }, { width: 14 },
        ...mat.compras.flatMap(() => [{ width: 12 }, { width: 11 }, { width: 14 }, { width: 18 }]),
        { width: 15 }, { width: 15 },
    ];

    for (const row of mat.rows) {
        pushRow(ws, [
            { value: row.origen === 'expediente' ? row.descripcion : `${row.descripcion} (${row.origen === 'manual' ? 'fuera del E.T.' : 'ya no está en el ACU'})`, kind: 'text' },
            { value: row.unidad ?? '', kind: 'center' },
            { value: n(row.et?.cantidad), kind: 'qty' },
            { value: n(row.et?.precio), kind: 'rate' },
            { value: n(row.et?.parcial), kind: 'money' },
            { value: n(row.cot.cantidad), kind: 'qty' },
            { value: n(row.cot.precio), kind: 'rate' },
            { value: n(row.cot.parcial), kind: 'money' },
            ...mat.compras.flatMap((compra): Cell[] => {
                const celda = row.compras[compra.id];
                return [
                    { value: n(celda?.cantidad), kind: 'qty' },
                    { value: n(celda?.precio), kind: 'rate' },
                    { value: n(celda?.subtotal), kind: 'money' },
                    { value: celda?.proveedor ?? '', kind: 'text' },
                ];
            }),
            { value: n(row.total_comprado), kind: 'money' },
            { value: n(row.saldo), kind: 'money' },
        ]);
    }

    const t = mat.totales;
    boldRow(pushRow(ws, [
        { value: `TOTAL ${grupo.descripcion}`, kind: 'text' },
        { value: '', kind: 'center' },
        { value: null, kind: 'qty' }, { value: null, kind: 'rate' }, { value: n(t.et), kind: 'money' },
        { value: null, kind: 'qty' }, { value: null, kind: 'rate' }, { value: n(t.cotizado), kind: 'money' },
        ...mat.compras.flatMap((compra): Cell[] => [
            { value: null, kind: 'qty' }, { value: null, kind: 'rate' }, { value: n(t.compras[compra.id]), kind: 'money' }, { value: '', kind: 'text' },
        ]),
        { value: n(t.total_comprado), kind: 'money' },
        { value: n(t.saldo), kind: 'money' },
    ]), RESULT_BG);
}

export async function exportGastFinExcel({ projectId, documentId, grupos, projectData }: Params): Promise<void> {
    // Siempre datos frescos del backend, nunca la caché de pestañas.
    const [resumen, mo, gg, ...mats] = await Promise.all([
        gastFinApi.resumen(projectId),
        gastFinApi.mo(projectId),
        ggApi.refresh(projectId, documentId),
        ...grupos.map((grupo) => gastFinApi.mat(projectId, grupo.ref)),
    ]);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Proyecta PCL';
    wb.created = new Date();

    buildResumenSheet(wb, resumen.resumen);
    buildMoSheet(wb, mo.mo);
    const used = new Set(['RESUMEN', 'MO', 'GG']);
    grupos.forEach((grupo, i) => buildMatSheet(wb, sheetName(`MAT ${grupo.descripcion}`, used), grupo, mats[i].mat));
    buildGgSheet(wb, gg.gg);

    const nombre = projectData?.nombre ?? 'Proyecto';
    for (const ws of wb.worksheets) {
        const frozen = ws.name !== 'RESUMEN';
        // addInstitutionalHeader inserta 2 filas con spliceRows, y ExcelJS NO desplaza las celdas
        // combinadas existentes (los títulos de sección de RESUMEN): chocaban con el encabezado
        // ("Cannot merge already merged cells"). Se quitan antes y se reponen 2 filas más abajo.
        const merges = unmergeAll(ws);
        await addInstitutionalHeader(
            wb,
            ws,
            {
                nombre,
                codigo_cui: projectData?.codigo_cui ?? null,
                codigo_local: projectData?.codigo_local ?? null,
                unidad_ejecutora: projectData?.unidad_ejecutora ?? null,
                plantilla_logo_izq_url: projectData?.plantilla_logo_izq_url ?? null,
                plantilla_logo_der_url: projectData?.plantilla_logo_der_url ?? null,
            },
            ws.columnCount,
            `GASTOS FINANCIEROS — ${ws.name}`,
        );
        for (const range of merges) ws.mergeCells(shiftRange(range, 2));
        // addInstitutionalHeader inserta 2 filas arriba (ver exportMantenimientoExcel).
        if (frozen) ws.views = [{ state: 'frozen', ySplit: 3, xSplit: 1 }];
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const limpio = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 40);
    saveAs(blob, `GastosFinancieros_${limpio || 'proyecto'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
