import {
    AppWindow,
    Building2,
    DoorOpen,
    Layers,
    Minus,
    Square,
    Triangle,
    Umbrella,
} from 'lucide-react';
import React, { useState } from 'react';
import type {
    AngleSnapMode,
    DrawTool,
} from '@/pages/dialux/hooks/useEditorStore';
import { CatalogPanel } from '../../CatalogPanel';
import {
    WINDOW_MATERIALS,
    type WindowMaterial,
} from '../../constants';
import {
    AngleSnapBlock,
    ChipFilter,
    SearchInput,
} from '../panelControls';
import {
    PanelCard,
    PanelTabs,
    PanelToolBtn,
} from '../primitives';

type ConstructionTab = 'spaces' | 'walls' | 'openings' | 'help';
type WallType = 'interior' | 'exterior' | 'cerco';
type RoomType = 'room' | 'ambient';

const SPACE_TOOLS: Array<{
    tool: DrawTool;
    icon: React.ReactNode;
    tip: string;
    sublabel?: string;
}> = [
    {
        tool: 'room',
        icon: <Square size={13} />,
        tip: 'Recinto poligonal (R)',
        sublabel: 'Poligono del recinto',
    },
    {
        tool: 'corridor',
        icon: <Layers size={13} />,
        tip: 'Pasadizo',
        sublabel: 'Poligono techo reflejado',
    },
    {
        tool: 'stair',
        icon: <Triangle size={13} />,
        tip: 'Escalera (E)',
        sublabel: 'Caja de escalera',
    },
];

const WALL_TOOLS: Array<{
    tool: DrawTool;
    icon: React.ReactNode;
    tip: string;
    sublabel?: string;
}> = [
    {
        tool: 'wall',
        icon: <Minus size={13} />,
        tip: 'Pared (W)',
        sublabel: 'Polilinea de pared',
    },
    {
        tool: 'education-wall',
        icon: <Building2 size={13} />,
        tip: 'Muro colegio',
        sublabel: 'Ingresos y salidas',
    },
];

const OPENING_TOOLS: Array<{
    tool: DrawTool;
    icon: React.ReactNode;
    tip: string;
    sublabel?: string;
}> = [
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
        sublabel: 'Proteccion solar',
    },
];

const WALL_TYPE_OPTIONS: Array<{
    value: WallType;
    label: string;
    color: string;
}> = [
    { value: 'interior', label: 'Interior', color: 'text-slate-300' },
    { value: 'exterior', label: 'Exterior', color: 'text-blue-400' },
    { value: 'cerco', label: 'Cerco', color: 'text-amber-400' },
];

const ROOM_TYPE_OPTIONS: Array<{
    value: RoomType;
    label: string;
    color: string;
    hint: string;
}> = [
    {
        value: 'room',
        label: 'Recinto',
        color: 'text-cyan-400',
        hint: 'Envolvente exterior - sin iluminacion',
    },
    {
        value: 'ambient',
        label: 'Ambiente',
        color: 'text-emerald-400',
        hint: 'Espacio interior - con normativa y focos',
    },
];

