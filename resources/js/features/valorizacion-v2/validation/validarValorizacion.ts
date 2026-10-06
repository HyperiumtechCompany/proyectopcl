import type Decimal from 'decimal.js';
import { formatMonthYear, isIsoDate } from '../lib/dates';
import { D } from '../lib/money';
import type { DecimalInput } from '../lib/money';
import type { ControlGeneral } from '../sheets/control/computeControl';
import type { MetradoFila } from '../sheets/metrados/computeMetrados';
import type { PagosAcumulados, RetencionFielCumplimiento } from '../sheets/pagos/computePagos';
import type { MesKey } from '../types';
import { fmtMoney, fmtNumber, fmtPct } from '../utils/format';

/**
 * - error: el dato es imposible o contrario al contrato; bloquea APROBAR la
 *   valorización (nunca el autoguardado: bloquear el guardado perdería trabajo).
 * - aviso: hay que revisarlo, pero puede ser legítimo (p. ej. mayor metrado).
 */
export type NivelHallazgo = 'error' | 'aviso';

export interface Hallazgo {
    regla: string;
    nivel: NivelHallazgo;
    mensaje: string;
    /** Hoja donde se corrige (id de config/sheets). */
    hoja: string;
}

export interface EntradaValidacion {
    metrados: MetradoFila[];
    control: ControlGeneral;
    pagos: PagosAcumulados;
    rfc: RetencionFielCumplimiento;
    contratoVigente: Decimal;
    adelantos: { directo: DecimalInput | null; materiales: DecimalInput | null };
    plazos: { fechaInicioObra: string; plazoEjecucionDias: number; fechaTerminoReal: string | null; fechaTerminoVigente: string };
    mesValorizacion: MesKey;
}

/** Diferencias menores a un céntimo son redondeo, no un exceso. */
const TOLERANCIA = D('0.01');
const supera = (valor: Decimal, limite: Decimal) => valor.sub(limite).gt(TOLERANCIA);
/** Tope de penalidades: 10 % del contrato vigente (Reglamento de la Ley 30225, D.S. 344-2018-EF, arts. 161–164). */
const TOPE_PENALIDAD = D('0.10');

const listar = (codigos: string[]) => `${codigos.slice(0, 5).join(', ')}${codigos.length > 5 ? ` y ${codigos.length - 5} más` : ''}`;

/**
 * Validaciones de negocio de la valorización activa (plan §9.1), sobre los
 * datos YA calculados por las hojas: no recalcula nada, solo compara.
 */
