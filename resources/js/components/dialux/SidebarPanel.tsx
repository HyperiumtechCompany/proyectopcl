import { Layers, ScrollText, Settings2 } from 'lucide-react';
import React from 'react';
import { useEditorStore } from '@/hooks/dialux/useEditorStore';
import { NormativeWizardPanel } from './NormativeWizardPanel';
import { ObjectsPanel } from './ObjectsPanel';
import { PropertiesPanel } from './PropertiesPanel';

export const SidebarPanel: React.FC = () => {
    const store = useEditorStore();
    const activeTab = store.ui.sidebarTab;

    const tabs = [
        { key: 'objects'    as const, label: 'Objetos',     icon: Layers   },
        { key: 'properties' as const, label: 'Propiedades', icon: Settings2 },
        { key: 'normative'  as const, label: 'Normativa',   icon: ScrollText },
    ];

    return (
        <aside
            id="dialux-sidebar-right"
            className="flex w-72 min-w-0 shrink-0 flex-col overflow-hidden border-l border-gray-800/50 bg-[#13141a]"
        >
            {/* ── Tabs ─────────────────────────────────────────────────── */}
            <div className="flex shrink-0 items-stretch border-b border-gray-800/50 bg-[#0f1014]">
                {tabs.map(({ key, label, icon: Icon }) => {
                    const isActive = activeTab === key;
                    return (
                        <button
                            key={key}
                            id={`dialux-tab-${key}`}
                            onClick={() => store.setSidebarTab(key)}
                            className={[
                                'relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[10px] font-medium tracking-wide transition-colors duration-150',
                                isActive
                                    ? 'text-blue-400'
                                    : 'text-gray-600 hover:text-gray-400',
                            ].join(' ')}
                        >
                            <Icon size={10} />
                            {label}
                            {/* active indicator */}
                            {isActive && (
                                <span className="absolute bottom-0 left-0 right-0 h-[1.5px] rounded-t-full bg-blue-500" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ── Content ──────────────────────────────────────────────── */}
            <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-2.5 text-xs">
                {activeTab === 'objects'    && <ObjectsPanel />}
                {activeTab === 'properties' && <PropertiesPanel />}
                {activeTab === 'normative'  && <NormativeWizardPanel />}
            </div>
        </aside>
    );
};