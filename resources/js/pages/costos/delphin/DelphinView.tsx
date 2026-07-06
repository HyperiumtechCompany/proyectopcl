import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import dayjs from 'dayjs';
import { ListFilter, Search, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
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
import { usePresupuestoAcu } from '../presupuesto/hooks/usePresupuestoAcu';
import { useProjectParamsStore } from '../presupuesto/stores/projectParamsStore';
import { DelphinGrid } from './components/DelphinGrid';
import { DelphinExportModal } from './components/DelphinExportModal';
import { FormulaPolinomicaSplitView } from './components/FormulaPolinomicaSplitView';
import { DelphinToolbar } from './components/DelphinToolbar';
import { ImportDelphinModal } from './components/ImportDelphinModal';
import { InsumosConsolidadosModal } from './components/InsumosConsolidadosModal';
import { PartidasSinAcuModal } from './components/PartidasSinAcuModal';
import { useDelphinData } from './hooks/useDelphinData';
import { useDiccionario } from './hooks/useDiccionario';
import { BUDGET_COLUMNS, CPM_COLUMNS, type DelphinBudgetView, type DelphinMode, type DelphinSubView, type InsumosScope } from './types';

const DESC_EXPANDED_EXTRA = 180;

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
    el.style.cssText = [
        'position:fixed;bottom:24px;right:24px;z-index:9999;',
        'padding:10px 18px;border-radius:8px;font-size:13px;',
        'color:#fff;font-family:inherit;max-width:340px;',
        `background:${type === 'success' ? '#059669' : type === 'error' ? '#dc2626' : '#2563eb'};`,
        'box-shadow:0 4px 14px rgba(0,0,0,.5);transition:opacity .35s;',
    ].join('');
    document.body.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.addEventListener('transitionend', () => el.remove(), { once: true });
    }, 3200);
}
function getIconForPartida(partida: string): string {
    const num = parseInt(partida?.split('.')?.[0] ?? '0', 10);
    const icons: Record<number, string> = {
        1: '🏗️', 2: '🏛️', 3: '⚡', 4: '🔧',
        5: '📡', 6: '🔥', 7: '⚡', 8: '🏊',
    };
    return icons[num] ?? '📄';
}
function modeKey(pid: string) { return `pcl:delphin:${pid}:mode`; }
function schedulingKey(pid: string) { return `pcl:gantt:v2:${pid}:scheduling-mode`; }


interface PageProps {
    project: string;
    project_id_int: number;
    project_name: string;
    initialRows: any[];
    initialTasks: GanttTask[];
    projectParams: Record<string, any> | null;
    projectData?: {
        id: number;
        nombre: string;
        codigo_cui: string;
        codigo_local: string;
        unidad_ejecutora: string;
        propietario: string;
        codigos_modulares: string;
        plantilla_logo_izq_url: string | null;
        plantilla_logo_der_url: string | null;
    };
}



