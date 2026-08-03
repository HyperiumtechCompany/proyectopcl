import { Link2 } from 'lucide-react';
import React, { useState } from 'react';
import type {
    Conductor,
    DrawTool,
    ElectricalDeviceProperties,
    ElectricalDeviceType,
} from '@/pages/dialux/hooks/useEditorStore';
import { CONDUCTOR_WIRE_OPTIONS } from '@/pages/dialux/hooks/types';
import { OUTLET_DEVICE_ITEMS, type ElectricalDeviceCatalogItem } from '../electricalDeviceCatalog';
import { OutletCatalogPanel, type OutletCatalogSelection } from '../OutletCatalogPanel';
import { PanelCard, PanelTabs, PanelToolBtn } from '../primitives';

const WATER_HEATER_ITEM = OUTLET_DEVICE_ITEMS.find((item) => item.type === 'water_heater_30l')!;

type WireTemplate = {
    wireCount: Conductor['wireCount'];
    wireLabel: NonNullable<Conductor['wireLabel']>;
};

type TomasSection = 'tomas' | 'wire';

/**
 * Panel dedicado a tomacorrientes — separado de "Luz" en la barra lateral
 * a propósito: alumbrado y tomacorriente son circuitos y tuberías
 * distintas por norma (CNE-Utilización / RNE EM.010), así que también
 * viven en secciones distintas de la barra de herramientas.
 */
export const TomasPanel: React.FC<{
    activeTool: DrawTool;
    onSetElecDevice?: (
        type: ElectricalDeviceType,
        label?: string,
        properties?: Partial<ElectricalDeviceProperties>,
    ) => void;
    onSetTool: (t: DrawTool) => void;
    wireTemplate: WireTemplate;
    onSetWireTemplate: (template: WireTemplate) => void;
}> = ({ activeTool, onSetElecDevice, onSetTool, wireTemplate, onSetWireTemplate }) => {
    const [activeSection, setActiveSection] = useState<TomasSection>('tomas');

    const pickFromCatalog = (selection: OutletCatalogSelection) => {
        onSetTool(selection.tool);
        onSetElecDevice?.(selection.type, selection.label, selection.properties);
    };

    const setElecTool = (item: ElectricalDeviceCatalogItem) => {
        onSetTool(item.tool);
        onSetElecDevice?.(item.type);
    };

    const setWireTool = (template: WireTemplate) => {
        onSetWireTemplate(template);
        onSetTool('wire');
    };

    return (
        <>
            <PanelTabs
                tabs={[
                    { id: 'tomas', label: 'Tomas' },
                    { id: 'wire', label: 'Cable' },
                ]}
                activeTab={activeSection}
                onChange={setActiveSection}
            />

            {activeSection === 'tomas' && (
                <>
                    <OutletCatalogPanel activeTool={activeTool} onSelect={pickFromCatalog} />
                    <PanelCard title="Otros">
                        <div className="grid grid-cols-2 gap-1">
                            <button
                                type="button"
                                onClick={() => setElecTool(WATER_HEATER_ITEM)}
                                title={WATER_HEATER_ITEM.label}
                                className={`flex h-14 flex-col items-center justify-center gap-1 rounded border px-2 py-1.5 text-[10px] transition-colors ${
                                    activeTool === WATER_HEATER_ITEM.tool
                                        ? WATER_HEATER_ITEM.activeClass
                                        : 'border-gray-700/50 bg-gray-800/40 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200'
                                }`}
                            >
                                <span className={`text-[12px] font-bold ${WATER_HEATER_ITEM.symbolClass}`}>
                                    {WATER_HEATER_ITEM.symbol}
                                </span>
                                <span className="max-w-full truncate">{WATER_HEATER_ITEM.label}</span>
                            </button>
                        </div>
                    </PanelCard>
                </>
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
                        {CONDUCTOR_WIRE_OPTIONS.slice(0, 9).map((item) => (
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
                                    activeTool === 'wire' && wireTemplate.wireLabel === item.value
                                        ? 'border-cyan-500/50 bg-cyan-600/20 text-cyan-200'
                                        : 'border-gray-700/40 bg-gray-950/60 text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
                                }`}
                                title={`${item.label}: ${item.count} conductores`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                    <p className="mt-2 text-[9px] text-gray-600">
                        Conecta un tomacorriente con otro, con una caja de paso o
                        directamente con el tablero. El cálculo de longitud de
                        cable está en el botón "Cálculo CT" de la barra superior.
                    </p>
                </PanelCard>
            )}
        </>
    );
};
