import type Decimal from 'decimal.js';
import type ExcelJS from 'exceljs';
import type { BudgetTotals } from '../../lib/budget';
import { formatMonthShort } from '../../lib/dates';
import { D } from '../../lib/money';
import { montoEnLetrasTexto } from '../../lib/spanishWords';
import type { PagoMensual } from '../../sheets/pagos/computePagos';
import { fmtMoney, fmtPct } from '../../utils/format';
import type { ContextoLibro } from './contexto';
import { bordes, C0, cabecera, celda, COLOR, encabezadoExpediente, fecha, FMT, filasPie, numero, nuevaHoja, rango, titulo } from './estilo';
import type { CampoPie, CeldaCabecera, Estilo } from './estilo';

const FONDO_ANTERIOR = 'FFD9D9D9';
const FONDO_SALDO = 'FFFCE4D6';
const nro = (n: number) => String(n).padStart(2, '0');

/** Párrafo combinado y ajustado, con alto de fila según el largo del texto. */
function parrafo(ws: ExcelJS.Worksheet, fila: number, c1: number, c2: number, texto: string, caracteresPorLinea: number, estilo: Estilo = {}): number {
    rango(ws, fila, c1, fila, c2, texto, { ajustar: true, vertical: 'top', alineacion: 'left', ...estilo });
    ws.getRow(fila).height = 15 * Math.max(1, Math.ceil(texto.length / caracteresPorLinea));

    return fila + 1;
}

type TipoFila = 'total' | 'grupo' | 'sub' | 'final';
interface FilaPago {
    letra?: string;
    etiqueta: string;
    nota?: string;
    tipo: TipoFila;
    valor: (p: PagoMensual) => Decimal;
}

/** Filas A → K del estado de pago (R PAGO MENSUAL y RESUMEN DE LA VALORIZACIÓN). */
const filasPago = (detraccion: string, etiquetaA: string): FilaPago[] => [
    { letra: 'A', etiqueta: etiquetaA, tipo: 'total', valor: (p) => p.a },
    { letra: 'B', etiqueta: 'REAJUSTE DE LA VALORIZACIÓN', tipo: 'grupo', valor: (p) => p.b.total },
    { etiqueta: 'REAJUSTE DEL MES', tipo: 'sub', valor: (p) => p.b.reajusteMes },
    { etiqueta: 'REINTEGRO DEL MES ANTERIOR', tipo: 'sub', valor: (p) => p.b.reintegroMesAnterior },
    { letra: 'C', etiqueta: 'MONTO BRUTO VALORIZADO REAJUSTADO', nota: '(A+B)', tipo: 'total', valor: (p) => p.c },
    { letra: 'D', etiqueta: 'DEDUCCIÓN DEL REAJUSTE QUE NO CORRESPONDE', tipo: 'grupo', valor: (p) => p.d.total },
    { etiqueta: 'POR ADELANTO DIRECTO', nota: '(-)', tipo: 'sub', valor: (p) => p.d.directo },
    { etiqueta: 'POR ADELANTO DE MATERIALES', nota: '(-)', tipo: 'sub', valor: (p) => p.d.materiales },
    { letra: 'E', etiqueta: 'AMORTIZACIÓN POR ADELANTOS', tipo: 'grupo', valor: (p) => p.e.total },
    { etiqueta: 'POR ADELANTO DIRECTO', nota: '(-)', tipo: 'sub', valor: (p) => p.e.directo },
    { etiqueta: 'POR ADELANTO DE MATERIALES', nota: '(-)', tipo: 'sub', valor: (p) => p.e.materiales },
    { letra: 'F', etiqueta: 'MONTO NETO VALORIZADO FACTURABLE', nota: '(C-D-E)', tipo: 'total', valor: (p) => p.f },
    { letra: 'G', etiqueta: 'RETENCIONES', tipo: 'grupo', valor: (p) => p.g.total },
    { etiqueta: 'POR GARANTÍA DE FIEL CUMPLIMIENTO', nota: '(-)', tipo: 'sub', valor: (p) => p.g.rfc },
    { etiqueta: `DETRACCIONES (${fmtPct(detraccion, 0)})`, tipo: 'sub', valor: (p) => p.g.detraccion },
    { letra: 'H', etiqueta: 'PENALIDADES', tipo: 'grupo', valor: (p) => p.h.total },
    { etiqueta: 'POR ATRASO DE OBRA', nota: '(-)', tipo: 'sub', valor: (p) => p.h.atraso },
    { etiqueta: 'OTROS', nota: '(-)', tipo: 'sub', valor: (p) => p.h.otros },
    { letra: 'J', etiqueta: 'MONTO A FACTURAR POR EL CONTRATISTA', nota: '(F)', tipo: 'total', valor: (p) => p.j },
    { letra: 'K', etiqueta: 'MONTO LÍQUIDO A PAGAR AL CONTRATISTA', nota: '(F-G-H)', tipo: 'final', valor: (p) => p.k },
];

