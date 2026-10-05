import { ArrowDownRight, ArrowUpRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SituacionAvance } from '../lib/avance';

const STYLES: Record<SituacionAvance, { className: string; Icon: typeof Check }> = {
    ADELANTADA: { className: 'border-stone-300 bg-stone-900 text-white dark:border-stone-600 dark:bg-stone-100 dark:text-stone-900', Icon: ArrowUpRight },
    ATRASADA: { className: 'border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300', Icon: ArrowDownRight },
    CULMINADA: { className: 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-300', Icon: Check },
};

/** Situación de la obra con ícono + texto (nunca solo color). */
export function SituacionBadge({ situacion, prefix = '' }: { situacion: SituacionAvance; prefix?: string }) {
    const { className, Icon } = STYLES[situacion];

    return (
        <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase', className)}>
            <Icon className="size-3" />
            {prefix}
            {situacion}
        </span>
    );
}
