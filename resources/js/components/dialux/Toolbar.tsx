/**
 * Toolbar.tsx
 * DIAlux-style sidebar toolbar — scalable, responsive, brand/category-aware.
 *
 * Structure:
 *  1. Types & Constants
 *  2. Primitive UI components
 *  3. FloatingPanelPortal
 *  4. Panel sub-components (Search, BrandFilter, AngleSnap, IsoluxModes)
 *  5. Panel bodies (extracted for readability)
 *  6. Main <Toolbar />
 */

import {
    MousePointer2,
    Square,
    Minus,
    Zap,
    Ruler,
    Hand,
    Grid,
    Layers,
    Trash2,
    Upload,
    AppWindow,
    Umbrella,
    Focus,
    RotateCcw,
    MinusCircle,
    Circle,
    Triangle,
    Move,
    PenTool,
    Spline,
    FilePlus,
    RotateCw,
    X,
    Wrench,
    Building2,
    Eye,
    FileInput,
    Lightbulb,
    DoorOpen,
    Search,
    Tag,
    Type,
} from 'lucide-react';
import React, {
    useRef,
    useCallback,
    useEffect,
    useState,
    useMemo,
} from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

import {
    createScaleConfig,
    useEditorStore,
    useScaleConfig,
} from '@/hooks/dialux/useEditorStore';
import type {
    AngleSnapMode,
    DrawTool,
    IsoluxMode,
    ScaleConfig,
} from '@/hooks/dialux/useEditorStore';
import { useMlightcadEngine } from '@/hooks/dialux/useMlightcadEngine';
import { useWasmEngine } from '@/hooks/dialux/useWasmEngine';
import { getEffectiveScale } from './canvas/canvasUtils';
import { CatalogPanel } from './CatalogPanel';
import { ImportLuminairesModal } from './ImportLuminairesModal';

/*  1. Types & Constants                                                       */
type PanelId =
    | 'herramientas'
    | 'construccion'
    | 'luz'
    | 'medir'
    | 'vista'
    | 'editar'
    | 'exportacion'
    | null;
type PanelWidth = 'sm' | 'md' | 'lg';

/** Pixel width of the sidebar rail — keep in sync with `w-14` (56 px) */
const RAIL_PX = 56;

const WIDTH_CLASS: Record<PanelWidth, string> = {
    sm: 'w-52',
    md: 'w-64',
    lg: 'w-80',
};

/* Brands / materials for catalog filtering */
export const LUMINAIRE_BRANDS = [
    'Todas',
    'Philips',
    'Osram',
    'Ledvance',
    'GE',
    'Cree',
    'Zumtobel',
] as const;
export type LuminaireBrand = (typeof LUMINAIRE_BRANDS)[number];

export const WINDOW_MATERIALS = [
    'Todos',
    'Madera',
    'Aluminio',
    'PVC',
    'Vidrio',
    'Acero',
] as const;
export type WindowMaterial = (typeof WINDOW_MATERIALS)[number];

const ANGLE_SNAP_OPTIONS: Array<{
    value: AngleSnapMode;
    label: string;
    hint: string;
}> = [
    {
        value: 'smart',
        label: 'Inteligente',
        hint: 'Asiste si detecta ángulo',
    },
    { value: 'free', label: 'Libre', hint: 'Sin restricción angular' },
    {
        value: 'orthogonal',
        label: 'Ortogonal',
        hint: '0 · 90 · 180 · 270°',
    },
    {
        value: 'diagonal',
        label: 'Diagonal',
        hint: '30 · 45 · 60° + ortogonales',
    },
];

const ISOLUX_MODES: Array<{ value: IsoluxMode; label: string }> = [
    { value: 'functional', label: 'Funcional' },
    { value: 'waves', label: 'Ondas' },
    { value: 'temperature', label: 'Temperatura' },
];

/*  2. Primitive UI components                                                 */
/** Rail separator line */
const Sep = () => (
    <div className="mx-auto my-1 w-6 border-t border-gray-800/60" />
);

/** Section separator inside a panel */
const PanelSep = ({ label }: { label?: string }) => (
    <div className="my-1.5 flex items-center gap-1.5 px-1">
        <div className="flex-1 border-t border-gray-700/40" />
        {label && (
            <span className="text-[8px] font-semibold tracking-widest text-gray-600 uppercase">
                {label}
            </span>
        )}
        <div className="flex-1 border-t border-gray-700/40" />
    </div>
);

/** Top-level tool button (icon-only, in the rail) */
interface ToolBtnProps {
    tool: DrawTool;
    icon: React.ReactNode;
    tip: string;
    active: DrawTool;
    onSet: (t: DrawTool) => void;
}
const ToolBtn: React.FC<ToolBtnProps> = ({
    tool,
    icon,
    tip,
    active,
    onSet,
}) => (
    <button
        type="button"
        id={`dialux-tool-${tool}`}
        onClick={() => onSet(tool)}
        title={tip}
        className={`flex h-9 w-9 items-center justify-center rounded transition-all duration-150 ${
            active === tool
                ? 'bg-blue-600/50 text-blue-200 ring-1 ring-blue-500/50'
                : 'text-gray-500 hover:bg-gray-700/50 hover:text-gray-200'
        }`}
    >
        {icon}
    </button>
);

/** Group toggle button in the rail — opens a floating panel */
interface GroupBtnProps {
    id: string;
    icon: React.ReactNode;
    label: string;
    isOpen: boolean;
    hasActive?: boolean;
    onClick: () => void;
}
const GroupBtn: React.FC<GroupBtnProps> = ({
    id,
    icon,
    label,
    isOpen,
    hasActive,
    onClick,
}) => (
    <button
        type="button"
        id={id}
        onClick={onClick}
        title={label}
        className={`relative flex h-10 w-10 flex-col items-center justify-center gap-0.5 rounded transition-all duration-150 ${
            isOpen
                ? 'bg-gray-700/80 text-gray-100 ring-1 ring-gray-600/60'
                : hasActive
                  ? 'text-blue-400 hover:bg-gray-700/40'
                  : 'text-gray-500 hover:bg-gray-700/40 hover:text-gray-300'
        }`}
    >
        {icon}
        <span className="text-[7px] leading-none font-medium tracking-wide uppercase opacity-70">
            {label}
        </span>
        {/* Arrow pointing to the panel */}
        {isOpen && (
            <span className="absolute top-1/2 right-0 h-0 w-0 translate-x-full -translate-y-1/2 border-y-4 border-l-[5px] border-y-transparent border-l-[#1e2130]" />
        )}
    </button>
);

