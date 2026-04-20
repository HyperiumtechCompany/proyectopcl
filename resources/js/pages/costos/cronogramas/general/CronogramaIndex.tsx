import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { PredecessorsModal } from './components/PredecessorsModal';
import { ProjectSettingsModal } from './components/ProjectSettingsModal';
import {
    applyAutoScheduling,
    enforceProjectBounds,
    getSubtreeDates,
    markCriticalTasks,
    parsePredecessorText,
    updateCountersAndItems,
    updatePredecessorsText,
    LINK_LABELS,
    LINK_NAMES,
} from './helpers/ganttHelpers';

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────────────────

/** Formatea un número como moneda peruana (S/.) */
const formatSoles = (value: number | string | null | undefined): string => {
    const num = parseFloat(String(value ?? 0));
    if (isNaN(num)) return 'S/. 0.00';
    return new Intl.NumberFormat('es-PE', {
        style: 'currency',
        currency: 'PEN',
        minimumFractionDigits: 2,
    })
        .format(num)
        .replace('PEN', 'S/.');
};

/**
 * Toast de notificación en la esquina inferior derecha.
 * Se auto-elimina a los 3 segundos.
 */
const showToast = (message: string, type: 'success' | 'error' | 'info'): void => {
    const toast = document.createElement('div');
    toast.className = `pcl-toast pcl-toast--${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => toast.classList.add('pcl-toast--visible'));
    });
    setTimeout(() => {
        toast.classList.remove('pcl-toast--visible');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 3000);
};

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
    /** Evita actualizaciones recursivas al propagar fechas/costos a padres */
    const isUpdatingRef = useRef(false);
    /** Estado de ruta crítica usado en closures del gantt (sin causar re-renders) */
    const criticalOnRef = useRef(true);
    /** Evita que parsePredecessorText se llame a sí mismo en cascada */
    const isParsingPredRef = useRef(false);
    /** ¿El gantt ya fue inicializado? Evita llamar refreshKPIs antes de init() */
    const ganttInitialized = useRef(false);
    /** IDs de eventos registrados para cleanup correcto al desmontar */
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

    const displayName = project_name || `Proyecto ${project}`;

    // ─────────────────────────────────────────────────────────────────────────
    // KPIs
    // Recorre solo tareas hoja (sin hijos) para calcular conteos y costos.
    // ─────────────────────────────────────────────────────────────────────────
    const refreshKPIs = useCallback(() => {
        if (!ganttInitialized.current) return;

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
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // PROPAGAR FECHAS AL PADRE
    // Cuando un hijo cambia fechas, el padre se expande para cubrir
    // el rango de todos sus hijos. Se propaga recursivamente hacia arriba.
    // ─────────────────────────────────────────────────────────────────────────
    const updateParentDates = useCallback((childId: any) => {
        let task: any;
        try { task = gantt.getTask(childId); } catch { return; }
        if (!task?.parent || !gantt.isTaskExists(task.parent)) return;

        const parent: any = gantt.getTask(task.parent);
        let minStart: Date | null = null;
        let maxEnd: Date | null = null;

        gantt.getChildren(parent.id).forEach((id: any) => {
            const t: any = gantt.getTask(id);
            if (!t?.start_date || !t?.end_date) return;
            const s = new Date(t.start_date);
            const e = new Date(t.end_date);
            if (!minStart || s < minStart) minStart = s;
            if (!maxEnd || e > maxEnd) maxEnd = e;
        });

        if (minStart && maxEnd) {
            const pStart = new Date((parent as any).start_date).getTime();
            const pEnd = new Date((parent as any).end_date).getTime();
            const nStart = (minStart as any).getTime();
            const nEnd = (maxEnd as any).getTime();

            if (pStart !== nStart || pEnd !== nEnd) {
                (parent as any).start_date = minStart;
                (parent as any).end_date = maxEnd;
                gantt.updateTask(parent.id);
                updateParentDates(parent.id); // propagar hacia arriba
            }
        }
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // PROPAGAR COSTOS AL PADRE
    // Suma costos de todos los hijos directos y actualiza el padre.
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
        gantt.config.auto_scheduling = next;
        gantt.config.auto_scheduling_strict = next;
        if (next) applyAutoScheduling();
        gantt.render();
        showToast(next ? '🤖 Auto-programado activado' : '🔧 Modo manual activado', 'info');
    }, [autoScheduling]);

    const expandAll = useCallback(() => {
        gantt.eachTask((t: any) => { t.$open = true; });
        gantt.render();
    }, []);

    const collapseAll = useCallback(() => {
        gantt.eachTask((t: any) => { if (gantt.hasChild(t.id)) t.$open = false; });
        gantt.render();
    }, []);

    /** Ajusta la escala para mostrar todo el proyecto con márgenes de 1 semana */
    const fitProject = useCallback(() => {
        // 🔥 Verificar si las fechas existentes son VÁLIDAS (año > 2000)
        const hasValidDates = gantt.config.start_date &&
            gantt.config.start_date.getFullYear() > 2000 &&
            gantt.config.end_date &&
            gantt.config.end_date.getFullYear() > 2000;

        if (hasValidDates) {
            // Solo mover la vista al inicio
            if (gantt.config.start_date) {
                gantt.showDate(gantt.config.start_date);
            }
            gantt.render();
            return;
        }

        // Si no hay fechas válidas, calcular desde las tareas
        let minDate: Date | null = null;
        let maxDate: Date | null = null;

        gantt.eachTask((task: any) => {
            if (task.start_date && task.end_date) {
                const s = new Date(task.start_date);
                const e = new Date(task.end_date);
                if (!minDate || s < minDate) minDate = s;
                if (!maxDate || e > maxDate) maxDate = e;
            }
        });

        if (minDate && maxDate) {
            const s = new Date(minDate); s.setDate(s.getDate() - 7);
            const e = new Date(maxDate); e.setDate(e.getDate() + 7);
            gantt.config.start_date = s;
            gantt.config.end_date = e;
            gantt.render();
        } else {
            // 🔥 Si no hay tareas, usar fechas por defecto (abril 2026)
            gantt.config.start_date = new Date(2026, 3, 1);
            gantt.config.end_date = new Date(2026, 3, 30);
            gantt.render();
        }
    }, []);

    const adjustView = useCallback(() => {
        if (gantt.config.start_date) {
            setTimeout(() => {
                if (gantt.config.start_date) {
                    gantt.showDate(gantt.config.start_date);
                }
            }, 100);
        }
        gantt.render();
    }, []);

    /** Filtra filas por texto o número de fila */
    const handleSearch = useCallback((term: string) => {
        setSearchTerm(term);
        const val = term.trim().toLowerCase();
        const isNum = /^\d+$/.test(val);
        const target = isNum ? parseInt(val, 10) : null;

        gantt.eachTask((t: any) => {
            if (!val) {
                t.$open = true;
            } else {
                const row = gantt.getGlobalTaskIndex(t.id) + 1;
                const matchRow = target !== null && row === target;
                const matchText = t.text?.toLowerCase().includes(val) || t.item?.toLowerCase().includes(val);
                t.$open = matchRow || matchText;
                if (t.$open) gantt.showTask(t.id);
            }
        });

        gantt.render();
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // GUARDAR CRONOGRAMA
    // Expande todo el árbol para capturar tareas colapsadas, serializa
    // tareas y links, y los envía al backend.
    // ─────────────────────────────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        setSaving(true);
        gantt.eachTask((task: any) => { task.$open = true; });
        gantt.render();
        await new Promise<void>((r) => setTimeout(r, 100));

        const pid = Number(cronogramaId) || Number(project);
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
            item_p: t.item_p || t.item,
            cost: t.cost || 0,
            predecessors: t.predecessors || '',
            progress: t.progress || 0,
            open: true,
            originalItem: t.originalItem || t.item,
            presupuesto_item_id: t.presupuesto_item_id || null,
            unidad: t.unidad || '',
            owner: t.owner || '',
        }));

        const links = gantt.getLinks().map((l: any) => ({
            id: l.id,
            source: l.source,
            target: l.target,
            type: l.type,
        }));

        try {
            await axios.post(`/cronograma/save/${pid}`, { tasks, links });
            showToast('✅ Cronograma guardado correctamente', 'success');
        } catch (err: any) {
            console.error('[handleSave]', err);
            showToast(`❌ Error: ${err?.response?.data?.message ?? err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    }, [cronogramaId, project]);

    // ─────────────────────────────────────────────────────────────────────────
    // IMPORTAR DESDE PRESUPUESTO
    // Trae las partidas del presupuesto base, infiere la jerarquía WBS
    // y las carga como tareas con 5 días de duración base.
    // ─────────────────────────────────────────────────────────────────────────
    const handleImport = useCallback(async () => {
        if (!confirm('¿Importar las partidas del presupuesto como tareas?\n\nEsto reemplazará el cronograma actual.')) return;

        setImporting(true);
        try {
            const { data: partidas } = await axios.get(`/presupuesto/${project}/partidas`);
            if (!partidas?.length) throw new Error('No hay partidas en el presupuesto');

            const tasksMap = new Map<string, any>();
            const rootTasks: any[] = [];

            partidas.forEach((partida: any) => {
                const taskId = gantt.uid();
                const task = {
                    id: taskId,
                    text: partida.descripcion,
                    start_date: new Date(),
                    duration: 5,
                    progress: 0,
                    cost: parseFloat(partida.total) || 0,
                    item: partida.partida,
                    originalItem: partida.partida,
                    unidad: partida.unidad || '',
                    parent: 0,
                    $open: true,
                };
                tasksMap.set(partida.partida, task);
                rootTasks.push(task);
            });

            // Inferir jerarquía: "1.2.3" → padre "1.2"
            tasksMap.forEach((task) => {
                const code = task.originalItem as string;
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
            gantt.batchUpdate(() => {
                rootTasks.forEach((t) => gantt.addTask({ ...t, parent: 0 }));
                tasksMap.forEach((t) => { if (t.parent !== 0) gantt.addTask(t); });
            });

            gantt.eachTask((task: any) => { task.$open = true; });
            updateCountersAndItems();
            markCriticalTasks();
            gantt.render();
            refreshKPIs();

            showToast(`✅ ${partidas.length} partidas importadas`, 'success');
        } catch (err: any) {
            showToast(`❌ Error: ${err.message}`, 'error');
        } finally {
            setImporting(false);
        }
    }, [project, refreshKPIs]);

    // ─────────────────────────────────────────────────────────────────────────
    // INICIALIZACIÓN DEL GANTT
    // Se ejecuta UNA VEZ al montar (o cuando cambian initialData/partidasBase).
    // El return hace cleanup de todos los eventos al desmontar.
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!ganttContainer.current) return;

        // Reset completo antes de inicializar
        ganttContainer.current.innerHTML = '';
        gantt.clearAll();
        ganttInitialized.current = false;
        eventIdsRef.current = [];

        // ── Plugins ───────────────────────────────────────────────────────────
        gantt.plugins({
            critical_path: true,
            auto_scheduling: true,
            tooltip: true
        });
        gantt.i18n.setLocale('es');

        // ── Configuración global ──────────────────────────────────────────────
        // ── Configuración global corregida ──────────────────────────────────────────────
        gantt.config.date_format = '%Y-%m-%d %H:%i';
        gantt.config.xml_date = '%d/%m/%Y';
        gantt.config.row_height = 32;
        gantt.config.grid_width = 500;
        gantt.config.scale_height = 54;
        gantt.config.min_column_width = 30;
        gantt.config.open_tree_initially = true;
        gantt.config.work_time = true;
        gantt.config.skip_off_time = true;
        gantt.config.fit_tasks = true;

        // AUTO-SCHEDULING: Configuración crítica para relaciones CF
        gantt.config.auto_scheduling = true;
        gantt.config.auto_scheduling_strict = true;
        (gantt.config as any).auto_scheduling_move_projects = true;
        (gantt.config as any).auto_scheduling_initial = true;
        (gantt.config as any).auto_scheduling_compatibility = true; // Permite alineación tope con tope

        gantt.config.autosize = false;
        gantt.config.schedule_from_end = false;
        gantt.config.highlight_critical_path = true;
        gantt.config.show_chart_work_time = true;
        gantt.config.split_tasks = false;
        gantt.config.branch_loading = false;
        gantt.config.limit_view = true;

        // Evita que el calendario separe las barras en relaciones CF
        gantt.config.correct_work_time = false;

        // Otras configuraciones de rendimiento y tipos
        (gantt.config as any).auto_types = true;
        (gantt.config as any).smart_rendering = false;
        (gantt.config as any).static_background = false;

        // Definición de tipos de enlaces
        gantt.config.links = {
            finish_to_start: '0',
            start_to_start: '1',
            finish_to_finish: '2',
            start_to_finish: '3', // Relación CF
        };
        // Días NO laborables por defecto: sábado y domingo
        gantt.setWorkTime({ day: 6, hours: false });
        gantt.setWorkTime({ day: 0, hours: false });


        // Evento para que se actualice al escribir y dar Enter
        const evUpdateCostoTotal = gantt.attachEvent("onAfterTaskUpdate", () => {
            gantt.refreshData();
            return true;
        });
        eventIdsRef.current.push(evUpdateCostoTotal);

        // ── Escalas: Mes relativo + Semana relativa ───────────────────────────
        gantt.config.scales = [
            {
                unit: 'month',
                step: 1,
                format: (date: Date) => {
                    const startDate = gantt.config.start_date || new Date();
                    const monthDiff =
                        (date.getFullYear() - startDate.getFullYear()) * 12 +
                        (date.getMonth() - startDate.getMonth());
                    return `Mes ${monthDiff + 1}`;
                },
            },
            {
                unit: 'week',
                step: 1,
                format: (date: Date) => {
                    const startDate = gantt.config.start_date || new Date();
                    const weekDiff = Math.floor(
                        (date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7)
                    );
                    return `Sem ${weekDiff + 1}`;
                },
                css: (date: Date) => (gantt.isWorkTime(date) ? '' : 'pcl-weekend'),
            },
        ];

        // ── Editores inline ───────────────────────────────────────────────────
        const editors = {
            text: { type: 'text', map_to: 'text' },
            date: { type: 'date', map_to: 'start_date' },
            endDate: { type: 'date', map_to: 'end_date' },
            duration: { type: 'number', map_to: 'duration', min: 0, max: 9999 },
            cost: { type: 'text', map_to: 'cost' },
            progress: { type: 'number', map_to: 'progress', min: 0, max: 1 },
            owner: { type: 'text', map_to: 'owner' },
        };

        // ── Columnas del grid ─────────────────────────────────────────────────
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
                name: 'duration', label: 'DÍAS', align: 'center', width: 60,
                resize: true, editor: editors.duration,
                template: (t: any) => `${t.duration || 0}d`,
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
                name: 'start_date', label: 'INICIO', align: 'center',
                width: 95, resize: true, editor: editors.date,
            },
            {
                name: 'end_date', label: 'FIN', align: 'center',
                width: 95, resize: true, editor: editors.endDate,
                template: (t: any) => {
                    try { return gantt.templates.date_grid(t.end_date, t, 'end_date'); }
                    catch { return ''; }
                },
            },
            {
                name: 'predecessors', label: 'PREDECESORAS', align: 'center',
                width: 110, resize: true,
                editor: { type: 'text', map_to: 'predecessors' },
                template: (task: any) => {
                    const labels = gantt
                        .getLinks()
                        .filter((l: any) => String(l.target) === String(task.id))
                        .map((l: any) => {
                            try {
                                const rownum = gantt.getGlobalTaskIndex(l.source) + 1;
                                return `${rownum}${LINK_LABELS[l.type] ?? 'FC'}`;
                            } catch { return null; }
                        })
                        .filter(Boolean);

                    return `<div style="display:flex;align-items:center;justify-content:space-between;gap:2px;">
                        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;font-size:11px;">${labels.join(', ')}</span>
                        <button onclick="event.stopPropagation();window.__openPredModal(${task.id})"
                            style="background:#e2e8f0;border:1px solid #94a3b8;border-radius:4px;cursor:pointer;font-size:12px;padding:2px 6px;color:#1e293b;">🔗</button>
                    </div>`;
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

        // ── Lightbox ──────────────────────────────────────────────────────────
        gantt.config.lightbox.sections = [
            { name: 'description', height: 38, map_to: 'text', type: 'textarea', focus: true },
            { name: 'time', type: 'duration', map_to: 'auto', time_format: ['%d', '%m', '%Y'] },
            { name: 'cost', height: 22, map_to: 'cost', type: 'text', default_value: '0' },
            { name: 'owner', height: 22, map_to: 'owner', type: 'text', default_value: '' },
        ];
        gantt.locale.labels.section_cost = 'Costo Parcial (S/.)';
        gantt.locale.labels.section_owner = 'Responsable';

        // ── Templates de estilos dinámicos ────────────────────────────────────

        gantt.templates.task_class = (_s: Date, _e: Date, task: any) => {
            const cls: string[] = [];
            if (gantt.hasChild(task.id)) cls.push('pcl-task-parent');
            if (criticalOnRef.current) {
                try {
                    const isCrit = typeof gantt.isCriticalTask === 'function'
                        ? gantt.isCriticalTask(task)
                        : task._critical;
                    if (isCrit) cls.push('gantt_critical_task');
                } catch { /* plugin no disponible */ }
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
                '0': 'gantt_link_fc', '1': 'gantt_link_cc',
                '2': 'gantt_link_ff', '3': 'gantt_link_cf',
            };
            if (typeMap[link.type]) cls.push(typeMap[link.type]);
            return cls.join(' ');
        };

        gantt.templates.link_description = (link: any) => {
            try {
                return `${gantt.getTask(link.source).text} (${LINK_NAMES[link.type]}) → ${gantt.getTask(link.target).text}`;
            } catch { return ''; }
        };

        gantt.templates.tooltip_text = (start: Date, end: Date, task: any) => {
            const isCrit = (() => {
                try {
                    return typeof gantt.isCriticalTask === 'function'
                        ? gantt.isCriticalTask(task) : task._critical;
                } catch { return false; }
            })();
            const pct = Math.round((parseFloat(task.progress) || 0) * 100);
            const predLabels = gantt.getLinks()
                .filter((l: any) => String(l.target) === String(task.id))
                .map((l: any) => {
                    try {
                        const rownum = gantt.getGlobalTaskIndex(l.source) + 1;
                        return `${rownum}${LINK_LABELS[l.type]}`;
                    } catch { return null; }
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


        gantt.templates.task_text = (_s: Date, _e: Date, task: any) =>
            gantt.hasChild(task.id)
                ? ''
                : `<span style="font-size:11px;font-weight:500;color:#fff;">${task.text}</span>`;

        gantt.templates.scale_cell_class = (date: Date) =>
            !gantt.isWorkTime(date) ? 'pcl-weekend-cell' : '';
        gantt.templates.timeline_cell_class = (_t: any, date: Date) =>
            !gantt.isWorkTime(date) ? 'pcl-weekend-cell' : '';

        // ── Helper: registrar evento con cleanup automático ───────────────────
        const on = (event: string, handler: (...args: any[]) => any) => {
            eventIdsRef.current.push((gantt as any).attachEvent(event, handler));
        };

        // ── EVENTOS ───────────────────────────────────────────────────────────

        /**
         * onTaskCreated: valores por defecto al crear una tarea nueva.
         * FIX: eliminamos onTaskLoading con hasChild (siempre false en carga).
         * auto_types=true hace ese trabajo correctamente.
         */
        on('onTaskCreated', (task: any) => {
            task.start_date = new Date();
            task.end_date = gantt.date.add(task.start_date, 1, 'day');
            task.cost = 0;
            task.progress = 0;
            return true;
        });

        /**
         * onAfterTaskUpdate: el evento más importante.
         * Maneja en orden:
         *   1. Sincronizar predecesoras si el usuario editó el campo de texto
         *   2. Validar límites del proyecto (usando enforceProjectBounds del helper)
         *   3. Propagar fechas y costos hacia el padre
         */
        on('onAfterTaskUpdate', (id: any, item: any) => {
            const task = gantt.getTask(id);
            if (gantt.hasChild(id) && task.cost) {
                // Forzar render para que el template se actualice
                gantt.render();
            }

            // ── 1. Predecesoras editadas en la celda de texto ─────────────────
            const rawText = String(item.predecessors ?? '').trim();

            // Construir el texto actual desde los links reales para comparar
            const currentLinksText = gantt
                .getLinks()
                .filter((l: any) => String(l.target) === String(id))
                .map((l: any) => {
                    const rownum = gantt.getGlobalTaskIndex(l.source) + 1;
                    return `${rownum}${LINK_LABELS[l.type] ?? 'FC'}`;
                })
                .join(', ');

            // Solo parsear si el usuario realmente cambió el texto
            // (no si el cambio vino de auto-scheduling o de propagación de padre/hijo)
            const isInternalUpdate = isUpdatingRef.current || isParsingPredRef.current;
            const predChanged = !isInternalUpdate && (
                (rawText !== '' && rawText.toUpperCase() !== currentLinksText.toUpperCase()) ||
                (rawText === '' && currentLinksText !== '')
            );

            if (predChanged) {
                isParsingPredRef.current = true;
                // FIX: parsePredecessorText del helper ahora también ajusta fechas
                // según el tipo de relación, cosa que antes no hacía la versión local
                parsePredecessorText(id, rawText);
                if (typeof (gantt as any).autoSchedule === 'function') {
                    (gantt as any).autoSchedule();
                }
                markCriticalTasks();
                isParsingPredRef.current = false;
            }

            // ── 2. Validar límites del proyecto ───────────────────────────────
            // FIX: antes este bloque estaba copiado 3 veces. Ahora es una función.
            if (enforceProjectBounds(id)) {
                gantt.updateTask(id);
            }

            // ── 3. Propagar al padre ──────────────────────────────────────────
            if (isUpdatingRef.current) return true;
            isUpdatingRef.current = true;
            try {
                const dates = getSubtreeDates(id);
                if (dates && gantt.hasChild(id)) {
                    const t = gantt.getTask(id);
                    t.start_date = dates.start_date;
                    t.end_date = dates.end_date;
                }
                if (item.parent && gantt.isTaskExists(item.parent)) {
                    updateParentCost(id);
                    updateParentDates(id);
                }
            } finally {
                isUpdatingRef.current = false;
                gantt.render();
                refreshKPIs();
            }
            return true;
        });

        /** onAfterTaskAdd: recalcula WBS y KPIs tras agregar tarea */
        on('onAfterTaskAdd', (id: any) => {
            const task = gantt.getTask(id);
            if (!task.cost) { task.cost = 0; gantt.updateTask(id); }
            updateCountersAndItems();
            applyAutoScheduling();
            markCriticalTasks();
            gantt.render();
            gantt.showTask(id);
            refreshKPIs();
        });

        /** onAfterTaskDelete: recalcula WBS y KPIs tras borrar tarea */
        on('onAfterTaskDelete', () => {
            updateCountersAndItems();
            applyAutoScheduling();
            markCriticalTasks();
            gantt.render();
            refreshKPIs();
        });

        /** onAfterTaskMove: recalcula WBS tras mover tarea en el árbol */
        on('onAfterTaskMove', () => {
            updateCountersAndItems();
            applyAutoScheduling();
            markCriticalTasks();
            gantt.render();
        });

        /**
         * onAfterLinkAdd: sincroniza texto y valida límites tras agregar link.
         * FIX: enforceProjectBounds reemplaza el bloque duplicado.
         */
        on('onAfterLinkAdd', (_id: any, link: any) => {
            updatePredecessorsText(link.target);
            applyAutoScheduling();
            markCriticalTasks();
            if (enforceProjectBounds(link.target)) {
                gantt.updateTask(link.target);
            }
            gantt.render();
        });

        /**
         * onAfterLinkDelete: sincroniza texto y valida límites tras eliminar link.
         * FIX: enforceProjectBounds reemplaza el bloque duplicado.
         */
        on('onAfterLinkDelete', (_id: any, link: any) => {
            try { updatePredecessorsText(link.target); } catch { /* tarea puede haberse eliminado */ }
            applyAutoScheduling();
            markCriticalTasks();
            try {
                if (enforceProjectBounds(link.target)) {
                    gantt.updateTask(link.target);
                }
            } catch { /* ok */ }
            gantt.render();
        });

        /**
         * onAfterAutoSchedule: recalcula duraciones en días hábiles después de
         * que el auto-scheduling mueve fechas por dependencias.
         */
        on('onAfterAutoSchedule', () => {
            markCriticalTasks();
            gantt.eachTask((task: any) => {
                if (!gantt.hasChild(task.id)) {
                    try {
                        task.duration = gantt.calculateDuration({
                            start_date: task.start_date,
                            end_date: task.end_date,
                            task,
                        });
                        gantt.updateTask(task.id);
                    } catch { /* ok */ }
                }
            });
            refreshKPIs();
        });


        // Mostrar costo encima del corchete de tareas padre
        gantt.templates.task_text = (_s: Date, _e: Date, task: any) => {
            if (gantt.hasChild(task.id)) {
                const monto = formatSoles(task.cost || 0);
                return `<span class="monto-flotante-final">${monto}</span>`;
            }
            return `<span style="font-size:11px;font-weight:500;color:#fff;">${task.text}</span>`;
        };


        // ── Inicializar el Gantt en el DOM ────────────────────────────────────
        gantt.init(ganttContainer.current);
        ganttInitialized.current = true;

        // ── Cargar datos ──────────────────────────────────────────────────────
        // Prioridad: initialData (guardado) > partidasBase > vacío
        let rawData: { tasks: any[]; links: any[] };
        if (initialData) {
            rawData = typeof initialData === 'string' ? JSON.parse(initialData) : initialData;
        } else if (partidasBase?.tasks?.length) {
            rawData = partidasBase;
        } else {
            rawData = { tasks: [], links: [] };
        }

        gantt.batchUpdate(() => {
            gantt.parse(rawData);
            gantt.eachTask((task: any) => {
                task.$open = true;
                // Normalizar duraciones excesivas en tareas hoja
                if (!gantt.hasChild(task.id) && task.duration > 30) {
                    task.duration = 5;
                    if (task.start_date) {
                        task.end_date = gantt.calculateEndDate({
                            start_date: task.start_date,
                            duration: 5,
                            task,
                        });
                    }
                }
            });
        });

        // 🔥 AGREGAR ESTO: Establecer fechas por defecto si son inválidas
        if (!gantt.config.start_date || gantt.config.start_date.getFullYear() < 2000) {
            gantt.config.start_date = new Date(2026, 3, 1);  // 1 de abril 2026
            gantt.config.end_date = new Date(2026, 3, 30);   // 30 de abril 2026
        }

        // Ajustar vista al rango del proyecto
        setTimeout(() => fitProject(), 100);

        // ── Recrear links desde task.predecessors ─────────────────────────────
        // Los datos guardados tienen el texto en formato "3FC, 5CC" (número de fila).
        // Este bloque recrea los links si no existen ya en el gantt.
        gantt.eachTask((task: any) => {
            const predText = task.predecessors;
            if (!predText || typeof predText !== 'string') return;

            predText.split(',').forEach((part: string) => {
                const clean = part.trim().toUpperCase();
                const match = clean.match(/^(\d+)(FC|CC|FF|CF)?$/);
                if (!match) return;

                const targetRownum = parseInt(match[1], 10);
                const type = { FC: '0', CC: '1', FF: '2', CF: '3' }[match[2] ?? 'FC'] ?? '0';

                let sourceTask: any = null;
                gantt.eachTask((t: any) => {
                    if (gantt.getGlobalTaskIndex(t.id) + 1 === targetRownum) sourceTask = t;
                });

                if (sourceTask && String(sourceTask.id) !== String(task.id)) {
                    const exists = gantt.getLinks().some(
                        (l: any) =>
                            String(l.source) === String(sourceTask.id) &&
                            String(l.target) === String(task.id)
                    );
                    if (!exists) {
                        gantt.addLink({ id: gantt.uid(), source: sourceTask.id, target: task.id, type });
                    }
                }
            });
        });



        // Sincronizar texto de predecesoras con los links cargados
        gantt.eachTask((task: any) => { updatePredecessorsText(task.id); });

        // Post-carga
        updateCountersAndItems();
        markCriticalTasks();
        setTimeout(() => { gantt.render(); refreshKPIs(); }, 80);

        // ── Cleanup al desmontar ──────────────────────────────────────────────
        return () => {
            eventIdsRef.current.forEach((evtId) => {
                try { gantt.detachEvent(evtId); } catch { /* ok */ }
            });
            eventIdsRef.current = [];
            ganttInitialized.current = false;
            gantt.clearAll();
        };
    }, [initialData, partidasBase, refreshKPIs, updateParentCost, updateParentDates, fitProject]);

    // ── Modal de predecesoras (función global para el botón HTML del template) ─
    useEffect(() => {
        (window as any).__openPredModal = (taskId: any) => {
            setPredTaskId(taskId);
            setPredOpen(true);
        };
        return () => { delete (window as any).__openPredModal; };
    }, []);

    // ── Aplicar configuración del proyecto ────────────────────────────────────
    // El modal ya configuró los días laborables y desplazó tareas.
    // Aquí solo actualizamos las fechas límite y hacemos render/fitProject.
    const handleApplySettings = useCallback(
        (settings: { projectStart?: string; projectEnd?: string }) => {
            console.log('📥 handleApplySettings recibió:', settings); // 👈 Agrega esto

            if (settings.projectStart && settings.projectStart !== '') {
                gantt.config.start_date = new Date(settings.projectStart);
                console.log('✅ start_date asignado:', gantt.config.start_date); // 👈 Agrega esto
            }
            if (settings.projectEnd && settings.projectEnd !== '') {
                gantt.config.end_date = new Date(settings.projectEnd);
                console.log('✅ end_date asignado:', gantt.config.end_date); // 👈 Agrega esto
            }

            gantt.config.limit_view = true;

            gantt.templates.scale_cell_class = (date: Date) =>
                !gantt.isWorkTime(date) ? 'pcl-weekend-cell' : '';
            gantt.templates.timeline_cell_class = (_t: any, date: Date) =>
                !gantt.isWorkTime(date) ? 'pcl-weekend-cell' : '';

            gantt.render();
            adjustView();
            refreshKPIs();
            setIsSettingsOpen(false);
        },
        [refreshKPIs, adjustView]
    );

    // ── Valores derivados ─────────────────────────────────────────────────────
    const breadcrumbs = useMemo(() => [
        { title: 'Costos', href: '/costos' },
        { title: displayName, href: `/costos/${project}` },
        { title: 'Cronograma General', href: '#' },
    ], [displayName, project]);

    const progressPct = Math.min(Math.round(projectProgress), 100);
    const budgetUsed = total_budget > 0 ? Math.min((totalCost / total_budget) * 100, 100) : 0;

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Cronograma – ${displayName}`} />

            <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">

                {/* HEADER */}
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

                        {/* KPIs */}
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
                            <span className="pcl-budget-bar__label">
                                Ejecución presupuestal: {budgetUsed.toFixed(1)}%
                            </span>
                        </div>
                    )}

                    {/* Toolbar */}
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
                            <button onClick={adjustView} className="pcl-btn pcl-btn--ghost">
                                <svg viewBox="0 0 20 20" fill="currentColor">...</svg>
                                <span>Ajustar</span>
                            </button>
                        </div>

                        <div className="pcl-toolbar__group">
                            <span className="pcl-toolbar__group-label">BUSCAR</span>
                            <div className="pcl-search">
                                <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" /></svg>
                                <input
                                    type="text"
                                    placeholder="Buscar partida o ítem..."
                                    value={searchTerm}
                                    onChange={(e) => handleSearch(e.target.value)}
                                />
                                {searchTerm && (
                                    <button onClick={() => handleSearch('')} aria-label="Limpiar búsqueda">✕</button>
                                )}
                            </div>
                        </div>

                        <div className="pcl-toolbar__group">
                            <span className="pcl-toolbar__group-label">ANÁLISIS</span>
                            <button
                                onClick={toggleCriticalPath}
                                className={`pcl-btn ${criticalOn ? 'pcl-btn--danger' : 'pcl-btn--ghost'}`}
                            >
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
                                {importing ? <span className="pcl-spinner" /> : <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" /></svg>}
                                <span>Importar</span>
                            </button>
                            <button onClick={() => setIsSettingsOpen(true)} className="pcl-btn pcl-btn--ghost">
                                <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" /></svg>
                                <span>Ajustes</span>
                            </button>
                        </div>

                        <button onClick={handleSave} disabled={saving} className="pcl-btn pcl-btn--primary pcl-btn--save">
                            {saving ? <span className="pcl-spinner" /> : <svg viewBox="0 0 20 20" fill="currentColor"><path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" /></svg>}
                            <span>Guardar Cronograma</span>
                        </button>
                    </nav>
                </header>

                {/* GANTT */}
                <div className="flex-1 relative overflow-auto">
                    <div
                        ref={ganttContainer}
                        className="pcl-gantt-wrapper"
                        style={{ minHeight: '500px', height: 'calc(100vh - 180px)', width: '100%' }}
                    />
                </div>

                {/* MODALES */}
                <PredecessorsModal
                    isOpen={predOpen}
                    taskId={predTaskId}
                    onClose={() => setPredOpen(false)}
                />
                <ProjectSettingsModal
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    onApply={handleApplySettings}
                />
            </div>

            {/* ESTILOS */}
            <style>{`
/* ========== HEADER ========== */
.pcl-header{background:linear-gradient(135deg,#0f2140 0%,#162d57 100%);border-bottom:1px solid rgba(34,211,238,0.15);flex-shrink:0;font-family:'Segoe UI',system-ui,sans-serif}
.pcl-header__top{display:flex;align-items:center;justify-content:space-between;padding:10px 16px 8px;gap:12px}
.pcl-header__project{display:flex;align-items:center;gap:10px;min-width:0}
.pcl-header__icon{width:36px;height:36px;background:rgba(34,211,238,0.12);border:1px solid rgba(34,211,238,0.3);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#22d3ee}
.pcl-header__icon svg{width:18px;height:18px}
.pcl-header__label{font-size:9px;font-weight:700;letter-spacing:.12em;color:rgba(34,211,238,0.7);text-transform:uppercase;margin:0}
.pcl-header__title{font-size:14px;font-weight:700;color:#fff;margin:0;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:500px}

/* ========== KPIs ========== */
.pcl-kpis{display:flex;align-items:center;gap:6px;flex-shrink:0}
.pcl-kpi{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:5px 12px;text-align:center;min-width:80px}
.pcl-kpi--cost,.pcl-kpi--budget{min-width:140px}
.pcl-kpi--progress{display:flex;align-items:center;gap:8px;padding:5px 10px}
.pcl-kpi__value{display:block;font-size:15px;font-weight:700;color:#fff;font-variant-numeric:tabular-nums;white-space:nowrap}
.pcl-kpi--cost .pcl-kpi__value{color:#6ee7b7}
.pcl-kpi--budget .pcl-kpi__value{color:#22d3ee}
.pcl-kpi__label{font-size:9px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:.08em}
.pcl-kpi__progress-ring{position:relative;width:34px;height:34px;flex-shrink:0}
.pcl-kpi__progress-ring svg{width:34px;height:34px;transform:rotate(-90deg)}
.pcl-kpi__progress-ring span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#22d3ee}

/* ========== BARRA PRESUPUESTAL ========== */
.pcl-budget-bar{display:flex;align-items:center;gap:10px;padding:0 16px 6px}
.pcl-budget-bar__track{flex:1;height:3px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden}
.pcl-budget-bar__fill{height:100%;background:linear-gradient(90deg,#10b981,#22d3ee);border-radius:2px;transition:width .6s ease}
.pcl-budget-bar__label{font-size:10px;color:rgba(255,255,255,0.45);white-space:nowrap}

/* ========== TOOLBAR ========== */
.pcl-toolbar{display:flex;align-items:center;gap:4px;padding:4px 16px 6px;border-top:1px solid rgba(255,255,255,0.06);overflow-x:auto}
.pcl-toolbar__group{display:flex;align-items:center;gap:3px;padding-right:10px;border-right:1px solid rgba(255,255,255,0.1);margin-right:6px}
.pcl-toolbar__group:last-of-type{border-right:none}
.pcl-toolbar__group-label{font-size:8px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:.1em;text-transform:uppercase;margin-right:4px;white-space:nowrap}

/* ========== BOTONES ========== */
.pcl-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:4px;font-size:11px;font-weight:600;border:none;cursor:pointer;transition:all .15s ease;white-space:nowrap;font-family:'Segoe UI',system-ui,sans-serif}
.pcl-btn svg{width:13px;height:13px;flex-shrink:0}
.pcl-btn--ghost{background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.8);border:1px solid rgba(255,255,255,0.12)}
.pcl-btn--ghost:hover{background:rgba(255,255,255,0.14);color:#fff}
.pcl-btn--danger{background:rgba(239,68,68,0.2);color:#fca5a5;border:1px solid rgba(239,68,68,0.4)}
.pcl-btn--danger:hover{background:rgba(239,68,68,0.35)}
.pcl-btn--warning{background:rgba(245,158,11,0.2);color:#fcd34d;border:1px solid rgba(245,158,11,0.4)}
.pcl-btn--warning:hover{background:rgba(245,158,11,0.35)}
.pcl-btn--success{background:rgba(16,185,129,0.2);color:#6ee7b7;border:1px solid rgba(16,185,129,0.4)}
.pcl-btn--success:hover{background:rgba(16,185,129,0.35)}
.pcl-btn--primary{background:#0ea5e9;color:#fff;border:none}
.pcl-btn--primary:hover{background:#38bdf8}
.pcl-btn--save{padding:5px 14px;font-size:12px}
.pcl-btn:disabled{opacity:.5;cursor:not-allowed}
.pcl-btn__dot{width:7px;height:7px;border-radius:50%;border:2px solid rgba(255,255,255,0.4)}
.pcl-btn__dot--active{background:#f87171;border-color:#f87171}

/* ========== BÚSQUEDA ========== */
.pcl-search{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:4px;padding:4px 8px}
.pcl-search svg{width:13px;height:13px;color:rgba(255,255,255,0.4);flex-shrink:0}
.pcl-search input{background:transparent;border:none;outline:none;color:#fff;font-size:11px;width:180px;font-family:'Segoe UI',system-ui,sans-serif}
.pcl-search input::placeholder{color:rgba(255,255,255,0.35)}
.pcl-search button{background:none;border:none;color:rgba(255,255,255,0.5);cursor:pointer;font-size:12px;padding:0 2px}
.pcl-search button:hover{color:#fff}

/* ========== SPINNER ========== */
.pcl-spinner{width:12px;height:12px;border-radius:50%;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;animation:pcl-spin .7s linear infinite;display:inline-block}
@keyframes pcl-spin{to{transform:rotate(360deg)}}

/* ========== TOAST ========== */
.pcl-toast{position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:8px;font-size:13px;font-weight:600;font-family:'Segoe UI',system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.3);opacity:0;transform:translateY(10px);transition:opacity .3s ease,transform .3s ease;max-width:360px;pointer-events:none}
.pcl-toast--visible{opacity:1;transform:translateY(0)}
.pcl-toast--success{background:#064e3b;color:#6ee7b7;border:1px solid #065f46}
.pcl-toast--error{background:#7f1d1d;color:#fca5a5;border:1px solid #991b1b}
.pcl-toast--info{background:#0c4a6e;color:#7dd3fc;border:1px solid #075985}

/* ========== GANTT - GRID ========== */
.pcl-gantt-wrapper .gantt_container{border:none !important;font-family:'Segoe UI',system-ui,sans-serif !important}
.pcl-gantt-wrapper .gantt_grid{background:#fff}
.pcl-gantt-wrapper .gantt_grid_head_cell{background:#f1f5f9 !important;font-size:10px !important;font-weight:700 !important;text-transform:uppercase !important;letter-spacing:.07em !important;color:#475569 !important;border-right:1px solid #e2e8f0 !important;border-bottom:2px solid #cbd5e1 !important}
.pcl-gantt-wrapper .gantt_cell{font-size:12px !important;color:#334155;border-right:1px solid #f1f5f9 !important}
.pcl-gantt-wrapper .gantt_row:nth-child(even) .gantt_cell{background:#f8fafc}
.pcl-gantt-wrapper .gantt_row:hover .gantt_cell{background:#eff6ff !important}
.pcl-gantt-wrapper .gantt_row.gantt_selected .gantt_cell{background:#dbeafe !important}

/* ========== GANTT - ESCALAS ========== */
.pcl-gantt-wrapper .gantt_scale_cell{font-size:11px !important;font-weight:600 !important;color:#475569;border-right:1px solid #e2e8f0 !important}
.pcl-gantt-wrapper .gantt_scale_line:first-child .gantt_scale_cell{background:#f8fafc !important;font-size:12px !important;color:#1e293b}

/* ========== GANTT - FINES DE SEMANA ========== */
.pcl-weekend-cell,.pcl-gantt-wrapper .gantt_task_cell.pcl-weekend-cell{background:repeating-linear-gradient(45deg,rgba(203,213,225,0.18) 0px,rgba(203,213,225,0.18) 2px,transparent 2px,transparent 8px) !important}
.pcl-gantt-wrapper .gantt_scale_cell.pcl-weekend-cell{color:#94a3b8 !important}
.pcl-gantt-wrapper .gantt_row_task{border-bottom:1px solid #f1f5f9}

/* ========== GANTT - TAREAS HOJA ========== */
.pcl-gantt-wrapper .gantt_task_line{border-radius:3px !important;background:#2563eb !important;border:1px solid #1d4ed8 !important;box-shadow:0 1px 3px rgba(37,99,235,0.3) !important}
.pcl-gantt-wrapper .gantt_task_progress{background:#1d4ed8 !important;opacity:.5 !important}
.pcl-gantt-wrapper .gantt_task_content{font-size:11px !important;font-weight:500 !important;color:#fff !important}

/* ========== GANTT - TAREAS PADRE (corchetes) ========== */
.pcl-gantt-wrapper .gantt_task_line.pcl-task-parent,
.pcl-gantt-wrapper .gantt_task_line.gantt_project{background:transparent !important;border:none !important;box-shadow:none !important}
.pcl-gantt-wrapper .gantt_task_line.pcl-task-parent::before,
.pcl-gantt-wrapper .gantt_task_line.gantt_project::before{content:'' !important;position:absolute !important;top:4px !important;left:0 !important;right:0 !important;height:3px !important;background:#0f172a !important;border-radius:2px !important}
.pcl-gantt-wrapper .gantt_task_line.pcl-task-parent::after,
.pcl-gantt-wrapper .gantt_task_line.gantt_project::after{content:'' !important;position:absolute !important;top:4px !important;left:0 !important;width:100% !important;height:8px !important;border-left:6px solid #0f172a !important;border-right:6px solid #0f172a !important;box-sizing:border-box !important}
.pcl-gantt-wrapper .gantt_task_line.gantt_project .gantt_task_content{display:none !important}

/* ========== GANTT - RUTA CRÍTICA ========== */
.pcl-gantt-wrapper .gantt_critical_task.gantt_task_line{background:#dc2626 !important;border-color:#b91c1c !important;box-shadow:0 0 6px rgba(220,38,38,0.4) !important}
.pcl-gantt-wrapper .gantt_critical_task .gantt_task_progress{background:#991b1b !important}
.pcl-gantt-wrapper .gantt_critical_link .gantt_line_wrapper div{background:#ef4444 !important}
.pcl-gantt-wrapper .gantt_critical_link .gantt_link_arrow{border-color:#ef4444 !important}

/* ========== GANTT - LINKS POR TIPO ========== */
.pcl-gantt-wrapper .gantt_link_fc .gantt_line_wrapper div{background:#3b82f6 !important}
.pcl-gantt-wrapper .gantt_link_cc .gantt_line_wrapper div{background:#10b981 !important}
.pcl-gantt-wrapper .gantt_link_ff .gantt_line_wrapper div{background:#f59e0b !important}
.pcl-gantt-wrapper .gantt_link_cf .gantt_line_wrapper div{background:#ef4444 !important}
.pcl-gantt-wrapper .gantt_link_arrow{border-width:6px !important}
.pcl-gantt-wrapper .gantt_line_wrapper div{background:#64748b !important}

/* ========== GANTT - EDITOR INLINE ========== */
.pcl-gantt-wrapper .gantt_grid_editor_placeholder input{box-sizing:border-box;width:100%;height:100%;border:2px solid #2563eb !important;padding:0 5px;font-size:12px;outline:none;background:#fff;font-family:'Segoe UI',system-ui,sans-serif}

/* ========== GANTT - MARCADOR HOY ========== */
.pcl-gantt-wrapper .gantt_marker.today_marker{background:rgba(239,68,68,0.25) !important;border-left:2px dashed #ef4444 !important}
.pcl-gantt-wrapper .gantt_marker_content{background:#ef4444 !important;color:#fff !important;font-size:10px !important;padding:2px 6px !important;border-radius:0 0 4px 4px !important}

/* ========== GANTT - TOOLTIP ========== */
.pcl-gantt-wrapper .gantt_tooltip{background:#ffffff !important;color:#1e293b !important;border:1px solid #cbd5e1 !important;border-radius:8px !important;padding:0 !important;font-size:12px !important;box-shadow:0 12px 40px rgba(0,0,0,0.15) !important;min-width:260px;overflow:hidden}
.pcl-tooltip{padding:12px 14px;font-family:'Segoe UI',system-ui,sans-serif}
.pcl-tooltip__title{font-weight:700;color:#0f172a;font-size:13px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #e2e8f0;line-height:1.3}
.pcl-tooltip__table{width:100%;border-collapse:collapse;font-size:11px}
.pcl-tooltip__table td{padding:3px 0;vertical-align:top}
.pcl-tooltip__table td:first-child{color:#64748b;padding-right:12px;white-space:nowrap;width:90px}
.pcl-tooltip__table td:last-child{color:#1e293b;font-weight:500}

/* ========== GANTT - SCROLLBAR ========== */
.pcl-gantt-wrapper ::-webkit-scrollbar{width:6px;height:6px}
.pcl-gantt-wrapper ::-webkit-scrollbar-track{background:#f1f5f9}
.pcl-gantt-wrapper ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}
.pcl-gantt-wrapper ::-webkit-scrollbar-thumb:hover{background:#94a3b8}

/* ========== GANTT - SELECCIONADA ========== */
.pcl-gantt-wrapper .gantt_selected .gantt_task_line{box-shadow:0 0 0 2px #f59e0b,0 2px 8px rgba(245,158,11,0.3) !important}

select,select option{color:#1e293b !important;background:white !important}
/* ========== HUECOS EN DÍAS NO LABORABLES ========== */

/* Forzar que las celdas de días no laborables tengan fondo blanco y estén por encima */
.pcl-gantt-wrapper .gantt_task_cell.pcl-weekend-cell {
    background-color: #ffffff !important;
    position: relative;
    z-index: 10 !important;
    pointer-events: none;
}

/* Extender el efecto a cualquier día marcado como no laborable */
.pcl-gantt-wrapper .gantt_task_cell.gantt_non_work_cell {
    background-color: #ffffff !important;
    position: relative;
    z-index: 10 !important;
    pointer-events: none;
}

/* Asegurar que las barras estén por DEBAJO de los huecos */
.pcl-gantt-wrapper .gantt_task_line {
    z-index: 1 !important;
}

/* Los corchetes de padres también deben estar por debajo */
.pcl-gantt-wrapper .gantt_task_line.gantt_project {
    z-index: 1 !important;
}

.pcl-gantt-wrapper .gantt_task_line.gantt_project::before,
.pcl-gantt-wrapper .gantt_task_line.gantt_project::after {
    z-index: 1 !important;
 }
/* 2. FORZAR VISIBILIDAD: El corchete no debe cortar el contenido */
.pcl-gantt-wrapper .gantt_task_line.gantt_project {
    overflow: visible !important;
}

.pcl-gantt-wrapper .gantt_task_content {
    overflow: visible !important;
}

/* 3. AJUSTE DE CAPAS: Bajamos los días blancos */
.pcl-gantt-wrapper .gantt_task_cell.pcl-weekend-cell,
.pcl-gantt-wrapper .gantt_task_cell.gantt_non_work_cell {
    z-index: 0 !important; /* IMPORTANTE: De 10 bajamos a 0 */
}

.monto-flotante-final {
    position: absolute;
    top: -18px;
    left: 50%;
    transform: translateX(-50%);
    background: transparent;
    color: #1e293b;
    font-size: 10px;
    font-weight: 700;
    white-space: nowrap;
    pointer-events: none;
}
`}</style>
        </AppLayout>
    );
};

export default CronogramaIndex;