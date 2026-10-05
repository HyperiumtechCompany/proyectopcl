import type Decimal from 'decimal.js';
import { cn } from '@/lib/utils';
import { fmtMoney, fmtPct } from '../utils/format';

export interface CompositionSegment {
    label: string;
    monto: Decimal;
    pct: Decimal;
    /** Clase de fondo del segmento (un solo tono claro→oscuro + gris para el saldo). */
    tone: string;
}

/**
 * Parte de un todo en una barra horizontal: segmentos con 2 px de separación,
 * extremos redondeados y leyenda con monto y % (reemplaza las tortas 3D del Excel).
 */
export function CompositionBar({ title, segments }: { title: string; segments: CompositionSegment[] }) {
    const visibles = segments.filter((segment) => segment.pct.gt(0));

    return (
        <figure className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
            <figcaption className="mb-3 text-xs font-semibold tracking-widest text-stone-600 uppercase dark:text-stone-300">{title}</figcaption>
            <div className="flex h-4 w-full gap-0.5" role="img" aria-label={`${title}: ${visibles.map((s) => `${s.label} ${fmtPct(s.pct)}`).join(', ')}`}>
                {visibles.map((segment) => (
                    <div
                        key={segment.label}
                        title={`${segment.label}: ${fmtMoney(segment.monto)} (${fmtPct(segment.pct)})`}
                        className={cn('h-full first:rounded-l last:rounded-r', segment.tone)}
                        style={{ width: `${segment.pct.mul(100).toNumber()}%` }}
                    />
                ))}
            </div>
            <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {segments.map((segment) => (
                    <li key={segment.label} className="flex items-center gap-2 text-xs">
                        <span className={cn('size-2.5 shrink-0 rounded-sm', segment.tone)} />
                        <span className="flex-1 text-stone-600 dark:text-stone-300">{segment.label}</span>
                        <span className="font-mono text-stone-900 tabular-nums dark:text-stone-100">{fmtMoney(segment.monto)}</span>
                        <span className="w-14 text-right font-mono font-semibold text-stone-900 tabular-nums dark:text-stone-100">{fmtPct(segment.pct)}</span>
                    </li>
                ))}
            </ul>
        </figure>
    );
}

/** Tonos secuenciales (naranja claro → oscuro) para N valorizaciones + gris para el saldo. */
export const SEQUENTIAL_TONES = ['bg-orange-300', 'bg-orange-500', 'bg-orange-700', 'bg-orange-900', 'bg-amber-600', 'bg-amber-800'];
export const SALDO_TONE = 'bg-stone-300 dark:bg-stone-600';
