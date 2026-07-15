import { Move, Trash2, Zap } from 'lucide-react';
import type {
    Conductor,
    ElectricalDevice,
    LightSwitch,
} from '@/pages/dialux/hooks/types';
import { CONDUCTOR_WIRE_OPTIONS } from '@/pages/dialux/hooks/types';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import { SectionWrapper, EditField, SelectField } from './PropertyFields';

export function LightSwitchProps({
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
                    <EditField
                        label="Rotación (°)"
                        value={lightSwitch.rotation ?? 0}
                        onChange={(val) => onUpdate({ rotation: ((val % 360) + 360) % 360 })}
                        step={5}
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

export function ConductorProps({
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

export function ElectricalDeviceProps({
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
                            { value: 'water_heater_30l', label: 'Terma Eléctrica 30L' },
                        ]}
                    />
                    <EditField
                        label="Rotación (°)"
                        value={device.rotation ?? 0}
                        onChange={(val) => onUpdate({ rotation: ((val % 360) + 360) % 360 })}
                        step={5}
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

export function VirtualWireProps({
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
