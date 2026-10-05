import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ChipTone = 'neutral' | 'orange' | 'amber' | 'dark' | 'danger';

const TONES: Record<ChipTone, string> = {
    neutral: 'border-stone-200 bg-stone-100 text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300',
    orange: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300',
    amber: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    dark: 'border-stone-700 bg-stone-800 text-stone-100',
    danger: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
};

export function Chip({ tone = 'neutral', title, children }: { tone?: ChipTone; title?: string; children: ReactNode }) {
    return (
        <span title={title} className={cn('inline-flex items-center rounded border px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase', TONES[tone], title && 'cursor-help')}>
            {children}
        </span>
    );
}
