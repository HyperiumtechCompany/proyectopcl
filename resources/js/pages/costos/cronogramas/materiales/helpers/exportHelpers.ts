import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { MaterialItem, Periodo, ViewMode } from '../types';


const TIPO_META: Record<string, {
    label:       string;
    headerArgb:  string;
    subArgb:     string;
    accentArgb:  string;
    textArgb:    string;
}> = {
    mano_de_obra: { label: 'MANO DE OBRA', headerArgb: 'FFF3E2D2', subArgb: 'FFF9EEE6', accentArgb: 'FFFCF7F3', textArgb: 'FF374151' },
    materiales:   { label: 'MATERIALES', headerArgb: 'FFDCEBFA', subArgb: 'FFEAF4FE', accentArgb: 'FFF5FAFF', textArgb: 'FF374151' },
    equipos:      { label: 'EQUIPOS', headerArgb: 'FFE9E3F7', subArgb: 'FFF2EEFB', accentArgb: 'FFFAF8FE', textArgb: 'FF374151' },
    subcontratos: { label: 'SUBCONTRATOS', headerArgb: 'FFDFF2E6', subArgb: 'FFEEF8F1', accentArgb: 'FFF7FCF8', textArgb: 'FF374151' },
    subpartidas:  { label: 'SUBPARTIDAS', headerArgb: 'FFDDF1EF', subArgb: 'FFECF8F7', accentArgb: 'FFF6FCFB', textArgb: 'FF374151' },
    otros:        { label: 'OTROS', headerArgb: 'FFE7EAF0', subArgb: 'FFF1F3F6', accentArgb: 'FFFAFBFC', textArgb: 'FF374151' },
};
const getTipoMeta = (tipo: string) => TIPO_META[tipo] || TIPO_META['otros'];

// Orden canónico de tipos
const TIPOS_ORDEN = ['mano_de_obra', 'materiales', 'equipos', 'subcontratos', 'subpartidas', 'otros'];
const SHEET_START_COL = 2;
const actualCol = (logicalCol: number): number => SHEET_START_COL + logicalCol - 1;
const actualLastCol = (logicalTotalCols: number): number => actualCol(logicalTotalCols);
const MONTH_BANDS = ['FFE8F1FA', 'FFFFF3D8', 'FFEAF4EA', 'FFFFE6D5', 'FFFFF0B8', 'FFDCE8F8', 'FFE2F0D9', 'FFE5E7EB'];
const getMonthBand = (index: number): string => MONTH_BANDS[index % MONTH_BANDS.length];


const mkFont = (opts: Partial<ExcelJS.Font>): Partial<ExcelJS.Font> => ({
    name: 'Calibri', size: 11, ...opts,
});
const mkFill = (argb: string): ExcelJS.Fill => ({
    type: 'pattern', pattern: 'solid', fgColor: { argb },
});
const mkBorder = (color = 'FFCBD5E1', style: ExcelJS.BorderStyle = 'thin'): Partial<ExcelJS.Borders> => ({
    top:    { style, color: { argb: color } },
    bottom: { style, color: { argb: color } },
    left:   { style, color: { argb: color } },
    right:  { style, color: { argb: color } },
});
const mkAlign = (
    horizontal: ExcelJS.Alignment['horizontal'] = 'center',
    vertical:   ExcelJS.Alignment['vertical']   = 'middle',
    wrap = false,
): Partial<ExcelJS.Alignment> => ({ horizontal, vertical, wrapText: wrap });

// Estilos reutilizables
const STYLES = {
    colHeader: (argb = 'FFE5E7EB', textArgb = 'FF1F2937'): Partial<ExcelJS.Style> => ({
        font:      mkFont({ bold: true, size: 8, color: { argb: textArgb } }),
        fill:      mkFill(argb),
        alignment: mkAlign('center', 'middle', true),
        border:    mkBorder('FF9CA3AF'),
    }),
    subHeader: (argb = 'FFF3F4F6'): Partial<ExcelJS.Style> => ({
        font:      mkFont({ bold: true, size: 7, color: { argb: 'FF374151' } }),
        fill:      mkFill(argb),
        alignment: mkAlign('center'),
        border:    mkBorder('FFB6C0CC'),
    }),
    bodyLeft: (): Partial<ExcelJS.Style> => ({
        font:      mkFont({ size: 8, color: { argb: 'FF111827' } }),
        alignment: mkAlign('left', 'middle', true),
        border:    mkBorder('FFB6C0CC'),
    }),
    bodyCenter: (): Partial<ExcelJS.Style> => ({
        font:      mkFont({ size: 8, color: { argb: 'FF111827' } }),
        alignment: mkAlign('center'),
        border:    mkBorder('FFB6C0CC'),
    }),
    number2: (): Partial<ExcelJS.Style> => ({
        font:      mkFont({ size: 8, color: { argb: 'FF111827' } }),
        numFmt:    '#,##0.00',
        alignment: mkAlign('right'),
        border:    mkBorder('FFB6C0CC'),
    }),
    number3: (): Partial<ExcelJS.Style> => ({
        font:      mkFont({ size: 8, color: { argb: 'FF111827' } }),
        numFmt:    '#,##0.000',
        alignment: mkAlign('right'),
        border:    mkBorder('FFB6C0CC'),
    }),
    sectionTotal: (bgArgb: string, textArgb = 'FF374151'): Partial<ExcelJS.Style> => ({
        font:      mkFont({ bold: true, size: 8, color: { argb: textArgb } }),
        fill:      mkFill(bgArgb),
        numFmt:    '#,##0.00',
        alignment: mkAlign('right'),
        border:    mkBorder('FF9CA3AF', 'thin'),
    }),
    grandTotal: (textArgb = 'FF111827'): Partial<ExcelJS.Style> => ({
        font:      mkFont({ bold: true, size: 8, color: { argb: textArgb } }),
        fill:      mkFill('FFE5E7EB'),
        numFmt:    '#,##0.00',
        alignment: mkAlign('right'),
        border:    mkBorder('FF6B7280', 'thin'),
    }),
    grandTotalLabel: (): Partial<ExcelJS.Style> => ({
        font:      mkFont({ bold: true, size: 8, color: { argb: 'FF111827' } }),
        fill:      mkFill('FFD1D5DB'),
        alignment: mkAlign('right'),
        border:    mkBorder('FF6B7280', 'thin'),
    }),
    pico: (): Partial<ExcelJS.Style> => ({
        font:      mkFont({ bold: true, size: 8, color: { argb: 'FF374151' } }),
        fill:      mkFill('FFFFF0B8'),
        numFmt:    '#,##0.00',
        alignment: mkAlign('right'),
        border:    mkBorder('FFB6C0CC'),
    }),
    picoCant: (): Partial<ExcelJS.Style> => ({
        font:      mkFont({ bold: true, size: 8, color: { argb: 'FF374151' } }),
        fill:      mkFill('FFFFF0B8'),
        numFmt:    '#,##0.000',
        alignment: mkAlign('right'),
        border:    mkBorder('FFB6C0CC'),
    }),
    pct: (): Partial<ExcelJS.Style> => ({
        font:      mkFont({ bold: true, size: 8, color: { argb: 'FF374151' } }),
        fill:      mkFill('FFF3F4F6'),
        numFmt:    '0.00"%"',
        alignment: mkAlign('center'),
        border:    mkBorder('FFB6C0CC'),
    }),
    empty: (bgArgb = 'FFFFFFFF'): Partial<ExcelJS.Style> => ({
        fill:   mkFill(bgArgb),
        border: mkBorder('FFB6C0CC'),
    }),
};


