import { Plus, Trash2 } from 'lucide-react';
import React, { useMemo } from 'react';
import type { Room, StairConfig, StairFlight } from '@/pages/dialux/hooks/types';
import { getStairPreset, validateStairConfig } from '@/pages/dialux/hooks/stairNorms';
import { EditField, PropField, SelectField } from '../PropertyFields';

/**
 * Extraído de `RoomProps.tsx` (Fase 2, extracción sin cambiar comportamiento)
 * — mismo componente, mismo JSX, solo movido a su propio archivo.
 */

const DEFAULT_STAIR: StairConfig = {
    normativeUse: 'generic',
    orientation: 'north',
    riserHeight: 0.175,
    treadDepth: 0.28,
    stairWidth: 1.2,
    flightGap: 0.4,
    showRailings: false,
    stepCount: 20,
    flights: [
        { id: 'flight-1', stepCount: 10, direction: 'north', hasLanding: true, landingDepth: 1.2 },
        { id: 'flight-2', stepCount: 10, direction: 'south', hasLanding: false, landingDepth: 0 },
    ],
};

const DIRECTION_LABELS: Record<StairFlight['direction'], string> = {
    north: 'Norte ↑',
    south: 'Sur ↓',
    east: 'Este →',
    west: 'Oeste ←',
};

/** Dirección opuesta para U-turn estándar */
const OPPOSITE_DIR: Record<StairFlight['direction'], StairFlight['direction']> = {
    north: 'south', south: 'north', east: 'west', west: 'east',
};

