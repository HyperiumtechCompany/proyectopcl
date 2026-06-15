import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import type { BreadcrumbItem } from '@/types';
import type { GanttTask, SchedulingMode } from '../types/task';
import type { ZoomLevel } from '../types/timeline';
import { type RowAction } from '../types/cell';
import { EDITABLE_COLUMNS } from '../types/cell';
import { useGanttTasks } from '../composables/useGanttTasks';
import { useGanttSelection } from '../composables/useGanttSelection';
import { useGanttKeyboard } from '../composables/useGanttKeyboard';
import { useGanttTimeline } from '../composables/useGanttTimeline';
import { useGanttCriticalPath } from '../composables/useGanttCriticalPath';
import { useGanttSettings } from '../composables/useGanttSettings';
import { diffWorkingDaysInclusive } from '../types/calendar';
import { GanttShell } from '../components/layout/GanttShell';
import { GanttToolbar } from '../components/toolbar/GanttToolbar';
import { GanttSettingsModal } from '../components/settings/GanttSettingsModal';
import { DiagramaRed } from '../components/network/DiagramaRed';
import { parseMSProjectXML } from '../utils/importMSProject';

const EMPTY_SET = new Set<number>();

function schedulingModeStorageKey(projectId: string): string {
    return `pcl:gantt:v2:${projectId}:scheduling-mode`;
}

// ─── Toast mínimo ─────────────────────────────────────────────────────────────
function toast(msg: string, type: 'success' | 'error' | 'info' = 'info') {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = `
        position:fixed;bottom:24px;right:24px;z-index:9999;
        padding:10px 18px;border-radius:6px;font-size:13px;
        color:#fff;font-family:inherit;
        background:${type === 'success' ? '#16a34a' : type === 'error' ? '#dc2626' : '#2563eb'};
        box-shadow:0 4px 12px rgba(0,0,0,.4);transition:opacity .3s;
    `;
    document.body.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.addEventListener('transitionend', () => el.remove(), { once: true });
    }, 3000);
}

// ─── Page props ───────────────────────────────────────────────────────────────
interface PageProps {
    project: string;
    project_name: string;
    initialTasks: GanttTask[];
}

