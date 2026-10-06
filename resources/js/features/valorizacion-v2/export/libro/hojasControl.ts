import type ExcelJS from 'exceljs';
import type { ControlMes } from '../../sheets/control/computeControl';
import type { ContextoLibro } from './contexto';
import { bordes, C0, cabecera, celda, COLOR, encabezadoExpediente, FMT, numero, nuevaHoja, rango, titulo } from './estilo';
import type { CeldaCabecera, Estilo, Valor } from './estilo';

/** "Jun-26" → "Jun-2026", como el expediente. */
export const mesLargo = (label: string) => label.replace(/-(\d{2})$/, '-20$1');
const nro = (n: number) => String(n).padStart(2, '0');
const FONDO_SITUACION = 'FFEBF1DE';

/** Inserta un gráfico PNG con la esquina superior izquierda en (fila, col) y devuelve la fila libre siguiente. */
export function insertarImagen(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, png: string, fila: number, col: number, ancho: number, alto: number): number {
    const id = wb.addImage({ base64: png, extension: 'png' });
    ws.addImage(id, { tl: { col: col - 1, row: fila - 1 }, ext: { width: ancho, height: alto } });

    return fila + Math.ceil(alto / 20) + 1;
}

/** Derecha del encabezado con los montos del contrato original y vigente. */
const derechaContrato = (ctx: ContextoLibro): Array<[string, Valor, string?]> => [
    ['MONTO DEL CONTRATO ORIGINAL:', ctx.d.contrato.principal.toNumber(), '#,##0.00 "INCL. IGV"'],
    ['MONTO DEL CONTRATO VIGENTE:', ctx.d.contrato.vigente.toNumber(), '#,##0.00 "INCL. IGV"'],
];

