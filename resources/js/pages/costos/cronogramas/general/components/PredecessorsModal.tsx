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
    rownum: number;  // número de fila global (1, 2, 3…)
    item?: string;   // código WBS, solo para filtrar en búsqueda
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
    const [search,         setSearch]         = useState('');
    const [tasks,          setTasks]          = useState<GanttTask[]>([]);
    const [links,          setLinks]          = useState<GanttLink[]>([]);
    const [tempSelections, setTempSelections] = useState<Record<string, string>>({});

    // ── Leer estado del gantt ─────────────────────────────────────────────────
    const refreshState = useCallback(() => {
        if (!taskId) return;

        const incomingLinks: GanttLink[] = gantt
            .getLinks()
            .filter((l: any) => String(l.target) === String(taskId));
        setLinks(incomingLinks);

        const available: GanttTask[] = [];
        gantt.eachTask((t: any) => {
            if (String(t.id) === String(taskId)) return;
            available.push({
                id:     t.id,
                text:   t.text,
                // FIX: número de fila global (1-based), no el código WBS
                rownum: gantt.getGlobalTaskIndex(t.id) + 1,
                item:   t.item,
            });
        });
        setTasks(available);
        setTempSelections({});
    }, [taskId]);

    useEffect(() => {
        if (isOpen && taskId) refreshState();
    }, [isOpen, taskId, refreshState]);

    // ── Añadir predecesora ────────────────────────────────────────────────────
    // Crea el link y llama autoSchedule() para que dhtmlx reposicione la tarea
    // target respetando el tipo de relación (FC mueve al día siguiente del fin
    // de source, CC alinea inicios, FF alinea fines, CF invierte).
  const predAdd = useCallback((sourceId: any, type: string) => {
    try {
        console.log('🔍 predAdd - sourceId:', sourceId, 'taskId:', taskId, 'type:', type);
        
        const sourceTask = gantt.getTask(sourceId);
        const targetTask = gantt.getTask(taskId);
        
        console.log('📌 sourceTask:', sourceTask?.text);
        console.log('📌 targetTask:', targetTask?.text);
        
        // Validar que las tareas existan
        if (!sourceTask) {
            console.error('❌ sourceTask no encontrada:', sourceId);
            return;
        }
        if (!targetTask) {
            console.error('❌ targetTask no encontrada:', taskId);
            return;
        }
        
        // Ajustar fechas según el tipo de relación
        if (type === '0') { // FC - Fin-Comienzo
            const newStart = new Date(sourceTask.end_date);
            newStart.setDate(newStart.getDate() + 1);
            targetTask.start_date = newStart;
            targetTask.end_date = gantt.date.add(newStart, targetTask.duration, 'day');
            gantt.updateTask(taskId);
        }
        else if (type === '1') { // CC - Comienzo-Comienzo
            targetTask.start_date = new Date(sourceTask.start_date);
            targetTask.end_date = gantt.date.add(targetTask.start_date, targetTask.duration, 'day');
            gantt.updateTask(taskId);
        }
        else if (type === '2') { // FF - Fin-Fin
            targetTask.end_date = new Date(sourceTask.end_date);
            const newStart = gantt.date.add(targetTask.end_date, -targetTask.duration, 'day');
            targetTask.start_date = newStart;
            gantt.updateTask(taskId);
        }
        else if (type === '3') { // CF - Comienzo-Fin
            targetTask.end_date = new Date(sourceTask.start_date);
            const newStart = gantt.date.add(targetTask.end_date, -targetTask.duration, 'day');
            targetTask.start_date = newStart;
            gantt.updateTask(taskId);
        }
        
        // Crear el link
        gantt.addLink({
            id: gantt.uid(),
            source: sourceId,
            target: taskId,
            type,
        });
        
        // Auto-scheduling
        if (typeof (gantt as any).autoSchedule === 'function') {
            (gantt as any).autoSchedule();
        }
        
        gantt.render();
    } catch (e) {
        console.error('[predAdd] Error:', e);
    }
    refreshState();
}, [taskId, refreshState]);

    // ── Eliminar predecesora ──────────────────────────────────────────────────
    const predRemove = useCallback((linkId: any) => {
        try {
            gantt.deleteLink(linkId);
            if (typeof (gantt as any).autoSchedule === 'function') {
                (gantt as any).autoSchedule();
            }
            gantt.render();
        } catch (e) {
            console.warn('[predRemove]', e);
        }
        refreshState();
    }, [refreshState]);

    // ── Filtrado ──────────────────────────────────────────────────────────────
    const filteredTasks = tasks.filter((t) => {
        if (!search.trim()) return true;
        const lower = search.toLowerCase();
        return (
            t.text.toLowerCase().includes(lower) ||
            String(t.rownum).includes(lower) ||
            (t.item ?? '').toLowerCase().includes(lower)
        );
    });

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
                        placeholder="Buscar por nombre, número o ítem..."
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
                                className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                                    added ? 'bg-emerald-50' : 'hover:bg-gray-50'
                                }`}
                            >
                                {/* Número de fila + nombre de tarea */}
                                <span className="text-sm text-gray-800 flex-1 min-w-0 truncate flex items-center gap-2">
                                    {/* FIX: número de fila (1, 2, 3…) en lugar del código WBS */}
                                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold font-mono px-1 flex-shrink-0">
                                        {t.rownum}
                                    </span>
                                    <span className="truncate">{t.text}</span>
                                </span>

                                {/* Selector de tipo de relación */}
                                <select
                                    value={added ? existingLink!.type : tempType}
                                    disabled={added}
                                    onChange={(e) =>
                                        setTempSelections((prev) => ({
                                            ...prev,
                                            [String(t.id)]: e.target.value,
                                        }))
                                    }
                                    className="text-xs px-2 py-1 border border-gray-300 rounded-md bg-white focus:outline-none flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <option value="" disabled>Tipo…</option>
                                    <option value="0">FC – Fin-Comienzo</option>
                                    <option value="1">CC – Comienzo-Comienzo</option>
                                    <option value="2">FF – Fin-Fin</option>
                                    <option value="3">CF – Comienzo-Fin</option>
                                </select>

                                {/* Botón acción */}
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

                {/* Pie — chips de predecesoras activas + contador */}
                <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
                    <div className="flex gap-1.5 flex-wrap">
                        {links.map((l) => {
                            try {
                                const rownum = gantt.getGlobalTaskIndex(l.source) + 1;
                                return (
                                    <span
                                        key={l.id}
                                        className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                    >
                                        #{rownum} {LINK_LABELS[l.type]}
                                    </span>
                                );
                            } catch { return null; }
                        })}
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                        {links.length} predecesora{links.length !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>
        </div>
    );
};