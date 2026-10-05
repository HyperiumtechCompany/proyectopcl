import { cn } from '@/lib/utils';
import { AprobacionControl } from '../../components/AprobacionControl';
import { usePagos } from '../../hooks/usePagos';
import { formatMonthYear } from '../../lib/dates';
import { montoEnLetrasTexto } from '../../lib/spanishWords';
import { tableClasses as t } from '../../shared/table';
import { useValorizacionStore } from '../../store/ValorizacionStoreProvider';
import { fmtMoney, fmtNumber, fmtPct } from '../../utils/format';
import { EstadoPagoTable } from './EstadoPagoTable';

/** Hoja R PAGO MENSUAL: del monto valorizado del mes al líquido a pagar; los ajustes manuales se editan aquí. */
export default function ResumenPagoSheet() {
    const { acumulados, resumen, parametros, input, mesValorizacion, vm } = usePagos();
    const setAjustePago = useValorizacionStore((state) => state.setAjustePago);
    const { periodo, fichaTecnica } = input;
    const pago = acumulados.actual;
    const titulo = `Valorización N°${String(periodo.numero).padStart(2, '0')} del mes de ${formatMonthYear(periodo.mes).toLowerCase()}`;

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <h2 className="text-lg font-bold text-stone-900 sm:text-xl dark:text-stone-50">Resumen de pago</h2>
                    <p className="text-xs text-stone-500 sm:text-sm dark:text-stone-400">{titulo} · los campos en amarillo son ajustes manuales del mes.</p>
                </div>
                <AprobacionControl valorizado={pago.a} liquido={pago.k} avanceAcumulado={vm.pies.acumulado.pesoCD} />
                <div className="min-w-0 max-w-full rounded-lg border border-orange-700 bg-orange-700 px-4 py-3 text-right text-white dark:border-orange-500/50 dark:bg-orange-500/15 dark:text-orange-100">
                    <p className="text-xs font-semibold tracking-wide text-orange-100 uppercase">Líquido a pagar</p>
                    <p className="mt-1 font-mono text-lg font-bold tabular-nums wrap-break-word">{fmtMoney(pago.k)}</p>
                </div>
            </div>

            <div className="grid gap-3 @min-[72rem]:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div className={t.wrap}>
                    <table className={cn(t.table, 'min-w-0')}>
                        <thead>
                            <tr>
                                {['Ítem', 'Componente', '% actual', 'Monto'].map((label, index) => (
                                    <th key={label} className={cn(t.th, index < 2 ? 'text-left' : 'text-right')}>{label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {resumen.componentes.map((comp) => (
                                <tr key={comp.node.id}>
                                    <td className={cn(t.td, 'font-mono')}>{comp.node.codigo}</td>
                                    <td className={cn(t.td, 'whitespace-normal')}>{comp.node.descripcion}</td>
                                    <td className={cn(t.td, t.num, 'text-stone-500')}>{fmtPct(comp.actual.pct)}</td>
                                    <td className={cn(t.td, t.num)}>{fmtNumber(comp.actual.monto)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <EstadoPagoTable
                    parametros={parametros}
                    detraccion={input.pagos.porcentajeDetraccion}
                    columnas={[
                        {
                            label: 'Monto',
                            pago,
                            highlight: true,
                            editable: {
                                valores: input.pagos.porMes[mesValorizacion] ?? {},
                                onEdit: (campo, valor) => setAjustePago(mesValorizacion, campo, valor),
                            },
                        },
                    ]}
                />
            </div>

            <p className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-[13px] leading-relaxed text-stone-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
                El monto a facturar por el contratista ejecutor <strong>{fichaTecnica.contratista.ejecutor}</strong> en la presente <strong>{titulo.toUpperCase()}</strong>, asciende a la suma de{' '}
                <strong>{fmtMoney(pago.j)}</strong> ({montoEnLetrasTexto(pago.j)}) incluido IGV.
            </p>
        </div>
    );
}
