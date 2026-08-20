import { Square, Zap, Trash2, Minus, AppWindow, Umbrella, DoorOpen, Plug, Cable, ToggleLeft, Boxes, ChevronDown } from 'lucide-react';
import React from 'react';
import { isOutletDeviceType } from '@/pages/dialux/hooks/types';
import { useEditorStore } from '@/pages/dialux/hooks/useEditorStore';
import { calculateConductorLength } from '@/pages/dialux/hooks/wireLengthCalculations';
import {
    EQUIPMENT_DEVICE_ITEMS,
    OUTLET_DEVICE_ITEMS,
} from './toolbar/electricalDeviceCatalog';

const DEVICE_LABEL_BY_TYPE = new Map(
    [...OUTLET_DEVICE_ITEMS, ...EQUIPMENT_DEVICE_ITEMS].map((item) => [item.type, item.label]),
);

const SWITCH_TYPE_LABELS: Record<string, string> = {
    single: 'Simple',
    double: 'Doble',
    triple: 'Triple',
    'two-way': 'Conmutado',
};

/**
 * ObjectsPanel — Lista jerárquica de todos los objetos de la escena
 *
 * Secciones:
 *   Recintos   → Rooms
 *   Paredes    → Walls
 *   Ventanas   → Windows
 *   Voladizos  → Canopies
 *   Luminarias → Fixtures
 */
