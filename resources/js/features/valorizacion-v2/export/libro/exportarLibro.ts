import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { derivarValorizacion } from '../../compute/derivarValorizacion';
import type { ValorizacionDerivada } from '../../compute/derivarValorizacion';
import { formatMonthYear } from '../../lib/dates';
import type { ValorizacionInput } from '../../types';
import type { ConstructorHoja, ContextoLibro } from './contexto';
import { FMT } from './estilo';
import type { Expediente } from './estilo';
import { SERIES_CURVA_S, svgAPng, svgCurvaS, svgTorta } from './graficos';
import { hojaFichaTecnica } from './hojaFichaTecnica';
import { hojaPersonal } from './hojaPersonal';
import { hojaCalendarioEjecutado, hojaCalendarioProgramado, hojaMetrados, hojaPresupuesto, hojaProgramadoVsEjecutado, hojaValorizacionMensual } from './hojasArbol';
import { hojaControlFinanciero, hojaControlFisico, hojaControlGeneral, hojaCurvaS } from './hojasControl';
import { hojaControlPagos, hojaPagosAcumulados, hojaResumenComponentes, hojaResumenPago, hojaRetencion } from './hojasPagos';

/** Orden y nombres de las pestañas = los del expediente del cliente. */
const HOJAS: ConstructorHoja[] = [
    hojaFichaTecnica,
    hojaPresupuesto,
    hojaCalendarioProgramado,
    hojaMetrados,
    hojaCalendarioEjecutado,
    hojaValorizacionMensual,
    hojaProgramadoVsEjecutado,
    hojaControlGeneral,
    hojaCurvaS,
    hojaControlFisico,
    hojaControlFinanciero,
    hojaResumenComponentes,
    hojaRetencion,
    hojaResumenPago,
    hojaPagosAcumulados,
    hojaControlPagos,
    hojaPersonal,
];

const nro = (n: number) => String(n).padStart(2, '0');

/** SVG de los tres gráficos del expediente (Curva S, avance físico, control financiero). */
export function graficosSvg(d: ValorizacionDerivada) {
    const { control, financiero } = d;
    const curvaS = svgCurvaS({
        titulo: 'GRÁFICO DE CONTROL DE AVANCE DE OBRA',
        subtitulo: 'PROGRAMADO VS EJECUTADO',
        valorizaciones: control.meses.length,
        series: [
            { nombre: 'Programado', color: SERIES_CURVA_S.programado, valores: control.meses.map((m) => m.programado.pctAcumulado.toNumber()) },
            { nombre: 'Ejecutado', color: SERIES_CURVA_S.ejecutado, valores: control.meses.filter((m) => m.ejecutado).map((m) => m.ejecutado!.pctAcumulado.toNumber()), suave: true },
        ],
    });
    const fisico = svgTorta({
        titulo: 'AVANCE FÍSICO DE OBRA',
        porciones: [
            ...control.meses.filter((m) => m.ejecutado).map((m) => ({ nombre: `VAL. Nº${nro(m.numero)}`, valor: m.ejecutado!.pctMensual.toNumber() })),
            { nombre: 'SALDO', valor: Math.max(0, 1 - control.pctEjecutado.toNumber()) },
        ],
    });
    const financieroSvg = svgTorta({
        titulo: 'CONTROL FINANCIERO DE LA OBRA',
        porciones: [
            ...financiero.adelantos.map((a) => ({ nombre: a.concepto, valor: a.pctDevengado.toNumber() })),
            ...financiero.valorizaciones.filter((v) => v.devengado.gt(0)).map((v) => ({ nombre: `Valorización Nº${nro(v.numero)}`, valor: v.pctDevengado.toNumber() })),
            { nombre: 'SALDO', valor: Math.max(0, financiero.saldo.pctDevengado.toNumber()) },
        ],
    });

    return { curvaS, fisico, financiero: financieroSvg };
}

/** Arma el libro (sin descargarlo) a partir de las entradas y los gráficos ya rasterizados. */
export function construirLibro(input: ValorizacionInput, graficos: ContextoLibro['graficos'], d: ValorizacionDerivada = derivarValorizacion(input)): ExcelJS.Workbook {
    const { datosGenerales, contratista, supervision } = input.fichaTecnica;
    const exp: Expediente = {
        obra: datosGenerales.obra,
        entidad: datosGenerales.entidad,
        ejecutor: contratista.ejecutor,
        supervisor: supervision.contratista,
        residente: contratista.residente,
        ingSupervisor: supervision.supervisor,
        contrato: contratista.contrato,
        derecha: [
            ['VALOR REFERENCIAL (CON IGV)', d.contrato.referencial.toNumber(), FMT.moneda],
            ['MONTO DEL CONTRATO (INCL. IGV):', d.contrato.vigente.toNumber(), FMT.moneda],
            ['PLAZO DE EJECUCIÓN:', d.ficha.plazoContractualTexto],
        ],
    };
    const [mes, anio] = formatMonthYear(input.periodo.mes).toUpperCase().split(' ');

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Valorización v2';
    wb.title = `Valorización N°${nro(input.periodo.numero)} - ${mes} ${anio}`;
    wb.created = new Date();
    const ctx: ContextoLibro = { wb, d, exp, numero: nro(input.periodo.numero), mesTexto: `${mes} DE ${anio}`, mesCorto: `${mes} ${anio}`, graficos };
    HOJAS.forEach((hoja) => hoja(ctx));

    return wb;
}

/**
 * Exporta la valorización completa con el formato formal del expediente: una
 * pestaña por hoja, construida desde los datos calculados (no desde la
 * pantalla), con números reales, encabezados del expediente y gráficos.
 */
export async function exportarLibro(input: ValorizacionInput, nombreDocumento: string): Promise<void> {
    const d = derivarValorizacion(input);
    const svg = graficosSvg(d);
    const [curvaS, fisico, financiero] = await Promise.all([svgAPng(svg.curvaS, 960, 520), svgAPng(svg.fisico, 760, 520), svgAPng(svg.financiero, 760, 520)]);
    const wb = construirLibro(input, { curvaS, fisico, financiero }, d);

    const buffer = await wb.xlsx.writeBuffer();
    const nombre = nombreDocumento
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40);
    saveAs(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `Valorizacion_N${nro(input.periodo.numero)}_${input.periodo.mes.slice(0, 7)}${nombre ? `_${nombre}` : ''}.xlsx`,
    );
}
