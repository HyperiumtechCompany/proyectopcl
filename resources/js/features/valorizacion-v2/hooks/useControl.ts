import { computeCalendario } from '../sheets/calendario/computeCalendario';
import { computeControlFinanciero, computeControlGeneral } from '../sheets/control/computeControl';
import { useValorizacionBase } from './useValorizacionBase';

/**
 * Controles de obra (Fase 5): ambos calendarios, CONTROL GENERAL (+ Curva S,
 * avance físico) y CONTROL FINANCIERO. Todo derivado: presupuesto → calendario
 * programado y metrados → calendario ejecutado → controles.
 */
export function useControl() {
    const base = useValorizacionBase();
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
