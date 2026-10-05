import type Decimal from 'decimal.js';
import { cn } from '@/lib/utils';
import { useControl } from '../../hooks/useControl';
import { D, safeDiv } from '../../lib/money';
import { CompositionBar, SALDO_TONE } from '../../shared/CompositionBar';
import { tableClasses as t } from '../../shared/table';
import { useValorizacionStore } from '../../store/ValorizacionStoreProvider';
import { fmtMoney, fmtNumber, fmtPct } from '../../utils/format';

/** Hoja CONTROL FINANCIERO: facturable vs devengado (dato marcado por valorización) y pendiente por devengar. */
export default function ControlFinancieroSheet() {
    const { financiero, input, contrato } = useControl();
    const setDevengado = useValorizacionStore((state) => state.setDevengado);
    const vigente = contrato.vigente;
    const pctDe = (monto: Decimal) => safeDiv(monto, vigente);
    const { acumulado, saldo } = financiero;

    return (
        <div className="space-y-3">
            <div>
                <h2 className="text-lg font-bold text-stone-900 sm:text-xl dark:text-stone-50">Control de avance financiero de obra</h2>
                <p className="text-xs text-stone-500 sm:text-sm dark:text-stone-400">
                    Facturable = valorización ejecutada con IGV. Marca “devengado” cuando la valorización fue pagada; el pendiente se calcula solo.
                </p>
            </div>

            <div className={t.wrap}>
                <table className={t.table}>
                    <thead>
                        <tr>
                            <th rowSpan={2} className={cn(t.th, 'text-left')}>N°</th>
                            <th rowSpan={2} className={cn(t.th, 'text-left')}>Periodo</th>
                            <th rowSpan={2} className={cn(t.th, 'text-right')}>Monto facturable</th>
                            <th colSpan={3} className={t.band}>Montos devengados</th>
                            <th rowSpan={2} className={cn(t.th, 'text-right')}>Pendiente por devengar</th>
                        </tr>
                        <tr>
                            <th className={cn(t.th, 'text-center')}>Devengado</th>
                            <th className={cn(t.th, 'text-right')}>Monto</th>
                            <th className={cn(t.th, 'text-right')}>%</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td colSpan={7} className={cn(t.td, 'bg-stone-50 text-[11px] font-semibold tracking-wide text-stone-600 uppercase dark:bg-stone-800/50')}>A. Adelantos otorgados</td>
                        </tr>
                        {financiero.adelantos.map((adelanto) => (
                            <tr key={adelanto.concepto}>
                                <td className={t.td}>{adelanto.concepto}</td>
                                <td className={t.td}>—</td>
                                <td className={cn(t.td, t.num)}>{fmtNumber(adelanto.facturable)}</td>
                                <td className={cn(t.td, 'text-center text-stone-400')}>—</td>
                                <td className={cn(t.td, t.num)}>{fmtNumber(adelanto.devengado)}</td>
                                <td className={cn(t.td, t.num)}>{fmtPct(adelanto.pctDevengado)}</td>
                                <td className={cn(t.td, t.num)}>{fmtNumber(D(0))}</td>
                            </tr>
                        ))}
                        <tr>
                            <td colSpan={7} className={cn(t.td, 'bg-stone-50 text-[11px] font-semibold tracking-wide text-stone-600 uppercase dark:bg-stone-800/50')}>B. Valorizaciones de obra</td>
                        </tr>
                        {financiero.valorizaciones.map((v) => {
                            const marcado = Boolean(input.control.devengados[v.periodo.key]);

                            return (
                                <tr key={v.periodo.key}>
                                    <td className={t.td}>Valorización N°{String(v.numero).padStart(2, '0')}</td>
                                    <td className={t.td}>{v.periodo.label}</td>
                                    <td className={cn(t.td, t.num)}>{fmtNumber(v.facturable)}</td>
                                    <td className={cn(t.td, 'text-center')}>
                                        <input
                                            type="checkbox"
                                            checked={marcado}
                                            onChange={(event) => setDevengado(v.periodo.key, event.target.checked)}
                                            aria-label={`Valorización N°${v.numero} devengada`}
                                            className="size-4 rounded border-stone-300 accent-orange-600"
                                        />
                                    </td>
                                    <td className={cn(t.td, t.num)}>{fmtNumber(v.devengado)}</td>
                                    <td className={cn(t.td, t.num)}>{fmtPct(v.pctDevengado)}</td>
                                    <td className={cn(t.td, t.num, !v.pendiente.isZero() && 'font-semibold text-orange-700 dark:text-orange-300')}>{fmtNumber(v.pendiente)}</td>
                                </tr>
                            );
                        })}
                        <tr className={t.total}>
                            <td colSpan={2} className={cn(t.td, 'text-[11px] tracking-wide uppercase')}>Acumulado</td>
                            <td className={cn(t.td, t.num)}>{fmtNumber(acumulado.facturable)}</td>
                            <td className={t.td} />
                            <td className={cn(t.td, t.num)}>{fmtNumber(acumulado.devengado)}</td>
                            <td className={cn(t.td, t.num)}>{fmtPct(acumulado.pctDevengado)}</td>
                            <td className={cn(t.td, t.num)}>{fmtNumber(acumulado.pendiente)}</td>
                        </tr>
                        <tr className="font-semibold text-stone-800 dark:text-stone-200">
                            <td colSpan={2} className={cn(t.td, 'text-[11px] tracking-wide uppercase')}>Saldo</td>
                            <td className={cn(t.td, t.num)}>{fmtNumber(saldo.facturable)}</td>
                            <td className={t.td} />
                            <td className={cn(t.td, t.num)}>{fmtNumber(saldo.devengado)}</td>
                            <td className={cn(t.td, t.num)}>{fmtPct(saldo.pctDevengado)}</td>
                            <td className={cn(t.td, t.num)}>{fmtNumber(saldo.pendiente)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <CompositionBar
                title="Control financiero de la obra"
                segments={[
                    { label: 'Devengado', monto: acumulado.devengado, pct: pctDe(acumulado.devengado), tone: 'bg-orange-600' },
                    { label: 'Facturable pendiente de devengar', monto: acumulado.pendiente, pct: pctDe(acumulado.pendiente), tone: 'bg-orange-300' },
                    { label: 'Saldo de obra por valorizar', monto: saldo.facturable, pct: pctDe(saldo.facturable), tone: SALDO_TONE },
                ]}
            />
            <p className="text-[11px] text-stone-500">Montos con IGV sobre el contrato vigente {fmtMoney(vigente)}.</p>
        </div>
    );
}
