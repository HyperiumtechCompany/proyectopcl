import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Chip } from './Chip';

interface DataRowProps {
    label: string;
    children: ReactNode;
    /** Valor derivado por fórmula: muestra el chip "Calculado" y la fórmula al pasar el cursor. */
    formula?: string;
    /** Valor que aún no se puede obtener (hoja de origen pendiente). */
    pending?: string;
    numeric?: boolean;
    emphasis?: boolean;
}

/** Fila etiqueta : valor del estilo de la ficha técnica del expediente. */
export function DataRow({ label, children, formula, pending, numeric = false, emphasis = false }: DataRowProps) {
    return (
        <div className="grid grid-cols-1 items-start gap-x-4 gap-y-1.5 border-b border-stone-200/70 py-2.5 last:border-0 @min-[32rem]:grid-cols-[minmax(10rem,35%)_minmax(0,1fr)] dark:border-stone-700/60">
            <dt className="pt-1 text-[13px] leading-relaxed text-stone-600 dark:text-stone-300">{label}</dt>
            <dd className="flex min-w-0 flex-wrap items-center gap-2">
                {pending ? (
                    <span className="text-[13px] leading-relaxed text-stone-500 dark:text-stone-400">{pending}</span>
                ) : (
                    <div
                        data-export-value
                        className={cn(
                            'min-w-0 basis-full text-[13px] leading-relaxed text-stone-900 dark:text-stone-100',
                            numeric && 'font-mono tabular-nums [&_button]:whitespace-nowrap',
                            emphasis && 'font-semibold',
                        )}
                    >
                        {children}
                    </div>
                )}
                {formula && !pending && (
                    <Chip tone="amber" title={formula}>
                        Calculado
                    </Chip>
                )}
            </dd>
        </div>
    );
}
