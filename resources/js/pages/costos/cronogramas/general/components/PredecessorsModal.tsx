import React, { useState, useEffect, useCallback } from 'react';
import { gantt } from 'dhtmlx-gantt';
const LINK_LABELS: Record<string, string> = { '0': 'FC', '1': 'CC', '2': 'FF', '3': 'CF' };

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
    isOpen: boolean;
    taskId: any;
    onClose: () => void;
}

interface GanttTask {
    id: any;
    text: string;
    item?: string;
}

interface GanttLink {
    id: any;
    source: any;
    target: any;
    type: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────────────────────
export const PredecessorsModal = ({ isOpen, taskId, onClose }: Props) => {
    const [search, setSearch]               = useState('');
    const [tasks, setTasks]                 = useState<GanttTask[]>([]);
    const [links, setLinks]                 = useState<GanttLink[]>([]);
    const [tempSelections, setTempSelections] = useState<Record<string, string>>({});

    // ── Lectura del estado actual del gantt ──────────────────────────────────
    const refreshState = useCallback(() => {
        if (!taskId) return;

        const incomingLinks: GanttLink[] = gantt
            .getLinks()
            .filter((l: any) => String(l.target) === String(taskId));

        setLinks(incomingLinks);

        const available: GanttTask[] = [];
        gantt.eachTask((t: any) => {
            // Excluir la tarea actual y sus descendientes para evitar ciclos
            if (String(t.id) !== String(taskId)) {
                available.push({ id: t.id, text: t.text, item: t.item });
            }
        });
        setTasks(available);
        setTempSelections({});
    }, [taskId]);

    useEffect(() => {
        if (isOpen && taskId) refreshState();
    }, [isOpen, taskId, refreshState]);

    // ── Añadir predecesora ───────────────────────────────────────────────────
    // FIX: Se eliminó el ajuste manual de fechas que conflictuaba con
    // auto_scheduling. Ahora solo se crea el link y se deja que el plugin
    // auto_scheduling reposicione las tareas automáticamente.
    const predAdd = useCallback((sourceId: any, type: string) => {
        try {
            gantt.addLink({
                id: gantt.uid(),
                source: sourceId,
                target: taskId,
                type,
            });
            gantt.refreshData();
        } catch (e) {
            console.warn('[predAdd]', e);
        }
        refreshState();
    }, [taskId, refreshState]);

    // ── Eliminar predecesora ────────────────────────────────────────────────
    const predRemove = useCallback((linkId: any) => {
        try {
            gantt.deleteLink(linkId);
            gantt.refreshData();
        } catch (e) {
            console.warn('[predRemove]', e);
        }
        refreshState();
    }, [refreshState]);

    // ── Filtrado ─────────────────────────────────────────────────────────────
    const filteredTasks = tasks.filter((t) =>
        !search.trim() ||
        t.text.toLowerCase().includes(search.toLowerCase()) ||
        (t.item ?? '').toLowerCase().includes(search.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">

                {/* Cabecera */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                        Predecesoras
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                        aria-label="Cerrar"
                    >
                        &times;
                    </button>
                </div>

                {/* Buscador */}
                <div className="px-5 py-3 border-b border-gray-100">
                    <input
                        type="text"
                        placeholder="Buscar tarea o ítem..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                </div>

                {/* Lista */}
                <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
                    {filteredTasks.length === 0 && (
                        <p className="px-5 py-8 text-center text-gray-400 text-sm">
                            No se encontraron tareas
                        </p>
                    )}

                    {filteredTasks.map((t) => {
                        const existingLink = links.find(
                            (l) => String(l.source) === String(t.id)
                        );
                        const added    = !!existingLink;
                        const tempType = tempSelections[String(t.id)] ?? '';

                        return (
                            <div
                                key={t.id}
                                className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                            >
                                {/* Nombre */}
                                <span className="text-sm text-gray-800 flex-1 min-w-0 truncate">
                                    <span className="text-gray-400 mr-1.5 text-xs font-mono">
                                        {t.item ?? gantt.getGlobalTaskIndex(t.id) + 1}
                                    </span>
                                    {t.text}
                                </span>

                                {/* Selector de tipo */}
                                <select
                                    value={added ? existingLink!.type : tempType}
                                    disabled={added}
                                    onChange={(e) =>
                                        setTempSelections((prev) => ({
                                            ...prev,
                                            [String(t.id)]: e.target.value,
                                        }))
                                    }
                                    className="text-xs px-2 py-1 border border-gray-300 rounded-md bg-white focus:outline-none flex-shrink-0 disabled:opacity-60"
                                >
                                    <option value="" disabled>Tipo…</option>
                                    <option value="0">FC – Fin-Comienzo</option>
                                    <option value="1">CC – Comienzo-Comienzo</option>
                                    <option value="2">FF – Fin-Fin</option>
                                    <option value="3">CF – Comienzo-Fin</option>
                                </select>

                                {/* Acción */}
                                <button
                                    onClick={() => {
                                        if (added && existingLink) {
                                            predRemove(existingLink.id);
                                        } else if (!added && tempType) {
                                            predAdd(t.id, tempType);
                                        }
                                    }}
                                    disabled={!added && !tempType}
                                    className={`text-xs px-3 py-1.5 rounded-md font-semibold text-white transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                                        added
                                            ? 'bg-red-500 hover:bg-red-600'
                                            : 'bg-emerald-500 hover:bg-emerald-600'
                                    }`}
                                >
                                    {added ? 'Quitar' : 'Agregar'}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Pie */}
                <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 text-right">
                    {links.length} predecesora{links.length !== 1 ? 's' : ''} asignada{links.length !== 1 ? 's' : ''}
                </div>
            </div>
        </div>
    );
};