export const ObjectsPanel: React.FC = () => {
    const store = useEditorStore();
    const scene = store.activeScene();
    const selectedId = store.ui.selectedId;

    if (!scene) {
        return (
            <p className="py-4 text-center text-[11px] text-slate-400 dark:text-gray-500">
                Sin escena activa
            </p>
        );
    }

    const regularRooms = scene.rooms.filter(
        (room) => room.roomType !== 'corridor',
    );
    const corridorAmbients = scene.rooms.filter(
        (room) => room.roomType === 'corridor',
    );

    const electricalDevices = scene.electricalDevices ?? [];
    const outletDevices = electricalDevices.filter((d) => isOutletDeviceType(d.type));
    const panelAndEquipmentDevices = electricalDevices.filter((d) => !isOutletDeviceType(d.type));
    const lightSwitches = scene.lightSwitches ?? [];
    const conductors = scene.conductors ?? [];

    // Para mostrar a qué dos objetos conecta cada cable (útil para
    // encontrar cables sueltos/duplicados que están inflando el conteo
    // de salidas en Cálculo CT).
    const nodeLabel = (id: string): string => {
        const fixture = scene.fixtures.find((f) => f.id === id);
        if (fixture) return fixture.name || 'Luminaria';
        const sw = lightSwitches.find((s) => s.id === id);
        if (sw) return sw.label || 'Interruptor';
        const device = electricalDevices.find((d) => d.id === id);
        if (device) return device.label || DEVICE_LABEL_BY_TYPE.get(device.type) || 'Equipo';
        return id.slice(0, 6);
    };

    const totalItems =
        (scene.rooms?.length || 0) +
        (scene.walls?.length || 0) +
        (scene.windows?.length || 0) +
        (scene.doors?.length || 0) +
        (scene.canopies?.length || 0) +
        (scene.fixtures?.length || 0) +
        electricalDevices.length +
        lightSwitches.length +
        conductors.length;

    return (
        <div className="space-y-1">
            <p className="mb-2 text-[10px] font-semibold tracking-widest text-slate-500 dark:text-gray-400 uppercase">
                Escena · {totalItems} objetos
            </p>

            {/* ── Recintos ──────────────────────────────────────────────── */}
            <ObjectSection
                label="Recintos"
                icon={<Square size={9} className="text-blue-500 dark:text-blue-400" />}
                items={regularRooms.map((r) => ({
                    id: r.id,
                    label: r.name,
                    sublabel: `${r.vertices.length} vért.`,
                    accent: 'blue',
                }))}
                selectedId={selectedId}
                onSelect={store.setSelectedId}
                onDelete={(id) => store.requestDelete(id)}
            />

            {/* ── Ambientes (pasadizos) ─────────────────────────────────── */}
            <ObjectSection
                label="Ambientes"
                icon={<Square size={9} className="text-cyan-500 dark:text-cyan-400" />}
                items={corridorAmbients.map((r) => ({
                    id: r.id,
                    label: r.name,
                    sublabel: `Pasadizo · ${r.vertices.length} vért.`,
                    accent: 'cyan',
                }))}
                selectedId={selectedId}
                onSelect={store.setSelectedId}
                onDelete={(id) => store.requestDelete(id)}
            />

            <ObjectSection
                label="Paredes"
                icon={<Minus size={9} className="text-slate-500 dark:text-slate-400" />}
                items={scene.walls.map((w) => {
                    const verts = w.vertices;
                    let len = 0;
                    if (verts.length > 1) {
                        const maxCoord = Math.max(
                            ...verts.flatMap((v) => [
                                Math.abs(v.x),
                                Math.abs(v.y),
                            ]),
                        );
                        if (maxCoord > 100) {
                            for (let i = 1; i < verts.length; i++) {
                                len += Math.hypot(
                                    (verts[i].x - verts[i - 1].x) / 1000,
                                    (verts[i].y - verts[i - 1].y) / 1000,
                                );
                            }
                        } else {
                            for (let i = 1; i < verts.length; i++) {
                                len += Math.hypot(
                                    verts[i].x - verts[i - 1].x,
                                    verts[i].y - verts[i - 1].y,
                                );
                            }
                        }
                    }
                    return {
                        id: w.id,
                        label: w.id.slice(0, 8),
                        sublabel: `${len.toFixed(2)}m`,
                        accent: 'slate' as const,
                    };
                })}
                selectedId={selectedId}
                onSelect={store.setSelectedId}
                onDelete={(id) => store.requestDelete(id)}
            />

            {/* ── Ventanas ──────────────────────────────────────────────── */}
            <ObjectSection
                label="Ventanas"
                icon={<AppWindow size={9} className="text-sky-500 dark:text-sky-400" />}
                items={scene.windows.map((w) => ({
                    id: w.id,
                    label: w.windowType === 'bathroom' ? `V.Baño ${w.id.slice(0, 6)}` : `Ventana ${w.id.slice(0, 6)}`,
                    sublabel: `${w.width.toFixed(1)}×${w.height.toFixed(1)}m`,
                    accent: w.windowType === 'bathroom' ? 'violet' : 'sky',
                }))}
                selectedId={selectedId}
                onSelect={store.setSelectedId}
                onDelete={(id) => store.requestDelete(id)}
            />

            {/* ── Puertas ───────────────────────────────────────────────── */}
            <ObjectSection
                label="Puertas"
                icon={<DoorOpen size={9} className="text-emerald-500 dark:text-emerald-400" />}
                items={(scene.doors || []).map((d) => ({
                    id: d.id,
                    label: `Puerta ${d.doorType ?? 'simple'} ${d.id.slice(0, 6)}`,
                    sublabel: `${d.width.toFixed(2)}×${d.height.toFixed(2)}m`,
                    accent: 'emerald',
                }))}
                selectedId={selectedId}
                onSelect={store.setSelectedId}
                onDelete={(id) => store.requestDelete(id)}
            />

            {/* ── Voladizos ─────────────────────────────────────────────── */}
            <ObjectSection
                label="Voladizos"
                icon={<Umbrella size={9} className="text-amber-500 dark:text-amber-400" />}
                items={scene.canopies.map((c) => {
                    const dx = c.x2 - c.x1;
                    const dy = c.y2 - c.y1;
                    const maxCoord = Math.max(
                        Math.abs(c.x1),
                        Math.abs(c.y1),
                        Math.abs(c.x2),
                        Math.abs(c.y2),
                    );
                    const depth =
                        maxCoord > 100
                            ? Math.hypot(dx / 1000, dy / 1000)
                            : Math.hypot(dx, dy);
                    return {
                        id: c.id,
                        label: `Voladizo ${c.id.slice(0, 6)}`,
                        sublabel: `${depth.toFixed(2)}m prof.`,
                        accent: 'amber',
                    };
                })}
                selectedId={selectedId}
                onSelect={store.setSelectedId}
                onDelete={(id) => store.requestDelete(id)}
            />

            {/* ── Luminarias (alumbrado) ───────────────────────────────────── */}
            <ObjectSection
                label="Luminarias"
                icon={<Zap size={9} className="text-amber-500 dark:text-amber-400" />}
                items={scene.fixtures.map((f) => ({
                    id: f.id,
                    label: f.name,
                    sublabel: `${f.lumens}lm`,
                    accent: 'yellow',
                }))}
                selectedId={selectedId}
                onSelect={store.setSelectedId}
                onDelete={(id) => store.requestDelete(id)}
            />

            {/* ── Tomacorrientes ────────────────────────────────────────────── */}
            <ObjectSection
                label="Tomacorrientes"
                icon={<Plug size={9} className="text-green-500 dark:text-green-400" />}
                items={outletDevices.map((d) => ({
                    id: d.id,
                    label: d.label || DEVICE_LABEL_BY_TYPE.get(d.type) || 'Toma',
                    sublabel: `${d.properties?.ratedPowerW ?? 180}W`,
                    accent: 'green',
                }))}
                selectedId={selectedId}
                onSelect={store.setSelectedId}
                onDelete={(id) => store.requestDelete(id)}
            />

            {/* ── Tableros y equipos (TG, TD, medidor, ATS, cajas, PAT, etc.) ── */}
            <ObjectSection
                label="Tableros y equipos"
                icon={<Boxes size={9} className="text-red-500 dark:text-red-400" />}
                items={panelAndEquipmentDevices.map((d) => ({
                    id: d.id,
                    label: d.label || DEVICE_LABEL_BY_TYPE.get(d.type) || d.type,
                    sublabel: DEVICE_LABEL_BY_TYPE.get(d.type) ?? d.type,
                    accent: 'red',
                }))}
                selectedId={selectedId}
                onSelect={store.setSelectedId}
                onDelete={(id) => store.requestDelete(id)}
            />

            {/* ── Interruptores ─────────────────────────────────────────────── */}
            <ObjectSection
                label="Interruptores"
                icon={<ToggleLeft size={9} className="text-orange-500 dark:text-orange-400" />}
                items={lightSwitches.map((s) => ({
                    id: s.id,
                    label: s.label || 'Interruptor',
                    sublabel: SWITCH_TYPE_LABELS[s.type] ?? s.type,
                    accent: 'orange',
                }))}
                selectedId={selectedId}
                onSelect={store.setSelectedId}
                onDelete={(id) => store.requestDelete(id)}
            />

            {/* ── Cableado (útil para encontrar cables sueltos/duplicados) ──── */}
            <ObjectSection
                label="Cableado"
                icon={<Cable size={9} className="text-teal-500 dark:text-teal-400" />}
                items={conductors.map((c) => {
                    const lengthM = calculateConductorLength(scene, c)?.totalLengthM;
                    return {
                        id: c.id,
                        label: `${nodeLabel(c.sourceId)} → ${nodeLabel(c.targetId)}`,
                        sublabel: `${c.sectionMm2}mm² · ${lengthM !== undefined ? `${lengthM.toFixed(2)}m` : '—'}`,
                        accent: 'teal' as const,
                    };
                })}
                selectedId={selectedId}
                onSelect={store.setSelectedId}
                onDelete={(id) => store.requestDelete(id)}
            />

            {totalItems === 0 && (
                <div className="px-2 py-6 text-center">
                    <Square size={24} className="mx-auto mb-2 text-slate-300 dark:text-gray-700" />
                    <p className="text-[10px] text-slate-400 dark:text-gray-500">
                        Usa las herramientas de la barra izquierda para comenzar
                        a diseñar
                    </p>
                </div>
            )}
        </div>
    );
};

