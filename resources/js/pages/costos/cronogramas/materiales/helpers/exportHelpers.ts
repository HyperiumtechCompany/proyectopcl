import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { MaterialItem, Periodo, ViewMode } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO DE TIPOS
// ─────────────────────────────────────────────────────────────────────────────
const TIPO_META: Record<string, {
    label: string;
    headerArgb: string;
    subArgb: string;
    accentArgb: string;
    textArgb: string;
}> = {
    mano_de_obra: { label: 'MANO DE OBRA', headerArgb: 'FFF3E2D2', subArgb: 'FFF9EEE6', accentArgb: 'FFFCF7F3', textArgb: 'FF374151' },
    materiales: { label: 'MATERIALES', headerArgb: 'FFDCEBFA', subArgb: 'FFEAF4FE', accentArgb: 'FFF5FAFF', textArgb: 'FF374151' },
    equipos: { label: 'EQUIPOS', headerArgb: 'FFE9E3F7', subArgb: 'FFF2EEFB', accentArgb: 'FFFAF8FE', textArgb: 'FF374151' },
    subcontratos: { label: 'SUBCONTRATOS', headerArgb: 'FFDFF2E6', subArgb: 'FFEEF8F1', accentArgb: 'FFF7FCF8', textArgb: 'FF374151' },
    subpartidas: { label: 'SUBPARTIDAS', headerArgb: 'FFDDF1EF', subArgb: 'FFECF8F7', accentArgb: 'FFF6FCFB', textArgb: 'FF374151' },
    otros: { label: 'OTROS', headerArgb: 'FFE7EAF0', subArgb: 'FFF1F3F6', accentArgb: 'FFFAFBFC', textArgb: 'FF374151' },
};

const getTipoMeta = (tipo: string) => TIPO_META[tipo] || TIPO_META['otros'];

const TIPOS_ORDEN = ['mano_de_obra', 'materiales', 'equipos', 'subcontratos', 'subpartidas', 'otros'];
const SHEET_START_COL = 2;
const actualCol = (logicalCol: number): number => SHEET_START_COL + logicalCol - 1;
const actualLastCol = (logicalTotalCols: number): number => actualCol(logicalTotalCols);

const MONTH_BANDS = ['FFE8F1FA', 'FFFFF3D8', 'FFEAF4EA', 'FFFFE6D5', 'FFFFF0B8', 'FFDCE8F8', 'FFE2F0D9', 'FFE5E7EB'];
const getMonthBand = (index: number): string => MONTH_BANDS[index % MONTH_BANDS.length];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE ESTILO EXCELJS
// ─────────────────────────────────────────────────────────────────────────────
const mkFont = (opts: Partial<ExcelJS.Font>): Partial<ExcelJS.Font> => ({
    name: 'Calibri', size: 11, ...opts,
});

const mkFill = (argb: string): ExcelJS.Fill => ({
    type: 'pattern', pattern: 'solid', fgColor: { argb },
});

const mkBorder = (color = 'FFCBD5E1', style: ExcelJS.BorderStyle = 'thin'): Partial<ExcelJS.Borders> => ({
    top: { style, color: { argb: color } },
    bottom: { style, color: { argb: color } },
    left: { style, color: { argb: color } },
    right: { style, color: { argb: color } },
});

const mkAlign = (
    horizontal: ExcelJS.Alignment['horizontal'] = 'center',
    vertical: ExcelJS.Alignment['vertical'] = 'middle',
    wrap = false,
): Partial<ExcelJS.Alignment> => ({ horizontal, vertical, wrapText: wrap });