export const ConstruccionPanel: React.FC<{
    activeTool: DrawTool;
    onSetTool: (t: DrawTool) => void;
    angleSnapMode: AngleSnapMode;
    onSetAngleSnap: (v: AngleSnapMode) => void;
    wallTypeTemplate: WallType;
    onSetWallType: (t: WallType) => void;
    roomTypeTemplate: RoomType;
    onSetRoomType: (t: RoomType) => void;
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
    const [activeTab, setActiveTab] = useState<ConstructionTab>('spaces');
    const [spaceSearch, setSpaceSearch] = useState('');
    const [openingSearch, setOpeningSearch] = useState('');
    const [material, setMaterial] = useState<WindowMaterial>('Todos');

    const renderToolGrid = (
        tools: Array<{
            tool: DrawTool;
            icon: React.ReactNode;
            tip: string;
            sublabel?: string;
        }>,
    ) => (
        <div className="grid grid-cols-2 gap-1">
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

    return (
        <>
            <PanelTabs
                tabs={[
                    { id: 'spaces', label: 'Espacios' },
                    { id: 'walls', label: 'Muros' },
                    { id: 'openings', label: 'Abert.' },
                    { id: 'help', label: 'Ayuda' },
                ]}
                activeTab={activeTab}
                onChange={setActiveTab}
            />

            {activeTab === 'spaces' && (
                <>
                    <PanelCard title="Espacios" tone="accent">
                        {renderToolGrid(SPACE_TOOLS)}
                    </PanelCard>
                    <PanelCard title="Tipo de espacio">
                        <div className="grid grid-cols-2 gap-1">
                            {ROOM_TYPE_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    title={opt.hint}
                                    onClick={() => onSetRoomType(opt.value)}
                                    className={`rounded border px-2 py-1.5 text-[10px] font-semibold transition-colors ${
                                        roomTypeTemplate === opt.value
                                            ? `border-gray-500 bg-gray-700 ${opt.color}`
                                            : 'border-gray-700/50 bg-gray-900/50 text-gray-500 hover:bg-gray-800 hover:text-gray-300'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <p className="mt-2 text-[9.5px] leading-snug text-gray-600">
                            {roomTypeTemplate === 'room'
                                ? 'Recinto: solo geometria constructiva.'
                                : 'Ambiente: participa en normativa e iluminacion.'}
                        </p>
                    </PanelCard>
                    <PanelCard title="Catalogo de pasadizos">
                        <SearchInput
                            value={spaceSearch}
                            onChange={setSpaceSearch}
                            placeholder="Buscar pasadizo..."
                        />
                        <div className="mt-2 max-h-52 overflow-y-auto pr-0.5">
                            <CatalogPanel
                                filterCategory="corridors"
                                search={spaceSearch}
                            />
                        </div>
                    </PanelCard>
                </>
            )}

            {activeTab === 'walls' && (
                <>
                    <PanelCard title="Muros" tone="accent">
                        {renderToolGrid(WALL_TOOLS)}
                    </PanelCard>
                    <PanelCard title="Tipo de muro">
                        <div className="grid grid-cols-3 gap-1">
                            {WALL_TYPE_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => onSetWallType(opt.value)}
                                    className={`rounded border px-2 py-1.5 text-[9px] font-semibold transition-colors ${
                                        wallTypeTemplate === opt.value
                                            ? `border-gray-500 bg-gray-700 ${opt.color}`
                                            : 'border-gray-700/50 bg-gray-900/50 text-gray-500 hover:bg-gray-800 hover:text-gray-300'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </PanelCard>
                </>
            )}

            {activeTab === 'openings' && (
                <>
                    <PanelCard title="Aberturas y cubierta" tone="accent">
                        {renderToolGrid(OPENING_TOOLS)}
                    </PanelCard>
                    <PanelCard title="Catalogo de aberturas">
                        <ChipFilter
                            options={WINDOW_MATERIALS}
                            active={material}
                            onChange={setMaterial}
                        />
                        <SearchInput
                            value={openingSearch}
                            onChange={setOpeningSearch}
                            placeholder="Buscar ventana o puerta..."
                        />
                    </PanelCard>
                    <PanelCard title="Ventanas">
                        <div className="max-h-52 overflow-y-auto pr-0.5">
                            <CatalogPanel
                                filterCategory="windows"
                                filterMaterial={
                                    material !== 'Todos' ? material : undefined
                                }
                                search={openingSearch}
                            />
                        </div>
                    </PanelCard>
                    <PanelCard title="Puertas">
                        <div className="max-h-52 overflow-y-auto pr-0.5">
                            <CatalogPanel
                                filterCategory="doors"
                                search={openingSearch}
                            />
                        </div>
                    </PanelCard>
                </>
            )}

            {activeTab === 'help' && (
                <>
                    <AngleSnapBlock
                        mode={angleSnapMode}
                        onChange={onSetAngleSnap}
                    />
                    <PanelCard title="Flujo recomendado">
                        <ol className="list-none space-y-1.5 text-[10px] leading-relaxed text-gray-400">
                            {[
                                'Dibuja recintos o muros.',
                                'Inserta ventanas, puertas y voladizos.',
                                'Usa cada catalogo dentro de su seccion.',
                            ].map((text, index) => (
                                <li key={text} className="flex gap-2">
                                    <span className="shrink-0 font-mono text-cyan-700">
                                        {index + 1}.
                                    </span>
                                    {text}
                                </li>
                            ))}
                        </ol>
                    </PanelCard>
                </>
            )}
        </>
    );
};
