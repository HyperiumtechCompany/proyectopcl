import { AppWindow, DoorOpen, Move, Target, Umbrella } from 'lucide-react';
import React from 'react';
import { findGlazingPresetByValue, GLAZING_PRESETS } from '@/pages/dialux/hooks/glazingData';
import type { Canopy, Door, Window } from '@/pages/dialux/hooks/useEditorStore';
import { EditField, PropField, SectionWrapper, SelectField } from './PropertyFields';

const GLAZING_UNSET = 'unset';
const GLAZING_CUSTOM = 'custom';

const GLAZING_SELECT_OPTIONS = [
    { value: GLAZING_UNSET, label: 'Sin asignar' },
    ...GLAZING_PRESETS.map((preset) => ({ value: preset.id, label: preset.label })),
    { value: GLAZING_CUSTOM, label: 'Personalizado' },
];

/**
 * Selector de vidrio (Fase 17: "Luz natural" — Daylight Factor). Escribe
 * directamente `window.glazingTransmittance`, el campo que
 * `daylightFactorEngine.ts` ya sabe leer — sin asignar, la ventana no aporta
 * luz natural (nunca se inventa un valor por defecto, mismo criterio que la
 * biblioteca de materiales de la Fase 16).
 */
function WindowGlazingField({ win, onUpdate }: { win: Window; onUpdate: (patch: Partial<Omit<Window, 'id'>>) => void }) {
    const transmittance = win.glazingTransmittance ?? null;
    const matchedPreset = findGlazingPresetByValue(transmittance);
    const selectValue = transmittance === null ? GLAZING_UNSET : (matchedPreset?.id ?? GLAZING_CUSTOM);

    return (
        <>
            <SelectField
                label="Vidrio"
                value={selectValue}
                options={GLAZING_SELECT_OPTIONS}
                onChange={(next) => {
                    if (next === GLAZING_UNSET) {
                        onUpdate({ glazingTransmittance: null });
                    } else if (next === GLAZING_CUSTOM) {
                        onUpdate({ glazingTransmittance: transmittance ?? 0.8 });
                    } else {
                        const preset = GLAZING_PRESETS.find((p) => p.id === next);
                        onUpdate({ glazingTransmittance: preset?.transmittance ?? null });
                    }
                }}
            />
            {selectValue === GLAZING_CUSTOM && (
                <EditField
                    label="Transmitancia (%)"
                    value={Math.round((transmittance ?? 0) * 100)}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(percent) => onUpdate({ glazingTransmittance: Math.min(1, Math.max(0, percent / 100)) })}
                />
            )}
        </>
    );
}

export const WindowProps: React.FC<{
    win: Window;
    onUpdate: (patch: Partial<Omit<Window, 'id'>>) => void;
    onCenter: () => void;
}> = ({ win, onUpdate, onCenter }) => (
    <SectionWrapper
        icon={<AppWindow size={12} className="text-sky-400" />}
        label="Ventana"
    >
        <div className="mb-2 flex items-start gap-2 rounded border border-sky-700/50 bg-sky-900/20 p-2">
            <Move size={14} className="mt-0.5 flex-shrink-0 text-sky-400" />
            <p className="text-[9px] text-sky-300">
                Selecciona esta ventana en el canvas y arrastrala para moverla
                sobre su pared.
            </p>
        </div>

        <EditField
            label="Ancho (m)"
            value={win.width}
            min={0.3}
            max={5}
            step={0.1}
            onChange={(value) => onUpdate({ width: value })}
        />
        <EditField
            label="Alto (m)"
            value={win.height}
            min={0.3}
            max={3}
            step={0.1}
            onChange={(value) => onUpdate({ height: value })}
        />
        <EditField
            label="Antepecho (m)"
            value={win.sillHeight}
            min={0}
            max={2}
            step={0.05}
            onChange={(value) => onUpdate({ sillHeight: value })}
        />
        <EditField
            label="Offset en muro (m)"
            value={win.offsetAlongWall}
            min={0}
            max={20}
            step={0.1}
            onChange={(value) => onUpdate({ offsetAlongWall: value })}
        />
        <SelectField
            label="Tipo"
            value={win.windowType ?? 'fixed'}
            options={[
                { value: 'fixed', label: 'Fija' },
                { value: 'sliding', label: 'Corrediza' },
                { value: 'casement', label: 'Batiente' },
                { value: 'awning', label: 'Proyectable' },
                { value: 'bathroom', label: 'Baño' },
            ]}
            onChange={(value) =>
                onUpdate({ windowType: value as Window['windowType'] })
            }
        />
        <button
            type="button"
            onClick={onCenter}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded border border-sky-700/50 bg-sky-950/40 py-1.5 text-[10px] text-sky-200 transition-colors hover:bg-sky-800/40"
        >
            <Target size={13} />
            Centrar en Pared
        </button>
        <SelectField
            label="Forma"
            value={win.windowShape ?? 'rectangular'}
            options={[
                { value: 'rectangular', label: 'Rectangular' },
                { value: 'arched', label: 'Arco' },
                { value: 'circular', label: 'Circular' },
            ]}
            onChange={(value) =>
                onUpdate({ windowShape: value as Window['windowShape'] })
            }
        />
        <WindowGlazingField win={win} onUpdate={onUpdate} />
        <PropField label="Pared ID" value={win.wallId.slice(0, 12)} />
        <PropField label="ID" value={win.id.slice(0, 12)} />
    </SectionWrapper>
);

