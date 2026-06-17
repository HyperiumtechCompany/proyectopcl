import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';

import { GanttChart } from '../cronogramas/v2/components/chart/GanttChart';
import { DiagramaRed } from '../cronogramas/v2/components/network/DiagramaRed';
import { GanttSettingsModal } from '../cronogramas/v2/components/settings/GanttSettingsModal';
import { useGanttCriticalPath } from '../cronogramas/v2/composables/useGanttCriticalPath';
import { useGanttKeyboard } from '../cronogramas/v2/composables/useGanttKeyboard';
import { useGanttSelection } from '../cronogramas/v2/composables/useGanttSelection';
import { useGanttSettings } from '../cronogramas/v2/composables/useGanttSettings';
import { useGanttTimeline } from '../cronogramas/v2/composables/useGanttTimeline';
import { diffWorkingDaysInclusive } from '../cronogramas/v2/types/calendar';
import type { GanttBarLabel, RowAction } from '../cronogramas/v2/types/cell';
import type { GanttTask, SchedulingMode } from '../cronogramas/v2/types/task';
import type { ZoomLevel } from '../cronogramas/v2/types/timeline';
import { parseMSProjectXML } from '../cronogramas/v2/utils/importMSProject';

import { router } from '@inertiajs/react';
import { AcuPanel } from '../presupuesto/components/AcuPanel';
import { ImportAcusExcelModal } from '../presupuesto/components/ImportAcusExcelModal';
import { ImportExcelPresupuestoModal } from '../presupuesto/components/ImportExcelPresupuestoModal';
import { usePresupuestoAcu } from '../presupuesto/hooks/usePresupuestoAcu';
import { useProjectParamsStore } from '../presupuesto/stores/projectParamsStore';

import { DelphinGrid } from './components/DelphinGrid';
import { DelphinToolbar } from './components/DelphinToolbar';
import { useDelphinData } from './hooks/useDelphinData';
import { BUDGET_COLUMNS, CPM_COLUMNS, type DelphinMode, type DelphinSubView } from './types';

// ─── Constants ────────────────────────────────────────────────────────────────
const EMPTY_SET = new Set<number>();

function normalizeCode(code: string | number): string {
    const str = String(code).trim();
    if (!str) return '';
    const parts = str.split('.').filter(p => p.trim() !== '');
    return parts.map(p => p.replace(/[a-zA-Z]+$/, '').padStart(2, '0')).join('.');
}

function toast(msg: string, type: 'success' | 'error' | 'info' = 'info') {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = `
        position:fixed;bottom:24px;right:24px;z-index:9999;
        padding:10px 18px;border-radius:6px;font-size:13px;color:#fff;font-family:inherit;
        background:${type === 'success' ? '#16a34a' : type === 'error' ? '#dc2626' : '#2563eb'};
        box-shadow:0 4px 12px rgba(0,0,0,.4);transition:opacity .3s;
    `;
    document.body.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.addEventListener('transitionend', () => el.remove(), { once: true });
    }, 3000);
}

function modeKey(pid: string) { return `pcl:delphin:${pid}:mode`; }
function schedulingKey(pid: string) { return `pcl:gantt:v2:${pid}:scheduling-mode`; }