// UTILIDADES
const fmtNum = (v: number, dec = 2) =>
    v.toLocaleString('es-PE', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const getMonto    = (m: MaterialItem, key: string) => m.distribucion[key]?.monto    || 0;
const getCantidad = (m: MaterialItem, key: string) => m.distribucion[key]?.cantidad || 0;

const setupCronogramaColumns = (ws: ExcelJS.Worksheet, periodos: Periodo[], colFixed: number): void => {
    ws.getColumn(1).width = 3;
    ws.getColumn(actualCol(1)).width = 5;
    ws.getColumn(actualCol(2)).width = 14;
    ws.getColumn(actualCol(3)).width = 13;
    ws.getColumn(actualCol(4)).width = 42;
    ws.getColumn(actualCol(5)).width = 8;
    ws.getColumn(actualCol(6)).width = 11;

    for (let i = 0; i < periodos.length; i++) {
        ws.getColumn(actualCol(colFixed + 1 + i * 2)).width = 10;
        ws.getColumn(actualCol(colFixed + 2 + i * 2)).width = 11;
    }

    ws.getColumn(actualCol(colFixed + periodos.length * 2 + 1)).width = 12;
    ws.getColumn(actualCol(colFixed + periodos.length * 2 + 2)).width = 13;
};

const toExcelText = (value: unknown, fallback = ''): string => {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        return toExcelText(record.nombre ?? record.name ?? record.label ?? record.descripcion, fallback);
    }
    return fallback;
};

/** Agrupa materiales por campo `tipo` manteniendo el orden canónico */
const agruparPorTipo = (materiales: MaterialItem[]): Map<string, MaterialItem[]> => {
    const mapa = new Map<string, MaterialItem[]>();
    TIPOS_ORDEN.forEach(t => mapa.set(t, []));
    materiales.forEach(m => {
        const t = m.tipo || 'otros';
        if (!mapa.has(t)) mapa.set(t, []);
        mapa.get(t)!.push(m);
    });
    mapa.forEach((v, k) => { if (v.length === 0) mapa.delete(k); });
    return mapa;
};

// HELPER: extrae el código modular desde projectData.codigos_modulares
const extraerCodigoModular = (projectData: any): string => {
    try {
        const raw = projectData.codigos_modulares ?? projectData.codigo_modular;
        if (!raw) return '-';
        const modulares = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const partes: string[] = [];
        if (modulares.inicial)    partes.push(modulares.inicial);
        if (modulares.primaria)   partes.push(modulares.primaria);
        if (modulares.secundaria) partes.push(modulares.secundaria);
        return partes.length > 0 ? partes.join('-') : '-';
    } catch {
        return projectData.codigos_modulares || projectData.codigo_modular || '-';
    }
};

