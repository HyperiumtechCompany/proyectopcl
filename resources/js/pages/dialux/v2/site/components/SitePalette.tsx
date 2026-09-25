import {
    Archive,
    Box,
    Building2,
    Cable,
    Calculator,
    CircleDot,
    DoorOpen,
    Eye,
    EyeOff,
    Fence,
    FileSpreadsheet,
    Fingerprint,
    Footprints,
    Fuel,
    Hexagon,
    Layers,
    Lightbulb,
    Map as MapIcon,
    MapPin,
    Mountain,
    MousePointer2,
    ParkingSquare,
    Plug,
    Ruler,
    Search,
    Settings2,
    ShieldCheck,
    Spline,
    Square,
    Trash2,
    TrendingUp,
    Trees,
    Upload,
    Waves,
    Zap,
} from 'lucide-react';
import { useState, type ComponentType, type ReactNode } from 'react';
import { create } from 'zustand';
import { SITE_CALCULATION_AREA_TYPES } from '../domain/siteLightingCalculation';
import { LINEAR_SPACE_TYPES } from '../domain/siteLinearProjection';
import type { SiteElementType } from '../domain/types';
import type { UseSiteEditorReturn } from '../hooks/useSiteEditor';
import type { SiteLightingCalculationState } from '../hooks/useSiteLightingCalculation';
import { SiteLinearProjectionPanel } from './SiteLinearProjectionPanel';
import { SiteProjectionPanel } from './SiteProjectionPanel';

interface Props {
    editor: UseSiteEditorReturn;
    /** Estado de "Calcular alumbrado" (compartido con el panel de resultados y el 3D). */
    lighting?: SiteLightingCalculationState;
}

type IconType = ComponentType<{ className?: string }>;

/**
 * Categorías de la paleta, al estilo de las pestañas de DIALux evo: un riel de
 * íconos a la izquierda y SOLO las herramientas de la categoría activa a la
 * derecha (en mosaico). Así la paleta no crece en scroll al sumar objetos:
 * cada objeto nuevo va a su categoría, y el buscador los encuentra a todos.
 */
export type CategoryId =
    | 'plan'
    | 'terrain'
    | 'spaces'
    | 'building'
    | 'electrical'
    | 'wiring'
    | 'lighting'
    | 'settings';

const CATEGORIES: Array<{ id: CategoryId; label: string; icon: IconType }> = [
    { id: 'plan', label: 'Plano', icon: MapIcon },
    { id: 'terrain', label: 'Terreno', icon: Mountain },
    { id: 'spaces', label: 'Espacios', icon: Hexagon },
    { id: 'building', label: 'Edificación', icon: Building2 },
    { id: 'electrical', label: 'Eléctrico', icon: Zap },
    { id: 'wiring', label: 'Cableado', icon: Cable },
    { id: 'lighting', label: 'Iluminación', icon: Lightbulb },
    { id: 'settings', label: 'Ajustes', icon: Settings2 },
];

interface ToolDef {
    key: string;
    category: CategoryId;
    label: string;
    icon: IconType;
    /** Palabras extra para el buscador. */
    keywords?: string;
    isActive: (editor: UseSiteEditorReturn) => boolean;
    run: (editor: UseSiteEditorReturn) => void;
    isVisible?: (editor: UseSiteEditorReturn) => boolean;
}

const polygon = (
    category: CategoryId,
    type: SiteElementType,
    label: string,
    icon: IconType,
    keywords?: string,
): ToolDef => ({
    key: `polygon:${type}`,
    category,
    label,
    icon,
    keywords,
    isActive: (editor) =>
        editor.activeTool === 'draw_polygon' && editor.pendingType === type,
    run: (editor) => editor.startTool('draw_polygon', type),
});

const point = (
    category: CategoryId,
    type: SiteElementType,
    label: string,
    icon: IconType,
    keywords?: string,
): ToolDef => ({
    key: `point:${type}`,
    category,
    label,
    icon,
    keywords,
    isActive: (editor) =>
        editor.activeTool === 'place_tg' && editor.pendingType === type,
    run: (editor) => editor.startTool('place_tg', type),
});

