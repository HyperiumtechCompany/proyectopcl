import ExcelJS from 'exceljs';

// TIPOS INTERNOS
type ViewMode = 'monto' | 'porcentaje';

interface ExportarExcelOptions {
    totalPresupuesto?: number;
    diasPorMes?: Record<string, number>;
    totalDias?: number;
    codigoProyecto?: string;
    ubicacion?: string;
    projectData?: any;
    finDefaults?: {
        pctGastosGenerales?: number;
        pctUtilidad?: number;
        pctIGV?: number;
        montoMobiliario?: number;
        pctIGVMobiliario?: number;
        pctSupervision?: number;
    };
}

// HELPERS DE FORMATO
const fmtN   = (v: number) => (v ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nivel  = (item: string) => (item?.split('.').length ?? 1) - 1;

// PALETA DE COLORES 
const C = {
    // Cabecera principal
    headerBg:        'FF1F4E79', 
    headerFg:        'FFFFFFFF',
    // Cabecera parcial
    parcialBg:       'FF5B9BD5', 
    parcialFg:       'FFFFFFFF',
    // Total (col derecha)
    totalBg:         'FF70AD47', 
    totalFg:         'FFFFFFFF',
    // Mes pico
    picoBg:          'FFFFC000', 
    picoFg:          'FF3A3A3A',
    // Niveles de ítem
    nivel0Bg:        'FFD9EAF7', nivel0Fg: 'FF1F4E79',   
    nivel1Bg:        'FFEAF4DD', nivel1Fg: 'FF375623',   
    nivel2Bg:        'FFF2F2F2', nivel2Fg: 'FF404040',  
    nivel3Bg:        'FFFFFFFF', nivel3Fg: 'FF404040',
    leafBg:          'FFFFFFFF', leafFg:  'FF1E293B',
    // Footer filas
    footer1Bg:       'FF5B9BD5', footer1Fg: 'FFFFFFFF',  
    footer2Bg:       'FF808080', footer2Fg: 'FFFFFFFF',  
    footer3Bg:       'FF70AD47', footer3Fg: 'FFFFFFFF',  
    footer4Bg:       'FF44546A', footer4Fg: 'FFFFFFFF', 
    // Celda datos
    dataBg:          'FFFFFFFF', dataFg: 'FF808080',
    altRowBg:        'FFF7FBFF',
    // Resumen superior
    resumeBg:        'FF5B9BD5',
};

// HELPER: aplicar fill sólido
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


// ENCABEZADO 
const EXCEL_START_COL = 2;
const xcol = (logicalCol: number): number => EXCEL_START_COL + logicalCol - 1;
const xlast = (logicalTotalCols: number): number => xcol(logicalTotalCols);

const fontX = (opts: Partial<ExcelJS.Font>): Partial<ExcelJS.Font> => ({
    name: 'Calibri', size: 11, ...opts,
});
const fillX = (argb: string): ExcelJS.Fill => ({
    type: 'pattern', pattern: 'solid', fgColor: { argb },
});
const borderX = (color = 'FFCBD5E1', styleBorder: ExcelJS.BorderStyle = 'thin'): Partial<ExcelJS.Borders> => ({
    top: { style: styleBorder, color: { argb: color } },
    bottom: { style: styleBorder, color: { argb: color } },
    left: { style: styleBorder, color: { argb: color } },
    right: { style: styleBorder, color: { argb: color } },
});
const alignX = (
    horizontal: ExcelJS.Alignment['horizontal'] = 'center',
    vertical: ExcelJS.Alignment['vertical'] = 'middle',
    wrap = false,
): Partial<ExcelJS.Alignment> => ({ horizontal, vertical, wrapText: wrap });

const getProjectNombre = (projectData: any, fallback = '-') =>
    (projectData?.nombre || projectData?.name || fallback || '-').toString().toUpperCase();

const getCodigoModular = (projectData: any): string => {
    try {
        const raw = projectData?.codigos_modulares ?? projectData?.codigo_modular;
        if (!raw) return '-';
        const modulares = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const partes: string[] = [];
        if (modulares?.inicial) partes.push(modulares.inicial);
        if (modulares?.primaria) partes.push(modulares.primaria);
        if (modulares?.secundaria) partes.push(modulares.secundaria);
        return partes.length ? partes.join('-') : String(raw);
    } catch {
        return projectData?.codigos_modulares || projectData?.codigo_modular || '-';
    }
};

const getUbicacionProyecto = (projectData: any, fallback = '-') => {
    const partes = [
        projectData?.departamento,
        projectData?.provincia,
        projectData?.distrito,
    ].filter(Boolean);
    return partes.length ? partes.join(' - ').toUpperCase() : fallback;
};

const calcularDuracionProyecto = (projectData: any, totalDias?: number): string => {
    if (totalDias && totalDias > 0) return `${totalDias} DÍAS CALENDARIO`;
    try {
        if (!projectData?.fecha_inicio || !projectData?.fecha_fin) return '-';
        const ini = new Date(projectData.fecha_inicio);
        const fin = new Date(projectData.fecha_fin);
        const dias = Math.round((fin.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24));
        return dias > 0 ? `${dias} DÍAS CALENDARIO` : '-';
    } catch { return '-'; }
};

async function fetchProjectImage(relativePath?: string): Promise<{ buffer: ArrayBuffer; extension: 'png' | 'jpeg' | 'gif' | 'bmp' } | null> {
    try {
        if (!relativePath) return null;
        const base = (window as any).__STORAGE_URL__
            || (import.meta as any).env?.VITE_STORAGE_URL
            || '/storage';
        const url = base.replace(/\/$/, '') + '/' + String(relativePath).replace(/^\//, '');
        const res = await fetch(url);
        if (!res.ok) return null;
        const buffer = await res.arrayBuffer();
        const lower = String(relativePath).toLowerCase();
        const extension: 'png' | 'jpeg' | 'gif' | 'bmp' =
            lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'jpeg' :
            lower.endsWith('.gif') ? 'gif' :
            lower.endsWith('.bmp') ? 'bmp' : 'png';
        return { buffer, extension };
    } catch { return null; }
}

function putProjectImage(
    ws: ExcelJS.Worksheet,
    imgData: { buffer: ArrayBuffer; extension: string },
    colIni: number,
    rowIni: number,
    colFin: number,
    rowFin: number,
): void {
    const imgId = ws.workbook.addImage({
        buffer: new Uint8Array(imgData.buffer) as any,
        extension: imgData.extension as any,
    });
    ws.addImage(imgId, {
        tl: { col: colIni - 1, row: rowIni - 1 } as any,
        br: { col: colFin - 1, row: rowFin - 1 } as any,
        editAs: 'oneCell',
    });
}

async function buildHeaderMaterialStyle(
    ws: ExcelJS.Worksheet,
    projectData: any,
    title: string,
    totalLogicalCols: number,
    totalDias?: number,
): Promise<number> {
    ws.getColumn(1).width = 3; 

    const nombre = getProjectNombre(projectData, projectData?.projectName || '-');
    const cui = projectData?.codigo_cui || projectData?.cui || '-';
    const codigoLocal = projectData?.codigo_local || '-';
    const modular = getCodigoModular(projectData);
    const unidadEjec = (projectData?.unidad_ejecutora || '-').toString().toUpperCase();
    const ubicacion = getUbicacionProyecto(projectData, '-');
    const duracion = calcularDuracionProyecto(projectData, totalDias);

    const [imgIzq, imgDer] = await Promise.all([
        fetchProjectImage(projectData?.plantilla_logo_izq || projectData?.logo_izq || projectData?.logoIzquierdo || projectData?.logo_izquierdo || projectData?.logo_institucion || projectData?.logo_entidad || ''),
        fetchProjectImage(projectData?.plantilla_logo_der || projectData?.logo_der || projectData?.logoDerecho || projectData?.logo_derecho || projectData?.logo_municipalidad || projectData?.logo_gobierno || ''),
    ]);
    const tieneLogos = !!(imgIzq || imgDer);
    const logoCols = tieneLogos ? 2 : 0;
    const cIni = logoCols + 1;
    const cFin = totalLogicalCols - logoCols;

    ws.getRow(1).height = 78;

    const borderExt: Partial<ExcelJS.Borders> = {
        top: { style: 'medium', color: { argb: 'FFB0B0B0' } },
        bottom: { style: 'medium', color: { argb: 'FFB0B0B0' } },
        left: { style: 'medium', color: { argb: 'FFB0B0B0' } },
        right: { style: 'medium', color: { argb: 'FFB0B0B0' } },
    };

    const mergeSet = (r1: number, lc1: number, r2: number, lc2: number, value: ExcelJS.CellValue, st: Partial<ExcelJS.Style>) => {
        const c1 = xcol(lc1);
        const c2 = xcol(lc2);
        if (c1 <= c2) {
            try { ws.mergeCells(r1, c1, r2, c2); } catch { /* ya mergeado */ }
            const cell = ws.getCell(r1, c1);
            cell.value = value;
            cell.style = st;
        }
    };

    if (tieneLogos) {
        mergeSet(1, 1, 1, logoCols, null, { fill: fillX('FFFFFFFF'), alignment: alignX('center'), border: borderExt });
        mergeSet(1, cFin + 1, 1, totalLogicalCols, null, { fill: fillX('FFFFFFFF'), alignment: alignX('center'), border: borderExt });
    }

    const headerText = [
        title.toUpperCase(),
        `"${nombre}"`,
        `CUI: ${cui};  CÓDIGO MODULAR: ${modular};  CÓDIGO LOCAL: ${codigoLocal}`,
        `UBICACIÓN: ${ubicacion};  UNIDAD EJECUTORA: ${unidadEjec};  PLAZO: ${duracion}`,
    ].join('\n');

    mergeSet(1, cIni, 1, cFin, headerText, {
        font: fontX({ bold: true, italic: true, size: 10, color: { argb: 'FF0F172A' } }),
        fill: fillX('FFFFFFFF'),
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        border: borderExt,
    });

    if (imgIzq) putProjectImage(ws, imgIzq, xcol(1), 1, xcol(logoCols) + 1, 2);
    if (imgDer) putProjectImage(ws, imgDer, xcol(cFin + 1), 1, xcol(totalLogicalCols) + 1, 2);

    ws.getRow(2).height = 5;
    for (let lc = 1; lc <= totalLogicalCols; lc++) {
        ws.getCell(2, xcol(lc)).style = { fill: fillX('FF64748B'), border: borderX('FF64748B') };
    }

    return 3;
}

interface FilaDesembolso {
    key: string;
    label: string;
    dias: number;
    diasAcumulados: number;
    adelantoEfectivo: number;
    adelantoMateriales: number;
    totalAdelanto: number;
    valorizacion: number;
    pctAvance: number;
    desembolsoMensual: number;
    desembolsoAcumulado: number;
    pctDesembolso: number;
}

interface DesembolsoData {
    totalPresupuesto: number;
    totalDias: number;
    adelantoDirecto: number;
    adelantoMateriales: number;
    adelantoTotal: number;
    flujoTotal: number;
    totalValorizacion: number;
    maxDesembolso: number;
    filas: FilaDesembolso[];
    curva: Array<{ label: string; acumulado: number; pct: number }>;
}

function buildDesembolsoData(periodos: any[], totales: any, options: ExportarExcelOptions): DesembolsoData {
    const totalPresupuesto: number = options.totalPresupuesto
        ?? (Object.values(totales as Record<string, any>).reduce((s: number, t: any) => s + (t.monto ?? 0), 0) as number);
    const diasPorMes = options.diasPorMes ?? {};
    const totalDias = options.totalDias ?? Object.values(diasPorMes).reduce((s, d) => s + (Number(d) || 0), 0);
    const adelantoDirecto = totalPresupuesto * 0.10;
    const adelantoMateriales = totalPresupuesto * 0.20;
    const adelantoTotal = adelantoDirecto + adelantoMateriales;
    const flujoTotal = totalPresupuesto + adelantoTotal;
    const totalDiasProyecto = totalDias || 1;

    let acumulado = adelantoTotal;
    let diasAcumulados = 0;
    const filas = periodos.map((p: any): FilaDesembolso => {
        const dias = diasPorMes[p.key] ?? 0;
        diasAcumulados += dias;
        const valorizacion = totales[p.key]?.monto ?? 0;
        const pctAvance = totales[p.key]?.porcentaje ?? 0;
        const factor = totalDiasProyecto > 0 ? dias / totalDiasProyecto : 0;
        const adelantoEfectivo = adelantoDirecto * factor;
        const adelantoMat = adelantoMateriales * factor;
        const totalAdelanto = adelantoEfectivo + adelantoMat;
        const desembolsoMensual = totalAdelanto + valorizacion;
        acumulado += desembolsoMensual;

        return {
            key: p.key,
            label: p.labelCal ?? p.label,
            dias,
            diasAcumulados,
            adelantoEfectivo,
            adelantoMateriales: adelantoMat,
            totalAdelanto,
            valorizacion,
            pctAvance,
            desembolsoMensual,
            desembolsoAcumulado: acumulado,
            pctDesembolso: flujoTotal > 0 ? acumulado / flujoTotal : 0,
        };
    });

    const lastPct = filas[filas.length - 1]?.pctDesembolso || 1;
    const lastAcum = filas[filas.length - 1]?.desembolsoAcumulado || flujoTotal || 1;
    const curva = filas.map((f, i) => ({
        label: f.label,
        acumulado: i === filas.length - 1 ? flujoTotal : f.desembolsoAcumulado * (flujoTotal / lastAcum),
        pct: i === filas.length - 1 ? 100 : f.pctDesembolso * (100 / lastPct),
    }));

    return {
        totalPresupuesto,
        totalDias,
        adelantoDirecto,
        adelantoMateriales,
        adelantoTotal,
        flujoTotal,
        totalValorizacion: filas.reduce((s, f) => s + f.valorizacion, 0),
        maxDesembolso: Math.max(...filas.map(f => f.desembolsoMensual), 1),
        filas,
        curva,
    };
}

async function addCronogramaDesembolsosSheet(
    wb: ExcelJS.Workbook,
    periodos: any[],
    totales: any,
    projectName: string,
    options: ExportarExcelOptions,
): Promise<void> {
    const data = buildDesembolsoData(periodos, totales, options);
    if (!data.filas.length) return;

    const ws = wb.addWorksheet('Desembolso', {
        pageSetup: {
            paperSize: 9,
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: { left: 0.35, right: 0.35, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 },
        },
        views: [{ state: 'normal', showGridLines: true, zoomScale: 100 }],
        properties: { tabColor: { argb: 'FFFFD966' } },
    });

    ws.getColumn(1).width = 3;
    const widths = [13, 15, 15, 13, 16, 12, 16, 14];
    widths.forEach((w, i) => ws.getColumn(xcol(i + 1)).width = w);

    const pd = options.projectData ?? { nombre: projectName, projectName };
    let r = await buildHeaderMaterialStyle(ws, pd, 'CRONOGRAMA DE DESEMBOLSOS', 8, data.totalDias);

    // Resumen ejecutivo corto
    const info: Array<[string, string | number]> = [
        ['PRESUPUESTO DE OBRA', data.totalPresupuesto],
        ['ADELANTO DIRECTO 10%', data.adelantoDirecto],
        ['ADELANTO MATERIALES 20%', data.adelantoMateriales],
        ['ADELANTO TOTAL 30%', data.adelantoTotal],
        ['FLUJO TOTAL', data.flujoTotal],
    ];
    for (let i = 0; i < info.length; i++) {
        const col = xcol(i + 1);
        const cell = ws.getCell(r, col);
        cell.value = info[i][0];
        style(cell, { bg: 'FFDCEBFA', fg: 'FF1F2937', bold: true, size: 8, hAlign: 'center', vAlign: 'middle', wrapText: true });
        borderAll(cell, 'FF9CA3AF');
        const val = ws.getCell(r + 1, col);
        val.value = info[i][1] as any;
        style(val, { bg: 'FFF5FAFF', fg: 'FF111827', bold: true, size: 9, hAlign: 'center', vAlign: 'middle', numFmt: typeof info[i][1] === 'number' ? '"S/. "#,##0.00' : undefined });
        borderAll(val, 'FFB6C0CC');
    }
    ws.getRow(r).height = 22;
    ws.getRow(r + 1).height = 22;
    r += 3;

    // Grupos superiores
    ws.mergeCells(r, xcol(2), r, xcol(4));
    ws.getCell(r, xcol(2)).value = 'ADELANTOS';
    ws.mergeCells(r, xcol(5), r, xcol(6));
    ws.getCell(r, xcol(5)).value = 'VALORIZACIÓN';
    ws.mergeCells(r, xcol(7), r, xcol(8));
    ws.getCell(r, xcol(7)).value = 'DESEMBOLSOS INC/IGV';
    [1, 2, 5, 7].forEach(lc => {
        const cell = ws.getCell(r, xcol(lc));
        style(cell, { bg: 'FFDCEBFA', fg: 'FF111827', bold: true, size: 8, hAlign: 'center', vAlign: 'middle' });
        borderAll(cell, 'FF000000');
    });
    r++;

    const headers = [
        'CALENDARIO', 'EFECTIVO\n10%', 'MATERIALES\n20%', 'TOTAL\n(1 + 2)',
        'PARCIAL\nPRESUPUESTO', '%\nAVANCE', 'MONTO\nDESEMBOLSO', '% DE\nDESEMBOLSO',
    ];
    headers.forEach((h, i) => {
        const cell = ws.getCell(r, xcol(i + 1));
        cell.value = h;
        style(cell, { bg: 'FFDCEBFA', fg: 'FF000000', bold: true, size: 8, hAlign: 'center', vAlign: 'middle', wrapText: true });
        borderAll(cell, 'FF000000');
    });
    ws.getRow(r).height = 31;
    r++;

    const paintRow = (values: any[], bg = 'FFFFFFFF', bold = false) => {
        values.forEach((value, i) => {
            const cell = ws.getCell(r, xcol(i + 1));
            cell.value = value as any;
            const isPct = i === 5 || i === 7;
            style(cell, {
                bg,
                fg: 'FF000000',
                bold,
                size: 8,
                hAlign: i === 0 ? 'center' : 'right',
                vAlign: 'middle',
                numFmt: isPct ? '0.00%' : i > 0 ? '#,##0.00' : undefined,
            });
            borderAll(cell, 'FF000000');
        });
        r++;
    };

    paintRow([
        0, data.adelantoDirecto, data.adelantoMateriales, data.adelantoTotal,
        null, null, data.adelantoTotal, data.flujoTotal > 0 ? data.adelantoTotal / data.flujoTotal : 0,
    ]);

    data.filas.forEach(f => paintRow([
        f.diasAcumulados,
        f.adelantoEfectivo,
        f.adelantoMateriales,
        f.totalAdelanto,
        f.valorizacion,
        f.pctAvance / 100,
        f.desembolsoMensual,
        f.pctDesembolso,
    ]));

    paintRow(['PARCIAL', null, null, null, data.totalValorizacion, 1, data.totalValorizacion, 1], 'FFDDEBF7', true);
    r++;

    [
        ['TOTAL PRESUPUESTO DE OBRA', data.totalPresupuesto],
        ['Adelanto Directo 10% del Monto del contrato', data.adelantoDirecto],
        ['Adelanto Materiales 20% del Monto del contrato', data.adelantoMateriales],
    ].forEach(([label, value]) => {
        ws.mergeCells(r, xcol(1), r, xcol(3));
        ws.getCell(r, xcol(1)).value = label as string;
        style(ws.getCell(r, xcol(1)), { bg: 'FFFFFFFF', fg: 'FF000000', bold: true, size: 8, hAlign: 'left', vAlign: 'middle' });
        ws.getCell(r, xcol(4)).value = value as number;
        style(ws.getCell(r, xcol(4)), { bg: 'FFFFFFFF', fg: 'FF000000', size: 8, hAlign: 'right', vAlign: 'middle', numFmt: '#,##0.00' });
        r++;
    });

    r++;
    ws.mergeCells(r, xcol(1), r, xcol(8));
    ws.getCell(r, xcol(1)).value = '* Porcentajes máximos de Adelantos según Artículo 155 del Reglamento de la Ley de Contrataciones del Estado.';
    style(ws.getCell(r, xcol(1)), { bg: 'FFFFFFFF', fg: 'FF000000', bold: true, size: 8, hAlign: 'left', vAlign: 'middle' });
    r++;
    ws.mergeCells(r, xcol(1), r, xcol(8));
    ws.getCell(r, xcol(1)).value = 'Las Bases establecerán el otorgamiento y el porcentaje final de dichos adelantos.';
    style(ws.getCell(r, xcol(1)), { bg: 'FFFFFFFF', fg: 'FF000000', bold: true, size: 8, hAlign: 'left', vAlign: 'middle' });
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function svgToPngDataUrl(svg: string, width: number, height: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(url);
                reject(new Error('No se pudo crear canvas para el grafico.'));
                return;
            }
            ctx.fillStyle = '#F7F9FC';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('No se pudo convertir el grafico SVG a PNG.'));
        };
        img.src = url;
    });
}