// HELPER: calcula duración del proyecto en días calendario
const calcularDuracion = (projectData: any): string => {
    try {
        if (!projectData.fecha_inicio || !projectData.fecha_fin) return '';
        const inicio = new Date(projectData.fecha_inicio);
        const fin    = new Date(projectData.fecha_fin);
        const dias   = Math.round((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
        return dias > 0 ? `${dias} DÍAS CALENDARIO` : '';
    } catch {
        return '';
    }
};

// HELPER: descarga una imagen desde storage de Laravel y devuelve ArrayBuffer
const fetchImageBuffer = async (
    relativePath: string,
): Promise<{ buffer: ArrayBuffer; extension: 'png' | 'jpeg' | 'gif' | 'bmp' } | null> => {
    try {
        if (!relativePath) return null;
        const base = (window as any).__STORAGE_URL__
            || (import.meta as any).env?.VITE_STORAGE_URL
            || '/storage';
        // Evitar doble barra
        const url = base.replace(/\/$/, '') + '/' + relativePath.replace(/^\//, '');
        const res = await fetch(url);
        if (!res.ok) return null;
        const buffer = await res.arrayBuffer();
        const lower = relativePath.toLowerCase();
        const extension: 'png' | 'jpeg' | 'gif' | 'bmp' =
            lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'jpeg' :
            lower.endsWith('.gif')  ? 'gif'  :
            lower.endsWith('.bmp')  ? 'bmp'  : 'png';
        return { buffer, extension };
    } catch {
        return null;
    }
};

const addImageToSheet = (
    ws:      ExcelJS.Worksheet,
    imgData: { buffer: ArrayBuffer; extension: string }, // Cambiado a string para admitir cualquier extensión
    colIni:  number,   // columna Excel real (1-based), inclusivo
    rowIni:  number,   // fila Excel real (1-based), inclusivo
    colFin:  number,   // columna Excel real (1-based), exclusivo (br)
    rowFin:  number,   // fila Excel real (1-based), exclusivo (br)
): void => {
    // ExcelJS acepta Uint8Array directamente — sin Buffer de Node
    const uint8 = new Uint8Array(imgData.buffer);
    
    // Forzamos la extensión con "as any" para evitar que rechace 'bmp' o strings genéricos
    const imgId = ws.workbook.addImage({
        buffer:    uint8 as any,
        extension: imgData.extension as any,
    });
    
    // Corregimos los objetos 'tl' y 'br' mapeando los valores nativos que exige TypeScript
    ws.addImage(imgId, {
        tl: { 
            col: colIni - 1, 
            row: rowIni - 1,
            nativeCol: colIni - 1,
            nativeRow: rowIni - 1,
            nativeColOff: 0,
            nativeRowOff: 0
        } as any, // 0-based inclusivo
        br: { 
            col: colFin - 1, 
            row: rowFin - 1,
            nativeCol: colFin - 1,
            nativeRow: rowFin - 1,
            nativeColOff: 0,
            nativeRowOff: 0
        } as any, // 0-based exclusivo
        editAs: 'oneCell',
    });
};

async function buildReportHeader(
    ws: ExcelJS.Worksheet,
    projectData: any,
    tipoLabel: string,
    viewMode: ViewMode,
    totalCols: number,
): Promise<number> {
    const workbook = ws.workbook;
    const projectName = projectData?.nombre || 'SIN NOMBRE';

    const logoIzq = projectData?.plantilla_logo_izq_url || projectData?.plantilla_logo_izq;
    const logoDer = projectData?.plantilla_logo_der_url || projectData?.plantilla_logo_der;

    const modular = typeof projectData?.codigos_modulares === 'string'
        ? projectData.codigos_modulares
        : (projectData?.codigos_modulares?.nombre ?? projectData?.codigos_modulares?.code ?? '-');
    const codigoLocal = projectData?.codigo_local || '-';
    const cui = projectData?.codigo_cui || '-';
    const unidadEjecutora = projectData?.unidad_ejecutora || '-';
    const propietario = projectData?.propietario || unidadEjecutora || '-';
    const nombreProyecto = projectName.toUpperCase();

    const SHEET_START_COL_LOCAL = 2;
    const xc = (lc: number) => SHEET_START_COL_LOCAL + lc - 1;
    const colInicio = xc(1);
    const colFin = xc(totalCols);

    let filaActual = 1;

    ws.getColumn(colInicio).width = 9;
    ws.getColumn(colInicio + 1).width = 9;
    if (totalCols > 2) {
        ws.getColumn(colFin - 1).width = 9;
        ws.getColumn(colFin).width = 9;
    }

    for (let r = filaActual; r <= filaActual + 3; r++) {
        ws.getRow(r).height = 22;
    }

    const f1 = filaActual;

    // Logo izquierdo
    if (totalCols >= 2) {
        ws.mergeCells(f1, colInicio, f1 + 3, colInicio + 1);
        const cell = ws.getCell(f1, colInicio);
        cell.value = '';
        cell.border = {
            top: { style: 'medium' }, bottom: { style: 'medium' },
            left: { style: 'medium' }, right: { style: 'thin' },
        };
    }

    // Texto central
    if (totalCols >= 3) {
        const colCentralInicio = colInicio + 2;
        const colCentralFin = colFin - 2;
        ws.mergeCells(f1, colCentralInicio, f1 + 3, colCentralFin);
        const cell = ws.getCell(f1, colCentralInicio);
        cell.value = {
            richText: [
                { font: { bold: true, size: 11, name: 'Calibri' }, text: `"${nombreProyecto}"\n` },
                { font: { bold: false, size: 9, name: 'Calibri' }, text: `CUI: ${cui}; CÓDIGO MODULAR: ${modular}; CÓDIGO LOCAL: ${codigoLocal}\n` },
                { font: { bold: false, size: 9, name: 'Calibri' }, text: `I.E. ${nombreProyecto}; UNIDAD EJECUTORA: ${unidadEjecutora}` },
            ],
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = {
            top: { style: 'medium' }, bottom: { style: 'medium' },
            left: { style: 'thin' }, right: { style: 'thin' },
        };
    }

    // Logo derecho
    if (totalCols >= 2) {
        ws.mergeCells(f1, colFin - 1, f1 + 3, colFin);
        const cell = ws.getCell(f1, colFin - 1);
        cell.value = '';
        cell.border = {
            top: { style: 'medium' }, bottom: { style: 'medium' },
            left: { style: 'thin' }, right: { style: 'medium' },
        };
    }

    // Agregar logo izquierdo
    const blobToBase64 = (blob: Blob): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

    const detectExt = (url: string, blob: Blob): 'png' | 'jpeg' | 'gif' => {
        if (blob.type === 'image/jpeg' || /\.jpe?g$/i.test(url)) return 'jpeg';
        if (blob.type === 'image/gif' || /\.gif$/i.test(url)) return 'gif';
        return 'png';
    };

    if (logoIzq && typeof logoIzq === 'string' && logoIzq.trim() !== '') {
        try {
            if (logoIzq.startsWith('data:image')) {
                const base64Data = logoIzq.split(',')[1];
                const imgId = workbook.addImage({ base64: base64Data, extension: 'png' });
                ws.addImage(imgId, {
                    tl: { col: colInicio - 1 + 0.15, row: f1 - 1 + 0.15 } as any,
                    br: { col: colInicio - 1 + 1.85, row: f1 - 1 + 3.85 } as any,
                    editAs: 'oneCell',
                } as any);
            } else {
                const url = logoIzq.startsWith('http') ? logoIzq : `/storage/${logoIzq.replace(/^\//, '')}`;
                const response = await fetch(url);
                if (response.ok) {
                    const blob = await response.blob();
                    const base64 = await blobToBase64(blob);
                    const ext = detectExt(logoIzq, blob);
                    const imgId = workbook.addImage({ base64, extension: ext });
                    ws.addImage(imgId, {
                        tl: { col: colInicio - 1 + 0.15, row: f1 - 1 + 0.15 } as any,
                        br: { col: colInicio - 1 + 1.85, row: f1 - 1 + 3.85 } as any,
                        editAs: 'oneCell',
                    } as any);
                }
            }
        } catch (e) { console.error('Error logo izq:', e); }
    }

    // Agregar logo derecho
    if (logoDer && typeof logoDer === 'string' && logoDer.trim() !== '') {
        try {
            if (logoDer.startsWith('data:image')) {
                const base64Data = logoDer.split(',')[1];
                const imgId = workbook.addImage({ base64: base64Data, extension: 'png' });
                ws.addImage(imgId, {
                    tl: { col: colFin - 1 - 1 + 0.15, row: f1 - 1 + 0.15 } as any,
                    br: { col: colFin - 1 + 0.85, row: f1 - 1 + 3.85 } as any,
                    editAs: 'oneCell',
                } as any);
            } else {
                const url = logoDer.startsWith('http') ? logoDer : `/storage/${logoDer.replace(/^\//, '')}`;
                const response = await fetch(url);
                if (response.ok) {
                    const blob = await response.blob();
                    const base64 = await blobToBase64(blob);
                    const ext = detectExt(logoDer, blob);
                    const imgId = workbook.addImage({ base64, extension: ext });
                    ws.addImage(imgId, {
                        tl: { col: colFin - 1 - 1 + 0.15, row: f1 - 1 + 0.15 } as any,
                        br: { col: colFin - 1 + 0.85, row: f1 - 1 + 3.85 } as any,
                        editAs: 'oneCell',
                    } as any);
                }
            }
        } catch (e) { console.error('Error logo der:', e); }
    }

    filaActual = f1 + 4;
    filaActual++;

    // Título
    ws.mergeCells(filaActual, colInicio, filaActual, colFin);
    const cellTitulo = ws.getCell(filaActual, colInicio);
    cellTitulo.value = tipoLabel;
    cellTitulo.font = { bold: true, size: 11, name: 'Calibri', color: { argb: 'FF1A3C5E' } };
    cellTitulo.alignment = { horizontal: 'center', vertical: 'middle' };
    cellTitulo.border = {
        top: { style: 'medium' }, bottom: { style: 'medium' },
        left: { style: 'medium' }, right: { style: 'medium' },
    };
    ws.getRow(filaActual).height = 24;
    filaActual++;
    filaActual++;

    // Bloque datos del proyecto
    const meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    const hoy = new Date();
    const fechaFormateada = `${meses[hoy.getMonth()]} ${hoy.getFullYear()}`;

    const inicioFila = filaActual;
    const lineasContenido = [
        `Proyecto : ${nombreProyecto}`,
        `Propietario : ${propietario}`,
        `Fecha : ${fechaFormateada}`,
        `Módulo : ${projectData?.modulo || 'GENERAL'}`,
        `Hecho por : ${projectData?.hechoPor || ''}          Revisado por : ${projectData?.revisadoPor || ''}`,
    ];

    const filaFin = inicioFila + lineasContenido.length - 1;
    ws.mergeCells(inicioFila, colInicio, filaFin, colFin);

    const cellBloque = ws.getCell(inicioFila, colInicio);
    cellBloque.value = lineasContenido.join('\n');
    cellBloque.font = { size: 9, name: 'Calibri' };
    cellBloque.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
    cellBloque.border = {
        top: { style: 'medium', color: { argb: 'FF000000' } },
        bottom: { style: 'medium', color: { argb: 'FF000000' } },
        left: { style: 'medium', color: { argb: 'FF000000' } },
        right: { style: 'medium', color: { argb: 'FF000000' } },
    };

    filaActual = filaFin + 1;
    filaActual++;
    ws.getRow(filaActual).height = 5;
    filaActual++;

    return filaActual;
}

function buildColumnHeaders(
    ws:          ExcelJS.Worksheet,
    periodos:    Periodo[],
    viewMode:    ViewMode,
    mesPicoKey:  string,
    startRow:    number,
    colFixed:    number,
): void {
    const ROW1 = startRow;
    const ROW2 = startRow + 1;
    ws.getRow(ROW1).height = 22;
    ws.getRow(ROW2).height = 16;

    const FIXED_LABELS = ['#', 'TIPO', 'PARTIDA', 'DESCRIPCION', 'UNIDAD', 'P. UNIT.'];
    const TOTAL_LABELS = ['CANT. TOTAL', 'TOTAL S/.'];

    FIXED_LABELS.forEach((lbl, i) => {
        const col = actualCol(i + 1);
        ws.mergeCells(ROW1, col, ROW2, col);
        const cell = ws.getCell(ROW1, col);
        cell.value = lbl;
        cell.style = STYLES.colHeader('FFE5E7EB', 'FF1F2937');
    });

    let col = actualCol(colFixed + 1);
    periodos.forEach((p, periodIndex) => {
        const isPico = p.key === mesPicoKey;
        const band = isPico ? 'FFFFF0B8' : getMonthBand(periodIndex);

        ws.mergeCells(ROW1, col, ROW1, col + 1);
        const hCell = ws.getCell(ROW1, col);
        hCell.value = p.labelCal || p.label;
        hCell.style = {
            ...STYLES.colHeader(band, 'FF1F2937'),
            border: mkBorder(isPico ? 'FFD97706' : 'FF9CA3AF'),
        };

        ws.getCell(ROW2, col).value = 'Cantidad';
        ws.getCell(ROW2, col).style = STYLES.subHeader(band);
        ws.getCell(ROW2, col + 1).value = 'Parcial S/.';
        ws.getCell(ROW2, col + 1).style = STYLES.subHeader(band);

        col += 2;
    });

    TOTAL_LABELS.forEach((lbl, i) => {
        ws.mergeCells(ROW1, col + i, ROW2, col + i);
        const cell = ws.getCell(ROW1, col + i);
        cell.value = lbl;
        cell.style = STYLES.colHeader('FFD1D5DB', 'FF111827');
    });
}


function buildSectionHeader(
    ws:        ExcelJS.Worksheet,
    tipo:      string,
    count:     number,
    totalCols: number,
    rowNum:    number,
): void {
    const meta = getTipoMeta(tipo);
    ws.mergeCells(rowNum, actualCol(1), rowNum, actualLastCol(totalCols));
    const cell = ws.getCell(rowNum, actualCol(1));
    cell.value = `${meta.label} - ${count} insumo${count !== 1 ? 's' : ''}`;
    cell.style = {
        font:      mkFont({ bold: true, size: 8, color: { argb: meta.textArgb } }),
        fill:      mkFill(meta.headerArgb),
        alignment: mkAlign('left'),
        border:    mkBorder('FFB6C0CC'),
    };
    ws.getRow(rowNum).height = 18;
}


function buildDataRow(
    ws:         ExcelJS.Worksheet,
    material:   MaterialItem,
    idx:        number,
    periodos:   Periodo[],
    viewMode:   ViewMode,
    mesPicoKey: string,
    rowNum:     number,
    colFixed:   number,
    isAlt:      boolean,
): void {
    const altBg  = isAlt ? 'FFFAFBFC' : 'FFFFFFFF';
    const meta   = getTipoMeta(material.tipo || 'otros');
    const row    = ws.getRow(rowNum);
    row.height   = 16;

    const setCell = (logicalCol: number, value: ExcelJS.CellValue, style: Partial<ExcelJS.Style>) => {
        const c = ws.getCell(rowNum, actualCol(logicalCol));
        c.value = value;
        c.style = { ...style, fill: style.fill ?? mkFill(altBg) };
    };

    const unidadSegura      = toExcelText(material.unidad, 'UND').toUpperCase();
    const descripcionSegura = toExcelText(material.descripcion, 'SIN DESCRIPCION');
    const partidasSeguras   = toExcelText(material.partida_origen, '-');

    setCell(1, idx + 1, { ...STYLES.bodyCenter(), font: mkFont({ size: 8, color: { argb: 'FF6B7280' } }) });
    setCell(2, meta.label, { ...STYLES.bodyCenter(), font: mkFont({ bold: true, size: 8, color: { argb: 'FF374151' } }), fill: mkFill(meta.accentArgb) });
    setCell(3, partidasSeguras, { ...STYLES.bodyCenter(), font: mkFont({ size: 8, color: { argb: 'FF374151' }, bold: true }) });
    setCell(4, descripcionSegura, { ...STYLES.bodyLeft(), font: mkFont({ size: 8 }) });
    setCell(5, unidadSegura, { ...STYLES.bodyCenter(), font: mkFont({ size: 8, bold: true, color: { argb: 'FF475569' } }) });
    setCell(6, material.precio, { ...STYLES.number2(), font: mkFont({ size: 8, color: { argb: 'FF374151' } }) });

    let col = actualCol(colFixed + 1);
    periodos.forEach((p, periodIndex) => {
        const isPico    = p.key === mesPicoKey;
        const bandBg    = isPico ? 'FFFFF0B8' : getMonthBand(periodIndex);
        const cantidad  = getCantidad(material, p.key);
        const monto     = getMonto(material, p.key);

        const cCell = ws.getCell(rowNum, col);
        cCell.value = cantidad > 0 ? cantidad : null;
        cCell.style = isPico && cantidad > 0
            ? STYLES.picoCant()
            : { ...STYLES.number3(), fill: mkFill(bandBg) };

        const mCell = ws.getCell(rowNum, col + 1);
        mCell.value = monto > 0 ? monto : null;
        mCell.style = isPico && monto > 0
            ? STYLES.pico()
            : { ...STYLES.number2(), fill: mkFill(bandBg) };

        col += 2;
    });

    const totCantCell = ws.getCell(rowNum, col);
    totCantCell.value = material.cantidad_total;
    totCantCell.style = { ...STYLES.number3(), font: mkFont({ bold: true, size: 8 }), fill: mkFill('FFF3F4F6') };

    const totCostCell = ws.getCell(rowNum, col + 1);
    totCostCell.value = material.costo_total;
    totCostCell.style = {
        ...STYLES.number2(),
        font: mkFont({ bold: true, size: 8, color: { argb: 'FF374151' } }),
        fill: mkFill('FFF3F4F6'),
    };
}


function buildSubtotalRow(
    ws:         ExcelJS.Worksheet,
    tipo:       string,
    items:      MaterialItem[],
    periodos:   Periodo[],
    mesPicoKey: string,
    rowNum:     number,
    colFixed:   number,
    totalCols:  number,
): void {
    const meta = getTipoMeta(tipo);
    ws.getRow(rowNum).height = 18;

    ws.mergeCells(rowNum, actualCol(1), rowNum, actualCol(colFixed));
    const lbl = ws.getCell(rowNum, actualCol(1));
    lbl.value = `SUBTOTAL ${meta.label} (${items.length})`;
    lbl.style = {
        font:      mkFont({ bold: true, size: 8, color: { argb: 'FF374151' } }),
        fill:      mkFill(meta.subArgb),
        alignment: mkAlign('right'),
        border:    mkBorder('FF9CA3AF'),
    };

    let col = actualCol(colFixed + 1);
    periodos.forEach((p, periodIndex) => {
        const isPico     = p.key === mesPicoKey;
        const totalCant  = items.reduce((s, m) => s + getCantidad(m, p.key), 0);
        const totalMonto = items.reduce((s, m) => s + getMonto(m, p.key), 0);
        const bgArgb     = isPico ? 'FFFFF0B8' : getMonthBand(periodIndex);

        const cc = ws.getCell(rowNum, col);
        cc.value = totalCant > 0 ? totalCant : null;
        cc.style = { ...STYLES.sectionTotal(bgArgb, 'FF374151'), numFmt: '#,##0.000' };

        const mc = ws.getCell(rowNum, col + 1);
        mc.value = totalMonto > 0 ? totalMonto : null;
        mc.style = STYLES.sectionTotal(bgArgb, 'FF374151');

        col += 2;
    });

    const totCant  = items.reduce((s, m) => s + m.cantidad_total, 0);
    const totCosto = items.reduce((s, m) => s + m.costo_total, 0);

    ws.getCell(rowNum, col).value     = totCant;
    ws.getCell(rowNum, col).style     = { ...STYLES.sectionTotal('FFF3F4F6', 'FF374151'), numFmt: '#,##0.000' };
    ws.getCell(rowNum, col + 1).value = totCosto;
    ws.getCell(rowNum, col + 1).style = STYLES.sectionTotal('FFF3F4F6', 'FF374151');
}

function buildGrandTotalRow(
    ws:         ExcelJS.Worksheet,
    materiales: MaterialItem[],
    periodos:   Periodo[],
    mesPicoKey: string,
    rowNum:     number,
    colFixed:   number,
): void {
    ws.getRow(rowNum).height = 20;

    ws.mergeCells(rowNum, actualCol(1), rowNum, actualCol(colFixed));
    const lbl = ws.getCell(rowNum, actualCol(1));
    lbl.value = `TOTAL GENERAL - ${materiales.length} insumos`;
    lbl.style = STYLES.grandTotalLabel();

    let col = actualCol(colFixed + 1);
    periodos.forEach((p, periodIndex) => {
        const isPico     = p.key === mesPicoKey;
        const totalCant  = materiales.reduce((s, m) => s + getCantidad(m, p.key), 0);
        const totalMonto = materiales.reduce((s, m) => s + getMonto(m, p.key), 0);
        const bgArgb     = isPico ? 'FFFFF0B8' : getMonthBand(periodIndex);

        const cc = ws.getCell(rowNum, col);
        cc.value = totalCant > 0 ? totalCant : null;
        cc.style = { ...STYLES.grandTotal('FF111827'), fill: mkFill(bgArgb), numFmt: '#,##0.000' };

        const mc = ws.getCell(rowNum, col + 1);
        mc.value = totalMonto > 0 ? totalMonto : null;
        mc.style = { ...STYLES.grandTotal('FF111827'), fill: mkFill(bgArgb) };

        col += 2;
    });

    const gtCant  = materiales.reduce((s, m) => s + m.cantidad_total, 0);
    const gtCosto = materiales.reduce((s, m) => s + m.costo_total, 0);

    ws.getCell(rowNum, col).value     = gtCant;
    ws.getCell(rowNum, col).style     = { ...STYLES.grandTotal('FF111827'), numFmt: '#,##0.000' };
    ws.getCell(rowNum, col + 1).value = gtCosto;
    ws.getCell(rowNum, col + 1).style = STYLES.grandTotal('FF111827');
}


function buildPctRow(
    ws:         ExcelJS.Worksheet,
    materiales: MaterialItem[],
    periodos:   Periodo[],
    mesPicoKey: string,
    rowNum:     number,
    colFixed:   number,
): void {
    ws.getRow(rowNum).height = 16;

    const totalMensual = periodos.reduce((s, p) =>
        s + materiales.reduce((ss, m) => ss + getMonto(m, p.key), 0), 0);

    ws.mergeCells(rowNum, actualCol(1), rowNum, actualCol(colFixed));
    const lbl = ws.getCell(rowNum, actualCol(1));
    lbl.value = '% DISTRIBUCION MENSUAL';
    lbl.style = {
        font:      mkFont({ bold: true, size: 8, color: { argb: 'FF64748B' } }),
        fill:      mkFill('FFF8FAFC'),
        alignment: mkAlign('right'),
        border:    mkBorder('FFB6C0CC'),
    };

    let col = actualCol(colFixed + 1);
    periodos.forEach((p, periodIndex) => {
        const isPico   = p.key === mesPicoKey;
        const montoMes = materiales.reduce((s, m) => s + getMonto(m, p.key), 0);
        const pct      = totalMensual > 0 ? (montoMes / totalMensual) * 100 : 0;
        const bgArgb   = isPico ? 'FFFFF0B8' : getMonthBand(periodIndex);

        const cc = ws.getCell(rowNum, col);
        cc.value = null;
        cc.style = STYLES.empty(bgArgb);

        const mc = ws.getCell(rowNum, col + 1);
        mc.value = pct > 0 ? pct : null;
        mc.style = { ...STYLES.pct(), fill: mkFill(bgArgb) };

        col += 2;
    });

    ws.getCell(rowNum, col).value = null;
    ws.getCell(rowNum, col).style = STYLES.empty('FFF3F4F6');
    ws.getCell(rowNum, col + 1).value = 100;
    ws.getCell(rowNum, col + 1).style = { ...STYLES.pct(), fill: mkFill('FFF3F4F6') };
}

function buildResumenSheet(
    wb:          ExcelJS.Workbook,
    materiales:  MaterialItem[],
    periodos:    Periodo[],
    projectData: any,
    tipoLabel:   string,
    mesPicoKey:  string,
): void {
    const ws = wb.addWorksheet('Resumen', {
        properties: { tabColor: { argb: 'FFE5E7EB' } },
    });

    ws.getColumn(1).width = 3;
    ws.getColumn(actualCol(1)).width = 34;
    ws.getColumn(actualCol(2)).width = 18;
    ws.getColumn(actualCol(3)).width = 16;

    const projectName = projectData?.nombre || 'SIN NOMBRE';

    ws.mergeCells(1, actualCol(1), 1, actualCol(3));
    ws.getCell(1, actualCol(1)).value = 'RESUMEN EJECUTIVO';
    ws.getCell(1, actualCol(1)).style = {
        font:      mkFont({ bold: true, size: 13, color: { argb: 'FF374151' } }),
        fill:      mkFill('FFF8FAFC'),
        alignment: mkAlign('left'),
        border:    mkBorder('FFCBD5E1'),
    };
    ws.getRow(1).height = 24;

    ws.mergeCells(2, actualCol(1), 2, actualCol(3));
    ws.getCell(2, actualCol(1)).value = projectName;
    ws.getCell(2, actualCol(1)).style = { font: mkFont({ size: 10, italic: true, color: { argb: 'FF64748B' } }), alignment: mkAlign('left') };

    ws.mergeCells(3, actualCol(1), 3, actualCol(3));
    ws.getCell(3, actualCol(1)).value = `Filtro activo: ${tipoLabel}`;
    ws.getCell(3, actualCol(1)).style = { font: mkFont({ size: 8, color: { argb: 'FF64748B' } }), alignment: mkAlign('left') };

    ws.getRow(4).height = 6;

    const totalGeneral = materiales.reduce((s, m) => s + m.costo_total, 0);
    const montoPorMes  = periodos.map(p => ({
        label: p.labelCal || p.label,
        key:   p.key,
        monto: materiales.reduce((s, m) => s + getMonto(m, p.key), 0),
    }));
    const mesPico     = montoPorMes.find(m => m.key === mesPicoKey);
    const montoPico   = mesPico?.monto || 0;
    const mesPromedio = montoPorMes.reduce((s, m) => s + m.monto, 0) / (periodos.length || 1);

    const grupos = agruparPorTipo(materiales);
    const resumenTipos: { tipo: string; count: number; costo: number }[] = [];
    grupos.forEach((items, tipo) => {
        resumenTipos.push({
            tipo,
            count: items.length,
            costo: items.reduce((s, m) => s + m.costo_total, 0),
        });
    });

    const datos: Array<[string, ExcelJS.CellValue, string?]> = [
        ['Total de insumos', materiales.length],
        ['Duración del proyecto', `${periodos.length} mes${periodos.length !== 1 ? 'es' : ''}`],
        ['Código CUI', projectData?.codigo_cui || '-'],
        ['Código Modular', extraerCodigoModular(projectData)],
        ['Presupuesto total', totalGeneral, '#,##0.00'],
        ['Promedio mensual', mesPromedio, '#,##0.00'],
        ['Mes de mayor consumo', mesPico?.label || '-'],
        ['Monto del mes pico', montoPico, '#,##0.00'],
        ['Tipos de insumo presentes', grupos.size],
    ];

    let r = 5;
    const hLabel = ws.getCell(r, actualCol(1)); hLabel.value = 'INDICADOR'; hLabel.style = STYLES.colHeader('FFE5E7EB');
    const hVal   = ws.getCell(r, actualCol(2)); hVal.value   = 'VALOR';     hVal.style   = STYLES.colHeader('FFE5E7EB');
    ws.getRow(r).height = 18;
    r++;

    datos.forEach(([label, value, fmt], i) => {
        const bg = i % 2 === 0 ? 'FFFFFFFF' : 'FFFAFBFC';
        const lCell = ws.getCell(r, actualCol(1));
        const vCell = ws.getCell(r, actualCol(2));
        lCell.value = label;
        lCell.style = { ...STYLES.bodyLeft(), font: mkFont({ bold: true, size: 8 }), fill: mkFill(bg) };
        vCell.value = value;
        vCell.style = fmt
            ? { ...STYLES.number2(), numFmt: fmt, fill: mkFill(bg) }
            : { ...STYLES.bodyLeft(), fill: mkFill(bg) };
        ws.getRow(r).height = 16;
        r++;
    });

    r++;

    if (resumenTipos.length > 1) {
        ws.mergeCells(r, actualCol(1), r, actualCol(3));
        const th = ws.getCell(r, actualCol(1));
        th.value = 'DESGLOSE POR TIPO DE INSUMO';
        th.style = STYLES.colHeader('FFE5E7EB');
        ws.getRow(r).height = 18;
        r++;

        const sh1 = ws.getCell(r, actualCol(1)); sh1.value = 'TIPO';      sh1.style = STYLES.colHeader('FFF3F4F6');
        const sh2 = ws.getCell(r, actualCol(2)); sh2.value = 'INSUMOS';   sh2.style = STYLES.colHeader('FFF3F4F6');
        const sh3 = ws.getCell(r, actualCol(3)); sh3.value = 'COSTO S/.'; sh3.style = STYLES.colHeader('FFF3F4F6');
        ws.getRow(r).height = 16;
        r++;

        resumenTipos.forEach((rt, i) => {
            const meta  = getTipoMeta(rt.tipo);
            const bg    = i % 2 === 0 ? 'FFFFFFFF' : 'FFFAFBFC';

            ws.getCell(r, actualCol(1)).value = meta.label;
            ws.getCell(r, actualCol(1)).style = {
                font: mkFont({ bold: true, size: 8, color: { argb: 'FF374151' } }),
                fill: mkFill(meta.accentArgb || bg),
                alignment: mkAlign('left'),
                border: mkBorder('FFB6C0CC'),
            };
            ws.getCell(r, actualCol(2)).value = rt.count;
            ws.getCell(r, actualCol(2)).style = { ...STYLES.bodyCenter(), fill: mkFill(bg) };
            ws.getCell(r, actualCol(3)).value = rt.costo;
            ws.getCell(r, actualCol(3)).style = { ...STYLES.number2(), fill: mkFill(bg) };
            ws.getRow(r).height = 16;
            r++;
        });

        ws.getCell(r, actualCol(1)).value = 'TOTAL';
        ws.getCell(r, actualCol(1)).style = STYLES.grandTotalLabel();
        ws.getCell(r, actualCol(2)).value = materiales.length;
        ws.getCell(r, actualCol(2)).style = { ...STYLES.grandTotal('FF111827'), numFmt: '0' };
        ws.getCell(r, actualCol(3)).value = totalGeneral;
        ws.getCell(r, actualCol(3)).style = STYLES.grandTotal('FF111827');
        ws.getRow(r).height = 18;
    }
}

// FUNCIÓN PRINCIPAL EXPORTADORA
/**
 * Exporta el cronograma de materiales a Excel.
 *
 * @param materiales        Lista de insumos YA filtrada por el componente padre
 * @param periodos          Períodos del proyecto
 * @param projectName       Nombre del proyecto (string de compatibilidad)
 * @param viewMode          'cantidad' | 'monto'
 * @param tipoFiltroActivo  Filtro activo (undefined/'' → todo, o 'mano_de_obra' etc.)
 * @param projectData       Objeto COMPLETO de costo_projects (con codigo_cui,
 *                          codigos_modulares, departamento_id, etc.)
 */

export const exportarMaterialesExcel = async (
    materiales:        MaterialItem[],
    periodos:          Periodo[],
    projectName:       string,
    viewMode:          ViewMode,
    tipoFiltroActivo?: string,
    projectData?:      any,   // objeto completo de costo_projects
): Promise<void> => {
    if (!materiales.length || !periodos.length) {
        console.warn('[exportHelpers] No hay datos para exportar');
        return;
    }

    // Unificar projectData: si solo llega projectName, construimos un objeto mínimo
    const pd = projectData ?? { nombre: projectName };

    // ── Meta del filtro activo 
    const filtroEsTodo = !tipoFiltroActivo;
    const tipoLabel    = filtroEsTodo
        ? 'INSUMOS GENERALES'
        : getTipoMeta(tipoFiltroActivo).label;

    // ── Mes pico 
    const montoPorMes = periodos.map(p => ({
        key:   p.key,
        monto: materiales.reduce((s, m) => s + getMonto(m, p.key), 0),
    }));
    const mesPicoKey = montoPorMes.reduce(
        (best, curr) => curr.monto > best.monto ? curr : best,
        montoPorMes[0],
    ).key;

    // ── Dimensiones 
    const COL_FIXED  = 6;
    const TOTAL_COLS = COL_FIXED + periodos.length * 2 + 2;

    // ── Crear workbook 
    const wb = new ExcelJS.Workbook();
    wb.creator        = 'PCL – Cronograma Materiales';
    wb.lastModifiedBy = 'PCL';
    wb.created        = new Date();
    wb.modified       = new Date();
    wb.calcProperties.fullCalcOnLoad = true;

    // HOJA PRINCIPAL
    const sheetName = filtroEsTodo ? 'Cronograma General' : tipoLabel;
    const ws = wb.addWorksheet(sheetName, {
        pageSetup: {
            orientation:  'landscape',
            fitToPage:    true,
            fitToWidth:   1,
            fitToHeight:  0,
            paperSize:    9,
            margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.2, footer: 0.2 },
        },
        headerFooter: {
            oddHeader: `&L&B${pd.nombre || projectName}&C&BTipo: ${tipoLabel}&R&BPágina &P de &N`,
            oddFooter: `&LGenerado: ${new Date().toLocaleString('es-PE')}&RPor: PCL`,
        },
        properties: {
            tabColor: { argb: filtroEsTodo ? 'FFE5E7EB' : getTipoMeta(tipoFiltroActivo!).headerArgb },
        },
    });

    setupCronogramaColumns(ws, periodos, COL_FIXED);

    // ── Encabezado reporte — async (carga logos si los hay) 
    const firstDataRow = await buildReportHeader(ws, pd, tipoLabel, viewMode, TOTAL_COLS);

    // ── Encabezados de columna (2 filas: firstDataRow y firstDataRow+1) 
    buildColumnHeaders(ws, periodos, viewMode, mesPicoKey, firstDataRow, COL_FIXED);

    // ── Datos (desde firstDataRow+2) 
    let currentRow = firstDataRow + 2;

    materiales.forEach((mat, i) => {
        buildDataRow(ws, mat, i, periodos, viewMode, mesPicoKey, currentRow, COL_FIXED, i % 2 !== 0);
        currentRow++;
    });

    // ── Fila de porcentajes 
    buildPctRow(ws, materiales, periodos, mesPicoKey, currentRow, COL_FIXED);
    currentRow++;

    // ── Totales generales 
    buildGrandTotalRow(ws, materiales, periodos, mesPicoKey, currentRow, COL_FIXED);
    currentRow++;

    // HOJA DE RESUMEN EJECUTIVO
    buildResumenSheet(wb, materiales, periodos, pd, tipoLabel, mesPicoKey);

    // SI ES "TODO": hojas adicionales por tipo (para navegación rápida)
    if (filtroEsTodo) {
        const grupos = agruparPorTipo(materiales);

        for (const [tipo, items] of grupos) {
            if (items.length === 0) continue;
            const meta = getTipoMeta(tipo);
            const wsT  = wb.addWorksheet(`${meta.label}`, {
                properties: { tabColor: { argb: meta.headerArgb } },
                pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
            });

            setupCronogramaColumns(wsT, periodos, COL_FIXED);

            // Encabezado async (logos en cada hoja)
            const fdr = await buildReportHeader(wsT, pd, meta.label, viewMode, TOTAL_COLS);
            buildColumnHeaders(wsT, periodos, viewMode, mesPicoKey, fdr, COL_FIXED);

            let r = fdr + 2;
            items.forEach((mat, i) => {
                buildDataRow(wsT, mat, i, periodos, viewMode, mesPicoKey, r, COL_FIXED, i % 2 !== 0);
                r++;
            });
            buildPctRow(wsT, items, periodos, mesPicoKey, r, COL_FIXED);
            r++;
            buildGrandTotalRow(wsT, items, periodos, mesPicoKey, r, COL_FIXED);
        }
    }
    // GENERAR Y DESCARGAR
    const buffer = await wb.xlsx.writeBuffer();
    const blob   = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const limpiarNombreArchivo = (txt: string, max = 32): string => {
        const limpio = String(txt || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9\s_-]/g, '')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '')
            .toUpperCase();

        return limpio.substring(0, max) || 'PROYECTO';
    };

    const fecha = new Date().toISOString().slice(0, 10);

    const codigoProyecto =
        pd?.codigo_cui ||
        pd?.codigo_local ||
        pd?.codigo_snip ||
        '';

    const codigoCorto = codigoProyecto
        ? `CUI_${limpiarNombreArchivo(String(codigoProyecto), 18)}`
        : limpiarNombreArchivo(pd?.nombre || projectName, 32);

    const sufijoCorto = filtroEsTodo
        ? 'GENERAL'
        : limpiarNombreArchivo(tipoLabel, 18);

    const nombre = `CM_${sufijoCorto}_${codigoCorto}_${fecha}.xlsx`;

    saveAs(blob, nombre);
};
