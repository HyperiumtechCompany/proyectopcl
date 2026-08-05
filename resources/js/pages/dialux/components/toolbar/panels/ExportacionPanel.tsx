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
    Loader2,
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

export const ExportacionPanel: React.FC<{
    hasCadDoc: boolean;
    isLoading: boolean;
    fileName?: string;
    activeTool: DrawTool;
    scaleConfig: ScaleConfig | null;
    detectedScale: ScaleConfig | null;
    scaleConfirmed: boolean;
    onNewDoc: () => void;
    onImportClick: () => void;
    onImportIfcClick: () => void;
    isIfcParsing: boolean;
    ifcImportError: string | null;
    onApplyScale: (cfg: ScaleConfig) => Promise<void>;
    onCalibrate: () => void;
    onResetCalibration: () => void;
}> = ({
    hasCadDoc,
    isLoading,
    fileName,
    activeTool,
    scaleConfig,
    detectedScale,
    scaleConfirmed,
    onNewDoc,
    onImportClick,
    onImportIfcClick,
    isIfcParsing,
    ifcImportError,
    onApplyScale,
    onCalibrate,
    onResetCalibration,
}) => (
    <div className="flex flex-col gap-2.5">
        <PanelCard title="Documento CAD" tone="accent">
            <Button
                variant="outline"
                className="mb-2 w-full justify-start gap-2 border-cyan-800/40 bg-cyan-950/20 text-cyan-200 hover:bg-cyan-900/40"
                onClick={onNewDoc}
                disabled={isLoading}
            >
                <FilePlus size={13} />
                <span className="text-[11px]">Nuevo documento</span>
            </Button>
            <div className="rounded border border-gray-700/40 bg-gray-900/40 px-2 py-1.5 text-[10.5px]">
                <span className="text-gray-500">Estado: </span>
                <span className="font-mono text-cyan-300">
                    {hasCadDoc
                        ? (fileName ?? 'Documento activo')
                        : 'Sin documento'}
                </span>
            </div>
        </PanelCard>

        <PanelCard title="Importar plano" tone="accent">
            <Button
                variant="outline"
                className="mb-2 w-full justify-start gap-2 border-cyan-800/40 bg-cyan-950/20 text-cyan-200 hover:bg-cyan-900/40"
                onClick={onImportClick}
            >
                <Upload size={13} />
                <span className="text-[11px]">Importar DXF / DWG</span>
            </Button>
            <Button
                variant="outline"
                className="w-full justify-start gap-2 border-cyan-800/40 bg-cyan-950/20 text-cyan-200 hover:bg-cyan-900/40"
                onClick={onImportIfcClick}
                disabled={isIfcParsing}
            >
                {isIfcParsing ? <Loader2 size={13} className="animate-spin" /> : <Building2 size={13} />}
                <span className="text-[11px]">{isIfcParsing ? 'Leyendo IFC...' : 'Importar IFC'}</span>
            </Button>
            {ifcImportError && <p className="mt-1.5 text-[9.5px] text-red-400">{ifcImportError}</p>}
        </PanelCard>

        <PanelCard title="Escala y calibración">
            <div className="mb-2 flex items-center justify-between rounded border border-gray-700/40 bg-gray-900/40 px-2 py-1.5">
                <span className="text-[10px] text-gray-500">Escala actual</span>
                <span className="font-mono text-[11px] text-cyan-300">
                    {scaleConfig?.displayUnit ?? '—'}
                </span>
            </div>
            {detectedScale && !scaleConfirmed && (
                <button
                    type="button"
                    onClick={() => void onApplyScale(detectedScale)}
                    className="mb-2 w-full rounded bg-amber-700/70 px-2 py-1.5 text-[10.5px] font-semibold text-amber-50 transition-colors hover:bg-amber-600"
                >
                    ⚡ Confirmar escala detectada: {detectedScale.displayUnit}
                </button>
            )}
            <div className="grid grid-cols-2 gap-1">
                <Button
                    variant="outline"
                    size="sm"
                    className={`justify-center gap-1 border-gray-700 bg-gray-800/40 text-[10.5px] text-gray-200 hover:bg-gray-700/60 ${
                        activeTool === 'calibrate'
                            ? 'border-amber-600/60 bg-amber-900/30 text-amber-200'
                            : ''
                    }`}
                    onClick={onCalibrate}
                >
                    <Ruler size={11} />
                    Calibrar
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="justify-center gap-1 border-gray-700 bg-gray-800/40 text-[10.5px] text-gray-200 hover:bg-gray-700/60"
                    onClick={onResetCalibration}
                >
                    <RotateCcw size={11} />
                    Reset
                </Button>
            </div>
        </PanelCard>

        <PanelCard title="Exportar reporte">
            <Button
                variant="outline"
                className="mb-2 w-full justify-start gap-2 border-gray-700 bg-gray-800/40 text-gray-200 hover:bg-gray-700/60"
                onClick={() =>
                    document.getElementById('dialux-btn-export-pdf')?.click()
                }
            >
                <FileInput size={13} />
                <span className="text-[11px]">Exportar Reporte PDF</span>
            </Button>
            <Button
                variant="outline"
                className="w-full justify-start gap-2 border-emerald-800/40 bg-emerald-950/20 text-emerald-200 hover:bg-emerald-900/40"
                onClick={() =>
                    document.getElementById('dialux-btn-export-dxf')?.click()
                }
            >
                <FileInput size={13} />
                <span className="text-[11px]">Exportar Plano DXF (CAD)</span>
            </Button>
        </PanelCard>
    </div>
);

/* ── Editar Panel ────────────────────────────────────────────────────────── */