// ─── Page props ───────────────────────────────────────────────────────────────
interface PageProps {
    project:        string;
    project_id_int: number;
    project_name:   string;
    initialRows:    any[];
    initialTasks:   GanttTask[];
    projectParams:  Record<string, any> | null;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function DelphinView({
    project, project_id_int, project_name,
    initialRows, initialTasks, projectParams,
}: PageProps) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Proyectos', href: '/costos' },
        { title: project_name, href: `/costos/${project}` },
        { title: 'Delphin', href: '#' },
    ];

    // ── Mode & sub-view ───────────────────────────────────────────────────────
    const [mode, setMode] = useState<DelphinMode>(() => {
        if (typeof window === 'undefined') return 'budget';
        return localStorage.getItem(modeKey(project)) === 'cpm' ? 'cpm' : 'budget';
    });

    const handleModeChange = useCallback((m: DelphinMode) => {
        setMode(m);
        localStorage.setItem(modeKey(project), m);
    }, [project]);

    const [subView, setSubView] = useState<DelphinSubView>('gantt');

    // ── Scheduling mode ───────────────────────────────────────────────────────
    const [schedulingMode, setSchedulingMode] = useState<SchedulingMode>(() => {
        if (typeof window === 'undefined') return 'automatic';
        return localStorage.getItem(schedulingKey(project)) === 'manual' ? 'manual' : 'automatic';
    });

    const handleSchedulingMode = useCallback((m: SchedulingMode) => {
        setSchedulingMode(m);
        localStorage.setItem(schedulingKey(project), m);
    }, [project]);

    // ── CPM view settings ─────────────────────────────────────────────────────
    const [zoomLevel,         setZoomLevel]         = useState<ZoomLevel>('MONTH_YEAR');
    const [continuousDayWidth, setContinuousDayWidth] = useState<number | null>(null);
    const [showCriticalPath,  setShowCriticalPath]  = useState(false);
    const [settingsOpen,      setSettingsOpen]      = useState(false);
    const [ganttBarLabel,     setGanttBarLabel]     = useState<GanttBarLabel>('descripcion');

    const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
    const [isAcusExcelModalOpen, setIsAcusExcelModalOpen] = useState(false);
    const [acuRefreshKey, setAcuRefreshKey] = useState(0);

    const { calendarSettings, setCalendarSettings } = useGanttSettings(project, initialTasks);

    // ── Project params (needed by AcuPanel cost tables) ───────────────────────
    const initializeParams = useProjectParamsStore((s) => s.initialize);
    useEffect(() => { initializeParams(projectParams); }, [projectParams, initializeParams]);

    // ── Unified data (gantt + budget merged) ──────────────────────────────────
    const {
        delphinRows, visibleDelphinRows,
        budgetDirty, isSavingBudget, saveBudget, commitField,
        tasks, visibleTasks, taskById, groupIds, expandedIds,
        isDirty: ganttDirty, isSaving: ganttIsSaving,
        toggleExpand, expandAll, collapseAll,
        addTaskAfter, addChildTask, deleteTask, indentTask, outdentTask,
        saveTasks, applyBarMove, importTasks,
    } = useDelphinData({ initialTasks, initialRows, schedulingMode, calendarSettings });

    // ── Timeline & critical path ──────────────────────────────────────────────
    const timeline = useGanttTimeline(tasks, zoomLevel, calendarSettings, continuousDayWidth);
    const { criticalIds, floatByTask } = useGanttCriticalPath(tasks);

    // ── Selection & editing ───────────────────────────────────────────────────
    const { selectedRowId, editState, selectRow, startEdit, stopEdit, cancelEdit } =
        useGanttSelection();

    const pendingSelectRef = useRef<number | null>(null);
    const setPendingSelect = useCallback((id: number) => { pendingSelectRef.current = id; }, []);

    useEffect(() => {
        const id = pendingSelectRef.current;
        if (id === null) return;
        if (visibleTasks.some((t) => t.id === id)) {
            pendingSelectRef.current = null;
            startEdit(id, 'descripcion');
        }
    }, [visibleTasks, startEdit]);

    const handleCommitField = useCallback(
        (id: number, field: string, value: any) => {
            commitField(id, field, value);
            stopEdit();
        },
        [commitField, stopEdit],
    );

    const onKeyDown = useGanttKeyboard({
        visibleTasks:    visibleDelphinRows as GanttTask[],
        selectedRowId,   editState,
        selectRow,       startEdit, stopEdit, cancelEdit,
        addTaskAfter,    addChildTask, deleteTask, indentTask, outdentTask,
        onPendingSelect: setPendingSelect,
    });

    // ── ACU panel (budget mode) ───────────────────────────────────────────────
    const selectedTask = selectedRowId !== null ? taskById.get(selectedRowId) : null;

    const selectedPartidaData = useMemo(() => {
        if (!selectedTask) return null;
        const row = delphinRows.find((r) => r.id === selectedTask.id);
        if (!row) return null;
        const hasUnit = row.unidad && row.unidad.trim() !== '';
        if (!hasUnit) return null;
        return { descripcion: row.descripcion, unidad: row.unidad };
    }, [selectedTask, delphinRows]);

    const { acuRows, acuLoading, selectedAcu, saveAcu: baseSaveAcu } = usePresupuestoAcu({
        projectId:            project_id_int,
        subsection:           'acus',
        selectedCell:         null,
        selectedPartidaCode:  selectedPartidaData ? normalizeCode(selectedTask?.partida ?? '') : null,
        selectedPartidaData,
        lastSaved:            null,
        setSheetVersion:      () => {},
        refreshKey:           acuRefreshKey,
    });

    const handleSaveAcu = useCallback(async (acuData: Record<string, any>) => {
        const result = await baseSaveAcu(acuData);
        if (result.success && result.acu && selectedTask) {
            commitField(selectedTask.id, 'precio_unitario', result.acu.costo_unitario_total);
        }
        return result;
    }, [baseSaveAcu, selectedTask, commitField]);

    // ── Scroll sync (CPM gantt mode) ──────────────────────────────────────────
    const gridScrollRef = useRef<HTMLDivElement>(null);
    const chartScrollRef = useRef<HTMLDivElement>(null);
    const syncing = useRef(false);

    const onGridScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        if (syncing.current) return;
        syncing.current = true;
        if (chartScrollRef.current) chartScrollRef.current.scrollTop = e.currentTarget.scrollTop;
        requestAnimationFrame(() => { syncing.current = false; });
    }, []);

    const onChartScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        if (syncing.current) return;
        syncing.current = true;
        if (gridScrollRef.current) gridScrollRef.current.scrollTop = e.currentTarget.scrollTop;
        requestAnimationFrame(() => { syncing.current = false; });
    }, []);

    // ── Continuous zoom ───────────────────────────────────────────────────────
    const handleContinuousZoom = useCallback(
        (newDayWidth: number, cursorRatio: number) => {
            setContinuousDayWidth(newDayWidth);
            requestAnimationFrame(() => {
                const el = chartScrollRef.current;
                if (!el) return;
                const totalW = timeline.totalDays * newDayWidth;
                el.scrollLeft = cursorRatio * totalW - el.clientWidth * cursorRatio;
            });
        },
        [timeline.totalDays],
    );

    const handleZoomChange = useCallback((z: ZoomLevel) => {
        setZoomLevel(z);
        setContinuousDayWidth(null);
    }, []);

    // ── Bar drag ──────────────────────────────────────────────────────────────
    const handleBarCommit = useCallback(
        (id: number, type: 'move' | 'resize', deltaDays: number) => {
            const task = taskById.get(id);
            if (!task?.fecha_inicio) return;
            if (type === 'move') {
                applyBarMove(id, dayjs(task.fecha_inicio).add(deltaDays, 'day').format('YYYY-MM-DD'), task.duracion_dias);
            } else {
                const end = dayjs(task.fecha_fin ?? task.fecha_inicio).add(deltaDays, 'day').format('YYYY-MM-DD');
                const dur = diffWorkingDaysInclusive(task.fecha_inicio, end, calendarSettings) ?? task.duracion_dias;
                applyBarMove(id, task.fecha_inicio, Math.max(1, dur));
            }
        },
        [applyBarMove, calendarSettings, taskById],
    );

    // ── Row actions ───────────────────────────────────────────────────────────
    const handleRowAction = useCallback(
        (taskId: number, action: RowAction) => {
            switch (action) {
                case 'addAfter':  setPendingSelect(addTaskAfter(taskId));  break;
                case 'addChild':  setPendingSelect(addChildTask(taskId));  break;
                case 'delete':    deleteTask(taskId);                       break;
                case 'indent':    indentTask(taskId);                       break;
                case 'outdent':   outdentTask(taskId);                      break;
                case 'expand':
                case 'collapse':  toggleExpand(taskId);                     break;
            }
        },
        [addTaskAfter, addChildTask, deleteTask, indentTask, outdentTask, toggleExpand, setPendingSelect],
    );

    // ── Save functions ────────────────────────────────────────────────────────
    const handleSaveBudget = useCallback(async () => {
        const ok = await saveBudget(project_id_int);
        toast(ok ? 'Presupuesto guardado.' : 'Error al guardar el presupuesto.', ok ? 'success' : 'error');
    }, [saveBudget, project_id_int]);

    const handleSaveGantt = useCallback(async () => {
        const ok = await saveTasks(project);
        toast(ok ? 'Cronograma guardado.' : 'Error al guardar el cronograma.', ok ? 'success' : 'error');
    }, [saveTasks, project]);

    // ── Import MSP ────────────────────────────────────────────────────────────
    const importInputRef = useRef<HTMLInputElement>(null);
    const handleImportClick = () => importInputRef.current?.click();
    const handleImportFile = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const imported = parseMSProjectXML(ev.target?.result as string);
                    importTasks(imported);
                    toast(`Importadas ${imported.length} tareas (sin guardar).`, 'success');
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

    // ── Ctrl+S ────────────────────────────────────────────────────────────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (!(e.ctrlKey || e.metaKey) || e.key !== 's') return;
            e.preventDefault();
            if (mode === 'budget') {
                if (budgetDirty && !isSavingBudget) void handleSaveBudget();
            } else {
                if (ganttDirty && !ganttIsSaving) void handleSaveGantt();
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [mode, budgetDirty, isSavingBudget, ganttDirty, ganttIsSaving, handleSaveBudget, handleSaveGantt]);

    // ── Columns & grid scrollRef depend on mode ───────────────────────────────
    const activeColumns = mode === 'budget' ? BUDGET_COLUMNS : CPM_COLUMNS;
    const activeScrollRef = mode === 'cpm' ? gridScrollRef : undefined;
    const activeOnScroll  = mode === 'cpm' ? onGridScroll  : undefined;

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Delphin — ${project_name}`} />

            <div className="flex h-[calc(100vh-4rem)] min-h-0 w-full min-w-0 flex-col overflow-hidden bg-slate-900 text-white">

                {/* ── 1. Single unified toolbar ──────────────────────────── */}
                <DelphinToolbar
                    mode={mode}
                    subView={subView}
                    onModeChange={handleModeChange}
                    onSubView={setSubView}

                    selectedRowId={selectedRowId}
                    onAddRow={() => setPendingSelect(addTaskAfter(selectedRowId))}
                    onAddChild={() => { if (selectedRowId !== null) setPendingSelect(addChildTask(selectedRowId)); }}
                    onDeleteRow={() => { if (selectedRowId !== null) deleteTask(selectedRowId); }}
                    onIndent={() => { if (selectedRowId !== null) indentTask(selectedRowId); }}
                    onOutdent={() => { if (selectedRowId !== null) outdentTask(selectedRowId); }}
                    onExpandAll={expandAll}
                    onCollapseAll={collapseAll}

                    zoomLevel={zoomLevel}
                    showCriticalPath={showCriticalPath}
                    schedulingMode={schedulingMode}
                    ganttBarLabel={ganttBarLabel}
                    onZoomChange={handleZoomChange}
                    onToggleCritical={() => setShowCriticalPath((p) => !p)}
                    onSchedulingMode={handleSchedulingMode}
                    onBarLabelChange={setGanttBarLabel}
                    onOpenSettings={() => setSettingsOpen(true)}
                    onImport={handleImportClick}

                    budgetDirty={budgetDirty}
                    isSavingBudget={isSavingBudget}
                    ganttDirty={ganttDirty}
                    isGanttSaving={ganttIsSaving}
                    onSaveBudget={() => void handleSaveBudget()}
                    onSaveGantt={() => void handleSaveGantt()}
                    onImportExcel={() => setIsExcelModalOpen(true)}
                    onImportAcus={() => setIsAcusExcelModalOpen(true)}
                />

                {/* ── 2. Main area ────────────────────────────────────────── */}
                {mode === 'cpm' && subView === 'network' ? (
                    /* Red/Network: full width, no split pane */
                    <div className="min-h-0 flex-1 overflow-hidden">
                        <DiagramaRed
                            tasks={tasks}
                            criticalIds={showCriticalPath ? criticalIds : EMPTY_SET}
                            groupIds={groupIds}
                            floatByTask={floatByTask}
                        />
                    </div>
                ) : (
                    /* Split pane: ONE grid (left, columns change) + right panel */
                    <Group orientation="horizontal" className="min-h-0 flex-1">

                        {/* ── Left: DelphinGrid (unified, columns by mode) ── */}
                        <Panel
                            defaultSize={40}
                            minSize={18}
                            className="flex min-h-0 flex-col overflow-hidden border-r border-slate-700"
                        >
                            <DelphinGrid
                                rows={visibleDelphinRows}
                                allRows={delphinRows}
                                columns={activeColumns}
                                groupIds={groupIds}
                                expandedIds={expandedIds}
                                selectedRowId={selectedRowId}
                                editState={editState}
                                scrollRef={activeScrollRef}
                                onScroll={activeOnScroll}
                                onSelect={selectRow}
                                onStartEdit={startEdit}
                                onCommitField={handleCommitField}
                                onCancelEdit={cancelEdit}
                                onToggleExpand={toggleExpand}
                                onKeyDown={onKeyDown}
                                onRowAction={handleRowAction}
                            />
                        </Panel>

                        <Separator className="z-10 w-1.5 cursor-col-resize border-x border-slate-700 bg-slate-800 transition-colors hover:bg-sky-600 active:bg-sky-500" />

                        {/* ── Right: changes completely by mode ────────────── */}
                        <Panel defaultSize={60} minSize={20} className="flex min-h-0 flex-col overflow-hidden">
                            {mode === 'budget' ? (
                                /* Budget mode: ACU breakdown panel */
                                <AcuPanel
                                    acuLoading={acuLoading}
                                    acuRows={acuRows}
                                    selectedAcu={selectedAcu}
                                    projectId={project_id_int}
                                    selectedCell={null}
                                    onSaveAcu={handleSaveAcu}
                                />
                            ) : (
                                /* CPM gantt mode: ONLY the Gantt chart bars (no grid here!) */
                                <GanttChart
                                    visibleTasks={visibleTasks}
                                    groupIds={groupIds}
                                    criticalIds={showCriticalPath ? criticalIds : EMPTY_SET}
                                    selectedRowId={selectedRowId}
                                    timeline={timeline}
                                    barLabel={ganttBarLabel}
                                    scrollRef={chartScrollRef}
                                    onScroll={onChartScroll}
                                    onSelect={selectRow}
                                    onBarCommit={handleBarCommit}
                                    onContinuousZoom={handleContinuousZoom}
                                />
                            )}
                        </Panel>
                    </Group>
                )}

                {/* ── Modals ──────────────────────────────────────────────── */}
                <GanttSettingsModal
                    open={settingsOpen}
                    settings={calendarSettings}
                    onClose={() => setSettingsOpen(false)}
                    onSave={setCalendarSettings}
                />
                <ImportExcelPresupuestoModal
                    projectId={project_id_int}
                    isOpen={isExcelModalOpen}
                    onClose={() => setIsExcelModalOpen(false)}
                    onSuccess={() => {
                        setIsExcelModalOpen(false);
                        router.reload();
                    }}
                />
                <ImportAcusExcelModal
                    projectId={project_id_int}
                    isOpen={isAcusExcelModalOpen}
                    onClose={() => setIsAcusExcelModalOpen(false)}
                    onSuccess={() => {
                        setIsAcusExcelModalOpen(false);
                        setAcuRefreshKey(k => k + 1);
                        router.reload();
                    }}
                />
                <input
                    ref={importInputRef}
                    type="file"
                    accept=".xml"
                    className="hidden"
                    onChange={handleImportFile}
                />
            </div>
        </AppLayout>
    );
}
