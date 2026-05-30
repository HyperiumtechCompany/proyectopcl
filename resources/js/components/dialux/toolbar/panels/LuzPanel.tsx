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
    Link2,
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

export const LuzPanel: React.FC<{
    activeTool: DrawTool;
    onSetTool: (t: DrawTool) => void;
    gridRows: number;
    gridCols: number;
    onSetRows: (n: number) => void;
    onSetCols: (n: number) => void;
    onOpenImportModal?: () => void;
    onSetElecDevice?: (type: ElectricalDeviceType, label?: string) => void;
}> = ({
    activeTool,
    onSetTool,
    gridRows,
    gridCols,
    onSetRows,
    onSetCols,
    onOpenImportModal,
    onSetElecDevice,
}) => {
    const [brand, setBrand] = useState<LuminaireBrand>('Todas');
    const [activeTab, setActiveTab] = useState<'insert' | 'catalog'>('insert');

    /** Activa la herramienta y configura el template del dispositivo */
    const setElecTool = (tool: DrawTool, type: ElectricalDeviceType) => {
        onSetTool(tool);
        onSetElecDevice?.(type);
    };

    return (
        <>
            <PanelTabs
                tabs={[
                    { id: 'insert', label: 'Inserción' },
                    { id: 'catalog', label: 'Catálogo' },
                ]}
                activeTab={activeTab}
                onChange={setActiveTab}
            />
            {activeTab === 'insert' ? (
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
                                tool="switch"
                                icon={<ToggleLeft size={13} />}
                                active={activeTool}
                                onSet={onSetTool}
                                tip="Interruptor (I)"
                                sublabel="Luz en pared"
                            />
                            <PanelToolBtn
                                tool="wire"
                                icon={<Link2 size={13} />}
                                active={activeTool}
                                onSet={onSetTool}
                                tip="Cableado (U)"
                                sublabel="Conectar focos"
                            />
                        </div>
                    </PanelCard>

                    <PanelCard title="Equipos eléctricos">
                        <p className="mb-2 text-[9.5px] leading-relaxed text-gray-500">
                            Insertar en plano. Clic = colocar libre. Clic cerca
                            de pared = anclar.
                        </p>
                        <div className="grid grid-cols-2 gap-1">
                            <button
                                type="button"
                                onClick={() =>
                                    setElecTool('elec-meter', 'meter')
                                }
                                className={`flex flex-col items-center gap-0.5 rounded border px-2 py-1.5 text-[10px] transition-colors ${
                                    activeTool === 'elec-meter'
                                        ? 'border-cyan-500 bg-cyan-900/40 text-cyan-300'
                                        : 'border-gray-700/50 bg-gray-800/40 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200'
                                }`}
                            >
                                <span className="text-[11px] font-bold">M</span>
                                <span>Medidor</span>
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    setElecTool('elec-main-panel', 'main_panel')
                                }
                                className={`flex flex-col items-center gap-0.5 rounded border px-2 py-1.5 text-[10px] transition-colors ${
                                    activeTool === 'elec-main-panel'
                                        ? 'border-red-500 bg-red-900/40 text-red-300'
                                        : 'border-gray-700/50 bg-gray-800/40 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200'
                                }`}
                            >
                                <span className="text-[11px] font-bold text-red-400">
                                    TG
                                </span>
                                <span>T. General</span>
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    setElecTool('elec-sub-panel', 'sub_panel')
                                }
                                className={`flex flex-col items-center gap-0.5 rounded border px-2 py-1.5 text-[10px] transition-colors ${
                                    activeTool === 'elec-sub-panel'
                                        ? 'border-green-500 bg-green-900/40 text-green-300'
                                        : 'border-gray-700/50 bg-gray-800/40 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200'
                                }`}
                            >
                                <span className="text-[11px] font-bold text-green-400">
                                    TD
                                </span>
                                <span>Sub Tablero</span>
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    setElecTool(
                                        'elec-transfer',
                                        'transfer_switch',
                                    )
                                }
                                className={`flex flex-col items-center gap-0.5 rounded border px-2 py-1.5 text-[10px] transition-colors ${
                                    activeTool === 'elec-transfer'
                                        ? 'border-orange-500 bg-orange-900/40 text-orange-300'
                                        : 'border-gray-700/50 bg-gray-800/40 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200'
                                }`}
                            >
                                <span className="text-[11px] font-bold text-orange-400">
                                    ATS
                                </span>
                                <span>Transferencia</span>
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    setElecTool('elec-arrival', 'arrival_panel')
                                }
                                className={`flex flex-col items-center gap-0.5 rounded border px-2 py-1.5 text-[10px] transition-colors ${
                                    activeTool === 'elec-arrival'
                                        ? 'border-purple-500 bg-purple-900/40 text-purple-300'
                                        : 'border-gray-700/50 bg-gray-800/40 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200'
                                }`}
                            >
                                <span className="text-[11px] font-bold text-purple-400">
                                    TL
                                </span>
                                <span>T. Llegada</span>
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    setElecTool(
                                        'elec-junction-box',
                                        'junction_box',
                                    )
                                }
                                className={`flex flex-col items-center gap-0.5 rounded border px-2 py-1.5 text-[10px] transition-colors ${
                                    activeTool === 'elec-junction-box'
                                        ? 'border-yellow-500 bg-yellow-900/40 text-yellow-300'
                                        : 'border-gray-700/50 bg-gray-800/40 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200'
                                }`}
                            >
                                <span className="text-[11px] font-bold text-yellow-400">
                                    ⊠
                                </span>
                                <span>Caja de Pase</span>
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    setElecTool('elec-earth-pit', 'earth_pit')
                                }
                                className={`flex flex-col items-center gap-0.5 rounded border px-2 py-1.5 text-[10px] transition-colors ${
                                    activeTool === 'elec-earth-pit'
                                        ? 'border-yellow-600 bg-yellow-900/40 text-yellow-500'
                                        : 'border-gray-700/50 bg-gray-800/40 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200'
                                }`}
                            >
                                <span className="text-[11px] font-bold text-yellow-500">
                                    ⏚
                                </span>
                                <span>Pozo PAT</span>
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    setElecTool('elec-facp', 'facp')
                                }
                                className={`flex flex-col items-center gap-0.5 rounded border px-2 py-1.5 text-[10px] transition-colors ${
                                    activeTool === 'elec-facp'
                                        ? 'border-cyan-500 bg-cyan-900/40 text-cyan-300'
                                        : 'border-gray-700/50 bg-gray-800/40 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200'
                                }`}
                            >
                                <span className="text-[11px] font-bold text-cyan-400">
                                    FACP
                                </span>
                                <span>Contraincendios</span>
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    setElecTool('elec-outlet-floor', 'outlet_floor')
                                }
                                className={`flex flex-col items-center gap-0.5 rounded border px-2 py-1.5 text-[10px] transition-colors ${
                                    activeTool === 'elec-outlet-floor'
                                        ? 'border-green-500 bg-green-900/40 text-green-300'
                                        : 'border-gray-700/50 bg-gray-800/40 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200'
                                }`}
                            >
                                <span className="text-[11px] font-bold text-green-400">
                                    T
                                </span>
                                <span>Toma Bajo</span>
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    setElecTool('elec-outlet-waterproof', 'outlet_waterproof')
                                }
                                className={`flex flex-col items-center gap-0.5 rounded border px-2 py-1.5 text-[10px] transition-colors ${
                                    activeTool === 'elec-outlet-waterproof'
                                        ? 'border-blue-500 bg-blue-900/40 text-blue-300'
                                        : 'border-gray-700/50 bg-gray-800/40 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200'
                                }`}
                            >
                                <span className="text-[11px] font-bold text-blue-400">
                                    T
                                </span>
                                <span>Toma Agua</span>
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    setElecTool('elec-outlet-ceiling', 'outlet_ceiling')
                                }
                                className={`flex flex-col items-center gap-0.5 rounded border px-2 py-1.5 text-[10px] transition-colors ${
                                    activeTool === 'elec-outlet-ceiling'
                                        ? 'border-green-500 bg-green-900/40 text-green-300'
                                        : 'border-gray-700/50 bg-gray-800/40 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200'
                                }`}
                            >
                                <span className="text-[11px] font-bold text-green-400">
                                    T
                                </span>
                                <span>Toma Techo</span>
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    setElecTool('elec-outlet-rack', 'outlet_rack')
                                }
                                className={`flex flex-col items-center gap-0.5 rounded border px-2 py-1.5 text-[10px] transition-colors ${
                                    activeTool === 'elec-outlet-rack'
                                        ? 'border-red-500 bg-red-900/40 text-red-300'
                                        : 'border-gray-700/50 bg-gray-800/40 text-gray-400 hover:bg-gray-700/60 hover:text-gray-200'
                                }`}
                            >
                                <span className="text-[11px] font-bold text-red-400">
                                    T
                                </span>
                                <span>Toma Rack</span>
                            </button>
                        </div>
                    </PanelCard>
                </>
            ) : (
                <>
                    <PanelCard title="Catálogo de luminarias">
                        <p className="mb-2.5 text-[10px] leading-relaxed text-gray-400">
                            Busca y selecciona luminarias del catálogo completo.
                        </p>
                        <Button
                            className="w-full justify-center gap-2 bg-cyan-700/80 text-cyan-100 hover:bg-cyan-600/80"
                            onClick={onOpenImportModal}
                        >
                            <Lightbulb size={13} />
                            <span className="text-[11px]">Abrir catálogo</span>
                        </Button>
                    </PanelCard>
                    <PanelCard title="Filtros por marca">
                        <ChipFilter
                            options={LUMINAIRE_BRANDS}
                            active={brand}
                            onChange={setBrand}
                        />
                    </PanelCard>
                </>
            )}
        </>
    );
};

/* ── Medir Panel ─────────────────────────────────────────────────────────── */