function buildGaussSvg(data: DesembolsoData): { svg: string; width: number; height: number } {
    const width = 1320;
    const height = 640;
    const ml = 145;
    const mr = 60;
    const mt = 145;
    const mb = 140;
    const cw = width - ml - mr;
    const ch = height - mt - mb;
    const dx = 16;
    const dy = -8;
    const max = data.maxDesembolso || 1;
    const n = Math.max(data.filas.length, 1);
    const slot = cw / n;
    const gap = Math.max(12, slot * 0.18);
    const bw = Math.max(36, slot - gap);
    const ticks = [0, 0.25, 0.5, 0.75, 1];

    const bars = data.filas.map((d, i) => {
        const isPeak = d.desembolsoMensual === max;
        const h = (d.desembolsoMensual / max) * ch;
        const x = ml + i * slot + gap / 2;
        const y = mt + ch - h;
        const bottom = mt + ch;
        const front = isPeak ? 'url(#gPeak)' : 'url(#gNormal)';
        const top = isPeak ? '#FFE38A' : '#7DAED8';
        const side = isPeak ? '#A86200' : '#154E8C';

        return `
            <g filter="url(#shadow)">
                <path d="M ${x + bw} ${y} L ${x + bw + dx} ${y + dy} L ${x + bw + dx} ${bottom + dy} L ${x + bw} ${bottom} Z" fill="${side}" opacity="0.92"/>
                <path d="M ${x} ${y} L ${x + bw} ${y} L ${x + bw + dx} ${y + dy} L ${x + dx} ${y + dy} Z" fill="${top}"/>
                <rect x="${x}" y="${y}" width="${bw}" height="${h}" fill="${front}"/>
                ${isPeak ? `<rect x="${x + bw / 2 - 20}" y="${y - 25}" width="40" height="18" rx="4" fill="#D4820A"/><text x="${x + bw / 2}" y="${y - 12}" text-anchor="middle" font-size="10" font-weight="800" fill="#fff">PICO</text>` : ''}
                <text x="${x + bw / 2}" y="${bottom + 20}" text-anchor="middle" font-size="11" font-weight="800" fill="#1E3A5F">${d.dias}</text>
                <text x="${x + bw / 2}" y="${bottom + 39}" text-anchor="middle" font-size="10" fill="#425C7A">${escapeXml(d.label)}</text>
            </g>`;
    }).join('');

    const grid = ticks.map(t => {
        const y = mt + ch - (t * ch);
        return `<line x1="${ml}" y1="${y}" x2="${ml + cw + dx}" y2="${y}" stroke="${t === 0 ? '#9DC3E6' : '#DDEAF5'}" stroke-width="${t === 0 ? 1.6 : 1}" stroke-dasharray="${t === 0 ? 'none' : '7 5'}"/>
            <text x="${ml - 12}" y="${y + 4}" text-anchor="end" font-size="11" fill="#2B4A6F">S/${fmtN(max * t)}</text>`;
    }).join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <defs>
            <linearGradient id="gNormal" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5B9BD5"/><stop offset="100%" stop-color="#1E5BB5"/></linearGradient>
            <linearGradient id="gPeak" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFC844"/><stop offset="100%" stop-color="#D4820A"/></linearGradient>
            <filter id="shadow"><feDropShadow dx="4" dy="6" stdDeviation="4" flood-color="#1E3A5F" flood-opacity="0.22"/></filter>
        </defs>
        <rect width="100%" height="100%" fill="#F7F9FC"/>
        <text x="22" y="38" font-size="16" font-weight="900" letter-spacing="2" fill="#1E3A5F">GAUSS DE DESEMBOLSOS MENSUALES</text>
        <text x="22" y="61" font-size="11" fill="#425C7A">Desembolso mensual (Adelantos + Valorizacion).</text>
        ${grid}
        <line x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt + ch}" stroke="#9DC3E6" stroke-width="1.5"/>
        <line x1="${ml}" y1="${mt + ch}" x2="${ml + cw + dx}" y2="${mt + ch}" stroke="#9DC3E6" stroke-width="1.8"/>
        ${bars}
        <text transform="translate(34 ${mt + ch / 2}) rotate(-90)" text-anchor="middle" font-size="13" font-weight="800" letter-spacing="2" fill="#2B4A6F">MONTO DESEMBOLSO (S/)</text>
        <rect x="22" y="${height - 52}" width="14" height="12" fill="url(#gNormal)" rx="2"/><text x="44" y="${height - 42}" font-size="11" fill="#425C7A">Desembolso Mensual</text>
        <rect x="160" y="${height - 52}" width="14" height="12" fill="url(#gPeak)" rx="2"/><text x="182" y="${height - 42}" font-size="11" fill="#425C7A">Mes Pico</text>
        <line x1="0" y1="${height - 20}" x2="${width}" y2="${height - 20}" stroke="#9DC3E6"/>
        <text x="20" y="${height - 7}" font-size="10" font-style="italic" fill="#425C7A">* Porcentajes maximos de Adelanto segun Articulo 155 del Reglamento de la Ley de Contrataciones del Estado.</text>
        <text x="${width - 20}" y="${height - 7}" font-size="10" text-anchor="end" fill="#94A3B8">Proyecta PCL - Modulo Financiero</text>
    </svg>`;

    return { svg, width, height };
}

function buildCurvaSvg(data: DesembolsoData): { svg: string; width: number; height: number } {
    const width = 1320;
    const height = 640;
    const ml = 118;
    const mr = 80;
    const mt = 145;
    const mb = 110;
    const cw = width - ml - mr;
    const ch = height - mt - mb;
    const n = Math.max(data.curva.length, 1);
    const step = cw / Math.max(n - 1, 1);
    const xy = (i: number, pct: number) => ({ x: ml + i * step, y: mt + ch - (pct / 100) * ch });
    const pts = data.curva.map((d, i) => xy(i, d.pct));
    let path = pts.length ? `M ${pts[0].x} ${pts[0].y}` : '';
    for (let i = 1; i < pts.length; i++) {
        const p = pts[i - 1];
        const c = pts[i];
        const cx = (p.x + c.x) / 2;
        path += ` C ${cx} ${p.y} ${cx} ${c.y} ${c.x} ${c.y}`;
    }
    const area = pts.length ? `${path} L ${pts[pts.length - 1].x} ${mt + ch} L ${pts[0].x} ${mt + ch} Z` : '';
    const grid = [0, 25, 50, 75, 100].map(t => {
        const y = mt + ch - (t / 100) * ch;
        return `<line x1="${ml}" y1="${y}" x2="${ml + cw}" y2="${y}" stroke="${t === 0 ? '#9DC3E6' : '#DDEAF5'}" stroke-width="${t === 0 ? 1.6 : 1}" stroke-dasharray="${t === 0 ? 'none' : '7 5'}"/>
            <text x="${ml - 12}" y="${y + 4}" text-anchor="end" font-size="12" fill="#2B4A6F">${t}%</text>`;
    }).join('');
    const points = data.curva.map((d, i) => {
        const p = xy(i, d.pct);
        return `<line x1="${p.x}" y1="${mt}" x2="${p.x}" y2="${mt + ch}" stroke="#E7F0F8"/>
            <circle cx="${p.x}" cy="${p.y}" r="7" fill="#fff" stroke="#1E3A5F" stroke-width="3"/>
            <text x="${p.x}" y="${p.y - 18}" text-anchor="middle" font-size="12" font-weight="900" fill="#1E5BB5">${d.pct.toFixed(1)}%</text>
            <text x="${p.x}" y="${mt + ch + 26}" text-anchor="middle" font-size="11" fill="#2B4A6F">${escapeXml(d.label)}</text>`;
    }).join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <defs>
            <linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#5B9BD5" stop-opacity="0.35"/><stop offset="100%" stop-color="#5B9BD5" stop-opacity="0.03"/></linearGradient>
            <filter id="lineShadow"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#1E3A5F" flood-opacity="0.35"/></filter>
        </defs>
        <rect width="100%" height="100%" fill="#F7F9FC"/>
        <text x="16" y="38" font-size="16" font-weight="900" letter-spacing="2" fill="#1E3A5F">CURVA S - DESEMBOLSO ACUMULADO (%)</text>
        <text x="16" y="62" font-size="11" fill="#425C7A">Progresion acumulada sobre el flujo total.</text>
        ${grid}
        <line x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt + ch}" stroke="#9DC3E6" stroke-width="1.8"/>
        <line x1="${ml}" y1="${mt + ch}" x2="${ml + cw}" y2="${mt + ch}" stroke="#9DC3E6" stroke-width="1.8"/>
        <path d="${area}" fill="url(#area)"/>
        <path d="${path}" fill="none" stroke="#7DAED8" stroke-width="9" opacity="0.35" stroke-linecap="round"/>
        <path d="${path}" fill="none" stroke="#1E3A5F" stroke-width="4" filter="url(#lineShadow)" stroke-linecap="round"/>
        ${points}
        <text transform="translate(32 ${mt + ch / 2}) rotate(-90)" text-anchor="middle" font-size="13" font-weight="800" letter-spacing="2" fill="#2B4A6F">% DESEMBOLSO ACUMULADO</text>
    </svg>`;

    return { svg, width, height };
}

