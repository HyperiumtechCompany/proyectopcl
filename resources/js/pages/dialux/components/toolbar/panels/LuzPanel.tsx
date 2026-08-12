import { Check, Grid, Link2, Pencil, ToggleLeft, Upload, X, Zap } from 'lucide-react';
import React, { useState } from 'react';
import type {
    DrawTool,
    ElectricalDeviceProperties,
    ElectricalDeviceType,
    Conductor,
    LightSwitch,
    Vertex,
} from '@/pages/dialux/hooks/useEditorStore';
import { CONDUCTOR_WIRE_OPTIONS } from '@/pages/dialux/hooks/types';

import { CatalogPanel } from '../../CatalogPanel';
import { ChipFilter } from '../panelControls';
import { PanelCard, PanelTabs, PanelToolBtn } from '../primitives';
import {
    EQUIPMENT_DEVICE_ITEMS,
    type ElectricalDeviceCatalogItem,
} from '../electricalDeviceCatalog';

type SwitchTemplate = {
    type: LightSwitch['type'];
    mountingHeight: number;
    label?: string;
};

type WireTemplate = {
    wireCount: Conductor['wireCount'];
    wireLabel: NonNullable<Conductor['wireLabel']>;
};

type InsertSection = 'luminaires' | 'switches' | 'wire' | 'equipment';

const SWITCH_ITEMS: Array<{
    type: LightSwitch['type'];
    label: string;
    name: string;
}> = [
    { type: 'single', label: 'S(a)', name: 'Simple' },
    { type: 'double', label: '2S(a)', name: 'Doble' },
    { type: 'triple', label: '3S(a)', name: 'Triple' },
    { type: 'two-way', label: 'Sc(a)', name: 'Conmutado' },
];

