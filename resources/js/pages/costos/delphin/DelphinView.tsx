import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import dayjs from 'dayjs';
import { Search, X } from 'lucide-react';
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
import { ImportExcelPresupuestoModal } from '../presupuesto/components/ImportExcelPresupuestoModal';
import { usePresupuestoAcu } from '../presupuesto/hooks/usePresupuestoAcu';
import { useProjectParamsStore } from '../presupuesto/stores/projectParamsStore';
import { DelphinGrid } from './components/DelphinGrid';
import { DelphinExportModal } from './components/DelphinExportModal';
import { FormulaPolinomicaSplitView } from './components/FormulaPolinomicaSplitView';
import { DelphinToolbar } from './components/DelphinToolbar';
import { ImportDelphinModal } from './components/ImportDelphinModal';
import { InsumosConsolidadosModal } from './components/InsumosConsolidadosModal';
import { useDelphinData } from './hooks/useDelphinData';
import { useDiccionario } from './hooks/useDiccionario';
import { BUDGET_COLUMNS, CPM_COLUMNS, type DelphinBudgetView, type DelphinMode, type DelphinSubView } from './types';

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
    const [ganttBarLabel, setGanttBarLabel] = useState<GanttBarLabel>('descripcion');
    const [acuRefetchVersion, setAcuRefetchVersion] = useState(0);


    // ── Column visibility + description expand ────────────────────────────────
    const [hiddenBudgetKeys, setHiddenBudgetKeys] = useState<Set<string>>(new Set());
    const [hiddenCpmKeys, setHiddenCpmKeys] = useState<Set<string>>(new Set());
    const [descExpanded, setDescExpanded] = useState(false);

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

    const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

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
        moveTaskUp, moveTaskDown, duplicateTask,
        saveTasks, applyBarMove, importTasks, importDelphinRows, importCronogramaTasks,
    } = useDelphinData({ initialTasks, initialRows, schedulingMode, calendarSettings });

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

    // ── Selection & editing ───────────────────────────────────────────────────
    const { selectedRowId, editState, selectRow, startEdit, stopEdit, cancelEdit } =
        useGanttSelection();

    // Enabled only when the selected row is a parent (group) node
    const isParentSelected = selectedRowId !== null && groupIds.has(selectedRowId);

    const handleFormulaView = useCallback(() => {
        if (selectedRowId !== null && groupIds.has(selectedRowId)) {
            setFormulaParentId(selectedRowId);
            setBudgetView('formula_polinomica');
        }
    }, [selectedRowId, groupIds]);

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
        saveAcu: baseSaveAcu,
        localSaveAcu,
        flushPendingAcus,
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

    // Called by AcuPanel when user edits an individual ACU (visual-first)
    const handleSaveAcu = useCallback(async (acuData: Record<string, any>) => {
        const result = await baseSaveAcu(acuData);
        if (result.success && result.acu && selectedTask) {
            commitField(selectedTask.id, 'precio_unitario', result.acu.costo_unitario_total);
        }
        return result;
    }, [baseSaveAcu, selectedTask, commitField]);

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
        }
    }, [addTaskAfter, addChildTask, deleteTask, indentTask, outdentTask,
        moveTaskUp, moveTaskDown, duplicateTask, toggleExpand, setPendingSelect]);

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
                    [budgetOk, acuOk] = await Promise.all([
                        saveBudget(project_id_int),
                        flushPendingAcus((p) => {
                            const s = document.getElementById('dsave-status');
                            const b = document.getElementById('dsave-bar');
                            if (s) s.textContent = `Guardando ACUs… ${p.done}/${p.total}`;
                            if (b) b.style.width = `${p.pct}%`;
                        }, ac.signal),
                    ]);
                } finally {
                    Swal.close();
                }
            },
        });

        if (ac.signal.aborted) {
            await Swal.fire({ icon: 'warning', title: 'Guardado cancelado', text: 'Las partidas fueron guardadas. Los ACUs pendientes se guardarán en el próximo guardado.', ...swalDark });
            return;
        }
        if (budgetOk && acuOk) {
            setAcuRefetchVersion((v) => v + 1);
            void Swal.fire({ icon: 'success', title: 'Presupuesto guardado', timer: 2000, showConfirmButton: false, ...swalDark });
        } else {
            await Swal.fire({ icon: 'error', title: 'Error al guardar', text: 'Ocurrió un error. Intente nuevamente.', ...swalDark });
        }
    }, [saveBudget, project_id_int, flushPendingAcus]);

    const handleSaveGantt = useCallback(async () => {
        const ac = new AbortController();
        let ganttOk = false;
        let budgetOk = false;
        let acuOk = false;

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
                } finally {
                    Swal.close();
                }
            },
        });

        if (ac.signal.aborted) {
            await Swal.fire({ icon: 'warning', title: 'Guardado cancelado', text: 'El cronograma y partidas fueron guardados. Los ACUs pendientes se guardarán en el próximo guardado.', ...swalDark });
            return;
        }
        if (ganttOk && budgetOk && acuOk) {
            setAcuRefetchVersion((v) => v + 1);
            void Swal.fire({ icon: 'success', title: 'Delphin guardado', timer: 2000, showConfirmButton: false, ...swalDark });
        } else {
            const errMsg = !ganttOk ? 'Error al guardar el cronograma.' : !budgetOk ? 'Error al guardar las partidas.' : 'Error al guardar los ACUs.';
            await Swal.fire({ icon: 'error', title: 'Error al guardar', text: errMsg, ...swalDark });
        }
    }, [saveTasks, project, saveBudget, project_id_int, flushPendingAcus]);

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

    // ── Columns (filtered by visibility + desc expansion) ────────────────────
    const allActiveColumns = mode === 'budget' ? BUDGET_COLUMNS : CPM_COLUMNS;

    const activeColumns = useMemo(() => {
        return allActiveColumns
            .filter((col) => col.key === 'item_order' || !activeHiddenKeys.has(col.key))
            .map((col) =>
                col.key === 'descripcion' && descExpanded
                    ? { ...col, width: col.width + DESC_EXPANDED_EXTRA }
                    : col,
            );
    }, [allActiveColumns, activeHiddenKeys, descExpanded]);

    // ── Filtered rows (search by description, includes ancestors) ────────────
    const filteredRows = useMemo(() => {
        if (!searchQuery.trim()) return visibleDelphinRows;
        const q = searchQuery.trim().toLowerCase();

        const matchingIds = new Set(
            delphinRows
                .filter((r) => (r.descripcion ?? '').toLowerCase().includes(q))
                .map((r) => r.id),
        );

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
    }, [visibleDelphinRows, delphinRows, searchQuery]);

    // ── Grid scroll ref depends on mode ──────────────────────────────────────
    const activeScrollRef = mode === 'cpm' ? gridScrollRef : undefined;
    const activeOnScroll = mode === 'cpm' ? onGridScroll : undefined;

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Delphin — ${project_name}`} />
            <div className="flex h-[calc(100vh-4rem)] min-h-0 w-full min-w-0 flex-col overflow-hidden bg-slate-900 text-white">

                {/* ── 1. Single unified toolbar ──────────────────────────── */}
                <DelphinToolbar
                    mode={mode}
                    budgetView={budgetView}
                    subView={subView}
                    onModeChange={handleModeChange}
                    onBudgetView={setBudgetView}
                    onSubView={setSubView}

                    selectedRowId={selectedRowId}
                    onAddRow={() => setPendingSelect(addTaskAfter(selectedRowId))}
                    onAddChild={() => { if (selectedRowId !== null) setPendingSelect(addChildTask(selectedRowId)); }}
                    onDeleteRow={() => { if (selectedRowId !== null) deleteTask(selectedRowId); }}
                    onIndent={() => { if (selectedRowId !== null) indentTask(selectedRowId); }}
                    onOutdent={() => { if (selectedRowId !== null) outdentTask(selectedRowId); }}
                    onMoveUp={() => { if (selectedRowId !== null) moveTaskUp(selectedRowId); }}
                    onMoveDown={() => { if (selectedRowId !== null) moveTaskDown(selectedRowId); }}
                    onDuplicate={() => { if (selectedRowId !== null) setPendingSelect(duplicateTask(selectedRowId)); }}
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
                    onImportExcel={() => setImportExcelOpen(true)}
                    onOpenInsumos={() => setInsumosOpen(true)}

                    isParentSelected={isParentSelected}
                    onFormulaView={handleFormulaView}

                    budgetDirty={budgetDirty || acuDirty}
                    isSavingBudget={isSavingBudget}
                    ganttDirty={ganttDirty || budgetDirty || acuDirty}
                    isGanttSaving={ganttIsSaving || isSavingBudget}
                    onSaveBudget={() => void handleSaveBudget()}
                    onSaveGantt={() => void handleSaveGantt()}
                    onExport={() => setExportOpen(true)}
                />

                {/* ── 2. Main area ────────────────────────────────────────── */}
                {mode === 'budget' && budgetView === 'formula_polinomica' && formulaParentId !== null ? (
                    <FormulaPolinomicaSplitView
                        key={String(formulaParentId)}
                        parentId={formulaParentId}
                        rows={delphinRows}
                        acuRows={acuRows}
                        diccionario={diccionario}
                        projectName={project_name}
                        onBack={() => setBudgetView('presupuesto')}
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
                            className="flex min-h-0 flex-col overflow-hidden border-r border-slate-700">
                            {/* Search bar */}
                            <div className="flex h-8 shrink-0 items-center gap-2 border-b border-slate-700 bg-slate-900 px-2.5">
                                <Search size={12} className="shrink-0 text-slate-500" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Buscar descripción…"
                                    className="min-w-0 flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-500 outline-none" />
                                {searchQuery && (<>
                                    <span className="shrink-0 text-[10px] text-slate-500">
                                        {filteredRows.length} resultado{filteredRows.length !== 1 ? 's' : ''}
                                    </span>
                                    <button
                                        title="Limpiar búsqueda"
                                        className="shrink-0 text-slate-500 hover:text-slate-300"
                                        onClick={() => setSearchQuery('')}>
                                        <X size={12} />
                                    </button>
                                </>
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
                                onScroll={activeOnScroll}
                                onSelect={selectRow}
                                onStartEdit={startEdit}
                                onCommitField={handleCommitField}
                                onCancelEdit={cancelEdit}
                                onToggleExpand={toggleExpand}
                                onKeyDown={onKeyDown}
                                onRowAction={handleRowAction}
                                onToggleHidden={handleToggleHidden}
                                onToggleDescExpand={() => setDescExpanded((p) => !p)} />
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
                                    onSaveAcu={handleSaveAcu} />
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
                    onSave={setCalendarSettings} />
                <DelphinExportModal
                    open={exportOpen}
                    rows={delphinRows}
                    projectName={project_name}
                    project={project}
                    projectData={projectData}
                    availableSpecialties={availableSpecialties}
                    onClose={() => setExportOpen(false)}
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
                <ImportDelphinModal
                    open={importExcelOpen}
                    project={project}
                    project_id_int={project_id_int}
                    delphinRows={delphinRows}
                    onClose={() => setImportExcelOpen(false)}
                    onBudgetImported={importDelphinRows}
                    onAcusImported={handleAcusImported} />
                <InsumosConsolidadosModal
                    open={insumosOpen}
                    acuRows={acuRows}
                    projectName={project_name}
                    onClose={() => setInsumosOpen(false)} />
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
