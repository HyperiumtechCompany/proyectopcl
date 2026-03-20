import React, { useEffect, useRef, useState } from 'react';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
    project: string | number;   // puede ser ID numérico o nombre
    initialData?: any;
    cronogramaId?: number;
}

interface PredTask {
    id: any;
    text: string;
    item?: string;
}

interface GLink {
    id: any;
    source: any;
    target: any;
    type: string;
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
        { id: 1, text: 'Office itinerancy',     start_date: '2024-07-22 00:00', duration: 25, progress: 0.6, open: true, cost: 5000 },
        { id: 2, text: 'Office facing',          start_date: '2024-07-22 00:00', duration: 20, parent: 1,    progress: 0.5, cost: 2500 },
        { id: 3, text: 'Furniture installation', start_date: '2024-07-22 00:00', duration: 5,  parent: 1,    progress: 0.8, cost: 1000 },
        { id: 4, text: 'Employee relocation',    start_date: '2024-07-29 00:00', duration: 15, parent: 1,    progress: 0.2, cost: 1200 },
        { id: 5, text: 'Interior office',        start_date: '2024-07-29 00:00', duration: 15, parent: 1,    progress: 0.3, cost: 3000 },
        { id: 6, text: 'Air conditioners',       start_date: '2024-08-19 00:00', duration: 2,  parent: 1,    progress: 0,   cost: 400  },
        { id: 7, text: 'Workplaces preparation', start_date: '2024-08-21 00:00', duration: 2,  parent: 1,    progress: 0,   cost: 600  },
        { id: 8, text: 'Preparing workplaces',   start_date: '2024-07-22 00:00', duration: 10, parent: 1,    progress: 0.6, cost: 1500 },
        { id: 9, text: 'Workplaces imports',     start_date: '2024-08-23 00:00', duration: 1,  parent: 1,    progress: 0,   cost: 2000 },
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
// HELPER: marcar tareas críticas manualmente
// La ruta crítica = cadena de tareas donde cualquier retraso retrasa el proyecto.
// Buscamos la fecha de fin más tardía y marcamos las tareas que llegan a ella
// a través de dependencias continuas (sin holgura).
// ─────────────────────────────────────────────────────────────────────────────
function markCriticalTasks() {
    // Intentar usar el método nativo primero (disponible en versiones PRO)
    try {
        if (typeof gantt.isCriticalTask === 'function') {
            gantt.eachTask((task: any) => {
                task._critical = gantt.isCriticalTask(task);
            });
            return;
        }
    } catch (_) {}

    // Fallback manual: encontrar la fecha de fin máxima del proyecto
    let maxEnd: Date | null = null;
    gantt.eachTask((task: any) => {
        if (!gantt.hasChild(task.id) && task.end_date) {
            const d = new Date(task.end_date);
            if (!maxEnd || d > maxEnd) maxEnd = d;
        }
    });

    if (!maxEnd) return;

    // Conjunto de IDs en la ruta crítica
    const criticalIds = new Set<any>();

    // Recorremos hacia atrás desde las tareas finales
    function traceBack(taskId: any) {
        if (criticalIds.has(taskId)) return;
        criticalIds.add(taskId);
        // Buscar predecesoras directas
        gantt.getLinks().forEach((link: any) => {
            if (link.target == taskId) {
                traceBack(link.source);
            }
        });
    }

    // Iniciar desde tareas que terminan en la fecha máxima (con tolerancia de 1 día)
    gantt.eachTask((task: any) => {
        if (!gantt.hasChild(task.id) && task.end_date) {
            const d = new Date(task.end_date);
            const diff = Math.abs(d.getTime() - (maxEnd as Date).getTime());
            if (diff <= 86400000) { // 1 día de tolerancia
                traceBack(task.id);
            }
        }
    });

    // Aplicar el flag _critical
    gantt.eachTask((task: any) => {
        task._critical = criticalIds.has(task.id);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
const CronogramaIndex = ({ project, initialData, cronogramaId = 1 }: Props) => {
    const ganttContainer = useRef<HTMLDivElement>(null);
    const isUpdatingRef  = useRef(false);
    const criticalOnRef  = useRef(true); // ref para acceder desde templates

    // UI State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [topUnit,        setTopUnit]        = useState('month');
    const [bottomUnit,     setBottomUnit]     = useState('day');
    const [workStartTime,  setWorkStartTime]  = useState('08:00');
    const [workEndTime,    setWorkEndTime]    = useState('17:00');
    const [workDays, setWorkDays] = useState({
        lunes: true, martes: true, miercoles: true,
        jueves: true, viernes: true, sabado: false, domingo: false,
    });

    // Predecesoras modal
    const [predOpen,   setPredOpen]   = useState(false);
    const [predTaskId, setPredTaskId] = useState<any>(null);
    const [predSearch, setPredSearch] = useState('');
    const [predTasks,  setPredTasks]  = useState<PredTask[]>([]);
    const [predLinks,  setPredLinks]  = useState<GLink[]>([]);

    // Ruta crítica toggle (UI)
    const [criticalOn, setCriticalOn] = useState(true);

    // ─────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────

    /** Rango de fechas de una tarea y todos sus hijos */
    function getSubtreeDates(taskId: any) {
        let task: any;
        try { task = gantt.getTask(taskId); } catch { return null; }
        if (!task?.start_date || !task?.end_date) return null;

        let earliest = new Date(task.start_date);
        let latest   = new Date(task.end_date);
        const seen   = new Set<any>();

        function walk(id: any) {
            if (seen.has(id)) return;
            seen.add(id);
            (gantt.getChildren(id) || []).forEach((cid: any) => {
                let c: any; try { c = gantt.getTask(cid); } catch { return; }
                if (!c?.start_date || !c?.end_date) return;
                if (new Date(c.start_date) < earliest) earliest = new Date(c.start_date);
                if (new Date(c.end_date)   > latest)   latest   = new Date(c.end_date);
                if (gantt.hasChild(cid)) walk(cid);
            });
        }
        if (gantt.hasChild(taskId)) walk(taskId);
        return { start_date: earliest, end_date: latest };
    }

    /** Renumera contadores e ítems jerárquicos */
    function updateCountersAndItems() {
        let counter = 1;
        function walk(parentId: any, parentItem: string | null) {
            let ci = 1;
            gantt.getChildren(parentId).forEach((id: any) => {
                const t: any = gantt.getTask(id);
                t.counter    = counter++;
                t.item       = parentItem
                    ? `${parentItem}.${String(ci).padStart(2, '0')}`
                    : String(ci).padStart(2, '0');
                ci++;
                gantt.updateTask(t.id);
                if (gantt.hasChild(t.id)) walk(t.id, t.item);
            });
        }
        walk(0, null);
        gantt.render();
    }

    /** Auto-scheduling seguro */
    function applyAutoScheduling() {
        try {
            if (gantt.getTaskByTime().length > 0) {
                const projectStart = gantt.getState().min_date;
                gantt.batchUpdate(() => {
                    gantt.eachTask((task: any) => {
                        if (!task.parent) {
                            const linked = gantt.getLinks().some((l: any) => l.target === task.id);
                            if (!linked && task.start_date < projectStart) {
                                task.start_date = projectStart;
                                gantt.updateTask(task.id);
                            }
                        }
                    });
                });
            }
            gantt.autoSchedule();
        } catch (e) { console.warn('autoSchedule:', e); }
    }

    /** Refresca estado del modal de predecesoras */
    function refreshPredState(taskId: any) {
        const links: GLink[] = gantt.getLinks().filter((l: any) => l.target == taskId);
        const tasks: PredTask[] = [];
        gantt.eachTask((t: any) => {
            if (t.id != taskId) tasks.push({ id: t.id, text: t.text, item: t.item });
        });
        setPredLinks(links);
        setPredTasks(tasks);
    }

    // ─────────────────────────────────────────────────────────────────────
    // INIT GANTT
    // ─────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!ganttContainer.current) return;

        ganttContainer.current.innerHTML = '';
        gantt.clearAll();

        // ── 1. PLUGINS (siempre primero) ──────────────────────────────
        gantt.plugins({
            critical_path:   true,
            auto_scheduling: true,
            tooltip:         true,
        });

        // ── 2. LOCALE ──────────────────────────────────────────────────
        gantt.i18n.setLocale('es');

        // ── 3. CONFIG ──────────────────────────────────────────────────
        gantt.config.date_format                   = '%Y-%m-%d %H:%i';
        gantt.config.row_height                    = 32;
        gantt.config.grid_width                    = 750;
        gantt.config.work_time                     = true;
        gantt.config.fit_tasks                     = true;
        gantt.config.min_column_width              = 50;
        gantt.config.scale_height                  = 50;
        gantt.config.highlight_critical_path       = true;  // activa el plugin
        gantt.config.auto_scheduling               = true;
        gantt.config.auto_scheduling_strict        = false;
        gantt.config.auto_scheduling_compatibility = true;
        gantt.config.schedule_from_end             = false;
        gantt.config.open_tree_initially           = true;
        gantt.config.links = {
            finish_to_start:  '0',
            start_to_start:   '1',
            finish_to_finish: '2',
            start_to_finish:  '3',
        };

        // ── 4. ESCALAS DE TIEMPO ───────────────────────────────────────
        gantt.config.scales = [
            { unit: 'month', step: 1, format: '%F, %Y' },
            { unit: 'day',   step: 1, format: '%j %D'  },
        ];

        // ── 5. EDITORES INLINE ─────────────────────────────────────────
        const textEditor     = { type: 'text',   map_to: 'text'       };
        const dateEditor     = { type: 'date',   map_to: 'start_date' };
        const endDateEditor  = { type: 'date',   map_to: 'end_date'   };
        const durationEditor = { type: 'number', map_to: 'duration', min: 0, max: 1000 };
        const costEditor     = { type: 'text',   map_to: 'cost'       };

        // ── 6. COLUMNAS ────────────────────────────────────────────────
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
            { name: 'text',       label: 'NOMBRE',   tree: true, width: 200, editor: textEditor },
            {
                name: 'duration', label: 'DURACIÓN',  align: 'center', width: 70, editor: durationEditor,
                template: (t: any) => `${t.duration} d`,
            },
            {
                name: 'cost',     label: 'COSTOS',    align: 'right',  width: 100, editor: costEditor,
                template: (t: any) => t.cost ? `S/. ${parseFloat(t.cost).toFixed(2)}` : 'S/. 0.00',
            },
            { name: 'start_date', label: 'INICIO',   align: 'center', width: 90, editor: dateEditor },
            {
                name: 'end_date', label: 'FIN',       align: 'center', width: 90, editor: endDateEditor,
                template: (task: any) => gantt.templates.date_grid(task.end_date, task),
            },
            {
                // Columna predecesoras: muestra los vínculos y el botón 🔗
                name: 'predecessors', label: 'PREDECESORAS', align: 'center', width: 110,
                template: (task: any) => {
                    const links: GLink[] = gantt.getLinks().filter((l: any) => l.target == task.id);
                    const labels = links.map((l) => {
                        try {
                            const src: any = gantt.getTask(l.source);
                            let wbs = src.item || String(l.source);
                            try { wbs = (gantt as any).getWBSCode(src); } catch { /* usa item */ }
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

        // ── 7. LIGHTBOX ────────────────────────────────────────────────
        gantt.config.lightbox.sections = [
            { name: 'description', height: 38, map_to: 'text', type: 'textarea', focus: true },
            { name: 'time', type: 'duration', map_to: 'auto', time_format: ['%d', '%m', '%Y'] },
            { name: 'cost', height: 22, map_to: 'cost', type: 'textarea', default_value: '0' },
        ];
        gantt.locale.labels.section_cost = 'Costo (S/.)';

        // ── 8. TEMPLATES ───────────────────────────────────────────────

        // task_class: aplica 'gantt_critical_task' si la tarea está en ruta crítica
        // Primero intenta el método nativo, luego usa el flag manual _critical
        gantt.templates.task_class = (_s: Date, _e: Date, task: any) => {
            if (!criticalOnRef.current) return '';
            try {
                // Método nativo (PRO)
                if (typeof gantt.isCriticalTask === 'function') {
                    return gantt.isCriticalTask(task) ? 'gantt_critical_task' : '';
                }
            } catch (_) {}
            // Fallback: flag manual
            return task._critical ? 'gantt_critical_task' : '';
        };

        // link_class: pinta las flechas de rojo si unen tareas críticas
        gantt.templates.link_class = (link: any) => {
            if (!criticalOnRef.current) return '';
            try {
                const s: any = gantt.getTask(link.source);
                const t: any = gantt.getTask(link.target);
                const sCrit  = typeof gantt.isCriticalTask === 'function'
                    ? gantt.isCriticalTask(s) : s?._critical;
                const tCrit  = typeof gantt.isCriticalTask === 'function'
                    ? gantt.isCriticalTask(t) : t?._critical;
                return sCrit && tCrit ? 'gantt_critical_link' : '';
            } catch { return ''; }
        };

        // Descripción del enlace
        gantt.templates.link_description = (link: any) => {
            try {
                return `${gantt.getTask(link.source).text} (${LINK_NAMES[link.type]}) → ${gantt.getTask(link.target).text}`;
            } catch { return ''; }
        };

        // Tooltip enriquecido
        gantt.templates.tooltip_text = (start: Date, end: Date, task: any) => {
            const isCrit = (() => {
                try {
                    if (typeof gantt.isCriticalTask === 'function') return gantt.isCriticalTask(task);
                } catch (_) {}
                return task._critical || false;
            })();

            let html =
                `<b>Tarea:</b> ${task.text}<br/>` +
                `<b>Duración:</b> ${task.duration} días<br/>` +
                `<b>Inicio:</b> ${gantt.templates.tooltip_date_format(start)}<br/>` +
                `<b>Fin:</b> ${gantt.templates.tooltip_date_format(end)}`;
            if (task.cost)  html += `<br/><b>Costo:</b> S/. ${task.cost}`;
            if (isCrit)     html += `<br/><span style="color:#f87171;font-weight:bold;">⚠ Ruta Crítica</span>`;

            try {
                const preds: GLink[] = gantt.getLinks().filter((l: any) => l.target == task.id);
                if (preds.length) {
                    const labels = preds.map((l) => {
                        const src: any = gantt.getTask(l.source);
                        return `${src.item || src.id}${LINK_LABELS[l.type]}`;
                    });
                    html += `<br/><b>Predecesoras:</b> ${labels.join(', ')}`;
                }
            } catch (_) {}
            return html;
        };

        // Días no laborables en gris
        gantt.templates.scale_cell_class    = (date: Date) =>
            !gantt.isWorkTime(date) ? 'columna-no-laborable' : '';
        gantt.templates.timeline_cell_class = (_t: any, date: Date) =>
            !gantt.isWorkTime(date) ? 'columna-no-laborable' : '';

        // ── 9. EVENTOS ─────────────────────────────────────────────────

        // Marcar tareas padre para ocultar su barra estándar
        gantt.attachEvent('onTaskLoading', (task: any) => {
            if (gantt.hasChild(task.id)) {
                task.type        = gantt.config.types.project;
                task.unscheduled = true;
            }
            return true;
        });

        // Actualizar fechas de tarea padre cuando cambia un hijo
        gantt.attachEvent('onAfterTaskUpdate', (id: any) => {
            if (isUpdatingRef.current) return true;
            isUpdatingRef.current = true;
            try {
                const dates = getSubtreeDates(id);
                if (dates) {
                    const t: any = gantt.getTask(id);
                    t.start_date = dates.start_date;
                    t.end_date   = dates.end_date;
                    gantt.updateTask(id);
                }
            } finally { isUpdatingRef.current = false; }
            return true;
        });

        gantt.attachEvent('onAfterTaskAdd', (id: any, task: any) => {
            if (!task.cost) { task.cost = 0; gantt.updateTask(id); }
            updateCountersAndItems();
            applyAutoScheduling();
            markCriticalTasks();
            gantt.render();
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

        // Cuando se añade un enlace: actualizar predecesoras + re-marcar crítica
        gantt.attachEvent('onAfterLinkAdd', (id: any, link: any) => {
            try {
                const target: any = gantt.getTask(link.target);
                const source: any = gantt.getTask(link.source);
                target.predecessors =
                    (target.predecessors ? target.predecessors + ', ' : '') +
                    `${source.item || source.id} (${LINK_LABELS[link.type]})`;
                gantt.updateTask(target.id);
            } catch (_) {}
            applyAutoScheduling();
            markCriticalTasks();
            gantt.render();
        });

        // Cuando se elimina un enlace: reconstruir campo predecesoras + re-marcar crítica
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
            } catch (_) {}
            applyAutoScheduling();
            markCriticalTasks();
            gantt.render();
        });

        // Evitar split tasks muy cortos
        gantt.attachEvent('onBeforeSplitTaskDisplay', (_id: any, task: any) => task.duration >= 3);

        // Recalcular ruta crítica después de auto-scheduling
        gantt.attachEvent('onAfterAutoSchedule', () => {
            markCriticalTasks();
        });

        // ── 10. INIT ───────────────────────────────────────────────────
        gantt.init(ganttContainer.current);

        // ── 11. CARGA DE DATOS ─────────────────────────────────────────
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData]);

    // Exponer abridor del modal al DOM (onclick inline en template de columna)
    useEffect(() => {
        (window as any).__openPredModal = (taskId: any) => {
            const links: GLink[] = gantt.getLinks().filter((l: any) => l.target == taskId);
            const tasks: PredTask[] = [];
            gantt.eachTask((t: any) => {
                if (t.id != taskId) tasks.push({ id: t.id, text: t.text, item: t.item });
            });
            setPredTasks(tasks);
            setPredLinks(links);
            setPredTaskId(taskId);
            setPredSearch('');
            setPredOpen(true);
        };
        return () => { delete (window as any).__openPredModal; };
    }, []);

    // ─────────────────────────────────────────────────────────────────────
    // ACCIONES
    // ─────────────────────────────────────────────────────────────────────

    /** Toggle ruta crítica */
    const toggleCriticalPath = () => {
        const next = !criticalOnRef.current;
        criticalOnRef.current            = next;
        gantt.config.highlight_critical_path = next;
        setCriticalOn(next);
        if (next) markCriticalTasks();
        gantt.render();
    };

    /** Guardar cronograma — usa el cronogramaId como número limpio */
    const handleSave = async () => {
        const id  = Number(cronogramaId); // garantiza que sea número, no "1:1"
        const fmt = gantt.date.date_to_str('%Y-%m-%d %H:%i');

        const tasks = gantt.getTaskByTime().map((t: any) => ({
            id: t.id,
            text: t.text,
            start_date: fmt(t.start_date),
            end_date:   fmt(t.end_date),
            duration:   t.duration,
            parent:     t.parent || 0,
            counter:    t.counter,
            item:       t.item,
            cost:       t.cost || 0,
            predecessors: t.predecessors || '',
            progress:   t.progress || 0,
        }));

        const links = gantt.getLinks().map((l: any) => ({
            id:     l.id,
            source: l.source,
            target: l.target,
            type:   l.type,
        }));

        try {
            await axios.post(`/guardar-cronograma/${id}`, {
                datacronograma: JSON.stringify({ tasks, links }),
            });
            alert('✅ ¡Cronograma guardado correctamente!');
        } catch (err: any) {
            console.error('Error al guardar:', err);
            alert(`❌ No se pudo guardar.\n${err?.response?.data?.message || err.message || ''}`);
        }
    };

    /** Aplicar ajustes del modal de configuración */
    const aplicarAjustes = () => {
    gantt.config.scales = [
        { unit: topUnit    as any, step: 1, format: topUnit    === 'year' ? '%Y'    : '%F, %Y' },
        { unit: bottomUnit as any, step: 1, format: bottomUnit === 'day'  ? '%j %D' : 'Sem %W' },
    ];

    // ── Días laborables ──────────────────────────────────────
    const dayMap: Record<string, number> = {
        domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
    };

    // Primero resetear TODOS los días a no laborable
    for (let i = 0; i <= 6; i++) {
        gantt.setWorkTime({ day: i, hours: false });
    }

    // Luego activar solo los marcados con el rango correcto
    Object.entries(workDays).forEach(([name, active]) => {
        if (active) {
            gantt.setWorkTime({
                day: dayMap[name],
                hours: [`${workStartTime}-${workEndTime}`],  // ← formato correcto: "08:00-17:00"
            });
        }
    });

    gantt.config.skip_off_time = false; // mostrar días no laborables en gris (no ocultarlos)
    gantt.render();
    setIsSettingsOpen(false);
};

    // ── Predecesoras modal ────────────────────────────────────────────────
    const predAdd = (sourceId: any, type = '0') => {
        gantt.addLink({ id: gantt.uid(), source: sourceId, target: predTaskId, type });
        gantt.refreshData();
        markCriticalTasks();
        gantt.render();
        refreshPredState(predTaskId);
    };

    const predRemove = (linkId: any) => {
        gantt.deleteLink(linkId);
        gantt.refreshData();
        markCriticalTasks();
        gantt.render();
        refreshPredState(predTaskId);
    };

    const predChangeType = (linkId: any, newType: string) => {
        const l: any = gantt.getLink(linkId);
        if (l) { l.type = newType; gantt.updateLink(linkId); gantt.refreshData(); }
        markCriticalTasks();
        gantt.render();
        refreshPredState(predTaskId);
    };

    // ─────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────
    const filteredPredTasks = predTasks.filter((t) =>
        !predSearch || t.text.toLowerCase().includes(predSearch.toLowerCase())
    );

    return (
        <div className="flex flex-col h-screen bg-white">
            <Head title="Cronograma" />

            {/* ── TOOLBAR ─────────────────────────────────────────────── */}
            <div className="bg-[#1e293b] px-4 py-2.5 flex items-center justify-between z-20 flex-shrink-0">
                <h1 className="text-white font-bold text-xs uppercase tracking-wider">
                    PROYECTO: {project}
                </h1>

                <div className="flex gap-2 items-center">

                    {/* Ajustes Proyecto */}
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

                    {/* Ruta Crítica */}
                    <button
                        onClick={toggleCriticalPath}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors text-white ${
                            criticalOn ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-600 hover:bg-slate-500'
                        }`}
                    >
                        <span className={`w-2 h-2 rounded-full border-2 ${criticalOn ? 'bg-white border-white' : 'bg-transparent border-red-400'}`} />
                        Ruta Crítica
                    </button>

                    {/* Guardar Cronograma */}
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

            {/* ── GANTT ────────────────────────────────────────────────── */}
            <div className="flex-1 relative overflow-hidden">
                <div ref={ganttContainer} className="w-full h-full" />
            </div>

            {/* ══════════════════════════════════════════════════════════
                MODAL: PREDECESORAS
            ══════════════════════════════════════════════════════════ */}
            {predOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) setPredOpen(false); }}
                >
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">

                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
                            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Predecesoras</h2>
                            <button onClick={() => setPredOpen(false)}
                                className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                        </div>

                        <div className="px-5 py-3 border-b border-gray-100">
                            <input
                                type="text"
                                placeholder="Buscar tarea..."
                                value={predSearch}
                                onChange={(e) => setPredSearch(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                        </div>

                        <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
                            {filteredPredTasks.length === 0 && (
                                <p className="px-5 py-8 text-center text-gray-400 text-sm">No se encontraron tareas</p>
                            )}
                            {filteredPredTasks.map((t) => {
                                const existingLink = predLinks.find((l) => l.source == t.id);
                                const added        = !!existingLink;
                                return (
                                    <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                                        <span className="text-sm text-gray-800 flex-1 min-w-0 truncate">
                                            {t.item && (
                                                <span className="text-gray-400 mr-1.5 text-xs font-mono">{t.item}</span>
                                            )}
                                            {t.text}
                                        </span>
                                        <select
                                            defaultValue={existingLink?.type ?? '0'}
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
                                            className={`text-xs px-3 py-1.5 rounded-md font-semibold text-white transition-colors flex-shrink-0 ${
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
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                MODAL: AJUSTES PROYECTO
            ══════════════════════════════════════════════════════════ */}
            {isSettingsOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) setIsSettingsOpen(false); }}
                >
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">

                        <div className="bg-gray-100 px-5 py-4 border-b flex justify-between items-center">
                            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Configuración del Proyecto</h2>
                            <button onClick={() => setIsSettingsOpen(false)}
                                className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                        </div>

                        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">

                            {/* Escala de tiempo */}
                            <section>
                                <h3 className="text-[11px] font-black text-blue-600 border-b border-blue-100 mb-4 pb-1 uppercase tracking-wider">
                                    Escala de Tiempo
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] text-gray-500 font-bold uppercase">Unidad Superior</label>
                                        <select value={topUnit} onChange={(e) => setTopUnit(e.target.value)}
                                            className="w-full border border-gray-300 rounded-md p-2 text-sm text-gray-900 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                                            <option value="month">Mes</option>
                                            <option value="year">Año</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] text-gray-500 font-bold uppercase">Unidad Inferior</label>
                                        <select value={bottomUnit} onChange={(e) => setBottomUnit(e.target.value)}
                                            className="w-full border border-gray-300 rounded-md p-2 text-sm text-gray-900 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                                            <option value="day">Día</option>
                                            <option value="week">Semana</option>
                                        </select>
                                    </div>
                                </div>
                            </section>

                            {/* Calendario laboral */}
                            <section>
                                <h3 className="text-[11px] font-black text-blue-600 border-b border-blue-100 mb-4 pb-1 uppercase tracking-wider">
                                    Calendario Laboral
                                </h3>
                                <div className="grid grid-cols-4 gap-3">
                                    {([
                                        ['lunes',     'Lunes'],
                                        ['martes',    'Martes'],
                                        ['miercoles', 'Miércoles'],
                                        ['jueves',    'Jueves'],
                                        ['viernes',   'Viernes'],
                                        ['sabado',    'Sábado'],
                                        ['domingo',   'Domingo'],
                                    ] as [keyof typeof workDays, string][]).map(([key, label]) => (
                                        <label key={key}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-xs font-medium select-none ${
                                                workDays[key]
                                                    ? 'bg-blue-50 border-blue-400 text-blue-700'
                                                    : 'bg-gray-50 border-gray-300 text-gray-500'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={workDays[key]}
                                                onChange={(e) =>
                                                    setWorkDays((d) => ({ ...d, [key]: e.target.checked }))
                                                }
                                                className="w-3.5 h-3.5 rounded accent-blue-600"
                                            />
                                            {label}
                                        </label>
                                    ))}
                                </div>
                            </section>

                            {/* Jornada laboral */}
                            <section>
                                <h3 className="text-[11px] font-black text-blue-600 border-b border-blue-100 mb-4 pb-1 uppercase tracking-wider">
                                    Jornada Laboral
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] text-gray-500 font-bold uppercase">Hora Inicio</label>
                                        <input type="time" value={workStartTime}
                                            onChange={(e) => setWorkStartTime(e.target.value)}
                                            className="w-full border border-gray-300 rounded-md p-2 text-sm text-gray-900 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] text-gray-500 font-bold uppercase">Hora Fin</label>
                                        <input type="time" value={workEndTime}
                                            onChange={(e) => setWorkEndTime(e.target.value)}
                                            className="w-full border border-gray-300 rounded-md p-2 text-sm text-gray-900 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div className="bg-gray-50 px-5 py-4 border-t flex justify-end gap-3">
                            <button onClick={() => setIsSettingsOpen(false)}
                                className="px-4 py-2 text-xs font-bold text-gray-500 uppercase hover:text-gray-700 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={aplicarAjustes}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md text-xs font-black uppercase shadow-md transition-colors">
                                Aplicar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── CSS ─────────────────────────────────────────────────── */}
            <style>{`
                /* Oculta la barra por defecto en tareas padre */
                .gantt_task_line.gantt_project              { visibility: hidden !important; }

                /* Cabecera de columnas */
                .gantt_grid_head_cell                       { font-weight: 700; font-size: 11px; text-transform: uppercase; color: #475569; }

                /* Barra estándar */
                .gantt_task_line                            { border-radius: 4px; border: 1px solid #1e40af; background-color: #3b82f6; }
                .gantt_task_progress                        { background-color: #1d4ed8; opacity: 0.4; }

                /* ── RUTA CRÍTICA ── */
                .gantt_critical_task                        { background-color: #ef4444 !important; border-color: #dc2626 !important; }
                .gantt_critical_task .gantt_task_progress   { background-color: #b91c1c !important; }
                /* Flechas críticas */
                .gantt_critical_link .gantt_line_wrapper div { background-color: #ef4444 !important; }
                .gantt_critical_link .gantt_link_arrow      { border-color: #ef4444 !important; }

                /* Editor inline */
                .gantt_grid_editor_placeholder input        {
                    box-sizing: border-box; width: 100%; height: 100%;
                    border: 1px solid #10b981 !important;
                    padding: 0 5px; font-size: 12px; outline: none; background: #fff;
                }

                /* Días no laborables */
                .columna-no-laborable {
                    background-color: #f1f5f9 !important;
                    color: #94a3b8 !important;
                    border-right: 1px solid #e2e8f0 !important;
                }

                /* Contenido tarea */
                .gantt_task_content { color: #fff; font-weight: 600; font-size: 11px; }

                /* Tooltip */
                .gantt_tooltip {
                    background: #1e293b !important; color: #fff !important;
                    border: none !important; border-radius: 8px !important;
                    padding: 10px 14px !important; font-size: 12px !important;
                    line-height: 1.7 !important; box-shadow: 0 4px 20px rgba(0,0,0,0.4) !important;
                }
            `}</style>
        </div>
    );
};

export default CronogramaIndex;