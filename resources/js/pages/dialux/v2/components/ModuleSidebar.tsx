import { Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, LayoutDashboard, Map as MapIcon, Plus } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { show as showElectricalNetwork } from '@/actions/App/Http/Controllers/Dialux/V2/ElectricalNetworkController';
import { show as showModule } from '@/actions/App/Http/Controllers/Dialux/V2/ModuleController';
import { show as showProject } from '@/actions/App/Http/Controllers/Dialux/V2/ProjectController';
import type { DialuxV2Module } from '../types';
import { ModuleCard, statusColors, statusLabels } from './ModuleCard';

const COLLAPSED_KEY = 'dialux-v2-module-sidebar-collapsed';
const COLLAPSED_EVENT = 'dialux-v2-module-sidebar';

/** Respaldo en memoria si el navegador no permite `localStorage` (el botón sigue funcionando). */
let memoryCollapsed = false;

function readCollapsed(): boolean {
    try {
        const stored = window.localStorage.getItem(COLLAPSED_KEY);
        return stored === null ? memoryCollapsed : stored === '1';
    } catch {
        return memoryCollapsed;
    }
}

function writeCollapsed(value: boolean) {
    memoryCollapsed = value;
    try {
        window.localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0');
    } catch {
        // sin almacenamiento: solo no se recuerda entre visitas
    }
    window.dispatchEvent(new Event(COLLAPSED_EVENT));
}

function subscribeCollapsed(onChange: () => void) {
    window.addEventListener(COLLAPSED_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
        window.removeEventListener(COLLAPSED_EVENT, onChange);
        window.removeEventListener('storage', onChange);
    };
}

/** Sigla del módulo para el riel plegado: "Módulo 12" → "M12", "Pabellón Norte" → "PN". */
function moduleShortName(name: string): string {
    const digits = name.match(/\d+/)?.[0];
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (digits) return `${(words[0]?.[0] ?? 'M').toUpperCase()}${digits}`.slice(0, 4);
    return words
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? '')
        .join('');
}

interface ModuleActions {
    busy: boolean;
    create: () => void;
    rename: (module: DialuxV2Module) => void;
    duplicate: (module: DialuxV2Module) => void;
    remove: (module: DialuxV2Module) => void;
    move: (module: DialuxV2Module, direction: -1 | 1) => void;
}

interface Props {
    projectId: number;
    modules: DialuxV2Module[];
    actions: ModuleActions;
    activeModuleId?: number;
}

export function ModuleSidebar({
    projectId,
    modules,
    actions,
    activeModuleId,
}: Props) {
    // Se recuerda plegado/expandido por navegador (preferencia de vista); en
    // el servidor (SSR) siempre expandido, así la hidratación no se desajusta.
    const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
    const setCollapsed = (update: (value: boolean) => boolean) => writeCollapsed(update(readCollapsed()));
    const designModulesCount = modules.filter(
        (module) => module.kind !== 'general',
    ).length;

    return (
        <aside
            className={`flex h-full shrink-0 flex-col border-r border-slate-200 bg-slate-50 transition-[width] dark:border-white/10 dark:bg-[#0d0f14] ${
                collapsed ? 'w-16' : 'w-72'
            }`}
        >
            <div className="flex items-center justify-between border-b border-slate-200 p-3 dark:border-white/10">
                {!collapsed && (
                    <span className="text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-zinc-400">
                        Módulos
                    </span>
                )}
                <button
                    type="button"
                    aria-label={
                        collapsed ? 'Expandir módulos' : 'Colapsar módulos'
                    }
                    onClick={() => setCollapsed((value) => !value)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10"
                >
                    {collapsed ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <ChevronLeft className="h-4 w-4" />
                    )}
                </button>
            </div>

            {collapsed ? (
                <>
                    {/* Riel plegado: un botón por módulo (sigla + estado), el activo resaltado. */}
                    <nav className="flex flex-1 flex-col items-center gap-1.5 overflow-y-auto p-2" aria-label="Módulos">
                        {modules.map((module) => {
                            const active = module.id === activeModuleId;
                            return (
                                <Link
                                    key={module.id}
                                    href={
                                        module.kind === 'general'
                                            ? showElectricalNetwork(projectId)
                                            : showModule([projectId, module.id])
                                    }
                                    prefetch
                                    title={`${module.name} · ${statusLabels[module.status]}`}
                                    aria-current={active ? 'page' : undefined}
                                    className={`relative flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border text-[10px] font-bold transition ${
                                        active
                                            ? 'border-amber-500/70 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-amber-400/60 hover:text-amber-700 dark:border-white/10 dark:bg-[#151821] dark:text-zinc-300'
                                    }`}
                                >
                                    {module.kind === 'general' ? (
                                        <MapIcon className="h-4 w-4" />
                                    ) : (
                                        <span className="max-w-full truncate px-0.5">{moduleShortName(module.name)}</span>
                                    )}
                                    <span
                                        className={`absolute top-1 right-1 h-1.5 w-1.5 rounded-full ${statusColors[module.status]}`}
                                    />
                                </Link>
                            );
                        })}
                    </nav>
                    <div className="flex flex-col items-center gap-1.5 border-t border-slate-200 p-2 dark:border-white/10">
                        <button
                            type="button"
                            title="Nuevo módulo"
                            aria-label="Nuevo módulo"
                            disabled={actions.busy || designModulesCount >= 25}
                            onClick={actions.create}
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-40"
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                        <Link
                            href={showProject(projectId)}
                            title="Resumen"
                            aria-label="Resumen"
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
                        >
                            <LayoutDashboard className="h-4 w-4" />
                        </Link>
                    </div>
                </>
            ) : (
                <>
                    <div className="flex-1 space-y-2 overflow-y-auto p-3">
                        {modules.map((module, index) => (
                            <ModuleCard
                                key={module.id}
                                projectId={projectId}
                                module={module}
                                compact
                                active={module.id === activeModuleId}
                                disabled={actions.busy}
                                canMoveUp={index > 0}
                                canMoveDown={index < modules.length - 1}
                                onRename={actions.rename}
                                onDuplicate={actions.duplicate}
                                onDelete={actions.remove}
                                onMove={actions.move}
                            />
                        ))}
                    </div>
                    <div className="grid gap-2 border-t border-slate-200 p-3 dark:border-white/10">
                        <button
                            type="button"
                            disabled={actions.busy || designModulesCount >= 25}
                            onClick={actions.create}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-500 disabled:opacity-40"
                        >
                            <Plus className="h-3.5 w-3.5" /> Nuevo módulo
                        </button>
                        <Link
                            href={showProject(projectId)}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
                        >
                            <LayoutDashboard className="h-3.5 w-3.5" /> Resumen
                        </Link>
                    </div>
                </>
            )}
        </aside>
    );
}
