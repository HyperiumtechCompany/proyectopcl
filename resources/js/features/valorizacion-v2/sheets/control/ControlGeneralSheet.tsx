import { cn } from '@/lib/utils';
import { useControl } from '../../hooks/useControl';
import { D } from '../../lib/money';
import { SituacionBadge } from '../../shared/SituacionBadge';
import { tableClasses as t } from '../../shared/table';
import { fmtMoney, fmtNumber, fmtPct } from '../../utils/format';

function Tarjeta({ label, value, hint, strong = false }: { label: string; value: string; hint?: string; strong?: boolean }) {
    return (
        <div className={cn('rounded-lg border px-3 py-2', strong ? 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10' : 'border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900')}>
            <p className="text-[11px] leading-relaxed font-semibold tracking-wide text-stone-600 uppercase dark:text-stone-300">{label}</p>
            <p className="mt-1 font-mono text-sm font-semibold text-stone-900 tabular-nums wrap-break-word dark:text-stone-100">{value}</p>
            {hint && <p className="mt-1 text-xs text-stone-600 dark:text-stone-300">{hint}</p>}
        </div>
    );
}

/** Hoja CONTROL GEN. AVAN. OBRA. (incluye PROGRAMADO): programado vs ejecutado por mes y evaluación del atraso. */
export default function ControlGeneralSheet() {
    const { control, mesValorizacion } = useControl();
    const { ultima } = control;

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <h2 className="text-lg font-bold text-stone-900 sm:text-xl dark:text-stone-50">Control general de avance de obra</h2>
                    <p className="text-xs text-stone-500 sm:text-sm dark:text-stone-400">Montos con IGV de los calendarios; los % se calculan sobre el total programado.</p>
                </div>
                {ultima?.evaluacion && <SituacionBadge situacion={ultima.evaluacion.situacion} prefix="Obra " />}
            </div>

            <div className="grid grid-cols-1 gap-2 @min-[28rem]:grid-cols-2 @min-[64rem]:grid-cols-4">
                <Tarjeta label="Programado acumulado" value={fmtPct(ultima?.programado.pctAcumulado)} hint={fmtMoney(ultima?.programado.acumulado)} />
                <Tarjeta label="Ejecutado acumulado" value={fmtPct(ultima?.ejecutado?.pctAcumulado)} hint={fmtMoney(ultima?.ejecutado?.acumulado)} strong />
                <Tarjeta label="80 % del programado" value={fmtPct(ultima?.ochenta)} hint="Límite de atraso (causal de intervención)" />
                <Tarjeta
                    label="Atraso (−) / adelanto (+)"
                    value={ultima?.evaluacion ? `${ultima.evaluacion.diferencia.isNegative() ? '' : '+'}${fmtPct(ultima.evaluacion.diferencia)}` : '—'}
                    hint={ultima ? `Al cierre de ${ultima.periodo.label}` : undefined}
                />
            </div>

            <div className={t.wrap}>
                <table className={cn(t.table, 'min-w-5xl')}>
                    <thead>
                        <tr>
                            <th colSpan={2} className={t.band}>Valorización</th>
                            <th colSpan={4} className={t.band}>Programado</th>
                            <th colSpan={4} className={t.band}>Ejecutado</th>
                            <th colSpan={4} className={t.band}>Evaluación del atraso (80 % del programado acumulado)</th>
                            <th rowSpan={2} className={cn(t.th, 'text-center')}>Situación</th>
                        </tr>
                        <tr>
                            {['N°', 'Mes', 'Mensual', 'Acumulado', '% mensual', '% acumulado', 'Mensual', 'Acumulado', '% mensual', '% acumulado', '% prog. acum.', '80 % prog.', '% ejec. acum.', 'Atraso (−) / adelanto (+)'].map((label, index) => (
                                <th key={label} className={cn(t.th, index < 2 ? 'text-left' : 'text-right')}>{label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {control.meses.map((mes) => {
                            const actual = mes.periodo.key === mesValorizacion;

                            return (
                                <tr key={mes.periodo.key} className={actual ? 'bg-orange-50/60 dark:bg-orange-500/5' : undefined}>
                                    <td className={cn(t.td, 'font-mono')}>{String(mes.numero).padStart(2, '0')}</td>
                                    <td className={t.td}>{mes.periodo.label}{actual && <span className="ml-1 text-orange-600">★</span>}</td>
                                    <td className={cn(t.td, t.num)}>{fmtNumber(mes.programado.mensual)}</td>
                                    <td className={cn(t.td, t.num)}>{fmtNumber(mes.programado.acumulado)}</td>
                                    <td className={cn(t.td, t.num)}>{fmtPct(mes.programado.pctMensual)}</td>
                                    <td className={cn(t.td, t.num, 'font-semibold')}>{fmtPct(mes.programado.pctAcumulado)}</td>
                                    <td className={cn(t.td, t.num)}>{mes.ejecutado ? fmtNumber(mes.ejecutado.mensual) : ''}</td>
                                    <td className={cn(t.td, t.num)}>{mes.ejecutado ? fmtNumber(mes.ejecutado.acumulado) : ''}</td>
                                    <td className={cn(t.td, t.num)}>{mes.ejecutado ? fmtPct(mes.ejecutado.pctMensual) : ''}</td>
                                    <td className={cn(t.td, t.num, 'font-semibold')}>{mes.ejecutado ? fmtPct(mes.ejecutado.pctAcumulado) : ''}</td>
                                    <td className={cn(t.td, t.num)}>{mes.evaluacion ? fmtPct(mes.programado.pctAcumulado) : ''}</td>
                                    <td className={cn(t.td, t.num)}>{mes.evaluacion ? fmtPct(mes.ochenta) : ''}</td>
                                    <td className={cn(t.td, t.num)}>{mes.ejecutado && mes.evaluacion ? fmtPct(mes.ejecutado.pctAcumulado) : ''}</td>
                                    <td className={cn(t.td, t.num, mes.evaluacion?.diferencia.isNegative() && 'text-red-600 dark:text-red-400')}>{mes.evaluacion ? fmtPct(mes.evaluacion.diferencia) : ''}</td>
                                    <td className={cn(t.td, 'text-center')}>{mes.evaluacion && <SituacionBadge situacion={mes.evaluacion.situacion} />}</td>
                                </tr>
                            );
                        })}
                        <tr className={t.total}>
                            <td colSpan={2} className={cn(t.td, 'text-[11px] tracking-wide uppercase')}>Total c/IGV</td>
                            <td className={cn(t.td, t.num)}>{fmtMoney(control.totalProgramado)}</td>
                            <td className={t.td} />
                            <td className={cn(t.td, t.num)}>{fmtPct(control.meses.reduce((acc, m) => acc.add(m.programado.pctMensual), D(0)))}</td>
                            <td className={t.td} />
                            <td className={cn(t.td, t.num)}>{fmtMoney(control.totalEjecutado)}</td>
                            <td className={t.td} />
                            <td className={cn(t.td, t.num)}>{fmtPct(control.pctEjecutado)}</td>
                            <td className={t.td} />
                            <td className={cn(t.td, t.num)}>{fmtPct(ultima?.programado.pctAcumulado)}</td>
                            <td className={cn(t.td, t.num)}>{fmtPct(ultima?.ochenta)}</td>
                            <td className={cn(t.td, t.num)}>{fmtPct(ultima?.ejecutado?.pctAcumulado)}</td>
                            <td className={cn(t.td, t.num)}>{ultima?.evaluacion ? fmtPct(ultima.evaluacion.diferencia) : ''}</td>
                            <td className={cn(t.td, 'text-center text-[11px] tracking-wide uppercase')}>{control.situacionObra}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
