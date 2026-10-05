import { cn } from '@/lib/utils';
import { D } from '../../lib/money';
import { SituacionBadge } from '../../shared/SituacionBadge';
import { tableClasses as t } from '../../shared/table';
import { fmtMoney, fmtNumber, fmtPct } from '../../utils/format';
import type { ControlGeneral } from './computeControl';

/** Tabla de datos de la Curva S (CURVA S!B32:K38), reutilizada en Avance físico. */
export function CurvaSTable({ control }: { control: ControlGeneral }) {
    return (
        <div className={t.wrap}>
            <table className={t.table}>
                <thead>
                    <tr>
                        <th colSpan={2} className={t.band}>Valorización</th>
                        <th colSpan={3} className={t.band}>Programado</th>
                        <th rowSpan={2} className={cn(t.th, 'text-right')}>Curva del 80 %</th>
                        <th colSpan={3} className={t.band}>Ejecutado</th>
                        <th rowSpan={2} className={cn(t.th, 'text-center')}>Estado</th>
                    </tr>
                    <tr>
                        {['N°', 'Mes', 'Monto', '% mensual', '% acumulado', 'Monto', '% mensual', '% acumulado'].map((label, index) => (
                            <th key={label + index} className={cn(t.th, index < 2 ? 'text-left' : 'text-right')}>{label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {control.meses.map((mes) => (
                        <tr key={mes.periodo.key}>
                            <td className={cn(t.td, 'font-mono')}>{String(mes.numero).padStart(2, '0')}</td>
                            <td className={t.td}>{mes.periodo.label}</td>
                            <td className={cn(t.td, t.num)}>{fmtNumber(mes.programado.mensual)}</td>
                            <td className={cn(t.td, t.num)}>{fmtPct(mes.programado.pctMensual)}</td>
                            <td className={cn(t.td, t.num, 'font-semibold')}>{fmtPct(mes.programado.pctAcumulado)}</td>
                            <td className={cn(t.td, t.num, 'text-stone-500')}>{fmtPct(mes.curva80)}</td>
                            <td className={cn(t.td, t.num)}>{mes.ejecutado ? fmtNumber(mes.ejecutado.mensual) : ''}</td>
                            <td className={cn(t.td, t.num)}>{mes.ejecutado ? fmtPct(mes.ejecutado.pctMensual) : ''}</td>
                            <td className={cn(t.td, t.num, 'font-semibold')}>{mes.ejecutado ? fmtPct(mes.ejecutado.pctAcumulado) : ''}</td>
                            <td className={cn(t.td, 'text-center')}>{mes.evaluacion && <SituacionBadge situacion={mes.evaluacion.situacion} />}</td>
                        </tr>
                    ))}
                    <tr className={t.total}>
                        <td colSpan={2} className={cn(t.td, 'text-[11px] tracking-wide uppercase')}>Total</td>
                        <td className={cn(t.td, t.num)}>{fmtMoney(control.totalProgramado)}</td>
                        <td className={cn(t.td, t.num)}>{fmtPct(control.meses.reduce((acc, m) => acc.add(m.programado.pctMensual), D(0)))}</td>
                        <td className={t.td} colSpan={2} />
                        <td className={cn(t.td, t.num)}>{fmtMoney(control.totalEjecutado)}</td>
                        <td className={cn(t.td, t.num)}>{fmtPct(control.pctEjecutado)}</td>
                        <td className={t.td} />
                        <td className={cn(t.td, 'text-center text-[11px] tracking-wide uppercase')}>{control.situacionObra}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
