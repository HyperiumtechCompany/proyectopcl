import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    ChevronDown,
    ChevronRight,
    CornerDownRight,
    IndentDecrease,
    IndentIncrease,
    Plus,
    Trash2,
} from 'lucide-react';
import type { RowAction } from '../../types/cell';

interface Props {
    x: number;
    y: number;
    taskId: number;
    isGroup: boolean;
    isExpanded: boolean;
    onAction: (action: RowAction) => void;
    onClose: () => void;
}

interface ItemProps {
    icon: React.ReactNode;
    label: string;
    shortcut?: string;
    variant?: 'default' | 'danger';
    disabled?: boolean;
    onClick: () => void;
}

function Item({ icon, label, shortcut, variant = 'default', disabled, onClick }: ItemProps) {
    return (
        <button
            className={`flex w-full items-center gap-2.5 rounded px-2.5 py-1.5 text-left text-xs transition-colors
                disabled:cursor-not-allowed disabled:opacity-40
                ${variant === 'danger'
                    ? 'text-red-300 hover:bg-red-700/40'
                    : 'text-slate-200 hover:bg-slate-700'}`}
            disabled={disabled}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClick}
        >
            <span className="text-slate-400 shrink-0">{icon}</span>
            <span className="flex-1">{label}</span>
            {shortcut && (
                <span className="text-[10px] text-slate-500 font-mono">{shortcut}</span>
            )}
        </button>
    );
}

function Sep() {
    return <div className="my-1 h-px bg-slate-700/80" />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div className="mb-0.5 px-2.5 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 select-none">
            {children}
        </div>
    );
}

export function GridContextMenu({
    x,
    y,
    isGroup,
    isExpanded,
    onAction,
    onClose,
}: Props) {
    useEffect(() => {
        const onMD   = () => onClose();
        const onKey  = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        const onScrl = () => onClose();
        document.addEventListener('mousedown', onMD);
        document.addEventListener('keydown',   onKey);
        document.addEventListener('scroll',    onScrl, true);
        return () => {
            document.removeEventListener('mousedown', onMD);
            document.removeEventListener('keydown',   onKey);
            document.removeEventListener('scroll',    onScrl, true);
        };
    }, [onClose]);

    // Clamp so the menu never goes off-screen
    const menuW = 220;
    const menuH = isGroup ? 310 : 260;
    const left  = Math.min(x, window.innerWidth  - menuW - 8);
    const top   = Math.min(y, window.innerHeight - menuH - 8);

    const act = (action: RowAction) => { onAction(action); onClose(); };

    return createPortal(
        <div
            className="fixed z-[9999] w-[220px] rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-2xl"
            style={{ left, top }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {/* Agregar */}
            <SectionLabel>Agregar</SectionLabel>
            <Item
                icon={<Plus size={13} />}
                label="Fila hermana"
                shortcut="Insert"
                onClick={() => act('addAfter')}
            />
            <Item
                icon={<CornerDownRight size={13} />}
                label="Fila hija"
                shortcut="Ctrl+Insert"
                onClick={() => act('addChild')}
            />

            <Sep />

            {/* Jerarquía */}
            <SectionLabel>Jerarquía</SectionLabel>
            <Item
                icon={<IndentIncrease size={13} />}
                label="Indentar"
                shortcut="Tab"
                onClick={() => act('indent')}
            />
            <Item
                icon={<IndentDecrease size={13} />}
                label="Outdentar"
                shortcut="Shift+Tab"
                onClick={() => act('outdent')}
            />

            {/* Expand / Collapse — solo si es grupo */}
            {isGroup && (
                <>
                    <Sep />
                    <SectionLabel>Vista</SectionLabel>
                    <Item
                        icon={<ChevronDown size={13} />}
                        label="Expandir"
                        disabled={isExpanded}
                        onClick={() => act('expand')}
                    />
                    <Item
                        icon={<ChevronRight size={13} />}
                        label="Colapsar"
                        disabled={!isExpanded}
                        onClick={() => act('collapse')}
                    />
                </>
            )}

            <Sep />

            {/* Eliminar */}
            <Item
                icon={<Trash2 size={13} />}
                label="Eliminar fila"
                variant="danger"
                onClick={() => act('delete')}
            />
        </div>,
        document.body,
    );
}