export const LuzPanel: React.FC<{
    activeTool: DrawTool;
    onSetTool: (t: DrawTool) => void;
    switchTemplate: SwitchTemplate;
    onSetSwitchTemplate: (template: SwitchTemplate) => void;
    wireTemplate: WireTemplate;
    onSetWireTemplate: (template: WireTemplate) => void;
    gridRows: number;
    gridCols: number;
    onSetRows: (n: number) => void;
    onSetCols: (n: number) => void;
    fixtureRotation: number;
    onSetFixtureRotation: (rotation: number) => void;
    /** 'room' = clic simple usa el ambiente completo. 'draw' = poligono libre vertice a vertice. */
    areaMode: 'room' | 'draw';
    onSetAreaMode: (mode: 'room' | 'draw') => void;
    /** Poligono recien cerrado en modo 'draw', esperando confirmar cantidad. */
    pendingArea: Vertex[] | null;
    onConfirmPendingArea: () => void;
    onCancelPendingArea: () => void;
    onOpenImportModal?: () => void;
    onSetElecDevice?: (
        type: ElectricalDeviceType,
        label?: string,
        properties?: Partial<ElectricalDeviceProperties>,
    ) => void;
}> = ({
    activeTool,
    onSetTool,
    switchTemplate,
    onSetSwitchTemplate,
    wireTemplate,
    onSetWireTemplate,
    gridRows,
    gridCols,
    onSetRows,
    onSetCols,
    fixtureRotation,
    onSetFixtureRotation,
    areaMode,
    onSetAreaMode,
    pendingArea,
    onConfirmPendingArea,
    onCancelPendingArea,
    onOpenImportModal,
    onSetElecDevice,
}) => {

    const [activeSection, setActiveSection] =
        useState<InsertSection>('luminaires');

    const setElecTool = (tool: DrawTool, type: ElectricalDeviceType) => {
        onSetTool(tool);
        onSetElecDevice?.(type);
    };

    const setSwitchTool = (
        type: LightSwitch['type'],
        label: string,
        mountingHeight = 1.4,
    ) => {
        onSetSwitchTemplate({ type, label, mountingHeight });
        onSetTool('switch');
    };

    const setWireTool = (template: WireTemplate) => {
        onSetWireTemplate(template);
        onSetTool('wire');
    };

    const renderDeviceButton = (item: ElectricalDeviceCatalogItem) => (
        <button
            key={item.tool}
            type="button"
            onClick={() => setElecTool(item.tool, item.type)}
            title={item.label}
            className={`flex h-14 flex-col items-center justify-center gap-1 rounded border px-2 py-1.5 text-[10px] transition-colors ${
                activeTool === item.tool
                    ? item.activeClass
                    : 'border-slate-200 dark:border-gray-700/50 bg-slate-50 dark:bg-gray-800/40 text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700/60 hover:text-slate-800 dark:hover:text-gray-200'
            }`}
        >
            <span className={`text-[12px] font-bold ${item.symbolClass}`}>
                {item.symbol}
            </span>
            <span className="max-w-full truncate">{item.label}</span>
        </button>
    );


    return (
        <>
            <PanelTabs
                tabs={[
                    { id: 'luminaires', label: 'Luz' },
                    { id: 'switches', label: 'Inter.' },
                    { id: 'wire', label: 'Cable' },
                    { id: 'equipment', label: 'Equipos' },
                ]}
                activeTab={activeSection}
                onChange={setActiveSection}
            />

            {activeSection === 'luminaires' && (
                <>
                    <PanelCard title="Herramientas de luz" tone="accent">
                        <div className="grid grid-cols-2 gap-1">
                            <PanelToolBtn
                                tool="fixture"
                                icon={<Zap size={13} />}
                                active={activeTool}
                                onSet={onSetTool}
                                tip="Luminaria (F)"
                                sublabel="Colocar unitaria"
                            />
                            <PanelToolBtn
                                tool="fixture-grid"
                                icon={<Grid size={13} />}
                                active={activeTool}
                                onSet={onSetTool}
                                tip="Matriz de luminarias"
                                sublabel={`${gridRows} x ${gridCols}`}
                            />
                        </div>
                        {activeTool === 'fixture-grid' && (
                            <div className="mt-2 rounded border border-gray-300 dark:border-gray-700/40 bg-gray-200 dark:bg-gray-900/40 p-2">
                                <div className="grid grid-cols-2 gap-1">
                                    <button
                                        type="button"
                                        onClick={() => onSetAreaMode('room')}
                                        className={`flex items-center justify-center gap-1 rounded px-2 py-1.5 text-[9.5px] font-medium transition-colors ${
                                            areaMode === 'room'
                                                ? 'bg-cyan-600/25 text-cyan-700 dark:text-cyan-200 ring-1 ring-cyan-500/50'
                                                : 'bg-gray-300 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-400/40 dark:hover:bg-gray-700/60'
                                        }`}
                                        title="Un clic sobre un ambiente usa el ambiente completo"
                                    >
                                        Ambiente completo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onSetAreaMode('draw')}
                                        className={`flex items-center justify-center gap-1 rounded px-2 py-1.5 text-[9.5px] font-medium transition-colors ${
                                            areaMode === 'draw'
                                                ? 'bg-cyan-600/25 text-cyan-700 dark:text-cyan-200 ring-1 ring-cyan-500/50'
                                                : 'bg-gray-300 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-400/40 dark:hover:bg-gray-700/60'
                                        }`}
                                        title="Dibuja un poligono libre en el plano (como Recinto): clic para cada vertice, clic cerca del primero para cerrar"
                                    >
                                        <Pencil size={11} />
                                        Dibujar área
                                    </button>
                                </div>

                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    <label className="space-y-1 text-[10px] text-gray-500 dark:text-gray-500">
                                        <span>Filas</span>
                                        <input
                                            type="number"
                                            min={1}
                                            max={20}
                                            value={gridRows}
                                            onChange={(e) =>
                                                onSetRows(Number(e.target.value))
                                            }
                                            className="h-7 w-full rounded border border-gray-300 dark:border-gray-700 bg-gray-300 dark:bg-gray-950 px-2 text-[11px] text-gray-800 dark:text-gray-200 outline-none focus:border-cyan-500/50"
                                        />
                                    </label>
                                    <label className="space-y-1 text-[10px] text-gray-500 dark:text-gray-500">
                                        <span>Columnas</span>
                                        <input
                                            type="number"
                                            min={1}
                                            max={20}
                                            value={gridCols}
                                            onChange={(e) =>
                                                onSetCols(Number(e.target.value))
                                            }
                                            className="h-7 w-full rounded border border-gray-300 dark:border-gray-700 bg-gray-300 dark:bg-gray-950 px-2 text-[11px] text-gray-800 dark:text-gray-200 outline-none focus:border-cyan-500/50"
                                        />
                                    </label>
                                </div>
                                <label className="mt-2 block space-y-1 text-[10px] text-gray-500">
                                    <span>Ángulo de luminarias (°)</span>
                                    <input
                                        type="number"
                                        min={0}
                                        max={359}
                                        step={1}
                                        value={fixtureRotation}
                                        onChange={(event) =>
                                            onSetFixtureRotation(((Number(event.target.value) % 360) + 360) % 360)
                                        }
                                        className="h-7 w-full rounded border border-gray-300 bg-gray-300 px-2 text-[11px] text-gray-800 outline-none focus:border-cyan-500/50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                                    />
                                </label>

                                {areaMode === 'room' ? (
                                    <p className="mt-2 text-[9px] leading-snug text-cyan-700 dark:text-cyan-500">
                                        Clic sobre un ambiente para proyectar la grilla en todo su espacio.
                                    </p>
                                ) : pendingArea ? (
                                    <div className="mt-2 rounded border border-emerald-500/40 bg-emerald-950/20 p-2">
                                        <p className="text-[9.5px] leading-snug text-emerald-300">
                                            Área proyectada ({pendingArea.length} vértices). Ajusta Filas/Columnas arriba y confirma.
                                        </p>
                                        <div className="mt-2 flex gap-1.5">
                                            <button
                                                type="button"
                                                onClick={onConfirmPendingArea}
                                                className="flex flex-1 items-center justify-center gap-1 rounded bg-emerald-600/30 py-1.5 text-[10px] font-medium text-emerald-200 transition-colors hover:bg-emerald-600/50"
                                            >
                                                <Check size={12} />
                                                Confirmar {gridRows}×{gridCols}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={onCancelPendingArea}
                                                className="flex items-center justify-center gap-1 rounded border border-gray-500/40 px-2.5 py-1.5 text-[10px] text-gray-400 transition-colors hover:bg-gray-700/40"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="mt-2 text-[9px] leading-snug text-cyan-700 dark:text-cyan-500">
                                        Dibuja el contorno en el plano: clic por cada vértice, clic cerca del primero para cerrar. Después elegís la cantidad y confirmás.
                                    </p>
                                )}
                            </div>
                        )}
                    </PanelCard>

                    <PanelCard title="Catalogo de luminarias">
                        <button
                            type="button"
                            onClick={() => onOpenImportModal?.()}
                            className="mb-2 flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-amber-300 bg-amber-50 py-1.5 text-[10px] font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-700/50 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-900/30"
                            title="Importar un archivo IES/LDT, crear una luminaria propia, o eliminar/compartir las tuyas"
                        >
                            <Upload size={12} />
                            Importar / crear / eliminar luminarias
                        </button>

                        <CatalogPanel
                            filterCategory="luminaires"
                            variant="compact-grid"
                            fixtureItemsPerPage={15}
                            onSelect={() => {
                                if (activeTool === 'fixture-grid') onSetTool('fixture-grid');
                            }}
                        />
                    </PanelCard>
                </>
            )}

            {activeSection === 'switches' && (
                <PanelCard title="Interruptores">
                    <div className="grid grid-cols-1 gap-1">
                        <PanelToolBtn
                            tool="switch"
                            icon={<ToggleLeft size={13} />}
                            active={activeTool}
                            onSet={onSetTool}
                            tip="Interruptor (I)"
                            sublabel={switchTemplate.label ?? 'Luz en pared'}
                        />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1">
                        {SWITCH_ITEMS.map((item) => (
                            <button
                                key={item.type}
                                type="button"
                                onClick={() =>
                                    setSwitchTool(item.type, item.label)
                                }
                                className={`flex h-9 items-center gap-2 rounded px-2 text-left transition-colors ${
                                    activeTool === 'switch' &&
                                    switchTemplate.type === item.type
                                        ? 'bg-cyan-600/25 text-cyan-200 ring-1 ring-cyan-600/30'
                                        : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700/50 hover:text-slate-900 dark:hover:text-gray-100'
                                }`}
                            >
                                <span className="w-8 shrink-0 font-mono text-[10px] text-slate-400 dark:text-gray-500">
                                    {item.label}
                                </span>
                                <span className="truncate text-[11px]">
                                    {item.name}
                                </span>
                            </button>
                        ))}
                    </div>
                </PanelCard>
            )}

            {activeSection === 'wire' && (
                <PanelCard title="Cable">
                            <div className="grid grid-cols-1 gap-1">
                                <PanelToolBtn
                                    tool="wire"
                                    icon={<Link2 size={13} />}
                                    active={activeTool}
                                    onSet={onSetTool}
                                    tip="Cableado (U)"
                                    sublabel="Conectar puntos"
                                />
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-1">
                                {CONDUCTOR_WIRE_OPTIONS.slice(0, 9).map(
                                    (item) => (
                                        <button
                                            key={item.value}
                                            type="button"
                                            onClick={() =>
                                                setWireTool({
                                                    wireCount: item.count,
                                                    wireLabel: item.value,
                                                })
                                            }
                                            className={`rounded border px-1.5 py-1 text-center font-mono text-[9.5px] transition-colors ${
                                                activeTool === 'wire' &&
                                                wireTemplate.wireLabel ===
                                                    item.value
                                                    ? 'border-cyan-500/50 bg-cyan-600/20 text-cyan-700 dark:text-cyan-200'
                                                    : 'border-slate-200 dark:border-gray-700/40 bg-slate-50 dark:bg-gray-950/60 text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700/50 hover:text-slate-900 dark:hover:text-gray-100'
                                            }`}
                                            title={`${item.label}: ${item.count} conductores`}
                                        >
                                            {item.label}
                                        </button>
                                    ),
                                )}
                            </div>
                            <p className="mt-2 text-[9px] text-slate-500 dark:text-gray-500">
                                El cálculo de longitud de cable está en el botón "Cálculo CT" de la barra superior (selecciona un ambiente primero).
                            </p>
                </PanelCard>
            )}

            {activeSection === 'equipment' && (
                <PanelCard title="Equipos electricos">
                            <p className="mb-2 text-[9.5px] leading-relaxed text-slate-500 dark:text-gray-500">
                                Insertar en plano. Clic = colocar libre. Clic
                                cerca de pared = anclar.
                            </p>
                            <div className="grid grid-cols-2 gap-1">
                                {EQUIPMENT_DEVICE_ITEMS.map(renderDeviceButton)}
                            </div>
                </PanelCard>
            )}
        </>
    );
};
 
