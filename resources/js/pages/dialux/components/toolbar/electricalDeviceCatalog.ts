import type {
    DrawTool,
    ElectricalDeviceType,
} from '@/pages/dialux/hooks/useEditorStore';

export type ElectricalDeviceCatalogItem = {
    tool: DrawTool;
    type: ElectricalDeviceType;
    label: string;
    symbol: string;
    activeClass: string;
    symbolClass: string;
};

// Punto unico para agregar nuevos objetos electricos al panel:
// 1. Agrega el tipo en ElectricalDeviceType/ELECTRICAL_DEVICE_DEFAULTS.
// 2. Agrega el tool en DrawTool y el cursor en MlightcadCanvas2D.
// 3. Agrega su simbolo en OverlayElectricalDevices.
// 4. Agrega aqui el item para mostrarlo en la toolbar.
export const OUTLET_DEVICE_ITEMS: ElectricalDeviceCatalogItem[] = [
    {
        tool: 'elec-outlet-floor',
        type: 'outlet_floor',
        label: 'Toma doble bajo',
        symbol: 'T',
        activeClass: 'border-green-500 bg-green-900/40 text-green-300',
        symbolClass: 'text-green-400',
    },
    {
        tool: 'elec-outlet-initial',
        type: 'outlet_initial',
        label: 'Toma inicial 1.50 m',
        symbol: 'TI',
        activeClass: 'border-green-500 bg-green-900/40 text-green-300',
        symbolClass: 'text-green-400',
    },
    {
        tool: 'elec-outlet-high-180',
        type: 'outlet_high_180',
        label: 'Toma alto 1.80 m',
        symbol: 'TA',
        activeClass: 'border-blue-500 bg-blue-900/40 text-blue-300',
        symbolClass: 'text-blue-400',
    },
    {
        tool: 'elec-outlet-floor-box',
        type: 'outlet_floor_box',
        label: 'Toma de piso NPT',
        symbol: 'TP',
        activeClass: 'border-emerald-500 bg-emerald-900/40 text-emerald-300',
        symbolClass: 'text-emerald-400',
    },
    {
        tool: 'elec-outlet-waterproof',
        type: 'outlet_waterproof',
        label: 'Toma prueba agua',
        symbol: 'PA',
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
    {
        tool: 'elec-water-heater',
        type: 'water_heater_30l',
        label: 'Terma 30L',
        symbol: 'TE',
        activeClass: 'border-fuchsia-500 bg-fuchsia-900/40 text-fuchsia-300',
        symbolClass: 'text-fuchsia-400',
    },
];

export const EQUIPMENT_DEVICE_ITEMS: ElectricalDeviceCatalogItem[] = [
    {
        tool: 'elec-meter',
        type: 'meter',
        label: 'Medidor 1O',
        symbol: 'kWh',
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
