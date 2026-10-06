import type Decimal from 'decimal.js';
import type ExcelJS from 'exceljs';
import type { BudgetTotals } from '../../lib/budget';
import { D } from '../../lib/money';
import type { PartidaNode } from '../../lib/partidaTree';
import type { Periodo } from '../../lib/periodos';
import type { CalendarioCalculado } from '../../sheets/calendario/computeCalendario';
import type { PresupuestoFila } from '../../sheets/presupuesto/computePresupuesto';
import type { ParametrosPresupuesto } from '../../types';
import type { ContextoLibro } from './contexto';
import { bordes, C0, cabecera, celda, COLOR, encabezadoExpediente, fecha as fechaIso, FMT, filasPie, itemArbol, numero, nuevaHoja, rango, subtitulo, titulo } from './estilo';
import type { CeldaCabecera, Estilo } from './estilo';

/** Columnas fijas de las hojas con árbol: ítem, descripción y presupuesto (und, metrado, P.U., total). */
const ANCHOS_PRESUPUESTO = [11, 62, 6, 10, 10, 12];

/** Congela ítem/descripción y la cabecera; la cabecera se repite al imprimir. */
function congelar(ws: ExcelJS.Worksheet, filaCabeceraIni: number, filaCabeceraFin: number): void {
    ws.views = [{ state: 'frozen', xSplit: C0 + 1, ySplit: filaCabeceraFin, showGridLines: false }];
    ws.pageSetup.printTitlesRow = `${filaCabeceraIni}:${filaCabeceraFin}`;
}

interface ValorCelda {
    v: Decimal | number | null | undefined;
    formato?: string;
    estilo?: Estilo;
}

/** Filas del árbol: ítem + descripción coloreados y, desde `colIni`, los valores. */
function escribirArbol(ws: ExcelJS.Worksheet, fila: number, nodos: PartidaNode[], colIni: number, ultimaCol: number, valores: (node: PartidaNode) => Array<ValorCelda | null>): number {
    for (const node of nodos) {
        itemArbol(ws, fila, node);
        valores(node).forEach((valor, i) => {
            if (valor) {
                numero(ws, fila, colIni + i, valor.v, valor.formato ?? FMT.numero, { negrita: !node.esHoja, ...valor.estilo });
            }
        });
        bordes(ws, fila, colIni, fila, ultimaCol);
        fila++;
    }

    return fila;
}

/** Metrado, P.U. y total de una partida (los títulos solo su subtotal o nada). */
function presupuestoDe(fila: PresupuestoFila | undefined, subtotalTitulos: boolean): Array<ValorCelda | null> {
    if (!fila) {
        return [null, null, null];
    }
    if (!fila.node.esHoja) {
        return [null, null, subtotalTitulos ? { v: fila.total } : null];
    }

    return [{ v: fila.metrado }, { v: fila.precioUnitario }, { v: fila.total }];
}

function unidad(ws: ExcelJS.Worksheet, fila: number, nodos: PartidaNode[]): void {
    nodos.forEach((node, i) => {
        celda(ws, fila + i, C0 + 2, node.esHoja ? (node.unidad ?? '') : '', { alineacion: 'center', borde: 'fino' });
    });
}

interface ColumnaPie {
    col: number;
    totales: BudgetTotals;
    /** Columna donde va el % del costo directo en la fila SUB TOTAL. */
    colPct?: number;
}

/**
 * Pie presupuestal CD → TOTAL. Etiqueta en la descripción, tasa en la columna
 * de unidad y montos en cada columna indicada; al final la fila del avance.
 */
