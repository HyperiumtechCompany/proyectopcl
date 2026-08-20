import { Layers, ListTree, Settings2 } from 'lucide-react';
import React from 'react';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import { LegendPanel } from './LegendPanel';
import { ObjectsPanel } from './ObjectsPanel';
import { PropertiesPanel } from './PropertiesPanel';

export const SidebarPanel: React.FC = () => {
    const store = useEditorStore();
    const activeTab = store.ui.sidebarTab;

    const tabs = [
        { key: 'objects'    as const, label: 'Objetos',     icon: Layers   },
        { key: 'properties' as const, label: 'Propiedades', icon: Settings2 },
        { key: 'legend'     as const, label: 'Leyenda',     icon: ListTree },
    ];

    return (
        <aside
            id="dialux-sidebar-right"
            className="flex min-h-0 w-[clamp(14rem,22vw,19rem)] min-w-0 shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-slate-50 font-sans text-[11px] text-slate-900 dark:border-slate-800 dark:bg-[#13141a] dark:text-slate-100"
        >
            {/* ── Tabs ─────────────────────────────────────────────────── */}
            <div className="flex shrink-0 items-stretch border-b border-slate-200 bg-white dark:border-gray-800/50 dark:bg-[#0f1014]">
                {tabs.map(({ key, label, icon: Icon }) => {
                    const isActive = activeTab === key;
                    return (
                        <button
                            key={key}
                            id={`dialux-tab-${key}`}
                            onClick={() => store.setSidebarTab(key)}
                            className={[
                                'relative flex min-h-10 flex-1 items-center justify-center gap-1.5 px-1 py-2.5 text-[11px] font-medium tracking-wide transition-colors duration-150',
                                isActive
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-slate-500 hover:text-slate-800 dark:text-gray-500 dark:hover:text-gray-200',
                            ].join(' ')}
                        >
                            <Icon size={12} />
                            {label}
                            {/* active indicator */}
                            {isActive && (
                                <span className="absolute right-0 bottom-0 left-0 h-[1.5px] rounded-t-full bg-blue-500" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ── Content ──────────────────────────────────────────────── */}
            <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-2.5 text-[11px] [scrollbar-gutter:stable]">
                {activeTab === 'objects'    && <ObjectsPanel />}
                {activeTab === 'properties' && <PropertiesPanel />}
                {activeTab === 'legend'     && <LegendPanel />}
            </div>
        </aside>
    );
};
