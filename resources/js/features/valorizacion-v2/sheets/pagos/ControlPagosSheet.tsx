import { cn } from '@/lib/utils';
import { usePagos } from '../../hooks/usePagos';

import { D } from '../../lib/money';
import { EditableCell } from '../../shared/EditableCell';
import { tableClasses as t } from '../../shared/table';
import { useValorizacionStore } from '../../store/ValorizacionStoreProvider';
import { fmtNumber } from '../../utils/format';
import { AdicionalesTable } from './AdicionalesTable';

const COLUMNAS = [
    ['Monto', '(V)'],
    ['Reajuste', '(R)'],
    ['Val. bruta', 'Vb=V+R'],
    ['Amort. directo', '(D)'],
    ['Amort. materiales', '(M)'],
    ['Val. neta facturable', 'Vn=Vb−(D+M)'],
    ['Retención G.F.C.', '(G)'],
    ['Penalidades', '(P)'],
    ['Detracciones', '(Det)'],
    ['Base imponible', 'Líquido/(1+IGV)'],
    ['IGV', ''],
    ['Monto líquido pagado', 'Vn−(G+P+Det)'],
] as const;

/** Hoja CONTROL DE PAGOS: valorizaciones tramitadas y pagadas, con desglose fiscal y comprobantes. */
export default function ControlPagosSheet() {
    const { controlPagos, input, adicionales, periodos, mesValorizacion } = usePagos();
    const setAjustePago = useValorizacionStore((state) => state.setAjustePago);
    const { filas, total } = controlPagos;
    const { contratista } = input.fichaTecnica;
    const adelantos = [
        ['Adelanto directo', contratista.adelantoDirecto.monto],
        ['Adelanto de materiales', contratista.adelantoMateriales.monto],
    ] as const;
    const valores = (fila: (typeof filas)[number]) => [
        fila.monto, fila.reajuste, fila.bruta, fila.amortizacionDirecto, fila.amortizacionMateriales, fila.neta,
        fila.retencion, fila.penalidades, fila.detraccion, fila.base, fila.igv, fila.liquido,
    ];

    return (
        <div className="space-y-3">
            <div>
                <h2 className="text-lg font-bold text-stone-900 sm:text-xl dark:text-stone-50">Control de pagos</h2>
                <p className="text-xs text-stone-500 sm:text-sm dark:text-stone-400">Valorizaciones tramitadas y pagadas. Factura, comprobante y fecha de pago se registran aquí.</p>
            </div>

            <section className="space-y-2">
                <h3 className="text-xs font-semibold tracking-widest text-stone-600 uppercase dark:text-stone-300">Contrato principal</h3>
                <div className={t.wrap}>
                    <table className={cn(t.table, 'min-w-6xl')}>
                        <thead>
                            <tr>
                                <th rowSpan={2} className={cn(t.th, 'text-left')}>N°</th>
                                <th rowSpan={2} className={cn(t.th, 'text-left')}>Mes</th>
                                {COLUMNAS.map(([label]) => (
                                    <th key={label} className={cn(t.th, 'text-right')}>{label}</th>
                                ))}
                                <th colSpan={3} className={t.band}>Comprobantes de pago</th>
                            </tr>
                            <tr>
                                {COLUMNAS.map(([label, formula]) => (
                                    <th key={label} className={cn(t.th, 'text-right font-mono font-normal normal-case')}>{formula}</th>
                                ))}
                                <th className={cn(t.th, 'text-left')}>Factura</th>
                                <th className={cn(t.th, 'text-left')}>Comprobante</th>
                                <th className={cn(t.th, 'text-left')}>Fecha de pago</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filas.map((fila) => (
                                <tr key={fila.periodo.key}>
                                    <td className={cn(t.td, 'font-mono')}>{fila.numero}</td>
                                    <td className={t.td}>{fila.periodo.label}</td>
                                    {valores(fila).map((valor, index) => (
                                        <td key={COLUMNAS[index][0]} className={cn(t.td, t.num, index === 11 && 'font-semibold text-stone-900 dark:text-stone-100')}>{valor.isZero() ? '—' : fmtNumber(valor)}</td>
                                    ))}
                                    <td className={cn(t.td, 'w-28')}>
                                        <EditableCell label={`Factura valorización ${fila.numero}`} placeholder="F001-…" value={fila.ajustes.facturaNro ?? null} onCommit={(v) => setAjustePago(fila.periodo.key, 'facturaNro', v)} />
                                    </td>
                                    <td className={cn(t.td, 'w-28')}>
                                        <EditableCell label={`Comprobante valorización ${fila.numero}`} placeholder="N°" value={fila.ajustes.comprobanteNro ?? null} onCommit={(v) => setAjustePago(fila.periodo.key, 'comprobanteNro', v)} />
                                    </td>
                                    <td className={cn(t.td, 'w-28')}>
                                        <EditableCell
                                            label={`Fecha de pago valorización ${fila.numero}`}
                                            kind="date"
                                            value={fila.ajustes.fechaPago ?? null}
                                            onCommit={(v) => setAjustePago(fila.periodo.key, 'fechaPago', v)}
                                        />
                                    </td>
                                </tr>
                            ))}
                            <tr className={t.total}>
                                <td colSpan={2} className={cn(t.td, 'text-[11px] tracking-wide text-inherit uppercase')}>Total</td>
                                {[total.monto, total.reajuste, total.bruta, total.amortizacionDirecto, total.amortizacionMateriales, total.neta, total.retencion, total.penalidades, total.detraccion, total.base, total.igv, total.liquido].map((valor, index) => (
                                    <td key={COLUMNAS[index][0]} className={cn(t.td, t.num, 'text-inherit')}>{valor.isZero() ? '—' : fmtNumber(valor)}</td>
                                ))}
                                <td colSpan={3} className={t.td} />
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <div className="grid gap-3 lg:max-w-2xl">
                <section className="space-y-2">
                    <h3 className="text-xs font-semibold tracking-widest text-stone-600 uppercase dark:text-stone-300">Adelantos (con IGV)</h3>
                    <div className={t.wrap}>
                        <table className={cn(t.table, 'min-w-0')}>
                            <thead>
                                <tr>
                                    {['Concepto', 'Monto', 'Base imponible', 'IGV'].map((label, index) => (
                                        <th key={label} className={cn(t.th, index === 0 ? 'text-left' : 'text-right')}>{label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {adelantos.map(([concepto, monto]) => {
                                    const valor = D(monto ?? 0);
                                    const base = valor.div(D(1).add(input.parametros.igv));

                                    return (
                                        <tr key={concepto}>
                                            <td className={t.td}>{concepto}</td>
                                            <td className={cn(t.td, t.num)}>{monto === null ? 'No se otorgó' : fmtNumber(valor)}</td>
                                            <td className={cn(t.td, t.num)}>{monto === null ? '—' : fmtNumber(base)}</td>
                                            <td className={cn(t.td, t.num)}>{monto === null ? '—' : fmtNumber(valor.sub(base))}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            <AdicionalesTable datos={adicionales} periodos={periodos} mesPorDefecto={mesValorizacion} />

            <div className="flex flex-wrap items-center justify-end gap-6 rounded-lg border border-stone-900 bg-stone-900 px-4 py-3 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900">
                <span className="text-[11px] font-semibold tracking-widest uppercase opacity-70">Total pagado (contrato principal + adicionales)</span>
                <span className="font-mono text-lg font-bold tabular-nums">{fmtNumber(total.liquido.add(adicionales.total.total))}</span>
            </div>
        </div>
    );
}
