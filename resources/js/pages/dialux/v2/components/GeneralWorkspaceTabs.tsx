import { Link } from '@inertiajs/react';
import { Box, Map, Network } from 'lucide-react';

export type GeneralWorkspaceView = '2d' | '3d' | 'network';

interface Props {
    projectId: number;
    moduleId: number;
    active: GeneralWorkspaceView;
}

const views = [
    { key: '2d', label: 'Emplazamiento 2D', icon: Map },
    { key: '3d', label: 'Vista 3D Exterior', icon: Box },
    { key: 'network', label: 'Red y CT', icon: Network },
] as const;

export function GeneralWorkspaceTabs({ projectId, moduleId, active }: Props) {
    const editorUrl = `/dialux-v2/projects/${projectId}/modules/${moduleId}`;

    return (
        <nav
            aria-label="Vistas del módulo General"
            className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-black/20"
        >
            {views.map(({ key, label, icon: Icon }) => {
                const href =
                    key === 'network'
                        ? `/dialux-v2/projects/${projectId}/electrical-network`
                        : `${editorUrl}?view=${key}`;
                const selected = active === key;

                return (
                    <Link
                        key={key}
                        href={href}
                        aria-current={selected ? 'page' : undefined}
                        className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                            selected
                                ? 'bg-white text-amber-700 shadow-sm dark:bg-slate-800 dark:text-amber-400'
                                : 'text-slate-500 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
                        }`}
                    >
                        <Icon className="h-4 w-4" />
                        {label}
                    </Link>
                );
            })}
        </nav>
    );
}