const TOOLS: ToolDef[] = [
    // Plano importado
    {
        key: 'plan:import',
        category: 'plan',
        label: 'Importar DXF / DWG',
        icon: Upload,
        keywords: 'cad autocad plano',
        isActive: (editor) => editor.planImportOpen,
        run: (editor) => editor.openPlanImport(),
    },
    {
        key: 'plan:calibrate',
        category: 'plan',
        label: 'Calibrar plano',
        icon: Ruler,
        keywords: 'escala',
        isActive: (editor) => editor.activeTool === 'calibrate_plan',
        run: (editor) => editor.startCalibratePlan(),
        isVisible: (editor) => Boolean(editor.siteData?.importedPlan),
    },
    // Terreno y topografía
    polygon('terrain', 'terrain', 'Terreno / Lote', Hexagon, 'lote predio'),
    polygon('terrain', 'terrace_platform', 'Plataforma (terraza)', Layers, 'cota nivel'),
    {
        key: 'terrain:contour',
        category: 'terrain',
        label: 'Curva de nivel',
        icon: Spline,
        keywords: 'topografía',
        isActive: (editor) => editor.activeTool === 'draw_contour',
        run: (editor) => editor.startTool('draw_contour', 'contour'),
    },
    {
        key: 'terrain:spot',
        category: 'terrain',
        label: 'Punto acotado',
        icon: Mountain,
        keywords: 'cota topografía',
        isActive: (editor) =>
            editor.activeTool === 'place_spot' &&
            editor.pendingType === 'spot_elevation',
        run: (editor) => editor.startTool('place_spot', 'spot_elevation'),
    },
    {
        key: 'terrain:cad-contours',
        category: 'terrain',
        label: 'Curvas del plano CAD',
        icon: Upload,
        keywords: 'extraer topografía',
        isActive: (editor) => editor.contourImportOpen,
        run: (editor) => editor.openContourImport(),
        isVisible: (editor) => Boolean(editor.siteData?.importedPlan),
    },
    {
        key: 'terrain:survey',
        category: 'terrain',
        label: 'Importar levantamiento',
        icon: FileSpreadsheet,
        keywords: 'excel csv topografía',
        isActive: (editor) => editor.surveyImportOpen,
        run: (editor) => editor.openSurveyImport(),
    },
    // Espacios exteriores
    polygon('spaces', 'street', 'Calle', Fingerprint, 'pista vía'),
    polygon('spaces', 'sidewalk', 'Vereda', Footprints, 'peatonal'),
    polygon('spaces', 'green_area', 'Área verde / jardín', Trees, 'césped'),
    polygon('spaces', 'court', 'Cancha deportiva', Hexagon, 'losa deporte'),
    polygon('spaces', 'parking', 'Estacionamiento', ParkingSquare, 'parqueo'),
    polygon('spaces', 'pool', 'Piscina', Waves),
    polygon('spaces', 'custom_zone', 'Zona personalizada', Square, 'patio área'),
    point('spaces', 'tree', 'Árbol / palmera', Trees, 'paisajismo'),
    // Edificación y accesos
    polygon('building', 'building_block', 'Bloque edificio', Building2, 'módulo'),
    polygon('building', 'canopy', 'Techado', Building2, 'cubierta cobertizo luminarias'),
    polygon('building', 'fence', 'Cerco / Muro', Fence),
    polygon('building', 'gate', 'Portón (vano, 2 clics)', DoorOpen, 'ingreso puerta'),
    point('building', 'gate', 'Portón puntual', DoorOpen, 'ingreso puerta'),
    {
        key: 'building:stair-landing',
        category: 'building',
        label: 'Escalera con descanso',
        icon: Footprints,
        isActive: (editor) =>
            editor.activeTool === 'draw_polygon' &&
            editor.pendingType === 'stair' &&
            editor.stairLandings === 'auto',
        run: (editor) => {
            editor.setStairLandings('auto');
            editor.startTool('draw_polygon', 'stair');
        },
    },
    {
        key: 'building:stair-straight',
        category: 'building',
        label: 'Escalera recta',
        icon: Footprints,
        isActive: (editor) =>
            editor.activeTool === 'draw_polygon' &&
            editor.pendingType === 'stair' &&
            editor.stairLandings === 'none',
        run: (editor) => {
            editor.setStairLandings('none');
            editor.startTool('draw_polygon', 'stair');
        },
    },
    polygon('building', 'ramp', 'Rampa', TrendingUp),
    // Red eléctrica
    point('electrical', 'tg_location', 'Tablero General', Zap, 'tg'),
    point('electrical', 'sub_panel', 'Sub tablero (TD)', Box, 'td'),
    point('electrical', 'transformer', 'Transformador', Zap, 'subestación suministro'),
    point('electrical', 'generator', 'Grupo electrógeno', Fuel, 'ge'),
    point('electrical', 'ats', 'ATS', ShieldCheck, 'transferencia'),
    point('electrical', 'mt_cell_arrival', 'Celda llegada MT', Zap, 'media tensión'),
    point('electrical', 'mt_cell_protection', 'Celda protección MT', Zap, 'media tensión'),
    point('electrical', 'mt_cell_transformation', 'Celda transformación MT', Zap, 'media tensión'),
    point('electrical', 'outlet', 'Tomacorriente', Plug, 'enchufe toma'),
    point('electrical', 'earth_pit', 'Pozo de tierra', CircleDot, 'pat puesta'),
    // Cableado
    {
        key: 'wiring:circuit',
        category: 'wiring',
        label: 'Cablear',
        icon: Cable,
        keywords: 'cable circuito aéreo subterráneo',
        isActive: (editor) => editor.activeTool === 'draw_circuit',
        run: (editor) => editor.startCircuitTool(),
    },
    point('wiring', 'cable_vault', 'Buzón de registro', Archive, 'buzon'),
    point('wiring', 'pull_box', 'Caja de pase', Square, 'caja'),
    // Iluminación
    point('lighting', 'pole', 'Poste de alumbrado', MapPin, 'luminaria farola'),
    polygon('lighting', 'canopy', 'Techado con luminarias', Building2, 'cubierta'),
];