/** Etiqueta del pie con su tasa: "GASTOS GENERALES 10.00%". */
const etiquetaPie = (etiqueta: string, tasa: number | null, campo: CampoPie) => (tasa !== null && campo !== 'igv' ? `${etiqueta}   ${fmtPct(tasa)}` : etiqueta);

/** RESUMEN VAL.: valorización por componentes (anterior, actual, acumulado y saldo). */
export function hojaResumenComponentes(ctx: ContextoLibro): void {
    const { resumen, parametros } = ctx.d;
    const ws = nuevaHoja(ctx.wb, 'RESUMEN VAL.', [8, 44, 14, 10, 13, 10, 13, 10, 13, 10, 13]);
    const ultima = C0 + 10;
    let f = titulo(ws, 1, 'Resumen de valorización por componentes', ultima);
    rango(ws, f + 1, C0, f + 1, ultima, ctx.exp.contrato.toUpperCase(), { negrita: true, tamano: 13, alineacion: 'center' });
    f = encabezadoExpediente(ws, f + 3, ctx.exp, ultima, []);
    const bloques = [
        { texto: 'ACUMULADO ANTERIOR', fondo: FONDO_ANTERIOR, pct: '% DE AVANCE' },
        { texto: 'ACTUAL', fondo: COLOR.actual, pct: '% DE AVANCE' },
        { texto: 'ACUMULADO ACTUAL', fondo: FONDO_ANTERIOR, pct: '% DE AVANCE' },
        { texto: 'SALDO', fondo: FONDO_SALDO, pct: '% DE SALDO' },
    ];
    cabecera(ws, [
        { texto: 'ÍTEM', fila: f, col: C0, filas: 2 },
        { texto: 'DESCRIPCIÓN', fila: f, col: C0 + 1, filas: 2 },
        { texto: 'MONTO CONTRATADO', fila: f, col: C0 + 2, filas: 2 },
        ...bloques.flatMap((b, i): CeldaCabecera[] => [
            { texto: b.texto, fila: f, col: C0 + 3 + i * 2, cols: 2, fondo: b.fondo },
            { texto: b.pct, fila: f + 1, col: C0 + 3 + i * 2, fondo: b.fondo },
            { texto: 'MONTO', fila: f + 1, col: C0 + 4 + i * 2, fondo: b.fondo },
        ]),
    ]);
    f += 2;
    const claves = ['anterior', 'actual', 'acumulado', 'saldo'] as const;
    for (const comp of resumen.componentes) {
        celda(ws, f, C0, comp.node.codigo, { alineacion: 'center', borde: 'fino' });
        celda(ws, f, C0 + 1, comp.node.descripcion.toUpperCase(), { borde: 'fino' });
        numero(ws, f, C0 + 2, comp.contratado, FMT.numeroGuion);
        claves.forEach((clave, i) => {
            numero(ws, f, C0 + 3 + i * 2, comp[clave].pct, FMT.pct);
            numero(ws, f, C0 + 4 + i * 2, comp[clave].monto, FMT.numeroGuion);
        });
        f++;
    }
    const pies: Record<(typeof claves)[number] | 'presupuesto', BudgetTotals> = resumen.pies;
    for (const fp of filasPie(parametros, 'MONTO TOTAL VALORIZADO')) {
        const resaltar = fp.campo === 'costoDirecto' || fp.campo === 'total';
        const estilo: Estilo = { negrita: fp.fuerte, fondo: resaltar ? COLOR.verde : undefined };
        celda(ws, f, C0, '', { ...estilo, borde: 'fino' });
        celda(ws, f, C0 + 1, etiquetaPie(fp.etiqueta, fp.tasa, fp.campo), { ...estilo, borde: 'fino' });
        numero(ws, f, C0 + 2, pies.presupuesto[fp.campo], FMT.numeroGuion, estilo);
        claves.forEach((clave, i) => {
            numero(ws, f, C0 + 3 + i * 2, fp.campo === 'subTotal' ? pies[clave].pesoCD : null, FMT.pct, { negrita: true });
            numero(ws, f, C0 + 4 + i * 2, pies[clave][fp.campo], FMT.numeroGuion, estilo);
        });
        f++;
    }
    celda(ws, f, C0 + 1, 'PORCENTAJE DE AVANCE', { borde: 'fino' });
    numero(ws, f, C0 + 2, 1, FMT.pct);
    claves.forEach((clave, i) => numero(ws, f, C0 + 4 + i * 2, pies[clave].pesoCD, FMT.pct));
    bordes(ws, f, C0, f, ultima);
}