/** CONTROL GEN. AVAN. OBRA.: programado, ejecutado y evaluación del atraso (80 %) por valorización. */
export function hojaControlGeneral(ctx: ContextoLibro): void {
    const { control } = ctx.d;
    const ws = nuevaHoja(ctx.wb, 'CONTROL GEN. AVAN. OBRA.', [8, 11, 13, 13, 9, 10, 13, 13, 9, 10, 11, 11, 11, 12, 13]);
    const ultima = C0 + 14;
    let f = titulo(ws, 1, 'Control general de avance de obra', ultima);
    f = encabezadoExpediente(ws, f + 1, ctx.exp, ultima);
    cabecera(ws, [
        { texto: 'VALORIZACIÓN', fila: f, col: C0, cols: 2, fondo: COLOR.cabecera },
        { texto: 'PROGRAMADO', fila: f, col: C0 + 2, cols: 4, fondo: COLOR.titulo },
        { texto: 'EJECUTADO', fila: f, col: C0 + 6, cols: 4 },
        { texto: 'EVALUACIÓN DEL ATRASO\n(80% DEL PROGRAMADO ACUMULADO)', fila: f, col: C0 + 10, cols: 4, fondo: COLOR.cabeceraGris },
        { texto: 'SITUACIÓN DE LA OBRA', fila: f, col: C0 + 14, filas: 2, fondo: FONDO_SITUACION },
        ...(['Nº', 'MES'] as const).map((texto, i): CeldaCabecera => ({ texto, fila: f + 1, col: C0 + i })),
        ...['MENSUAL', 'ACUMULADO', '% MENSUAL', '% ACUMULADO'].map((texto, i): CeldaCabecera => ({ texto, fila: f + 1, col: C0 + 2 + i, fondo: COLOR.titulo })),
        ...['MENSUAL', 'ACUMULADO', '% MENSUAL', '% ACUMULADO'].map((texto, i): CeldaCabecera => ({ texto, fila: f + 1, col: C0 + 6 + i })),
        ...['% PROGRAMADO ACUMULADO', '80% DEL PROGRAMADO', '% EJECUTADO ACUMULADO', 'CONCLUSIÓN: ATRASO (-) ADELANTO (+)'].map(
            (texto, i): CeldaCabecera => ({ texto, fila: f + 1, col: C0 + 10 + i, fondo: COLOR.cabeceraGris }),
        ),
    ]);
    ws.getRow(f).height = 30;
    ws.getRow(f + 1).height = 42;
    f += 2;
    for (const mes of control.meses) {
        const fondo = mes.periodo.key === ctx.d.mesValorizacion ? COLOR.actual : undefined;
        const e: Estilo = { fondo };
        celda(ws, f, C0, nro(mes.numero), { ...e, alineacion: 'center', borde: 'fino' });
        celda(ws, f, C0 + 1, mesLargo(mes.periodo.label), { ...e, alineacion: 'center', borde: 'fino' });
        numero(ws, f, C0 + 2, mes.programado.mensual, FMT.numero, e);
        numero(ws, f, C0 + 3, mes.programado.acumulado, FMT.numero, e);
        numero(ws, f, C0 + 4, mes.programado.pctMensual, FMT.pct, e);
        numero(ws, f, C0 + 5, mes.programado.pctAcumulado, FMT.pct, e);
        if (mes.ejecutado && mes.evaluacion) {
            numero(ws, f, C0 + 6, mes.ejecutado.mensual, FMT.numero, e);
            numero(ws, f, C0 + 7, mes.ejecutado.acumulado, FMT.numero, e);
            numero(ws, f, C0 + 8, mes.ejecutado.pctMensual, FMT.pct, e);
            numero(ws, f, C0 + 9, mes.ejecutado.pctAcumulado, FMT.pct, e);
            numero(ws, f, C0 + 10, mes.programado.pctAcumulado, FMT.pct, e);
            numero(ws, f, C0 + 11, mes.ochenta, FMT.pct, e);
            numero(ws, f, C0 + 12, mes.ejecutado.pctAcumulado, FMT.pct, e);
            numero(ws, f, C0 + 13, mes.evaluacion.diferencia, FMT.pct, e);
            celda(ws, f, C0 + 14, mes.evaluacion.situacion, { ...e, alineacion: 'center', borde: 'fino' });
        }
        bordes(ws, f, C0, f, ultima);
        f++;
    }
    const ultimaMes = control.ultima;
    const total: Estilo = { negrita: true, tamano: 12 };
    rango(ws, f, C0, f, C0 + 1, 'TOTAL C/IGV', { ...total, alineacion: 'center', borde: 'fino' });
    rango(ws, f, C0 + 2, f, C0 + 3, control.totalProgramado.toNumber(), { ...total, formato: FMT.moneda, alineacion: 'center', borde: 'fino' });
    numero(ws, f, C0 + 4, control.meses.reduce((acc, m) => acc + m.programado.pctMensual.toNumber(), 0), FMT.pct, total);
    rango(ws, f, C0 + 6, f, C0 + 7, control.totalEjecutado.toNumber(), { ...total, formato: FMT.moneda, alineacion: 'center', borde: 'fino' });
    numero(ws, f, C0 + 8, control.pctEjecutado, FMT.pct, total);
    if (ultimaMes?.ejecutado && ultimaMes.evaluacion) {
        numero(ws, f, C0 + 10, ultimaMes.programado.pctAcumulado, FMT.pct, total);
        numero(ws, f, C0 + 11, ultimaMes.ochenta, FMT.pct, total);
        numero(ws, f, C0 + 12, ultimaMes.ejecutado.pctAcumulado, FMT.pct, total);
        numero(ws, f, C0 + 13, ultimaMes.evaluacion.diferencia, FMT.pct, total);
    }
    celda(ws, f, C0 + 14, control.situacionObra, { ...total, alineacion: 'center', ajustar: true, borde: 'fino' });
    bordes(ws, f, C0, f, ultima);
    ws.getRow(f).height = 30;
}

