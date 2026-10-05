import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ImportSummaryData {
    ok: boolean;
    title: string;
    detail?: string;
    warnings: string[];
}

/** Resultado de una importación desde Excel (título, detalle y observaciones). */
export function ImportSummaryPanel({ summary, onClose }: { summary: ImportSummaryData; onClose: () => void }) {
    return (
        <div className={cn('flex items-start gap-3 rounded-lg border px-4 py-3 text-sm', summary.ok ? 'border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200')}>
            <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium text-stone-900 dark:text-stone-100">{summary.title}</p>
                {summary.detail && <p className="text-xs text-stone-600 dark:text-stone-300">{summary.detail}</p>}
                {summary.warnings.length > 0 && (
                    <ul className="list-disc pl-5 text-xs text-stone-600 dark:text-stone-400">
                        {summary.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                        ))}
                    </ul>
                )}
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar resumen de importación" className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-800 dark:hover:bg-stone-800 dark:hover:text-stone-100">
                <X className="size-4" />
            </button>
        </div>
    );
}
