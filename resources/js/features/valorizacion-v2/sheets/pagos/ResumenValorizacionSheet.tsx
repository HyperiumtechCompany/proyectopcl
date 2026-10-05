import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePagos } from '../../hooks/usePagos';
import type { BudgetTotals } from '../../lib/budget';
import { tableClasses as t } from '../../shared/table';
import { fmtNumber, fmtPct } from '../../utils/format';

const BLOQUES = [
    { key: 'anterior', label: 'Acumulado anterior' },
    { key: 'actual', label: 'Actual' },
    { key: 'acumulado', label: 'Acumulado actual' },
    { key: 'saldo', label: 'Saldo' },
] as const;

/** Hoja RESUMEN VAL.: valorización por componente (nivel 2) con pie presupuestal por bloque. */
export default function ResumenValorizacionSheet() {
    const { resumen, parametros, input } = usePagos();
    const { pies } = resumen;
    const pieRows: Array<{ label: string; value: (p: BudgetTotals) => string; strong?: boolean }> = [
        { label: 'Costo directo', value: (p) => fmtNumber(p.costoDirecto), strong: true },
        { label: `Gastos generales (${fmtPct(parametros.gastosGenerales)})`, value: (p) => fmtNumber(p.gastosGenerales) },
        { label: `Utilidad (${fmtPct(parametros.utilidad)})`, value: (p) => fmtNumber(p.utilidad) },
        { label: 'Sub total', value: (p) => fmtNumber(p.subTotal), strong: true },
        { label: `IGV (${fmtPct(parametros.igv)})`, value: (p) => fmtNumber(p.igv) },
        { label: 'Monto total valorizado', value: (p) => fmtNumber(p.total), strong: true },
        { label: 'Porcentaje de avance', value: (p) => fmtPct(p.pesoCD) },
    ];

    return (
        <div className="space-y-3">
            <div>
                <h2 className="text-lg font-bold text-stone-900 sm:text-xl dark:text-stone-50">Resumen de valorización por componentes</h2>
                <p className="text-xs text-stone-500 sm:text-sm dark:text-stone-400">{input.fichaTecnica.contratista.contrato}</p>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-xs text-stone-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
                <Info className="mt-0.5 size-4 shrink-0 text-orange-600" />
                Se calcula desde la valorización mensual. En el Excel de referencia esta hoja tenía referencias rotas en 01.09–01.13 (por ejemplo, Seguridad y salud mostraba un anterior de S/ 4.30 en vez de S/ 16,380.56).
            </div>

            <div className={t.wrap}>
                <table className={cn(t.table, 'min-w-5xl')}>
                    <thead>
                        <tr>
                            <th rowSpan={2} className={cn(t.th, 'text-left')}>Ítem</th>
                            <th rowSpan={2} className={cn(t.th, 'text-left')}>Descripción</th>
                            <th rowSpan={2} className={cn(t.th, 'text-right')}>Monto contratado</th>
                            {BLOQUES.map((bloque) => (
                                <th key={bloque.key} colSpan={2} className={cn(t.band, bloque.key === 'actual' && 'bg-orange-100 dark:bg-orange-500/20')}>{bloque.label}</th>
                            ))}
                        </tr>
                        <tr>
                            {BLOQUES.flatMap((bloque) => [
                                <th key={`${bloque.key}-p`} className={cn(t.th, 'text-right')}>{bloque.key === 'saldo' ? '% de saldo' : '% de avance'}</th>,
                                <th key={`${bloque.key}-m`} className={cn(t.th, 'text-right')}>Monto</th>,
                            ])}
                        </tr>
                    </thead>
                    <tbody>
                        {resumen.componentes.map((comp) => (
                            <tr key={comp.node.id}>
                                <td className={cn(t.td, 'font-mono')}>{comp.node.codigo}</td>
                                <td className={cn(t.td, 'whitespace-normal')}>{comp.node.descripcion}</td>
                                <td className={cn(t.td, t.num)}>{fmtNumber(comp.contratado)}</td>
                                {BLOQUES.flatMap((bloque) => [
                                    <td key={`${bloque.key}-p`} className={cn(t.td, t.num, 'text-stone-500', bloque.key === 'actual' && 'bg-orange-50/40 dark:bg-orange-500/5')}>{fmtPct(comp[bloque.key].pct)}</td>,
                                    <td key={`${bloque.key}-m`} className={cn(t.td, t.num, bloque.key === 'actual' && 'bg-orange-50/40 dark:bg-orange-500/5')}>{comp[bloque.key].monto.isZero() ? '—' : fmtNumber(comp[bloque.key].monto)}</td>,
                                ])}
                            </tr>
                        ))}
                        {pieRows.map((row) => (
                            <tr key={row.label} className={row.strong ? t.total : 'text-stone-600 dark:text-stone-400'}>
                                <td className={t.td} />
                                <td className={cn(t.td, 'text-right text-[11px] tracking-wide text-inherit uppercase')}>{row.label}</td>
                                <td className={cn(t.td, t.num, 'text-inherit')}>{row.value(pies.presupuesto)}</td>
                                {BLOQUES.flatMap((bloque) => [
                                    <td key={`${bloque.key}-p`} className={t.td} />,
                                    <td key={`${bloque.key}-m`} className={cn(t.td, t.num, 'text-inherit')}>{row.value(pies[bloque.key])}</td>,
                                ])}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
