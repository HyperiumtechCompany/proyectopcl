import React from 'react';
import type { DrawTool } from '@/pages/dialux/hooks/useEditorStore';

export const Sep = () => (
    <div className="mx-auto my-1.5 w-7 border-t border-slate-200 dark:border-gray-800/70" />
);

export const PanelSep = ({ label }: { label?: string }) => (
    <div className="my-2 flex items-center gap-1.5 px-0.5">
        <div className="flex-1 border-t border-slate-200 dark:border-gray-700/40" />
        {label && (
            <span className="shrink-0 text-[9px] font-semibold tracking-[0.15em] text-slate-400 dark:text-gray-500 uppercase">
                {label}
            </span>
        )}
        <div className="flex-1 border-t border-slate-200 dark:border-gray-700/40" />
    </div>
);

/** Color-coded section header band, like DIALux */
export const SectionBand = ({
    label,
    icon,
    className,
}: {
    label: string;
    icon?: React.ReactNode;
    className?: string;
}) => (
    <div
        className={`mb-1.5 flex items-center gap-1.5 rounded bg-slate-100 dark:bg-gray-800/60 px-2 py-1.5 ${className ?? ''}`}
    >
        {icon && <span className="shrink-0 text-slate-400 dark:text-gray-500">{icon}</span>}
        <span className="text-[10px] font-bold tracking-widest text-slate-600 dark:text-gray-400 uppercase">
            {label}
        </span>
    </div>
);

/** Metric row: label left, monospaced value right */
export const MetricRow = ({
    label,
    value,
    unit,
    highlight,
}: {
    label: string;
    value: React.ReactNode;
    unit?: string;
    highlight?: boolean;
}) => (
    <div
        className={`flex items-baseline justify-between rounded px-1 py-[3px] ${highlight ? 'bg-cyan-950/20 dark:bg-cyan-950/20 bg-cyan-50' : ''}`}
    >
        <span className="text-[10px] leading-tight text-slate-500 dark:text-gray-500">{label}</span>
        <span
            className={`font-mono text-[11px] leading-tight tabular-nums ${highlight ? 'font-semibold text-cyan-600 dark:text-cyan-300' : 'text-slate-800 dark:text-gray-200'}`}
        >
            {value}
            {unit && (
                <span className="ml-0.5 text-[9px] text-slate-400 dark:text-gray-500">{unit}</span>
            )}
        </span>
    </div>
);

