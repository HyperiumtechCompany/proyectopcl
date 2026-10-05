import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Periodo } from '../../lib/periodos';
import { newPartidaId } from '../../lib/presupuestoOps';
import { EditableCell } from '../../shared/EditableCell';
import { tableClasses as t } from '../../shared/table';
import { useValorizacionStore } from '../../store/ValorizacionStoreProvider';
import type { AdicionalPago } from '../../types';
import { fmtNumber } from '../../utils/format';
import type { computeAdicionales } from './computePagos';

type MontoCampo = 'monto' | 'reajuste' | 'amortizacionDirecto' | 'amortizacionMateriales' | 'retencion' | 'penalidades';

const MONTOS: Array<[MontoCampo, string]> = [
    ['monto', 'Monto (V)'],
    ['reajuste', 'Reajuste (R)'],
    ['amortizacionDirecto', 'Amort. directo (D)'],
    ['amortizacionMateriales', 'Amort. materiales (M)'],
    ['retencion', 'G.F.C. (G)'],
    ['penalidades', 'Penalidades (P)'],
];

/** Tabla editable de adicionales, mayores gastos generales, intereses u otros (CONTROL DE PAGOS). */
export function AdicionalesTable({ datos, periodos, mesPorDefecto }: { datos: ReturnType<typeof computeAdicionales>; periodos: Periodo[]; mesPorDefecto: string }) {
    const addAdicional = useValorizacionStore((state) => state.addAdicional);
    const updateAdicional = useValorizacionStore((state) => state.updateAdicional);
    const removeAdicional = useValorizacionStore((state) => state.removeAdicional);
    const { filas, total } = datos;

    const nuevo = (): AdicionalPago => ({
        id: newPartidaId().replace('p-', 'ad-'),
        mes: mesPorDefecto,
        concepto: 'ADICIONAL',
        monto: '0',
        reajuste: '0',
        amortizacionDirecto: '0',
        amortizacionMateriales: '0',
        retencion: '0',
        penalidades: '0',
        facturaNro: '',
        comprobanteNro: '',
        fechaPago: null,
    });

    return (
        <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold tracking-widest text-stone-600 uppercase dark:text-stone-300">Adicionales, costos adicionales, mayores gastos generales, intereses y otros</h3>
                <button type="button" onClick={() => addAdicional(nuevo())} className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:border-orange-400 hover:text-orange-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200">
                    <Plus className="size-3.5" /> Agregar adicional
                </button>
            </div>
            <div className={t.wrap}>
                <table className={cn(t.table, 'min-w-7xl')}>
                    <thead>
                        <tr>
                            <th className={cn(t.th, 'text-left')}>Mes</th>
                            <th className={cn(t.th, 'text-left')}>Concepto</th>
                            {MONTOS.map(([, label]) => (
                                <th key={label} className={cn(t.th, 'text-right')}>{label}</th>
                            ))}
                            <th className={cn(t.th, 'text-right')}>Vb = V+R</th>
                            <th className={cn(t.th, 'text-right')}>Vn = Vb−(D+M)</th>
                            <th className={cn(t.th, 'text-right')}>Efectivo</th>
                            <th className={cn(t.th, 'text-right')}>IGV</th>
                            <th className={cn(t.th, 'text-right')}>Total</th>
                            <th className={cn(t.th, 'text-left')}>Factura</th>
                            <th className={cn(t.th, 'text-left')}>Comprobante</th>
                            <th className={cn(t.th, 'text-left')}>Fecha de pago</th>
                            <th className={t.th} />
                        </tr>
                    </thead>
                    <tbody>
                        {filas.map(({ adicional, bruta, neta, efectivo, igv, total: totalFila }) => (
                            <tr key={adicional.id}>
                                <td className={cn(t.td, 'w-28')}>
                                    <select
                                        value={adicional.mes}
                                        onChange={(event) => updateAdicional(adicional.id, { mes: event.target.value })}
                                        aria-label="Mes del adicional"
                                        className="rounded-sm border border-amber-200 bg-amber-50/80 px-1 py-0.5 text-[12px] dark:border-amber-500/30 dark:bg-amber-500/10"
                                    >
                                        {periodos.map((p) => (
                                            <option key={p.key} value={p.key}>{p.label}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className={cn(t.td, 'min-w-48')}>
                                    <EditableCell label="Concepto del adicional" value={adicional.concepto || null} onCommit={(v) => updateAdicional(adicional.id, { concepto: v ?? '' })} />
                                </td>
                                {MONTOS.map(([campo, label]) => (
                                    <td key={campo} className={cn(t.td, 'w-28')}>
                                        <EditableCell label={label} kind="money" value={adicional[campo]} onCommit={(v) => updateAdicional(adicional.id, { [campo]: v ?? '0.00' })} />
                                    </td>
                                ))}
                                <td className={cn(t.td, t.num)}>{fmtNumber(bruta)}</td>
                                <td className={cn(t.td, t.num)}>{fmtNumber(neta)}</td>
                                <td className={cn(t.td, t.num)}>{fmtNumber(efectivo)}</td>
                                <td className={cn(t.td, t.num)}>{fmtNumber(igv)}</td>
                                <td className={cn(t.td, t.num, 'font-semibold text-stone-900 dark:text-stone-100')}>{fmtNumber(totalFila)}</td>
                                <td className={cn(t.td, 'w-28')}>
                                    <EditableCell label="Factura del adicional" placeholder="F001-…" value={adicional.facturaNro || null} onCommit={(v) => updateAdicional(adicional.id, { facturaNro: v ?? '' })} />
                                </td>
                                <td className={cn(t.td, 'w-28')}>
                                    <EditableCell label="Comprobante del adicional" placeholder="N°" value={adicional.comprobanteNro || null} onCommit={(v) => updateAdicional(adicional.id, { comprobanteNro: v ?? '' })} />
                                </td>
                                <td className={cn(t.td, 'w-28')}>
                                    <EditableCell
                                        label="Fecha de pago del adicional"
                                        kind="date"
                                        value={adicional.fechaPago}
                                        onCommit={(v) => updateAdicional(adicional.id, { fechaPago: v })}
                                    />
                                </td>
                                <td className={cn(t.td, 'w-8')}>
                                    <button
                                        type="button"
                                        aria-label="Quitar adicional"
                                        onClick={() => window.confirm('¿Quitar este adicional? Puedes deshacerlo con Ctrl+Z.') && removeAdicional(adicional.id)}
                                        className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                                    >
                                        <Trash2 className="size-3.5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filas.length === 0 && (
                            <tr>
                                <td colSpan={17} className={cn(t.td, 'py-6 text-center text-stone-500')}>Sin adicionales registrados.</td>
                            </tr>
                        )}
                        {filas.length > 0 && (
                            <tr className={t.total}>
                                <td colSpan={2} className={cn(t.td, 'text-[11px] tracking-wide uppercase')}>Total adicionales</td>
                                <td className={cn(t.td, t.num)}>{fmtNumber(total.monto)}</td>
                                <td colSpan={5} className={t.td} />
                                <td className={cn(t.td, t.num)}>{fmtNumber(total.bruta)}</td>
                                <td className={cn(t.td, t.num)}>{fmtNumber(total.neta)}</td>
                                <td className={cn(t.td, t.num)}>{fmtNumber(total.efectivo)}</td>
                                <td className={cn(t.td, t.num)}>{fmtNumber(total.igv)}</td>
                                <td className={cn(t.td, t.num)}>{fmtNumber(total.total)}</td>
                                <td colSpan={4} className={t.td} />
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
