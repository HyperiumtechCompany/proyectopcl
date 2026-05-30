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

export const MedirPanel: React.FC<{
    activeTool: DrawTool;
    onSetTool: (t: DrawTool) => void;
    onExecute: (cmd: string) => void;
    isReady: boolean;
    scaleConfig: ScaleConfig;
}> = ({ activeTool, onSetTool, onExecute, isReady, scaleConfig }) => {
    const isCalibrated =
        scaleConfig.isCalibrated && scaleConfig.calibrationFactor !== 1;
    return (
        <>
            <SectionBand
                label="Herramientas DIAlux"
                icon={<Ruler size={11} />}
            />
            <PanelToolBtn
                tool="measure"
                icon={<Ruler size={13} />}
                active={activeTool}
                onSet={onSetTool}
                tip="Medir distancia"
                sublabel="Punto a punto"
            />
            <PanelToolBtn
                tool="measure-area"
                icon={<Square size={13} />}
                active={activeTool}
                onSet={onSetTool}
                tip="Medir área"
                sublabel="Polígono (click)"
            />

            <SectionBand
                label="Herramientas CAD (Motor)"
                icon={<Grid size={11} />}
                className="mt-2"
            />
            {isCalibrated && (
                <div className="mx-2 mb-2 rounded bg-amber-950/50 p-2 text-[10px] leading-tight text-amber-200 ring-1 ring-amber-900/50">
                    <span className="font-semibold text-amber-400">
                        Atención:
                    </span>{' '}
                    Escala activa (×{scaleConfig.calibrationFactor.toFixed(4)}).
                    Las herramientas nativas medirán en unidades originales. Usa
                    las de DIAlux arriba.
                </div>
            )}
            <div className={isCalibrated ? 'opacity-50 grayscale' : ''}>
                <PanelCadBtn
                    command="measurearea"
                    title="Área CAD"
                    icon={<Square size={13} />}
                    onExecute={onExecute}
                    isReady={isReady}
                />
                <PanelCadBtn
                    command="measureangle"
                    title="Ángulo CAD"
                    icon={<RotateCw size={13} />}
                    onExecute={onExecute}
                    isReady={isReady}
                />
                <PanelSep />
                <PanelCadBtn
                    command="clearmeasurements"
                    title="Limpiar marcas CAD"
                    icon={<Trash2 size={13} />}
                    onExecute={onExecute}
                    isReady={isReady}
                />
            </div>
        </>
    );
};

/* ── Vista Panel ─────────────────────────────────────────────────────────── */
