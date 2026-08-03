import React, { useState } from 'react';
import { LuminaireCatalogSection } from '@/pages/dialux/features/luminaires/catalog/LuminaireCatalogSection';
import type { CorridorConfig } from '@/pages/dialux/hooks/types';
import type { Door, Window } from '@/pages/dialux/hooks/useEditorStore';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import {
    corridorCatalog,
    doorCatalog,
    isCorridorMatch,
    isDoorMatch,
    isWindowMatch,
    junctionBoxCatalog,
    switchCatalog,
    windowCatalog,
} from './catalogData';
import type { JunctionBoxCatalogItem, SwitchCatalogItem } from './catalogData';

interface CatalogPanelProps {
    filterCategory?:
        | 'luminaires'
        | 'windows'
        | 'doors'
        | 'corridors'
        | 'architecture'
        | 'switches'
        | 'junctionboxes';
    filterBrand?: string;
    filterMaterial?: string;
    search?: string;
    onSelect?: () => void;
    variant?: 'default' | 'compact-grid';
    fixtureItemsPerPage?: number;
    /**
     * Cuando se pasa, seleccionar una luminaria del catálogo NO entra en modo
     * "colocar nueva luminaria": en su lugar aplica el modelo (lúmenes,
     * potencia, tipo, forma, catalogSymbol, etc.) a estas luminarias ya
     * existentes, sin tocar su posición. Usado por el selector de "Cambiar
     * modelo" en Propiedades (una luminaria o un grupo completo).
     */
    applyToFixtureIds?: string[];
}

/* ─── Componente principal ───────────────────────────────────────────────── */

