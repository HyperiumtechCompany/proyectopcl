import { Plus, Square, Trash2, Zap } from 'lucide-react';
import React from 'react';
import {
    deriveAmbientSpaces,
    deriveSceneAmbientSpaces,
} from '@/pages/dialux/hooks/ambientSpaces';
import {
    calculatePolygonArea,
    calculatePolygonPerimeter,
} from '@/pages/dialux/hooks/lightingCalculations';
import {
    NORMATIVE_LABELS,
    buildRoomLightingInputs,
    getFixturesForRoom,
} from '@/pages/dialux/hooks/roomLighting';
import type {
    CorridorType,
    StairConfig,
    StairFlight,
} from '@/pages/dialux/hooks/types';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import type { Room, Scene } from '@/pages/dialux/hooks/useEditorStore';
import { getPeruWallPreset } from '@/pages/dialux/hooks/wallNorms';
import {
    EditField,
    PropField,
    SectionWrapper,
    SelectField,
    TextField,
} from './PropertyFields';

const CORRIDOR_TYPE_OPTIONS: Array<{ value: CorridorType; label: string }> = [
    { value: 'roof_only', label: 'Solo techo' },
    { value: 'normal', label: 'Normal' },
    { value: 'roof_floor', label: 'Techo y piso' },
    { value: 'concrete_railings', label: 'Baranda cemento' },
    { value: 'metal_railings', label: 'Baranda metal' },
    { value: 'ramp', label: 'Rampa' },
    { value: 'sidewalk', label: 'Vereda (Piso sin barandas)' },
];