export function validarValorizacion(e: EntradaValidacion): Hallazgo[] {
    const hallazgos: Hallazgo[] = [];
    const push = (regla: string, nivel: NivelHallazgo, hoja: string, mensaje: string) => hallazgos.push({ regla, nivel, hoja, mensaje });

    // Fechas: sin inicio válido ni plazo no hay meses de obra.
    if (!isIsoDate(e.plazos.fechaInicioObra)) {
        push('fecha-inicio', 'error', 'ficha-tecnica', 'La fecha de inicio de ejecución no es válida.');
    }
    if (!(e.plazos.plazoEjecucionDias > 0)) {
        push('plazo', 'error', 'ficha-tecnica', 'El plazo de ejecución debe ser mayor a 0 días.');
    }
    if (e.plazos.fechaTerminoReal && isIsoDate(e.plazos.fechaInicioObra) && e.plazos.fechaTerminoReal < e.plazos.fechaInicioObra) {
        push('fecha-termino', 'error', 'ficha-tecnica', 'La fecha de término real es anterior al inicio de ejecución.');
    }
    if (isIsoDate(e.plazos.fechaInicioObra) && (e.mesValorizacion < e.plazos.fechaInicioObra.slice(0, 7) || e.mesValorizacion > e.plazos.fechaTerminoVigente.slice(0, 7))) {
        push('mes-fuera-de-plazo', 'aviso', 'ficha-tecnica', `${formatMonthYear(`${e.mesValorizacion}-01`)} está fuera del plazo vigente de la obra.`);
    }

    // Metrados: mayor metrado por partida (aviso) — puede ser un adicional en trámite.
    const excedidas = e.metrados.filter((fila) => fila.estado === 'excedido');
    if (excedidas.length > 0) {
        push(
            'metrado-excedido',
            'aviso',
            'metrados',
            `${excedidas.length} partida${excedidas.length === 1 ? ' supera' : 's superan'} su metrado contratado: ${listar(excedidas.map((fila) => `${fila.node.codigo} (+${fmtNumber(fila.saldo.neg())})`))}.`,
        );
    }
    const conAvance = e.metrados.some((fila) => fila.meses[e.mesValorizacion]);
    if (!conAvance && e.metrados.some((fila) => fila.node.esHoja)) {
        push('mes-sin-avance', 'aviso', 'metrados', `La valorización de ${formatMonthYear(`${e.mesValorizacion}-01`)} no tiene metrados ejecutados.`);
    }

    // Avance y montos acumulados (con IGV).
    const presupuesto = e.pagos.contratado.a;
    const acumulado = e.pagos.acumulado.a;
    if (presupuesto.gt(0) && supera(acumulado, presupuesto)) {
        push('avance-mayor-100', 'error', 'control-general', `El avance acumulado (${fmtPct(acumulado.div(presupuesto))}) supera el 100 % del presupuesto: ${fmtMoney(acumulado)} de ${fmtMoney(presupuesto)}.`);
    }
    if (presupuesto.gt(0) && supera(e.control.totalProgramado, presupuesto)) {
        push('programado-mayor-presupuesto', 'error', 'calendario-programado', `El calendario programado (${fmtMoney(e.control.totalProgramado)}) supera el total del presupuesto (${fmtMoney(presupuesto)}).`);
    }
    if (supera(acumulado, e.contratoVigente)) {
        push('valorizado-mayor-contrato', 'error', 'control-financiero', `Lo valorizado (${fmtMoney(acumulado)}) supera el contrato vigente (${fmtMoney(e.contratoVigente)}): registra el adicional en la Ficha técnica.`);
    }

    // Garantía de fiel cumplimiento.
    if (supera(e.rfc.actualAcumulada, e.rfc.total)) {
        push('retencion-mayor-garantia', 'error', 'retencion-fc', `La retención acumulada (${fmtMoney(e.rfc.actualAcumulada)}) supera la garantía de fiel cumplimiento (${fmtMoney(e.rfc.total)}).`);
    }

    // Saldos: no se puede amortizar más de lo adelantado.
    const amortizaciones: Array<[string, Decimal, DecimalInput | null]> = [
        ['directo', e.pagos.acumulado.e.directo, e.adelantos.directo],
        ['para materiales', e.pagos.acumulado.e.materiales, e.adelantos.materiales],
    ];
    for (const [nombre, amortizado, adelanto] of amortizaciones) {
        const monto = D(adelanto ?? 0);
        if (supera(amortizado, monto)) {
            push('saldo-adelanto-negativo', 'aviso', 'resumen-pago', `La amortización acumulada del adelanto ${nombre} (${fmtMoney(amortizado)}) supera el adelanto otorgado (${fmtMoney(monto)}): saldo negativo.`);
        }
    }
    if (e.pagos.acumulado.k.isNegative()) {
        push('liquido-negativo', 'aviso', 'pagos-acumulados', `El monto líquido acumulado es negativo (${fmtMoney(e.pagos.acumulado.k)}).`);
    }
    const penalidades = e.pagos.acumulado.h.total;
    if (e.contratoVigente.gt(0) && supera(penalidades, e.contratoVigente.mul(TOPE_PENALIDAD))) {
        push('penalidad-tope', 'aviso', 'resumen-pago', `Las penalidades acumuladas (${fmtMoney(penalidades)}) superan el 10 % del contrato vigente: corresponde evaluar la resolución del contrato.`);
    }

    return hallazgos.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === 'error' ? -1 : 1));
}
