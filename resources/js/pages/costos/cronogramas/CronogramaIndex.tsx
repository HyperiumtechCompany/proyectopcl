import { Head } from '@inertiajs/react';
import axios from 'axios';
import { gantt } from 'dhtmlx-gantt';
import React, { useEffect, useRef, useState } from 'react';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';
import { PredecessorsModal } from './components/PredecessorsModal';
import { ProjectSettingsModal } from './components/ProjectSettingsModal';
import { markCriticalTasks, updateCountersAndItems, getSubtreeDates, applyAutoScheduling } from './helpers/ganttHelpers';

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
    project: string | number;
    initialData?: any;
    cronogramaId?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────
const LINK_LABELS: Record<string, string> = { '0': 'FC', '1': 'CC', '2': 'FF', '3': 'CF' };
const LINK_NAMES: Record<string, string> = {
    '0': 'Fin-Comienzo',
    '1': 'Comienzo-Comienzo',
    '2': 'Fin-Fin',
    '3': 'Comienzo-Fin',
};

const DEFAULT_DATA = {
    tasks: [
        { id: 1, text: 'Office itinerancy', start_date: '2024-07-22 00:00', duration: 25, progress: 0.6, open: true, cost: 5000 },
        { id: 2, text: 'Office facing', start_date: '2024-07-22 00:00', duration: 20, parent: 1, progress: 0.5, cost: 2500 },
        { id: 3, text: 'Furniture installation', start_date: '2024-07-22 00:00', duration: 5, parent: 1, progress: 0.8, cost: 1000 },
        { id: 4, text: 'Employee relocation', start_date: '2024-07-29 00:00', duration: 15, parent: 1, progress: 0.2, cost: 1200 },
        { id: 5, text: 'Interior office', start_date: '2024-07-29 00:00', duration: 15, parent: 1, progress: 0.3, cost: 3000 },
        { id: 6, text: 'Air conditioners', start_date: '2024-08-19 00:00', duration: 2, parent: 1, progress: 0, cost: 400 },
        { id: 7, text: 'Workplaces preparation', start_date: '2024-08-21 00:00', duration: 2, parent: 1, progress: 0, cost: 600 },
        { id: 8, text: 'Preparing workplaces', start_date: '2024-07-22 00:00', duration: 10, parent: 1, progress: 0.6, cost: 1500 },
        { id: 9, text: 'Workplaces imports', start_date: '2024-08-23 00:00', duration: 1, parent: 1, progress: 0, cost: 2000 },
    ],
    links: [
        { id: 1, source: 3, target: 4, type: '0' },
        { id: 2, source: 3, target: 5, type: '0' },
        { id: 3, source: 8, target: 9, type: '0' },
        { id: 4, source: 2, target: 8, type: '1' },
        { id: 5, source: 6, target: 7, type: '2' },
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
const CronogramaIndex = ({ project, initialData, cronogramaId = 1 }: Props) => {
    const ganttContainer = useRef<HTMLDivElement>(null);
    const isUpdatingRef = useRef(false);
    const criticalOnRef = useRef(true);

    // UI State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [predOpen, setPredOpen] = useState(false);
    const [predTaskId, setPredTaskId] = useState<any>(null);
    const [criticalOn, setCriticalOn] = useState(true);


    const [topUnit, setTopUnit] = useState('month');
    const [bottomUnit, setBottomUnit] = useState('day');
    const [workStartTime, setWorkStartTime] = useState('08:00');
    const [workEndTime, setWorkEndTime] = useState('17:00');
    const [projectStart, setProjectStart] = useState('');
    const [projectEnd, setProjectEnd] = useState('');
    const [scheduleFromEnd, setScheduleFromEnd] = useState(false);
    const [workDays, setWorkDays] = useState({
        lunes: true, martes: true, miercoles: true,
        jueves: true, viernes: true, sabado: false, domingo: false,
    });

    // Función para actualizar fechas padre
    const updateParentDates = (childId: string | number) => {
        const child: any = gantt.getTask(childId);
        if (!child || !child.parent) return;

        const parent: any = gantt.getTask(child.parent);
        const childrenIds: (string | number)[] = gantt.getChildren(parent.id);

        let minStart: Date | null = null;
        let maxEnd: Date | null = null;

        childrenIds.forEach((id) => {
            const t: any = gantt.getTask(id);
            if (!minStart || t.start_date < minStart) minStart = t.start_date;
            if (!maxEnd || t.end_date > maxEnd) maxEnd = t.end_date;
        });

        if (minStart && maxEnd) {
            if (parent.start_date.getTime() !== minStart.getTime() ||
                parent.end_date.getTime() !== maxEnd.getTime()) {
                parent.start_date = minStart;
                parent.end_date = maxEnd;
                gantt.updateTask(parent.id);
                updateParentDates(parent.id);
            }
        }
    };

    // Actualizar costos del padre
    const updateParentCost = (childId: any) => {
        const child: any = gantt.getTask(childId);
        if (!child || !child.parent) return;

        const children = gantt.getChildren(child.parent);
        let total = 0;
        children.forEach((childId: any) => {
            const c = gantt.getTask(childId);
            if (c) total += parseFloat(c.cost) || 0;
        });
        const parent = gantt.getTask(child.parent);
        if (parseFloat(parent.cost || 0) !== total) {
            parent.cost = total;
            gantt.updateTask(parent.id);
        }
    };

    // Actualizar texto de predecesoras
    const updatePredecessorsText = (taskId: string | number) => {
        const task = gantt.getTask(taskId);
        const links = gantt.getLinks().filter(l => String(l.target) === String(taskId));
        const preds = links.map(l => {
            const sourceTask = gantt.getTask(l.source);
            const typeLabel = LINK_LABELS[l.type] || 'FC';
            const taskRef = sourceTask.item || sourceTask.id;
            return `${taskRef}${typeLabel}`;
        });
        task.predecessors = preds.join(', ');
        gantt.updateTask(taskId);
    };

    // Toggle ruta crítica
    const toggleCriticalPath = () => {
        const next = !criticalOnRef.current;
        criticalOnRef.current = next;
        gantt.config.highlight_critical_path = next;
        setCriticalOn(next);
        if (next) markCriticalTasks();
        gantt.render();
    };

    // Guardar cronograma
    const handleSave = async () => {
        const id = Number(cronogramaId);
        const fmt = gantt.date.date_to_str('%Y-%m-%d %H:%i');

        const tasks = gantt.getTaskByTime().map((t: any) => ({
            id: t.id,
            text: t.text,
            start_date: fmt(t.start_date),
            end_date: fmt(t.end_date),
            duration: t.duration,
            parent: t.parent || 0,
            counter: t.counter,
            item: t.item,
            cost: t.cost || 0,
            predecessors: t.predecessors || '',
            progress: t.progress || 0,
        }));

        const links = gantt.getLinks().map((l: any) => ({
            id: l.id,
            source: l.source,
            target: l.target,
            type: l.type,
        }));

        try {
            await axios.post(`/cronograma/save/${id}`, {
                data: JSON.stringify({ tasks, links }),
            });
            alert('✅ ¡Cronograma guardado correctamente!');
        } catch (err: any) {
            console.error('Error al guardar:', err);
            alert(`❌ No se pudo guardar.\n${err?.response?.data?.message || err.message || ''}`);
        }
    };

    // IMPORTAR desde PRESUPUESTOS (automático)
    const handleImport = async () => {
        try {
            const loadingAlert = setTimeout(() => {
                alert('⏳ Cargando datos del presupuesto...');
            }, 100);

            const response = await axios.get(`/presupuesto/${project}/partidas`);
            clearTimeout(loadingAlert);

            const partidas = response.data;

            if (!partidas || partidas.length === 0) {
                alert('❌ No hay partidas en el presupuesto para importar');
                return;
            }

            if (!confirm(`📋 ¿Importar ${partidas.length} partidas como tareas del cronograma?\n\nEsto reemplazará el cronograma actual.`)) {
                return;
            }

            const nuevasTareas = partidas.map((partida: any, index: number) => ({
                id: gantt.uid(),
                text: partida.descripcion || `Partida ${index + 1}`,
                start_date: new Date(),
                duration: partida.plazo_estimado || 5,
                progress: 0,
                cost: parseFloat(partida.total) || 0,
                parent: 0,
                open: true,
            }));

            gantt.clearAll();
            gantt.batchUpdate(() => {
                nuevasTareas.forEach(tarea => {
                    gantt.addTask(tarea);
                });
            });

            updateCountersAndItems();
            markCriticalTasks();
            gantt.render();

            // Reutilizar handleSave para guardar automáticamente
            await handleSave();

            alert(`✅ ¡Importación exitosa!\n\nSe importaron ${nuevasTareas.length} partidas y se guardaron automáticamente.`);

        } catch (error: any) {
            console.error('Error al importar presupuesto:', error);

            if (error.response?.status === 404) {
                alert('❌ No se encontró el presupuesto para este proyecto');
            } else if (error.response?.status === 500) {
                alert('❌ Error en el servidor al obtener el presupuesto');
            } else {
                alert(`❌ Error al importar: ${error.message || 'Desconocido'}`);
            }
        }
    };
    // ─────────────────────────────────────────────────────────────────────────
    // INIT GANTT
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!ganttContainer.current) return;

        ganttContainer.current.innerHTML = '';
        gantt.clearAll();

        // Plugins
        gantt.plugins({
            critical_path: true,
            auto_scheduling: true,
            tooltip: true,
        });

        // Locale
        gantt.i18n.setLocale('es');

        // Configuración básica
        gantt.config.date_format = '%Y-%m-%d %H:%i';
        gantt.config.row_height = 32;
        gantt.config.grid_width = 750;
        gantt.config.work_time = true;
        gantt.config.skip_off_time = true;
        gantt.config.fit_tasks = false;
        gantt.config.min_column_width = 50;
        gantt.config.scale_height = 50;
        gantt.config.highlight_critical_path = true;
        gantt.config.auto_scheduling = true;
        gantt.config.auto_scheduling_strict = false;
        gantt.config.auto_scheduling_compatibility = true;
        gantt.config.schedule_from_end = false;
        gantt.config.open_tree_initially = true;
        gantt.config.show_chart_work_time = true;
        gantt.config.split_tasks = true;

        // Días no laborables
        gantt.setWorkTime({ day: 6, hours: false });
        gantt.setWorkTime({ day: 0, hours: false });


        // Escalas
        gantt.config.scales = [
            { unit: 'month', step: 1, format: '%F, %Y' },
            { unit: 'day', step: 1, format: '%j %D' },
        ];

        gantt.config.links = {
            finish_to_start: '0',
            start_to_start: '1',
            finish_to_finish: '2',
            start_to_finish: '3',
        };

        // Templates
        gantt.templates.task_class = (_s: Date, _e: Date, task: any) => {
            if (!criticalOnRef.current) return '';
            try {
                if (typeof gantt.isCriticalTask === 'function') {
                    return gantt.isCriticalTask(task) ? 'gantt_critical_task' : '';
                }
            } catch (_) { }
            return task._critical ? 'gantt_critical_task' : '';
        };

        gantt.templates.link_class = (link: any) => {
            if (!criticalOnRef.current) return '';
            try {
                const s: any = gantt.getTask(link.source);
                const t: any = gantt.getTask(link.target);
                const sCrit = typeof gantt.isCriticalTask === 'function'
                    ? gantt.isCriticalTask(s) : s?._critical;
                const tCrit = typeof gantt.isCriticalTask === 'function'
                    ? gantt.isCriticalTask(t) : t?._critical;
                return sCrit && tCrit ? 'gantt_critical_link' : '';
            } catch { return ''; }
        };

        gantt.templates.link_description = (link: any) => {
            try {
                return `${gantt.getTask(link.source).text} (${LINK_NAMES[link.type]}) → ${gantt.getTask(link.target).text}`;
            } catch { return ''; }
        };

        gantt.templates.tooltip_text = (start: Date, end: Date, task: any) => {
            const isCrit = (() => {
                try {
                    if (typeof gantt.isCriticalTask === 'function') return gantt.isCriticalTask(task);
                } catch (_) { }
                return task._critical || false;
            })();

            let html =
                `<b>Tarea:</b> ${task.text}<br/>` +
                `<b>Duración:</b> ${task.duration} días<br/>` +
                `<b>Inicio:</b> ${gantt.templates.tooltip_date_format(start)}<br/>` +
                `<b>Fin:</b> ${gantt.templates.tooltip_date_format(end)}`;
            if (task.cost) html += `<br/><b>Costo:</b> S/. ${task.cost}`;
            if (isCrit) html += `<br/><span style="color:#f87171;font-weight:bold;">⚠ Ruta Crítica</span>`;

            try {
                const preds: any[] = gantt.getLinks().filter((l: any) => l.target == task.id);
                if (preds.length) {
                    const labels = preds.map((l) => {
                        const src: any = gantt.getTask(l.source);
                        return `${src.item || src.id}${LINK_LABELS[l.type]}`;
                    });
                    html += `<br/><b>Predecesoras:</b> ${labels.join(', ')}`;
                }
            } catch (_) { }
            return html;
        };

        gantt.templates.scale_cell_class = (date: Date) =>
            !gantt.isWorkTime(date) ? 'columna-no-laborable' : '';
        gantt.templates.timeline_cell_class = (_t: any, date: Date) =>
            !gantt.isWorkTime(date) ? 'columna-no-laborable' : '';

        gantt.templates.task_text = function (start, end, task: any) {
            if (gantt.hasChild(task.id)) {
                return `
                    <div style="width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center;">
                        <div style="position: absolute; width: 100%; height: 2px; background: #000; top: 0; left: 0;"></div>
                        <div style="position: absolute; width: 2px; height: 10px; background: #000; top: 0; left: 0;"></div>
                        <div style="position: absolute; width: 2px; height: 10px; background: #000; top: 0; right: 0;"></div>
                        <span style="color: #fff; font-weight: bold; position: relative; z-index: 1; font-size: 12px;">
                            ${task.text}
                        </span>
                    </div>
                `;
            }
            return `
                <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; overflow: visible;">
                    <span style="color: #fff; font-weight: 500; white-space: nowrap; pointer-events: none;">
                        ${task.text}
                    </span>
                </div>
            `;
        };

        // Columnas
        gantt.config.columns = [
            {
                name: 'number', label: '#', width: 40, align: 'center',
                template: (task: any) => gantt.getGlobalTaskIndex(task.id) + 1,
            },
            {
                name: 'wbs', label: 'ITEM', width: 60,
                template: (task: any) => {
                    try { return (gantt as any).getWBSCode(task); }
                    catch { return task.item || ''; }
                },
            },
            { name: 'text', label: 'NOMBRE', tree: true, width: 200, editor: { type: 'text', map_to: 'text' } },
            {
                name: 'duration', label: 'DURACIÓN', align: 'center', width: 70, editor: { type: 'number', map_to: 'duration', min: 0, max: 1000 },
                template: (t: any) => `${t.duration} d`,
            },
            {
                name: 'cost', label: 'COSTOS', align: 'right', width: 100, editor: { type: 'text', map_to: 'cost' },
                template: (t: any) => {
                    const valor = parseFloat(t.cost);
                    if (isNaN(valor)) return 'S/. 0.00';
                    return `S/. ${valor.toFixed(2)}`;
                }
            },
            { name: 'start_date', label: 'INICIO', align: 'center', width: 90, editor: { type: 'date', map_to: 'start_date' } },
            {
                name: 'end_date', label: 'FIN', align: 'center', width: 90, editor: { type: 'date', map_to: 'end_date' },
                template: (task: any) => gantt.templates.date_grid(task.end_date, task),
            },
            {
                name: 'predecessors', label: 'PREDECESORAS', align: 'center', width: 110,
                template: (task: any) => {
                    const links: any[] = gantt.getLinks().filter((l: any) => l.target == task.id);
                    const labels = links.map((l) => {
                        try {
                            const src: any = gantt.getTask(l.source);
                            let wbs = src.item || String(l.source);
                            try { wbs = (gantt as any).getWBSCode(src); } catch { }
                            return `${wbs}${LINK_LABELS[l.type] || ''}`;
                        } catch { return ''; }
                    }).filter(Boolean);

                    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:0 4px;width:100%;">
                        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;">${labels.join(', ')}</span>
                        <button onclick="event.stopPropagation();window.__openPredModal(${task.id})"
                            style="background:none;border:none;cursor:pointer;font-size:14px;padding:0 2px;flex-shrink:0;line-height:1;">🔗</button>
                    </div>`;
                },
            },
            { name: 'add', width: 44 },
        ];

        // Lightbox
        gantt.config.lightbox.sections = [
            { name: 'description', height: 38, map_to: 'text', type: 'textarea', focus: true },
            { name: 'time', type: 'duration', map_to: 'auto', time_format: ['%d', '%m', '%Y'] },
            { name: 'cost', height: 22, map_to: 'cost', type: 'text', default_value: '0' },
        ];
        gantt.locale.labels.section_cost = 'Costo (S/.)';

        // Eventos
        gantt.attachEvent('onTaskLoading', (task: any) => {
            if (gantt.hasChild(task.id)) {
                task.type = gantt.config.types.project;
                task.unscheduled = true;
            }
            if (!gantt.hasChild(task.id)) {
                task.render = "split";
            }
            return true;
        });

        gantt.attachEvent('onAfterTaskUpdate', (id: any, item: any) => {
            if (isUpdatingRef.current) return true;
            isUpdatingRef.current = true;
            try {
                const dates = getSubtreeDates(id);
                if (dates) {
                    const t: any = gantt.getTask(id);
                    t.start_date = dates.start_date;
                    t.end_date = dates.end_date;
                }
                if (item.parent && gantt.isTaskExists(item.parent)) {
                    updateParentCost(id);
                }
            } finally {
                isUpdatingRef.current = false;
                gantt.render();
            }
            return true;
        });

        gantt.attachEvent('onAfterTaskAdd', (id: any, task: any) => {
            if (!task.cost) { task.cost = 0; gantt.updateTask(id); }
            updateCountersAndItems();
            applyAutoScheduling();
            markCriticalTasks();
            gantt.render();
            gantt.showTask(id);
        });

        gantt.attachEvent('onAfterTaskDelete', () => {
            updateCountersAndItems();
            applyAutoScheduling();
            markCriticalTasks();
            gantt.render();
        });

        gantt.attachEvent('onAfterTaskMove', () => {
            updateCountersAndItems();
            applyAutoScheduling();
            markCriticalTasks();
            gantt.render();
        });

        gantt.attachEvent('onAfterLinkAdd', (id: any, link: any) => {
            try {
                const target: any = gantt.getTask(link.target);
                const source: any = gantt.getTask(link.source);
                target.predecessors =
                    (target.predecessors ? target.predecessors + ', ' : '') +
                    `${source.item || source.id} (${LINK_LABELS[link.type]})`;
                gantt.updateTask(target.id);
            } catch (_) { }
            applyAutoScheduling();
            markCriticalTasks();
            gantt.render();
        });

        gantt.attachEvent('onAfterLinkDelete', (id: any, link: any) => {
            try {
                const target: any = gantt.getTask(link.target);
                target.predecessors = gantt.getLinks()
                    .filter((l: any) => l.target === target.id)
                    .map((l: any) => {
                        const src: any = gantt.getTask(l.source);
                        return `${src.item || src.id} (${LINK_LABELS[l.type]})`;
                    }).join(', ');
                gantt.updateTask(target.id);
            } catch (_) { }
            applyAutoScheduling();
            markCriticalTasks();
            gantt.render();
        });

        gantt.attachEvent('onAfterAutoSchedule', () => {
            markCriticalTasks();
            gantt.eachTask((task: any) => {
                if (!gantt.hasChild(task.id)) {
                    task.duration = gantt.calculateDuration({
                        start_date: task.start_date,
                        end_date: task.end_date,
                        task: task,
                    });
                    gantt.updateTask(task.id);
                }
            });
        });

        gantt.eachTask((task: any) => {
            if (!gantt.hasChild(task.id)) {
                task.render = "split";
                gantt.updateTask(task.id);
            }
        });
        gantt.render();

        gantt.attachEvent('onTaskCreated', (task) => {
            const fechaInicioAjuste = new Date(2026, 3, 1);
            task.start_date = fechaInicioAjuste;
            task.end_date = gantt.date.add(fechaInicioAjuste, 1, "day");
            return true;
        });

        gantt.config.limit_view = true;

        // Inicializar
        gantt.init(ganttContainer.current);

        const raw = initialData
            ? (typeof initialData === 'string' ? JSON.parse(initialData) : initialData)
            : DEFAULT_DATA;

        gantt.batchUpdate(() => {
            gantt.parse(raw);
            gantt.eachTask((task: any) => { task.$open = true; });
        });

        updateCountersAndItems();
        markCriticalTasks();
        setTimeout(() => gantt.render(), 50);

        return () => { gantt.clearAll(); };
    }, [initialData]);

    // Exponer función global para abrir modal
    useEffect(() => {
        (window as any).__openPredModal = (taskId: any) => {
            setPredTaskId(taskId);
            setPredOpen(true);
        };
        return () => { delete (window as any).__openPredModal; };
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-screen bg-white">
            <Head title="Cronograma" />

            {/* Toolbar */}
            <div className="bg-[#1e293b] px-4 py-2.5 flex items-center justify-between z-20 flex-shrink-0">
                <h1 className="text-white font-bold text-xs uppercase tracking-wider">
                    PROYECTO: {project}
                </h1>

                <div className="flex gap-2 items-center">
                    {/* ========== IMPORTAR ========== */}
                    <button
                        onClick={handleImport}
                        className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Importar
                    </button>

                    {/* ========== AJUSTES PROYECTO ========== */}
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="flex items-center gap-1.5 bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Ajustes Proyecto
                    </button>

                    {/* ========== RUTA CRÍTICA ========== */}
                    <button
                        onClick={toggleCriticalPath}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors text-white ${criticalOn ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-600 hover:bg-slate-500'
                            }`}
                    >
                        <span className={`w-2 h-2 rounded-full border-2 ${criticalOn ? 'bg-white border-white' : 'bg-transparent border-red-400'}`} />
                        Ruta Crítica
                    </button>

                    {/* ========== GUARDAR CRONOGRAMA ========== */}
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Guardar Cronograma
                    </button>
                </div>
            </div>

            {/* Gantt */}
            <div className="flex-1 relative overflow-hidden">
                <div ref={ganttContainer} className="w-full h-full" />
            </div>

            {/* Modales */}
            <PredecessorsModal
                isOpen={predOpen}
                taskId={predTaskId}
                onClose={() => setPredOpen(false)}
            />

            <ProjectSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                onApply={(settings) => {
                    // Actualizar los estados locales
                    setTopUnit(settings.topUnit);
                    setBottomUnit(settings.bottomUnit);
                    setWorkStartTime(settings.workStartTime);
                    setWorkEndTime(settings.workEndTime);
                    setProjectStart(settings.projectStart);
                    setProjectEnd(settings.projectEnd);
                    setScheduleFromEnd(settings.scheduleFromEnd);
                    setWorkDays(settings.workDays);
                }}
            />

            {/* CSS */}
            <style>{`
                .gantt_task_line.gantt_project { visibility: hidden !important; }
                .gantt_grid_head_cell { font-weight: 700; font-size: 11px; text-transform: uppercase; color: #475569; }
                .gantt_task_line { border-radius: 4px; border: 1px solid #1e40af; background-color: #3b82f6; }
                .gantt_task_progress { background-color: #1d4ed8; opacity: 0.4; }
                .gantt_critical_task { background-color: #ef4444 !important; border-color: #dc2626 !important; }
                .gantt_critical_task .gantt_task_progress { background-color: #b91c1c !important; }
                .gantt_critical_link .gantt_line_wrapper div { background-color: #ef4444 !important; }
                .gantt_critical_link .gantt_link_arrow { border-color: #ef4444 !important; }
                .gantt_grid_editor_placeholder input {
                    box-sizing: border-box; width: 100%; height: 100%;
                    border: 1px solid #10b981 !important;
                    padding: 0 5px; font-size: 12px; outline: none; background: #fff;
                }
               .columna-no-laborable {
    background-color: #e5e7eb !important;
    background-image: repeating-linear-gradient(
        45deg,
        rgba(0,0,0,0.05) 0px,
        rgba(0,0,0,0.05) 2px,
        transparent 2px,
        transparent 8px
    ) !important;
}
                .gantt_task_content { color: #fff; font-weight: 600; font-size: 11px; }
                .gantt_tooltip {
                    background: #1e293b !important; color: #fff !important;
                    border: none !important; border-radius: 8px !important;
                    padding: 10px 14px !important; font-size: 12px !important;
                    line-height: 1.7 !important; box-shadow: 0 4px 20px rgba(0,0,0,0.4) !important;
                }
                .gantt_parent_task {
                    background-color: #3db9d3 !important;
                    border: 1px solid #2d96ad !important;
                }
                .gantt_task_line.gantt_split_parent {
                    background-color: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                }
                .gantt_split_child {
                    background-color: #3db9d3 !important;
                    border: 1px solid #2d96ad !important;
                    border-radius: 4px;
                    height: 24px !important;
                    top: 3px !important;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white !important;
                }
                .gantt_critical_task.gantt_split_parent {
                    background-color: rgba(255, 77, 77, 0.1) !important;
                    border-right: 5px solid #ff4d4d !important;
                }
                .gantt_critical_task.gantt_split_parent .gantt_split_child {
                    background-color: #ff4d4d !important;
                    border: 1px solid #d43f3f !important;
                }
            `}</style>
        </div>
    );
};

export default CronogramaIndex;