export const CatalogPanel: React.FC<CatalogPanelProps> = ({
    filterCategory,
    filterBrand,
    filterMaterial,
    search = '',
    onSelect,
    variant = 'default',
    fixtureItemsPerPage,
    applyToFixtureIds,
}) => {
    const store = useEditorStore();
    const { windowTemplate, doorTemplate, corridorTemplate } = store.ui;
    const [architectureTab, setArchitectureTab] = useState<
        'corridors' | 'windows' | 'doors'
    >('corridors');

    const showFixtures = filterCategory === 'luminaires' || !filterCategory;
    const showSwitches = filterCategory === 'switches' || !filterCategory;
    const showJunctionBoxes = filterCategory === 'junctionboxes' || !filterCategory;
    const showCorridors =
        filterCategory === 'corridors' ||
        filterCategory === 'architecture' ||
        !filterCategory;
    const showWindows =
        filterCategory === 'windows' ||
        filterCategory === 'architecture' ||
        !filterCategory;
    const showDoors =
        filterCategory === 'doors' ||
        filterCategory === 'architecture' ||
        !filterCategory;
    const isCompactFixtureGrid =
        variant === 'compact-grid' && filterCategory === 'luminaires';

    const filteredWindows = windowCatalog.filter((item) => {
        if (
            filterMaterial &&
            filterMaterial !== 'Todos' &&
            item.material !== filterMaterial
        )
            return false;
        if (search && !item.label.toLowerCase().includes(search.toLowerCase()))
            return false;
        return true;
    });

    const filteredDoors = doorCatalog.filter((item) => {
        if (search && !item.label.toLowerCase().includes(search.toLowerCase()))
            return false;
        return true;
    });

    const filteredCorridors = corridorCatalog.filter((item) => {
        if (
            search &&
            !item.label.toLowerCase().includes(search.toLowerCase()) &&
            !item.description.toLowerCase().includes(search.toLowerCase())
        ) {
            return false;
        }

        return true;
    });

    const filteredSwitches = switchCatalog.filter((item) =>
        !search || item.label.toLowerCase().includes(search.toLowerCase()),
    );

    const filteredJunctionBoxes = junctionBoxCatalog.filter((item) =>
        !search || item.label.toLowerCase().includes(search.toLowerCase()),
    );

    const setSwitch = (item: SwitchCatalogItem) => {
        store.setSwitchTemplate({ type: item.type, mountingHeight: 1.4, label: item.switchLabel });
        store.setTool('switch');
        onSelect?.();
    };

    const setJunctionBox = (item: JunctionBoxCatalogItem) => {
        store.setJunctionBoxTemplate({ size: item.size });
        store.setTool('wire');
        onSelect?.();
    };

    const setWindow = (template: Partial<Window>) => {
        store.setWindowTemplate(template);
        store.setTool('window');
        onSelect?.();
    };

    const setDoor = (template: Partial<Door>) => {
        store.setDoorTemplate(template);
        store.setTool('door');
        onSelect?.();
    };

    const setCorridor = (template: CorridorConfig) => {
        store.setCorridorTemplate(template);
        store.setTool('corridor');
        onSelect?.();
    };

    const renderArchitectureTabs = filterCategory === 'architecture';
    const shouldShowCorridors =
        showCorridors &&
        (!renderArchitectureTabs || architectureTab === 'corridors');
    const shouldShowWindows =
        showWindows &&
        (!renderArchitectureTabs || architectureTab === 'windows');
    const shouldShowDoors =
        showDoors && (!renderArchitectureTabs || architectureTab === 'doors');

    return (
        <div className="flex flex-col gap-2 text-xs">
            {renderArchitectureTabs && (
                <div className="mb-1 grid grid-cols-3 gap-1 rounded border border-gray-800 bg-gray-950/30 p-1">
                    {[
                        {
                            id: 'corridors' as const,
                            label: 'Pasadizos',
                            count: filteredCorridors.length,
                        },
                        {
                            id: 'windows' as const,
                            label: 'Ventanas',
                            count: filteredWindows.length,
                        },
                        {
                            id: 'doors' as const,
                            label: 'Puertas',
                            count: filteredDoors.length,
                        },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setArchitectureTab(tab.id)}
                            className={`min-w-0 rounded px-1.5 py-1 text-[9px] transition-colors ${
                                architectureTab === tab.id
                                    ? 'bg-cyan-900/40 text-cyan-200 ring-1 ring-cyan-600/30'
                                    : 'text-gray-500 hover:bg-gray-800/70 hover:text-gray-200'
                            }`}
                        >
                            <span className="block truncate">{tab.label}</span>
                            <span className="font-mono text-[8px] opacity-70">
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {shouldShowCorridors && (
                <div className="space-y-0.5">
                    <p className="mb-1 px-1 text-[8px] font-semibold tracking-widest text-cyan-500/80 uppercase">
                        Pasadizos ({filteredCorridors.length})
                    </p>
                    {filteredCorridors.map((item, i) => {
                        const isActive = isCorridorMatch(
                            item.template,
                            corridorTemplate,
                        );

                        return (
                            <button
                                key={`${item.label}-${i}`}
                                type="button"
                                onClick={() => setCorridor(item.template)}
                                className={`group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-all duration-150 ${
                                    isActive
                                        ? 'bg-cyan-900/30 text-cyan-300 ring-1 ring-cyan-600/30'
                                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
                                }`}
                            >
                                <span
                                    className={`shrink-0 ${isActive ? 'text-cyan-400' : 'text-gray-500'}`}
                                >
                                    {item.icon}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[11px] leading-tight">
                                        {item.label}
                                    </p>
                                    <p className="truncate text-[9px] leading-none text-gray-600">
                                        {item.description}
                                    </p>
                                </div>
                                {isActive && (
                                    <span className="shrink-0 rounded bg-cyan-900/50 px-1 py-0.5 text-[8px] text-cyan-400">
                                        ●
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {shouldShowCorridors && (shouldShowWindows || shouldShowDoors) && (
                <div className="my-1 border-t border-gray-700/40" />
            )}
            {/* ── Luminarias ── */}
            {showFixtures && (
                <LuminaireCatalogSection
                    isCompactFixtureGrid={isCompactFixtureGrid}
                    filterBrand={filterBrand}
                    search={search}
                    fixtureItemsPerPage={fixtureItemsPerPage}
                    applyToFixtureIds={applyToFixtureIds}
                    onSelect={onSelect}
                />
            )}

            {/* ── Interruptores ── */}
            {showFixtures && showSwitches && (
                <div className="my-1 border-t border-gray-700/40" />
            )}
            {showSwitches && (
                <div className="space-y-0.5">
                    <p className="mb-1 px-1 text-[8px] font-semibold tracking-widest text-violet-500/80 uppercase">
                        Interruptores ({filteredSwitches.length})
                    </p>
                    {filteredSwitches.map((item, i) => {
                        const isActive = store.ui.switchTemplate?.type === item.type;
                        return (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setSwitch(item)}
                                className={`group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-all duration-150 ${
                                    isActive
                                        ? 'bg-violet-900/30 text-violet-300 ring-1 ring-violet-600/30'
                                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
                                }`}
                            >
                                <span className={`shrink-0 font-bold text-[11px] w-8 text-center ${isActive ? 'text-violet-300' : 'text-gray-500'}`}>
                                    {item.switchLabel}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[11px] leading-tight">{item.label}</p>
                                    <p className="text-[9px] leading-none text-gray-600">{item.description}</p>
                                </div>
                                {isActive && (
                                    <span className="shrink-0 rounded bg-violet-900/50 px-1 py-0.5 text-[8px] text-violet-400">●</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── Cajas de pase ── */}
            {showSwitches && showJunctionBoxes && (
                <div className="my-1 border-t border-gray-700/40" />
            )}
            {showJunctionBoxes && (
                <div className="space-y-0.5">
                    <p className="mb-1 px-1 text-[8px] font-semibold tracking-widest text-orange-500/80 uppercase">
                        Cajas de pase ({filteredJunctionBoxes.length})
                    </p>
                    {filteredJunctionBoxes.map((item, i) => {
                        const isActive = store.ui.junctionBoxTemplate?.size === item.size;
                        return (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setJunctionBox(item)}
                                className={`group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-all duration-150 ${
                                    isActive
                                        ? 'bg-orange-900/30 text-orange-300 ring-1 ring-orange-600/30'
                                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
                                }`}
                            >
                                <span className={`shrink-0 ${isActive ? 'text-orange-400' : 'text-gray-500'}`}>
                                    {item.icon}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[11px] leading-tight">{item.label}</p>
                                    <p className="text-[9px] leading-none text-gray-600">{item.description}</p>
                                </div>
                                {isActive && (
                                    <span className="shrink-0 rounded bg-orange-900/50 px-1 py-0.5 text-[8px] text-orange-400">●</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── Ventanas ── */}
            {(showFixtures || showSwitches || showJunctionBoxes) && shouldShowWindows && (
                <div className="my-1 border-t border-gray-700/40" />
            )}

            {shouldShowWindows && (
                <div className="space-y-0.5">
                    <p className="mb-1 px-1 text-[8px] font-semibold tracking-widest text-sky-500/80 uppercase">
                        Ventanas ({filteredWindows.length})
                    </p>
                    {filteredWindows.map((item, i) => {
                        const isActive = isWindowMatch(
                            item.template,
                            windowTemplate,
                        );
                        return (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setWindow(item.template)}
                                className={`group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-all duration-150 ${
                                    isActive
                                        ? 'bg-sky-900/30 text-sky-300 ring-1 ring-sky-600/30'
                                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
                                }`}
                            >
                                <span
                                    className={`shrink-0 ${isActive ? 'text-sky-400' : 'text-gray-500'}`}
                                >
                                    {item.icon}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[11px] leading-tight">
                                        {item.label}
                                    </p>
                                    <p className="text-[9px] leading-none text-gray-600">
                                        {item.material} · {item.template.width}×
                                        {item.template.height}m
                                    </p>
                                </div>
                                {isActive && (
                                    <span className="shrink-0 rounded bg-sky-900/50 px-1 py-0.5 text-[8px] text-sky-400">
                                        ●
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── Puertas ── */}
            {shouldShowWindows && shouldShowDoors && (
                <div className="my-1 border-t border-gray-700/40" />
            )}

            {shouldShowDoors && (
                <div className="space-y-0.5">
                    <p className="mb-1 px-1 text-[8px] font-semibold tracking-widest text-emerald-500/80 uppercase">
                        Puertas ({filteredDoors.length})
                    </p>
                    {filteredDoors.map((item, i) => {
                        const isActive = isDoorMatch(
                            item.template,
                            doorTemplate,
                        );
                        return (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setDoor(item.template)}
                                className={`group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-all duration-150 ${
                                    isActive
                                        ? 'bg-emerald-900/30 text-emerald-300 ring-1 ring-emerald-600/30'
                                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
                                }`}
                            >
                                <span
                                    className={`shrink-0 ${isActive ? 'text-emerald-400' : 'text-gray-500'}`}
                                >
                                    {item.icon}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[11px] leading-tight">
                                        {item.label}
                                    </p>
                                    <p className="text-[9px] leading-none text-gray-600">
                                        {item.template.width}×
                                        {item.template.height}m ·{' '}
                                        {item.template.openingDirection ===
                                        'outward'
                                            ? 'Exterior'
                                            : 'Interior'}
                                    </p>
                                </div>
                                {isActive && (
                                    <span className="shrink-0 rounded bg-emerald-900/50 px-1 py-0.5 text-[8px] text-emerald-400">
                                        ●
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