/** R.F.C: retención de garantía de fiel cumplimiento (MYPE). */
export function hojaRetencion(ctx: ContextoLibro): void {
    const { rfc, input } = ctx.d;
    const config = input.pagos.rfc;
    const ws = nuevaHoja(ctx.wb, 'R.F.C', [10, 16, 20, 22, 20], true);
    const ultima = C0 + 4;
    let f = titulo(ws, 1, 'Retención de garantía de fiel cumplimiento', ultima);
    f = encabezadoExpediente(ws, f + 1, ctx.exp, ultima, []);
    rango(ws, f - 1, C0, f - 1, C0 + 1, 'Monto del contrato:', { negrita: true });
    celda(ws, f - 1, C0 + 2, rfc.contrato.toNumber(), { formato: FMT.moneda, alineacion: 'left' });
    f++;
    const programadaEn = config.modo === 'primer-pago' ? 'en el primer pago, es decir, en la primera valorización' : 'en forma prorrateada durante la primera mitad del número de pagos a realizarse';
    const letras = montoEnLetrasTexto(rfc.total);
    f = parrafo(ws, f, C0, ultima, 'Según el REGLAMENTO DE LA LEY GENERAL DE CONTRATACIONES PÚBLICAS:', 95, { negrita: true });
    f = parrafo(
        ws,
        f,
        C0,
        ultima,
        `El ${input.fichaTecnica.contratista.ejecutor} con el objetivo de cumplir con el Artículo 114 del Reglamento de la Ley N°32069, Ley General de Contrataciones Públicas, en los contratos de ejecución de obras que celebren las Entidades con las micro y pequeñas empresas (MYPES), estas últimas pueden otorgar como Garantía de Fiel Cumplimiento el ${fmtPct(config.porcentaje, 0)} del monto del contrato original, cuyo monto asciende a ${fmtMoney(rfc.total)} (${letras}) incluido IGV, porcentaje que es retenido por la Entidad durante la primera mitad del número de pagos a realizarse, en forma prorrateada, con cargo a ser devuelto en la liquidación de la Obra.`,
        95,
    );
    f = parrafo(ws, f, C0, ultima, `En ese sentido, se PROGRAMÓ realizar la RETENCIÓN DE GARANTÍA DE FIEL CUMPLIMIENTO ${programadaEn}, por un monto de retención total de ${fmtMoney(rfc.total)} (${letras}) incluido IGV.`, 95);
    f++;
    rango(ws, f, C0, f, C0 + 1, 'MONTO DEL CONTRATO:', {});
    celda(ws, f, C0 + 2, rfc.contrato.toNumber(), { formato: FMT.moneda, alineacion: 'right' });
    rango(ws, f + 1, C0, f + 1, C0 + 1, `TOTAL DE RETENCIÓN (${fmtPct(config.porcentaje)}):`, {});
    celda(ws, f + 1, C0 + 2, rfc.total.toNumber(), { formato: FMT.moneda, alineacion: 'right' });
    f += 3;
    cabecera(ws, ['Nº', 'MES', 'MONTO VALORIZADO', 'RETENCIÓN MENSUAL PROGRAMADA', 'RETENCIÓN EFECTIVA'].map((texto, i): CeldaCabecera => ({ texto, fila: f, col: C0 + i })));
    ws.getRow(f).height = 30;
    f++;
    for (const mes of rfc.meses) {
        const fondo = mes.periodo.key === ctx.d.mesValorizacion ? COLOR.verde : undefined;
        celda(ws, f, C0, nro(mes.numero), { alineacion: 'center', borde: 'fino', fondo });
        celda(ws, f, C0 + 1, mes.periodo.label, { alineacion: 'center', borde: 'fino', fondo });
        numero(ws, f, C0 + 2, mes.valorizado, FMT.numeroGuion, { fondo });
        numero(ws, f, C0 + 3, mes.programada, FMT.numeroGuion, { fondo });
        numero(ws, f, C0 + 4, mes.efectiva, FMT.numeroGuion, { fondo });
        f++;
    }
    f++;
    const resumen: Array<[string, Decimal]> = [
        ['RETENCIÓN ANTERIOR ACUMULADA', rfc.anteriorAcumulada],
        ['RETENCIÓN ACTUAL', rfc.actual],
        ['RETENCIÓN ACTUAL ACUMULADA', rfc.actualAcumulada],
        ['SALDO POR RETENER', rfc.saldoPorRetener],
    ];
    for (const [etiqueta, valor] of resumen) {
        rango(ws, f, C0, f, C0 + 3, etiqueta, { borde: 'fino' });
        numero(ws, f, C0 + 4, valor, FMT.numeroGuion);
        f++;
    }
    f++;
    rango(ws, f, C0, f, C0 + 3, 'TOTAL A RETENERSE POR GARANTÍA DE FIEL CUMPLIMIENTO:', { negrita: true, alineacion: 'right' });
    celda(ws, f, C0 + 4, rfc.actual.toNumber(), { negrita: true, formato: FMT.moneda, fondo: COLOR.amarillo, alineacion: 'right' });
}

