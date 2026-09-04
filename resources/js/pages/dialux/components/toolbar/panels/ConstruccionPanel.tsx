import {
    AppWindow,
    Box,
    Building2,
    DoorOpen,
    Layers,
    Minus,
    Square,
    SquareDashed,
    Triangle,
    Umbrella,
} from 'lucide-react';
import React, { useState } from 'react';
import type {
    AngleSnapMode,
    DrawTool,
} from '@/pages/dialux/hooks/useEditorStore';
import { CatalogPanel } from '../../CatalogPanel';
import { WINDOW_MATERIALS, type WindowMaterial } from '../../constants';
import { AngleSnapBlock, ChipFilter, SearchInput } from '../panelControls';
import {
    PanelCard,
    PanelSubTabs,
    PanelTabs,
    PanelToolBtn,
} from '../primitives';

type ConstructionTab = 'spaces' | 'walls' | 'openings' | 'structure';
type SpaceTab = 'draw' | 'catalog' | 'precision';
type WallTab = 'draw' | 'settings' | 'precision';
type OpeningTab = 'windows' | 'doors' | 'canopies';
type StructureTab = 'draw' | 'precision' | 'help';
type WallType = 'interior' | 'exterior' | 'cerco';
type RoomType = 'room' | 'ambient';

interface ConstructionTool {
    tool: DrawTool;
    icon: React.ReactNode;
    tip: string;
    sublabel?: string;
}

const SPACE_TOOLS: ConstructionTool[] = [
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
        sublabel: 'Polígono de circulación',
    },
];
const WALL_TOOLS: ConstructionTool[] = [
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
    {
        tool: 'partition',
        icon: <SquareDashed size={13} />,
        tip: 'Tabique / separador',
        sublabel: 'SS.HH., duchas y divisiones',
    },
];
const OPENING_TOOLS: Record<OpeningTab, ConstructionTool[]> = {
    windows: [
        {
            tool: 'window',
            icon: <AppWindow size={13} />,
            tip: 'Ventana (N)',
            sublabel: 'En pared existente',
        },
    ],
    doors: [
        {
            tool: 'door',
            icon: <DoorOpen size={13} />,
            tip: 'Puerta (D)',
            sublabel: 'Entrada o salida',
        },
    ],
    canopies: [
        {
            tool: 'canopy',
            icon: <Umbrella size={13} />,
            tip: 'Voladizo (C)',
            sublabel: 'Protección solar',
        },
    ],
};
const STRUCTURE_TOOLS: ConstructionTool[] = [
    {
        tool: 'stair',
        icon: <Triangle size={13} />,
        tip: 'Escalera (E)',
        sublabel: 'Caja de escalera',
    },
    {
        tool: 'ramp',
        icon: <Triangle size={13} className="rotate-90" />,
        tip: 'Rampa',
        sublabel: 'Recta o helicoidal entre pisos',
    },
    {
        tool: 'structural-obstacle',
        icon: <Box size={13} />,
        tip: 'Estructura / techo / rampa',
        sublabel: 'Dibuja el contorno y define su tipo',
    },
];
const WALL_TYPES: Array<{ value: WallType; label: string; color: string }> = [
    {
        value: 'interior',
        label: 'Interior',
        color: 'text-slate-700 dark:text-slate-300',
    },
    {
        value: 'exterior',
        label: 'Exterior',
        color: 'text-blue-600 dark:text-blue-300',
    },
    {
        value: 'cerco',
        label: 'Cerco',
        color: 'text-amber-600 dark:text-amber-300',
    },
];
const ROOM_TYPES: Array<{
    value: RoomType;
    label: string;
    color: string;
    hint: string;
}> = [
    {
        value: 'room',
        label: 'Recinto',
        color: 'text-cyan-700 dark:text-cyan-300',
        hint: 'Envolvente exterior sin iluminación',
    },
    {
        value: 'ambient',
        label: 'Ambiente',
        color: 'text-emerald-700 dark:text-emerald-300',
        hint: 'Espacio interior con normativa y luminarias',
    },
];

const ToolGrid = ({
    tools,
    activeTool,
    onSetTool,
}: {
    tools: ConstructionTool[];
    activeTool: DrawTool;
    onSetTool: (tool: DrawTool) => void;
}) => (
    <div className="grid grid-cols-1 gap-1 min-[300px]:grid-cols-2">
        {tools.map((tool) => (
            <PanelToolBtn
                key={tool.tool}
                {...tool}
                active={activeTool}
                onSet={onSetTool}
            />
        ))}
    </div>
);

