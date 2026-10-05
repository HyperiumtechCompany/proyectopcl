import { cn } from '@/lib/utils';
import { useControl } from '../../hooks/useControl';
import { D, safeDiv } from '../../lib/money';
import { CompositionBar, SALDO_TONE, SEQUENTIAL_TONES } from '../../shared/CompositionBar';
import { CurvaSChart } from '../../shared/CurvaSChart';
import { tableClasses as t } from '../../shared/table';
import { fmtMoney, fmtNumber, fmtPct } from '../../utils/format';
import { CurvaSTable } from './CurvaSTable';

/** Hoja CONTROL AVAN. FISICO: avance físico por valorización, saldo y Curva S. */
export default function ControlFisicoSheet() {
    const { control, contrato } = useControl();
    const original = contrato.principal;
    const vigente = contrato.vigente;
    const valorizadas = control.meses.filter((mes) => mes.ejecutado);
    const saldoMonto = vigente.sub(control.totalEjecutado);
    const saldoPct = D(1).sub(control.pctEjecutado);

    return (
        <div className="space-y-3">
            <div>
                <h2 className="text-lg font-bold text-stone-900 sm:text-xl dark:text-stone-50">Control de avance físico de obra</h2>
                <p className="text-xs text-stone-500 sm:text-sm dark:text-stone-400">
                    Contrato original {fmtMoney(original)} · vigente {fmtMoney(vigente)} ({fmtPct(safeDiv(vigente, original))} del original), incl. IGV.
                </p>
            </div>

            <div className="grid gap-3 @min-[64rem]:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
                <div className={t.wrap}>
                    <table className={cn(t.table, 'min-w-0')}>
                        <thead>
                            <tr>
                                <th colSpan={4} className={t.band}>Avance físico</th>
                            </tr>
                            <tr>
                                {['N°', 'Mes', 'Monto', '% mensual'].map((label, index) => (
                                    <th key={label} className={cn(t.th, index < 2 ? 'text-left' : 'text-right')}>{label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {control.meses.map((mes) => (
                                <tr key={mes.periodo.key}>
                                    <td className={t.td}>Val. N°{String(mes.numero).padStart(2, '0')}</td>
                                    <td className={t.td}>{mes.periodo.label}</td>
                                    <td className={cn(t.td, t.num)}>{mes.ejecutado ? fmtNumber(mes.ejecutado.mensual) : ''}</td>
                                    <td className={cn(t.td, t.num)}>{mes.ejecutado ? fmtPct(mes.ejecutado.pctMensual) : ''}</td>
                                </tr>
                            ))}
                            <tr className={t.total}>
                                <td colSpan={2} className={cn(t.td, 'text-[11px] tracking-wide uppercase')}>Acumulado</td>
                                <td className={cn(t.td, t.num)}>{fmtNumber(control.totalEjecutado)}</td>
                                <td className={cn(t.td, t.num)}>{fmtPct(control.pctEjecutado)}</td>
                            </tr>
                            <tr className="font-semibold text-stone-800 dark:text-stone-200">
                                <td colSpan={2} className={cn(t.td, 'text-[11px] tracking-wide uppercase')}>Saldo</td>
                                <td className={cn(t.td, t.num)}>{fmtNumber(saldoMonto)}</td>
                                <td className={cn(t.td, t.num)}>{fmtPct(saldoPct)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <CompositionBar
                    title="Avance físico de obra"
                    segments={[
                        ...valorizadas.map((mes, index) => ({
                            label: `Val. N°${String(mes.numero).padStart(2, '0')} · ${mes.periodo.label}`,
                            monto: mes.ejecutado!.mensual,
                            pct: mes.ejecutado!.pctMensual,
                            tone: SEQUENTIAL_TONES[index % SEQUENTIAL_TONES.length],
                        })),
                        { label: 'Saldo por ejecutar', monto: saldoMonto, pct: saldoPct, tone: SALDO_TONE },
                    ]}
                />
            </div>

            <CurvaSTable control={control} />
            <figure className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
                <CurvaSChart meses={control.meses} height={240} />
            </figure>
        </div>
    );
}
