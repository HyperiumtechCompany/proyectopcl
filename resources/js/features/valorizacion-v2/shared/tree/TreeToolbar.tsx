import { Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { PartidaTreeState } from '../../hooks/usePartidaTree';

const LEVEL_LABELS: Record<number, string> = { 1: 'Obra', 2: 'Componentes', 3: 'Subtítulos', 4: 'Nivel 4' };

/** Búsqueda + expandir por nivel, común a las hojas con árbol de partidas. */
export function TreeToolbar({ state, children }: { state: PartidaTreeState; children?: ReactNode }) {
    const levels = Array.from({ length: Math.max(state.maxNivel - 1, 0) }, (_, index) => index + 1).filter((nivel) => LEVEL_LABELS[nivel]);
    const button = 'min-h-9 rounded px-2 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-orange-500 dark:text-stone-300 dark:hover:bg-stone-800';

    return (
        <div className="flex flex-wrap items-center gap-2 print:hidden" data-export="skip">
            <label className="relative min-w-0 basis-full sm:min-w-48 sm:flex-1 sm:basis-auto sm:max-w-sm">
                <span className="sr-only">Buscar partida</span>
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-stone-400" />
                <input
                    type="search"
                    value={state.query}
                    onChange={(event) => state.setQuery(event.target.value)}
                    placeholder="Buscar por ítem o descripción…"
                    className="min-h-10 w-full rounded-md border border-stone-300 bg-white py-2 pr-3 pl-8 text-base text-stone-900 placeholder:text-stone-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none sm:text-sm dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:placeholder:text-stone-400"
                />
            </label>
            <div className="flex max-w-full flex-wrap items-center gap-0.5 rounded-md border border-stone-200 bg-white p-0.5 dark:border-stone-700 dark:bg-stone-900">
                <span className="px-1.5 text-[10px] font-semibold tracking-wider text-stone-400 uppercase">Ver</span>
                {levels.map((nivel) => (
                    <button key={nivel} type="button" onClick={() => state.expandToLevel(nivel)} className={button}>
                        {LEVEL_LABELS[nivel]}
                    </button>
                ))}
                <button type="button" onClick={state.expandAll} className={cn(button, 'text-orange-700 dark:text-orange-300')}>
                    Todo
                </button>
            </div>
            {children}
        </div>
    );
}
