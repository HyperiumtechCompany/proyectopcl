import {
    Building2,
    DoorOpen,
    Fence,
    Fingerprint,
    Hexagon,
    MapPin,
    MousePointer2,
    ParkingSquare,
    Trees,
    Waves,
    Zap,
} from 'lucide-react';
import type { SiteElementType } from '../domain/types';
import type { UseSiteEditorReturn } from '../hooks/useSiteEditor';

interface Props {
    editor: UseSiteEditorReturn;
}

function PaletteButton({
    icon: Icon,
    label,
    active,
    onClick,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-medium ${
                active
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
            }`}
        >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {label}
        </button>
    );
}

function PolygonTool({
    editor,
    type,
    icon,
    label,
}: {
    editor: UseSiteEditorReturn;
    type: SiteElementType;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
}) {
    const active =
        editor.activeTool === 'draw_polygon' && editor.pendingType === type;
    return (
        <PaletteButton
            icon={icon}
            label={label}
            active={active}
            onClick={() => editor.startTool('draw_polygon', type)}
        />
    );
}

function PointTool({
    editor,
    type,
    icon,
    label,
}: {
    editor: UseSiteEditorReturn;
    type: SiteElementType;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
}) {
    const active =
        editor.activeTool === 'place_tg' && editor.pendingType === type;
    return (
        <PaletteButton
            icon={icon}
            label={label}
            active={active}
            onClick={() => editor.startTool('place_tg', type)}
        />
    );
}

export function SitePalette({ editor }: Props) {
    return (
        <aside className="w-full space-y-4 overflow-y-auto border-b border-slate-200 bg-white p-3 lg:w-56 lg:border-r lg:border-b-0 dark:border-white/10 dark:bg-[#101218]">
            <div>
                <p className="mb-1 px-1 text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                    Herramientas
                </p>
                <PaletteButton
                    icon={MousePointer2}
                    label="Seleccionar"
                    active={editor.activeTool === 'select'}
                    onClick={() => editor.startTool('select')}
                />
            </div>

            <div>
                <p className="mb-1 px-1 text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                    Terreno
                </p>
                <PolygonTool
                    editor={editor}
                    type="terrain"
                    icon={Hexagon}
                    label="Terreno / Lote"
                />
                <PolygonTool
                    editor={editor}
                    type="street"
                    icon={Fingerprint}
                    label="Calle / Vereda"
                />
                <PolygonTool
                    editor={editor}
                    type="green_area"
                    icon={Trees}
                    label="Área verde"
                />
            </div>

            <div>
                <p className="mb-1 px-1 text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                    Edificaciones
                </p>
                <PolygonTool
                    editor={editor}
                    type="building_block"
                    icon={Building2}
                    label="Bloque edificio"
                />
                <PolygonTool
                    editor={editor}
                    type="fence"
                    icon={Fence}
                    label="Cerco / Muro"
                />
                <PointTool
                    editor={editor}
                    type="gate"
                    icon={DoorOpen}
                    label="Portón / Acceso"
                />
            </div>

            <div>
                <p className="mb-1 px-1 text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                    Instalaciones
                </p>
                <PolygonTool
                    editor={editor}
                    type="pool"
                    icon={Waves}
                    label="Piscina"
                />
                <PolygonTool
                    editor={editor}
                    type="court"
                    icon={Hexagon}
                    label="Cancha deportiva"
                />
                <PolygonTool
                    editor={editor}
                    type="parking"
                    icon={ParkingSquare}
                    label="Estacionamiento"
                />
            </div>

            <div>
                <p className="mb-1 px-1 text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                    Red eléctrica
                </p>
                <PointTool
                    editor={editor}
                    type="tg_location"
                    icon={Zap}
                    label="Tablero General"
                />
                <PointTool
                    editor={editor}
                    type="transformer"
                    icon={Zap}
                    label="Transformador"
                />
                <PointTool
                    editor={editor}
                    type="pole"
                    icon={MapPin}
                    label="Poste exterior"
                />
                <FeederTool editor={editor} />
            </div>
        </aside>
    );
}

/**
 * Vincula un trazado nuevo (`draw_feeder`) a un alimentador concreto de la
 * red eléctrica v2 — la lista viene de `useNetworkSnapshotForSite` (mismo
 * endpoint que el diagrama de red, en modo lectura). Elegir un alimentador
 * arranca la herramienta de dibujo; el usuario hace clic en el plano para
 * trazar el recorrido y cierra con doble clic.
 */
function FeederTool({ editor }: Props) {
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
                if (event.target.value)
                    editor.startFeederTool(event.target.value);
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
