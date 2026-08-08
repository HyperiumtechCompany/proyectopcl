/**
 * DynamicInputOverlay.tsx - Input dinamico estilo AutoCAD (distancia + angulo)
 * mientras se traza un recinto/muro. Complementa el badge de solo-lectura de
 * OverlayPreviews: aqui los mismos dos valores son editables. Escribir un
 * numero exacto evita depender del snap angular para formas irregulares
 * (terrenos con angulos peculiares que no caen en ningun preset).
 */

import React, { useEffect, useRef, useState } from 'react';

interface Props {
    visible: boolean;
    /** Punto de anclaje en pantalla (px), normalmente el preview point actual. */
    anchorScreen: { x: number; y: number } | null;
    liveDistanceM: number;
    liveAngleDeg: number;
    onCommit: (distanceM: number, angleDeg: number) => void;
}

export const DynamicInputOverlay: React.FC<Props> = ({
    visible,
    anchorScreen,
    liveDistanceM,
    liveAngleDeg,
    onCommit,
}) => {
    const [distanceText, setDistanceText] = useState('');
    const [angleText, setAngleText] = useState('');
    const distanceRef = useRef<HTMLInputElement>(null);
    const angleRef = useRef<HTMLInputElement>(null);

    // Sigue el valor en vivo (mouse) mientras el campo no tenga foco. En
    // cuanto el usuario hace click/Tab al campo, deja de seguir el mouse y
    // el numero queda bajo su control hasta Enter o Escape.
    useEffect(() => {
        if (document.activeElement !== distanceRef.current) {
            setDistanceText(liveDistanceM.toFixed(2));
        }
    }, [liveDistanceM]);

    useEffect(() => {
        if (document.activeElement !== angleRef.current) {
            setAngleText(String(Math.round(liveAngleDeg)));
        }
    }, [liveAngleDeg]);

    if (!visible || !anchorScreen) return null;

    const commit = () => {
        const d = parseFloat(distanceText.replace(',', '.'));
        const a = parseFloat(angleText.replace(',', '.'));
        if (!Number.isFinite(d) || d <= 0) return;
        onCommit(d, Number.isFinite(a) ? a : liveAngleDeg);
        distanceRef.current?.blur();
        angleRef.current?.blur();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
        }
    };

    return (
        <div
            className="pointer-events-none absolute z-20"
            style={{ left: anchorScreen.x + 14, top: anchorScreen.y + 14 }}
        >
            <div className="pointer-events-auto flex items-center gap-1 rounded-md border border-slate-600 bg-slate-800/95 px-2 py-1 shadow-lg">
                <input
                    ref={distanceRef}
                    type="text"
                    inputMode="decimal"
                    value={distanceText}
                    onChange={(e) => setDistanceText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-16 bg-transparent font-mono text-[11px] font-bold text-sky-300 outline-none"
                />
                <span className="text-[10px] text-slate-500">m</span>
                <span className="text-slate-600">·</span>
                <input
                    ref={angleRef}
                    type="text"
                    inputMode="decimal"
                    value={angleText}
                    onChange={(e) => setAngleText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-12 bg-transparent font-mono text-[11px] font-bold text-sky-300 outline-none"
                />
                <span className="text-[10px] text-slate-500">°</span>
            </div>
        </div>
    );
};
