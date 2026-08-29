export interface PeriodoDesembolsoInput {
    key: string;
    label: string;
    dias: number;
    valorizacion: number;
}

export interface FilaDesembolsoCalculada extends PeriodoDesembolsoInput {
    calendario: number;
    amortizacionEfectivo: number;
    amortizacionMateriales: number;
    amortizacionTotal: number;
    pctAvance: number;
    desembolsoMensual: number;
    desembolsoAcumulado: number;
    pctDesembolso: number;
    pctDesembolsoAcumulado: number;
}

const round4 = (value: number): number => Math.round((value + Number.EPSILON) * 10_000) / 10_000;

/** Replica la hoja Desembolso: adelanto en día 0 y amortización en cada valorización. */
export function calcularDesembolso(
    presupuestoObra: number,
    periodos: PeriodoDesembolsoInput[],
    pctAdelantoEfectivo = 0.1,
    pctAdelantoMateriales = 0.2,
) {
    const adelantoEfectivo = round4(presupuestoObra * pctAdelantoEfectivo);
    const adelantoMateriales = round4(presupuestoObra * pctAdelantoMateriales);
    const adelantoTotal = adelantoEfectivo + adelantoMateriales;
    let desembolsoAcumulado = adelantoTotal;
    let calendario = 0;

    const filas: FilaDesembolsoCalculada[] = periodos.map((periodo) => {
        calendario += 30;
        const amortizacionEfectivo = round4(periodo.valorizacion * pctAdelantoEfectivo);
        const amortizacionMateriales = round4(periodo.valorizacion * pctAdelantoMateriales);
        const amortizacionTotal = amortizacionEfectivo + amortizacionMateriales;
        const desembolsoMensual = periodo.valorizacion - amortizacionTotal;
        desembolsoAcumulado += desembolsoMensual;

        return {
            ...periodo,
            calendario,
            amortizacionEfectivo,
            amortizacionMateriales,
            amortizacionTotal,
            pctAvance: presupuestoObra > 0 ? (periodo.valorizacion / presupuestoObra) * 100 : 0,
            desembolsoMensual,
            desembolsoAcumulado,
            pctDesembolso: presupuestoObra > 0 ? (desembolsoMensual / presupuestoObra) * 100 : 0,
            pctDesembolsoAcumulado: presupuestoObra > 0 ? (desembolsoAcumulado / presupuestoObra) * 100 : 0,
        };
    });

    const totalValorizacion = filas.reduce((sum, fila) => sum + fila.valorizacion, 0);
    const totalAmortizacionEfectivo = filas.reduce((sum, fila) => sum + fila.amortizacionEfectivo, 0);
    const totalAmortizacionMateriales = filas.reduce((sum, fila) => sum + fila.amortizacionMateriales, 0);

    return {
        adelantoEfectivo,
        adelantoMateriales,
        adelantoTotal,
        filas,
        totalValorizacion,
        totalDesembolsado: desembolsoAcumulado,
        saldoAdelantoEfectivo: adelantoEfectivo - totalAmortizacionEfectivo,
        saldoAdelantoMateriales: adelantoMateriales - totalAmortizacionMateriales,
    };
}