// ─────────────────────────────────────────────────────────────────────────────
export default function DelphinView({
    project, project_id_int, project_name,
    initialRows, initialTasks, projectParams,
    projectData,
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
    const [budgetView, setBudgetView] = useState<DelphinBudgetView>('presupuesto');

    // ── Diccionario INEI (para fórmula polinómica) ────────────────────────────
    const { items: diccionario } = useDiccionario(project);

    // ── Fórmula polinómica: padre seleccionado ────────────────────────────────
    const [formulaParentId, setFormulaParentId] = useState<number | null>(null);

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
    const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('MONTH_YEAR');
    const [continuousDayWidth, setContinuousDayWidth] = useState<number | null>(null);

    const [showCriticalPath, setShowCriticalPath] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [importExcelOpen, setImportExcelOpen] = useState(false);
    const [insumosOpen, setInsumosOpen] = useState(false);
    const [insumosScope, setInsumosScope] = useState<InsumosScope>('presupuesto');
    const [ganttBarLabel, setGanttBarLabel] = useState<GanttBarLabel>('descripcion');
    const [acuRefetchVersion, setAcuRefetchVersion] = useState(0);
    const [compatOpen, setCompatOpen] = useState(false);
    const [scrollToRowId, setScrollToRowId] = useState<number | null>(null);


    // ── Column visibility + description expand ────────────────────────────────
    const [hiddenBudgetKeys, setHiddenBudgetKeys] = useState<Set<string>>(new Set());
    const [hiddenCpmKeys, setHiddenCpmKeys] = useState<Set<string>>(new Set());
    const [descExpanded, setDescExpanded] = useState(false);
    const [formulaMonomios, setFormulaMonomios] = useState<any[]>([]);
    const [showExportModal, setShowExportModal] = useState(false);

    const activeHiddenKeys = mode === 'budget' ? hiddenBudgetKeys : hiddenCpmKeys;

    const handleToggleHidden = useCallback((key: string) => {
        const setter = mode === 'budget' ? setHiddenBudgetKeys : setHiddenCpmKeys;
        setter((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    }, [mode]);

    // ── Search / filter ───────────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
    const [showSearch, setShowSearch] = useState(false);
    const [showColumnFilters, setShowColumnFilters] = useState(false);
    const handleColumnFilterChange = useCallback((key: string, value: string) => {
        setColumnFilters((prev) => ({ ...prev, [key]: value }));
    }, []);
    const handleClearColumnFilters = useCallback(() => setColumnFilters({}), []);
    const handleClearAllFilters = useCallback(() => {
        setSearchQuery('');
        setColumnFilters({});
    }, []);
    const { calendarSettings, setCalendarSettings } = useGanttSettings(project, initialTasks);
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
        moveTaskUp, moveTaskDown, duplicateTask,
        saveTasks, applyBarMove, importTasks, importDelphinRows, importCronogramaTasks,
        renameRootPartida,
    } = useDelphinData({ initialTasks, initialRows, schedulingMode, calendarSettings });

    const handleRenameRootPartida = useCallback(
        (taskId: number, newPartida: string) => {
            renameRootPartida(taskId, newPartida);
        },
        [renameRootPartida],
    );

    const availableSpecialties = useMemo(() => {
        return delphinRows
            .filter(row => row.nivel === 1)
            .map(row => ({
                id: String(row.id),
                label: row.descripcion || row.partida || `Especialidad ${row.partida}`,
                icon: getIconForPartida(row.partida),
            }));
    }, [delphinRows]);
    // ── Timeline & critical path ──────────────────────────────────────────────
    const timeline = useGanttTimeline(tasks, zoomLevel, calendarSettings, continuousDayWidth);
    const { criticalIds, floatByTask } = useGanttCriticalPath(tasks);
    const { selectedRowId, editState, selectRow, startEdit, stopEdit, cancelEdit } =
        useGanttSelection();

    const isParentSelected = selectedRowId !== null && groupIds.has(selectedRowId);
    const handleFormulaView = useCallback(() => {
        if (selectedRowId !== null && groupIds.has(selectedRowId)) {
            setFormulaParentId(selectedRowId);
            setBudgetView('formula_polinomica');
        }
    }, [selectedRowId, groupIds]);

    const handleFormulaData = useCallback((monomios: any[]) => {

        setFormulaMonomios(monomios);
        setShowExportModal(true);
    }, []);

    const handleCloseModal = useCallback(() => {
        setShowExportModal(false);
        setFormulaMonomios([]);
    }, []);

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

    // ── ACU copy/paste clipboard (Delphin) ────────────────────────────────────
    type DelphinClipboard = {
        taskId: number;
        descripcion: string;
        unidad: string;
        metrado: number;
        precio_unitario: number;
        acu: any | null;
    };
    const [delphinClipboard, setDelphinClipboard] = useState<DelphinClipboard | null>(null);
    const pendingAcuPasteRef = useRef<(DelphinClipboard & { newTaskId: number }) | null>(null);

    useEffect(() => {
        const pending = pendingAcuPasteRef.current;
        if (!pending) return;
        const newTask = tasks.find((t) => t.id === pending.newTaskId);
        if (!newTask?.partida) return;
        pendingAcuPasteRef.current = null;
        commitField(pending.newTaskId, 'descripcion', pending.descripcion);
        commitField(pending.newTaskId, 'unidad', pending.unidad);
        commitField(pending.newTaskId, 'metrado', pending.metrado);
        if (pending.acu) {
            const newPartida = normalizeCode(newTask.partida);
            const result = localSaveAcu({ ...pending.acu, partida: newPartida, id: 0 });
            if (result.success && result.acu) {
                commitField(pending.newTaskId, 'precio_unitario', result.acu.costo_unitario_total);
            } else {
                commitField(pending.newTaskId, 'precio_unitario', pending.precio_unitario);
            }
        } else {
            commitField(pending.newTaskId, 'precio_unitario', pending.precio_unitario);
        }
    }, [tasks]);

    const handleCommitField = useCallback(
        (id: number, field: string, value: any) => {
            commitField(id, field, value);
            stopEdit();
        },
        [commitField, stopEdit],
    );

    const ganttKeyDown = useGanttKeyboard({
        visibleTasks: visibleDelphinRows as GanttTask[],
        selectedRowId, editState,
        selectRow, startEdit, stopEdit, cancelEdit,
        addTaskAfter, addChildTask, deleteTask, indentTask, outdentTask,
        onPendingSelect: setPendingSelect,
    });

    const onKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (selectedRowId !== null) {
                if (e.altKey && e.key === 'ArrowUp' && !editState) {
                    e.preventDefault();
                    moveTaskUp(selectedRowId);
                    return;
                }
                if (e.altKey && e.key === 'ArrowDown' && !editState) {
                    e.preventDefault();
                    moveTaskDown(selectedRowId);
                    return;
                }
                if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !editState) {
                    e.preventDefault();
                    setPendingSelect(duplicateTask(selectedRowId));
                    return;
                }
            }
            ganttKeyDown(e);
        },
        [ganttKeyDown, selectedRowId, editState, moveTaskUp, moveTaskDown, duplicateTask, setPendingSelect],
    );

    // ── ACU panel (budget mode) ───────────────────────────────────────────────
    const selectedTask = selectedRowId !== null ? taskById.get(selectedRowId) : null;

    const selectedPartidaData = useMemo(() => {
        if (!selectedTask) return null;
        const row = delphinRows.find((r) => r.id === selectedTask.id);
        if (!row) return null;
        const isLeaf = !groupIds.has(row.id);
        const hasUnit = row.unidad && row.unidad.trim() !== '';
        if (!isLeaf || !hasUnit) return null;
        return { descripcion: row.descripcion, unidad: row.unidad };
    }, [selectedTask, delphinRows, groupIds]);

    const {
        acuRows,
        acuLoading,
        selectedAcu,
        localSaveAcu,
        flushPendingAcus,
        registerPendingInsumo,
        flushPendingInsumos,
        acuDirty,
    } = usePresupuestoAcu({
        projectId: project_id_int,
        subsection: 'acus',
        selectedCell: null,
        selectedPartidaCode: selectedPartidaData ? normalizeCode(selectedTask?.partida ?? '') : null,
        selectedPartidaData,
        lastSaved: null,
        setSheetVersion: () => { },
        refreshKey: 0,
        refetchVersion: acuRefetchVersion,
    });

    // ── Compatibilidad Presupuesto ↔ ACU ─────────────────────────────────────
    const incompatiblesCount = useMemo(() => {
        const normP = (v: string) =>
            String(v).split('.').filter(Boolean).map(p => p.padStart(2, '0')).join('.');
        const acuByPartida = new Map(acuRows.map(acu => [normP(acu.partida), acu]));
        let count = 0;
        for (const row of delphinRows) {
            if (groupIds.has(row.id)) continue;
            if (!row.unidad?.trim()) continue;
            const acu = acuByPartida.get(normP(String(row.partida ?? '')));
            if (!acu || acu.costo_unitario_total === 0 || Math.abs(row.precio_unitario - acu.costo_unitario_total) > 0.01) {
                count++;
            }
        }
        return count;
    }, [delphinRows, acuRows, groupIds]);

    const handleSelectPartida = useCallback((rowId: number) => {
        if (mode !== 'budget') handleModeChange('budget');
        const rowById = new Map(delphinRows.map(r => [r.id, r]));
        let parentId = rowById.get(rowId)?.parent_id ?? null;
        while (parentId != null) {
            if (!expandedIds.has(parentId)) toggleExpand(parentId);
            parentId = rowById.get(parentId)?.parent_id ?? null;
        }
        selectRow(rowId);
        setScrollToRowId(rowId);
        setTimeout(() => setScrollToRowId(null), 400);
    }, [mode, handleModeChange, delphinRows, expandedIds, toggleExpand, selectRow]);

    // Called by AcuPanel when user edits an individual ACU (visual-first)
    const handleAcuChange = useCallback((acuData: Record<string, any>, options?: { updateProjectPrices?: boolean }) => {
        const result = localSaveAcu(acuData, options);
        if (result.success && result.acu && selectedTask) {
            commitField(selectedTask.id, 'precio_unitario', result.acu.costo_unitario_total);
        }
    }, [localSaveAcu, selectedTask, commitField]);

    // Called by ImportDelphinModal after ACU Excel parse — applies locally, no DB call
    const handleAcusImported = useCallback((payloads: Array<Record<string, any>>) => {
        for (const payload of payloads) {
            // Normalize partida so it matches selectedPartidaCode (which uses normalizeCode)
            const rawPartida = String(payload.partida ?? '');
            const normalizedPayload = { ...payload, partida: normalizeCode(rawPartida) };
            const result = localSaveAcu(normalizedPayload);
            if (result.success && result.acu && result.acu.costo_unitario_total > 0) {
                // Update price in budget grid — match by original raw partida from delphinRows
                const row = delphinRows.find((r) => r.partida === rawPartida);
                if (row) commitField(row.id, 'precio_unitario', result.acu.costo_unitario_total);
            }
        }
    }, [localSaveAcu, delphinRows, commitField]);

    // Called by InsumosConsolidadosModal after confirming a price change — applies
    // to every affected ACU locally (visual-first, no DB call until "Guardar")
    const handleApplyConsolidatedAcuChanges = useCallback((updatedAcus: Array<Record<string, any>>) => {
        let appliedCount = 0;
        for (const clonedAcu of updatedAcus) {
            const result = localSaveAcu(clonedAcu);
            if (result.success && result.acu) {
                appliedCount += 1;
                const partidaKey = normalizeCode(String(clonedAcu.partida ?? ''));
                const budgetRow = delphinRows.find((r) => normalizeCode(String(r.partida ?? '')) === partidaKey);
                if (budgetRow) commitField(budgetRow.id, 'precio_unitario', result.acu.costo_unitario_total);
            }
        }
        toast(
            `Precio aplicado en ${appliedCount} ACU(s) (local). Pulsa "Guardar" para persistir.`,
            'success',
        );
    }, [localSaveAcu, delphinRows, commitField]);

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
    const handleRowAction = useCallback((taskId: number, action: RowAction) => {
        switch (action) {
            case 'addAfter': setPendingSelect(addTaskAfter(taskId)); break;
            case 'addChild': setPendingSelect(addChildTask(taskId)); break;
            case 'delete': deleteTask(taskId); break;
            case 'indent': indentTask(taskId); break;
            case 'outdent': outdentTask(taskId); break;
            case 'moveUp': moveTaskUp(taskId); break;
            case 'moveDown': moveTaskDown(taskId); break;
            case 'duplicate': setPendingSelect(duplicateTask(taskId)); break;
            case 'expand':
            case 'collapse': toggleExpand(taskId); break;
            case 'copyWithAcu': {
                const row = delphinRows.find((r) => r.id === taskId);
                if (!row) break;
                const normPartida = normalizeCode(row.partida ?? '');
                const acu = acuRows.find((a: any) => normalizeCode(a.partida) === normPartida) ?? null;
                setDelphinClipboard({
                    taskId,
                    descripcion: row.descripcion,
                    unidad: row.unidad ?? '',
                    metrado: row.metrado ?? 0,
                    precio_unitario: row.precio_unitario ?? 0,
                    acu,
                });
                toast(`Copiado: ${row.descripcion || normPartida}`, 'success');
                break;
            }
            case 'pasteWithAcu': {
                setDelphinClipboard((clip) => {
                    if (!clip) return clip;
                    const newTaskId = addTaskAfter(taskId);
                    pendingAcuPasteRef.current = { ...clip, newTaskId };
                    setPendingSelect(newTaskId);
                    return clip;
                });
                break;
            }
        }
    }, [addTaskAfter, addChildTask, deleteTask, indentTask, outdentTask,
        moveTaskUp, moveTaskDown, duplicateTask, toggleExpand, setPendingSelect,
        delphinRows, acuRows, setDelphinClipboard]);

    // ── Save functions ────────────────────────────────────────────────────────
    const swalDark = {
        background: '#1e293b',
        color: '#e2e8f0',
        confirmButtonColor: '#0ea5e9',
    } as const;

    const saveSwalHtml = (statusText: string) => `
        <p id="dsave-status" style="font-size:13px;color:#94a3b8;margin:0 0 12px">${statusText}</p>
        <div style="background:#334155;border-radius:4px;height:6px;overflow:hidden;margin-bottom:16px">
            <div id="dsave-bar" style="width:0%;height:100%;background:#38bdf8;border-radius:4px;transition:width 0.25s ease"></div>
        </div>
        <button id="dsave-cancel" style="padding:6px 20px;border-radius:6px;background:#475569;border:1px solid #64748b;color:#e2e8f0;cursor:pointer;font-size:13px">
            Cancelar
        </button>`;

    const handleSaveBudget = useCallback(async () => {
        const ac = new AbortController();
        let budgetOk = false;
        let acuOk = false;
        let insumosOk = false;

        await Swal.fire({
            title: 'Guardando presupuesto…',
            html: saveSwalHtml('Guardando partidas…'),
            showConfirmButton: false,
            showCancelButton: false,
            allowOutsideClick: false,
            allowEscapeKey: false,
            ...swalDark,
            didOpen: async () => {
                document.getElementById('dsave-cancel')?.addEventListener('click', () => {
                    ac.abort();
                    const btn = document.getElementById('dsave-cancel') as HTMLButtonElement | null;
                    if (btn) { btn.disabled = true; btn.textContent = 'Cancelando…'; btn.style.opacity = '0.5'; }
                    const s = document.getElementById('dsave-status');
                    if (s) s.textContent = 'Cancelando guardado de ACUs…';
                }, { once: true });

                try {
                    // Crea primero los insumos nuevos (si hay) y parcha su insumo_id
                    // en los ACUs pendientes, antes de guardar presupuesto/ACUs.
                    insumosOk = await flushPendingInsumos();
                    if (insumosOk) {
                        [budgetOk, acuOk] = await Promise.all([
                            saveBudget(project_id_int),
                            flushPendingAcus((p) => {
                                const s = document.getElementById('dsave-status');
                                const b = document.getElementById('dsave-bar');
                                if (s) s.textContent = `Guardando ACUs… ${p.done}/${p.total}`;
                                if (b) b.style.width = `${p.pct}%`;
                            }, ac.signal),
                        ]);
                    }
                } finally {
                    Swal.close();
                }
            },
        });

        if (ac.signal.aborted) {
            await Swal.fire({ icon: 'warning', title: 'Guardado cancelado', text: 'Las partidas fueron guardadas. Los ACUs pendientes se guardarán en el próximo guardado.', ...swalDark });
            return;
        }
        if (insumosOk && budgetOk && acuOk) {
            setAcuRefetchVersion((v) => v + 1);
            void Swal.fire({ icon: 'success', title: 'Presupuesto guardado', timer: 2000, showConfirmButton: false, ...swalDark });
        } else {
            const errMsg = !insumosOk ? 'Error al crear los insumos nuevos.' : 'Ocurrió un error. Intente nuevamente.';
            await Swal.fire({ icon: 'error', title: 'Error al guardar', text: errMsg, ...swalDark });
        }
    }, [saveBudget, project_id_int, flushPendingAcus, flushPendingInsumos]);

    const handleSaveGantt = useCallback(async () => {
        const ac = new AbortController();
        let ganttOk = false;
        let budgetOk = false;
        let acuOk = false;
        let insumosOk = false;

        await Swal.fire({
            title: 'Guardando Delphin…',
            html: saveSwalHtml('Guardando cronograma y partidas…'),
            showConfirmButton: false,
            showCancelButton: false,
            allowOutsideClick: false,
            allowEscapeKey: false,
            ...swalDark,
            didOpen: async () => {
                document.getElementById('dsave-cancel')?.addEventListener('click', () => {
                    ac.abort();
                    const btn = document.getElementById('dsave-cancel') as HTMLButtonElement | null;
                    if (btn) { btn.disabled = true; btn.textContent = 'Cancelando…'; btn.style.opacity = '0.5'; }
                    const s = document.getElementById('dsave-status');
                    if (s) s.textContent = 'Cancelando guardado de ACUs…';
                }, { once: true });

                try {
                    // Crea primero los insumos nuevos (si hay) y parcha su insumo_id
                    // en los ACUs pendientes, antes de guardar cronograma/presupuesto/ACUs.
                    insumosOk = await flushPendingInsumos();
                    if (insumosOk) {
                        [ganttOk, budgetOk, acuOk] = await Promise.all([
                            saveTasks(project),
                            saveBudget(project_id_int),
                            flushPendingAcus((p) => {
                                const s = document.getElementById('dsave-status');
                                const b = document.getElementById('dsave-bar');
                                if (s) s.textContent = `Guardando ACUs… ${p.done}/${p.total}`;
                                if (b) b.style.width = `${p.pct}%`;
                            }, ac.signal),
                        ]);
                    }
                } finally {
                    Swal.close();
                }
            },
        });

        if (ac.signal.aborted) {
            await Swal.fire({ icon: 'warning', title: 'Guardado cancelado', text: 'El cronograma y partidas fueron guardados. Los ACUs pendientes se guardarán en el próximo guardado.', ...swalDark });
            return;
        }
        if (insumosOk && ganttOk && budgetOk && acuOk) {
            setAcuRefetchVersion((v) => v + 1);
            void Swal.fire({ icon: 'success', title: 'Delphin guardado', timer: 2000, showConfirmButton: false, ...swalDark });
        } else {
            const errMsg = !insumosOk ? 'Error al crear los insumos nuevos.' : !ganttOk ? 'Error al guardar el cronograma.' : !budgetOk ? 'Error al guardar las partidas.' : 'Error al guardar los ACUs.';
            await Swal.fire({ icon: 'error', title: 'Error al guardar', text: errMsg, ...swalDark });
        }
    }, [saveTasks, project, saveBudget, project_id_int, flushPendingAcus, flushPendingInsumos]);

    // ── Reset total (vaciar presupuesto) ────────────────────────────────────
    const handleResetAll = useCallback(async () => {
        const confirmResult = await Swal.fire({
            icon: 'warning',
            title: '¿Vaciar presupuesto completo?',
            text: 'Se eliminarán todas las partidas, ACUs, gastos generales y el cronograma de este presupuesto. El catálogo de insumos no se verá afectado. Esta acción no se puede deshacer.',
            showCancelButton: true,
            confirmButtonText: 'Sí, vaciar todo',
            cancelButtonText: 'Cancelar',
            ...swalDark,
            confirmButtonColor: '#dc2626',
        });
        if (!confirmResult.isConfirmed) return;

        try {
            await axios.delete('/module/delphin/reset', { params: { project: project_id_int } });
            await Swal.fire({ icon: 'success', title: 'Presupuesto vaciado', timer: 2000, showConfirmButton: false, ...swalDark });
            router.reload();
        } catch (err: any) {
            await Swal.fire({ icon: 'error', title: 'Error al vaciar', text: err?.response?.data?.message ?? 'Ocurrió un error. Intente nuevamente.', ...swalDark });
        }
    }, [project_id_int]);

    // ── Import MSP ────────────────────────────────────────────────────────────
    const importInputRef = useRef<HTMLInputElement>(null);
    const handleImportClick = useCallback(() => importInputRef.current?.click(), []);
    const handleImportFile = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const imported = parseMSProjectXML(ev.target?.result as string);
                    importCronogramaTasks(imported);
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


    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (!(e.ctrlKey || e.metaKey) || e.key !== 's') return;
            e.preventDefault();
            if (mode === 'budget') {
                if ((budgetDirty || acuDirty) && !isSavingBudget) void handleSaveBudget();
            } else {
                const cpmDirty = ganttDirty || budgetDirty || acuDirty;
                if (cpmDirty && !ganttIsSaving && !isSavingBudget) void handleSaveGantt();
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [mode, budgetDirty, acuDirty, isSavingBudget, ganttDirty, ganttIsSaving, handleSaveBudget, handleSaveGantt]);

    const allActiveColumns = mode === 'budget' ? BUDGET_COLUMNS : CPM_COLUMNS;
    const activeColumnFilterCount = useMemo(
        () => Object.values(columnFilters).filter((value) => value.trim() !== '').length,
        [columnFilters],
    );
    const hasSearchQuery = searchQuery.trim() !== '';
    const hasActiveTableFilters = hasSearchQuery || activeColumnFilterCount > 0;

    const activeColumns = useMemo(() => {
        return allActiveColumns
            .filter((col) => col.key === 'item_order' || !activeHiddenKeys.has(col.key))
            .map((col) =>
                col.key === 'descripcion' && descExpanded
                    ? { ...col, width: col.width + DESC_EXPANDED_EXTRA }
                    : col,
            );
    }, [allActiveColumns, activeHiddenKeys, descExpanded]);

    // ── Filtered rows (search by description + per-column header filters, includes ancestors) ──
    const filteredRows = useMemo(() => {
        const activeColumnFilters = activeColumns
            .map((col) => ({ key: col.key, value: (columnFilters[col.key] ?? '').trim().toLowerCase() }))
            .filter((f) => f.value !== '');

        const hasSearch = !!searchQuery.trim();
        if (!hasSearch && activeColumnFilters.length === 0) return visibleDelphinRows;

        const q = searchQuery.trim().toLowerCase();
        const matchesRow = (r: (typeof delphinRows)[number]) => {
            if (hasSearch && !(r.descripcion ?? '').toLowerCase().includes(q)) return false;
            for (const f of activeColumnFilters) {
                const cellValue = String((r as unknown as Record<string, unknown>)[f.key] ?? '').toLowerCase();
                if (!cellValue.includes(f.value)) return false;
            }
            return true;
        };

        const matchingIds = new Set(delphinRows.filter(matchesRow).map((r) => r.id));

        const ancestorIds = new Set<number>();
        const rowById = new Map(delphinRows.map((r) => [r.id, r]));
        for (const id of matchingIds) {
            let parentId = rowById.get(id)?.parent_id ?? null;
            while (parentId != null) {
                ancestorIds.add(parentId);
                parentId = rowById.get(parentId)?.parent_id ?? null;
            }
        }

        return visibleDelphinRows.filter((r) => matchingIds.has(r.id) || ancestorIds.has(r.id));
    }, [visibleDelphinRows, delphinRows, searchQuery, columnFilters, activeColumns]);

    // ── Grid scroll ref depends on mode ──────────────────────────────────────
    const activeScrollRef = mode === 'cpm' ? gridScrollRef : undefined;
    const activeOnScroll = mode === 'cpm' ? onGridScroll : undefined;

    // ── Toolbar handlers (memoized so DelphinToolbar's React.memo is effective) ──
    const handleAddRow = useCallback(() => setPendingSelect(addTaskAfter(selectedRowId)), [addTaskAfter, selectedRowId]);
    const handleAddChild = useCallback(() => { if (selectedRowId !== null) setPendingSelect(addChildTask(selectedRowId)); }, [addChildTask, selectedRowId]);
    const handleDeleteRowClick = useCallback(() => { if (selectedRowId !== null) deleteTask(selectedRowId); }, [deleteTask, selectedRowId]);
    const handleResetAllClick = useCallback(() => void handleResetAll(), [handleResetAll]);
    const handleIndentClick = useCallback(() => { if (selectedRowId !== null) indentTask(selectedRowId); }, [indentTask, selectedRowId]);
    const handleOutdentClick = useCallback(() => { if (selectedRowId !== null) outdentTask(selectedRowId); }, [outdentTask, selectedRowId]);
    const handleMoveUpClick = useCallback(() => { if (selectedRowId !== null) moveTaskUp(selectedRowId); }, [moveTaskUp, selectedRowId]);
    const handleMoveDownClick = useCallback(() => { if (selectedRowId !== null) moveTaskDown(selectedRowId); }, [moveTaskDown, selectedRowId]);
    const handleDuplicateClick = useCallback(() => { if (selectedRowId !== null) setPendingSelect(duplicateTask(selectedRowId)); }, [duplicateTask, selectedRowId]);
    const handleToggleCritical = useCallback(() => setShowCriticalPath((p) => !p), []);
    const handleOpenSettingsClick = useCallback(() => setSettingsOpen(true), []);
    const handleOpenImportExcelClick = useCallback(() => setImportExcelOpen(true), []);
    const handleOpenInsumosModal = useCallback((scope: InsumosScope) => {
        setInsumosScope(scope);
        setInsumosOpen(true);
    }, []);
    const handleOpenCompatibilidadClick = useCallback(() => setCompatOpen(true), []);
    const handleSaveBudgetClick = useCallback(() => void handleSaveBudget(), [handleSaveBudget]);
    const handleSaveGanttClick = useCallback(() => void handleSaveGantt(), [handleSaveGantt]);
    const handleOpenExportClick = useCallback(() => setExportOpen(true), []);


    // ─────────────────────────────────────────────────────────────────────────
    return (

        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Delphin — ${project_name}`} />
            <div className="flex h-[calc(100vh-4rem)] min-h-0 w-full min-w-0 flex-col overflow-hidden bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-white">

                {/* ── 1. Single unified toolbar ──────────────────────────── */}
                <DelphinToolbar
                    mode={mode}
                    budgetView={budgetView}
                    subView={subView}
                    onModeChange={handleModeChange}
                    onBudgetView={setBudgetView}
                    onSubView={setSubView}

                    selectedRowId={selectedRowId}
                    onAddRow={handleAddRow}
                    onAddChild={handleAddChild}
                    onDeleteRow={handleDeleteRowClick}
                    onResetAll={handleResetAllClick}
                    onIndent={handleIndentClick}
                    onOutdent={handleOutdentClick}
                    onMoveUp={handleMoveUpClick}
                    onMoveDown={handleMoveDownClick}
                    onDuplicate={handleDuplicateClick}
                    onExpandAll={expandAll}
                    onCollapseAll={collapseAll}

                    zoomLevel={zoomLevel}
                    showCriticalPath={showCriticalPath}
                    schedulingMode={schedulingMode}
                    ganttBarLabel={ganttBarLabel}
                    onZoomChange={handleZoomChange}
                    onToggleCritical={handleToggleCritical}
                    onSchedulingMode={handleSchedulingMode}
                    onBarLabelChange={setGanttBarLabel}
                    onOpenSettings={handleOpenSettingsClick}
                    onImport={handleImportClick}
                    onImportExcel={handleOpenImportExcelClick}
                    onOpenInsumos={handleOpenInsumosModal}

                    isParentSelected={isParentSelected}
                    onFormulaView={handleFormulaView}

                    incompatiblesCount={incompatiblesCount}
                    onOpenCompatibilidad={handleOpenCompatibilidadClick}

                    budgetDirty={budgetDirty || acuDirty}
                    isSavingBudget={isSavingBudget}
                    ganttDirty={ganttDirty || budgetDirty || acuDirty}
                    isGanttSaving={ganttIsSaving || isSavingBudget}
                    onSaveBudget={handleSaveBudgetClick}
                    onSaveGantt={handleSaveGanttClick}
                    onExport={handleOpenExportClick}
                    project={project}
                />

                {/* ──  vista formula polinomida────────────────────────────── */}
                {mode === 'budget' && budgetView === 'formula_polinomica' && formulaParentId !== null ? (
                    <FormulaPolinomicaSplitView
                        key={String(formulaParentId)}
                        parentId={formulaParentId}
                        rows={delphinRows}
                        acuRows={acuRows}
                        diccionario={diccionario}
                        projectName={project_name}
                        onBack={() => setBudgetView('presupuesto')}
                        onMonomiosChange={(monomios) => {

                            setFormulaMonomios(monomios);
                        }}
                        onExportFormula={handleFormulaData}
                    />
                ) : mode === 'cpm' && subView === 'network' ? (
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
                        {/* ── Left: search bar + DelphinGrid ───────────── */}
                        <Panel
                            defaultSize={40}
                            minSize={18}
                            className="flex min-h-0 flex-col overflow-hidden border-r border-slate-300 dark:border-slate-700">
                            {/* Search and filter controls */}
                            <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-2 border-b border-slate-300 bg-white px-2.5 py-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                                <div className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/80">
                                    <button
                                        type="button"
                                        title={showSearch ? 'Ocultar buscador' : 'Mostrar buscador'}
                                        onClick={() => setShowSearch((current) => !current)}
                                        className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold transition ${
                                            showSearch || hasSearchQuery
                                                ? 'bg-sky-600 text-white shadow-sm'
                                                : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'
                                        }`}
                                    >
                                        <Search size={12} />
                                        <span className="hidden sm:inline">Buscar</span>
                                    </button>
                                    <button
                                        type="button"
                                        title={showColumnFilters ? 'Ocultar filtros de columna' : 'Mostrar filtros de columna'}
                                        onClick={() => setShowColumnFilters((current) => !current)}
                                        className={`relative inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold transition ${
                                            showColumnFilters || activeColumnFilterCount > 0
                                                ? 'bg-emerald-600 text-white shadow-sm'
                                                : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'
                                        }`}
                                    >
                                        <ListFilter size={12} />
                                        <span className="hidden sm:inline">Filtros</span>
                                        {activeColumnFilterCount > 0 && (
                                            <span className="ml-0.5 rounded-full bg-white px-1.5 py-px text-[9px] font-black leading-none text-emerald-700">
                                                {activeColumnFilterCount}
                                            </span>
                                        )}
                                    </button>
                                </div>

                                {showSearch ? (
                                    <div className="flex min-w-[220px] flex-1 items-center gap-2">
                                        <Search size={13} className="shrink-0 text-slate-500 dark:text-slate-400" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Buscar por descripcion..."
                                            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-sky-400 dark:focus:bg-slate-900" />
                                        {hasSearchQuery && (
                                            <button
                                                title="Limpiar busqueda"
                                                className="shrink-0 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                                onClick={() => setSearchQuery('')}>
                                                <X size={13} />
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="min-w-0 flex-1">
                                        <div className="flex min-w-0 items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                            <span className="truncate">
                                                {hasActiveTableFilters ? `${filteredRows.length} resultado${filteredRows.length !== 1 ? 's' : ''}` : 'Tabla sin filtros visibles'}
                                            </span>
                                            {hasSearchQuery && (
                                                <span className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300">
                                                    Busqueda activa
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {hasActiveTableFilters && (
                                    <button
                                        type="button"
                                        title="Limpiar busqueda y filtros"
                                        onClick={handleClearAllFilters}
                                        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 text-[11px] font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/60"
                                    >
                                        <X size={12} />
                                        <span className="hidden sm:inline">Limpiar</span>
                                    </button>
                                )}
                            </div>

                            <DelphinGrid
                                rows={filteredRows}
                                allRows={delphinRows}
                                columns={activeColumns}
                                allColumns={allActiveColumns}
                                hiddenKeys={activeHiddenKeys}
                                descExpanded={descExpanded}
                                groupIds={groupIds}
                                expandedIds={expandedIds}
                                selectedRowId={selectedRowId}
                                editState={editState}
                                scrollRef={activeScrollRef}
                                scrollToRowId={scrollToRowId}
                                onScroll={activeOnScroll}
                                onSelect={selectRow}
                                onStartEdit={startEdit}
                                onCommitField={handleCommitField}
                                onCancelEdit={cancelEdit}
                                onToggleExpand={toggleExpand}
                                onKeyDown={onKeyDown}
                                hasClipboard={!!delphinClipboard}
                                onRowAction={handleRowAction}
                                onToggleHidden={handleToggleHidden}
                                onToggleDescExpand={() => setDescExpanded((p) => !p)}
                                onRenamePartida={handleRenameRootPartida}
                                columnFilters={columnFilters}
                                onColumnFilterChange={handleColumnFilterChange}
                                onClearColumnFilters={handleClearColumnFilters}
                                showColumnFilters={showColumnFilters} />
                        </Panel>

                        <Separator className="z-10 w-1.5 cursor-col-resize border-x border-slate-300 bg-slate-200 transition-colors hover:bg-sky-600 active:bg-sky-500 dark:border-slate-700 dark:bg-slate-800" />

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
                                    onAcuChange={handleAcuChange} />
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
                                    onContinuousZoom={handleContinuousZoom} />
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



                <DelphinExportModal
                    open={exportOpen}
                    rows={delphinRows}
                    projectName={project_name}
                    project={project}
                    projectData={projectData}
                    formulaMonomios={formulaMonomios}
                    availableSpecialties={availableSpecialties}
                    onClose={() => setExportOpen(false)}
                />

                <ImportDelphinModal
                    open={importExcelOpen}
                    project={project}
                    project_id_int={project_id_int}
                    delphinRows={delphinRows}
                    onClose={() => setImportExcelOpen(false)}
                    onBudgetImported={importDelphinRows}
                    onAcusImported={handleAcusImported}
                    onRegisterPendingInsumo={registerPendingInsumo} />
                <InsumosConsolidadosModal
                    open={insumosOpen}
                    acuRows={acuRows}
                    delphinRows={delphinRows}
                    scope={insumosScope}
                    projectName={project_name}
                    projectData={projectData}
                    onClose={() => setInsumosOpen(false)}
                    onApplyAcuChanges={handleApplyConsolidatedAcuChanges}
                />
                <PartidasSinAcuModal
                    open={compatOpen}
                    delphinRows={delphinRows}
                    acuRows={acuRows}
                    groupIds={groupIds}
                    onClose={() => setCompatOpen(false)}
                    onSelectPartida={handleSelectPartida}
                />
                <input
                    ref={importInputRef}
                    type="file"
                    accept=".xml"
                    className="hidden"
                    onChange={handleImportFile} />
            </div>
        </AppLayout>
    );
}