async function addChartImageSheet(
    wb: ExcelJS.Workbook,
    name: string,
    chart: { svg: string; width: number; height: number },
    data: DesembolsoData,
    projectName: string,
    options: ExportarExcelOptions,
    tabColor: string,
    type: 'gauss' | 'curva',
): Promise<void> {
    const ws = wb.addWorksheet(name, {
        properties: { tabColor: { argb: tabColor } },
        pageSetup: {
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 1,
            paperSize: 9,
            margins: { left: 0.35, right: 0.35, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 },
        },
        views: [{ state: 'normal', showGridLines: false, zoomScale: 100 }],
    });

    ws.getColumn(1).width = 3;
    for (let c = 2; c <= 14; c++) ws.getColumn(c).width = 14;
    for (let r = 1; r <= 55; r++) ws.getRow(r).height = 18;

    await buildHeaderMaterialStyle(
        ws,
        options.projectData ?? { nombre: projectName, projectName },
        `CRONOGRAMA VALORIZADO - ${name.toUpperCase()}`,
        13,
        options.totalDias,
    );

    const png = await svgToPngDataUrl(chart.svg, chart.width, chart.height);
    const imageId = wb.addImage({ base64: png, extension: 'png' });
    ws.addImage(imageId, {
        tl: { col: 1, row: 4 }, // B5 visualmente; columna A queda libre
        ext: { width: 1188, height: 576 },
        editAs: 'oneCell',
    });

    // Tabla auxiliar con notas
    let r = 39;
    const headers = type === 'gauss'
        ? ['PERÍODO', 'DÍAS', 'ADELANTO', 'VALORIZACIÓN', 'DESEMBOLSO', '% DESEMBOLSO', 'DESCRIPCIÓN']
        : ['PERÍODO', 'ACUMULADO S/.', '% ACUMULADO', 'DESCRIPCIÓN'];

    headers.forEach((h, i) => {
        const cell = ws.getCell(r, 2 + i);
        cell.value = h;
        style(cell, { bg: 'FFDCEBFA', fg: 'FF1F2937', bold: true, size: 8, hAlign: 'center', vAlign: 'middle', wrapText: true });
        borderAll(cell, 'FF9CA3AF');
    });
    r++;

    if (type === 'gauss') {
        data.filas.forEach(f => {
            const values = [
                f.label,
                f.dias,
                f.totalAdelanto,
                f.valorizacion,
                f.desembolsoMensual,
                f.pctDesembolso,
                `Desembolso mensual de ${f.label}`,
            ];
            values.forEach((v, i) => {
                const cell = ws.getCell(r, 2 + i);
                cell.value = v as any;
                style(cell, {
                    bg: r % 2 === 0 ? 'FFFFFFFF' : 'FFF7FBFF',
                    fg: 'FF111827',
                    size: 8,
                    hAlign: i === 0 || i === 6 ? 'left' : 'right',
                    vAlign: 'middle',
                    wrapText: i === 6,
                    numFmt: i >= 2 && i <= 4 ? '"S/. "#,##0.00' : i === 5 ? '0.00%' : undefined,
                });
                borderAll(cell, 'FFB6C0CC');
                cell.note = {
                    texts: [
                        { text: `PERÍODO: ${f.label}\n` },
                        { text: `Días: ${f.dias}\n` },
                        { text: `Adelanto: S/. ${fmtN(f.totalAdelanto)}\n` },
                        { text: `Valorización: S/. ${fmtN(f.valorizacion)}\n` },
                        { text: `Desembolso: S/. ${fmtN(f.desembolsoMensual)}\n` },
                        { text: `% Desembolso: ${(f.pctDesembolso * 100).toFixed(2)}%` },
                    ],
                } as any;
            });
            r++;
        });
    } else {
        data.curva.forEach(f => {
            const values = [f.label, f.acumulado, f.pct / 100, `Curva S acumulada de ${f.label}`];
            values.forEach((v, i) => {
                const cell = ws.getCell(r, 2 + i);
                cell.value = v as any;
                style(cell, {
                    bg: r % 2 === 0 ? 'FFFFFFFF' : 'FFF7FBFF',
                    fg: 'FF111827',
                    size: 8,
                    hAlign: i === 0 || i === 3 ? 'left' : 'right',
                    vAlign: 'middle',
                    wrapText: i === 3,
                    numFmt: i === 1 ? '"S/. "#,##0.00' : i === 2 ? '0.00%' : undefined,
                });
                borderAll(cell, 'FFB6C0CC');
                cell.note = {
                    texts: [
                        { text: `PERÍODO: ${f.label}\n` },
                        { text: `Acumulado: S/. ${fmtN(f.acumulado)}\n` },
                        { text: `% Acumulado: ${f.pct.toFixed(2)}%` },
                    ],
                } as any;
            });
            r++;
        });
    }
}

