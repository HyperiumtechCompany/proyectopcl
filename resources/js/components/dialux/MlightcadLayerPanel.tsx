import { Layers, Eye, EyeOff, X } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useMlightcadEngine } from '@/hooks/dialux/useMlightcadEngine';

interface LayerInfo {
    name: string;
    color: string;
    isVisible: boolean;
    isLocked: boolean;
    entityCount?: number;
}

/**
 * MlightcadLayerPanel — Panel de capas integrado con el motor mlightcad.
 * Muestra y controla las capas del DXF/DWG + las capas de DIAlux.
 */
export const MlightcadLayerPanel: React.FC = () => {
    const engine = useMlightcadEngine();
    const [isOpen, setIsOpen] = useState(false);
    const [layers, setLayers] = useState<LayerInfo[]>([]);

    // Extraer capas del documento activo cuando cambia
    useEffect(() => {
        if (!engine.activeDoc) {
            setLayers([]);
            return;
        }

        // Intentar obtener las capas del documento
        try {
            const doc = engine.activeDoc as any;
            const layerTable = doc?.database?.layerTable ?? doc?.db?.layerTable ?? null;

            if (layerTable) {
                const layerList: LayerInfo[] = [];
                // Iterar la tabla de capas
                layerTable.forEach?.((layer: any) => {
                    const name = layer?.name ?? layer?.dxfName ?? 'Unknown';
                    if (name === undefined) return;
                    const color = layer?.color?.rgb
                        ? `#${layer.color.rgb.toString(16).padStart(6, '0')}`
                        : '#60a5fa';
                    layerList.push({
                        name: String(name),
                        color,
                        isVisible: layer?.isOff === false || layer?.isOff === undefined,
                        isLocked: layer?.isLocked ?? false,
                    });
                });
                setLayers(layerList.slice(0, 100)); // Máximo 100 capas mostradas
            } else {
                // Fallback: mostrar capas básicas
                setLayers([
                    { name: '0',        color: '#94a3b8', isVisible: true, isLocked: false },
                    { name: 'DIAlux',   color: '#60a5fa', isVisible: true, isLocked: false },
                ]);
            }
        } catch {
            setLayers([
                { name: '0',      color: '#94a3b8', isVisible: true, isLocked: false },
                { name: 'DIAlux', color: '#60a5fa', isVisible: true, isLocked: false },
            ]);
        }
    }, [engine.activeDoc]);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                title="Gestor de capas (CAD)"
                className="absolute bottom-16 left-3 z-30 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-900/90 border border-slate-700/60 text-slate-400 hover:text-cyan-300 hover:border-cyan-700/60 transition-all shadow-lg backdrop-blur-sm"
            >
                <Layers size={14} />
            </button>
        );
    }

    return (
        <div className="absolute bottom-16 left-3 z-40 w-64 max-h-80 flex flex-col bg-slate-900/95 backdrop-blur border border-slate-700/70 rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/60 shrink-0">
                <div className="flex items-center gap-2">
                    <Layers size={12} className="text-cyan-500" />
                    <span className="text-[11px] font-semibold text-slate-200 tracking-wide">Capas CAD</span>
                    {layers.length > 0 && (
                        <span className="text-[9px] text-slate-500 font-mono">({layers.length})</span>
                    )}
                </div>
                <button onClick={() => setIsOpen(false)}
                    className="text-slate-600 hover:text-slate-300 transition-colors p-0.5 rounded">
                    <X size={12} />
                </button>
            </div>

            {/* Lista de capas */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700">
                {layers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 gap-2 text-center px-4">
                        <Layers size={20} className="text-slate-700" />
                        <p className="text-[10px] text-slate-600">
                            Importa un archivo DXF/DWG para ver sus capas
                        </p>
                    </div>
                ) : (
                    layers.map((layer, idx) => (
                        <div key={`${layer.name}-${idx}`}
                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800/50 transition-colors group">
                            {/* Color swatch */}
                            <div
                                className="w-3 h-3 rounded-sm shrink-0 border border-white/10"
                                style={{ backgroundColor: layer.color }}
                            />
                            {/* Nombre */}
                            <span className={`flex-1 text-[11px] font-mono truncate ${
                                layer.isVisible ? 'text-slate-300' : 'text-slate-600 line-through'
                            }`}>
                                {layer.name}
                            </span>
                            {/* Toggle visibilidad */}
                            <button
                                onClick={() => {
                                    setLayers(ls => ls.map((l, i) =>
                                        i === idx ? { ...l, isVisible: !l.isVisible } : l
                                    ));
                                    // Intentar togglear en el motor
                                    try {
                                        const doc = (engine.activeDoc as any);
                                        const lt  = doc?.database?.layerTable ?? doc?.db?.layerTable;
                                        if (lt) {
                                            const l = lt.get?.(layer.name);
                                            if (l) l.isOff = layer.isVisible;
                                            engine.sendCommand('regen');
                                        }
                                    } catch {/* ok */}
                                }}
                                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 transition-all p-0.5 rounded"
                                title={layer.isVisible ? 'Ocultar capa' : 'Mostrar capa'}
                            >
                                {layer.isVisible
                                    ? <Eye size={11} />
                                    : <EyeOff size={11} className="text-slate-700" />
                                }
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Footer */}
            {engine.activeDoc && (
                <div className="px-3 py-1.5 border-t border-slate-800/60 shrink-0">
                    <p className="text-[9px] text-slate-600 font-mono truncate">
                        {engine.fileName}
                    </p>
                </div>
            )}
        </div>
    );
};
