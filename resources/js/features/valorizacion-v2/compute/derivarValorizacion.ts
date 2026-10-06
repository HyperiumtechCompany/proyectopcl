import { D, roundMoney } from '../lib/money';
import { periodosDeObra } from '../lib/periodos';
import { computeCalendario } from '../sheets/calendario/computeCalendario';
import { computeControlFinanciero, computeControlGeneral } from '../sheets/control/computeControl';
import { computeFichaTecnica } from '../sheets/ficha-tecnica/computeFichaTecnica';
import { resolverContrato } from '../sheets/ficha-tecnica/resolverContrato';
import { calendarioEjecutadoDesdeMetrados, computeMetrados } from '../sheets/metrados/computeMetrados';
import { computeAdicionales, computeControlPagos, computePagosAcumulados, computeResumenValorizacion, computeRetencionFielCumplimiento } from '../sheets/pagos/computePagos';
import { computeAsistencia } from '../sheets/personal/computeAsistencia';
import { computePresupuesto } from '../sheets/presupuesto/computePresupuesto';
import { computeValorizacionMensual } from '../sheets/valorizacion-mensual/computeValorizacionMensual';
import type { ValorizacionInput } from '../types';

/**
 * Cadena de cálculo de la valorización como funciones puras. Los hooks
 * (useValorizacionBase → useControl → usePagos) las envuelven; la exportación
 * del libro Excel usa `derivarValorizacion` sin React. Una sola cadena: lo que
 * se exporta es exactamente lo que se ve.
 */

/** Presupuesto, contrato resuelto, calendarios, meses de obra y mes valorizado. */
export function derivarBase(input: ValorizacionInput) {
    const calculado = computePresupuesto(input.presupuesto, input.parametros);
    const contrato = resolverContrato(input.fichaTecnica, calculado.totales.total);
    // El total del presupuesto debe igualar el contrato PRINCIPAL (el vigente incluye adicionales).
    const presupuesto = { ...calculado, diferenciaContrato: roundMoney(calculado.totales.total.sub(contrato.principal)) };
    const ejecutado = calendarioEjecutadoDesdeMetrados(presupuesto, input.metrados);
    const mesesConDatos = new Set(
        [...Object.values(input.calendarios.programado.montos), ...Object.values(input.metrados.ejecutado)].flatMap((porMes) => Object.keys(porMes)),
    );
    const { fechaTerminoVigente } = computeFichaTecnica(input.fichaTecnica);

    return {
        input,
        presupuesto,
        contrato,
        parametros: input.parametros,
        calendarios: { programado: input.calendarios.programado, ejecutado },
        periodos: periodosDeObra(input.fichaTecnica.plazos.fechaInicioObra, fechaTerminoVigente, mesesConDatos),
        mesValorizacion: input.periodo.mes.slice(0, 7),
    };
}

/** Ambos calendarios, CONTROL GENERAL (+ Curva S, avance físico) y CONTROL FINANCIERO. */
export function derivarControl(base: ReturnType<typeof derivarBase>) {
    const { input, presupuesto, contrato, calendarios, periodos, parametros, mesValorizacion } = base;
    const programado = computeCalendario('programado', presupuesto, calendarios.programado, periodos, parametros);
    const ejecutado = computeCalendario('ejecutado', presupuesto, calendarios.ejecutado, periodos, parametros);
    const control = computeControlGeneral(programado, ejecutado, mesValorizacion);
    const { contratista } = input.fichaTecnica;
    const financiero = computeControlFinanciero(control, input.control.devengados, contrato.principal, contrato.vigente, {
        directo: contratista.adelantoDirecto.monto,
        materiales: contratista.adelantoMateriales.monto,
    });

    return { ...base, programado, ejecutado, control, financiero };
}

/** Flujo de pagos: VAL. MENSUAL → RESUMEN VAL. → R.F.C → PAGOS ACUMULADOS → CONTROL DE PAGOS. */
export function derivarPagos(base: ReturnType<typeof derivarControl>) {
    const { input, presupuesto, contrato, parametros, mesValorizacion, control, ejecutado } = base;
    const vm = computeValorizacionMensual(presupuesto, input.metrados, mesValorizacion, parametros);
    const rfc = computeRetencionFielCumplimiento(control, contrato.principal, input.pagos.rfc, mesValorizacion);
    const acumulados = computePagosAcumulados(presupuesto.totales, ejecutado, rfc, input.pagos.porMes, input.pagos.porcentajeDetraccion, mesValorizacion);

    return {
        ...base,
        vm,
        resumen: computeResumenValorizacion(vm),
        rfc,
        acumulados,
        controlPagos: computeControlPagos(acumulados, parametros.igv),
        adicionales: computeAdicionales(input.pagos.adicionales, parametros.igv),
    };
}

/** Todas las hojas calculadas a la vez (exportación del libro completo). */
export function derivarValorizacion(input: ValorizacionInput) {
    const pagos = derivarPagos(derivarControl(derivarBase(input)));
    const { control, mesValorizacion, presupuesto, periodos } = pagos;
    const fila = control.meses.find((mes) => mes.periodo.key === mesValorizacion) ?? control.ultima;
    const ficha = computeFichaTecnica(input.fichaTecnica, fila ? { programado: fila.programado.pctAcumulado, ejecutado: fila.ejecutado?.pctAcumulado ?? D(0) } : null);

    return {
        ...pagos,
        metrados: computeMetrados(presupuesto, input.metrados, periodos),
        ficha,
        asistencia: computeAsistencia(input.personal, mesValorizacion, input.fichaTecnica.plazos.fechaInicioObra, ficha.fechaTerminoVigente, {
            residente: input.fichaTecnica.contratista.residente,
        }),
    };
}

export type ValorizacionDerivada = ReturnType<typeof derivarValorizacion>;
