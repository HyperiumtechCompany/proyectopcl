import type Decimal from 'decimal.js';
import { D, roundPct } from './money';
import type { DecimalInput } from './money';

export type SituacionAvance = 'ADELANTADA' | 'ATRASADA' | 'CULMINADA';

export interface EvaluacionAvance {
    situacion: SituacionAvance;
    /** ejecutado − programado (positivo = adelanto). */
    diferencia: Decimal;
}

/**
 * CONTROL GEN. AVAN. OBRA. columna P:
 *   IF(K < G, "ATRASADA", IF(K = 100%, "CULMINADA", "ADELANTADA"))
 * K = % ejecutado acumulado, G = % programado acumulado.
 */
export function evaluarAvance(programadoAcum: DecimalInput, ejecutadoAcum: DecimalInput): EvaluacionAvance {
    const programado = D(programadoAcum);
    const ejecutado = D(ejecutadoAcum);
    const diferencia = roundPct(ejecutado.sub(programado));

    if (ejecutado.lt(programado)) {
        return { situacion: 'ATRASADA', diferencia };
    }

    return { situacion: ejecutado.eq(1) ? 'CULMINADA' : 'ADELANTADA', diferencia };
}
