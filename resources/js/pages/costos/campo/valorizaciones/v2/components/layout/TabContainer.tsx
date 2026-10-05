import React, { useState, useEffect } from 'react';

export interface TabConfig {
    id: string;
    label: string;
    icon?: string;
    component: React.ComponentType;
}

interface TabContainerProps {
    tabs: TabConfig[];
    defaultTab?: string;
}

export function TabContainer({ tabs, defaultTab }: TabContainerProps) {
    const [activeTab, setActiveTab] = useState<string>(
        () => window.location.hash.replace('#', '') || defaultTab || tabs[0]?.id
    );

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '');
            if (tabs.some((t) => t.id === hash)) {
                setActiveTab(hash);
            }
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [tabs]);

    const handleTabChange = (id: string) => {
        setActiveTab(id);
        window.location.hash = id;
    };

    const ActiveComponent = tabs.find((t) => t.id === activeTab)?.component;

    return (
        <div className="flex flex-col h-full bg-gray-50/50">
            {/* Tab Header (Scrollable on small screens) */}
            <div className="border-b border-gray-200 bg-white shadow-sm sticky top-0 z-10 overflow-x-auto">
                <nav className="flex space-x-1 p-2" aria-label="Tabs">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={`
                                flex items-center gap-2 whitespace-nowrap py-2 px-3 text-sm font-medium rounded-md
                                transition-colors duration-150 ease-in-out
                                ${
                                    activeTab === tab.id
                                        ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-500/20'
                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                }
                            `}
                        >
                            {tab.icon && <span>{tab.icon}</span>}
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-auto p-4 md:p-6 bg-gray-50/50">
                {ActiveComponent ? (
                    <React.Suspense fallback={<div className="p-4 text-gray-500">Cargando pestaña...</div>}>
                        <div className="max-w-7xl mx-auto space-y-6">
                            <ActiveComponent />
                        </div>
                    </React.Suspense>
                ) : (
                    <div className="p-4 text-red-500">Pestaña no encontrada.</div>
                )}
            </div>
        </div>
    );
}
