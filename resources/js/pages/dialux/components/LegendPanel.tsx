import { Eye, EyeOff, Layers3, MousePointer2 } from 'lucide-react';
import type { ElectricalLayerGroup } from '@/pages/dialux/hooks/types';
import { useActiveScene, useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import { ELECTRICAL_LEGEND_ITEMS } from '@/pages/dialux/electrical/electricalLegend';
import { classifyConductorLayer } from '@/pages/dialux/electrical/electricalLayerVisibility';

type LayerUnit = { id: string; label: string };

const GROUPS: Array<{ key: ElectricalLayerGroup; label: string; color: string }> = [
    { key: 'cad', label: 'Plano CAD base', color: '#94a3b8' },
    { key: 'fixtures', label: 'Luminarias + cableado', color: '#facc15' },
    { key: 'switches', label: 'Interruptores', color: '#d946ef' },
    { key: 'outlets', label: 'Tomacorrientes + cableado', color: '#22c55e' },
    { key: 'panels', label: 'Tableros y equipos', color: '#f97316' },
    { key: 'wires', label: 'Otros cableados', color: '#ef4444' },
];

const isOutlet = (type: string) => type.startsWith('outlet_');

export function LegendPanel() {
    const store = useEditorStore();
    const scene = useActiveScene();
    const visibility = store.ui.electricalLayerVisibility;
    const hiddenIds = new Set(store.ui.hiddenElectricalIds);

    const fixtures = scene?.fixtures ?? [];
    const lightSwitches = scene?.lightSwitches ?? [];
    const electricalDevices = scene?.electricalDevices ?? [];
    const conductors = scene?.conductors ?? [];
    const nodeLabel = (id: string): string => {
        const fixture = fixtures.find((item) => item.id === id);
        if (fixture) return fixture.name || `Luminaria ${id.slice(0, 5)}`;
        const lightSwitch = lightSwitches.find((item) => item.id === id);
        if (lightSwitch) return lightSwitch.label || `Interruptor ${id.slice(0, 5)}`;
        const device = electricalDevices.find((item) => item.id === id);
        return device?.label || device?.type || id.slice(0, 5);
    };
    const conductorUnits = (layer: 'fixtures' | 'outlets' | 'wires'): LayerUnit[] => conductors
        .filter((conductor) => classifyConductorLayer(conductor, fixtures, lightSwitches, electricalDevices) === layer)
        .map((item) => ({
            id: item.id,
            label: `${item.wireLabel || 'Cable'} · ${nodeLabel(item.sourceId)} → ${nodeLabel(item.targetId)}`,
        }));

    const units: Record<ElectricalLayerGroup, LayerUnit[]> = {
        cad: [],
        fixtures: [
            ...fixtures.map((item) => ({ id: item.id, label: item.name || `Luminaria ${item.id.slice(0, 5)}` })),
            ...conductorUnits('fixtures'),
        ],
        wires: conductorUnits('wires'),
        switches: lightSwitches.map((item) => ({ id: item.id, label: item.label || `Interruptor ${item.id.slice(0, 5)}` })),
        outlets: [
            ...electricalDevices.filter((item) => isOutlet(item.type)).map((item) => ({ id: item.id, label: item.label || item.type })),
            ...conductorUnits('outlets'),
        ],
        panels: electricalDevices.filter((item) => !isOutlet(item.type)).map((item) => ({ id: item.id, label: item.label || item.type })),
    };

    return (
        <div className="flex flex-col gap-3">
            <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/50">
                <div className="border-b border-slate-800 px-2.5 py-2">
                    <p className="text-[10px] font-semibold tracking-wider text-slate-200 uppercase">Simbología eléctrica</p>
                    <p className="mt-0.5 text-[9px] text-slate-500">Se abre automáticamente al usar herramientas eléctricas.</p>
                </div>
                <div className="grid grid-cols-1 gap-px bg-slate-800/70">
                    {ELECTRICAL_LEGEND_ITEMS.map((item) => (
                        <div key={`${item.group}-${item.code}`} className="flex items-center gap-2 bg-slate-950/90 px-2 py-1.5">
                            <span className="flex h-5 w-8 shrink-0 items-center justify-center rounded border border-current font-mono text-[9px] font-bold" style={{ color: item.color }}>
                                {item.code}
                            </span>
                            <span className="text-[9px] leading-tight text-slate-300">{item.label}</span>
                        </div>
                    ))}
                </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/50">
                <div className="flex items-center gap-2 border-b border-slate-800 px-2.5 py-2">
                    <Layers3 className="h-3.5 w-3.5 text-cyan-400" />
                    <div>
                        <p className="text-[10px] font-semibold tracking-wider text-slate-200 uppercase">Visibilidad del plano</p>
                        <p className="text-[9px] text-slate-500">Clic en un elemento para seleccionarlo; usa el ojo para ocultarlo.</p>
                    </div>
                </div>
                <div className="divide-y divide-slate-800/80">
                    {GROUPS.map((group) => {
                        const groupVisible = visibility[group.key];
                        const groupUnits = units[group.key];
                        return (
                            <details key={group.key} className="group/layer" open={groupUnits.length > 0 && groupUnits.length <= 6}>
                                <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2 hover:bg-slate-900">
                                    <span className="h-2.5 w-2.5 rounded-sm border border-white/10" style={{ backgroundColor: group.color }} />
                                    <span className={`min-w-0 flex-1 truncate text-[10px] ${groupVisible ? 'text-slate-300' : 'text-slate-600 line-through'}`}>{group.label}</span>
                                    {groupUnits.length > 0 && <span className="font-mono text-[8px] text-slate-600">{groupUnits.length}</span>}
                                    <button
                                        type="button"
                                        className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-white"
                                        onClick={(event) => { event.preventDefault(); store.toggleElectricalLayer(group.key); }}
                                        title={groupVisible ? `Ocultar ${group.label}` : `Mostrar ${group.label}`}
                                    >
                                        {groupVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                                    </button>
                                </summary>
                                {groupUnits.length > 0 && (
                                    <div className="border-t border-slate-800/60 bg-black/20 py-1">
                                        {groupUnits.map((unit) => {
                                            const visible = !hiddenIds.has(unit.id);
                                            const selected = store.ui.selectedId === unit.id;
                                            return (
                                                <div
                                                    key={unit.id}
                                                    className={`flex w-full items-center gap-1 px-3 py-0.5 ${selected ? 'bg-cyan-500/10' : 'hover:bg-slate-900'}`}
                                                >
                                                    <button
                                                        type="button"
                                                        disabled={!visible || !groupVisible}
                                                        onClick={() => store.setSelectedId(unit.id)}
                                                        className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 text-left disabled:cursor-not-allowed"
                                                        title={visible && groupVisible ? `Seleccionar ${unit.label}` : `${unit.label} está oculto`}
                                                    >
                                                        <MousePointer2 size={9} className={selected ? 'text-cyan-400' : 'text-slate-600'} />
                                                        <span className={`min-w-0 flex-1 truncate text-[9px] ${selected ? 'font-medium text-cyan-300' : visible && groupVisible ? 'text-slate-400' : 'text-slate-700 line-through'}`}>{unit.label}</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => store.toggleElectricalItemVisibility(unit.id)}
                                                        className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-white"
                                                        title={visible ? `Ocultar ${unit.label}` : `Mostrar ${unit.label}`}
                                                    >
                                                        {visible ? <Eye size={10} /> : <EyeOff size={10} className="text-slate-700" />}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </details>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
