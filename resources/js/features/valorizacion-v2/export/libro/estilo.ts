import type Decimal from 'decimal.js';
import type ExcelJS from 'exceljs';
import type { BudgetTotals } from '../../lib/budget';
import type { PartidaNode } from '../../lib/partidaTree';
import type { ParametrosPresupuesto } from '../../types';

/**
 * Estilo formal del expediente del cliente: fuente condensada (Agency FB), banda
 * de título azul, cabeceras celestes, sin cuadrícula, ítems coloreados por
 * nivel (morado → rojo → azul) y pie presupuestal en negrita.
 */
export const FUENTE = 'Agency FB';
export const COLOR = {
    titulo: 'FF538DD5',
    cabecera: 'FFC5D9F1',
    cabeceraGris: 'FFBFBFBF',
    actual: 'FFDCE6F1',
    mesActual: 'FF31869B',
    verde: 'FFD8E4BC',
    rosa: 'FFF2DCDB',
    amarillo: 'FFFFFF00',
    asistio: 'FF00B050',
    domingo: 'FFFF0000',
    texto: 'FF000000',
    blanco: 'FFFFFFFF',
} as const;
/** Ítems: nivel 1 morado, 2 rojo, 3+ azul (títulos); partidas en negro. */
const COLOR_NIVEL = ['FF7030A0', 'FFFF0000', 'FF0000FF'];

export const FMT = {
    numero: '#,##0.00;-#,##0.00',
    /** Ceros como guion, como en los resúmenes de pago. */
    numeroGuion: '#,##0.00;-#,##0.00;"-"',
    moneda: '"S/" #,##0.00',
    pct: '0.00%',
    pctGuion: '0.00%;-0.00%;"-"',
    fecha: 'd/mm/yyyy',
    entero: '00',
} as const;

/** Columna A = margen angosto; el contenido empieza en la B. */
export const C0 = 2;

export interface Estilo {
    negrita?: boolean;
    cursiva?: boolean;
    color?: string;
    fondo?: string;
    formato?: string;
    alineacion?: 'left' | 'center' | 'right';
    vertical?: 'top' | 'middle';
    ajustar?: boolean;
    tamano?: number;
    borde?: 'fino' | 'medio' | 'ninguno';
    subrayado?: boolean;
}

export type Valor = string | number | Date | null;

const BORDE_FINO: Partial<ExcelJS.Borders> = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
const BORDE_MEDIO: Partial<ExcelJS.Borders> = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'medium' }, right: { style: 'medium' } };

/** Decimal → número de Excel (null queda vacío). */
export const num = (valor: Decimal | null | undefined): number | null => (valor === null || valor === undefined ? null : valor.toNumber());

/** Fecha ISO (aaaa-mm-dd) → Date UTC que Excel muestra como ese mismo día. */
export const fecha = (iso: string | null | undefined): Date | null => {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        return null;
    }
    const [y, m, d] = iso.split('-').map(Number);

    return new Date(Date.UTC(y, m - 1, d));
};

function aplicar(celda: ExcelJS.Cell, estilo: Estilo) {
    celda.font = { name: FUENTE, size: estilo.tamano ?? 11, bold: estilo.negrita ?? false, italic: estilo.cursiva ?? false, underline: estilo.subrayado ?? false, color: { argb: estilo.color ?? COLOR.texto } };
    if (estilo.fondo) {
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: estilo.fondo } };
    }
    if (estilo.formato) {
        celda.numFmt = estilo.formato;
    }
    celda.alignment = { horizontal: estilo.alineacion, vertical: estilo.vertical ?? 'middle', wrapText: estilo.ajustar ?? false };
    if (estilo.borde === 'fino') {
        celda.border = BORDE_FINO;
    } else if (estilo.borde === 'medio') {
        celda.border = BORDE_MEDIO;
    }
}

export function celda(ws: ExcelJS.Worksheet, fila: number, col: number, valor: Valor, estilo: Estilo = {}): ExcelJS.Cell {
    const c = ws.getCell(fila, col);
    c.value = valor;
    aplicar(c, estilo);

    return c;
}

/** Rango combinado; el estilo (borde, fondo) se aplica a todas sus celdas. */
export function rango(ws: ExcelJS.Worksheet, f1: number, c1: number, f2: number, c2: number, valor: Valor, estilo: Estilo = {}): void {
    for (let f = f1; f <= f2; f++) {
        for (let c = c1; c <= c2; c++) {
            aplicar(ws.getCell(f, c), estilo);
        }
    }
    if (f2 > f1 || c2 > c1) {
        ws.mergeCells(f1, c1, f2, c2);
    }
    ws.getCell(f1, c1).value = valor;
}