// ─────────────────────────────────────────────────────────────────────────────
// ESTILOS REUTILIZABLES
// ─────────────────────────────────────────────────────────────────────────────
const STYLES = {
    colHeader: (argb = 'FFE5E7EB', textArgb = 'FF1F2937'): Partial<ExcelJS.Style> => ({
        font: mkFont({ bold: true, size: 8, color: { argb: textArgb } }),
        fill: mkFill(argb),
        alignment: mkAlign('center', 'middle', true),
        border: mkBorder('FF9CA3AF'),
    }),
    subHeader: (argb = 'FFF3F4F6'): Partial<ExcelJS.Style> => ({
        font: mkFont({ bold: true, size: 7, color: { argb: 'FF374151' } }),
        fill: mkFill(argb),
        alignment: mkAlign('center'),
        border: mkBorder('FFB6C0CC'),
    }),
    bodyLeft: (): Partial<ExcelJS.Style> => ({
        font: mkFont({ size: 8, color: { argb: 'FF111827' } }),
        alignment: mkAlign('left', 'middle', true),
        border: mkBorder('FFB6C0CC'),
    }),
    bodyCenter: (): Partial<ExcelJS.Style> => ({
        font: mkFont({ size: 8, color: { argb: 'FF111827' } }),
        alignment: mkAlign('center'),
        border: mkBorder('FFB6C0CC'),
    }),
    number2: (): Partial<ExcelJS.Style> => ({
        font: mkFont({ size: 8, color: { argb: 'FF111827' } }),
        numFmt: '#,##0.00',
        alignment: mkAlign('right'),
        border: mkBorder('FFB6C0CC'),
    }),
    number3: (): Partial<ExcelJS.Style> => ({
        font: mkFont({ size: 8, color: { argb: 'FF111827' } }),
        numFmt: '#,##0.000',
        alignment: mkAlign('right'),
        border: mkBorder('FFB6C0CC'),
    }),
    sectionTotal: (bgArgb: string, textArgb = 'FF374151'): Partial<ExcelJS.Style> => ({
        font: mkFont({ bold: true, size: 8, color: { argb: textArgb } }),
        fill: mkFill(bgArgb),
        numFmt: '#,##0.00',
        alignment: mkAlign('right'),
        border: mkBorder('FF9CA3AF', 'thin'),
    }),
    grandTotal: (textArgb = 'FF111827'): Partial<ExcelJS.Style> => ({
        font: mkFont({ bold: true, size: 8, color: { argb: textArgb } }),
        fill: mkFill('FFE5E7EB'),
        numFmt: '#,##0.00',
        alignment: mkAlign('right'),
        border: mkBorder('FF6B7280', 'thin'),
    }),
    grandTotalLabel: (): Partial<ExcelJS.Style> => ({
        font: mkFont({ bold: true, size: 8, color: { argb: 'FF111827' } }),
        fill: mkFill('FFD1D5DB'),
        alignment: mkAlign('right'),
        border: mkBorder('FF6B7280', 'thin'),
    }),
    pico: (): Partial<ExcelJS.Style> => ({
        font: mkFont({ bold: true, size: 8, color: { argb: 'FF374151' } }),
        fill: mkFill('FFFFF0B8'),
        numFmt: '#,##0.00',
        alignment: mkAlign('right'),
        border: mkBorder('FFB6C0CC'),
    }),
    picoCant: (): Partial<ExcelJS.Style> => ({
        font: mkFont({ bold: true, size: 8, color: { argb: 'FF374151' } }),
        fill: mkFill('FFFFF0B8'),
        numFmt: '#,##0.000',
        alignment: mkAlign('right'),
        border: mkBorder('FFB6C0CC'),
    }),
    pct: (): Partial<ExcelJS.Style> => ({
        font: mkFont({ bold: true, size: 8, color: { argb: 'FF374151' } }),
        fill: mkFill('FFF3F4F6'),
        numFmt: '0.00"%"',
        alignment: mkAlign('center'),
        border: mkBorder('FFB6C0CC'),
    }),
    empty: (bgArgb = 'FFFFFFFF'): Partial<ExcelJS.Style> => ({
        fill: mkFill(bgArgb),
        border: mkBorder('FFB6C0CC'),
    }),
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────────────────
const fmtNum = (v: number, dec = 2) =>
    v.toLocaleString('es-PE', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const getMonto = (m: MaterialItem, key: string) => m.distribucion[key]?.monto || 0;
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

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACCIÓN DE DATOS DEL PROYECTO
// ─────────────────────────────────────────────────────────────────────────────
const extraerCodigoModular = (projectData: any): string => {
    try {
        const raw = projectData?.codigos_modulares ?? projectData?.codigo_modular;
        if (!raw) return '-';
        const modulares = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const partes: string[] = [];
        if (modulares.inicial) partes.push(modulares.inicial);
        if (modulares.primaria) partes.push(modulares.primaria);
        if (modulares.secundaria) partes.push(modulares.secundaria);
        return partes.length > 0 ? partes.join('-') : '-';
    } catch {
        return projectData?.codigos_modulares || projectData?.codigo_modular || '-';
    }
};

const extraerIECodigo = (nombre: string): string => {
    const match = nombre.match(/(I\.?E\.?\s*(?:I\.?P\.?\s*)?N[°º]?\s*\d+)/i);
    return match ? match[0].trim() : nombre.split('-')[0].trim();
};

const formatearUbicacion = (projectData: any): string => {
    return [
        projectData?.departamento_id,
        projectData?.provincia_id,
        projectData?.distrito_id,
        projectData?.centro_poblado,
    ].filter(Boolean).join(' - ') || 'SIN UBICACIÓN';
};

// ─────────────────────────────────────────────────────────────────────────────
// BUILDERS DE HOJAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Encabezado profesional del reporte (igual al ejemplo de referencia)
 * Filas: 1-7
 */
function buildReportHeader(
    ws: ExcelJS.Worksheet,
    projectData: any,
    tipoLabel: string,
    viewMode: ViewMode,
    totalCols: number,
): void {
    const mergeRow = (rowNum: number, value: string, style: Partial<ExcelJS.Style>, height = 18) => {
        ws.mergeCells(rowNum, actualCol(1), rowNum, actualLastCol(totalCols));
        const cell = ws.getCell(rowNum, actualCol(1));
        cell.value = value;
        cell.style = style;
        ws.getRow(rowNum).height = height;
    };

    const setCell = (rowNum: number, logicalCol: number, value: ExcelJS.CellValue, style: Partial<ExcelJS.Style>) => {
        const cell = ws.getCell(rowNum, actualCol(logicalCol));
        cell.value = value;
        cell.style = style;
    };

    // Datos del proyecto
    const nombreProyecto = projectData?.nombre || 'SIN NOMBRE';
    const ieCodigo = extraerIECodigo(nombreProyecto);
    const codigoCUI = projectData?.codigo_cui || '-';
    const codigoModular = extraerCodigoModular(projectData);
    const ubicacion = formatearUbicacion(projectData);
    const fechaStr = new Date().toLocaleDateString('es-PE');

    // Estilos
    const styleTitulo: Partial<ExcelJS.Style> = {
        font: mkFont({ bold: true, size: 14, color: { argb: 'FF1E3A8A' } }),
        fill: mkFill('FFDBEAFE'),
        alignment: mkAlign('center', 'middle'),
        border: mkBorder('FF93C5FD', 'medium'),
    };

    const styleProyecto: Partial<ExcelJS.Style> = {
        font: mkFont({ bold: true, size: 10, color: { argb: 'FF1F2937' } }),
        fill: mkFill('FFDCE8F8'),
        alignment: mkAlign('left', 'middle', true),
        border: mkBorder('FFB6C0CC'),
    };

    const styleIE: Partial<ExcelJS.Style> = {
        font: mkFont({ bold: true, size: 9, color: { argb: 'FF374151' } }),
        alignment: mkAlign('left', 'middle'),
        border: mkBorder('FFB6C0CC'),
    };

    const styleLabel: Partial<ExcelJS.Style> = {
        font: mkFont({ bold: true, size: 8, color: { argb: 'FF64748B' } }),
        alignment: mkAlign('right', 'middle'),
        border: mkBorder('FFB6C0CC'),
    };

    const styleValor: Partial<ExcelJS.Style> = {
        font: mkFont({ bold: true, size: 9, color: { argb: 'FF1D4ED8' } }),
        alignment: mkAlign('left', 'middle'),
        border: mkBorder('FFB6C0CC'),
    };

    const styleUbicacion: Partial<ExcelJS.Style> = {
        font: mkFont({ size: 8, color: { argb: 'FF374151' } }),
        alignment: mkAlign('left', 'middle'),
        border: mkBorder('FFB6C0CC'),
    };

    // Fila 1: Título
    mergeRow(1, `CRONOGRAMA DE ${tipoLabel}`, styleTitulo, 30);

    // Fila 2: Proyecto
    mergeRow(2, `PROYECTO: "${nombreProyecto}"`, styleProyecto, 36);

    // Fila 3: Fecha
    mergeRow(3, `FECHA: ${fechaStr}`, {
        font: mkFont({ size: 9, italic: true, color: { argb: 'FF64748B' } }),
        alignment: mkAlign('left', 'middle'),
        border: mkBorder('FFB6C0CC'),
    }, 18);

    // Fila 4: I.E. y Código Unificado
    ws.mergeCells(4, actualCol(1), 4, actualCol(2));
    setCell(4, 1, ieCodigo, styleIE);
    setCell(4, 3, 'CÓDIGO UNIFICADO:', styleLabel);
    setCell(4, 4, codigoCUI, styleValor);
    for (let c = 5; c <= totalCols; c++) {
        ws.getCell(4, actualCol(c)).style = STYLES.empty('FFFFFFFF');
    }
    ws.getRow(4).height = 20;

    // Fila 5: Ubicación y Código Modular
    ws.mergeCells(5, actualCol(1), 5, actualCol(2));
    setCell(5, 1, `UBICACIÓN: ${ubicacion}`, styleUbicacion);
    setCell(5, 3, 'CÓDIGO MODULAR:', styleLabel);
    setCell(5, 4, codigoModular, styleValor);
    for (let c = 5; c <= totalCols; c++) {
        ws.getCell(5, actualCol(c)).style = STYLES.empty('FFFFFFFF');
    }
    ws.getRow(5).height = 20;

    // Fila 6: Duración (si existe)
    if (projectData?.fecha_inicio && projectData?.fecha_fin) {
        try {
            const inicio = new Date(projectData.fecha_inicio);
            const fin = new Date(projectData.fecha_fin);
            const dias = Math.round((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
            if (dias > 0) {
                mergeRow(6, `${dias} DÍAS CALENDARIO`, {
                    font: mkFont({ bold: true, size: 8, color: { argb: 'FF374151' } }),
                    fill: mkFill('FFF3F4F6'),
                    alignment: mkAlign('left', 'middle'),
                    border: mkBorder('FFB6C0CC'),
                }, 18);
            } else {
                ws.getRow(6).height = 6;
            }
        } catch {
            ws.getRow(6).height = 6;
        }
    } else {
        ws.getRow(6).height = 6;
    }

    // Fila 7: Espacio
    ws.getRow(7).height = 6;
}

/**
 * Encabezados de columnas (dos filas)
 */
function buildColumnHeaders(
    ws: ExcelJS.Worksheet,
    periodos: Periodo[],
    viewMode: ViewMode,
    mesPicoKey: string,
    startRow: number,
    colFixed: number,
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

/**
 * Fila de datos
 */
function buildDataRow(
    ws: ExcelJS.Worksheet,
    material: MaterialItem,
    idx: number,
    periodos: Periodo[],
    viewMode: ViewMode,
    mesPicoKey: string,
    rowNum: number,
    colFixed: number,
    isAlt: boolean,
): void {
    const altBg = isAlt ? 'FFFAFBFC' : 'FFFFFFFF';
    const meta = getTipoMeta(material.tipo || 'otros');
    const row = ws.getRow(rowNum);
    row.height = 16;

    const setCell = (logicalCol: number, value: ExcelJS.CellValue, style: Partial<ExcelJS.Style>) => {
        const c = ws.getCell(rowNum, actualCol(logicalCol));
        c.value = value;
        c.style = { ...style, fill: style.fill ?? mkFill(altBg) };
    };

    const unidadSegura = toExcelText(material.unidad, 'UND').toUpperCase();
    const descripcionSegura = toExcelText(material.descripcion, 'SIN DESCRIPCION');
    const partidaSegura = toExcelText(material.partida_origen, '-');

    setCell(1, idx + 1, { ...STYLES.bodyCenter(), font: mkFont({ size: 8, color: { argb: 'FF6B7280' } }) });
    setCell(2, meta.label, { ...STYLES.bodyCenter(), font: mkFont({ bold: true, size: 8, color: { argb: 'FF374151' } }), fill: mkFill(meta.accentArgb) });
    setCell(3, partidaSegura, { ...STYLES.bodyCenter(), font: mkFont({ size: 8, color: { argb: 'FF374151' }, bold: true }) });
    setCell(4, descripcionSegura, { ...STYLES.bodyLeft(), font: mkFont({ size: 8 }) });
    setCell(5, unidadSegura, { ...STYLES.bodyCenter(), font: mkFont({ size: 8, bold: true, color: { argb: 'FF475569' } }) });
    setCell(6, material.precio, { ...STYLES.number2(), font: mkFont({ size: 8, color: { argb: 'FF374151' } }) });

    let col = actualCol(colFixed + 1);
    periodos.forEach((p, periodIndex) => {
        const isPico = p.key === mesPicoKey;
        const bandBg = isPico ? 'FFFFF0B8' : getMonthBand(periodIndex);
        const cantidad = getCantidad(material, p.key);
        const monto = getMonto(material, p.key);

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

/**
 * Fila de subtotal por tipo
 */
function buildSubtotalRow(
    ws: ExcelJS.Worksheet,
    tipo: string,
    items: MaterialItem[],
    periodos: Periodo[],
    mesPicoKey: string,
    rowNum: number,
    colFixed: number,
    totalCols: number,
): void {
    const meta = getTipoMeta(tipo);
    ws.getRow(rowNum).height = 18;

    ws.mergeCells(rowNum, actualCol(1), rowNum, actualCol(colFixed));
    const lbl = ws.getCell(rowNum, actualCol(1));
    lbl.value = `SUBTOTAL ${meta.label} (${items.length})`;
    lbl.style = {
        font: mkFont({ bold: true, size: 8, color: { argb: 'FF374151' } }),
        fill: mkFill(meta.subArgb),
        alignment: mkAlign('right'),
        border: mkBorder('FF9CA3AF'),
    };

    let col = actualCol(colFixed + 1);
    periodos.forEach((p, periodIndex) => {
        const isPico = p.key === mesPicoKey;
        const totalCant = items.reduce((s, m) => s + getCantidad(m, p.key), 0);
        const totalMonto = items.reduce((s, m) => s + getMonto(m, p.key), 0);
        const bgArgb = isPico ? 'FFFFF0B8' : getMonthBand(periodIndex);

        const cc = ws.getCell(rowNum, col);
        cc.value = totalCant > 0 ? totalCant : null;
        cc.style = { ...STYLES.sectionTotal(bgArgb, 'FF374151'), numFmt: '#,##0.000' };

        const mc = ws.getCell(rowNum, col + 1);
        mc.value = totalMonto > 0 ? totalMonto : null;
        mc.style = STYLES.sectionTotal(bgArgb, 'FF374151');

        col += 2;
    });

    const totCant = items.reduce((s, m) => s + m.cantidad_total, 0);
    const totCosto = items.reduce((s, m) => s + m.costo_total, 0);

    ws.getCell(rowNum, col).value = totCant;
    ws.getCell(rowNum, col).style = { ...STYLES.sectionTotal('FFF3F4F6', 'FF374151'), numFmt: '#,##0.000' };
    ws.getCell(rowNum, col + 1).value = totCosto;
    ws.getCell(rowNum, col + 1).style = STYLES.sectionTotal('FFF3F4F6', 'FF374151');
}

/**
 * Fila de total general
 */
function buildGrandTotalRow(
    ws: ExcelJS.Worksheet,
    materiales: MaterialItem[],
    periodos: Periodo[],
    mesPicoKey: string,
    rowNum: number,
    colFixed: number,
): void {
    ws.getRow(rowNum).height = 20;

    ws.mergeCells(rowNum, actualCol(1), rowNum, actualCol(colFixed));
    const lbl = ws.getCell(rowNum, actualCol(1));
    lbl.value = `TOTAL GENERAL - ${materiales.length} insumos`;
    lbl.style = STYLES.grandTotalLabel();

    let col = actualCol(colFixed + 1);
    periodos.forEach((p, periodIndex) => {
        const isPico = p.key === mesPicoKey;
        const totalCant = materiales.reduce((s, m) => s + getCantidad(m, p.key), 0);
        const totalMonto = materiales.reduce((s, m) => s + getMonto(m, p.key), 0);
        const bgArgb = isPico ? 'FFFFF0B8' : getMonthBand(periodIndex);

        const cc = ws.getCell(rowNum, col);
        cc.value = totalCant > 0 ? totalCant : null;
        cc.style = { ...STYLES.grandTotal('FF111827'), fill: mkFill(bgArgb), numFmt: '#,##0.000' };

        const mc = ws.getCell(rowNum, col + 1);
        mc.value = totalMonto > 0 ? totalMonto : null;
        mc.style = { ...STYLES.grandTotal('FF111827'), fill: mkFill(bgArgb) };

        col += 2;
    });

    const gtCant = materiales.reduce((s, m) => s + m.cantidad_total, 0);
    const gtCosto = materiales.reduce((s, m) => s + m.costo_total, 0);

    ws.getCell(rowNum, col).value = gtCant;
    ws.getCell(rowNum, col).style = { ...STYLES.grandTotal('FF111827'), numFmt: '#,##0.000' };
    ws.getCell(rowNum, col + 1).value = gtCosto;
    ws.getCell(rowNum, col + 1).style = STYLES.grandTotal('FF111827');
}

/**
 * Fila de porcentajes mensuales
 */
function buildPctRow(
    ws: ExcelJS.Worksheet,
    materiales: MaterialItem[],
    periodos: Periodo[],
    mesPicoKey: string,
    rowNum: number,
    colFixed: number,
): void {
    ws.getRow(rowNum).height = 16;

    const totalMensual = periodos.reduce((s, p) =>
        s + materiales.reduce((ss, m) => ss + getMonto(m, p.key), 0), 0);

    ws.mergeCells(rowNum, actualCol(1), rowNum, actualCol(colFixed));
    const lbl = ws.getCell(rowNum, actualCol(1));
    lbl.value = '% DISTRIBUCIÓN MENSUAL';
    lbl.style = {
        font: mkFont({ bold: true, size: 8, color: { argb: 'FF64748B' } }),
        fill: mkFill('FFF8FAFC'),
        alignment: mkAlign('right'),
        border: mkBorder('FFB6C0CC'),
    };

    let col = actualCol(colFixed + 1);
    periodos.forEach((p, periodIndex) => {
        const isPico = p.key === mesPicoKey;
        const montoMes = materiales.reduce((s, m) => s + getMonto(m, p.key), 0);
        const pct = totalMensual > 0 ? (montoMes / totalMensual) * 100 : 0;
        const bgArgb = isPico ? 'FFFFF0B8' : getMonthBand(periodIndex);

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

/**
 * Hoja de resumen ejecutivo
 */
function buildResumenSheet(
    wb: ExcelJS.Workbook,
    materiales: MaterialItem[],
    periodos: Periodo[],
    projectData: any,
    tipoLabel: string,
    mesPicoKey: string,
): void {
    const ws = wb.addWorksheet('Resumen Ejecutivo', {
        properties: { tabColor: { argb: 'FFE5E7EB' } },
    });

    ws.getColumn(1).width = 3;
    ws.getColumn(actualCol(1)).width = 34;
    ws.getColumn(actualCol(2)).width = 18;
    ws.getColumn(actualCol(3)).width = 16;

    const nombreProyecto = projectData?.nombre || 'SIN NOMBRE';

    // Título
    ws.mergeCells(1, actualCol(1), 1, actualCol(3));
    ws.getCell(1, actualCol(1)).value = 'RESUMEN EJECUTIVO';
    ws.getCell(1, actualCol(1)).style = {
        font: mkFont({ bold: true, size: 13, color: { argb: 'FF374151' } }),
        fill: mkFill('FFF8FAFC'),
        alignment: mkAlign('left'),
        border: mkBorder('FFCBD5E1'),
    };
    ws.getRow(1).height = 24;

    // Subtítulo
    ws.mergeCells(2, actualCol(1), 2, actualCol(3));
    ws.getCell(2, actualCol(1)).value = nombreProyecto;
    ws.getCell(2, actualCol(1)).style = {
        font: mkFont({ size: 10, italic: true, color: { argb: 'FF64748B' } }),
        alignment: mkAlign('left'),
    };

    // Filtro activo
    ws.mergeCells(3, actualCol(1), 3, actualCol(3));
    ws.getCell(3, actualCol(1)).value = `Filtro activo: ${tipoLabel}`;
    ws.getCell(3, actualCol(1)).style = {
        font: mkFont({ size: 8, color: { argb: 'FF64748B' } }),
        alignment: mkAlign('left'),
    };
    ws.getRow(4).height = 6;

    // Datos
    const totalGeneral = materiales.reduce((s, m) => s + m.costo_total, 0);
    const montoPorMes = periodos.map(p => ({
        label: p.labelCal || p.label,
        key: p.key,
        monto: materiales.reduce((s, m) => s + getMonto(m, p.key), 0),
    }));
    const mesPico = montoPorMes.find(m => m.key === mesPicoKey);
    const montoPico = mesPico?.monto || 0;
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
    const hLabel = ws.getCell(r, actualCol(1));
    hLabel.value = 'INDICADOR';
    hLabel.style = STYLES.colHeader('FFE5E7EB');
    const hVal = ws.getCell(r, actualCol(2));
    hVal.value = 'VALOR';
    hVal.style = STYLES.colHeader('FFE5E7EB');
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

    // Desglose por tipo (si hay más de uno)
    if (resumenTipos.length > 1) {
        r++;
        ws.mergeCells(r, actualCol(1), r, actualCol(3));
        const th = ws.getCell(r, actualCol(1));
        th.value = 'DESGLOSE POR TIPO DE INSUMO';
        th.style = STYLES.colHeader('FFE5E7EB');
        ws.getRow(r).height = 18;
        r++;

        const sh1 = ws.getCell(r, actualCol(1));
        sh1.value = 'TIPO';
        sh1.style = STYLES.colHeader('FFF3F4F6');
        const sh2 = ws.getCell(r, actualCol(2));
        sh2.value = 'INSUMOS';
        sh2.style = STYLES.colHeader('FFF3F4F6');
        const sh3 = ws.getCell(r, actualCol(3));
        sh3.value = 'COSTO S/.';
        sh3.style = STYLES.colHeader('FFF3F4F6');
        ws.getRow(r).height = 16;
        r++;

        resumenTipos.forEach((rt, i) => {
            const meta = getTipoMeta(rt.tipo);
            const bg = i % 2 === 0 ? 'FFFFFFFF' : 'FFFAFBFC';

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

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL EXPORTADORA
// ─────────────────────────────────────────────────────────────────────────────
export const exportarMaterialesExcel = async (
    materiales: MaterialItem[],
    periodos: Periodo[],
    projectName: string,
    viewMode: ViewMode,
    tipoFiltroActivo?: string,
    projectData?: any,
): Promise<void> => {
    if (!materiales.length || !periodos.length) {
        console.warn('[exportHelpers] No hay datos para exportar');
        return;
    }

    const pd = projectData ?? { nombre: projectName };
    const filtroEsTodo = !tipoFiltroActivo;
    const tipoLabel = filtroEsTodo ? 'INSUMOS GENERALES' : getTipoMeta(tipoFiltroActivo).label;

    const montoPorMes = periodos.map(p => ({
        key: p.key,
        monto: materiales.reduce((s, m) => s + getMonto(m, p.key), 0),
    }));
    const mesPicoKey = montoPorMes.reduce((best, curr) => curr.monto > best.monto ? curr : best, montoPorMes[0]).key;

    const COL_FIXED = 6;
    const TOTAL_COLS = COL_FIXED + periodos.length * 2 + 2;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'PCL – Cronograma Materiales';
    wb.lastModifiedBy = 'PCL';
    wb.created = new Date();
    wb.modified = new Date();
    wb.calcProperties.fullCalcOnLoad = true;

    // Hoja principal
    const sheetName = filtroEsTodo ? 'Cronograma General' : tipoLabel;
    const ws = wb.addWorksheet(sheetName, {
        pageSetup: {
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            paperSize: 9,
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
    buildReportHeader(ws, pd, tipoLabel, viewMode, TOTAL_COLS);
    buildColumnHeaders(ws, periodos, viewMode, mesPicoKey, 8, COL_FIXED);

    let currentRow = 10;
    materiales.forEach((mat, i) => {
        buildDataRow(ws, mat, i, periodos, viewMode, mesPicoKey, currentRow, COL_FIXED, i % 2 !== 0);
        currentRow++;
    });

    buildPctRow(ws, materiales, periodos, mesPicoKey, currentRow, COL_FIXED);
    currentRow++;
    buildGrandTotalRow(ws, materiales, periodos, mesPicoKey, currentRow, COL_FIXED);

    // Hoja de resumen
    buildResumenSheet(wb, materiales, periodos, pd, tipoLabel, mesPicoKey);

    // Hojas adicionales por tipo (si exporta todo)
    if (filtroEsTodo) {
        const grupos = agruparPorTipo(materiales);
        grupos.forEach((items, tipo) => {
            if (items.length === 0) return;
            const meta = getTipoMeta(tipo);
            const wsT = wb.addWorksheet(meta.label, {
                properties: { tabColor: { argb: meta.headerArgb } },
                pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
            });

            setupCronogramaColumns(wsT, periodos, COL_FIXED);
            buildReportHeader(wsT, pd, meta.label, viewMode, TOTAL_COLS);
            buildColumnHeaders(wsT, periodos, viewMode, mesPicoKey, 8, COL_FIXED);

            let r = 10;
            items.forEach((mat, i) => {
                buildDataRow(wsT, mat, i, periodos, viewMode, mesPicoKey, r, COL_FIXED, i % 2 !== 0);
                r++;
            });
            buildPctRow(wsT, items, periodos, mesPicoKey, r, COL_FIXED);
            r++;
            buildGrandTotalRow(wsT, items, periodos, mesPicoKey, r, COL_FIXED);
        });
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const sufijo = filtroEsTodo ? 'GENERAL' : tipoLabel.replace(/\s+/g, '_');
    const fecha = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const nombre = `Cronograma_${sufijo}_${(pd.nombre || projectName).replace(/\s+/g, '_')}_${fecha}.xlsx`;

    saveAs(blob, nombre);
};