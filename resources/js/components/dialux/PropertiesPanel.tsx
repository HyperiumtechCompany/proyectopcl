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
    pointInPolygon,
} from '@/hooks/dialux/ambientSpaces';
import {
    calculatePolygonArea,
    calculatePolygonPerimeter,
    calculateLumensRequired,
    calculateExactQuantity,
    calculateRoundedQuantity,
} from '@/hooks/dialux/lightingCalculations';
import {
    NORMATIVE_LABELS,
    buildRoomLightingInputs,
    getFixturesForRoom,
    getCategoryOptions,
    getSectionOptions,
    getActivityOptions,
} from '@/hooks/dialux/roomLighting';
import type { NormativeStandard } from '@/hooks/dialux/roomLighting';
import type {
    CorridorType,
    Partition,
    StairConfig,
    StairFlight,
    LightSwitch,
    Conductor,
    ElectricalDevice,
} from '@/hooks/dialux/types';
import { CONDUCTOR_WIRE_OPTIONS } from '@/hooks/dialux/types';
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

const CORRIDOR_TYPE_OPTIONS: Array<{ value: CorridorType; label: string }> = [
    { value: 'roof_only', label: 'Solo techo' },
    { value: 'normal', label: 'Normal' },
    { value: 'roof_floor', label: 'Techo y piso' },
    { value: 'concrete_railings', label: 'Baranda cemento' },
    { value: 'metal_railings', label: 'Baranda metal' },
    { value: 'ramp', label: 'Rampa' },
    { value: 'sidewalk', label: 'Vereda (Piso sin barandas)' },
];

