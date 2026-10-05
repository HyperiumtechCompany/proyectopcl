import { Redo2, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useValorizacionStore } from '../store/ValorizacionStoreProvider';

const isTextField = (target: EventTarget | null): boolean =>
    target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * Deshacer / rehacer de toda la valorización (botones + Ctrl+Z, Ctrl+Y,
 * Ctrl+Shift+Z). Dentro de un campo de texto se respeta el deshacer nativo
 * del navegador.
 */
export function HistoryControls() {
    const undoLabel = useValorizacionStore((state) => state.history.past.at(-1)?.label ?? null);
    const redoLabel = useValorizacionStore((state) => state.history.future[0]?.label ?? null);
    const undo = useValorizacionStore((state) => state.undo);
    const redo = useValorizacionStore((state) => state.redo);
    const [notice, setNotice] = useState<string | null>(null);
    const timer = useRef<number | undefined>(undefined);

    const announce = (prefix: string, label: string | null) => {
        if (!label) {
            return;
        }
        setNotice(`${prefix}: ${label}`);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setNotice(null), 2500);
    };

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey) || isTextField(event.target)) {
                return;
            }
            const key = event.key.toLowerCase();
            if (key === 'z' && !event.shiftKey) {
                event.preventDefault();
                announce('Deshecho', undo());
            } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
                event.preventDefault();
                announce('Rehecho', redo());
            }
        };
        window.addEventListener('keydown', onKeyDown);

        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.clearTimeout(timer.current);
        };
    });

    const button = 'rounded-md p-1.5 text-stone-300 hover:bg-stone-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30';

    return (
        <div className="flex items-center gap-1">
            <span aria-live="polite" className="mr-1 hidden max-w-64 truncate text-[11px] text-amber-300 sm:inline">{notice}</span>
            <button type="button" className={button} disabled={!undoLabel} onClick={() => announce('Deshecho', undo())} title={undoLabel ? `Deshacer: ${undoLabel} (Ctrl+Z)` : 'Nada que deshacer'} aria-label="Deshacer">
                <Undo2 className="size-4" />
            </button>
            <button type="button" className={button} disabled={!redoLabel} onClick={() => announce('Rehecho', redo())} title={redoLabel ? `Rehacer: ${redoLabel} (Ctrl+Y)` : 'Nada que rehacer'} aria-label="Rehacer">
                <Redo2 className="size-4" />
            </button>
        </div>
    );
}