const TONO: Record<TipoFila, Estilo> = {
    total: { negrita: true },
    grupo: { negrita: true },
    sub: {},
    final: { negrita: true, tamano: 12 },
};

/** Texto de cierre: "El monto a facturar por el contratista … asciende a la suma de S/ …". */
const textoFacturar = (ctx: ContextoLibro, monto: Decimal) =>
    `El monto a facturar por el contratista ejecutor ${ctx.d.input.fichaTecnica.contratista.ejecutor} en la presente VALORIZACIÓN N°${ctx.numero} DEL MES DE ${ctx.mesTexto}, asciende a la suma de ${fmtMoney(monto)} (${montoEnLetrasTexto(monto)}) incluido IGV.`;

/** R PAGO MENSUAL: componentes del mes + pie + estado de pago A → K. */
export function hojaResumenPago(ctx: ContextoLibro): void {
    const { resumen, parametros, acumulados, input } = ctx.d;
    const pago = acumulados.actual;
    const ws = nuevaHoja(ctx.wb, 'R PAGO MENSUAL', [8, 56, 11, 20], true);
    const ultima = C0 + 3;
    let f = titulo(ws, 1, `Resumen de pago de la valorización N°${ctx.numero} del mes de ${ctx.mesTexto}`, ultima);
    ws.getRow(1).height = 34;
    ws.getCell(1, C0).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    f = encabezadoExpediente(ws, f + 1, ctx.exp, ultima, []);
    cabecera(ws, [
        { texto: 'ITEM', fila: f, col: C0 },
        { texto: 'DESCRIPCIÓN', fila: f, col: C0 + 1, cols: 2 },
        { texto: 'MONTO', fila: f, col: C0 + 3 },
    ]);
    f++;
    for (const comp of resumen.componentes) {
        celda(ws, f, C0, comp.node.codigo, { alineacion: 'center', borde: 'fino' });
        celda(ws, f, C0 + 1, comp.node.descripcion.toUpperCase(), { borde: 'fino' });
        numero(ws, f, C0 + 2, comp.actual.pct, FMT.pct);
        numero(ws, f, C0 + 3, comp.actual.monto, FMT.moneda);
        f++;
    }
    for (const fp of filasPie(parametros)) {
        if (fp.campo === 'total') {
            continue;
        }
        const estilo: Estilo = { negrita: fp.fuerte };
        celda(ws, f, C0, '', { borde: 'fino' });
        celda(ws, f, C0 + 1, fp.etiqueta, { ...estilo, borde: 'fino' });
        numero(ws, f, C0 + 2, fp.tasa, '0.000%', estilo);
        numero(ws, f, C0 + 3, resumen.pies.actual[fp.campo], FMT.moneda, estilo);
        f++;
    }
    for (const fila of filasPago(input.pagos.porcentajeDetraccion, 'VALORIZACIÓN DEL MES SIN REAJUSTE')) {
        const estilo: Estilo = { ...TONO[fila.tipo], fondo: fila.tipo === 'final' || fila.letra === 'J' ? COLOR.actual : undefined };
        celda(ws, f, C0, fila.letra ?? '', { ...estilo, alineacion: 'center', borde: 'fino' });
        celda(ws, f, C0 + 1, fila.etiqueta, { ...estilo, borde: 'fino' });
        if (fila.letra === 'A') {
            numero(ws, f, C0 + 2, resumen.pies.actual.pesoCD, FMT.pct, estilo);
        } else {
            celda(ws, f, C0 + 2, fila.nota ?? '', { ...estilo, alineacion: 'center', borde: 'fino' });
        }
        numero(ws, f, C0 + 3, fila.valor(pago), FMT.moneda, estilo);
        if (fila.tipo === 'final' || fila.letra === 'J') {
            ws.getRow(f).height = 24;
        }
        f++;
    }
    parrafo(ws, f + 1, C0, ultima, textoFacturar(ctx, pago.j), 100);
}

