import {
    Building2,
    ChevronDown,
    DoorOpen,
    Fence,
    FileSpreadsheet,
    Fingerprint,
    Footprints,
    Hexagon,
    MapPin,
    Mountain,
    MousePointer2,
    ParkingSquare,
    Ruler,
    Spline,
    TrendingUp,
    Trees,
    Upload,
    Waves,
    Zap,
} from 'lucide-react';
import { useState, type ComponentType, type ReactNode } from 'react';
import type { SiteElementType } from '../domain/types';
import type { UseSiteEditorReturn } from '../hooks/useSiteEditor';

interface Props {
    editor: UseSiteEditorReturn;
}

type IconType = ComponentType<{ className?: string }>;

function PaletteButton({
    icon: Icon,
    label,
    active,
    onClick,
}: {
    icon: IconType;
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

/** Grupo colapsable del panel. Recuerda su estado en `localStorage`. */
function PaletteGroup({
    id,
    title,
    children,
}: {
    id: string;
    title: string;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(() => {
        try {
            return localStorage.getItem(`dialux:palette:${id}`) !== 'closed';
        } catch {
            return true;
        }
    });
    const toggle = () => {
        setOpen((prev) => {
            const next = !prev;
            try {
                localStorage.setItem(
                    `dialux:palette:${id}`,
                    next ? 'open' : 'closed',
                );
            } catch {
                /* almacenamiento no disponible */
            }
            return next;
        });
    };
    return (
        <div>
            <button
                type="button"
                onClick={toggle}
                className="mb-1 flex w-full items-center justify-between px-1 text-[10px] font-bold tracking-wide text-slate-400 uppercase hover:text-slate-600 dark:hover:text-slate-200"
            >
                {title}
                <ChevronDown
                    className={`h-3 w-3 transition-transform ${open ? '' : '-rotate-90'}`}
                />
            </button>
            {open && <div>{children}</div>}
        </div>
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
    icon: IconType;
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
    icon: IconType;
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
        <aside className="w-full space-y-3 overflow-y-auto border-b border-slate-200 bg-white p-3 lg:w-56 lg:border-r lg:border-b-0 dark:border-white/10 dark:bg-[#101218]">
            <PaletteButton
                icon={MousePointer2}
                label="Seleccionar"
                active={editor.activeTool === 'select'}
                onClick={() => editor.startTool('select')}
            />

            <PaletteGroup id="plan" title="Plano importado">
                <PaletteButton
                    icon={Upload}
                    label="Importar DXF / DWG"
                    active={editor.planImportOpen}
                    onClick={editor.openPlanImport}
                />
                {editor.siteData?.importedPlan && (
                    <PaletteButton
                        icon={Ruler}
                        label="Calibrar plano"
                        active={editor.activeTool === 'calibrate_plan'}
                        onClick={editor.startCalibratePlan}
                    />
                )}
            </PaletteGroup>

            <PaletteGroup id="terrain" title="Terreno">
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
            </PaletteGroup>

            <PaletteGroup id="topography" title="Topografía">
                <PaletteButton
                    icon={Spline}
                    label="Curva de nivel"
                    active={editor.activeTool === 'draw_contour'}
                    onClick={() => editor.startTool('draw_contour', 'contour')}
                />
                <PaletteButton
                    icon={Mountain}
                    label="Punto acotado"
                    active={
                        editor.activeTool === 'place_spot' &&
                        editor.pendingType === 'spot_elevation'
                    }
                    onClick={() =>
                        editor.startTool('place_spot', 'spot_elevation')
                    }
                />
                {editor.siteData?.importedPlan && (
                    <PaletteButton
                        icon={Upload}
                        label="Extraer del plano CAD"
                        active={editor.contourImportOpen}
                        onClick={editor.openContourImport}
                    />
                )}
                <PaletteButton
                    icon={FileSpreadsheet}
                    label="Importar levantamiento"
                    active={editor.surveyImportOpen}
                    onClick={editor.openSurveyImport}
                />
            </PaletteGroup>

            <PaletteGroup id="building" title="Edificación">
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
                <PolygonTool
                    editor={editor}
                    type="stair"
                    icon={Footprints}
                    label="Escalera"
                />
                <PolygonTool
                    editor={editor}
                    type="ramp"
                    icon={TrendingUp}
                    label="Rampa"
                />
            </PaletteGroup>

            <PaletteGroup id="installations" title="Instalaciones">
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
            </PaletteGroup>

            <PaletteGroup id="electrical" title="Red eléctrica">
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
            </PaletteGroup>
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
