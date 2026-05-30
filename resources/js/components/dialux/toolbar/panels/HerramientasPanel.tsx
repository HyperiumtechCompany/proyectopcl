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

export const HerramientasPanel: React.FC<{
    onExecute: (cmd: string) => void;
    isReady: boolean;
}> = ({ onExecute, isReady }) => {
    const CMDS = [
        {
            cmd: 'line',
            label: 'Línea',
            sublabel: 'Rectas',
            icon: <MinusCircle size={13} />,
        },
        {
            cmd: 'pline',
            label: 'Polilínea',
            sublabel: 'Continua conectada',
            icon: <PenTool size={13} />,
        },
        {
            cmd: 'rectangle',
            label: 'Rectángulo',
            sublabel: 'Forma cerrada',
            icon: <Square size={13} />,
        },
        {
            cmd: 'circle',
            label: 'Círculo',
            sublabel: 'Centro + radio',
            icon: <Circle size={13} />,
        },
        {
            cmd: 'arc',
            label: 'Arco',
            sublabel: '3 puntos o ángulo',
            icon: <Triangle size={13} />,
        },
        {
            cmd: 'spline',
            label: 'Curva spline',
            sublabel: 'Curva suave',
            icon: <Spline size={13} />,
        },
        {
            cmd: 'text',
            label: 'Texto simple',
            sublabel: 'Una línea',
            icon: <Type size={13} />,
        },
        {
            cmd: 'mtext',
            label: 'Texto múltiple',
            sublabel: 'Bloque multilínea',
            icon: <FilePlus size={13} />,
        },
    ];
    return (
        <>
            <SectionBand label="Entidades CAD" icon={<Wrench size={11} />} />
            {CMDS.map(({ cmd, label, sublabel, icon }) => (
                <PanelCadBtn
                    key={cmd}
                    command={cmd}
                    title={`${label} - ${sublabel}`}
                    icon={icon}
                    onExecute={onExecute}
                    isReady={isReady}
                />
            ))}
        </>
    );
};

/* ── Construccion Panel ───────────────────────────────────────────────────── */
