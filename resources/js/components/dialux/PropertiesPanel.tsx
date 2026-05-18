import {
    AppWindow,
    Minus,
    Move,
    Square,
    Umbrella,
    Zap,
    DoorOpen,
    Target,
    Grid,
    PlusSquare,
    Plus,
    Trash2,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import React from 'react';
import {
    deriveAmbientSpaces,
    deriveSceneAmbientSpaces,
} from '@/hooks/dialux/ambientSpaces';
import { calculatePolygonArea } from '@/hooks/dialux/lightingCalculations';
import {
    NORMATIVE_LABELS,
    buildRoomLightingInputs,
    findNormativeOption,
    getActivityOptions,
    getCategoryOptions,
    getFixturesForRoom,
    getSectionOptions,
} from '@/hooks/dialux/roomLighting';
import { useEditorStore } from '@/hooks/dialux/useEditorStore';
import type {
    Canopy,
    Fixture,
    Room,
    Scene,
    Wall,
    Window,
    Door,
} from '@/hooks/dialux/useEditorStore';
import {
    getWallPresetFromWall,
    getPeruWallPreset,
} from '@/hooks/dialux/wallNorms';
import type { Partition, StairConfig, StairFlight } from '@/hooks/dialux/types';

export const PropertiesPanel = React.memo(function PropertiesPanel() {
    const store = useEditorStore();
    const scene = store.activeScene();
    const selectedId = store.ui.selectedId;

    if (!selectedId || !scene) {
        return (
            <div className="px-2 py-6 text-center">
                <p className="text-[10px] text-gray-600">
                    Selecciona un objeto para ver sus propiedades
                </p>
            </div>
        );
    }

    const room = scene.rooms.find((r) => r.id === selectedId);
    const wall = scene.walls.find((w) => w.id === selectedId);
    const win = scene.windows.find((w) => w.id === selectedId);
    const door = scene.doors.find((d) => d.id === selectedId);
    const canopy = scene.canopies.find((c) => c.id === selectedId);
    const fixture = scene.fixtures.find((f) => f.id === selectedId);
    const partition = scene.partitions?.find((p) => p.id === selectedId);

    if (partition) {
        return (
            <PartitionProps
                partition={partition}
                onUpdate={(patch) => store.updatePartition(partition.id, patch)}
            />
        );
    }

    if (room) {
        const corridorAmbient =
            room.roomType === 'corridor'
                ? (deriveSceneAmbientSpaces(scene).find(
                      (ambient) => ambient.sourceRoom.id === room.id,
                  ) ?? null)
                : null;
        const parentRoom = corridorAmbient
            ? (scene.rooms.find(
                  (candidate) => candidate.id === corridorAmbient.roomId,
              ) ?? null)
            : null;

        return (
            <RoomProps
                room={room}
                scene={scene}
                parentRoom={parentRoom}
                selectedAmbient={corridorAmbient}
                onUpdate={(patch) => store.updateRoom(room.id, patch)}
            />
        );
    }

    if (wall) {
        return (
            <WallProps
                wall={wall}
                scene={scene}
                onUpdate={(patch) => store.updateWall(wall.id, patch)}
                onUpdateRoom={(roomId, patch) =>
                    store.updateRoom(roomId, patch)
                }
            />
        );
    }

    if (win) {
        return (
            <WindowProps
                win={win}
                onUpdate={(patch) => store.updateWindow(win.id, patch)}
                onCenter={() => store.centerWindowOnWall(win.id)}
            />
        );
    }

    if (door) {
        return (
            <DoorProps
                door={door}
                onUpdate={(patch) => store.updateDoor(door.id, patch)}
                onCenter={() => store.centerDoorOnWall(door.id)}
            />
        );
    }

    if (canopy) {
        return (
            <CanopyProps
                canopy={canopy}
                onUpdate={(patch) => store.updateCanopy(canopy.id, patch)}
            />
        );
    }

    if (fixture) {
        return (
            <FixtureProps
                fixture={fixture}
                onUpdate={(patch) => store.updateFixture(fixture.id, patch)}
            />
        );
    }

    return <p className="text-[10px] text-gray-600">Objeto no encontrado</p>;
});

const RoomProps: React.FC<{
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
    const calculationRoom = selectedAmbient?.room ?? room;
    const area = calculatePolygonArea(calculationRoom.vertices);
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
    const normative = findNormativeOption(room);
    const standard =
        room.normativeStandard ?? store.defaultRoomNormativeStandard;
    const categoryOptions = getCategoryOptions(standard);
    const sectionOptions = getSectionOptions(standard, room.normativeCategory);
    const activityOptions = getActivityOptions(
        standard,
        room.normativeCategory,
        room.normativeSection,
    );
    const inputs = buildRoomLightingInputs(calculationRoom, fixturesInRoom);

    const handleNormativeCategoryChange = (value: string) => {
        onUpdate({
            normativeCategory: value || undefined,
            normativeSection: undefined,
            normativeActivity: undefined,
            normativeLabel: undefined,
            ugrLimit: undefined,
            uniformityTarget: undefined,
            colorRenderingRa: undefined,
            specificRequirements: undefined,
        });
    };

    const handleNormativeSectionChange = (value: string) => {
        onUpdate({
            normativeSection: value || undefined,
            normativeActivity: undefined,
            normativeLabel: undefined,
            ugrLimit: undefined,
            uniformityTarget: undefined,
            colorRenderingRa: undefined,
            specificRequirements: undefined,
        });
    };

    const handleNormativeActivityChange = (value: string) => {
        const selectedOption = activityOptions.find(
            (option) => option.activity === value,
        );
        onUpdate({
            normativeActivity: value || undefined,
            normativeLabel: selectedOption?.label || undefined,
            illuminanceLux:
                selectedOption?.illuminanceLux || inputs.illuminanceLux,
            ugrLimit: selectedOption?.ugr || undefined,
            uniformityTarget: selectedOption?.uniformity || undefined,
            colorRenderingRa: selectedOption?.ra || undefined,
            specificRequirements:
                selectedOption?.specificRequirements || undefined,
        });
    };

    return (
        <div className="max-h-[600px] space-y-3 overflow-y-auto">
            <SectionWrapper
                icon={<Square size={12} className="text-blue-400" />}
                label={isCorridorAmbient ? 'Ambiente' : 'Recinto'}
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
                    <PropField label="Tipo" value="Pasadizo" mono={false} />
                )}
                <PropField label="Vertices" value={`${room.vertices.length}`} />
                <PropField label="Area" value={`${area.toFixed(2)} m2`} />
                {!isCorridorAmbient && (
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

                <div className="my-2 space-y-1 border-t border-gray-800/80 pt-2">
                    <p className="mb-1.5 text-[10px] font-semibold text-cyan-500">
                        Normativa y calculo
                    </p>
                    <PropField
                        label="Estandar"
                        value={NORMATIVE_LABELS[standard]}
                        mono={false}
                    />
                    <SelectField
                        label="Categoria"
                        value={room.normativeCategory ?? ''}
                        options={categoryOptions.map((option) => ({
                            value: option,
                            label: option,
                        }))}
                        placeholder="Selecciona"
                        onChange={handleNormativeCategoryChange}
                    />
                    {sectionOptions.length > 0 && (
                        <SelectField
                            label="Jerarquia"
                            value={room.normativeSection ?? ''}
                            options={sectionOptions.map((option) => ({
                                value: option,
                                label: option,
                            }))}
                            placeholder="Selecciona"
                            onChange={handleNormativeSectionChange}
                        />
                    )}
                    {activityOptions.length > 0 && (
                        <SelectField
                            label="Actividad"
                            value={room.normativeActivity ?? ''}
                            options={activityOptions.map((option) => ({
                                value: option.activity,
                                label: option.activity,
                            }))}
                            placeholder="Selecciona"
                            onChange={handleNormativeActivityChange}
                        />
                    )}
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
                    <EditField
                        label="Flujo base (lm)"
                        value={room.fixtureLumens ?? room.fixtureFlux ?? 4000}
                        min={100}
                        max={50000}
                        step={100}
                        onChange={(value) =>
                            onUpdate({
                                fixtureLumens: value,
                                fixtureFlux: value,
                            })
                        }
                    />
                    <PropField
                        label="Lm detectados"
                        value={
                            inputs.detectedFixtureLumens
                                ? `${inputs.detectedFixtureLumens} lm`
                                : 'Sin luminaria en recinto'
                        }
                    />
                    <PropField
                        label="Luminarias en recinto"
                        value={`${fixturesInRoom.length}`}
                    />
                    <PropField
                        label="Lm Requeridos"
                        value={`${inputs.lumensRequired.toFixed(0)}`}
                    />
                    <PropField
                        label="Cant. Optima"
                        value={`${inputs.exactQuantity.toFixed(2)}`}
                    />
                    <PropField
                        label="Cant. Simetria"
                        value={`${inputs.roundedQuantity}`}
                    />
                    {normative?.label && (
                        <PropField
                            label="Aplicacion"
                            value={normative.label}
                            mono={false}
                        />
                    )}
                    {room.specificRequirements && (
                        <PropField
                            label="Req. esp."
                            value={room.specificRequirements}
                            mono={false}
                        />
                    )}
                </div>

                <PropField label="ID" value={room.id.slice(0, 12)} />
            </SectionWrapper>
        </div>
    );
};

const DEFAULT_STAIR: StairConfig = {
    normativeUse: 'generic',
    orientation: 'north',
    riserHeight: 0.175,
    treadDepth: 0.28,
    stairWidth: 1.2,
    stepCount: 17,
    flights: [],
};

const DIRECTION_LABELS: Record<StairFlight['direction'], string> = {
    north: 'Norte ↑',
    south: 'Sur ↓',
    east: 'Este →',
    west: 'Oeste ←',
};

const StairConfigPanel: React.FC<{
    room: Room;
    onUpdate: (patch: Partial<Omit<Room, 'id'>>) => void;
}> = ({ room, onUpdate }) => {
    const st = room.stairConfig ?? DEFAULT_STAIR;

    const updateSt = (patch: Partial<StairConfig>) =>
        onUpdate({ stairConfig: { ...st, ...patch } });

    const updateFlight = (index: number, patch: Partial<StairFlight>) => {
        const flights = st.flights.map((f, i) =>
            i === index ? { ...f, ...patch } : f,
        );
        updateSt({ flights });
    };

    const addFlight = () => {
        const newFlight: StairFlight = {
            id: `flight-${Date.now()}`,
            stepCount: 8,
            direction: st.orientation,
            hasLanding: true,
            landingDepth: 1.2,
        };
        updateSt({ flights: [...st.flights, newFlight] });
    };

    const removeFlight = (index: number) => {
        updateSt({ flights: st.flights.filter((_, i) => i !== index) });
    };

    const totalSteps = st.flights.length > 0
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
            <SelectField
                label="Orientación"
                value={st.orientation}
                options={[
                    { value: 'north', label: 'Norte ↑' },
                    { value: 'south', label: 'Sur ↓' },
                    { value: 'east', label: 'Este →' },
                    { value: 'west', label: 'Oeste ←' },
                ]}
                onChange={(val) => updateSt({ orientation: val as StairConfig['orientation'] })}
            />
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

            {st.flights.length === 0 && (
                <EditField
                    label="Cant. escalones"
                    value={st.stepCount}
                    min={2} max={80} step={1}
                    onChange={(val) => updateSt({ stepCount: val })}
                />
            )}

            <PropField
                label="Altura total"
                value={`${totalHeight} m (${totalSteps} esc.)`}
            />

            {/* ── Tramos ─────────────────────────────────────────── */}
            <div className="mt-2 border-t border-orange-900/40 pt-2">
                <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-orange-300">
                        Tramos ({st.flights.length})
                    </p>
                    <button
                        type="button"
                        onClick={addFlight}
                        className="flex items-center gap-1 rounded bg-orange-700/60 px-1.5 py-0.5 text-[9px] text-orange-200 hover:bg-orange-600/60"
                    >
                        <Plus size={9} />
                        Agregar tramo
                    </button>
                </div>

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
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] text-gray-400">Descanso</span>
                            <button
                                type="button"
                                onClick={() => updateFlight(idx, { hasLanding: !flight.hasLanding })}
                                className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                                    flight.hasLanding
                                        ? 'bg-amber-700/60 text-amber-200'
                                        : 'bg-gray-700/60 text-gray-400'
                                }`}
                            >
                                {flight.hasLanding ? 'Sí' : 'No'}
                            </button>
                        </div>
                        {flight.hasLanding && (
                            <EditField
                                label="Prof. descanso (m)"
                                value={flight.landingDepth}
                                min={0.6} max={3} step={0.1}
                                onChange={(val) => updateFlight(idx, { landingDepth: val })}
                            />
                        )}
                    </div>
                ))}

                {st.flights.length === 0 && (
                    <p className="text-[8px] text-gray-500 px-0.5">
                        Sin tramos: escalera directa con {st.stepCount} escalones en dirección {DIRECTION_LABELS[st.orientation]}.
                    </p>
                )}
            </div>
        </div>
    );
};

const WallProps: React.FC<{
    wall: Wall;
    scene: Scene | null;
    onUpdate: (patch: Partial<Omit<Wall, 'id'>>) => void;
    onUpdateRoom: (roomId: string, patch: Partial<Omit<Room, 'id'>>) => void;
}> = ({ wall, scene, onUpdate, onUpdateRoom }) => {
    const store = useEditorStore();
    const verts = wall.vertices;
    const preset = getWallPresetFromWall(wall);
    const ambientMatch =
        scene?.rooms
            .flatMap((room) =>
                deriveAmbientSpaces(room, scene.walls, scene.fixtures),
            )
            .find((ambient) => ambient.wallId === wall.id) ?? null;
    const activityOptions = ambientMatch
        ? getActivityOptions(
              ambientMatch.sourceRoom.normativeStandard ?? 'en_12464',
              ambientMatch.sourceRoom.normativeCategory,
              ambientMatch.sourceRoom.normativeSection,
          )
        : [];
    let len = 0;

    if (verts.length > 1) {
        for (let i = 1; i < verts.length; i++) {
            len += Math.hypot(
                verts[i].x - verts[i - 1].x,
                verts[i].y - verts[i - 1].y,
            );
        }
    }

    const start = verts[0];
    const end = verts[verts.length - 1];

    const handleVertexChange = (
        index: number,
        axis: 'x' | 'y',
        value: number,
    ) => {
        const newVertices = wall.vertices.map((vertex, vertexIndex) =>
            vertexIndex === index ? { ...vertex, [axis]: value } : vertex,
        );
        onUpdate({ vertices: newVertices });
    };

    const handleMaterialChange = (value: string) => {
        if (value !== 'brick' && value !== 'adobe') return;

        const nextPreset = getPeruWallPreset(
            value,
            wall.normativeUse ?? 'housing',
        );

        onUpdate({
            material: nextPreset.material,
            normativeUse: nextPreset.use,
            thickness: nextPreset.recommendedThickness,
            height: nextPreset.recommendedHeight,
            mortarJointMin: nextPreset.mortarJointMin,
            mortarJointMax: nextPreset.mortarJointMax,
        });
    };

    const handleUseChange = (value: string) => {
        if (
            value !== 'housing' &&
            value !== 'education' &&
            value !== 'generic'
        ) {
            return;
        }

        const nextPreset = getPeruWallPreset(wall.material ?? 'brick', value);

        onUpdate({
            normativeUse: nextPreset.use,
            thickness: nextPreset.recommendedThickness,
            height: nextPreset.recommendedHeight,
            mortarJointMin: nextPreset.mortarJointMin,
            mortarJointMax: nextPreset.mortarJointMax,
        });
    };

    const updateAmbientConfig = (
        patch: Partial<NonNullable<Room['ambientConfigs']>[string]>,
    ) => {
        if (!ambientMatch) return;

        onUpdateRoom(ambientMatch.sourceRoom.id, {
            ambientConfigs: {
                ...(ambientMatch.sourceRoom.ambientConfigs ?? {}),
                [ambientMatch.configKey]: {
                    ...(ambientMatch.sourceRoom.ambientConfigs?.[
                        ambientMatch.configKey
                    ] ?? {}),
                    ...patch,
                },
            },
        });
    };

    return (
        <SectionWrapper
            icon={<Minus size={12} className="text-slate-400" />}
            label={ambientMatch ? 'Ambiente' : 'Pared'}
        >
            <PropField label="Longitud" value={`${len.toFixed(2)} m`} />
            {ambientMatch && (
                <>
                    <TextField
                        label="Nombre ambiente"
                        value={
                            ambientMatch.sourceRoom.ambientConfigs?.[
                                ambientMatch.configKey
                            ]?.name ?? ambientMatch.name
                        }
                        onChange={(value) =>
                            updateAmbientConfig({ name: value })
                        }
                    />
                    <SelectField
                        label="Tipo ambiente"
                        value={
                            ambientMatch.sourceRoom.ambientConfigs?.[
                                ambientMatch.configKey
                            ]?.activity ??
                            ambientMatch.activity ??
                            ''
                        }
                        options={activityOptions.map((option) => ({
                            value: option.activity,
                            label: option.activity,
                        }))}
                        placeholder="Selecciona"
                        onChange={(value) =>
                            updateAmbientConfig({
                                activity: value || undefined,
                            })
                        }
                    />
                    <PropField
                        label="Area ambiente"
                        value={`${ambientMatch.area.toFixed(2)} m2`}
                    />
                    <PropField
                        label="Centro"
                        value={`${ambientMatch.centroid.x.toFixed(2)}, ${ambientMatch.centroid.y.toFixed(2)}`}
                    />
                    <PropField
                        label="Luminarias"
                        value={`${ambientMatch.fixtures.length}`}
                    />
                    <div className="my-2 space-y-1 border-t border-gray-800/80 pt-2">
                        <div className="flex items-center gap-2 text-emerald-500">
                            <Grid size={12} />
                            <p className="text-[10px] font-semibold uppercase">
                                Distribucion de focos (Grilla)
                            </p>
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <EditField
                                label="Filas"
                                value={store.ui.fixtureGridRows}
                                min={1}
                                max={10}
                                step={1}
                                onChange={(val) =>
                                    store.setFixtureGridRows(val)
                                }
                            />
                            <EditField
                                label="Columnas"
                                value={store.ui.fixtureGridCols}
                                min={1}
                                max={10}
                                step={1}
                                onChange={(val) =>
                                    store.setFixtureGridCols(val)
                                }
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                store.addFixtureGrid({
                                    roomId: ambientMatch.sourceRoom.id,
                                    rows: store.ui.fixtureGridRows,
                                    columns: store.ui.fixtureGridCols,
                                    fixtureTemplate: store.ui.fixtureTemplate,
                                    ambientVertices: ambientMatch.room.vertices,
                                })
                            }
                            className="mt-2 flex w-full items-center justify-center gap-2 rounded bg-emerald-600/80 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-emerald-500"
                        >
                            <PlusSquare size={13} />
                            Generar Grilla {store.ui.fixtureGridRows}×
                            {store.ui.fixtureGridCols}
                        </button>

                        <p className="mt-1 px-1 text-[8px] leading-tight text-gray-500">
                            Crea una distribucion de focos restringida al area
                            de este ambiente.
                        </p>
                    </div>
                </>
            )}
            <SelectField
                label="Tipo de muro"
                value={wall.wallType ?? 'interior'}
                options={[
                    { value: 'interior', label: 'Interior' },
                    { value: 'exterior', label: 'Exterior' },
                    { value: 'cerco', label: 'Cerco perimétrico' },
                ]}
                onChange={(val) => onUpdate({ wallType: val as 'interior' | 'exterior' | 'cerco' })}
            />
            <SelectField
                label="Material"
                value={wall.material ?? 'brick'}
                options={[
                    { value: 'brick', label: 'Ladrillo' },
                    { value: 'adobe', label: 'Adobe' },
                ]}
                onChange={handleMaterialChange}
            />
            <SelectField
                label="Uso Peru"
                value={wall.normativeUse ?? 'housing'}
                options={[
                    { value: 'housing', label: 'Vivienda' },
                    { value: 'education', label: 'Educacion / colegio' },
                    { value: 'generic', label: 'Generico' },
                ]}
                onChange={handleUseChange}
            />
            <EditField
                label="Espesor (m)"
                value={wall.thickness}
                min={0.05}
                max={1}
                step={0.05}
                onChange={(value) => onUpdate({ thickness: value })}
            />
            <EditField
                label="Alto (m)"
                value={wall.height}
                min={1}
                max={20}
                step={0.1}
                onChange={(value) => onUpdate({ height: value })}
            />
            {wall.wallType === 'cerco' && (
                <EditField
                    label="Esp. postes (m)"
                    value={wall.postSpacing ?? 3.0}
                    min={0.5}
                    max={10}
                    step={0.25}
                    onChange={(value) => onUpdate({ postSpacing: value })}
                />
            )}
            <PropField
                label="Orientación"
                value={(() => {
                    const dx = end.x - start.x;
                    const dy = end.y - start.y;
                    const deg = Math.atan2(dy, dx) * 180 / Math.PI;
                    const norm = ((deg % 180) + 180) % 180;
                    return `${norm.toFixed(1)}°`;
                })()}
            />
            <PropField
                label="Espesor min."
                value={`${preset.minThickness.toFixed(2)} m`}
            />
            <PropField
                label="Altura min."
                value={`${preset.minHeight.toFixed(2)} m`}
            />
            <PropField
                label="Junta mortero"
                value={`${(wall.mortarJointMin ?? preset.mortarJointMin).toFixed(3)} - ${(wall.mortarJointMax ?? preset.mortarJointMax).toFixed(3)} m`}
            />
            <PropField
                label="Estado"
                value={
                    wall.thickness >= preset.minThickness &&
                    wall.height >= preset.minHeight
                        ? 'Cumple preset'
                        : 'Revisar minimos'
                }
                mono={false}
            />
            {preset.notes.map((note, index) => (
                <PropField
                    key={`${wall.id}-note-${index}`}
                    label={index === 0 ? 'Norma PE' : 'Detalle'}
                    value={note}
                    mono={false}
                />
            ))}

            <div className="mt-2 mb-1 border-t border-gray-700/50 pt-1">
                <p className="mb-1.5 text-[10px] font-semibold text-cyan-500">
                    Vertices
                </p>
            </div>
            <EditField
                label="X1 (m)"
                value={start.x}
                min={-50}
                max={50}
                step={0.1}
                onChange={(value) => handleVertexChange(0, 'x', value)}
            />
            <EditField
                label="Y1 (m)"
                value={start.y}
                min={-50}
                max={50}
                step={0.1}
                onChange={(value) => handleVertexChange(0, 'y', value)}
            />
            <EditField
                label="X2 (m)"
                value={end.x}
                min={-50}
                max={50}
                step={0.1}
                onChange={(value) =>
                    handleVertexChange(verts.length - 1, 'x', value)
                }
            />
            <EditField
                label="Y2 (m)"
                value={end.y}
                min={-50}
                max={50}
                step={0.1}
                onChange={(value) =>
                    handleVertexChange(verts.length - 1, 'y', value)
                }
            />
            <PropField label="Vertices" value={`${verts.length}`} />
            <PropField label="ID" value={wall.id.slice(0, 12)} />
        </SectionWrapper>
    );
};

const WindowProps: React.FC<{
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
        <PropField label="Pared ID" value={win.wallId.slice(0, 12)} />
        <PropField label="ID" value={win.id.slice(0, 12)} />
    </SectionWrapper>
);

const DoorProps: React.FC<{
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

const CanopyProps: React.FC<{
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

const FixtureProps: React.FC<{
    fixture: Fixture;
    onUpdate: (patch: Partial<Omit<Fixture, 'id'>>) => void;
}> = ({ fixture, onUpdate }) => {
    const store = useEditorStore();
    return (
        <SectionWrapper
            icon={<Zap size={12} className="text-amber-400" />}
            label="Luminaria"
        >
            <div className="mb-2 flex items-start gap-2 rounded border border-amber-700/50 bg-amber-900/20 p-2">
                <Move
                    size={14}
                    className="mt-0.5 flex-shrink-0 text-amber-400"
                />
                <p className="text-[9px] text-amber-300">
                    Selecciona esta luminaria en el canvas y arrastrala para
                    moverla dentro del recinto.
                </p>
            </div>

            <TextField
                label="Nombre"
                value={fixture.name}
                onChange={(value) => onUpdate({ name: value })}
            />
            <PropField label="Lumenes" value={`${fixture.lumens} lm`} />
            <PropField
                label="Eficiencia"
                value={`${(fixture.efficiency * 100).toFixed(0)}%`}
            />

            <EditField
                label="X (m)"
                value={fixture.x}
                min={-50}
                max={50}
                step={0.1}
                onChange={(value) => onUpdate({ x: value })}
            />
            <EditField
                label="Y (m)"
                value={fixture.y}
                min={-50}
                max={50}
                step={0.1}
                onChange={(value) => onUpdate({ y: value })}
            />
            <EditField
                label="Z (m)"
                value={fixture.z}
                min={0}
                max={10}
                step={0.1}
                onChange={(value) => onUpdate({ z: value })}
            />
            <SelectField
                label="Tipo"
                value={fixture.fixtureType ?? 'recessed'}
                options={[
                    { value: 'recessed', label: 'Empotrada' },
                    { value: 'surface', label: 'Superficie' },
                    { value: 'pendant', label: 'Colgante' },
                    { value: 'spot', label: 'Spot' },
                    { value: 'strip', label: 'Tira LED' },
                    { value: 'panel', label: 'Panel LED' },
                    { value: 'tube', label: 'Tubo' },
                ]}
                onChange={(value) =>
                    onUpdate({ fixtureType: value as Fixture['fixtureType'] })
                }
            />
            <SelectField
                label="Forma"
                value={fixture.fixtureShape ?? 'round'}
                options={[
                    { value: 'round', label: 'Redonda' },
                    { value: 'square', label: 'Cuadrada' },
                    { value: 'rectangular', label: 'Rectangular' },
                    { value: 'cylindrical', label: 'Cilindrica' },
                ]}
                onChange={(value) =>
                    onUpdate({ fixtureShape: value as Fixture['fixtureShape'] })
                }
            />
            <div className="flex items-center justify-between border-b border-gray-800/40 pb-1.5">
                <span className="text-[10px] text-gray-500">Color luz</span>
                <input
                    type="color"
                    value={fixture.lightColor ?? '#fff5e1'}
                    onChange={(event) =>
                        onUpdate({ lightColor: event.target.value })
                    }
                    className="h-5 w-8 cursor-pointer rounded border border-gray-700/50 bg-transparent"
                />
            </div>

            <div className="mt-3 flex gap-2">
                <button
                    type="button"
                    onClick={() => store.centerFixtureInRoom(fixture.id)}
                    className="flex flex-1 items-center justify-center gap-2 rounded border border-amber-700/50 bg-amber-950/40 py-1.5 text-[10px] text-amber-200 transition-colors hover:bg-amber-800/40"
                    title="Centrar esta luminaria en el recinto"
                >
                    <Target size={13} />
                    Centrar
                </button>

                {fixture.roomId && (
                    <button
                        type="button"
                        onClick={() => store.setTool('fixture-grid')}
                        className="flex flex-1 items-center justify-center gap-2 rounded border border-emerald-700/30 bg-emerald-950/40 py-1.5 text-[10px] text-emerald-200 transition-colors hover:bg-emerald-900/40"
                        title="Abrir herramienta de grilla para este recinto"
                    >
                        <Grid size={13} />
                        Nueva Grilla
                    </button>
                )}
            </div>

            <PropField label="ID" value={fixture.id.slice(0, 12)} />
        </SectionWrapper>
    );
};

const PartitionProps: React.FC<{
    partition: Partition;
    onUpdate: (patch: Partial<Omit<Partition, 'id' | 'vertices'>>) => void;
}> = ({ partition, onUpdate }) => {
    return (
        <div className="max-h-[600px] space-y-3 overflow-y-auto">
            <SectionWrapper
                icon={<Minus size={12} className="text-orange-400" />}
                label="Partición / Separador"
            >
                <SelectField
                    label="Tipo"
                    value={partition.partitionType}
                    options={[
                        { value: 'melamine', label: 'Melamina (SS.HH)' },
                        { value: 'drywall', label: 'Drywall' },
                        { value: 'glass', label: 'Vidrio' },
                        { value: 'masonry', label: 'Ladrillo' },
                    ]}
                    onChange={(val) => onUpdate({ partitionType: val as any })}
                />
                <EditField
                    label="Grosor (m)"
                    value={partition.thickness}
                    min={0.01}
                    max={0.5}
                    step={0.01}
                    onChange={(val) => onUpdate({ thickness: val })}
                />
                <EditField
                    label="Altura (m)"
                    value={partition.height}
                    min={0.1}
                    max={10}
                    step={0.1}
                    onChange={(val) => onUpdate({ height: val })}
                />
                <EditField
                    label="Elevación base (m)"
                    value={partition.bottomGap}
                    min={0}
                    max={2}
                    step={0.05}
                    onChange={(val) => onUpdate({ bottomGap: val })}
                />
                <PropField label="ID" value={partition.id.slice(0, 12)} />
            </SectionWrapper>
        </div>
    );
};

const SectionWrapper: React.FC<{
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
}> = ({ icon, label, children }) => (
    <div className="space-y-2.5">
        <div className="mb-1 flex items-center gap-2">
            {icon}
            <p className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase">
                {label}
            </p>
        </div>
        {children}
    </div>
);

const PropField: React.FC<{ label: string; value: string; mono?: boolean }> = ({
    label,
    value,
    mono = true,
}) => (
    <div className="flex items-center justify-between gap-2 border-b border-gray-800/40 pb-1.5">
        <span className="text-[10px] text-gray-500">{label}</span>
        <span
            className={`text-right text-[11px] text-gray-200 ${mono ? 'font-mono' : 'font-medium'}`}
        >
            {value}
        </span>
    </div>
);

const EditField: React.FC<{
    label: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    onChange: (value: number) => void;
}> = ({ label, value, min, max, step = 0.1, onChange }) => (
    <div className="flex items-center justify-between gap-2 border-b border-gray-800/40 pb-1.5">
        <span className="shrink-0 text-[10px] text-gray-500">{label}</span>
        <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(event) => {
                const nextValue = parseFloat(event.target.value);
                if (!Number.isNaN(nextValue)) onChange(nextValue);
            }}
            className="w-20 rounded border border-gray-700/50 bg-gray-800/80 px-1.5 py-0.5 text-right font-mono text-[11px] text-gray-200 focus:border-blue-600/50 focus:outline-none"
        />
    </div>
);

const TextField: React.FC<{
    label: string;
    value: string;
    onChange: (value: string) => void;
}> = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between gap-2 border-b border-gray-800/40 pb-1.5">
        <span className="shrink-0 text-[10px] text-gray-500">{label}</span>
        <input
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="w-32 rounded border border-gray-700/50 bg-gray-800/80 px-1.5 py-0.5 text-right text-[11px] text-gray-200 focus:border-blue-600/50 focus:outline-none"
        />
    </div>
);

const SelectField: React.FC<{
    label: string;
    value: string;
    options: Array<{ value: string; label: string }>;
    placeholder?: string;
    onChange: (value: string) => void;
}> = ({ label, value, options, placeholder = 'Selecciona', onChange }) => (
    <div className="flex min-w-0 items-center justify-between gap-2 border-b border-gray-800/40 pb-1.5">
        <span className="shrink-0 truncate text-[10px] text-gray-500">
            {label}
        </span>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="max-w-[120px] min-w-0 flex-1 truncate rounded border border-gray-700/50 bg-gray-800/80 px-1.5 py-0.5 text-right text-[11px] text-gray-200 focus:border-blue-600/50 focus:outline-none"
        >
            <option value="">{placeholder}</option>
            {options.map((o) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    </div>
);
