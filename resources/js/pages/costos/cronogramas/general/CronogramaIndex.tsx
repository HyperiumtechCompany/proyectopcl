import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '@/css/cronograma/general/general.css';

import { PredecessorsModal } from './components/PredecessorsModal';
import { ProjectSettingsModal } from './components/ProjectSettingsModal';
import {
    applyAutoScheduling,
    enforceProjectBounds,
    markCriticalTasks,
    parsePredecessorText,
    setProjectMarkers,
    toggleGanttMode,
    updateCountersAndItems,
    updatePredecessorsText,
    LINK_LABELS,
    LINK_NAMES,
} from './helpers/ganttHelpers';

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────────────────

const formatSoles = (value: number | string | null | undefined): string => {
    const num = parseFloat(String(value ?? 0));
    if (isNaN(num)) return 'S/. 0.00';
    return new Intl.NumberFormat('es-PE', {
        style: 'currency', currency: 'PEN', minimumFractionDigits: 2,
    }).format(num).replace('PEN', 'S/.');
};

const showToast = (message: string, type: 'success' | 'error' | 'info'): void => {
    const toast = document.createElement('div');
    toast.className = `pcl-toast pcl-toast--${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('pcl-toast--visible')));
    setTimeout(() => {
        toast.classList.remove('pcl-toast--visible');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 3000);
};

// ─────────────────────────────────────────────────────────────────────────────
// RECALCULAR FECHAS DEL PADRE DESDE SUS HIJOS (min start / max end)
// ─────────────────────────────────────────────────────────────────────────────

function recalcParentDates(childId: any): void {
    let child: any;
    try { child = gantt.getTask(childId); } catch { return; }
    if (!child?.parent || !gantt.isTaskExists(child.parent)) return;

    const parent: any = gantt.getTask(child.parent);

    let minStart: Date | null = null;
    let maxEnd: Date | null = null;

    gantt.getChildren(parent.id).forEach((cid: any) => {
        let t: any;
        try { t = gantt.getTask(cid); } catch { return; }
        if (!t?.start_date || !t?.end_date) return;
        const s = new Date(t.start_date);
        const e = new Date(t.end_date);
        if (isNaN(s.getTime()) || isNaN(e.getTime())) return;
        if (!minStart || s < minStart) minStart = s;
        if (!maxEnd || e > maxEnd) maxEnd = e;
    });

    if (!minStart || !maxEnd) return;

    const sameStart = parent.start_date && new Date(parent.start_date).getTime() === (minStart as Date).getTime();
    const sameEnd = parent.end_date && new Date(parent.end_date).getTime() === (maxEnd as Date).getTime();
    if (sameStart && sameEnd) return; // sin cambios, no hacer nada


    gantt.silent(() => {
        parent.start_date = new Date(minStart!);
        parent.end_date = new Date(maxEnd!);
        parent.duration = gantt.calculateDuration({
            start_date: new Date(minStart!),
            end_date: new Date(maxEnd!),
            task: parent,
        });
        gantt.updateTask(parent.id);
    });


    recalcParentDates(parent.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
    project_name?: string;
    project: string | number;
    total_budget?: number;
    initialData?: any;
    cronogramaId?: number;
    partidasBase?: { tasks: any[]; links: any[] } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
function calcularFinLaborable(
    fechaInicio: string,
    diasTotales: number,
    workDays: Record<string, boolean>,
    holidays: { date: string; checked: boolean }[]
): Date | null {
    if (!fechaInicio || diasTotales <= 0) return null;

    const inicio = new Date(fechaInicio + 'T00:00:00');
    if (isNaN(inicio.getTime())) return null;

    const DAY_MAP: Record<string, number> = {
        domingo: 0, lunes: 1, martes: 2, miercoles: 3,
        jueves: 4, viernes: 5, sabado: 6,
    };

    // Días laborables por índice (0=domingo ... 6=sábado)
    const esLaborable: boolean[] = [false, false, false, false, false, false, false];
    Object.entries(workDays).forEach(([name, active]) => {
        if (active && DAY_MAP[name] !== undefined) {
            esLaborable[DAY_MAP[name]] = true;
        }
    });

    // Feriados como strings 'YYYY-MM-DD'
    const feriadosSet = new Set<string>();
    holidays.forEach((h) => {
        if (h.checked && h.date) {
            try {
                const f = new Date(h.date + 'T00:00:00');
                if (!isNaN(f.getTime())) {
                    feriadosSet.add(f.toISOString().split('T')[0]);
                }
            } catch { /* ok */ }
        }
    });

    let fechaActual = new Date(inicio);
    let diasContados = 0;

    while (diasContados < diasTotales) {
        const diaSemana = fechaActual.getDay();
        const fechaStr = fechaActual.toISOString().split('T')[0];

        if (esLaborable[diaSemana] && !feriadosSet.has(fechaStr)) {
            diasContados++;
            if (diasContados === diasTotales) break; // este es el día final
        }

        if (diasContados < diasTotales) {
            fechaActual = new Date(fechaActual);
            fechaActual.setDate(fechaActual.getDate() + 1);
        }
    }

    return fechaActual;
}
const CronogramaIndex = ({
    project_name,
    project,
    total_budget = 0,
    initialData,
    cronogramaId,
    partidasBase,
}: Props) => {

    // ── REFS ─────────────────────────────────────────────────────────────────
    const ganttContainer = useRef<HTMLDivElement>(null);
    const isUpdatingRef = useRef(false);
    const criticalOnRef = useRef(true);
    const isParsingPredRef = useRef(false);
    const ganttInitialized = useRef(false);
    const eventIdsRef = useRef<any[]>([]);


    // ── UI STATE ──────────────────────────────────────────────────────────────
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [predOpen, setPredOpen] = useState(false);
    const [predTaskId, setPredTaskId] = useState<any>(null);
    const [criticalOn, setCriticalOn] = useState(true);
    const [saving, setSaving] = useState(false);
    const [importing, setImporting] = useState(false);
    const [taskCount, setTaskCount] = useState(0);
    const [totalCost, setTotalCost] = useState(0);
    const [projectProgress, setProjectProgress] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [autoScheduling, setAutoScheduling] = useState(true);
    const [showTaskLabels, setShowTaskLabels] = useState(true);

    const displayName = project_name || `Proyecto ${project}`;


    // ─────────────────────────────────────────────────────────────────────────
    // KPIs — solo tareas hoja
    // ─────────────────────────────────────────────────────────────────────────

    const refreshKPIs = useCallback(() => {
        if (!ganttInitialized.current) return;
        requestAnimationFrame(() => {
            let count = 0, cost = 0, weightedProgress = 0, totalDuration = 0;
            gantt.eachTask((task: any) => {
                if (!gantt.hasChild(task.id)) {
                    count++;
                    cost += parseFloat(task.cost) || 0;
                    const dur = parseFloat(task.duration) || 1;
                    weightedProgress += (parseFloat(task.progress) || 0) * dur;
                    totalDuration += dur;
                }
            });
            setTaskCount(count);
            setTotalCost(cost);
            setProjectProgress(totalDuration > 0 ? (weightedProgress / totalDuration) * 100 : 0);
        });
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // PROPAGAR COSTO AL PADRE (suma de hijos, recursivo hacia arriba)
    // ─────────────────────────────────────────────────────────────────────────

    const updateParentCost = useCallback((childId: any) => {
        let child: any;
        try { child = gantt.getTask(childId); } catch { return; }
        if (!child?.parent || !gantt.isTaskExists(child.parent)) return;

        let total = 0;
        gantt.getChildren(child.parent).forEach((cid: any) => {
            total += parseFloat(gantt.getTask(cid)?.cost) || 0;
        });

        const parent: any = gantt.getTask(child.parent);
        if (parseFloat(parent.cost || 0) !== total) {
            parent.cost = total;
            gantt.updateTask(parent.id);
            if (parent.parent && gantt.isTaskExists(parent.parent)) {
                updateParentCost(parent.id);
            }
        }
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // ACCIONES DEL TOOLBAR
    // ─────────────────────────────────────────────────────────────────────────

    const toggleCriticalPath = useCallback(() => {
        criticalOnRef.current = !criticalOnRef.current;
        gantt.config.highlight_critical_path = criticalOnRef.current;
        setCriticalOn(criticalOnRef.current);
        if (criticalOnRef.current) markCriticalTasks();
        gantt.render();
    }, []);

    const toggleAutoScheduling = useCallback(() => {
        const next = !autoScheduling;
        setAutoScheduling(next);
        toggleGanttMode(next);
        showToast(
            next ? '🤖 Modo Auto: tareas confinadas al límite del proyecto' : '🔧 Modo Manual: puedes pasar la fecha límite',
            'info',
        );
    }, [autoScheduling]);

    const expandAll = useCallback(() => {
        gantt.eachTask((t: any) => { t.$open = true; });
        gantt.render();
    }, []);

    const collapseAll = useCallback(() => {
        gantt.eachTask((t: any) => { if (gantt.hasChild(t.id)) t.$open = false; });
        gantt.render();
    }, []);

    const handleSearch = useCallback((term: string) => {
        setSearchTerm(term);
        document.querySelectorAll('.gantt_row').forEach((row: any) => row.classList.remove('pcl-row-highlight'));

        if (!term.trim()) {
            gantt.eachTask((task: any) => { task.$open = true; task.$highlight = false; });
            gantt.render();
            return;
        }

        const searchLower = term.toLowerCase().trim();
        const isNumber = /^\d+$/.test(searchLower);
        gantt.eachTask((task: any) => { task.$open = true; task.$highlight = false; });

        let foundTaskId: any = null;
        let foundRowNum: any = null;

        gantt.eachTask((task: any) => {
            const rowNumber = gantt.getGlobalTaskIndex(task.id) + 1;
            const matches = isNumber
                ? rowNumber.toString() === searchLower
                : task.text?.toLowerCase().includes(searchLower) || task.item?.toLowerCase().includes(searchLower);
            if (matches) { foundTaskId = task.id; foundRowNum = rowNumber; task.$highlight = true; }
        });

        if (foundTaskId) {
            gantt.showTask(foundTaskId);
            setTimeout(() => {
                const gridContainer = document.querySelector('.gantt_grid_data');
                const rowElement = document.querySelector(`.gantt_row[data-task-id="${foundTaskId}"]`);
                if (gridContainer && rowElement) {
                    const offset = rowElement.getBoundingClientRect().top - gridContainer.getBoundingClientRect().top;
                    gridContainer.scrollBy({ top: offset - 50, behavior: 'smooth' });
                }
                if (rowElement) rowElement.classList.add('pcl-row-highlight');
            }, 150);
            showToast(`📍 Tarea #${foundRowNum} encontrada`, 'info');
        } else {
            showToast(`❌ No se encontró: "${term}"`, 'info');
        }
        gantt.render();
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // GUARDAR CRONOGRAMA
    // ─────────────────────────────────────────────────────────────────────────

    const handleSave = useCallback(async () => {
        setSaving(true);
        gantt.eachTask((task: any) => { task.$open = true; });
        gantt.render();
        await new Promise<void>((r) => setTimeout(r, 100));

        const pid = Number(cronogramaId) || Number(project);
        const fmt = gantt.date.date_to_str('%Y-%m-%d %H:%i');

        const tasks = gantt.getTaskByTime().map((t: any) => ({
            id: t.id, text: t.text,
            start_date: fmt(t.start_date), end_date: fmt(t.end_date),
            duration: (t.start_date && t.end_date)
                ? Math.ceil((new Date(t.end_date).getTime() - new Date(t.start_date).getTime()) / 86400000) + 1
                : t.duration,
            parent: t.parent || 0,
            counter: t.counter, item: t.item, item_p: t.item_p || t.item,
            cost: t.cost || 0, predecessors: t.predecessors || '',
            progress: t.progress || 0, open: true,
            originalItem: t.originalItem || t.item,
            presupuesto_item_id: t.presupuesto_item_id || null,
            unidad: t.unidad || '', owner: t.owner || '',
        }));

        const links = gantt.getLinks().map((l: any) => ({
            id: l.id, source: l.source, target: l.target, type: l.type,
        }));

        try {
            await axios.post(`/cronograma/save/${pid}`, { tasks, links });
            showToast('✅ Cronograma guardado correctamente', 'success');
        } catch (err: any) {
            showToast(`❌ Error: ${err?.response?.data?.message ?? err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    }, [cronogramaId, project]);

    // ─────────────────────────────────────────────────────────────────────────
    // IMPORTAR DESDE PRESUPUESTO
    // ─────────────────────────────────────────────────────────────────────────

    const handleImport = useCallback(async () => {
        if (!confirm('¿Importar las partidas del presupuesto como tareas?\n\nEsto reemplazará el cronograma actual.')) return;

        setImporting(true);
        try {
            const { data: partidas } = await axios.get(`/presupuesto/${project}/partidas`);
            if (!partidas?.length) throw new Error('No hay partidas en el presupuesto');

            const tasksMap = new Map<string, any>();
            const rootTasks: any[] = [];

            const fmt = gantt.date.date_to_str('%Y-%m-%d %H:%i');
            partidas.forEach((partida: any) => {
                if (!partida.codigo) return; // Skip if no codigo
                const task = {
                    id: gantt.uid(), text: partida.descripcion,
                    start_date: fmt(new Date()), end_date: fmt(gantt.date.add(new Date(), 5, 'day')),
                    duration: 5, progress: 0,
                    cost: parseFloat(partida.total) || 0,
                    item: partida.codigo, originalItem: partida.codigo,
                    unidad: partida.unidad || '', parent: 0, $open: true,
                };
                tasksMap.set(partida.codigo, task);
                rootTasks.push(task);
            });

            tasksMap.forEach((task) => {
                const code = task.originalItem as string;
                if (!code) return; // Skip if no code
                const lastDot = code.lastIndexOf('.');
                if (lastDot !== -1) {
                    const parentTask = tasksMap.get(code.substring(0, lastDot));
                    if (parentTask) {
                        task.parent = parentTask.id;
                        const idx = rootTasks.findIndex((t: any) => t.originalItem === code);
                        if (idx !== -1) rootTasks.splice(idx, 1);
                    }
                }
            });

            gantt.clearAll();
            gantt.parse({
                data: Array.from(tasksMap.values()),
                links: []
            });

            // Marcar padres como "project" y propagar fechas bottom-up
            gantt.silent(() => {
                gantt.eachTask((task: any) => {
                    if (gantt.hasChild(task.id)) task.type = gantt.config.types.project;
                    task.$open = true;
                });
            });
            gantt.eachTask((task: any) => {
                if (!gantt.hasChild(task.id)) recalcParentDates(task.id);
            });

            updateCountersAndItems();
            markCriticalTasks();
            gantt.render();
            refreshKPIs();

            // Guardar en la base de datos
            const pid = Number(project);
            const tasks = gantt.getTaskByTime().map((t: any) => ({
                id: t.id, text: t.text,
                start_date: fmt(t.start_date), end_date: fmt(t.end_date),
                duration: (t.start_date && t.end_date)
                    ? Math.ceil((new Date(t.end_date).getTime() - new Date(t.start_date).getTime()) / 86400000) + 1
                    : t.duration,
                parent: t.parent || 0,
                counter: t.counter, item: t.item, item_p: t.item_p || t.item,
                cost: t.cost || 0, predecessors: t.predecessors || '',
                progress: t.progress || 0, open: true,
                originalItem: t.originalItem || t.item,
                presupuesto_item_id: t.presupuesto_item_id || null,
                unidad: t.unidad || '', owner: t.owner || '',
            }));
            const links = gantt.getLinks().map((l: any) => ({
                id: l.id, source: l.source, target: l.target, type: l.type,
            }));

            await axios.post(`/cronograma/save/${pid}`, { tasks, links });
            showToast(`✅ ${partidas.length} partidas importadas y guardadas`, 'success');
        } catch (err: any) {
            showToast(`❌ Error: ${err.message}`, 'error');
        } finally {
            setImporting(false);
        }
    }, [project, refreshKPIs]);

    // ─────────────────────────────────────────────────────────────────────────
    // AJUSTES DEL PROYECTO
    // ─────────────────────────────────────────────────────────────────────────

    const handleApplySettings = useCallback((settings: {
        projectStart?: string;
        projectEnd?: string;
        projectDuration?: number;
        holidays?: any[];
        workDays?: any;
        workStartTime?: string;
        workEndTime?: string;
        scheduleFromEnd?: boolean;
    }) => {
        try {
            let realStartDate: Date | null = null;
            let limitDate: Date | null = null;

            gantt.silent(() => {
                // ── Días laborables ───────────────────────────────────────────
                if (settings.workDays) {
                    const DAY_MAP: Record<string, number> = {
                        domingo: 0, lunes: 1, martes: 2, miercoles: 3,
                        jueves: 4, viernes: 5, sabado: 6,
                    };
                    for (let i = 0; i <= 6; i++) gantt.setWorkTime({ day: i, hours: false } as any);
                    Object.entries(settings.workDays).forEach(([name, active]) => {
                        if (active) {
                            gantt.setWorkTime({
                                day: DAY_MAP[name],
                                hours: [`${settings.workStartTime || '08:00'}-${settings.workEndTime || '17:00'}`],
                            } as any);
                        }
                    });
                }

                // ── Feriados ──────────────────────────────────────────────────
                (settings.holidays || []).forEach((h: any) => {
                    if (h.checked) {
                        const date = new Date(h.date);
                        if (!isNaN(date.getTime())) gantt.setWorkTime({ date, hours: false } as any);
                    }
                });

                // ── Fecha de inicio ───────────────────────────────────────────
                if (settings.projectStart) {
                    realStartDate = new Date(settings.projectStart + 'T00:00:00');
                    (window as any).__projectRealStartDate = realStartDate;
                    const viewStart = new Date(realStartDate);
                    viewStart.setDate(viewStart.getDate() - 1);
                    gantt.config.start_date = viewStart;
                }

                // ── Fecha límite ──────────────────────────────────────────────
                if (settings.projectStart && settings.projectDuration && settings.projectDuration > 0) {
                    const duracion = Number(settings.projectDuration);
                    if (!isNaN(duracion) && duracion > 0) {

                        limitDate = calcularFinLaborable(
                            settings.projectStart,
                            duracion,
                            settings.workDays || {},
                            settings.holidays || []
                        );

                        if (limitDate && !isNaN(limitDate.getTime())) {
                            (window as any).__projectLimitDate = limitDate;

                            // end_date necesita 1 día extra para que el marker sea visible
                            const viewEnd = new Date(limitDate!);
                            viewEnd.setDate(viewEnd.getDate() + 2); // ← +2 días para que el límite sea visible
                            gantt.config.end_date = viewEnd;
                            gantt.config.limit_view = autoScheduling;

                            if (realStartDate) {
                                const viewStart = new Date(realStartDate);
                                viewStart.setDate(viewStart.getDate() - 1);
                                gantt.config.start_date = viewStart;
                            }
                        } else {
                            limitDate = null;
                        }
                    }
                }

                if (settings.scheduleFromEnd !== undefined) {
                    (gantt.config as any).schedule_from_end = settings.scheduleFromEnd;
                }

                gantt.config.skip_off_time = false;
                gantt.config.work_time = false;

                // ── Template celdas feriados / fin de semana ──────────────────
                const hols = settings.holidays || [];
                const workDaysCfg = settings.workDays || {};
                const nonWorkDays: number[] = [];
                const dayMap: Record<string, number> = {
                    domingo: 0, lunes: 1, martes: 2, miercoles: 3,
                    jueves: 4, viernes: 5, sabado: 6,
                };
                Object.entries(workDaysCfg).forEach(([name, isWorking]) => {
                    if (!isWorking) nonWorkDays.push(dayMap[name]);
                });

                gantt.templates.timeline_cell_class = (_t: any, date: Date) => {
                    if (!date || isNaN(date.getTime())) return '';
                    const dStr = date.toLocaleDateString('en-CA');
                    const esFeriado = hols.some((h: any) => {
                        if (!h.checked || !h.date) return false;
                        try {
                            const f = new Date(h.date);
                            return !isNaN(f.getTime()) && f.toISOString().split('T')[0] === dStr;
                        } catch { return false; }
                    });
                    if (esFeriado) return 'pcl-feriado-cell';
                    if (nonWorkDays.includes(date.getDay())) return 'pcl-weekend-cell';
                    return '';
                };
            });
            // ── Mover TODAS las tareas HOJA con los nuevos parámetros ─────────────
            if (realStartDate !== null && settings.projectDuration && settings.projectDuration > 0) {
                const nuevaDuracion = settings.projectDuration;

                const allTasks: any[] = [];
                gantt.eachTask((task: any) => {
                    // ✅ Asegurar duración positiva
                    let duracion = nuevaDuracion;
                    if (duracion < 1 || isNaN(duracion) || duracion > 1000) {
                        duracion = 5;
                    }

                    allTasks.push({
                        id: task.id,
                        text: task.text,
                        parent: task.parent,
                        cost: task.cost,
                        item: task.item,
                        originalItem: task.originalItem,
                        progress: task.progress,
                        owner: task.owner,
                        type: task.type,
                        $open: true,
                        start_date: new Date(realStartDate as Date),
                        duration: duracion  // ← usar duración limpia
                    });
                });

                const allLinks = gantt.getLinks();

                gantt.clearAll();

                gantt.batchUpdate(() => {
                    allTasks.forEach((task: any) => {
                        gantt.addTask(task);
                    });
                    allLinks.forEach((link: any) => {
                        gantt.addLink(link);
                    });
                });

                gantt.render();
                refreshKPIs();
                setProjectMarkers(realStartDate, limitDate);
            }

            let style = document.getElementById('pcl-feriado-style') as HTMLStyleElement | null;
            if (!style) {
                style = document.createElement('style');
                style.id = 'pcl-feriado-style';
                document.head.appendChild(style);
            }
            style.innerHTML = `.pcl-gantt-wrapper .gantt_task_cell.pcl-feriado-cell { background: rgba(251,146,60,0.4) !important; }`;

            setProjectMarkers(realStartDate, limitDate);
            gantt.render();
            if (gantt.config.start_date) setTimeout(() => gantt.showDate(gantt.config.start_date!), 100);
            refreshKPIs();


            if (gantt.config.start_date) setTimeout(() => gantt.showDate(gantt.config.start_date!), 100);
            refreshKPIs();

        } catch (error) {
            console.error('[handleApplySettings]', error);
            // Al final de handleApplySettings, antes de cerrar el modal
            if (settings.workDays) {
                localStorage.setItem('gantt_work_days', JSON.stringify(settings.workDays));
            }
            if (settings.workStartTime) {
                localStorage.setItem('gantt_work_start', settings.workStartTime);
            }
            if (settings.workEndTime) {
                localStorage.setItem('gantt_work_end', settings.workEndTime);
            }

        } finally {
            setIsSettingsOpen(false);
        }

    }, [refreshKPIs, autoScheduling]);

    // ─────────────────────────────────────────────────────────────────────────
    // INICIALIZACIÓN DEL GANTT
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!ganttContainer.current) return;

        ganttContainer.current.innerHTML = '';
        gantt.clearAll();
        ganttInitialized.current = false;
        eventIdsRef.current = [];

        (gantt as any).plugins({
            critical_path: true,
            auto_scheduling: true,
            tooltip: true,
            marker: true,
        });
        gantt.config.date_format = '%Y-%m-%d %H:%i';
        gantt.config.xml_date = '%Y-%m-%d %H:%i';
        gantt.config.row_height = 32;
        gantt.config.grid_width = 500;
        gantt.config.scale_height = 54;
        gantt.config.min_column_width = 50;
        gantt.config.open_tree_initially = true;
        gantt.config.work_time = false;
        gantt.config.skip_off_time = false;
        gantt.config.fit_tasks = true;
        gantt.config.auto_scheduling = true;
        gantt.config.auto_scheduling_strict = autoScheduling;
        gantt.config.autosize = false;
        gantt.config.schedule_from_end = false;
        gantt.config.highlight_critical_path = true;
        gantt.config.show_chart_work_time = true;
        gantt.config.split_tasks = false;
        gantt.config.branch_loading = false;
        gantt.config.limit_view = false;
        gantt.config.correct_work_time = true;
        gantt.config.grid_resize = true;
        gantt.config.grid_resize_rows = false;
        gantt.config.show_task_cells = true;
        gantt.config.link_radius = 0;
        gantt.config.link_line_width = 2;  // grosor de línea
        gantt.config.link_arrow_size = 4;
        gantt.config.links_rounding = 0;
        (gantt.config as any).link_line_radius = 0;


        (gantt.config as any).show_grid_work_time = true;
        (gantt.config as any).auto_types = true;
        (gantt.config as any).smart_rendering = true;
        (gantt.config as any).static_background = false;
        (gantt.config as any).auto_scheduling_move_projects = true;
        (gantt.config as any).auto_scheduling_initial = true;
        (gantt.config as any).auto_scheduling_compatibility = true;

        gantt.config.links = {
            finish_to_start: '0', start_to_start: '1',
            finish_to_finish: '2', start_to_finish: '3',
        };

        // ── Días laborables — restaurar desde localStorage si existe ──────────
        const savedWorkDays = localStorage.getItem('gantt_work_days');
        const savedWorkStart = localStorage.getItem('gantt_work_start') || '08:00';
        const savedWorkEnd = localStorage.getItem('gantt_work_end') || '17:00';

        if (savedWorkDays) {
            const workDays = JSON.parse(savedWorkDays);
            const DAY_MAP: Record<string, number> = {
                domingo: 0, lunes: 1, martes: 2, miercoles: 3,
                jueves: 4, viernes: 5, sabado: 6,
            };

            for (let i = 0; i <= 6; i++) gantt.setWorkTime({ day: i, hours: false } as any);
            // Aplicar los guardados
            Object.entries(workDays).forEach(([name, active]) => {
                if (active) {
                    gantt.setWorkTime({
                        day: DAY_MAP[name],
                        hours: [`${savedWorkStart}-${savedWorkEnd}`],
                    } as any);
                }
            });
        } else {
            // Defaults: lun-vie laborables, sáb y dom no
            gantt.setWorkTime({ day: 6, hours: false });
            gantt.setWorkTime({ day: 0, hours: false });
        }
        gantt.config.layout = {
            css: 'gantt_container',
            cols: [
                {
                    width: 700,
                    min_width: 300,  // ← aumentado para mejor UX
                    gravity: 1,
                    rows: [
                        { view: 'grid', scrollX: 'gridScroll', scrollable: true, scrollY: 'vScroll' },
                        { view: 'scrollbar', id: 'gridScroll' },
                    ],
                },
                // RESIZER ELIMINADO - grid_resize se encarga
                {
                    gravity: 2,
                    rows: [
                        { view: 'timeline', scrollX: 'scrollHor', scrollY: 'vScroll' },
                        { view: 'scrollbar', id: 'scrollHor' },
                    ],
                },
                { view: 'scrollbar', id: 'vScroll' },
            ],
        };

        gantt.config.scales = [
            {
                unit: "month",
                step: 1,
                format: "%F, %Y"
            },
            {
                unit: "day",
                step: 1,
                format: "%j"
            }
        ];

        const editors = {
            text: { type: 'text', map_to: 'text' },
            date: { type: 'date', map_to: 'start_date' },
            endDate: { type: 'date', map_to: 'end_date' },
            duration: { type: 'text', map_to: 'duration' },
            cost: { type: 'text', map_to: 'cost' },
            progress: { type: 'number', map_to: 'progress', min: 0, max: 1 },
            owner: { type: 'text', map_to: 'owner' },
        };

        gantt.config.columns = [
            {
                name: 'rownum', label: '#', width: 50, align: 'center', resize: true,
                template: (t: any) => gantt.getGlobalTaskIndex(t.id) + 1,
            },
            {
                name: 'wbs_item', label: 'ÍTEM', width: 80, resize: true,
                template: (t: any) => {
                    const code = t.item || '';
                    const isParent = gantt.hasChild(t.id) || code.split('.').length <= 2;
                    return `<span style="font-weight:${isParent ? '700;color:#1e293b' : '400;color:#475569'}">${code}</span>`;
                },
            },
            {
                name: 'text', label: 'NOMBRE DE TAREA', tree: true, width: 300,
                min_width: 150, resize: true, editor: editors.text,
                template: (t: any) => gantt.hasChild(t.id)
                    ? `<span style="font-weight:700;color:#0f172a"><span style="font-weight:300;opacity:0.8;color:#000;">[</span>${t.text || ''}<span style="font-weight:300;opacity:0.8;color:#000;">]</span></span>`
                    : `<span style="font-weight:400;color:#334155">${t.text || ''}</span>`,
            },

            {
                name: 'predecessors', label: 'PREDECESORAS', align: 'center', width: 140, resize: true,
                editor: { type: 'text', map_to: 'predecessors' },
                template: (task: any) => {
                    const currentTaskNum = gantt.getGlobalTaskIndex(task.id) + 1;
                    const labels = gantt.getLinks()
                        .filter((l: any) => String(l.target) === String(task.id))
                        .map((l: any) => {
                            try { return `${gantt.getGlobalTaskIndex(l.source) + 1}${LINK_LABELS[l.type] ?? 'FC'}`; }
                            catch { return null; }
                        }).filter(Boolean);
                    return `<div style="display:flex;align-items:center;justify-content:space-between;gap:4px;">
                        <span style="flex:1;font-size:11px;color:#64748b;">${labels.join(', ') || '—'}</span>
                        <button onclick="event.stopPropagation();window.__openPredModal('${task.id}')"
                            style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:4px;cursor:pointer;font-size:11px;padding:3px 7px;color:#3b82f6;display:flex;align-items:center;gap:3px;">
                            <span style="font-size:12px;">🔗</span><span style="font-size:10px;">${currentTaskNum}</span>
                        </button>
                    </div>`;
                },
            },

            {
                name: 'duration', label: 'DÍAS', align: 'center', width: 60,
                resize: true, editor: editors.duration,
                template: (t: any) => {

                    return `${t.duration || 0}d`;
                },
            },
            { name: 'start_date', label: 'INICIO', align: 'center', width: 95, resize: true, editor: editors.date },
            {
                name: 'end_date', label: 'FIN', align: 'center', width: 95, resize: true, editor: editors.endDate,
                template: (t: any) => {
                    try { return gantt.templates.date_grid(t.end_date, t, 'end_date'); } catch { return ''; }
                },
            },

            {
                name: 'cost', label: 'COSTO PARCIAL', align: 'right', width: 120,
                resize: true, editor: editors.cost,
                template: (t: any) =>
                    `<span style="font-variant-numeric:tabular-nums;color:${parseFloat(t.cost) > 0 ? '#0f766e' : '#94a3b8'}">${formatSoles(t.cost)}</span>`,
            },
            {
                name: 'progress', label: '%', align: 'center', width: 60,
                resize: true, editor: editors.progress,
                template: (t: any) => {
                    const p = Math.round((parseFloat(t.progress) || 0) * 100);
                    const color = p >= 100 ? '#10b981' : p >= 50 ? '#f59e0b' : '#3b82f6';
                    return `<span style="font-weight:600;color:${color}">${p}%</span>`;
                },
            },
            {
                name: 'owner', label: 'RESP.', align: 'center', width: 70,
                resize: true, editor: editors.owner,
                template: (t: any) => t.owner
                    ? `<span style="background:#eff6ff;color:#2563eb;padding:1px 5px;border-radius:9px;">${t.owner}</span>`
                    : '',
            },
            { name: 'add', width: 40, resize: false },
        ];

        gantt.config.lightbox.sections = [
            { name: 'description', height: 38, map_to: 'text', type: 'textarea', focus: true },
            { name: 'time', type: 'duration', map_to: 'auto', time_format: ['%d', '%m', '%Y'] },
            { name: 'cost', height: 22, map_to: 'cost', type: 'text', default_value: '0' },
            { name: 'owner', height: 22, map_to: 'owner', type: 'text', default_value: '' },
        ];
        gantt.locale.labels.section_cost = 'Costo Parcial (S/.)';
        gantt.locale.labels.section_owner = 'Responsable';

        gantt.templates.task_class = (_s: Date, _e: Date, task: any) => {
            const cls: string[] = [];
            if (gantt.hasChild(task.id)) cls.push('pcl-task-parent');
            if (criticalOnRef.current) {
                try {
                    const isCrit = typeof gantt.isCriticalTask === 'function'
                        ? gantt.isCriticalTask(task) : task._critical;
                    if (isCrit) cls.push('gantt_critical_task');
                } catch { /* ok */ }
            }
            return cls.join(' ');
        };

        gantt.templates.link_class = (link: any) => {
            const cls: string[] = [];
            if (criticalOnRef.current) {
                try {
                    const s = gantt.getTask(link.source);
                    const t = gantt.getTask(link.target);
                    const sCrit = typeof gantt.isCriticalTask === 'function' ? gantt.isCriticalTask(s) : s?._critical;
                    const tCrit = typeof gantt.isCriticalTask === 'function' ? gantt.isCriticalTask(t) : t?._critical;
                    if (sCrit && tCrit) cls.push('gantt_critical_link');
                } catch { /* ok */ }
            }
            const typeMap: Record<string, string> = {
                '0': 'gantt_link_fc', '1': 'gantt_link_cc', '2': 'gantt_link_ff', '3': 'gantt_link_cf',
            };
            if (typeMap[link.type]) cls.push(typeMap[link.type]);
            return cls.join(' ');
        };

        gantt.templates.link_description = (link: any) => {
            try { return `${gantt.getTask(link.source).text} (${LINK_NAMES[link.type]}) → ${gantt.getTask(link.target).text}`; }
            catch { return ''; }
        };

        gantt.templates.tooltip_text = (start: Date, end: Date, task: any) => {
            const isCrit = (() => {
                try { return typeof gantt.isCriticalTask === 'function' ? gantt.isCriticalTask(task) : task._critical; }
                catch { return false; }
            })();
            const pct = Math.round((parseFloat(task.progress) || 0) * 100);
            const predLabels = gantt.getLinks()
                .filter((l: any) => String(l.target) === String(task.id))
                .map((l: any) => {
                    try { return `${gantt.getGlobalTaskIndex(l.source) + 1}${LINK_LABELS[l.type]}`; }
                    catch { return null; }
                }).filter(Boolean);

            return `<div class="pcl-tooltip">
                <div class="pcl-tooltip__title">${task.text}</div>
                <table class="pcl-tooltip__table">
                    <tr><td>Ítem WBS</td><td><b>${task.item_p || task.item || '-'}</b></td></tr>
                    <tr><td>Duración</td><td><b>${task.duration}</b> días hábiles</td></tr>
                    <tr><td>Inicio</td><td>${gantt.templates.tooltip_date_format(start)}</td></tr>
                    <tr><td>Fin</td><td>${gantt.templates.tooltip_date_format(end)}</td></tr>
                    <tr><td>Costo Parcial</td><td><b>${formatSoles(task.cost)}</b></td></tr>
                    <tr><td>Avance</td><td>
                        <div style="display:flex;align-items:center;gap:6px;">
                            <div style="flex:1;height:6px;background:#334155;border-radius:3px;">
                                <div style="width:${pct}%;height:100%;background:${pct >= 100 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#3b82f6'}"></div>
                            </div><b>${pct}%</b>
                        </div>
                    </td></tr>
                    ${task.owner ? `<tr><td>Responsable</td><td>${task.owner}</td></tr>` : ''}
                    ${predLabels.length ? `<tr><td>Predecesoras</td><td>${predLabels.join(', ')}</td></tr>` : ''}
                    ${isCrit ? `<tr><td colspan="2"><span style="color:#f87171;">⚠ Tarea en Ruta Crítica</span></td></tr>` : ''}
                </table>
            </div>`;
        };

        const on = (event: string, handler: (...args: any[]) => any) => {
            eventIdsRef.current.push((gantt as any).attachEvent(event, handler));
        };

        // ── EVENTOS ──────────────────────────────────────────────────
        on('onTaskCreated', (task: any) => {
            task.start_date = new Date();
            task.end_date = gantt.date.add(task.start_date, 1, 'day');
            task.cost = 0;
            task.progress = 0;
            return true;
        });

        on('onAfterTaskUpdate', (id: any, item: any) => {

            //  Duración editada por usuario → recalcular end_date en días CALENDARIO
            if (!isUpdatingRef.current && !isParsingPredRef.current) {
                let task: any;
                try { task = gantt.getTask(id); } catch { /* ok */ }
                if (task?.start_date && task?.end_date && item.duration > 0) {
                    const calDiff = Math.ceil(
                        (new Date(task.end_date).getTime() - new Date(task.start_date).getTime()) / 86400000
                    ) + 1;
                    if (item.duration !== calDiff) {
                        gantt.silent(() => {
                            task.end_date = new Date(task.start_date);
                            task.end_date.setDate(task.end_date.getDate() + item.duration - 1);
                            gantt.updateTask(id);
                        });
                    }
                }
            }

            // Predecesoras
            if (!isUpdatingRef.current && !isParsingPredRef.current) {
                const rawText = String(item.predecessors ?? '').trim();
                const currentLinksText = gantt.getLinks()
                    .filter((l: any) => String(l.target) === String(id))
                    .map((l: any) => {
                        try { return `${gantt.getGlobalTaskIndex(l.source) + 1}${LINK_LABELS[l.type] ?? 'FC'}`; }
                        catch { return null; }
                    }).filter(Boolean).join(', ');

                if (rawText !== currentLinksText) {
                    isParsingPredRef.current = true;
                    parsePredecessorText(id, rawText);
                    gantt.render();
                    isParsingPredRef.current = false;
                }
            }

            // Costo y fechas del padre
            if (!isUpdatingRef.current) {
                isUpdatingRef.current = true;
                try {
                    if (item.parent && gantt.isTaskExists(item.parent)) {
                        updateParentCost(id);
                    }
                    recalcParentDates(id);
                } finally {
                    isUpdatingRef.current = false;
                }
            }

            setTimeout(() => refreshKPIs(), 50);
        });
        const afterChange = () => {
            updateCountersAndItems();
            applyAutoScheduling();
            markCriticalTasks();
            gantt.render();
            refreshKPIs();
        };

        on('onAfterTaskAdd', (id: any) => {
            const task = gantt.getTask(id);
            if (!task.cost) { task.cost = 0; gantt.updateTask(id); }
            if (autoScheduling) { enforceProjectBounds(id); gantt.updateTask(id); }
            afterChange();
            gantt.showTask(id);
        });

        on('onAfterTaskDelete', afterChange);
        on('onAfterTaskMove', afterChange);
        on('onAfterLinkAdd', (_id: any, link: any) => {
            updatePredecessorsText(link.target);
            applyAutoScheduling();
            markCriticalTasks();
            if (enforceProjectBounds(link.target)) gantt.updateTask(link.target);
            gantt.render();
        });

        on('onAfterLinkDelete', (_id: any, link: any) => {
            try { updatePredecessorsText(link.target); } catch { /* tarea ya eliminada */ }
            applyAutoScheduling();
            markCriticalTasks();
            try { if (enforceProjectBounds(link.target)) gantt.updateTask(link.target); } catch { /* ok */ }
            gantt.render();
        });

        on('onAfterAutoSchedule', () => {
            markCriticalTasks();
            refreshKPIs();
        });

        let dragTimer: any = null;
        on('onAfterTaskDrag', (id: any) => {
            if (dragTimer) clearTimeout(dragTimer);
            dragTimer = setTimeout(() => {
                recalcParentDates(id);
                gantt.render();
                dragTimer = null;
            }, 50);
        });

        gantt.i18n.setLocale("es");
        gantt.init(ganttContainer.current);
        if (!ganttContainer.current) {
            console.warn('Contenedor no disponible para pan');
            return;
        }



        ganttInitialized.current = true;
        (gantt as any).config.editor_types.duration_calendar = {
            show: function (id: any, column: any, config: any, placeholder: any) {
                const task = gantt.getTask(id);
                const currentDays = task.start_date && task.end_date
                    ? Math.ceil((new Date(task.end_date).getTime() - new Date(task.start_date).getTime()) / 86400000) + 1
                    : task.duration || 0;
                placeholder.innerHTML = `<input type="number" min="1" style="width:100%;height:100%;border:none;outline:none;padding:0 4px;font-size:13px;text-align:center;" value="${currentDays}">`;
                const input = placeholder.querySelector('input');
                input.focus();
                input.select();
            },
            hide: function () { },
            set_value: function (value: any, id: any, column: any, node: any) {
                const input = node.querySelector('input');
                if (input) input.value = value;
            },
            get_value: function (id: any, column: any, node: any) {
                const input = node.querySelector('input');
                return input ? parseInt(input.value) || 1 : 1;
            },
            is_changed: function (value: any, id: any, column: any, node: any) {
                const input = node.querySelector('input');
                const newVal = parseInt(input?.value) || 1;
                const task = gantt.getTask(id);
                const currentDays = task.start_date && task.end_date
                    ? Math.ceil((new Date(task.end_date).getTime() - new Date(task.start_date).getTime()) / 86400000) + 1
                    : task.duration || 0;
                return newVal !== currentDays;
            },
            is_valid: function (value: any, id: any, column: any, node: any) {
                const input = node.querySelector('input');
                return parseInt(input?.value) > 0;
            },
            save: function (id: any, column: any, node: any) { },
            focus: function (node: any) {
                const input = node.querySelector('input');
                if (input) { input.focus(); input.select(); }
            }
        };

        const ganttContainerElement = ganttContainer.current;

        const getScaleByDays = (totalDays: number) => {
            if (totalDays <= 35) {
                return [
                    { unit: 'month', step: 1, format: '%F, %Y' },
                    { unit: 'day', step: 1, format: '%j' } // Cambiado de '%d/%m' a '%j'
                ];
            } else if (totalDays <= 120) {
                return [
                    { unit: 'month', step: 1, format: '%F, %Y' },
                    { unit: 'week', step: 1, format: 'Sem %W' }
                ];
            } else {
                return [
                    { unit: 'year', step: 1, format: '%Y' },
                    { unit: 'month', step: 1, format: '%F' }
                ];
            }
        };
        // ─────────────────────────────────────────────────────────────────────────────
        // PAN - ARRASTRAR EN EL DIAGRAMA (4 DIRECCIONES)
        // ─────────────────────────────────────────────────────────────────────────────
        let isDraggingGantt = false;
        let startX = 0;
        let startY = 0;
        let scrollLeftStart = 0;
        let scrollTopStart = 0;

        const onMouseDown = (e: MouseEvent) => {
            const target = e.target as HTMLElement;

            // Verificar si el clic está en la tabla izquierda (NO activar)
            if (target.closest('.gantt_grid, .gantt_grid_head, .gantt_grid_data, .gantt_row')) {
                return;
            }

            // Activar en cualquier parte del diagrama derecho
            if (!target.closest('.gantt_task, .gantt_task_bg, .gantt_data_area, .gantt_chart, .gantt_task_row')) {
                return;
            }

            isDraggingGantt = true;
            startX = e.clientX;
            startY = e.clientY;

            // Contenedor horizontal (mueve barras izquierda/derecha)
            const horizontalScroller = document.querySelector('.gantt_data_area') as HTMLElement;
            if (horizontalScroller) {
                scrollLeftStart = horizontalScroller.scrollLeft;
            }

            // Contenedor vertical (mueve arriba/abajo)
            const verticalScroller = document.querySelector('.gantt_grid_data') as HTMLElement;
            if (verticalScroller) {
                scrollTopStart = verticalScroller.scrollTop;
            }

            e.preventDefault();
            document.body.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!isDraggingGantt) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            const horizontalScroller = document.querySelector('.gantt_data_area') as HTMLElement;
            const verticalScroller = document.querySelector('.gantt_grid_data') as HTMLElement;

            if (horizontalScroller) {
                horizontalScroller.scrollLeft = scrollLeftStart - dx;
            }

            if (verticalScroller) {
                verticalScroller.scrollTop = scrollTopStart - dy;
            }

            e.preventDefault();
        };

        const onMouseUp = () => {
            isDraggingGantt = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);

        (gantt as any).__panHandlers = {
            mousedown: onMouseDown,
            mousemove: onMouseMove,
            mouseup: onMouseUp
        };
        // ── Cargar datos ──────────────────────────────────────────────────────
        let rawData: { tasks: any[]; links: any[] };
        if (initialData?.tasks?.length || initialData?.links?.length) {
            rawData = typeof initialData === 'string' ? JSON.parse(initialData) : initialData;
        } else if (partidasBase?.tasks?.length) {
            rawData = partidasBase;
        } else {
            rawData = { tasks: [], links: [] };
        }


        const fmt = gantt.date.date_to_str('%Y-%m-%d %H:%i');

        //  LIMPIAR TAREAS ANTES DE CARGAR

        const cleanTasks = rawData.tasks.map((task: any) => {
            // Forzar duración positiva (mínimo 1, máximo 365)
            let cleanDuration = task.duration;
            if (cleanDuration <= 0 || isNaN(cleanDuration) || cleanDuration > 1000) {
                cleanDuration = 5;
            }

            // Forzar fecha de inicio válida (año >= 2020)
            let cleanStartDate = task.start_date ? new Date(task.start_date) : new Date();
            if (isNaN(cleanStartDate.getTime()) || cleanStartDate.getFullYear() < 2020) {
                cleanStartDate = new Date(2026, 4, 1); // 01/05/2026
            }

            // Crear tarea limpia SOLO con las propiedades necesarias
            return {
                id: task.id,
                text: task.text,
                parent: task.parent || 0,
                cost: task.cost || 0,
                item: task.item || '',
                originalItem: task.originalItem || task.item || '',
                progress: task.progress || 0,
                owner: task.owner || '',
                type: task.type,
                $open: true,
                start_date: fmt(cleanStartDate),
                duration: cleanDuration
                //  NO incluir end_date
            };
        });

        gantt.clearAll();

        if (cleanTasks.length > 0) {
            const parsedData = cleanTasks.map((task: any) => {
                const hasChildren = cleanTasks.some(
                    (other: any) => String(other.parent) === String(task.id)
                );

                return {
                    ...task,
                    type: hasChildren ? gantt.config.types.project : gantt.config.types.task,
                };
            });

            gantt.parse({
                data: parsedData,
                links: rawData.links || []
            });

            gantt.eachTask((task: any) => {
                if (!gantt.hasChild(task.id)) recalcParentDates(task.id);
            });
        }

        gantt.render();
        updateCountersAndItems();
        markCriticalTasks();
        refreshKPIs();

        setTimeout(() => {
            if (!ganttInitialized.current) return;
            gantt.eachTask((task: any) => { task.$open = true; });
            gantt.render();
            refreshKPIs();
            if (gantt.config.start_date) gantt.showDate(gantt.config.start_date);
        }, 100);

        //  LIMPIEZA AL DESMONTAR EL COMPONENTE
        return () => {
            // Limpiar eventos de pan
            if ((gantt as any).__panHandlers) {
                document.removeEventListener('mousedown', (gantt as any).__panHandlers.mousedown);
                document.removeEventListener('mousemove', (gantt as any).__panHandlers.mousemove);
                document.removeEventListener('mouseup', (gantt as any).__panHandlers.mouseup);
                delete (gantt as any).__panHandlers;
            }

            // Resto de limpieza
            eventIdsRef.current.forEach((evtId) => {
                try { gantt.detachEvent(evtId); } catch { /* ok */ }
            });
            eventIdsRef.current = [];
            ganttInitialized.current = false;
            gantt.clearAll();
        };
    }, [initialData, partidasBase]);


    useEffect(() => {
        if (!ganttInitialized.current) return;
        gantt.templates.task_text = (_s: Date, _e: Date, task: any) => {
            if (!showTaskLabels) return '';
            return gantt.hasChild(task.id)
                ? `<span class="monto-flotante-final">${formatSoles(task.cost || 0)}</span>`
                : `<span class="gantt-task-label" style="font-size:11px;font-weight:500;color:#fff;">${task.text}</span>`;
        };
        gantt.render();
    }, [showTaskLabels]);

    useEffect(() => {
        (window as any).__openPredModal = (taskId: any) => { setPredTaskId(taskId); setPredOpen(true); };
        return () => { delete (window as any).__openPredModal; };
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (!ganttInitialized.current) return;
            document.querySelectorAll('.gantt_grid_head_cell').forEach((header, idx) => {
                const col = gantt.config.columns[idx];
                if (!col || col.name === 'add' || col.name === 'rownum') return;
                if (header.querySelector('.pcl-hide-col')) return;

                const btn = document.createElement('button');
                btn.innerHTML = '✕';
                btn.className = 'pcl-hide-col';
                btn.title = 'Ocultar columna';
                btn.style.cssText = `
                    position:absolute;right:4px;top:50%;transform:translateY(-50%);
                    width:16px;height:16px;border-radius:3px;border:none;
                    background:rgba(0,0,0,0.1);color:#666;font-size:10px;
                    cursor:pointer;display:none;align-items:center;justify-content:center;
                    padding:0;line-height:1;
                `;
                const headerEl = header as HTMLElement;
                headerEl.style.position = 'relative';
                headerEl.addEventListener('mouseenter', () => btn.style.display = 'flex');
                headerEl.addEventListener('mouseleave', () => btn.style.display = 'none');
                btn.onclick = (e) => {
                    e.stopPropagation();
                    if (confirm(`¿Ocultar columna "${col.label}"?`)) {
                        gantt.config.columns = gantt.config.columns.filter((c: any) => c.name !== col.name);
                        gantt.render();
                        showToast(`Columna "${col.label}" ocultada. Recarga para restaurar.`, 'info');
                    }
                };
                headerEl.appendChild(btn);
            });
        }, 200);
        return () => clearTimeout(timer);
    }, []);

    const breadcrumbs = useMemo(() => [
        { title: 'Costos', href: '/costos' },
        { title: displayName, href: `/costos/${project}` },
        { title: 'Cronograma General', href: '#' },
    ], [displayName, project]);

    const progressPct = Math.min(Math.round(projectProgress), 100);
    const budgetUsed = total_budget > 0 ? Math.min((totalCost / total_budget) * 100, 100) : 0;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Cronograma – ${displayName}`} />

            <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
                <header className="pcl-header">
                    <div className="pcl-header__top">
                        <div className="pcl-header__project">
                            <div className="pcl-header__icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                </svg>
                            </div>
                            <div>
                                <p className="pcl-header__label">CRONOGRAMA GENERAL DE OBRA</p>
                                <h1 className="pcl-header__title">{displayName}</h1>
                            </div>
                        </div>

                        <div className="pcl-kpis">
                            <div className="pcl-kpi">
                                <span className="pcl-kpi__value">{taskCount.toLocaleString()}</span>
                                <span className="pcl-kpi__label">Partidas</span>
                            </div>
                            <div className="pcl-kpi pcl-kpi--cost">
                                <span className="pcl-kpi__value">{formatSoles(totalCost)}</span>
                                <span className="pcl-kpi__label">Costo Total Asignado</span>
                            </div>
                            {total_budget > 0 && (
                                <div className="pcl-kpi pcl-kpi--budget">
                                    <span className="pcl-kpi__value">{formatSoles(total_budget)}</span>
                                    <span className="pcl-kpi__label">Presupuesto Base</span>
                                </div>
                            )}
                            <div className="pcl-kpi pcl-kpi--progress">
                                <div className="pcl-kpi__progress-ring">
                                    <svg viewBox="0 0 36 36">
                                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e3a5f" strokeWidth="2.5" />
                                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#22d3ee" strokeWidth="2.5"
                                            strokeDasharray={`${progressPct} ${100 - progressPct}`}
                                            strokeDashoffset="25" strokeLinecap="round" />
                                    </svg>
                                    <span>{progressPct}%</span>
                                </div>
                                <span className="pcl-kpi__label">Avance</span>
                            </div>
                        </div>
                    </div>

                    {total_budget > 0 && (
                        <div className="pcl-budget-bar">
                            <div className="pcl-budget-bar__track">
                                <div className="pcl-budget-bar__fill" style={{ width: `${budgetUsed}%` }} />
                            </div>
                            <span className="pcl-budget-bar__label">Ejecución presupuestal: {budgetUsed.toFixed(1)}%</span>
                        </div>
                    )}

                    <nav className="pcl-toolbar">
                        <div className="pcl-toolbar__group">
                            <span className="pcl-toolbar__group-label">VISTA</span>
                            <button onClick={expandAll} className="pcl-btn pcl-btn--ghost">
                                <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                                <span>Expandir</span>
                            </button>
                            <button onClick={collapseAll} className="pcl-btn pcl-btn--ghost">
                                <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" /></svg>
                                <span>Colapsar</span>
                            </button>
                        </div>

                        <div className="pcl-toolbar__group">
                            <span className="pcl-toolbar__group-label">BUSCAR</span>
                            <div className="pcl-search">
                                <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" /></svg>
                                <input
                                    type="text" placeholder="Buscar partida o ítem..."
                                    value={searchTerm} onChange={(e) => handleSearch(e.target.value)}
                                />
                                {searchTerm && <button onClick={() => handleSearch('')} aria-label="Limpiar búsqueda">✕</button>}
                            </div>
                        </div>

                        <button onClick={() => setShowTaskLabels(p => !p)} className="pcl-btn pcl-btn--ghost">
                            {showTaskLabels ? '🏷️ Ocultar etiquetas' : '🏷️ Mostrar etiquetas'}
                        </button>

                        <div className="pcl-toolbar__group">
                            <span className="pcl-toolbar__group-label">ANÁLISIS</span>
                            <button onClick={toggleCriticalPath} className={`pcl-btn ${criticalOn ? 'pcl-btn--danger' : 'pcl-btn--ghost'}`}>
                                <span className={`pcl-btn__dot ${criticalOn ? 'pcl-btn__dot--active' : ''}`} />
                                Ruta Crítica
                            </button>
                        </div>

                        <div className="pcl-toolbar__group">
                            <span className="pcl-toolbar__group-label">PROGRAMACIÓN</span>
                            <button
                                onClick={toggleAutoScheduling}
                                className={`pcl-btn ${autoScheduling ? 'pcl-btn--success' : 'pcl-btn--ghost'}`}
                                title={autoScheduling ? 'Desactivar auto-programado' : 'Activar auto-programado'}
                            >
                                🤖 {autoScheduling ? 'Auto' : 'Manual'}
                            </button>
                        </div>

                        <div className="pcl-toolbar__group">
                            <span className="pcl-toolbar__group-label">PROYECTO</span>
                            <button onClick={handleImport} disabled={importing} className="pcl-btn pcl-btn--warning">
                                {importing
                                    ? <span className="pcl-spinner" />
                                    : <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" /></svg>}
                                <span>Importar</span>
                            </button>
                            <button onClick={() => setIsSettingsOpen(true)} className="pcl-btn pcl-btn--ghost">
                                <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" /></svg>
                                <span>Ajustes</span>
                            </button>


                        </div>

                        <button onClick={handleSave} disabled={saving} className="pcl-btn pcl-btn--primary pcl-btn--save">
                            {saving
                                ? <span className="pcl-spinner" />
                                : <svg viewBox="0 0 20 20" fill="currentColor"><path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" /></svg>}
                            <span>Guardar Cronograma</span>
                        </button>
                    </nav>
                </header>

                <div className="flex-1 relative">
                    <div
                        ref={ganttContainer}
                        className="pcl-gantt-wrapper"
                        style={{ height: 'calc(100vh - 180px)', width: '100%' }}
                    />
                </div>

                <PredecessorsModal isOpen={predOpen} taskId={predTaskId} onClose={() => setPredOpen(false)} />
                <ProjectSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onApply={handleApplySettings} />
            </div>

        </AppLayout>
    );

};


export default CronogramaIndex;     
