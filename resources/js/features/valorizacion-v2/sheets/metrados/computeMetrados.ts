import type Decimal from 'decimal.js';
import { calcPartidaTotal } from '../../lib/budget';
import { D, roundPct, safeDiv } from '../../lib/money';
import type { PartidaNode } from '../../lib/partidaTree';
import type { Periodo } from '../../lib/periodos';
import type { CalendarioInput, MesKey, MetradosInput } from '../../types';
import type { PresupuestoCalculado } from '../presupuesto/computePresupuesto';

export type EstadoMetrado = 'sin-avance' | 'en-curso' | 'completo' | 'excedido';

export interface MetradoFila {
    node: PartidaNode;
    /** Metrado contratado (presupuesto); null en títulos. */
    contratado: Decimal | null;
    meses: Record<MesKey, Decimal | null>;
    /** METRADOS!M = suma de los meses. */
    acumulado: Decimal;
    /** METRADOS!O = contratado − acumulado. */
    saldo: Decimal;
    /** acumulado / contratado. */
    avance: Decimal;
    estado: EstadoMetrado;
}

export interface MetradosCalculado {
    filas: MetradoFila[];
    porId: Map<string, MetradoFila>;
    issues: string[];
}

const valor = (raw: string | undefined): Decimal | null => (raw === undefined || raw === '' ? null : D(raw));

/**
 * Hoja METRADOS: metrado ejecutado por mes (dato de entrada), acumulado y
 * saldo por metrar. Los títulos no suman metrados (unidades distintas).
 */
export function computeMetrados(presupuesto: PresupuestoCalculado, metrados: MetradosInput, periodos: Periodo[]): MetradosCalculado {
    const { tree } = presupuesto;
    const issues: string[] = [];

    const filas = tree.ordered.map((node): MetradoFila => {
        const porMes = node.esHoja ? (metrados.ejecutado[node.id] ?? {}) : {};
        const meses: Record<MesKey, Decimal | null> = {};
        let acumulado = D(0);
        let tieneDato = false;
        for (const periodo of periodos) {
            const value = valor(porMes[periodo.key]);
            meses[periodo.key] = value;
            if (value) {
                acumulado = acumulado.add(value);
                tieneDato = true;
            }
        }
        const contratado = node.esHoja ? D(node.input.metrado ?? 0) : null;
        const saldo = contratado ? contratado.sub(acumulado) : D(0);
        let estado: EstadoMetrado = 'sin-avance';
        if (node.esHoja && tieneDato) {
            estado = saldo.isNegative() ? 'excedido' : saldo.isZero() ? 'completo' : 'en-curso';
        }

        return { node, contratado, meses, acumulado, saldo, avance: contratado ? roundPct(safeDiv(acumulado, contratado)) : D(0), estado };
    });

    const excedidas = filas.filter((fila) => fila.estado === 'excedido');
    if (excedidas.length > 0) {
        issues.push(`${excedidas.length} partidas superan su metrado contratado: ${excedidas.slice(0, 5).map((fila) => fila.node.codigo).join(', ')}${excedidas.length > 5 ? '…' : ''}.`);
    }
    const huerfanos = Object.keys(metrados.ejecutado).filter((id) => !tree.byId.has(id) && Object.keys(metrados.ejecutado[id]).length > 0).length;
    if (huerfanos > 0) {
        issues.push(`${huerfanos} partidas con metrados ya no existen en el presupuesto (se ignoran; Ctrl+Z las recupera).`);
    }
    const enTitulos = Object.keys(metrados.ejecutado).filter((id) => tree.byId.get(id)?.esHoja === false && Object.keys(metrados.ejecutado[id]).length > 0).length;
    if (enTitulos > 0) {
        issues.push(`${enTitulos} títulos tienen metrados propios: solo cuentan los de sus partidas.`);
    }

    return { filas, porId: new Map(filas.map((fila) => [fila.node.id, fila])), issues };
}

/**
 * Calendario ejecutado derivado: monto del mes = ROUND(metrado × P.U., 2)
 * (CALEN. VALO. del Excel coincide con esto en las 103 partidas).
 */
export function calendarioEjecutadoDesdeMetrados(presupuesto: PresupuestoCalculado, metrados: MetradosInput): CalendarioInput {
    const montos: CalendarioInput['montos'] = {};
    for (const node of presupuesto.tree.ordered) {
        const porMes = node.esHoja ? metrados.ejecutado[node.id] : undefined;
        if (!porMes) {
            continue;
        }
        const fila: Record<MesKey, string> = {};
        for (const [mes, metrado] of Object.entries(porMes)) {
            if (metrado !== '') {
                fila[mes] = calcPartidaTotal(metrado, node.input.precioUnitario ?? 0).toFixed(2);
            }
        }
        montos[node.id] = fila;
    }

    return { montos };
}
