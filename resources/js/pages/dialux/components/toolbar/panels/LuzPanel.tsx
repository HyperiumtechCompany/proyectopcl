import { Grid, Link2, ToggleLeft, Zap } from 'lucide-react';
import React, { useState } from 'react';
import type {
    DrawTool,
    ElectricalDeviceType,
    LightSwitch,
} from '@/pages/dialux/hooks/useEditorStore';
import { CONDUCTOR_WIRE_OPTIONS } from '@/pages/dialux/hooks/types';
import {
    LUMINAIRE_BRANDS,
    type LuminaireBrand,
} from '../../constants';
import { CatalogPanel } from '../../CatalogPanel';
import { ChipFilter } from '../panelControls';
import { PanelCard, PanelTabs, PanelToolBtn } from '../primitives';

type SwitchTemplate = {
    type: LightSwitch['type'];
    mountingHeight: number;
    label?: string;
};

type DeviceItem = {
    tool: DrawTool;
    type: ElectricalDeviceType;
    label: string;
    symbol: string;
    activeClass: string;
    symbolClass: string;
};

type InsertSection = 'luminaires' | 'switches' | 'wire' | 'outlets' | 'equipment';

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

const OUTLET_ITEMS: DeviceItem[] = [
    {
        tool: 'elec-outlet-floor',
        type: 'outlet_floor',
        label: 'Toma bajo',
        symbol: 'T',
        activeClass: 'border-green-500 bg-green-900/40 text-green-300',
        symbolClass: 'text-green-400',
    },
    {
        tool: 'elec-outlet-waterproof',
        type: 'outlet_waterproof',
        label: 'Toma agua',
        symbol: 'TW',
        activeClass: 'border-blue-500 bg-blue-900/40 text-blue-300',
        symbolClass: 'text-blue-400',
    },
    {
        tool: 'elec-outlet-ceiling',
        type: 'outlet_ceiling',
        label: 'Toma techo',
        symbol: 'TC',
        activeClass: 'border-green-500 bg-green-900/40 text-green-300',
        symbolClass: 'text-green-400',
    },
    {
        tool: 'elec-outlet-rack',
        type: 'outlet_rack',
        label: 'Toma rack',
        symbol: 'TR',
        activeClass: 'border-red-500 bg-red-900/40 text-red-300',
        symbolClass: 'text-red-400',
    },
];

const EQUIPMENT_ITEMS: DeviceItem[] = [
    {
        tool: 'elec-meter',
        type: 'meter',
        label: 'Medidor',
        symbol: 'M',
        activeClass: 'border-cyan-500 bg-cyan-900/40 text-cyan-300',
        symbolClass: 'text-cyan-400',
    },
    {
        tool: 'elec-main-panel',
        type: 'main_panel',
        label: 'T. General',
        symbol: 'TG',
        activeClass: 'border-red-500 bg-red-900/40 text-red-300',
        symbolClass: 'text-red-400',
    },
    {
        tool: 'elec-sub-panel',
        type: 'sub_panel',
        label: 'Sub tablero',
        symbol: 'TD',
        activeClass: 'border-green-500 bg-green-900/40 text-green-300',
        symbolClass: 'text-green-400',
    },
    {
        tool: 'elec-transfer',
        type: 'transfer_switch',
        label: 'Transferencia',
        symbol: 'ATS',
        activeClass: 'border-orange-500 bg-orange-900/40 text-orange-300',
        symbolClass: 'text-orange-400',
    },
    {
        tool: 'elec-arrival',
        type: 'arrival_panel',
        label: 'T. Llegada',
        symbol: 'TL',
        activeClass: 'border-purple-500 bg-purple-900/40 text-purple-300',
        symbolClass: 'text-purple-400',
    },
    {
        tool: 'elec-junction-box',
        type: 'junction_box',
        label: 'Caja de pase',
        symbol: 'C',
        activeClass: 'border-yellow-500 bg-yellow-900/40 text-yellow-300',
        symbolClass: 'text-yellow-400',
    },
    {
        tool: 'elec-earth-pit',
        type: 'earth_pit',
        label: 'Pozo PAT',
        symbol: 'PAT',
        activeClass: 'border-yellow-600 bg-yellow-900/40 text-yellow-500',
        symbolClass: 'text-yellow-500',
    },
    {
        tool: 'elec-facp',
        type: 'facp',
        label: 'Contraincendios',
        symbol: 'FACP',
        activeClass: 'border-cyan-500 bg-cyan-900/40 text-cyan-300',
        symbolClass: 'text-cyan-400',
    },
];

