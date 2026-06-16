import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, X, ChevronDown, ChevronRight, Check } from 'lucide-react';
import type { GanttTask, Predecessor, PredecessorType } from '../../../types/task';
import { formatPredecessoras, parsePredecessoras } from '../../../types/task';

// ─── Constantes ───────────────────────────────────────────────────────────────
const TIPO_OPTIONS: PredecessorType[] = ['FC', 'CC', 'FF', 'CF'];
const TIPO_LABELS: Record<PredecessorType, string> = {
    FC: 'FC (Fin → Inicio)',
    CC: 'CC (Inicio → Inicio)',
    FF: 'FF (Fin → Fin)',
    CF: 'CF (Inicio → Fin)',
};
const ROW_H = 26;

interface Props {
    value:         Predecessor[];
    allTasks:      GanttTask[];
    currentTaskId: number;
    onCommit:      (value: Predecessor[]) => void;
    onClose:       () => void;
    anchorRef:     React.RefObject<HTMLElement | null>;
}

// ─── Tipo auxiliar para fila de árbol ────────────────────────────────────────
interface TreeRow extends GanttTask {
    _isGroup:  boolean;
    _depth:    number;
}

// ─── Validación ───────────────────────────────────────────────────────────────
function validatePreds(
    preds: Predecessor[],
    byOrder: Map<number, GanttTask>,
): string | null {
    for (const p of preds) {
        if (!byOrder.has(Number(p.taskId))) {
            return `N° ${p.taskId} no existe`;
        }
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
export function PredecessorPicker({
    value,
    allTasks,
    currentTaskId,
    onCommit,
    onClose,
    anchorRef,
}: Props) {
    // ── Estado ────────────────────────────────────────────────────────────────
    const [preds, setPreds]             = useState<Predecessor[]>(() => [...value]);
    const [searchQuery, setSearch]      = useState('');
    const [manualText, setManual]       = useState(() => formatPredecessoras(value));
    const [manualError, setManualError] = useState<string | null>(null);
    const [addTipo, setAddTipo]         = useState<PredecessorType>('FC');
    const [addLag, setAddLag]           = useState(0);
    const [showTipoMenu, setShowTipoMenu] = useState(false);

    // Grupos expandidos – todos abiertos por defecto
    const [expandedIds, setExpandedIds] = useState<Set<number>>(() => {
        const ids = new Set<number>();
        allTasks.forEach(t => { if (t.parent_id !== null) ids.add(t.parent_id); });
        return ids;
    });

    const containerRef = useRef<HTMLDivElement>(null);
    const searchRef    = useRef<HTMLInputElement>(null);
    const listRef      = useRef<HTMLDivElement>(null);

    // ── Mapas derivados ───────────────────────────────────────────────────────
    const byOrder = useMemo(
        () => new Map(allTasks.map(t => [Number(t.item_order), t])),
        [allTasks],
    );

    const groupIds = useMemo(() => {
        const ids = new Set<number>();
        allTasks.forEach(t => { if (t.parent_id !== null) ids.add(t.parent_id); });
        return ids;
    }, [allTasks]);

    const toggleExpand = useCallback((id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    // ── Filas visibles del árbol ──────────────────────────────────────────────
    const treeRows = useMemo((): TreeRow[] => {
        const q = searchQuery.trim().toLowerCase();

        if (q) {
            // Con búsqueda: mostrar todas las que coincidan (sin árbol)
            return allTasks
                .filter(t => {
                    if (t.id === currentTaskId) return false;
                    return (
                        String(t.item_order).includes(q) ||
                        t.descripcion.toLowerCase().includes(q) ||
                        (t.partida ?? '').toLowerCase().includes(q)
                    );
                })
                .map(t => ({
                    ...t,
                    _isGroup: groupIds.has(t.id),
                    _depth:   Math.max(0, t.nivel - 1),
                }));
        }

        // Sin búsqueda: respetar árbol colapsado
        const collapsed = new Set<number>();
        const result: TreeRow[] = [];

        for (const task of allTasks) {
            if (task.id === currentTaskId) continue;

            // Ocultar si el padre está colapsado
            if (task.parent_id !== null && collapsed.has(task.parent_id)) {
                if (groupIds.has(task.id)) collapsed.add(task.id);
                continue;
            }

            // Registrar colapso de grupos cerrados
            if (groupIds.has(task.id) && !expandedIds.has(task.id)) {
                collapsed.add(task.id);
            }

            result.push({
                ...task,
                _isGroup: groupIds.has(task.id),
                _depth:   Math.max(0, task.nivel - 1),
            });
        }
        return result;
    }, [allTasks, currentTaskId, searchQuery, expandedIds, groupIds]);

    const virtualizer = useVirtualizer({
        count:            treeRows.length,
        getScrollElement: () => listRef.current,
        estimateSize:     () => ROW_H,
        overscan:         10,
    });

    // ── Auto-foco ─────────────────────────────────────────────────────────────
    useEffect(() => {
        requestAnimationFrame(() => searchRef.current?.focus());
    }, []);

    // ── Cerrar al click fuera (con delay para evitar cierre inmediato) ─────────
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                !containerRef.current?.contains(target) &&
                !anchorRef.current?.contains(target)
            ) {
                onClose();
            }
        };
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handler);
        }, 80);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handler);
        };
    }, [onClose, anchorRef]);

    // ── Sync manual → preds ──────────────────────────────────────────────────
    const commitManual = useCallback(() => {
        if (!manualText.trim()) {
            setManualError(null);
            setPreds([]);
            return;
        }
        const parsed = parsePredecessoras(manualText);
        const err    = validatePreds(parsed, byOrder);
        if (err) { setManualError(err); return; }
        setManualError(null);
        setPreds(parsed);
        setManual(formatPredecessoras(parsed));
    }, [manualText, byOrder]);

    // ── Toggle desde árbol ────────────────────────────────────────────────────
    const togglePred = useCallback((task: GanttTask) => {
        const taskIdNum = Number(task.item_order);
        const already   = preds.some(p => Number(p.taskId) === taskIdNum);
        let next: Predecessor[];
        if (already) {
            next = preds.filter(p => Number(p.taskId) !== taskIdNum);
        } else {
            next = [...preds, { taskId: taskIdNum, tipo: addTipo, lag: addLag }];
        }
        setPreds(next);
        setManual(formatPredecessoras(next));
        setManualError(null);
    }, [preds, addTipo, addLag]);

    // ── Eliminar chip ─────────────────────────────────────────────────────────
    const removePred = useCallback((taskId: number) => {
        const next = preds.filter(p => Number(p.taskId) !== Number(taskId));
        setPreds(next);
        setManual(formatPredecessoras(next));
    }, [preds]);

    // ── Guardar ───────────────────────────────────────────────────────────────
    const handleSave = () => {
        const err = validatePreds(preds, byOrder);
        if (err) { setManualError(err); return; }
        onCommit(preds);
    };

    // ── Posición del popover ───────────────────────────────────────────────────
    const anchorRect = anchorRef.current?.getBoundingClientRect();
    const viewportH  = window.innerHeight;
    const popH       = 520;
    const spaceBelow = viewportH - (anchorRect?.bottom ?? 0);
    const top = spaceBelow > popH + 8
        ? (anchorRect?.bottom ?? 0) + 2
        : (anchorRect?.top ?? 0) - popH - 2;

    const popoverStyle: React.CSSProperties = {
        position: 'fixed',
        top:      Math.max(8, top),
        left:     Math.max(8, (anchorRect?.left ?? 0) - 40),
        zIndex:   99999,
        width:    380,
        maxHeight: popH,
    };

    return (
        <div
            ref={containerRef}
            className="flex flex-col rounded-xl border border-slate-600 bg-slate-900 shadow-2xl shadow-black/70"
            style={popoverStyle}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
        >
            {/* ─── Cabecera ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between rounded-t-xl border-b border-slate-700/60 bg-slate-800/60 px-4 py-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-300">
                    Predecesores
                </span>
                <button
                    type="button"
                    className="rounded p-0.5 text-slate-500 hover:bg-slate-700 hover:text-white"
                    onClick={onClose}
                >
                    <X size={13} />
                </button>
            </div>

            <div className="flex flex-col gap-3 overflow-y-auto p-3">

                {/* ─── Entrada manual ───────────────────────────────────────── */}
                <div>
                    <div className="mb-1 flex items-center justify-between">
                        <label className="text-[10px] text-slate-500">
                            Entrada manual · <span className="font-mono text-slate-400">2FC, 5CC+2</span>
                        </label>
                    </div>
                    <div className="flex gap-1">
                        <input
                            className={`h-7 flex-1 rounded border px-2 font-mono text-xs text-white outline-none transition-colors ${
                                manualError
                                    ? 'border-red-500 bg-red-950/30 focus:border-red-400'
                                    : 'border-slate-600 bg-slate-950 focus:border-blue-500'
                            }`}
                            value={manualText}
                            placeholder="ej: 2FC, 5CC+2, 3FF-1"
                            onChange={(e) => { setManual(e.target.value); setManualError(null); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') commitManual(); }}
                            onBlur={commitManual}
                        />
                        <button
                            type="button"
                            className="h-7 rounded bg-slate-700 px-2.5 text-[11px] text-slate-300 hover:bg-slate-600"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={commitManual}
                        >
                            OK
                        </button>
                    </div>
                    {manualError && (
                        <p className="mt-1 text-[10px] text-red-400">⚠ {manualError}</p>
                    )}
                </div>

                {/* ─── Tipo y Lag ───────────────────────────────────────────── */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500">Tipo vínculo:</span>
                    <div className="relative">
                        <button
                            type="button"
                            className="flex h-6 items-center gap-1 rounded border border-slate-600 bg-slate-800 px-2 font-mono text-[10px] text-slate-200 hover:bg-slate-700"
                            onClick={() => setShowTipoMenu(v => !v)}
                        >
                            {addTipo} <ChevronDown size={9} />
                        </button>
                        {showTipoMenu && (
                            <div className="absolute left-0 top-7 z-50 min-w-max rounded border border-slate-600 bg-slate-800 shadow-xl">
                                {TIPO_OPTIONS.map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[10px] hover:bg-slate-700 ${
                                            t === addTipo ? 'text-blue-400' : 'text-slate-300'
                                        }`}
                                        onClick={() => { setAddTipo(t); setShowTipoMenu(false); }}
                                    >
                                        {t === addTipo && <Check size={9} />}
                                        {TIPO_LABELS[t]}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <span className="text-[10px] text-slate-500">Lag:</span>
                    <input
                        type="number"
                        className="h-6 w-14 rounded border border-slate-600 bg-slate-950 px-1 text-center text-[10px] text-white outline-none focus:border-blue-500"
                        value={addLag}
                        onChange={(e) => setAddLag(Number(e.target.value))}
                    />
                    <span className="text-[10px] text-slate-600">días</span>
                </div>

                {/* ─── Chips de seleccionados ───────────────────────────────── */}
                {preds.length > 0 && (
                    <div className="flex flex-wrap gap-1 rounded-lg border border-slate-700/50 bg-slate-800/30 p-2">
                        <span className="w-full text-[9px] uppercase tracking-wider text-slate-600">Seleccionados:</span>
                        {preds.map(p => {
                            const task   = byOrder.get(Number(p.taskId));
                            const lagStr = p.lag > 0 ? `+${p.lag}` : p.lag < 0 ? String(p.lag) : '';
                            const label  = `${p.taskId}${p.tipo}${lagStr}`;
                            return (
                                <span
                                    key={p.taskId}
                                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] ${
                                        !task
                                            ? 'bg-red-900/50 text-red-300'
                                            : 'bg-blue-800/60 text-blue-200'
                                    }`}
                                    title={task?.descripcion ?? 'ID no encontrado'}
                                >
                                    {label}
                                    <button
                                        type="button"
                                        className="ml-0.5 rounded-full opacity-60 hover:opacity-100"
                                        onClick={() => removePred(p.taskId)}
                                    >
                                        <X size={9} />
                                    </button>
                                </span>
                            );
                        })}
                    </div>
                )}

                {/* ─── Buscador ─────────────────────────────────────────────── */}
                <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        ref={searchRef}
                        className="h-7 w-full rounded border border-slate-600 bg-slate-950 pl-7 pr-2 text-xs text-white outline-none focus:border-blue-500"
                        placeholder="Buscar por N°, descripción o partida…"
                        value={searchQuery}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                            onClick={() => setSearch('')}
                        >
                            <X size={11} />
                        </button>
                    )}
                </div>

                {/* ─── Árbol de tareas (virtualizado) ──────────────────────── */}
                <div
                    ref={listRef}
                    className="overflow-y-auto rounded-lg border border-slate-700 bg-slate-950"
                    style={{ height: Math.min(treeRows.length * ROW_H, 200) || 48 }}
                >
                    {treeRows.length === 0 ? (
                        <div className="flex h-12 items-center justify-center text-[11px] text-slate-600">
                            Sin resultados
                        </div>
                    ) : (
                        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                            {virtualizer.getVirtualItems().map(vRow => {
                                const task        = treeRows[vRow.index];
                                if (!task) return null;
                                const isSelected  = preds.some(p => Number(p.taskId) === Number(task.item_order));
                                const isGroup     = task._isGroup;
                                const depth       = task._depth;
                                const isExpanded  = expandedIds.has(task.id);

                                return (
                                    <div
                                        key={task.id}
                                        className={`absolute left-0 right-0 flex cursor-pointer select-none items-center border-b border-slate-800/40 transition-colors ${
                                            isSelected
                                                ? 'bg-blue-900/30 text-blue-200'
                                                : isGroup
                                                    ? 'text-slate-200 hover:bg-slate-800/60'
                                                    : 'text-slate-300 hover:bg-slate-800/40'
                                        }`}
                                        style={{ top: vRow.start, height: ROW_H }}
                                        onClick={() => !isGroup && togglePred(task)}
                                    >
                                        {/* Checkbox visual */}
                                        <div className="flex w-7 shrink-0 items-center justify-center">
                                            {!isGroup && (
                                                <div className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${
                                                    isSelected
                                                        ? 'border-blue-500 bg-blue-600'
                                                        : 'border-slate-600 bg-slate-800'
                                                }`}>
                                                    {isSelected && <Check size={9} className="text-white" />}
                                                </div>
                                            )}
                                        </div>

                                        {/* Indent */}
                                        <div
                                            className="flex shrink-0 items-center"
                                            style={{ paddingLeft: `${depth * 12}px` }}
                                        >
                                            {isGroup ? (
                                                <button
                                                    className="flex h-5 w-5 items-center justify-center text-slate-400 hover:text-slate-100"
                                                    onClick={(e) => toggleExpand(task.id, e)}
                                                >
                                                    {isExpanded
                                                        ? <ChevronDown size={11} />
                                                        : <ChevronRight size={11} />
                                                    }
                                                </button>
                                            ) : (
                                                <div className="w-5" />
                                            )}
                                        </div>

                                        {/* N° */}
                                        <span className="w-7 shrink-0 font-mono text-[10px] text-slate-500">
                                            {task.item_order}
                                        </span>

                                        {/* Descripción */}
                                        <span className={`flex-1 truncate text-[11px] pr-2 ${isGroup ? 'font-semibold' : ''}`}>
                                            {task.descripcion || task.partida}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Footer ──────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between rounded-b-xl border-t border-slate-700/60 bg-slate-800/40 px-4 py-2">
                <span className="text-[10px] text-slate-500">
                    {preds.length === 0
                        ? 'Sin predecesores'
                        : `${preds.length} predecesor${preds.length > 1 ? 'es' : ''} seleccionado${preds.length > 1 ? 's' : ''}`
                    }
                </span>
                <div className="flex gap-2">
                    <button
                        type="button"
                        className="h-7 rounded-lg bg-slate-700 px-3 text-xs text-slate-300 hover:bg-slate-600"
                        onClick={onClose}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className={`h-7 rounded-lg px-4 text-xs font-medium text-white transition-colors ${
                            manualError
                                ? 'cursor-not-allowed bg-slate-700 opacity-40'
                                : 'bg-blue-600 hover:bg-blue-500'
                        }`}
                        disabled={!!manualError}
                        onClick={handleSave}
                    >
                        Aplicar
                    </button>
                </div>
            </div>
        </div>
    );
}
