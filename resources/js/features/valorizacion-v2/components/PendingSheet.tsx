import { Construction } from 'lucide-react';
import type { SheetDefinition } from '../config/sheets';

export function PendingSheet({ sheet }: { sheet: SheetDefinition }) {
    return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 bg-white px-6 py-12 text-center dark:border-stone-700 dark:bg-stone-900">
            <Construction className="mb-3 size-8 text-orange-500" />
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">{sheet.label}</h2>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                Hoja <span className="font-mono">{sheet.excelSheet}</span> del Excel · se implementa en la <strong className="text-stone-700 dark:text-stone-200">Fase {sheet.phase}</strong>.
            </p>
        </div>
    );
}