/** PAGOS ACUMULADOS ("RESUMEN DE LA VALORIZACIÓN N°…"): contratado, anterior, actual, acumulado y saldo. */
export function hojaPagosAcumulados(ctx: ContextoLibro): void {
    const { resumen, parametros, acumulados, input } = ctx.d;
    const ws = nuevaHoja(ctx.wb, 'PAGOS ACUMULADOS', [7, 46, 9, 14, 14, 14, 14, 14], true);
    const ultima = C0 + 7;
    let f = titulo(ws, 1, `Resumen de la valorización N°${ctx.numero} del mes de ${ctx.mesTexto}`, ultima);
    f = encabezadoExpediente(ws, f + 1, ctx.exp, ultima, []);
    cabecera(ws, [
        { texto: 'ÍTEM', fila: f, col: C0 },
        { texto: 'DESCRIPCIÓN DE SUB PRESUPUESTOS', fila: f, col: C0 + 1, cols: 2 },
        ...['MONTO CONTRATADO', 'ACUMULADO ANTERIOR', 'ACTUAL', 'ACUMULADO ACTUAL', 'SALDO POR PAGAR'].map((texto, i): CeldaCabecera => ({ texto, fila: f, col: C0 + 3 + i })),
    ]);
    ws.getRow(f).height = 30;
    f++;
    for (const comp of resumen.componentes) {
        celda(ws, f, C0, comp.node.codigo, { alineacion: 'center', borde: 'fino' });
        rango(ws, f, C0 + 1, f, C0 + 2, comp.node.descripcion.toUpperCase(), { borde: 'fino' });
        [comp.contratado, comp.anterior.monto, comp.actual.monto, comp.acumulado.monto, comp.saldo.monto].forEach((valor, i) => numero(ws, f, C0 + 3 + i, valor, FMT.numeroGuion));
        f++;
    }
    const columnasPie = [resumen.pies.presupuesto, resumen.pies.anterior, resumen.pies.actual, resumen.pies.acumulado, resumen.pies.saldo];
    for (const fp of filasPie(parametros)) {
        if (fp.campo === 'total') {
            continue;
        }
        const estilo: Estilo = { negrita: fp.fuerte, fondo: fp.campo === 'costoDirecto' ? COLOR.verde : undefined };
        celda(ws, f, C0, '', { borde: 'fino' });
        celda(ws, f, C0 + 1, fp.etiqueta, { ...estilo, fondo: undefined, borde: 'fino' });
        numero(ws, f, C0 + 2, fp.tasa, '0.000%');
        columnasPie.forEach((totales, i) => numero(ws, f, C0 + 3 + i, totales[fp.campo], FMT.numeroGuion, estilo));
        f++;
    }
    const pagos = [acumulados.contratado, acumulados.anterior, acumulados.actual, acumulados.acumulado, acumulados.saldo];
    for (const fila of filasPago(input.pagos.porcentajeDetraccion, 'VALORIZACIÓN MENSUAL')) {
        const fondo = fila.tipo === 'grupo' ? COLOR.rosa : fila.tipo === 'total' || fila.tipo === 'final' ? COLOR.verde : undefined;
        const estilo: Estilo = { ...TONO[fila.tipo], tamano: 11 };
        celda(ws, f, C0, fila.letra ?? '', { ...estilo, alineacion: 'center', borde: 'fino' });
        celda(ws, f, C0 + 1, fila.etiqueta, { ...estilo, borde: 'fino' });
        if (fila.letra === 'A') {
            numero(ws, f, C0 + 2, resumen.pies.actual.pesoCD, FMT.pct, estilo);
        } else {
            celda(ws, f, C0 + 2, fila.nota ?? '', { ...estilo, alineacion: 'center', borde: 'fino' });
        }
        pagos.forEach((pago, i) => numero(ws, f, C0 + 3 + i, fila.valor(pago), FMT.numeroGuion, { ...estilo, fondo }));
        f++;
    }
    parrafo(ws, f + 1, C0, ultima, textoFacturar(ctx, acumulados.actual.j), 120);
}

