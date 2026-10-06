import { cn } from '@/lib/utils';
import type { BudgetTotals } from '../../lib/budget';
import type { ParametrosPresupuesto } from '../../types';
import { fmtNumber, fmtPct } from '../../utils/format';

interface BudgetSummaryFooterProps {
    /** Columnas que ocupa la etiqueta (ítem + descripción + columnas previas al primer monto). */
    labelColSpan: number;
    parametros: ParametrosPresupuesto;
    /** Una celda por columna restante: totales a mostrar o null para dejarla vacía. */
    cells: Array<BudgetTotals | null>;
    /** Agrega la fila "% del costo directo" (peso mensual en calendarios). */
    showPeso?: boolean;
    /** Etiqueta de la fila del total (p. ej. "Monto valorizado mensual"). */
    totalLabel?: string;
    /** Etiqueta de la fila de peso (p. ej. "Avance mensual"). */
    pesoLabel?: string;
    /** Filas adicionales con texto ya formateado por celda (p. ej. avance acumulado). */
    extraRows?: Array<{ label: string; cells: Array<string | null> }>;
}

type Field = keyof Omit<BudgetTotals, 'pesoCD'>;

const ROWS: Array<{ field: Field; label: (p: ParametrosPresupuesto) => string; formula: string; strong?: boolean; highlight?: boolean }> = [
    { field: 'costoDirecto', label: () => 'Costo directo', formula: 'CD = Σ parciales de las partidas (metrado × P.U., redondeado a 2 decimales)', strong: true },
    { field: 'gastosGenerales', label: (p) => `Gastos generales (${fmtPct(p.gastosGenerales)})`, formula: 'GG = ROUND(CD × %GG, 2)' },
    { field: 'utilidad', label: (p) => `Utilidad (${fmtPct(p.utilidad)})`, formula: 'UT = ROUND(CD × %Utilidad, 2)' },
    { field: 'subTotal', label: () => 'Sub total', formula: 'Sub total = CD + GG + UT', strong: true },
    { field: 'igv', label: (p) => `IGV (${fmtPct(p.igv)})`, formula: 'IGV = ROUND(Sub total × %IGV, 2)' },
    { field: 'total', label: () => 'Total presupuesto', formula: 'Total = Sub total + IGV', strong: true, highlight: true },
];

/**
 * Pie presupuestal CD → GG → UTIL → SUB TOTAL → IGV → TOTAL como filas de <tfoot>.
 * Mismo componente para PRESUPUESTO (1 columna de montos), calendarios
 * (1 por mes) y VAL. MENSUAL (5 bloques).
 */
export function BudgetSummaryFooter({ labelColSpan, parametros, cells, showPeso = false, totalLabel = 'Total presupuesto', pesoLabel = '% del costo directo', extraRows = [] }: BudgetSummaryFooterProps) {
    const base = 'border-t border-stone-200 px-2 py-2 dark:border-stone-700';

    return (
        <>
            {ROWS.map((row) => (
                <tr
                    key={row.field}
                    className={cn(
                        'bg-stone-50 text-stone-700 dark:bg-stone-900 dark:text-stone-300',
                        row.strong && 'font-semibold text-stone-900 dark:text-stone-100',
                        row.highlight && 'bg-amber-100 text-stone-900 dark:bg-amber-500/15 dark:text-amber-100',
                    )}
                >
                    <td colSpan={labelColSpan} title={row.formula} className={cn(base, 'cursor-help bg-inherit text-right text-[11px] tracking-wide uppercase lg:sticky lg:left-0')}>
                        {row.field === 'total' ? totalLabel : row.label(parametros)}
                    </td>
                    {cells.map((totals, index) => (
                        <td key={index} className={cn(base, 'text-right font-mono whitespace-nowrap tabular-nums')}>
                            {totals ? fmtNumber(totals[row.field]) : ''}
                        </td>
                    ))}
                </tr>
            ))}
            {showPeso && (
                <tr className="bg-stone-50 text-stone-600 dark:bg-stone-900 dark:text-stone-400">
                    <td colSpan={labelColSpan} className={cn(base, 'bg-inherit text-right text-[11px] tracking-wide uppercase lg:sticky lg:left-0')}>
                        {pesoLabel}
                    </td>
                    {cells.map((totals, index) => (
                        <td key={index} className={cn(base, 'text-right font-mono tabular-nums')}>
                            {totals ? fmtPct(totals.pesoCD) : ''}
                        </td>
                    ))}
                </tr>
            )}
            {extraRows.map((extra) => (
                <tr key={extra.label} className="bg-stone-50 font-semibold text-stone-800 dark:bg-stone-900 dark:text-stone-200">
                    <td colSpan={labelColSpan} className={cn(base, 'bg-inherit text-right text-[11px] tracking-wide uppercase lg:sticky lg:left-0')}>
                        {extra.label}
                    </td>
                    {extra.cells.map((value, index) => (
                        <td key={index} className={cn(base, 'text-right font-mono tabular-nums')}>
                            {value ?? ''}
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
}
