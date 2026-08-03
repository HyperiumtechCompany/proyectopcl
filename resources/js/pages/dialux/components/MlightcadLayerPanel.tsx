import { Eye, EyeOff, Layers, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useMlightcadEngine } from '@/pages/dialux/hooks/useMlightcadEngine';

interface LayerInfo {
    name: string;
    color: string;
    isVisible: boolean;
}

function resolveLayerTable(document: any): any {
    return document?.database?.tables?.layerTable
        ?? document?.database?.layerTable
        ?? document?.db?.tables?.layerTable
        ?? document?.db?.layerTable
        ?? null;
}

function readLayers(layerTable: any): LayerInfo[] {
    if (!layerTable) return [];
    const result: LayerInfo[] = [];
    const append = (layer: any) => {
        const name = layer?.name ?? layer?.dxfName;
        if (name == null) return;
        const rgb = layer?.color?.rgb;
        result.push({
            name: String(name),
            color: typeof rgb === 'number' ? `#${rgb.toString(16).padStart(6, '0').slice(-6)}` : '#60a5fa',
            isVisible: layer?.isOff !== true,
        });
    };

    if (typeof layerTable.newIterator === 'function') {
        Array.from(layerTable.newIterator()).forEach(append);
    } else if (typeof layerTable.forEach === 'function') {
        layerTable.forEach(append);
    }
    return result.slice(0, 100);
}

/** Controla únicamente las capas nativas del archivo DXF/DWG. */
export const MlightcadLayerPanel: React.FC = () => {
    const engine = useMlightcadEngine();
    const [isOpen, setIsOpen] = useState(false);
    const [layers, setLayers] = useState<LayerInfo[]>([]);

    useEffect(() => {
        setLayers(readLayers(resolveLayerTable(engine.activeDoc)));
    }, [engine.activeDoc]);

    const toggleLayer = (index: number) => {
        const selected = layers[index];
        const nextVisible = !selected.isVisible;
        try {
            const table = resolveLayerTable(engine.activeDoc);
            const record = table?.getAt?.(selected.name) ?? table?.get?.(selected.name);
            if (record) record.isOff = !nextVisible;
            engine.sendCommand('regen');
        } finally {
            setLayers((current) => current.map((layer, currentIndex) =>
                currentIndex === index ? { ...layer, isVisible: nextVisible } : layer,
            ));
        }
    };

    if (!isOpen) {
        return (
            <button type="button" onClick={() => setIsOpen(true)} title="Capas nativas del archivo CAD" className="absolute bottom-16 left-3 z-30 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/90 text-slate-400 shadow-lg backdrop-blur-sm transition-all hover:border-cyan-700/60 hover:text-cyan-300">
                <Layers size={14} />
            </button>
        );
    }

    return (
        <div className="absolute bottom-16 left-3 z-40 flex max-h-80 w-64 flex-col overflow-hidden rounded-xl border border-slate-700/70 bg-slate-900/95 shadow-2xl backdrop-blur">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-800/60 px-3 py-2">
                <div className="flex items-center gap-2">
                    <Layers size={12} className="text-cyan-500" />
                    <span className="text-[11px] font-semibold tracking-wide text-slate-200">Capas del archivo CAD</span>
                    <span className="font-mono text-[9px] text-slate-500">({layers.length})</span>
                </div>
                <button type="button" onClick={() => setIsOpen(false)} className="rounded p-0.5 text-slate-600 transition-colors hover:text-slate-300"><X size={12} /></button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {layers.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                        <Layers size={20} className="text-slate-700" />
                        <p className="text-[10px] text-slate-600">El archivo no expone capas editables.</p>
                    </div>
                ) : layers.map((layer, index) => (
                    <button key={`${layer.name}-${index}`} type="button" onClick={() => toggleLayer(index)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-slate-800/50">
                        <span className="h-3 w-3 shrink-0 rounded-sm border border-white/10" style={{ backgroundColor: layer.color }} />
                        <span className={`min-w-0 flex-1 truncate font-mono text-[11px] ${layer.isVisible ? 'text-slate-300' : 'text-slate-600 line-through'}`}>{layer.name}</span>
                        {layer.isVisible ? <Eye size={11} className="text-slate-500" /> : <EyeOff size={11} className="text-slate-700" />}
                    </button>
                ))}
            </div>

            {engine.activeDoc && <div className="shrink-0 border-t border-slate-800/60 px-3 py-1.5"><p className="truncate font-mono text-[9px] text-slate-600">{engine.fileName}</p></div>}
        </div>
    );
};