function escribirPie(ws: ExcelJS.Worksheet, fila: number, parametros: ParametrosPresupuesto, columnas: ColumnaPie[], ultimaCol: number, opciones: { totalLabel?: string; avanceLabel?: string; fondo?: (campo: string) => string | undefined } = {}): number {
    const inicio = fila;
    for (const fp of filasPie(parametros, opciones.totalLabel)) {
        const estilo: Estilo = { negrita: fp.fuerte, fondo: opciones.fondo?.(fp.campo) };
        celda(ws, fila, C0 + 1, fp.etiqueta, { ...estilo, borde: 'fino' });
        if (fp.tasa !== null && fp.campo !== 'igv') {
            numero(ws, fila, C0 + 2, fp.tasa, FMT.pct, { ...estilo });
        }
        for (const columna of columnas) {
            numero(ws, fila, columna.col, columna.totales[fp.campo], FMT.numero, estilo);
            if (columna.colPct && fp.campo === 'subTotal') {
                numero(ws, fila, columna.colPct, columna.totales.pesoCD, FMT.pct, { negrita: true });
            }
        }
        bordes(ws, fila, C0, fila, ultimaCol);
        fila++;
    }
    if (opciones.avanceLabel) {
        celda(ws, fila, C0 + 1, opciones.avanceLabel, { borde: 'fino' });
        for (const columna of columnas) {
            numero(ws, fila, columna.col, columna.totales.pesoCD, FMT.pct);
        }
        bordes(ws, fila, C0, fila, ultimaCol);
        fila++;
    }
    // Separación visual con el cuerpo de la tabla.
    for (let c = C0; c <= ultimaCol; c++) {
        ws.getCell(inicio, c).border = { ...ws.getCell(inicio, c).border, top: { style: 'medium' } };
    }

    return fila;
}

const cabeceraPresupuesto = (fila: number, filas: number): CeldaCabecera[] => [
    { texto: 'ITEM', fila, col: C0, filas },
    { texto: 'DESCRIPCIÓN', fila, col: C0 + 1, filas },
    { texto: 'PRESUPUESTO DE OBRA', fila, col: C0 + 2, cols: 4, filas: filas - 1 },
    { texto: 'UND', fila: fila + filas - 1, col: C0 + 2 },
    { texto: 'METRADO', fila: fila + filas - 1, col: C0 + 3 },
    { texto: 'P.UND', fila: fila + filas - 1, col: C0 + 4 },
    { texto: 'TOTAL', fila: fila + filas - 1, col: C0 + 5 },
];

/** Escribe ítem…total de todas las partidas; devuelve la fila siguiente. */
function cuerpoPresupuesto(ws: ExcelJS.Worksheet, fila: number, ctx: ContextoLibro, ultimaCol: number, subtotalTitulos: boolean, extra: (node: PartidaNode) => Array<ValorCelda | null> = () => []): number {
    const nodos = ctx.d.presupuesto.tree.ordered;
    unidad(ws, fila, nodos);

    return escribirArbol(ws, fila, nodos, C0 + 3, ultimaCol, (node) => {
        return [...presupuestoDe(ctx.d.presupuesto.porId.get(node.id), subtotalTitulos), ...extra(node)];
    });
}

/** PRESUPUESTO DE OBRA. */
export function hojaPresupuesto(ctx: ContextoLibro): void {
    const ws = nuevaHoja(ctx.wb, 'PRESUPUESTO', ANCHOS_PRESUPUESTO, true);
    const ultima = C0 + 5;
    let f = titulo(ws, 1, 'Presupuesto de obra', ultima);
    f = subtitulo(ws, f + 1, ctx.exp.contrato, ultima);
    f = encabezadoExpediente(ws, f + 1, ctx.exp, ultima, []);
    cabecera(ws, cabeceraPresupuesto(f, 2));
    congelar(ws, f, f + 1);
    f = cuerpoPresupuesto(ws, f + 2, ctx, ultima, true);
    escribirPie(ws, f, ctx.d.parametros, [{ col: C0 + 5, totales: ctx.d.presupuesto.totales }], ultima);
}

