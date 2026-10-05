import { cn } from '@/lib/utils';
import { parseMontoOPorcentaje } from '../../lib/money';
import type { Periodo } from '../../lib/periodos';
import { EditableCell } from '../../shared/EditableCell';
import type { TreeColumn } from '../../shared/tree/PartidaTreeTable';
import type { TipoCalendario } from '../../types';
import { fmtNumber, fmtPct } from '../../utils/format';
import type { CalendarioFila } from './computeCalendario';

const num = 'font-mono tabular-nums';

interface Options {
    tipo: TipoCalendario;
    periodos: Periodo[];
    mesValorizacion: string;
    editing: boolean;
    showPct: boolean;
    onMonto: (fila: CalendarioFila, mes: string, monto: string | null) => void;
}

/** Color del control por fila: programado debe llegar a 100 %; ejecutado no debe pasarlo. */
function estadoClass(tipo: TipoCalendario, fila: CalendarioFila): string {
    if (!fila.node.esHoja) {
        return '';
    }
    if (fila.estado === 'excedido') {
        return 'text-red-600 dark:text-red-400';
    }
    if (tipo === 'programado' && fila.estado !== 'completo' && !fila.total.isZero()) {
        return 'text-amber-700 dark:text-amber-300';
    }

    return 'text-stone-500';
}

/**
 * Columnas de CALEN. PROG. / CALEN. VALO.: total de la partida, por cada mes
 * (% y costo) y control (Σ % · Σ costo · saldo). En edición, el costo de cada
 * partida es un input que acepta monto ("1600") o porcentaje ("25%").
 */
export function calendarioColumns({ tipo, periodos, mesValorizacion, editing, showPct, onMonto }: Options): TreeColumn<CalendarioFila>[] {
    const meses = periodos.flatMap((periodo): TreeColumn<CalendarioFila>[] => {
        const actual = periodo.key === mesValorizacion;
        const group = `${periodo.label} · ${periodo.rango}${actual ? ' ★' : ''}`;
        const tone = actual ? 'bg-orange-50/40 dark:bg-orange-500/5' : '';
        const pct: TreeColumn<CalendarioFila> = {
            id: `${periodo.key}-pct`,
            header: '%',
            group,
            className: cn(num, 'text-stone-500', tone),
            cell: (fila) => {
                const value = fila.meses[periodo.key]?.pct;

                return value ? fmtPct(value) : '';
            },
        };
        const costo: TreeColumn<CalendarioFila> = {
            id: `${periodo.key}-costo`,
            header: 'Costo (S/)',
            group,
            className: cn(num, editing && 'w-28', tone),
            cell: (fila) => {
                const celda = fila.meses[periodo.key];
                if (editing && fila.node.esHoja) {
                    return (
                        <EditableCell
                            label={`${periodo.label} ${fila.node.codigo}`}
                            kind="number"
                            align="right"
                            title="Monto (1600) o porcentaje del total (25%)"
                            value={celda?.monto ? celda.monto.toString() : null}
                            parse={(raw) => parseMontoOPorcentaje(raw, fila.total)}
                            onCommit={(monto) => onMonto(fila, periodo.key, monto)}
                        />
                    );
                }

                return celda?.monto ? fmtNumber(celda.monto) : '';
            },
        };

        return showPct ? [pct, costo] : [costo];
    });

    return [
        { id: 'total', header: 'Total (S/)', group: 'Presupuesto', className: num, cell: (fila) => fmtNumber(fila.total) },
        ...meses,
        {
            id: 'suma-pct',
            header: 'Σ %',
            group: 'Control',
            className: num,
            cell: (fila) => (fila.estado === 'sin-datos' ? '' : <span className={estadoClass(tipo, fila)}>{fmtPct(fila.sumaPct)}</span>),
        },
        {
            id: 'saldo',
            header: tipo === 'programado' ? 'Sin programar' : 'Saldo',
            group: 'Control',
            className: num,
            cell: (fila) => (fila.saldo.isZero() ? '' : <span className={estadoClass(tipo, fila)}>{fmtNumber(fila.saldo)}</span>),
        },
    ];
}
