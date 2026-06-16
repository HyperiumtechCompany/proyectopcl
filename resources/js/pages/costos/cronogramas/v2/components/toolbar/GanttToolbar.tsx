import React, { useRef, useState } from 'react';
import {
    Bot,
    Calendar,
    ChevronRight,
    ChevronsDownUp,
    ChevronsUpDown,
    CornerDownRight,
    GitBranch,
    Hand,
    IndentDecrease,
    IndentIncrease,
    LayoutDashboard,
    MoreHorizontal,
    Network,
    Plus,
    Save,
    Settings,
    Trash2,
    Upload,
} from 'lucide-react';
import type { SchedulingMode } from '../../types/task';
import type { ZoomLevel } from '../../types/timeline';
import { ZOOM_LABELS } from '../../types/timeline';

export type ViewMode = 'gantt' | 'network';

interface Props {
    projectName: string;
    isDirty: boolean;
    isSaving: boolean;
    selectedRowId: number | null;
    zoomLevel: ZoomLevel;
    showCriticalPath: boolean;
    schedulingMode: SchedulingMode;
    activeView: ViewMode;
    onViewChange: (view: ViewMode) => void;
    onAddRow: () => void;
    onAddChild: () => void;
    onDeleteRow: () => void;
    onIndent: () => void;
    onOutdent: () => void;
    onExpandAll: () => void;
    onCollapseAll: () => void;
    onZoomChange: (zoom: ZoomLevel) => void;
    onToggleCritical: () => void;
    onSchedulingModeChange: (mode: SchedulingMode) => void;
    onOpenSettings: () => void;
    onSave: () => void;
    onImport?: () => void;
}

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: React.ReactNode;
    label: string;
    variant?: 'default' | 'primary' | 'danger' | 'active';
    hideLabel?: boolean;
}