/** Cabecera de un mes en los calendarios: "Jun-26" / inicio – fin / PORCEN. – COSTO. */
function cabeceraMes(fila: number, col: number, periodo: Periodo, fondo?: string, color?: string): CeldaCabecera[] {
    return [
        { texto: periodo.label, fila, col, cols: 2, fondo, color },
        { texto: '', fila: fila + 1, col, fondo, color },
        { texto: '', fila: fila + 1, col: col + 1, fondo, color },
        { texto: 'PORCEN. (%)', fila: fila + 2, col, fondo, color },
        { texto: 'COSTO (S/)', fila: fila + 2, col: col + 1, fondo, color },
    ];
}

/** Fechas de inicio y fin del mes en la segunda fila de la cabecera, como fechas reales. */
function fechasMes(ws: ExcelJS.Worksheet, fila: number, col: number, periodo: Periodo): void {
    for (const [i, iso] of [periodo.inicio, periodo.fin].entries()) {
        const c = ws.getCell(fila, col + i);
        c.value = fechaIso(iso);
        c.numFmt = 'd-mmm-yy';
    }
}

/** CALEN. PROG. / CALEN. VALO.: presupuesto + % y costo por mes. */
function hojaCalendario(ctx: ContextoLibro, calendario: CalendarioCalculado, nombre: string, tituloHoja: string): void {
    const meses = calendario.meses;
    const ws = nuevaHoja(ctx.wb, nombre, [...ANCHOS_PRESUPUESTO, ...meses.flatMap(() => [9, 11])]);
    const ultima = C0 + 5 + meses.length * 2;
    let f = titulo(ws, 1, tituloHoja, ultima);
    f = encabezadoExpediente(ws, f + 1, ctx.exp, ultima);
    cabecera(ws, [...cabeceraPresupuesto(f, 3), ...meses.flatMap((mes, i) => cabeceraMes(f, C0 + 6 + i * 2, mes.periodo, mes.periodo.key === ctx.d.mesValorizacion ? COLOR.actual : undefined))]);
    meses.forEach((mes, i) => fechasMes(ws, f + 1, C0 + 6 + i * 2, mes.periodo));
    congelar(ws, f, f + 2);
    f = cuerpoPresupuesto(ws, f + 3, ctx, ultima, false, (node) => {
        const fila = calendario.porId.get(node.id);

        return meses.flatMap((mes): Array<ValorCelda | null> => {
            const celdaMes = node.esHoja ? fila?.meses[mes.periodo.key] : undefined;

            return [celdaMes?.pct ? { v: celdaMes.pct, formato: FMT.pct } : null, celdaMes?.monto ? { v: celdaMes.monto } : null];
        });
    });
    escribirPie(
        ws,
        f,
        ctx.d.parametros,
        [{ col: C0 + 5, totales: ctx.d.presupuesto.totales }, ...meses.map((mes, i) => ({ col: C0 + 7 + i * 2, totales: mes.totales, colPct: C0 + 6 + i * 2 }))],
        ultima,
        { totalLabel: 'MONTO VALORIZADO MENSUAL', avanceLabel: 'AVANCE FÍSICO MENSUAL' },
    );
}

export function hojaCalendarioProgramado(ctx: ContextoLibro): void {
    hojaCalendario(ctx, ctx.d.programado, 'CALEN. PROG.', 'Calendario de avance de obra valorizado programado adecuado al inicio de la obra');
}

export function hojaCalendarioEjecutado(ctx: ContextoLibro): void {
    hojaCalendario(ctx, ctx.d.ejecutado, 'CALEN. VALO.', 'Calendario de avance de obra valorizado ejecutado');
}

