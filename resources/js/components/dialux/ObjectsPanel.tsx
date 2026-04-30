import { Square, Zap, Trash2, Minus, AppWindow, Umbrella, DoorOpen } from 'lucide-react';
import React from 'react';
import { useEditorStore } from '@/hooks/dialux/useEditorStore';

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
            <p className="py-4 text-center text-[11px] text-gray-600">
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
    const totalItems =
        (scene.rooms?.length || 0) +
        (scene.walls?.length || 0) +
        (scene.windows?.length || 0) +
        (scene.doors?.length || 0) +
        (scene.canopies?.length || 0) +
        (scene.fixtures?.length || 0);

    return (
        <div className="space-y-1">
            <p className="mb-2 text-[10px] font-semibold tracking-widest text-gray-500 uppercase">
                Escena · {totalItems} objetos
            </p>

            {/* ── Recintos ──────────────────────────────────────────────── */}
            <ObjectSection
                label="Recintos"
                icon={<Square size={9} className="text-blue-400" />}
                items={regularRooms.map((r) => ({
                    id: r.id,
                    label: r.name,
                    sublabel: `${r.vertices.length} vért.`,
                    accent: 'blue',
                }))}
                selectedId={selectedId}
                onSelect={store.setSelectedId}
                onDelete={(id) => store.removeObject(id)}
            />

            {/* ── Paredes ───────────────────────────────────────────────── */}
            <ObjectSection
                label="Ambientes"
                icon={<Square size={9} className="text-cyan-400" />}
                items={corridorAmbients.map((r) => ({
                    id: r.id,
                    label: r.name,
                    sublabel: `Pasadizo · ${r.vertices.length} vÃ©rt.`,
                    accent: 'cyan',
                }))}
                selectedId={selectedId}
                onSelect={store.setSelectedId}
                onDelete={(id) => store.removeObject(id)}
            />

            <ObjectSection
                label="Paredes"
                icon={<Minus size={9} className="text-slate-400" />}
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
                onDelete={(id) => store.removeObject(id)}
            />

            {/* ── Ventanas ──────────────────────────────────────────────── */}
            <ObjectSection
                label="Ventanas"
                icon={<AppWindow size={9} className="text-sky-400" />}
                items={scene.windows.map((w) => ({
                    id: w.id,
                    label: w.windowType === 'bathroom' ? `V.Baño ${w.id.slice(0, 6)}` : `Ventana ${w.id.slice(0, 6)}`,
                    sublabel: `${w.width.toFixed(1)}×${w.height.toFixed(1)}m`,
                    accent: w.windowType === 'bathroom' ? 'violet' : 'sky',
                }))}
                selectedId={selectedId}
                onSelect={store.setSelectedId}
                onDelete={(id) => store.removeObject(id)}
            />

            {/* ── Puertas ───────────────────────────────────────────────── */}
            <ObjectSection
                label="Puertas"
                icon={<DoorOpen size={9} className="text-emerald-400" />}
                items={(scene.doors || []).map((d) => ({
                    id: d.id,
                    label: `Puerta ${d.doorType ?? 'simple'} ${d.id.slice(0, 6)}`,
                    sublabel: `${d.width.toFixed(2)}×${d.height.toFixed(2)}m`,
                    accent: 'emerald',
                }))}
                selectedId={selectedId}
                onSelect={store.setSelectedId}
                onDelete={(id) => store.removeObject(id)}
            />

            {/* ── Voladizos ─────────────────────────────────────────────── */}
            <ObjectSection
                label="Voladizos"
                icon={<Umbrella size={9} className="text-amber-400" />}
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
                onDelete={(id) => store.removeObject(id)}
            />

            {/* ── Luminarias ────────────────────────────────────────────── */}
            <ObjectSection
                label="Luminarias"
                icon={<Zap size={9} className="text-amber-400" />}
                items={scene.fixtures.map((f) => ({
                    id: f.id,
                    label: f.name,
                    sublabel: `${f.lumens}lm`,
                    accent: 'yellow',
                }))}
                selectedId={selectedId}
                onSelect={store.setSelectedId}
                onDelete={(id) => store.removeObject(id)}
            />

            {totalItems === 0 && (
                <div className="px-2 py-6 text-center">
                    <Square size={24} className="mx-auto mb-2 text-gray-700" />
                    <p className="text-[10px] text-gray-600">
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
    | 'violet';

const accentClasses: Record<Accent, { selected: string; dot: string }> = {
    blue:    { selected: 'bg-blue-900/40 text-blue-200',       dot: 'text-blue-400' },
    slate:   { selected: 'bg-slate-800/60 text-slate-200',     dot: 'text-slate-400' },
    sky:     { selected: 'bg-sky-900/40 text-sky-200',         dot: 'text-sky-400' },
    cyan:    { selected: 'bg-cyan-900/40 text-cyan-200',       dot: 'text-cyan-400' },
    amber:   { selected: 'bg-amber-900/40 text-amber-200',     dot: 'text-amber-400' },
    yellow:  { selected: 'bg-yellow-900/40 text-yellow-200',   dot: 'text-yellow-400' },
    emerald: { selected: 'bg-emerald-900/40 text-emerald-200', dot: 'text-emerald-400' },
    violet:  { selected: 'bg-violet-900/40 text-violet-200',   dot: 'text-violet-400' },
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
        <div className="mb-2">
            <div className="mb-1 flex items-center gap-1 px-1">
                {icon}
                <p className="text-[9px] font-medium tracking-wider text-gray-600 uppercase">
                    {label}
                </p>
                <span className="ml-auto font-mono text-[9px] text-gray-700">
                    {items.length}
                </span>
            </div>
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
                                : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'
                        }`}
                    >
                        <span className="flex-1 truncate font-mono text-[11px]">
                            {item.label}
                        </span>
                        <span className="shrink-0 font-mono text-[9px] text-gray-600">
                            {item.sublabel}
                        </span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(item.id);
                            }}
                            className="ml-1 text-red-500/60 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
                            title="Eliminar"
                        >
                            <Trash2 size={9} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
};