export const DoorProps: React.FC<{
    door: Door;
    onUpdate: (patch: Partial<Omit<Door, 'id'>>) => void;
    onCenter: () => void;
}> = ({ door, onUpdate, onCenter }) => (
    <SectionWrapper
        icon={<DoorOpen size={12} className="text-emerald-400" />}
        label="Puerta"
    >
        <div className="mb-2 flex items-start gap-2 rounded border border-emerald-700/50 bg-emerald-900/20 p-2">
            <Move size={14} className="mt-0.5 flex-shrink-0 text-emerald-400" />
            <p className="text-[9px] text-emerald-300">
                Arrastra la puerta en el 2D para ajustar su posición sobre el
                muro.
            </p>
        </div>

        <EditField
            label="Ancho (m)"
            value={door.width}
            min={0.6}
            max={4}
            step={0.1}
            onChange={(value) => onUpdate({ width: value })}
        />
        <EditField
            label="Alto (m)"
            value={door.height}
            min={1.8}
            max={4}
            step={0.1}
            onChange={(value) => onUpdate({ height: value })}
        />
        <EditField
            label="Offset (m)"
            value={door.offsetAlongWall}
            min={0}
            max={20}
            step={0.1}
            onChange={(value) => onUpdate({ offsetAlongWall: value })}
        />

        <button
            type="button"
            onClick={onCenter}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded border border-emerald-700/50 bg-emerald-950/40 py-1.5 text-[10px] text-emerald-200 transition-colors hover:bg-emerald-800/40"
        >
            <Target size={13} />
            Centrar en Pared
        </button>

        <SelectField
            label="Tipo"
            value={door.doorType ?? 'single'}
            options={[
                { value: 'single', label: 'Simple' },
                { value: 'double', label: 'Doble' },
                { value: 'sliding', label: 'Corrediza' },
                { value: 'folding', label: 'Plegable' },
                { value: 'opening', label: 'Vano Abierto' },
            ]}
            onChange={(value) => onUpdate({ doorType: value as any })}
        />

        {/* ── Controles de apertura ── */}
        <div className="my-2 space-y-1.5 border-t border-gray-800/60 pt-2">
            <p className="text-[9px] font-semibold tracking-wider text-emerald-400/80 uppercase">
                Apertura
            </p>

            {/* Dirección: inward / outward */}
            <div className="flex items-center justify-between gap-2 border-b border-gray-800/40 pb-1.5">
                <span className="text-[10px] text-gray-500">Dirección</span>
                <div className="flex gap-1">
                    {(['inward', 'outward'] as const).map((dir) => (
                        <button
                            key={dir}
                            type="button"
                            onClick={() => onUpdate({ openingDirection: dir })}
                            className={`rounded px-2 py-0.5 text-[9px] transition-colors ${
                                (door.openingDirection ?? 'inward') === dir
                                    ? 'bg-emerald-700/60 text-emerald-200 ring-1 ring-emerald-500/40'
                                    : 'bg-gray-800/60 text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            {dir === 'inward' ? '→ Adentro' : '← Afuera'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Bisagra: left / right */}
            <div className="flex items-center justify-between gap-2 border-b border-gray-800/40 pb-1.5">
                <span className="text-[10px] text-gray-500">Bisagra</span>
                <div className="flex gap-1">
                    {(['left', 'right'] as const).map((side) => (
                        <button
                            key={side}
                            type="button"
                            onClick={() => onUpdate({ hingeDirection: side })}
                            className={`rounded px-2 py-0.5 text-[9px] transition-colors ${
                                (door.hingeDirection ?? 'left') === side
                                    ? 'bg-emerald-700/60 text-emerald-200 ring-1 ring-emerald-500/40'
                                    : 'bg-gray-800/60 text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            {side === 'left' ? '⊢ Izq.' : 'Der. ⊣'}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        <PropField label="ID" value={door.id.slice(0, 12)} />
    </SectionWrapper>
);

export const CanopyProps: React.FC<{
    canopy: Canopy;
    onUpdate: (patch: Partial<Omit<Canopy, 'id'>>) => void;
}> = ({ canopy, onUpdate }) => {
    const dx = canopy.x2 - canopy.x1;
    const dy = canopy.y2 - canopy.y1;
    const depth = Math.hypot(dx, dy);

    return (
        <SectionWrapper
            icon={<Umbrella size={12} className="text-amber-400" />}
            label="Voladizo"
        >
            <PropField label="Profundidad" value={`${depth.toFixed(2)} m`} />
            <EditField
                label="Anchura (m)"
                value={canopy.width}
                min={0.2}
                max={10}
                step={0.1}
                onChange={(value) => onUpdate({ width: value })}
            />
            <EditField
                label="Grosor losa (m)"
                value={canopy.slabThickness}
                min={0.05}
                max={0.5}
                step={0.05}
                onChange={(value) => onUpdate({ slabThickness: value })}
            />
            <EditField
                label="X1 (m)"
                value={canopy.x1}
                min={-50}
                max={50}
                step={0.1}
                onChange={(value) => onUpdate({ x1: value })}
            />
            <EditField
                label="Y1 (m)"
                value={canopy.y1}
                min={-50}
                max={50}
                step={0.1}
                onChange={(value) => onUpdate({ y1: value })}
            />
            <EditField
                label="X2 (m)"
                value={canopy.x2}
                min={-50}
                max={50}
                step={0.1}
                onChange={(value) => onUpdate({ x2: value })}
            />
            <EditField
                label="Y2 (m)"
                value={canopy.y2}
                min={-50}
                max={50}
                step={0.1}
                onChange={(value) => onUpdate({ y2: value })}
            />
            <EditField
                label="Z (m)"
                value={canopy.height}
                min={0}
                max={10}
                step={0.1}
                onChange={(value) => onUpdate({ height: value })}
            />
            <PropField label="ID" value={canopy.id.slice(0, 12)} />
        </SectionWrapper>
    );
};