/** METRADOS: metrado contratado, metrado de cada mes hasta el valorizado, acumulado y saldo. */
export function hojaMetrados(ctx: ContextoLibro): void {
    const { d } = ctx;
    const meses = d.periodos.filter((periodo) => periodo.key <= d.mesValorizacion);
    const ws = nuevaHoja(ctx.wb, 'METRADOS', [11, 62, 6, 11, ...meses.map(() => 11), 12, 12], true);
    const ultima = C0 + 5 + meses.length;
    let f = titulo(ws, 1, 'Resumen de metrados ejecutados en el presente mes', ultima);
    f = encabezadoExpediente(ws, f + 1, ctx.exp, ultima);
    cabecera(ws, [
        { texto: 'ITEM', fila: f, col: C0, filas: 2 },
        { texto: 'DESCRIPCIÓN', fila: f, col: C0 + 1, filas: 2 },
        { texto: 'METRADO CONTRATADO', fila: f, col: C0 + 2, cols: 2 },
        { texto: 'UND', fila: f + 1, col: C0 + 2 },
        { texto: 'METRADO', fila: f + 1, col: C0 + 3 },
        ...meses.flatMap((periodo, i): CeldaCabecera[] => {
            const actual = periodo.key === d.mesValorizacion;
            const fondo = actual ? COLOR.mesActual : undefined;
            const color = actual ? COLOR.blanco : undefined;

            return [
                { texto: periodo.label, fila: f, col: C0 + 4 + i, fondo, color },
                { texto: 'METRADO', fila: f + 1, col: C0 + 4 + i, fondo, color },
            ];
        }),
        { texto: 'METRADO ACUMULADO', fila: f, col: ultima - 1, filas: 2 },
        { texto: 'SALDO POR METRAR', fila: f, col: ultima, filas: 2 },
    ]);
    congelar(ws, f, f + 1);
    f++;
    const nodos = d.presupuesto.tree.ordered;
    unidad(ws, f + 1, nodos);
    escribirArbol(ws, f + 1, nodos, C0 + 3, ultima, (node) => {
        const fila = d.metrados.porId.get(node.id);
        if (!node.esHoja || !fila) {
            return [];
        }
        const acumulado = meses.reduce((acc, periodo) => acc.add(fila.meses[periodo.key] ?? 0), D(0));

        return [
            { v: fila.contratado },
            ...meses.map((periodo) => (fila.meses[periodo.key] ? { v: fila.meses[periodo.key] } : null)),
            acumulado.isZero() ? null : { v: acumulado },
            fila.contratado && !fila.contratado.sub(acumulado).isZero() ? { v: fila.contratado.sub(acumulado) } : null,
        ];
    });
}

/** VAL. MENSUAL: presupuesto + acumulado anterior, actual, acumulado actual y saldo (metrado, costo, %). */
export function hojaValorizacionMensual(ctx: ContextoLibro): void {
    const { d } = ctx;
    const vm = d.vm;
    const ws = nuevaHoja(ctx.wb, 'VAL. MENSUAL', [...ANCHOS_PRESUPUESTO, ...Array.from({ length: 4 }, () => [9, 11, 8]).flat()]);
    const ultima = C0 + 5 + 12;
    const bloques = ['ACUMULADO ANTERIOR', 'ACTUAL', 'ACUMULADO ACTUAL', 'SALDO'] as const;
    const claves = ['anterior', 'actual', 'acumulado', 'saldo'] as const;
    let f = titulo(ws, 1, `Valorización N°${ctx.numero} del mes de ${ctx.mesTexto}`, ultima);
    f = subtitulo(ws, f + 1, ctx.exp.contrato, ultima);
    f = encabezadoExpediente(ws, f + 1, ctx.exp, ultima);
    cabecera(ws, [
        ...cabeceraPresupuesto(f, 2),
        ...bloques.flatMap((bloque, i): CeldaCabecera[] => {
            const col = C0 + 6 + i * 3;
            const fondo = bloque === 'ACTUAL' ? COLOR.actual : undefined;

            return [
                { texto: bloque, fila: f, col, cols: 3, fondo },
                { texto: 'METRADO', fila: f + 1, col, fondo },
                { texto: 'COSTO (S/)', fila: f + 1, col: col + 1, fondo },
                { texto: '%', fila: f + 1, col: col + 2, fondo },
            ];
        }),
    ]);
    congelar(ws, f, f + 1);
    f = cuerpoPresupuesto(ws, f + 2, ctx, ultima, false, (node) => {
        const fila = vm.porId.get(node.id);
        if (!node.esHoja || !fila) {
            return claves.flatMap(() => [null, null, null]);
        }

        return claves.flatMap((clave): Array<ValorCelda | null> => {
            const bloque = fila[clave];
            const fondo = clave === 'actual' ? { fondo: COLOR.actual } : undefined;
            const vacio = bloque.costo.isZero() && (!bloque.metrado || bloque.metrado.isZero());

            return vacio
                ? [{ v: null, estilo: fondo }, { v: null, estilo: fondo }, { v: null, estilo: fondo }]
                : [
                      { v: bloque.metrado, estilo: fondo },
                      { v: bloque.costo, estilo: fondo },
                      { v: bloque.pct, formato: FMT.pct, estilo: fondo },
                  ];
        });
    });
    escribirPie(
        ws,
        f,
        d.parametros,
        [
            { col: C0 + 5, totales: vm.pies.presupuesto },
            ...claves.map((clave, i) => ({ col: C0 + 7 + i * 3, totales: vm.pies[clave], colPct: C0 + 8 + i * 3 })),
        ],
        ultima,
        { totalLabel: 'MONTO VALORIZADO MENSUAL', avanceLabel: 'AVANCE FÍSICO MENSUAL' },
    );
}

