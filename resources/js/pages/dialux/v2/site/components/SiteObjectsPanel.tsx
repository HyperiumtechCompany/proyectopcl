import {
    Building2,
    ChevronDown,
    Hexagon,
    Layers,
    Mountain,
    Trash2,
    Waves,
    Zap,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { SiteElement, SiteElementType } from '../domain/types';
import type { UseSiteEditorReturn } from '../hooks/useSiteEditor';
import { SITE_ELEMENT_DEFAULTS } from '../lib/siteDefaults';

interface Props {
    editor: UseSiteEditorReturn;
    /** Se llama además de `editor.selectElement` al elegir un ítem — para que el panel de Propiedades quede al frente. */
    onSelect?: (id: string) => void;
}

type IconType = ComponentType<{ className?: string }>;

/** Mismas categorías que `SitePalette` — un objeto pertenece a una sola, para no tener dos sitios distintos de los que aprender la organización del módulo. */
const GROUPS: { id: string; title: string; icon: IconType; types: SiteElementType[] }[] = [
    {
        id: 'terrain',
        title: 'Terreno',
        icon: Hexagon,
        types: ['terrain', 'street', 'green_area'],
    },
    {
        id: 'topography',
        title: 'Topografía',
        icon: Mountain,
        types: ['contour', 'spot_elevation', 'terrace_platform'],
    },
    {
        id: 'building',
        title: 'Edificación',
        icon: Building2,
        types: ['building_block', 'fence', 'gate', 'stair', 'ramp'],
    },
    {
        id: 'installations',
        title: 'Instalaciones',
        icon: Waves,
        types: ['pool', 'court', 'parking'],
    },
    {
        id: 'electrical',
        title: 'Red eléctrica',
        icon: Zap,
        types: ['tg_location', 'transformer', 'pole'],
    },
];
const KNOWN_TYPES = new Set(GROUPS.flatMap((g) => g.types));

function sublabelFor(element: SiteElement): string {
    const typeLabel = SITE_ELEMENT_DEFAULTS[element.type]?.label ?? element.type;
    const z = element.baseElevationM;
    if (typeof z === 'number' && Math.abs(z) > 0.001) {
        return `${typeLabel} · ▲ ${z.toFixed(2)} m`;
    }
    return typeLabel;
}

/**
 * Lista de todos los objetos del emplazamiento, agrupada por categoría (las
 * mismas de `SitePalette`) — para encontrar y seleccionar un objeto cuando
 * hay demasiados como para ubicarlo a ojo en el plano (ej. varias
 * plataformas de terreno apiladas por nivel).
 */
export function SiteObjectsPanel({ editor, onSelect }: Props) {
    const elements = editor.siteData?.elements ?? [];
    const selectedIds = editor.selectedElementIds;
    const select = (id: string, additive = false) => {
        // Mayús/Ctrl + clic en la lista: agrega o quita del grupo (sin saltar a Propiedades).
        if (additive) {
            editor.toggleElementSelection(id);
            return;
        }
        editor.selectElement(id);
        onSelect?.(id);
    };
    const remove = (id: string) => {
        editor.removeSiteElement(id);
        if (selectedIds.includes(id)) editor.selectElements(selectedIds.filter((x) => x !== id));
    };

    const other = elements.filter((el) => !KNOWN_TYPES.has(el.type));

    if (elements.length === 0) {
        return (
            <p className="px-4 py-6 text-center text-[11px] text-slate-400">
                Sin objetos todavía — usa las herramientas de la izquierda
                para empezar a dibujar.
            </p>
        );
    }

    return (
        <div className="space-y-1 p-2">
            <p className="mb-1 px-1 text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                Emplazamiento · {elements.length} objetos
            </p>
            {GROUPS.map((group) => (
                <ObjectGroup
                    key={group.id}
                    title={group.title}
                    icon={group.icon}
                    items={elements.filter((el) => group.types.includes(el.type))}
                    selectedIds={selectedIds}
                    onSelect={select}
                    onDelete={remove}
                />
            ))}
            <ObjectGroup
                title="Otros"
                icon={Layers}
                items={other}
                selectedIds={selectedIds}
                onSelect={select}
                onDelete={remove}
            />
        </div>
    );
}

function ObjectGroup({
    title,
    icon: Icon,
    items,
    selectedIds,
    onSelect,
    onDelete,
}: {
    title: string;
    icon: IconType;
    items: SiteElement[];
    selectedIds: string[];
    onSelect: (id: string, additive?: boolean) => void;
    onDelete: (id: string) => void;
}) {
    if (items.length === 0) return null;
    return (
        <details
            className="group overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950/40"
            open
        >
            <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 bg-slate-50 px-2 py-1.5 hover:bg-slate-100 dark:bg-slate-900/70 dark:hover:bg-slate-800/80">
                <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" />
                <span className="text-[11px] font-semibold tracking-wide text-slate-700 uppercase dark:text-slate-300">
                    {title}
                </span>
                <span className="ml-auto rounded-full bg-slate-200 px-1.5 font-mono text-[9px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {items.length}
                </span>
                <ChevronDown className="h-3 w-3 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-0.5 border-t border-slate-200 p-1 dark:border-white/10">
                {items.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    return (
                        <div
                            key={item.id}
                            onClick={(event) =>
                                onSelect(item.id, event.shiftKey || event.ctrlKey || event.metaKey)
                            }
                            className={`group/item flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 ${
                                isSelected
                                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300'
                                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
                            }`}
                        >
                            <span className="flex-1 truncate text-[11px] font-medium">
                                {item.label}
                            </span>
                            <span
                                className={`shrink-0 text-[9px] ${isSelected ? '' : 'text-slate-400'}`}
                            >
                                {sublabelFor(item)}
                            </span>
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onDelete(item.id);
                                }}
                                title="Eliminar"
                                className="ml-1 shrink-0 text-red-400 opacity-0 transition-opacity group-hover/item:opacity-100 hover:text-red-500"
                            >
                                <Trash2 className="h-3 w-3" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </details>
    );
}
