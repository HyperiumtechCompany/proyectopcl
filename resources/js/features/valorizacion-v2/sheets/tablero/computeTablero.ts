import type Decimal from 'decimal.js';
import type { IsoDate } from '../../lib/dates';
import { D } from '../../lib/money';
import { avanceDelPlazo } from '../../lib/periodos';
import type { MesKey } from '../../types';
import type { ControlFinanciero, ControlGeneral } from '../control/computeControl';
import type { PagosAcumulados, ResumenValorizacion, RetencionFielCumplimiento } from '../pagos/computePagos';

export interface Tablero {
    fisico: { programado: Decimal; ejecutado: Decimal; diferencia: Decimal | null; situacion: string };
    /** Avance del plazo: días transcurridos al cierre del mes valorizado / plazo vigente. */
    tiempo: { transcurridos: number; plazo: number; pct: Decimal };
    valorizacionMes: Decimal;
    liquidoMes: Decimal;
    financiero: { devengadoPct: Decimal; devengado: Decimal; pendiente: Decimal; saldoObra: Decimal };
    garantia: { retenida: Decimal; total: Decimal };
    componentes: Array<{ codigo: string; descripcion: string; anteriorPct: Decimal; actualPct: Decimal; acumuladoPct: Decimal; saldoPct: Decimal }>;
}

/**
 * Tablero de indicadores (reconstrucción de la hoja "res %", que en el Excel
 * estaba rota con #REF!). Solo junta resultados ya calculados por las demás hojas.
 */
export function computeTablero(args: {
    control: ControlGeneral;
    financiero: ControlFinanciero;
    resumen: ResumenValorizacion;
    rfc: RetencionFielCumplimiento;
    pagos: PagosAcumulados;
    mesValorizacion: MesKey;
    inicioObra: IsoDate;
    terminoVigente: IsoDate;
    contratoVigente: Decimal;
}): Tablero {
    const { control, financiero, resumen, rfc, pagos, mesValorizacion, inicioObra, terminoVigente, contratoVigente } = args;
    const fila = control.meses.find((mes) => mes.periodo.key === mesValorizacion) ?? control.ultima;
    const tiempo = avanceDelPlazo(inicioObra, terminoVigente, mesValorizacion);

    return {
        fisico: {
            programado: fila?.programado.pctAcumulado ?? D(0),
            ejecutado: fila?.ejecutado?.pctAcumulado ?? D(0),
            diferencia: fila?.evaluacion?.diferencia ?? null,
            situacion: control.situacionObra,
        },
        tiempo: { transcurridos: tiempo.transcurridos, plazo: tiempo.plazo, pct: D(tiempo.pct) },
        valorizacionMes: pagos.actual.a,
        liquidoMes: pagos.actual.k,
        financiero: {
            devengadoPct: financiero.acumulado.pctDevengado,
            devengado: financiero.acumulado.devengado,
            pendiente: financiero.acumulado.pendiente,
            saldoObra: contratoVigente.sub(control.totalEjecutado),
        },
        garantia: { retenida: rfc.actualAcumulada, total: rfc.total },
        componentes: resumen.componentes.map((comp) => ({
            codigo: comp.node.codigo,
            descripcion: comp.node.descripcion,
            anteriorPct: comp.anterior.pct,
            actualPct: comp.actual.pct,
            acumuladoPct: comp.acumulado.pct,
            saldoPct: comp.saldo.pct,
        })),
    };
}
