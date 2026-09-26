import { luxColor } from '../domain/exteriorLighting';
import {
    areaIsolines,
    formatIsoluxLevel,
    labelPoint,
} from '../domain/isoluxContours';
import type { SiteLightingAreaResult } from '../domain/siteLightingCalculation';
import type { SiteLightingCalculation } from '../domain/siteLightingCalculation';
import { requiredLuxFor } from '../domain/siteLightingNorms';
import type { SiteData } from '../domain/types';
import type { Point2D } from '../domain/types';
import { activeRegions } from './SiteNormPanels';

const LEGEND_STOPS = [0, 1, 5, 10, 20, 50, 100];


function rgba(lux: number): string {
    const [r, g, b, a] = luxColor(lux);
    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${Math.max(0.35, a)})`;
}

/**
 * Falsos colores de la iluminancia calculada con el motor V1 sobre la planta
 * 2D (como la vista de isolíneas/falsos colores de DIALux): una celda por
 * punto de la malla de cada superficie de cálculo, con la MISMA escala de
 * color que el mapa de lux del 3D (`luxColor`). Dibuja cada PARCHE de la
 * superficie (terreno con desnivel, zona sobre varias plataformas); los
 * puntos que son de otra superficie vienen en `null` y no se repiten. No
 * captura clics.
 */
export function IsoluxLayer({
    calculation,
    focusedAreaId,
    scaleM,
    toScreen,
    showIsolines = true,
    site,
}: {
    calculation: SiteLightingCalculation;
    focusedAreaId: string | null;
    scaleM: number;
    toScreen: (point: Point2D) => Point2D;
    /** Curvas isolux con su valor, sobre los falsos colores. */
    showIsolines?: boolean;
    /** Planta (para la norma de cada espacio: su curva de Ē exigido). */
    site?: SiteData;
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
            {areas.flatMap((area) =>
                area.patches.map((patch, patchIndex) => ({ area, patch, patchIndex })),
            ).map(({ area, patch, patchIndex }) => {
                const r = patch.result;
                const ox = r.grid_origin_x ?? 0;
                const oy = r.grid_origin_y ?? 0;
                const cw = r.grid_cell_width ?? 0;
                const ch = r.grid_cell_height ?? 0;
                if (cw <= 0 || ch <= 0) return null;
                return (
                    <g key={`${area.elementId}:${patchIndex}`}>
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
            {showIsolines &&
                areas.flatMap((area) => {
                    // Curvas POR ESPACIO: niveles de su propio rango + la curva
                    // del Ē exigido por su norma (elegida o sugerida).
                    const element = site?.elements.find((item) => item.id === area.elementId);
                    const required = site
                        ? requiredLuxFor(element, activeRegions(site), area.summary)
                        : null;
                    const iso = areaIsolines(
                        area.patches.map((patch) => patch.result),
                        required?.lux ?? null,
                    );
                    return iso.lines.map((line, lineIndex) => {
                        const points = line.points.map((p) => screen(p.x, p.y)).join(' ');
                        const label = labelPoint(line);
                        const at = toScreen({ x: label.x / scaleM, y: label.y / scaleM });
                        return (
                            <g key={`iso-${area.elementId}-${lineIndex}`}>
                                <polyline
                                    points={points}
                                    fill="none"
                                    stroke={line.required ? '#dc2626' : '#0f172a'}
                                    strokeOpacity={line.required ? 0.95 : 0.75}
                                    strokeWidth={line.required ? 2.2 : 1.1}
                                    strokeDasharray={line.required ? '6 3' : undefined}
                                />
                                {(line.points.length >= 6 || line.required) && (
                                    <text
                                        x={at.x}
                                        y={at.y}
                                        fontSize={line.required ? 10 : 9}
                                        fontWeight={700}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        fill={line.required ? '#b91c1c' : '#0f172a'}
                                        stroke="#ffffff"
                                        strokeWidth={2.5}
                                        paintOrder="stroke"
                                    >
                                        {formatIsoluxLevel(line.level)}
                                        {line.required ? ' lx norma' : ''}
                                    </text>
                                )}
                            </g>
                        );
                    });
                })}
        </g>
    );
}

/** Leyenda de la escala de lux (HTML, fuera del SVG). */
export function IsoluxLegend({
    focus,
}: {
    /** Espacio enfocado (clic en la tabla): sus niveles de curvas y su norma. */
    focus?: { label: string; levels: number[]; required: ReturnType<typeof requiredLuxFor> } | null;
} = {}) {
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
            {focus && (
                <div className="mt-1 max-w-36 border-t border-slate-200 pt-1 dark:border-white/10">
                    <p className="font-semibold">{focus.label}</p>
                    <p>Curvas: {focus.levels.map(formatIsoluxLevel).join(' · ') || '—'} lx</p>
                    {focus.required ? (
                        <p className="font-semibold text-red-700 dark:text-red-400">
                            - - {formatIsoluxLevel(focus.required.lux)} lx norma
                            {focus.required.suggested ? ' (sugerida)' : ''}
                        </p>
                    ) : (
                        <p className="text-slate-400">Sin norma aplicable</p>
                    )}
                </div>
            )}
        </div>
    );
}

/** Datos de la leyenda de un espacio enfocado. */
export function focusLegendData(
    site: SiteData | undefined,
    area: SiteLightingAreaResult | undefined,
) {
    if (!site || !area) return null;
    const element = site.elements.find((item) => item.id === area.elementId);
    const required = requiredLuxFor(element, activeRegions(site), area.summary);
    return {
        label: area.label,
        levels: areaIsolines(area.patches.map((patch) => patch.result), required?.lux ?? null).levels,
        required,
    };
}
