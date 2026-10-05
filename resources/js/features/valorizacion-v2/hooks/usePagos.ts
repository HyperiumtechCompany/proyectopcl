import { computeAdicionales, computeControlPagos, computePagosAcumulados, computeResumenValorizacion, computeRetencionFielCumplimiento } from '../sheets/pagos/computePagos';
import { computeValorizacionMensual } from '../sheets/valorizacion-mensual/computeValorizacionMensual';
import { useControl } from './useControl';

/**
 * Flujo de pagos (Fase 6), última etapa de la cadena:
 * VAL. MENSUAL → RESUMEN VAL. · CONTROL GENERAL → R.F.C → R PAGO MENSUAL →
 * PAGOS ACUMULADOS → CONTROL DE PAGOS. Solo los ajustes manuales son entrada.
 */
export function usePagos() {
    const base = useControl();
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