export const RoomProps: React.FC<{
    room: Room;
    scene: Scene | null;
    parentRoom?: Room | null;
    selectedAmbient?:
        | ReturnType<typeof deriveSceneAmbientSpaces>[number]
        | null;
    onUpdate: (patch: Partial<Omit<Room, 'id'>>) => void;
}> = ({ room, scene, parentRoom = null, selectedAmbient = null, onUpdate }) => {
    const store = useEditorStore();
    const isCorridorAmbient = room.roomType === 'corridor';
    const isRecinto = !room.roomType || room.roomType === 'room';
    const isAmbiente = room.roomType === 'ambient' || room.roomType === 'corridor';
    const calculationRoom = selectedAmbient?.room ?? room;
    const area = calculatePolygonArea(calculationRoom.vertices);
    const perimeter = calculatePolygonPerimeter(calculationRoom.vertices);
    const fixturesInRoom = selectedAmbient
        ? selectedAmbient.fixtures
        : scene
          ? getFixturesForRoom(room, scene.fixtures)
          : [];
    const ambientSpaces = scene
        ? isCorridorAmbient
            ? selectedAmbient
                ? [selectedAmbient]
                : deriveAmbientSpaces(room, scene.walls, scene.fixtures)
            : deriveSceneAmbientSpaces(scene).filter(
                  (ambient) => ambient.roomId === room.id,
              )
        : [];
    const standard =
        room.normativeStandard ?? store.defaultRoomNormativeStandard;
    const inputs = buildRoomLightingInputs(calculationRoom, fixturesInRoom);

    // Sección Construcción — preset del material del recinto
    const roomMaterial = (room.material ?? 'brick') as 'brick' | 'adobe';
    const roomUse = (room.normativeUse ?? 'housing') as 'housing' | 'education' | 'generic';
    const constructionPreset = getPeruWallPreset(roomMaterial, roomUse);

    const handleCorridorTypeChange = (value: string) => {
        const corridorType = CORRIDOR_TYPE_OPTIONS.find(
            (option) => option.value === value,
        )?.value;

        if (!corridorType) return;

        onUpdate({
            corridorConfig: {
                ...(room.corridorConfig ?? {}),
                type: corridorType,
            },
        });
    };

    return (
        <div className="max-h-[600px] space-y-3 overflow-y-auto">
            {/* ── Sección Geometría ── */}
            <SectionWrapper
                icon={<Square size={12} className="text-blue-400" />}
                label={isCorridorAmbient ? 'Pasadizo' : room.roomType === 'ambient' ? 'Ambiente' : 'Recinto'}
            >
                <TextField
                    label="Nombre"
                    value={room.name}
                    onChange={(value) => onUpdate({ name: value })}
                />
                <EditField
                    label={isCorridorAmbient ? 'Alto techo (m)' : 'Alto (m)'}
                    value={room.height}
                    min={1}
                    max={20}
                    step={0.1}
                    onChange={(value) => onUpdate({ height: value })}
                />
                {isCorridorAmbient &&
                    parentRoom &&
                    parentRoom.id !== room.id && (
                        <PropField
                            label="Recinto"
                            value={parentRoom.name}
                            mono={false}
                        />
                    )}
                {isCorridorAmbient && (
                    <>
                        <SelectField
                            label="Tipo"
                            value={room.corridorConfig?.type ?? 'roof_only'}
                            options={CORRIDOR_TYPE_OPTIONS}
                            onChange={handleCorridorTypeChange}
                        />
                        {(room.corridorConfig?.type === 'concrete_railings' ||
                            room.corridorConfig?.type === 'metal_railings') && (
                            <EditField
                                label="Alto baranda (m)"
                                value={room.corridorConfig?.railingHeight ?? 1.05}
                                min={0.6}
                                max={1.5}
                                step={0.05}
                                onChange={(value) =>
                                    onUpdate({
                                        corridorConfig: {
                                            ...(room.corridorConfig ?? {}),
                                            railingHeight: value,
                                        },
                                    })
                                }
                            />
                        )}
                        {room.corridorConfig?.type === 'ramp' && (
                            <>
                                <EditField
                                    label="Pendiente (%)"
                                    value={room.corridorConfig?.rampSlope ?? 8}
                                    min={1}
                                    max={20}
                                    step={0.5}
                                    onChange={(value) =>
                                        onUpdate({
                                            corridorConfig: {
                                                ...(room.corridorConfig ?? {}),
                                                rampSlope: value,
                                            },
                                        })
                                    }
                                />
                            </>
                        )}
                        {(room.corridorConfig?.type === 'ramp' || room.corridorConfig?.type === 'roof_floor') && (
                            <SelectField
                                label={room.corridorConfig?.type === 'ramp' ? "Dirección sube" : "Dirección flujo"}
                                value={room.corridorConfig?.direction ?? 'north'}
                                options={[
                                    { value: 'north', label: 'Norte ↑' },
                                    { value: 'south', label: 'Sur ↓' },
                                    { value: 'east', label: 'Este →' },
                                    { value: 'west', label: 'Oeste ←' },
                                ]}
                                onChange={(value) =>
                                    onUpdate({
                                        corridorConfig: {
                                            ...(room.corridorConfig ?? {}),
                                            direction: value as 'north' | 'south' | 'east' | 'west',
                                        },
                                    })
                                }
                            />
                        )}
                        {room.corridorConfig?.type === 'ramp' && (
                            <EditField
                                label="Alto baranda (m)"
                                value={room.corridorConfig?.railingHeight ?? 1.0}
                                min={0.6}
                                max={1.5}
                                step={0.05}
                                onChange={(value) =>
                                    onUpdate({
                                        corridorConfig: {
                                            ...(room.corridorConfig ?? {}),
                                            railingHeight: value,
                                        },
                                    })
                                }
                            />
                        )}
                    </>
                )}
                <PropField label="Vértices" value={`${room.vertices.length}`} />
                <PropField label="Área" value={`${area.toFixed(4)} m²`} />
                <PropField label="Perímetro" value={`${perimeter.toFixed(4)} m`} />
                {isRecinto && (
                    <PropField
                        label="Ambientes"
                        value={`${ambientSpaces.length}`}
                    />
                )}

                {room.roomType === 'stair' && (
                    <StairConfigPanel
                        room={room}
                        onUpdate={onUpdate}
                    />
                )}
            </SectionWrapper>

            {/* ── Sección Construcción — solo recinto exterior ── */}
            {isRecinto && (
                <SectionWrapper
                    icon={<Square size={12} className="text-orange-400" />}
                    label="Construcción"
                >
                    <SelectField
                        label="Material estruct."
                        value={roomMaterial}
                        options={[
                            { value: 'brick', label: 'Ladrillo' },
                            { value: 'adobe', label: 'Adobe' },
                        ]}
                        onChange={(val) => onUpdate({ material: val as 'brick' | 'adobe' })}
                    />
                    <SelectField
                        label="Tipo edificación"
                        value={roomUse}
                        options={[
                            { value: 'housing', label: 'Vivienda (A.010)' },
                            { value: 'education', label: 'Educación (A.040)' },
                            { value: 'generic', label: 'Genérico' },
                        ]}
                        onChange={(val) => onUpdate({ normativeUse: val as 'housing' | 'education' | 'generic' })}
                    />
                    <PropField
                        label="Espesor pared rec."
                        value={`${constructionPreset.recommendedThickness.toFixed(2)} m`}
                    />
                    <PropField
                        label="Altura mín. permit."
                        value={`${constructionPreset.minHeight.toFixed(2)} m`}
                    />
                </SectionWrapper>
            )}

            {/* ── Sección Iluminación — solo ambientes y pasadizos ── */}
            {isAmbiente && (
                <SectionWrapper
                    icon={<Zap size={12} className="text-yellow-400" />}
                    label="Iluminación"
                >
                    <PropField
                        label="Estándar"
                        value={NORMATIVE_LABELS[standard]}
                        mono={false}
                    />
                    <EditField
                        label="Iluminancia (lux)"
                        value={inputs.illuminanceLux}
                        min={10}
                        max={2000}
                        step={10}
                        onChange={(value) =>
                            onUpdate({ illuminanceLux: value, norma: value })
                        }
                    />
                    <div className="flex items-center justify-between">
                        <PropField
                            label="Luminarias"
                            value={`${fixturesInRoom.length}`}
                        />
                        {fixturesInRoom.length > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    store.setSelectedId(null);
                                    store.setSelectedFixtureIds(fixturesInRoom.map((f) => f.id));
                                }}
                                className="ml-2 rounded bg-blue-600/20 px-2 py-0.5 text-[10px] text-blue-400 hover:bg-blue-600/40"
                            >
                                Seleccionar Todas
                            </button>
                        )}
                    </div>
                    <PropField
                        label="Lm detectados"
                        value={
                            inputs.detectedFixtureLumens
                                ? `${inputs.detectedFixtureLumens.toLocaleString()} lm`
                                : '—'
                        }
                    />
                    <PropField
                        label="Lm requeridos"
                        value={`${inputs.lumensRequired.toFixed(0).toLocaleString()} lm`}
                    />
                    <PropField
                        label="Cant. óptima"
                        value={`${inputs.exactQuantity.toFixed(2)}`}
                    />
                    <PropField
                        label="Cant. simetría"
                        value={`${inputs.roundedQuantity}`}
                    />
                    <div className="flex items-center justify-between border-b border-gray-800/40 pb-1.5">
                        <span className="text-[10px] text-gray-500">Cumple normativa</span>
                        {fixturesInRoom.length >= inputs.roundedQuantity ? (
                            <span className="text-[11px] font-medium text-emerald-400">
                                ✓ Sí ({fixturesInRoom.length}/{inputs.roundedQuantity})
                            </span>
                        ) : (
                            <span className="text-[11px] font-medium text-red-400">
                                ✗ Faltan {inputs.roundedQuantity - fixturesInRoom.length}
                            </span>
                        )}
                    </div>
                    <p className="pt-1 text-[9px] text-gray-600">
                        Botón "Cálculo CT" disponible en la barra superior (junto a Calcular) cuando este ambiente está seleccionado.
                    </p>
                </SectionWrapper>
            )}

            {/* ── Sección Grilla de Luminarias — solo ambientes y pasadizos ── */}
            {isAmbiente && (
                <div className="mt-4 border-t border-gray-800/80 pt-3">
                    <div className="flex items-center gap-2 text-emerald-500">
                        <Zap size={12} />
                        <p className="text-[10px] font-semibold uppercase">
                            Generar Grilla de Focos
                        </p>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        <EditField
                            label="Filas"
                            value={store.ui.fixtureGridRows}
                            min={1}
                            max={20}
                            step={1}
                            onChange={(val) => store.setFixtureGridRows(val)}
                        />
                        <EditField
                            label="Columnas"
                            value={store.ui.fixtureGridCols}
                            min={1}
                            max={20}
                            step={1}
                            onChange={(val) => store.setFixtureGridCols(val)}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            const newIds = store.addFixtureGrid({
                                roomId: room.id,
                                rows: store.ui.fixtureGridRows,
                                columns: store.ui.fixtureGridCols,
                                fixtureTemplate: store.ui.fixtureTemplate,
                                ambientVertices: calculationRoom.vertices,
                            });
                            if (newIds.length > 0) {
                                store.setSelectedId(null);
                                store.setSelectedFixtureIds(newIds);
                            } else {
                                alert("No se pudo generar la grilla. El área puede ser muy pequeña.");
                            }
                        }}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded bg-emerald-600/20 py-1.5 text-[10px] font-medium text-emerald-400 hover:bg-emerald-600/30 transition-colors"
                    >
                        Generar en Techo {store.ui.fixtureGridRows}x{store.ui.fixtureGridCols}
                    </button>
                </div>
            )}
        </div>
    );
};

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

const StairConfigPanel: React.FC<{
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

    return (
        <div className="my-2 space-y-1 border-t border-gray-800/80 pt-2">
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
                    <span className="text-[9px] text-gray-300">Base sólida bajo escalones</span>
                </label>
                <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                        type="checkbox"
                        className="accent-orange-500"
                        checked={st.isInterFloor === true}
                        onChange={(e) => updateSt({ isInterFloor: e.target.checked })}
                    />
                    <span className="text-[9px] text-gray-300">Conecta con piso superior</span>
                </label>
                <label className="flex cursor-pointer items-center gap-1.5">
                    <input
                        type="checkbox"
                        className="accent-orange-500"
                        checked={st.showRailings === true}
                        onChange={(e) => updateSt({ showRailings: e.target.checked })}
                    />
                    <span className="text-[9px] text-gray-300">Mostrar pasamanos</span>
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
                    <p className="text-[8px] text-gray-500 px-0.5 leading-tight">
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
