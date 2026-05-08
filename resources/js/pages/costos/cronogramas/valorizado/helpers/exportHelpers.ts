import ExcelJS from 'exceljs';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────
type ViewMode = 'monto' | 'porcentaje';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE FORMATO
// ─────────────────────────────────────────────────────────────────────────────
const fmtN   = (v: number) => (v ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nivel  = (item: string) => (item?.split('.').length ?? 1) - 1;

// ─────────────────────────────────────────────────────────────────────────────
// PALETA DE COLORES (ARGB sin "#")
// ─────────────────────────────────────────────────────────────────────────────
const C = {
    // Cabecera principal
    headerBg:        'FF0F172A', // slate-950
    headerFg:        'FFFFFFFF',
    // Cabecera parcial
    parcialBg:       'FF1E3A5F', // azul oscuro
    parcialFg:       'FFBFDBFE',
    // Total (col derecha)
    totalBg:         'FF064E3B', // emerald-950
    totalFg:         'FF6EE7B7',
    // Mes pico
    picoBg:          'FFB45309', // amber-700
    picoFg:          'FFFFFFFF',
    // Niveles de ítem
    nivel0Bg:        'FF1E293B', nivel0Fg: 'FFFFFFFF',   // slate-800
    nivel1Bg:        'FFE2E8F0', nivel1Fg: 'FF1E293B',   // slate-200
    nivel2Bg:        'FFF1F5F9', nivel2Fg: 'FF1E293B',   // slate-100
    nivel3Bg:        'FFFAFAFA', nivel3Fg: 'FF334155',
    leafBg:          'FFFFFFFF', leafFg:  'FF1E293B',
    // Footer filas
    footer1Bg:       'FF1E3A5F', footer1Fg: 'FFFFFFFF',  // Valorización mensual
    footer2Bg:       'FF374151', footer2Fg: 'FFE5E7EB',  // % mensual
    footer3Bg:       'FF065F46', footer3Fg: 'FFD1FAE5',  // Val. acumulada
    footer4Bg:       'FF111827', footer4Fg: 'FF34D399',  // % acumulado
    // Celda datos
    dataBg:          'FFFFFFFF', dataFg: 'FF374151',
    altRowBg:        'FFF8FAFC',
    // Resumen superior
    resumeBg:        'FF1E40AF',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: aplicar fill sólido
// ─────────────────────────────────────────────────────────────────────────────
function fill(cell: ExcelJS.Cell, argb: string) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function style(
    cell: ExcelJS.Cell,
    opts: {
        bg?: string; fg?: string; bold?: boolean; size?: number;
        hAlign?: ExcelJS.Alignment['horizontal'];
        vAlign?: ExcelJS.Alignment['vertical'];
        wrapText?: boolean; italic?: boolean; border?: boolean;
        numFmt?: string; indent?: number;
    },
) {
    if (opts.bg)       fill(cell, opts.bg);
    if (opts.fg || opts.bold || opts.size || opts.italic) {
        cell.font = {
            name:   'Arial',
            color:  opts.fg ? { argb: opts.fg } : undefined,
            bold:   opts.bold   ?? false,
            size:   opts.size   ?? 9,
            italic: opts.italic ?? false,
        };
    }
    cell.alignment = {
        horizontal: opts.hAlign  ?? 'left',
        vertical:   opts.vAlign  ?? 'middle',
        wrapText:   opts.wrapText ?? false,
        indent:     opts.indent,
    };
    if (opts.numFmt) cell.numFmt = opts.numFmt;
    if (opts.border) {
        const b: ExcelJS.Border = { style: 'thin', color: { argb: 'FFD1D5DB' } };
        cell.border = { top: b, left: b, bottom: b, right: b };
    }
}

function borderAll(cell: ExcelJS.Cell, color = 'FFD1D5DB') {
    const b: ExcelJS.Border = { style: 'thin', color: { argb: color } };
    cell.border = { top: b, left: b, bottom: b, right: b };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTAR EXCEL (.xlsx) con ExcelJS
// ─────────────────────────────────────────────────────────────────────────────
export async function exportarExcel(
    items:           any[],
    periodos:        any[],
    totales:         any,
    projectName:     string,
    viewMode:        ViewMode,
    totalesPorItem:  Record<string | number, number>,
): Promise<void> {
    const wb = new ExcelJS.Workbook();
    wb.creator  = 'Sistema Valorizado';
    wb.created  = new Date();

    const ws = wb.addWorksheet('Cronograma Valorizado', {
        pageSetup: {
            paperSize:   5,   // A3
            orientation: 'landscape',
            fitToPage:   true,
            fitToWidth:  1,
            fitToHeight: 0,
            margins:     { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
        },
        views: [{ state: 'normal', showGridLines: true }],
    });

    // ── Freeze pane: fijar primeras 9 filas + col C (descripcion) ────────────
    ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 9 }];

    // ── Número total de columnas ─────────────────────────────────────────────
    // Cols fijas: N°(1) ITEM(2) DESC(3) UND(4) METRADO(5) PU(6) PARCIAL(7)  = 7
    // + periodos
    // + TOTAL = 1
    const FIXED   = 7;
    const nPer    = periodos.length;
    const TOTAL_C = FIXED + nPer + 1;  // columna TOTAL al final

    // ── Ancho de columnas ────────────────────────────────────────────────────
    ws.getColumn(1).width  = 5;   // N°
    ws.getColumn(2).width  = 12;  // ITEM
    ws.getColumn(3).width  = 50;  // DESC
    ws.getColumn(4).width  = 8;   // UND
    ws.getColumn(5).width  = 12;  // METRADO
    ws.getColumn(6).width  = 13;  // PU
    ws.getColumn(7).width  = 16;  // PARCIAL
    for (let i = 0; i < nPer; i++) ws.getColumn(FIXED + 1 + i).width = 14;
    ws.getColumn(TOTAL_C).width = 16; // TOTAL

    // ── ROW 1-2: Título + proyecto ───────────────────────────────────────────
    ws.getRow(1).height = 22;
    ws.getRow(2).height = 14;
    ws.getRow(3).height = 14;

    const title = ws.getCell('A1');
    title.value = 'CRONOGRAMA DE EJECUCIÓN FÍSICO VALORIZADO';
    ws.mergeCells(1, 1, 1, TOTAL_C);
    style(title, { bg: C.headerBg, fg: C.headerFg, bold: true, size: 13, hAlign: 'center', vAlign: 'middle' });

    const proj = ws.getCell('A2');
    proj.value = `PROYECTO: ${projectName}`;
    ws.mergeCells(2, 1, 2, TOTAL_C);
    style(proj, { bg: 'FF1E293B', fg: 'FF94A3B8', bold: false, size: 9, hAlign: 'left', vAlign: 'middle' });
    proj.alignment.indent = 1;

    const fecha = ws.getCell('A3');
    fecha.value = `Exportado: ${new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}`;
    ws.mergeCells(3, 1, 3, TOTAL_C);
    style(fecha, { bg: 'FF0F172A', fg: 'FF64748B', size: 8, hAlign: 'right', vAlign: 'middle' });
    fecha.alignment.indent = 1;

    // ── ROW 4: Spacer ────────────────────────────────────────────────────────
    ws.getRow(4).height = 6;
    for (let c = 1; c <= TOTAL_C; c++) fill(ws.getCell(4, c), 'FF334155');

    // ── ROW 5-6: Sub-encabezados sección (Meses / Resumen) ──────────────────
    ws.getRow(5).height = 16;
    for (let c = 1; c <= FIXED; c++) {
        const cell = ws.getCell(5, c);
        ws.mergeCells(5, c, 6, c);
        style(cell, { bg: C.headerBg, fg: C.headerFg, bold: true, size: 9, hAlign: 'center', vAlign: 'middle' });
    }
    // Sección "DISTRIBUCIÓN MENSUAL"
    if (nPer > 0) {
        const secMes = ws.getCell(5, FIXED + 1);
        secMes.value = viewMode === 'monto' ? 'DISTRIBUCIÓN MENSUAL (S/.)' : 'DISTRIBUCIÓN MENSUAL (%)';
        ws.mergeCells(5, FIXED + 1, 5, FIXED + nPer);
        style(secMes, { bg: 'FF1E3A5F', fg: 'FFBFDBFE', bold: true, size: 9, hAlign: 'center', vAlign: 'middle' });
    }
    // Sección "TOTAL"
    const secTot = ws.getCell(5, TOTAL_C);
    secTot.value = 'TOTAL';
    ws.mergeCells(5, TOTAL_C, 6, TOTAL_C);
    style(secTot, { bg: C.totalBg, fg: C.totalFg, bold: true, size: 10, hAlign: 'center', vAlign: 'middle' });

    // ── ROW 6: Nombres de períodos ───────────────────────────────────────────
    ws.getRow(6).height = 14;
    for (let i = 0; i < nPer; i++) {
        const p    = periodos[i];
        const cell = ws.getCell(6, FIXED + 1 + i);
        cell.value = `${p.label}\n${p.labelCal ?? ''}`;
        style(cell, { bg: 'FF1E293B', fg: 'FF94A3B8', size: 8, hAlign: 'center', vAlign: 'middle', wrapText: true });
        borderAll(cell, 'FF334155');
    }

    // ── ROW 7: Spacer ────────────────────────────────────────────────────────
    ws.getRow(7).height = 6;
    for (let c = 1; c <= TOTAL_C; c++) fill(ws.getCell(7, c), 'FF334155');

    // ── ROW 8: Encabezados columnas fijas ────────────────────────────────────
    ws.getRow(8).height = 24;
    const headers8 = ['N°', 'ÍTEM', 'DESCRIPCIÓN', 'UND', 'METRADO', 'P.U. (S/.)', 'PARCIAL (S/.)'];
    headers8.forEach((h, i) => {
        const cell = ws.getCell(8, i + 1);
        cell.value = h;
        const isTot = i === 6; // PARCIAL
        style(cell, {
            bg:     isTot ? C.parcialBg : C.headerBg,
            fg:     isTot ? C.parcialFg : C.headerFg,
            bold:   true, size: 9,
            hAlign: i <= 1 ? 'center' : i === 2 ? 'left' : 'right',
            vAlign: 'middle', wrapText: true,
        });
        borderAll(cell, 'FF334155');
    });
    // Periodos en fila 8 (nombres individuales ya en fila 6, aquí solo borde)
    for (let i = 0; i < nPer; i++) {
        const cell = ws.getCell(8, FIXED + 1 + i);
        // Ya fusionado en fila 6; solo aseguramos borde
        borderAll(cell, 'FF334155');
    }
    const totalH = ws.getCell(8, TOTAL_C);
    borderAll(totalH, 'FF065F46');

    // ── ROW 9: Separador ────────────────────────────────────────────────────
    ws.getRow(9).height = 4;
    for (let c = 1; c <= TOTAL_C; c++) fill(ws.getCell(9, c), 'FF0F172A');

    // ── DATOS ────────────────────────────────────────────────────────────────
    let rowIdx = 10;

    items.forEach((item: any, idx: number) => {
        const n       = nivel(item.item);
        const isLeaf  = item.is_leaf;
        const row     = ws.getRow(rowIdx);
        row.height    = isLeaf ? 16 : n === 0 ? 20 : 17;

        const desvio     = isLeaf ? 0 : 0;
        const totalFila  = totalesPorItem[item.id] ?? 0;

        // Colores por nivel
        let bgRow: string, fgRow: string;
        if      (n === 0) { bgRow = C.nivel0Bg; fgRow = C.nivel0Fg; }
        else if (n === 1) { bgRow = C.nivel1Bg; fgRow = C.nivel1Fg; }
        else if (n === 2) { bgRow = C.nivel2Bg; fgRow = C.nivel2Fg; }
        else if (isLeaf)  { bgRow = idx % 2 === 0 ? C.leafBg : C.altRowBg; fgRow = C.leafFg; }
        else              { bgRow = C.nivel3Bg; fgRow = C.nivel3Fg; }

        // N°
        const cN = ws.getCell(rowIdx, 1);
        cN.value = idx + 1;
        style(cN, { bg: bgRow, fg: fgRow, size: 8, hAlign: 'center', vAlign: 'middle' });
        borderAll(cN);

        // ÍTEM
        const cI = ws.getCell(rowIdx, 2);
        cI.value = item.item;
        style(cI, { bg: bgRow, fg: fgRow, bold: n <= 1, size: 8, hAlign: 'center', vAlign: 'middle' });
        borderAll(cI);

        // DESCRIPCIÓN
        const cD = ws.getCell(rowIdx, 3);
        cD.value = item.descripcion;
        style(cD, {
            bg: bgRow, fg: fgRow,
            bold: n <= 1, italic: isLeaf, size: 9,
            hAlign: 'left', vAlign: 'middle', wrapText: false,
            indent: n,
        });
        borderAll(cD);

        // UND
        const cU = ws.getCell(rowIdx, 4);
        cU.value = item.und || '';
        style(cU, { bg: bgRow, fg: fgRow, size: 8, hAlign: 'center', vAlign: 'middle' });
        borderAll(cU);

        // METRADO
        const cM = ws.getCell(rowIdx, 5);
        cM.value = item.metrado > 0 ? item.metrado : null;
        style(cM, { bg: bgRow, fg: fgRow, size: 9, hAlign: 'right', vAlign: 'middle', numFmt: '#,##0.00' });
        borderAll(cM);

        // P.U.
        const cP = ws.getCell(rowIdx, 6);
        cP.value = item.precio > 0 ? item.precio : null;
        style(cP, { bg: bgRow, fg: fgRow, size: 9, hAlign: 'right', vAlign: 'middle', numFmt: '#,##0.00' });
        borderAll(cP);

        // PARCIAL
        const cPar = ws.getCell(rowIdx, 7);
        cPar.value = item.parcial > 0 ? item.parcial : null;
        style(cPar, { bg: 'FFEFF6FF', fg: 'FF1D4ED8', bold: true, size: 9, hAlign: 'right', vAlign: 'middle', numFmt: '"S/. "#,##0.00' });
        borderAll(cPar, 'FFBFDBFE');

        // PERIODOS
        periodos.forEach((p: any, pi: number) => {
            const monto  = item.distribucion?.[p.key]?.monto ?? 0;
            const colIdx = FIXED + 1 + pi;
            const cCell  = ws.getCell(rowIdx, colIdx);

            let val: number | null = null;
            if (viewMode === 'monto') {
                val = monto > 0 ? monto : null;
            } else {
                const pct = item.parcial > 0 ? (monto / item.parcial) * 100 : 0;
                val = pct > 0 ? pct : null;
            }

            cCell.value = val;
            const numFmt = viewMode === 'monto' ? '#,##0.00' : '0.0000"%"';
            style(cCell, {
                bg:     monto > 0 ? (idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC') : (idx % 2 === 0 ? 'FFFAFAFA' : 'FFF1F5F9'),
                fg:     monto > 0 ? 'FF1E293B' : 'FFD1D5DB',
                bold:   !isLeaf && monto > 0,
                size:   9,
                hAlign: 'right', vAlign: 'middle',
                numFmt,
            });
            borderAll(cCell);
        });

        // TOTAL por fila
        const cT = ws.getCell(rowIdx, TOTAL_C);
        cT.value = totalFila > 0 ? totalFila : null;
        style(cT, {
            bg:     totalFila > 0 ? 'FFECFDF5' : 'FFEFF6FF',
            fg:     totalFila > 0 ? 'FF065F46' : 'FFD1FAE5',
            bold:   true, size: 9,
            hAlign: 'right', vAlign: 'middle',
            numFmt: '"S/. "#,##0.00',
        });
        borderAll(cT, 'FFA7F3D0');

        rowIdx++;
    });

    // ── SPACER ───────────────────────────────────────────────────────────────
    ws.getRow(rowIdx).height = 4;
    for (let c = 1; c <= TOTAL_C; c++) fill(ws.getCell(rowIdx, c), 'FF334155');
    rowIdx++;

    // ── FOOTER rows ──────────────────────────────────────────────────────────
    const lastKey            = periodos.length > 0 ? periodos[periodos.length - 1].key : '';
    const totalAcumFinal     = totales[lastKey]?.acumuladoMonto ?? 0;
    const totalMensualGeneral = Object.values(totales as any)
        .reduce((s: number, t: any) => s + (t.monto ?? 0), 0) as number;

    const addFooterRow = (
        label:    string,
        bgLabel:  string, fgLabel: string,
        bgData:   string, fgData:  string,
        bgTotal:  string, fgTotal: string,
        values:   (number | string | null)[],
        totalVal: number | string | null,
        height:   number = 20,
        numFmt:   string = '#,##0.00',
    ) => {
        const row = ws.getRow(rowIdx);
        row.height = height;

        // Label (merge primeras 7 cols)
        const lCell = ws.getCell(rowIdx, 1);
        lCell.value = label;
        ws.mergeCells(rowIdx, 1, rowIdx, FIXED);
        style(lCell, { bg: bgLabel, fg: fgLabel, bold: true, size: 9, hAlign: 'right', vAlign: 'middle' });
        borderAll(lCell, bgLabel);

        // Valores por periodo
        values.forEach((v, i) => {
            const cell = ws.getCell(rowIdx, FIXED + 1 + i);
            cell.value = typeof v === 'number' && v > 0 ? v : null;
            style(cell, { bg: bgData, fg: fgData, bold: true, size: 9, hAlign: 'center', vAlign: 'middle', numFmt });
            borderAll(cell, bgLabel);
        });

        // Total final
        const tCell = ws.getCell(rowIdx, TOTAL_C);
        tCell.value = typeof totalVal === 'number' && totalVal > 0 ? totalVal : (totalVal ?? null);
        style(tCell, { bg: bgTotal, fg: fgTotal, bold: true, size: 10, hAlign: 'center', vAlign: 'middle', numFmt });
        borderAll(tCell, bgTotal);

        rowIdx++;
    };

    // Valorización Mensual (S/.)
    addFooterRow(
        'VALORIZACIÓN MENSUAL (S/.)',
        C.footer1Bg, C.footer1Fg, C.footer1Bg, 'FFBFDBFE', C.totalBg, C.totalFg,
        periodos.map((p: any) => totales[p.key]?.monto ?? 0),
        totalMensualGeneral,
        22, '"S/. "#,##0.00',
    );

    // % Avance Mensual
    addFooterRow(
        '% AVANCE MENSUAL',
        C.footer2Bg, C.footer2Fg, C.footer2Bg, 'FFFBBF24', 'FF374151', 'FF9CA3AF',
        periodos.map((p: any) => totales[p.key]?.porcentaje ?? 0),
        null, 18, '0.000"%"',
    );

    // Valorización Acumulada (S/.)
    addFooterRow(
        'VALORIZACIÓN ACUMULADA (S/.)',
        C.footer3Bg, C.footer3Fg, C.footer3Bg, 'FF6EE7B7', C.totalBg, C.totalFg,
        periodos.map((p: any) => totales[p.key]?.acumuladoMonto ?? 0),
        totalAcumFinal,
        22, '"S/. "#,##0.00',
    );

    // % Avance Acumulado (Curva S)
    addFooterRow(
        '% AVANCE ACUMULADO — CURVA S',
        C.footer4Bg, C.footer4Fg, C.footer4Bg, '34D399FF', 'FF111827', 'FF34D399',
        periodos.map((p: any) => totales[p.key]?.acumuladoPorcentaje ?? 0),
        100, 18, '0.00"%"',
    );

    // ── Hoja CURVA S ─────────────────────────────────────────────────────────
    const wsCurva = wb.addWorksheet('Curva S', { properties: { tabColor: { argb: 'FF10B981' } } });
    wsCurva.getRow(1).height = 22;
    const csTitulo = wsCurva.getCell('A1');
    csTitulo.value = 'CURVA S — % AVANCE ACUMULADO';
    wsCurva.mergeCells(1, 1, 1, 3 + nPer);
    style(csTitulo, { bg: C.footer4Bg, fg: 'FF34D399', bold: true, size: 11, hAlign: 'center', vAlign: 'middle' });
    ['N°', 'PERÍODO', 'FECHA', '% ACUM.'].forEach((h, i) => {
        const cell = wsCurva.getCell(2, i + 1);
        cell.value = h;
        style(cell, { bg: C.headerBg, fg: C.headerFg, bold: true, size: 9, hAlign: 'center', vAlign: 'middle' });
        borderAll(cell, 'FF334155');
    });
    periodos.forEach((p: any, i: number) => {
        const r    = 3 + i;
        const pct  = totales[p.key]?.acumuladoPorcentaje ?? 0;
        const bg   = i % 2 === 0 ? 'FFF0FDF4' : 'FFECFDF5';
        const cells = [i + 1, p.label, p.labelCal ?? '', pct > 0 ? pct / 100 : null];
        cells.forEach((v, ci) => {
            const cell = wsCurva.getCell(r, ci + 1);
            cell.value = v;
            style(cell, {
                bg, fg: 'FF065F46', size: 9,
                hAlign: ci === 3 ? 'right' : ci === 0 ? 'center' : 'left',
                numFmt: ci === 3 ? '0.00%' : undefined,
            });
            borderAll(cell, 'FFA7F3D0');
        });
        wsCurva.getColumn(1).width = 6;
        wsCurva.getColumn(2).width = 15;
        wsCurva.getColumn(3).width = 22;
        wsCurva.getColumn(4).width = 12;
    });

    // ── DOWNLOAD ─────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer();
    const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href       = url;
    a.download   = `Cronograma_Valorizado_${projectName.replace(/\s+/g, '_')}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTAR PDF — Ventana de impresión con diseño profesional
// ─────────────────────────────────────────────────────────────────────────────
export function exportarPDF(
    items:          any[],
    periodos:       any[],
    totales:        any,
    projectName:    string,
    totalesPorItem: Record<string | number, number>,
): void {
    const fmt  = (v: number) => (v ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtS = (v: number) => `S/. ${fmt(v)}`;

    const colW        = Math.max(52, Math.floor(520 / Math.max(periodos.length + 1, 1)));
    const lastKey     = periodos.length > 0 ? periodos[periodos.length - 1].key : '';
    const acumFinal   = totales[lastKey]?.acumuladoMonto  ?? 0;
    const pctFinal    = totales[lastKey]?.acumuladoPorcentaje ?? 0;
    const totalMens   = Object.values(totales as any)
        .reduce((s: number, t: any) => s + (t.monto ?? 0), 0) as number;

    // Curva S mini-chart (barra horizontal SVG)
    const curvaBars = periodos.map((p: any) => {
        const pct = totales[p.key]?.acumuladoPorcentaje ?? 0;
        return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
            <span style="width:60px;font-size:7px;color:#94a3b8;text-align:right">${p.label}</span>
            <div style="flex:1;background:#1e293b;border-radius:2px;overflow:hidden;height:8px;">
                <div style="width:${Math.min(pct, 100)}%;background:linear-gradient(90deg,#10b981,#34d399);height:100%;border-radius:2px;"></div>
            </div>
            <span style="width:42px;font-size:7px;font-family:monospace;color:#34d399;text-align:right">${pct > 0 ? pct.toFixed(1) + '%' : ''}</span>
        </div>`;
    }).join('');

    const thStyle = `style="padding:4px 5px;background:#0f172a;color:#fff;font-size:8px;text-align:center;border:1px solid #334155;font-weight:700;"`;
    const thPar   = `style="padding:4px 5px;background:#1e3a5f;color:#bfdbfe;font-size:8px;text-align:right;border:1px solid #334155;font-weight:700;"`;
    const thTot   = `style="padding:4px 5px;background:#064e3b;color:#6ee7b7;font-size:8px;text-align:center;border:1px solid #334155;font-weight:700;"`;
    const thPer   = (key: string) =>
        `style="min-width:${colW}px;padding:4px 3px;background:${key === '' ? '#0f172a' : '#1e293b'};color:#94a3b8;font-size:7px;text-align:center;border:1px solid #334155;"`;

    const headerCols =
        periodos.map((p: any) =>
            `<th ${thPer(p.key)}>${p.label}<br><span style="font-size:6px;opacity:.7">${p.labelCal ?? ''}</span></th>`
        ).join('') +
        `<th ${thTot}>TOTAL<br><span style="font-size:6px;color:#a7f3d0;">S/. acum.</span></th>`;

    const bodyRows = items.map((item: any, i: number) => {
        const n       = nivel(item.item);
        const isLeaf  = item.is_leaf;
        const totalF  = totalesPorItem[item.id] ?? 0;

        let bg: string, fg: string, fw: string;
        if      (n === 0) { bg = '#1e293b'; fg = '#fff';    fw = '900'; }
        else if (n === 1) { bg = '#e2e8f0'; fg = '#1e293b'; fw = '700'; }
        else if (n === 2) { bg = '#f1f5f9'; fg = '#334155'; fw = '600'; }
        else if (isLeaf)  { bg = i % 2 === 0 ? '#fff' : '#f8fafc'; fg = '#374151'; fw = '400'; }
        else              { bg = '#fafafa'; fg = '#475569'; fw = '500'; }

        const pl = `${4 + n * 8}px`;

        const cols = periodos.map((p: any) => {
            const m = item.distribucion?.[p.key]?.monto ?? 0;
            return `<td style="text-align:right;font-size:7px;padding:2px 4px;border:1px solid #e2e8f0;font-family:monospace;background:${m > 0 ? bg : (i % 2 === 0 ? '#f9fafb' : '#f3f4f6')};color:${m > 0 ? fg : '#d1d5db'};">${m > 0 ? fmt(m) : ''}</td>`;
        }).join('');

        return `<tr>
            <td style="text-align:center;font-size:7.5px;padding:2px;border:1px solid #e2e8f0;background:${bg};color:${fg};">${i + 1}</td>
            <td style="text-align:center;font-size:7px;padding:2px 3px;border:1px solid #e2e8f0;font-family:monospace;background:${bg};color:${fg};">${item.item}</td>
            <td style="font-size:7.5px;padding:2px ${pl} 2px 4px;border:1px solid #e2e8f0;background:${bg};color:${fg};font-weight:${fw};${isLeaf ? 'font-style:italic' : ''};max-width:220px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${item.descripcion}</td>
            <td style="text-align:center;font-size:7px;padding:2px;border:1px solid #e2e8f0;background:${bg};color:${fg};">${item.und || ''}</td>
            <td style="text-align:right;font-size:7px;padding:2px 4px;border:1px solid #e2e8f0;font-family:monospace;background:${bg};color:${fg};">${item.metrado > 0 ? fmt(item.metrado) : ''}</td>
            <td style="text-align:right;font-size:7px;padding:2px 4px;border:1px solid #e2e8f0;font-family:monospace;background:${bg};color:${fg};">${item.precio > 0 ? fmt(item.precio) : ''}</td>
            <td style="text-align:right;font-size:8px;padding:2px 4px;border:1px solid #bfdbfe;background:#eff6ff;font-weight:700;font-family:monospace;color:#1d4ed8;">${item.parcial > 0 ? fmt(item.parcial) : ''}</td>
            ${cols}
            <td style="text-align:right;font-size:8px;padding:2px 4px;border:1px solid #a7f3d0;background:#ecfdf5;font-weight:900;font-family:monospace;color:#065f46;">${totalF > 0 ? fmtS(totalF) : ''}</td>
        </tr>`;
    }).join('');

    const footerRow = (
        label: string, bg: string, fg: string, bdColor: string,
        vals:  string[], totalVal: string,
    ) =>
        `<tr><td colspan="7" style="text-align:right;padding:4px 6px;font-size:8px;font-weight:900;background:${bg};color:${fg};border:1px solid ${bdColor};text-transform:uppercase;letter-spacing:.5px;">${label}</td>
        ${vals.map(v => `<td style="text-align:center;font-size:8px;padding:3px;border:1px solid ${bdColor};background:${bg};color:${fg};font-family:monospace;">${v}</td>`).join('')}
        <td style="text-align:center;font-size:8.5px;padding:3px;border:1px solid ${bdColor};background:${bg};color:${fg};font-family:monospace;font-weight:900;">${totalVal}</td></tr>`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Cronograma Valorizado — ${projectName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: #fff; color: #1e293b; }
  .page-wrap { padding: 6mm 8mm; }
  .header-card {
    display: flex; align-items: flex-start; justify-content: space-between;
    background: linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);
    border-radius: 8px; padding: 10px 14px; margin-bottom: 6px; gap: 12px;
  }
  .header-left { flex: 1; }
  .header-title { font-size: 13px; font-weight: 900; color: #fff; text-transform: uppercase; letter-spacing: .5px; }
  .header-sub   { font-size: 9px;  color: #94a3b8; margin-top: 3px; }
  .header-date  { font-size: 8px;  color: #64748b; margin-top: 2px; }
  .kpi-cards { display: flex; gap: 6px; flex-shrink: 0; }
  .kpi { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
         border-radius: 6px; padding: 5px 10px; text-align: center; min-width: 80px; }
  .kpi-label { font-size: 7px; color: #94a3b8; text-transform: uppercase; letter-spacing: .4px; }
  .kpi-val   { font-size: 12px; font-weight: 900; color: #34d399; font-family: monospace; }
  .kpi-sub   { font-size: 7px; color: #64748b; }
  .curva-section { background: #0f172a; border-radius: 6px; padding: 6px 10px; margin-bottom: 6px; }
  .curva-title   { font-size: 8px; font-weight: 700; color: #34d399; margin-bottom: 4px; text-transform: uppercase; letter-spacing: .5px; }
  table { width: 100%; border-collapse: collapse; font-size: 8px; }
  thead th { position: relative; }
  @media print {
    @page { size: A3 landscape; margin: 5mm; }
    .page-wrap { padding: 0; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
<div class="page-wrap">

  <!-- HEADER -->
  <div class="header-card">
    <div class="header-left">
      <div class="header-title">Cronograma de Ejecución Físico Valorizado</div>
      <div class="header-sub">${projectName}</div>
      <div class="header-date">Exportado: ${new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
    </div>
    <div class="kpi-cards">
      <div class="kpi">
        <div class="kpi-label">Meses</div>
        <div class="kpi-val">${periodos.length}</div>
        <div class="kpi-sub">periodos</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Total ejecutado</div>
        <div class="kpi-val">${fmtS(totalMens)}</div>
        <div class="kpi-sub">S/. mensual</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Avance final</div>
        <div class="kpi-val">${pctFinal.toFixed(1)}%</div>
        <div class="kpi-sub">acumulado</div>
      </div>
    </div>
  </div>

  <!-- CURVA S mini -->
  <div class="curva-section">
    <div class="curva-title">📈 Curva S — Avance Acumulado</div>
    ${curvaBars}
  </div>

  <!-- TABLA -->
  <table>
    <thead>
      <tr>
        <th ${thStyle} style="min-width:24px;background:#0f172a;color:#fff;border:1px solid #334155;font-size:8px;padding:4px;">N°</th>
        <th ${thStyle} style="min-width:56px;background:#0f172a;color:#fff;border:1px solid #334155;font-size:8px;padding:4px;">ÍTEM</th>
        <th style="min-width:200px;text-align:left;padding:4px 5px;background:#0f172a;color:#fff;font-size:8px;font-weight:700;border:1px solid #334155;">DESCRIPCIÓN</th>
        <th ${thStyle} style="min-width:32px;background:#0f172a;color:#fff;border:1px solid #334155;font-size:8px;padding:4px;">UND</th>
        <th ${thStyle} style="min-width:58px;text-align:right;background:#0f172a;color:#fff;border:1px solid #334155;font-size:8px;padding:4px;">METRADO</th>
        <th ${thStyle} style="min-width:60px;text-align:right;background:#0f172a;color:#fff;border:1px solid #334155;font-size:8px;padding:4px;">P.U.</th>
        <th ${thPar} style="min-width:72px;">PARCIAL</th>
        ${headerCols}
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
    <tfoot>
      ${footerRow(
          'Valorización Mensual (S/.)', '#1e3a5f', '#fff', '#1e3a5f',
          periodos.map((p: any) => { const v = totales[p.key]?.monto ?? 0; return v > 0 ? fmtS(v) : '—'; }),
          fmtS(totalMens),
      )}
      ${footerRow(
          '% Avance Mensual', '#374151', '#e5e7eb', '#374151',
          periodos.map((p: any) => { const v = totales[p.key]?.porcentaje ?? 0; return v > 0 ? v.toFixed(3) + '%' : '—'; }),
          '—',
      )}
      ${footerRow(
          'Valorización Acumulada (S/.)', '#064e3b', '#6ee7b7', '#064e3b',
          periodos.map((p: any) => { const v = totales[p.key]?.acumuladoMonto ?? 0; return v > 0 ? fmtS(v) : '—'; }),
          fmtS(acumFinal),
      )}
      ${footerRow(
          '% Avance Acumulado — Curva S', '#111827', '#34d399', '#111827',
          periodos.map((p: any) => { const v = totales[p.key]?.acumuladoPorcentaje ?? 0; return v > 0 ? v.toFixed(2) + '%' : '—'; }),
          '100 %',
      )}
    </tfoot>
  </table>

  <!-- PIE DE PÁGINA -->
  <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center;padding-top:4px;border-top:1px solid #e2e8f0;">
    <span style="font-size:7px;color:#94a3b8;">Sistema de Cronograma Valorizado</span>
    <span style="font-size:7px;color:#94a3b8;">${new Date().toLocaleDateString('es-PE')}</span>
  </div>
</div>

<script>
  window.onload = () => setTimeout(() => window.print(), 500);
</script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=1400,height=900,menubar=yes');
    if (win) {
        win.document.write(html);
        win.document.close();
    }
}