function addFilasFinancierasValorizado(
    ws: ExcelJS.Worksheet,
    startRow: number,
    periodos: any[],
    totales: any,
    totalPresupuesto: number,
    options: ExportarExcelOptions,
    mesPicoKey: string,
    fixedCols: number,
    totalCol: number,
): number {
    const fin = {
        pctGastosGenerales: options.finDefaults?.pctGastosGenerales ?? 11.56,
        pctUtilidad: options.finDefaults?.pctUtilidad ?? 5.00,
        pctIGV: options.finDefaults?.pctIGV ?? 18.00,
        montoMobiliario: options.finDefaults?.montoMobiliario ?? 0,
        pctIGVMobiliario: options.finDefaults?.pctIGVMobiliario ?? 18.00,
        pctSupervision: options.finDefaults?.pctSupervision ?? 5.13,
    };

    const costoDirecto = totalPresupuesto || periodos.reduce((s, p) => s + (totales[p.key]?.monto ?? 0), 0);
    const cdPorPeriodo: Record<string, number> = {};
    periodos.forEach(p => { cdPorPeriodo[p.key] = totales[p.key]?.monto ?? 0; });
    const cdTotalReal = Object.values(cdPorPeriodo).reduce((a, b) => a + b, 0);

    const propDist = (total: number): Record<string, number> => {
        const r: Record<string, number> = {};
        periodos.forEach(p => {
            r[p.key] = cdTotalReal > 0 ? total * ((cdPorPeriodo[p.key] ?? 0) / cdTotalReal) : 0;
        });
        return r;
    };

    const montoGG = costoDirecto * (fin.pctGastosGenerales / 100);
    const montoUT = costoDirecto * (fin.pctUtilidad / 100);
    const subTotal = costoDirecto + montoGG + montoUT;
    const montoIGV = subTotal * (fin.pctIGV / 100);
    const presupI = subTotal + montoIGV;
    const montoIGVMob = fin.montoMobiliario * (fin.pctIGVMobiliario / 100);
    const subTotalII = fin.montoMobiliario + montoIGVMob;
    const totalI_II = presupI + subTotalII;
    const montoSup = presupI * (fin.pctSupervision / 100);
    const presupTotal = totalI_II + montoSup;

    const rows: Array<[string, number, Record<string, number>]> = [
        [`GASTOS GENERALES ${fin.pctGastosGenerales.toFixed(2)}%`, montoGG, propDist(montoGG)],
        [`UTILIDAD ${fin.pctUtilidad.toFixed(2)}%`, montoUT, propDist(montoUT)],
        ['SUB TOTAL', subTotal, propDist(subTotal)],
        [`IGV ${fin.pctIGV.toFixed(2)}%`, montoIGV, propDist(montoIGV)],
        ['PRESUPUESTO I', presupI, propDist(presupI)],
        ['MOBILIARIO Y EQUIPAMIENTO', fin.montoMobiliario, propDist(fin.montoMobiliario)],
        [`IGV MOBILIARIO ${fin.pctIGVMobiliario.toFixed(2)}%`, montoIGVMob, propDist(montoIGVMob)],
        ['PRESUPUESTO I + II', totalI_II, propDist(totalI_II)],
        [`SUPERVISIÓN ${fin.pctSupervision.toFixed(2)}%`, montoSup, propDist(montoSup)],
    ];

    let r = startRow + 1;
    rows.forEach(([label, total, dist], idx) => {
        ws.getRow(r).height = 19;
        const labelCell = ws.getCell(r, 1);
        labelCell.value = label;
        ws.mergeCells(r, 1, r, fixedCols);
        style(labelCell, { bg: idx % 2 === 0 ? 'FFE5E7EB' : 'FFF3F4F6', fg: 'FF111827', bold: true, size: 8, hAlign: 'right', vAlign: 'middle' });
        borderAll(labelCell, 'FF6B7280');

        periodos.forEach((p, i) => {
            const cell = ws.getCell(r, fixedCols + 1 + i);
            cell.value = dist[p.key] || null;
            style(cell, { bg: p.key === mesPicoKey ? 'FFFFF0B8' : 'FFFFFFFF', fg: 'FF111827', bold: true, size: 8, hAlign: 'right', vAlign: 'middle', numFmt: '"S/. "#,##0.00' });
            borderAll(cell, 'FFB6C0CC');
        });

        const totalCell = ws.getCell(r, totalCol);
        totalCell.value = total || null;
        style(totalCell, { bg: 'FFE5E7EB', fg: 'FF111827', bold: true, size: 8, hAlign: 'right', vAlign: 'middle', numFmt: '"S/. "#,##0.00' });
        borderAll(totalCell, 'FF6B7280');
        r++;
    });

    ws.getRow(r).height = 22;
    const labelCell = ws.getCell(r, 1);
    labelCell.value = 'PRESUPUESTO TOTAL';
    ws.mergeCells(r, 1, r, fixedCols);
    style(labelCell, { bg: 'FF0F172A', fg: 'FFFFFFFF', bold: true, size: 10, hAlign: 'right', vAlign: 'middle' });
    borderAll(labelCell, 'FF0F172A');

    const distPresTotal = propDist(presupI + montoSup);
    periodos.forEach((p, i) => {
        const cell = ws.getCell(r, fixedCols + 1 + i);
        cell.value = distPresTotal[p.key] || null;
        style(cell, { bg: 'FF0F172A', fg: 'FFFFFFFF', bold: true, size: 9, hAlign: 'right', vAlign: 'middle', numFmt: '"S/. "#,##0.00' });
        borderAll(cell, 'FF0F172A');
    });

    const totalCell = ws.getCell(r, totalCol);
    totalCell.value = presupTotal;
    style(totalCell, { bg: 'FF0F172A', fg: 'FF34D399', bold: true, size: 10, hAlign: 'right', vAlign: 'middle', numFmt: '"S/. "#,##0.00' });
    borderAll(totalCell, 'FF0F172A');

    return r + 1;
}

