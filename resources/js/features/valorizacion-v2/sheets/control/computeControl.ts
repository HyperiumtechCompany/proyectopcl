import type Decimal from 'decimal.js';
import { evaluarAvance } from '../../lib/avance';
import type { SituacionAvance } from '../../lib/avance';
import { D, roundPct, safeDiv } from '../../lib/money';
import type { DecimalInput } from '../../lib/money';
import type { Periodo } from '../../lib/periodos';
import type { MesKey } from '../../types';
import type { CalendarioCalculado } from '../calendario/computeCalendario';

export interface SerieMes {
    /** Monto del mes con IGV (CALEN.!J161). */
    mensual: Decimal;
    acumulado: Decimal;
    /** ROUND(mensual / total programado, 4). */
    pctMensual: Decimal;
    /** Σ % mensuales. */
    pctAcumulado: Decimal;
}

export interface ControlMes {
    numero: number;
    periodo: Periodo;
    programado: SerieMes;
    /** null en meses aún no valorizados. */
    ejecutado: SerieMes | null;
    /** 80 % del programado acumulado: ROUND(L × 0.8, 4) (CONTROL GEN.!M). */
    ochenta: Decimal;
    /** Curva del 80 % sin redondear (CURVA S!G = 0.8 × F). */
    curva80: Decimal;
    /** Ejecutado − programado acumulado y situación (CONTROL GEN.!O y P). */
    evaluacion: { diferencia: Decimal; situacion: SituacionAvance } | null;
}

export interface ControlGeneral {
    meses: ControlMes[];
    /** D14: total programado con IGV (base de los %). */
    totalProgramado: Decimal;
    totalEjecutado: Decimal;
    pctEjecutado: Decimal;
    /** Última valorización: fila TOTAL (L14…P14). */
    ultima: ControlMes | null;
    situacionObra: string;
}

function serie(montos: Decimal[], base: Decimal): SerieMes[] {
    let acumulado = D(0);
    let pctAcumulado = D(0);

    return montos.map((mensual) => {
        const pctMensual = roundPct(safeDiv(mensual, base));
        acumulado = acumulado.add(mensual);
        pctAcumulado = pctAcumulado.add(pctMensual);

        return { mensual, acumulado, pctMensual, pctAcumulado };
    });
}

/**
 * CONTROL GEN. AVAN. OBRA. (incluye la hoja PROGRAMADO): una fila por mes con
 * programado y ejecutado (montos con IGV de los calendarios), % sobre el total
 * programado, 80 % del programado y situación. El ejecutado solo llega hasta el
 * mes de la valorización.
 */
export function computeControlGeneral(programado: CalendarioCalculado, ejecutado: CalendarioCalculado, mesValorizacion: MesKey): ControlGeneral {
    const totalProgramado = programado.meses.reduce((acc, mes) => acc.add(mes.totales.total), D(0));
    const prog = serie(programado.meses.map((mes) => mes.totales.total), totalProgramado);
    const valorizados = ejecutado.meses.filter((mes) => mes.periodo.key <= mesValorizacion);
    const ejec = serie(valorizados.map((mes) => mes.totales.total), totalProgramado);

    const meses = programado.meses.map((mes, index): ControlMes => {
        const p = prog[index];
        const e = index < ejec.length ? ejec[index] : null;

        return {
            numero: index + 1,
            periodo: mes.periodo,
            programado: p,
            ejecutado: e,
            ochenta: roundPct(p.pctAcumulado.mul('0.8')),
            curva80: p.pctAcumulado.mul('0.8'),
            evaluacion: e ? evaluarAvance(p.pctAcumulado, e.pctAcumulado) : null,
        };
    });

    const ultima = [...meses].reverse().find((mes) => mes.ejecutado !== null) ?? null;
    const totalEjecutado = ejec.at(-1)?.acumulado ?? D(0);

    return {
        meses,
        totalProgramado,
        totalEjecutado,
        pctEjecutado: ejec.at(-1)?.pctAcumulado ?? D(0),
        ultima,
        situacionObra: ultima?.evaluacion ? `OBRA ${ultima.evaluacion.situacion}` : 'SIN VALORIZAR',
    };
}

export interface ValorizacionFinanciera {
    numero: number;
    periodo: Periodo;
    facturable: Decimal;
    devengado: Decimal;
    /** devengado / contrato original (sin redondear, como el Excel). */
    pctDevengado: Decimal;
    pendiente: Decimal;
}

export interface ControlFinanciero {
    adelantos: Array<{ concepto: string; facturable: Decimal; devengado: Decimal; pctDevengado: Decimal }>;
    valorizaciones: ValorizacionFinanciera[];
    acumulado: { facturable: Decimal; devengado: Decimal; pctDevengado: Decimal; pendiente: Decimal };
    saldo: { facturable: Decimal; devengado: Decimal; pctDevengado: Decimal; pendiente: Decimal };
}

/**
 * CONTROL FINANCIERO: facturable = ejecutado mensual con IGV; devengado es un
 * dato (la valorización ya fue pagada/devengada o no); pendiente = facturable −
 * devengado. Saldo contra el contrato vigente.
 */
export function computeControlFinanciero(
    control: ControlGeneral,
    devengados: Record<MesKey, boolean>,
    contratoOriginal: DecimalInput,
    contratoVigente: DecimalInput,
    adelantos: { directo: DecimalInput | null; materiales: DecimalInput | null },
): ControlFinanciero {
    const original = D(contratoOriginal);
    const vigente = D(contratoVigente);
    const adelanto = (concepto: string, monto: DecimalInput | null) => {
        const valor = D(monto ?? 0);

        return { concepto, facturable: valor, devengado: valor, pctDevengado: safeDiv(valor, original) };
    };
    const filasAdelanto = [adelanto('Adelanto directo', adelantos.directo), adelanto('Adelanto de materiales', adelantos.materiales)];

    const valorizaciones = control.meses
        .filter((mes) => mes.ejecutado !== null)
        .map((mes): ValorizacionFinanciera => {
            const facturable = mes.ejecutado!.mensual;
            const devengado = devengados[mes.periodo.key] ? facturable : D(0);

            return { numero: mes.numero, periodo: mes.periodo, facturable, devengado, pctDevengado: safeDiv(devengado, original), pendiente: facturable.sub(devengado) };
        });

    const todas = [...filasAdelanto, ...valorizaciones];
    const sum = (pick: (fila: (typeof todas)[number]) => Decimal) => todas.reduce((acc, fila) => acc.add(pick(fila)), D(0));
    const acumulado = {
        facturable: sum((f) => f.facturable),
        devengado: sum((f) => f.devengado),
        pctDevengado: sum((f) => f.pctDevengado),
        pendiente: valorizaciones.reduce((acc, v) => acc.add(v.pendiente), D(0)),
    };
    const saldoFacturable = vigente.sub(acumulado.facturable);

    return {
        adelantos: filasAdelanto,
        valorizaciones,
        acumulado,
        saldo: { facturable: saldoFacturable, devengado: vigente.sub(acumulado.devengado), pctDevengado: D(1).sub(acumulado.pctDevengado), pendiente: saldoFacturable },
    };
}
