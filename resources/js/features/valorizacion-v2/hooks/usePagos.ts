import { derivarPagos } from '../compute/derivarValorizacion';
import { useControl } from './useControl';

/**
 * Flujo de pagos (Fase 6), última etapa de la cadena:
 * VAL. MENSUAL → RESUMEN VAL. · CONTROL GENERAL → R.F.C → R PAGO MENSUAL →
 * PAGOS ACUMULADOS → CONTROL DE PAGOS. Solo los ajustes manuales son entrada.
 */
export function usePagos() {
    return derivarPagos(useControl());
}
