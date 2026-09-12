import { PlusCircle, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface Props {
    x: number;
    y: number;
    materialName: string;
    onClose: () => void;
    onAddMaterial: () => void;
    onDelete: () => void;
}

export default function MatMaterialContextMenu({ x, y, materialName, onClose, onAddMaterial, onDelete }: Props) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onMouse = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', onMouse);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onMouse);
            document.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    // Ajuste para no salir de pantalla
    const top = Math.min(y, window.innerHeight - 120);
    const left = Math.min(x, window.innerWidth - 210);

    return (
        <div
            ref={ref}
            style={{ top, left }}
            className="fixed z-50 min-w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
            {/* Nombre del material */}
            <div className="truncate border-b border-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:text-slate-500">
                {materialName}
            </div>

            <button
                type="button"
                onClick={() => {
                    onAddMaterial();
                    onClose();
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-blue-50 dark:hover:bg-blue-950/30"
            >
                <PlusCircle size={12} className="text-blue-500" />
                Agregar material aquí
            </button>

            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

            <button
                type="button"
                onClick={() => {
                    onDelete();
                    onClose();
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
                <Trash2 size={12} />
                Eliminar material
            </button>
        </div>
    );
}