function LightSwitchProps({
    lightSwitch,
    onUpdate,
}: {
    lightSwitch: LightSwitch;
    onUpdate: (patch: Partial<LightSwitch>) => void;
}) {
    return (
        <div className="flex flex-col gap-3">
            <SectionWrapper label="Interruptor" icon={<Zap size={15} />}>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <SelectField
                        label="Tipo"
                        value={lightSwitch.type}
                        onChange={(val) => onUpdate({ type: val as any })}
                        options={[
                            { value: 'single', label: 'Simple S(f)' },
                            { value: 'double', label: 'Doble 2Sc(d,3)' },
                            { value: 'two-way', label: 'Conmutado Sc(c)' },
                        ]}
                    />
                    <EditField
                        label="Altura (m)"
                        value={lightSwitch.mountingHeight}
                        onChange={(val) => onUpdate({ mountingHeight: val })}
                        step={0.05}
                    />
                </div>
            </SectionWrapper>
            {(lightSwitch.connectedFixtureIds?.length ?? 0) > 0 && (
                <SectionWrapper label="Conexiones" icon={<Zap size={15} />}>
                    <div className="flex flex-col gap-1">
                        {lightSwitch.connectedFixtureIds.map(fid => (
                            <div key={fid} className="flex items-center justify-between text-[10px] bg-slate-50 p-1 rounded border">
                                <span>Luminaria {fid.slice(0,4)}...</span>
                                <button
                                    onClick={() => onUpdate({
                                        connectedFixtureIds: lightSwitch.connectedFixtureIds.filter(id => id !== fid)
                                    })}
                                    className="text-red-500 hover:text-red-700 px-1"
                                    title="Desconectar"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                </SectionWrapper>
            )}
        </div>
    );
}

function ConductorProps({
    conductor,
    onUpdate,
    onDelete,
}: {
    conductor: Conductor;
    onUpdate: (patch: Partial<Omit<Conductor, 'id'>>) => void;
    onDelete: () => void;
}) {
    const store = useEditorStore();
    const wireOptions = CONDUCTOR_WIRE_OPTIONS.map(({ value, label }) => ({
        value,
        label,
    }));
    
    // Find connected nodes
    const scene = store.activeScene();
    const sourceNode = scene?.lightSwitches.find(s => s.id === conductor.sourceId) || scene?.fixtures.find(f => f.id === conductor.sourceId) || scene?.electricalDevices?.find(d => d.id === conductor.sourceId);
    const targetNode = scene?.lightSwitches.find(s => s.id === conductor.targetId) || scene?.fixtures.find(f => f.id === conductor.targetId) || scene?.electricalDevices?.find(d => d.id === conductor.targetId);

    const getNodeLabel = (node: any) => {
        if (!node) return 'Desconocido';
        if ('name' in node) return node.name; // Fixture
        if ('label' in node) return node.label; // Device
        return `Interruptor ${node.type}`; // Switch
    };

    return (
        <div className="flex flex-col gap-3">
            <SectionWrapper label="Conductor" icon={<Zap size={15} />}>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <SelectField
                        label="N° Conductores"
                        value={conductor.wireLabel ?? ''}
                        onChange={(val) => {
                            const option = CONDUCTOR_WIRE_OPTIONS.find(
                                (item) => item.value === val,
                            );
                            if (!option) return;
                            onUpdate({
                                wireCount: option.count,
                                wireLabel: option.value,
                            });
                        }}
                        options={wireOptions}
                    />
                    <SelectField
                        label="Ruta"
                        value={conductor.routeType}
                        onChange={(val) => onUpdate({ routeType: val as Conductor['routeType'] })}
                        options={[
                            { value: 'wall_ceiling', label: 'Pared/Techo' },
                            { value: 'floor', label: 'Piso' },
                        ]}
                    />
                    <SelectField
                        label="Tipo"
                        value={conductor.conductorType}
                        onChange={(val) => onUpdate({ conductorType: val })}
                        options={[
                            { value: 'THW-90', label: 'THW-90' },
                            { value: 'N2XOH', label: 'N2XOH (LSOH)' },
                            { value: 'Cu LSOH', label: 'Cu LSOH' },
                            { value: 'NYY', label: 'NYY' },
                        ]}
                    />
                    <SelectField
                        label="Ø Tubo (mm)"
                        value={String(conductor.tubeSize)}
                        onChange={(val) => onUpdate({ tubeSize: parseInt(val) })}
                        options={[
                            { value: '16', label: 'Ø16 mm' },
                            { value: '20', label: 'Ø20 mm' },
                            { value: '25', label: 'Ø25 mm' },
                            { value: '32', label: 'Ø32 mm' },
                        ]}
                    />
                </div>
                <div className="mt-2 text-[10px] text-gray-500 bg-slate-900/50 p-1.5 rounded">
                    <p className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-gray-400">Origen:</span>
                        <span className="truncate max-w-[120px]">{getNodeLabel(sourceNode)}</span>
                    </p>
                    <p className="flex justify-between items-center">
                        <span className="font-semibold text-gray-400">Destino:</span>
                        <span className="truncate max-w-[120px]">{getNodeLabel(targetNode)}</span>
                    </p>
                </div>
            </SectionWrapper>
            <button
                type="button"
                onClick={onDelete}
                className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-red-400 hover:bg-red-900/20 hover:text-red-300"
            >
                <Trash2 size={11} /> Eliminar conductor
            </button>
        </div>
    );
}

function ElectricalDeviceProps({
    device,
    onUpdate,
}: {
    device: ElectricalDevice;
    onUpdate: (patch: Partial<ElectricalDevice>) => void;
}) {
    return (
        <div className="flex flex-col gap-3">
            <SectionWrapper label={`Equipo: ${device.type}`} icon={<Zap size={15} />}>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <SelectField
                        label="Tipo"
                        value={device.type}
                        onChange={(val) => onUpdate({ type: val as any })}
                        options={[
                            { value: 'meter', label: 'Medidor' },
                            { value: 'main_panel', label: 'Tablero General (TG)' },
                            { value: 'sub_panel', label: 'Tablero Distribución (TD)' },
                            { value: 'transfer_switch', label: 'Transferencia (ATS)' },
                            { value: 'arrival_panel', label: 'T. Llegada (TL)' },
                            { value: 'junction_box', label: 'Caja de Pase' },
                            { value: 'earth_pit', label: 'Pozo a Tierra (PAT)' },
                            { value: 'facp', label: 'Contraincendios (FACP)' },
                            { value: 'outlet_floor', label: 'Tomacorriente Bajo' },
                            { value: 'outlet_waterproof', label: 'Tomacorriente Agua' },
                            { value: 'outlet_ceiling', label: 'Tomacorriente Techo' },
                            { value: 'outlet_rack', label: 'Tomacorriente Rack' },
                        ]}
                    />
                    <div className="col-span-2">
                        <label className="mb-1 block text-[10px] font-medium text-gray-700">
                            Etiqueta (Opcional)
                        </label>
                        <input
                            type="text"
                            value={device.label ?? ''}
                            onChange={(e) => onUpdate({ label: e.target.value })}
                            placeholder="Ej. TD-1"
                            className="w-full rounded border px-2 py-1 text-xs"
                        />
                    </div>
                </div>
            </SectionWrapper>

            {/* Conexiones */}
            <SectionWrapper label="Conexiones Eléctricas" icon={<Move size={15} />}>
                <div className="flex flex-col gap-2">
                    {/* Luminarias */}
                    {(device.connectedFixtureIds?.length ?? 0) > 0 && (
                        <div>
                            <p className="text-[10px] font-medium text-gray-500">Luminarias (Salidas)</p>
                            <div className="flex flex-col gap-1 mt-1">
                                {device.connectedFixtureIds!.map(id => (
                                    <div key={id} className="flex items-center justify-between text-[10px] bg-slate-50 p-1 rounded border">
                                        <span>Luminaria {id.slice(0,4)}...</span>
                                        <button onClick={() => onUpdate({ connectedFixtureIds: device.connectedFixtureIds!.filter(x => x !== id) })} className="text-red-500 px-1"><Trash2 size={12} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Interruptores */}
                    {(device.connectedSwitchIds?.length ?? 0) > 0 && (
                        <div>
                            <p className="text-[10px] font-medium text-gray-500">Interruptores</p>
                            <div className="flex flex-col gap-1 mt-1">
                                {device.connectedSwitchIds!.map(id => (
                                    <div key={id} className="flex items-center justify-between text-[10px] bg-slate-50 p-1 rounded border">
                                        <span>Interruptor {id.slice(0,4)}...</span>
                                        <button onClick={() => onUpdate({ connectedSwitchIds: device.connectedSwitchIds!.filter(x => x !== id) })} className="text-red-500 px-1"><Trash2 size={12} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Dispositivos */}
                    {(device.connectedDeviceIds?.length ?? 0) > 0 && (
                        <div>
                            <p className="text-[10px] font-medium text-gray-500">Otros Equipos / Tableros</p>
                            <div className="flex flex-col gap-1 mt-1">
                                {device.connectedDeviceIds!.map(id => (
                                    <div key={id} className="flex items-center justify-between text-[10px] bg-slate-50 p-1 rounded border">
                                        <span>Equipo {id.slice(0,4)}...</span>
                                        <button onClick={() => onUpdate({ connectedDeviceIds: device.connectedDeviceIds!.filter(x => x !== id) })} className="text-red-500 px-1"><Trash2 size={12} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {(device.connectedFixtureIds?.length ?? 0) === 0 && (device.connectedSwitchIds?.length ?? 0) === 0 && (device.connectedDeviceIds?.length ?? 0) === 0 && (
                        <p className="text-[10px] text-gray-400 italic">No hay conexiones a este equipo. Usa la herramienta U (Wire) para conectar.</p>
                    )}
                </div>
            </SectionWrapper>
        </div>
    );
}

function VirtualWireProps({
    wireId,
    device,
    onUpdate,
    onDelete,
}: {
    wireId: string;
    device: ElectricalDevice;
    onUpdate: (patch: any) => void;
    onDelete: () => void;
}) {
    const props = device.wireProps?.[wireId] ?? {
        wireCount: wireId.includes('dev-dev') ? 3 : 2,
        routeType: wireId.includes('dev-sw') ? 'wall_ceiling' : 'floor',
        tubeSize: 20,
        conductorType: 'THW-90',
    };

    const wireOptions = CONDUCTOR_WIRE_OPTIONS.map(({ value, label }) => ({
        value,
        label,
    }));

    return (
        <div className="flex flex-col gap-3">
            <SectionWrapper label="Conductor de Tablero/Equipo" icon={<Zap size={15} />}>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <SelectField
                        label="N° Conductores"
                        value={props.wireLabel ?? ''}
                        onChange={(val) => {
                            const option = CONDUCTOR_WIRE_OPTIONS.find(item => item.value === val);
                            if (!option) return;
                            onUpdate({
                                ...props,
                                wireCount: option.count,
                                wireLabel: option.value,
                            });
                        }}
                        options={wireOptions}
                    />
                    <SelectField
                        label="Ruta"
                        value={props.routeType}
                        onChange={(val) => onUpdate({ ...props, routeType: val as any })}
                        options={[
                            { value: 'wall_ceiling', label: 'Pared/Techo' },
                            { value: 'floor', label: 'Piso' },
                        ]}
                    />
                    <SelectField
                        label="Tipo"
                        value={props.conductorType}
                        onChange={(val) => onUpdate({ ...props, conductorType: val })}
                        options={[
                            { value: 'THW-90', label: 'THW-90' },
                            { value: 'N2XOH', label: 'N2XOH (LSOH)' },
                            { value: 'Cu LSOH', label: 'Cu LSOH' },
                            { value: 'NYY', label: 'NYY' },
                        ]}
                    />
                    <SelectField
                        label="Ø Tubo (mm)"
                        value={String(props.tubeSize)}
                        onChange={(val) => onUpdate({ ...props, tubeSize: parseInt(val) })}
                        options={[
                            { value: '16', label: 'Ø16 mm' },
                            { value: '20', label: 'Ø20 mm' },
                            { value: '25', label: 'Ø25 mm' },
                            { value: '32', label: 'Ø32 mm' },
                        ]}
                    />
                </div>
            </SectionWrapper>
            <button
                type="button"
                onClick={onDelete}
                className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-red-400 hover:bg-red-900/20 hover:text-red-300"
            >
                <Trash2 size={11} /> Eliminar conexión
            </button>
        </div>
    );
}

export const PropertiesPanel = React.memo(function PropertiesPanel() {
    const store = useEditorStore();
    const scene = store.activeScene();
    const selectedId = store.ui.selectedId;
    const selectedFixtureIds = store.ui.selectedFixtureIds;

    if (!selectedId && selectedFixtureIds.length === 0) {
        return (
            <div className="px-2 py-6 text-center">
                <p className="text-[10px] text-gray-600">
                    Selecciona un objeto para ver sus propiedades
                </p>
            </div>
        );
    }

    if (selectedId?.startsWith('wire:dev-') && scene) {
        const [, , sourceId, targetId] = selectedId.split(':');
        const device = scene.electricalDevices?.find(d => d.id === sourceId);
        if (device) {
            return (
                <VirtualWireProps
                    wireId={selectedId}
                    device={device}
                    onUpdate={(patch) => {
                        store.updateElectricalDevice(device.id, {
                            wireProps: {
                                ...(device.wireProps ?? {}),
                                [selectedId]: {
                                    ...(device.wireProps?.[selectedId] ?? {
                                        wireCount: selectedId.includes('dev-dev') ? 3 : 2,
                                        routeType: selectedId.includes('dev-sw') ? 'wall_ceiling' : 'floor',
                                        tubeSize: 20,
                                        conductorType: 'THW-90',
                                    }),
                                    ...patch
                                }
                            }
                        });
                    }}
                    onDelete={() => store.removeObject(selectedId)}
                />
            );
        }
    }

    if (selectedFixtureIds.length > 1 && scene) {
        const firstFixture = scene.fixtures.find(f => f.id === selectedFixtureIds[0]);
        if (firstFixture) {
            return (
                <FixtureProps
                    fixture={firstFixture}
                    onUpdate={(patch) => store.updateFixtures(selectedFixtureIds, patch)}
                    multiple={true}
                    count={selectedFixtureIds.length}
                />
            );
        }
    }

    const room = scene?.rooms.find((r) => r.id === selectedId);
    const wall = scene?.walls.find((w) => w.id === selectedId);
    const win = scene?.windows.find((w) => w.id === selectedId);
    const door = scene?.doors.find((d) => d.id === selectedId);
    const canopy = scene?.canopies.find((c) => c.id === selectedId);
    const fixture = scene?.fixtures.find((f) => f.id === selectedId);
    const partition = scene?.partitions?.find((p) => p.id === selectedId);
    const lightSwitch = scene?.lightSwitches?.find((s) => s.id === selectedId);
    const conductor = scene?.conductors?.find((c) => c.id === selectedId);
    const electricalDevice = scene?.electricalDevices?.find((d) => d.id === selectedId);

    if (electricalDevice) {
        return (
            <ElectricalDeviceProps
                device={electricalDevice}
                onUpdate={(patch) => store.updateElectricalDevice(electricalDevice.id, patch)}
            />
        );
    }

    if (conductor) {
        return (
            <ConductorProps
                conductor={conductor}
                onUpdate={(patch) => store.updateConductor(conductor.id, patch)}
                onDelete={() => store.removeObject(conductor.id)}
            />
        );
    }

    if (partition) {
        return (
            <PartitionProps
                partition={partition}
                onUpdate={(patch) => store.updatePartition(partition.id, patch)}
            />
        );
    }

    if (lightSwitch) {
        return (
            <LightSwitchProps
                lightSwitch={lightSwitch}
                onUpdate={(patch) => store.updateLightSwitch(lightSwitch.id, patch)}
            />
        );
    }

    if (room) {
        const corridorAmbient =
            room.roomType === 'corridor'
                ? (deriveSceneAmbientSpaces(scene!).find(
                      (ambient) => ambient.sourceRoom.id === room.id,
                  ) ?? null)
                : null;
        const parentRoom = corridorAmbient
            ? (scene!.rooms.find(
                  (candidate) => candidate.id === corridorAmbient.roomId,
              ) ?? null)
            : null;

        return (
            <RoomProps
                room={room}
                scene={scene!}
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
                multiple={false}
                count={1}
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

const WallInteriorLightingSection: React.FC<{
    wall: Wall;
    scene: Scene | null;
    onUpdate: (patch: Partial<Omit<Wall, 'id'>>) => void;
}> = ({ wall, scene, onUpdate }) => {
    const store = useEditorStore();
    const standard = store.defaultRoomNormativeStandard as NormativeStandard;

    const verts = wall.vertices;
    let wallLen = 0;
    for (let i = 1; i < verts.length; i++) {
        wallLen += Math.hypot(verts[i].x - verts[i - 1].x, verts[i].y - verts[i - 1].y);
    }
    const wallArea = wallLen * wall.height;

    const cats = getCategoryOptions(standard);
    const sects = getSectionOptions(standard, wall.normativeCategory);
    const activities = getActivityOptions(standard, wall.normativeCategory, wall.normativeSection);

    const lux = wall.illuminanceLux ?? 300;
    const fixLumens = wall.fixtureLumens ?? 4000;
    const lumensReq = calculateLumensRequired(wallArea, lux);
    const exactQty = calculateExactQuantity(lumensReq, fixLumens);
    const roundedQty = calculateRoundedQuantity(exactQty);

    const mid = React.useMemo(() =>
        verts.length >= 2
            ? { x: (verts[0].x + verts[verts.length - 1].x) / 2, y: (verts[0].y + verts[verts.length - 1].y) / 2 }
            : verts[0],
        [verts]);

    const parentAmbient = React.useMemo(() =>
        scene?.rooms.find(r =>
            (r.roomType === 'ambient' || r.roomType === 'corridor') &&
            pointInPolygon(mid, r.vertices),
        ) ?? null,
        [scene, mid]);

    const fixturesInArea = React.useMemo(() => {
        if (!scene || !parentAmbient) return [];
        return scene.fixtures.filter(f => pointInPolygon({ x: f.x, y: f.y }, parentAmbient.vertices));
    }, [scene, parentAmbient]);

    const wallPolygon = React.useMemo(() => {
        if (verts.length < 2) return null;
        const ax = verts[0].x, ay = verts[0].y;
        const bx = verts[verts.length - 1].x, by = verts[verts.length - 1].y;
        const len = Math.hypot(bx - ax, by - ay);
        if (len < 0.01) return null;
        const dx = (bx - ax) / len, dy = (by - ay) / len;
        const px = dy, py = -dx;
        const depth = Math.max(wall.thickness * 2, 1.5);
        return [
            { x: ax, y: ay },
            { x: bx, y: by },
            { x: bx + px * depth, y: by + py * depth },
            { x: ax + px * depth, y: ay + py * depth },
        ];
    }, [verts, wall.thickness]);

    const handleGenerate = () => {
        const fixtureTemplate = {
            ...store.ui.fixtureTemplate,
            ...(wall.fixtureType ? { fixtureType: wall.fixtureType } : {}),
            ...(wall.fixtureShape ? { fixtureShape: wall.fixtureShape } : {}),
            ...(wall.fixtureLumens ? { lumens: wall.fixtureLumens } : {}),
        };
        // Generate the grid over the wall's area, and assign it to the parent room if possible.
        // If the wall is within an ambient, we assign it to that ambient's source room.
        const parentRoomId = parentAmbient?.id ?? scene?.rooms.find(r => pointInPolygon(mid, r.vertices))?.id ?? null;
        
        const newIds = wallPolygon
            ? store.addFixtureGrid({ roomId: parentRoomId, rows: store.ui.fixtureGridRows, columns: store.ui.fixtureGridCols, fixtureTemplate, ambientVertices: wallPolygon })
            : [];
        if (newIds.length > 0) {
            store.setSelectedId(null);
            store.setSelectedFixtureIds(newIds);
        }
    };

    return (
        <div className="mt-3 space-y-2.5 border-t border-gray-700/50 pt-3">
            <div className="flex items-center gap-2">
                <Zap size={12} className="text-yellow-400" />
                <p className="text-[10px] font-semibold tracking-widest text-gray-500 uppercase">Iluminación</p>
            </div>

            <PropField label="Estándar" value={NORMATIVE_LABELS[standard]} mono={false} />
            <PropField label="Área pared" value={`${wallArea.toFixed(2)} m²`} />

            <SelectField
                label="Sección / Área"
                value={wall.normativeCategory ?? ''}
                options={cats.map(c => ({ value: c, label: c }))}
                onChange={(val) => onUpdate({ normativeCategory: val, normativeSection: undefined, normativeActivity: undefined })}
            />
            {wall.normativeCategory && (
                <SelectField
                    label="Subsección"
                    value={wall.normativeSection ?? ''}
                    options={sects.map(s => ({ value: s, label: s }))}
                    onChange={(val) => onUpdate({ normativeSection: val, normativeActivity: undefined })}
                />
            )}
            {wall.normativeSection && (
                <SelectField
                    label="Aplicación"
                    value={wall.normativeActivity ?? ''}
                    options={activities.map(a => ({ value: a.activity, label: a.activity }))}
                    onChange={(val) => {
                        const act = activities.find(a => a.activity === val);
                        onUpdate({ normativeActivity: val, illuminanceLux: act?.illuminanceLux ?? lux });
                    }}
                />
            )}

            <EditField label="Iluminancia (lux)" value={lux} min={10} max={2000} step={10}
                onChange={(val) => onUpdate({ illuminanceLux: val })} />

            <div className="flex items-center justify-between">
                <PropField label="Luminarias" value={`${fixturesInArea.length}`} />
                {fixturesInArea.length > 0 && (
                    <button type="button"
                        onClick={() => { store.setSelectedId(null); store.setSelectedFixtureIds(fixturesInArea.map(f => f.id)); }}
                        className="ml-2 rounded bg-blue-600/20 px-2 py-0.5 text-[10px] text-blue-400 hover:bg-blue-600/40">
                        Seleccionar
                    </button>
                )}
            </div>
            <PropField label="Lm requeridos" value={`${lumensReq.toFixed(0)} lm`} />
            <PropField label="Cant. óptima" value={exactQty.toFixed(2)} />
            <PropField label="Cant. simetría" value={`${roundedQty}`} />

            <EditField label="Lm/foco" value={fixLumens} min={100} max={50000} step={100}
                onChange={(val) => onUpdate({ fixtureLumens: val })} />
            <SelectField label="Tipo foco"
                value={wall.fixtureType ?? 'recessed'}
                options={[
                    { value: 'recessed', label: 'Empotrada' },
                    { value: 'surface', label: 'Superficie' },
                    { value: 'pendant', label: 'Colgante' },
                    { value: 'spot', label: 'Spot' },
                    { value: 'strip', label: 'Tira LED' },
                    { value: 'panel', label: 'Panel LED' },
                    { value: 'tube', label: 'Tubo' },
                ]}
                onChange={(val) => onUpdate({ fixtureType: val as Wall['fixtureType'] })} />
            <SelectField label="Forma foco"
                value={wall.fixtureShape ?? 'round'}
                options={[
                    { value: 'round', label: 'Redonda' },
                    { value: 'square', label: 'Cuadrada' },
                    { value: 'rectangular', label: 'Rectangular' },
                    { value: 'cylindrical', label: 'Cilíndrica' },
                ]}
                onChange={(val) => onUpdate({ fixtureShape: val as Wall['fixtureShape'] })} />

            <div className="mt-3 border-t border-gray-700/50 pt-2">
                <div className="flex items-center gap-2 text-emerald-500 mb-2">
                    <Grid size={12} />
                    <p className="text-[10px] font-semibold uppercase">Grilla sobre Pared</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <EditField label="Filas" value={store.ui.fixtureGridRows} min={1} max={20} step={1}
                        onChange={(val) => store.setFixtureGridRows(val)} />
                    <EditField label="Columnas" value={store.ui.fixtureGridCols} min={1} max={20} step={1}
                        onChange={(val) => store.setFixtureGridCols(val)} />
                </div>
                <button type="button" onClick={handleGenerate}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded bg-emerald-600/20 py-1.5 text-[10px] font-medium text-emerald-400 hover:bg-emerald-600/30 transition-colors">
                    <Grid size={11} />
                    Generar en Pared {store.ui.fixtureGridRows}×{store.ui.fixtureGridCols}
                </button>
                <p className="text-[9px] text-gray-500 mt-1 leading-snug">
                    Genera una grilla de focos pegada a la superficie de esta pared (ej. apliques).
                </p>
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
            label={ambientMatch ? 'Ambiente • Pared' : 'Pared'}
        >
            {/* Tipo de muro: solo lectura (se elige en el Toolbar) */}
            <PropField
                label="Tipo"
                value={
                    wall.wallType === 'cerco'
                        ? 'Cerco perimétrico'
                        : wall.wallType === 'exterior'
                          ? 'Exterior'
                          : 'Interior'
                }
                mono={false}
            />
            <PropField label="Longitud" value={`${len.toFixed(4)} m`} />
            <PropField
                label="Superficie"
                value={`${(len * wall.height).toFixed(4)} m²`}
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
                label="Estado"
                value={
                    wall.thickness >= preset.minThickness &&
                    wall.height >= preset.minHeight
                        ? '✅ Cumple'
                        : '⚠️ Revisar mínimos'
                }
                mono={false}
            />

            {/* Sección de ambiente (grilla de focos) */}
            {ambientMatch && (
                <>
                    <div className="my-1 border-t border-gray-700/50 pt-1">
                        <p className="mb-1 text-[10px] font-semibold text-cyan-500">
                            Ambiente: {ambientMatch.name}
                        </p>
                    </div>
                    <TextField
                        label="Nombre"
                        value={
                            ambientMatch.sourceRoom.ambientConfigs?.[
                                ambientMatch.configKey
                            ]?.name ?? ambientMatch.name
                        }
                        onChange={(value) =>
                            updateAmbientConfig({ name: value })
                        }
                    />
                    <PropField
                        label="Área ambiente"
                        value={`${ambientMatch.area.toFixed(4)} m²`}
                    />
                    <div className="flex items-center justify-between">
                        <PropField
                            label="Luminarias"
                            value={`${ambientMatch.fixtures.length}`}
                        />
                        {ambientMatch.fixtures.length > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    store.setSelectedId(null);
                                    store.setSelectedFixtureIds(ambientMatch.fixtures.map((f) => f.id));
                                }}
                                className="ml-2 rounded bg-blue-600/20 px-2 py-0.5 text-[10px] text-blue-400 hover:bg-blue-600/40"
                            >
                                Seleccionar Todas
                            </button>
                        )}
                    </div>
                    <div className="my-2 space-y-1 border-t border-gray-800/80 pt-2">
                        <div className="flex items-center gap-2 text-emerald-500">
                            <Grid size={12} />
                            <p className="text-[10px] font-semibold uppercase">
                                Grilla de focos
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
                            onClick={() => {
                                const newIds = store.addFixtureGrid({
                                    roomId: ambientMatch.sourceRoom.id,
                                    rows: store.ui.fixtureGridRows,
                                    columns: store.ui.fixtureGridCols,
                                    fixtureTemplate: store.ui.fixtureTemplate,
                                    ambientVertices: ambientMatch.room.vertices,
                                });
                                if (newIds.length > 0) {
                                    store.setSelectedId(null);
                                    store.setSelectedFixtureIds(newIds);
                                } else {
                                    alert("No se pudo generar la grilla. Asegúrese de que el ambiente esté cerrado y tenga un área válida.");
                                }
                            }}
                            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded bg-emerald-600/20 py-1.5 text-[10px] font-medium text-emerald-400 hover:bg-emerald-600/30 transition-colors"
                        >
                            Generar en Techo de Ambiente {store.ui.fixtureGridRows}x{store.ui.fixtureGridCols}
                        </button>
                        <p className="text-[9px] text-gray-500 mt-1 leading-snug">
                            Genera luminarias en el área de techo delimitada por esta pared.
                        </p>
                    </div>
                </>
            )}
            {wall.wallType === 'interior' && (
                <WallInteriorLightingSection
                    wall={wall}
                    scene={scene}
                    onUpdate={onUpdate}
                />
            )}
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
    multiple?: boolean;
    count?: number;
}> = ({ fixture, onUpdate, multiple, count }) => {
    const store = useEditorStore();
    return (
        <SectionWrapper
            icon={<Zap size={12} className="text-amber-400" />}
            label={multiple ? `Luminarias múltiples (${count})` : "Luminaria"}
        >
            <div className="mb-2 flex items-start gap-2 rounded border border-amber-700/50 bg-amber-900/20 p-2">
                <Move
                    size={14}
                    className="mt-0.5 flex-shrink-0 text-amber-400"
                />
                <p className="text-[9px] text-amber-300">
                    {multiple 
                        ? "Estás editando múltiples luminarias. Los cambios de posición afectarán a todas por igual."
                        : "Selecciona esta luminaria en el canvas y arrastrala para moverla dentro del recinto."}
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
                    onClick={() => {
                        if (multiple) {
                            store.ui.selectedFixtureIds.forEach(id => store.centerFixtureInRoom(id));
                        } else {
                            store.centerFixtureInRoom(fixture.id);
                        }
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded border border-amber-700/50 bg-amber-950/40 py-1.5 text-[10px] text-amber-200 transition-colors hover:bg-amber-800/40"
                    title={multiple ? "Centrar todas en sus recintos" : "Centrar esta luminaria en el recinto"}
                >
                    <Target size={13} />
                    Centrar
                </button>

                {!multiple && fixture.roomId && (
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

            {!multiple && <PropField label="ID" value={fixture.id.slice(0, 12)} />}
        </SectionWrapper>
    );
};

const PartitionProps: React.FC<{
    partition: Partition;
    onUpdate: (patch: Partial<Omit<Partition, 'id' | 'vertices'>>) => void;
}> = ({ partition, onUpdate }) => {
    const length = calculatePolygonPerimeter(partition.vertices, false);
    return (
        <div className="max-h-[600px] space-y-3 overflow-y-auto">
            <SectionWrapper
                icon={<Minus size={12} className="text-orange-400" />}
                label="Partición / Separador"
            >
                <PropField label="Longitud" value={`${length.toFixed(4)} m`} />
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

const PropField: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono = true }) => (
    <div className="flex items-center justify-between gap-2 border-b border-gray-800/40 pb-1.5">
        <span className="text-[10px] text-gray-500">{label}</span>
        <span className={`text-right text-[11px] text-gray-200 ${mono ? 'font-mono' : 'font-medium'}`}>
            {value}
        </span>
    </div>
);

const EditField: React.FC<{ label: string; value: number; min?: number; max?: number; step?: number; onChange: (value: number) => void;}> = ({ label, value, min, max, step = 0.1, onChange }) => (
    <div className="flex items-center justify-between gap-2 border-b border-gray-800/40 pb-1.5">
        <span className="shrink-0 text-[10px] text-gray-500">{label}</span>
        <input type="number" value={value} min={min} max={max} step={step}
            onChange={(event) => {
                const nextValue = parseFloat(event.target.value);
                if (!Number.isNaN(nextValue)) onChange(nextValue);
            }}
            className="w-20 rounded border border-gray-700/50 bg-gray-800/80 px-1.5 py-0.5 text-right font-mono text-[11px] text-gray-200 focus:border-blue-600/50 focus:outline-none"
        />
    </div>
);

const TextField: React.FC<{ label: string; value: string; onChange: (value: string) => void;}> = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between gap-2 border-b border-gray-800/40 pb-1.5">
        <span className="shrink-0 text-[10px] text-gray-500">{label}</span>
        <input type="text" value={value} onChange={(event) => onChange(event.target.value)} className="w-32 rounded border border-gray-700/50 bg-gray-800/80 px-1.5 py-0.5 text-right text-[11px] text-gray-200 focus:border-blue-600/50 focus:outline-none"/>
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
        <select value={value} onChange={(e) => onChange(e.target.value)} className="max-w-[120px] min-w-0 flex-1 truncate rounded border border-gray-700/50 bg-gray-800/80 px-1.5 py-0.5 text-right text-[11px] text-gray-200 focus:border-blue-600/50 focus:outline-none">
            <option value="">{placeholder}</option>
            {options.map((o) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    </div>
);