export const StairConfigPanel: React.FC<{
    room: Room;
    onUpdate: (patch: Partial<Omit<Room, 'id'>>) => void;
}> = ({ room, onUpdate }) => {
    const st = room.stairConfig ?? DEFAULT_STAIR;

    // Orientación efectiva: derivada del primer tramo si existen tramos.
    // De este modo NO hay duplicación UI — un solo control de dirección.
    const hasFlights = st.flights.length > 0;
    const effectiveOrientation = hasFlights ? st.flights[0].direction : st.orientation;

    const updateSt = (patch: Partial<StairConfig>) =>
        onUpdate({ stairConfig: { ...st, ...patch } });

    const updateFlight = (index: number, patch: Partial<StairFlight>) => {
        const flights = st.flights.map((f, i) =>
            i === index ? { ...f, ...patch } : f,
        );
        // Si se cambia la dirección del tramo 0, sincronizar con stairConfig.orientation
        const newOrientation = index === 0 && patch.direction
            ? patch.direction
            : st.orientation;
        updateSt({ flights, orientation: newOrientation });
    };

    const addFlight = () => {
        const prevDir = st.flights.length > 0
            ? st.flights[st.flights.length - 1].direction
            : st.orientation;
        const newFlight: StairFlight = {
            id: `flight-${Date.now()}`,
            stepCount: 8,
            // Dirección opuesta al tramo anterior (U-turn típico)
            direction: OPPOSITE_DIR[prevDir],
            hasLanding: false,
            landingDepth: 0,
        };
        // El tramo anterior debe tener descanso para conectar
        const prevFlights = st.flights.length > 0
            ? st.flights.map((f, i) =>
                i === st.flights.length - 1 ? { ...f, hasLanding: true, landingDepth: Math.max(f.landingDepth, 1.2) } : f,
              )
            : st.flights;
        updateSt({ flights: [...prevFlights, newFlight] });
    };

    const removeFlight = (index: number) => {
        const remaining = st.flights.filter((_, i) => i !== index);
        const newOrientation = remaining.length > 0 ? remaining[0].direction : st.orientation;
        updateSt({ flights: remaining, orientation: newOrientation });
    };

    const totalSteps = hasFlights
        ? st.flights.reduce((sum, f) => sum + f.stepCount, 0)
        : st.stepCount;
    const totalHeight = (totalSteps * st.riserHeight).toFixed(2);

    // Validación contra la norma seleccionada en "Uso Normativo" — antes de esto,
    // el selector no tenía ningún efecto sobre las advertencias mostradas
    // (ver planes/plan_cierre_brecha_paridad_dialux_evo.md, hallazgo bloqueante §-9.3).
    const normWarnings = useMemo(
        () => validateStairConfig(st, st.normativeUse),
        [st],
    );

    return (
        <div className="my-2 space-y-1 border-t border-gray-300 dark:border-gray-800/80 pt-2">
            <p className="mb-1.5 text-[10px] font-semibold text-orange-400">
                Configuración de Escalera
            </p>

            <SelectField
                label="Uso Normativo"
                value={st.normativeUse}
                options={[
                    { value: 'education', label: 'A.040 (Educación)' },
                    { value: 'housing', label: 'A.010 (Vivienda)' },
                    { value: 'generic', label: 'Libre' },
                ]}
                onChange={(val) => updateSt({ normativeUse: val as StairConfig['normativeUse'] })}
            />

            {/* Orientación solo para escalera directa (sin tramos).
                Cuando hay tramos, la dirección la define el Tramo 1. */}
            {!hasFlights && (
                <SelectField
                    label="Dirección"
                    value={st.orientation}
                    options={[
                        { value: 'north', label: 'Norte ↑' },
                        { value: 'south', label: 'Sur ↓' },
                        { value: 'east', label: 'Este →' },
                        { value: 'west', label: 'Oeste ←' },
                    ]}
                    onChange={(val) => updateSt({ orientation: val as StairConfig['orientation'] })}
                />
            )}

            <EditField
                label="Contrahuella (m)"
                value={st.riserHeight}
                min={0.1} max={0.25} step={0.005}
                onChange={(val) => updateSt({ riserHeight: val })}
            />
            <EditField
                label="Huella (m)"
                value={st.treadDepth}
                min={0.2} max={0.4} step={0.01}
                onChange={(val) => updateSt({ treadDepth: val })}
            />
            <EditField
                label="Ancho paso (m)"
                value={st.stairWidth}
                min={0.6} max={5} step={0.1}
                onChange={(val) => updateSt({ stairWidth: val })}
            />

            {hasFlights && (
                <EditField
                    label="Separación tramos (m)"
                    value={st.flightGap ?? 0}
                    min={0} max={2} step={0.05}
                    onChange={(val) => updateSt({ flightGap: val })}
                />
            )}

            <EditField
                label="Elev. arranque (m)"
                value={st.startElevation ?? 0}
                min={0} max={10} step={0.025}
                onChange={(val) => updateSt({ startElevation: val })}
            />

            {!hasFlights && (
                <EditField
                    label="Cant. escalones"
                    value={st.stepCount}
                    min={2} max={80} step={1}
                    onChange={(val) => updateSt({ stepCount: val })}
                />
            )}

            <PropField
                label="Altura total"
                value={`${(parseFloat(totalHeight) + (st.startElevation ?? 0)).toFixed(2)} m · ${totalSteps} esc. · Dir: ${DIRECTION_LABELS[effectiveOrientation]}`}
            />

            {normWarnings.length > 0 ? (
                <div className="mt-1 space-y-1 rounded bg-amber-950/40 px-2 py-1.5">
                    {normWarnings.map((msg, i) => (
                        <p key={i} className="text-[9px] leading-snug text-amber-400">
                            ⚠️ {msg}
                        </p>
                    ))}
                </div>
            ) : (
                <p className="text-[9px] leading-snug text-emerald-500">
                    ✅ Cumple los mínimos de {getStairPreset(st.normativeUse).label}
                </p>
            )}

            {/* ── Opciones 3D ────────────────────────────────────────── */}
            <div className="mt-1.5 flex flex-col gap-0.5 rounded border border-orange-900/40 bg-orange-950/20 p-1.5">
                <p className="mb-1 text-[9px] font-semibold text-orange-300">Opciones 3D</p>
                <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                        type="checkbox"
                        className="accent-orange-500"
                        checked={st.hasBaseSlab !== false}
                        onChange={(e) => updateSt({ hasBaseSlab: e.target.checked })}
                    />
                    <span className="text-[9px] text-gray-700 dark:text-gray-700 dark:text-gray-300">Base sólida bajo escalones</span>
                </label>
                <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                        type="checkbox"
                        className="accent-orange-500"
                        checked={st.isInterFloor === true}
                        onChange={(e) => updateSt({ isInterFloor: e.target.checked })}
                    />
                    <span className="text-[9px] text-gray-700 dark:text-gray-700 dark:text-gray-300">Conecta con piso superior</span>
                </label>
                <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                        type="checkbox"
                        className="accent-orange-500"
                        checked={st.showRailings === true}
                        onChange={(e) => updateSt({ showRailings: e.target.checked })}
                    />
                    <span className="text-[9px] text-gray-700 dark:text-gray-700 dark:text-gray-300">Mostrar pasamanos</span>
                </label>
            </div>

            {/* ── Tramos ─────────────────────────────────────────── */}
            <div className="mt-2 border-t border-orange-900/40 pt-2">
                <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-orange-300">
                        {hasFlights ? `Tramos (${st.flights.length})` : 'Escalera directa'}
                    </p>
                    <button
                        type="button"
                        onClick={addFlight}
                        className="flex items-center gap-1 rounded bg-orange-700/60 px-1.5 py-0.5 text-[9px] text-orange-200 hover:bg-orange-600/60"
                    >
                        <Plus size={9} />
                        {hasFlights ? 'Agregar tramo' : 'Dividir en tramos'}
                    </button>
                </div>

                {!hasFlights && (
                    <p className="text-[8px] text-gray-500 dark:text-gray-500 px-0.5 leading-tight">
                        {st.stepCount} escalones · {DIRECTION_LABELS[st.orientation]} · sin descanso
                    </p>
                )}

                {st.flights.map((flight, idx) => (
                    <div
                        key={flight.id}
                        className="mb-2 rounded border border-orange-900/50 bg-orange-950/20 p-1.5 space-y-1"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-semibold text-orange-300">
                                Tramo {idx + 1}
                            </span>
                            <button
                                type="button"
                                onClick={() => removeFlight(idx)}
                                className="text-red-400 hover:text-red-300"
                            >
                                <Trash2 size={9} />
                            </button>
                        </div>
                        <EditField
                            label="Escalones"
                            value={flight.stepCount}
                            min={1} max={40} step={1}
                            onChange={(val) => updateFlight(idx, { stepCount: val })}
                        />
                        <SelectField
                            label="Dirección"
                            value={flight.direction}
                            options={Object.entries(DIRECTION_LABELS).map(([v, l]) => ({
                                value: v,
                                label: l,
                            }))}
                            onChange={(val) => updateFlight(idx, { direction: val as StairFlight['direction'] })}
                        />
                        {idx < st.flights.length - 1 && (
                            <EditField
                                label="Descanso (m)"
                                value={flight.landingDepth > 0 ? flight.landingDepth : 1.2}
                                min={0.6} max={3} step={0.1}
                                onChange={(val) => updateFlight(idx, { hasLanding: val > 0, landingDepth: val })}
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
