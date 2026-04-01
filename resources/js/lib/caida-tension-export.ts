import ExcelJS from 'exceljs';
import type {
    ATSRow,
    TableRowNode,
    TGRow,
    TGTableRow,
    SelectionData,
} from '@/types/caida-tension';

export interface CaidaTensionState {
    flattenedData: TGRow[];
    atsData: ATSRow[];
    tgData: TGTableRow[];
}

// ── paleta de colores ─────────────────────────────────────────────────────────
const CLR = {
    headerYellPink: 'FFFF66FF',
    tgRow:          'FFFFCCFF',
    tdRow:          'FFD9D9D9',
    circuitBg:      'FFFFFFFF',
    splitBg:        'FFF2F2F2',
    headerBg:       'FFDCE6F1',
    white:          'FFFFFFFF',
};

// ── Bordes ────────────────────────────────────────────────────────────────────
const T  = (): ExcelJS.Border => ({ style: 'thin',   color: { argb: 'FF000000' } });
const M  = (): ExcelJS.Border => ({ style: 'medium', color: { argb: 'FF000000' } });
const GN = (): ExcelJS.Border => ({ style: 'medium', color: { argb: 'FF00B050' } });
const DB = (): ExcelJS.Border => ({ style: 'double', color: { argb: 'FF000000' } });