function Btn({
    icon,
    label,
    variant = 'default',
    hideLabel = false,
    className = '',
    ...rest
}: BtnProps) {
    const styles: Record<string, string> = {
        default: 'bg-slate-700 text-slate-200 hover:bg-slate-600',
        primary: 'bg-blue-600 text-white hover:bg-blue-500',
        danger: 'bg-red-700/70 text-red-200 hover:bg-red-600',
        active: 'bg-blue-700 text-blue-100 hover:bg-blue-600',
    };
    return (
        <button
            className={`flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
            title={label}
            {...rest}
        >
            {icon}
            {!hideLabel && <span className="hidden sm:inline">{label}</span>}
        </button>
    );
}

function Divider() {
    return <div className="mx-0.5 h-5 w-px shrink-0 bg-slate-700" />;
}

const ZOOM_ORDER: ZoomLevel[] = [
    'DAY_WEEK',
    'DAY_MONTH',
    'MONTH_YEAR',
    'QUARTER_YEAR',
];

// ─── More menu (overflow for small screens) ───────────────────────────────────
interface MoreMenuProps {
    children: React.ReactNode;
}

function MoreMenu({ children }: MoreMenuProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click
    React.useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node))
                setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <div ref={ref} className="relative flex shrink-0 lg:hidden">
            <button
                className="flex h-7 w-7 items-center justify-center rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
                title="Más opciones"
                onClick={() => setOpen((p) => !p)}
            >
                <MoreHorizontal size={14} />
            </button>
            {open && (
                <div
                    className="absolute right-0 top-9 z-50 flex min-w-45 flex-col gap-1 rounded-lg border border-slate-700 bg-slate-800 p-2 shadow-xl"
                    onClick={() => setOpen(false)}
                >
                    {children}
                </div>
            )}
        </div>
    );
}

// ─── Main toolbar ─────────────────────────────────────────────────────────────
export function GanttToolbar({
    projectName,
    isDirty,
    isSaving,
    selectedRowId,
    zoomLevel,
    showCriticalPath,
    schedulingMode,
    activeView,
    onViewChange,
    onAddRow,
    onAddChild,
    onDeleteRow,
    onIndent,
    onOutdent,
    onExpandAll,
    onCollapseAll,
    onZoomChange,
    onToggleCritical,
    onSchedulingModeChange,
    onOpenSettings,
    onSave,
    onImport,
}: Props) {
    const noSelection = selectedRowId === null;

    return (
        <div className="flex h-10 shrink-0 items-center gap-1.5 border-b border-slate-700 bg-slate-900 px-2">
            {/* ── LEFT: Title + view toggle (always visible) ─────────────── */}
            <div className="flex shrink-0 items-center gap-1.5">
                {/* Breadcrumb title */}
                {/* <div className="flex items-center gap-1 text-xs font-semibold text-slate-300">
                    <span className="hidden text-slate-500 md:inline">
                        {projectName}
                    </span>
                    <ChevronRight
                        size={12}
                        className="hidden text-slate-600 md:block"
                    />
                    <span>Cronograma</span>
                    <span className="ml-0.5 rounded bg-blue-600/30 px-1.5 py-0.5 text-[10px] text-blue-400">
                        v2
                    </span>
                </div>

                <Divider /> */}

                {/* View toggle: Gantt / Red */}
                <div className="flex shrink-0 rounded bg-slate-800 p-0.5">
                    <button
                        type="button"
                        className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                            activeView === 'gantt'
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title="Vista Gantt (cronograma)"
                        onClick={() => onViewChange('gantt')}
                    >
                        <LayoutDashboard size={11} />
                        <span>Gantt</span>
                    </button>
                    <button
                        type="button"
                        className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                            activeView === 'network'
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title="Diagrama de red (PERT)"
                        onClick={() => onViewChange('network')}
                    >
                        <Network size={11} />
                        <span>Red</span>
                    </button>
                </div>
            </div>

            {/* ── CENTER: Scrollable secondary controls ───────────────────── */}
            <div className="relative min-w-0 flex-1 overflow-hidden">
                {/* Gradient fade edges to indicate scrollability */}
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-4 bg-linear-to-r from-slate-900 to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-4 bg-linear-to-l from-slate-900 to-transparent" />

                <div className="flex items-center gap-1 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {/* Filas (gantt only) */}
                    {activeView === 'gantt' && (
                        <>
                            <Divider />
                            <Btn
                                icon={<Plus size={13} />}
                                label="Fila"
                                title="Agregar fila (Insert)"
                                onClick={onAddRow}
                            />
                            <Btn
                                icon={<CornerDownRight size={13} />}
                                label="Sub-fila"
                                title="Agregar fila hija (Ctrl+Insert)"
                                disabled={noSelection}
                                onClick={onAddChild}
                            />
                            <Btn
                                icon={<Trash2 size={13} />}
                                label="Eliminar"
                                variant="danger"
                                disabled={noSelection}
                                onClick={onDeleteRow}
                            />
                            <Divider />

                            {/* Jerarquía */}
                            <Btn
                                icon={<IndentIncrease size={13} />}
                                label="Indentar"
                                title="Indentar (Tab)"
                                disabled={noSelection}
                                onClick={onIndent}
                            />
                            <Btn
                                icon={<IndentDecrease size={13} />}
                                label="Outdentar"
                                title="Outdentar (Shift+Tab)"
                                disabled={noSelection}
                                onClick={onOutdent}
                            />
                            <Divider />

                            {/* Expand/Collapse */}
                            <Btn
                                icon={<ChevronsUpDown size={13} />}
                                label="Expandir"
                                onClick={onExpandAll}
                            />
                            <Btn
                                icon={<ChevronsDownUp size={13} />}
                                label="Colapsar"
                                onClick={onCollapseAll}
                            />
                            <Divider />
                        </>
                    )}

                    {/* Settings */}
                    <Btn
                        icon={<Settings size={13} />}
                        label="Calendario"
                        title="Configurar calendario"
                        onClick={onOpenSettings}
                    />

                    {/* Scheduling mode */}
                    <div className="flex shrink-0 rounded bg-slate-800 p-0.5">
                        <button
                            type="button"
                            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                                schedulingMode === 'automatic'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                            title="Programador automático"
                            onClick={() => onSchedulingModeChange('automatic')}
                        >
                            <Bot size={11} />
                            Auto
                        </button>
                        <button
                            type="button"
                            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                                schedulingMode === 'manual'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                            title="Programador manual"
                            onClick={() => onSchedulingModeChange('manual')}
                        >
                            <Hand size={11} />
                            Manual
                        </button>
                    </div>

                    <Divider />

                    {/* Ruta crítica */}
                    <button
                        className={`flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors ${
                            showCriticalPath
                                ? 'bg-red-700 text-white hover:bg-red-600'
                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'
                        }`}
                        title="Resaltar ruta crítica"
                        onClick={onToggleCritical}
                    >
                        <GitBranch size={13} />
                        <span className="hidden sm:inline">Ruta Crítica</span>
                    </button>

                    {/* Escala temporal (gantt only) */}
                    {activeView === 'gantt' && (
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
                                            onClick={() => onZoomChange(z)}
                                        >
                                            {ZOOM_LABELS[z]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── RIGHT: Fixed — dirty + actions (always visible) ──────────── */}
            <div className="flex shrink-0 items-center gap-1.5">
                {/* More menu for small/medium screens */}
                <MoreMenu>
                    {activeView === 'gantt' && (
                        <>
                            <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                Filas
                            </div>
                            <Btn
                                icon={<Plus size={13} />}
                                label="Agregar fila"
                                onClick={onAddRow}
                                className="w-full justify-start"
                            />
                            <Btn
                                icon={<CornerDownRight size={13} />}
                                label="Agregar sub-fila"
                                disabled={noSelection}
                                onClick={onAddChild}
                                className="w-full justify-start"
                            />
                            <Btn
                                icon={<Trash2 size={13} />}
                                label="Eliminar fila"
                                variant="danger"
                                disabled={noSelection}
                                onClick={onDeleteRow}
                                className="w-full justify-start"
                            />
                            <div className="my-1 border-t border-slate-700" />
                            <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                Jerarquía
                            </div>
                            <Btn
                                icon={<IndentIncrease size={13} />}
                                label="Indentar (Tab)"
                                disabled={noSelection}
                                onClick={onIndent}
                                className="w-full justify-start"
                            />
                            <Btn
                                icon={<IndentDecrease size={13} />}
                                label="Outdentar (Shift+Tab)"
                                disabled={noSelection}
                                onClick={onOutdent}
                                className="w-full justify-start"
                            />
                            <div className="my-1 border-t border-slate-700" />
                        </>
                    )}
                    <Btn
                        icon={<Upload size={13} />}
                        label="Importar MSP"
                        onClick={onImport}
                        className="w-full justify-start"
                    />
                </MoreMenu>

                {/* Dirty indicator */}
                {isDirty && (
                    <span className="shrink-0 text-[10px] text-amber-400">
                        ● <span className="hidden sm:inline">Sin guardar</span>
                    </span>
                )}

                {/* Import — visible on large screens */}
                <Btn
                    icon={<Upload size={13} />}
                    label="Importar MSP"
                    title="Importar XML de MS Project"
                    onClick={onImport}
                    className="hidden lg:flex"
                />

                {/* Save */}
                <Btn
                    icon={<Save size={13} />}
                    label={isSaving ? 'Guardando…' : 'Guardar'}
                    variant="primary"
                    disabled={isSaving || !isDirty}
                    onClick={onSave}
                />
            </div>
        </div>
    );
}
