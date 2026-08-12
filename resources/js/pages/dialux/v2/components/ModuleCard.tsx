import { Link } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowUp,
    Copy,
    MoreVertical,
    Pencil,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { show } from '@/actions/App/Http/Controllers/Dialux/V2/ModuleController';
import type { DialuxV2Module, ModuleStatus } from '../types';

const statusLabels: Record<ModuleStatus, string> = {
    draft: 'Borrador',
    in_progress: 'En progreso',
    completed: 'Completado',
    archived: 'Archivado',
};

const statusColors: Record<ModuleStatus, string> = {
    draft: 'bg-zinc-500',
    in_progress: 'bg-amber-500',
    completed: 'bg-emerald-500',
    archived: 'bg-slate-500',
};

interface Props {
    projectId: number;
    module: DialuxV2Module;
    active?: boolean;
    compact?: boolean;
    disabled?: boolean;
    canMoveUp: boolean;
    canMoveDown: boolean;
    onRename: (module: DialuxV2Module) => void;
    onDuplicate: (module: DialuxV2Module) => void;
    onDelete: (module: DialuxV2Module) => void;
    onMove: (module: DialuxV2Module, direction: -1 | 1) => void;
}

export function ModuleCard({
    projectId,
    module,
    active = false,
    compact = false,
    disabled = false,
    canMoveUp,
    canMoveDown,
    onRename,
    onDuplicate,
    onDelete,
    onMove,
}: Props) {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <article
            className={`relative rounded-xl border transition ${
                active
                    ? 'border-amber-500/70 bg-amber-500/10'
                    : 'border-slate-200 bg-white hover:border-amber-400/50 dark:border-white/10 dark:bg-[#151821]'
            }`}
        >
            <Link
                href={show([projectId, module.id])}
                prefetch
                className={`block ${compact ? 'px-3 py-2.5' : 'p-4 pr-12'}`}
            >
                <div className="flex items-center gap-2">
                    <span
                        className={`h-2 w-2 rounded-full ${statusColors[module.status]}`}
                    />
                    <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">
                        {module.name}
                    </h3>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                    {statusLabels[module.status]}
                    {module.rooms_count !== undefined &&
                        ` · ${module.rooms_count} ambientes`}
                </p>
            </Link>

            <button
                type="button"
                disabled={disabled}
                aria-label={`Acciones de ${module.name}`}
                onClick={() => setMenuOpen((open) => !open)}
                className="absolute top-2 right-2 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-white"
            >
                <MoreVertical className="h-4 w-4" />
            </button>

            {menuOpen && (
                <div className="absolute top-11 right-2 z-30 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-[#101218]">
                    <MenuButton
                        icon={Pencil}
                        label="Renombrar"
                        onClick={() => onRename(module)}
                    />
                    <MenuButton
                        icon={Copy}
                        label="Duplicar"
                        onClick={() => onDuplicate(module)}
                    />
                    <MenuButton
                        icon={ArrowUp}
                        label="Mover arriba"
                        disabled={!canMoveUp}
                        onClick={() => onMove(module, -1)}
                    />
                    <MenuButton
                        icon={ArrowDown}
                        label="Mover abajo"
                        disabled={!canMoveDown}
                        onClick={() => onMove(module, 1)}
                    />
                    <MenuButton
                        icon={Trash2}
                        label="Eliminar"
                        danger
                        onClick={() => onDelete(module)}
                    />
                </div>
            )}
        </article>
    );
}

interface MenuButtonProps {
    icon: typeof Pencil;
    label: string;
    danger?: boolean;
    disabled?: boolean;
    onClick: () => void;
}

function MenuButton({
    icon: Icon,
    label,
    danger,
    disabled,
    onClick,
}: MenuButtonProps) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition disabled:opacity-30 ${
                danger
                    ? 'text-red-600 hover:bg-red-500/10 dark:text-red-400'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-white/10'
            }`}
        >
            <Icon className="h-3.5 w-3.5" />
            {label}
        </button>
    );
}
