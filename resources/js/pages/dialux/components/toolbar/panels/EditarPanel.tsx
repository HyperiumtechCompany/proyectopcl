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
import type { NormativeStandard } from '@/pages/dialux/hooks/roomLighting';
import type {
    AngleSnapMode,
    DrawTool,
    ElectricalDeviceType,
    IsoluxMode,
    ScaleConfig,
} from '@/pages/dialux/hooks/useEditorStore';
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

export const EditarPanel: React.FC<{
    onExecute: (cmd: string) => void;
    isReady: boolean;
    onDeleteSelected: () => void;
}> = ({ onExecute, isReady, onDeleteSelected }) => (
    <>
        <SectionBand label="Edición" icon={<Wrench size={11} />} />
        <PanelCadBtn
            command="erase"
            title="Borrar - Objetos seleccionados"
            icon={<Trash2 size={13} />}
            onExecute={onExecute}
            isReady={isReady}
        />
        <button
            type="button"
            id="dialux-delete-selected"
            onClick={onDeleteSelected}
            className="flex h-9 w-full items-center gap-2.5 rounded px-2 text-left text-red-500/70 transition-colors hover:bg-red-900/20 hover:text-red-400"
        >
            <X size={13} />
            <span className="text-[11px]">Eliminar seleccionado</span>
        </button>
    </>
);

/* ── Proyecto Panel ──────────────────────────────────────────────────────── */