/**
 * Hoja nueva: margen en A, anchos de columna desde la B, sin cuadrícula, A4
 * apaisado ajustado al ancho y cabecera de tabla repetida al imprimir.
 */
export function nuevaHoja(wb: ExcelJS.Workbook, nombre: string, anchos: number[], vertical = false): ExcelJS.Worksheet {
    const ws = wb.addWorksheet(nombre, {
        views: [{ showGridLines: false }],
        pageSetup: {
            paperSize: 9,
            orientation: vertical ? 'portrait' : 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            horizontalCentered: true,
            margins: { left: 0.4, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
        },
        headerFooter: { oddFooter: `&L&"${FUENTE}"&8${nombre}&R&"${FUENTE}"&8Página &P de &N` },
    });
    ws.getColumn(1).width = 1.5;
    anchos.forEach((ancho, i) => {
        ws.getColumn(C0 + i).width = ancho;
    });

    return ws;
}

/** Banda azul con el título de la hoja (fila 1 de cada hoja del expediente). */
export function titulo(ws: ExcelJS.Worksheet, fila: number, texto: string, ultimaCol: number): number {
    rango(ws, fila, C0, fila, ultimaCol, texto.toUpperCase(), { negrita: true, tamano: 16, alineacion: 'center', fondo: COLOR.titulo, borde: 'medio' });
    ws.getRow(fila).height = 26;

    return fila + 1;
}

/** Subtítulo centrado en negrita (p. ej. el contrato). */
export function subtitulo(ws: ExcelJS.Worksheet, fila: number, texto: string, ultimaCol: number): number {
    rango(ws, fila, C0, fila, ultimaCol, texto.toUpperCase(), { negrita: true, tamano: 13, alineacion: 'center' });
    ws.getRow(fila).height = 20;

    return fila + 1;
}

export interface Expediente {
    obra: string;
    entidad: string;
    ejecutor: string;
    supervisor: string;
    residente: string;
    ingSupervisor: string;
    contrato: string;
    /** Bloque derecho por defecto (valor referencial, monto del contrato, plazo). */
    derecha: Array<[string, Valor, string?]>;
}

/**
 * Datos del expediente que el Excel repite bajo el título de cada hoja: Obra,
 * Entidad, Ejecutor, Supervisor, Residente, Ing. Supervisor y, a la derecha,
 * los montos y el plazo. `derecha` reemplaza el bloque derecho (o [] sin él).
 */
export function encabezadoExpediente(ws: ExcelJS.Worksheet, fila: number, e: Expediente, ultimaCol: number, derecha: Array<[string, Valor, string?]> = e.derecha): number {
    const izquierda: Array<[string, string]> = [
        ['Obra:', e.obra],
        ['Entidad:', e.entidad],
        ['Ejecutor:', e.ejecutor],
        ['Supervisor:', e.supervisor],
        ['Residente:', e.residente],
        ['Ing. Supervisor:', e.ingSupervisor],
    ];
    // Si la columna del ítem es angosta, la etiqueta ocupa dos columnas para no cortarse.
    const anchoCol = (col: number) => ws.getColumn(col).width ?? 9;
    const finEtiqueta = anchoCol(C0) < 12 ? C0 + 1 : C0;
    const colValor = finEtiqueta + 1;
    const total = ultimaCol - colValor + 1;
    const finValor = derecha.length > 0 ? colValor + Math.max(1, Math.floor(total * 0.45)) - 1 : ultimaCol;
    const colEtiquetaDer = finValor + 1;
    const colValorDer = Math.min(ultimaCol, colEtiquetaDer + Math.max(1, Math.floor((ultimaCol - colEtiquetaDer + 1) / 2)));
    // Caracteres por línea de la obra según el ancho real (fuente condensada ≈ 1.3 caracteres por unidad).
    let anchoObra = 0;
    for (let col = colValor; col <= ultimaCol; col++) {
        anchoObra += anchoCol(col);
    }

    izquierda.forEach(([etiqueta, valor], i) => {
        const f = fila + i;
        rango(ws, f, C0, f, finEtiqueta, etiqueta, { negrita: true, vertical: 'top' });
        const hasta = i === 0 ? ultimaCol : finValor;
        rango(ws, f, colValor, f, hasta, valor, { ajustar: i === 0, vertical: 'top' });
        if (i === 0) {
            ws.getRow(f).height = 15 * Math.max(1, Math.ceil(valor.length / Math.max(30, anchoObra * 1.3)));
        }
    });
    derecha.forEach(([etiqueta, valor, formato], i) => {
        const f = fila + izquierda.length - derecha.length + i;
        if (colValorDer > colEtiquetaDer) {
            rango(ws, f, colEtiquetaDer, f, colValorDer - 1, etiqueta, { negrita: false });
        }
        rango(ws, f, colValorDer, f, ultimaCol, valor, { formato, alineacion: 'left' });
    });
    // Línea de cierre del encabezado.
    const cierre = fila + izquierda.length;
    for (let c = C0; c <= ultimaCol; c++) {
        ws.getCell(cierre - 1, c).border = { ...ws.getCell(cierre - 1, c).border, bottom: { style: 'thin' } };
    }

    return cierre + 1;
}

export interface CeldaCabecera {
    texto: string;
    fila: number;
    col: number;
    filas?: number;
    cols?: number;
    fondo?: string;
    color?: string;
}

/** Cabecera de tabla: celdas combinadas celestes, negrita, centradas y con borde. */
export function cabecera(ws: ExcelJS.Worksheet, celdas: CeldaCabecera[]): void {
    for (const c of celdas) {
        rango(ws, c.fila, c.col, c.fila + (c.filas ?? 1) - 1, c.col + (c.cols ?? 1) - 1, c.texto, {
            negrita: true,
            alineacion: 'center',
            ajustar: true,
            fondo: c.fondo ?? COLOR.cabecera,
            color: c.color,
            borde: 'fino',
            tamano: 10,
        });
    }
}

/** Ítem y descripción de una fila del árbol de partidas, coloreados por nivel. */
export function itemArbol(ws: ExcelJS.Worksheet, fila: number, node: PartidaNode): void {
    const color = node.esHoja ? COLOR.texto : COLOR_NIVEL[Math.min(node.nivel, COLOR_NIVEL.length) - 1];
    const estilo: Estilo = { negrita: !node.esHoja, color, borde: 'fino' };
    celda(ws, fila, C0, node.codigo, estilo);
    celda(ws, fila, C0 + 1, node.descripcion.toUpperCase(), { ...estilo, ajustar: node.descripcion.length > 70 });
}

/** Celda numérica de tabla con borde fino. */
export function numero(ws: ExcelJS.Worksheet, fila: number, col: number, valor: Decimal | number | null | undefined, formato: string = FMT.numero, estilo: Estilo = {}): void {
    const v = valor === null || valor === undefined ? null : typeof valor === 'number' ? valor : valor.toNumber();
    celda(ws, fila, col, v, { formato, alineacion: 'right', borde: 'fino', ...estilo });
}

/** Bordes finos en un rectángulo (celdas vacías de la tabla). */
export function bordes(ws: ExcelJS.Worksheet, f1: number, c1: number, f2: number, c2: number): void {
    for (let f = f1; f <= f2; f++) {
        for (let c = c1; c <= c2; c++) {
            const cel = ws.getCell(f, c);
            if (!cel.border) {
                cel.border = BORDE_FINO;
            }
            if (!cel.font) {
                cel.font = { name: FUENTE, size: 11 };
            }
        }
    }
}

export type CampoPie = keyof Omit<BudgetTotals, 'pesoCD'>;

/** Filas del pie presupuestal CD → TOTAL con su etiqueta y la tasa (columna de %). */
export function filasPie(parametros: ParametrosPresupuesto, totalLabel = 'TOTAL PRESUPUESTO'): Array<{ campo: CampoPie; etiqueta: string; tasa: number | null; fuerte: boolean }> {
    return [
        { campo: 'costoDirecto', etiqueta: 'COSTO DIRECTO', tasa: null, fuerte: true },
        { campo: 'gastosGenerales', etiqueta: 'GASTOS GENERALES', tasa: Number(parametros.gastosGenerales), fuerte: false },
        { campo: 'utilidad', etiqueta: 'UTILIDAD', tasa: Number(parametros.utilidad), fuerte: false },
        { campo: 'subTotal', etiqueta: 'SUB TOTAL', tasa: null, fuerte: true },
        { campo: 'igv', etiqueta: `IGV (${Math.round(Number(parametros.igv) * 100)}%)`, tasa: Number(parametros.igv), fuerte: false },
        { campo: 'total', etiqueta: totalLabel, tasa: null, fuerte: true },
    ];
}
