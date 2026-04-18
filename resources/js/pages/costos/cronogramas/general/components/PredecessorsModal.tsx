import React, { useState, useEffect, useCallback } from 'react';
import { gantt } from 'dhtmlx-gantt';

// Importamos las funciones centralizadas del helper
// ya no duplicamos la lógica de fechas aquí
import {
    adjustTaskDatesByLinkType,
    updatePredecessorsText,
    LINK_LABELS,
} from '../helpers/ganttHelpers';

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
    const [search, setSearch] = useState('');
    const [tasks, setTasks] = useState<GanttTask[]>([]);
    const [links, setLinks] = useState<GanttLink[]>([]);
    const [tempSelections, setTempSelections] = useState<Record<string, string>>({});

    // ── Leer estado actual del gantt ──────────────────────────────────────────
    // Se llama al abrir el modal y después de cada acción para mantener
    // la lista sincronizada con los links reales del gantt.
    const refreshState = useCallback(() => {
        if (!taskId) return;

        // Links que apuntan a esta tarea (sus predecesoras)
        const incomingLinks: GanttLink[] = gantt
            .getLinks()
            .filter((l: any) => String(l.target) === String(taskId));
        setLinks(incomingLinks);

        // Lista de todas las tareas disponibles para seleccionar como predecesora
        const available: GanttTask[] = [];
        gantt.eachTask((t: any) => {
            if (String(t.id) === String(taskId)) return; // excluir la tarea actual
            available.push({
                id: t.id,
                text: t.text,
                rownum: gantt.getGlobalTaskIndex(t.id) + 1, // número de fila (1-based)
                item: t.item,
            });
        });

        setTasks(available);
        setTempSelections({}); // limpiar selecciones temporales al refrescar
    }, [taskId]);

    useEffect(() => {
        if (isOpen && taskId) refreshState();
    }, [isOpen, taskId, refreshState]);

    // ── Agregar predecesora ───────────────────────────────────────────────────
    // 1. Ajusta las fechas de la tarea destino según el tipo de relación
    //    usando calculateEndDate (respeta días no laborables)
    // 2. Crea el link en el gantt
    // 3. Llama autoSchedule para propagar cambios a tareas dependientes
    // 4. Actualiza el texto de la columna predecesoras
    const predAdd = useCallback((sourceId: any, type: string) => {
        try {
            const sourceTask = gantt.getTask(sourceId);
            const targetTask = gantt.getTask(taskId);

            if (!sourceTask || !targetTask) return;

            const duration = Number(targetTask.duration) || 1;

            // Ajustar fechas usando la función centralizada del helper
            // (antes se hacía con date.add que ignora fines de semana)
            adjustTaskDatesByLinkType(targetTask, sourceTask, type, duration);
            gantt.updateTask(taskId);

            // Crear el link
            gantt.addLink({
                id: gantt.uid(),
                source: sourceId,
                target: taskId,
                type,
            });

            // Propagar el cambio a tareas que dependan de esta
            if (typeof (gantt as any).autoSchedule === 'function') {
                (gantt as any).autoSchedule();
            }

            // Actualizar la columna de predecesoras en el grid
            // usando número de fila (formato unificado con el parser)
            updatePredecessorsText(taskId);

            gantt.render();
        } catch (e) {
            console.error('[predAdd]', e);
        }
        refreshState();
    }, [taskId, refreshState]);

    // ── Eliminar predecesora ──────────────────────────────────────────────────
    // Elimina el link, dispara auto-scheduling y actualiza la columna del grid.
    // Antes solo eliminaba el link y no actualizaba el texto de la columna.
    const predRemove = useCallback((linkId: any, targetId: any) => {
        try {
            gantt.deleteLink(linkId);

            if (typeof (gantt as any).autoSchedule === 'function') {
                (gantt as any).autoSchedule();
            }

            // FIX: actualizar el texto de la columna después de eliminar
            // Antes esto no se hacía, entonces la columna mostraba datos viejos
            updatePredecessorsText(targetId);

            gantt.render();
        } catch (e) {
            console.warn('[predRemove]', e);
        }
        refreshState();
    }, [refreshState]);

    // ── Cambiar tipo de relación existente ────────────────────────────────────
    // Permite editar el tipo de un link ya creado sin tener que quitarlo y
    // volver a agregarlo. Antes esto no era posible.
    const predChangeType = useCallback((linkId: any, newType: string) => {
        try {
            const link: any = gantt.getLink(linkId);
            if (!link) return;

            link.type = newType;
            gantt.updateLink(linkId);

            // Recalcular fechas con el nuevo tipo de relación
            const sourceTask = gantt.getTask(link.source);
            const targetTask = gantt.getTask(link.target);
            const duration   = Number(targetTask.duration) || 1;

            adjustTaskDatesByLinkType(targetTask, sourceTask, newType, duration);
            gantt.updateTask(link.target);

            if (typeof (gantt as any).autoSchedule === 'function') {
                (gantt as any).autoSchedule();
            }

            updatePredecessorsText(link.target);
            gantt.render();
        } catch (e) {
            console.warn('[predChangeType]', e);
        }
        refreshState();
    }, [refreshState]);

    // ── Filtrado de tareas ────────────────────────────────────────────────────
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

                {/* Lista de tareas */}
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
                                {/* Número de fila + nombre */}
                                <span className="text-sm text-gray-800 flex-1 min-w-0 truncate flex items-center gap-2">
                                    <span className="inline-flex items-center justify-center min-w-[24px] h-5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold font-mono px-1 flex-shrink-0">
                                        {t.rownum}
                                    </span>
                                    <span className="truncate">{t.text}</span>
                                </span>

                                {/* Selector de tipo de relación
                                    - Si ya existe link: permite editar el tipo (predChangeType)
                                    - Si no existe: guarda la selección temporal para usarla al agregar */}
                                <select
                                    value={added ? existingLink!.type : tempType}
                                    onChange={(e) => {
                                        if (added && existingLink) {
                                            // Cambiar tipo del link existente sin quitar y volver a agregar
                                            predChangeType(existingLink.id, e.target.value);
                                        } else {
                                            setTempSelections((prev) => ({
                                                ...prev,
                                                [String(t.id)]: e.target.value,
                                            }));
                                        }
                                    }}
                                    className="text-xs px-2 py-1 border border-gray-300 rounded-md bg-white focus:outline-none flex-shrink-0"
                                >
                                    <option value="" disabled>Tipo…</option>
                                    <option value="0">FC – Fin-Comienzo</option>
                                    <option value="1">CC – Comienzo-Comienzo</option>
                                    <option value="2">FF – Fin-Fin</option>
                                    <option value="3">CF – Comienzo-Fin</option>
                                </select>

                                {/* Botón agregar / quitar */}
                                <button
                                    onClick={() => {
                                        if (added && existingLink) {
                                            predRemove(existingLink.id, taskId);
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