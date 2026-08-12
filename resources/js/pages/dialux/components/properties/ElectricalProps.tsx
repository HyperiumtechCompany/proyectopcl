import React from 'react';
import { Move, Trash2, Zap } from 'lucide-react';
import type {
    Conductor,
    ElectricalDevice,
    LightSwitch,
} from '@/pages/dialux/hooks/types';
import {
    CONDUCTOR_SECTION_OPTIONS,
    CONDUCTOR_WIRE_OPTIONS,
    DEFAULT_OUTLET_POWER_W,
    ELECTRICAL_DEVICE_DEFAULTS,
    isOutletDeviceType,
} from '@/pages/dialux/hooks/types';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import { calculateConductorGroupLength, resolveConductorRouteHeight } from '@/pages/dialux/hooks/wireLengthCalculations';
import { SectionWrapper, EditField, SelectField } from './PropertyFields';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select';

const connectionRowClass =
    'flex items-center justify-between rounded border border-slate-200 bg-white p-1 text-[10px] text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:shadow-none';

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
                <div className="flex flex-col gap-2 text-xs">
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
                        label="Altura instalada S.N.P.T. (m)"
                        value={lightSwitch.mountingHeight ?? 1.4}
                        onChange={(val) => onUpdate({ mountingHeight: val })}
                        min={0}
                        max={10}
                        step={0.05}
                    />
                    <EditField
                        label="Rotación (°)"
                        value={lightSwitch.rotation ?? 0}
                        onChange={(val) => onUpdate({ rotation: ((val % 360) + 360) % 360 })}
                        step={5}
                    />
                    <EditField
                        label="Escala del símbolo"
                        value={lightSwitch.symbolScale ?? 1}
                        onChange={(val) => onUpdate({ symbolScale: Math.max(0.25, val) })}
                        min={0.25}
                        max={5}
                        step={0.1}
                    />
                </div>
            </SectionWrapper>
            {(lightSwitch.connectedFixtureIds?.length ?? 0) > 0 && (
                <SectionWrapper label="Conexiones" icon={<Zap size={15} />}>
                    <div className="flex flex-col gap-1">
                        {lightSwitch.connectedFixtureIds.map(fid => (
                            <div key={fid} className={connectionRowClass}>
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
    circuitCount = 1,
    circuitConductorIds,
    onUpdate,
    onUpdateIndividual,
    onDelete,
}: {
    conductor: Conductor;
    circuitCount?: number;
    circuitConductorIds?: string[];
    onUpdate: (patch: Partial<Omit<Conductor, 'id'>>) => void;
    onUpdateIndividual?: (patch: Partial<Omit<Conductor, 'id'>>) => void;
    onDelete: () => void;
}) {
    const [applyToGroup, setApplyToGroup] = React.useState(true);
    const store = useEditorStore();
    // Find connected nodes
    const scene = store.activeScene();
    const sourceNode = scene?.lightSwitches.find(s => s.id === conductor.sourceId) || scene?.fixtures.find(f => f.id === conductor.sourceId) || scene?.electricalDevices?.find(d => d.id === conductor.sourceId);
    const targetNode = scene?.lightSwitches.find(s => s.id === conductor.targetId) || scene?.fixtures.find(f => f.id === conductor.targetId) || scene?.electricalDevices?.find(d => d.id === conductor.targetId);

    const connectsToSwitch = scene?.lightSwitches.some(s => s.id === conductor.sourceId || s.id === conductor.targetId) ?? false;

    const wireOptions = CONDUCTOR_WIRE_OPTIONS
        .filter(opt => !connectsToSwitch || opt.count <= 3)
        .map(({ value, label }) => ({
            value,
            label,
        }));

    const lengthM = scene
        ? calculateConductorGroupLength(
              scene,
              circuitConductorIds ?? [conductor.id],
          ).totalLengthM
        : null;
    const effectiveRouteHeightM = scene
        ? resolveConductorRouteHeight(scene, conductor)
        : (conductor.routeHeightM ?? 2.7);
    const automaticRouteHeightM = scene
        ? resolveConductorRouteHeight(scene, { ...conductor, routeHeightM: undefined })
        : 2.7;
    const usesAutomaticRouteHeight = conductor.routeHeightM === undefined || conductor.routeHeightM <= 0;

    const getNodeLabel = (node: any) => {
        if (!node) return 'Desconocido';
        if ('name' in node) return node.name; // Fixture
        if ('label' in node) return node.label; // Device
        return `Interruptor ${node.type}`; // Switch
    };

    return (
        <div className="flex flex-col gap-3">
            <SectionWrapper
                label={
                    circuitCount > 1
                        ? `Circuito seleccionado · ${circuitCount} tramos`
                        : 'Conductor'
                }
                icon={<Zap size={15} />}
            >
                {circuitCount > 1 && onUpdateIndividual && (
                    <div className="flex items-center gap-2 rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1.5 text-[10px] text-cyan-700 dark:text-cyan-300">
                        <input
                            type="checkbox"
                            checked={applyToGroup}
                            onChange={(e) => setApplyToGroup(e.target.checked)}
                            className="h-3 w-3 cursor-pointer rounded border-cyan-400 bg-transparent"
                            id="applyGroupToggle"
                        />
                        <label htmlFor="applyGroupToggle" className="cursor-pointer leading-tight">
                            Aplicar edición a toda la línea ({circuitCount} tramos). Desmarca para editar solo este conductor.
                        </label>
                    </div>
                )}
                <div className="flex flex-col gap-2 text-xs">
                    <SelectField
                        label="N° Conductores"
                        value={conductor.wireLabel ?? ''}
                        onChange={(val) => {
                            const option = CONDUCTOR_WIRE_OPTIONS.find(
                                (item) => item.value === val,
                            );
                            if (!option) return;
                            const patch = {
                                wireCount: option.count,
                                wireLabel: option.value,
                            };
                            if (applyToGroup || !onUpdateIndividual) onUpdate(patch);
                            else onUpdateIndividual(patch);
                        }}
                        options={wireOptions}
                    />
                    <SelectField
                        label="Ruta"
                        value={conductor.routeType}
                        onChange={(val) => {
                            const patch = { routeType: val as Conductor['routeType'] };
                            if (applyToGroup || !onUpdateIndividual) onUpdate(patch);
                            else onUpdateIndividual(patch);
                        }}
                        options={[
                            { value: 'wall_ceiling', label: 'Pared/Techo' },
                            { value: 'floor', label: 'Piso' },
                        ]}
                    />
                    {conductor.routeType === 'wall_ceiling' && (
                        <EditField
                            label={`Altura de ruta S.N.P.T. (m) · ${usesAutomaticRouteHeight ? 'automática' : 'manual'}`}
                            value={Number(effectiveRouteHeightM.toFixed(2))}
                            min={0}
                            max={20}
                            step={0.05}
                            onChange={(value) => {
                                const patch = { routeHeightM: value > 0 ? value : undefined };
                                if (applyToGroup || !onUpdateIndividual) onUpdate(patch);
                                else onUpdateIndividual(patch);
                            }}
                        />
                    )}
                    {conductor.routeType === 'wall_ceiling' && (
                        <button
                            type="button"
                            onClick={() => {
                                const patch = { routeHeightM: undefined };
                                if (applyToGroup || !onUpdateIndividual) onUpdate(patch);
                                else onUpdateIndividual(patch);
                            }}
                            className="w-full rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-left text-[10px] leading-snug text-cyan-700 transition-colors hover:bg-cyan-500/20 dark:text-cyan-300"
                        >
                            {usesAutomaticRouteHeight
                                ? `Usando techo del recinto: ${effectiveRouteHeightM.toFixed(2)} m`
                                : `Restablecer al techo automático (${automaticRouteHeightM.toFixed(2)} m)`}
                        </button>
                    )}
                    <SelectField
                        label="Tipo"
                        value={conductor.conductorType}
                        onChange={(val) => {
                            const patch = { conductorType: val };
                            if (applyToGroup || !onUpdateIndividual) onUpdate(patch);
                            else onUpdateIndividual(patch);
                        }}
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
                        onChange={(val) => {
                            const patch = { tubeSize: Number.parseFloat(val) };
                            if (applyToGroup || !onUpdateIndividual) onUpdate(patch);
                            else onUpdateIndividual(patch);
                        }}
                        options={[
                            { value: '16', label: 'Ø16 mm' },
                            { value: '20', label: 'Ø20 mm' },
                            { value: '25', label: 'Ø25 mm' },
                            { value: '32', label: 'Ø32 mm' },
                        ]}
                    />
                    <SelectField
                        label="Sección cable"
                        value={String(conductor.sectionMm2 ?? 2.5)}
                        onChange={(val) => {
                            const patch = { sectionMm2: Number.parseFloat(val) };
                            if (applyToGroup || !onUpdateIndividual) onUpdate(patch);
                            else onUpdateIndividual(patch);
                        }}
                        options={CONDUCTOR_SECTION_OPTIONS.map(({ value, label }) => ({ value: String(value), label }))}
                    />
                </div>
                <div className="mt-2 rounded bg-slate-100 p-1.5 text-[10px] text-slate-600 dark:bg-slate-900/50 dark:text-gray-500">
                    <p className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-slate-500 dark:text-gray-400">Origen:</span>
                        <span className="truncate max-w-[120px]">{getNodeLabel(sourceNode)}</span>
                    </p>
                    <p className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-slate-500 dark:text-gray-400">Destino:</span>
                        <span className="truncate max-w-[120px]">{getNodeLabel(targetNode)}</span>
                    </p>
                    <p className="flex justify-between items-center">
                        <span className="font-semibold text-slate-500 dark:text-gray-400">
                            {circuitCount > 1 ? 'Longitud total:' : 'Longitud:'}
                        </span>
                        <span>{lengthM !== null ? `${lengthM.toFixed(2)} m` : '—'}</span>
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
    const isPanel = device.type === 'main_panel' || device.type === 'sub_panel';
    const isOutlet = isOutletDeviceType(device.type);
    const project = useEditorStore((state) => state.project);
    const setProject = useEditorStore((state) => state.setProject);
    const allPanels = (project?.scenes ?? []).flatMap((scene) =>
        (scene.electricalDevices ?? [])
            .map((candidate) => ({
                device: candidate,
                scene,
            }))
            .filter(({ device: candidate }) => candidate.type === 'main_panel' || candidate.type === 'sub_panel'),
    );
    const wouldCreateCycle = (candidateId: string): boolean => {
        let currentId: string | undefined = candidateId;
        const visited = new Set<string>();
        while (currentId && !visited.has(currentId)) {
            if (currentId === device.id) return true;
            visited.add(currentId);
            currentId = allPanels.find(({ device: candidate }) => candidate.id === currentId)?.device.properties?.upstreamPanelId;
        }
        return false;
    };
    const upstreamPanelOptions = allPanels
        .filter(({ device: candidate }) => candidate.id !== device.id && !wouldCreateCycle(candidate.id))
        .map(({ device: candidate, scene }) => ({
            value: candidate.id,
            label: `${candidate.label || (candidate.type === 'main_panel' ? 'TG' : 'TD')} · ${scene.name}`,
        }));
    const downstreamPanels = allPanels.filter(({ device: candidate }) => candidate.properties?.upstreamPanelId === device.id);
    const setDownstreamPanel = (childId: string, connected: boolean): void => {
        if (!project) return;
        setProject({
            ...project,
            scenes: project.scenes.map((scene) => ({
                ...scene,
                electricalDevices: (scene.electricalDevices ?? []).map((candidate) =>
                    candidate.id === childId
                        ? {
                              ...candidate,
                              properties: {
                                  ...(candidate.properties ?? {}),
                                  upstreamPanelId: connected ? device.id : undefined,
                              },
                          }
                        : candidate,
                ),
            })),
        });
    };

    return (
        <div className="flex flex-col gap-3">
            <SectionWrapper label={`Equipo: ${device.type}`} icon={<Zap size={15} />}>
                <div className="flex flex-col gap-2 text-xs">
                    <SelectField
                        label="Tipo"
                        value={device.type}
                        onChange={(val) => {
                            const type = val as ElectricalDevice['type'];
                            onUpdate({ type });
                        }}
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
                            { value: 'outlet_initial', label: 'Tomacorriente Inicial 1.50 m' },
                            { value: 'outlet_high_180', label: 'Tomacorriente Alto 1.80 m' },
                            { value: 'outlet_floor_box', label: 'Tomacorriente de Piso NPT' },
                            { value: 'outlet_waterproof', label: 'Tomacorriente Agua' },
                            { value: 'outlet_ceiling', label: 'Tomacorriente Techo' },
                            { value: 'outlet_rack', label: 'Tomacorriente Rack' },
                            { value: 'water_heater_30l', label: 'Terma Eléctrica 30L' },
                        ]}
                    />
                    <EditField
                        label="Altura instalada S.N.P.T. (m)"
                        value={
                            device.mountingHeight ??
                            ELECTRICAL_DEVICE_DEFAULTS[device.type].mountingHeight
                        }
                        onChange={(val) => onUpdate({ mountingHeight: val })}
                        min={0}
                        max={10}
                        step={0.05}
                    />
                    {isPanel && (
                        <>
                            <SelectField
                                label="Función eléctrica"
                                value={device.properties?.panelRole ?? (device.type === 'main_panel' ? 'main' : 'distribution')}
                                onChange={(panelRole) => onUpdate({ properties: { ...device.properties, panelRole: panelRole as NonNullable<ElectricalDevice['properties']>['panelRole'] } })}
                                options={[
                                    { value: 'service', label: 'Suministro / acometida' },
                                    { value: 'main', label: 'Tablero general (TG)' },
                                    { value: 'distribution', label: 'Tablero distribución (TD)' },
                                    { value: 'sub_distribution', label: 'Subtablero (Sub-TD)' },
                                ]}
                            />
                            <SelectField
                                label="Ámbito"
                                value={device.properties?.panelScope ?? 'floor'}
                                onChange={(panelScope) => onUpdate({ properties: { ...device.properties, panelScope: panelScope as NonNullable<ElectricalDevice['properties']>['panelScope'] } })}
                                options={[
                                    { value: 'project', label: 'Proyecto global' },
                                    { value: 'module', label: 'Módulo' },
                                    { value: 'floor', label: 'Piso' },
                                ]}
                            />
                            <SelectField
                                label="Ubicación"
                                value={device.properties?.panelLocation ?? 'internal'}
                                onChange={(panelLocation) => onUpdate({ properties: { ...device.properties, panelLocation: panelLocation as NonNullable<ElectricalDevice['properties']>['panelLocation'] } })}
                                options={[
                                    { value: 'external', label: 'Exterior / calle' },
                                    { value: 'internal', label: 'Interior' },
                                ]}
                            />
                            {upstreamPanelOptions.length > 0 && device.properties?.panelRole !== 'service' && (
                                <div className="flex flex-col gap-1">
                                    <SelectField
                                        label="Alimentado desde"
                                        value={device.properties?.upstreamPanelId ?? ''}
                                        onChange={(upstreamPanelId) =>
                                            onUpdate({ properties: { ...device.properties, upstreamPanelId } })
                                        }
                                        options={upstreamPanelOptions}
                                    />
                                    {device.properties?.upstreamPanelId && (
                                        <button
                                            type="button"
                                            onClick={() => onUpdate({ properties: { ...device.properties, upstreamPanelId: undefined } })}
                                            className="self-end rounded border border-red-300 px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                                        >
                                            Desconectar tablero
                                        </button>
                                    )}
                                </div>
                            )}
                            <div className="rounded border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900/60">
                                <p className="mb-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300">Tableros alimentados</p>
                                {allPanels.filter(({ device: candidate }) => candidate.id !== device.id && !wouldCreateCycle(candidate.id)).length === 0 ? (
                                    <p className="text-[10px] text-slate-400">No hay otros tableros disponibles.</p>
                                ) : allPanels.filter(({ device: candidate }) => candidate.id !== device.id && !wouldCreateCycle(candidate.id)).map(({ device: child, scene }) => {
                                    const connected = downstreamPanels.some(({ device: current }) => current.id === child.id);
                                    return (
                                        <label key={child.id} className="flex cursor-pointer items-center gap-2 py-1 text-[10px] text-slate-700 dark:text-slate-200">
                                            <input type="checkbox" checked={connected} onChange={(event) => setDownstreamPanel(child.id, event.target.checked)} />
                                            <span>{child.label || 'Tablero'} · {scene.name}</span>
                                            <span className={connected ? 'ml-auto text-emerald-600 dark:text-emerald-400' : 'ml-auto text-slate-400'}>
                                                {connected ? 'Conectado' : 'Desconectado'}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                            <EditField
                                label="Voltaje de operación (V)"
                                value={Number.parseFloat(device.properties?.voltage ?? '') || (device.type === 'main_panel' ? 380 : 220)}
                                onChange={(val) =>
                                    onUpdate({ properties: { ...device.properties, voltage: `${Math.max(1, val)}V` } })
                                }
                                min={1}
                                step={1}
                            />
                            <SelectField
                                label="Sistema"
                                value={device.properties?.phases?.startsWith('3') ? '3' : '1'}
                                onChange={(val) =>
                                    onUpdate({ properties: { ...device.properties, phases: val === '3' ? '3O' : '1O' } })
                                }
                                options={[
                                    { value: '1', label: '1 — Monofásico' },
                                    { value: '3', label: '3 — Trifásico' },
                                ]}
                            />
                            <SelectField
                                label="Conexión"
                                value={device.properties?.connectionType ?? 'star'}
                                onChange={(val) =>
                                    onUpdate({ properties: { ...device.properties, connectionType: val as 'delta' | 'star' } })
                                }
                                options={[
                                    { value: 'star', label: 'Estrella' },
                                    { value: 'delta', label: 'Delta' },
                                ]}
                            />
                            <EditField
                                label="Factor de diseño (fdis)"
                                value={device.properties?.designFactor ?? 1.25}
                                onChange={(val) =>
                                    onUpdate({ properties: { ...device.properties, designFactor: Math.max(0, val) } })
                                }
                                min={0}
                                step={0.01}
                            />
                            <EditField
                                label="Temperatura de trabajo (°C)"
                                value={device.properties?.workingTemperatureC ?? 20}
                                onChange={(val) =>
                                    onUpdate({ properties: { ...device.properties, workingTemperatureC: val } })
                                }
                                step={1}
                            />
                            <EditField
                                label="ρCuT (Ω·mm²/m)"
                                value={device.properties?.copperResistivity ?? 0.0175}
                                onChange={(val) =>
                                    onUpdate({ properties: { ...device.properties, copperResistivity: Math.max(0, val) } })
                                }
                                min={0}
                                step={0.0001}
                            />
                            <EditField
                                label="ΔV acumulada aguas arriba (V)"
                                value={device.properties?.upstreamVoltageDropV ?? (device.type === 'sub_panel' ? 6.22 : 0)}
                                onChange={(val) =>
                                    onUpdate({ properties: { ...device.properties, upstreamVoltageDropV: Math.max(0, val) } })
                                }
                                min={0}
                                step={0.01}
                            />
                            <div>
                                <EditField
                                    label="Longitud horizontal (m)"
                                    value={device.properties?.horizontalLengthM ?? 0}
                                    onChange={(val) =>
                                        onUpdate({
                                            properties: {
                                                ...device.properties,
                                                horizontalLengthM: Math.max(0, val),
                                                lengthM: Math.max(0, val) + (device.properties?.verticalLengthM ?? 0),
                                            },
                                        })
                                    }
                                    min={0}
                                    step={0.1}
                                />
                                <EditField
                                    label="Longitud vertical (m)"
                                    value={device.properties?.verticalLengthM ?? 0}
                                    onChange={(val) =>
                                        onUpdate({
                                            properties: {
                                                ...device.properties,
                                                verticalLengthM: Math.max(0, val),
                                                lengthM: (device.properties?.horizontalLengthM ?? 0) + Math.max(0, val),
                                            },
                                        })
                                    }
                                    min={0}
                                    step={0.1}
                                />
                                <p className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-gray-400">
                                    Si este tablero no tiene padre en el plano, esta es la distancia al medidor.
                                    Si tiene padre, reemplaza la longitud trazada en el plano para el cálculo.
                                </p>
                            </div>
                            <EditField
                                label="Sección de acometida/alimentador (mm²)"
                                value={device.properties?.sectionMm2 ?? 0}
                                onChange={(val) =>
                                    onUpdate({ properties: { ...device.properties, sectionMm2: Math.max(0, val) } })
                                }
                                min={0}
                                step={1}
                            />
                            <EditField
                                label="Sección de tierra (mm²)"
                                value={device.properties?.earthSectionMm2 ?? 0}
                                onChange={(val) =>
                                    onUpdate({ properties: { ...device.properties, earthSectionMm2: Math.max(0, val) } })
                                }
                                min={0}
                                step={1}
                            />
                            <div className="space-y-2">
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                    Tipo de Conductor (Alimentador)
                                </label>
                                <Select
                                    value={device.properties?.wireType ?? ''}
                                    onValueChange={(val) => onUpdate({ properties: { ...device.properties, wireType: val } })}
                                >
                                    <SelectTrigger className="h-8 bg-white text-xs dark:bg-slate-900">
                                        <SelectValue placeholder="Automático" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">Automático</SelectItem>
                                        <SelectItem value="THW-90">THW-90</SelectItem>
                                        <SelectItem value="N2X0H">N2X0H</SelectItem>
                                        <SelectItem value="NH-80">NH-80</SelectItem>
                                        <SelectItem value="LSOH-80">LSOH-80</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <EditField
                                label="Diámetro de tubo (mm)"
                                value={device.properties?.tubeDiameterMm ?? 0}
                                onChange={(val) =>
                                    onUpdate({ properties: { ...device.properties, tubeDiameterMm: Math.max(0, val) } })
                                }
                                min={0}
                                step={1}
                            />
                        </>
                    )}
                    {isOutlet && (
                        <EditField
                            label="Potencia asignada (W)"
                            value={device.properties?.ratedPowerW ?? DEFAULT_OUTLET_POWER_W}
                            onChange={(val) =>
                                onUpdate({
                                    properties: {
                                        ...device.properties,
                                        ratedPowerW: Math.max(0, val),
                                    },
                                })
                            }
                            min={0}
                            step={10}
                        />
                    )}
                    <EditField
                        label="Rotación (°)"
                        value={device.rotation ?? 0}
                        onChange={(val) => onUpdate({ rotation: ((val % 360) + 360) % 360 })}
                        step={5}
                    />
                    <div>
                        <label className="mb-1 block text-[10px] font-medium text-slate-600 dark:text-gray-400">
                            Etiqueta (Opcional)
                        </label>
                        <input
                            type="text"
                            value={device.label ?? ''}
                            onChange={(e) => onUpdate({ label: e.target.value })}
                            placeholder="Ej. TD-1"
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 placeholder:text-slate-600 dark:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-600"
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
                            <p className="text-[10px] font-medium text-slate-500 dark:text-gray-500">Luminarias (Salidas)</p>
                            <div className="flex flex-col gap-1 mt-1">
                                {device.connectedFixtureIds!.map(id => (
                                    <div key={id} className={connectionRowClass}>
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
                            <p className="text-[10px] font-medium text-slate-500 dark:text-gray-500">Interruptores</p>
                            <div className="flex flex-col gap-1 mt-1">
                                {device.connectedSwitchIds!.map(id => (
                                    <div key={id} className={connectionRowClass}>
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
                            <p className="text-[10px] font-medium text-slate-500 dark:text-gray-500">Otros Equipos / Tableros</p>
                            <div className="flex flex-col gap-1 mt-1">
                                {device.connectedDeviceIds!.map(id => (
                                    <div key={id} className={connectionRowClass}>
                                        <span>Equipo {id.slice(0,4)}...</span>
                                        <button onClick={() => onUpdate({ connectedDeviceIds: device.connectedDeviceIds!.filter(x => x !== id) })} className="text-red-500 px-1"><Trash2 size={12} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {(device.connectedFixtureIds?.length ?? 0) === 0 && (device.connectedSwitchIds?.length ?? 0) === 0 && (device.connectedDeviceIds?.length ?? 0) === 0 && (
                        <p className="text-[10px] text-slate-500 italic dark:text-gray-400">No hay conexiones a este equipo. Usa la herramienta U (Wire) para conectar.</p>
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
        sectionMm2: 2.5,
    };

    const wireOptions = CONDUCTOR_WIRE_OPTIONS.map(({ value, label }) => ({
        value,
        label,
    }));

    return (
        <div className="flex flex-col gap-3">
            <SectionWrapper label="Conductor de Tablero/Equipo" icon={<Zap size={15} />}>
                <div className="flex flex-col gap-2 text-xs">
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
                    <SelectField
                        label="Sección cable"
                        value={String(props.sectionMm2 ?? 2.5)}
                        onChange={(val) => onUpdate({ ...props, sectionMm2: parseFloat(val) })}
                        options={CONDUCTOR_SECTION_OPTIONS.map(({ value, label }) => ({ value: String(value), label }))}
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