/** CONTROL DE PAGOS: valorizaciones tramitadas y pagadas, adicionales y adelantos. */
export function hojaControlPagos(ctx: ContextoLibro): void {
    const { controlPagos, adicionales, control, input } = ctx.d;
    const ws = nuevaHoja(ctx.wb, 'CONTROL DE PAGOS', [6, 10, 13, 11, 13, 11, 11, 13, 12, 11, 12, 13, 11, 12, 11]);
    const ultima = C0 + 14;
    let f = titulo(ws, 1, 'Resumen de valorizaciones tramitadas y pagadas', ultima);
    f = encabezadoExpediente(ws, f + 1, ctx.exp, ultima);

    const encabezadoTabla = (fila: number, rotulo: string, fondo?: string): number => {
        rango(ws, fila, C0, fila, ultima, rotulo, { negrita: true });
        const r = fila + 1;
        cabecera(ws, [
            { texto: rotulo === 'CONTRATO PRINCIPAL' ? 'VALORIZACIONES CONTRACTUALES' : 'VALORIZACIONES DE ADICIONAL', fila: r, col: C0, cols: 4, fondo },
            { texto: 'VALORIZACIÓN BRUTA', fila: r, col: C0 + 4, filas: 2, fondo },
            { texto: 'AMORTIZACIONES', fila: r, col: C0 + 5, cols: 2, fondo },
            { texto: 'VALORIZACIÓN NETA FACTURABLE', fila: r, col: C0 + 7, filas: 2, fondo },
            { texto: rotulo === 'CONTRATO PRINCIPAL' ? 'RETENCIONES (G.F.C)' : 'G.F.C.', fila: r, col: C0 + 8, filas: 2, fondo },
            { texto: 'PENALIDADES', fila: r, col: C0 + 9, filas: 2, fondo },
            { texto: rotulo === 'CONTRATO PRINCIPAL' ? 'DETRACCIONES' : 'IGV', fila: r, col: C0 + 10, filas: 2, fondo },
            { texto: rotulo === 'CONTRATO PRINCIPAL' ? 'MONTO LÍQUIDO PAGADO' : 'MONTO NETO TOTAL', fila: r, col: C0 + 11, filas: 3, fondo },
            { texto: 'COMPROBANTES DE PAGO', fila: r, col: C0 + 12, cols: 3, fondo },
            { texto: 'Nro', fila: r + 1, col: C0, filas: 2, fondo },
            { texto: 'MES', fila: r + 1, col: C0 + 1, filas: 2, fondo },
            { texto: 'MONTO', fila: r + 1, col: C0 + 2, fondo },
            { texto: 'REAJUSTE', fila: r + 1, col: C0 + 3, fondo },
            { texto: 'DIRECTO', fila: r + 1, col: C0 + 5, fondo },
            { texto: 'MATERIALES', fila: r + 1, col: C0 + 6, fondo },
            { texto: 'FACTURA Nro.', fila: r + 1, col: C0 + 12, filas: 2, fondo },
            { texto: 'COMPROBANTE Nro.', fila: r + 1, col: C0 + 13, filas: 2, fondo },
            { texto: 'FECHA DE PAGO', fila: r + 1, col: C0 + 14, filas: 2, fondo },
            ...['(V)', '(R)', 'Vb=V+R', '(D)', '(M)', 'Vn=Vb-(D+M)', '(G)', '(P)', rotulo === 'CONTRATO PRINCIPAL' ? '(D)' : ''].map(
                (texto, i): CeldaCabecera => ({ texto, fila: r + 2, col: C0 + 2 + i, fondo }),
            ),
        ]);
        ws.getRow(r).height = 30;

        return r + 3;
    };

    const montos = (fila: number, valores: Array<Decimal | null>, estilo: Estilo = {}) => valores.forEach((valor, i) => numero(ws, fila, C0 + 2 + i, valor, FMT.numeroGuion, estilo));

    f = encabezadoTabla(f, 'CONTRATO PRINCIPAL');
    const porMes = new Map(controlPagos.filas.map((fila) => [fila.periodo.key, fila]));
    control.meses.forEach((mes) => {
        const fila = porMes.get(mes.periodo.key);
        const fondo = mes.periodo.key === ctx.d.mesValorizacion ? COLOR.actual : undefined;
        celda(ws, f, C0, mes.numero, { alineacion: 'center', borde: 'fino', fondo });
        celda(ws, f, C0 + 1, mes.periodo.label, { alineacion: 'center', borde: 'fino', fondo });
        const cero = D(0);
        montos(
            f,
            fila
                ? [fila.monto, fila.reajuste, fila.bruta, fila.amortizacionDirecto, fila.amortizacionMateriales, fila.neta, fila.retencion, fila.penalidades, fila.detraccion, fila.liquido]
                : Array.from({ length: 10 }, () => cero),
            { fondo },
        );
        celda(ws, f, C0 + 12, fila?.ajustes.facturaNro ?? '', { alineacion: 'center', borde: 'fino', fondo });
        celda(ws, f, C0 + 13, fila?.ajustes.comprobanteNro ?? '', { alineacion: 'center', borde: 'fino', fondo });
        celda(ws, f, C0 + 14, fecha(fila?.ajustes.fechaPago), { formato: FMT.fecha, alineacion: 'center', borde: 'fino', fondo });
        ws.getRow(f).height = 22;
        f++;
    });
    const t = controlPagos.total;
    rango(ws, f, C0, f, C0 + 1, 'TOTAL', { negrita: true, alineacion: 'center', borde: 'fino' });
    montos(f, [t.monto, t.reajuste, t.bruta, t.amortizacionDirecto, t.amortizacionMateriales, t.neta, t.retencion, t.penalidades, t.detraccion, t.liquido], { negrita: true });
    bordes(ws, f, C0, f, ultima);
    ws.getRow(f).height = 24;
    f += 3;

    f = encabezadoTabla(f, 'ADICIONALES, COSTO ADICIONALES, MAYORES GASTOS GENERALES, INTERESES Y OTROS', COLOR.cabeceraGris);
    if (adicionales.filas.length === 0) {
        control.meses.forEach((mes) => {
            celda(ws, f, C0, mes.numero, { alineacion: 'center', borde: 'fino' });
            celda(ws, f, C0 + 1, mes.periodo.label, { alineacion: 'center', borde: 'fino' });
            montos(f, Array.from({ length: 10 }, () => D(0)));
            bordes(ws, f, C0, f, ultima);
            f++;
        });
    }
    adicionales.filas.forEach((fila, i) => {
        const a = fila.adicional;
        celda(ws, f, C0, i + 1, { alineacion: 'center', borde: 'fino' });
        celda(ws, f, C0 + 1, formatMonthShort(`${a.mes}-01`), { alineacion: 'center', borde: 'fino' });
        montos(f, [D(a.monto || 0), D(a.reajuste || 0), fila.bruta, D(a.amortizacionDirecto || 0), D(a.amortizacionMateriales || 0), fila.neta, D(a.retencion || 0), D(a.penalidades || 0), fila.igv, fila.total]);
        celda(ws, f, C0 + 12, a.facturaNro, { alineacion: 'center', borde: 'fino' });
        celda(ws, f, C0 + 13, a.comprobanteNro, { alineacion: 'center', borde: 'fino' });
        celda(ws, f, C0 + 14, fecha(a.fechaPago), { formato: FMT.fecha, alineacion: 'center', borde: 'fino' });
        f++;
    });
    const ta = adicionales.total;
    rango(ws, f, C0, f, C0 + 1, 'TOTAL', { negrita: true, alineacion: 'center', borde: 'fino' });
    montos(f, [ta.monto, null, ta.bruta, null, null, ta.neta, null, null, ta.igv, ta.total], { negrita: true });
    bordes(ws, f, C0, f, ultima);
    f += 3;

    // Adelantos (c/IGV), a la derecha como en el expediente.
    const { adelantoDirecto, adelantoMateriales } = input.fichaTecnica.contratista;
    const ci = C0 + 8;
    cabecera(ws, [
        { texto: 'ADELANTOS (C/IGV)', fila: f, col: ci, cols: 3, fondo: COLOR.cabeceraGris },
        { texto: 'MONTO NETO', fila: f, col: ci + 3, fondo: COLOR.cabeceraGris },
        { texto: 'COMPROBANTES DE PAGO', fila: f, col: ci + 4, cols: 3, fondo: COLOR.cabeceraGris },
        ...['Nro.', 'DIRECTO', 'MATERIALES', 'TOTAL', 'FACTURA Nro.', 'COMPROBANTE Nro.', 'FECHA DE PAGO'].map((texto, i): CeldaCabecera => ({ texto, fila: f + 1, col: ci + i, fondo: COLOR.cabeceraGris })),
    ]);
    f += 2;
    const directo = D(adelantoDirecto.monto ?? 0);
    const materiales = D(adelantoMateriales.monto ?? 0);
    [
        [directo, null],
        [null, materiales],
    ].forEach(([dir, mat], i) => {
        celda(ws, f, ci, i + 1, { alineacion: 'center', borde: 'fino' });
        numero(ws, f, ci + 1, dir, FMT.numeroGuion);
        numero(ws, f, ci + 2, mat, FMT.numeroGuion);
        numero(ws, f, ci + 3, dir ?? mat, FMT.numeroGuion);
        bordes(ws, f, ci, f, ultima);
        f++;
    });
    celda(ws, f, ci, 'TOTAL', { negrita: true, alineacion: 'center', borde: 'fino' });
    numero(ws, f, ci + 1, directo, FMT.numeroGuion, { negrita: true });
    numero(ws, f, ci + 2, materiales, FMT.numeroGuion, { negrita: true });
    numero(ws, f, ci + 3, directo.add(materiales), FMT.numeroGuion, { negrita: true });
    bordes(ws, f, ci, f, ultima);
    f += 3;

    // Total general (contrato principal + adicionales).
    rango(ws, f, C0, f, C0 + 1, 'TOTAL', { negrita: true, alineacion: 'center', borde: 'medio' });
    montos(
        f,
        [t.monto.add(ta.monto), t.reajuste, t.bruta.add(ta.bruta), t.amortizacionDirecto, t.amortizacionMateriales, t.neta.add(ta.neta), t.retencion, t.penalidades, t.detraccion, t.liquido.add(ta.total)],
        { negrita: true, tamano: 12 },
    );
    bordes(ws, f, C0, f, ultima);
    ws.getRow(f).height = 26;
}
