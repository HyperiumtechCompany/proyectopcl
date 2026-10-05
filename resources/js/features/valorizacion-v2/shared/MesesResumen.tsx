import { cn } from '@/lib/utils';
import type { CalendarioMes } from '../sheets/calendario/computeCalendario';
import { fmtMoney, fmtPct } from '../utils/format';
import { Chip } from './Chip';

/** Tarjetas por mes: monto, avance mensual, acumulado y barra de progreso. */
export function MesesResumen({ meses, mesValorizacion }: { meses: CalendarioMes[]; mesValorizacion: string }) {
    return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {meses.map((mes) => {
                const actual = mes.periodo.key === mesValorizacion;

                return (
                    <div key={mes.periodo.key} className={cn('rounded-lg border px-3 py-2', actual ? 'border-orange-300 bg-orange-50/60 dark:border-orange-500/40 dark:bg-orange-500/10' : 'border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900')}>
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-semibold tracking-widest text-stone-600 uppercase dark:text-stone-300">
                                {mes.periodo.label} <span className="font-normal tracking-normal text-stone-400 normal-case">{mes.periodo.rango}</span>
                            </p>
                            {actual && <Chip tone="orange">Mes valorizado</Chip>}
                        </div>
                        <p className="mt-1 font-mono text-sm font-semibold text-stone-900 tabular-nums dark:text-stone-100">{fmtMoney(mes.totales.total)}</p>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                            <div className="h-full rounded-full bg-orange-500" style={{ width: `${Math.min(100, mes.acumulado.mul(100).toNumber())}%` }} />
                        </div>
                        <p className="mt-1 text-[11px] text-stone-500">
                            Mensual <span className="font-mono text-stone-700 dark:text-stone-300">{fmtPct(mes.totales.pesoCD)}</span> · Acumulado{' '}
                            <span className="font-mono font-semibold text-stone-900 dark:text-stone-100">{fmtPct(mes.acumulado)}</span>
                        </p>
                    </div>
                );
            })}
        </div>
    );
}
