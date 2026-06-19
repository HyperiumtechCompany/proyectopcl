import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    ArrowDown,
    ArrowUp,
    BarChart2,
    Bot,
    Calendar,
    CalendarDays,
    Calculator,
    ChevronsDownUp,
    ChevronsUpDown,
    Copy,
    CornerDownRight,
    GitBranch,
    Hand,
    IndentDecrease,
    IndentIncrease,
    LayoutDashboard,
    Network,
    NotepadTextIcon,
    Package,
    Plus,
    Save,
    Settings,
    Trash2,
    Upload,
} from 'lucide-react';
import type { SchedulingMode } from '../../cronogramas/v2/types/task';
import type { GanttBarLabel } from '../../cronogramas/v2/types/cell';
import type { ZoomLevel } from '../../cronogramas/v2/types/timeline';
import { ZOOM_LABELS } from '../../cronogramas/v2/types/timeline';
import type { DelphinBudgetView, DelphinMode, DelphinSubView } from '../types';

const ZOOM_ORDER: ZoomLevel[] = ['DAY_WEEK', 'DAY_MONTH', 'MONTH_YEAR', 'QUARTER_YEAR'];

const BAR_LABEL_OPTIONS = [
    { value: 'descripcion', label: 'Descripción' },
    { value: 'costo',       label: 'Costo'        },
    { value: 'empty',       label: 'Vacío'         },
] as const;

interface Props {
    // Mode
    mode:          DelphinMode;
    budgetView:    DelphinBudgetView;
    subView:       DelphinSubView;
    onModeChange:  (m: DelphinMode) => void;
    onBudgetView:  (v: DelphinBudgetView) => void;
    onSubView:     (v: DelphinSubView) => void;

    // Row ops (both modes)
    selectedRowId: number | null;
    onAddRow:      () => void;
    onAddChild:    () => void;
    onDeleteRow:   () => void;
    onIndent:      () => void;
    onOutdent:     () => void;
    onMoveUp:      () => void;
    onMoveDown:    () => void;
    onDuplicate:   () => void;
    onExpandAll:   () => void;
    onCollapseAll: () => void;

    // CPM-specific
    zoomLevel:           ZoomLevel;
    showCriticalPath:    boolean;
    schedulingMode:      SchedulingMode;
    ganttBarLabel:       GanttBarLabel;
    onZoomChange:        (z: ZoomLevel) => void;
    onToggleCritical:    () => void;
    onSchedulingMode:    (m: SchedulingMode) => void;
    onBarLabelChange:    (l: GanttBarLabel) => void;
    onOpenSettings:      () => void;
    onImport?:           () => void;
    onImportExcel?:      () => void;
    onOpenInsumos?:      () => void;

    // Save (context-aware)
    budgetDirty:    boolean;
    isSavingBudget: boolean;
    ganttDirty:     boolean;
    isGanttSaving:  boolean;
    onSaveBudget:   () => void;
    onSaveGantt:    () => void;

    // Export
    onExport: () => void;
}

// ── Shared primitives ─────────────────────────────────────────────────────────

/** Full button with icon + label text (for right-side actions: save, export, import). */
function Btn({
    icon,
    label,
    variant = 'default',
    ...rest
}: {
    icon: React.ReactNode;
    label: string;
    variant?: 'default' | 'primary' | 'danger' | 'active';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    const styles: Record<string, string> = {
        default: 'bg-slate-700 text-slate-200 hover:bg-slate-600',
        primary: 'bg-blue-600 text-white hover:bg-blue-500',
        danger:  'bg-red-700/70 text-red-200 hover:bg-red-600',
        active:  'bg-blue-700 text-blue-100 hover:bg-blue-600',
    };
    return (
        <button
            title={label}
            className={`flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]}`}
            {...rest}
        >
            {icon}
            <span className="hidden sm:inline">{label}</span>
        </button>
    );
}

/** Icon-only button with a portal tooltip that bypasses overflow:hidden parents. */
function IconBtn({
    icon,
    tooltip,
    variant = 'default',
    ...rest
}: {
    icon: React.ReactNode;
    tooltip: string;
    variant?: 'default' | 'primary' | 'danger' | 'active';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    const [rect, setRect] = useState<DOMRect | null>(null);
    const ref = useRef<HTMLButtonElement>(null);

    const styles: Record<string, string> = {
        default: 'bg-slate-700 text-slate-200 hover:bg-slate-600',
        primary: 'bg-blue-600 text-white hover:bg-blue-500',
        danger:  'bg-red-700/70 text-red-200 hover:bg-red-600',
        active:  'bg-blue-700 text-blue-100 hover:bg-blue-600',
    };

    return (
        <>
            <button
                ref={ref}
                title={tooltip}
                className={`flex shrink-0 items-center justify-center rounded p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]}`}
                onMouseEnter={() => setRect(ref.current?.getBoundingClientRect() ?? null)}
                onMouseLeave={() => setRect(null)}
                {...rest}
            >
                {icon}
            </button>
            {rect && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        top: rect.bottom + 5,
                        left: rect.left + rect.width / 2,
                        transform: 'translateX(-50%)',
                        zIndex: 9999,
                        pointerEvents: 'none',
                    }}
                    className="whitespace-nowrap rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-[11px] leading-none text-slate-200 shadow-xl"
                >
                    {tooltip}
                </div>,
                document.body,
            )}
        </>
    );
}