// EXPORTAR EXCEL 
export async function exportarExcel(
    items:           any[],
    periodos:        any[],
    totales:         any,
    projectName:     string,
    viewMode:        ViewMode,
    totalesPorItem:  Record<string | number, number>,
    options:         ExportarExcelOptions = {},
): Promise<void> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Proyecta PCL — Módulo Financiero';
    wb.lastModifiedBy = 'Proyecta PCL';
    wb.created = new Date();
    wb.modified = new Date();
    wb.calcProperties.fullCalcOnLoad = true;

    const pd = options.projectData ?? { nombre: projectName, projectName };
    const mesPicoKey = periodos.reduce((best: any, p: any) =>
        ((totales[p.key]?.monto ?? 0) > (totales[best?.key]?.monto ?? 0) ? p : best), periodos[0]
    )?.key;

    const FIXED = 8; 
    const TOTAL_LOGICAL = FIXED + periodos.length + 1;
    const totalCol = xcol(TOTAL_LOGICAL);

    const ws = wb.addWorksheet('Cronograma Valorizado', {
        pageSetup: {
            paperSize: 9,
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: { left: 0.35, right: 0.35, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 },
        },
        views: [{ state: 'frozen', xSplit: 0, ySplit: 5, showGridLines: false, zoomScale: 100 }],
        properties: { tabColor: { argb: 'FF1E3A5F' } },
        headerFooter: {
            oddHeader: `&L&B${getProjectNombre(pd, projectName)}&C&BCRONOGRAMA VALORIZADO&R&P de &N`,
            oddFooter: `&LGenerado: ${new Date().toLocaleString('es-PE')}&RProyecta PCL`,
        },
    });

    ws.getColumn(1).width = 3;
    [6, 12, 48, 8, 12, 14, 16, 10].forEach((w, i) => ws.getColumn(xcol(i + 1)).width = w);
    periodos.forEach((_, i) => ws.getColumn(xcol(FIXED + 1 + i)).width = 15);
    ws.getColumn(totalCol).width = 18;

    const firstRow = await buildHeaderMaterialStyle(
        ws,
        pd,
        'CRONOGRAMA DE EJECUCIÓN FÍSICO VALORIZADO',
        TOTAL_LOGICAL,
        options.totalDias,
    );

    // Leyenda superior 
    ws.getRow(firstRow).height = 22;
    ws.mergeCells(firstRow, xcol(1), firstRow, totalCol);
    const ley = ws.getCell(firstRow, xcol(1));
    ley.value = '📌 CLIC EN CELDA PARA EDITAR     ⟳ = UNIFORME     ↗ = GAUSS (CURVA S)     × = LIMPIAR     🔒 = FUERA DE RANGO';
    ley.style = {
        font: fontX({ bold: true, size: 9, color: { argb: 'FF1F4E79' } }),
        fill: fillX('FFEAF4FE'),
        alignment: alignX('left', 'middle'),
        border: borderX('FFCBD5E1'),
    };

    const rowH1 = firstRow + 1;
    const rowH2 = firstRow + 2;
    ws.getRow(rowH1).height = 32;
    ws.getRow(rowH2).height = 28;

    const fixedHeaders = ['N°', 'ÍTEM', 'DESCRIPCIÓN', 'UND', 'METRADO', 'P.U. (S/.)', 'PARCIAL (S/.)', 'ACC.'];
    fixedHeaders.forEach((h, i) => {
        const col = xcol(i + 1);
        ws.mergeCells(rowH1, col, rowH2, col);
        const cell = ws.getCell(rowH1, col);
        cell.value = h;
        cell.style = {
            font: fontX({ bold: true, size: 9, color: { argb: 'FF000000' } }),
            fill: fillX(i === 6 ? 'FF5B9BD5' : 'FFD9EAF7'),
            alignment: alignX(i === 2 ? 'left' : 'center', 'middle', true),
            border: borderX('FF9DC3E6'),
        };
    });

    periodos.forEach((p, i) => {
        const col = xcol(FIXED + 1 + i);
        const isPico = p.key === mesPicoKey;
        const cell = ws.getCell(rowH1, col);
        cell.value = `${p.label ?? `MES ${i + 1}`}\n${p.labelCal ?? ''}`;
        ws.mergeCells(rowH1, col, rowH2, col);
        cell.style = {
            font: fontX({ bold: true, size: 9, color: { argb: 'FF000000' } }),
            fill: fillX(isPico ? 'FFFFC000' : 'FFD9EAF7'),
            alignment: alignX('center', 'middle', true),
            border: borderX(isPico ? 'FFD966' : 'FF9DC3E6'),
        };
    });

    const totalHeader = ws.getCell(rowH1, totalCol);
    totalHeader.value = 'TOTAL\nS/. acumulado';
    ws.mergeCells(rowH1, totalCol, rowH2, totalCol);
    totalHeader.style = {
        font: fontX({ bold: true, size: 9, color: { argb: 'FFFFFFFF' } }),
        fill: fillX('FF70AD47'),
        alignment: alignX('center', 'middle', true),
        border: borderX('FF065F46'),
    };

    let rowIdx = rowH2 + 1;

    const getItemTotal = (item: any): number => {
        const byId = totalesPorItem[item.id] ?? totalesPorItem[String(item.id)] ?? 0;
        if (byId) return byId;
        return periodos.reduce((s, p) => s + (item.distribucion?.[p.key]?.monto ?? 0), 0);
    };

    items.forEach((item: any, idx: number) => {
        const n = nivel(item.item || '');
        const isLeaf = item.is_leaf ?? true;
        const totalFila = getItemTotal(item);
        const row = ws.getRow(rowIdx);
        row.height = n === 0 ? 26 : 23;

        const isRoot = n === 0;
        const bg = isRoot ? 'FFD9EAF7' : (idx % 2 === 0 ? 'FFFFFFFF' : 'FFF7FBFF');
        const fg = 'FF000000';

        const set = (logicalCol: number, value: ExcelJS.CellValue, st: Partial<ExcelJS.Style>) => {
            const c = ws.getCell(rowIdx, xcol(logicalCol));
            c.value = value;
            c.style = st;
        };

        const bodyBase = (align: ExcelJS.Alignment['horizontal'] = 'center'): Partial<ExcelJS.Style> => ({
            font: fontX({ bold: isRoot, italic: !isRoot && isLeaf, size: 9, color: { argb: fg } }),
            fill: fillX(bg),
            alignment: alignX(align, 'middle', align === 'left'),
            border: borderX('FFCBD5E1'),
        });

        set(1, idx + 1, bodyBase('center'));
        set(2, item.item ?? '', { ...bodyBase('center'), font: fontX({ bold: true, size: 9, color: { argb: fg } }) });
        set(3, item.descripcion ?? item.description ?? '', { ...bodyBase('left'), alignment: { horizontal: 'left', vertical: 'middle', wrapText: true, indent: Math.min(n, 4) } });
        set(4, item.und ?? item.unidad ?? '', bodyBase('center'));
        set(5, item.metrado || null, { ...bodyBase('right'), numFmt: '#,##0.00' });
        set(6, item.precio || null, { ...bodyBase('right'), numFmt: '#,##0.00' });
        set(7, item.parcial || null, {
            font: fontX({ bold: true, size: 8, color: { argb: 'FF1D4ED8' } }),
            fill: fillX(isRoot ? 'FFD9EAF7' : 'FFEAF4FE'),
            alignment: alignX('right'),
            border: borderX('FFCBD5E1'),
            numFmt: '"S/. "#,##0.00',
        });
        set(8, isRoot ? '' : '⟳  ↗  ×', {
            font: fontX({ size: 8, color: { argb: 'FF94A3B8' } }),
            fill: fillX(isRoot ? 'FFD9EAF7' : 'FFF7FBFF'),
            alignment: alignX('center'),
            border: borderX('FFCBD5E1'),
        });

        periodos.forEach((p, pi) => {
            const monto = item.distribucion?.[p.key]?.monto ?? 0;
            const value = viewMode === 'porcentaje'
                ? (item.parcial > 0 ? (monto / item.parcial) * 100 : null)
                : (monto > 0 ? monto : null);
            const col = xcol(FIXED + 1 + pi);
            const c = ws.getCell(rowIdx, col);
            c.value = value as any;
            c.style = {
                font: fontX({ bold: true, size: 9, color: { argb: monto > 0 ? 'FF000000' : 'FF94A3B8' } }),
                fill: fillX(p.key === mesPicoKey ? 'FFFFF2CC' : bg),
                alignment: alignX('right'),
                border: borderX(p.key === mesPicoKey ? 'FFFFC000' : 'FFCBD5E1'),
                numFmt: viewMode === 'porcentaje' ? '0.0000"%"' : '#,##0.00',
            };
        });

        const tCell = ws.getCell(rowIdx, totalCol);
        tCell.value = totalFila || null;
        tCell.style = {
            font: fontX({ bold: true, size: 9, color: { argb: 'FF008000' } }),
            fill: fillX('FFECFDF5'),
            alignment: alignX('right'),
            border: borderX('FFA7F3D0'),
            numFmt: '"S/. "#,##0.00',
        };

        rowIdx++;
    });

    // Resumen financiero del presupuesto
    ws.getRow(rowIdx).height = 17;
    ws.mergeCells(rowIdx, xcol(1), rowIdx, totalCol);
    const secFin = ws.getCell(rowIdx, xcol(1));
    secFin.value = '▼ RESUMEN FINANCIERO DEL PRESUPUESTO';
    secFin.style = {
        font: fontX({ bold: true, size: 9, color: { argb: 'FF1F4E79' } }),
        fill: fillX('FFD9EAF7'),
        alignment: alignX('left'),
        border: borderX('FF9DC3E6'),
    };
    rowIdx++;

    const totalPresupuesto = options.totalPresupuesto
        ?? items.reduce((s, it) => s + (Number(it.parcial) || 0), 0)
        ?? periodos.reduce((s, p) => s + (totales[p.key]?.monto ?? 0), 0);
    const fin = {
        pctGastosGenerales: options.finDefaults?.pctGastosGenerales ?? 11.56,
        pctUtilidad: options.finDefaults?.pctUtilidad ?? 5.00,
        pctIGV: options.finDefaults?.pctIGV ?? 18.00,
        montoMobiliario: options.finDefaults?.montoMobiliario ?? 0,
        pctIGVMobiliario: options.finDefaults?.pctIGVMobiliario ?? 18.00,
        pctSupervision: options.finDefaults?.pctSupervision ?? 5.13,
    };
    const cdPorPeriodo: Record<string, number> = {};
    periodos.forEach(p => { cdPorPeriodo[p.key] = totales[p.key]?.monto ?? 0; });
    const cdTotalReal = Object.values(cdPorPeriodo).reduce((a, b) => a + b, 0);
    const propDist = (total: number): Record<string, number> => {
        const r: Record<string, number> = {};
        periodos.forEach(p => { r[p.key] = cdTotalReal > 0 ? total * ((cdPorPeriodo[p.key] ?? 0) / cdTotalReal) : 0; });
        return r;
    };
    const montoGG = totalPresupuesto * (fin.pctGastosGenerales / 100);
    const montoUT = totalPresupuesto * (fin.pctUtilidad / 100);
    const subTotal = totalPresupuesto + montoGG + montoUT;
    const montoIGV = subTotal * (fin.pctIGV / 100);
    const presupI = subTotal + montoIGV;
    const montoIGVMob = fin.montoMobiliario * (fin.pctIGVMobiliario / 100);
    const subTotalII = fin.montoMobiliario + montoIGVMob;
    const totalI_II = presupI + subTotalII;
    const montoSup = presupI * (fin.pctSupervision / 100);
    const presupTotal = totalI_II + montoSup;

    const finRows: Array<{ pct?: string; label: string; total: number; dark?: boolean; gray?: boolean }> = [
        { label: 'COSTO DIRECTO', total: totalPresupuesto, gray: true },
        { pct: `${fin.pctGastosGenerales.toFixed(2)}%`, label: 'GASTOS GENERALES', total: montoGG },
        { pct: `${fin.pctUtilidad.toFixed(2)}%`, label: 'UTILIDAD', total: montoUT },
        { label: 'SUB TOTAL', total: subTotal, gray: true },
        { pct: `${fin.pctIGV.toFixed(2)}%`, label: 'I.G.V.', total: montoIGV },
        { label: 'PRESUPUESTO DE OBRA INFRAESTRUCTURA COMPONENTE I', total: presupI, dark: true },
        { pct: 'monto', label: 'MOBILIARIO Y EQUIPAMIENTO COMPONENTE II', total: fin.montoMobiliario },
        { pct: `${fin.pctIGVMobiliario.toFixed(2)}%`, label: 'IGV (MOBILIARIO Y EQUIPAMIENTO)', total: montoIGVMob },
        { label: 'SUB TOTAL COMPONENTE II', total: subTotalII, gray: true },
        { label: 'TOTAL PRESUPUESTO DE OBRA COMPONENTE I+II', total: totalI_II, dark: true },
        { pct: `${fin.pctSupervision.toFixed(2)}%`, label: 'GASTOS DE SUPERVISIÓN Y LIQUIDACIÓN', total: montoSup },
        { label: 'PRESUPUESTO TOTAL', total: presupTotal, dark: true },
    ];

    finRows.forEach(fr => {
        const dist = propDist(fr.label.includes('COSTO DIRECTO') ? totalPresupuesto : fr.total);
        ws.getRow(rowIdx).height = fr.dark ? 24 : 22;
        const bg = fr.dark ? 'FF5B9BD5' : fr.gray ? 'FFD9EAF7' : 'FFFFFFFF';
        const fg = 'FF000000';

        ws.getCell(rowIdx, xcol(1)).value = fr.pct ?? '';
        ws.getCell(rowIdx, xcol(1)).style = { font: fontX({ italic: fr.pct === 'monto', size: 9, color: { argb: 'FF000000' } }), fill: fillX(bg), alignment: alignX('center'), border: borderX('FFCBD5E1') };

        ws.mergeCells(rowIdx, xcol(2), rowIdx, xcol(6));
        const l = ws.getCell(rowIdx, xcol(2));
        l.value = fr.label;
        l.style = { font: fontX({ bold: true, size: 9, color: { argb: fg } }), fill: fillX(bg), alignment: alignX('right'), border: borderX('FFCBD5E1') };

        const parcialCell = ws.getCell(rowIdx, xcol(7));
        parcialCell.value = fr.total || null;
        parcialCell.style = { font: fontX({ bold: true, size: 9, color: { argb: fr.dark && fr.label === 'PRESUPUESTO TOTAL' ? 'FF008000' : fg } }), fill: fillX(bg), alignment: alignX('right'), border: borderX('FFCBD5E1'), numFmt: '"S/. "#,##0.00' };
        ws.getCell(rowIdx, xcol(8)).style = { fill: fillX(bg), border: borderX('FFCBD5E1') };

        periodos.forEach((p, pi) => {
            const c = ws.getCell(rowIdx, xcol(FIXED + 1 + pi));
            c.value = dist[p.key] || null;
            c.style = { font: fontX({ bold: true, size: 9, color: { argb: fg } }), fill: fillX(p.key === mesPicoKey ? 'FFFFF2CC' : bg), alignment: alignX('right'), border: borderX(p.key === mesPicoKey ? 'FFFFC000' : 'FFCBD5E1'), numFmt: '#,##0.00' };
        });
        const t = ws.getCell(rowIdx, totalCol);
        t.value = fr.total || null;
        t.style = { font: fontX({ bold: true, size: 9, color: { argb: fr.dark && fr.label === 'PRESUPUESTO TOTAL' ? 'FF008000' : fg } }), fill: fillX(fr.dark ? 'FF5B9BD5' : 'FFECFDF5'), alignment: alignX('right'), border: borderX(fr.dark ? 'FF2F75B6' : 'FFA7F3D0'), numFmt: '"S/. "#,##0.00' };
        rowIdx++;
    });

    // Valorización y avance de obra
    ws.getRow(rowIdx).height = 17;
    ws.mergeCells(rowIdx, xcol(1), rowIdx, totalCol);
    const secVal = ws.getCell(rowIdx, xcol(1));
    secVal.value = '▼ VALORIZACIÓN Y AVANCE DE OBRA';
    secVal.style = { font: fontX({ bold: true, size: 9, color: { argb: 'FF1F4E79' } }), fill: fillX('FFD9EAF7'), alignment: alignX('left'), border: borderX('FF334155') };
    rowIdx++;

    const totalMensualGeneral = periodos.reduce((s, p) => s + (totales[p.key]?.monto ?? 0), 0);
    const lastKey = periodos.length ? periodos[periodos.length - 1].key : '';
    const footerRows = [
        { label: 'VALORIZACIÓN MENSUAL (S/.)', bg: 'FF5B9BD5', fg: 'FFFFFFFF', values: periodos.map(p => totales[p.key]?.monto ?? 0), total: totalMensualGeneral, fmt: '#,##0.00' },
        { label: '% AVANCE MENSUAL', bg: 'FFD9EAF7', fg: 'FF000000', values: periodos.map(p => totales[p.key]?.porcentaje ?? 0), total: null, fmt: '0.000"%"' },
        { label: 'DÍAS TRABAJADOS', bg: 'FFD9EAF7', fg: 'FF000000', values: periodos.map(p => options.diasPorMes?.[p.key] ?? null), total: null, fmt: '0' },
        { label: 'VALORIZACIÓN ACUMULADA (S/.)', bg: 'FF70AD47', fg: 'FFFFFFFF', values: periodos.map(p => totales[p.key]?.acumuladoMonto ?? 0), total: totales[lastKey]?.acumuladoMonto ?? totalMensualGeneral, fmt: '#,##0.00' },
        { label: '% AVANCE ACUMULADO (CURVA S)', bg: 'FFE2EFDA', fg: 'FF000000', values: periodos.map(p => totales[p.key]?.acumuladoPorcentaje ?? 0), total: 100, fmt: '0.00"%"' },
    ];

    footerRows.forEach(fr => {
        ws.getRow(rowIdx).height = 24;
        ws.mergeCells(rowIdx, xcol(1), rowIdx, xcol(FIXED));
        const l = ws.getCell(rowIdx, xcol(1));
        l.value = fr.label;
        l.style = { font: fontX({ bold: true, size: 9, color: { argb: fr.fg } }), fill: fillX(fr.bg), alignment: alignX('right'), border: borderX('FF9DC3E6'), numFmt: fr.fmt };
        fr.values.forEach((v, pi) => {
            const c = ws.getCell(rowIdx, xcol(FIXED + 1 + pi));
            c.value = v as any;
            c.style = { font: fontX({ bold: true, size: 9, color: { argb: fr.fg } }), fill: fillX(periodos[pi]?.key === mesPicoKey ? 'FFFFC000' : fr.bg), alignment: alignX('center'), border: borderX('FF9DC3E6'), numFmt: fr.fmt };
        });
        const t = ws.getCell(rowIdx, totalCol);
        t.value = fr.total as any;
        t.style = { font: fontX({ bold: true, size: 9, color: { argb: fr.fg } }), fill: fillX(fr.bg === 'FF5B9BD5' ? 'FF70AD47' : fr.bg), alignment: alignX('center'), border: borderX('FF9DC3E6'), numFmt: fr.fmt };
        rowIdx++;
    });

    ws.autoFilter = { from: { row: rowH1, column: xcol(1) }, to: { row: rowH2, column: totalCol } };

    // Hojas de desembolso y gráficos
    const desembolsoData = buildDesembolsoData(periodos, totales, options);
    await addCronogramaDesembolsosSheet(wb, periodos, totales, projectName, options);
    await addChartImageSheet(wb, 'Gauss', buildGaussSvg(desembolsoData), desembolsoData, projectName, options, 'FF5B9BD5', 'gauss');
    await addChartImageSheet(wb, 'Curva S', buildCurvaSvg(desembolsoData), desembolsoData, projectName, options, 'FF10B981', 'curva');

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cronograma_Valorizado_${projectName.replace(/\s+/g, '_')}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}

// EXPORTAR PDF
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

