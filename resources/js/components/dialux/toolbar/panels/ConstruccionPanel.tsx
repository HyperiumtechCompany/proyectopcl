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

export const ConstruccionPanel: React.FC<{
    activeTool: DrawTool;
    onSetTool: (t: DrawTool) => void;
    angleSnapMode: AngleSnapMode;
    onSetAngleSnap: (v: AngleSnapMode) => void;
    wallTypeTemplate: 'interior' | 'exterior' | 'cerco';
    onSetWallType: (t: 'interior' | 'exterior' | 'cerco') => void;
    roomTypeTemplate: 'room' | 'ambient';
    onSetRoomType: (t: 'room' | 'ambient') => void;
}> = ({
    activeTool,
    onSetTool,
    angleSnapMode,
    onSetAngleSnap,
    wallTypeTemplate,
    onSetWallType,
    roomTypeTemplate,
    onSetRoomType,
}) => {
    const [search, setSearch] = useState('');
    const [material, setMaterial] = useState<WindowMaterial>('Todos');
    const [activeTab, setActiveTab] = useState<'tools' | 'catalog'>('tools');

    const WALL_TYPE_OPTIONS: Array<{
        value: 'interior' | 'exterior' | 'cerco';
        label: string;
        color: string;
    }> = [
        { value: 'interior', label: 'Interior', color: 'text-slate-300' },
        { value: 'exterior', label: 'Exterior', color: 'text-blue-400' },
        { value: 'cerco', label: 'Cerco', color: 'text-amber-400' },
    ];

    const ROOM_TYPE_OPTIONS: Array<{
        value: 'room' | 'ambient';
        label: string;
        color: string;
        hint: string;
    }> = [
        {
            value: 'room',
            label: 'Recinto',
            color: 'text-cyan-400',
            hint: 'Envolvente exterior — sin iluminación',
        },
        {
            value: 'ambient',
            label: 'Ambiente',
            color: 'text-emerald-400',
            hint: 'Espacio interior — con normativa y focos',
        },
    ];

    const TOOL_GROUPS: Array<{
        label: string;
        tools: Array<{
            tool: DrawTool;
            icon: React.ReactNode;
            tip: string;
            sublabel?: string;
        }>;
    }> = [
        {
            label: 'Espacios',
            tools: [
                {
                    tool: 'room',
                    icon: <Square size={13} />,
                    tip: 'Recinto poligonal (R)',
                    sublabel: 'Polígono del recinto',
                },
                {
                    tool: 'corridor',
                    icon: <Layers size={13} />,
                    tip: 'Pasadizo',
                    sublabel: 'Polígono techo reflejado',
                },
                {
                    tool: 'stair',
                    icon: <Triangle size={13} />,
                    tip: 'Escalera (E)',
                    sublabel: 'Caja de escalera',
                },
            ],
        },
        {
            label: 'Muros',
            tools: [
                {
                    tool: 'wall',
                    icon: <Minus size={13} />,
                    tip: 'Pared (W)',
                    sublabel: 'Polilínea de pared',
                },
                {
                    tool: 'education-wall',
                    icon: <Building2 size={13} />,
                    tip: 'Muro colegio',
                    sublabel: 'Ingresos y salidas',
                },
            ],
        },
        {
            label: 'Aberturas y cubierta',
            tools: [
                {
                    tool: 'window',
                    icon: <AppWindow size={13} />,
                    tip: 'Ventana (N)',
                    sublabel: 'En pared existente',
                },
                {
                    tool: 'door',
                    icon: <DoorOpen size={13} />,
                    tip: 'Puerta (D)',
                    sublabel: 'Entrada / salida',
                },
                {
                    tool: 'canopy',
                    icon: <Umbrella size={13} />,
                    tip: 'Voladizo (C)',
                    sublabel: 'Protección solar',
                },
            ],
        },
    ];
    const toolCount = TOOL_GROUPS.reduce(
        (total, group) => total + group.tools.length,
        0,
    );

    return (
        <>
            <PanelTabs
                tabs={[
                    { id: 'tools', label: 'Dibujo', count: toolCount },
                    { id: 'catalog', label: 'Catálogo' },
                ]}
                activeTab={activeTab}
                onChange={setActiveTab}
            />

            {activeTab === 'tools' ? (
                <>
                    <PanelCard tone="accent">
                        <div className="space-y-2">
                            {TOOL_GROUPS.map((group) => (
                                <div key={group.label}>
                                    <p className="mb-1 px-1 text-[9px] font-semibold tracking-[0.14em] text-gray-600 uppercase">
                                        {group.label}
                                    </p>
                                    <div className="grid grid-cols-2 gap-1">
                                        {group.tools.map((t) => (
                                            <PanelToolBtn
                                                key={t.tool}
                                                {...t}
                                                active={activeTool}
                                                onSet={onSetTool}
                                            />
                                        ))}
                                    </div>
                                    {/* Selector de tipo de espacio — bajo los botones de Espacios */}
                                    {group.label === 'Espacios' && (
                                        <div className="mt-1.5 rounded border border-gray-700/60 bg-gray-900/60 p-1.5">
                                            <p className="mb-1 text-[8px] font-bold tracking-widest text-gray-600 uppercase">
                                                Tipo de espacio
                                            </p>
                                            <div className="flex gap-1">
                                                {ROOM_TYPE_OPTIONS.map(
                                                    (opt) => (
                                                        <button
                                                            key={opt.value}
                                                            type="button"
                                                            title={opt.hint}
                                                            onClick={() =>
                                                                onSetRoomType(
                                                                    opt.value,
                                                                )
                                                            }
                                                            className={`flex-1 rounded py-1 text-[9px] font-semibold transition-colors ${
                                                                roomTypeTemplate ===
                                                                opt.value
                                                                    ? `bg-gray-700 ${opt.color} ring-1 ring-gray-500`
                                                                    : 'text-gray-600 hover:text-gray-400'
                                                            }`}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    ),
                                                )}
                                            </div>
                                            {roomTypeTemplate === 'room' && (
                                                <p className="mt-1 text-[8.5px] leading-snug text-cyan-700">
                                                    Sin iluminación — solo
                                                    construcción
                                                </p>
                                            )}
                                            {roomTypeTemplate === 'ambient' && (
                                                <p className="mt-1 text-[8.5px] leading-snug text-emerald-700">
                                                    Con normativa y grilla de
                                                    focos
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    {/* Selector de tipo de muro — justo bajo los botones de Muros */}
                                    {group.label === 'Muros' && (
                                        <div className="mt-1.5 rounded border border-gray-700/60 bg-gray-900/60 p-1.5">
                                            <p className="mb-1 text-[8px] font-bold tracking-widest text-gray-600 uppercase">
                                                Tipo de muro
                                            </p>
                                            <div className="flex gap-1">
                                                {WALL_TYPE_OPTIONS.map(
                                                    (opt) => (
                                                        <button
                                                            key={opt.value}
                                                            type="button"
                                                            onClick={() =>
                                                                onSetWallType(
                                                                    opt.value,
                                                                )
                                                            }
                                                            className={`flex-1 rounded py-1 text-[9px] font-semibold transition-colors ${
                                                                wallTypeTemplate ===
                                                                opt.value
                                                                    ? `bg-gray-700 ${opt.color} ring-1 ring-gray-500`
                                                                    : 'text-gray-600 hover:text-gray-400'
                                                            }`}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    ),
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </PanelCard>
                    <PanelSep label="Ayuda de dibujo" />
                    <AngleSnapBlock
                        mode={angleSnapMode}
                        onChange={onSetAngleSnap}
                    />
                    <PanelCard title="Flujo recomendado">
                        <ol className="list-none space-y-1.5 text-[10px] leading-relaxed text-gray-400">
                            {[
                                'Dibuja recinto o muros.',
                                'Inserta ventanas, puertas y voladizos.',
                                'Importa plano DXF solo si necesitas referencia.',
                            ].map((t, i) => (
                                <li key={i} className="flex gap-2">
                                    <span className="shrink-0 font-mono text-cyan-700">
                                        {i + 1}.
                                    </span>
                                    {t}
                                </li>
                            ))}
                        </ol>
                    </PanelCard>
                </>
            ) : (
                <>
                    <PanelCard title="Filtros">
                        <ChipFilter
                            options={WINDOW_MATERIALS}
                            active={material}
                            onChange={setMaterial}
                        />
                        <SearchInput
                            value={search}
                            onChange={setSearch}
                            placeholder="Buscar ventana o puerta…"
                        />
                    </PanelCard>
                    <PanelCard title="Objetos arquitectónicos">
                        <div className="max-h-[50vh] overflow-y-auto pr-0.5">
                            <CatalogPanel
                                filterCategory="architecture"
                                filterMaterial={
                                    material !== 'Todos' ? material : undefined
                                }
                                search={search}
                            />
                        </div>
                    </PanelCard>
                </>
            )}
        </>
    );
};

/* ── Luz Panel ────────────────────────────────────────────────────────────── */
