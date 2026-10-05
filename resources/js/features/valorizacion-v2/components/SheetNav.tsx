import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SHEET_GROUPS, SHEETS } from '../config/sheets';
import type { SheetDefinition } from '../config/sheets';

interface SheetNavProps {
    active: SheetDefinition;
    onSelect: (id: string) => void;
    collapsed: boolean;
    onToggleCollapsed: () => void;
}

/** Navegación entre hojas: barra lateral agrupada (plegable) en escritorio, selector en móvil. */
export function SheetNav({ active, onSelect, collapsed, onToggleCollapsed }: SheetNavProps) {
    return (
        <>
            <div className="border-b border-stone-200 bg-white px-4 py-2 lg:hidden dark:border-stone-800 dark:bg-stone-900">
                <label className="sr-only" htmlFor="valorizacion-sheet">Hoja</label>
                <select
                    id="valorizacion-sheet"
                    value={active.id}
                    onChange={(event) => onSelect(event.target.value)}
                    className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
                >
                    {SHEET_GROUPS.map((group) => (
                        <optgroup key={group.id} label={group.label}>
                            {SHEETS.filter((sheet) => sheet.group === group.id).map((sheet) => (
                                <option key={sheet.id} value={sheet.id}>
                                    {sheet.label}{sheet.component ? '' : ` · Fase ${sheet.phase}`}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                </select>
            </div>

            {collapsed && (
                <div className="hidden w-10 shrink-0 flex-col items-center border-r border-stone-200 bg-white py-2 lg:flex dark:border-stone-800 dark:bg-stone-900">
                    <button type="button" onClick={onToggleCollapsed} title="Mostrar hojas" aria-label="Mostrar hojas" className="rounded p-1.5 text-stone-500 hover:bg-orange-50 hover:text-orange-700 dark:hover:bg-orange-500/10">
                        <PanelLeftOpen className="size-4" />
                    </button>
                    <span className="mt-3 [writing-mode:vertical-rl] rotate-180 text-[11px] font-semibold tracking-wider text-stone-500 uppercase">{active.label}</span>
                </div>
            )}

            <nav aria-label="Hojas de la valorización" className={cn('w-56 shrink-0 overflow-y-auto border-r border-stone-200 bg-white py-2 dark:border-stone-800 dark:bg-stone-900', collapsed ? 'hidden' : 'hidden lg:block')}>
                <div className="flex justify-end px-2 pb-1">
                    <button type="button" onClick={onToggleCollapsed} title="Ocultar hojas" aria-label="Ocultar hojas" className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800">
                        <PanelLeftClose className="size-4" />
                    </button>
                </div>
                {SHEET_GROUPS.map((group) => (
                    <div key={group.id} className="mb-3">
                        <p className="px-4 pb-1 text-[10px] font-semibold tracking-[0.12em] text-stone-400 uppercase dark:text-stone-500">{group.label}</p>
                        <ul>
                            {SHEETS.filter((sheet) => sheet.group === group.id).map((sheet) => {
                                const isActive = sheet.id === active.id;
                                const ready = Boolean(sheet.component);

                                return (
                                    <li key={sheet.id}>
                                        <button
                                            type="button"
                                            onClick={() => onSelect(sheet.id)}
                                            aria-current={isActive ? 'page' : undefined}
                                            className={cn(
                                                'flex min-h-10 w-full items-center gap-2 border-l-2 px-4 py-2 text-left text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-inset',
                                                isActive
                                                    ? 'border-orange-500 bg-orange-50 font-semibold text-stone-900 dark:bg-orange-500/10 dark:text-white'
                                                    : 'border-transparent text-stone-600 hover:bg-stone-50 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100',
                                                !ready && !isActive && 'text-stone-400 dark:text-stone-500',
                                            )}
                                        >
                                            <span className="min-w-0 flex-1 truncate">{sheet.label}</span>
                                            {!ready && <span className="font-mono text-[10px] text-stone-400">F{sheet.phase}</span>}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </nav>
        </>
    );
}