const CATEGORY_STORAGE_KEY = 'dialux:palette:category';

function loadCategory(): CategoryId {
    try {
        const stored = localStorage.getItem(CATEGORY_STORAGE_KEY);
        if (stored && CATEGORIES.some((item) => item.id === stored)) {
            return stored as CategoryId;
        }
    } catch {
        /* almacenamiento no disponible */
    }
    return 'terrain';
}

/** Categoría activa de la paleta (compartida: Propiedades puede abrir "Iluminación"). */
export const useSitePaletteStore = create<{
    category: CategoryId;
    setCategory: (category: CategoryId) => void;
}>((set) => ({
    category: loadCategory(),
    setCategory: (category) => {
        try {
            localStorage.setItem(CATEGORY_STORAGE_KEY, category);
        } catch {
            /* almacenamiento no disponible */
        }
        set({ category });
    },
}));


function ToolTile({
    tool,
    editor,
    showCategory = false,
}: {
    tool: ToolDef;
    editor: UseSiteEditorReturn;
    showCategory?: boolean;
}) {
    const active = tool.isActive(editor);
    const Icon = tool.icon;
    return (
        <button
            type="button"
            onClick={() => tool.run(editor)}
            title={tool.label}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-center text-[10px] leading-tight font-medium ${
                active
                    ? 'border-amber-400 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5'
            }`}
        >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{tool.label}</span>
            {showCategory && (
                <span className="text-[9px] text-slate-400">
                    {CATEGORIES.find((item) => item.id === tool.category)?.label}
                </span>
            )}
        </button>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="space-y-1.5">
            <p className="px-0.5 text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                {title}
            </p>
            {children}
        </div>
    );
}

export function SitePalette({ editor, lighting }: Props) {
    const category = useSitePaletteStore((state) => state.category);
    const setStoredCategory = useSitePaletteStore((state) => state.setCategory);
    const [query, setQuery] = useState('');
    const setCategory = (next: CategoryId) => {
        setStoredCategory(next);
        setQuery('');
    };
    const visible = TOOLS.filter((tool) => tool.isVisible?.(editor) ?? true);
    const needle = query.trim().toLowerCase();
    const matches = needle
        ? visible.filter((tool) =>
              `${tool.label} ${tool.keywords ?? ''}`.toLowerCase().includes(needle),
          )
        : visible.filter((tool) => tool.category === category);
    const activeCategoryOfTool = visible.find((tool) => tool.isActive(editor))?.category;
    const current = CATEGORIES.find((item) => item.id === category)!;

    return (
        <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-white lg:w-72 lg:flex-row lg:border-r lg:border-b-0 dark:border-white/10 dark:bg-[#101218]">
            {/* Riel de categorías */}
            <nav
                aria-label="Categorías de herramientas"
                className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-slate-200 p-1 lg:w-16 lg:flex-col lg:overflow-y-auto lg:border-r lg:border-b-0 dark:border-white/10"
            >
                <button
                    type="button"
                    onClick={() => editor.startTool('select')}
                    title="Seleccionar (Esc)"
                    className={`flex shrink-0 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[9px] font-semibold ${
                        editor.activeTool === 'select'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                            : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5'
                    }`}
                >
                    <MousePointer2 className="h-4 w-4" />
                    Selec.
                </button>
                <div className="my-0.5 border-t border-slate-200 dark:border-white/10" />
                {CATEGORIES.map((item) => {
                    const Icon = item.icon;
                    const selected = !needle && item.id === category;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setCategory(item.id)}
                            title={item.label}
                            className={`relative flex shrink-0 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[9px] font-semibold ${
                                selected
                                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5'
                            }`}
                        >
                            <Icon className="h-4 w-4" />
                            {item.label}
                            {activeCategoryOfTool === item.id && (
                                <span
                                    className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-500"
                                    title="Herramienta activa en esta categoría"
                                />
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Contenido de la categoría */}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
                <label className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 dark:border-white/10">
                    <Search className="h-3.5 w-3.5 text-slate-400" />
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Buscar herramienta…"
                        className="w-full bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
                    />
                </label>

                <p className="px-0.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                    {needle ? `Resultados (${matches.length})` : current.label}
                </p>

                {matches.length > 0 && (
                    <div className="grid grid-cols-2 gap-1.5">
                        {matches.map((tool) => (
                            <ToolTile
                                key={tool.key}
                                tool={tool}
                                editor={editor}
                                showCategory={Boolean(needle)}
                            />
                        ))}
                    </div>
                )}

                {!needle && category === 'terrain' && (
                    <TerrainExtras editor={editor} />
                )}
                {!needle && category === 'electrical' && (
                    <Section title="Alimentador de la red">
                        <FeederTool editor={editor} />
                    </Section>
                )}
                {!needle && category === 'wiring' && (
                    <p className="px-0.5 text-[10px] leading-relaxed text-slate-400">
                        Empieza sobre un poste, tomacorriente, tablero,
                        transformador, portón, techado, celda MT, buzón o caja
                        de pase; recorre los objetos con clics (clic derecho =
                        tramo subterráneo) y termina con doble clic o Enter.
                        Su resultado (CT/ΔU) aparece al seleccionar el cable.
                    </p>
                )}
                {!needle && category === 'lighting' && (
                    <LightingSection editor={editor} lighting={lighting} />
                )}
                {!needle && category === 'settings' && (
                    <SettingsSection editor={editor} />
                )}
            </div>
        </aside>
    );
}

/**
 * Iluminación: calcular con el motor V1, falsos colores, superficies de
 * cálculo (un clic las selecciona) y la proyección de luminarias del área
 * seleccionada — todo en un solo lugar visible.
 */
function LightingSection({ editor, lighting }: Props) {
    const areas = (editor.siteData?.elements ?? []).filter(
        (element) =>
            SITE_CALCULATION_AREA_TYPES.has(element.type) &&
            element.visible !== false &&
            element.vertices.length >= 3,
    );
    const selected = areas.find((area) => area.id === editor.selectedElementId);
    const results = new Map(
        (lighting?.calculation?.areas ?? []).map((area) => [area.elementId, area]),
    );
    return (
        <>
            {lighting && (
                <Section title="Cálculo (motor V1)">
                    <button
                        type="button"
                        onClick={lighting.run}
                        disabled={lighting.running}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-2 py-2 text-[11px] font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                    >
                        <Calculator
                            className={`h-4 w-4 ${lighting.running ? 'animate-spin' : ''}`}
                        />
                        {lighting.running ? 'Calculando…' : 'Calcular alumbrado'}
                    </button>
                    {lighting.calculation && (
                        <button
                            type="button"
                            onClick={() => lighting.setShowIsolux(!lighting.showIsolux)}
                            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                        >
                            {lighting.showIsolux ? (
                                <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                                <Eye className="h-3.5 w-3.5" />
                            )}
                            {lighting.showIsolux
                                ? 'Ocultar falsos colores'
                                : 'Ver falsos colores'}
                        </button>
                    )}
                    {lighting.stale && (
                        <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            La planta cambió: vuelve a calcular.
                        </p>
                    )}
                </Section>
            )}

            <Section title={`Superficies de cálculo (${areas.length})`}>
                {areas.length === 0 ? (
                    <p className="text-[10px] leading-relaxed text-slate-400">
                        Dibuja una cancha, estacionamiento, calle, vereda,
                        jardín, zona, plataforma o techado (categorías
                        Espacios / Edificación) para calcular y proyectar
                        luminarias sobre ella.
                    </p>
                ) : (
                    <ul className="space-y-0.5">
                        {areas.map((area) => {
                            const result = results.get(area.id);
                            const isSelected = area.id === editor.selectedElementId;
                            return (
                                <li key={area.id}>
                                    <button
                                        type="button"
                                        onClick={() => editor.selectElements([area.id])}
                                        className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-[11px] ${
                                            isSelected
                                                ? 'bg-amber-100 font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                                                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
                                        }`}
                                    >
                                        <span className="truncate">{area.label}</span>
                                        <span className="shrink-0 text-[10px] text-slate-400">
                                            {result
                                                ? `${result.result.avg_lux.toFixed(1)} lx`
                                                : '—'}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Section>

            <Section title="Proyectar luminarias">
                {selected && LINEAR_SPACE_TYPES.has(selected.type) ? (
                    <SiteLinearProjectionPanel
                        key={selected.id}
                        element={selected}
                        editor={editor}
                    />
                ) : selected ? (
                    <SiteProjectionPanel
                        key={selected.id}
                        element={selected}
                        editor={editor}
                    />
                ) : (
                    <p className="text-[10px] leading-relaxed text-slate-400">
                        Elige una superficie de la lista (o haz clic sobre ella
                        en el plano) para proyectar sus luminarias como en la
                        V1: método de lúmenes → grilla → ajuste con el motor V1.
                    </p>
                )}
            </Section>
        </>
    );
}