function bAll(c: ExcelJS.Cell, b: () => ExcelJS.Border) {
    c.border = { top: b(), bottom: b(), left: b(), right: b() };
}
function fill(c: ExcelJS.Cell, argb: string) {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function sc(
    ws: ExcelJS.Worksheet, row: number, col: number, value: any,
    opts: {
        bold?: boolean; size?: number; italic?: boolean;
        bg?: string; numFmt?: string; color?: string;
        h?: 'center' | 'left' | 'right'; wrap?: boolean;
        border?: 'thin' | 'medium' | 'none';
    } = {}
): ExcelJS.Cell {
    const c = ws.getCell(row, col);
    c.value = value ?? '';
    c.font = {
        name: 'Arial', size: opts.size ?? 9,
        bold: opts.bold ?? false, italic: opts.italic ?? false,
        ...(opts.color ? { color: { argb: opts.color } } : {}),
    };
    c.alignment = {
        horizontal: opts.h ?? 'center',
        vertical: 'middle',
        wrapText: opts.wrap ?? false,
    };
    if (opts.bg) fill(c, opts.bg);
    if (opts.numFmt) c.numFmt = opts.numFmt;
    if (opts.border !== 'none') bAll(c, opts.border === 'medium' ? M : T);
    return c;
}

function nb(v: any): number | string {
    if (v === null || v === undefined || v === '') return '';
    const n = Number(v);
    return isNaN(n) ? String(v) : n;
}
function nv(v: any): number | string {
    if (v === null || v === undefined || v === '') return '';
    const n = Number(v);
    return isNaN(n) ? String(v) : n;
}

function safeMerge(
    ws: ExcelJS.Worksheet,
    startRow: number, startCol: number,
    endRow: number,   endCol: number
) {
    if (startRow === endRow && startCol === endCol) return;
    try { ws.mergeCells(startRow, startCol, endRow, endCol); } catch (_) {}
}

// ════════════════════════════════════════════════════════════════════════════
export async function exportCaidaTensionToExcel(
    tdTree: TableRowNode[],
    tgState: CaidaTensionState,
    selectionData: SelectionData,
    fileName = 'Caida_Tension'
) {
    try {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'Sistema Eléctrico';

        // ════════════════════════════════════════════════════════════════
        // HOJA 1 — TD - CAÍDA DE TENSIÓN
        // ════════════════════════════════════════════════════════════════
        const ws1 = wb.addWorksheet('TD-CAÍDA DE TENSIÓN');
        ws1.columns = [
            { width: 11.4 },  // A — TABLERO
            { width: 13   },  // B \
            { width: 13   },  // C  > DESCRIPCIÓN (B:D merged)
            { width: 31.4 },  // D /
            { width: 13   },  // E — PUNTOS
            { width: 13.9 },  // F — CARGA INSTALADA
            { width: 11.4 },  // G — POTENCIA INST.
            { width: 13   },  // H — FACTOR DEMANDA
            { width: 13   },  // I — MÁXIMA DEMANDA
            { width: 13   },  // J — CORRIENTE (A)
            { width: 13   },  // K — CORRIENTE DISEÑO
            { width: 13   },  // L — LONGITUD
            { width: 14.6 },  // M — SECCIÓN
            { width: 11.4 },  // N — CAÍDA V
            { width: 13   },  // O — CAÍDA %
            { width: 13   },  // P — INTERRUPTOR
            { width: 13   },  // Q — TIPO DE CONDUCTOR
            { width: 13   },  // R — DUCTO
        ];
        ws1.views = [{ state: 'frozen', ySplit: 3 }];

        ws1.mergeCells('A1:R1');
        const t1 = ws1.getCell('A1');
        t1.value = 'CALCULO DE LA POTENCIA INSTALADA Y MAXIMA DEMANDA';
        t1.font = { name: 'Arial', bold: true, size: 11 };
        t1.alignment = { horizontal: 'center', vertical: 'middle' };
        fill(t1, CLR.headerYellPink);
        bAll(t1, T);
        ws1.getRow(1).height = 31;

        ws1.getRow(2).height = 18;
        ws1.getRow(3).height = 20;

        const H1_specs: [string, string][] = [
            ['TABLERO',                     'A2:A3'],
            ['DESCRIPCIÓN DEL LOCAL',       'B2:D3'],
            ['PUNTOS',                      'E2:E3'],
            ['CARGA INSTALADA (W)',         'F2:F3'],
            ['POTENCIA INSTALADA (W)',      'G2:G3'],
            ['FACTOR DE DEMANDA (f.d)',     'H2:H3'],
            ['MÁXIMA DEMANDA (W)',          'I2:I3'],
            ['CORRIENTE (A)',               'J2:J3'],
            ['CORRIENTE DE DISEÑO Id (A)',  'K2:K3'],
            ['LONGITUD DE CONDUCTOR (m)',   'L2:L3'],
            ['SECCIÓN (mm2)',               'M2:M3'],
            ['CAÍDA DE TENSIÓN (V)',        'N2:N3'],
            ['CAÍDA DE TENSIÓN (%) <2.5%', 'O2:O3'],
            ['INTERRUPTOR (A)',             'P2:P3'],
            ['TIPO DE CONDUCTOR',          'Q2:Q3'],
            ['DUCTO (mm)',                 'R2:R3'],
        ];
        H1_specs.forEach(([text, range]) => {
            ws1.mergeCells(range);
            const c = ws1.getCell(range.split(':')[0]);
            c.value = text;
            c.font = { name: 'Arial', bold: true, size: 9 };
            c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            fill(c, CLR.headerBg);
            bAll(c, T);
        });

        ws1.getRow(4).height = 5;
        ws1.mergeCells('A4:R4');
        fill(ws1.getCell('A4'), CLR.tgRow);

        let r = 5;
        const NF = '#,##0.##';

        const flatten = (nodes: TableRowNode[]) => {
            nodes.forEach(node => {
                const d = node.data;

                if (node.type === 'group') {
                    ws1.getRow(r).height = 17;
                    ws1.mergeCells(`B${r}:D${r}`);
                    sc(ws1, r,  1, d.tablero,                    { bold: true, bg: CLR.tgRow });
                    sc(ws1, r,  2, d.descripcion || '',          { bold: true, bg: CLR.tgRow, h: 'left', wrap: true });
                    sc(ws1, r,  5, '',                           { bg: CLR.tgRow });
                    sc(ws1, r,  6, '',                           { bg: CLR.tgRow });
                    sc(ws1, r,  7, nb(d.potenciaInstalada),      { bold: true, bg: CLR.tgRow, numFmt: NF });
                    sc(ws1, r,  8, '',                           { bg: CLR.tgRow });
                    sc(ws1, r,  9, nb(d.maximaDemanda),          { bold: true, bg: CLR.tgRow, numFmt: NF });
                    sc(ws1, r, 10, nb(d.corrienteA),             { bold: true, bg: CLR.tgRow, numFmt: NF });
                    sc(ws1, r, 11, nb(d.corrienteDiseno),        { bold: true, bg: CLR.tgRow, numFmt: NF });
                    sc(ws1, r, 12, nb(d.longitudConductor),      { bold: true, bg: CLR.tgRow, numFmt: NF });
                    sc(ws1, r, 13, nb(d.seccion),                { bold: true, bg: CLR.tgRow, numFmt: NF });
                    sc(ws1, r, 14, nb(d.caidaTension),           { bold: true, bg: CLR.tgRow, numFmt: NF });
                    sc(ws1, r, 15, nb(d.caidaTensionPorcentaje), { bold: true, bg: CLR.tgRow, numFmt: NF });
                    sc(ws1, r, 16, d.interruptor   || '',        { bold: true, bg: CLR.tgRow });
                    sc(ws1, r, 17, d.tipoConductor || '',        { bold: true, bg: CLR.tgRow });
                    sc(ws1, r, 18, d.ducto         || '',        { bold: true, bg: CLR.tgRow });
                    r++;

                } else if (node.type === 'subgroup' || node.type === 'subsubgroup') {
                    ws1.getRow(r).height = 16;
                    ws1.mergeCells(`B${r}:D${r}`);
                    sc(ws1, r,  1, d.tablero,                    { bold: true, bg: CLR.tdRow });
                    sc(ws1, r,  2, d.descripcion || '',          { bold: true, bg: CLR.tdRow, h: 'left', wrap: true });
                    sc(ws1, r,  5, '',                           { bg: CLR.tdRow });
                    sc(ws1, r,  6, '',                           { bg: CLR.tdRow });
                    sc(ws1, r,  7, nb(d.potenciaInstalada),      { bold: true, bg: CLR.tdRow, numFmt: NF });
                    sc(ws1, r,  8, '',                           { bg: CLR.tdRow });
                    sc(ws1, r,  9, nb(d.maximaDemanda),          { bold: true, bg: CLR.tdRow, numFmt: NF });
                    sc(ws1, r, 10, nb(d.corrienteA),             { bold: true, bg: CLR.tdRow, numFmt: NF });
                    sc(ws1, r, 11, nb(d.corrienteDiseno),        { bold: true, bg: CLR.tdRow, numFmt: NF });
                    sc(ws1, r, 12, nb(d.longitudConductor),      { bold: true, bg: CLR.tdRow, numFmt: NF });
                    sc(ws1, r, 13, nb(d.seccion),                { bold: true, bg: CLR.tdRow, numFmt: NF });
                    sc(ws1, r, 14, nb(d.caidaTension),           { bold: true, bg: CLR.tdRow, numFmt: NF });
                    sc(ws1, r, 15, nb(d.caidaTensionPorcentaje), { bold: true, bg: CLR.tdRow, numFmt: NF });
                    sc(ws1, r, 16, d.interruptor   || '',        { bold: true, bg: CLR.tdRow });
                    sc(ws1, r, 17, d.tipoConductor || '',        { bold: true, bg: CLR.tdRow });
                    sc(ws1, r, 18, d.ducto         || '',        { bold: true, bg: CLR.tdRow });
                    r++;

                } else {
                    const startRow = r;
                    const hasSplit = node.isSplit && node.splitData?.length > 0;
                    const subCount = hasSplit ? node.splitData.length : 1;
                    const endRow   = startRow + subCount - 1;

                    if (!hasSplit) {
                        ws1.getRow(r).height = 14;
                        ws1.mergeCells(`B${r}:D${r}`);
                        sc(ws1, r,  1, d.tablero,                    { bold: true, bg: CLR.circuitBg });
                        sc(ws1, r,  2, d.descripcion || '',          { bg: CLR.circuitBg, h: 'left', wrap: true });
                        sc(ws1, r,  5, nb(d.puntos),                 { bg: CLR.circuitBg, numFmt: NF });
                        sc(ws1, r,  6, nb(d.cargaInstalada),         { bg: CLR.circuitBg });
                        sc(ws1, r,  7, nb(d.potenciaInstalada),      { bg: CLR.circuitBg, numFmt: NF });
                        sc(ws1, r,  8, nv(d.factorDemanda),          { bg: CLR.circuitBg, numFmt: NF });
                        sc(ws1, r,  9, nb(d.maximaDemanda),          { bg: CLR.circuitBg, numFmt: NF });
                        sc(ws1, r, 10, nb(d.corrienteA),             { bg: CLR.circuitBg, numFmt: NF });
                        sc(ws1, r, 11, nb(d.corrienteDiseno),        { bg: CLR.circuitBg, numFmt: NF });
                        sc(ws1, r, 12, nb(d.longitudConductor),      { bg: CLR.circuitBg, numFmt: NF });
                        sc(ws1, r, 13, nb(d.seccion),                { bg: CLR.circuitBg, numFmt: NF });
                        sc(ws1, r, 14, nb(d.caidaTension),           { bg: CLR.circuitBg, numFmt: NF });
                        sc(ws1, r, 15, nb(d.caidaTensionPorcentaje), { bg: CLR.circuitBg, numFmt: NF });
                        sc(ws1, r, 16, d.interruptor   || '',        { bg: CLR.circuitBg });
                        sc(ws1, r, 17, d.tipoConductor || '',        { bg: CLR.circuitBg });
                        sc(ws1, r, 18, d.ducto         || '',        { bg: CLR.circuitBg });
                        r++;

                    } else {
                        node.splitData.forEach((split, idx) => {
                            const rr = startRow + idx;
                            ws1.getRow(rr).height = 14;
                            ws1.mergeCells(`B${rr}:D${rr}`);
                            sc(ws1, rr, 2, split.descripcion || '', { bg: CLR.splitBg, h: 'left' });
                            sc(ws1, rr, 5, nb(split.puntos),        { bg: CLR.splitBg, numFmt: NF });
                            sc(ws1, rr, 6, nb(split.cargaInstalada), { bg: CLR.splitBg });
                            r++;
                        });

                        if (subCount > 1) safeMerge(ws1, startRow, 1, endRow, 1);
                        const cA = ws1.getCell(startRow, 1);
                        cA.value = d.tablero;
                        cA.font = { name: 'Arial', bold: true, size: 9 };
                        cA.alignment = { horizontal: 'center', vertical: 'middle' };
                        fill(cA, CLR.circuitBg);
                        bAll(cA, T);

                        const techCols: [number, any, string?][] = [
                            [ 7, nb(d.potenciaInstalada),       NF],
                            [ 8, nv(d.factorDemanda),           NF],
                            [ 9, nb(d.maximaDemanda),           NF],
                            [10, nb(d.corrienteA),              NF],
                            [11, nb(d.corrienteDiseno),         NF],
                            [12, nb(d.longitudConductor),       NF],
                            [13, nb(d.seccion),                 NF],
                            [14, nb(d.caidaTension),            NF],
                            [15, nb(d.caidaTensionPorcentaje),  NF],
                            [16, d.interruptor   || ''],
                            [17, d.tipoConductor || ''],
                            [18, d.ducto         || ''],
                        ];
                        techCols.forEach(([col, val, fmt]) => {
                            if (subCount > 1) safeMerge(ws1, startRow, col as number, endRow, col as number);
                            const tc = ws1.getCell(startRow, col as number);
                            tc.value = val;
                            tc.font = { name: 'Arial', size: 9 };
                            tc.alignment = { horizontal: 'center', vertical: 'middle' };
                            fill(tc, CLR.splitBg);
                            if (fmt) tc.numFmt = fmt;
                            bAll(tc, T);
                        });
                    }
                }

                if (node.children?.length > 0) flatten(node.children);
            });
        };

        if (tdTree?.length > 0) flatten(tdTree);

        // ════════════════════════════════════════════════════════════════
        // HOJA 2 — TG - CAÍDA DE TENSIÓN
        // (3 tablas: Alimentador Principal → ATS → Grupo Electrógeno)
        // ════════════════════════════════════════════════════════════════
        const ws2 = wb.addWorksheet('TG - CAÍDA DE TENSIÓN');
        ws2.columns = [
            { width: 13   },  // A — vacía
            { width: 17.9 },  // B — ALIMENTADOR
            { width: 16.1 },  // C — TABLERO
            { width: 13.9 },  // D — SISTEMA
            { width: 17.4 },  // E — POTENCIA INSTALADA
            { width: 22   },  // F — FACTOR SIMULTANEIDAD
            { width: 16   },  // G — MAXIMA DEMANDA
            { width: 16.6 },  // H — CORRIENTE (A)
            { width: 19.4 },  // I — CORRIENTE DISEÑO
            { width: 19.3 },  // J — LONGITUD
            { width: 13   },  // K — SECCIÓN
            { width: 14.3 },  // L — CAÍDA V
            { width: 16   },  // M — CAÍDA %
            { width: 15.6 },  // N — INTERRUPTOR
            { width: 14.4 },  // O — TIPO CONDUCTOR
            { width: 18.6 },  // P — DUCTO
        ];
        ws2.views = [{ state: 'frozen', ySplit: 6 }];

        // ── Título hoja 2 ─────────────────────────────────────────────
        ws2.mergeCells('B1:P1');
        const t1b = ws2.getCell('B1');
        t1b.value = 'CALCULO DE LA POTENCIA INSTALADA Y MAXIMA DEMANDA';
        t1b.font = { name: 'Arial', bold: true, size: 11 };
        t1b.alignment = { horizontal: 'center', vertical: 'middle' };
        fill(t1b, CLR.headerYellPink);
        bAll(t1b, T);
        ws2.getRow(1).height = 31;

        ws2.getRow(2).height = 5;

        // ── Headers tabla 1 (Alimentador Principal) ───────────────────
        for (let i = 3; i <= 6; i++) ws2.getRow(i).height = 14;

        const H2_specs: [string, string][] = [
            ['ALIMENTADOR',                   'B3:B6'],
            ['TABLERO',                       'C3:C6'],
            ['SISTEMA',                       'D3:D6'],
            ['POTENCIA\nINSTALADA\n(W)',      'E3:E6'],
            ['FACTOR DE\nSIMULTANEIDAD F.S', 'F3:F6'],
            ['MAXIMA\nDEMANDA\n(W)',          'G3:G6'],
            ['CORRIENTE (A)',                  'H3:H6'],
            ['CORRIENTE\nDISEÑO Id (A)',      'I3:I6'],
            ['LONGITUD DE\nCONDUCTOR(M)',     'J3:J6'],
            ['SECCIÓN\n(mm2)',                'K3:K6'],
            ['CAIDA DE\nTENSIÓN (V)',         'L3:L6'],
            ['CAIDA DE TENSIÓN (%)\n<2.5%',  'M3:M6'],
            ['INTERRUPTOR (A)',               'N3:N6'],
            ['TIPO DE\nCONDUCTOR',           'O3:O6'],
            ['DUCTO (mm2)',                   'P3:P6'],
        ];
        H2_specs.forEach(([text, range]) => {
            ws2.mergeCells(range);
            const c = ws2.getCell(range.split(':')[0]);
            c.value = text;
            c.font = { name: 'Arial', bold: true, size: 9 };
            c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            fill(c, CLR.headerBg);
            bAll(c, T);
        });

        // ── Datos tabla 1: flattenedData (TGRow) ─────────────────────
        const NF2 = '#,##0.00';
        const flatRows: TGRow[] = tgState.flattenedData || [];
        let r2 = 7;

        // Fila estática TG (resumen general)
        const tgStaticRow = flatRows.find(row => row.isStaticTG);
        if (tgStaticRow) {
            ws2.getRow(r2).height = 17;
            sc(ws2, r2,  2, tgStaticRow.alimentador || '',          { bold: true, bg: CLR.headerYellPink });
            sc(ws2, r2,  3, tgStaticRow.tablero,                    { bold: true, bg: CLR.headerYellPink });
            sc(ws2, r2,  4, tgStaticRow.sistema,                    { bold: true, bg: CLR.headerYellPink });
            sc(ws2, r2,  5, nb(tgStaticRow.potenciaInstalada),      { bold: true, bg: CLR.headerYellPink, numFmt: NF2 });
            sc(ws2, r2,  6, nv(tgStaticRow.factorSimultaniedad),    { bold: true, bg: CLR.headerYellPink, numFmt: NF2 });
            sc(ws2, r2,  7, nb(tgStaticRow.maximaDemanda),          { bold: true, bg: CLR.headerYellPink, numFmt: NF2 });
            sc(ws2, r2,  8, nb(tgStaticRow.corrienteA),             { bold: true, bg: CLR.headerYellPink, numFmt: NF2 });
            sc(ws2, r2,  9, nb(tgStaticRow.corrienteDiseno),        { bold: true, bg: CLR.headerYellPink, numFmt: NF2 });
            sc(ws2, r2, 10, nb(tgStaticRow.longitudConductor),      { bold: true, bg: CLR.headerYellPink, numFmt: NF2 });
            sc(ws2, r2, 11, nb(tgStaticRow.seccion),                { bold: true, bg: CLR.headerYellPink, numFmt: NF2 });
            sc(ws2, r2, 12, nb(tgStaticRow.caidaTension),           { bold: true, bg: CLR.headerYellPink, numFmt: NF2 });
            sc(ws2, r2, 13, nb(tgStaticRow.caidaTensionPorcentaje), { bold: true, bg: CLR.headerYellPink, numFmt: NF2 });
            sc(ws2, r2, 14, tgStaticRow.interruptor   || '',        { bold: true, bg: CLR.headerYellPink });
            sc(ws2, r2, 15, tgStaticRow.tipoConductor || '',        { bold: true, bg: CLR.headerYellPink });
            sc(ws2, r2, 16, tgStaticRow.ducto         || '',        { bold: true, bg: CLR.headerYellPink });
            r2++;
        }

        // Resto de filas (no estáticas)
        flatRows.filter(row => !row.isStaticTG).forEach(row => {
            ws2.getRow(r2).height = 17;
            sc(ws2, r2,  2, row.alimentador,               { bold: true, bg: CLR.circuitBg });
            sc(ws2, r2,  3, row.tablero,                   { bold: true, bg: CLR.circuitBg });
            sc(ws2, r2,  4, row.sistema,                   { bg: CLR.circuitBg });
            sc(ws2, r2,  5, nb(row.potenciaInstalada),     { bg: CLR.circuitBg, numFmt: NF2 });
            sc(ws2, r2,  6, nv(row.factorSimultaniedad),   { bg: CLR.circuitBg, numFmt: NF2 });
            sc(ws2, r2,  7, nb(row.maximaDemanda),         { bg: CLR.circuitBg, numFmt: NF2 });
            sc(ws2, r2,  8, nb(row.corrienteA),            { bg: CLR.circuitBg, numFmt: NF2 });
            sc(ws2, r2,  9, nb(row.corrienteDiseno),       { bg: CLR.circuitBg, numFmt: NF2 });
            sc(ws2, r2, 10, nb(row.longitudConductor),     { bg: CLR.circuitBg, numFmt: NF2 });
            sc(ws2, r2, 11, nb(row.seccion),               { bg: CLR.circuitBg, numFmt: NF2 });
            sc(ws2, r2, 12, nb(row.caidaTension),          { bg: CLR.circuitBg, numFmt: NF2 });
            sc(ws2, r2, 13, nb(row.caidaTensionPorcentaje),{ bg: CLR.circuitBg, numFmt: NF2 });
            sc(ws2, r2, 14, row.interruptor   || '',       { bg: CLR.circuitBg });
            sc(ws2, r2, 15, row.tipoConductor || '',       { bg: CLR.circuitBg });
            sc(ws2, r2, 16, row.ducto         || '',       { bg: CLR.circuitBg });
            r2++;
        });

        // ════════════════════════════════════════════════════════════════
        // TABLA 2 — ATS (Transferencia Automática)
        // ════════════════════════════════════════════════════════════════
        const atsRows: ATSRow[] = tgState.atsData || [];

        // Separador
        ws2.getRow(r2).height = 8;
        r2++;

        // Título ATS
        ws2.mergeCells(`C${r2}:P${r2}`);
        const titleAts = ws2.getCell(`C${r2}`);
        titleAts.value = 'CÁLCULO DE CAÍDA DE TENSIÓN – ATS (TRANSFERENCIA AUTOMÁTICA)';
        titleAts.font = { name: 'Arial', bold: true, size: 11 };
        titleAts.alignment = { horizontal: 'left', vertical: 'middle' };
        ws2.getRow(r2).height = 17;
        r2++;

        // Headers ATS (4 filas fusionadas verticalmente)
        const hAtsStart = r2;
        for (let i = 0; i < 4; i++) ws2.getRow(hAtsStart + i).height = 14;

        // La tabla ATS no tiene POT.INSTALADA ni F.S. → SISTEMA ocupa D:G
        const Hats_specs: [string, string][] = [
            ['ALIMENTADOR',                 `B${hAtsStart}:B${hAtsStart+3}`],
            ['TABLERO',                     `C${hAtsStart}:C${hAtsStart+3}`],
            ['SISTEMA',                     `D${hAtsStart}:G${hAtsStart+3}`],
            ['MAXIMA\nDEMANDA\n(W)',        `H${hAtsStart}:H${hAtsStart+3}`],
            ['CORRIENTE (A)',               `I${hAtsStart}:I${hAtsStart+3}`],
            ['CORRIENTE\nDISEÑO Id (A)',    `J${hAtsStart}:J${hAtsStart+3}`],
            ['LONGITUD DE\nCONDUCTOR(M)',   `K${hAtsStart}:K${hAtsStart+3}`],
            ['SECCIÓN\n(mm2)',              `L${hAtsStart}:L${hAtsStart+3}`],
            ['CAIDA DE\nTENSIÓN (V)',       `M${hAtsStart}:M${hAtsStart+3}`],
            ['CAIDA DE TENSIÓN (%)\n<1.5%', `N${hAtsStart}:N${hAtsStart+3}`],
            ['INTERRUPTOR (A)',             `O${hAtsStart}:O${hAtsStart+3}`],
            ['DUCTO (mm2)',                 `P${hAtsStart}:P${hAtsStart+3}`],
        ];
        Hats_specs.forEach(([text, range]) => {
            try { ws2.mergeCells(range); } catch (_) {}
            const c = ws2.getCell(range.split(':')[0]);
            c.value = text;
            c.font = { name: 'Arial', bold: true, size: 9 };
            c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            fill(c, CLR.headerBg);
            bAll(c, T);
        });

        ws2.getRow(hAtsStart + 4).height = 5;
        let rAts = hAtsStart + 5;

        // Filas de datos ATS
        atsRows.forEach(row => {
            ws2.getRow(rAts).height = 17;
            sc(ws2, rAts,  2, row.alimentador ?? '',              { bold: true, bg: CLR.headerYellPink });
            sc(ws2, rAts,  3, row.tablero,                        { bold: true, bg: CLR.headerYellPink });
            // SISTEMA ocupa D:G (cols 4-7)
            try { ws2.mergeCells(rAts, 4, rAts, 7); } catch (_) {}
            sc(ws2, rAts,  4, row.sistema,                        { bold: true, bg: CLR.headerYellPink });
            // MÁX DEMANDA → col H (8)
            sc(ws2, rAts,  8, nb(row.maximademandaats),           { bg: CLR.headerYellPink, numFmt: NF2 });
            // CORRIENTE → col I (9)
            sc(ws2, rAts,  9, nb(row.corrienteA),                 { bg: CLR.headerYellPink, numFmt: NF2 });
            // CORRIENTE DISEÑO → col J (10)
            sc(ws2, rAts, 10, nb(row.corrienteDiseno),            { bg: CLR.headerYellPink, numFmt: NF2 });
            // LONGITUD → col K (11)
            sc(ws2, rAts, 11, nb(row.longitudConductor),          { bg: CLR.headerYellPink, numFmt: NF2 });
            // SECCIÓN → col L (12)
            sc(ws2, rAts, 12, nb(row.seccion),                    { bg: CLR.headerYellPink, numFmt: NF2 });
            // CAÍDA V → col M (13)
            sc(ws2, rAts, 13, nb(row.caidaTension),               { bg: CLR.headerYellPink, numFmt: NF2 });
            // CAÍDA % → col N (14)
            sc(ws2, rAts, 14, nb(row.caidaTensionPorcentaje),     { bg: CLR.headerYellPink, numFmt: NF2 });
            // INTERRUPTOR → col O (15)
            sc(ws2, rAts, 15, row.interruptor   || '',            { bg: CLR.headerYellPink });
            // DUCTO → col P (16)  [ATS no tiene tipoConductor separado]
            sc(ws2, rAts, 16, row.ducto         || '',            { bg: CLR.headerYellPink });
            rAts++;
        });

        r2 = rAts;

        // ════════════════════════════════════════════════════════════════
        // TABLA 3 — TG (Grupo Electrógeno)
        // ════════════════════════════════════════════════════════════════

        // Separador
        ws2.getRow(r2).height     = 8;
        ws2.getRow(r2 + 1).height = 8;
        const r2t = r2 + 2;

        // Título TG
        ws2.mergeCells(`C${r2t}:P${r2t}`);
        const t2b2 = ws2.getCell(`C${r2t}`);
        t2b2.value = 'CÁLCULO DE CAIDA DE TENSIÓN Y SECCION DEL ALIMENTADOR – GRUPO ELECTRÓGENO';
        t2b2.font = { name: 'Arial', bold: true, size: 11 };
        t2b2.alignment = { horizontal: 'left', vertical: 'middle' };
        ws2.getRow(r2t).height = 17;

        // Headers tabla TG (4 filas, SISTEMA ocupa D:G, sin POT.INST ni F.S.)
        const hR2s = r2t + 1;
        for (let i = 0; i < 4; i++) ws2.getRow(hR2s + i).height = 14;

        const H2b_specs: [string, string][] = [
            ['ALIMENTADOR',                `B${hR2s}:B${hR2s+3}`],
            ['TABLERO',                    `C${hR2s}:C${hR2s+3}`],
            ['SISTEMA',                    `D${hR2s}:G${hR2s+3}`],
            ['MAXIMA\nDEMANDA\n(W)',       `H${hR2s}:H${hR2s+3}`],
            ['CORRIENTE (A)',              `I${hR2s}:I${hR2s+3}`],
            ['CORRIENTE\nDISEÑO Id (A)',   `J${hR2s}:J${hR2s+3}`],
            ['LONGITUD DE\nCONDUCTOR(M)', `K${hR2s}:K${hR2s+3}`],
            ['SECCIÓN\n(mm2)',             `L${hR2s}:L${hR2s+3}`],
            ['CAIDA DE\nTENSIÓN (V)',      `M${hR2s}:M${hR2s+3}`],
            ['CAIDA DE TENSIÓN (%)\n<1.5%',`N${hR2s}:N${hR2s+3}`],
            ['INTERRUPTOR (A)',            `O${hR2s}:O${hR2s+3}`],
            ['DUCTO (mm2)',               `P${hR2s}:P${hR2s+3}`],
        ];
        H2b_specs.forEach(([text, range]) => {
            try { ws2.mergeCells(range); } catch (_) {}
            const c = ws2.getCell(range.split(':')[0]);
            c.value = text;
            c.font = { name: 'Arial', bold: true, size: 9 };
            c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            fill(c, CLR.headerBg);
            bAll(c, T);
        });

        ws2.getRow(hR2s + 4).height = 5;
        let r2b = hR2s + 5;

        // Filas de datos TG
        const tgRows: TGTableRow[] = tgState.tgData || [];
        tgRows.forEach(row => {
            ws2.getRow(r2b).height = 17;
            sc(ws2, r2b,  2, row.alimentador ?? '',            { bold: true, bg: CLR.headerYellPink });
            sc(ws2, r2b,  3, row.tablero,                      { bold: true, bg: CLR.headerYellPink });
            try { ws2.mergeCells(r2b, 4, r2b, 7); } catch (_) {}
            sc(ws2, r2b,  4, row.sistema,                      { bold: true, bg: CLR.headerYellPink });
            sc(ws2, r2b,  8, nb(row.maximademandaTG),          { bg: CLR.headerYellPink, numFmt: NF2 });
            sc(ws2, r2b,  9, nb(row.corrienteA),               { bg: CLR.headerYellPink, numFmt: NF2 });
            sc(ws2, r2b, 10, nb(row.corrienteDiseno),          { bg: CLR.headerYellPink, numFmt: NF2 });
            sc(ws2, r2b, 11, nb(row.longitudConductor),        { bg: CLR.headerYellPink, numFmt: NF2 });
            sc(ws2, r2b, 12, nb(row.seccion),                  { bg: CLR.headerYellPink, numFmt: NF2 });
            sc(ws2, r2b, 13, nb(row.caidaTension),             { bg: CLR.headerYellPink, numFmt: NF2 });
            sc(ws2, r2b, 14, nb(row.caidaTensionPorcentaje),   { bg: CLR.headerYellPink, numFmt: NF2 });
            sc(ws2, r2b, 15, row.interruptor   || '',          { bg: CLR.headerYellPink });
            sc(ws2, r2b, 16, row.ducto         || '',          { bg: CLR.headerYellPink });
            r2b++;
        });

        // ════════════════════════════════════════════════════════════════
        // HOJA 3 — SELECCIÓN DE GRUPO ELECTRÓGENO
        // Estructura fiel a la UI (imagen de referencia)
        // ════════════════════════════════════════════════════════════════
        const ws3 = wb.addWorksheet('SELECCION DE GE.');
        ws3.columns = [
            { width: 6.7  },  // A
            { width: 13   },  // B
            { width: 20.7 },  // C
            { width: 13   },  // D
            { width: 10.7 },  // E
            { width: 8.7  },  // F
            { width: 15.7 },  // G
            { width: 13.7 },  // H
            { width: 10   },  // I
            { width: 7.4  },  // J
            { width: 14.7 },  // K
            { width: 6.7  },  // L
        ];

        // ── Calcular todos los valores ────────────────────────────────
        const potInstW  = selectionData?.cantidadPotenciaWatts ?? 0;
        const potInstKW = potInstW / 1000;
        const fDem      = selectionData?.factorDemanda  ?? 1;
        const maxDemKW  = potInstKW * fDem;
        const fc1       = selectionData?.factorCarga1   ?? 0.90;
        const fc2       = selectionData?.factorCarga2   ?? 0.80;
        const resultFc1 = fc1 !== 0 ? Number((maxDemKW / fc1).toFixed(3)) : 0;
        const resultFc2 = fc2 !== 0 ? Number((maxDemKW / fc2).toFixed(3)) : 0;
        const standby = fc2 !== 0 ? resultFc2 / fc2: 0;
        const potEstabilizada = selectionData?.potenciaEstabilizadaStandby ?? 0;
        const NF3 = '#,##0.00';

        ws3.getRow(1).height = 8;
        ws3.getRow(2).height = 10;
        ws3.getRow(3).height = 10;

        // ── Fila 4: Título ────────────────────────────────────────────
        ws3.mergeCells('C4:K4');
        const s1 = ws3.getCell('C4');
        s1.value = 'SELECCIÓN DE GRUPO ELECTROGENO';
        s1.font = { name: 'Arial', bold: true, size: 13 };
        s1.alignment = { horizontal: 'center', vertical: 'middle' };
        fill(s1, CLR.white);
        bAll(s1, T);
        ws3.getRow(4).height = 26;

        ws3.getRow(5).height = 8;

        // ─────────────────────────────────────────────────────────────
        // SECCIÓN 1: tabla superior de la UI
        // Columnas: Descripción | Cant./Potencia(W) | Pot.Inst(kW) | F.D. | Máx.Demanda(kW)
        // ─────────────────────────────────────────────────────────────

        // Fila 6: cabecera sección 1
        ws3.getRow(6).height = 32;
        ws3.mergeCells('C6:D6');
        sc(ws3, 6, 3, 'Descripción',                    { bold: true, bg: CLR.white, h: 'center', wrap: true });
        ws3.mergeCells('E6:F6');
        sc(ws3, 6, 5, 'Cant. / Potencia\n(W)',          { bold: true, bg: CLR.white, h: 'center', wrap: true });
        ws3.mergeCells('G6:H6');
        sc(ws3, 6, 7, 'Pot. Instalada\n(kW)',           { bold: true, bg: CLR.white, h: 'center', wrap: true });
        sc(ws3, 6, 9, 'F.D.\n(Factor de\nDemanda)',     { bold: true, bg: CLR.white, h: 'center', wrap: true });
        ws3.mergeCells('J6:K6');
        sc(ws3, 6,10, 'Máx. Demanda\n(kW)',             { bold: true, bg: CLR.white, h: 'center', wrap: true });

        // Fila 7: fila de datos TG
        ws3.getRow(7).height = 18;
        ws3.mergeCells('C7:D7');
        sc(ws3, 7, 3, 'TG',                             { bg: CLR.white, h: 'left' });
        ws3.mergeCells('E7:F7');
        sc(ws3, 7, 5, `${potInstW.toLocaleString('es-PE')} Watts`, { bg: CLR.white, h: 'left' });
        ws3.mergeCells('G7:H7');
        sc(ws3, 7, 7, potInstKW,                        { bg: CLR.white, numFmt: NF3 });
        sc(ws3, 7, 9, fDem,                             { bg: CLR.white, numFmt: NF3 });
        ws3.mergeCells('J7:K7');
        sc(ws3, 7,10, maxDemKW,                         { bg: CLR.white, numFmt: NF3 });

        // Fila 8: POTENCIA TOTAL (con borde doble inferior)
        ws3.getRow(8).height = 20;
        ws3.mergeCells('C8:I8');
        const c8 = ws3.getCell('C8');
        c8.value = 'POTENCIA TOTAL';
        c8.font = { name: 'Arial', bold: true, size: 9 };
        c8.alignment = { horizontal: 'left', vertical: 'middle' };
        fill(c8, CLR.white);
        c8.border = { top: T(), bottom: DB(), left: T(), right: T() };
        ws3.mergeCells('J8:K8');
        const j8 = ws3.getCell('J8');
        j8.value = maxDemKW;
        j8.font = { name: 'Arial', bold: true, size: 10 };
        j8.alignment = { horizontal: 'center', vertical: 'middle' };
        j8.numFmt = NF3;
        fill(j8, CLR.white);
        j8.border = { top: T(), bottom: DB(), left: T(), right: T() };

        ws3.getRow(9).height = 8;

        // ─────────────────────────────────────────────────────────────
        // SECCIÓN 2: tabla inferior de la UI — Selección del GE
        // Columnas: Descripción | Factor de Carga | Potencia Calculada (kW)
        // ─────────────────────────────────────────────────────────────

        // Fila 10: título sección 2
        ws3.mergeCells('C10:K10');
        const s2 = ws3.getCell('C10');
        s2.value = 'Selección de Grupo Electrógeno';
        s2.font = { name: 'Arial', bold: true, size: 12 };
        s2.alignment = { horizontal: 'center', vertical: 'middle' };
        fill(s2, CLR.white);
        bAll(s2, T);
        ws3.getRow(10).height = 24;

        ws3.getRow(11).height = 8;

        // Fila 12: cabecera sección 2
        ws3.getRow(12).height = 28;
        ws3.mergeCells('C12:G12');
        sc(ws3, 12, 3, 'Descripción',           { bold: true, bg: CLR.white, h: 'center' });
        sc(ws3, 12, 9, 'Factor de\nCarga',      { bold: true, bg: CLR.white, h: 'center', wrap: true });
        ws3.mergeCells('J12:K12');
        sc(ws3, 12,10, 'Potencia Calculada\n(kW)', { bold: true, bg: CLR.white, h: 'center', wrap: true });

        ws3.getRow(13).height = 5;

        // Fila 14: POTENCIA TOTAL
        ws3.getRow(14).height = 20;
        ws3.mergeCells('C14:G14');
        sc(ws3, 14, 3, 'POTENCIA TOTAL',        { bold: true, bg: CLR.white, h: 'left' });
        // sin factor de carga en esta fila
        ws3.mergeCells('J14:K14');
        sc(ws3, 14,10, maxDemKW,                { bold: true, bg: CLR.white, numFmt: NF3 });

        // Fila 15: Grupo Electrógeno a X m.s.n.m  (fc1)
        ws3.getRow(15).height = 22;
        ws3.mergeCells('C15:G15');
        sc(ws3, 15, 3, `Grupo Electrógeno a '145.35' m.s.n.m`,
            { bg: CLR.white, h: 'left' });
        sc(ws3, 15, 8, '',                      { bg: CLR.white });   // celda Factor
        sc(ws3, 15, 9, fc1,                     { bg: CLR.white, numFmt: '0.00' });
        ws3.mergeCells('J15:K15');
        sc(ws3, 15,10, resultFc1,               { bold: true, bg: CLR.white, numFmt: NF3 });

        // Fila 16: Funcionará al X% de su máxima capacidad  (fc2)
        ws3.getRow(16).height = 22;
        ws3.mergeCells('C16:G16');
        sc(ws3, 16, 3, `Funcionará al ${(fc2 * 100).toFixed(0)}% de su máxima capacidad`,
            { bg: CLR.white, h: 'left', wrap: true });
        sc(ws3, 16, 8, '',                      { bg: CLR.white });
        sc(ws3, 16, 9, fc2,                     { bg: CLR.white, numFmt: '0.00' });
        ws3.mergeCells('J16:K16');
        const cellJ16 = ws3.getCell('J16');

        cellJ16.value = {
            formula: 'J15/I16'
        };

        cellJ16.font = { name: 'Arial', bold: true, size: 9 };
        cellJ16.alignment = { horizontal: 'center', vertical: 'middle' };
        cellJ16.numFmt = NF3;
        fill(cellJ16, CLR.white);
        bAll(cellJ16, T);

        // Fila 17: Potencia STAND BY en kW a X m.s.n.m
        ws3.getRow(17).height = 22;
        ws3.mergeCells('C17:G17');
        sc(ws3, 17, 3, `Potencia STAND BY en kW a '145.35' m.s.n.m`,
            { bg: CLR.white, h: 'left' });
        sc(ws3, 17, 8, '',                      { bg: CLR.white });
        sc(ws3, 17, 9, '',                      { bg: CLR.white });
        ws3.mergeCells('J17:K17');
        const cellJ17 = ws3.getCell('J17');

        cellJ17.value = {
            formula: 'J16'
        };

        cellJ17.font = { name: 'Arial', bold: true, size: 9 };
        cellJ17.alignment = { horizontal: 'center', vertical: 'middle' };
        cellJ17.numFmt = NF3;
        fill(cellJ17, CLR.white);
        bAll(cellJ17, T);

        ws3.getRow(18).height = 8;

        // Fila 19: GRUPO ELECTRÓGENO ESTABILIZADO EN STAND BY (kW)
        ws3.getRow(19).height = 28;
        ws3.mergeCells('C19:I19');
        const c19 = ws3.getCell('C19');
        c19.value = 'GRUPO ELECTRÓGENO ESTABILIZADO EN STAND BY (kW)';
        c19.font = { name: 'Arial', bold: true, size: 10 };
        c19.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        fill(c19, CLR.white);
        bAll(c19, M);

        ws3.mergeCells('J19:K19');
        const k19 = ws3.getCell('J19');
        k19.value = potEstabilizada;
        k19.font = { name: 'Arial', bold: true, size: 12 };
        k19.alignment = { horizontal: 'center', vertical: 'middle' };
        k19.numFmt = '#,##0.##';
        fill(k19, CLR.white);
        k19.border = { top: GN(), bottom: GN(), left: GN(), right: GN() };

        ws3.getRow(20).height = 8;

        // ── Descarga ──────────────────────────────────────────────────
        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (err: any) {
        console.error('Error al exportar Excel:', err);
        alert('Error al exportar Excel: ' + err.message);
    }
}