interface ConstruccionPanelProps {
    activeTool: DrawTool;
    onSetTool: (tool: DrawTool) => void;
    angleSnapMode: AngleSnapMode;
    onSetAngleSnap: (mode: AngleSnapMode) => void;
    wallTypeTemplate: WallType;
    onSetWallType: (type: WallType) => void;
    roomTypeTemplate: RoomType;
    onSetRoomType: (type: RoomType) => void;
}

export const ConstruccionPanel: React.FC<ConstruccionPanelProps> = ({
    activeTool,
    onSetTool,
    angleSnapMode,
    onSetAngleSnap,
    wallTypeTemplate,
    onSetWallType,
    roomTypeTemplate,
    onSetRoomType,
}) => {
    const [activeTab, setActiveTab] = useState<ConstructionTab>('spaces');
    const [spaceTab, setSpaceTab] = useState<SpaceTab>('draw');
    const [wallTab, setWallTab] = useState<WallTab>('draw');
    const [openingTab, setOpeningTab] = useState<OpeningTab>('windows');
    const [structureTab, setStructureTab] = useState<StructureTab>('draw');
    const [spaceSearch, setSpaceSearch] = useState('');
    const [openingSearch, setOpeningSearch] = useState('');
    const [material, setMaterial] = useState<WindowMaterial>('Todos');

    return (
        <div className="min-w-0">
            <PanelTabs
                tabs={[
                    { id: 'spaces', label: 'Espacios' },
                    { id: 'walls', label: 'Muros' },
                    { id: 'openings', label: 'Abert.' },
                    { id: 'structure', label: 'Estruct.' },
                ]}
                activeTab={activeTab}
                onChange={setActiveTab}
            />

            {activeTab === 'spaces' && (
                <>
                    <PanelSubTabs
                        tabs={[
                            { id: 'draw', label: 'Dibujar' },
                            { id: 'catalog', label: 'Catálogo' },
                            { id: 'precision', label: 'Precisión' },
                        ]}
                        activeTab={spaceTab}
                        onChange={setSpaceTab}
                    />
                    {spaceTab === 'draw' && (
                        <>
                            <PanelCard title="Crear espacio" tone="accent">
                                <ToolGrid
                                    tools={SPACE_TOOLS}
                                    activeTool={activeTool}
                                    onSetTool={onSetTool}
                                />
                            </PanelCard>
                            <PanelCard title="Clasificación">
                                <div className="grid grid-cols-2 gap-1">
                                    {ROOM_TYPES.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            title={option.hint}
                                            onClick={() =>
                                                onSetRoomType(option.value)
                                            }
                                            className={`rounded border px-2 py-1.5 text-[10px] font-semibold transition-colors ${roomTypeTemplate === option.value ? `border-cyan-400/60 bg-cyan-50 dark:border-cyan-700/60 dark:bg-cyan-950/30 ${option.color}` : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-gray-700/50 dark:bg-gray-900/50 dark:text-gray-400 dark:hover:bg-gray-800'}`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-2 text-[9.5px] leading-snug text-slate-500 dark:text-gray-500">
                                    {roomTypeTemplate === 'room'
                                        ? 'Recinto: geometría constructiva exterior.'
                                        : 'Ambiente: espacio interior con normativa e iluminación.'}
                                </p>
                            </PanelCard>
                        </>
                    )}
                    {spaceTab === 'catalog' && (
                        <PanelCard title="Catálogo de pasadizos">
                            <SearchInput
                                value={spaceSearch}
                                onChange={setSpaceSearch}
                                placeholder="Buscar pasadizo..."
                            />
                            <CatalogPanel
                                filterCategory="corridors"
                                search={spaceSearch}
                            />
                        </PanelCard>
                    )}
                    {spaceTab === 'precision' && (
                        <AngleSnapBlock
                            mode={angleSnapMode}
                            onChange={onSetAngleSnap}
                        />
                    )}
                </>
            )}

            {activeTab === 'walls' && (
                <>
                    <PanelSubTabs
                        tabs={[
                            { id: 'draw', label: 'Dibujar' },
                            { id: 'settings', label: 'Tipo' },
                            { id: 'precision', label: 'Precisión' },
                        ]}
                        activeTab={wallTab}
                        onChange={setWallTab}
                    />
                    {wallTab === 'draw' && (
                        <PanelCard title="Crear cerramiento" tone="accent">
                            <ToolGrid
                                tools={WALL_TOOLS}
                                activeTool={activeTool}
                                onSetTool={onSetTool}
                            />
                        </PanelCard>
                    )}
                    {wallTab === 'settings' && (
                        <PanelCard title="Tipo de muro">
                            <div className="grid grid-cols-3 gap-1">
                                {WALL_TYPES.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() =>
                                            onSetWallType(option.value)
                                        }
                                        className={`rounded border px-1.5 py-1.5 text-[9px] font-semibold transition-colors ${wallTypeTemplate === option.value ? `border-cyan-400/60 bg-cyan-50 dark:border-cyan-700/60 dark:bg-cyan-950/30 ${option.color}` : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-gray-700/50 dark:bg-gray-900/50 dark:text-gray-400 dark:hover:bg-gray-800'}`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </PanelCard>
                    )}
                    {wallTab === 'precision' && (
                        <AngleSnapBlock
                            mode={angleSnapMode}
                            onChange={onSetAngleSnap}
                        />
                    )}
                </>
            )}

            {activeTab === 'openings' && (
                <>
                    <PanelSubTabs
                        tabs={[
                            { id: 'windows', label: 'Ventanas' },
                            { id: 'doors', label: 'Puertas' },
                            { id: 'canopies', label: 'Cubiertas' },
                        ]}
                        activeTab={openingTab}
                        onChange={setOpeningTab}
                    />
                    <PanelCard
                        title={
                            openingTab === 'windows'
                                ? 'Insertar ventana'
                                : openingTab === 'doors'
                                  ? 'Insertar puerta'
                                  : 'Insertar cubierta'
                        }
                        tone="accent"
                    >
                        <ToolGrid
                            tools={OPENING_TOOLS[openingTab]}
                            activeTool={activeTool}
                            onSetTool={onSetTool}
                        />
                    </PanelCard>
                    {openingTab !== 'canopies' && (
                        <PanelCard title="Filtrar catálogo">
                            <ChipFilter
                                options={WINDOW_MATERIALS}
                                active={material}
                                onChange={setMaterial}
                            />
                            <SearchInput
                                value={openingSearch}
                                onChange={setOpeningSearch}
                                placeholder="Buscar abertura..."
                            />
                        </PanelCard>
                    )}
                    {openingTab === 'windows' && (
                        <PanelCard title="Ventanas">
                            <CatalogPanel
                                filterCategory="windows"
                                filterMaterial={
                                    material !== 'Todos' ? material : undefined
                                }
                                search={openingSearch}
                            />
                        </PanelCard>
                    )}
                    {openingTab === 'doors' && (
                        <PanelCard title="Puertas">
                            <CatalogPanel
                                filterCategory="doors"
                                search={openingSearch}
                            />
                        </PanelCard>
                    )}
                    {openingTab === 'canopies' && (
                        <PanelCard title="Uso">
                            <p className="text-[10px] leading-relaxed text-slate-500 dark:text-gray-400">
                                Dibuja voladizos y elementos de protección solar
                                sobre la fachada.
                            </p>
                        </PanelCard>
                    )}
                </>
            )}

            {activeTab === 'structure' && (
                <>
                    <PanelSubTabs
                        tabs={[
                            { id: 'draw', label: 'Elementos' },
                            { id: 'precision', label: 'Precisión' },
                            { id: 'help', label: 'Guía' },
                        ]}
                        activeTab={structureTab}
                        onChange={setStructureTab}
                    />
                    {structureTab === 'draw' && (
                        <PanelCard
                            title="Elementos estructurales"
                            tone="accent"
                        >
                            <ToolGrid
                                tools={STRUCTURE_TOOLS}
                                activeTool={activeTool}
                                onSetTool={onSetTool}
                            />
                        </PanelCard>
                    )}
                    {structureTab === 'precision' && (
                        <AngleSnapBlock
                            mode={angleSnapMode}
                            onChange={onSetAngleSnap}
                        />
                    )}
                    {structureTab === 'help' && (
                        <PanelCard title="Flujo recomendado">
                            <ol className="space-y-1.5 text-[10px] leading-relaxed text-slate-500 dark:text-gray-400">
                                {[
                                    'Define primero los espacios y muros.',
                                    'Añade escaleras, techos, rampas u obstáculos.',
                                    'Inserta las aberturas desde su categoría.',
                                ].map((text, index) => (
                                    <li key={text} className="flex gap-2">
                                        <span className="shrink-0 font-mono text-cyan-600 dark:text-cyan-400">
                                            {index + 1}.
                                        </span>
                                        {text}
                                    </li>
                                ))}
                            </ol>
                        </PanelCard>
                    )}
                </>
            )}
        </div>
    );
};
