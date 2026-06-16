import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { DelphinRow } from '../types';
import type { DelphinExportContent } from './exportDelphin';

// ── Colores ARGB ──────────────────────────────────────────────────────────────
const C = {
    headerBg:  'FF0F172A', headerFg:  'FFFFFFFF',
    titulo0Bg: 'FF1E293B', titulo0Fg: 'FFFFFFFF',
    titulo1Bg: 'FF334155', titulo1Fg: 'FFE2E8F0',
    titulo2Bg: 'FF475569', titulo2Fg: 'FFF1F5F9',
    leafBg:    'FFFFFFFF', leafFg:    'FF1E293B',
    altBg:     'FFF8FAFC',
    totalBg:   'FF064E3B', totalFg:   'FF6EE7B7',
    ganttHdBg: 'FF1E3A5F', ganttHdFg: 'FFBFDBFE',
};

function fill(cell: ExcelJS.Cell, argb: string) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}
function font(cell: ExcelJS.Cell, argb: string, bold = false, size = 10) {
    cell.font = { color: { argb }, bold, size, name: 'Calibri' };
}
function border(cell: ExcelJS.Cell) {
    const s: ExcelJS.Border = { style: 'thin', color: { argb: 'FFE2E8F0' } };
    cell.border = { top: s, bottom: s, left: s, right: s };
}

