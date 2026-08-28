import {
    Grid3x3,
    Layers,
    Magnet,
    MapPin,
    Redo2,
    Satellite,
    Undo2,
} from 'lucide-react';
import { useState } from 'react';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import type { UseSiteEditorReturn } from '../hooks/useSiteEditor';
import { GeoSearchPanel } from './GeoSearchPanel';

interface Props {
    editor: UseSiteEditorReturn;
}

export function SiteToolbar({ editor }: Props) {
    const canUndo = useEditorStore((state) => state.historyCanUndo);
    const canRedo = useEditorStore((state) => state.historyCanRedo);
    const undo = useEditorStore((state) => state.undo);
    const redo = useEditorStore((state) => state.redo);
    const [layersOpen, setLayersOpen] = useState(false);
    const [locationOpen, setLocationOpen] = useState(false);
    const location = editor.siteData?.location;

    return (
        <div className="relative flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-[#0d0f14]">
            <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                title="Deshacer"
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 disabled:opacity-30 dark:border-white/10"
            >
                <Undo2 className="h-4 w-4" />
            </button>
            <button
                type="button"
                onClick={redo}
                disabled={!canRedo}
                title="Rehacer"
                className="rounded-lg border border-slate-200 p-1.5 text-slate-500 disabled:opacity-30 dark:border-white/10"
            >
                <Redo2 className="h-4 w-4" />
            </button>
            <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-white/10" />
            <button
                type="button"
                onClick={() => editor.setSnapEnabled(!editor.snapEnabled)}
                title="Ajustar a la cuadrícula"
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-semibold ${
                    editor.snapEnabled
                        ? 'border-cyan-400 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300'
                        : 'border-slate-200 text-slate-500 dark:border-white/10'
                }`}
            >
                <Magnet className="h-3.5 w-3.5" />
                Snap {editor.gridSizeM} m
            </button>
            <div className="flex items-center gap-1 text-[10px] text-slate-500">
                <Grid3x3 className="h-3.5 w-3.5" />
                Cuadrícula {editor.gridSizeM} m
            </div>
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setLocationOpen((current) => !current)}
                    title="Buscar la ubicación del proyecto"
                    className="flex max-w-48 items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300"
                >
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                        {location ? location.displayName : 'Ubicación'}
                    </span>
                </button>
                {locationOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setLocationOpen(false)}
                        />
                        <div className="absolute top-full left-0 z-50 mt-1 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900">
                            <GeoSearchPanel
                                onUseLocation={(selected) => {
                                    editor.setSiteLocation(selected);
                                    setLocationOpen(false);
                                }}
                            />
                        </div>
                    </>
                )}
            </div>
            {location && (
                <button
                    type="button"
                    onClick={() =>
                        editor.setShowSatellite(!editor.showSatellite)
                    }
                    title="Mostrar/ocultar la imagen satelital de fondo"
                    className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-semibold ${
                        editor.showSatellite
                            ? 'border-cyan-400 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300'
                            : 'border-slate-200 text-slate-500 dark:border-white/10'
                    }`}
                >
                    <Satellite className="h-3.5 w-3.5" />
                    Satélite
                </button>
            )}
            {location && editor.showSatellite && (
                <div
                    className="flex items-center rounded-lg border border-slate-200 text-slate-500 dark:border-white/10"
                    title="Zoom de la imagen satelital — bájalo si tu zona no tiene cobertura de alta resolución"
                >
                    <button
                        type="button"
                        onClick={() =>
                            editor.setSatelliteZoom(editor.satelliteZoom - 1)
                        }
                        className="px-2 py-1.5 text-xs font-bold disabled:opacity-30"
                    >
                        −
                    </button>
                    <span className="px-1 text-[10px] font-semibold tabular-nums">
                        z{editor.satelliteZoom}
                    </span>
                    <button
                        type="button"
                        onClick={() =>
                            editor.setSatelliteZoom(editor.satelliteZoom + 1)
                        }
                        className="px-2 py-1.5 text-xs font-bold disabled:opacity-30"
                    >
                        +
                    </button>
                </div>
            )}
            <div className="ml-auto">
                <button
                    type="button"
                    onClick={() => setLayersOpen((current) => !current)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300"
                >
                    <Layers className="h-3.5 w-3.5" />
                    Capas
                </button>
                {layersOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setLayersOpen(false)}
                        />
                        <div className="absolute top-full right-0 z-50 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 text-xs shadow-xl dark:border-white/10 dark:bg-slate-900">
                            {editor.siteData?.layers.map((layer) => (
                                <label
                                    key={layer.id}
                                    className="flex items-center gap-2 px-3 py-1.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
                                >
                                    <input
                                        type="checkbox"
                                        checked={layer.visible}
                                        onChange={() =>
                                            editor.toggleSiteLayer(layer.id)
                                        }
                                    />
                                    {layer.label}
                                </label>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
