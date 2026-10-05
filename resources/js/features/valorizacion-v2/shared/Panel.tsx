import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PanelProps {
    title: string;
    /** Letra de sección del expediente (A, B, C…). */
    badge?: string;
    aside?: ReactNode;
    className?: string;
    children: ReactNode;
}

/** Tarjeta de sección. Paleta del módulo: neutros stone + acento naranja. */
export function Panel({ title, badge, aside, className, children }: PanelProps) {
    return (
        <section className={cn('@container min-w-0 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-[0_1px_2px_rgba(28,25,23,0.04)] dark:border-stone-700 dark:bg-stone-900', className)}>
            <header className="flex flex-wrap items-center gap-3 border-b border-stone-200 bg-stone-50/80 px-3 py-3 sm:px-4 dark:border-stone-700 dark:bg-stone-800/60">
                {badge && (
                    <span className="flex size-6 shrink-0 items-center justify-center rounded bg-orange-100 text-xs font-bold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                        {badge}
                    </span>
                )}
                <h3 className="min-w-0 flex-1 text-xs leading-relaxed font-semibold tracking-[0.04em] text-stone-700 uppercase dark:text-stone-100">{title}</h3>
                {aside}
            </header>
            <div className="px-3 py-2 sm:px-4">{children}</div>
        </section>
    );
}