const fmtNum = (v: number) =>
    (v ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Hoja Presupuesto ──────────────────────────────────────────────────────────
function buildPresupuestoSheet(ws: ExcelJS.Worksheet, rows: DelphinRow[]) {
    ws.columns = [
        { key: 'no',    width: 6  },
        { key: 'part',  width: 12 },
        { key: 'desc',  width: 52 },
        { key: 'und',   width: 8  },
        { key: 'meta',  width: 12 },
        { key: 'pu',    width: 14 },
        { key: 'total', width: 16 },
    ];

    const hdr = ws.addRow(['N°', 'Partida', 'Descripción', 'Und.', 'Metrado', 'P. Unit.', 'Total (S/)']);
    hdr.height = 18;
    hdr.eachCell((c) => {
        fill(c, C.headerBg); font(c, C.headerFg, true, 10);
        c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        border(c);
    });

    let altIdx = 0;
    rows.forEach((row) => {
        const nivel = row.nivel ?? 1;
        const isLeaf = nivel >= 3;
        const dataRow = ws.addRow([
            row.item_order,
            row.partida,
            row.descripcion,
            row.unidad,
            isLeaf ? row.metrado : null,
            isLeaf ? row.precio_unitario : null,
            row.parcial || (row.metrado * row.precio_unitario) || 0,
        ]);

        let bg = C.leafBg, fg = C.leafFg, bold = false;
        if (nivel === 1)           { bg = C.titulo0Bg; fg = C.titulo0Fg; bold = true; }
        else if (nivel === 2)      { bg = C.titulo1Bg; fg = C.titulo1Fg; bold = true; }
        else if (nivel === 3)      { bg = C.titulo2Bg; fg = C.titulo2Fg; }
        else if (altIdx % 2 === 1) { bg = C.altBg; }

        dataRow.eachCell({ includeEmpty: true }, (c, col) => {
            fill(c, bg); font(c, fg, bold);
            border(c);
            if (col >= 5) c.alignment = { horizontal: 'right', vertical: 'middle' };
            else c.alignment = { vertical: 'middle', wrapText: col === 3 };
            if (col >= 5 && c.value !== null && c.value !== undefined) c.numFmt = '#,##0.00';
        });

        dataRow.getCell(3).alignment = {
            horizontal: 'left', vertical: 'middle', wrapText: true,
            indent: Math.max(0, nivel - 1),
        };

        if (isLeaf) altIdx++;
    });

    const total = rows.reduce(
        (s, r) => r.nivel === 1 ? s + (r.parcial || r.metrado * r.precio_unitario || 0) : s,
        0,
    );
    const totRow = ws.addRow(['', '', 'TOTAL PRESUPUESTO', '', '', '', total]);
    totRow.height = 18;
    totRow.eachCell({ includeEmpty: true }, (c, col) => {
        fill(c, C.totalBg); font(c, C.totalFg, true);
        border(c);
        if (col === 7) { c.numFmt = '#,##0.00'; c.alignment = { horizontal: 'right', vertical: 'middle' }; }
        else c.alignment = { vertical: 'middle' };
    });

    ws.views = [{ state: 'frozen', ySplit: 1 }];
}

// ── Hoja Cronograma ───────────────────────────────────────────────────────────
function buildCronogramaSheet(ws: ExcelJS.Worksheet, rows: DelphinRow[]) {
    ws.columns = [
        { key: 'no',    width: 6  },
        { key: 'desc',  width: 52 },
        { key: 'dur',   width: 8  },
        { key: 'ini',   width: 12 },
        { key: 'fin',   width: 12 },
        { key: 'pred',  width: 12 },
        { key: 'costo', width: 16 },
    ];

    const hdr = ws.addRow(['N°', 'Descripción', 'Dur.', 'Inicio', 'Fin', 'Pred.', 'Costo (S/)']);
    hdr.height = 18;
    hdr.eachCell((c) => {
        fill(c, C.ganttHdBg); font(c, C.ganttHdFg, true, 10);
        c.alignment = { vertical: 'middle', horizontal: 'center' };
        border(c);
    });

    let altIdx = 0;
    rows.forEach((row) => {
        const nivel = row.nivel ?? 1;
        const isLeaf = nivel >= 3;
        const pred = Array.isArray(row.predecesoras) && row.predecesoras.length > 0
            ? row.predecesoras.map((p: any) => `${p.taskId}${p.tipo !== 'FC' ? p.tipo : ''}`).join(', ')
            : '';

        const dataRow = ws.addRow([
            row.item_order,
            row.descripcion,
            row.duracion_dias || '',
            row.fecha_inicio || '',
            row.fecha_fin || '',
            pred,
            row.presupuesto || 0,
        ]);

        let bg = C.leafBg, fg = C.leafFg, bold = false;
        if (nivel === 1)           { bg = C.titulo0Bg; fg = C.titulo0Fg; bold = true; }
        else if (nivel === 2)      { bg = C.titulo1Bg; fg = C.titulo1Fg; bold = true; }
        else if (nivel === 3)      { bg = C.titulo2Bg; fg = C.titulo2Fg; }
        else if (altIdx % 2 === 1) { bg = C.altBg; }

        dataRow.eachCell({ includeEmpty: true }, (c, col) => {
            fill(c, bg); font(c, fg, bold);
            border(c);
            c.alignment = { vertical: 'middle', horizontal: col === 2 ? 'left' : 'center' };
        });

        dataRow.getCell(2).alignment = {
            horizontal: 'left', vertical: 'middle', wrapText: true,
            indent: Math.max(0, nivel - 1),
        };
        dataRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
        dataRow.getCell(7).numFmt = '#,##0.00';

        if (isLeaf) altIdx++;
    });

    ws.views = [{ state: 'frozen', ySplit: 1 }];
}

// ── Entry point ───────────────────────────────────────────────────────────────
export async function exportDelphinExcel(
    content: DelphinExportContent,
    rows: DelphinRow[],
    projectName: string,
): Promise<void> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'PCL Costos';
    wb.created = new Date();

    if (content === 'budget_only' || content === 'budget_gantt') {
        buildPresupuestoSheet(wb.addWorksheet('Presupuesto General'), rows);
    }
    if (content === 'gantt_only' || content === 'budget_gantt') {
        buildCronogramaSheet(wb.addWorksheet('Cronograma General'), rows);
    }

    const date = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const suffix = {
        budget_only:  'Presupuesto',
        budget_gantt: 'Presupuesto_Cronograma',
        gantt_only:   'Cronograma',
    }[content];

    const fileName = `${projectName.replace(/\s+/g, '_')}_${suffix}_${date.replace(/\//g, '-')}.xlsx`;
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
}
