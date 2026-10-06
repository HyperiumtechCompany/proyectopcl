import { derivarControl } from '../compute/derivarValorizacion';
import { useValorizacionBase } from './useValorizacionBase';

/**
 * Controles de obra (Fase 5): ambos calendarios, CONTROL GENERAL (+ Curva S,
 * avance físico) y CONTROL FINANCIERO. Todo derivado: presupuesto → calendario
 * programado y metrados → calendario ejecutado → controles.
 */
export function useControl() {
    return derivarControl(useValorizacionBase());
}
