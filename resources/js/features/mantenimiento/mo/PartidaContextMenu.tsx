import { useEffect, useRef } from 'react';

interface Props {
    x: number;
    y: number;
    onAddChild: () => void;
    onAddSibling: () => void;
    onDelete: () => void;
    onClose: () => void;
    canDelete?: boolean;
}

const MENU_WIDTH = 208;
const MENU_HEIGHT = 116;

export default function PartidaContextMenu({ x, y, onAddChild, onAddSibling, onDelete, onClose, canDelete = true }: Props) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handlePointer = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) onClose();
        };
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', handlePointer);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handlePointer);
            document.removeEventListener('keydown', handleKey);
        };
    }, [onClose]);

    const item = (label: string, onClick: () => void, danger = false) => (
        <button
            type="button"
            onClick={() => {
                onClick();
                onClose();
            }}
            className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800 ${danger ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'}`}
        >
            {label}
        </button>
    );

    const left = Math.min(x, window.innerWidth - MENU_WIDTH - 8);
    const top = Math.min(y, window.innerHeight - MENU_HEIGHT - 8);

    return (
        <div
            ref={ref}
            style={{ position: 'fixed', left, top, width: MENU_WIDTH }}
            className="z-50 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
            {item('+ Agregar hijo', onAddChild)}
            {item('+ Agregar al mismo nivel', onAddSibling)}
            {canDelete && item('Eliminar', onDelete, true)}
        </div>
    );
}
