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

export const VistaPanel: React.FC<{
    showIsolux: boolean;
    isoluxMode: IsoluxMode;
    isReady: boolean;
    onExecute: (cmd: string) => void;
    onToggleIsolux: () => void;
    onSetIsoluxMode: (m: IsoluxMode) => void;
    onResetView: () => void;
}> = ({
    showIsolux,
    isoluxMode,
    isReady,
    onExecute,
    onToggleIsolux,
    onSetIsoluxMode,
    onResetView,
}) => (
    <>
        <SectionBand label="Navegación" icon={<Eye size={11} />} />
        <PanelCadBtn
            command="zoom"
            title="Zoom extents - Ajustar vista"
            icon={<Focus size={13} />}
            onExecute={onExecute}
            isReady={isReady}
        />
        <PanelCadBtn
            command="pan"
            title="Pan CAD - Mover vista"
            icon={<Move size={13} />}
            onExecute={onExecute}
            isReady={isReady}
        />
        <PanelSep label="Superposiciones" />
        <button
            type="button"
            disabled
            title="Grilla nativa no soportada"
            className="flex h-9 w-full cursor-not-allowed items-center gap-2.5 rounded bg-gray-800/60 px-2 text-gray-500"
        >
            <Grid size={13} />
            <span className="text-[11px]">Grilla</span>
            <span className="ml-auto rounded bg-gray-700/50 px-1.5 py-0.5 text-[9px] text-gray-400">
                N/D
            </span>
        </button>
        <button
            type="button"
            id="dialux-toggle-isolux"
            onClick={onToggleIsolux}
            className={`flex h-9 w-full items-center gap-2.5 rounded px-2 text-left transition-colors ${
                showIsolux
                    ? 'bg-yellow-900/20 text-yellow-400'
                    : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-100'
            }`}
        >
            <Layers size={13} />
            <span className="text-[11px]">Isolux</span>
            <span
                className={`ml-auto rounded px-1.5 py-0.5 text-[9px] ${
                    showIsolux
                        ? 'bg-yellow-900/40 text-yellow-400'
                        : 'bg-gray-700/50 text-gray-600'
                }`}
            >
                {showIsolux ? 'ON' : 'OFF'}
            </span>
        </button>
        <IsoluxBlock mode={isoluxMode} onChange={onSetIsoluxMode} />
        <PanelSep />
        <button
            type="button"
            id="dialux-reset-view"
            onClick={onResetView}
            className="flex h-9 w-full items-center gap-2.5 rounded px-2 text-left text-gray-400 transition-colors hover:bg-gray-700/50 hover:text-gray-100"
        >
            <RotateCcw size={13} />
            <span className="text-[11px]">Resetear vista</span>
        </button>
    </>
);

/* ── Exportación Panel ───────────────────────────────────────────────────── */