function TerrainExtras({ editor }: { editor: UseSiteEditorReturn }) {
    const layer = editor.siteData?.layers.find(
        (candidate) => candidate.id === 'layer-topography',
    );
    return (
        <Section title="Topografía">
            {layer && (
                <button
                    type="button"
                    onClick={() => editor.toggleSiteLayer(layer.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                >
                    {layer.visible ? (
                        <EyeOff className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                        <Eye className="h-3.5 w-3.5 shrink-0" />
                    )}
                    {layer.visible ? 'Ocultar topografía' : 'Mostrar topografía'}
                </button>
            )}
            {editor.topographyCount > 0 && (
                <button
                    type="button"
                    onClick={() => {
                        if (
                            window.confirm(
                                `¿Borrar las ${editor.topographyCount} curvas/puntos de topografía?`,
                            )
                        )
                            editor.clearTopography();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                >
                    <Trash2 className="h-3.5 w-3.5 shrink-0" />
                    Borrar topografía ({editor.topographyCount})
                </button>
            )}
        </Section>
    );
}

function SettingsSection({ editor }: { editor: UseSiteEditorReturn }) {
    return (
        <Section title="Edición">
            <label
                title="Terreno, cerco, plataformas y topografía quedan bloqueados (no se mueven por un clic o arrastre al dibujar encima). Se bloquean solos al crear el primer objeto que no es base. Para editarlos: desmarca esto y elígelos en la lista de Objetos."
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:border-white/10 dark:text-slate-300"
            >
                <input
                    type="checkbox"
                    checked={editor.baseLockActive}
                    onChange={(event) => editor.setBaseLocked(event.target.checked)}
                />
                Base bloqueada (terreno, cerco, plataformas)
            </label>
            <label
                title="Los objetos que ocupan área (rampas, escaleras, edificios, canchas, estacionamientos…) no se dibujan ni se arrastran encima de otros: el punto se corre al borde del vecino."
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:border-white/10 dark:text-slate-300"
            >
                <input
                    type="checkbox"
                    checked={editor.respectSpaces}
                    onChange={(event) => editor.setRespectSpaces(event.target.checked)}
                />
                Respetar espacios (no superponer)
            </label>
        </Section>
    );
}

/**
 * Vincula un trazado nuevo (`draw_feeder`) a un alimentador concreto de la
 * red eléctrica v2 — la lista viene de `useNetworkSnapshotForSite` (mismo
 * endpoint que el diagrama de red, en modo lectura). Elegir un alimentador
 * arranca la herramienta de dibujo; el usuario hace clic en el plano para
 * trazar el recorrido y cierra con doble clic.
 */
function FeederTool({ editor }: { editor: UseSiteEditorReturn }) {
    if (editor.networkEdgesLoading) {
        return (
            <p className="mt-1 px-1 text-[10px] text-slate-400">
                Cargando alimentadores…
            </p>
        );
    }
    if (editor.networkEdges.length === 0) {
        return (
            <p className="mt-1 px-1 text-[10px] text-slate-400">
                Conecta tableros en el diagrama de red para poder trazarlos
                aquí.
            </p>
        );
    }
    const active = editor.activeTool === 'draw_feeder';
    return (
        <select
            title="Trazar alimentador"
            className={`mt-1 w-full rounded-lg border px-2 py-1.5 text-[11px] font-medium outline-none ${
                active
                    ? 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-transparent dark:text-slate-300'
            }`}
            value={active ? (editor.pendingNetworkEdgeId ?? '') : ''}
            onChange={(event) => {
                if (event.target.value) editor.startFeederTool(event.target.value);
            }}
        >
            <option value="">Trazar alimentador…</option>
            {editor.networkEdges.map((edge) => (
                <option key={edge.id} value={edge.id}>
                    {edge.label}
                </option>
            ))}
        </select>
    );
}
