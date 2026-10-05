import { cn } from '@/lib/utils';
import { usePagos } from '../../hooks/usePagos';
import { parseDecimal } from '../../lib/money';
import { montoEnLetrasTexto } from '../../lib/spanishWords';
import { EditableCell } from '../../shared/EditableCell';
import { tableClasses as t } from '../../shared/table';
import { useValorizacionStore } from '../../store/ValorizacionStoreProvider';
import type { ConfigRfc } from '../../types';
import { fmtMoney, fmtNumber, fmtPct } from '../../utils/format';

/** Hoja R.F.C: retención de garantía de fiel cumplimiento (MYPE) programada y efectiva por valorización. */
export default function RetencionFCSheet() {
    const { rfc, input, mesValorizacion } = usePagos();
    const setConfigPagos = useValorizacionStore((state) => state.setConfigPagos);
    const { contratista } = input.fichaTecnica;
    const config = input.pagos.rfc;
    const programadaEn = config.modo === 'primer-pago' ? 'en el primer pago, es decir, en la primera valorización' : 'en forma prorrateada durante la primera mitad del número de pagos a realizarse';
    const resumen = [
        ['Retención anterior acumulada', rfc.anteriorAcumulada],
        ['Retención actual', rfc.actual],
        ['Retención actual acumulada', rfc.actualAcumulada],
        ['Saldo por retener', rfc.saldoPorRetener],
    ] as const;

    return (
        <div className="space-y-3">
            <div>
                <h2 className="text-lg font-bold text-stone-900 sm:text-xl dark:text-stone-50">Retención de garantía de fiel cumplimiento</h2>
                <p className="text-xs text-stone-500 sm:text-sm dark:text-stone-400">Monto del contrato {fmtMoney(rfc.contrato)}</p>
            </div>

            <div className="grid gap-3 @min-[72rem]:grid-cols-[minmax(0,1fr)_20rem]">
                <article className="space-y-2 rounded-lg border border-stone-200 bg-white p-4 text-[13px] leading-relaxed text-stone-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
                    <p className="font-semibold text-stone-900 dark:text-stone-100">Según el Reglamento de la Ley General de Contrataciones Públicas:</p>
                    <p>
                        El {contratista.ejecutor}, con el objetivo de cumplir con el Artículo 114 del Reglamento de la Ley N°32069, Ley General de Contrataciones Públicas, en los contratos de
                        ejecución de obras que celebren las Entidades con las micro y pequeñas empresas (MYPES), estas últimas pueden otorgar como Garantía de Fiel Cumplimiento el{' '}
                        {fmtPct(config.porcentaje, 0)} del monto del contrato original, cuyo monto asciende a <strong>{fmtMoney(rfc.total)}</strong> ({montoEnLetrasTexto(rfc.total)}) incluido IGV,
                        porcentaje que es retenido por la Entidad durante la primera mitad del número de pagos a realizarse, en forma prorrateada, con cargo a ser devuelto en la liquidación de
                        la Obra.
                    </p>
                    <p>
                        En ese sentido, se programó realizar la retención de garantía de fiel cumplimiento {programadaEn}, por un monto de retención total de{' '}
                        <strong>{fmtMoney(rfc.total)}</strong> ({montoEnLetrasTexto(rfc.total)}) incluido IGV.
                    </p>
                </article>

                <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
                    <p className="text-xs font-semibold tracking-widest text-stone-600 uppercase dark:text-stone-300">Configuración</p>
                    <label className="block text-xs text-stone-600 dark:text-stone-400">
                        Porcentaje de retención
                        <EditableCell
                            label="Porcentaje de retención"
                            kind="number"
                            align="right"
                            className="mt-1"
                            value={parseDecimal(config.porcentaje)?.mul(100).toString() ?? null}
                            parse={(raw) => {
                                const pct = parseDecimal(raw.replace('%', ''));

                                return pct === null || pct.lte(0) || pct.gt(100) ? false : pct.div(100).toString();
                            }}
                            onCommit={(porcentaje) => porcentaje && setConfigPagos({ rfc: { porcentaje } })}
                        />
                    </label>
                    <label className="block text-xs text-stone-600 dark:text-stone-400">
                        Programación
                        <select
                            value={config.modo}
                            onChange={(event) => setConfigPagos({ rfc: { modo: event.target.value as ConfigRfc['modo'] } })}
                            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
                        >
                            <option value="primer-pago">Todo en el primer pago</option>
                            <option value="prorrateo-mitad">Prorrateado en la primera mitad de pagos</option>
                        </select>
                    </label>
                </div>
            </div>

            <div className={t.wrap}>
                <table className={t.table}>
                    <thead>
                        <tr>
                            {['N°', 'Mes', 'Monto valorizado', 'Retención mensual programada', 'Retención efectiva'].map((label, index) => (
                                <th key={label} className={cn(t.th, index < 2 ? 'text-left' : 'text-right')}>{label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rfc.meses.map((mes) => (
                            <tr key={mes.periodo.key} className={mes.periodo.key === mesValorizacion ? 'bg-orange-50/60 dark:bg-orange-500/5' : undefined}>
                                <td className={cn(t.td, 'font-mono')}>{String(mes.numero).padStart(2, '0')}</td>
                                <td className={t.td}>{mes.periodo.label}{mes.periodo.key === mesValorizacion && <span className="ml-1 text-orange-600">★</span>}</td>
                                <td className={cn(t.td, t.num)}>{fmtNumber(mes.valorizado)}</td>
                                <td className={cn(t.td, t.num)}>{fmtNumber(mes.programada)}</td>
                                <td className={cn(t.td, t.num, 'font-semibold')}>{fmtNumber(mes.efectiva)}</td>
                            </tr>
                        ))}
                        {resumen.map(([label, value]) => (
                            <tr key={label} className="text-stone-800 dark:text-stone-200">
                                <td colSpan={4} className={cn(t.td, 'text-[11px] tracking-wide text-inherit uppercase')}>{label}</td>
                                <td className={cn(t.td, t.num, 'text-inherit')}>{fmtNumber(value)}</td>
                            </tr>
                        ))}
                        <tr className={t.total}>
                            <td colSpan={4} className={cn(t.td, 'text-right text-[11px] tracking-wide text-inherit uppercase')}>Total a retenerse en esta valorización</td>
                            <td className={cn(t.td, t.num, 'bg-amber-200 text-inherit dark:bg-amber-500/30')}>{fmtMoney(rfc.actual)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