/** Full-width tool button inside a floating panel */
interface PanelToolBtnProps extends ToolBtnProps {
    sublabel?: string;
}
const PanelToolBtn: React.FC<PanelToolBtnProps> = ({
    tool,
    icon,
    tip,
    sublabel,
    active,
    onSet,
}) => (
    <button
        type="button"
        id={`dialux-tool-${tool}`}
        onClick={() => onSet(tool)}
        title={tip}
        className={`flex h-8 w-full items-center gap-2.5 rounded px-2 text-left transition-all duration-150 ${
            active === tool
                ? 'bg-blue-600/30 text-blue-200 ring-1 ring-blue-600/30'
                : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
        }`}
    >
        <span className="shrink-0 text-gray-500">{icon}</span>
        <div className="min-w-0">
            <p className="truncate text-[11px] leading-none">
                {tip.split(' (')[0]}
            </p>
            {sublabel && (
                <p className="mt-0.5 text-[9px] leading-snug text-gray-600">
                    {sublabel}
                </p>
            )}
        </div>
    </button>
);

/** Full-width CAD command button inside a floating panel */
interface PanelCadBtnProps {
    command: string;
    title: string;
    icon: React.ReactNode;
    onExecute: (cmd: string) => void;
    isReady: boolean;
    active?: boolean;
}
const PanelCadBtn: React.FC<PanelCadBtnProps> = ({
    command,
    title,
    icon,
    onExecute,
    isReady,
    active,
}) => {
    const [label, sublabel] = title.split(' - ');
    return (
        <button
            type="button"
            onClick={() => onExecute(command)}
            title={isReady ? title : `${title} (motor no listo)`}
            disabled={!isReady}
            className={`flex h-8 w-full items-center gap-2.5 rounded px-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                active
                    ? 'bg-cyan-900/30 text-cyan-300'
                    : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
            }`}
        >
            <span className="shrink-0 text-gray-500">{icon}</span>
            <div className="min-w-0">
                <p className="truncate text-[11px] leading-none">{label}</p>
                {sublabel && (
                    <p className="mt-0.5 truncate text-[9px] leading-snug text-gray-600">
                        {sublabel}
                    </p>
                )}
            </div>
        </button>
    );
};

interface PanelCardProps {
    title?: string;
    children: React.ReactNode;
    tone?: 'default' | 'accent' | 'warning';
}
const PanelCard: React.FC<PanelCardProps> = ({
    title,
    children,
    tone = 'default',
}) => {
    const toneClass = {
        default: 'border-gray-700/50 bg-gray-900/50',
        accent: 'border-cyan-800/40 bg-cyan-950/10',
        warning: 'border-amber-700/40 bg-amber-950/10',
    } satisfies Record<NonNullable<PanelCardProps['tone']>, string>;

    return (
        <div className={`rounded border p-2 ${toneClass[tone]}`}>
            {title ? (
                <p className="mb-2 text-[9px] font-semibold tracking-widest text-gray-600 uppercase">
                    {title}
                </p>
            ) : null}
            {children}
        </div>
    );
};

interface PanelTabsProps<T extends string> {
    tabs: Array<{ id: T; label: string; count?: number }>;
    activeTab: T;
    onChange: (tab: T) => void;
}
function PanelTabs<T extends string>({
    tabs,
    activeTab,
    onChange,
}: PanelTabsProps<T>) {
    return (
        <div className="mb-2 grid grid-cols-2 gap-1 rounded border border-gray-700/50 bg-[#141723] p-1">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    onClick={() => onChange(tab.id)}
                    className={`flex items-center justify-center gap-1 rounded px-2 py-1.5 text-[10px] font-semibold tracking-wide transition-colors ${
                        activeTab === tab.id
                            ? 'bg-cyan-700/40 text-cyan-100 ring-1 ring-cyan-600/40'
                            : 'text-gray-500 hover:bg-gray-800/70 hover:text-gray-200'
                    }`}
                >
                    <span>{tab.label}</span>
                    {tab.count !== undefined ? (
                        <span
                            className={`rounded px-1 py-0.5 text-[9px] ${
                                activeTab === tab.id
                                    ? 'bg-cyan-950/70 text-cyan-200'
                                    : 'bg-gray-800 text-gray-500'
                            }`}
                        >
                            {tab.count}
                        </span>
                    ) : null}
                </button>
            ))}
        </div>
    );
}

/*  3. FloatingPanelPortal                                                     */
interface FloatingPanelPortalProps {
    title: string;
    icon: React.ReactNode;
    anchorRef: React.RefObject<HTMLElement | null>;
    onClose: () => void;
    children: React.ReactNode;
    width?: PanelWidth;
}

