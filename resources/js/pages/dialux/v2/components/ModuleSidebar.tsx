import { Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, LayoutDashboard, Plus } from 'lucide-react';
import { useState } from 'react';
import { show as showProject } from '@/actions/App/Http/Controllers/Dialux/V2/ProjectController';
import type { DialuxV2Module } from '../types';
import { ModuleCard } from './ModuleCard';

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
    const [collapsed, setCollapsed] = useState(false);
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
                <div className="flex flex-col items-center gap-2 p-2">
                    <Link
                        href={showProject(projectId)}
                        title="Resumen"
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10"
                    >
                        <LayoutDashboard className="h-4 w-4" />
                    </Link>
                    <button
                        type="button"
                        title="Nuevo módulo"
                        disabled={actions.busy || designModulesCount >= 25}
                        onClick={actions.create}
                        className="rounded-lg p-2 text-amber-600 hover:bg-amber-500/10 disabled:opacity-30"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                </div>
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
