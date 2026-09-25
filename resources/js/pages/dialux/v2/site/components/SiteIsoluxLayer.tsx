import { luxColor } from '../domain/exteriorLighting';
import type { SiteLightingCalculation } from '../domain/siteLightingCalculation';
import type { Point2D } from '../domain/types';

const LEGEND_STOPS = [0, 1, 5, 10, 20, 50, 100];

function rgba(lux: number): string {
    const [r, g, b, a] = luxColor(lux);
    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${Math.max(0.35, a)})`;
}

/**
 * Falsos colores de la iluminancia calculada con el motor V1 sobre la planta
 * 2D (como la vista de isolíneas/falsos colores de DIALux): una celda por
 * punto de la malla de cada superficie de cálculo, con la MISMA escala de
 * color que el mapa de lux del 3D (`luxColor`). No captura clics.
 */
export function IsoluxLayer({
    calculation,
    focusedAreaId,
    scaleM,
    toScreen,
}: {
    calculation: SiteLightingCalculation;
    focusedAreaId: string | null;
    scaleM: number;
    toScreen: (point: Point2D) => Point2D;
}) {
    const areas = focusedAreaId
        ? calculation.areas.filter((area) => area.elementId === focusedAreaId)
        : calculation.areas;
    // Malla en metros → unidades de plano → pantalla.
    const screen = (xM: number, yM: number) => {
        const p = toScreen({ x: xM / scaleM, y: yM / scaleM });
        return `${p.x},${p.y}`;
    };

    return (
        <g className="pointer-events-none" aria-hidden>
            {areas.map((area) => {
                const r = area.result;
                const ox = r.grid_origin_x ?? 0;
                const oy = r.grid_origin_y ?? 0;
                const cw = r.grid_cell_width ?? 0;
                const ch = r.grid_cell_height ?? 0;
                if (cw <= 0 || ch <= 0) return null;
                return (
                    <g key={area.elementId}>
                        {r.grid_values.map((value, index) => {
                            if (value === null) return null;
                            const row = Math.floor(index / r.grid_cols);
                            const col = index % r.grid_cols;
                            const x0 = ox + col * cw;
                            const y0 = oy + row * ch;
                            return (
                                <polygon
                                    key={index}
                                    points={`${screen(x0, y0)} ${screen(x0 + cw, y0)} ${screen(x0 + cw, y0 + ch)} ${screen(x0, y0 + ch)}`}
                                    fill={rgba(value)}
                                />
                            );
                        })}
                    </g>
                );
            })}
        </g>
    );
}

/** Leyenda de la escala de lux (HTML, fuera del SVG). */
export function IsoluxLegend() {
    return (
        <div className="pointer-events-none absolute top-12 right-2 z-10 rounded-md border border-slate-200 bg-white/90 px-2 py-1 text-[9px] text-slate-600 shadow dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-300">
            <p className="mb-0.5 font-semibold">Iluminancia (lx)</p>
            {LEGEND_STOPS.map((lux, index) => (
                <div key={lux} className="flex items-center gap-1">
                    <span
                        className="inline-block h-2.5 w-4 rounded-sm"
                        style={{ background: rgba(lux) }}
                    />
                    {index === LEGEND_STOPS.length - 1 ? `≥ ${lux}` : lux}
                </div>
            ))}
        </div>
    );
}