interface ToolBtnProps {
    tool: DrawTool;
    icon: React.ReactNode;
    tip: string;
    active: DrawTool;
    onSet: (t: DrawTool) => void;
}
export const ToolBtn: React.FC<ToolBtnProps> = ({
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
        className={`flex h-9 w-9 items-center justify-center rounded transition-all duration-100 ${
            active === tool
                ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-600/30 dark:text-cyan-300 ring-1 ring-cyan-400 dark:ring-cyan-500/50'
                : 'text-slate-500 dark:text-gray-500 hover:bg-slate-200 dark:hover:bg-gray-700/50 hover:text-slate-800 dark:hover:text-gray-200'
        }`}
    >
        {icon}
    </button>
);

interface GroupBtnProps {
    id: string;
    icon: React.ReactNode;
    label: string;
    isOpen: boolean;
    hasActive?: boolean;
    onClick: () => void;
    accentColor?: string;
}
export const GroupBtn: React.FC<GroupBtnProps> = ({
    id,
    icon,
    label,
    isOpen,
    hasActive,
    onClick,
    accentColor = 'text-cyan-600 dark:text-cyan-400',
}) => (
    <button
        type="button"
        id={id}
        onClick={onClick}
        title={label}
        className={`relative flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded transition-all duration-100 ${
            isOpen
                ? 'bg-slate-200 dark:bg-gray-700/80 text-slate-700 dark:text-gray-100 shadow-sm ring-1 ring-slate-400/50 dark:ring-gray-600/50'
                : hasActive
                  ? `${accentColor} hover:bg-slate-200 dark:hover:bg-gray-700/40`
                  : 'text-slate-500 dark:text-gray-500 hover:bg-slate-200 dark:hover:bg-gray-700/40 hover:text-slate-700 dark:hover:text-gray-300'
        }`}
    >
        <span className="text-[15px]">{icon}</span>
        <span className="text-[8.5px] leading-none font-semibold tracking-wider uppercase opacity-75">
            {label}
        </span>
        {isOpen && (
            <span className="absolute top-1/2 right-0 h-0 w-0 translate-x-full -translate-y-1/2 border-y-[5px] border-l-[6px] border-y-transparent border-l-white dark:border-l-[#1a1d2e]" />
        )}
    </button>
);

interface PanelToolBtnProps extends ToolBtnProps {
    sublabel?: string;
}
export const PanelToolBtn: React.FC<PanelToolBtnProps> = ({
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
        className={`flex h-9 w-full items-center gap-2.5 rounded px-2 text-left transition-all duration-100 ${
            active === tool
                ? 'bg-cyan-100 dark:bg-cyan-600/25 text-cyan-700 dark:text-cyan-200 ring-1 ring-cyan-400 dark:ring-cyan-600/30'
                : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700/50 hover:text-slate-900 dark:hover:text-gray-100'
        }`}
    >
        <span className="shrink-0 text-slate-400 dark:text-gray-500">{icon}</span>
        <div className="min-w-0">
            <p className="truncate text-[11px] leading-snug">
                {tip.split(' (')[0]}
            </p>
            {sublabel && (
                <p className="mt-0.5 text-[9.5px] leading-none text-slate-400 dark:text-gray-500">
                    {sublabel}
                </p>
            )}
        </div>
    </button>
);

interface PanelCadBtnProps {
    command: string;
    title: string;
    icon: React.ReactNode;
    onExecute: (cmd: string) => void;
    isReady: boolean;
    active?: boolean;
}
export const PanelCadBtn: React.FC<PanelCadBtnProps> = ({
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
            className={`flex h-9 w-full items-center gap-2.5 rounded px-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                active
                    ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300'
                    : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700/50 hover:text-slate-900 dark:hover:text-gray-100'
            }`}
        >
            <span className="shrink-0 text-slate-400 dark:text-gray-500">{icon}</span>
            <div className="min-w-0">
                <p className="truncate text-[11px] leading-snug">{label}</p>
                {sublabel && (
                    <p className="mt-0.5 truncate text-[9.5px] text-slate-400 dark:text-gray-500">
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
    tone?: 'default' | 'accent' | 'warning' | 'normativa';
}
export const PanelCard: React.FC<PanelCardProps> = ({
    title,
    children,
    tone = 'default',
}) => {
    const toneClass = {
        default:   'border-slate-200 dark:border-gray-700/40 bg-slate-50 dark:bg-gray-900/40',
        accent:    'border-cyan-300/50 dark:border-cyan-800/30 bg-cyan-50/50 dark:bg-cyan-950/10',
        warning:   'border-amber-300/50 dark:border-amber-700/30 bg-amber-50/50 dark:bg-amber-950/10',
        normativa: 'border-emerald-300/50 dark:border-emerald-800/30 bg-emerald-50/50 dark:bg-emerald-950/10',
    } satisfies Record<NonNullable<PanelCardProps['tone']>, string>;

    return (
        <div className={`rounded-md border p-2.5 ${toneClass[tone]}`}>
            {title && (
                <p className="mb-2 text-[9px] font-bold tracking-[0.15em] text-slate-500 dark:text-gray-500 uppercase">
                    {title}
                </p>
            )}
            {children}
        </div>
    );
};

export function PanelTabs<T extends string>({
    tabs,
    activeTab,
    onChange,
}: {
    tabs: Array<{ id: T; label: string; count?: number }>;
    activeTab: T;
    onChange: (t: T) => void;
}) {
    return (
        <div
            className="mb-2.5 grid gap-1 rounded-md border border-slate-200 dark:border-gray-700/50 bg-slate-100 dark:bg-[#12151f] p-1"
            style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
        >
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    onClick={() => onChange(tab.id)}
                    className={`flex items-center justify-center gap-1 rounded px-1.5 py-1.5 text-[10px] font-semibold tracking-wide transition-colors ${
                        activeTab === tab.id
                            ? 'bg-white shadow-sm dark:bg-cyan-700/40 text-cyan-700 dark:text-cyan-100 ring-1 ring-slate-200 dark:ring-cyan-500/40'
                            : 'text-slate-500 dark:text-gray-500 hover:bg-white dark:hover:bg-gray-800/70 hover:text-slate-800 dark:hover:text-gray-200'
                    }`}
                >
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                        <span
                            className={`rounded px-1 text-[9px] ${
                                activeTab === tab.id
                                    ? 'bg-cyan-100 dark:bg-cyan-950/70 text-cyan-700 dark:text-cyan-300'
                                    : 'bg-slate-200 dark:bg-gray-800 text-slate-500 dark:text-gray-500'
                            }`}
                        >
                            {tab.count}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
}
