import {
    AlertCircle,
    AppWindow,
    Building2,
    CheckCircle2,
    Circle,
    DoorOpen,
    Eye,
    FileInput,
    FilePlus,
    Focus,
    Gauge,
    Grid,
    Info,
    Layers,
    Lightbulb,
    Minus,
    MinusCircle,
    Move,
    PenTool,
    RotateCcw,
    RotateCw,
    Ruler,
    Scale,
    Square,
    Spline,
    Tag,
    ToggleLeft,
    Trash2,
    Triangle,
    Type,
    Umbrella,
    Upload,
    Wrench,
    X,
    Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { NormativeStandard } from '@/hooks/dialux/roomLighting';
import type {
    AngleSnapMode,
    DrawTool,
    ElectricalDeviceType,
    IsoluxMode,
    ScaleConfig,
} from '@/hooks/dialux/useEditorStore';
import { CatalogPanel } from '../../CatalogPanel';
import {
    LUMINAIRE_BRANDS,
    WINDOW_MATERIALS,
    type LuminaireBrand,
    type WindowMaterial,
} from '../../constants';
import {
    ALL_STANDARDS,
    getBackground,
    getSurround,
    type NormKey,
    type NormProfile,
} from '../normativeData';
import {
    AngleSnapBlock,
    ChipFilter,
    IsoluxBlock,
    SearchInput,
} from '../panelControls';
import {
    MetricRow,
    PanelCadBtn,
    PanelCard,
    PanelSep,
    PanelTabs,
    PanelToolBtn,
    SectionBand,
} from '../primitives';

export const ProyectoPanel: React.FC<{
    projectName: string;
    onProjectNameChange: (v: string) => void;
}> = ({ projectName, onProjectNameChange }) => (
    <div className="flex flex-col gap-2.5">
        <PanelCard title="Identificación del proyecto" tone="accent">
            <label className="mb-1 block text-[9px] tracking-wider text-gray-600 uppercase">
                Nombre del proyecto
            </label>
            <input
                type="text"
                value={projectName}
                onChange={(e) => onProjectNameChange(e.target.value)}
                placeholder="Ej. Edificio Comercial Los Pinos"
                className="w-full rounded border border-gray-700/60 bg-gray-900/70 px-2 py-1.5 text-[11px] text-gray-200 placeholder-gray-600 transition-colors outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
            />
        </PanelCard>
        <PanelCard title="Uso del nombre">
            <p className="text-[9.5px] leading-snug text-gray-500">
                El nombre aparece en el encabezado del reporte PDF y como título
                del proyecto.
            </p>
        </PanelCard>
    </div>
);