/** Tabla de datos de la Curva S (CURVA S!B32:K38 y CONTROL AVAN. FISICO). */
function tablaCurva(ws: ExcelJS.Worksheet, fila: number, ctx: ContextoLibro): number {
    const { control } = ctx.d;
    cabecera(ws, [
        { texto: 'VALORIZACIÓN', fila, col: C0, cols: 2, fondo: COLOR.cabeceraGris },
        { texto: 'PROGRAMADO', fila, col: C0 + 2, cols: 3, fondo: COLOR.titulo },
        { texto: 'CURVA DEL 80%', fila, col: C0 + 5, filas: 2, fondo: COLOR.cabeceraGris },
        { texto: 'EJECUTADO', fila, col: C0 + 6, cols: 3 },
        { texto: 'ESTADO DE LA OBRA', fila, col: C0 + 9, filas: 2, fondo: FONDO_SITUACION },
        { texto: 'Nº', fila: fila + 1, col: C0, fondo: COLOR.cabeceraGris },
        { texto: 'MES', fila: fila + 1, col: C0 + 1, fondo: COLOR.cabeceraGris },
        ...['MONTO', '% MENSUAL', '% ACUMULADO'].map((texto, i): CeldaCabecera => ({ texto, fila: fila + 1, col: C0 + 2 + i, fondo: COLOR.titulo })),
        ...['MONTO', 'MENSUAL', 'ACUMULADO'].map((texto, i): CeldaCabecera => ({ texto, fila: fila + 1, col: C0 + 6 + i })),
    ]);
    let f = fila + 2;
    control.meses.forEach((mes: ControlMes) => {
        celda(ws, f, C0, nro(mes.numero), { alineacion: 'center', borde: 'fino' });
        celda(ws, f, C0 + 1, mesLargo(mes.periodo.label), { alineacion: 'center', borde: 'fino' });
        numero(ws, f, C0 + 2, mes.programado.mensual);
        numero(ws, f, C0 + 3, mes.programado.pctMensual, FMT.pct);
        numero(ws, f, C0 + 4, mes.programado.pctAcumulado, FMT.pct);
        numero(ws, f, C0 + 5, mes.curva80, FMT.pct);
        if (mes.ejecutado) {
            numero(ws, f, C0 + 6, mes.ejecutado.mensual);
            numero(ws, f, C0 + 7, mes.ejecutado.pctMensual, FMT.pct);
            numero(ws, f, C0 + 8, mes.ejecutado.pctAcumulado, FMT.pct);
            celda(ws, f, C0 + 9, mes.evaluacion?.situacion ?? '', { alineacion: 'center', borde: 'fino' });
        }
        bordes(ws, f, C0, f, C0 + 9);
        f++;
    });
    const total: Estilo = { negrita: true, tamano: 12 };
    rango(ws, f, C0, f, C0 + 1, 'TOTAL', { ...total, alineacion: 'center', borde: 'fino' });
    numero(ws, f, C0 + 2, control.totalProgramado, FMT.numero, total);
    numero(ws, f, C0 + 3, control.meses.reduce((acc, m) => acc + m.programado.pctMensual.toNumber(), 0), FMT.pct, total);
    numero(ws, f, C0 + 6, control.totalEjecutado, FMT.numero, total);
    numero(ws, f, C0 + 7, control.pctEjecutado, FMT.pct, total);
    celda(ws, f, C0 + 9, control.situacionObra, { ...total, alineacion: 'center', ajustar: true, borde: 'fino' });
    bordes(ws, f, C0, f, C0 + 9);
    ws.getRow(f).height = 30;

    return f + 2;
}

const ANCHOS_CURVA = [9, 12, 14, 11, 12, 12, 14, 11, 12, 16];

/** CURVA S: gráfico programado vs ejecutado + tabla de datos. */
export function hojaCurvaS(ctx: ContextoLibro): void {
    const ws = nuevaHoja(ctx.wb, 'CURVA S', ANCHOS_CURVA, true);
    const ultima = C0 + 9;
    let f = titulo(ws, 1, 'Curva S', ultima);
    f = encabezadoExpediente(ws, f + 1, ctx.exp, ultima);
    f = insertarImagen(ctx.wb, ws, ctx.graficos.curvaS, f, C0, 900, 488);
    tablaCurva(ws, f, ctx);
}

/** CONTROL AVAN. FISICO: avance por valorización, acumulado y saldo + tabla de la curva + torta. */
export function hojaControlFisico(ctx: ContextoLibro): void {
    const { control } = ctx.d;
    const ws = nuevaHoja(ctx.wb, 'CONTROL AVAN. FISICO', ANCHOS_CURVA, true);
    const ultima = C0 + 9;
    let f = titulo(ws, 1, 'Control de avance físico de obra', ultima);
    f = encabezadoExpediente(ws, f + 1, ctx.exp, ultima, derechaContrato(ctx));
    rango(ws, f, C0, f, C0 + 3, 'AVANCE FÍSICO', { negrita: true, alineacion: 'center', fondo: COLOR.actual, borde: 'fino' });
    cabecera(ws, ['Nº', 'MES', 'MONTO', '% MENSUAL'].map((texto, i): CeldaCabecera => ({ texto, fila: f + 1, col: C0 + i, fondo: COLOR.actual })));
    f += 2;
    for (const mes of control.meses) {
        celda(ws, f, C0, `VAL. Nº${nro(mes.numero)}`, { alineacion: 'center', borde: 'fino' });
        celda(ws, f, C0 + 1, mesLargo(mes.periodo.label), { alineacion: 'center', borde: 'fino' });
        numero(ws, f, C0 + 2, mes.ejecutado?.mensual ?? null);
        numero(ws, f, C0 + 3, mes.ejecutado?.pctMensual ?? null, FMT.pct);
        f++;
    }
    const total: Estilo = { negrita: true };
    celda(ws, f, C0, 'ACUMULADO', { ...total, borde: 'fino' });
    celda(ws, f, C0 + 1, '', { borde: 'fino' });
    numero(ws, f, C0 + 2, control.totalEjecutado, FMT.numero, total);
    numero(ws, f, C0 + 3, control.pctEjecutado, FMT.pct, total);
    f++;
    celda(ws, f, C0, 'SALDO', { ...total, borde: 'fino' });
    celda(ws, f, C0 + 1, '', { borde: 'fino' });
    numero(ws, f, C0 + 2, control.totalProgramado.sub(control.totalEjecutado), FMT.numero, total);
    numero(ws, f, C0 + 3, control.pctEjecutado.neg().add(1), FMT.pct, total);
    f = tablaCurva(ws, f + 3, ctx);
    insertarImagen(ctx.wb, ws, ctx.graficos.fisico, f, C0 + 1, 720, 492);
}