// ─── Componente de sección reutilizable ───────────────────────────────────────

type Accent =
    | 'blue'
    | 'slate'
    | 'sky'
    | 'cyan'
    | 'amber'
    | 'yellow'
    | 'emerald'
    | 'violet'
    | 'green'
    | 'red'
    | 'orange'
    | 'teal';

const accentClasses: Record<Accent, { selected: string; dot: string }> = {
    blue:    { selected: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200',       dot: 'text-blue-500 dark:text-blue-400' },
    slate:   { selected: 'bg-slate-200 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200',   dot: 'text-slate-500 dark:text-slate-400' },
    sky:     { selected: 'bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200',           dot: 'text-sky-500 dark:text-sky-400' },
    cyan:    { selected: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200',       dot: 'text-cyan-500 dark:text-cyan-400' },
    amber:   { selected: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200',   dot: 'text-amber-500 dark:text-amber-400' },
    yellow:  { selected: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200', dot: 'text-yellow-600 dark:text-yellow-400' },
    emerald: { selected: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200', dot: 'text-emerald-500 dark:text-emerald-400' },
    violet:  { selected: 'bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-200',   dot: 'text-violet-500 dark:text-violet-400' },
    green:   { selected: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200',   dot: 'text-green-500 dark:text-green-400' },
    red:     { selected: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200',           dot: 'text-red-500 dark:text-red-400' },
    orange:  { selected: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200', dot: 'text-orange-500 dark:text-orange-400' },
    teal:    { selected: 'bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200',       dot: 'text-teal-500 dark:text-teal-400' },
};

interface ObjectItem {
    id: string;
    label: string;
    sublabel: string;
    accent: Accent;
}

interface ObjectSectionProps {
    label: string;
    icon: React.ReactNode;
    items: ObjectItem[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
}

const ObjectSection: React.FC<ObjectSectionProps> = ({
    label,
    icon,
    items,
    selectedId,
    onSelect,
    onDelete,
}) => {
    if (items.length === 0) return null;
    return (
        <details className="group mb-1 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/40" open>
            <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 bg-slate-50 px-2.5 py-2 transition-colors hover:bg-slate-100 dark:bg-slate-900/70 dark:hover:bg-slate-800/80">
                {icon}
                <span className="text-[11px] font-semibold tracking-wide text-slate-700 uppercase dark:text-slate-300">
                    {label}
                </span>
                <span className="ml-auto rounded-full bg-slate-200 px-1.5 font-mono text-[9px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {items.length}
                </span>
                <ChevronDown size={12} className="text-slate-400 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-0.5 border-t border-slate-200 p-1 dark:border-slate-800">
            {items.map((item) => {
                const acc = accentClasses[item.accent];
                const isSelected = selectedId === item.id;
                return (
                    <div
                        key={item.id}
                        onClick={() => onSelect(item.id)}
                        className={`group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors ${
                            isSelected
                                ? acc.selected
                                : 'text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-800/60 hover:text-slate-900 dark:hover:text-gray-100'
                        }`}
                    >
                        <span className="flex-1 truncate font-mono text-[11px]">
                            {item.label}
                        </span>
                        <span className={`shrink-0 font-mono text-[9px] ${isSelected ? '' : 'text-slate-400 dark:text-gray-500'}`}>
                            {item.sublabel}
                        </span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(item.id);
                            }}
                            className="ml-1 text-red-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                            title="Eliminar"
                        >
                            <Trash2 size={9} />
                        </button>
                    </div>
                );
            })}
            </div>
        </details>
    );
};