// ─────────────────────────────────────────────────────────────────────────────
export default function CronogramaGeneralV2({
    project,
    project_name,
    initialTasks,
}: PageProps) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Proyectos', href: '/costos' },
        { title: project_name, href: `/costos/${project}` },
        { title: 'Cronograma v2', href: '#' },
    ];

    // ── Vista activa (Gantt / Diagrama de Red) ───────────────────────────────
    const [activeView, setActiveView] = useState<'gantt' | 'network'>('gantt');

    // ── Zoom temporal y ruta crítica ─────────────────────────────────────────
    const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('MONTH_YEAR');
    const [continuousDayWidth, setContinuousDayWidth] = useState<number | null>(null);
    const [showCriticalPath, setShowCriticalPath] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    // Ref para scroll del chart (necesario para anchor de cursor en zoom)
    const chartScrollRef = useRef<HTMLDivElement | null>(null);
    const [schedulingMode, setSchedulingMode] = useState<SchedulingMode>(() => {
        if (typeof window === 'undefined') {
            return 'automatic';
        }

        const stored = window.localStorage.getItem(
            schedulingModeStorageKey(project),
        );

        return stored === 'manual' ? 'manual' : 'automatic';
    });

    const { calendarSettings, setCalendarSettings } = useGanttSettings(
        project,
        initialTasks,
    );

    // ── Estado de tareas ─────────────────────────────────────────────────────
    const {
        tasks,
        visibleTasks,
        taskById,
        groupIds,
        expandedIds,
        isDirty,
        isSaving,
        updateField,
        toggleExpand,
        expandAll,
        collapseAll,
        addTaskAfter,
        addChildTask,
        deleteTask,
        indentTask,
        outdentTask,
        saveTasks,
        applyBarMove,
        importTasks,
    } = useGanttTasks(initialTasks, schedulingMode, calendarSettings);

    // ── Timeline (barras) ────────────────────────────────────────────────────
    const timeline = useGanttTimeline(tasks, zoomLevel, calendarSettings, continuousDayWidth);

    // ── Callback zoom continuo (Ctrl+Scroll) ────────────────────────────────
    const handleContinuousZoom = useCallback(
        (newDayWidth: number, cursorRatio: number) => {
            setContinuousDayWidth(newDayWidth);
            // Preservar la posición del cursor tras el repaint
            requestAnimationFrame(() => {
                const el = chartScrollRef.current;
                if (!el) return;
                const newTotalWidth = timeline.totalDays * newDayWidth;
                el.scrollLeft = cursorRatio * newTotalWidth - (el.clientWidth * cursorRatio);
            });
        },
        [timeline.totalDays],
    );

    // ── Ruta crítica (CPM) ───────────────────────────────────────────────────
    const { criticalIds, floatByTask } = useGanttCriticalPath(tasks);

    // ── Selección e inline edit ──────────────────────────────────────────────
    const {
        selectedRowId,
        editState,
        selectRow,
        startEdit,
        stopEdit,
        cancelEdit,
    } = useGanttSelection();

    // ── Auto-select + auto-edit tras agregar fila ────────────────────────────
    const pendingSelectRef = useRef<number | null>(null);
    const setPendingSelect = useCallback((id: number) => {
        pendingSelectRef.current = id;
    }, []);

    useEffect(() => {
        const id = pendingSelectRef.current;
        if (id === null) return;
        if (visibleTasks.some((t) => t.id === id)) {
            pendingSelectRef.current = null;
            startEdit(id, EDITABLE_COLUMNS[0].key);
        }
    }, [visibleTasks, startEdit]);

    // ── Commit ───────────────────────────────────────────────────────────────
    const handleCommitField = useCallback(
        <K extends keyof GanttTask>(
            id: number,
            field: K,
            value: GanttTask[K],
        ) => {
            updateField(id, field, value);
            stopEdit();
        },
        [updateField, stopEdit],
    );

    // ── Keyboard ─────────────────────────────────────────────────────────────
    const onKeyDown = useGanttKeyboard({
        visibleTasks,
        selectedRowId,
        editState,
        selectRow,
        startEdit,
        stopEdit,
        cancelEdit,
        addTaskAfter,
        addChildTask,
        deleteTask,
        indentTask,
        outdentTask,
        onPendingSelect: setPendingSelect,
    });

    // ── Guardar ──────────────────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        const ok = await saveTasks(project);
        toast(
            ok
                ? 'Cronograma guardado correctamente.'
                : 'Error al guardar el cronograma.',
            ok ? 'success' : 'error',
        );
    }, [saveTasks, project]);

    const handleSchedulingModeChange = useCallback(
        (mode: SchedulingMode) => {
            setSchedulingMode(mode);
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(
                    schedulingModeStorageKey(project),
                    mode,
                );
            }
            toast(
                mode === 'automatic'
                    ? 'Programador automatico activado.'
                    : 'Programador manual activado.',
                'info',
            );
        },
        [project],
    );

    // ── Ctrl+S global ────────────────────────────────────────────────────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (isDirty && !isSaving) handleSave();
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isDirty, isSaving, handleSave]);

    // ── Commit de drag/resize desde barras del chart ─────────────────────────
    const handleBarCommit = useCallback(
        (id: number, type: 'move' | 'resize', deltaDays: number) => {
            const task = taskById.get(id);
            if (!task?.fecha_inicio) return;
            if (type === 'move') {
                const newStart = dayjs(task.fecha_inicio)
                    .add(deltaDays, 'day')
                    .format('YYYY-MM-DD');
                applyBarMove(id, newStart, task.duracion_dias);
            } else {
                const tentativeEnd = dayjs(task.fecha_fin ?? task.fecha_inicio)
                    .add(deltaDays, 'day')
                    .format('YYYY-MM-DD');
                const newDuration =
                    diffWorkingDaysInclusive(
                        task.fecha_inicio,
                        tentativeEnd,
                        calendarSettings,
                    ) ?? task.duracion_dias;
                applyBarMove(id, task.fecha_inicio, Math.max(1, newDuration));
            }
        },
        [applyBarMove, calendarSettings, taskById],
    );

    // ── Toolbar callbacks ─────────────────────────────────────────────────────
    const handleZoomChange = useCallback((zoom: ZoomLevel) => {
        setZoomLevel(zoom);
        setContinuousDayWidth(null); // reset al nivel discreto al usar los botones
    }, []);

    const handleAddRow = () => setPendingSelect(addTaskAfter(selectedRowId));
    const handleAddChild = () => {
        if (selectedRowId !== null)
            setPendingSelect(addChildTask(selectedRowId));
    };
    const handleDeleteRow = () => {
        if (selectedRowId !== null) deleteTask(selectedRowId);
    };
    const handleIndent = () => {
        if (selectedRowId !== null) indentTask(selectedRowId);
    };
    const handleOutdent = () => {
        if (selectedRowId !== null) outdentTask(selectedRowId);
    };

    // ── Row action desde el menú contextual del grid ─────────────────────────
    const handleRowAction = useCallback(
        (taskId: number, action: RowAction) => {
            switch (action) {
                case 'addAfter':  setPendingSelect(addTaskAfter(taskId));  break;
                case 'addChild':  setPendingSelect(addChildTask(taskId));  break;
                case 'delete':    deleteTask(taskId);                      break;
                case 'indent':    indentTask(taskId);                      break;
                case 'outdent':   outdentTask(taskId);                     break;
                case 'expand':
                case 'collapse':  toggleExpand(taskId);                    break;
            }
        },
        [addTaskAfter, addChildTask, deleteTask, indentTask, outdentTask, toggleExpand, setPendingSelect],
    );

    // ── Ref para input de archivo oculto (importación MSP) ───────────────
    const importInputRef = useRef<HTMLInputElement>(null);

    const handleImportClick = () => importInputRef.current?.click();

    const handleImportFile = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const xmlText = ev.target?.result as string;
                    const tasks   = parseMSProjectXML(xmlText);
                    importTasks(tasks);
                    toast(`✅ Importadas ${tasks.length} tareas desde "${file.name}" (solo vista, sin guardar)`, 'success');
                } catch (err: any) {
                    toast('Error al importar: ' + (err?.message ?? 'XML inválido'), 'error');
                } finally {
                    e.target.value = '';
                }
            };
            reader.readAsText(file);
        },
        [importTasks],
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Cronograma v2 — ${project_name}`} />

            <div className="flex h-[calc(100vh-4rem)] min-h-0 w-full min-w-0 flex-col overflow-hidden bg-slate-900 text-white">
                {/* ── Toolbar ──────────────────────────────────────────────── */}
                <GanttToolbar
                    projectName={project_name}
                    isDirty={isDirty}
                    isSaving={isSaving}
                    selectedRowId={selectedRowId}
                    zoomLevel={zoomLevel}
                    showCriticalPath={showCriticalPath}
                    schedulingMode={schedulingMode}
                    activeView={activeView}
                    onViewChange={setActiveView}
                    onAddRow={handleAddRow}
                    onAddChild={handleAddChild}
                    onDeleteRow={handleDeleteRow}
                    onIndent={handleIndent}
                    onOutdent={handleOutdent}
                    onExpandAll={expandAll}
                    onCollapseAll={collapseAll}
                    onZoomChange={handleZoomChange}
                    onToggleCritical={() => setShowCriticalPath((p) => !p)}
                    onSchedulingModeChange={handleSchedulingModeChange}
                    onOpenSettings={() => setSettingsOpen(true)}
                    onSave={handleSave}
                    onImport={handleImportClick}
                />
                {/* Input oculto para seleccionar archivo XML */}
                <input
                    ref={importInputRef}
                    type="file"
                    accept=".xml"
                    className="hidden"
                    onChange={handleImportFile}
                />

                <GanttSettingsModal
                    open={settingsOpen}
                    settings={calendarSettings}
                    onClose={() => setSettingsOpen(false)}
                    onSave={setCalendarSettings}
                />

                {/* ── Contenido principal ───────────────────────────────────── */}
                <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                    {activeView === 'gantt' ? (
                        <GanttShell
                            visibleTasks={visibleTasks}
                            allTasks={tasks}
                            groupIds={groupIds}
                            criticalIds={showCriticalPath ? criticalIds : EMPTY_SET}
                            expandedIds={expandedIds}
                            selectedRowId={selectedRowId}
                            editState={editState}
                            timeline={timeline}
                            chartScrollRef={chartScrollRef}
                            onSelect={selectRow}
                            onStartEdit={startEdit}
                            onCommitField={handleCommitField}
                            onCancelEdit={cancelEdit}
                            onToggleExpand={toggleExpand}
                            onKeyDown={onKeyDown}
                            onBarCommit={handleBarCommit}
                            onContinuousZoom={handleContinuousZoom}
                            onRowAction={handleRowAction}
                        />
                    ) : (
                        <DiagramaRed
                            tasks={tasks}
                            criticalIds={showCriticalPath ? criticalIds : EMPTY_SET}
                            groupIds={groupIds}
                            floatByTask={floatByTask}
                        />
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