const FloatingPanelPortal: React.FC<FloatingPanelPortalProps> = ({
    title,
    icon,
    anchorRef,
    onClose,
    children,
    width = 'sm',
}) => {
    const [top, setTop] = useState(0);

    useEffect(() => {
        const update = () => {
            if (anchorRef.current)
                setTop(anchorRef.current.getBoundingClientRect().top);
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, [anchorRef]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            const panel = document.getElementById('dialux-floating-panel');
            if (
                anchorRef.current &&
                !anchorRef.current.contains(target) &&
                panel &&
                !panel.contains(target)
            ) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [anchorRef, onClose]);

    /* Clamp panel so it doesn't overflow viewport bottom */
    const maxH = `calc(100vh - ${top + 8}px)`;

    return createPortal(
        <div
            id="dialux-floating-panel"
            style={{
                position: 'fixed',
                left: RAIL_PX + 4,
                top,
                zIndex: 9999,
                maxHeight: maxH,
            }}
            className={`${WIDTH_CLASS[width]} flex flex-col overflow-hidden rounded-lg border border-gray-700/60 bg-[#1a1d2e] shadow-2xl ring-1 ring-black/40`}
        >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-gray-700/60 bg-[#1e2236] px-3 py-2">
                <div className="flex items-center gap-2 text-gray-200">
                    <span className="text-gray-400">{icon}</span>
                    <span className="text-[11px] font-semibold tracking-wide">
                        {title}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-5 w-5 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-600/40 hover:text-gray-300"
                >
                    <X size={11} />
                </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-2">
                <div className="flex flex-col gap-0.5">{children}</div>
            </div>
        </div>,
        document.body,
    );
};

/*  4. Panel sub-components                                                    
/** Generic search input */
interface SearchInputProps {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}
const SearchInput: React.FC<SearchInputProps> = ({
    value,
    onChange,
    placeholder = 'Buscar…',
}) => (
    <div className="relative mb-1">
        <Search
            size={11}
            className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-gray-600"
        />
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="h-7 w-full rounded border border-gray-700/60 bg-gray-900/70 pr-2 pl-6 text-[11px] text-gray-200 placeholder-gray-600 transition-colors outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
        />
        {value && (
            <button
                type="button"
                onClick={() => onChange('')}
                className="absolute top-1/2 right-1.5 -translate-y-1/2 text-gray-600 hover:text-gray-400"
            >
                <X size={10} />
            </button>
        )}
    </div>
);

/** Horizontal pill-based brand / category filter */
interface ChipFilterProps<T extends string> {
    options: readonly T[];
    active: T;
    onChange: (v: T) => void;
}
function ChipFilter<T extends string>({
    options,
    active,
    onChange,
}: ChipFilterProps<T>) {
    return (
        <div className="mb-1 flex flex-wrap gap-1">
            {options.map((opt) => (
                <button
                    key={opt}
                    type="button"
                    onClick={() => onChange(opt)}
                    className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        active === opt
                            ? 'bg-cyan-700/60 text-cyan-100 ring-1 ring-cyan-500/40'
                            : 'bg-gray-800/60 text-gray-500 hover:bg-gray-700/60 hover:text-gray-300'
                    }`}
                >
                    <Tag size={8} />
                    {opt}
                </button>
            ))}
        </div>
    );
}

/** Angle-snap selector block */
interface AngleSnapBlockProps {
    mode: AngleSnapMode;
    onChange: (v: AngleSnapMode) => void;
}
const AngleSnapBlock: React.FC<AngleSnapBlockProps> = ({ mode, onChange }) => (
    <div className="rounded border border-gray-700/50 bg-gray-900/50 p-1.5">
        <p className="px-1 pb-1 text-[8px] font-semibold tracking-widest text-gray-600 uppercase">
            Modo angular
        </p>
        {ANGLE_SNAP_OPTIONS.map((opt) => (
            <button
                key={opt.value}
                type="button"
                onClick={() => onChange(opt.value)}
                className={`mt-0.5 flex w-full items-center rounded px-2 py-1.5 text-left transition-colors ${
                    mode === opt.value
                        ? 'bg-cyan-900/30 text-cyan-300'
                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
                }`}
            >
                <span className="text-[11px]">{opt.label}</span>
                <span className="ml-auto text-[9px] text-gray-500">
                    {opt.hint}
                </span>
            </button>
        ))}
        <p className="mt-1 px-1 text-[9px] leading-tight text-gray-600">
            El modo inteligente combina ayuda angular y trazo libre. Mayús
            fuerza ortogonal temporal.
        </p>
    </div>
);

/** Isolux mode selector block */
interface IsoluxBlockProps {
    mode: IsoluxMode;
    onChange: (v: IsoluxMode) => void;
}
const IsoluxBlock: React.FC<IsoluxBlockProps> = ({ mode, onChange }) => (
    <div className="rounded border border-gray-700/50 bg-gray-900/50 p-1.5">
        <p className="px-1 pb-1 text-[8px] font-semibold tracking-widest text-gray-600 uppercase">
            Modo Isolux
        </p>
        {ISOLUX_MODES.map((m) => (
            <button
                key={m.value}
                type="button"
                onClick={() => onChange(m.value)}
                className={`mt-0.5 flex h-7 w-full items-center rounded px-2 text-left text-[11px] transition-colors ${
                    mode === m.value
                        ? 'bg-cyan-900/30 text-cyan-300'
                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
                }`}
            >
                {m.label}
                {mode === m.value && (
                    <span className="ml-auto rounded bg-cyan-950/70 px-1.5 py-0.5 text-[9px] text-cyan-300">
                        Activo
                    </span>
                )}
            </button>
        ))}
    </div>
);

interface HerramientasPanelProps {
    onExecute: (cmd: string) => void;
    isReady: boolean;
}
const HerramientasPanel: React.FC<HerramientasPanelProps> = ({
    onExecute,
    isReady,
}) => {
    const CMDS: Array<{
        cmd: string;
        label: string;
        sublabel: string;
        icon: React.ReactNode;
    }> = [
        {
            cmd: 'line',
            label: 'Línea',
            sublabel: 'Líneas rectas',
            icon: <MinusCircle size={13} />,
        },
        {
            cmd: 'pline',
            label: 'Polilínea',
            sublabel: 'Continuas conectadas',
            icon: <PenTool size={13} />,
        },
        {
            cmd: 'rectangle',
            label: 'Rectángulo',
            sublabel: 'Forma cerrada',
            icon: <Square size={13} />,
        },
        {
            cmd: 'circle',
            label: 'Círculo',
            sublabel: 'Centro + radio',
            icon: <Circle size={13} />,
        },
        {
            cmd: 'arc',
            label: 'Arco',
            sublabel: '3 puntos o ángulo',
            icon: <Triangle size={13} />,
        },
        {
            cmd: 'spline',
            label: 'Curva',
            sublabel: 'Curva suave',
            icon: <Spline size={13} />,
        },
        {
            cmd: 'text',
            label: 'Texto',
            sublabel: 'Texto simple',
            icon: <Type size={13} />,
        },
        {
            cmd: 'mtext',
            label: 'Texto múltiple',
            sublabel: 'Bloque multilínea',
            icon: <FilePlus size={13} />,
        },
    ];
    return (
        <>
            {CMDS.map(({ cmd, label, sublabel, icon }) => (
                <PanelCadBtn
                    key={cmd}
                    command={cmd}
                    title={`${label} - ${sublabel}`}
                    icon={icon}
                    onExecute={onExecute}
                    isReady={isReady}
                />
            ))}
        </>
    );
};

interface ConstruccionPanelProps {
    activeTool: DrawTool;
    onSetTool: (t: DrawTool) => void;
    angleSnapMode: AngleSnapMode;
    onSetAngleSnap: (v: AngleSnapMode) => void;
}
const ConstruccionPanel: React.FC<ConstruccionPanelProps> = ({
    activeTool,
    onSetTool,
    angleSnapMode,
    onSetAngleSnap,
}) => {
    const [search, setSearch] = useState('');
    const [material, setMaterial] = useState<WindowMaterial>('Todos');
    const [activeTab, setActiveTab] = useState<'tools' | 'catalog'>('tools');

    const TOOLS: Array<{
        tool: DrawTool;
        icon: React.ReactNode;
        tip: string;
        sublabel?: string;
    }> = [
        {
            tool: 'room',
            icon: <Square size={13} />,
            tip: 'Recinto poligonal (R)',
            sublabel: 'Polígono del recinto',
        },
        {
            tool: 'corridor',
            icon: <Layers size={13} />,
            tip: 'Pasadizo',
            sublabel: 'Polígono reflejado en techo',
        },
        {
            tool: 'wall',
            icon: <Minus size={13} />,
            tip: 'Pared (W)',
            sublabel: 'Polilínea de pared',
        },
        { tool: 'window', icon: <AppWindow size={13} />, tip: 'Ventana (N)' },
        { tool: 'door', icon: <DoorOpen size={13} />, tip: 'Puerta (D)' },
        { tool: 'canopy', icon: <Umbrella size={13} />, tip: 'Voladizo (C)' },
    ];

    return (
        <>
            <PanelTabs
                tabs={[
                    { id: 'tools', label: 'Dibujo', count: TOOLS.length },
                    { id: 'catalog', label: 'Catálogo' },
                ]}
                activeTab={activeTab}
                onChange={setActiveTab}
            />

            {activeTab === 'tools' ? (
                <>
                    <PanelCard title="Herramientas" tone="accent">
                        <div className="grid grid-cols-2 gap-1">
                            {TOOLS.map((t) => (
                                <PanelToolBtn
                                    key={t.tool}
                                    {...t}
                                    active={activeTool}
                                    onSet={onSetTool}
                                />
                            ))}
                        </div>
                    </PanelCard>

                    <PanelSep label="Ayuda de dibujo" />
                    <AngleSnapBlock
                        mode={angleSnapMode}
                        onChange={onSetAngleSnap}
                    />

                    <PanelCard title="Flujo recomendado">
                        <div className="space-y-1 text-[10px] leading-relaxed text-gray-400">
                            <p>1. Dibuja recinto o muros sin importar CAD.</p>
                            <p>
                                2. Inserta ventanas, puertas y voladizos sobre
                                la geometría creada.
                            </p>
                            <p>
                                3. Importa plano solo si necesitas referencia o
                                calibración externa.
                            </p>
                        </div>
                    </PanelCard>
                </>
            ) : (
                <>
                    <PanelCard title="Filtros">
                        <ChipFilter
                            options={WINDOW_MATERIALS}
                            active={material}
                            onChange={setMaterial}
                        />
                        <SearchInput
                            value={search}
                            onChange={setSearch}
                            placeholder="Buscar ventana o puerta…"
                        />
                    </PanelCard>

                    <PanelCard title="Objetos arquitectónicos">
                        <div className="max-h-[50vh] overflow-y-auto pr-0.5">
                            <CatalogPanel
                                filterCategory="architecture"
                                filterMaterial={
                                    material !== 'Todos' ? material : undefined
                                }
                                search={search}
                            />
                        </div>
                    </PanelCard>
                </>
            )}
        </>
    );
};

interface LuzPanelProps {
    activeTool: DrawTool;
    onSetTool: (t: DrawTool) => void;
    gridRows: number;
    gridCols: number;
    onSetRows: (n: number) => void;
    onSetCols: (n: number) => void;
    onOpenImportModal?: () => void;
}
const LuzPanel: React.FC<LuzPanelProps> = ({
    activeTool,
    onSetTool,
    gridRows,
    gridCols,
    onSetRows,
    onSetCols,
    onOpenImportModal,
}) => {
    const [brand, setBrand] = useState<LuminaireBrand>('Todas');
    const [activeTab, setActiveTab] = useState<'insert' | 'catalog'>('insert');

    return (
        <>
            <PanelTabs
                tabs={[
                    { id: 'insert', label: 'Inserción' },
                    { id: 'catalog', label: 'Catálogo' },
                ]}
                activeTab={activeTab}
                onChange={setActiveTab}
            />

            {activeTab === 'insert' ? (
                <>
                    <PanelCard title="Herramientas de luz" tone="accent">
                        <div className="grid grid-cols-2 gap-1">
                            <PanelToolBtn
                                tool="fixture"
                                icon={<Zap size={13} />}
                                active={activeTool}
                                onSet={onSetTool}
                                tip="Luminaria (F)"
                                sublabel="Colocar una a una"
                            />
                            <PanelToolBtn
                                tool="fixture-grid"
                                icon={<Grid size={13} />}
                                active={activeTool}
                                onSet={onSetTool}
                                tip="Grilla de Focos (G)"
                                sublabel="Distribución N×M centrada"
                            />
                        </div>
                    </PanelCard>

                    <PanelSep label="Grilla" />

                    <PanelCard title="Configuración de grilla">
                        <div className="space-y-2">
                            <div className="flex gap-2">
                                {[
                                    {
                                        label: 'Filas',
                                        value: gridRows,
                                        set: onSetRows,
                                    },
                                    {
                                        label: 'Columnas',
                                        value: gridCols,
                                        set: onSetCols,
                                    },
                                ].map(({ label, value, set }) => (
                                    <div key={label} className="flex-1">
                                        <label className="mb-1 block text-[9px] text-gray-600 uppercase">
                                            {label}
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={20}
                                            value={value}
                                            onChange={(e) =>
                                                set(
                                                    Math.max(
                                                        1,
                                                        parseInt(
                                                            e.target.value,
                                                            10,
                                                        ) || 1,
                                                    ),
                                                )
                                            }
                                            className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-200 outline-none focus:ring-1 focus:ring-amber-500/50"
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center justify-between rounded border border-amber-700/20 bg-amber-950/10 px-2 py-1.5 text-[10px] text-gray-300">
                                <span>
                                    Distribución centrada en el recinto activo
                                </span>
                                <span className="font-mono text-amber-300">
                                    {gridRows * gridCols} uds
                                </span>
                            </div>
                        </div>
                    </PanelCard>
                </>
            ) : (
                <>
                    <PanelCard title="Búsqueda de luminarias">
                        <p className="mb-3 text-[10px] text-gray-400">
                            Abre el catálogo completo para buscar y seleccionar luminarias.
                        </p>
                        <Button
                            className="w-full justify-center gap-2 bg-cyan-700/80 text-cyan-100 hover:bg-cyan-600/80"
                            onClick={onOpenImportModal}
                        >
                            <Lightbulb size={14} />
                            <span>Abrir catálogo de luminarias</span>
                        </Button>
                    </PanelCard>

                    <PanelCard title="Filtros por marca">
                        <ChipFilter
                            options={LUMINAIRE_BRANDS}
                            active={brand}
                            onChange={setBrand}
                        />
                        <p className="mt-2 text-[9px] leading-tight text-gray-600">
                            Selecciona una marca para filtrar los resultados en el catálogo.
                        </p>
                    </PanelCard>
                </>
            )}
        </>
    );
};

interface MedirPanelProps {
    activeTool: DrawTool;
    onSetTool: (t: DrawTool) => void;
    onExecute: (cmd: string) => void;
    isReady: boolean;
}
const MedirPanel: React.FC<MedirPanelProps> = ({
    activeTool,
    onSetTool,
    onExecute,
    isReady,
}) => (
    <>
        <PanelToolBtn
            tool="measure"
            icon={<Ruler size={13} />}
            active={activeTool}
            onSet={onSetTool}
            tip="Medir distancia (M)"
        />
        <PanelCadBtn
            command="measurearea"
            title="Medir área"
            icon={<Ruler size={13} />}
            onExecute={onExecute}
            isReady={isReady}
        />
        <PanelCadBtn
            command="measureangle"
            title="Medir ángulo"
            icon={<RotateCw size={13} />}
            onExecute={onExecute}
            isReady={isReady}
        />
        <PanelSep />
        <PanelCadBtn
            command="clearmeasurements"
            title="Limpiar mediciones"
            icon={<Trash2 size={13} />}
            onExecute={onExecute}
            isReady={isReady}
        />
    </>
);

interface VistaPanelProps {
    showIsolux: boolean;
    isoluxMode: IsoluxMode;
    isReady: boolean;
    onExecute: (cmd: string) => void;
    onToggleIsolux: () => void;
    onSetIsoluxMode: (m: IsoluxMode) => void;
    onResetView: () => void;
}
const VistaPanel: React.FC<VistaPanelProps> = ({
    showIsolux,
    isoluxMode,
    isReady,
    onExecute,
    onToggleIsolux,
    onSetIsoluxMode,
    onResetView,
}) => (
    <>
        <PanelCadBtn
            command="zoom"
            title="Zoom extents - Ajustar vista"
            icon={<Focus size={13} />}
            onExecute={onExecute}
            isReady={isReady}
        />
        <PanelCadBtn
            command="pan"
            title="Pan CAD - Mover vista"
            icon={<Move size={13} />}
            onExecute={onExecute}
            isReady={isReady}
        />

        <PanelSep />

        {/* Grid — not supported */}
        <button
            type="button"
            disabled
            title="Grilla nativa no soportada en este motor"
            className="flex h-8 w-full cursor-not-allowed items-center gap-2.5 rounded bg-gray-800/80 px-2 text-gray-500"
        >
            <Grid size={13} />
            <span className="text-[11px]">Grilla</span>
            <span className="ml-auto rounded bg-gray-700/50 px-1.5 py-0.5 text-[9px] text-gray-400">
                N/D
            </span>
        </button>

        {/* Isolux toggle */}
        <button
            type="button"
            id="dialux-toggle-isolux"
            onClick={onToggleIsolux}
            className={`flex h-8 w-full items-center gap-2.5 rounded px-2 text-left transition-colors ${
                showIsolux
                    ? 'bg-yellow-900/20 text-yellow-400'
                    : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
            }`}
        >
            <Layers size={13} />
            <span className="text-[11px]">Isolux</span>
            <span
                className={`ml-auto rounded px-1.5 py-0.5 text-[9px] ${showIsolux ? 'bg-yellow-900/40 text-yellow-400' : 'bg-gray-700/50 text-gray-600'}`}
            >
                {showIsolux ? 'ON' : 'OFF'}
            </span>
        </button>

        <IsoluxBlock mode={isoluxMode} onChange={onSetIsoluxMode} />

        <PanelSep />
        <button
            type="button"
            id="dialux-reset-view"
            onClick={onResetView}
            className="flex h-8 w-full items-center gap-2.5 rounded px-2 text-left text-gray-400 transition-colors hover:bg-gray-700/50 hover:text-gray-100"
        >
            <RotateCcw size={13} />
            <span className="text-[11px]">Resetear vista</span>
        </button>
    </>
);

/* â”€â”€ Document CAD Panel â”€â”€ */
interface DocumentoPanelProps {
    hasCadDoc: boolean;
    isLoading: boolean;
    fileName?: string;
    activeTool: DrawTool;
    scaleConfig: ScaleConfig | null;
    detectedScale: ScaleConfig | null;
    scaleConfirmed: boolean;
    onNewDoc: () => void;
    onImportClick: () => void;
    onApplyScale: (cfg: ScaleConfig) => Promise<void>;
    onCalibrate: () => void;
    onResetCalibration: () => void;
}
const ExportacionPanel: React.FC<DocumentoPanelProps> = ({
    hasCadDoc,
    isLoading,
    fileName,
    activeTool,
    scaleConfig,
    detectedScale,
    scaleConfirmed,
    onNewDoc,
    onImportClick,
    onApplyScale,
    onCalibrate,
    onResetCalibration,
}) => {
    return (
        <div className="space-y-3">
            <PanelCard title="Documento" tone="accent">
                <p className="mb-2 text-[10px] text-gray-400">
                    Inicia un plano CAD editable en blanco.
                </p>
                <Button
                    variant="outline"
                    className="w-full justify-start gap-2 border-cyan-800/40 bg-cyan-950/20 text-cyan-200 hover:bg-cyan-900/40"
                    onClick={() => onNewDoc()}
                    disabled={isLoading}
                >
                    <FilePlus size={14} />
                    <span>Nuevo documento</span>
                </Button>
                <div className="mt-2 rounded border border-cyan-900/30 bg-cyan-950/10 px-2 py-1.5 text-[10px] text-gray-400">
                    <span className="text-gray-500">Estado: </span>
                    <span className="font-mono text-cyan-300">
                        {hasCadDoc ? (fileName ?? 'Documento activo') : 'Sin documento'}
                    </span>
                </div>
            </PanelCard>

            <PanelCard title="Importación" tone="accent">
                <p className="mb-2 text-[10px] text-gray-400">
                    Carga un plano CAD para usarlo como referencia en tu diseño.
                </p>
                <Button
                    variant="outline"
                    className="w-full justify-start gap-2 border-cyan-800/40 bg-cyan-950/20 text-cyan-200 hover:bg-cyan-900/40"
                    onClick={onImportClick}
                >
                    <Upload size={14} />
                    <span>Importar DXF / DWG</span>
                </Button>
            </PanelCard>

            <PanelCard title="Escala y calibración">
                <div className="space-y-2 text-[10px] text-gray-400">
                    <div className="rounded border border-gray-700/50 bg-gray-900/50 px-2 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <span>Escala actual</span>
                            <span className="font-mono text-cyan-300">
                                {scaleConfig?.displayUnit ?? 'No definida'}
                            </span>
                        </div>
                        {detectedScale && !scaleConfirmed && (
                            <button
                                type="button"
                                onClick={() => void onApplyScale(detectedScale)}
                                className="mt-1 w-full rounded bg-amber-700/70 px-2 py-1 text-[10px] font-medium text-amber-50 transition-colors hover:bg-amber-600"
                            >
                                Confirmar escala detectada
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            className={`justify-center gap-1 border-gray-700 bg-gray-800/40 text-gray-200 hover:bg-gray-700/60 ${
                                activeTool === 'calibrate'
                                    ? 'border-amber-600/60 bg-amber-900/30 text-amber-200'
                                    : ''
                            }`}
                            onClick={onCalibrate}
                        >
                            <Ruler size={12} />
                            Calibrar
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="justify-center gap-1 border-gray-700 bg-gray-800/40 text-gray-200 hover:bg-gray-700/60"
                            onClick={onResetCalibration}
                        >
                            <RotateCcw size={12} />
                            Reset
                        </Button>
                    </div>
                </div>
            </PanelCard>

            <PanelCard title="Exportación">
                <p className="mb-2 text-[10px] text-gray-400">
                    Genera el reporte técnico formal en formato PDF.
                </p>
                <Button
                    variant="outline"
                    className="w-full justify-start gap-2 border-gray-700 bg-gray-800/40 text-gray-200 hover:bg-gray-700/60"
                    onClick={() => {
                        // This would typically trigger the PDF export from EditorLayout
                        // But since we are in Toolbar, we might need a store action
                        // For now, let's just show the intent.
                        const btn = document.getElementById('dialux-btn-export-pdf');
                        if (btn) btn.click();
                    }}
                >
                    <FileInput size={14} />
                    <span>Exportar Reporte PDF</span>
                </Button>
            </PanelCard>
        </div>
    );
};

interface EditarPanelProps {
    onExecute: (cmd: string) => void;
    isReady: boolean;
    onDeleteSelected: () => void;
}
const EditarPanel: React.FC<EditarPanelProps> = ({
    onExecute,
    isReady,
    onDeleteSelected,
}) => (
    <>
        <PanelCadBtn
            command="erase"
            title="Borrar - Objetos seleccionados"
            icon={<Trash2 size={13} />}
            onExecute={onExecute}
            isReady={isReady}
        />
        <button
            type="button"
            id="dialux-delete-selected"
            onClick={onDeleteSelected}
            className="flex h-8 w-full items-center gap-2.5 rounded px-2 text-left text-red-500/70 transition-colors hover:bg-red-900/20 hover:text-red-400">
            <X size={13} />
            <span className="text-[11px]">Eliminar seleccionado</span>
        </button>
    </>
);


export const Toolbar: React.FC = () => {
    const store = useEditorStore();
    const wasmEngine = useWasmEngine();
    const engine = useMlightcadEngine();
    const scaleConfig = useScaleConfig();

    const { activeTool, angleSnapMode, showGrid, showIsolux, isoluxMode } =
        store.ui;
    const { isParsing, parseDxf, rescaleDxfEntities } = wasmEngine;

    const fileInputRef = useRef<HTMLInputElement>(null);

    /* Panel state */
    const [openPanel, setOpenPanel] = useState<PanelId>(null);
    const [lastCmd, setLastCmd] = useState<string | null>(null);
    const [detectedScale, setDetectedScale] = useState<ScaleConfig | null>(
        null,
    );
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [scaleConfirmed, setScaleConfirmed] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isImportLuminairesModalOpen, setIsImportLuminairesModalOpen] =
        useState(false);

    /* Anchor refs for each group button */
    const herramientasRef = useRef<HTMLDivElement>(null);
    const construccionRef = useRef<HTMLDivElement>(null);
    const luzRef = useRef<HTMLDivElement>(null);
    const medirRef = useRef<HTMLDivElement>(null);
    const vistaRef = useRef<HTMLDivElement>(null);
    const exportacionRef = useRef<HTMLDivElement>(null);
    const editarRef = useRef<HTMLDivElement>(null);
    const refs = useMemo(
        () =>
            ({
                herramientas: herramientasRef,
                construccion: construccionRef,
                luz: luzRef,
                medir: medirRef,
                vista: vistaRef,
                exportacion: exportacionRef,
                editar: editarRef,
            }) as const,
        [],
    );

    const closePanel = useCallback(() => setOpenPanel(null), []);
    const togglePanel = useCallback(
        (id: PanelId) => setOpenPanel((prev) => (prev === id ? null : id)),
        [],
    );

    
    const hasCadDoc = !!engine.activeDoc;
    const isLoading = engine.isLoading || isParsing;
    const isReady = engine.isReady;

  
    const handleFileUpload = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const ok = await engine.openFile(file);
            if (ok) {
                setPendingFile(file);
                setScaleConfirmed(false);
                setTimeout(async () => {
                    const ext = engine.getDocumentExtents?.();
                    if (ext) {
                        const suggested = store.detectScaleFromExtents({
                            min_x: ext.minX,
                            min_y: ext.minY,
                            max_x: ext.maxX,
                            max_y: ext.maxY,
                        });
                        setDetectedScale(suggested);
                        await applyScaleConfig(suggested);
                    } else {
                        setDetectedScale(null);
                    }
                    setIsImportModalOpen(true);
                }, 500);
            }
            if (fileInputRef.current) fileInputRef.current.value = '';
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [engine, store],
    );

    const applyScaleConfig = useCallback(
        async (config: ScaleConfig) => {
            const prevEffective = getEffectiveScale(scaleConfig);
            store.setScaleConfig(config, true);
            setDetectedScale(config);
            setScaleConfirmed(true);
            if (pendingFile?.name.toLowerCase().endsWith('.dxf')) {
                if (store.dxfEntities) {
                    rescaleDxfEntities(
                        prevEffective,
                        getEffectiveScale(config),
                    );
                } else {
                    await parseDxf?.(pendingFile, getEffectiveScale(config));
                }
            }
        },
        [parseDxf, pendingFile, rescaleDxfEntities, scaleConfig, store],
    );

    const handleCommand = useCallback(
        (cmd: string) => {
            setLastCmd(cmd);
            engine.sendCommand(cmd);
            if (store.ui.activeTool !== 'select') store.setTool('select');
        },
        [engine, store],
    );

    const handleDeleteSelected = useCallback(() => {
        const { selectedId } = store.ui;
        if (selectedId) store.removeObject(selectedId);
    }, [store]);

    const handleResetCalibration = useCallback(() => {
        const prev = getEffectiveScale(scaleConfig);
        const next = store.resetCalibration();
        if (next && store.dxfEntities)
            rescaleDxfEntities(prev, getEffectiveScale(next));
    }, [rescaleDxfEntities, scaleConfig, store]);

    const handleResetView = useCallback(() => {
        store.setZoom(1);
        store.setPan(0, 0);
        engine.fitToView?.();
    }, [engine, store]);


    const GROUPS: Array<{
        id: PanelId & string;
        ref: React.RefObject<HTMLDivElement | null>;
        icon: React.ReactNode;
        label: string;
        hasActive?: boolean;
    }> = useMemo(
        () => [
            {
                id: 'construccion',
                ref: refs.construccion,
                icon: <Building2 size={14} />,
                label: 'Herr.', // Changed Arq to Herr as requested
                hasActive:
                    activeTool === 'room' ||
                    activeTool === 'wall' ||
                    activeTool === 'window' ||
                    activeTool === 'door' ||
                    activeTool === 'corridor',
            },
            {
                id: 'luz',
                ref: refs.luz,
                icon: <Lightbulb size={14} />,
                label: 'Luz',
                hasActive:
                    activeTool === 'fixture' || activeTool === 'fixture-grid',
            },
            {
                id: 'herramientas',
                ref: refs.herramientas,
                icon: <Wrench size={14} />,
                label: 'CAD',
            },
            {
                id: 'medir',
                ref: refs.medir,
                icon: <Ruler size={14} />,
                label: 'Medir',
                hasActive: activeTool === 'measure',
            },
            {
                id: 'vista',
                ref: refs.vista,
                icon: <Eye size={14} />,
                label: 'Vista',
                hasActive: showGrid || showIsolux,
            },
            {
                id: 'exportacion',
                ref: refs.exportacion,
                icon: <FileInput size={14} />,
                label: 'Doc.',
                hasActive: hasCadDoc || activeTool === 'calibrate',
            },
        ],
        [activeTool, hasCadDoc, refs, showGrid, showIsolux],
    );

  
    return (
        <>
            {/* Hidden file input */}
            <input
                type="file"
                className="hidden"
                accept=".dxf,.dwg"
                ref={fileInputRef}
                onChange={handleFileUpload}
            />

            {/* â”€â”€ Sidebar rail â”€â”€ */}
            <aside
                id="dialux-toolbar"
                className="relative flex w-14 shrink-0 flex-col items-center gap-0.5 overflow-x-visible overflow-y-auto border-r border-gray-800/60 bg-[#161820] py-2"
            >
                {/* DIAlux native tools */}
                <span className="mt-1 px-1 text-[7px] font-semibold tracking-widest text-gray-700 uppercase">
                    DIAlux
                </span>
                <div className="flex w-full flex-col items-center gap-0.5 px-1.5">
                    <ToolBtn
                        tool="select"
                        icon={<MousePointer2 size={15} />}
                        active={activeTool}
                        onSet={store.setTool}
                        tip="Seleccionar (V)"
                    />
                    <ToolBtn
                        tool="room"
                        icon={<Square size={15} />}
                        active={activeTool}
                        onSet={store.setTool}
                        tip="Recinto poligonal (R)"
                    />
                    <ToolBtn
                        tool="wall"
                        icon={<Minus size={15} />}
                        active={activeTool}
                        onSet={store.setTool}
                        tip="Pared (W)"
                    />
                    <ToolBtn
                        tool="pan"
                        icon={<Hand size={15} />}
                        active={activeTool}
                        onSet={store.setTool}
                        tip="Pan (Espacio)"
                    />
                </div>

                <Sep />

                {/* Group buttons */}
                <div className="flex w-full flex-col items-center gap-2 px-1">
                    {GROUPS.map(({ id, ref, icon, label, hasActive }) => (
                        <div key={id} ref={ref} className="w-full">
                            <GroupBtn
                                id={`group-${id}`}
                                icon={icon}
                                label={label}
                                isOpen={openPanel === id}
                                hasActive={hasActive}
                                onClick={() => togglePanel(id)}
                            />
                        </div>
                    ))}
                </div>

                <Sep />

                {/* Edit group */}
                <div
                    ref={refs.editar}
                    className="flex w-full flex-col items-center px-1"
                >
                    <GroupBtn
                        id="group-editar"
                        icon={<Trash2 size={14} />}
                        label="Editar"
                        isOpen={openPanel === 'editar'}
                        onClick={() => togglePanel('editar')}
                    />
                </div>

                <div className="flex-1" />

                {/* Last command hint */}
                {lastCmd && (
                    <div
                        className="px-1 pb-1 text-center text-[8px] break-all text-cyan-700"
                        title={lastCmd}
                    >
                        {lastCmd.length > 8
                            ? `${lastCmd.slice(0, 8)}…`
                            : lastCmd}
                    </div>
                )}
            </aside>

            {/* ——— Floating Panels ——— */}
            {openPanel === 'herramientas' && (
                <FloatingPanelPortal
                    title="Herramientas de dibujo"
                    icon={<Wrench size={12} />}
                    anchorRef={refs.herramientas}
                    onClose={closePanel}>
                    <HerramientasPanel
                        onExecute={handleCommand}
                        isReady={isReady}
                    />
                </FloatingPanelPortal>
            )}

            {openPanel === 'construccion' && (
                <FloatingPanelPortal
                    title="Construcción"
                    icon={<Building2 size={12} />}
                    anchorRef={refs.construccion}
                    onClose={closePanel}
                    width="md">
                    <ConstruccionPanel
                        activeTool={activeTool}
                        onSetTool={store.setTool}
                        angleSnapMode={angleSnapMode}
                        onSetAngleSnap={store.setAngleSnapMode}
                    />
                </FloatingPanelPortal>
            )}

            {openPanel === 'luz' && (
                <FloatingPanelPortal
                    title="Iluminación"
                    icon={<Lightbulb size={13} />}
                    anchorRef={refs.luz}
                    onClose={closePanel}
                    width="md"
                >
                    <LuzPanel
                        activeTool={activeTool}
                        onSetTool={store.setTool}
                        gridRows={store.ui.fixtureGridRows}
                        gridCols={store.ui.fixtureGridCols}
                        onSetRows={store.setFixtureGridRows}
                        onSetCols={store.setFixtureGridCols}
                        onOpenImportModal={() =>
                            setIsImportLuminairesModalOpen(true)
                        }
                    />
                </FloatingPanelPortal>
            )}

            {openPanel === 'medir' && (
                <FloatingPanelPortal
                    title="Medición"
                    icon={<Ruler size={13} />}
                    anchorRef={refs.medir}
                    onClose={closePanel}
                >
                    <MedirPanel
                        activeTool={activeTool}
                        onSetTool={store.setTool}
                        onExecute={handleCommand}
                        isReady={isReady}
                    />
                </FloatingPanelPortal>
            )}

            {openPanel === 'vista' && (
                <FloatingPanelPortal
                    title="Vista"
                    icon={<Eye size={13} />}
                    anchorRef={refs.vista}
                    onClose={closePanel}
                >
                    <VistaPanel
                        showIsolux={showIsolux}
                        isoluxMode={isoluxMode}
                        isReady={isReady}
                        onExecute={handleCommand}
                        onToggleIsolux={store.toggleIsolux}
                        onSetIsoluxMode={store.setIsoluxMode}
                        onResetView={handleResetView}
                    />
                </FloatingPanelPortal>
            )}

            {openPanel === 'exportacion' && (
                <FloatingPanelPortal
                    title="Exportación y Planos"
                    icon={<FileInput size={13} />}
                    anchorRef={refs.exportacion}
                    onClose={closePanel}
                    width="md"
                >
                    <ExportacionPanel
                        hasCadDoc={hasCadDoc}
                        isLoading={isLoading}
                        fileName={engine.fileName ?? undefined}
                        activeTool={activeTool}
                        scaleConfig={scaleConfig}
                        detectedScale={detectedScale}
                        scaleConfirmed={scaleConfirmed}
                        onNewDoc={() => engine.newDocument?.()}
                        onImportClick={() => fileInputRef.current?.click()}
                        onApplyScale={applyScaleConfig}
                        onCalibrate={() => {
                            store.setTool('calibrate');
                            closePanel();
                        }}
                        onResetCalibration={handleResetCalibration}
                    />
                </FloatingPanelPortal>
            )}

            {openPanel === 'editar' && (
                <FloatingPanelPortal
                    title="Editar"
                    icon={<Trash2 size={13} />}
                    anchorRef={refs.editar}
                    onClose={closePanel}
                >
                    <EditarPanel
                        onExecute={handleCommand}
                        isReady={isReady}
                        onDeleteSelected={handleDeleteSelected}
                    />
                </FloatingPanelPortal>
            )}

            {/* ——— Import & Scale Modal ——— */}
            <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
                <DialogContent className="border-gray-800 bg-[#161820] text-gray-100 sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-bold text-cyan-400">
                            <Upload size={20} />
                            Importar Plano CAD
                        </DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Configura la escala y unidades para el archivo{' '}
                            <span className="font-mono text-cyan-200">
                                {pendingFile?.name}
                            </span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="rounded-lg border border-cyan-900/30 bg-cyan-950/20 p-4">
                            <h4 className="mb-2 text-xs font-semibold text-cyan-300 uppercase tracking-wider">
                                Unidades del archivo
                            </h4>
                            <select
                                id="dialux-modal-scale-select"
                                value={scaleConfig?.unit || 'm'}
                                onChange={async (e) => {
                                    const unit = e.target.value as 'mm' | 'cm' | 'm';
                                    const map = {
                                        mm: { factor: 0.001, display: 'Milímetros (1000 = 1m)' },
                                        cm: { factor: 0.01, display: 'Centímetros (100 = 1m)' },
                                        m: { factor: 1, display: 'Metros (1 = 1m)' },
                                    };
                                    const { factor, display } = map[unit];
                                    await applyScaleConfig(createScaleConfig(unit, factor, display));
                                }}
                                className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 outline-none focus:ring-2 focus:ring-cyan-500/50"
                            >
                                <option value="mm">Milímetros (mm)</option>
                                <option value="cm">Centímetros (cm)</option>
                                <option value="m">Metros (m)</option>
                            </select>
                            <p className="mt-2 text-[11px] text-gray-500">
                                Selecciona la unidad en la que fue dibujado el plano original.
                            </p>
                        </div>

                        {detectedScale && !scaleConfirmed && (
                            <div className="flex items-center justify-between rounded-lg border border-amber-600/30 bg-amber-950/30 p-3 text-amber-200 shadow-sm">
                                <div className="space-y-0.5">
                                    <p className="text-xs font-bold text-amber-400">Auto-detección</p>
                                    <p className="text-[10px]">{detectedScale.displayUnit}</p>
                                </div>
                                <Button 
                                    size="sm" 
                                    className="bg-amber-600 text-white hover:bg-amber-500"
                                    onClick={() => applyScaleConfig(detectedScale)}
                                >
                                    Confirmar
                                </Button>
                            </div>
                        )}

                        <div className="flex flex-col gap-2 rounded-lg border border-gray-700 bg-gray-800/30 p-4">
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                Calibración Manual
                            </h4>
                            <p className="text-[11px] text-gray-500">
                                Si no conoces las unidades, puedes calibrar midiendo una distancia conocida en el plano.
                            </p>
                            <Button
                                variant="secondary"
                                size="sm"
                                className="mt-2 gap-2 bg-gray-700 hover:bg-gray-600"
                                onClick={() => {
                                    store.setTool('calibrate');
                                    setIsImportModalOpen(false);
                                }}
                            >
                                <Ruler size={14} />
                                Iniciar Calibración
                            </Button>
                        </div>
                    </div>

                    <DialogFooter className="sm:justify-end">
                        <Button
                            className="bg-cyan-600 font-bold text-white hover:bg-cyan-500"
                            onClick={() => setIsImportModalOpen(false)}
                        >
                            Listo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ——— Import Luminaires Modal ——— */}
            <ImportLuminairesModal
                open={isImportLuminairesModalOpen}
                onOpenChange={setIsImportLuminairesModalOpen}
            />
        </>
    );
};