/** PROG VS. EJEC: presupuesto + programado y ejecutado del mes valorizado. */
export function hojaProgramadoVsEjecutado(ctx: ContextoLibro): void {
    const { d } = ctx;
    const mesProg = d.programado.meses.find((mes) => mes.periodo.key === d.mesValorizacion);
    const mesEjec = d.ejecutado.meses.find((mes) => mes.periodo.key === d.mesValorizacion);
    if (!mesProg || !mesEjec) {
        return;
    }
    const ws = nuevaHoja(ctx.wb, 'PROG VS. EJEC', [...ANCHOS_PRESUPUESTO, 9, 11, 9, 11]);
    const ultima = C0 + 9;
    let f = titulo(ws, 1, `Avance programado vs. ejecutado (${ctx.mesCorto})`, ultima);
    f = encabezadoExpediente(ws, f + 1, ctx.exp, ultima);
    cabecera(ws, [...cabeceraPresupuesto(f, 3), ...cabeceraMes(f, C0 + 6, mesProg.periodo), ...cabeceraMes(f, C0 + 8, mesEjec.periodo, COLOR.cabeceraGris)]);
    fechasMes(ws, f + 1, C0 + 6, mesProg.periodo);
    fechasMes(ws, f + 1, C0 + 8, mesEjec.periodo);
    // Rótulo de cada bloque sobre la cabecera.
    rango(ws, f - 1, C0 + 6, f - 1, C0 + 7, 'PROGRAMADO', { negrita: true, alineacion: 'center', tamano: 10 });
    rango(ws, f - 1, C0 + 8, f - 1, C0 + 9, 'EJECUTADO', { negrita: true, alineacion: 'center', tamano: 10 });
    congelar(ws, f, f + 2);
    f = cuerpoPresupuesto(ws, f + 3, ctx, ultima, false, (node) => {
        if (!node.esHoja) {
            return [];
        }
        const prog = d.programado.porId.get(node.id)?.meses[d.mesValorizacion];
        const ejec = d.ejecutado.porId.get(node.id)?.meses[d.mesValorizacion];

        return [prog?.pct ? { v: prog.pct, formato: FMT.pct } : null, prog?.monto ? { v: prog.monto } : null, ejec?.pct ? { v: ejec.pct, formato: FMT.pct } : null, ejec?.monto ? { v: ejec.monto } : null];
    });
    escribirPie(
        ws,
        f,
        d.parametros,
        [
            { col: C0 + 5, totales: d.presupuesto.totales },
            { col: C0 + 7, totales: mesProg.totales, colPct: C0 + 6 },
            { col: C0 + 9, totales: mesEjec.totales, colPct: C0 + 8 },
        ],
        ultima,
        { totalLabel: 'MONTO VALORIZADO MENSUAL', avanceLabel: 'AVANCE FÍSICO MENSUAL' },
    );
}