function Divider() {
    return <div className="mx-0.5 h-5 w-px shrink-0 bg-slate-700" />;
}

// ── Config dropdown ───────────────────────────────────────────────────────────
function ConfigDropdown({
    ganttBarLabel,
    onBarLabelChange,
    onOpenSettings,
}: {
    ganttBarLabel:    GanttBarLabel;
    onBarLabelChange: (l: GanttBarLabel) => void;
    onOpenSettings:   () => void;
}) {
    const [open, setOpen] = useState(false);
    const [pos, setPos]   = useState({ top: 0, left: 0 });
    const btnRef   = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const handleToggle = () => {
        if (!open && btnRef.current) {
            const r = btnRef.current.getBoundingClientRect();
            setPos({ top: r.bottom + 4, left: r.left });
        }
        setOpen((p) => !p);
    };

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (
                !btnRef.current?.contains(e.target as Node) &&
                !panelRef.current?.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <>
            <button
                ref={btnRef}
                title="Configuración"
                className={`flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors ${
                    open
                        ? 'bg-blue-700 text-blue-100'
                        : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                }`}
                onClick={handleToggle}
            >
                <Settings size={13} />
                <span className="hidden sm:inline">Config.</span>
            </button>

            {open && createPortal(
                <div
                    ref={panelRef}
                    style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
                    className="w-56 rounded-lg border border-slate-700 bg-slate-900 shadow-2xl ring-1 ring-black/40"
                >
                    <div className="p-3">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Etiqueta en barra
                        </p>
                        <div className="flex rounded-md bg-slate-800 p-0.5">
                            {BAR_LABEL_OPTIONS.map(({ value, label }) => (
                                <button
                                    key={value}
                                    className={`flex-1 rounded py-1 text-[11px] font-medium transition-colors ${
                                        ganttBarLabel === value
                                            ? 'bg-blue-600 text-white shadow'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                    onClick={() => {
                                        onBarLabelChange(value);
                                        setOpen(false);
                                    }}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mx-3 h-px bg-slate-700" />

                    <div className="p-1.5">
                        <button
                            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[11px] text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
                            onClick={() => {
                                onOpenSettings();
                                setOpen(false);
                            }}
                        >
                            <Calendar size={13} className="shrink-0 text-slate-400" />
                            Ajustes de calendario…
                        </button>
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
export function DelphinToolbar({
    mode, budgetView, subView, onModeChange, onBudgetView, onSubView,
    selectedRowId, onAddRow, onAddChild, onDeleteRow, onIndent, onOutdent,
    onMoveUp, onMoveDown, onDuplicate, onExpandAll, onCollapseAll,
    zoomLevel, showCriticalPath, schedulingMode, ganttBarLabel,
    onZoomChange, onToggleCritical, onSchedulingMode, onBarLabelChange,
    onOpenSettings, onImport, onImportExcel, onOpenInsumos,
    budgetDirty, isSavingBudget, ganttDirty, isGanttSaving, onSaveBudget, onSaveGantt,
    onExport,
}: Props) {
    const isFormulaBudgetView = mode === 'budget' && budgetView === 'formula_polinomica';
    const noSel   = selectedRowId === null || isFormulaBudgetView;
    const isDirty  = mode === 'budget' ? budgetDirty : ganttDirty;
    const isSaving = mode === 'budget' ? isSavingBudget : isGanttSaving;
    const onSave   = mode === 'budget' ? onSaveBudget : onSaveGantt;

    // Portal tooltip state for the critical-path toggle (custom styling)
    const [cpRect, setCpRect] = useState<DOMRect | null>(null);
    const cpRef = useRef<HTMLButtonElement>(null);

    return (
        <div className="flex h-10 shrink-0 items-center gap-1.5 border-b border-slate-700 bg-slate-900 px-2">

            {/* ── LEFT: Mode toggle ──────────────────────────────────────── */}
            <div className="flex shrink-0 rounded bg-slate-800 p-0.5">
                <button
                    type="button"
                    title="Presupuesto / ACUs"
                    onClick={() => onModeChange('budget')}
                    className={`flex items-center gap-1 rounded px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        mode === 'budget'
                            ? 'bg-emerald-700 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                    }`}>
                    <BarChart2 size={11} />
                    <span className="hidden sm:inline">Presupuesto</span>
                    <span className="sm:hidden">$</span>
                </button>
                <button
                    type="button"
                    title="CPM — Cronograma General"
                    onClick={() => onModeChange('cpm')}
                    className={`flex items-center gap-1 rounded px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        mode === 'cpm'
                            ? 'bg-sky-700 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                    }`}>
                    <CalendarDays size={11} />
                    <span className="hidden sm:inline">CPM</span>
                    <span className="sm:hidden">⏱</span>
                </button>
            </div>

            <Divider />

            {/* ── CENTER: Scrollable controls ───────────────────────────── */}
            <div className="relative min-w-0 flex-1 overflow-hidden">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-4 bg-linear-to-r from-slate-900 to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-4 bg-linear-to-l from-slate-900 to-transparent" />

                <div className="flex items-center gap-1 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

                    {/* Budget sub-view toggle */}
                    {mode === 'budget' && (
                        <>
                            <div className="flex shrink-0 rounded bg-slate-800 p-0.5">
                                <button
                                    type="button"
                                    title="Presupuesto y ACUs"
                                    onClick={() => onBudgetView('presupuesto')}
                                    className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                                        budgetView === 'presupuesto'
                                            ? 'bg-emerald-700 text-white'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}>
                                    <BarChart2 size={11} /> Presupuesto
                                </button>
                                <button
                                    type="button"
                                    title="Formula Polinomica"
                                    onClick={() => onBudgetView('formula_polinomica')}
                                    className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                                        budgetView === 'formula_polinomica'
                                            ? 'bg-emerald-700 text-white'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}>
                                    <Calculator size={11} /> Formula P.
                                </button>
                            </div>
                            <Divider />
                        </>
                    )}

                    {/* CPM sub-view toggle */}
                    {mode === 'cpm' && (
                        <>
                            <div className="flex shrink-0 rounded bg-slate-800 p-0.5">
                                <button
                                    type="button"
                                    title="Vista Gantt"
                                    onClick={() => onSubView('gantt')}
                                    className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                                        subView === 'gantt'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}>
                                    <LayoutDashboard size={11} /> Gantt
                                </button>
                                <button
                                    type="button"
                                    title="Diagrama de Red (PERT)"
                                    onClick={() => onSubView('network')}
                                    className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                                        subView === 'network'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}>
                                    <Network size={11} /> Red
                                </button>
                            </div>
                            <Divider />
                        </>
                    )}

                    {/* ── Row ops: icon-only with portal tooltips ── */}
                    <IconBtn icon={<Plus size={13} />}            tooltip="Agregar fila  ·  Insert"          onClick={onAddRow} />
                    <IconBtn icon={<CornerDownRight size={13} />} tooltip="Agregar sub-fila  ·  Ctrl+Insert"  disabled={noSel} onClick={onAddChild} />
                    <IconBtn icon={<Trash2 size={13} />}          tooltip="Eliminar fila  ·  Supr"            variant="danger" disabled={noSel} onClick={onDeleteRow} />
                    <Divider />
                    <IconBtn icon={<IndentIncrease size={13} />}  tooltip="Indentar  ·  Tab"                  disabled={noSel} onClick={onIndent} />
                    <IconBtn icon={<IndentDecrease size={13} />}  tooltip="Outdentar  ·  Shift+Tab"           disabled={noSel} onClick={onOutdent} />
                    <Divider />
                    <IconBtn icon={<ArrowUp size={13} />}         tooltip="Subir fila  ·  Alt+↑"             disabled={noSel} onClick={onMoveUp} />
                    <IconBtn icon={<ArrowDown size={13} />}       tooltip="Bajar fila  ·  Alt+↓"             disabled={noSel} onClick={onMoveDown} />
                    <IconBtn icon={<Copy size={13} />}            tooltip="Duplicar fila  ·  Ctrl+D"         disabled={noSel} onClick={onDuplicate} />
                    <Divider />
                    <IconBtn icon={<ChevronsUpDown size={13} />}  tooltip="Expandir todo"                     onClick={onExpandAll} />
                    <IconBtn icon={<ChevronsDownUp size={13} />}  tooltip="Colapsar todo"                     onClick={onCollapseAll} />

                    {/* CPM-only: Programador + Ruta crítica + Zoom */}
                    {mode === 'cpm' && (
                        <>
                            <Divider />
                            <div className="flex shrink-0 rounded bg-slate-800 p-0.5">
                                <button
                                    type="button"
                                    title="Programador automático"
                                    onClick={() => onSchedulingMode('automatic')}
                                    className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                                        schedulingMode === 'automatic'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}>
                                    <Bot size={11} /> Auto
                                </button>
                                <button
                                    type="button"
                                    title="Programador manual"
                                    onClick={() => onSchedulingMode('manual')}
                                    className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                                        schedulingMode === 'manual'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}>
                                    <Hand size={11} /> Manual
                                </button>
                            </div>
                            <Divider />

                            {/* Ruta crítica — icon-only, portal tooltip, red when active */}
                            <button
                                ref={cpRef}
                                title="Resaltar ruta crítica"
                                className={`flex shrink-0 items-center justify-center rounded p-1.5 transition-colors ${
                                    showCriticalPath
                                        ? 'bg-red-700 text-white hover:bg-red-600'
                                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'
                                }`}
                                onClick={onToggleCritical}
                                onMouseEnter={() => setCpRect(cpRef.current?.getBoundingClientRect() ?? null)}
                                onMouseLeave={() => setCpRect(null)}
                            >
                                <GitBranch size={13} />
                            </button>
                            {cpRect && createPortal(
                                <div
                                    style={{
                                        position: 'fixed',
                                        top: cpRect.bottom + 5,
                                        left: cpRect.left + cpRect.width / 2,
                                        transform: 'translateX(-50%)',
                                        zIndex: 9999,
                                        pointerEvents: 'none',
                                    }}
                                    className="whitespace-nowrap rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-[11px] leading-none text-slate-200 shadow-xl"
                                >
                                    Resaltar ruta crítica
                                </div>,
                                document.body,
                            )}

                            {/* Zoom — solo vista Gantt */}
                            {subView === 'gantt' && (
                                <>
                                    <Divider />
                                    <div className="flex shrink-0 items-center gap-1">
                                        <Calendar size={12} className="text-slate-500" />
                                        <div className="flex rounded bg-slate-800 p-0.5">
                                            {ZOOM_ORDER.map((z) => (
                                                <button
                                                    key={z}
                                                    className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
                                                        zoomLevel === z
                                                            ? 'bg-slate-600 text-white'
                                                            : 'text-slate-400 hover:text-slate-200'
                                                    }`}
                                                    title={ZOOM_LABELS[z]}
                                                    onClick={() => onZoomChange(z)}>
                                                    {ZOOM_LABELS[z]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Config. dropdown — fuera del overflow-hidden */}
            {mode === 'cpm' && (
                <>
                    <Divider />
                    <ConfigDropdown
                        ganttBarLabel={ganttBarLabel}
                        onBarLabelChange={onBarLabelChange}
                        onOpenSettings={onOpenSettings}/>
                </>
            )}

            {/* ── RIGHT: dirty indicator + import + save ─────────────────── */}
            <div className="flex shrink-0 items-center gap-1.5">
                {isDirty && (
                    <span className="shrink-0 text-[10px] text-amber-400">
                        ●<span className="ml-1 hidden sm:inline">Sin guardar</span>
                    </span>
                )}
                {mode === 'budget' && (
                    <>
                        <Btn
                            icon={<Package size={13} />}
                            label="Insumos"
                            title="Ver insumos consolidados del proyecto"
                            variant="default"
                            onClick={onOpenInsumos}/>
                        <Btn
                            icon={<Upload size={13} />}
                            label="Imp. Excel"
                            title="Importar presupuesto y ACUs desde Excel (Delphin Express)"
                            variant="default"
                            onClick={onImportExcel}/>
                    </>
                )}
                {mode === 'cpm' && (
                    <Btn
                        icon={<Upload size={13} />}
                        label="Imp."
                        title="Importar XML de MS Project"
                        variant="danger"
                        onClick={onImport}/>
                )}
                <Btn
                    icon={<NotepadTextIcon size={13} />}
                    label="Exportar"
                    title="Exportar a Excel"
                    variant="default"
                    onClick={onExport}/>
                <Btn
                    icon={<Save size={13} />}
                    label={isSaving ? 'Guardando…' : 'Guardar'}
                    variant="primary"
                    disabled={isSaving || !isDirty}
                    onClick={onSave}/>
            </div>
        </div>
    );
}