export const LuzPanel: React.FC<{
    activeTool: DrawTool;
    onSetTool: (t: DrawTool) => void;
    switchTemplate: SwitchTemplate;
    onSetSwitchTemplate: (template: SwitchTemplate) => void;
    gridRows: number;
    gridCols: number;
    onSetRows: (n: number) => void;
    onSetCols: (n: number) => void;
    onOpenImportModal?: () => void;
    onSetElecDevice?: (type: ElectricalDeviceType, label?: string) => void;
}> = ({
    activeTool,
    onSetTool,
    switchTemplate,
    onSetSwitchTemplate,
    gridRows,
    gridCols,
    onSetRows,
    onSetCols,
    onSetElecDevice,
}) => {
    const [brand, setBrand] = useState<LuminaireBrand>('Todas');
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

    const renderDeviceButton = (item: DeviceItem) => (
        <button
            key={item.tool}
            type="button"
            onClick={() => setElecTool(item.tool, item.type)}
            className={`flex h-11 flex-col items-center justify-center gap-0.5 rounded border px-2 py-1.5 text-[10px] transition-colors ${
                activeTool === item.tool
                    ? item.activeClass
                    : 'border-gray-700/50 bg-gray-800/40 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200'
            }`}
        >
            <span className={`text-[11px] font-bold ${item.symbolClass}`}>
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
                    { id: 'outlets', label: 'Tomas' },
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
                                <div className="mt-2 grid grid-cols-2 gap-2 rounded border border-gray-700/40 bg-gray-900/40 p-2">
                                    <label className="space-y-1 text-[10px] text-gray-500">
                                        <span>Filas</span>
                                        <input
                                            type="number"
                                            min={1}
                                            max={20}
                                            value={gridRows}
                                            onChange={(e) =>
                                                onSetRows(Number(e.target.value))
                                            }
                                            className="h-7 w-full rounded border border-gray-700 bg-gray-950 px-2 text-[11px] text-gray-200 outline-none focus:border-cyan-500/50"
                                        />
                                    </label>
                                    <label className="space-y-1 text-[10px] text-gray-500">
                                        <span>Columnas</span>
                                        <input
                                            type="number"
                                            min={1}
                                            max={20}
                                            value={gridCols}
                                            onChange={(e) =>
                                                onSetCols(Number(e.target.value))
                                            }
                                            className="h-7 w-full rounded border border-gray-700 bg-gray-950 px-2 text-[11px] text-gray-200 outline-none focus:border-cyan-500/50"
                                    />
                                </label>
                            </div>
                        )}
                    </PanelCard>

                    <PanelCard title="Catalogo de luminarias">
                        <ChipFilter
                            options={LUMINAIRE_BRANDS}
                            active={brand}
                            onChange={setBrand}
                        />
                        <CatalogPanel
                            filterCategory="luminaires"
                            filterBrand={brand}
                            variant="compact-grid"
                            fixtureItemsPerPage={15}
                        />
                    </PanelCard>
                </>
            )}

            {activeSection === 'switches' && (
                <PanelCard title="Interruptores">
                            <div className="grid grid-cols-2 gap-1">
                                <PanelToolBtn
                                    tool="switch"
                                    icon={<ToggleLeft size={13} />}
                                    active={activeTool}
                                    onSet={onSetTool}
                                    tip="Interruptor (I)"
                                    sublabel={
                                        switchTemplate.label ?? 'Luz en pared'
                                    }
                                />
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
                                                : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
                                        }`}
                                    >
                                        <span className="w-8 shrink-0 font-mono text-[10px] text-gray-500">
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
                                        <span
                                            key={item.value}
                                            className="rounded border border-gray-700/40 bg-gray-950/60 px-1.5 py-1 text-center font-mono text-[9.5px] text-gray-400"
                                            title={`${item.label}: ${item.count} conductores`}
                                        >
                                            {item.label}
                                        </span>
                                    ),
                                )}
                            </div>
                            <p className="mt-2 text-[9px] text-gray-600">
                                El cálculo de longitud de cable está en el botón "Cálculo CT" de la barra superior (selecciona un ambiente primero).
                            </p>
                </PanelCard>
            )}

            {activeSection === 'outlets' && (
                <PanelCard title="Tomacorriente">
                            <div className="grid grid-cols-2 gap-1">
                                {OUTLET_ITEMS.map(renderDeviceButton)}
                            </div>
                </PanelCard>
            )}

            {activeSection === 'equipment' && (
                <PanelCard title="Equipos electricos">
                            <p className="mb-2 text-[9.5px] leading-relaxed text-gray-500">
                                Insertar en plano. Clic = colocar libre. Clic
                                cerca de pared = anclar.
                            </p>
                            <div className="grid grid-cols-2 gap-1">
                                {EQUIPMENT_ITEMS.map(renderDeviceButton)}
                            </div>
                </PanelCard>
            )}
        </>
    );
};
