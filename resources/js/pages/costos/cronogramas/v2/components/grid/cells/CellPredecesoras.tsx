import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { formatPredecessoras, parsePredecessoras } from '../../../types/task';
import type { GanttTask, Predecessor } from '../../../types/task';
import { PredecessorPicker } from './PredecessorPicker';

interface Props {
    value:          Predecessor[];
    allTasks:       GanttTask[];
    currentTaskId:  number;
    isEditing:      boolean;
    onCommit:       (value: Predecessor[]) => void;
    onCancel:       () => void;
    onClick?:       () => void;
    onDoubleClick?: () => void;
}

/**
 * CellPredecesoras
 *
 * ─ 1 clic  (fila ya seleccionada)  →  edición inline: input de texto en la celda
 *   - Escribe "2FC, 5CC+2" y presiona Enter o Tab para confirmar
 *   - Icono 🔍 (dentro de la celda) abre el modal/árbol
 *
 * ─ Doble clic  →  abre el modal picker con árbol y buscador directamente
 */
export function CellPredecesoras({
    value,
    allTasks,
    currentTaskId,
    isEditing,
    onCommit,
    onCancel,
    onClick,
    onDoubleClick,
}: Props) {
    const [localValue, setLocalValue] = useState('');
    const [pickerOpen, setPickerOpen] = useState(false);
    const [hasError, setHasError]     = useState(false);

    const cellRef  = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sincronizar texto cuando el valor externo cambia o se entra en modo edición
    useEffect(() => {
        if (isEditing) {
            setLocalValue(formatPredecessoras(value));
            setHasError(false);
        }
    }, [isEditing]);                 // solo al cambiar isEditing, NO en cada render

    // Foco automático al entrar en modo inline (pero no si el picker está abierto)
    useEffect(() => {
        if (isEditing && !pickerOpen) {
            requestAnimationFrame(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            });
        }
    }, [isEditing, pickerOpen]);

    // ── Commit del input inline ───────────────────────────────────────────────
    const handleCommitLocal = () => {
        const text = localValue.trim();
        if (!text) { onCommit([]); return; }
        const parsed   = parsePredecessoras(text);
        const byOrder  = new Map(allTasks.map(t => [Number(t.item_order), t]));
        const invalid  = parsed.find(p => !byOrder.has(Number(p.taskId)));
        if (invalid) { setHasError(true); return; }
        setHasError(false);
        onCommit(parsed);
    };

    // ── Doble clic: abrir picker (el parent también llama onStartEdit) ────────
    const handleDblClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDoubleClick?.();        // registra la fila como seleccionada
        setPickerOpen(true);
    };

    // ── Un clic: selección / inicio de edición (el parent decide) ────────────
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onClick?.();
    };

    // ── Cuando el picker aplica ───────────────────────────────────────────────
    const handlePickerCommit = (preds: Predecessor[]) => {
        setPickerOpen(false);
        onCommit(preds);
    };

    // ── Cuando el picker se cierra sin guardar ────────────────────────────────
    const handlePickerClose = () => {
        setPickerOpen(false);
        // Volver el foco al input inline si estamos en modo edición
        requestAnimationFrame(() => inputRef.current?.focus());
    };

    const display = formatPredecessoras(value);

    // ═══════════════════════════════════════════════════════════════════════════
    // MODO EDICIÓN INLINE
    // ═══════════════════════════════════════════════════════════════════════════
    if (isEditing) {
        return (
            <>
                {/* Celda con input + botón lupa (todo dentro del mismo ancho) */}
                <div
                    ref={cellRef}
                    className={`flex h-full w-full items-center overflow-hidden ring-1 ring-inset ${
                        hasError ? 'bg-red-50 ring-red-500 dark:bg-red-950/20' : 'bg-white ring-blue-500 dark:bg-slate-800'
                    }`}
                >
                    <input
                        ref={inputRef}
                        className={`h-full min-w-0 flex-1 bg-transparent px-1 font-mono text-xs outline-none ${
                            hasError ? 'text-red-700 dark:text-red-300' : 'text-slate-900 dark:text-white'
                        }`}
                        value={localValue}
                        placeholder="ej: 2FC"
                        onChange={(e) => { setLocalValue(e.target.value); setHasError(false); }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter')  { e.stopPropagation(); handleCommitLocal(); }
                            if (e.key === 'Escape') { e.stopPropagation(); setHasError(false); onCancel(); }
                            if (e.key === 'Tab')    { e.preventDefault();  handleCommitLocal(); }
                        }}
                        onBlur={() => {
                            // Solo hacer commit en blur si el picker NO está abierto
                            if (!pickerOpen) handleCommitLocal();
                        }}
                        onClick={(e) => e.stopPropagation()}
                    />

                    {/* Botón lupa — abre el modal picker */}
                    <button
                        type="button"
                        tabIndex={-1}
                        title="Buscar predecesor (árbol)"
                        className="flex h-full w-6 shrink-0 items-center justify-center border-l border-slate-300 bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600 dark:hover:text-white"
                        onMouseDown={(e) => {
                            // preventDefault evita que el input haga blur antes de que abramos el picker
                            e.preventDefault();
                            setPickerOpen(true);
                        }}
                    >
                        <Search size={10} />
                    </button>
                </div>

                {/* Modal picker — portal a body para no quedar cortado */}
                {pickerOpen && createPortal(
                    <PredecessorPicker
                        value={value}
                        allTasks={allTasks}
                        currentTaskId={currentTaskId}
                        onCommit={handlePickerCommit}
                        onClose={handlePickerClose}
                        anchorRef={cellRef}
                    />,
                    document.body,
                )}
            </>
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MODO DISPLAY (solo lectura)
    // ═══════════════════════════════════════════════════════════════════════════
    return (
        <>
            <div
                ref={cellRef}
                className="flex h-full w-full cursor-pointer select-none items-center justify-center overflow-hidden px-1 hover:bg-slate-100 dark:hover:bg-slate-700/40"
                onClick={handleClick}
                onDoubleClick={handleDblClick}
                title={display ? `Predecesores: ${display} · Doble clic para editar` : 'Doble clic para agregar predecesor'}
            >
                {display
                    ? <span className="truncate font-mono text-xs text-sky-400">{display}</span>
                    : <span className="text-xs text-slate-400 dark:text-slate-600">–</span>
                }
            </div>

            {/* El picker también puede abrirse desde display (doble clic) */}
            {pickerOpen && createPortal(
                <PredecessorPicker
                    value={value}
                    allTasks={allTasks}
                    currentTaskId={currentTaskId}
                    onCommit={handlePickerCommit}
                    onClose={() => setPickerOpen(false)}
                    anchorRef={cellRef}
                />,
                document.body,
            )}
        </>
    );
}
