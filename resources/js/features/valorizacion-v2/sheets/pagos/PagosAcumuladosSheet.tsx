import { cn } from '@/lib/utils';
import { usePagos } from '../../hooks/usePagos';
import { formatMonthYear } from '../../lib/dates';
import { tableClasses as t } from '../../shared/table';
import { useValorizacionStore } from '../../store/ValorizacionStoreProvider';
import { fmtNumber } from '../../utils/format';
import { EstadoPagoTable } from './EstadoPagoTable';

/** Hoja PAGOS ACUMULADOS: contratado · anterior (suma de pagos previos) · actual · acumulado · saldo por pagar. */
export default function PagosAcumuladosSheet() {
    const { acumulados, resumen, parametros, input, mesValorizacion } = usePagos();
    const setAjustePago = useValorizacionStore((state) => state.setAjustePago);
    const { periodo } = input;

    return (
        <div className="space-y-3">
            <div>
                <h2 className="text-lg font-bold text-stone-900 sm:text-xl dark:text-stone-50">
                    Resumen de la Valorización N°{String(periodo.numero).padStart(2, '0')} · {formatMonthYear(periodo.mes)}
                </h2>
                <p className="text-xs text-stone-500 sm:text-sm dark:text-stone-400">El acumulado anterior es la suma de los pagos de las valorizaciones previas (en el Excel era un número tecleado).</p>
            </div>

            <div className={t.wrap}>
                <table className={cn(t.table, 'min-w-4xl')}>
                    <thead>
                        <tr>
                            {['Ítem', 'Descripción de sub presupuestos', 'Monto contratado', 'Acumulado anterior', 'Actual', 'Acumulado actual', 'Saldo por pagar'].map((label, index) => (
                                <th key={label} className={cn(t.th, index < 2 ? 'text-left' : 'text-right', label === 'Actual' && 'bg-orange-100 text-orange-900 dark:bg-orange-500/20 dark:text-orange-200')}>{label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {resumen.componentes.map((comp) => (
                            <tr key={comp.node.id}>
                                <td className={cn(t.td, 'font-mono')}>{comp.node.codigo}</td>
                                <td className={cn(t.td, 'whitespace-normal')}>{comp.node.descripcion}</td>
                                <td className={cn(t.td, t.num)}>{fmtNumber(comp.contratado)}</td>
                                <td className={cn(t.td, t.num)}>{comp.anterior.monto.isZero() ? '—' : fmtNumber(comp.anterior.monto)}</td>
                                <td className={cn(t.td, t.num, 'bg-orange-50/40 dark:bg-orange-500/5')}>{comp.actual.monto.isZero() ? '—' : fmtNumber(comp.actual.monto)}</td>
                                <td className={cn(t.td, t.num)}>{fmtNumber(comp.acumulado.monto)}</td>
                                <td className={cn(t.td, t.num)}>{comp.saldo.monto.isZero() ? '—' : fmtNumber(comp.saldo.monto)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <EstadoPagoTable
                parametros={parametros}
                detraccion={input.pagos.porcentajeDetraccion}
                columnas={[
                    { label: 'Monto contratado', pago: acumulados.contratado },
                    { label: 'Acumulado anterior', pago: acumulados.anterior },
                    {
                        label: 'Actual',
                        pago: acumulados.actual,
                        highlight: true,
                        editable: { valores: input.pagos.porMes[mesValorizacion] ?? {}, onEdit: (campo, valor) => setAjustePago(mesValorizacion, campo, valor) },
                    },
                    { label: 'Acumulado actual', pago: acumulados.acumulado },
                    { label: 'Saldo por pagar', pago: acumulados.saldo },
                ]}
            />
        </div>
    );
}
