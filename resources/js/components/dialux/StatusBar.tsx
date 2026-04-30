import React, { memo } from 'react';
import { useEditorStore } from '@/hooks/dialux/useEditorStore';

/**
 * StatusBar — Barra de estado inferior del editor DIAlux
 * Muestra: zoom, escala, resultado rápido de Ē y Uo
 */
export const StatusBar = memo(function StatusBar() {
    const zoom       = useEditorStore(s => s.ui.zoom);
    const result     = useEditorStore(s => s.result);
    const roomCount  = useEditorStore(s => s.activeScene()?.rooms.length ?? 0);
    const fixCount   = useEditorStore(s => s.activeScene()?.fixtures.length ?? 0);

    return (
        <footer
            id="dialux-statusbar"
            className="h-6 px-4 bg-[#0e1015] border-t border-gray-800/60 flex items-center gap-4 text-[10px] text-gray-600 shrink-0 select-none"
        >
            <span>Zoom: <span className="text-gray-500">{(zoom * 100).toFixed(0)}%</span></span>
            <span>Escala: <span className="text-gray-500">1 m = 60 px</span></span>
            <span>
                <span className="text-gray-500">{roomCount}</span> recintos ·{' '}
                <span className="text-gray-500">{fixCount}</span> luminarias
            </span>
            {result && (
                <span className="text-green-700 font-mono">
                    Ē = {result.avg_lux.toFixed(0)} lux · Uo = {result.uniformity.toFixed(2)} · UGR = {result.ugr.toFixed(1)}
                </span>
            )}
            <div className="flex-1" />
            <span className="text-gray-700">Motor JS · Babylon.js ready</span>
        </footer>
    );
});