/** CONTROL FINANCIERO: adelantos y valorizaciones facturables, devengados y pendientes + torta. */
export function hojaControlFinanciero(ctx: ContextoLibro): void {
    const { financiero } = ctx.d;
    const ws = nuevaHoja(ctx.wb, 'CONTROL FINANCIERO', [24, 14, 16, 16, 10, 18], true);
    const ultima = C0 + 5;
    let f = titulo(ws, 1, 'Control de avance financiero de obra', ultima);
    f = encabezadoExpediente(ws, f + 1, ctx.exp, ultima, derechaContrato(ctx));
    cabecera(ws, [
        { texto: 'Nº', fila: f, col: C0, filas: 2 },
        { texto: 'PERIODO', fila: f, col: C0 + 1, filas: 2 },
        { texto: 'MONTO FACTURABLES', fila: f, col: C0 + 2, filas: 2 },
        { texto: 'MONTOS DEVENGADOS', fila: f, col: C0 + 3, cols: 2 },
        { texto: 'MONTOS', fila: f + 1, col: C0 + 3 },
        { texto: '%', fila: f + 1, col: C0 + 4 },
        { texto: 'MONTOS PENDIENTES POR DEVENGAR', fila: f, col: C0 + 5, filas: 2 },
    ]);
    f += 2;
    const seccion = (texto: string) => {
        rango(ws, f, C0, f, ultima, texto, { negrita: true, borde: 'fino' });
        f++;
    };
    const fila = (concepto: string, periodo: string, facturable: Parameters<typeof numero>[3], devengado: Parameters<typeof numero>[3], pct: Parameters<typeof numero>[3], pendiente: Parameters<typeof numero>[3], estilo: Estilo = {}) => {
        celda(ws, f, C0, concepto, { ...estilo, borde: 'fino' });
        celda(ws, f, C0 + 1, periodo, { ...estilo, alineacion: 'center', borde: 'fino' });
        numero(ws, f, C0 + 2, facturable, FMT.numero, estilo);
        numero(ws, f, C0 + 3, devengado, FMT.numero, estilo);
        numero(ws, f, C0 + 4, pct, FMT.pct, estilo);
        numero(ws, f, C0 + 5, pendiente, FMT.numero, estilo);
        f++;
    };
    seccion('A. Adelantos otorgados');
    for (const adelanto of financiero.adelantos) {
        fila(adelanto.concepto, '-', adelanto.facturable, adelanto.devengado, adelanto.pctDevengado, adelanto.facturable.sub(adelanto.devengado));
    }
    seccion('B. Valorizaciones de obra');
    const valorizadas = new Map(financiero.valorizaciones.map((v) => [v.periodo.key, v]));
    for (const mes of ctx.d.control.meses) {
        const v = valorizadas.get(mes.periodo.key);
        fila(`Valorización Nº${nro(mes.numero)}`, mesLargo(mes.periodo.label), v?.facturable ?? null, v?.devengado ?? null, v?.pctDevengado ?? null, v?.pendiente ?? null);
    }
    const fuerte: Estilo = { negrita: true };
    fila('ACUMULADO', '', financiero.acumulado.facturable, financiero.acumulado.devengado, financiero.acumulado.pctDevengado, financiero.acumulado.pendiente, fuerte);
    fila('SALDO', '', financiero.saldo.facturable, financiero.saldo.devengado, financiero.saldo.pctDevengado, financiero.saldo.pendiente, fuerte);
    insertarImagen(ctx.wb, ws, ctx.graficos.financiero, f + 2, C0, 680, 465);
}
