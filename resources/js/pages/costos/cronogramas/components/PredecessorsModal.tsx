import React, { useState, useEffect } from 'react';
import { gantt } from 'dhtmlx-gantt';

interface Props {
    isOpen: boolean;
    taskId: any;
    onClose: () => void;
}

const LINK_LABELS: Record<string, string> = { '0': 'FC', '1': 'CC', '2': 'FF', '3': 'CF' };

export const PredecessorsModal = ({ isOpen, taskId, onClose }: Props) => {
    const [search, setSearch] = useState('');
    const [tasks, setTasks] = useState<any[]>([]);
    const [links, setLinks] = useState<any[]>([]);

    const refreshPredState = () => {
        if (!taskId) return;
        setLinks(gantt.getLinks().filter((l: any) => l.target == taskId));
        const available: any[] = [];
        gantt.eachTask((t: any) => {
            if (t.id != taskId) {
                available.push({ id: t.id, text: t.text, item: t.item });
            }
        });
        setTasks(available);
    };

    useEffect(() => {
        if (isOpen && taskId) {
            refreshPredState();
        }
    }, [isOpen, taskId]);

    const predAdd = (sourceId: any, type = '0') => {
        gantt.addLink({ id: gantt.uid(), source: sourceId, target: taskId, type });
        gantt.refreshData();
        refreshPredState();
    };

    const predRemove = (linkId: any) => {
        gantt.deleteLink(linkId);
        gantt.refreshData();
        refreshPredState();
    };

    const predChangeType = (linkId: any, newType: string) => {
        const l: any = gantt.getLink(linkId);
        if (l) {
            l.type = newType;
            gantt.updateLink(linkId);
            gantt.refreshData();
        }
        refreshPredState();
    };

    const filteredTasks = tasks.filter((t) =>
        !search || t.text.toLowerCase().includes(search.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Predecesoras</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                </div>

                <div className="px-5 py-3 border-b border-gray-100">
                    <input
                        type="text"
                        placeholder="Buscar tarea..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                </div>

                <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
                    {filteredTasks.length === 0 && (
                        <p className="px-5 py-8 text-center text-gray-400 text-sm">No se encontraron tareas</p>
                    )}
                    {filteredTasks.map((t) => {
                        const existingLink = links.find((l) => l.source == t.id);
                        const added = !!existingLink;
                        return (
                            <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                                <span className="text-sm text-gray-800 flex-1 min-w-0 truncate">
                                    {t.item && (
                                        <span className="text-gray-400 mr-1.5 text-xs font-mono">{t.item}</span>
                                    )}
                                    {t.text}
                                </span>
                                <select
                                    value={existingLink?.type ?? '0'}
                                    onChange={(e) => {
                                        if (added && existingLink) predChangeType(existingLink.id, e.target.value);
                                    }}
                                    className="text-xs px-2 py-1 border border-gray-300 rounded-md bg-white focus:outline-none flex-shrink-0"
                                >
                                    <option value="0">FC – Fin-Comienzo</option>
                                    <option value="1">CC – Comienzo-Comienzo</option>
                                    <option value="2">FF – Fin-Fin</option>
                                    <option value="3">CF – Comienzo-Fin</option>
                                </select>
                                <button
                                    onClick={() =>
                                        added && existingLink
                                            ? predRemove(existingLink.id)
                                            : predAdd(t.id)
                                    }
                                    className={`text-xs px-3 py-1.5 rounded-md font-semibold text-white transition-colors flex-shrink-0 ${added
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
            </div>
        </div>
    );
};