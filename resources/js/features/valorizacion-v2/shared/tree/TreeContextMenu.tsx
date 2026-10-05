import { useEffect, useRef } from 'react';
import type { ComponentType } from 'react';
import { cn } from '@/lib/utils';

export interface TreeMenuItem {
    label: string;
    icon: ComponentType<{ className?: string }>;
    onSelect: () => void;
    hint?: string;
    disabled?: boolean;
    danger?: boolean;
}

export type TreeMenuEntry = TreeMenuItem | 'separator';

interface TreeContextMenuProps {
    x: number;
    y: number;
    title: string;
    subtitle?: string;
    entries: TreeMenuEntry[];
    onClose: () => void;
}

const WIDTH = 264;

/** Menú contextual (clic derecho o botón ⋮) para operar sobre una rama del árbol. */
export function TreeContextMenu({ x, y, title, subtitle, entries, onClose }: TreeContextMenuProps) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onPointer = (event: PointerEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                onClose();
            }
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        const onScroll = () => onClose();
        document.addEventListener('pointerdown', onPointer);
        document.addEventListener('keydown', onKey);
        window.addEventListener('resize', onScroll);
        ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();

        return () => {
            document.removeEventListener('pointerdown', onPointer);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', onScroll);
        };
    }, [onClose]);

    const height = 52 + entries.reduce((acc, entry) => acc + (entry === 'separator' ? 9 : 34), 0);
    const left = Math.max(8, Math.min(x, window.innerWidth - WIDTH - 8));
    const top = Math.max(8, Math.min(y, window.innerHeight - height - 8));

    return (
        <div
            ref={ref}
            role="menu"
            aria-label={`Acciones de ${title}`}
            style={{ left, top, width: WIDTH }}
            className="fixed z-50 overflow-hidden rounded-lg border border-stone-200 bg-white py-1 shadow-xl shadow-stone-900/10 dark:border-stone-700 dark:bg-stone-900"
        >
            <div className="border-b border-stone-100 px-3 pt-1 pb-1.5 dark:border-stone-800">
                <p className="truncate font-mono text-[11px] font-semibold text-orange-700 dark:text-orange-300">{title}</p>
                {subtitle && <p className="truncate text-[11px] text-stone-500">{subtitle}</p>}
            </div>
            {entries.map((entry, index) =>
                entry === 'separator' ? (
                    <div key={`sep-${index}`} className="my-1 border-t border-stone-100 dark:border-stone-800" />
                ) : (
                    <button
                        key={entry.label}
                        type="button"
                        role="menuitem"
                        disabled={entry.disabled}
                        onClick={() => {
                            entry.onSelect();
                            onClose();
                        }}
                        className={cn(
                            'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] focus:outline-none disabled:cursor-not-allowed disabled:opacity-40',
                            entry.danger
                                ? 'text-red-600 hover:bg-red-50 focus:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 dark:focus:bg-red-500/10'
                                : 'text-stone-700 hover:bg-orange-50 focus:bg-orange-50 dark:text-stone-200 dark:hover:bg-orange-500/10 dark:focus:bg-orange-500/10',
                        )}
                    >
                        <entry.icon className="size-4 shrink-0 opacity-70" />
                        <span className="flex-1 truncate">{entry.label}</span>
                        {entry.hint && <span className="text-[10px] text-stone-400">{entry.hint}</span>}
                    </button>
                ),
            )}
        </div>
    );
}
